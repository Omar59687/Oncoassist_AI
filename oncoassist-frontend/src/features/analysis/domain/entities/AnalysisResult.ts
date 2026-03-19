export interface DrugRecommendation {
  name: string;
  sensitivity: number;
}

export interface AnalysisResult {
  prediction: string;
  confidence: number;
  clinical_note: string;
  top_genes: string[];
  top_drugs: DrugRecommendation[];
}
