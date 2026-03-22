from __future__ import annotations

import io
import logging
import pickle
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from fastapi import HTTPException, UploadFile
from sklearn.metrics import auc, roc_curve

logger = logging.getLogger(__name__)


class InferenceService:
    def __init__(self) -> None:
        self._model: Any | None = None
        self._scaler: Any | None = None
        self._encoder: Any | None = None
        self._feature_order: list[str] | None = None
        self._gdsc_df: pd.DataFrame | None = None
        self._model_path: Path | None = None

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

    def _discover_aux_artifacts(self, model_path: Path) -> None:
        for model_dir in self._candidate_model_dirs():
            if not model_dir.exists():
                continue
            for artifact in sorted(model_dir.glob("*.pkl")):
                if artifact == model_path:
                    continue

                lower_name = artifact.name.lower()
                try:
                    loaded = self._safe_pickle_load(artifact)
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
        feature_names = [f"{source_name}:{str(col)}" for col in numeric.columns]

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
        expected_count: int | None,
        feature_order: list[str] | None,
    ) -> tuple[np.ndarray, list[str]]:
        if feature_order:
            mapping = {name: values[idx] for idx, name in enumerate(names)}
            ordered = np.array(
                [mapping.get(name, 0.0) for name in feature_order], dtype=np.float32
            )
            return ordered, feature_order

        if expected_count is None:
            return values, names

        if values.size == expected_count:
            return values, names

        if values.size > expected_count:
            return values[:expected_count], names[:expected_count]

        pad_size = expected_count - values.size
        padded = np.pad(values, (0, pad_size), mode="constant")
        padded_names = names + [f"padded_feature_{idx + 1}" for idx in range(pad_size)]
        return padded, padded_names

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
    def _top_genes_from_weights(model: Any, feature_names: list[str]) -> list[str]:
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

            top_features: list[str] = []
            for idx in top_idx:
                name = feature_names[int(idx)]
                if name.startswith("mGE:"):
                    name = name.split(":", 1)[1]
                top_features.append(name)
            return top_features

        return []

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
        aligned_values, aligned_names = self._align_to_expected(
            feature_values,
            feature_names,
            expected_features,
            self._feature_order,
        )

        X = aligned_values.reshape(1, -1)
        X = self._apply_transform_if_available(self._scaler, X)
        X = self._apply_transform_if_available(self._encoder, X)

        prediction_label, confidence, prob_high = self._predict_label_and_confidence(
            model, X
        )
        confidence = max(0.0, min(1.0, float(confidence)))
        auc_roc, fpr, tpr = self._compute_roc(prob_high)
        top_genes = self._top_genes_from_weights(model, aligned_names)
        drugs = self._recommend_drugs(prediction_label)

        return {
            "prediction": prediction_label,
            "confidence": confidence,
            "auc_roc": auc_roc,
            "fpr": fpr,
            "tpr": tpr,
            "clinical_note": self._make_clinical_note(prediction_label, confidence),
            "top_genes": top_genes,
            "drugs": drugs,
        }


inference_service = InferenceService()
