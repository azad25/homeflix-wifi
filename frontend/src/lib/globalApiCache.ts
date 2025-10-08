/**
 * Global API Caching System for HomeFlix
 * Provides intelligent caching, request deduplication, and performance optimization
 * across all components and pages
 */

import { apiCache, mediaCache, recommendationCache, assetCache } from './apiCache';
import { getApiUrl } from './api';

// Cache configuration for different API endpoint types
const CACHE_CONFIGS = {
  // Media data - longer cache since it changes infrequently
  media: { ttl: 15 * 60 * 1000, maxSize: 200 }, // 15 minutes
  
  // Recommendations - shorter cache for freshness
  recommendations: { ttl: 5 * 60 * 1000, maxSize: 100 }, // 5 minutes
  
  // Search results - medium cache
  search: { ttl: 10 * 60 * 1000, maxSize: 150 }, // 10 minutes
  
  // Assets (thumbnails, posters, previews) - long cache
  assets: { ttl: 60 * 60 * 1000, maxSize: 500 }, // 1 hour
  
  // Genres and static data - very long cache
  static: { ttl: 2 * 60 * 60 * 1000, maxSize: 50 }, // 2 hours
  
  // User-specific data - short cache
  user: { ttl: 2 * 60 * 1000, maxSize: 100 }, // 2 minutes
  
  // Admin operations - no cache
  admin: { ttl: 0, maxSize: 0 }
};

// Request deduplication map
const pendingRequests = new Map<string, Promise<any>>();

// Hit rate tracking
let totalRequests = 0;
let cacheHits = 0;

/**
 * Determine cache type based on URL pattern
 */
function getCacheType(url: string): keyof typeof CACHE_CONFIGS {
  if (url.includes('/api/media')) return 'media';
  if (url.includes('/api/recommendations')) return 'recommendations';
  if (url.includes('/api/search')) return 'search';
  if (url.includes('/api/thumbnails') || url.includes('/api/posters') || url.includes('/api/preview-clips')) return 'assets';
  if (url.includes('/api/genres')) return 'static';
  if (url.includes('/api/user') || url.includes('/api/mylist') || url.includes('/api/playback')) return 'user';
  if (url.includes('/api/admin')) return 'admin';
  return 'media'; // default
}

/**
 * Get appropriate cache instance based on cache type
 */
function getCacheInstance(cacheType: keyof typeof CACHE_CONFIGS) {
  switch (cacheType) {
    case 'media': return mediaCache;
    case 'recommendations': return recommendationCache;
    case 'assets': return assetCache;
    default: return apiCache;
  }
}

/**
 * Generate cache key from URL and options
 */
function generateCacheKey(url: string, options?: RequestInit): string {
  const method = options?.method || 'GET';
  const body = options?.body ? JSON.stringify(options.body) : '';
  const headers = options?.headers ? JSON.stringify(options.headers) : '';
  return `${method}:${url}:${body}:${headers}`;
}

/**
 * Global cached fetch function that automatically handles all API requests
 */
export async function globalCachedFetch<T = any>(
  url: string, 
  options: RequestInit = {},
  cacheOptions: { 
    bypassCache?: boolean;
    customTTL?: number;
    staleWhileRevalidate?: boolean;
  } = {}
): Promise<T> {
  totalRequests++;
  
  const { bypassCache = false, customTTL, staleWhileRevalidate = true } = cacheOptions;
  const cacheType = getCacheType(url);
  const config = CACHE_CONFIGS[cacheType];
  
  // Skip caching for admin operations or when bypassed
  if (bypassCache || config.ttl === 0) {
    return makeDirectRequest<T>(url, options);
  }
  
  const cacheKey = generateCacheKey(url, options);
  const cache = getCacheInstance(cacheType);
  
  // Check cache first
  const cached = cache.get<T>(cacheKey);
  if (cached) {
    cacheHits++;
    return cached;
  }
  
  // Check for pending request (deduplication)
  const pending = pendingRequests.get(cacheKey);
  if (pending) {
    return pending;
  }
  
  // Get stale data for fallback
  const stale = staleWhileRevalidate ? cache.getStale<T>(cacheKey) : null;
  
  // Make new request
  const requestPromise = makeRequestWithCache<T>(url, options, cache, cacheKey, customTTL || config.ttl);
  pendingRequests.set(cacheKey, requestPromise);
  
  try {
    const result = await requestPromise;
    return result;
  } catch (error) {
    // Return stale data if available and request fails
    if (stale) {
      console.warn(`API request failed, returning stale data for: ${url}`, error);
      return stale;
    }
    throw error;
  } finally {
    pendingRequests.delete(cacheKey);
  }
}

/**
 * Make request with caching
 */
async function makeRequestWithCache<T>(
  url: string, 
  options: RequestInit, 
  cache: any, 
  cacheKey: string, 
  ttl: number
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const data = await response.json();
  
  // Cache the result
  if (ttl > 0) {
    cache.set(cacheKey, data, ttl);
  }
  
  return data;
}

/**
 * Make direct request without caching
 */
