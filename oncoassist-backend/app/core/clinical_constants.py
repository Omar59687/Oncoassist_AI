"""
Clinical Insights and Medical Content Constants
Used across the OncoAssist AI backend for consistent medical terminology
"""

CLINICAL_INSIGHTS = {
    "HIGH_TMB": {
        "title": "High Mutational Load",
        "description": "The genomic profile indicates a high mutational load. This suggests a potentially increased neoantigen landscape, which correlates with better clinical responses to Immune Checkpoint Inhibitors (ICIs).",
        "recommendation": "Consider immunotherapy (e.g., Pembrolizumab, Atezolizumab) or checkpoint inhibitor combinations.",
    },
    "LOW_TMB": {
        "title": "Stable Mutational Environment",
        "description": "The genomic profile indicates a stable mutational environment. Conventional therapeutic pathways or combined targeted therapies may be more appropriate. Clinical correlation is advised.",
        "recommendation": "Evaluate targeted therapies based on specific genomic alterations. Consider conventional chemotherapy if appropriate.",
    },
}

METHODOLOGY_INFO = {
    "title": "Methodology & Limitations",
    "institution": "Leekheed University",
    "key_techniques": [
        "Multi-omics Integration (mGE, mDM, mCNA)",
        "Autoencoder-based Feature Reduction",
        "Conditional Generative Adversarial Networks (AE-CTGAN)",
        "SHAP-based Feature Importance Analysis",
        "Ensemble Learning Models",
    ],
    "strengths": [
        "Comprehensive tumor profiling through multi-modal genomic integration",
        "AI-powered dimensionality reduction for high-dimensional data",
        "Explainable predictions with feature importance rankings",
        "Validated on clinical cohorts with high AUC-ROC performance",
    ],
    "limitations": [
        "Research-based tool, not a certified diagnostic instrument",
        "Requires quality multi-omics input data",
        "Should complement, not replace, histopathological analysis",
        "Clinical validation required before therapeutic implementation",
        "Performance depends on data preprocessing and normalization",
    ],
}

DISCLAIMER = (
    "OncoAssist AI is a research-based clinical decision support tool. "
    "It is NOT a replacement for histopathological or certified laboratory molecular diagnostics. "
    "All clinical decisions should be made by qualified healthcare professionals after comprehensive patient evaluation."
)

LOADING_MESSAGES = [
    "Preprocessing Multi-omics data...",
    "Running AE-CTGAN feature reduction...",
    "Analyzing Feature Importance...",
    "Generating Clinical Prediction...",
    "Compiling Therapeutic Recommendations...",
]
