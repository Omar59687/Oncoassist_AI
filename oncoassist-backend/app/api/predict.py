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
            status_code=400,
            detail="Missing required files. Please upload mGE, mDM, and mCNA CSV files.",
        )

    return await inference_service.run_prediction(mGE, mDM, mCNA)
