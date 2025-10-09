'use client';

import React from 'react';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';

interface LoadingFallbackProps {
  error?: Error | null;
  retry?: () => void;
  children?: React.ReactNode;
}

const LoadingFallback: React.FC<LoadingFallbackProps> = ({ error, retry, children }) => {
  const { isOnline, isServerReachable } = useConnectionStatus();

  if (error || (!isOnline || !isServerReachable)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-red-900/20 to-black flex items-center justify-center p-4">
        <div className="bg-black/80 backdrop-blur-sm border border-red-500/30 rounded-lg p-8 max-w-md w-full text-center">
          <div className="text-red-500 text-6xl mb-4">
            {!isOnline ? '📡' : !isServerReachable ? '🔌' : '⚠️'}
          </div>
          
          <h2 className="text-2xl font-bold text-white mb-4">
            {!isOnline 
              ? 'No Internet Connection' 
              : !isServerReachable 
                ? 'Server Disconnected' 
                : 'Loading Error'
            }
          </h2>
          
          <p className="text-gray-300 mb-6">
            {!isOnline 
              ? 'Please check your internet connection and try again.'
              : !isServerReachable 
                ? 'Unable to connect to HomeFlix server. Please check if the server is running.'
                : error?.message || 'An error occurred while loading content.'
            }
          </p>
          
          <div className="space-y-3">
            {retry && (
              <button
                onClick={retry}
                className="w-full bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Try Again
              </button>
            )}
            
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-red-900/20 to-black flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto mb-4"></div>
        <p className="text-white text-lg">Loading HomeFlix...</p>
        {children}
      </div>
    </div>
  );
};

export default LoadingFallback;
