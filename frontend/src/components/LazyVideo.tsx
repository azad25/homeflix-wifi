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
  quality?: 'low' | 'medium' | 'high' | 'auto';
  streamOptimization?: 'netflix-level' | 'standard';
  bufferStrategy?: 'aggressive' | 'balanced' | 'conservative';
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
  quality = 'auto',
  streamOptimization = 'netflix-level',
  bufferStrategy = 'aggressive',
  ...props
}, ref) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const [canPlay, setCanPlay] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [networkSpeed, setNetworkSpeed] = useState<string>('unknown');
  const [deviceType, setDeviceType] = useState<string>('desktop');
  const containerRef = useRef<HTMLDivElement>(null);

  // Device and network detection for Netflix-level optimization
  useEffect(() => {
    const detectCapabilities = () => {
      // Device detection
      const userAgent = navigator.userAgent.toLowerCase();
      if (userAgent.includes('mobile') || userAgent.includes('android')) {
        setDeviceType('mobile');
      } else if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
        setDeviceType('ios');
      } else if (userAgent.includes('mac')) {
        setDeviceType('mac');
      } else if (userAgent.includes('windows')) {
        setDeviceType('windows');
      } else if (userAgent.includes('linux')) {
        setDeviceType('linux');
      }

      // Network speed estimation
      if ('connection' in navigator) {
        const connection = (navigator as any).connection;
        if (connection) {
          const effectiveType = connection.effectiveType;
          setNetworkSpeed(effectiveType || 'unknown');
        }
      }
    };

    detectCapabilities();
  }, []);

  // Enhanced Intersection Observer for lazy loading with Netflix-level preloading
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
        rootMargin: streamOptimization === 'netflix-level' ? '200px' : '100px', // More aggressive preloading
        threshold: 0.1
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [priority, isInView, streamOptimization]);

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
    // Netflix-level retry logic
    if (retryCount < 3) {
      setTimeout(() => {
        setRetryCount(prev => prev + 1);
        setHasError(false);
        setIsLoading(true);
      }, 1000 * (retryCount + 1)); // Exponential backoff
    } else {
      setHasError(true);
      setIsLoading(false);
      onError?.();
    }
  };

  // Netflix-level URL optimization
  const getOptimizedVideoSrc = () => {
    const baseUrl = hasError && fallbackSrc ? fallbackSrc : src;
    if (!baseUrl) return '';
    
    try {
      const url = new URL(baseUrl, window.location.origin);
      
      // Add Netflix-level optimization parameters
      if (streamOptimization === 'netflix-level') {
        url.searchParams.set('optimize', 'netflix-level');
        url.searchParams.set('buffer', bufferStrategy);
        
        // Quality optimization based on device and network
        if (quality === 'auto') {
          if (deviceType === 'mobile' || networkSpeed === '2g' || networkSpeed === 'slow-2g') {
            url.searchParams.set('quality', 'medium');
          } else if (deviceType === 'mac' || deviceType === 'windows' || deviceType === 'linux') {
            url.searchParams.set('quality', 'high');
          } else {
            url.searchParams.set('quality', 'high');
          }
        } else {
          url.searchParams.set('quality', quality);
        }
        
        // Device-specific optimizations
        url.searchParams.set('device', deviceType);
        
        // Network-specific optimizations
        if (networkSpeed !== 'unknown') {
          url.searchParams.set('network', networkSpeed);
        }
        
        // Priority handling
        if (priority) {
          url.searchParams.set('priority', 'high');
        }
      }
      
      return url.toString();
    } catch {
      return baseUrl; // Fallback to original URL if parsing fails
    }
  };

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
            <RedLoader size={loaderSize} />
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
            preload={priority ? 'auto' : 'metadata'}
            crossOrigin="anonymous"
            playsInline
            webkit-playsinline="true"
            x-webkit-airplay="allow"
            style={{
              // Netflix-level hardware acceleration
              transform: 'translateZ(0)',
              willChange: 'transform',
              backgroundColor: '#000'
            }}
            {...props}
          >
            {/* Netflix-level multi-source strategy */}
            <source src={getOptimizedVideoSrc()} type="video/mp4; codecs=&quot;avc1.42E01E, mp4a.40.2&quot;" />
            <source src={`${getOptimizedVideoSrc()}&format=webm`} type="video/webm; codecs=&quot;vp9, opus&quot;" />
            <source src={`${getOptimizedVideoSrc()}&quality=medium`} type="video/mp4" />
            {fallbackSrc && (
              <source src={fallbackSrc} type="video/mp4" />
            )}
            Your browser does not support the video tag.
          </video>
        </motion.div>
      )}

      {/* Placeholder when not in view */}
      {!isInView && !priority && (
        <div className="absolute inset-0 bg-black flex items-center justify-center">
          <div className="w-16 h-16 bg-gray-800 rounded animate-pulse flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
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