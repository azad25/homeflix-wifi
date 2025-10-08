"use client";

import { useQuery, useInfiniteQuery, UseQueryOptions, UseInfiniteQueryOptions } from '@tanstack/react-query';
import { Media } from '@/types/media';

// Query keys for consistent caching
export const queryKeys = {
  media: {
    all: ['media'] as const,
    lists: () => [...queryKeys.media.all, 'list'] as const,
    list: (filters: Record<string, any>) => [...queryKeys.media.lists(), { filters }] as const,
    details: () => [...queryKeys.media.all, 'detail'] as const,
    detail: (id: string | number) => [...queryKeys.media.details(), id] as const,
  },
  recommendations: {
    all: ['recommendations'] as const,
    lists: () => [...queryKeys.recommendations.all, 'list'] as const,
    list: (type: string, params?: Record<string, any>) => [...queryKeys.recommendations.lists(), type, params] as const,
  },
  assets: {
    all: ['assets'] as const,
    thumbnails: () => [...queryKeys.assets.all, 'thumbnails'] as const,
    thumbnail: (id: string | number) => [...queryKeys.assets.thumbnails(), id] as const,
    posters: () => [...queryKeys.assets.all, 'posters'] as const,
    poster: (id: string | number) => [...queryKeys.assets.posters(), id] as const,
    previews: () => [...queryKeys.assets.all, 'previews'] as const,
    preview: (id: string | number) => [...queryKeys.assets.previews(), id] as const,
  },
};

// Debounced fetch function to prevent duplicate requests
const debouncedFetches = new Map<string, Promise<any>>();

export function useDebouncedFetch<T>(
  key: string,
  fetchFn: () => Promise<T>,
  delay: number = 300
): Promise<T> {
  const existing = debouncedFetches.get(key);
  if (existing) {
    return existing;
  }

  const promise = new Promise<T>((resolve, reject) => {
    setTimeout(async () => {
      try {
        const result = await fetchFn();
        debouncedFetches.delete(key);
        resolve(result);
      } catch (error) {
        debouncedFetches.delete(key);
        reject(error);
      }
    }, delay);
  });

  debouncedFetches.set(key, promise);
  return promise;
}

// Optimized query hook
export function useOptimizedQuery<T>(
  queryKey: readonly unknown[],
  fetchFn: () => Promise<T>,
  options?: Omit<UseQueryOptions<T>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey,
    queryFn: fetchFn,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 20 * 60 * 1000, // 20 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...options,
  });
}

// Optimized recommendations query hook
export function useOptimizedRecommendationsQuery<T = Media[]>(
  type: string,
  fetchFn: () => Promise<T>,
  params?: Record<string, any>,
  options?: Omit<UseQueryOptions<T>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.recommendations.list(type, params),
    queryFn: fetchFn,
    staleTime: 15 * 60 * 1000, // 15 minutes for recommendations
    gcTime: 30 * 60 * 1000, // 30 minutes in cache
    refetchInterval: 15 * 60 * 1000, // Auto-refresh every 15 minutes
    ...options,
  });
}

// Asset URL caching hook
export function useAssetUrl(
  type: 'thumbnail' | 'poster' | 'preview',
  mediaId: string | number,
  baseUrl: string
) {
  const cacheKey = `asset-${type}-${mediaId}`;
  
  return useQuery({
    queryKey: queryKeys.assets[type](mediaId),
    queryFn: async () => {
      // Check localStorage cache first
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { url, timestamp } = JSON.parse(cached);
        // Cache for 1 hour
        if (Date.now() - timestamp < 60 * 60 * 1000) {
          return url;
        }
      }

      // Generate new URL and cache it
      const url = `${baseUrl}/api/${type}s/${mediaId}`;
      localStorage.setItem(cacheKey, JSON.stringify({
        url,
        timestamp: Date.now()
      }));
      
      return url;
    },
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 2 * 60 * 60 * 1000, // 2 hours
  });
}

// Infinite scroll query for large lists
export function useOptimizedInfiniteQuery<T>(
  queryKey: readonly unknown[],
  fetchFn: ({ pageParam }: { pageParam: number }) => Promise<{ data: T[]; nextPage?: number }>,
  options?: Omit<UseInfiniteQueryOptions<{ data: T[]; nextPage?: number }>, 'queryKey' | 'queryFn'>
) {
  return useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => fetchFn({ pageParam: pageParam as number }),
    initialPageParam: 1,
    getNextPageParam: (lastPage: { data: T[]; nextPage?: number }) => lastPage.nextPage,
    staleTime: 10 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    ...options,
  });
}
