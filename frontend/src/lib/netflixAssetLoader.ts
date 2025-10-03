/**
 * Netflix-level asset loading utilities for seamless media experience
 * Implements progressive loading, caching, and preloading strategies
 */

interface LoadingOptions {
  priority?: 'high' | 'medium' | 'low';
  preload?: boolean;
  cache?: boolean;
  quality?: 'low' | 'medium' | 'high' | 'auto';
  timeout?: number;
}

interface AssetCache {
  [key: string]: {
    blob: Blob;
    url: string;
    timestamp: number;
    size: number;
  };
}

class NetflixAssetLoader {
  private cache: AssetCache = {};
  private loadingPromises: Map<string, Promise<string>> = new Map();
  private preloadQueue: Set<string> = new Set();
  private maxCacheSize = 100 * 1024 * 1024; // 100MB cache
  private currentCacheSize = 0;

  /**
   * Load image with Netflix-style progressive loading
   */
  async loadImage(src: string, options: LoadingOptions = {}): Promise<string> {
    const {
      priority = 'medium',
      preload = false,
      cache = true,
      quality = 'auto',
      timeout = 10000
    } = options;

    // Check cache first
    if (cache && this.cache[src]) {
      const cached = this.cache[src];
      // Check if cache is still valid (1 hour)
      if (Date.now() - cached.timestamp < 3600000) {
        return cached.url;
      } else {
        this.removeFromCache(src);
      }
    }

    // Check if already loading
    if (this.loadingPromises.has(src)) {
      return this.loadingPromises.get(src)!;
    }

    // Create loading promise
    const loadingPromise = this.createImageLoadingPromise(src, options);
    this.loadingPromises.set(src, loadingPromise);

    try {
      const result = await loadingPromise;
      this.loadingPromises.delete(src);
      return result;
    } catch (error) {
      this.loadingPromises.delete(src);
      throw error;
    }
  }

  private async createImageLoadingPromise(src: string, options: LoadingOptions): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const timeoutId = setTimeout(() => {
        reject(new Error(`Image load timeout: ${src}`));
      }, options.timeout || 10000);

      img.onload = () => {
        clearTimeout(timeoutId);
        
        // Convert to blob for caching
        if (options.cache) {
          this.convertImageToBlob(img, src).then(resolve).catch(reject);
        } else {
          resolve(src);
        }
      };

      img.onerror = () => {
        clearTimeout(timeoutId);
        reject(new Error(`Failed to load image: ${src}`));
      };

      // Set loading attributes for better performance
      img.decoding = 'async';
      img.loading = options.priority === 'high' ? 'eager' : 'lazy';
      