async function makeDirectRequest<T>(url: string, options: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Convenience functions for common API patterns
 */

// Media API calls
export const fetchMedia = (endpoint: string = '', options?: RequestInit) => 
  globalCachedFetch(`${getApiUrl()}/api/media${endpoint}`, options);

export const fetchMediaById = (id: string | number) => 
  globalCachedFetch(`${getApiUrl()}/api/media/${id}`);

export const fetchMovies = (limit?: number) => 
  globalCachedFetch(`${getApiUrl()}/api/media${limit ? `?limit=${limit}` : ''}`)
    .then((data: any[]) => data.filter(item => item.type === 'movie'));

export const fetchTVShows = (limit?: number) => 
  globalCachedFetch(`${getApiUrl()}/api/media/tv-shows${limit ? `?limit=${limit}` : ''}`);

// Recommendation API calls
export const fetchRecommendations = (category: string = 'mixed', limit: number = 25) => 
  globalCachedFetch(`${getApiUrl()}/api/recommendations/${category}?limit=${limit}`);

export const fetchSimilarMedia = (id: string | number) => 
  globalCachedFetch(`${getApiUrl()}/api/recommendations/similar/${id}`);

export const fetchContinueWatching = () => 
  globalCachedFetch(`${getApiUrl()}/api/recommendations/continue-watching`);

// Search API calls
export const searchMedia = (query: string) => 
  globalCachedFetch(`${getApiUrl()}/api/search?q=${encodeURIComponent(query)}`);

// Asset API calls
export const fetchThumbnail = (id: string | number) => 
  globalCachedFetch(`${getApiUrl()}/api/thumbnails/${id}`);

export const fetchPoster = (id: string | number) => 
  globalCachedFetch(`${getApiUrl()}/api/posters/${id}`);

export const fetchPreviewClip = (id: string | number) => 
  globalCachedFetch(`${getApiUrl()}/api/preview-clips/${id}`);

// Genre API calls
export const fetchGenres = () => 
  globalCachedFetch(`${getApiUrl()}/api/genres`);

// User data API calls
export const fetchMyList = () => 
  globalCachedFetch(`${getApiUrl()}/api/mylist`);

export const fetchPlaybackProgress = (id: string | number) => 
  globalCachedFetch(`${getApiUrl()}/api/playback/progress/${id}`);

/**
 * Batch fetch with intelligent concurrency control
 */
export async function batchFetch<T>(
  requests: Array<{ url: string; options?: RequestInit; cacheOptions?: any }>,
  maxConcurrent: number = 6
): Promise<(T | null)[]> {
  const results: (T | null)[] = [];
  
  for (let i = 0; i < requests.length; i += maxConcurrent) {
    const chunk = requests.slice(i, i + maxConcurrent);
    
    const chunkResults = await Promise.allSettled(
      chunk.map(({ url, options, cacheOptions }) => 
        globalCachedFetch<T>(url, options, cacheOptions)
      )
    );
    
    chunkResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results[i + index] = result.value;
      } else {
        console.warn(`Batch request failed for: ${chunk[index].url}`, result.reason);
        results[i + index] = null;
      }
    });
  }
  
  return results;
}

/**
 * Cache invalidation functions
 */
export const invalidateCache = {
  media: () => {
    mediaCache.invalidate('/api/media');
    apiCache.invalidate('/api/media');
  },
  recommendations: () => {
    recommendationCache.invalidate('/api/recommendations');
    apiCache.invalidate('/api/recommendations');
  },
  search: () => {
    apiCache.invalidate('/api/search');
  },
  assets: (id?: string | number) => {
    if (id) {
      assetCache.invalidate(`/${id}`);
    } else {
      assetCache.clear();
    }
  },
  user: () => {
    apiCache.invalidate('/api/user');
    apiCache.invalidate('/api/mylist');
    apiCache.invalidate('/api/playback');
  },
  all: () => {
    mediaCache.clear();
    recommendationCache.clear();
    assetCache.clear();
    apiCache.clear();
    pendingRequests.clear();
  }
};

/**
 * Cache statistics and monitoring
 */
export const getCacheStats = () => {
  const hitRate = totalRequests > 0 ? (cacheHits / totalRequests) * 100 : 0;
  
  return {
    hitRate: Math.round(hitRate * 100) / 100,
    totalRequests,
    cacheHits,
    cacheMisses: totalRequests - cacheHits,
    caches: {
      media: mediaCache.getStats(),
      recommendations: recommendationCache.getStats(),
      assets: assetCache.getStats(),
      general: apiCache.getStats()
    },
    pendingRequests: pendingRequests.size
  };
};

/**
 * Preload critical data for better performance
 */
export const preloadCriticalData = async () => {
  try {
    // Preload essential data that's likely to be needed
    const preloadPromises = [
      fetchMedia('?limit=50'), // First 50 media items
      fetchGenres(), // All genres
      fetchRecommendations('mixed', 20), // Mixed recommendations
      fetchRecommendations('trending', 15), // Trending content
    ];
    
    await Promise.allSettled(preloadPromises);
    console.log('Critical data preloaded successfully');
  } catch (error) {
    console.warn('Failed to preload critical data:', error);
  }
};

/**
 * Smart cache warming based on user behavior
 */
export const warmCache = async (mediaIds: (string | number)[]) => {
  try {
    const warmupPromises = mediaIds.slice(0, 10).map(id => [
      fetchMediaById(id),
      fetchThumbnail(id),
      fetchPoster(id),
      fetchSimilarMedia(id)
    ]).flat();
    
    await Promise.allSettled(warmupPromises);
    console.log(`Cache warmed for ${mediaIds.length} media items`);
  } catch (error) {
    console.warn('Cache warming failed:', error);
  }
};

// Export the main function as default
export default globalCachedFetch;
