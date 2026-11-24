import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'An unexpected error occurred.',
    };
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-white text-neutral-950 flex items-center justify-center p-6">
          <div className="max-w-lg w-full border border-neutral-200 rounded-xl p-8 bg-neutral-50 space-y-4">
            <h1 className="text-xl font-bold tracking-tight">Something went wrong</h1>
            <p className="text-sm text-neutral-600 leading-relaxed">
              We encountered an error while loading this view. Please reload the page or return to
              the storefront.
            </p>
            <p className="text-xs font-mono text-neutral-500 break-all">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 bg-neutral-950 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
