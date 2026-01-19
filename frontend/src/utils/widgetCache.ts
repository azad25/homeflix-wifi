/**
 * Smart Widget Cache - Ultra-fast caching for instant widget loading
 * Provides multi-layer caching with selective invalidation
 */

interface CacheEntry {
  data: any;
  timestamp: number;
  version: number;
}

interface CacheConfig {
  ttl: number; // Time to live in milliseconds
  maxSize: number; // Maximum number of entries
}

class SmartWidgetCache {
  private cache = new Map<string, CacheEntry>();
  private versions = new Map<string, number>();
  private config: CacheConfig = {
    ttl: 2 * 60 * 1000, // 2 minutes
    maxSize: 50, // Max 50 cached pages
  };

  constructor(config?: Partial<CacheConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Get cached data for a page
   */
  get(page: string): any | null {
    const entry = this.cache.get(page);
    
    if (!entry) {
      return null;
    }

    // Check if entry is expired
    if (Date.now() - entry.timestamp > this.config.ttl) {
      this.cache.delete(page);
      return null;
    }

    // Check if version is still valid
    const currentVersion = this.versions.get(page) || 1;
    if (entry.version < currentVersion) {
      this.cache.delete(page);
      return null;
    }

    console.log(`📦 Widget cache hit for page: ${page}`);
    return entry.data;
  }

  /**
   * Set cached data for a page
   */
  set(page: string, data: any): void {
    // Cleanup old entries if cache is full
    if (this.cache.size >= this.config.maxSize) {
      this.cleanup();
    }

    const currentVersion = this.versions.get(page) || 1;
    
    this.cache.set(page, {
      data,
      timestamp: Date.now(),
      version: currentVersion,
    });

    console.log(`💾 Widget cache set for page: ${page}`);
  }

  /**
   * Invalidate cache for a specific page (when widgets change)
   */
  invalidate(page: string): void {
    // Increment version to invalidate existing cache entries
    const currentVersion = this.versions.get(page) || 1;
    this.versions.set(page, currentVersion + 1);
    
    // Remove from cache
    this.cache.delete(page);
    
    console.log(`🗑️ Widget cache invalidated for page: ${page} (version: ${currentVersion + 1})`);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.versions.clear();
    console.log('🗑️ Widget cache cleared completely');
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.config.ttl) {
        expiredKeys.push(key);
      }
    }

    // Remove expired entries
    expiredKeys.forEach(key => this.cache.delete(key));

    // If still too many entries, remove oldest ones
    if (this.cache.size >= this.config.maxSize) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = entries.slice(0, Math.floor(this.config.maxSize * 0.3)); // Remove 30%
      toRemove.forEach(([key]) => this.cache.delete(key));
    }

    console.log(`🧹 Widget cache cleanup: removed ${expiredKeys.length} expired entries`);
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      ttl: this.config.ttl,
      versions: this.versions.size,
    };
  }

  /**
   * Preload widget data for a page
   */
  async preload(page: string): Promise<void> {
    if (this.get(page)) {
      return; // Already cached
    }

    try {
      const response = await fetch(`/api/widgets/page/${page}/with-data`, {
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': '1',
        },
      });

      if (response.ok) {
        const data = await response.json();
        this.set(page, data);
        console.log(`🚀 Preloaded widgets for page: ${page}`);
      }
    } catch (error) {
      console.warn(`Failed to preload widgets for page: ${page}`, error);
    }
  }
}

// Create singleton instance
export const widgetCache = new SmartWidgetCache({
  ttl: 2 * 60 * 1000, // 2 minutes for fast updates
  maxSize: 20, // Cache up to 20 pages
});

// Preload essential pages on app start
export const preloadEssentialWidgets = () => {
  const essentialPages = ['home', 'movies', 'tv-shows'];
  
  // Use requestIdleCallback for non-blocking preload
  if (typeof window !== 'undefined') {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => {
        essentialPages.forEach(page => {
          widgetCache.preload(page);
        });
      });
    } else {
      setTimeout(() => {
        essentialPages.forEach(page => {
          widgetCache.preload(page);
        });
      }, 1000);
    }
  }
};

// Export cache management functions
export const cacheManager = {
  invalidatePage: (page: string) => widgetCache.invalidate(page),
  clearAll: () => widgetCache.clear(),
  getStats: () => widgetCache.getStats(),
  preloadPage: (page: string) => widgetCache.preload(page),
};