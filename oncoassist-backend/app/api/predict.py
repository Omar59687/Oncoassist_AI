from fastapi import APIRouter, File, HTTPException, UploadFile

from app.schemas.analysis import AnalysisResponse
from app.services.inference import inference_service

router = APIRouter()


@router.post("/predict", response_model=AnalysisResponse)
async def predict_cancer_outcome(
    mGE: UploadFile | None = File(default=None),
    mDM: UploadFile | None = File(default=None),
    mCNA: UploadFile | None = File(default=None),
):
    if mGE is None or mDM is None or mCNA is None:
        raise HTTPException(
            status_code=422,
            detail="Missing required files. Please upload mGE, mDM, and mCNA CSV files.",
        )

    try:
        return await inference_service.run_prediction(mGE, mDM, mCNA)
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover
        raise HTTPException(
            status_code=500,
            detail={"message": "Inference failed.", "error": str(exc)},
        ) from exc


@router.get("/sample")
async def get_sample_data() -> dict:
    try:
        return await inference_service.get_sample_data()
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover
        raise HTTPException(
            status_code=500,
            detail={"message": "Failed to prepare demo samples.", "error": str(exc)},
        ) from exc
