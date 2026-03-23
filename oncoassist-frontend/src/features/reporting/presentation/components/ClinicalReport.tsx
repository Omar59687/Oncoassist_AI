import { motion } from 'framer-motion';
import { Printer, Download, ShieldCheck, Pill, Dna, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useRef } from 'react';
import html2pdf from 'html2pdf.js';
import type { AnalysisResult } from '../../../analysis/domain/entities/AnalysisResult';
import { CLINICAL_INSIGHTS, METHODOLOGY_LIMITATIONS, DISCLAIMER } from '../../../analysis/domain/constants/clinicalConstants';
import RocChart from './RocChart';

interface ClinicalReportProps {
  data: AnalysisResult;
}

const ClinicalReport: React.FC<ClinicalReportProps> = ({ data }) => {
  const topGenes = data.top_genes || [];
  const topDrugs = data.drugs || [];
  const reportRef = useRef<HTMLDivElement>(null);

  // Determine prediction type and colors
  const isHighTMB = data.prediction.toLowerCase().includes('high');
  const clinicalInsight = isHighTMB ? CLINICAL_INSIGHTS.HIGH_TMB : CLINICAL_INSIGHTS.LOW_TMB;
  
  const cardBgColor = isHighTMB ? 'bg-emerald-50' : 'bg-orange-50';
  const cardBorderColor = isHighTMB ? 'border-emerald-200' : 'border-orange-200';
  const badgeColor = isHighTMB ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-800';
  const iconColor = isHighTMB ? 'text-emerald-600' : 'text-orange-600';

  const downloadPDF = () => {
    if (!reportRef.current) return;
    
    const element = reportRef.current;
    const opt = {
      margin: 10,
      filename: `OncoAssist-Clinical-Report-${new Date().getTime()}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
    };
    
    html2pdf().set(opt).from(element).save();
  };

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
        <div className="flex gap-3">
          <button 
            onClick={downloadPDF} 
            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-all shadow-lg"
          >
            <Download size={18} /> Download PDF Report
          </button>
          <button 
            onClick={() => window.print()} 
            className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl hover:bg-slate-800 transition-all shadow-lg"
          >
            <Printer size={18} /> Print Report
          </button>
        </div>
      </div>

      <div ref={reportRef} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* ENHANCED: Large Colored Result Card */}
          <motion.div 
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            className={`rounded-3xl p-8 border-2 shadow-xl relative overflow-hidden ${cardBgColor} ${cardBorderColor}`}
          >
            <div className="absolute top-0 right-0 p-8 opacity-10">
              {isHighTMB ? <CheckCircle2 size={120} className={iconColor} /> : <AlertCircle size={120} className={iconColor} />}
            </div>
            
            <div className="relative z-10">
              <div className="mb-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg ${badgeColor}`}>
                  {isHighTMB ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                </div>
                <span className={`font-bold uppercase text-xs tracking-widest ${isHighTMB ? 'text-emerald-700' : 'text-orange-700'}`}>
                  {clinicalInsight.title}
                </span>
              </div>
              
              <div className="mb-6">
                <div className="text-slate-600 font-semibold uppercase text-xs tracking-widest mb-2">Primary Prediction</div>
                <div className="flex flex-col md:flex-row md:items-baseline gap-3 md:gap-4">
                  <span className={`text-5xl md:text-6xl font-black ${isHighTMB ? 'text-emerald-600' : 'text-orange-600'}`}>
                    {data.prediction}
                  </span>
                  <span className={`text-2xl font-bold ${isHighTMB ? 'text-emerald-500' : 'text-orange-500'}`}>
                    {(data.confidence * 100).toFixed(1)}% Confidence
                  </span>
                </div>
              </div>
              
              <div className={`border-l-4 ${isHighTMB ? 'border-emerald-500 bg-emerald-100/30' : 'border-orange-500 bg-orange-100/30'} p-4 rounded-r-lg`}>
                <p className="text-slate-700 leading-relaxed font-medium">
                  {clinicalInsight.description}
                </p>
              </div>
            </div>
          </motion.div>

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

          {/* ENHANCED: Methodology & Limitations Section */}
          <div className="bg-slate-50 rounded-3xl p-8 border-2 border-slate-200">
            <h3 className="font-bold text-xl text-slate-900 mb-4 flex items-center gap-2">
              <ShieldCheck className="text-slate-600" size={24} />
              {METHODOLOGY_LIMITATIONS.title}
            </h3>
            <div className="text-slate-700 leading-relaxed space-y-3 text-sm">
              {METHODOLOGY_LIMITATIONS.content.split('\n').map((line, idx) => (
                <p key={idx}>{line}</p>
              ))}
            </div>
          </div>

          {/* ENHANCED: Mandatory Disclaimer */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-red-50 rounded-3xl p-6 border-2 border-red-200"
          >
            <div className="flex gap-3">
              <AlertCircle className="text-red-600 flex-shrink-0 mt-1" size={24} />
              <div>
                <h4 className="font-black text-red-900 mb-2">⚠️ IMPORTANT DISCLAIMER</h4>
                <p className="text-red-800 leading-relaxed text-sm font-medium">
                  {DISCLAIMER}
                </p>
              </div>
            </div>
          </motion.div>
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
