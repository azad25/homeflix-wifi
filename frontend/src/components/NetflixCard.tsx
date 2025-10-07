"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Play, Plus, ThumbsUp, ChevronDown, Volume2, VolumeX, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import LazyImage from './LazyImage';
import LazyVideo from './LazyVideo';
import { Media } from '../types/media';
import { getApiUrl } from '../lib/api';
import { addToWishlist, removeFromWishlist, isInWishlist } from '../lib/wishlist';

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
  const [isLoading, setIsLoading] = useState(false);
  const [inWishlist, setInWishlist] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const apiUrl = getApiUrl();

  const getThumbnailUrl = () => {
    // Always try thumbnails first for better compatibility
    return `${apiUrl}/api/thumbnails/${media.id}`;
  };

  const getPosterUrl = () => {
    // Separate poster URL for fallback
    return `${apiUrl}/api/posters/${media.id}`;
  };

  const getPreviewUrl = () => {
    if (media.preview_clip_path) {
      return `${apiUrl}/api/admin/assets/${media.preview_clip_path.split('/').pop()}`;
    }
    if (media.trailer_path) {
      return `${apiUrl}/api/admin/assets/${media.trailer_path.split('/').pop()}`;
    }
    return `${apiUrl}/api/preview-clips/${media.id}`;
  };

  useEffect(() => {
    // Check if media is in wishlist
    setInWishlist(isInWishlist(media.id));

    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, [media.id]);

  const handleMouseEnter = () => {
    setIsHovered(true);

    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }

    // Netflix-like delay before showing preview (800ms for faster response)
    hoverTimeoutRef.current = setTimeout(() => {
      setShowPreview(true);

      // Start video preview immediately when showPreview is true
      if (videoRef.current) {
        const video = videoRef.current;
        video.currentTime = 0;
        video.muted = isMuted;
        video.play().then(() => {
          setIsPlaying(true);
          setIsVideoLoaded(true);
        }).catch((error) => {
          console.log('Video autoplay failed:', error);
          // Try muted fallback
          video.muted = true;
          video.play().then(() => {
            setIsPlaying(true);
            setIsVideoLoaded(true);
          }).catch(() => {
            setIsVideoLoaded(false);
            setShowPreview(false);
          });
        });
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
      }
    }, 300);
  };

  const handleVideoLoad = () => {
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
  };

  const handleVideoError = () => {
    console.log('Video error occurred for media:', media.id);
    setIsVideoLoaded(false);
    setShowPreview(false);
    setIsPlaying(false);
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

  const handleWishlistToggle = (e: React.MouseEvent) => {
    e.stopPropagation();

    let success = false;
    if (inWishlist) {
      success = removeFromWishlist(media.id);
    } else {
      success = addToWishlist(media.id);
    }

    if (success) {
      setInWishlist(!inWishlist);
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  // Check if media has priority genres (sci-fi, action, drama, thriller)
  const hasPriorityGenres = (media: Media) => {
    const priorityGenres = ['sci-fi', 'science fiction', 'action', 'drama', 'thriller', 'adventure', 'mystery', 'crime'];
    return media.genres?.some(genre =>
      priorityGenres.some(priority =>
        genre.name.toLowerCase().includes(priority.toLowerCase())
      )
    );
  };

  // Check if media is newly added (high ID suggests recent addition)
  const isNewlyAdded = (media: Media) => {
    // Simple heuristic: if ID is in top 30% of typical range, consider it new
    // This can be adjusted based on your media ID patterns
    return media.id > 1000; // Adjust this threshold as needed
  };

  return (
    <motion.div
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
        {/* Thumbnail Image with Lazy Loading and Fallback */}
        {!imageError ? (
          <LazyImage
            src={media.poster_path ? getPosterUrl() : getThumbnailUrl()}
            alt={media.title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className={`transition-opacity duration-300 ${showPreview && isVideoLoaded ? 'opacity-0' : 'opacity-100'
              }`}
            priority={priority}
            onError={() => {
              // Try thumbnail fallback if poster fails
              if (media.poster_path) {
                const img = document.querySelector(`img[alt="${media.title}"]`) as HTMLImageElement;
                if (img) {
                  img.src = getThumbnailUrl();
                  return;
                }
              }
              handleImageError();
            }}
            loaderSize="medium"
            showLoader={true}
            fallbackSrc={getThumbnailUrl()}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900 flex items-center justify-center">
            <div className="text-white text-center">
              <div className="text-3xl mb-2">🎬</div>
              <div className="text-sm font-medium line-clamp-2 px-2">{media.title}</div>
              <div className="text-xs text-gray-400 mt-1">No Image Available</div>
            </div>
          </div>
        )}

        {/* Preview Video with Lazy Loading */}
        {showPreview && (
          <video
            ref={videoRef}
            src={getPreviewUrl()}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${isVideoLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            muted={isMuted}
            loop
            playsInline
            preload="metadata"
            onLoadedData={handleVideoLoad}
            onError={handleVideoError}
            onCanPlay={handleVideoLoad}
            crossOrigin="anonymous"
          />
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Priority Genre Badge */}
        {hasPriorityGenres(media) && (
          <div className="absolute top-2 left-2 bg-red-600 text-white text-xs px-2 py-1 rounded-md font-semibold">
            FEATURED
          </div>
        )}

        {/* New Content Badge */}
        {isNewlyAdded(media) && (
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
              {isNewlyAdded(media) && (
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
