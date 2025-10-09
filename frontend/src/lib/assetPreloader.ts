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
   * DISABLED: Preload an image - returns placeholder to prevent server crashes
   */
  async preloadImage(url: string, options: PreloadOptions = {}): Promise<HTMLImageElement> {
    // DISABLED: Return placeholder image to prevent server requests
    const img = new Image();
    img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDMwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iNDAwIiBmaWxsPSJncmFkaWVudChsaW5lYXIsIDQ1ZGVnLCAjMTExLCAjMzMzKSIvPgo8dGV4dCB4PSIxNTAiIHk9IjIwMCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjI0IiBmaWxsPSIjZTUwOTE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5Ib21lRmxpeDwvdGV4dD4KPHN2Zz4=';
    return Promise.resolve(img);
  }

  /**
   * DISABLED: Preload a video - returns empty video element to prevent server crashes
   */
  async preloadVideo(url: string, options: PreloadOptions = {}): Promise<HTMLVideoElement> {
    // DISABLED: Return empty video element to prevent server requests
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    return Promise.resolve(video);
  }

  /**
   * DISABLED: Batch preload - no-op to prevent server crashes
   */
  async preloadBatch(assets: Array<{ url: string; type: 'image' | 'video'; priority?: 'high' | 'medium' | 'low' }>): Promise<void> {
    // DISABLED: No-op to prevent server crashes from batch asset requests
    return Promise.resolve();
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
