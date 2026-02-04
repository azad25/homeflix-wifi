/**
 * Smart Widget Cache - Ultra-fast multi-layer caching for instant widget loading
 * Provides in-memory cache, localStorage persistence, and selective invalidation
 */

interface CacheEntry {
  data: any;
  timestamp: number;
  version: number;
}

interface CacheConfig {
  ttl: number; // Time to live in milliseconds
  maxSize: number; // Maximum number of entries
  persistTTL: number; // How long to keep data in localStorage (1 day)
}

class SmartWidgetCache {
  private cache = new Map<string, CacheEntry>();
  private versions = new Map<string, number>();
  private config: CacheConfig = {
    ttl: 10 * 60 * 1000, // 10 minutes in-memory cache
    maxSize: 50, // Max 50 cached pages
    persistTTL: 24 * 60 * 60 * 1000, // 24 hours in localStorage
  };
  private localStoragePrefix = 'WIDGET_CACHE_';
  private isInitialized = false;

  constructor(config?: Partial<CacheConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    this.loadFromStorage();
  }

  /**
   * Load cache from localStorage on initialization
   */
  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const keys = Object.keys(localStorage);
      let loadedCount = 0;

      for (const key of keys) {
        if (key.startsWith(this.localStoragePrefix)) {
          try {
            const stored = localStorage.getItem(key);
            if (stored) {
              const parsed = JSON.parse(stored);
              const page = key.replace(this.localStoragePrefix, '');
              
              // Check if stored data is still valid
              if (Date.now() - parsed.timestamp <= this.config.persistTTL) {
                // Load into in-memory cache
                this.cache.set(page, parsed);
                loadedCount++;
                console.log(`📦 Restored ${page} from localStorage`);
              } else {
                // Remove expired localStorage entries
                localStorage.removeItem(key);
              }
            }
          } catch (e) {
            console.warn(`Failed to parse cached widget data for key: ${key}`, e);
          }
        }
      }

      if (loadedCount > 0) {
        console.log(`✅ Restored ${loadedCount} widgets from localStorage`);
      }
    } catch (error) {
      console.warn('Failed to load widgets from localStorage:', error);
    }

    this.isInitialized = true;
  }

  /**
   * Save entry to localStorage for persistence across browser sessions
   */
  private saveToStorage(page: string, entry: CacheEntry): void {
    if (typeof window === 'undefined') return;

    try {
      const key = this.localStoragePrefix + page;
      localStorage.setItem(key, JSON.stringify(entry));
      console.log(`💾 Saved ${page} to localStorage`);
    } catch (error) {
      // localStorage might be full or unavailable (incognito mode)
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        console.warn('localStorage quota exceeded, clearing old entries');
        this.clearOldestStorageEntries();
      } else {
        console.warn(`Failed to save widget cache to localStorage:`, error);
      }
    }
  }

  /**
   * Remove oldest entries from localStorage to make space
   */
  private clearOldestStorageEntries(): void {
    if (typeof window === 'undefined') return;

    try {
      const keys = Object.keys(localStorage);
      const entries: { key: string; timestamp: number }[] = [];

      for (const key of keys) {
        if (key.startsWith(this.localStoragePrefix)) {
          const stored = localStorage.getItem(key);
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              entries.push({ key, timestamp: parsed.timestamp });
            } catch {
              // Skip malformed entries
            }
          }
        }
      }

      // Sort by timestamp and remove oldest 30%
      entries.sort((a, b) => a.timestamp - b.timestamp);
      const toRemove = Math.max(1, Math.floor(entries.length * 0.3));
      
      for (let i = 0; i < toRemove; i++) {
        localStorage.removeItem(entries[i].key);
        console.log(`🗑️ Removed ${entries[i].key} from localStorage to free space`);
      }
    } catch (error) {
      console.warn('Failed to cleanup localStorage:', error);
    }
  }

  /**
   * Get cached data for a page (checks memory first, then localStorage)
   */
  get(page: string): any | null {
    // Check in-memory cache first (fastest)
    const entry = this.cache.get(page);
    
    if (entry) {
      // Check if entry is expired
      if (Date.now() - entry.timestamp > this.config.ttl) {
        this.cache.delete(page);
      } else {
        // Check if version is still valid
        const currentVersion = this.versions.get(page) || 1;
        if (entry.version >= currentVersion) {
          console.log(`📦 Widget cache hit (memory) for page: ${page}`);
          return entry.data;
        }
      }
    }

    // Fall back to localStorage (for cross-session persistence)
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(this.localStoragePrefix + page);
        if (stored) {
          const parsed = JSON.parse(stored);
          
          // Check if stored data is still valid
          if (Date.now() - parsed.timestamp <= this.config.persistTTL) {
            const currentVersion = this.versions.get(page) || 1;
            if (parsed.version >= currentVersion) {
              // Restore to in-memory cache for faster subsequent access
              this.cache.set(page, parsed);
              console.log(`📦 Widget cache hit (localStorage) for page: ${page}`);
              return parsed.data;
            }
          } else {
            // Remove expired localStorage entry
            localStorage.removeItem(this.localStoragePrefix + page);
          }
        }
      } catch (error) {
        console.warn(`Failed to load widget cache from localStorage for ${page}:`, error);
      }
    }

    return null;
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
    
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      version: currentVersion,
    };

    // Store in memory
    this.cache.set(page, entry);
    
    // Also persist to localStorage for cross-session reuse
    this.saveToStorage(page, entry);

    console.log(`💾 Widget cache set for page: ${page} (memory + localStorage)`);
  }

  /**
   * Invalidate cache for a specific page (when widgets change)
   */
  invalidate(page: string): void {
    // Increment version to invalidate existing cache entries
    const currentVersion = this.versions.get(page) || 1;
    this.versions.set(page, currentVersion + 1);
    
    // Remove from memory
    this.cache.delete(page);
    
    // Also remove from localStorage
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(this.localStoragePrefix + page);
      } catch (error) {
        console.warn(`Failed to remove ${page} from localStorage:`, error);
      }
    }
    
    console.log(`🗑️ Widget cache invalidated for page: ${page} (version: ${currentVersion + 1})`);
  }

  /**
   * Clear all cache (both memory and localStorage)
   */
  clear(): void {
    this.cache.clear();
    this.versions.clear();
    
    if (typeof window !== 'undefined') {
      try {
        const keys = Object.keys(localStorage);
        for (const key of keys) {
          if (key.startsWith(this.localStoragePrefix)) {
            localStorage.removeItem(key);
          }
        }
      } catch (error) {
        console.warn('Failed to clear localStorage cache:', error);
      }
    }
    
    console.log('🗑️ Widget cache cleared completely (memory + localStorage)');
  }

  /**
   * Cleanup expired entries from memory cache
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
    const storageSize = typeof window !== 'undefined' ? 
      Object.keys(localStorage)
        .filter(k => k.startsWith(this.localStoragePrefix))
        .length : 0;

    return {
      memory: {
        size: this.cache.size,
        maxSize: this.config.maxSize,
      },
      storage: {
        size: storageSize,
      },
      ttl: this.config.ttl,
      persistTTL: this.config.persistTTL,
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
  ttl: 10 * 60 * 1000, // 10 minutes in-memory cache for fast access
  maxSize: 20, // Cache up to 20 pages in memory
  persistTTL: 24 * 60 * 60 * 1000, // Keep data in localStorage for 24 hours
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