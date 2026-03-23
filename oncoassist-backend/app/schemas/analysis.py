from typing import List

from pydantic import BaseModel, Field


class DrugRecommendation(BaseModel):
    name: str
    target: str
    pathway: str


class GeneImportance(BaseModel):
    name: str
    importance: float


class AnalysisResponse(BaseModel):
    prediction: str
    confidence: float
    is_inconclusive: bool = Field(default=False)
    auc_roc: float
    fpr: List[float]
    tpr: List[float]
    clinical_note: str
    top_genes: List[GeneImportance]
    drugs: List[DrugRecommendation]
