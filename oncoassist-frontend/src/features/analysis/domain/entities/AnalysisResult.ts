export interface GeneImportance {
  name: string;
  importance: number;
}

export interface AnalysisResult {
  prediction: string;
  confidence: number;
  is_inconclusive?: boolean;
  clinical_note: string;
  top_genes: GeneImportance[];
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
