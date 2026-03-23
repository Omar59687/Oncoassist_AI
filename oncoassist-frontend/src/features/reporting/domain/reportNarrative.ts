import type { AnalysisResult } from '../../analysis/domain/entities/AnalysisResult';

type UploadedFileNames = {
  mGE: string;
  mDM: string;
  mCNA: string;
} | null;

export type ConfidenceBand = 'high' | 'moderate' | 'low';

type NarrativeInput = {
  result: AnalysisResult;
  uploadedFileNames?: UploadedFileNames;
};

export const getConfidenceBand = (
  confidence: number | undefined,
  isInconclusive: boolean | undefined,
): ConfidenceBand => {
  const normalized = Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence as number)) : 0;
  if (isInconclusive || normalized < 0.55) return 'low';
  if (normalized < 0.75) return 'moderate';
  return 'high';
};

export const buildInterpretationSummary = ({ result }: NarrativeInput): string[] => {
  const parts: string[] = [];
  const confidence = Number.isFinite(result.confidence) ? result.confidence : undefined;
  const confidencePct = confidence !== undefined ? Math.round(confidence * 100) : undefined;
  const band = getConfidenceBand(confidence, result.is_inconclusive);
  const topFeatures = (result.top_genes || []).slice(0, 3).map((item) => item.name).filter(Boolean);

  parts.push(`The model predicted ${result.prediction || 'an unavailable TMB class'} for this uploaded case.`);

  if (confidencePct !== undefined) {
    const bandText = band === 'high' ? 'high' : band === 'moderate' ? 'moderate' : 'low';
    parts.push(`Prediction confidence is ${bandText} (${confidencePct}%).`);
  }

  if (topFeatures.length > 0) {
    parts.push(`The strongest contributing genomic features for this prediction were ${topFeatures.join(', ')}.`);
  }

  if (result.is_inconclusive) {
    parts.push('Because model certainty is limited, this result should be treated as supportive only and not used in isolation.');
  } else if ((result.prediction || '').toLowerCase().includes('high')) {
    parts.push('This pattern may be associated with higher mutational burden and may support consideration of immunotherapy-related evaluation in the appropriate clinical context.');
  } else {
    parts.push('This pattern suggests a lower mutational burden profile, which may indicate lower expected benefit from immunotherapy in some settings.');
  }

  parts.push('This output was generated from the uploaded gene expression, DNA methylation, and copy number alteration inputs after preprocessing and feature alignment.');

  return parts;
};

export const buildSuggestedNextStep = ({ result }: NarrativeInput): string => {
  const confidenceBand = getConfidenceBand(result.confidence, result.is_inconclusive);
  const hasDrugSuggestions = (result.drugs || []).length > 0;
  const isHigh = (result.prediction || '').toLowerCase().includes('high');

  let statement: string;

  if (result.is_inconclusive || confidenceBand === 'low') {
    statement = 'Model confidence is limited for this case. Correlation with certified laboratory biomarker testing and oncologist review is recommended before treatment planning.';
  } else if (isHigh) {
    statement = 'This result may support further evaluation for immunotherapy suitability in the appropriate clinical context. Confirmatory laboratory testing and oncologist review are recommended before final treatment decisions.';
  } else {
    statement = 'This result may support evaluation of non-immunotherapy treatment pathways in the appropriate clinical setting. Laboratory confirmation and multidisciplinary review are recommended before final treatment decisions.';
  }

  if (hasDrugSuggestions) {
    statement += ' Returned drug suggestions should be treated as reference options for clinical review rather than direct treatment recommendations.';
  }

  return statement;
};

export const buildProcessingOverview = ({ result, uploadedFileNames }: NarrativeInput) => {
  const liveSteps = [
    { title: 'Input Validation', detail: 'The uploaded mGE, mDM, and mCNA CSV files were checked for presence, format, and parseability.' },
    { title: 'Data Preparation', detail: 'Numeric feature columns were prepared, missing values handled, and features aligned to the model input format.' },
    { title: 'Feature Transformation', detail: 'Saved scaler or encoder artifacts were applied when available; fallback scaling is used when needed.' },
    { title: 'Model Prediction', detail: 'The deployed model generated a class probability that was mapped to High-TMB or Low-TMB with confidence.' },
    { title: 'Result Assembly', detail: 'Clinical note, top influential features, and report metadata were attached for decision-support review.' },
  ];

  const developmentContext = [
    'During model development, dimensionality reduction and imbalance-handling methods were used to improve generalization.',
    'During live inference, the deployed model processes only the uploaded case using saved preprocessing and prediction artifacts.',
  ];

  const evidenceRows = [
    {
      label: 'Inputs used',
      value: [
        uploadedFileNames?.mGE ? `mGE (${uploadedFileNames.mGE})` : 'mGE',
        uploadedFileNames?.mDM ? `mDM (${uploadedFileNames.mDM})` : 'mDM',
        uploadedFileNames?.mCNA ? `mCNA (${uploadedFileNames.mCNA})` : 'mCNA',
      ].join(' · '),
    },
    {
      label: 'Prediction confidence',
      value: Number.isFinite(result.confidence) ? `${(result.confidence * 100).toFixed(1)}%` : 'Unavailable',
    },
    {
      label: 'Inconclusive flag',
      value: result.is_inconclusive ? 'Yes' : 'No',
    },
    {
      label: 'Top features extracted',
      value: `${(result.top_genes || []).length}`,
    },
  ];

  if (typeof result.auc_roc === 'number') {
    evidenceRows.push({ label: 'AUC-ROC available', value: result.auc_roc.toFixed(3) });
  }

  if (Array.isArray(result.drugs)) {
    evidenceRows.push({ label: 'Drug suggestions returned', value: `${result.drugs.length}` });
  }

  return { liveSteps, developmentContext, evidenceRows };
};
