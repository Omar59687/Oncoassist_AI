from __future__ import annotations

import pickle
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from fastapi import HTTPException, UploadFile


class InferenceService:
    def __init__(self) -> None:
        self._model: Any | None = None
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

    def _load_model(self) -> Any:
        if self._model is not None:
            return self._model

        model_path = self._locate_model()
        with model_path.open("rb") as fh:
            self._model = pickle.load(fh)
        self._model_path = model_path
        return self._model

    @staticmethod
    async def _read_csv(file: UploadFile, field_name: str) -> pd.DataFrame:
        if file is None:
            raise HTTPException(
                status_code=400, detail=f"Missing required file: {field_name}"
            )

        filename = (file.filename or "").lower()
        if not filename.endswith(".csv"):
            raise HTTPException(
                status_code=400,
                detail=f"{field_name} must be a CSV file.",
            )

        try:
            await file.seek(0)
            return pd.read_csv(file.file)
        except Exception as exc:  # pragma: no cover
            raise HTTPException(
                status_code=400,
                detail=f"Failed to parse {field_name} as CSV.",
            ) from exc

    @staticmethod
    def _extract_features(df: pd.DataFrame, source_name: str) -> np.ndarray:
        if df.empty:
            raise HTTPException(status_code=400, detail=f"{source_name} CSV is empty.")

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
                status_code=400,
                detail=f"{source_name} CSV has no usable numeric features.",
            )

        numeric = numeric.fillna(numeric.median(numeric_only=True)).fillna(0.0)
        vector = numeric.to_numpy(dtype=np.float32, copy=False).reshape(-1)

        if vector.size == 0:
            raise HTTPException(
                status_code=400,
                detail=f"{source_name} CSV produced an empty feature vector.",
            )

        return vector

    @staticmethod
    def _expected_feature_count(model: Any) -> int | None:
        if hasattr(model, "n_features_in_"):
            try:
                return int(model.n_features_in_)
            except Exception:
                return None

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
    def _make_clinical_note(prediction_label: str, confidence: float) -> str:
        if prediction_label.lower().startswith("high"):
            return (
                f"Predicted high-risk profile with {confidence:.1%} confidence. "
                "Recommend oncology review for aggressive treatment planning."
            )
        return (
            f"Predicted low-risk profile with {confidence:.1%} confidence. "
            "Suggest standard monitoring and follow-up based on clinical context."
        )

    def _predict_label_and_confidence(
        self, model: Any, X: np.ndarray
    ) -> tuple[str, float]:
        try:
            raw_prediction = model.predict(X, verbose=0)
        except TypeError:
            raw_prediction = model.predict(X)

        confidence: float
        prediction_label: str

        if hasattr(model, "predict_proba"):
            probabilities = model.predict_proba(X)
            probabilities = np.asarray(probabilities, dtype=np.float32)

            if probabilities.ndim == 2 and probabilities.shape[1] > 1:
                class_index = int(np.argmax(probabilities[0]))
                confidence = float(probabilities[0][class_index])
                if hasattr(model, "classes_"):
                    prediction_label = str(model.classes_[class_index])
                else:
                    prediction_label = f"class_{class_index}"
            else:
                positive_prob = float(probabilities.reshape(-1)[0])
                prediction_label = "High-TMB" if positive_prob >= 0.5 else "Low-TMB"
                confidence = max(positive_prob, 1.0 - positive_prob)
            return prediction_label, confidence

        raw_array = np.asarray(raw_prediction, dtype=np.float32)
        if raw_array.ndim == 2 and raw_array.shape[1] > 1:
            class_index = int(np.argmax(raw_array[0]))
            confidence = float(raw_array[0][class_index])
            prediction_label = f"class_{class_index}"
        else:
            score = float(raw_array.reshape(-1)[0])
            if 0.0 <= score <= 1.0:
                prediction_label = "High-TMB" if score >= 0.5 else "Low-TMB"
                confidence = max(score, 1.0 - score)
            else:
                prediction_label = str(int(round(score)))
                confidence = 1.0

        return prediction_label, confidence

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

        feature_parts = [
            self._extract_features(mge_df, "mGE"),
            self._extract_features(mdm_df, "mDM"),
            self._extract_features(mcna_df, "mCNA"),
        ]
        X = np.concatenate(feature_parts, axis=0).astype(np.float32).reshape(1, -1)

        expected_features = self._expected_feature_count(model)
        if expected_features is not None and X.shape[1] != expected_features:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Input feature shape mismatch. "
                    f"Expected {expected_features} features, received {X.shape[1]}."
                ),
            )

        prediction_label, confidence = self._predict_label_and_confidence(model, X)
        confidence = max(0.0, min(1.0, float(confidence)))

        return {
            "prediction": prediction_label,
            "confidence": confidence,
            "clinical_note": self._make_clinical_note(prediction_label, confidence),
            "top_genes": [],
            "top_drugs": [],
        }


inference_service = InferenceService()
