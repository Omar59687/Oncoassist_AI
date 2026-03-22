from typing import List

from pydantic import BaseModel


class DrugRecommendation(BaseModel):
    name: str
    target: str
    pathway: str


class AnalysisResponse(BaseModel):
    prediction: str
    confidence: float
    auc_roc: float
    fpr: List[float]
    tpr: List[float]
    clinical_note: str
    top_genes: List[str]
    drugs: List[DrugRecommendation]
