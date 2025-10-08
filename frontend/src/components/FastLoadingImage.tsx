"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { assetPreloader, getCachedAsset, isAssetCached } from '@/lib/assetPreloader';

interface FastLoadingImageProps {
  src: string;
  alt: string;
  fallbackSrc?: string;
  className?: string;
  priority?: 'high' | 'medium' | 'low';
  showLoader?: boolean;
  loaderSize?: 'small' | 'medium' | 'large';
  onLoad?: () => void;
  onError?: () => void;
  preload?: boolean;
}

const FastLoadingImage: React.FC<FastLoadingImageProps> = ({
  src,
  alt,
  fallbackSrc,
  className = '',
  priority = 'medium',
  showLoader = true,
  loaderSize = 'medium',
  onLoad,
  onError,
  preload = false
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const mountedRef = useRef(true);

  // Check if image is already cached
  useEffect(() => {
    const cached = getCachedAsset(src);
    if (cached && cached.loaded) {
      setImageElement(cached.element as HTMLImageElement);
      setIsLoaded(true);
      setIsLoading(false);
      onLoad?.();
      return;
    }

    // Start loading if not cached
    loadImage();

    return () => {
      mountedRef.current = false;
    };
  }, [src]);

  // Preload effect
  useEffect(() => {
    if (preload && !isAssetCached(src)) {
      assetPreloader.preloadImage(src, { priority }).catch(() => {
        // Preload failed, but don't show error yet
      });
    }
  }, [src, preload, priority]);

  const loadImage = async () => {
    if (!mountedRef.current) return;

    setIsLoading(true);
    setHasError(false);

    try {
      const img = await assetPreloader.preloadImage(currentSrc, { priority, timeout: 10000 });
      
      if (!mountedRef.current) return;

      setImageElement(img);
      setIsLoaded(true);
      setIsLoading(false);
      onLoad?.();
    } catch (error) {
      if (!mountedRef.current) return;

      console.warn(`Failed to load image: ${currentSrc}`, error);
      
      // Try fallback if available
      if (fallbackSrc && currentSrc !== fallbackSrc) {
        setCurrentSrc(fallbackSrc);
        try {
          const fallbackImg = await assetPreloader.preloadImage(fallbackSrc, { priority, timeout: 8000 });
          
          if (!mountedRef.current) return;

          setImageElement(fallbackImg);
          setIsLoaded(true);
          setIsLoading(false);
          onLoad?.();
        } catch (fallbackError) {
          if (!mountedRef.current) return;
          
          setIsLoading(false);
          setHasError(true);
          onError?.();
        }
      } else {
        setIsLoading(false);
        setHasError(true);
        onError?.();
      }
    }
  };

  const getLoaderSize = () => {
    switch (loaderSize) {
      case 'small': return 'w-8 h-8';
      case 'large': return 'w-16 h-16';
      default: return 'w-12 h-12';
    }
  };

  const renderLoader = () => (
    <div className="absolute inset-0 flex items-center justify-center bg-gray-800/50">
      <div className={`${getLoaderSize()} border-4 border-white/20 border-t-red-600 rounded-full animate-spin`} />
    </div>
  );

  const renderError = () => (
    <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
      <div className="text-white text-center">
        <div className="text-2xl mb-2">🖼️</div>
        <div className="text-xs text-gray-400">Image unavailable</div>
      </div>
    </div>
  );

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Actual image */}
      <AnimatePresence>
        {isLoaded && imageElement && (
          <motion.img
            ref={imgRef}
            src={imageElement.src}
            alt={alt}
            className="w-full h-full object-cover"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            draggable={false}
          />
        )}
      </AnimatePresence>

      {/* Loading state */}
      <AnimatePresence>
        {isLoading && showLoader && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {renderLoader()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error state */}
      <AnimatePresence>
        {hasError && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {renderError()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Placeholder for initial load */}
      {!isLoaded && !isLoading && !hasError && (
        <div className="absolute inset-0 bg-gray-800 animate-pulse" />
      )}
    </div>
  );
};

export default FastLoadingImage;
