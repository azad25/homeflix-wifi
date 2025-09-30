"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Play, Plus, ThumbsUp, ChevronDown, Volume2, VolumeX, Star, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { Media } from '../../types/media';
import { getApiUrl } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';

interface NetflixMovieCardProps {
  media: Media;
  onPlay: (media: Media) => void;
  onInfo: (media: Media) => void;
  priority?: boolean;
  delay?: number;
  variant?: 'portrait' | 'landscape';
  size?: 'small' | 'medium' | 'large';
}

const NetflixMovieCard: React.FC<NetflixMovieCardProps> = ({ 
  media, 
  onPlay, 
  onInfo, 
  priority = false,
  delay = 0,
  variant = 'portrait',
  size = 'medium'
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [fallbackError, setFallbackError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const apiUrl = getApiUrl();
  
  const getThumbnailUrl = () => {
    // Try poster first for portrait variant, fallback to thumbnail
    if (variant === 'portrait') {
      return `${apiUrl}/api/posters/${media.id}`;
    }
    return `${apiUrl}/api/thumbnails/${media.id}`;
  };

  const getFallbackThumbnailUrl = () => {
    // If poster fails, try thumbnail, and vice versa
    if (variant === 'portrait') {
      return `${apiUrl}/api/thumbnails/${media.id}`;
    }
    return `${apiUrl}/api/posters/${media.id}`;
  };

  const getPreviewUrl = () => {
    if (media.trailer_path) {
      return `${apiUrl}/api/admin/assets/${media.trailer_path.split('/').pop()}`;
    }
    return `${apiUrl}/api/preview-clips/${media.id}`;
  };

  const sizeClasses = {
    small: variant === 'portrait' ? 'w-50 h-72' : 'w-70 h-40',
    medium: variant === 'portrait' ? 'w-60 h-80' : 'w-80 h-48',
    large: variant === 'portrait' ? 'w-70 h-96' : 'w-90 h-52'
  };

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  const handleMouseEnter = () => {
    setIsHovered(true);
    
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }

    // Netflix-like delay before showing preview
    hoverTimeoutRef.current = setTimeout(() => {
      setShowPreview(true);
    }, 800);
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
  };

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLoading(true);
    setTimeout(() => {
      onPlay(media);
      setIsLoading(false);
    }, 300);
  };

  const handleInfoClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onInfo(media);
  };

  const handleImageError = () => {
    if (!imageError) {
      setImageError(true);
    } else {
      setFallbackError(true);
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const getQualityBadge = () => {
    if (media.rating && media.rating >= 8.5) return { text: '4K', color: 'bg-green-600' };
    if (media.rating && media.rating >= 7.5) return { text: 'HD', color: 'bg-blue-600' };
    return { text: 'SD', color: 'bg-gray-600' };
  };

  const getMatchPercentage = () => {
    // Calculate match percentage based on rating and view count
    const rating = media.rating || 5;
    const viewCount = media.view_count || 0;
    const baseMatch = Math.min(95, Math.max(65, (rating / 10) * 100));
    const popularityBonus = Math.min(10, viewCount / 1000);
    return Math.round(baseMatch + popularityBonus);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: delay / 1000 }}
      className="relative group cursor-pointer"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Base Card */}
      <motion.div
        className={`relative ${sizeClasses[size]} bg-gray-900 rounded-lg overflow-hidden shadow-lg`}
        animate={{ 
          scale: isHovered ? 1.05 : 1,
          zIndex: isHovered ? 50 : 1,
        }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        style={{
          transformOrigin: 'center center',
        }}
      >
        {/* Thumbnail Image */}
        {!fallbackError ? (
          <Image
            src={imageError ? getFallbackThumbnailUrl() : getThumbnailUrl()}
            alt={media.title}
            fill
            className={`object-cover transition-opacity duration-300 ${
              showPreview && isVideoLoaded ? 'opacity-0' : 'opacity-100'
            }`}
            loading={priority ? "eager" : "lazy"}
            onError={handleImageError}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900 flex items-center justify-center">
            <div className="text-white text-center p-2">
              <div className="text-2xl mb-2">🎬</div>
              <div className="text-xs font-medium line-clamp-2">{media.title}</div>
            </div>
          </div>
        )}

        {/* Preview Video */}
        {showPreview && (
          <video
            ref={videoRef}
            src={getPreviewUrl()}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
              isVideoLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            muted={isMuted}
            loop
            playsInline
            onLoadedData={handleVideoLoad}
            onError={handleVideoError}
          />
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Quality Badge */}
        <div className="absolute top-2 left-2 z-10">
          <span className={`${getQualityBadge().color} text-white text-xs px-2 py-1 rounded font-bold`}>
            {getQualityBadge().text}
          </span>
        </div>

        {/* Duration Badge */}
        {media.duration && (
          <div className="absolute top-2 right-2 z-10">
            <span className="bg-black/70 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDuration(media.duration)}
            </span>
          </div>
        )}

        {/* Quick Play Button (center) */}
        <AnimatePresence>
          {isHovered && !showPreview && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute inset-0 flex items-center justify-center z-20"
            >
              <button
                onClick={handlePlayClick}
                disabled={isLoading}
                className="bg-white/20 backdrop-blur-sm rounded-full p-3 hover:bg-white/30 transition-all duration-200 cursor-pointer border border-white/30"
              >
                {isLoading ? (
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Play className="w-6 h-6 text-white fill-white" />
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
            className="absolute top-2 right-2 bg-black/50 text-white p-1.5 rounded-full hover:bg-black/70 transition-colors cursor-pointer z-20"
          >
            {isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
          </button>
        )}

        {/* Title Overlay (bottom) */}
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <h3 className="text-white font-bold text-sm line-clamp-2 mb-1">
            {media.title}
          </h3>
          <div className="flex items-center gap-2 text-xs text-gray-300">
            <span className="text-green-400 font-semibold">
              {getMatchPercentage()}% Match
            </span>
            {media.rating && (
              <>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-yellow-400 fill-current" />
                  <span>{media.rating}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </motion.div>

      {/* Expanded Info Panel (Netflix-style) - Only for larger sizes */}
      <AnimatePresence>
        {isHovered && size !== 'small' && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute top-full left-0 right-0 bg-gray-900/95 backdrop-blur-md rounded-b-lg shadow-2xl p-4 z-30 border border-gray-700/50"
            style={{ marginTop: '4px' }}
          >
            {/* Action Buttons */}
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={handlePlayClick}
                disabled={isLoading}
                className="bg-white text-black px-3 py-1.5 rounded-md font-bold hover:bg-gray-200 transition-colors duration-200 flex items-center gap-2 cursor-pointer text-sm"
              >
                {isLoading ? (
                  <div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Play className="w-3 h-3 fill-current" />
                )}
                Play
              </button>
              
              <button className="bg-gray-700 text-white p-1.5 rounded-full hover:bg-gray-600 transition-colors duration-200 cursor-pointer">
                <Plus className="w-3 h-3" />
              </button>
              
              <button className="bg-gray-700 text-white p-1.5 rounded-full hover:bg-gray-600 transition-colors duration-200 cursor-pointer">
                <ThumbsUp className="w-3 h-3" />
              </button>
              
              <button
                onClick={handleInfoClick}
                className="bg-gray-700 text-white p-1.5 rounded-full hover:bg-gray-600 transition-colors duration-200 ml-auto cursor-pointer"
              >
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>

            {/* Metadata */}
            <div className="flex items-center gap-2 mb-2 text-xs">
              <span className="text-green-500 font-semibold">
                {getMatchPercentage()}% Match
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
                  <span className="text-yellow-400 flex items-center gap-1">
                    <Star className="w-3 h-3 fill-current" />
                    {media.rating}
                  </span>
                </>
              )}
            </div>

            {/* Genres */}
            {media.genres && media.genres.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {media.genres.slice(0, 3).map((genre, index) => (
                  <span
                    key={genre.id || index}
                    className="text-xs text-gray-300 bg-gray-800/80 px-2 py-0.5 rounded"
                  >
                    {genre.name}
                  </span>
                ))}
              </div>
            )}

            {/* Description (if available) */}
            {media.description && size === 'large' && (
              <p className="text-gray-400 text-xs line-clamp-2">
                {media.description}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default NetflixMovieCard;
