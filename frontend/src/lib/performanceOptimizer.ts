"use client";

import { Media } from '@/types/media';
import { assetPreloader } from './assetPreloader';

// Video preloading pool with intelligent management
class VideoPreloadPool {
  private pool = new Map<string, HTMLVideoElement>();
  private maxPoolSize = 5; // Maximum 5 preloaded videos
  private currentlyPreloading = new Set<string>();

  async preloadVideo(url: string, priority: 'high' | 'medium' | 'low' = 'medium'): Promise<HTMLVideoElement | null> {
    // Check if already in pool
    if (this.pool.has(url)) {
      return this.pool.get(url)!;
    }

    // Check if already preloading
    if (this.currentlyPreloading.has(url)) {
      return null;
    }

    // Clean pool if at capacity
    if (this.pool.size >= this.maxPoolSize) {
      this.cleanOldestVideo();
    }

    this.currentlyPreloading.add(url);

    try {
      const video = await assetPreloader.preloadVideo(url, { priority });
      this.pool.set(url, video);
      return video;
    } catch (error) {
      console.warn('Failed to preload video:', url, error);
      return null;
    } finally {
      this.currentlyPreloading.delete(url);
    }
  }

  getPreloadedVideo(url: string): HTMLVideoElement | null {
    return this.pool.get(url) || null;
  }

  private cleanOldestVideo(): void {
    const firstEntry = this.pool.entries().next().value;
    if (firstEntry) {
      const [url, video] = firstEntry;
      video.pause();
      video.src = '';
      this.pool.delete(url);
    }
  }

  clearPool(): void {
    this.pool.forEach(video => {
      video.pause();
      video.src = '';
    });
    this.pool.clear();
  }
}

// Intersection Observer for lazy loading
class LazyLoadManager {
  private observer: IntersectionObserver | null = null;
  private callbacks = new Map<Element, () => void>();

  constructor() {
    if (typeof window !== 'undefined') {
      this.observer = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const callback = this.callbacks.get(entry.target);
              if (callback) {
                callback();
                this.unobserve(entry.target);
              }
            }
          });
        },
        {
          rootMargin: '50px', // Start loading 50px before element enters viewport
          threshold: 0.1
        }
      );
    }
  }

  observe(element: Element, callback: () => void): void {
    if (!this.observer) return;
    
    this.callbacks.set(element, callback);
    this.observer.observe(element);
  }

  unobserve(element: Element): void {
    if (!this.observer) return;
    
    this.observer.unobserve(element);
    this.callbacks.delete(element);
  }

  disconnect(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.callbacks.clear();
    }
  }
}

// Debounce utility for hover effects
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate = false
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      if (!immediate) func(...args);
    };
    
    const callNow = immediate && !timeout;
    
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    
    if (callNow) func(...args);
  };
}

// Asset URL caching with localStorage
class AssetUrlCache {
  private cache = new Map<string, string>();
  private storageKey = 'homeflix-asset-urls';

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        this.cache = new Map(Object.entries(data));
      }
    } catch (error) {
      console.warn('Failed to load asset URL cache:', error);
    }
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const data = Object.fromEntries(this.cache);
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save asset URL cache:', error);
    }
  }

  getUrl(type: 'thumbnail' | 'poster' | 'preview', mediaId: string | number, baseUrl: string): string {
    const key = `${type}-${mediaId}`;
    
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    const url = `${baseUrl}/api/${type}s/${mediaId}`;
    this.cache.set(key, url);
    
    // Debounced save to avoid excessive localStorage writes
    this.debouncedSave();
    
    return url;
  }

  private debouncedSave = debounce(() => {
    this.saveToStorage();
  }, 1000);

  clearCache(): void {
    this.cache.clear();
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.storageKey);
    }
  }
}

// Slide preloader for carousel components
class SlidePreloader {
  private preloadedSlides = new Map<number, { image: boolean; video: boolean }>();

  async preloadSlide(
    media: Media,
    index: number,
    baseUrl: string,
    priority: 'high' | 'medium' | 'low' = 'medium'
  ): Promise<void> {
    const slideKey = index;
    
    if (this.preloadedSlides.has(slideKey)) {
      return;
    }

    const thumbnailUrl = assetUrlCache.getUrl('thumbnail', media.id, baseUrl);
    const previewUrl = assetUrlCache.getUrl('preview', media.id, baseUrl);

    const promises: Promise<any>[] = [];

    // Preload thumbnail/poster
    promises.push(
      assetPreloader.preloadImage(thumbnailUrl, { priority })
        .then(() => {
          const current = this.preloadedSlides.get(slideKey) || { image: false, video: false };
          this.preloadedSlides.set(slideKey, { ...current, image: true });
        })
        .catch(() => {
          console.warn('Failed to preload slide image:', thumbnailUrl);
        })
    );

    // Preload preview video for high priority slides
    if (priority === 'high') {
      promises.push(
        videoPreloadPool.preloadVideo(previewUrl, priority)
          .then(() => {
            const current = this.preloadedSlides.get(slideKey) || { image: false, video: false };
            this.preloadedSlides.set(slideKey, { ...current, video: true });
          })
          .catch(() => {
            console.warn('Failed to preload slide video:', previewUrl);
          })
      );
    }

    await Promise.allSettled(promises);
  }

  isSlidePreloaded(index: number): { image: boolean; video: boolean } {
    return this.preloadedSlides.get(index) || { image: false, video: false };
  }

  preloadNextSlides(
    currentIndex: number,
    mediaList: Media[],
    baseUrl: string,
    count: number = 2
  ): void {
    for (let i = 1; i <= count; i++) {
      const nextIndex = (currentIndex + i) % mediaList.length;
      const media = mediaList[nextIndex];
      
      if (media) {
        this.preloadSlide(media, nextIndex, baseUrl, i === 1 ? 'high' : 'medium');
      }
    }
  }

  clearPreloaded(): void {
    this.preloadedSlides.clear();
  }
}

// Request deduplication
class RequestDeduplicator {
  private pendingRequests = new Map<string, Promise<any>>();

  async dedupe<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key) as Promise<T>;
    }

    const promise = requestFn().finally(() => {
      this.pendingRequests.delete(key);
    });

    this.pendingRequests.set(key, promise);
    return promise;
  }

  clear(): void {
    this.pendingRequests.clear();
  }
}

// Create singleton instances
export const videoPreloadPool = new VideoPreloadPool();
export const lazyLoadManager = new LazyLoadManager();
export const assetUrlCache = new AssetUrlCache();
export const slidePreloader = new SlidePreloader();
export const requestDeduplicator = new RequestDeduplicator();

// Loading state manager
export class LoadingStateManager {
  private loadingStates = new Map<string, boolean>();
  private callbacks = new Map<string, Set<(loading: boolean) => void>>();

  setLoading(key: string, loading: boolean): void {
    this.loadingStates.set(key, loading);
    
    const callbacks = this.callbacks.get(key);
    if (callbacks) {
      callbacks.forEach(callback => callback(loading));
    }
  }

  isLoading(key: string): boolean {
    return this.loadingStates.get(key) || false;
  }

  subscribe(key: string, callback: (loading: boolean) => void): () => void {
    if (!this.callbacks.has(key)) {
      this.callbacks.set(key, new Set());
    }
    
    this.callbacks.get(key)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.callbacks.get(key);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.callbacks.delete(key);
        }
      }
    };
  }

  clear(): void {
    this.loadingStates.clear();
    this.callbacks.clear();
  }
}

export const loadingStateManager = new LoadingStateManager();
