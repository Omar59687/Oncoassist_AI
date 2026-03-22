import { useState } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import axios from 'axios';
import FileUploader from './features/analysis/presentation/components/FileUploader';
import AnalysisLoading from './features/analysis/presentation/components/AnalysisLoading';
import ClinicalReport from './features/reporting/presentation/components/ClinicalReport';
import type { AnalysisResult } from './features/analysis/domain/entities/AnalysisResult';
import { AnalysisService } from './features/analysis/data/AnalysisService';
function App() {
  const [status, setStatus] = useState<'upload' | 'loading' | 'report'>('upload');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

const handleStartAnalysis = async (mGE: File, mDM: File, mCNA: File) => {
  setErrorMessage(null);
  setStatus('loading');
  toast.loading('Uploading genomic data to server...', { id: 'analysis' });

  // سنبدأ الوقت الآن
  const startTime = Date.now();

  try {
    // 1. طلب البيانات الحقيقي من الباك-أند
    const result = await AnalysisService.uploadGenomicData(mGE, mDM, mCNA);
    
    // 2. حساب الوقت المستغرق
    const duration = Date.now() - startTime;
    const minLoadingTime = 4000; // بدنا الأنيميشن يظهر على الأقل لـ 4 ثواني

    // 3. إذا كان السيرفر أسرع من 4 ثواني، سننتظر الباقي يدوياً
    if (duration < minLoadingTime) {
      await new Promise(resolve => setTimeout(resolve, minLoadingTime - duration));
    }

    // 4. عرض النتائج
    setAnalysisResult(result);
    setStatus('report');
    toast.success('Analysis Complete!', { id: 'analysis' });
  } catch (error: unknown) {
    setStatus('upload');
    const message = axios.isAxiosError(error)
      ? (typeof error.response?.data?.detail === 'string'
          ? error.response?.data?.detail
          : error.response?.data?.detail?.message || 'Server error while running prediction.')
      : 'Unexpected error while running prediction.';
    setErrorMessage(message);
    toast.error(message, { id: 'analysis' });
  }
};
  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <Toaster position="top-right" /> {/* نظام التنبيهات */}
      
      <nav className="max-w-7xl mx-auto px-6 py-8 flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => { setStatus('upload'); setErrorMessage(null); }}>
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center text-white font-black shadow-lg">O</div>
            <span className="text-xl font-black tracking-tighter text-slate-900 italic">ONCOASSIST <span className="text-blue-600 not-italic">AI</span></span>
          </div>
      </nav>
      
      <main>
        {status === 'upload' && <FileUploader onAnalyze={handleStartAnalysis} errorMessage={errorMessage} />}
        {status === 'loading' && <AnalysisLoading />}
        {status === 'report' && analysisResult && <ClinicalReport data={analysisResult} />}
      </main>
    </div>
  );
}

export default App;
