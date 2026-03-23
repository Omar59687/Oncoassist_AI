import { motion } from 'framer-motion';
import { Printer, ShieldCheck, Dna, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { AnalysisResult } from '../../../analysis/domain/entities/AnalysisResult';
import { CLINICAL_INSIGHTS, METHODOLOGY_LIMITATIONS, DISCLAIMER } from '../../../analysis/domain/constants/clinicalConstants';

interface ClinicalReportProps {
  data: AnalysisResult;
}

const ClinicalReport: React.FC<ClinicalReportProps> = ({ data }) => {
  const topGenes = (data.top_genes || []).map((gene, index) => {
    if (typeof gene === 'string') {
      return { name: gene, importance: 0, index };
    }
    return {
      name: gene.name,
      importance: gene.importance,
      index,
    };
  });

  const isHighTMB = data.prediction.toLowerCase().includes('high');
  const isBorderline = data.is_inconclusive ?? (data.confidence >= 0.45 && data.confidence <= 0.55);
  const confidencePct = data.confidence * 100;
  const clinicalInsight = isHighTMB ? CLINICAL_INSIGHTS.HIGH_TMB : CLINICAL_INSIGHTS.LOW_TMB;

  const cardBgColor = isHighTMB ? 'bg-emerald-50' : 'bg-orange-50';
  const cardBorderColor = isHighTMB ? 'border-emerald-200' : 'border-orange-200';
  const badgeColor = isHighTMB ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-800';
  const iconColor = isHighTMB ? 'text-emerald-600' : 'text-orange-600';
  const confidenceStyle = isBorderline
    ? 'text-amber-700'
    : isHighTMB
      ? 'text-emerald-600'
      : 'text-orange-600';

  const interpretationText = isBorderline
    ? 'The model output is not strongly separated. This result should be interpreted with caution and confirmed with clinical and laboratory context.'
    : clinicalInsight.description;

  const confidenceDescriptor = isBorderline
    ? 'Borderline confidence'
    : confidencePct >= 75
      ? 'Strong confidence'
      : confidencePct >= 60
        ? 'Moderate confidence'
        : 'Limited confidence';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-6xl mx-auto px-5 md:px-8 py-6 md:py-8 space-y-6 md:space-y-8 pb-20 print:pb-0"
    >
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 border-b border-slate-200 pb-5 print:hidden">
        <div>
          <span className="text-blue-600 font-bold text-sm tracking-widest uppercase">Clinical Analysis Result</span>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 mt-1 tracking-tight">OncoAssist AI Report</h1>
        </div>
        <button
          onClick={() => window.print()}
          className="w-fit flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl hover:bg-slate-800 transition-all shadow-lg"
        >
            <Printer size={18} /> Print Report
        </button>
      </div>

      <article className="print-report-shell grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-7">
        <div className="lg:col-span-2 space-y-6 md:space-y-7">
          <motion.div
            initial={{ scale: 0.98 }}
            animate={{ scale: 1 }}
            className={`rounded-3xl p-6 md:p-8 border-2 shadow-lg relative overflow-hidden ${cardBgColor} ${cardBorderColor}`}
          >
            <div className="absolute top-0 right-0 p-8 opacity-10">
              {isHighTMB ? <CheckCircle2 size={120} className={iconColor} /> : <AlertCircle size={120} className={iconColor} />}
            </div>

            <div className="relative z-10">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <div className={`p-2 rounded-lg ${badgeColor}`}>
                  {isHighTMB ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                </div>
                <span className={`font-bold uppercase text-xs tracking-widest ${isHighTMB ? 'text-emerald-700' : 'text-orange-700'}`}>
                  {clinicalInsight.title}
                </span>
                {isBorderline ? (
                  <span className="rounded-full bg-amber-100 text-amber-800 px-3 py-1 text-xs font-semibold">Interpret with caution</span>
                ) : null}
              </div>

              <div className="mb-6">
                <div className="text-slate-600 font-semibold uppercase text-xs tracking-widest mb-2">Primary Prediction</div>
                <div className="flex flex-col md:flex-row md:items-baseline gap-3 md:gap-4">
                  <span className={`text-4xl md:text-5xl font-black ${isHighTMB ? 'text-emerald-700' : 'text-orange-700'}`}>
                    {data.prediction}
                  </span>
                  <span className={`text-xl md:text-2xl font-bold ${confidenceStyle}`}>
                    {confidencePct.toFixed(1)}% Confidence
                  </span>
                </div>
                <p className="mt-2 text-sm font-medium text-slate-600">{confidenceDescriptor}</p>
              </div>

              <div className={`border-l-4 ${isHighTMB ? 'border-emerald-500 bg-emerald-100/30' : 'border-orange-500 bg-orange-100/30'} p-4 rounded-r-lg`}>
                <p className="text-slate-700 leading-relaxed font-medium">
                  {interpretationText}
                </p>
              </div>

              <p className="mt-4 text-sm text-slate-600 leading-relaxed">{data.clinical_note}</p>
            </div>
          </motion.div>

          <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm">
            <h3 className="font-bold text-xl flex items-center gap-2 text-slate-800 mb-4">
              <Dna className="text-blue-600" /> Uploaded Omics Summary
            </h3>
            <p className="text-slate-600 leading-relaxed mb-4">
              This prediction was generated from three uploaded modalities after numeric validation and model-compatible preprocessing.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: 'mGE', value: 'Gene Expression' },
                { label: 'mDM', value: 'DNA Methylation' },
                { label: 'mCNA', value: 'Copy Number Alterations' },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">{item.label}</p>
                  <p className="text-sm font-semibold text-slate-800 mt-1">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-50 rounded-3xl p-6 md:p-8 border-2 border-slate-200">
            <h3 className="font-bold text-xl text-slate-900 mb-4 flex items-center gap-2">
              <ShieldCheck className="text-slate-600" size={24} />
              {METHODOLOGY_LIMITATIONS.title}
            </h3>
            <ul className="space-y-3 text-sm text-slate-700 leading-relaxed list-disc pl-5">
              {METHODOLOGY_LIMITATIONS.points.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-red-50 rounded-3xl p-6 border-2 border-red-200"
          >
            <div className="flex gap-3">
              <AlertCircle className="text-red-600 flex-shrink-0 mt-1" size={24} />
              <div>
                <h4 className="font-black text-red-900 mb-2">Important Medical Disclaimer</h4>
                <p className="text-red-800 leading-relaxed text-sm font-medium">
                  {DISCLAIMER}
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-lg">
            <h3 className="font-bold text-lg mb-2">Top Influential Features</h3>
            <p className="text-slate-300 text-xs mb-5">
              Ranked by model contribution for this uploaded case. These are computational signals, not standalone diagnostic biomarkers.
            </p>
            {topGenes.length === 0 ? (
              <p className="text-slate-300 text-sm">No ranked genes were returned by the model.</p>
            ) : (
              <div className="space-y-3">
                {topGenes.map((gene) => (
                    <div key={`${gene.name}-${gene.index}`} className="p-3 rounded-xl bg-slate-800 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate font-medium text-slate-100">{gene.name}</span>
                        <span className="text-xs font-semibold text-slate-200 bg-slate-700 px-2 py-1 rounded-md">
                          {gene.importance.toFixed(4)}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </article>
    </motion.div>
  );
};

export default ClinicalReport;
