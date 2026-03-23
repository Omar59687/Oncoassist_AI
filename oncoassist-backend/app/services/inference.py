from __future__ import annotations

import io
import logging
import pickle
import time
from pathlib import Path
from typing import Any, Callable

import numpy as np
import pandas as pd
from fastapi import HTTPException, UploadFile
from sklearn.inspection import permutation_importance
from sklearn.metrics import auc, roc_curve
from sklearn.preprocessing import RobustScaler

logger = logging.getLogger(__name__)


class InferenceService:
    def __init__(self) -> None:
        self._model: Any | None = None
        self._scaler: Any | None = None
        self._encoder: Any | None = None
        self._feature_order: list[str] | None = None
        self._gdsc_df: pd.DataFrame | None = None
        self._model_path: Path | None = None
        self._using_fallback_scaler = False
        self._fallback_scaler_by_dim: dict[int, RobustScaler] = {}

    def _candidate_model_dirs(self) -> list[Path]:
        backend_dir = Path(__file__).resolve().parents[2]
        project_root = backend_dir.parent
        return [
            project_root / "models",
            project_root / "model",
            backend_dir / "models",
            backend_dir / "model",
        ]

    def _locate_model(self) -> Path:
        for model_dir in self._candidate_model_dirs():
            if not model_dir.exists():
                continue
            candidates = sorted(model_dir.glob("*.pkl"))
            if candidates:
                return candidates[0]

        raise RuntimeError(
            "No pickle model found. Expected a .pkl file in models/ (or model/) directory."
        )

    def _candidate_data_dirs(self) -> list[Path]:
        backend_dir = Path(__file__).resolve().parents[2]
        project_root = backend_dir.parent
        return [
            project_root / "gdsc",
            project_root / "data",
            project_root,
            backend_dir / "data",
            backend_dir,
        ]

    @staticmethod
    def _safe_pickle_load(path: Path) -> Any:
        with path.open("rb") as fh:
            return pickle.load(fh)

    def _artifact_candidates(self) -> list[Path]:
        backend_dir = Path(__file__).resolve().parents[2]
        project_root = backend_dir.parent
        candidates: list[Path] = []
        ignored_parts = {"venv", "node_modules", ".git", ".ruff_cache", "__pycache__"}

        for root in [project_root / "models", project_root / "model", project_root]:
            if not root.exists():
                continue
            for pattern in ("*.pkl", "*.joblib", "*.h5"):
                for file_path in sorted(root.rglob(pattern)):
                    if any(part in ignored_parts for part in file_path.parts):
                        continue
                    candidates.append(file_path)

        return candidates

    def _load_artifact_file(self, path: Path) -> Any:
        suffix = path.suffix.lower()

        if suffix == ".pkl":
            return self._safe_pickle_load(path)

        if suffix == ".joblib":
            import joblib

            return joblib.load(path)

        if suffix == ".h5":
            from tensorflow.keras.models import load_model

            return load_model(path)

        raise ValueError(f"Unsupported artifact format: {path}")

    def _discover_aux_artifacts(self, model_path: Path) -> None:
        for artifact in self._artifact_candidates():
            if artifact == model_path:
                continue

            lower_name = artifact.name.lower()
            try:
                loaded = self._load_artifact_file(artifact)
            except Exception:
                logger.exception("Skipping unreadable artifact: %s", artifact)
                continue

            if "scaler" in lower_name and hasattr(loaded, "transform"):
                self._scaler = loaded
                continue

            if ("encoder" in lower_name or "autoencoder" in lower_name) and (
                hasattr(loaded, "predict") or hasattr(loaded, "transform")
            ):
                self._encoder = loaded
                continue

            if "feature" in lower_name and isinstance(loaded, (list, tuple)):
                self._feature_order = [str(item) for item in loaded]

    def _load_gdsc(self) -> pd.DataFrame | None:
        if self._gdsc_df is not None:
            return self._gdsc_df

        candidates: list[Path] = []
        for data_dir in self._candidate_data_dirs():
            if not data_dir.exists():
                continue
            for csv_file in data_dir.rglob("*.csv"):
                name = csv_file.name.lower()
                parent = str(csv_file.parent).lower()
                if "gdsc" in name or "drug" in name or "gdsc" in parent:
                    candidates.append(csv_file)

        if not candidates:
            return None

        for path in sorted(candidates):
            try:
                df = pd.read_csv(path)
            except Exception:
                logger.exception("Could not load GDSC candidate: %s", path)
                continue

            if not df.empty:
                self._gdsc_df = df
                return df

        return None

    def _load_model(self) -> Any:
        if self._model is not None:
            return self._model

        model_path = self._locate_model()
        self._model = self._safe_pickle_load(model_path)
        self._model_path = model_path
        self._discover_aux_artifacts(model_path)
        self._load_gdsc()
        return self._model

    def startup_load_assets(self) -> None:
        self._load_model()

    @staticmethod
    async def _read_csv(file: UploadFile, field_name: str) -> pd.DataFrame:
        if file is None:
            raise HTTPException(
                status_code=422, detail=f"Missing required file: {field_name}"
            )

        filename = (file.filename or "").lower()
        if not filename.endswith(".csv"):
            raise HTTPException(
                status_code=422,
                detail=f"{field_name} must be a CSV file.",
            )

        try:
            await file.seek(0)
            content = await file.read()
            if not content or not content.strip():
                raise HTTPException(
                    status_code=422,
                    detail=f"{field_name} CSV is empty.",
                )

            stream = io.StringIO(content.decode("utf-8"))
            parsed = pd.read_csv(stream)
            if parsed.empty:
                raise HTTPException(
                    status_code=422,
                    detail=f"{field_name} CSV has no rows.",
                )

            return parsed
        except HTTPException:
            raise
        except Exception as exc:  # pragma: no cover
            raise HTTPException(
                status_code=422,
                detail=f"Failed to parse {field_name} as CSV.",
            ) from exc

    @staticmethod
    def _extract_features(
        df: pd.DataFrame, source_name: str
    ) -> tuple[np.ndarray, list[str]]:
        if df.empty:
            raise HTTPException(status_code=422, detail=f"{source_name} CSV is empty.")

        id_like_columns = [
            col
            for col in df.columns
            if str(col).strip().lower() in {"id", "sample_id", "patient_id"}
            or str(col).strip().lower().endswith("_id")
        ]
        cleaned = df.drop(columns=id_like_columns, errors="ignore")

        numeric = cleaned.apply(pd.to_numeric, errors="coerce").dropna(
            axis=1, how="all"
        )
        if numeric.empty:
            raise HTTPException(
                status_code=422,
                detail=f"{source_name} CSV has no usable numeric features.",
            )

        numeric = numeric.fillna(numeric.median(numeric_only=True)).fillna(0.0)
        feature_values = numeric.mean(axis=0).to_numpy(dtype=np.float32, copy=False)
        feature_names = [str(col) for col in numeric.columns]

        if feature_values.size == 0:
            raise HTTPException(
                status_code=422,
                detail=f"{source_name} CSV produced an empty feature vector.",
            )

        return feature_values, feature_names

    @staticmethod
    def _feature_count_from_model(model: Any) -> int | None:
        input_shape = getattr(model, "input_shape", None)
        if input_shape is None:
            return None

        try:
            if isinstance(input_shape, list):
                return int(input_shape[0][-1])
            return int(input_shape[-1])
        except Exception:
            return None

    @staticmethod
    def _align_to_expected(
        values: np.ndarray,
        names: list[str],
        feature_order: list[str] | None,
    ) -> tuple[np.ndarray, list[str]]:
        if feature_order:
            mapping = {name: values[idx] for idx, name in enumerate(names)}
            ordered = np.array(
                [mapping.get(name, 0.0) for name in feature_order], dtype=np.float32
            )
            return ordered, feature_order

        return values, names

    @staticmethod
    def _make_clinical_note(prediction_label: str, confidence: float) -> str:
        if prediction_label.lower().startswith("high"):
            return (
                "Patient data suggests high tumor mutational burden. "
                "May benefit from checkpoint inhibitor immunotherapy such as "
                "Pembrolizumab or Nivolumab. Recommend oncologist review."
            )
        return (
            "Patient data suggests low tumor mutational burden. "
            "Immunotherapy response less likely. Consider standard chemotherapy "
            "protocols. Recommend oncologist review."
        )

    def _derive_clinical_note(
        self, prediction_label: str, confidence: float
    ) -> tuple[str, bool]:
        if 0.45 <= confidence <= 0.55:
            return (
                "Result is inconclusive. Model confidence is low. Clinical correlation "
                "and laboratory confirmation are strongly recommended before making "
                "treatment decisions.",
                True,
            )

        return self._make_clinical_note(prediction_label, confidence), False

    @staticmethod
    def _build_background_samples(sample: np.ndarray, size: int = 30) -> np.ndarray:
        rng = np.random.default_rng(123)
        sample = np.asarray(sample, dtype=np.float32).reshape(1, -1)
        scale = np.maximum(np.abs(sample), 1.0) * 0.03
        noise = rng.normal(loc=0.0, scale=scale, size=(size, sample.shape[1]))
        return np.asarray(sample + noise, dtype=np.float32)

    def _resolve_scaler(self, sample_row: np.ndarray) -> Any:
        if self._scaler is not None:
            self._using_fallback_scaler = False
            return self._scaler

        feature_count = int(np.asarray(sample_row).reshape(-1).size)
        cached = self._fallback_scaler_by_dim.get(feature_count)
        if cached is not None:
            self._using_fallback_scaler = True
            return cached

        fallback_scaler = RobustScaler()
        rng = np.random.default_rng(2026)
        reference = rng.normal(loc=0.0, scale=1.0, size=(256, feature_count))
        fallback_scaler.fit(reference)
        self._fallback_scaler_by_dim[feature_count] = fallback_scaler
        self._using_fallback_scaler = True
        return fallback_scaler

    @staticmethod
    def _apply_transform_if_available(transformer: Any, X: np.ndarray) -> np.ndarray:
        if transformer is None:
            return X

        if hasattr(transformer, "transform"):
            transformed = transformer.transform(X)
        elif hasattr(transformer, "predict"):
            try:
                transformed = transformer.predict(X, verbose=0)
            except TypeError:
                transformed = transformer.predict(X)
        else:
            return X

        return np.asarray(transformed, dtype=np.float32)

    @staticmethod
    def _compute_roc(prob_high: float) -> tuple[float, list[float], list[float]]:
        y_true = np.array([0, 1], dtype=np.int32)
        y_score = np.array([1.0 - prob_high, prob_high], dtype=np.float32)
        fpr, tpr, _ = roc_curve(y_true, y_score)
        auc_score = float(auc(fpr, tpr))
        return auc_score, [float(v) for v in fpr], [float(v) for v in tpr]

    @staticmethod
    def _resolve_prediction(prob_high: float) -> tuple[str, float, float]:
        prediction = "High-TMB" if prob_high >= 0.5 else "Low-TMB"
        confidence = max(prob_high, 1.0 - prob_high)
        return prediction, confidence, prob_high

    @staticmethod
    def _extract_prob_high(model_output: np.ndarray) -> float:
        output = np.asarray(model_output, dtype=np.float32).reshape(-1)
        if output.size == 0:
            raise HTTPException(
                status_code=500, detail="Model returned empty prediction."
            )

        raw_score = float(output[0])
        if 0.0 <= raw_score <= 1.0:
            return raw_score

        return 1.0 / (1.0 + np.exp(-raw_score))

    @staticmethod
    def _top_genes_from_weights(
        model: Any, feature_names: list[str]
    ) -> list[dict[str, float | str]]:
        if not hasattr(model, "layers") or not getattr(model, "layers", None):
            return []

        for layer in model.layers:
            weights = layer.get_weights()
            if not weights:
                continue

            kernel = np.asarray(weights[0])
            if kernel.ndim < 2 or kernel.shape[0] != len(feature_names):
                continue

            importance = np.abs(kernel).mean(axis=1)
            top_idx = np.argsort(importance)[::-1][:5]

            top_features: list[dict[str, float | str]] = []
            for idx in top_idx:
                top_features.append(
                    {
                        "name": feature_names[int(idx)],
                        "importance": float(importance[int(idx)]),
                    }
                )
            return top_features

        return []

    @staticmethod
    def _select_top_features(
        feature_names: list[str], importances: np.ndarray, top_k: int = 5
    ) -> list[dict[str, float | str]]:
        scores = np.abs(np.asarray(importances, dtype=np.float32)).reshape(-1)
        if scores.size != len(feature_names):
            return []

        top_idx = np.argsort(scores)[::-1][:top_k]
        return [
            {"name": feature_names[int(idx)], "importance": float(scores[int(idx)])}
            for idx in top_idx
        ]

    def _compute_shap_importance(
        self,
        predictor: Callable[[np.ndarray], np.ndarray],
        sample: np.ndarray,
        feature_names: list[str],
    ) -> list[dict[str, float | str]]:
        try:
            import shap  # type: ignore
        except Exception:
            return []

        start = time.perf_counter()
        try:
            background = self._build_background_samples(sample[0], size=30)
            explainer = shap.KernelExplainer(predictor, background)
            shap_values = explainer.shap_values(sample, nsamples=60)

            if isinstance(shap_values, list):
                shap_array = np.asarray(shap_values[-1], dtype=np.float32)
            else:
                shap_array = np.asarray(shap_values, dtype=np.float32)

            if shap_array.ndim > 1:
                shap_array = shap_array[0]

            top = self._select_top_features(feature_names, shap_array, top_k=5)
            elapsed = time.perf_counter() - start
            logger.info("SHAP importance computed in %.3fs", elapsed)
            return top
        except Exception:
            logger.exception("SHAP feature importance failed")
            return []

    def _compute_permutation_importance(
        self,
        predictor: Callable[[np.ndarray], np.ndarray],
        sample: np.ndarray,
        feature_names: list[str],
    ) -> list[dict[str, float | str]]:
        class _ModelProxy:
            def __init__(self, fn: Callable[[np.ndarray], np.ndarray]) -> None:
                self._fn = fn

            def fit(self, X: np.ndarray, y: np.ndarray) -> "_ModelProxy":
                return self

            def predict(self, X: np.ndarray) -> np.ndarray:
                probs = np.asarray(self._fn(X), dtype=np.float32)
                return (probs >= 0.5).astype(int)

            def score(self, X: np.ndarray, y: np.ndarray) -> float:
                preds = self.predict(X)
                return float(np.mean(preds == y))

        try:
            eval_X = self._build_background_samples(sample[0], size=8)
            proxy = _ModelProxy(predictor)
            pseudo_y = proxy.predict(eval_X)
            result = permutation_importance(
                proxy,
                eval_X,
                pseudo_y,
                n_repeats=1,
                random_state=42,
                scoring=None,
            )
            importances = np.asarray(result["importances_mean"], dtype=np.float32)
            if np.allclose(importances, 0.0):
                return []
            return self._select_top_features(feature_names, importances, top_k=5)
        except Exception:
            logger.exception("Permutation importance failed")
            return []

    def _compute_feature_importance(
        self,
        model: Any,
        sample: np.ndarray,
        feature_names: list[str],
        scaler: Any,
        encoder: Any,
    ) -> list[dict[str, float | str]]:
        def raw_predictor(X_raw: np.ndarray) -> np.ndarray:
            X_step = np.asarray(X_raw, dtype=np.float32)
            X_step = self._apply_transform_if_available(scaler, X_step)
            X_step = self._apply_transform_if_available(encoder, X_step)
            try:
                output = model.predict(X_step, verbose=0)
            except TypeError:
                output = model.predict(X_step)

            out = np.asarray(output, dtype=np.float32)
            if out.ndim == 2 and out.shape[1] > 1:
                return out[:, -1]
            raw = out.reshape(-1)
            if raw.size and (raw.min() < 0.0 or raw.max() > 1.0):
                return 1.0 / (1.0 + np.exp(-raw))
            return raw

        top = self._compute_shap_importance(raw_predictor, sample, feature_names)
        if top:
            return top

        top = self._compute_permutation_importance(raw_predictor, sample, feature_names)
        if top:
            return top

        return self._top_genes_from_weights(model, feature_names)

    @staticmethod
    def _recommend_drugs_from_fallback(prediction_label: str) -> list[dict[str, str]]:
        if prediction_label == "High-TMB":
            return [
                {
                    "name": "Pembrolizumab",
                    "target": "PD-1",
                    "pathway": "Immune Checkpoint",
                },
                {"name": "Nivolumab", "target": "PD-1", "pathway": "Immune Checkpoint"},
                {
                    "name": "Atezolizumab",
                    "target": "PD-L1",
                    "pathway": "Immune Checkpoint",
                },
                {
                    "name": "Ipilimumab",
                    "target": "CTLA-4",
                    "pathway": "Immune Checkpoint",
                },
                {
                    "name": "Durvalumab",
                    "target": "PD-L1",
                    "pathway": "Immune Checkpoint",
                },
            ]

        return [
            {"name": "Cisplatin", "target": "DNA Crosslink", "pathway": "Chemotherapy"},
            {
                "name": "Carboplatin",
                "target": "DNA Crosslink",
                "pathway": "Chemotherapy",
            },
            {"name": "Paclitaxel", "target": "Microtubules", "pathway": "Chemotherapy"},
            {"name": "Docetaxel", "target": "Microtubules", "pathway": "Chemotherapy"},
            {
                "name": "Gemcitabine",
                "target": "DNA Synthesis",
                "pathway": "Chemotherapy",
            },
        ]

    def _recommend_drugs(self, prediction_label: str) -> list[dict[str, str]]:
        gdsc = self._load_gdsc()
        if gdsc is None or gdsc.empty:
            return self._recommend_drugs_from_fallback(prediction_label)

        columns_map = {col.lower().strip(): col for col in gdsc.columns}

        name_col = next(
            (
                columns_map[key]
                for key in columns_map
                if key in {"name", "drug", "drug_name", "compound", "compound_name"}
            ),
            None,
        )
        target_col = next(
            (
                columns_map[key]
                for key in columns_map
                if key in {"target", "targets", "gene_target"}
            ),
            None,
        )
        pathway_col = next(
            (
                columns_map[key]
                for key in columns_map
                if key
                in {
                    "pathway",
                    "pathway_name",
                    "signaling_pathway",
                    "signalling_pathway",
                }
            ),
            None,
        )

        if name_col is None:
            return self._recommend_drugs_from_fallback(prediction_label)

        text_blob = (
            gdsc.fillna("")
            .astype(str)
            .apply(lambda row: " ".join(value.lower() for value in row.values), axis=1)
        )

        if prediction_label == "High-TMB":
            keywords = [
                "immun",
                "checkpoint",
                "pd-1",
                "pd-l1",
                "ctla-4",
                "nivolumab",
                "pembrolizumab",
            ]
        else:
            keywords = [
                "chemo",
                "cisplatin",
                "carboplatin",
                "paclitaxel",
                "docetaxel",
                "gemcitabine",
            ]

        mask = text_blob.apply(
            lambda text: any(keyword in text for keyword in keywords)
        )
        filtered = gdsc[mask].copy()
        if filtered.empty:
            filtered = gdsc.copy()

        recs: list[dict[str, str]] = []
        for _, row in filtered.head(5).iterrows():
            recs.append(
                {
                    "name": str(row.get(name_col, "Unknown")),
                    "target": str(row.get(target_col, "Unknown"))
                    if target_col
                    else "Unknown",
                    "pathway": str(row.get(pathway_col, "Unknown"))
                    if pathway_col
                    else "Unknown",
                }
            )

        if not recs:
            return self._recommend_drugs_from_fallback(prediction_label)

        return recs

    def _predict_label_and_confidence(
        self, model: Any, X: np.ndarray
    ) -> tuple[str, float, float]:
        if hasattr(model, "predict_proba"):
            probs = np.asarray(model.predict_proba(X), dtype=np.float32)
            if probs.ndim == 2 and probs.shape[1] > 1:
                prob_high = float(probs[0, -1])
            else:
                prob_high = float(probs.reshape(-1)[0])
        else:
            try:
                raw_prediction = model.predict(X, verbose=0)
            except TypeError:
                raw_prediction = model.predict(X)
            prob_high = self._extract_prob_high(raw_prediction)

        prediction_label, confidence, prob_high = self._resolve_prediction(prob_high)
        return prediction_label, confidence, prob_high

    async def get_sample_data(self) -> dict[str, Any]:
        model = self._load_model()
        expected = self._feature_count_from_model(model) or 82

        backend_dir = Path(__file__).resolve().parents[2]
        project_root = backend_dir.parent

        search_roots = [
            project_root / "samples",
            project_root / "sample",
            project_root / "demo",
            project_root / "data" / "sample",
            project_root / "data" / "samples",
        ]

        discovered: dict[str, Path] = {}
        for root in search_roots:
            if not root.exists():
                continue

            for file_path in root.rglob("*.csv"):
                name = file_path.name.lower()
                if "mge" in name and "mGE" not in discovered:
                    discovered["mGE"] = file_path
                elif "mdm" in name and "mDM" not in discovered:
                    discovered["mDM"] = file_path
                elif "mcna" in name and "mCNA" not in discovered:
                    discovered["mCNA"] = file_path

            if all(key in discovered for key in ["mGE", "mDM", "mCNA"]):
                break

        if all(key in discovered for key in ["mGE", "mDM", "mCNA"]):
            return {
                "files": {
                    "mGE": {
                        "filename": discovered["mGE"].name,
                        "content": discovered["mGE"].read_text(encoding="utf-8"),
                    },
                    "mDM": {
                        "filename": discovered["mDM"].name,
                        "content": discovered["mDM"].read_text(encoding="utf-8"),
                    },
                    "mCNA": {
                        "filename": discovered["mCNA"].name,
                        "content": discovered["mCNA"].read_text(encoding="utf-8"),
                    },
                },
                "paths": {
                    "mGE": str(discovered["mGE"]),
                    "mDM": str(discovered["mDM"]),
                    "mCNA": str(discovered["mCNA"]),
                },
            }

        samples_dir = project_root / "samples"
        samples_dir.mkdir(parents=True, exist_ok=True)

        mge_path = samples_dir / "demo_mGE.csv"
        mdm_path = samples_dir / "demo_mDM.csv"
        mcna_path = samples_dir / "demo_mCNA.csv"

        existing = all(
            path.exists() and path.stat().st_size > 0
            for path in [mge_path, mdm_path, mcna_path]
        )
        if not existing:
            split_a = expected // 3
            split_b = expected // 3
            split_c = expected - split_a - split_b

            rng = np.random.default_rng(42)

            mge_columns = [f"GENE_{idx + 1:03d}" for idx in range(split_a)]
            mdm_columns = [f"METH_{idx + 1:03d}" for idx in range(split_b)]
            mcna_columns = [f"CNA_{idx + 1:03d}" for idx in range(split_c)]

            pd.DataFrame(
                [rng.normal(loc=0.0, scale=1.0, size=split_a)], columns=mge_columns
            ).to_csv(mge_path, index=False)
            pd.DataFrame(
                [rng.normal(loc=0.0, scale=1.0, size=split_b)], columns=mdm_columns
            ).to_csv(mdm_path, index=False)
            pd.DataFrame(
                [rng.normal(loc=0.0, scale=1.0, size=split_c)], columns=mcna_columns
            ).to_csv(mcna_path, index=False)

        return {
            "files": {
                "mGE": {
                    "filename": mge_path.name,
                    "content": mge_path.read_text(encoding="utf-8"),
                },
                "mDM": {
                    "filename": mdm_path.name,
                    "content": mdm_path.read_text(encoding="utf-8"),
                },
                "mCNA": {
                    "filename": mcna_path.name,
                    "content": mcna_path.read_text(encoding="utf-8"),
                },
            },
            "paths": {
                "mGE": str(mge_path),
                "mDM": str(mdm_path),
                "mCNA": str(mcna_path),
            },
        }

    async def run_prediction(
        self,
        mge_file: UploadFile,
        mdm_file: UploadFile,
        mcna_file: UploadFile,
    ) -> dict[str, Any]:
        model = self._load_model()

        mge_df = await self._read_csv(mge_file, "mGE")
        mdm_df = await self._read_csv(mdm_file, "mDM")
        mcna_df = await self._read_csv(mcna_file, "mCNA")

        mge_values, mge_names = self._extract_features(mge_df, "mGE")
        mdm_values, mdm_names = self._extract_features(mdm_df, "mDM")
        mcna_values, mcna_names = self._extract_features(mcna_df, "mCNA")

        feature_values = np.concatenate(
            [mge_values, mdm_values, mcna_values], axis=0
        ).astype(np.float32)
        feature_names = mge_names + mdm_names + mcna_names

        expected_features = self._feature_count_from_model(model)
        received_features = int(feature_values.size)
        if (
            expected_features is not None
            and expected_features != received_features
            and self._feature_order is None
        ):
            raise HTTPException(
                status_code=422,
                detail=(
                    "Feature count mismatch. Expected "
                    f"{expected_features} features, received {received_features}. "
                    "Please verify your CSV files match the training data format."
                ),
            )

        aligned_values, aligned_names = self._align_to_expected(
            feature_values,
            feature_names,
            self._feature_order,
        )

        if (
            expected_features is not None
            and int(aligned_values.size) != expected_features
        ):
            raise HTTPException(
                status_code=422,
                detail=(
                    "Feature count mismatch. Expected "
                    f"{expected_features} features, received {int(aligned_values.size)}. "
                    "Please verify your CSV files match the training data format."
                ),
            )

        X_raw = aligned_values.reshape(1, -1)
        active_scaler = self._resolve_scaler(X_raw[0])
        X = self._apply_transform_if_available(active_scaler, X_raw)
        X = self._apply_transform_if_available(self._encoder, X)

        prediction_label, confidence, prob_high = self._predict_label_and_confidence(
            model, X
        )
        confidence = max(0.0, min(1.0, float(confidence)))
        clinical_note, is_inconclusive = self._derive_clinical_note(
            prediction_label, confidence
        )
        auc_roc, fpr, tpr = self._compute_roc(prob_high)
        top_genes = self._compute_feature_importance(
            model,
            X_raw,
            aligned_names,
            active_scaler,
            self._encoder,
        )
        drugs = self._recommend_drugs(prediction_label)

        return {
            "prediction": prediction_label,
            "confidence": confidence,
            "is_inconclusive": is_inconclusive,
            "auc_roc": auc_roc,
            "fpr": fpr,
            "tpr": tpr,
            "clinical_note": clinical_note,
            "top_genes": top_genes,
            "drugs": drugs,
        }


inference_service = InferenceService()
