import { motion } from 'framer-motion';
import { Dna, Database, BrainCircuit, Activity } from 'lucide-react';

const steps = [
  { icon: <Database className="w-5 h-5" />, text: "Loading Multi-Omics Data..." },
  { icon: <Dna className="w-5 h-5" />, text: "Extracting Numeric Features from CSVs..." },
  { icon: <BrainCircuit className="w-5 h-5" />, text: "Running Deployed Model Inference..." },
  { icon: <Activity className="w-5 h-5" />, text: "Finalizing Clinical Prediction..." },
];

const AnalysisLoading = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      {/* الأيقونة المركزية المتحركة */}
      <motion.div
        animate={{ 
          scale: [1, 1.1, 1],
          rotate: [0, 180, 360] 
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        className="mb-12 p-6 bg-blue-100 rounded-full text-blue-600 shadow-xl shadow-blue-100"
      >
        <BrainCircuit size={64} />
      </motion.div>

      <h3 className="text-2xl font-bold text-slate-800 mb-8">OncoAssist AI is Thinking...</h3>

      {/* قائمة الخطوات */}
      <div className="w-full max-w-md space-y-4">
        {steps.map((step, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.8 }}
            className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-100 shadow-sm"
          >
            <div className="text-blue-500 animate-pulse">{step.icon}</div>
            <span className="text-slate-600 font-medium">{step.text}</span>
          </motion.div>
        ))}
      </div>

      {/* Progress Bar السفلي */}
      <div className="w-full max-w-md mt-10 h-2 bg-slate-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: "100%" }}
          transition={{ duration: 4, ease: "easeInOut" }}
          className="h-full bg-gradient-to-r from-blue-500 to-indigo-600"
        />
      </div>
    </div>
  );
};

export default AnalysisLoading;
