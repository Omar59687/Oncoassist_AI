import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Dna } from 'lucide-react';
import { AnalysisService } from '../../data/AnalysisService';

interface FileUploaderProps {
  onAnalyze: (mGE: File, mDM: File, mCNA: File) => void;
  errorMessage?: string | null;
}

const INPUT_LABELS: Record<string, string> = {
  mGE: 'Gene Expression (mGE)',
  mDM: 'DNA Methylation (mDM)',
  mCNA: 'Copy Number Alterations (mCNA)',
};

const FileUploader: React.FC<FileUploaderProps> = ({ onAnalyze, errorMessage }) => {
  const [files, setFiles] = useState<{ [key: string]: File | null }>({
    mGE: null,
    mDM: null,
    mCNA: null,
  });
  const [isLoadingDemo, setIsLoadingDemo] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    if (e.target.files && e.target.files[0]) {
      setFiles((prev) => ({ ...prev, [type]: e.target.files![0] }));
    }
  };

  const handleLoadDemoData = async () => {
    setIsLoadingDemo(true);
    setDemoError(null);

    try {
      const sampleResponse = await AnalysisService.loadDemoData();

      const demoFiles = {
        mGE: new File([sampleResponse.files.mGE.content], sampleResponse.files.mGE.filename, { type: 'text/csv' }),
        mDM: new File([sampleResponse.files.mDM.content], sampleResponse.files.mDM.filename, { type: 'text/csv' }),
        mCNA: new File([sampleResponse.files.mCNA.content], sampleResponse.files.mCNA.filename, { type: 'text/csv' }),
      };

      setFiles(demoFiles);
    } catch {
      setDemoError('Unable to load demo sample files from backend.');
    } finally {
      setIsLoadingDemo(false);
    }
  };

  const isReady = files.mGE && files.mDM && files.mCNA;

  return (
    <div className="max-w-4xl mx-auto p-8">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-10"
      >
        <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tight uppercase italic">
          Genomic Data <span className="text-blue-600 not-italic">Analysis</span>
        </h2>
        <p className="text-slate-500 max-w-lg mx-auto leading-relaxed font-medium">
          Upload your <span className="text-blue-600 font-bold border-b-2 border-blue-100">Multi-Omics</span> CSV files to begin the clinical prediction process.
        </p>

        <button
          type="button"
          onClick={handleLoadDemoData}
          disabled={isLoadingDemo}
          className="mt-5 px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 transition disabled:opacity-60"
        >
          {isLoadingDemo ? 'Loading demo data...' : 'Load demo data'}
        </button>

        {errorMessage ? (
          <p className="mt-4 text-sm text-rose-600 font-medium">{errorMessage}</p>
        ) : null}

        {demoError ? (
          <p className="mt-2 text-sm text-rose-600 font-medium">{demoError}</p>
        ) : null}
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {['mGE', 'mDM', 'mCNA'].map((type, index) => (
          <motion.div
            key={type}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.15 }}
            className={`relative group border-2 border-dashed rounded-[2.5rem] p-8 transition-all duration-700 flex flex-col items-center justify-center min-h-[260px] 
              ${files[type] 
                ? 'border-emerald-500 bg-emerald-50/40 shadow-xl shadow-emerald-50' 
                : 'border-slate-200 hover:border-blue-500 hover:bg-white hover:shadow-2xl hover:shadow-blue-50'}`}
          >
            <input
              type="file"
              accept=".csv"
              onChange={(e) => handleFileChange(e, type)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            
            {/* الأيقونة مع الأنيميشن الدائري الذي طلبته */}
            <div className={`mb-6 p-6 rounded-3xl transition-all duration-700 shadow-lg
              ${files[type] 
                ? 'bg-emerald-500 text-white rotate-[360deg] scale-110 shadow-emerald-200' 
                : 'bg-slate-100 text-slate-400 group-hover:bg-blue-600 group-hover:text-white group-hover:rotate-[15deg] group-hover:scale-110'}`}>
              {files[type] ? <CheckCircle2 size={36} strokeWidth={2.5} /> : <Dna size={36} strokeWidth={2.5} />}
            </div>

              <span className={`font-black text-lg tracking-tight text-center transition-colors duration-500 
              ${files[type] ? 'text-emerald-700' : 'text-slate-700 group-hover:text-blue-600'}`}>
              {INPUT_LABELS[type]}
              </span>
            
            <p className="text-[10px] font-bold text-slate-400 mt-3 text-center uppercase tracking-widest px-4 truncate w-full">
              {files[type] ? files[type]?.name : 'Drag & Drop CSV'}
            </p>

            {/* مؤشر صغير عند النجاح */}
            {files[type] && (
              <motion.div 
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                className="absolute top-4 right-4 bg-emerald-500 text-white p-1 rounded-full"
              >
                <CheckCircle2 size={14} />
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>

      <motion.button
        whileHover={isReady ? { scale: 1.03, y: -4 } : {}}
        whileTap={isReady ? { scale: 0.97 } : {}}
        onClick={() => isReady && onAnalyze(files.mGE!, files.mDM!, files.mCNA!)}
        className={`w-full mt-14 py-6 rounded-[2rem] font-black text-xl tracking-[0.15em] uppercase transition-all duration-700 shadow-2xl
          ${isReady 
            ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white shadow-blue-200 hover:shadow-blue-400 animate-gradient-x' 
            : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'}`}
        disabled={!isReady}
      >
        {isReady ? 'Initialize AI Engine' : 'Waiting for Data...'}
      </motion.button>
    </div>
  );
};

export default FileUploader;
