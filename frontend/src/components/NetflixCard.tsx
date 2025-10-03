"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Plus, ThumbsUp, ChevronDown, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Media } from '../types/media';
import { getApiUrl } from '../lib/api';
import { NetflixImage, NetflixVideo } from '@/components';
import { useNetflixPreloader } from '@/hooks/useNetflixPreloader';
import ErrorBoundary from './ErrorBoundary';
import { Skeleton } from './ui/skeleton';

// Constants
const HOVER_DELAY = 1000; // 1 second delay before showing preview
const PRELOAD_DISTANCE = 2; // Number of items to preload around viewport
const VIDEO_LOAD_TIMEOUT = 5000; // 5 seconds timeout for video loading

interface NetflixCardProps {
  media: Media;
  onPlay: (media: Media) => void;
  onInfo: (media: Media) => void;
  priority?: boolean;
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
  lazyLoad?: boolean;
  preloadDistance?: number;
  intersectionThreshold?: number;
}

const NetflixCard: React.FC<NetflixCardProps> = ({ 
  media, 
  onPlay, 
  onInfo, 
  priority = false,
  delay = 0,
  lazyLoad = false,
  preloadDistance = 1,
  intersectionThreshold = 1.0,
  className,
  style
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCardLoading, setIsCardLoading] = useState(true);
  const [hasPreviewError, setHasPreviewError] = useState(false);
  const [isPreviewReady, setIsPreviewReady] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const apiUrl = getApiUrl();
  
  const getThumbnailUrl = () => {
    if (media.poster_path) {
      return `${apiUrl}/api/posters/${media.uuid}`;
    }
    return `${apiUrl}/api/thumbnails/${media.uuid}`;
  };

  const getPreviewUrl = () => {
    if (media.trailer_path) {
      return `${apiUrl}/api/admin/assets/${media.trailer_path.split('/').pop()}`;
    }
    return `${apiUrl}/api/preview-clips/${media.uuid}`;
  };
  
  // Netflix-style preloading for Netflix card assets
  const { observeElement } = useNetflixPreloader([
    {
      src: getThumbnailUrl(),
      type: 'image',
      priority: priority ? 'high' : 'medium'
    },
    {
      src: getPreviewUrl(),
      type: 'video',
      priority: 'low'
    }
  ], {
    enabled: true,
    maxConcurrent: 2,
    preloadDistance: preloadDistance
  });

  useEffect(() => {
    // Setup intersection observer for preloading
    const cardElement = cardRef.current;
    if (cardElement) {
      const observer = new IntersectionObserver((entries) => {
        const isInView = entries[0].isIntersecting;
        if (isInView) {
          observeElement(cardElement, intersectionThreshold);
        }
      }, {
        threshold: intersectionThreshold
      });
      observer.observe(cardElement);
      return () => observer.unobserve(cardElement);
    }
    
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, [media.uuid, observeElement, intersectionThreshold]);

  const handleMouseEnter = () => {
    setIsHovered(true);
    
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }

    // Netflix-like delay before showing preview (1 second)
    hoverTimeoutRef.current = setTimeout(() => {
      setShowPreview(true);
    }, 1000);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }

    hideTimeoutRef.current = setTimeout(() => {
      setShowPreview(false);
      setIsVideoLoaded(false);
      setIsPlaying(false);
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
    }, 300);
  };

  const handleVideoLoad = () => {
    setIsVideoLoaded(true);
    if (videoRef.current && showPreview) {
      videoRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(() => {
        setIsVideoLoaded(false);
      });
    }
  };

  const handleVideoError = () => {
    setIsVideoLoaded(false);
    setShowPreview(false);
    setHasPreviewError(true);
  };

  const handlePlayClick = () => {
    setIsLoading(true);
    setTimeout(() => {
      onPlay(media);
      setIsLoading(false);
    }, 500);
  };

  const handleImageError = () => {
    setImageError(true);
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const isInView = () => {
    if (!cardRef.current) return false;
    const rect = cardRef.current.getBoundingClientRect();
    return rect.top < globalThis.innerHeight && rect.bottom > 0;
  };

  if (!isInView() && lazyLoad) {
    return (
      <div 
        ref={cardRef}
        className="relative w-full h-full rounded overflow-hidden bg-gray-800/50"
        style={{
          aspectRatio: '2/3',
          ...style
        }}
      >
        <Skeleton className="w-full h-full" />
      </div>
    );
  }

  return (
    <ErrorBoundary
      fallback={
        <div className="relative w-full h-full rounded overflow-hidden bg-gray-800/50 flex items-center justify-center">
          <span className="text-sm text-gray-400">Error loading card</span>
        </div>
      }
    >
      <div 
        ref={cardRef}
        className={`relative w-full h-full rounded overflow-hidden transition-all duration-300 transform-gpu group ${className || ''}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        data-media-uuid={media.uuid}
        style={{
          aspectRatio: '2/3',
          ...style
        }}
      >
        {/* Thumbnail with loading state */}
        <div className="w-full h-full relative">
          {isCardLoading ? (
            <Skeleton className="w-full h-full" />
          ) : (
            <NetflixImage
              src={getThumbnailUrl()}
              alt={media.title || 'Media thumbnail'}
              className="w-full h-full object-cover"
              priority={priority ? 'high' : 'medium'}
              loading={lazyLoad ? 'lazy' : 'eager'}
              fallbackSrc="/images/placeholder-poster.jpg"
              onError={() => setImageError(true)}
              onLoad={() => setIsCardLoading(false)}
            />
          )}
          
          {/* Loading indicator */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
            </div>
          )}
        </div>

        {/* Preview Video with error handling */}
        <AnimatePresence>
          {isHovered && showPreview && isPreviewReady && !hasPreviewError && !imageError && (
            <motion.div 
              className="absolute inset-0 z-10"
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              transition={{ duration: 0.3 }}
            >
              <div className="relative w-full h-full">
                <NetflixVideo
                  src={getPreviewUrl()}
                  autoPlay
                  loop
                  muted={isMuted}
                  className="w-full h-full object-cover"
                  onLoad={handleVideoLoad}
                  onError={handleVideoError}
                  preload
                />
                
                {/* Video loading indicator */}
                {!isVideoLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
                  </div>
                )}
                
                {/* Mute toggle */}
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="absolute bottom-2 right-2 bg-black/70 rounded-full p-1.5 text-white z-20"
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions with loading state */}
        <AnimatePresence>
          {(isHovered || isCardLoading) && (
            <motion.div 
              className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/90 to-transparent z-20"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-center justify-between">
                <div className="flex space-x-2">
                  <button 
                    onClick={handlePlayClick}
                    className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Play"
                    disabled={isCardLoading}
                  >
                    {isCardLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play size={16} fill="currentColor" />
                    )}
                  </button>
                  <button 
                    className="w-8 h-8 rounded-full border border-gray-400 text-white flex items-center justify-center hover:border-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Add to list"
                    disabled={isCardLoading}
                  >
                    <Plus size={16} />
                  </button>
                  <button 
                    className="w-8 h-8 rounded-full border border-gray-400 text-white flex items-center justify-center hover:border-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Like"
                    disabled={isCardLoading}
                  >
                    <ThumbsUp size={16} />
                  </button>
                </div>
                <button 
                  onClick={() => onInfo(media)}
                  className="w-8 h-8 rounded-full border border-gray-400 text-white flex items-center justify-center hover:border-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="More info"
                  disabled={isCardLoading}
                >
                  <ChevronDown size={16} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Expanded Info Panel (Netflix-style) */}
        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="absolute top-full left-0 right-0 bg-gray-900 rounded-b-lg shadow-2xl p-4 z-30 border border-gray-700"
              style={{ marginTop: '4px' }}
            >
              {/* Title */}
              <h3 className="text-white font-bold text-lg mb-2 line-clamp-1">
                {media.title}
              </h3>
              
              {/* Metadata */}
              <div className="flex items-center gap-2 mb-3 text-sm">
                <span className="text-green-500 font-semibold">
                  {Math.round(((media.view_count || 0) / 1000) * 10) / 10}K views
                </span>
                <span className="text-gray-400">•</span>
                <span className="text-gray-400 capitalize">{media.type}</span>
                {media.duration && (
                  <>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-400">{formatDuration(media.duration)}</span>
                  </>
                )}
                {media.rating && (
                  <>
                    <span className="text-gray-400">•</span>
                    <span className="text-yellow-400">⭐ {media.rating}</span>
                  </>
                )}
                {media.genres && media.genres.length > 0 && (
                  <>
                    <span className="text-gray-400">•</span>
                    {media.genres.slice(0, 2).map((genre, index) => (
                      <span key={genre.id || index} className="text-gray-400">
                        {index > 0 && ', '}
                        {genre.name}
                      </span>
                    ))}
                  </>
                )}
              </div>

            {/* Description (if available) */}
            {media.description && (
              <p className="text-gray-400 text-sm mt-2 line-clamp-2">
                {media.description}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
};

export default NetflixCard;
