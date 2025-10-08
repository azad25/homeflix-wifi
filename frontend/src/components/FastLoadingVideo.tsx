"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { assetPreloader, getCachedAsset, isAssetCached } from '@/lib/assetPreloader';

interface FastLoadingVideoProps {
  src: string;
  className?: string;
  priority?: 'high' | 'medium' | 'low';
  showLoader?: boolean;
  loaderSize?: 'small' | 'medium' | 'large';
  onLoad?: () => void;
  onError?: () => void;
  preload?: boolean;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  playsInline?: boolean;
  poster?: string;
}

const FastLoadingVideo: React.FC<FastLoadingVideoProps> = ({
  src,
  className = '',
  priority = 'medium',
  showLoader = true,
  loaderSize = 'medium',
  onLoad,
  onError,
  preload = false,
  autoPlay = true,
  muted = true,
  loop = true,
  playsInline = true,
  poster
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mountedRef = useRef(true);

  // Check if video is already cached
  useEffect(() => {
    const cached = getCachedAsset(src);
    if (cached && cached.loaded && cached.type === 'video') {
      const cachedVideo = cached.element as HTMLVideoElement;
      setVideoElement(cachedVideo);
      setIsLoaded(true);
      setIsLoading(false);
      onLoad?.();
      
      // Try to play if autoPlay is enabled
      if (autoPlay) {
        playVideo(cachedVideo);
      }
      return;
    }

    // Start loading if not cached
    loadVideo();

    return () => {
      mountedRef.current = false;
    };
  }, [src]);

  // Preload effect
  useEffect(() => {
    if (preload && !isAssetCached(src)) {
      assetPreloader.preloadVideo(src, { priority }).catch(() => {
        // Preload failed, but don't show error yet
      });
    }
  }, [src, preload, priority]);

  const loadVideo = async () => {
    if (!mountedRef.current) return;

    setIsLoading(true);
    setHasError(false);
    setLoadProgress(0);

    try {
      const video = await assetPreloader.preloadVideo(src, { priority, timeout: 15000 });
      
      if (!mountedRef.current) return;

      // Configure video element
      video.muted = muted;
      video.loop = loop;
      video.playsInline = playsInline;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      
      if (poster) {
        video.poster = poster;
      }

      // Add progress tracking
      video.addEventListener('progress', () => {
        if (video.buffered.length > 0) {
          const bufferedEnd = video.buffered.end(video.buffered.length - 1);
          const duration = video.duration || 1;
          const progress = (bufferedEnd / duration) * 100;
          setLoadProgress(Math.min(progress, 100));
        }
      });

      setVideoElement(video);
      setIsLoaded(true);
      setIsLoading(false);
      setLoadProgress(100);
      onLoad?.();

      // Try to play if autoPlay is enabled
      if (autoPlay) {
        playVideo(video);
      }
    } catch (error) {
      if (!mountedRef.current) return;

      console.warn(`Failed to load video: ${src}`, error);
      setIsLoading(false);
      setHasError(true);
      onError?.();
    }
  };

  const playVideo = async (video: HTMLVideoElement) => {
    try {
      await video.play();
      setIsPlaying(true);
    } catch (error) {
      console.warn('Video autoplay failed:', error);
      // Try muted fallback
      video.muted = true;
      try {
        await video.play();
        setIsPlaying(true);
      } catch (mutedError) {
        console.warn('Muted video play also failed:', mutedError);
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
    <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
      <div className="text-white text-center">
        <div className={`${getLoaderSize()} border-4 border-white/20 border-t-red-600 rounded-full animate-spin mb-4 mx-auto`} />
        <div className="text-sm mb-2">Loading video...</div>
        <div className="w-32 h-2 bg-white/20 rounded-full overflow-hidden mx-auto">
          <motion.div
            className="h-full bg-red-600 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${loadProgress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <div className="text-xs mt-1 text-white/70">{Math.round(loadProgress)}%</div>
      </div>
    </div>
  );

  const renderError = () => (
    <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
      <div className="text-white text-center">
        <div className="text-4xl mb-2">🎬</div>
        <div className="text-sm mb-1">Video unavailable</div>
        <div className="text-xs text-gray-400">Preview not available</div>
      </div>
    </div>
  );

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Actual video */}
      <AnimatePresence>
        {isLoaded && videoElement && (
          <motion.video
            ref={videoRef}
            className="w-full h-full object-cover"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            muted={videoElement.muted}
            loop={videoElement.loop}
            playsInline={videoElement.playsInline}
            autoPlay={false} // We handle play manually
            onLoadedData={() => {
              if (autoPlay && videoElement) {
                playVideo(videoElement);
              }
            }}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onError={() => {
              setHasError(true);
              onError?.();
            }}
          >
            <source src={videoElement.src} type="video/mp4" />
          </motion.video>
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
        <div className="absolute inset-0 bg-gray-900 animate-pulse flex items-center justify-center">
          <div className="text-white/50 text-center">
            <div className="text-3xl mb-2">🎬</div>
            <div className="text-sm">Preparing video...</div>
          </div>
        </div>
      )}

      {/* Play indicator */}
      {isLoaded && !isPlaying && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <div className="bg-white/20 backdrop-blur-sm rounded-full p-4">
            <svg className="w-8 h-8 text-white fill-white" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
        </div>
      )}
    </div>
  );
};

export default FastLoadingVideo;
