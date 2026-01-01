"use client";

import React, { useState, useCallback, useRef, useEffect } from 'react';
import Image from 'next/image';
import { usePerformanceOptimization } from '@/hooks/usePerformanceOptimization';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  quality?: number;
  placeholder?: 'blur' | 'empty';
  blurDataURL?: string;
  sizes?: string;
  fill?: boolean;
  style?: React.CSSProperties;
  onLoad?: () => void;
  onError?: () => void;
  lazy?: boolean;
  fallbackSrc?: string;
}

const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  width,
  height,
  className = '',
  priority = false,
  quality = 75,
  placeholder = 'empty',
  blurDataURL,
  sizes,
  fill = false,
  style,
  onLoad,
  onError,
  lazy = true,
  fallbackSrc = '/placeholder-image.jpg'
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);
  const imgRef = useRef<HTMLDivElement>(null);
  const { createIntersectionObserver } = usePerformanceOptimization('OptimizedImage');

  // Handle image load
  const handleLoad = useCallback(() => {
    setIsLoaded(true);
    onLoad?.();
  }, [onLoad]);

  // Handle image error with fallback
  const handleError = useCallback(() => {
    if (!hasError && fallbackSrc && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
      setHasError(true);
    } else {
      setHasError(true);
      onError?.();
    }
  }, [hasError, fallbackSrc, currentSrc, onError]);

  // Lazy loading with Intersection Observer
  const [shouldLoad, setShouldLoad] = useState(!lazy || priority);

  useEffect(() => {
    if (!lazy || priority || shouldLoad) return;

    const observer = createIntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShouldLoad(true);
            observer?.disconnect();
          }
        });
      },
      { rootMargin: '50px' }
    );

    if (observer && imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer?.disconnect();
  }, [lazy, priority, shouldLoad, createIntersectionObserver]);

  // Generate optimized blur placeholder
  const generateBlurDataURL = useCallback((width: number, height: number) => {
    if (blurDataURL) return blurDataURL;
    
    // Generate a simple gradient blur placeholder
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, '#1f2937');
      gradient.addColorStop(1, '#374151');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }
    
    return canvas.toDataURL();
  }, [blurDataURL]);

  // Optimize image sizes based on viewport
  const optimizedSizes = sizes || (
    fill ? '100vw' : 
    width && width > 800 ? '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw' :
    '(max-width: 768px) 100vw, 50vw'
  );

  if (!shouldLoad) {
    return (
      <div
        ref={imgRef}
        className={`bg-gray-800 animate-pulse ${className}`}
        style={{
          width: fill ? '100%' : width,
          height: fill ? '100%' : height,
          ...style
        }}
      />
    );
  }

  if (hasError && currentSrc === fallbackSrc) {
    return (
      <div
        className={`bg-gray-800 flex items-center justify-center text-gray-400 text-sm ${className}`}
        style={{
          width: fill ? '100%' : width,
          height: fill ? '100%' : height,
          ...style
        }}
      >
        Image unavailable
      </div>
    );
  }

  const imageProps = {
    src: currentSrc,
    alt,
    className: `transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'} ${className}`,
    priority,
    quality,
    sizes: optimizedSizes,
    onLoad: handleLoad,
    onError: handleError,
    style,
    ...(placeholder === 'blur' && width && height ? {
      placeholder: 'blur' as const,
      blurDataURL: generateBlurDataURL(width, height)
    } : {}),
    ...(fill ? { fill: true } : { width, height })
  };

  return (
    <div ref={imgRef} className="relative">
      <Image {...imageProps} />
      {!isLoaded && (
        <div
          className={`absolute inset-0 bg-gray-800 animate-pulse ${className}`}
          style={style}
        />
      )}
    </div>
  );
};

export default OptimizedImage;