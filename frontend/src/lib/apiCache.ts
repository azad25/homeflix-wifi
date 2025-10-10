// Enhanced API caching system with intelligent cache management
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  key: string;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

class APICache {
  private cache = new Map<string, CacheEntry<any>>();
  private pendingRequests = new Map<string, Promise<any>>();
  private stats = { hits: 0, misses: 0 };
  private maxSize = 500; // Maximum cache entries
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Clean up expired entries every 2 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 2 * 60 * 1000);
  }

  private generateKey(url: string, options?: RequestInit): string {
    const method = options?.method || 'GET';
    const body = options?.body ? JSON.stringify(options.body) : '';
    return `${method}:${url}:${body}`;
  }

  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    // If cache is still too large, remove oldest entries
    if (this.cache.size > this.maxSize) {
      const entries = Array.from(this.cache.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp);
      
      const toRemove = entries.slice(0, this.cache.size - this.maxSize);
      toRemove.forEach(([key]) => this.cache.delete(key));
      cleaned += toRemove.length;
    }

    if (cleaned > 0) {
      console.log(`🧹 Cache cleanup: removed ${cleaned} expired/old entries`);
    }
  }

  async get<T>(
    url: string, 
    options?: RequestInit, 
    ttl: number = 5 * 60 * 1000 // 5 minutes default
  ): Promise<T> {
    const key = this.generateKey(url, options);
    
    // Check cache first
    const cached = this.cache.get(key);
    if (cached && !this.isExpired(cached)) {
      this.stats.hits++;
      console.log(`📦 Cache HIT: ${key.substring(0, 100)}...`);
      return cached.data;
    }

    // Check if request is already pending
    if (this.pendingRequests.has(key)) {
      console.log(`⏳ Request pending: ${key.substring(0, 100)}...`);
      return this.pendingRequests.get(key)!;
    }

    // Make new request
    this.stats.misses++;
    console.log(`🌐 Cache MISS: ${key.substring(0, 100)}...`);
    
    const requestPromise = this.fetchData<T>(url, options, ttl, key);
    this.pendingRequests.set(key, requestPromise);

    try {
      const result = await requestPromise;
      return result;
    } finally {
      this.pendingRequests.delete(key);
    }
  }

  private async fetchData<T>(url: string, options: RequestInit | undefined, ttl: number, key: string): Promise<T> {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Store in cache
      this.cache.set(key, {
        data,
        timestamp: Date.now(),
        ttl,
        key
      });

      return data;
    } catch (error) {
      console.error(`❌ API request failed: ${url}`, error);
      throw error;
    }
  }

  // Invalidate specific cache entries
  invalidate(pattern: string): void {
    let removed = 0;
    for (const [key] of this.cache.entries()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        removed++;
      }
    }
    console.log(`🗑️ Invalidated ${removed} cache entries matching: ${pattern}`);
  }

  // Clear all cache
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.pendingRequests.clear();
    console.log(`🗑️ Cleared entire cache (${size} entries)`);
  }

  // Get cache statistics
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.cache.size,
      hitRate: total > 0 ? (this.stats.hits / total) * 100 : 0
    };
  }

  // Preload data into cache
  async preload(url: string, options?: RequestInit, ttl?: number): Promise<void> {
    try {
      await this.get(url, options, ttl);
    } catch (error) {
      console.warn(`⚠️ Preload failed for ${url}:`, error);
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }
}

// Global cache instance
export const apiCache = new APICache();

// Enhanced fetch wrapper with caching
export async function cachedFetch<T>(
  url: string, 
  options?: RequestInit & { 
    ttl?: number; 
    skipCache?: boolean;
    retries?: number;
  }
): Promise<T> {
  const { ttl = 5 * 60 * 1000, skipCache = false, retries = 2, ...fetchOptions } = options || {};
  
  if (skipCache) {
    const response = await fetch(url, fetchOptions);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }

  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await apiCache.get<T>(url, fetchOptions, ttl);
    } catch (error) {
      lastError = error as Error;
      if (attempt < retries) {
        console.warn(`🔄 Retry ${attempt + 1}/${retries} for ${url}`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }
  
  throw lastError;
}

// Specialized cache functions for different data types
export const cacheConfig = {
  media: { ttl: 10 * 60 * 1000 }, // 10 minutes
  recommendations: { ttl: 5 * 60 * 1000 }, // 5 minutes
  assets: { ttl: 30 * 60 * 1000 }, // 30 minutes
  search: { ttl: 2 * 60 * 1000 }, // 2 minutes
  metadata: { ttl: 15 * 60 * 1000 }, // 15 minutes
};

export async function fetchMedia<T>(url: string, options?: RequestInit): Promise<T> {
  return cachedFetch<T>(url, { ...options, ...cacheConfig.media });
}

export async function fetchRecommendations<T>(url: string, options?: RequestInit): Promise<T> {
  return cachedFetch<T>(url, { ...options, ...cacheConfig.recommendations });
}

export async function fetchAssets<T>(url: string, options?: RequestInit): Promise<T> {
  return cachedFetch<T>(url, { ...options, ...cacheConfig.assets });
}

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    apiCache.destroy();
  });
}
