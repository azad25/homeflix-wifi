/**
 * React Hook for Global API Caching
 * Provides seamless integration of global caching system with React components
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { globalCachedFetch, getCacheStats, invalidateCache } from '../lib/globalApiCache';

interface UseGlobalCacheOptions {
  enabled?: boolean;
  staleWhileRevalidate?: boolean;
  refetchOnWindowFocus?: boolean;
  refetchInterval?: number;
  customTTL?: number;
}

interface UseGlobalCacheResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  invalidate: () => void;
}

/**
 * Hook for making cached API requests with React state management
 */
export function useGlobalCache<T = any>(
  url: string | null,
  options: RequestInit = {},
  hookOptions: UseGlobalCacheOptions = {}
): UseGlobalCacheResult<T> {
  const {
    enabled = true,
    staleWhileRevalidate = true,
    refetchOnWindowFocus = false,
    refetchInterval,
    customTTL
  } = hookOptions;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(!!url && enabled);
  const [error, setError] = useState<Error | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async (showLoading = true) => {
    if (!url || !enabled) return;

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    
    if (showLoading) {
      setLoading(true);
    }
    setError(null);

    try {
      const result = await globalCachedFetch<T>(url, {
        ...options,
        signal: abortControllerRef.current.signal
      }, {
        staleWhileRevalidate,
        customTTL
      });

      setData(result);
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err);
      }
    } finally {
      setLoading(false);
    }
  }, [url, enabled, staleWhileRevalidate, customTTL, options]);

  const refetch = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  const invalidate = useCallback(() => {
    if (url) {
      // Determine cache type and invalidate appropriately
      if (url.includes('/api/media')) invalidateCache.media();
      else if (url.includes('/api/recommendations')) invalidateCache.recommendations();
      else if (url.includes('/api/search')) invalidateCache.search();
      else if (url.includes('/api/user') || url.includes('/api/mylist')) invalidateCache.user();
    }
  }, [url]);

  // Initial fetch
  useEffect(() => {
    fetchData();
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchData]);

  // Refetch interval
  useEffect(() => {
    if (refetchInterval && enabled) {
      intervalRef.current = setInterval(() => {
        fetchData(false); // Don't show loading for interval refetches
      }, refetchInterval);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [refetchInterval, enabled, fetchData]);

  // Refetch on window focus
  useEffect(() => {
    if (refetchOnWindowFocus && enabled) {
      const handleFocus = () => fetchData(false);
      window.addEventListener('focus', handleFocus);
      return () => window.removeEventListener('focus', handleFocus);
    }
  }, [refetchOnWindowFocus, enabled, fetchData]);

  return {
    data,
    loading,
    error,
    refetch,
    invalidate
  };
}

/**
 * Hook for batch fetching multiple endpoints
 */
export function useBatchCache<T = any>(
  requests: Array<{ url: string; options?: RequestInit }>,
  hookOptions: UseGlobalCacheOptions = {}
): {
  data: (T | null)[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
} {
  const { enabled = true } = hookOptions;
  
  const [data, setData] = useState<(T | null)[]>([]);
  const [loading, setLoading] = useState<boolean>(enabled && requests.length > 0);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!enabled || requests.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const results = await Promise.allSettled(
        requests.map(({ url, options }) => 
          globalCachedFetch<T>(url, options, hookOptions)
        )
      );

      const processedResults = results.map(result => 
        result.status === 'fulfilled' ? result.value : null
      );

      setData(processedResults);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Batch fetch failed'));
    } finally {
      setLoading(false);
    }
  }, [requests, enabled, hookOptions]);

  const refetch = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch
  };
}

/**
 * Hook for cache statistics monitoring
 */
export function useCacheStats() {
  const [stats, setStats] = useState(getCacheStats());

  const updateStats = useCallback(() => {
    setStats(getCacheStats());
  }, []);

  useEffect(() => {
    const interval = setInterval(updateStats, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, [updateStats]);

  return { stats, updateStats };
}

/**
 * Hook for media-specific caching patterns
 */
export function useMediaCache(endpoint: string = '', options?: RequestInit) {
  return useGlobalCache(`/api/media${endpoint}`, options, {
    customTTL: 15 * 60 * 1000, // 15 minutes for media data
    staleWhileRevalidate: true
  });
}

/**
 * Hook for recommendation-specific caching patterns
 */
export function useRecommendationCache(category: string = 'mixed', limit: number = 25) {
  return useGlobalCache(`/api/recommendations/${category}?limit=${limit}`, {}, {
    customTTL: 5 * 60 * 1000, // 5 minutes for recommendations
    staleWhileRevalidate: true,
    refetchInterval: 5 * 60 * 1000 // Auto-refresh every 5 minutes
  });
}

/**
 * Hook for search with caching and debouncing
 */
export function useSearchCache(query: string, debounceMs: number = 300) {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, debounceMs]);

  return useGlobalCache(
    debouncedQuery.trim() ? `/api/search?q=${encodeURIComponent(debouncedQuery)}` : null,
    {},
    {
      customTTL: 10 * 60 * 1000, // 10 minutes for search results
      staleWhileRevalidate: true
    }
  );
}

/**
 * Hook for asset URLs with caching
 */
export function useAssetCache(type: 'thumbnail' | 'poster' | 'preview-clips', id: string | number) {
  return useGlobalCache(`/api/${type}/${id}`, {}, {
    customTTL: 60 * 60 * 1000, // 1 hour for assets
    staleWhileRevalidate: true
  });
}
