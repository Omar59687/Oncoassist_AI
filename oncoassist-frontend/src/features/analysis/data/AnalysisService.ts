import type { AnalysisResult, SampleDataResponse } from '../domain/entities/AnalysisResult';
import oncoClient from '../../../core/api/oncoClient';

export const AnalysisService = {
  uploadGenomicData: async (mGE: File, mDM: File, mCNA: File): Promise<AnalysisResult> => {
    const formData = new FormData();
    formData.append('mGE', mGE);
    formData.append('mDM', mDM);
    formData.append('mCNA', mCNA);

    const response = await oncoClient.post<AnalysisResult>('/predict', formData);
    return response.data;
  },

  loadDemoData: async (): Promise<SampleDataResponse> => {
    const response = await oncoClient.get<SampleDataResponse>('/sample');
    return response.data;
  },
};