      // Apply quality-based loading
      if (options.quality === 'low') {
        // For thumbnails, we might want to load a smaller version first
        img.src = this.getOptimizedImageUrl(src, 'thumbnail');
      } else {
        img.src = src;
      }
    });
  }

  private async convertImageToBlob(img: HTMLImageElement, src: string): Promise<string> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);
      
      canvas.toBlob((blob) => {
        if (blob && this.currentCacheSize + blob.size < this.maxCacheSize) {
          const url = URL.createObjectURL(blob);
          this.cache[src] = {
            blob,
            url,
            timestamp: Date.now(),
            size: blob.size
          };
          this.currentCacheSize += blob.size;
          resolve(url);
        } else {
          resolve(src);
        }
      }, 'image/jpeg', 0.9);
    });
  }

  /**
   * Load video with adaptive streaming and preloading
   */
  async loadVideo(src: string, options: LoadingOptions = {}): Promise<HTMLVideoElement> {
    const {
      priority = 'medium',
      preload = true,
      timeout = 15000
    } = options;

    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const timeoutId = setTimeout(() => {
        reject(new Error(`Video load timeout: ${src}`));
      }, timeout);

      video.oncanplay = () => {
        clearTimeout(timeoutId);
        resolve(video);
      };

      video.onerror = () => {
        clearTimeout(timeoutId);
        reject(new Error(`Failed to load video: ${src}`));
      };

      // Netflix-style video attributes
      video.preload = preload ? 'metadata' : 'none';
      video.playsInline = true;
      video.muted = true; // Start muted for autoplay compliance
      video.controls = false;
      video.disablePictureInPicture = true;
      
      // Safari-specific attributes
      video.setAttribute('webkit-playsinline', 'true');
      video.setAttribute('playsinline', 'true');
      
      // Set source with range request support
      video.src = src;
      
      // Preload first few seconds for instant playback
      if (preload && priority === 'high') {
        video.currentTime = 0.1;
      }
    });
  }

  /**
   * Preload assets in the background (Netflix-style)
   */
  preloadAssets(assets: Array<{src: string, type: 'image' | 'video', options?: LoadingOptions}>) {
    assets.forEach(asset => {
      if (!this.preloadQueue.has(asset.src)) {
        this.preloadQueue.add(asset.src);
        
        // Use requestIdleCallback for non-blocking preloading
        if ('requestIdleCallback' in window) {
          requestIdleCallback(() => {
            this.preloadAsset(asset);
          });
        } else {
          setTimeout(() => this.preloadAsset(asset), 100);
        }
      }
    });
  }

  private async preloadAsset(asset: {src: string, type: 'image' | 'video', options?: LoadingOptions}) {
    try {
      if (asset.type === 'image') {
        await this.loadImage(asset.src, { ...asset.options, priority: 'low' });
      } else {
        await this.loadVideo(asset.src, { ...asset.options, priority: 'low', preload: true });
      }
    } catch (error) {
      console.warn(`Preload failed for ${asset.src}:`, error);
    } finally {
      this.preloadQueue.delete(asset.src);
    }
  }

  /**
   * Get optimized image URL based on quality and device
   */
  private getOptimizedImageUrl(src: string, quality: 'thumbnail' | 'medium' | 'high' = 'medium'): string {
    // In a real implementation, this would generate different sized images
    // For now, we'll use the original URL
    return src;
  }

  /**
   * Progressive image loading with blur-to-sharp transition
   */
  async loadImageProgressive(
    container: HTMLElement,
    src: string,
    options: LoadingOptions = {}
  ): Promise<void> {
    // Create placeholder with blur effect
    const placeholder = document.createElement('div');
    placeholder.className = 'absolute inset-0 bg-gray-800 animate-pulse';
    container.appendChild(placeholder);

    try {
      // Load low quality first
      const lowQualityUrl = this.getOptimizedImageUrl(src, 'thumbnail');
      const lowQualityImg = await this.loadImage(lowQualityUrl, { 
        ...options, 
        quality: 'low',
        timeout: 3000 
      });

      // Show low quality with blur
      const lowImg = document.createElement('img');
      lowImg.src = lowQualityImg;
      lowImg.className = 'absolute inset-0 w-full h-full object-cover filter blur-sm transition-opacity duration-300';
      container.appendChild(lowImg);
      placeholder.remove();

      // Load high quality in background
      const highQualityImg = await this.loadImage(src, options);
      
      // Show high quality
      const highImg = document.createElement('img');
      highImg.src = highQualityImg;
      highImg.className = 'absolute inset-0 w-full h-full object-cover transition-opacity duration-500';
      highImg.style.opacity = '0';
      container.appendChild(highImg);

      // Fade in high quality
      requestAnimationFrame(() => {
        highImg.style.opacity = '1';
        setTimeout(() => {
          lowImg.remove();
        }, 500);
      });

    } catch (error) {
      console.error('Progressive image loading failed:', error);
      placeholder.remove();
      
      // Fallback to regular image
      const fallbackImg = document.createElement('img');
      fallbackImg.src = src;
      fallbackImg.className = 'absolute inset-0 w-full h-full object-cover';
      container.appendChild(fallbackImg);
    }
  }

  /**
   * Clean up cache and resources
   */
  cleanup() {
    Object.values(this.cache).forEach(entry => {
      URL.revokeObjectURL(entry.url);
    });
    this.cache = {};
    this.currentCacheSize = 0;
    this.loadingPromises.clear();
    this.preloadQueue.clear();
  }

  /**
   * Remove item from cache
   */
  private removeFromCache(src: string) {
    if (this.cache[src]) {
      URL.revokeObjectURL(this.cache[src].url);
      this.currentCacheSize -= this.cache[src].size;
      delete this.cache[src];
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.currentCacheSize,
      maxSize: this.maxCacheSize,
      itemCount: Object.keys(this.cache).length,
      utilizationPercent: (this.currentCacheSize / this.maxCacheSize) * 100
    };
  }
}

// Singleton instance
export const netflixAssetLoader = new NetflixAssetLoader();

// React hook for asset loading
export function useNetflixAssetLoader() {
  return {
    loadImage: netflixAssetLoader.loadImage.bind(netflixAssetLoader),
    loadVideo: netflixAssetLoader.loadVideo.bind(netflixAssetLoader),
    preloadAssets: netflixAssetLoader.preloadAssets.bind(netflixAssetLoader),
    loadImageProgressive: netflixAssetLoader.loadImageProgressive.bind(netflixAssetLoader),
    getCacheStats: netflixAssetLoader.getCacheStats.bind(netflixAssetLoader)
  };
}

export default NetflixAssetLoader;
