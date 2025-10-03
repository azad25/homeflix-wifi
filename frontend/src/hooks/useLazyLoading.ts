import { useState, useEffect, useRef, useCallback } from 'react';

interface LazyLoadingOptions {
  threshold?: number;
  rootMargin?: string;
  enabled?: boolean;
}

export const useLazyLoading = (options: LazyLoadingOptions = {}) => {
  const {
    threshold = 0.1,
    rootMargin = '50px',
    enabled = true
  } = options;

  const [isVisible, setIsVisible] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const elementRef = useRef<HTMLElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const observe = useCallback(() => {
    if (!enabled || hasLoaded || !elementRef.current) return;

    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !hasLoaded) {
          setIsVisible(true);
          setHasLoaded(true);
          // Disconnect after first load for performance
          observerRef.current?.disconnect();
        }
      },
      { threshold, rootMargin }
    );

    observerRef.current.observe(elementRef.current);
  }, [enabled, hasLoaded, threshold, rootMargin]);

  useEffect(() => {
    observe();
    return () => observerRef.current?.disconnect();
  }, [observe]);

  const reset = useCallback(() => {
    setIsVisible(false);
    setHasLoaded(false);
    observe();
  }, [observe]);

  return {
    elementRef,
    isVisible,
    hasLoaded,
    reset
  };
};

// Hook for batch lazy loading multiple items
export const useBatchLazyLoading = (itemCount: number, batchSize: number = 10) => {
  const [loadedBatches, setLoadedBatches] = useState<Set<number>>(new Set([0])); // Load first batch immediately
  const observerRefs = useRef<Map<number, IntersectionObserver>>(new Map());

  const createBatchObserver = useCallback((batchIndex: number) => {
    if (observerRefs.current.has(batchIndex)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setLoadedBatches(prev => new Set([...prev, batchIndex]));
            observer.disconnect();
            observerRefs.current.delete(batchIndex);
          }
        });
      },
      { threshold: 0.1, rootMargin: '200px' }
    );

    observerRefs.current.set(batchIndex, observer);
    return observer;
  }, []);

  const getBatchRef = useCallback((batchIndex: number) => {
    return (element: HTMLElement | null) => {
      if (!element) return;
      
      const observer = createBatchObserver(batchIndex);
      if (observer && !loadedBatches.has(batchIndex)) {
        observer.observe(element);
      }
    };
  }, [createBatchObserver, loadedBatches]);

  const shouldLoadItem = useCallback((itemIndex: number) => {
    const batchIndex = Math.floor(itemIndex / batchSize);
    return loadedBatches.has(batchIndex);
  }, [loadedBatches, batchSize]);

  useEffect(() => {
    return () => {
      observerRefs.current.forEach(observer => observer.disconnect());
      observerRefs.current.clear();
    };
  }, []);

  return {
    shouldLoadItem,
    getBatchRef,
    loadedBatches: Array.from(loadedBatches)
  };
};

// Hook for progressive image loading
export const useProgressiveImage = (src: string, placeholder?: string) => {
  const [currentSrc, setCurrentSrc] = useState(placeholder || '');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!src) return;

    setIsLoading(true);
    setHasError(false);

    const img = new Image();
    
    img.onload = () => {
      setCurrentSrc(src);
      setIsLoading(false);
    };
    
    img.onerror = () => {
      setHasError(true);
      setIsLoading(false);
    };
    
    img.src = src;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  return {
    src: currentSrc,
    isLoading,
    hasError
  };
};
