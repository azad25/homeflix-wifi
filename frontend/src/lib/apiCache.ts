/**
 * Advanced API Caching System for HomeFlix
 * Reduces redundant API calls and improves performance
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiry: number;
  key: string;
}

interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  maxSize?: number; // Maximum cache size
  staleWhileRevalidate?: boolean; // Return stale data while fetching fresh
}

class APICache {
  private cache = new Map<string, CacheEntry<any>>();
  private pendingRequests = new Map<string, Promise<any>>();
  private maxSize: number;
  private defaultTTL: number;

  constructor(options: CacheOptions = {}) {
    this.maxSize = options.maxSize || 100;
    this.defaultTTL = options.ttl || 5 * 60 * 1000; // 5 minutes default
  }

  /**
   * Generate cache key from URL and params
   */
  private generateKey(url: string, params?: Record<string, any>): string {
    const paramString = params ? JSON.stringify(params) : '';
    return `${url}${paramString}`;
  }

  /**
   * Check if cache entry is valid
   */
  private isValid(entry: CacheEntry<any>): boolean {
    return Date.now() < entry.expiry;
  }

  /**
   * Check if cache entry is stale but usable
   */
  private isStale(entry: CacheEntry<any>): boolean {
    return Date.now() > entry.expiry;
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    this.cache.forEach((entry, key) => {
      if (now > entry.expiry + (this.defaultTTL * 2)) { // Delete after 2x TTL
        toDelete.push(key);
      }
    });

    toDelete.forEach(key => this.cache.delete(key));

    // If still over max size, remove oldest entries
    if (this.cache.size > this.maxSize) {
      const entries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = entries.slice(0, entries.length - this.maxSize);
      toRemove.forEach(([key]) => this.cache.delete(key));
    }
  }

  /**
   * Get cached data
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (this.isValid(entry)) {
      return entry.data;
    }

    return null;
  }

  /**
   * Get stale data (for stale-while-revalidate)
   */
  getStale<T>(key: string): T | null {
    const entry = this.cache.get(key);
    return entry ? entry.data : null;
  }

  /**
   * Set cache data
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const expiry = Date.now() + (ttl || this.defaultTTL);
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiry,
      key
    });

    // Cleanup periodically
    if (this.cache.size > this.maxSize * 1.2) {
      this.cleanup();
    }
  }

  /**
   * Cached fetch with deduplication
   */
  async fetch<T>(
    url: string, 
    options: RequestInit = {}, 
    cacheOptions: CacheOptions & { params?: Record<string, any> } = {}
  ): Promise<T> {
    const { ttl, staleWhileRevalidate = true, params } = cacheOptions;
    const cacheKey = this.generateKey(url, params);

    // Check cache first
    const cached = this.get<T>(cacheKey);
    if (cached) {
      return cached;
    }

    // Check for stale data
    const stale = staleWhileRevalidate ? this.getStale<T>(cacheKey) : null;

    // Check if request is already pending (deduplication)
    const pending = this.pendingRequests.get(cacheKey);
    if (pending) {
      return pending;
    }

    // Make the request
    const requestPromise = this.makeRequest<T>(url, options, cacheKey, ttl);
    this.pendingRequests.set(cacheKey, requestPromise);

    try {
      const result = await requestPromise;
      return result;
    } catch (error) {
      // If we have stale data and request fails, return stale
      if (stale) {
        console.warn(`API request failed, returning stale data for: ${url}`, error);
        return stale;
      }
      throw error;
    } finally {
      this.pendingRequests.delete(cacheKey);
    }
  }

  /**
   * Make the actual HTTP request
   */
  private async makeRequest<T>(url: string, options: RequestInit, cacheKey: string, ttl?: number): Promise<T> {
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
    this.set(cacheKey, data, ttl);
    return data;
  }

  /**
   * Invalidate cache entries by pattern
   */
  invalidate(pattern: string | RegExp): void {
    const toDelete: string[] = [];

    this.cache.forEach((entry, key) => {
      if (typeof pattern === 'string') {
        if (key.includes(pattern)) {
          toDelete.push(key);
        }
      } else {
        if (pattern.test(key)) {
          toDelete.push(key);
        }
      }
    });

    toDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.pendingRequests.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; pending: number; hitRate: number } {
    return {
      size: this.cache.size,
      pending: this.pendingRequests.size,
      hitRate: 0 // TODO: Implement hit rate tracking
    };
  }
}

// Create singleton instance
export const apiCache = new APICache({
  ttl: 5 * 60 * 1000, // 5 minutes
  maxSize: 200,
});

// Specialized caches for different data types
export const mediaCache = new APICache({
  ttl: 10 * 60 * 1000, // 10 minutes for media data
  maxSize: 100,
});

export const recommendationCache = new APICache({
  ttl: 3 * 60 * 1000, // 3 minutes for recommendations
  maxSize: 50,
});

export const assetCache = new APICache({
  ttl: 30 * 60 * 1000, // 30 minutes for asset URLs
  maxSize: 300,
});

// Helper functions for common API patterns
export const cachedFetch = <T>(url: string, options?: RequestInit, cacheOptions?: CacheOptions) => 
  apiCache.fetch<T>(url, options, cacheOptions);

export const cachedMediaFetch = <T>(url: string, options?: RequestInit) => 
  mediaCache.fetch<T>(url, options, { staleWhileRevalidate: true });

export const cachedRecommendationFetch = <T>(url: string, options?: RequestInit) => 
  recommendationCache.fetch<T>(url, options, { staleWhileRevalidate: true });

// Cache invalidation helpers
export const invalidateMediaCache = () => mediaCache.invalidate('/api/media');
export const invalidateRecommendationCache = () => recommendationCache.invalidate('/api/recommendations');

// Batch request helper with intelligent caching
export const batchFetch = async <T>(
  requests: Array<{ url: string; options?: RequestInit; cacheOptions?: CacheOptions }>,
  maxConcurrent = 6
): Promise<T[]> => {
  const results: T[] = [];
  
  // Process in chunks to avoid overwhelming the server
  for (let i = 0; i < requests.length; i += maxConcurrent) {
    const chunk = requests.slice(i, i + maxConcurrent);
    
    const chunkResults = await Promise.allSettled(
      chunk.map(({ url, options, cacheOptions }) => 
        apiCache.fetch<T>(url, options, cacheOptions)
      )
    );

    chunkResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results[i + index] = result.value;
      } else {
        console.warn(`Batch request failed for: ${chunk[index].url}`, result.reason);
        results[i + index] = null as any; // or provide fallback
      }
    });
  }

  return results;
};
