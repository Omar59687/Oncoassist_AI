from pydantic import BaseModel
from typing import List


class DrugRecommendation(BaseModel):
    name: str
    sensitivity: float


class AnalysisResponse(BaseModel):
    prediction: str
    confidence: float
    clinical_note: str
    top_genes: List[str]
    top_drugs: List[DrugRecommendation]
