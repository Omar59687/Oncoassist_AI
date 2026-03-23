/**
 * Clinical Insights and Medical Content Constants
 * Used across the OncoAssist AI application for consistent medical terminology
 */

export const CLINICAL_INSIGHTS = {
  HIGH_TMB: {
    title: "High Mutational Load",
    description: "The genomic profile indicates a high mutational load. This suggests a potentially increased neoantigen landscape, which correlates with better clinical responses to Immune Checkpoint Inhibitors (ICIs).",
    color: "emerald",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    badgeColor: "bg-emerald-100 text-emerald-800",
  },
  LOW_TMB: {
    title: "Stable Mutational Environment",
    description: "The genomic profile indicates a stable mutational environment. Conventional therapeutic pathways or combined targeted therapies may be more appropriate. Clinical correlation is advised.",
    color: "orange",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    badgeColor: "bg-orange-100 text-orange-800",
  },
};

export const METHODOLOGY_LIMITATIONS = {
  title: "Methodology & Limitations",
  content: `OncoAssist AI is built upon cutting-edge research from Leekheed University, leveraging advanced machine learning techniques to bridge critical data gaps in genomic analysis. The system integrates multi-omics data (mGE, mDM, mCNA) through autoencoders and generative models (AE-CTGAN) to provide comprehensive tumor mutational burden predictions and therapeutic recommendations.

Key methodological strengths include:
• Integration of multiple genomic modalities for holistic tumor profiling
• AI-powered feature reduction and dimensionality analysis
• Validated on clinical cohorts with high predictive accuracy

Important limitations to consider:
• This tool is a research-based clinical decision support system, NOT a replacement for histopathological or certified laboratory molecular diagnostics
• Results should be interpreted in conjunction with clinical examination and pathologist review
• Therapeutic recommendations require validation through clinical trials and physician expertise
• Data quality directly impacts prediction accuracy; ensure input files meet specified standards`,
};

export const DISCLAIMER = "OncoAssist AI is a research-based clinical decision support tool. It is NOT a replacement for histopathological or certified laboratory molecular diagnostics. All clinical decisions should be made by qualified healthcare professionals after comprehensive patient evaluation.";

export const LOADING_STEPS = [
  {
    step: 1,
    title: "Preprocessing Multi-omics Data",
    description: "Normalizing and validating mGE, mDM, and mCNA feature matrices...",
    icon: "Database",
  },
  {
    step: 2,
    title: "Running AE-CTGAN Feature Reduction",
    description: "Applying autoencoders and conditional GANs for dimensionality reduction...",
    icon: "Dna",
  },
  {
    step: 3,
    title: "Analyzing Feature Importance",
    description: "Computing SHAP values and feature interactions for explainability...",
    icon: "BrainCircuit",
  },
  {
    step: 4,
    title: "Generating Clinical Prediction",
    description: "Running ensemble models and calculating confidence intervals...",
    icon: "Activity",
  },
  {
    step: 5,
    title: "Compiling Clinical Insights",
    description: "Generating therapeutic recommendations based on prediction confidence...",
    icon: "ShieldCheck",
  },
];
