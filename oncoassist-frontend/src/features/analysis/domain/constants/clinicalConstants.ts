/**
 * Clinical Insights and Medical Content Constants
 * Used across the OncoAssist AI application for consistent medical terminology
 */

export const CLINICAL_INSIGHTS = {
  HIGH_TMB: {
    title: "High-TMB Signal",
    description:
      "The genomic profile suggests an elevated mutational burden, which may support consideration of immunotherapy in the appropriate clinical context.",
    color: "emerald",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    badgeColor: "bg-emerald-100 text-emerald-800",
  },
  LOW_TMB: {
    title: "Low-TMB Signal",
    description:
      "The genomic profile suggests a lower mutational burden. Reduced likelihood of immunotherapy benefit may be considered. Clinical correlation is advised.",
    color: "orange",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    badgeColor: "bg-orange-100 text-orange-800",
  },
};

export const METHODOLOGY_LIMITATIONS = {
  title: "Methodology & Limitations",
  points: [
    "OncoAssist AI is a research-based clinical decision support tool for estimating TMB class from uploaded multi-omics inputs.",
    "This output does not replace certified molecular diagnostics, pathology review, or physician judgment.",
    "Predictions should be interpreted with full clinical context, laboratory confirmation, and multidisciplinary review.",
    "Model behavior depends on input quality and feature compatibility with the training format.",
  ],
};

export const DISCLAIMER = "OncoAssist AI is a research-based clinical decision support tool. It is NOT a replacement for histopathological or certified laboratory molecular diagnostics. All clinical decisions should be made by qualified healthcare professionals after comprehensive patient evaluation.";

export const LOADING_STEPS = [
  {
    step: 1,
    title: "Preprocessing Multi-omics Data",
    description: "Validating mGE, mDM, and mCNA CSV inputs and preparing numeric feature vectors...",
    icon: "Database",
  },
  {
    step: 2,
    title: "Applying Model-Compatible Transformations",
    description: "Applying scaler and optional encoder transforms before classification...",
    icon: "Dna",
  },
  {
    step: 3,
    title: "Analyzing Feature Importance",
    description: "Computing feature contribution ranking for explainability...",
    icon: "BrainCircuit",
  },
  {
    step: 4,
    title: "Generating Clinical Prediction",
    description: "Producing TMB class probability and confidence score...",
    icon: "Activity",
  },
  {
    step: 5,
    title: "Preparing Clinical Report",
    description: "Compiling interpretation, top features, and safety notes for review...",
    icon: "ShieldCheck",
  },
];
