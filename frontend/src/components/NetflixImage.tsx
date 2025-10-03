/**
 * Netflix-style optimized image component with progressive loading,
 * error boundaries, and lazy loading support
 */

import React, { useState, useRef, useEffect } from 'react';
import { useNetflixAssetLoader } from '@/lib/netflixAssetLoader';

interface NetflixImageProps {
  src: string;
  alt: string;
  className?: string;
  priority?: 'high' | 'medium' | 'low';
  progressive?: boolean;
  preload?: boolean;
  quality?: 'low' | 'medium' | 'high' | 'auto';
  onLoad?: () => void;
  onError?: (error: Error) => void;
  placeholder?: React.ReactNode;
  fallbackSrc?: string;
  loading?: 'eager' | 'lazy';
  width?: number | string;
  height?: number | string;
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  fetchPriority?: 'high' | 'low' | 'auto';
  sizes?: string;
  style?: React.CSSProperties;
}

// Skeleton placeholder component
const ImagePlaceholder = ({ width, height, className = '' }: { width?: number | string; height?: number | string; className?: string }) => (
  <div 
    className={`bg-gray-800 animate-pulse ${className}`}
    style={{
      width: width || '100%',
      height: height || '100%',
      minHeight: height || '200px',
      minWidth: width || '100%',
    }}
  />
);

export const NetflixImage: React.FC<NetflixImageProps> = ({
  src,
  alt,
  className = '',
  priority = 'medium',
  progressive = true,
  preload = false,
  quality = 'auto',
  onLoad,
  onError,
  placeholder,
  fallbackSrc = '/images/placeholder.jpg',
  loading = 'lazy',
  width,
  height,
  objectFit = 'cover',
  fetchPriority = 'auto',
  sizes = '100vw',
  style = {},
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState<string>('');
  const [displaySrc, setDisplaySrc] = useState<string>('');
  const containerRef = useRef<HTMLDivElement>(null);
  const { loadImage, loadImageProgressive } = useNetflixAssetLoader();
  const [isInView, setIsInView] = useState(loading === 'eager');
  const observerRef = useRef<IntersectionObserver | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const setImageSrc = (src: string) => {
    setCurrentSrc(src);
    setDisplaySrc(src);
  };

  // Set up intersection observer for lazy loading
  useEffect(() => {
    if (loading !== 'lazy' || !imgRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.unobserve(entry.target);
        }
      },
      {
        root: null,
        rootMargin: '200px',
        threshold: 0.01,
      }
    );

    observer.observe(imgRef.current);
    observerRef.current = observer;

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loading]);

  // Load image when in view or if loading is eager
  useEffect(() => {
    if ((!isInView && loading === 'lazy') || !src) return;

    let isMounted = true;
    const loadImageAsset = async () => {
      try {
        if (isMounted) {
          setIsLoading(true);
          setHasError(false);
        }

        if (progressive && containerRef.current) {
          // Use progressive loading for Netflix-style experience
          await loadImageProgressive(containerRef.current, src, {
            priority,
            preload,
            quality,
            cache: true
          });
          if (isMounted) {
            setIsLoading(false);
            onLoad?.();
          }
        } else {
          // Standard optimized loading
          const loadedSrc = await loadImage(src, {
            priority,
            preload,
            quality,
            cache: true
          });
          if (isMounted) {
            setImageSrc(loadedSrc);
            setIsLoading(false);
            onLoad?.();
          }
        }
      } catch (error) {
        console.error('NetflixImage loading failed:', error);
        if (isMounted) {
          // Try fallback source if available
          if (fallbackSrc && fallbackSrc !== src) {
            try {
              const fallbackLoadedSrc = await loadImage(fallbackSrc, {
                priority: 'low',
                cache: true
              });
              if (isMounted) {
                setImageSrc(fallbackLoadedSrc);
                setIsLoading(false);
                onLoad?.();
                return;
              }
            } catch (fallbackError) {
              console.error('Fallback image also failed:', fallbackError);
            }
          }
          setHasError(true);
          setIsLoading(false);
          onError?.(error as Error);
        }
      }
    };

    loadImageAsset();
    
    return () => {
      isMounted = false;
    };
  }, [src, priority, progressive, preload, quality, onLoad, onError, loadImage, loadImageProgressive, isInView, loading, fallbackSrc]);

  if (progressive) {
    return (
      <div 
        ref={containerRef}
        className={`relative overflow-hidden ${className}`}
        role="img"
        aria-label={alt}
      >
        {isLoading && (
          <div className="absolute inset-0 bg-gray-800 animate-pulse flex items-center justify-center">
            {placeholder || (
              <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
            )}
          </div>
        )}
        {hasError && (
          <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
            <div className="text-gray-400 text-center">
              <svg className="w-12 h-12 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
              </svg>
              <p className="text-sm">Failed to load</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`} style={style}>
      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 bg-gray-800 animate-pulse flex items-center justify-center">
          {placeholder || (
            <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
          )}
        </div>
      )}
      
      {/* Actual image */}
      {!progressive && displaySrc && !hasError && (
        <img
          ref={imgRef}
          src={displaySrc}
          alt={alt}
          className="w-full h-full object-cover"
          style={{
            objectFit,
            width: width || '100%',
            height: height || '100%',
          }}
          loading={loading}
          decoding="async"
          sizes={sizes}
          onLoad={() => {
            setIsLoading(false);
            onLoad?.();
          }}
          onError={() => {
            setHasError(true);
            setIsLoading(false);
          }}
        />
      )}
      
      {/* Error state */}
      {hasError && !displaySrc && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-gray-800 text-gray-500"
          style={{
            minHeight: height || '200px',
            minWidth: width || '100%',
          }}
        >
          <div className="text-center">
            <svg className="w-12 h-12 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
            </svg>
            <span className="text-sm">Could not load image</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default NetflixImage;
