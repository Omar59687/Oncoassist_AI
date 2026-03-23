import { motion } from 'framer-motion';
import { Dna, Database, BrainCircuit, Activity, ShieldCheck } from 'lucide-react';
import { LOADING_STEPS } from '../../../analysis/domain/constants/clinicalConstants';

const iconMap: Record<string, React.ReactNode> = {
  Database: <Database className="w-5 h-5" />,
  Dna: <Dna className="w-5 h-5" />,
  BrainCircuit: <BrainCircuit className="w-5 h-5" />,
  Activity: <Activity className="w-5 h-5" />,
  ShieldCheck: <ShieldCheck className="w-5 h-5" />,
};

const AnalysisLoading = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Central animated icon */}
      <motion.div
        animate={{ 
          scale: [1, 1.1, 1],
          rotate: [0, 180, 360] 
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        className="mb-8 p-6 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full text-blue-600 shadow-2xl"
      >
        <BrainCircuit size={64} />
      </motion.div>

      <h2 className="text-3xl font-bold text-slate-900 mb-2">OncoAssist AI is Analyzing...</h2>
      <p className="text-slate-600 mb-12 text-center max-w-md">
        Advanced multi-omics analysis in progress. Leveraging machine learning to process your genomic data.
      </p>

      {/* Clinical processing steps */}
      <div className="w-full max-w-2xl space-y-3">
        {LOADING_STEPS.map((step, index) => (
          <motion.div
            key={step.step}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.3 }}
            className="flex items-start gap-4 p-4 bg-white rounded-xl border border-blue-100 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="text-blue-600 flex-shrink-0 mt-1 animate-pulse">
              {iconMap[step.icon] || <Database className="w-5 h-5" />}
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-slate-800">{step.title}</h4>
              <p className="text-sm text-slate-500 mt-1">{step.description}</p>
            </div>
            <div className="text-xs font-mono text-blue-500 flex-shrink-0">
              Step {step.step}/5
            </div>
          </motion.div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-2xl mt-10 h-1 bg-slate-200 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: "100%" }}
          transition={{ duration: 5, ease: "easeInOut" }}
          className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-600"
        />
      </div>
    </div>
  );
};

export default AnalysisLoading;
