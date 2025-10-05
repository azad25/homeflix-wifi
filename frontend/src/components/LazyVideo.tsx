"use client";

import React, { useState, useRef, useEffect, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import RedLoader from './RedLoader';

interface LazyVideoProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
  src: string;
  poster?: string;
  fallbackSrc?: string;
  loaderSize?: 'small' | 'medium' | 'large';
  showLoader?: boolean;
  priority?: boolean;
  onLoadStart?: () => void;
  onCanPlay?: () => void;
  onError?: () => void;
  className?: string;
}

const LazyVideo = forwardRef<HTMLVideoElement, LazyVideoProps>(({
  src,
  poster,
  fallbackSrc,
  loaderSize = 'medium',
  showLoader = true,
  priority = false,
  onLoadStart,
  onCanPlay,
  onError,
  className = '',
  ...props
}, ref) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const [canPlay, setCanPlay] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority || isInView) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '100px', // Start loading 100px before the video comes into view
        threshold: 0.1
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [priority, isInView]);

  const handleLoadStart = () => {
    setIsLoading(true);
    onLoadStart?.();
  };

  const handleCanPlay = () => {
    setIsLoading(false);
    setCanPlay(true);
    onCanPlay?.();
  };

  const handleError = () => {
    setHasError(true);
    setIsLoading(false);
    onError?.();
  };

  const videoSrc = hasError && fallbackSrc ? fallbackSrc : src;

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${className}`}>
      <AnimatePresence>
        {isLoading && showLoader && isInView && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-20"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <RedLoader size={loaderSize} showText text="Loading video..." />
          </motion.div>
        )}
      </AnimatePresence>

      {isInView && (
        <motion.div
          className="w-full h-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: canPlay ? 1 : 0.5 }}
          transition={{ duration: 0.5 }}
        >
          <video
            ref={ref}
            className="w-full h-full object-cover"
            onLoadStart={handleLoadStart}
            onCanPlay={handleCanPlay}
            onError={handleError}
            poster={poster}
            {...props}
          >
            <source src={videoSrc} type="video/mp4" />
            {fallbackSrc && hasError && (
              <source src={fallbackSrc} type="video/mp4" />
            )}
            Your browser does not support the video tag.
          </video>
        </motion.div>
      )}

      {/* Placeholder when not in view */}
      {!isInView && !priority && (
        <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
          <div className="w-16 h-16 bg-gray-700 rounded animate-pulse flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
});

LazyVideo.displayName = 'LazyVideo';

export default LazyVideo;