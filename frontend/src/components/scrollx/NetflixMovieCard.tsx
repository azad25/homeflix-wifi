"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Play, Plus, Clock, VolumeX, Volume2, Star, ThumbsUp, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { Media } from '@/types/media';
import { getApiUrl } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useAudio } from '@/contexts/EnhancedAudioContext';
import { cleanMovieTitle, extractNiceTitle } from '@/lib/titleUtils';
import { TextureEffects } from '../TextureEffects';

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
  priority = false,
  delay = 0,
  variant = 'portrait',
  size = 'medium'
}) => {
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [, setShowControls] = useState(false);
  const [, setIsPlayButtonLoading] = useState(false);
  const [, setIsInfoButtonLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [fallbackError, setFallbackError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { setCurrentAudioElement, muteAll } = useAudio();
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const apiUrl = getApiUrl();
  
  const getThumbnailUrl = () => {
    // Try poster first for portrait variant, fallback to thumbnail
    if (variant === 'portrait') {
      return `${apiUrl}/api/posters/${media.uuid}`;
    }
    return `${apiUrl}/api/thumbnails/${media.uuid}`;
  };

  const getFallbackThumbnailUrl = () => {
    // If poster fails, try thumbnail, and vice versa
    if (variant === 'portrait') {
      return `${apiUrl}/api/thumbnails/${media.uuid}`;
    }
    return `${apiUrl}/api/posters/${media.uuid}`;
  };

  const getPreviewUrl = () => {
    // First try to get the actual media file for full experience
    if (media.file_path) {
      return `${apiUrl}/api/stream/${media.uuid}`;
    }
    // Fallback to trailer if available
    if (media.trailer_path) {
      return `${apiUrl}/api/admin/assets/${media.trailer_path.split('/').pop()}`;
    }
    // Final fallback to preview clips
    return `${apiUrl}/api/preview-clips/${media.uuid}`;
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
      
      // Start video preview
      if (videoRef.current && isHovered) {
        const video = videoRef.current;
        
        const handleLoadedData = () => {
          setIsVideoLoaded(true);
          // Register as current audio source and mute others
          muteAll();
          setCurrentAudioElement(video);
          
          // Try to play with sound first
          video.muted = false;
          video.volume = 0.3;
          video.play().then(() => {
            setIsPlaying(true);
          }).catch(() => {
            // Fallback to muted if autoplay with sound fails
            video.muted = true;
            video.play().then(() => {
              setIsPlaying(true);
            }).catch(() => {
              setIsVideoLoaded(false);
              setIsPlaying(false);
            });
          });
        };

        const handleVideoError = () => {
          setIsVideoLoaded(false);
          setIsPlaying(false);
        };

        video.addEventListener('loadeddata', handleLoadedData);
        video.addEventListener('error', handleVideoError);
        video.load();
      }
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
        setCurrentAudioElement(null);
      }
    }, 300);
  };

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPlayButtonLoading(true);
    setTimeout(() => {
      onPlay(media);
      setIsPlayButtonLoading(false);
    }, 300);
  };

  const handleInfoClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/movie/${media.uuid}`);
  };

  const handleCardClick = () => {
    router.push(`/movie/${media.uuid}`);
  };

  const handleImageError = () => {
    if (!imageError) {
      setImageError(true);
    } else if (!fallbackError) {
      setFallbackError(true);
    }
  };

  const handleVideoLoad = () => {
    setIsVideoLoaded(true);
  };

  const handleVideoError = () => {
    setIsVideoLoaded(false);
    setIsPlaying(false);
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
      onClick={handleCardClick}
    >
      {/* Base Card */}
      <motion.div
        className={`relative ${sizeClasses[size]} bg-gray-900 rounded-lg overflow-hidden shadow-lg`}
        animate={{ 
          scale: isHovered ? 1.3 : 1,
          zIndex: isHovered ? 50 : 1,
          y: isHovered ? -20 : 0,
        }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        style={{
          transformOrigin: 'center center',
        }}
      >
        {/* Thumbnail Image */}
        {!fallbackError ? (
          <Image
            src={imageError ? getFallbackThumbnailUrl() : getThumbnailUrl()}
            alt={extractNiceTitle(media.title)}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
            className={`object-cover transition-opacity duration-300 ${
              showPreview && isVideoLoaded ? 'opacity-0' : 'opacity-100'
            }`}
            loading={priority ? "eager" : "lazy"}
            onError={handleImageError}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-black/80 via-gray-900/60 to-black/80 flex items-center justify-center">
            <div className="text-center p-2">
              <div className="text-2xl mb-2">🎬</div>
              <TextureEffects 
                genre={media.genres?.[0]?.name || 'drama'} 
                effectType="both"
                className="text-xs font-medium line-clamp-2"
              >
                {extractNiceTitle(media.title)}
              </TextureEffects>
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

        {/* Title Overlay (bottom) - Enhanced with Texture Effects */}
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/95 via-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <TextureEffects 
            genre={media.genres?.[0]?.name || 'drama'} 
            effectType="both"
            className="font-bold text-sm line-clamp-2 mb-1 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]"
          >
            {extractNiceTitle(media.title)}
          </TextureEffects>
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

      {/* Expanded Info Panel (Netflix-style) */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.8 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="absolute top-full left-0 right-0 bg-black/90 backdrop-blur-xl rounded-b-xl shadow-2xl p-6 z-40 border border-red-900/30"
            style={{ marginTop: '8px', minWidth: '320px' }}
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
