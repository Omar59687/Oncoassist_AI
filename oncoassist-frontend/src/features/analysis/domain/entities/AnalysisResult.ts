export interface DrugRecommendation {
  name: string;
  target: string;
  pathway: string;
}

export interface AnalysisResult {
  prediction: string;
  confidence: number;
  auc_roc: number;
  fpr: number[];
  tpr: number[];
  clinical_note: string;
  top_genes: string[];
  drugs: DrugRecommendation[];
}

export interface SampleFilePayload {
  filename: string;
  content: string;
}

export interface SampleDataResponse {
  files: {
    mGE: SampleFilePayload;
    mDM: SampleFilePayload;
    mCNA: SampleFilePayload;
  };
  paths: {
    mGE: string;
    mDM: string;
    mCNA: string;
  };
}
