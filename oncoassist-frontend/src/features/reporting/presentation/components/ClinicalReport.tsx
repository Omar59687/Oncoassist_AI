import { motion } from 'framer-motion';
import { Printer, ShieldCheck, Pill, Dna } from 'lucide-react';
import type { AnalysisResult } from '../../../analysis/domain/entities/AnalysisResult';
import RocChart from './RocChart';

interface ClinicalReportProps {
  data: AnalysisResult;
}

const ClinicalReport: React.FC<ClinicalReportProps> = ({ data }) => {
  const topGenes = data.top_genes || [];
  const topDrugs = data.drugs || [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-5xl mx-auto p-6 space-y-6 pb-20"
    >
      <div className="flex justify-between items-end border-b pb-6">
        <div>
          <span className="text-blue-600 font-bold text-sm tracking-widest uppercase">Clinical Analysis Result</span>
          <h1 className="text-4xl font-black text-slate-900 mt-1">OncoAssist AI Report</h1>
        </div>
        <button onClick={() => window.print()} className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl hover:bg-slate-800 transition-all shadow-lg">
          <Printer size={18} /> Print Report
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6">
              <ShieldCheck size={48} className="text-emerald-500 opacity-20" />
            </div>
            <h3 className="text-slate-500 font-bold uppercase text-xs tracking-widest mb-4">Primary Prediction</h3>
            <div className="flex flex-col md:flex-row md:items-baseline gap-3 md:gap-4">
              <span className="text-5xl md:text-6xl font-black text-blue-600">{data.prediction}</span>
              <span className="text-2xl font-bold text-emerald-500">{(data.confidence * 100).toFixed(1)}% Confidence</span>
            </div>
            <p className="mt-6 text-slate-600 leading-relaxed text-lg border-l-4 border-blue-500 pl-4 bg-blue-50/50 py-3 rounded-r-lg">
              {data.clinical_note}
            </p>
          </div>

          <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
            <h3 className="font-bold text-xl flex items-center gap-2 text-slate-800 mb-4">
              <Dna className="text-blue-500" /> Uploaded Omics Summary
            </h3>
            <p className="text-slate-600 leading-relaxed">
              Prediction is generated from concatenated mGE + mDM + mCNA feature vectors using the deployed trained model.
            </p>
          </div>

          <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="font-bold text-xl text-slate-800">ROC Curve</h3>
              <span className="text-sm font-semibold text-blue-700">AUC-ROC: {data.auc_roc.toFixed(3)}</span>
            </div>
            <RocChart fpr={data.fpr} tpr={data.tpr} />
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl">
            <h3 className="font-bold text-lg mb-6">Top Genomic Drivers</h3>
            {topGenes.length === 0 ? (
              <p className="text-slate-300 text-sm">No ranked genes were returned by the model.</p>
            ) : (
              <div className="space-y-3">
                {topGenes.map((gene) => (
                  <div key={gene} className="p-3 rounded-xl bg-slate-800 text-sm font-mono">
                    {gene}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
            <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800">
              <Pill className="text-rose-500" /> Suggested Drugs
            </h3>
            {topDrugs.length === 0 ? (
              <p className="text-slate-500 text-sm">No drug recommendations available for this prediction output.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-200">
                      <th className="py-2 pr-3 font-semibold">Drug Name</th>
                      <th className="py-2 pr-3 font-semibold">Target</th>
                      <th className="py-2 font-semibold">Pathway</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topDrugs.map((drug) => (
                      <tr key={`${drug.name}-${drug.target}`} className="border-b border-slate-100">
                        <td className="py-2 pr-3 font-semibold text-slate-800">{drug.name}</td>
                        <td className="py-2 pr-3 text-slate-600">{drug.target}</td>
                        <td className="py-2 text-slate-600">{drug.pathway}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ClinicalReport;
