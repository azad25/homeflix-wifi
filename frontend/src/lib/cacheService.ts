// Advanced caching service for instant loading
class CacheService {
  private cache = new Map<string, any>();
  private timestamps = new Map<string, number>();
  private maxSize = 100; // Maximum number of cached items
  private defaultTTL = 300000; // 5 minutes default TTL

  // Set item in cache with TTL
  set(key: string, value: any, ttl: number = this.defaultTTL): void {
    // Remove oldest items if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = Array.from(this.timestamps.entries())
        .sort(([, a], [, b]) => a - b)[0][0];
      this.delete(oldestKey);
    }

    this.cache.set(key, value);
    this.timestamps.set(key, Date.now() + ttl);
  }

  // Get item from cache
  get<T>(key: string): T | null {
    const timestamp = this.timestamps.get(key);
    
    if (!timestamp || Date.now() > timestamp) {
      this.delete(key);
      return null;
    }

    return this.cache.get(key) || null;
  }

  // Check if item exists and is valid
  has(key: string): boolean {
    const timestamp = this.timestamps.get(key);
    
    if (!timestamp || Date.now() > timestamp) {
      this.delete(key);
      return false;
    }

    return this.cache.has(key);
  }

  // Delete item from cache
  delete(key: string): void {
    this.cache.delete(key);
    this.timestamps.delete(key);
  }

  // Clear all cache
  clear(): void {
    this.cache.clear();
    this.timestamps.clear();
  }

  // Get cache size
  size(): number {
    return this.cache.size;
  }

  // Clean expired items
  cleanup(): void {
    const now = Date.now();
    for (const [key, timestamp] of this.timestamps.entries()) {
      if (now > timestamp) {
        this.delete(key);
      }
    }
  }

  // Get cache statistics
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Create singleton instance
export const cacheService = new CacheService();

// Auto cleanup every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    cacheService.cleanup();
  }, 300000);
}

// Cache keys for different data types
export const CACHE_KEYS = {
  MEDIA_LIST: 'media_list',
  MOVIE_LIST: 'movie_list',
  TV_LIST: 'tv_list',
  SERIES_LIST: 'series_list',
  TRENDING: 'trending',
  POPULAR: 'popular',
  UPCOMING: 'upcoming',
  NOW_PLAYING: 'now_playing',
  WIDGETS: (page: string) => `widgets_${page}`,
  SEARCH: (query: string) => `search_${query}`,
  GENRE: (genre: string) => `genre_${genre}`,
  RECOMMENDATIONS: (type: string) => `recommendations_${type}`,
  USER_DATA: 'user_data',
  RECENTLY_WATCHED: 'recently_watched',
  MY_LIST: 'my_list'
};

// Preload essential data
export const preloadEssentialData = async () => {
  const essentialEndpoints = [
    '/api/media',
    '/api/recommendations/trending?limit=20',
    '/api/recommendations/popular?limit=20',
    '/api/tmdb/movie/popular',
    '/api/tmdb/movie/now-playing'
  ];

  const promises = essentialEndpoints.map(async (endpoint) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8252'}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': '1'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        cacheService.set(endpoint, data, 600000); // Cache for 10 minutes
        return data;
      }
    } catch (error) {
      console.warn(`Failed to preload ${endpoint}:`, error);
    }
    return null;
  });

  await Promise.allSettled(promises);
};

// Image cache for better performance
class ImageCache {
  private cache = new Map<string, HTMLImageElement>();
  private loading = new Set<string>();
  private maxSize = 50;

  async preload(src: string): Promise<HTMLImageElement> {
    if (this.cache.has(src)) {
      return this.cache.get(src)!;
    }

    if (this.loading.has(src)) {
      // Wait for existing load to complete
      return new Promise((resolve) => {
        const checkLoaded = () => {
          if (this.cache.has(src)) {
            resolve(this.cache.get(src)!);
          } else {
            setTimeout(checkLoaded, 50);
          }
        };
        checkLoaded();
      });
    }

    this.loading.add(src);

    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        // Remove oldest if cache is full
        if (this.cache.size >= this.maxSize) {
          const firstKey = this.cache.keys().next().value;
          if (firstKey) {
            this.cache.delete(firstKey);
          }
        }

        this.cache.set(src, img);
        this.loading.delete(src);
        resolve(img);
      };

      img.onerror = () => {
        this.loading.delete(src);
        reject(new Error(`Failed to load image: ${src}`));
      };

      img.src = src;
    });
  }

  has(src: string): boolean {
    return this.cache.has(src);
  }

  get(src: string): HTMLImageElement | null {
    return this.cache.get(src) || null;
  }

  clear(): void {
    this.cache.clear();
    this.loading.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

export const imageCache = new ImageCache();

// Batch image preloader
export const preloadImages = async (urls: string[], batchSize: number = 3) => {
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    await Promise.allSettled(
      batch.map(url => imageCache.preload(url))
    );
    
    // Small delay between batches to prevent blocking
    if (i + batchSize < urls.length) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
};

// Performance monitoring
export const performanceMonitor = {
  startTime: 0,
  
  start(label: string) {
    this.startTime = performance.now();
    console.time(label);
  },
  
  end(label: string) {
    const duration = performance.now() - this.startTime;
    console.timeEnd(label);
    
    if (duration > 100) {
      console.warn(`Slow operation detected: ${label} took ${duration.toFixed(2)}ms`);
    }
    
    return duration;
  },
  
  measure(fn: Function, label: string) {
    this.start(label);
    const result = fn();
    this.end(label);
    return result;
  }
};