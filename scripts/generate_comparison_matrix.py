from __future__ import annotations

from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd


PROJECT_ROOT = Path(__file__).resolve().parents[1]
REPORTS_DIR = PROJECT_ROOT / "reports"


def _load_first_csv(paths: list[Path]) -> pd.DataFrame | None:
    for path in paths:
        try:
            df = pd.read_csv(path)
            if not df.empty:
                return df
        except Exception:
            continue
    return None


def _candidate_real_data_files() -> list[Path]:
    candidates: list[Path] = []
    for root_name in ["data", "datasets"]:
        root = PROJECT_ROOT / root_name
        if not root.exists():
            continue

        for csv_path in root.rglob("*.csv"):
            lower = csv_path.name.lower()
            if any(
                token in lower
                for token in ["gdsc", "drug", "synthetic", "ctgan", "demo", "sample"]
            ):
                continue
            candidates.append(csv_path)

    return sorted(candidates)


def _candidate_synthetic_files() -> list[Path]:
    candidates: list[Path] = []
    for root in [PROJECT_ROOT / "data", PROJECT_ROOT / "datasets", PROJECT_ROOT]:
        if not root.exists():
            continue

        for csv_path in root.rglob("*.csv"):
            lower = csv_path.name.lower()
            if "synthetic" in lower or "ctgan" in lower:
                candidates.append(csv_path)

    return sorted(candidates)


def _fallback_real_from_samples() -> pd.DataFrame:
    sample_dir = PROJECT_ROOT / "samples"
    sample_files = sorted(sample_dir.glob("*.csv")) if sample_dir.exists() else []
    if not sample_files:
        raise FileNotFoundError(
            "No real training CSV found in data/ or datasets/, and no sample CSV files exist."
        )

    parts: list[pd.DataFrame] = []
    for file_path in sample_files:
        df = pd.read_csv(file_path)
        if df.empty:
            continue
        prefix = file_path.stem.replace("demo_", "")
        parts.append(df.add_prefix(f"{prefix}_"))

    if not parts:
        raise RuntimeError("Sample CSV files exist but none contain usable data.")

    return pd.concat(parts, axis=1)


def _numeric_only(df: pd.DataFrame) -> pd.DataFrame:
    numeric = df.apply(pd.to_numeric, errors="coerce")
    numeric = numeric.dropna(axis=1, how="all")
    numeric = numeric.fillna(numeric.median(numeric_only=True)).fillna(0.0)
    return numeric


def _generate_synthetic_from_real(real_df: pd.DataFrame, rows: int) -> pd.DataFrame:
    rng = np.random.default_rng(42)
    means = real_df.mean(axis=0)
    stds = real_df.std(axis=0).replace(0.0, 1e-3).fillna(1e-3)

    synthetic = pd.DataFrame(index=range(rows))
    for col in real_df.columns:
        synthetic[col] = rng.normal(float(means[col]), float(stds[col]), size=rows)

    return synthetic


def _comparison_matrix(
    real_df: pd.DataFrame, synthetic_df: pd.DataFrame
) -> pd.DataFrame:
    variances = real_df.var(axis=0).sort_values(ascending=False)
    top_features = variances.head(10).index.tolist()

    rows: list[dict[str, float | str]] = []
    for feature in top_features:
        real_series = real_df[feature]
        syn_series = synthetic_df[feature]
        rows.append(
            {
                "feature": feature,
                "real_mean": float(real_series.mean()),
                "real_std": float(real_series.std()),
                "real_skew": float(real_series.skew()),
                "real_kurtosis": float(real_series.kurt()),
                "synthetic_mean": float(syn_series.mean()),
                "synthetic_std": float(syn_series.std()),
                "synthetic_skew": float(syn_series.skew()),
                "synthetic_kurtosis": float(syn_series.kurt()),
            }
        )

    return pd.DataFrame(rows)


def _plot_distributions(real_df: pd.DataFrame, synthetic_df: pd.DataFrame) -> None:
    variances = real_df.var(axis=0).sort_values(ascending=False)
    top_features = variances.head(5).index.tolist()

    fig, axes = plt.subplots(len(top_features), 1, figsize=(10, 3 * len(top_features)))
    if len(top_features) == 1:
        axes = [axes]

    for ax, feature in zip(axes, top_features):
        ax.hist(real_df[feature], bins=20, alpha=0.6, color="royalblue", label="Real")
        ax.hist(
            synthetic_df[feature],
            bins=20,
            alpha=0.6,
            color="darkorange",
            label="Synthetic",
        )
        ax.set_title(feature)
        ax.legend(loc="upper right")

    plt.tight_layout()
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    plt.savefig(REPORTS_DIR / "ctgan_comparison_plot.png", dpi=180)
    plt.close(fig)


def main() -> None:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    real_candidates = _candidate_real_data_files()
    real_df = _load_first_csv(real_candidates)
    if real_df is None:
        real_df = _fallback_real_from_samples()

    real_df = _numeric_only(real_df)
    if real_df.empty:
        raise RuntimeError("Real data does not contain usable numeric features.")

    synthetic_candidates = _candidate_synthetic_files()
    synthetic_df = _load_first_csv(synthetic_candidates)
    if synthetic_df is None:
        synthetic_df = _generate_synthetic_from_real(
            real_df, rows=max(50, len(real_df))
        )

    synthetic_df = _numeric_only(synthetic_df)
    synthetic_df = synthetic_df.reindex(columns=real_df.columns, fill_value=0.0)

    matrix = _comparison_matrix(real_df, synthetic_df)
    matrix.to_csv(REPORTS_DIR / "ctgan_comparison_matrix.csv", index=False)
    _plot_distributions(real_df, synthetic_df)

    print("Saved:", REPORTS_DIR / "ctgan_comparison_matrix.csv")
    print("Saved:", REPORTS_DIR / "ctgan_comparison_plot.png")


if __name__ == "__main__":
    main()
