/**
 * Advanced Asset Preloader for HomeFlix
 * Handles intelligent preloading of images, videos, and other assets
 */

interface PreloadedAsset {
  url: string;
  type: 'image' | 'video';
  element: HTMLImageElement | HTMLVideoElement;
  loaded: boolean;
  loading: boolean;
  error: boolean;
  priority: 'high' | 'medium' | 'low';
  timestamp: number;
}

interface PreloadOptions {
  priority?: 'high' | 'medium' | 'low';
  timeout?: number;
  retries?: number;
}

class AssetPreloader {
  private cache = new Map<string, PreloadedAsset>();
  private loadingQueue = new Set<string>();
  private maxCacheSize = 50; // Maximum number of cached assets
  private maxConcurrentLoads = 6; // Maximum concurrent loading operations
  private currentLoads = 0;

  /**
   * Preload an image with intelligent caching
   */
  async preloadImage(url: string, options: PreloadOptions = {}): Promise<HTMLImageElement> {
    const { priority = 'medium', timeout = 10000, retries = 2 } = options;

    // Check if already cached
    const cached = this.cache.get(url);
    if (cached && cached.loaded && cached.type === 'image') {
      return cached.element as HTMLImageElement;
    }

    // Check if already loading
    if (this.loadingQueue.has(url)) {
      return this.waitForLoad(url) as Promise<HTMLImageElement>;
    }

    // Wait for available slot if at max concurrent loads
    await this.waitForAvailableSlot();

    this.loadingQueue.add(url);
    this.currentLoads++;

    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      // Add to cache immediately
      const asset: PreloadedAsset = {
        url,
        type: 'image',
        element: img,
        loaded: false,
        loading: true,
        error: false,
        priority,
        timestamp: Date.now()
      };
      this.cache.set(url, asset);

      const loadPromise = new Promise<HTMLImageElement>((resolve, reject) => {
        let attempts = 0;

        const attemptLoad = () => {
          attempts++;
          
          const timeoutId = setTimeout(() => {
            if (attempts < retries) {
              console.warn(`Image load timeout, retrying (${attempts}/${retries}): ${url}`);
              attemptLoad();
            } else {
              asset.loading = false;
              asset.error = true;
              reject(new Error(`Image load timeout after ${retries} attempts: ${url}`));
            }
          }, timeout);

          img.onload = () => {
            clearTimeout(timeoutId);
            asset.loaded = true;
            asset.loading = false;
            asset.error = false;
            resolve(img);
          };

          img.onerror = () => {
            clearTimeout(timeoutId);
            if (attempts < retries) {
              console.warn(`Image load error, retrying (${attempts}/${retries}): ${url}`);
              setTimeout(attemptLoad, 1000 * attempts); // Exponential backoff
            } else {
              asset.loading = false;
              asset.error = true;
              reject(new Error(`Image load failed after ${retries} attempts: ${url}`));
            }
          };

          img.src = url;
        };

        attemptLoad();
      });

      const result = await loadPromise;
      this.cleanupCache();
      return result;

    } finally {
      this.loadingQueue.delete(url);
      this.currentLoads--;
    }
  }

  /**
   * Preload a video with intelligent caching
   */
  async preloadVideo(url: string, options: PreloadOptions = {}): Promise<HTMLVideoElement> {
    const { priority = 'medium', timeout = 15000, retries = 2 } = options;

    // Check if already cached
    const cached = this.cache.get(url);
    if (cached && cached.loaded && cached.type === 'video') {
      return cached.element as HTMLVideoElement;
    }

    // Check if already loading
    if (this.loadingQueue.has(url)) {
      return this.waitForLoad(url) as Promise<HTMLVideoElement>;
    }

    // Wait for available slot if at max concurrent loads
    await this.waitForAvailableSlot();

    this.loadingQueue.add(url);
    this.currentLoads++;

    try {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.muted = true;
      video.playsInline = true;
      video.preload = 'metadata';
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');

      // Add to cache immediately
      const asset: PreloadedAsset = {
        url,
        type: 'video',
        element: video,
        loaded: false,
        loading: true,
        error: false,
        priority,
        timestamp: Date.now()
      };
      this.cache.set(url, asset);

      const loadPromise = new Promise<HTMLVideoElement>((resolve, reject) => {
        let attempts = 0;

        const attemptLoad = () => {
          attempts++;
          
          const timeoutId = setTimeout(() => {
            if (attempts < retries) {
              console.warn(`Video load timeout, retrying (${attempts}/${retries}): ${url}`);
              attemptLoad();
            } else {
              asset.loading = false;
              asset.error = true;
              reject(new Error(`Video load timeout after ${retries} attempts: ${url}`));
            }
          }, timeout);

          video.onloadeddata = () => {
            clearTimeout(timeoutId);
            asset.loaded = true;
            asset.loading = false;
            asset.error = false;
            resolve(video);
          };

          video.onerror = () => {
            clearTimeout(timeoutId);
            if (attempts < retries) {
              console.warn(`Video load error, retrying (${attempts}/${retries}): ${url}`);
              setTimeout(attemptLoad, 1000 * attempts); // Exponential backoff
            } else {
              asset.loading = false;
              asset.error = true;
              reject(new Error(`Video load failed after ${retries} attempts: ${url}`));
            }
          };

          video.src = url;
          video.load();
        };

        attemptLoad();
      });

      const result = await loadPromise;
      this.cleanupCache();
      return result;

    } finally {
      this.loadingQueue.delete(url);
      this.currentLoads--;
    }
  }

  /**
   * Batch preload multiple assets with priority handling
   */
  async preloadBatch(assets: Array<{ url: string; type: 'image' | 'video'; priority?: 'high' | 'medium' | 'low' }>): Promise<void> {
    // Sort by priority
    const sortedAssets = assets.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority || 'medium'] - priorityOrder[a.priority || 'medium'];
    });

    // Process in chunks to avoid overwhelming the browser
    const chunkSize = 3;
    for (let i = 0; i < sortedAssets.length; i += chunkSize) {
      const chunk = sortedAssets.slice(i, i + chunkSize);
      
      await Promise.allSettled(
        chunk.map(asset => {
          if (asset.type === 'image') {
            return this.preloadImage(asset.url, { priority: asset.priority });
          } else {
            return this.preloadVideo(asset.url, { priority: asset.priority });
          }
        })
      );
    }
  }

  /**
   * Get cached asset if available
   */
  getCached(url: string): PreloadedAsset | null {
    const cached = this.cache.get(url);
    return cached && cached.loaded ? cached : null;
  }

  /**
   * Check if asset is loading
   */
  isLoading(url: string): boolean {
    return this.loadingQueue.has(url);
  }

  /**
   * Check if asset is cached and loaded
   */
  isCached(url: string): boolean {
    const cached = this.cache.get(url);
    return cached ? cached.loaded : false;
  }

  /**
   * Wait for an asset to finish loading
   */
  private async waitForLoad(url: string): Promise<HTMLImageElement | HTMLVideoElement> {
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        const cached = this.cache.get(url);
        if (cached && cached.loaded) {
          clearInterval(checkInterval);
          resolve(cached.element);
        } else if (cached && cached.error) {
          clearInterval(checkInterval);
          reject(new Error(`Asset failed to load: ${url}`));
        }
      }, 100);

      // Timeout after 30 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error(`Wait timeout for asset: ${url}`));
      }, 30000);
    });
  }

  /**
   * Wait for available loading slot
   */
  private async waitForAvailableSlot(): Promise<void> {
    while (this.currentLoads >= this.maxConcurrentLoads) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Clean up old cached assets to prevent memory leaks
   */
  private cleanupCache(): void {
    if (this.cache.size <= this.maxCacheSize) return;

    // Convert to array and sort by timestamp (oldest first)
    const entries = Array.from(this.cache.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Remove oldest entries until we're under the limit
    const toRemove = entries.slice(0, entries.length - this.maxCacheSize);
    toRemove.forEach(([url, asset]) => {
      // Clean up video elements to prevent memory leaks
      if (asset.type === 'video') {
        const video = asset.element as HTMLVideoElement;
        video.pause();
        video.src = '';
        video.load();
      }
      this.cache.delete(url);
    });

    console.log(`🧹 Cleaned up ${toRemove.length} cached assets`);
  }

  /**
   * Clear all cached assets
   */
  clearCache(): void {
    this.cache.forEach((asset) => {
      if (asset.type === 'video') {
        const video = asset.element as HTMLVideoElement;
        video.pause();
        video.src = '';
        video.load();
      }
    });
    this.cache.clear();
    console.log('🧹 Cleared all cached assets');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; loading: number; images: number; videos: number } {
    const images = Array.from(this.cache.values()).filter(asset => asset.type === 'image' && asset.loaded).length;
    const videos = Array.from(this.cache.values()).filter(asset => asset.type === 'video' && asset.loaded).length;
    
    return {
      size: this.cache.size,
      loading: this.loadingQueue.size,
      images,
      videos
    };
  }
}

// Create singleton instance
export const assetPreloader = new AssetPreloader();

// Helper functions for easy use
export const preloadImage = (url: string, options?: PreloadOptions) => assetPreloader.preloadImage(url, options);
export const preloadVideo = (url: string, options?: PreloadOptions) => assetPreloader.preloadVideo(url, options);
export const preloadBatch = (assets: Array<{ url: string; type: 'image' | 'video'; priority?: 'high' | 'medium' | 'low' }>) => assetPreloader.preloadBatch(assets);
export const getCachedAsset = (url: string) => assetPreloader.getCached(url);
export const isAssetLoading = (url: string) => assetPreloader.isLoading(url);
export const isAssetCached = (url: string) => assetPreloader.isCached(url);
