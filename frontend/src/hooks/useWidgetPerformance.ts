import { useEffect, useRef, useState } from 'react';

interface WidgetPerformanceMetrics {
  widgetId: number;
  widgetType: string;
  loadStartTime: number;
  loadEndTime?: number;
  loadDuration?: number;
  dataFetchTime?: number;
  renderTime?: number;
  errorCount: number;
  retryCount: number;
}

interface PerformanceStats {
  totalWidgets: number;
  loadedWidgets: number;
  averageLoadTime: number;
  slowestWidget: WidgetPerformanceMetrics | null;
  fastestWidget: WidgetPerformanceMetrics | null;
  errorRate: number;
  totalErrors: number;
}

export function useWidgetPerformance() {
  const [metrics, setMetrics] = useState<Map<number, WidgetPerformanceMetrics>>(new Map());
  const [stats, setStats] = useState<PerformanceStats>({
    totalWidgets: 0,
    loadedWidgets: 0,
    averageLoadTime: 0,
    slowestWidget: null,
    fastestWidget: null,
    errorRate: 0,
    totalErrors: 0
  });

  const performanceObserverRef = useRef<PerformanceObserver | null>(null);

  // Start tracking a widget's performance
  const startWidgetLoad = (widgetId: number, widgetType: string) => {
    const startTime = performance.now();
    setMetrics(prev => new Map(prev).set(widgetId, {
      widgetId,
      widgetType,
      loadStartTime: startTime,
      errorCount: 0,
      retryCount: 0
    }));
  };

  // Mark widget data fetch completion
  const markDataFetched = (widgetId: number) => {
    const fetchTime = performance.now();
    setMetrics(prev => {
      const current = prev.get(widgetId);
      if (current) {
        const updated = {
          ...current,
          dataFetchTime: fetchTime - current.loadStartTime
        };
        return new Map(prev).set(widgetId, updated);
      }
      return prev;
    });
  };

  // Mark widget render completion
  const markWidgetLoaded = (widgetId: number) => {
    const endTime = performance.now();
    setMetrics(prev => {
      const current = prev.get(widgetId);
      if (current) {
        const updated = {
          ...current,
          loadEndTime: endTime,
          loadDuration: endTime - current.loadStartTime,
          renderTime: current.dataFetchTime ? endTime - (current.loadStartTime + current.dataFetchTime) : undefined
        };
        return new Map(prev).set(widgetId, updated);
      }
      return prev;
    });
  };

  // Record widget error
  const recordWidgetError = (widgetId: number) => {
    setMetrics(prev => {
      const current = prev.get(widgetId);
      if (current) {
        const updated = {
          ...current,
          errorCount: current.errorCount + 1
        };
        return new Map(prev).set(widgetId, updated);
      }
      return prev;
    });
  };

  // Record widget retry
  const recordWidgetRetry = (widgetId: number) => {
    setMetrics(prev => {
      const current = prev.get(widgetId);
      if (current) {
        const updated = {
          ...current,
          retryCount: current.retryCount + 1
        };
        return new Map(prev).set(widgetId, updated);
      }
      return prev;
    });
  };

  // Calculate performance statistics
  useEffect(() => {
    const metricsArray = Array.from(metrics.values());
    const loadedMetrics = metricsArray.filter(m => m.loadDuration !== undefined);
    
    if (metricsArray.length === 0) return;

    const totalErrors = metricsArray.reduce((sum, m) => sum + m.errorCount, 0);
    const loadTimes = loadedMetrics.map(m => m.loadDuration!);
    const averageLoadTime = loadTimes.length > 0 ? loadTimes.reduce((sum, time) => sum + time, 0) / loadTimes.length : 0;
    
    let slowestWidget: WidgetPerformanceMetrics | null = null;
    let fastestWidget: WidgetPerformanceMetrics | null = null;

    if (loadedMetrics.length > 0) {
      slowestWidget = loadedMetrics.reduce((slowest, current) => 
        (current.loadDuration! > slowest.loadDuration!) ? current : slowest
      );
      
      fastestWidget = loadedMetrics.reduce((fastest, current) => 
        (current.loadDuration! < fastest.loadDuration!) ? current : fastest
      );
    }

    setStats({
      totalWidgets: metricsArray.length,
      loadedWidgets: loadedMetrics.length,
      averageLoadTime,
      slowestWidget,
      fastestWidget,
      errorRate: metricsArray.length > 0 ? (totalErrors / metricsArray.length) * 100 : 0,
      totalErrors
    });
  }, [metrics]);

  // Set up Performance Observer for additional metrics
  useEffect(() => {
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      performanceObserverRef.current = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.name.includes('widget-')) {
            console.log(`Widget Performance: ${entry.name} took ${entry.duration}ms`);
          }
        });
      });

      try {
        performanceObserverRef.current.observe({ entryTypes: ['measure'] });
      } catch (error) {
        console.warn('Performance Observer not supported:', error);
      }
    }

    return () => {
      if (performanceObserverRef.current) {
        performanceObserverRef.current.disconnect();
      }
    };
  }, []);

  // Performance mark helpers
  const markStart = (widgetId: number, operation: string) => {
    if (typeof window !== 'undefined' && 'performance' in window) {
      performance.mark(`widget-${widgetId}-${operation}-start`);
    }
  };

  const markEnd = (widgetId: number, operation: string) => {
    if (typeof window !== 'undefined' && 'performance' in window) {
      const startMark = `widget-${widgetId}-${operation}-start`;
      const endMark = `widget-${widgetId}-${operation}-end`;
      const measureName = `widget-${widgetId}-${operation}`;
      
      performance.mark(endMark);
      
      try {
        performance.measure(measureName, startMark, endMark);
      } catch (error) {
        console.warn('Performance measure failed:', error);
      }
    }
  };

  // Get performance report
  const getPerformanceReport = () => {
    const report = {
      summary: stats,
      details: Array.from(metrics.values()),
      recommendations: []
    };

    // Add performance recommendations
    const recommendations: string[] = [];
    
    if (stats.averageLoadTime > 2000) {
      recommendations.push('Consider enabling widget caching to improve load times');
    }
    
    if (stats.errorRate > 10) {
      recommendations.push('High error rate detected - check network connectivity and API endpoints');
    }
    
    if (stats.slowestWidget && stats.slowestWidget.loadDuration! > 5000) {
      recommendations.push(`Widget "${stats.slowestWidget.widgetType}" is loading slowly - consider optimizing data source`);
    }

    return {
      ...report,
      recommendations
    };
  };

  // Clear metrics (useful for page changes)
  const clearMetrics = () => {
    setMetrics(new Map());
  };

  return {
    metrics,
    stats,
    startWidgetLoad,
    markDataFetched,
    markWidgetLoaded,
    recordWidgetError,
    recordWidgetRetry,
    markStart,
    markEnd,
    getPerformanceReport,
    clearMetrics
  };
}