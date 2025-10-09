'use client';

import React, { useState, useEffect } from 'react';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import LoadingFallback from './LoadingFallback';

interface SafeMediaLoaderProps {
  children: React.ReactNode;
  loadData: () => Promise<any>;
  fallbackData?: any[];
  errorMessage?: string;
}

const SafeMediaLoader: React.FC<SafeMediaLoaderProps> = ({ 
  children, 
  loadData, 
  fallbackData = [], 
  errorMessage = "Failed to load content" 
}) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { isServerReachable } = useConnectionStatus();

  const attemptLoad = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await loadData();
      setData(result);
    } catch (err) {
      console.error('SafeMediaLoader error:', err);
      setError(err instanceof Error ? err : new Error(errorMessage));
      
      // Use fallback data if available
      if (fallbackData.length > 0) {
        setData(fallbackData);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isServerReachable) {
      attemptLoad();
    } else {
      // Use fallback data when server is not reachable
      setData(fallbackData);
      setLoading(false);
    }
  }, [isServerReachable]);

  if (loading) {
    return <LoadingFallback />;
  }

  if (error && !data) {
    return <LoadingFallback error={error} retry={attemptLoad} />;
  }

  // Pass data through context or render children directly
  return <>{children}</>;
};

export default SafeMediaLoader;
