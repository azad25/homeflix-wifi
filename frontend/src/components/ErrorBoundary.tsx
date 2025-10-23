"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { Tv, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
  private reloadTimeout?: NodeJS.Timeout;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });

    // Auto-reload after 10 seconds for TV channel stability
    this.reloadTimeout = setTimeout(() => {
      window.location.reload();
    }, 10000);
  }

  componentWillUnmount() {
    if (this.reloadTimeout) {
      clearTimeout(this.reloadTimeout);
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen bg-black flex items-center justify-center">
          <div className="text-center text-white">
            <div className="text-red-500 text-6xl mb-6">
              <Tv />
            </div>
            <h1 className="text-2xl font-bold mb-4">HomeFlix TV</h1>
            <p className="text-lg mb-6">Technical difficulties detected</p>
            <p className="text-sm text-gray-400 mb-8">
              Automatically reloading in a few seconds...
            </p>
            <button
              onClick={this.handleReload}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg transition-colors flex items-center gap-2 mx-auto"
            >
              <RefreshCw className="w-5 h-5" />
              Reload Now
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;