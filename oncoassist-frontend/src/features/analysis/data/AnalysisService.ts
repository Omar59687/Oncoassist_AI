import type { AnalysisResult } from '../domain/entities/AnalysisResult';
import oncoClient from '../../../core/api/oncoClient';
export const AnalysisService = {
  // دالة إرسال الملفات الثلاثة معاً كما يتطلب نموذج AE-CTGAN
  uploadGenomicData: async (mGE: File, mDM: File, mCNA: File): Promise<AnalysisResult> => {
    const formData = new FormData();
    formData.append('mGE', mGE);
    formData.append('mDM', mDM);
    formData.append('mCNA', mCNA);

    const response = await oncoClient.post<AnalysisResult>('/predict', formData);
    return response.data;
  }
};