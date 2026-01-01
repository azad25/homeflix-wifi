"use client";

import React, { useEffect, useState } from 'react';

interface PerformanceMetrics {
  loadTime: number;
  widgetCount: number;
  cacheHit: boolean;
  timestamp: number;
}

interface WidgetPerformanceMonitorProps {
  page: string;
  widgetCount: number;
  loading: boolean;
  error?: Error | null;
}

export default function WidgetPerformanceMonitor({
  page,
  widgetCount,
  loading,
  error
}: WidgetPerformanceMonitorProps) {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [startTime, setStartTime] = useState<number>(0);

  useEffect(() => {
    if (loading && startTime === 0) {
      setStartTime(performance.now());
    } else if (!loading && startTime > 0) {
      const loadTime = performance.now() - startTime;
      setMetrics({
        loadTime,
        widgetCount,
        cacheHit: loadTime < 100, // Assume cache hit if load time is very fast
        timestamp: Date.now()
      });
      setStartTime(0);
    }
  }, [loading, startTime, widgetCount]);

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  if (!metrics) {
    return null;
  }

  const getPerformanceColor = (loadTime: number) => {
    if (loadTime < 100) return 'text-green-400';
    if (loadTime < 500) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white p-3 rounded-lg text-xs font-mono z-50">
      <div className="space-y-1">
        <div>Page: <span className="text-blue-400">{page}</span></div>
        <div>Widgets: <span className="text-cyan-400">{metrics.widgetCount}</span></div>
        <div>
          Load Time: <span className={getPerformanceColor(metrics.loadTime)}>
            {metrics.loadTime.toFixed(1)}ms
          </span>
        </div>
        <div>
          Cache: <span className={metrics.cacheHit ? 'text-green-400' : 'text-orange-400'}>
            {metrics.cacheHit ? 'HIT' : 'MISS'}
          </span>
        </div>
        {error && (
          <div className="text-red-400">Error: {error.message}</div>
        )}
      </div>
    </div>
  );
}