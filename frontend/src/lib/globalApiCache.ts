/**
 * Global API Caching System for HomeFlix
 * Provides intelligent caching, request deduplication, and performance optimization
 * across all components and pages
 */

import { apiCache, mediaCache, recommendationCache, assetCache } from './apiCache';
import { getApiUrl } from './api';

// Cache configuration for different API endpoint types - reduced for real-time data
const CACHE_CONFIGS = {
  // Media data - short cache for real-time updates
  media: { ttl: 30 * 1000, maxSize: 200 }, // Reduced to 30 seconds
  
  // Recommendations - short cache for fresh content
  recommendations: { ttl: 60 * 1000, maxSize: 100 }, // Reduced to 1 minute
  
  // Search results - short cache
  search: { ttl: 30 * 1000, maxSize: 150 }, // Reduced to 30 seconds
  
  // Assets (thumbnails, posters, previews) - moderate cache
  assets: { ttl: 5 * 60 * 1000, maxSize: 500 }, // Reduced to 5 minutes
  
  // Genres and static data - moderate cache
  static: { ttl: 10 * 60 * 1000, maxSize: 50 }, // Reduced to 10 minutes
  
  // User-specific data - very short cache for real-time updates
  user: { ttl: 15 * 1000, maxSize: 100 }, // Reduced to 15 seconds
  
  // Admin operations - no cache
  admin: { ttl: 0, maxSize: 0 }
};

// Request deduplication map
const pendingRequests = new Map<string, Promise<any>>();

// Request rate limiting - more aggressive limits
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 15; // Further reduced to 15 requests per minute per endpoint

// Request throttling for rapid successive calls
const throttleMap = new Map<string, { lastCall: number; delay: number }>();
const MIN_REQUEST_INTERVAL = 100; // Minimum 100ms between identical requests
const BURST_THRESHOLD = 5; // Max 5 requests in burst before throttling

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
 * Check rate limit for endpoint
 */
function checkRateLimit(endpoint: string): boolean {
  const now = Date.now();
  const key = endpoint.split('?')[0]; // Remove query params for rate limiting
  
  const limit = rateLimitMap.get(key);
  if (!limit || now > limit.resetTime) {
    // Reset or initialize rate limit
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (limit.count >= RATE_LIMIT_MAX_REQUESTS) {
    console.warn(`⚠️ Rate limit exceeded for: ${key} (${limit.count}/${RATE_LIMIT_MAX_REQUESTS})`);
    return false;
  }
  
  limit.count++;
  return true;
}

/**
 * Check throttling for rapid successive requests
 */
function checkThrottle(cacheKey: string): boolean {
  const now = Date.now();
  const throttle = throttleMap.get(cacheKey);
  
  if (!throttle) {
    throttleMap.set(cacheKey, { lastCall: now, delay: 0 });
    return true;
  }
  
  const timeSinceLastCall = now - throttle.lastCall;
  
  // If too soon since last call, throttle
  if (timeSinceLastCall < MIN_REQUEST_INTERVAL + throttle.delay) {
    console.log(`🚫 Throttling request: ${cacheKey} (${timeSinceLastCall}ms since last call)`);
    return false;
  }
  
  // Increase delay for rapid successive calls
  const newDelay = timeSinceLastCall < 1000 ? Math.min(throttle.delay + 50, 500) : 0;
  throttleMap.set(cacheKey, { lastCall: now, delay: newDelay });
  
  return true;
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
  
  // Check if identical request is already pending
  const pending = pendingRequests.get(cacheKey);
  if (pending) {
    console.log(`🔄 Deduplicating request: ${url}`);
    return pending;
  }

  // Check throttling for rapid requests
  if (!checkThrottle(cacheKey)) {
    // If throttled, return cached data if available
    const cached = cache.get<T>(cacheKey);
    if (cached) {
      console.log(`🚫 Throttled, serving cached data: ${url}`);
      return cached;
    }
    // For throttled requests without cache, wait briefly then retry
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Check rate limit
  if (!checkRateLimit(url)) {
    // If rate limited, try to return cached data even if stale
    const cached = cache.get<T>(cacheKey);
    if (cached) {
      console.log(`⚠️ Rate limited, serving cached data: ${url}`);
      return cached;
    }
    throw new Error(`Rate limit exceeded and no cached data available for: ${url}`);
  }

  // Check cache first (unless bypassing)
  if (!bypassCache) {
    const cached = cache.get<T>(cacheKey);
    if (cached) {
      cacheHits++;
      console.log(`✅ Cache hit for: ${url}`);
      return cached;
    }
    
    // Stale-while-revalidate: return stale data immediately, fetch fresh in background
    const stale = staleWhileRevalidate ? cache.getStale<T>(cacheKey) : null;
    if (stale) {
      cacheHits++;
      console.log(`🔄 Serving stale data for: ${url}`);
      
      // Fetch fresh data in background (with deduplication)
      if (!pendingRequests.has(cacheKey)) {
        const backgroundPromise = makeRequestWithCache<T>(url, options, cache, cacheKey, customTTL || config.ttl)
          .catch(console.error)
          .finally(() => pendingRequests.delete(cacheKey));
        pendingRequests.set(cacheKey, backgroundPromise);
      }
      
      return stale;
    }
  }

  // Make new request
  const requestPromise = makeRequestWithCache<T>(url, options, cache, cacheKey, customTTL || config.ttl);
  pendingRequests.set(cacheKey, requestPromise);
  
  try {
    const result = await requestPromise;
    return result;
  } catch (error) {
    // Return stale data if available and request fails
    const stale = staleWhileRevalidate ? cache.getStale<T>(cacheKey) : null;
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

// DISABLED: Asset API calls - return placeholder to prevent CORS errors
export const fetchThumbnail = (id: string | number) => {
  const placeholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDMwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iNDAwIiBmaWxsPSJncmFkaWVudChsaW5lYXIsIDQ1ZGVnLCAjMTExLCAjMzMzKSIvPgo8dGV4dCB4PSIxNTAiIHk9IjIwMCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjI0IiBmaWxsPSIjZTUwOTE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5Ib21lRmxpeDwvdGV4dD4KPHN2Zz4=';
  return Promise.resolve({ url: placeholder, blob: () => Promise.resolve(new Blob()) });
};

export const fetchPoster = (id: string | number) => {
  const placeholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDMwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iNDAwIiBmaWxsPSJncmFkaWVudChsaW5lYXIsIDQ1ZGVnLCAjMTExLCAjMzMzKSIvPgo8dGV4dCB4PSIxNTAiIHk9IjIwMCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjI0IiBmaWxsPSIjZTUwOTE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5Ib21lRmxpeDwvdGV4dD4KPHN2Zz4=';
  return Promise.resolve({ url: placeholder, blob: () => Promise.resolve(new Blob()) });
};

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
