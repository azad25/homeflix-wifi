"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Media } from '@/types/media';
import { assetPreloader, preloadBatch } from '@/lib/assetPreloader';
import { getApiUrl } from '@/lib/api';

interface OptimizedSlideLoaderProps {
  media: Media[];
  currentIndex: number;
  onSlideReady: (index: number, assets: { image: HTMLImageElement | null; video: HTMLVideoElement | null }) => void;
  preloadRange?: number; // How many slides ahead/behind to preload
}

interface SlideAssets {
  image: HTMLImageElement | null;
  video: HTMLVideoElement | null;
  imageLoaded: boolean;
  videoLoaded: boolean;
  imageLoading: boolean;
  videoLoading: boolean;
  imageError: boolean;
  videoError: boolean;
}

const OptimizedSlideLoader: React.FC<OptimizedSlideLoaderProps> = ({
  media,
  currentIndex,
  onSlideReady,
  preloadRange = 2
}) => {
  const [slideAssets, setSlideAssets] = useState<Map<number, SlideAssets>>(new Map());
  const [loadingProgress, setLoadingProgress] = useState<Map<number, number>>(new Map());
  const loadingRef = useRef<Set<number>>(new Set());

  const getImageUrl = (mediaItem: Media): string => {
    const apiUrl = getApiUrl();
    return `${apiUrl}/api/thumbnails/${mediaItem.id}`;
  };

  const getVideoUrl = (mediaItem: Media): string => {
    const apiUrl = getApiUrl();
    return `${apiUrl}/api/preview-clips/${mediaItem.id}?quality=high&format=mp4`;
  };

  const getPosterUrl = (mediaItem: Media): string => {
    const apiUrl = getApiUrl();
    return `${apiUrl}/api/posters/${mediaItem.id}`;
  };

  // Initialize slide assets
  const initializeSlideAssets = (index: number): SlideAssets => {
    return {
      image: null,
      video: null,
      imageLoaded: false,
      videoLoaded: false,
      imageLoading: false,
      videoLoading: false,
      imageError: false,
      videoError: false
    };
  };

  // Load assets for a specific slide
  const loadSlideAssets = async (index: number, priority: 'high' | 'medium' | 'low' = 'medium') => {
    if (index < 0 || index >= media.length || loadingRef.current.has(index)) {
      return;
    }

    loadingRef.current.add(index);
    const mediaItem = media[index];
    
    // Initialize assets if not exists
    if (!slideAssets.has(index)) {
      setSlideAssets(prev => new Map(prev.set(index, initializeSlideAssets(index))));
    }

    // Update loading states
    setSlideAssets(prev => {
      const newMap = new Map(prev);
      const assets = newMap.get(index) || initializeSlideAssets(index);
      assets.imageLoading = true;
      assets.videoLoading = true;
      newMap.set(index, assets);
      return newMap;
    });

    setLoadingProgress(prev => new Map(prev.set(index, 0)));

    try {
      // Load image (thumbnail or poster)
      let imageElement: HTMLImageElement | null = null;
      try {
        const imageUrl = getImageUrl(mediaItem);
        imageElement = await assetPreloader.preloadImage(imageUrl, { priority, timeout: 8000 });
        
        // Update image loaded state
        setSlideAssets(prev => {
          const newMap = new Map(prev);
          const assets = newMap.get(index) || initializeSlideAssets(index);
          assets.image = imageElement;
          assets.imageLoaded = true;
          assets.imageLoading = false;
          assets.imageError = false;
          newMap.set(index, assets);
          return newMap;
        });

        setLoadingProgress(prev => new Map(prev.set(index, 50)));
      } catch (error) {
        console.warn(`Failed to load image for slide ${index}:`, error);
        
        // Try poster as fallback
        try {
          const posterUrl = getPosterUrl(mediaItem);
          imageElement = await assetPreloader.preloadImage(posterUrl, { priority, timeout: 8000 });
          
          setSlideAssets(prev => {
            const newMap = new Map(prev);
            const assets = newMap.get(index) || initializeSlideAssets(index);
            assets.image = imageElement;
            assets.imageLoaded = true;
            assets.imageLoading = false;
            assets.imageError = false;
            newMap.set(index, assets);
            return newMap;
          });

          setLoadingProgress(prev => new Map(prev.set(index, 50)));
        } catch (posterError) {
          console.warn(`Failed to load poster fallback for slide ${index}:`, posterError);
          
          setSlideAssets(prev => {
            const newMap = new Map(prev);
            const assets = newMap.get(index) || initializeSlideAssets(index);
            assets.imageLoading = false;
            assets.imageError = true;
            newMap.set(index, assets);
            return newMap;
          });
        }
      }

      // Load video (preview clip)
      let videoElement: HTMLVideoElement | null = null;
      try {
        const videoUrl = getVideoUrl(mediaItem);
        videoElement = await assetPreloader.preloadVideo(videoUrl, { priority, timeout: 12000 });
        
        // Update video loaded state
        setSlideAssets(prev => {
          const newMap = new Map(prev);
          const assets = newMap.get(index) || initializeSlideAssets(index);
          assets.video = videoElement;
          assets.videoLoaded = true;
          assets.videoLoading = false;
          assets.videoError = false;
          newMap.set(index, assets);
          return newMap;
        });

        setLoadingProgress(prev => new Map(prev.set(index, 100)));
      } catch (error) {
        console.warn(`Failed to load video for slide ${index}:`, error);
        
        setSlideAssets(prev => {
          const newMap = new Map(prev);
          const assets = newMap.get(index) || initializeSlideAssets(index);
          assets.videoLoading = false;
          assets.videoError = true;
          newMap.set(index, assets);
          return newMap;
        });

        // If video fails but image loaded, still consider it partially ready
        if (imageElement) {
          setLoadingProgress(prev => new Map(prev.set(index, 75)));
        }
      }

      // Notify parent component that slide is ready
      const finalAssets = slideAssets.get(index);
      if (finalAssets && (finalAssets.imageLoaded || finalAssets.videoLoaded)) {
        onSlideReady(index, {
          image: finalAssets.image,
          video: finalAssets.video
        });
      }

    } finally {
      loadingRef.current.delete(index);
    }
  };

  // Preload slides around current index
  const preloadSurroundingSlides = async () => {
    const indicesToLoad: Array<{ index: number; priority: 'high' | 'medium' | 'low' }> = [];

    // Current slide - highest priority
    indicesToLoad.push({ index: currentIndex, priority: 'high' });

    // Next slides - high priority
    for (let i = 1; i <= preloadRange; i++) {
      const nextIndex = currentIndex + i;
      if (nextIndex < media.length) {
        indicesToLoad.push({ index: nextIndex, priority: i === 1 ? 'high' : 'medium' });
      }
    }

    // Previous slides - medium priority
    for (let i = 1; i <= preloadRange; i++) {
      const prevIndex = currentIndex - i;
      if (prevIndex >= 0) {
        indicesToLoad.push({ index: prevIndex, priority: 'medium' });
      }
    }

    // Load in priority order
    for (const { index, priority } of indicesToLoad) {
      if (!slideAssets.has(index) || (!slideAssets.get(index)?.imageLoaded && !slideAssets.get(index)?.videoLoaded)) {
        loadSlideAssets(index, priority);
      }
    }
  };

  // Effect to preload when current index changes
  useEffect(() => {
    preloadSurroundingSlides();
  }, [currentIndex, media]);

  // Effect to preload initial batch
  useEffect(() => {
    if (media.length > 0) {
      // Preload first few slides immediately
      const initialBatch = media.slice(0, Math.min(3, media.length)).map((mediaItem, index) => [
        { url: getImageUrl(mediaItem), type: 'image' as const, priority: 'high' as const },
        { url: getVideoUrl(mediaItem), type: 'video' as const, priority: index === 0 ? 'high' as const : 'medium' as const }
      ]).flat();

      preloadBatch(initialBatch).catch(error => {
        console.warn('Initial batch preload failed:', error);
      });
    }
  }, [media]);

  // Cleanup old assets when slides change significantly
  useEffect(() => {
    const cleanup = () => {
      const indicesToKeep = new Set<number>();
      
      // Keep current slide and surrounding slides
      for (let i = Math.max(0, currentIndex - preloadRange * 2); 
           i <= Math.min(media.length - 1, currentIndex + preloadRange * 2); 
           i++) {
        indicesToKeep.add(i);
      }

      // Remove assets for slides that are far away
      setSlideAssets(prev => {
        const newMap = new Map();
        prev.forEach((assets, index) => {
          if (indicesToKeep.has(index)) {
            newMap.set(index, assets);
          } else {
            // Cleanup video elements
            if (assets.video) {
              assets.video.pause();
              assets.video.src = '';
              assets.video.load();
            }
          }
        });
        return newMap;
      });

      setLoadingProgress(prev => {
        const newMap = new Map();
        prev.forEach((progress, index) => {
          if (indicesToKeep.has(index)) {
            newMap.set(index, progress);
          }
        });
        return newMap;
      });
    };

    const cleanupTimer = setTimeout(cleanup, 5000); // Cleanup after 5 seconds
    return () => clearTimeout(cleanupTimer);
  }, [currentIndex, preloadRange, media.length]);

  // Get loading state for a specific slide
  const getSlideLoadingState = (index: number) => {
    const assets = slideAssets.get(index);
    const progress = loadingProgress.get(index) || 0;
    
    return {
      isLoading: assets?.imageLoading || assets?.videoLoading || false,
      isReady: assets?.imageLoaded || assets?.videoLoaded || false,
      hasError: assets?.imageError && assets?.videoError || false,
      progress,
      assets: assets || null
    };
  };

  // Render loading indicators
  const renderLoadingIndicator = (index: number) => {
    const state = getSlideLoadingState(index);
    
    if (!state.isLoading && state.isReady) return null;
    if (!state.isLoading && !state.isReady && !state.hasError) return null;

    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 flex items-center justify-center z-10"
        >
          {state.hasError ? (
            <div className="text-white text-center">
              <div className="text-4xl mb-2">⚠️</div>
              <div className="text-sm">Failed to load</div>
            </div>
          ) : (
            <div className="text-white text-center">
              <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4"></div>
              <div className="text-sm mb-2">Loading slide...</div>
              <div className="w-32 h-2 bg-white/20 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-red-600 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${state.progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <div className="text-xs mt-1 text-white/70">{state.progress}%</div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    );
  };

  // This component doesn't render anything visible, it just manages preloading
  // The loading indicators are returned via a function for the parent to use
  return null;
};

export default OptimizedSlideLoader;

// Export helper functions for parent components
export const useSlideLoader = (media: Media[], currentIndex: number, preloadRange = 2) => {
  const [slideAssets, setSlideAssets] = useState<Map<number, SlideAssets>>(new Map());
  const [loadingStates, setLoadingStates] = useState<Map<number, any>>(new Map());

  const getSlideAssets = (index: number) => slideAssets.get(index);
  const getLoadingState = (index: number) => loadingStates.get(index);

  return {
    getSlideAssets,
    getLoadingState,
    slideAssets,
    loadingStates
  };
};
