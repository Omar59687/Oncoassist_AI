import React from 'react';

type ReportSnapshot = {
  prediction?: string;
  confidence?: number;
};

type ReportErrorBoundaryProps = {
  children: React.ReactNode;
  reportSnapshot?: ReportSnapshot;
  onBackToUpload: () => void;
};

type ReportErrorBoundaryState = {
  hasError: boolean;
};

class ReportErrorBoundary extends React.Component<ReportErrorBoundaryProps, ReportErrorBoundaryState> {
  public constructor(props: ReportErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  public static getDerivedStateFromError(): ReportErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(error: Error): void {
    console.error('Report render error:', error);
  }

  public render(): React.ReactNode {
    if (this.state.hasError) {
      const confidence = this.props.reportSnapshot?.confidence;
      const prediction = this.props.reportSnapshot?.prediction;

      return (
        <div className="max-w-3xl mx-auto px-6 py-10">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-rose-900">Unable to render full report</h2>
            <p className="mt-2 text-sm text-rose-800">
              A display error occurred while rendering the clinical report. Please review the summary below and return to upload.
            </p>
            <div className="mt-4 space-y-1 text-sm text-slate-700">
              <p>
                <span className="font-semibold">Prediction:</span> {prediction ?? 'Unavailable'}
              </p>
              <p>
                <span className="font-semibold">Confidence:</span>{' '}
                {typeof confidence === 'number' ? `${(confidence * 100).toFixed(1)}%` : 'Unavailable'}
              </p>
            </div>
            <button
              type="button"
              onClick={this.props.onBackToUpload}
              className="mt-6 inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Back to Upload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ReportErrorBoundary;
