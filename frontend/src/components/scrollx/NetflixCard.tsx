"use client";

import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Media } from '../../types/media';
import LazyImage from '../LazyImage';
import { getApiUrl } from '../../lib/api';

interface NetflixCardProps {
  media: Media;
  index: number;
  onMediaClick: (media: Media) => void;
  showRankBadges?: boolean;
}

const NetflixCard: React.FC<NetflixCardProps> = ({
  media,
  index,
  onMediaClick,
  showRankBadges = false
}) => {
  const [imageError, setImageError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const getThumbnailUrl = () => {
    // Validate media ID before making API call
    if (!media?.id || typeof media.id !== 'number' || media.id <= 0) {
      console.warn('Invalid media ID for thumbnail:', media?.id);
      return null;
    }
    const apiUrl = getApiUrl();
    return `${apiUrl}/api/thumbnails/${media.id}`;
  };

  const getPreviewUrl = () => {
    // Validate media ID before making API call
    if (!media?.id || typeof media.id !== 'number' || media.id <= 0) {
      console.warn('Invalid media ID for preview:', media?.id);
      return null;
    }
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8252';
    return `${apiUrl}/api/preview-clips/${media.id}`;
  };

  // Handle mouse enter with delay for preview
  const handleMouseEnter = () => {
    setIsHovered(true);
    
    // Clear any existing timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    
    // Start preview after 1 second of hovering
    hoverTimeoutRef.current = setTimeout(() => {
      if (getPreviewUrl() && !previewError) {
        setShowPreview(true);
      }
    }, 1000);
  };

  // Handle mouse leave
  const handleMouseLeave = () => {
    setIsHovered(false);
    setShowPreview(false);
    
    // Clear timeout if user stops hovering before preview starts
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    
    // Stop and reset video
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Handle video events
  const handleVideoLoad = () => {
    if (videoRef.current && showPreview) {
      videoRef.current.play().catch(() => {
        console.log('Preview autoplay failed');
      });
    }
  };

  const handleVideoError = () => {
    setPreviewError(true);
    setShowPreview(false);
  };

  const handleClick = async () => {
    // Validate media before handling click
    if (!media?.id || typeof media.id !== 'number' || media.id <= 0) {
      console.warn('Invalid media for click handler:', media?.id);
      return;
    }
    setIsLoading(true);
    try {
      await onMediaClick(media);
    } finally {
      setTimeout(() => setIsLoading(false), 500);
    }
  };

  const getRating = () => {
    if (media.rating && media.rating > 0) {
      return `${media.rating.toFixed(1)}`;
    }
    return 'N/A';
  };

  const getYear = () => {
    if (media.release_date) {
      return new Date(media.release_date).getFullYear();
    }
    return '';
  };

  const getDuration = () => {
    if (media.duration && media.duration > 0) {
      const hours = Math.floor(media.duration / 60);
      const minutes = media.duration % 60;
      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      }
      return `${minutes}m`;
    }
    return '';
  };

  return (
    <motion.div
      className="relative group cursor-pointer flex-shrink-0 w-80"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      whileHover={{ 
        scale: 1.05,
        y: -8,
        zIndex: 10
      }}
      transition={{ 
        duration: 0.3, 
        ease: "easeOut",
        type: "spring",
        stiffness: 300,
        damping: 30
      }}
      style={{
        transformOrigin: 'center center'
      }}
    >
      {/* Main Card Container */}
      <div className="relative bg-zinc-900 rounded-lg overflow-hidden shadow-2xl border border-zinc-800">
        {/* Rank Badge */}
        {showRankBadges && index < 10 && (
          <div className="absolute top-3 left-3 z-20 bg-red-600 text-white text-sm font-bold px-3 py-1 rounded-full shadow-lg">
            #{index + 1}
          </div>
        )}

        {/* Thumbnail Image / Preview Video */}
        <div className="relative aspect-video overflow-hidden bg-zinc-800">
          {/* Preview Video - shown on hover */}
          {showPreview && getPreviewUrl() && !previewError && (
            <motion.video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover z-10"
              muted
              loop
              playsInline
              onLoadedData={handleVideoLoad}
              onError={handleVideoError}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <source src={getPreviewUrl() || ''} type="video/mp4" />
            </motion.video>
          )}
          
          {/* Thumbnail Image - default state */}
          {!imageError && getThumbnailUrl() ? (
            <motion.img
              src={getThumbnailUrl() || ''}
              alt={media.title}
              className={`w-full h-full object-cover transition-opacity duration-300 ${showPreview ? 'opacity-0' : 'opacity-100'}`}
              loading="lazy"
              onError={() => setImageError(true)}
              whileHover={{ scale: showPreview ? 1 : 1.1 }}
              transition={{ duration: 0.3 }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-zinc-800 via-zinc-900 to-black flex items-center justify-center">
              <div className="text-zinc-400 text-center">
                <div className="text-4xl mb-2">🎬</div>
                <div className="text-sm font-medium">{media.title}</div>
              </div>
            </div>
          )}
          
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          
          {/* Play Button Overlay - only show when not playing preview */}
          {!showPreview && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100"
              initial={{ opacity: 0, scale: 0.8 }}
              whileHover={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
            >
              <div className="bg-white/20 backdrop-blur-sm rounded-full p-4 border border-white/30">
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </div>
            </motion.div>
          )}
          
          {/* Preview Loading Indicator */}
          {isHovered && !showPreview && !previewError && getPreviewUrl() && (
            <motion.div
              className="absolute top-2 right-2 z-20"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
            >
              <div className="bg-black/50 backdrop-blur-sm rounded-full p-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Content Section */}
        <div className="p-4 space-y-3">
          {/* Title with DynamicTitle - smaller size for cards */}
          <div className="min-h-[3rem] flex items-start">
            <h1 className="text-md leading-tight max-w-full overflow-hidden text-ellipsis [&>h1]:text-sm [&>h1]:leading-tight [&>h1]:line-clamp-2 [&>h1]:max-h-8">
              {media.title}
            </h1>
          </div>

          {/* Metadata Row */}
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <div className="flex items-center space-x-2">
              {getYear() && (
                <span className="bg-zinc-800 px-2 py-1 rounded text-zinc-300">
                  {getYear()}
                </span>
              )}
              {media.type && (
                <span className="bg-zinc-800 px-2 py-1 rounded text-zinc-300 capitalize">
                  {media.type}
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {getDuration() && (
                <span className="text-zinc-400">{getDuration()}</span>
              )}
              <div className="flex items-center space-x-1">
                <svg className="w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="text-yellow-500 font-medium">{getRating()}</span>
              </div>
            </div>
          </div>

          {/* Genres */}
          {media.genres && media.genres.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {media.genres.slice(0, 3).map((genre, idx) => (
                <span
                  key={idx}
                  className="text-xs bg-red-600/20 text-red-400 px-2 py-1 rounded-full border border-red-600/30"
                >
                  {genre.name}
                </span>
              ))}
              {media.genres.length > 3 && (
                <span className="text-xs text-zinc-500">
                  +{media.genres.length - 3} more
                </span>
              )}
            </div>
          )}

          {/* Description Preview */}
          {media.description && (
            <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
              {media.description}
            </p>
          )}
        </div>

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-30">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
          </div>
        )}

        {/* Hover Glow Effect */}
        <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-red-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      </div>
    </motion.div>
  );
};

export default NetflixCard;
