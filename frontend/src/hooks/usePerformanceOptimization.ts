import { useEffect, useCallback, useRef } from 'react';

interface PerformanceMetrics {
  renderTime: number;
  componentName: string;
  timestamp: number;
}

export function usePerformanceOptimization(componentName: string) {
  const renderStartTime = useRef<number>(0);
  const metricsRef = useRef<PerformanceMetrics[]>([]);

  // Start performance measurement
  useEffect(() => {
    renderStartTime.current = performance.now();
    
    return () => {
      const renderTime = performance.now() - renderStartTime.current;
      metricsRef.current.push({
        renderTime,
        componentName,
        timestamp: Date.now()
      });

      // Log slow renders in development
      if (process.env.NODE_ENV === 'development' && renderTime > 16) {
        console.warn(`Slow render detected in ${componentName}: ${renderTime.toFixed(2)}ms`);
      }
    };
  });

  // Debounced function for expensive operations
  const debounce = useCallback((func: Function, delay: number) => {
    let timeoutId: NodeJS.Timeout;
    return (...args: any[]) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(null, args), delay);
    };
  }, []);

  // Throttled function for frequent operations
  const throttle = useCallback((func: Function, delay: number) => {
    let lastCall = 0;
    return (...args: any[]) => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        return func.apply(null, args);
      }
    };
  }, []);

  // Optimized image loading
  const preloadImage = useCallback((src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = src;
    });
  }, []);

  // Batch image preloading
  const preloadImages = useCallback(async (urls: string[], batchSize: number = 3) => {
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      await Promise.allSettled(batch.map(preloadImage));
      
      // Small delay between batches to prevent blocking
      if (i + batchSize < urls.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
  }, [preloadImage]);

  // Intersection Observer for lazy loading
  const createIntersectionObserver = useCallback((
    callback: (entries: IntersectionObserverEntry[]) => void,
    options?: IntersectionObserverInit
  ) => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      return null;
    }

    return new IntersectionObserver(callback, {
      rootMargin: '50px',
      threshold: 0.1,
      ...options
    });
  }, []);

  // Get performance metrics
  const getMetrics = useCallback(() => {
    return metricsRef.current.slice();
  }, []);

  // Clear metrics
  const clearMetrics = useCallback(() => {
    metricsRef.current = [];
  }, []);

  return {
    debounce,
    throttle,
    preloadImage,
    preloadImages,
    createIntersectionObserver,
    getMetrics,
    clearMetrics
  };
}

// Hook for optimizing list rendering
export function useVirtualization(
  items: any[],
  containerHeight: number,
  itemHeight: number,
  overscan: number = 5
) {
  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const totalCount = items.length;

  const getVisibleRange = useCallback((scrollTop: number) => {
    const start = Math.floor(scrollTop / itemHeight);
    const end = Math.min(start + visibleCount + overscan, totalCount);
    
    return {
      start: Math.max(0, start - overscan),
      end,
      visibleItems: items.slice(Math.max(0, start - overscan), end)
    };
  }, [items, itemHeight, visibleCount, totalCount, overscan]);

  return {
    getVisibleRange,
    totalHeight: totalCount * itemHeight,
    visibleCount
  };
}

// Hook for optimizing re-renders
export function useStableCallback<T extends (...args: any[]) => any>(callback: T): T {
  const callbackRef = useRef<T>(callback);
  
  useEffect(() => {
    callbackRef.current = callback;
  });

  return useCallback(((...args: any[]) => {
    return callbackRef.current(...args);
  }) as T, []);
}