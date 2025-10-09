"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Play, Plus, ThumbsUp, ChevronDown, Check, VolumeX, Volume2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Media } from '@/types/media';
import { getApiUrl, getAssetUrl } from '@/lib/api';
import { videoPreloadPool, lazyLoadManager, assetUrlCache, loadingStateManager } from '@/lib/performanceOptimizer';
import UltraFastPreview from './UltraFastPreview';
import FastLoadingImage from './FastLoadingImage';
import FastLoadingVideo from './FastLoadingVideo';
import RedLoader from './RedLoader';

// Debounce utility for performance
const debounce = (func: Function, wait: number) => {
  let timeout: NodeJS.Timeout;
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

interface NetflixCardProps {
  media: Media;
  onPlay: (media: Media) => void;
  onInfo: (media: Media) => void;
  priority?: boolean;
  delay?: number;
}

const NetflixCard: React.FC<NetflixCardProps> = ({
  media,
  onPlay,
  onInfo,
  priority = false,
  delay = 0
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [inWishlist, setInWishlist] = useState(false);
  const [isIntersecting, setIsIntersecting] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const apiUrl = getApiUrl();

  // Memoized URL generators for better performance
  const thumbnailUrl = useMemo(() => {
    const urls = getAssetUrl('thumbnail', media.id, true);
    return Array.isArray(urls) ? urls[0] : urls;
  }, [media.id]);

  const posterUrl = useMemo(() => {
    const urls = getAssetUrl('poster', media.id, true);
    return Array.isArray(urls) ? urls[0] : urls;
  }, [media.id]);

  const previewUrl = useMemo(() => {
    return getAssetUrl('preview', media.id, false);
  }, [media.id]);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!cardRef.current) return;
    
    lazyLoadManager.observe(cardRef.current, () => {
      setIsIntersecting(true);
      // Video preloading can be added here if needed
    });

    return () => {
      if (cardRef.current) {
        lazyLoadManager.unobserve(cardRef.current);
      }
    };
  }, [previewUrl, priority]);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  // Debounced hover handler for better performance
  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }

    hoverTimeoutRef.current = setTimeout(() => {
      setShowPreview(true);
      if (previewUrl && videoRef.current) {
        videoRef.current.src = previewUrl as string;
        videoRef.current.load();
      }
    }, 800);
  }, [media.id, previewUrl]);

  const handleMouseLeave = useCallback(() => {
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
  }, []);

  const handleVideoLoad = useCallback(() => {
    setIsVideoLoaded(true);
    if (videoRef.current && showPreview && isHovered) {
      const video = videoRef.current;
      video.currentTime = 0;
      video.muted = isMuted;
      video.play().then(() => {
        setIsPlaying(true);
      }).catch((error) => {
        console.log('Video play failed on load:', error);
        // Try muted fallback
        video.muted = true;
        video.play().then(() => {
          setIsPlaying(true);
        }).catch(() => {
          setIsVideoLoaded(false);
          setShowPreview(false);
        });
      });
    }
  }, [showPreview, isHovered, isMuted]);

  const handleVideoError = useCallback(() => {
    console.log('Video error occurred for media:', media.id);
    setIsVideoLoaded(false);
    setShowPreview(false);
    setIsPlaying(false);
  }, [media.id]);

  const handlePlayClick = useCallback(() => {
    setIsLoading(true);
    setTimeout(() => {
      onPlay(media);
      setIsLoading(false);
    }, 500);
  }, [onPlay, media]);

  const handleImageError = useCallback(() => {
    setImageError(true);
  }, []);

  const handleWishlistToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // Simple toggle for now - can be enhanced with actual wishlist context later
    setInWishlist(!inWishlist);
  }, [inWishlist]);

  const formatDuration = useCallback((seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  }, []);

  // Memoized genre and content checks for performance
  const hasPriorityGenres = useMemo(() => {
    const priorityGenres = ['sci-fi', 'science fiction', 'action', 'drama', 'thriller', 'adventure', 'mystery', 'crime'];
    return media.genres?.some(genre =>
      priorityGenres.some(priority =>
        genre.name.toLowerCase().includes(priority.toLowerCase())
      )
    ) || false;
  }, [media.genres]);

  const isNewlyAdded = useMemo(() => {
    // Simple heuristic: if ID is in top 30% of typical range, consider it new
    return media.id > 1000; // Adjust this threshold as needed
  }, [media.id]);

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: delay / 1000 }}
      className={`relative group cursor-pointer ${isHovered ? 'z-50' : 'z-10'}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={() => onInfo(media)}
      style={{
        zIndex: isHovered ? 50 : 10,
      }}
    >
      {/* Base Card */}
      <motion.div
        className="relative w-full aspect-video bg-gray-900 rounded-lg overflow-hidden"
        animate={{
          scale: isHovered ? 1.3 : 1,
        }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        style={{
          transformOrigin: 'center center',
          zIndex: isHovered ? 50 : 1,
          position: isHovered ? 'relative' : 'relative',
        }}
      >
        {/* Ultra-Fast Thumbnail Image */}
        <FastLoadingImage
          src={media.poster_path ? posterUrl : thumbnailUrl}
          alt={media.title}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${showPreview && isVideoLoaded ? 'opacity-0' : 'opacity-100'}`}
          priority={priority ? 'high' : 'medium'}
          fallbackSrc={thumbnailUrl}
          showLoader={true}
          loaderSize="medium"
          preload={priority}
          onLoad={() => setImageLoaded(true)}
          onError={handleImageError}
        />

        {/* Preview Video */}
        {showPreview && (
          <video
            ref={videoRef}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
              isVideoLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            autoPlay
            muted={isMuted}
            loop
            playsInline
            onLoadedData={handleVideoLoad}
            onError={handleVideoError}
          />
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Priority Genre Badge */}
        {hasPriorityGenres && (
          <div className="absolute top-2 left-2 bg-red-600 text-white text-xs px-2 py-1 rounded-md font-semibold">
            FEATURED
          </div>
        )}

        {/* New Content Badge */}
        {isNewlyAdded && (
          <div className="absolute top-2 right-2 bg-green-600 text-white text-xs px-2 py-1 rounded-md font-semibold">
            NEW
          </div>
        )}

        {/* Quick Play Button (center) */}
        <AnimatePresence>
          {isHovered && !showPreview && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              {isLoading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <RedLoader size="small" />
                </div>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePlayClick();
                }}
                disabled={isLoading}
                className="bg-white/20 backdrop-blur-sm rounded-full p-4 hover:bg-white/30 transition-all duration-200 cursor-pointer"
              >
                {isLoading ? (
                  <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Play className="w-8 h-8 text-white fill-white" />
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Volume Control for Preview */}
        {showPreview && isPlaying && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsMuted(!isMuted);
              if (videoRef.current) {
                videoRef.current.muted = !isMuted;
              }
            }}
            className="absolute top-2 right-2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        )}
      </motion.div>

      {/* Expanded Info Panel (Netflix-style) */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute top-full left-0 right-0 bg-gray-900 rounded-b-lg shadow-2xl p-4 border border-gray-700"
            style={{ zIndex: 60, marginTop: '4px' }}
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
              {isNewlyAdded && (
                <>
                  <span className="text-gray-400">•</span>
                  <span className="text-green-400 font-semibold">NEW</span>
                </>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePlayClick();
                }}
                disabled={isLoading}
                className="bg-white text-black px-4 py-2 rounded-md font-bold hover:bg-gray-200 transition-colors duration-200 flex items-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Play className="w-4 h-4 fill-current" />
                )}
                Play
              </button>

              <button
                onClick={handleWishlistToggle}
                className={`p-2 rounded-full transition-colors duration-200 cursor-pointer ${inWishlist
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-700 text-white hover:bg-gray-600'
                  }`}
                title={inWishlist ? 'Remove from My List' : 'Add to My List'}
              >
                {inWishlist ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              </button>

              <button className="bg-gray-700 text-white p-2 rounded-full hover:bg-gray-600 transition-colors duration-200 cursor-pointer">
                <ThumbsUp className="w-4 h-4" />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onInfo(media);
                }}
                className="bg-gray-700 text-white p-2 rounded-full hover:bg-gray-600 transition-colors duration-200 ml-auto cursor-pointer"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            {/* Genres */}
            {media.genres && media.genres.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {media.genres.slice(0, 3).map((genre, index) => (
                  <span
                    key={genre.id || index}
                    className="text-xs text-gray-300 bg-gray-800 px-2 py-1 rounded"
                  >
                    {genre.name}
                  </span>
                ))}
              </div>
            )}

            {/* Description (if available) */}
            {media.description && (
              <p className="text-gray-400 text-sm mt-2 line-clamp-2">
                {media.description}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default NetflixCard;
