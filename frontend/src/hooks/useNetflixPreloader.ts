/**
 * Netflix-style preloading hook for seamless asset management
 */

import { useEffect, useCallback, useRef } from 'react';
import { useNetflixAssetLoader } from '@/lib/netflixAssetLoader';

interface PreloadItem {
  src: string;
  type: 'image' | 'video';
  priority?: 'high' | 'medium' | 'low';
}

interface UseNetflixPreloaderOptions {
  enabled?: boolean;
  maxConcurrent?: number;
  preloadDistance?: number; // How many items ahead to preload
  viewport?: {
    rootMargin?: string;
    threshold?: number;
  };
}

export function useNetflixPreloader(
  items: PreloadItem[],
  options: UseNetflixPreloaderOptions = {}
) {
  const {
    enabled = true,
    maxConcurrent = 3,
    preloadDistance = 5,
    viewport = { rootMargin: '200px', threshold: 0.1 }
  } = options;

  const { preloadAssets } = useNetflixAssetLoader();
  const preloadedItems = useRef(new Set<string>());
  const currentlyPreloading = useRef(new Set<string>());
  const intersectionObserver = useRef<IntersectionObserver | null>(null);

  // Preload items based on scroll position and visibility
  const preloadNearbyItems = useCallback((visibleIndex: number) => {
    if (!enabled) return;

    const startIndex = Math.max(0, visibleIndex - 1);
    const endIndex = Math.min(items.length - 1, visibleIndex + preloadDistance);
    
    const itemsToPreload: Array<{src: string, type: 'image' | 'video', options?: any}> = [];
    
    for (let i = startIndex; i <= endIndex; i++) {
      const item = items[i];
      if (!item || preloadedItems.current.has(item.src) || currentlyPreloading.current.has(item.src)) {
        continue;
      }
      
      if (currentlyPreloading.current.size >= maxConcurrent) {
        break;
      }
      
      currentlyPreloading.current.add(item.src);
      itemsToPreload.push({
        src: item.src,
        type: item.type,
        options: {
          priority: (item.priority || 'low') as 'high' | 'medium' | 'low',
          cache: true,
          preload: true
        }
      });
    }

    if (itemsToPreload.length > 0) {
      preloadAssets(itemsToPreload);
      
      // Mark as preloaded after a delay
      itemsToPreload.forEach(item => {
        setTimeout(() => {
          preloadedItems.current.add(item.src);
          currentlyPreloading.current.delete(item.src);
        }, 1000);
      });
    }
  }, [enabled, items, preloadDistance, maxConcurrent, preloadAssets]);

  // Setup intersection observer for viewport-based preloading
  const setupIntersectionObserver = useCallback(() => {
    if (!enabled || typeof window === 'undefined') return;

    intersectionObserver.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = parseInt(entry.target.getAttribute('data-preload-index') || '0');
            preloadNearbyItems(index);
          }
        });
      },
      {
        rootMargin: viewport.rootMargin,
        threshold: viewport.threshold
      }
    );
  }, [enabled, viewport, preloadNearbyItems]);

  // Observe element for preloading
  const observeElement = useCallback((element: HTMLElement, index: number) => {
    if (!intersectionObserver.current) return;
    
    element.setAttribute('data-preload-index', index.toString());
    intersectionObserver.current.observe(element);
  }, []);

  // Unobserve element
  const unobserveElement = useCallback((element: HTMLElement) => {
    if (!intersectionObserver.current) return;
    
    intersectionObserver.current.unobserve(element);
  }, []);

  // Preload high priority items immediately
  const preloadHighPriorityItems = useCallback(() => {
    const highPriorityItems = items
      .filter(item => item.priority === 'high')
      .slice(0, maxConcurrent)
      .map(item => ({
        src: item.src,
        type: item.type,
        options: {
          priority: 'high' as 'high' | 'medium' | 'low',
          cache: true,
          preload: true
        }
      }));

    if (highPriorityItems.length > 0) {
      preloadAssets(highPriorityItems);
      highPriorityItems.forEach(item => {
        preloadedItems.current.add(item.src);
      });
    }
  }, [items, maxConcurrent, preloadAssets]);

  // Initialize preloader
  useEffect(() => {
    if (!enabled) return;

    setupIntersectionObserver();
    preloadHighPriorityItems();

    return () => {
      if (intersectionObserver.current) {
        intersectionObserver.current.disconnect();
      }
    };
  }, [enabled, setupIntersectionObserver, preloadHighPriorityItems]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      preloadedItems.current.clear();
      currentlyPreloading.current.clear();
    };
  }, []);

  return {
    observeElement,
    unobserveElement,
    preloadNearbyItems,
    preloadedCount: preloadedItems.current.size,
    isPreloading: currentlyPreloading.current.size > 0
  };
}

export default useNetflixPreloader;
