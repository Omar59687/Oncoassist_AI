import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Dna, Printer, ShieldCheck } from 'lucide-react';
import type { AnalysisResult } from '../../../analysis/domain/entities/AnalysisResult';
import { CLINICAL_INSIGHTS, DISCLAIMER, METHODOLOGY_LIMITATIONS } from '../../../analysis/domain/constants/clinicalConstants';

type UploadedFileNames = {
  mGE: string;
  mDM: string;
  mCNA: string;
} | null;

interface ClinicalReportProps {
  data: AnalysisResult;
  uploadedFileNames?: UploadedFileNames;
}

const formatNowForPrint = (date: Date) =>
  date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

const formatDatePart = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}${month}${day}`;
};

const confidenceDescriptor = (confidence: number) => {
  if (confidence >= 0.75) return 'High confidence';
  if (confidence >= 0.55) return 'Moderate confidence';
  return 'Low confidence';
};

const confidenceColorClass = (confidence: number) => {
  if (confidence >= 0.75) return 'bg-emerald-500';
  if (confidence >= 0.55) return 'bg-amber-500';
  return 'bg-rose-500';
};

const confidenceTextClass = (confidence: number) => {
  if (confidence >= 0.75) return 'text-emerald-700';
  if (confidence >= 0.55) return 'text-amber-700';
  return 'text-rose-700';
};

const ClinicalReport: React.FC<ClinicalReportProps> = ({ data, uploadedFileNames = null }) => {
  const prefersReducedMotion = useReducedMotion();

  const createdAt = useMemo(() => new Date(), []);
  const reportId = useMemo(() => {
    const randomSuffix = `${Math.floor(1000 + Math.random() * 9000)}`;
    return `ONCO-${formatDatePart(createdAt)}-${randomSuffix}`;
  }, [createdAt]);

  const isHighTMB = data.prediction.toLowerCase().includes('high');
  const isInconclusive = data.is_inconclusive;
  const confidencePct = Math.max(0, Math.min(100, data.confidence * 100));

  const clinicalInsight = isHighTMB ? CLINICAL_INSIGHTS.HIGH_TMB : CLINICAL_INSIGHTS.LOW_TMB;

  const topGenes = (data.top_genes || []).map((gene, index) => ({
    name: gene.name,
    importance: Number.isFinite(gene.importance) ? Math.max(0, gene.importance) : 0,
    index,
  }));

  const maxImportance = Math.max(...topGenes.map((gene) => gene.importance), 1);
  const confidenceLabel = confidenceDescriptor(data.confidence);

  const interpretation = isInconclusive
    ? 'The model output is not strongly separated. This result should be interpreted with caution and confirmed with clinical and laboratory context.'
    : clinicalInsight.description;

  const suggestedNextStep = isInconclusive
    ? 'Repeat molecular review and correlate with laboratory findings before considering treatment pathway decisions. Multidisciplinary oncologist review is advised.'
    : isHighTMB
      ? 'Correlate this signal with pathology and staging data. Consider immunotherapy eligibility review in the appropriate clinical context.'
      : 'Correlate with pathology and disease staging. Consider standard-of-care planning with oncologist review and laboratory confirmation.';

  const modalityCards = [
    {
      key: 'mGE',
      title: 'mGE · Gene Expression',
      description: 'Measures gene activity levels across the tumor.',
      filename: uploadedFileNames?.mGE,
    },
    {
      key: 'mDM',
      title: 'mDM · DNA Methylation',
      description: 'Captures epigenetic methylation patterns.',
      filename: uploadedFileNames?.mDM,
    },
    {
      key: 'mCNA',
      title: 'mCNA · Copy Number Alterations',
      description: 'Detects chromosomal copy number changes.',
      filename: uploadedFileNames?.mCNA,
    },
  ];

  return (
    <motion.section
      initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className="max-w-6xl mx-auto px-5 md:px-8 py-6 md:py-8 space-y-6 md:space-y-7 pb-20 print:pb-0"
    >
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 border-b border-slate-200 pb-5 print:hidden">
        <div>
          <span className="text-blue-600 font-bold text-sm tracking-widest uppercase">Clinical Decision Support</span>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 mt-1 tracking-tight">OncoAssist AI Report</h1>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="w-fit flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl hover:bg-slate-800 transition-all shadow-lg"
        >
          <Printer size={18} /> Print Report
        </button>
      </header>

      <div className="print-only print-report-header border-b border-slate-300 pb-3 mb-4">
        <p className="text-lg font-bold text-slate-900">OncoAssist AI - Clinical Decision Support Report</p>
        <p className="text-xs text-slate-600 mt-1">Generated: {formatNowForPrint(createdAt)}</p>
        <p className="text-xs text-slate-600">Report ID: {reportId}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-7 print-report-shell">
        <div className="lg:col-span-2 space-y-6 md:space-y-7">
          <article className={`rounded-3xl p-6 md:p-8 border-2 shadow-lg relative overflow-hidden print-avoid-break ${isHighTMB ? 'bg-emerald-50 border-emerald-200' : 'bg-orange-50 border-orange-200'}`}>
            <div className="absolute top-0 right-0 p-8 opacity-10">
              {isHighTMB ? <CheckCircle2 size={116} className="text-emerald-600" /> : <AlertCircle size={116} className="text-orange-600" />}
            </div>

            <div className="relative z-10 space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border ${isHighTMB ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-orange-100 text-orange-800 border-orange-200'}`}>
                  {isHighTMB ? 'High-TMB signal' : 'Low-TMB signal'}
                </span>
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border ${data.confidence >= 0.75 ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : data.confidence >= 0.55 ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-rose-100 text-rose-700 border-rose-200'}`}>
                  {confidenceLabel}
                </span>
                {isInconclusive ? (
                  <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border bg-amber-100 text-amber-800 border-amber-300">
                    Low Confidence - Verify with Lab
                  </span>
                ) : null}
              </div>

              <div>
                <p className="text-xs tracking-widest uppercase font-semibold text-slate-600 mb-2">Prediction</p>
                <h2 className={`text-4xl md:text-5xl font-black ${isHighTMB ? 'text-emerald-700' : 'text-orange-700'}`}>{data.prediction}</h2>
              </div>

              <div>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="text-xs tracking-widest uppercase font-semibold text-slate-600">Confidence</p>
                  <p className={`text-sm font-bold ${confidenceTextClass(data.confidence)}`}>{confidencePct.toFixed(1)}%</p>
                </div>
                <div className="h-2.5 rounded-full bg-white/80 border border-slate-200 overflow-hidden">
                  <motion.div
                    className={`h-full ${confidenceColorClass(data.confidence)}`}
                    initial={prefersReducedMotion ? false : { width: 0 }}
                    animate={{ width: `${confidencePct}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                  />
                </div>
                <p className="mt-2 text-sm text-slate-700">{confidenceLabel}</p>
              </div>

              <div className={`rounded-xl border-l-4 p-4 ${isHighTMB ? 'border-emerald-500 bg-emerald-100/40' : 'border-orange-500 bg-orange-100/40'}`}>
                <p className="text-xs tracking-widest uppercase font-semibold text-slate-600 mb-1">Clinical Interpretation</p>
                <p className="text-sm text-slate-700 leading-relaxed">{interpretation}</p>
              </div>

              <div className="rounded-xl border border-slate-300 bg-white/70 p-4">
                <p className="text-xs tracking-widest uppercase font-semibold text-slate-600 mb-1">Suggested Next Step</p>
                <p className="text-sm text-slate-700 leading-relaxed">{suggestedNextStep}</p>
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm print-avoid-break">
            <p className="text-xs uppercase tracking-wide font-semibold text-slate-500">Report Trace</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{reportId}</p>
            <p className="text-xs text-slate-600 mt-1">Generated {formatNowForPrint(createdAt)}</p>
          </article>

          <article className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm print-avoid-break">
            <h3 className="font-bold text-xl flex items-center gap-2 text-slate-800 mb-4">
              <Dna className="text-blue-600" /> Uploaded Omics Summary
            </h3>
            <p className="text-slate-600 leading-relaxed mb-4 text-sm">
              Prediction integrates validated multi-omics modalities. Each uploaded file is parsed and included in model inference.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {modalityCards.map((item) => (
                <div key={item.key} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                    <Dna size={15} className="text-slate-500" />
                  </div>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">{item.description}</p>
                  <p className="text-xs text-slate-500 mt-3">{item.filename ?? 'Uploaded'}</p>
                  <p className="text-[11px] font-semibold text-emerald-700 mt-2">Validated · Parsed successfully · Included in prediction</p>
                </div>
              ))}
            </div>
          </article>

          <article className="bg-slate-50 rounded-3xl p-6 md:p-8 border-2 border-slate-200 print-avoid-break">
            <h3 className="font-bold text-xl text-slate-900 mb-4 flex items-center gap-2">
              <ShieldCheck className="text-slate-600" size={24} />
              {METHODOLOGY_LIMITATIONS.title}
            </h3>
            <ul className="space-y-3 text-sm text-slate-700 leading-relaxed list-disc pl-5">
              {METHODOLOGY_LIMITATIONS.points.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </article>

          <article className="bg-red-50 rounded-3xl p-6 border-2 border-red-200 print-avoid-break">
            <div className="flex gap-3">
              <AlertCircle className="text-red-600 flex-shrink-0 mt-1" size={24} />
              <div>
                <h4 className="font-black text-red-900 mb-2">Important Medical Disclaimer</h4>
                <p className="text-red-800 leading-relaxed text-sm font-medium">{DISCLAIMER}</p>
              </div>
            </div>
          </article>
        </div>

        <aside className="space-y-6">
          <article className="bg-slate-900 rounded-3xl p-6 text-white shadow-md print-avoid-break">
            <h3 className="font-bold text-lg mb-2">Top Influential Genomic Features</h3>
            <p className="text-slate-300 text-xs mb-5">
              These features had the strongest influence on the model output for this case.
            </p>
            {topGenes.length === 0 ? (
              <p className="text-slate-300 text-sm">No ranked features were returned by the model.</p>
            ) : (
              <div className="space-y-3">
                {topGenes.map((gene) => {
                  const widthPct = Math.max((gene.importance / maxImportance) * 100, 4);
                  return (
                    <motion.div
                      key={`${gene.name}-${gene.index}`}
                      initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: prefersReducedMotion ? 0 : gene.index * 0.05 }}
                      className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-3"
                    >
                      <div className="flex items-center justify-between gap-3 text-xs mb-2">
                        <span className="font-medium text-slate-100 truncate">{gene.name}</span>
                        <span className="font-semibold text-slate-200">{gene.importance.toFixed(4)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-blue-500 to-cyan-400"
                          initial={prefersReducedMotion ? false : { width: 0 }}
                          animate={{ width: `${widthPct}%` }}
                          transition={{ duration: 0.45, delay: prefersReducedMotion ? 0 : 0.08 + gene.index * 0.06 }}
                        />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </article>
        </aside>
      </div>

      <footer className="print-only print-report-footer mt-6 border-t border-slate-300 pt-3 text-[11px] text-slate-600">
        This report is generated by an AI research tool. It does not replace certified laboratory diagnostics or physician judgment. For research and decision-support use only.
      </footer>
    </motion.section>
  );
};

export default ClinicalReport;
