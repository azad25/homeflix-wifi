"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Play, Info, Plus, Check, ChevronDown, Volume2, VolumeX, Clock, Star, ThumbsUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { Media } from '@/types/media';
import { getApiUrl } from '@/lib/api';
import { useAudio } from '@/contexts/EnhancedAudioContext';
import { cleanMovieTitle } from '@/lib/titleUtils';
import { useNavigate } from '@/hooks/useNavigate';
import ImageWithFallback from '@/components/ImageWithFallback';

interface EnhancedMovieCardProps {
  media: Media;
  onPlay: (media: Media) => void;
  onInfo: (media: Media) => void;
  priority?: boolean;
  delay?: number;
  variant?: 'portrait' | 'landscape';
  size?: 'small' | 'medium' | 'large';
}

const EnhancedMovieCard: React.FC<EnhancedMovieCardProps> = ({
  media,
  onPlay,
  onInfo,
  priority = false,
  delay = 0,
  variant = 'portrait',
  size = 'medium'
}) => {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { setCurrentAudioElement, muteAll } = useAudio();
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const apiUrl = getApiUrl();

  const getPreviewUrl = () => {
    return `${apiUrl}/api/preview-clips/${media.id}`;
  };

  const sizeClasses = {
    small: 'w-52 h-72 sm:w-56 sm:h-80',
    medium: 'w-56 h-80 sm:w-64 sm:h-96',
    large: 'w-64 h-96 sm:w-72 sm:h-[28rem]'
  };

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      window.removeEventListener('resize', checkMobile);
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
          muteAll();
          setCurrentAudioElement(video);

          video.muted = false;
          video.volume = 0.3;
          video.play().then(() => {
            setIsPlaying(true);
          }).catch(() => {
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
    setIsLoading(true);
    setTimeout(() => {
      if (media.type === 'episode' || media.type === 'tv' || media.type === 'series') {
        const seriesId = media.series_id || media.id;
        navigate.push(`/tv-series/${seriesId}`);
      } else {
        navigate.push(`/movie/${media.id}`);
      }
      setIsLoading(false);
    }, 300);
  };

  const handleInfoClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (media.type === 'episode' || media.type === 'tv' || media.type === 'series') {
      const seriesId = media.series_id || media.id;
      navigate.push(`/tv-series/${seriesId}`);
    } else {
      navigate.push(`/movie/${media.id}`);
    }
  };

  const handleCardClick = () => {
    if (media.type === 'episode' || media.type === 'tv' || media.type === 'series') {
      const seriesId = media.series_id || media.id;
      navigate.push(`/tv-series/${seriesId}`);
    } else {
      navigate.push(`/movie/${media.id}`);
    }
  };



  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const getQualityBadge = () => {
    const qualityText = media.quality ?
      (media.quality.includes('2160') || media.quality.toLowerCase().includes('4k') ? '4K' : 'HD')
      : "HD";
    return { text: qualityText, color: 'bg-blue-600' };
  };

  // Extract year from filename or title
  const getYear = () => {
    //try to extract year from object first
    if (media.year) {
      return media.year;
    } else if (media.release_date) {
      return new Date(media.release_date).getFullYear().toString();
    }

    // Try to extract year from filename first
    if (media.file_path) {
      const yearMatch = media.file_path.match(/\b(19|20)\d{2}\b/);
      if (yearMatch) return yearMatch[0];
    }

    // Try to extract year from title
    if (media.title) {
      const yearMatch = media.title.match(/\b(19|20)\d{2}\b/);
      if (yearMatch) return yearMatch[0];
    }

    // Fallback to release_date if available
    if (media.release_date) {
      return new Date(media.release_date).getFullYear().toString();
    }

    return null;
  };

  const getMatchPercentage = () => {
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
      style={{ zIndex: isHovered ? 100 : 1 }}
    >
      {/* Base Card */}
      <motion.div
        className={`relative ${sizeClasses[size]} bg-gray-900 rounded-xl overflow-hidden shadow-xl ${isHovered ? 'z-[100]' : 'z-[1]'}`}
        animate={{
          scale: isHovered ? (isMobile ? 1.1 : 1.2) : 1,
          y: isHovered ? (isMobile ? -10 : -20) : 0,
        }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        style={{
          transformOrigin: 'center center',
          zIndex: isHovered ? 100 : 1,
          position: 'relative'
        }}
      >
        {/* Main Image Container - Full Height */}
        <div className="relative h-full overflow-hidden">
          <ImageWithFallback
            mediaId={media.id}
            alt={cleanMovieTitle(media.title)}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
            className={`object-cover transition-opacity duration-300 ${showPreview && isVideoLoaded ? 'opacity-0' : 'opacity-100'
              }`}
            loading={priority ? "eager" : "lazy"}
            priority={priority}
            posterUrl={media.tmdb_poster_url || media.poster_url}
            mediaType={media.type}
          />

          {/* Preview Video */}
          {showPreview && (
            <video
              ref={videoRef}
              src={getPreviewUrl()}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${isVideoLoaded ? 'opacity-100' : 'opacity-0'
                }`}
              muted={isMuted}
              loop
              playsInline
              onLoadedData={() => setIsVideoLoaded(true)}
              onError={() => {
                setIsVideoLoaded(false);
                setIsPlaying(false);
              }}
            />
          )}

          {/* Quality Badge - Top Right */}
          <div className="absolute top-3 right-3 z-10">
            <span className="border border-white/50 text-white text-[10px] px-1.5 py-0.5 rounded font-medium backdrop-blur-sm shadow-lg">
              {getQualityBadge().text}
            </span>
          </div>

          {/* Gradient Overlay for Text */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

          {/* Play Button Overlay */}
          <AnimatePresence>
            {isHovered && !showPreview && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute inset-0 flex items-center justify-center z-20 bg-black/30"
              >
                <button
                  onClick={handlePlayClick}
                  disabled={isLoading}
                  className="bg-white/90 backdrop-blur-sm rounded-full p-4 hover:bg-white transition-all duration-200 cursor-pointer shadow-xl"
                >
                  {isLoading ? (
                    <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Play className="w-6 h-6 text-black fill-black" />
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
              className="absolute top-3 left-3 bg-black/70 text-white p-2 rounded-full hover:bg-black/90 transition-colors cursor-pointer z-20 shadow-lg"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          )}

          {/* Content Overlay - Bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
            {/* Title */}
            <h3 className="text-white font-bold text-sm sm:text-base line-clamp-2 mb-2 drop-shadow-lg">
              {cleanMovieTitle(media.title)}
            </h3>

            {/* Year and Rating Row */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-300 text-sm font-medium drop-shadow">
                {getYear()}
              </span>
              {media.rating && (
                <div className="flex items-center gap-1 bg-black/50 px-2 py-1 rounded-md">
                  <Star className="w-3 h-3 text-yellow-400 fill-current" />
                  <span className="text-white text-sm font-medium">{media.rating.toFixed(1)}</span>
                </div>
              )}
            </div>

            {/* Genres Row */}
            {media.genres && media.genres.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {media.genres.slice(0, isMobile ? 2 : 3).map((genre, index) => (
                  <span
                    key={genre.id || index}
                    className="text-xs text-white bg-red-600/80 px-2 py-1 rounded-md font-medium backdrop-blur-sm"
                  >
                    {genre.name}
                  </span>
                ))}
              </div>
            )}

            {/* Description - Only show on hover */}
            <AnimatePresence>
              {isHovered && media.description && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="mt-3 pt-3 border-t border-white/20"
                >
                  <p className="text-gray-300 text-xs leading-relaxed line-clamp-3 drop-shadow">
                    {media.description}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>


    </motion.div>
  );
};

export default EnhancedMovieCard;