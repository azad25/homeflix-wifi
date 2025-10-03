import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showRetry?: boolean;
  retryText?: string;
  className?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    retryCount: 0,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, retryCount: 0 };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      retryCount: this.state.retryCount + 1,
    });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className={`flex items-center justify-center min-h-[200px] ${this.props.className || ''}`}>
          <div className="text-center p-6 bg-black/80 backdrop-blur-sm rounded-xl border border-red-900/30 max-w-md">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-white font-bold text-lg mb-2">Something went wrong</h3>
            <p className="text-gray-400 text-sm mb-4">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            
            {this.props.showRetry !== false && (
              <button
                onClick={this.handleRetry}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md transition-colors duration-200 flex items-center gap-2 mx-auto"
              >
                <RefreshCw className="w-4 h-4" />
                {this.props.retryText || 'Try Again'}
              </button>
            )}
            
            {this.state.retryCount > 0 && (
              <p className="text-gray-500 text-xs mt-2">
                Retry attempt: {this.state.retryCount}
              </p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Netflix-style media error boundary
export const MediaErrorBoundary: React.FC<{
  children: ReactNode;
  mediaTitle?: string;
}> = ({ children, mediaTitle }) => {
  return (
    <ErrorBoundary
      fallback={
        <div className="w-full h-full bg-gradient-to-br from-black/80 via-gray-900/60 to-black/80 flex items-center justify-center">
          <div className="text-center p-4">
            <div className="text-4xl mb-3">🎬</div>
            <p className="text-white font-medium text-sm mb-1">
              {mediaTitle || 'Media'} unavailable
            </p>
            <p className="text-gray-400 text-xs">
              Please try refreshing the page
            </p>
          </div>
        </div>
      }
      showRetry={true}
      retryText="Reload Media"
    >
      {children}
    </ErrorBoundary>
  );
};

export default ErrorBoundary;
