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
  refetchOnMount?: boolean;
  refetchInterval?: number;
  staleTime?: number;
  cacheTime?: number;
  customTTL?: number;
  retry?: number;
  retryDelay?: number;
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
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
    refetchInterval = 0, // Disabled by default to prevent polling
    refetchOnWindowFocus = false, // Disabled to prevent excessive requests
    refetchOnMount = true,
    staleTime = 5 * 60 * 1000, // 5 minutes stale time to reduce requests
    cacheTime = 30 * 60 * 1000, // Increased to 30 minutes
    retry = 2, // Reduced retries to prevent request flooding
    retryDelay = 2000, // Increased delay between retries
    onSuccess,
    onError
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
        customTTL: cacheTime,
        staleWhileRevalidate: true
      });

      setData(result);
      if (onSuccess) onSuccess(result);
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err);
        console.warn(`API request failed for ${url}:`, err.message);
        if (onError) onError(err);
      }
    } finally {
      setLoading(false);
    }
  }, [url, enabled, staleTime, cacheTime, retry, retryDelay, options, onSuccess, onError]);

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

  // Initial fetch with debouncing
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      fetchData();
    }, 50); // 50ms debounce for initial fetch
    
    return () => {
      clearTimeout(debounceTimer);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchData]);

  // Refetch interval (only if explicitly set)
  useEffect(() => {
    if (!refetchInterval || refetchInterval <= 0 || !enabled) return;

    // Minimum interval of 30 seconds to prevent excessive polling
    const safeInterval = Math.max(refetchInterval, 30000);
    
    const interval = setInterval(() => {
      if (!document.hidden && !loading) { // Only refetch when tab is visible and not already loading
        refetch();
      }
    }, safeInterval);

    return () => clearInterval(interval);
  }, [refetchInterval, enabled, refetch, loading]);

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
 * Hook for continue watching with optimized caching
 */
export function useContinueWatching(userId?: string) {
  return useGlobalCache('/api/recommendations/continue-watching', {}, {
    staleTime: 5 * 60 * 1000, // Increased to 5 minutes to reduce polling
    cacheTime: 15 * 60 * 1000, // Increased to 15 minutes
    refetchInterval: 0, // Disabled automatic polling - major cause of API flooding
    refetchOnWindowFocus: false // Disabled to prevent excessive requests
  });
}

/**
 * Specialized hook for recommendations with appropriate caching
 */
export function useRecommendations(category?: string, limit?: number, userId?: string) {
  const url = `/api/recommendations${
    category || limit || userId 
      ? `?${new URLSearchParams({
          ...(category && { category }),
          ...(limit && { limit: limit.toString() }),
          ...(userId && { user_id: userId })
        }).toString()}`
      : ''
  }`;

  return useGlobalCache(url, {}, {
    staleTime: 15 * 60 * 1000, // Increased to 15 minutes
    cacheTime: 30 * 60 * 1000, // Increased to 30 minutes
    refetchInterval: 0, // Disabled automatic refetching to prevent polling
    refetchOnWindowFocus: false // Disabled to prevent excessive requests
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
      staleTime: 10 * 60 * 1000, // Increased to 10 minutes
      cacheTime: 30 * 60 * 1000, // Increased to 30 minutes
      refetchInterval: 0, // Disabled automatic polling
      refetchOnWindowFocus: false // Disabled to prevent excessive requests
    }
  );
}

/**
 * Hook for asset URLs (thumbnails, posters, previews) with very long caching
 */
export function useAssetUrl(type: 'thumbnails' | 'posters' | 'previews', id: string) {
  const url = `/api/${type}/${id}`;
  
  return useGlobalCache(url, {}, {
    staleTime: 2 * 60 * 60 * 1000, // Increased to 2 hours
    cacheTime: 7 * 24 * 60 * 60 * 1000, // Increased to 7 days for assets
    refetchOnWindowFocus: false,
    refetchInterval: 0,
    retry: 1, // Reduced retries for assets to prevent 404 flooding
    retryDelay: 5000 // Longer delay for asset retries
  });
}
