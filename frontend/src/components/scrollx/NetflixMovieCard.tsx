"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Play, Plus, Clock, VolumeX, Volume2, Star, ThumbsUp, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Media } from '@/types/media';
import { getApiUrl } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useEnhancedAudio } from '@/contexts/EnhancedAudioContext';
import { cleanMovieTitle, extractNiceTitle } from '@/lib/titleUtils';
import { TextureEffects } from '@/components/TextureEffects';
import { NetflixImage } from '@/components/NetflixImage';
import { MyListButton } from '@/components/MyListButton';
import { setupCrossBrowserVideo } from '@/lib/audio/crossBrowserAudio';
import { useNetflixPreloader } from '@/hooks/useNetflixPreloader';

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
  const {
    alacEngine,
    isALACEnabled,
    initializeEnhancedAudio,
    setCurrentAudioElement,
    muteAll
  } = useEnhancedAudio();
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const apiUrl = getApiUrl();
  
  const getThumbnailUrl = () => {
    if (!media.uuid) {
      console.warn('No UUID for media:', media.title);
      return '/images/placeholder.jpg';
    }
    
    // Try poster first for portrait variant, fallback to thumbnail
    if (variant === 'portrait') {
      return `${apiUrl}/api/posters/${media.uuid}`;
    }
    return `${apiUrl}/api/thumbnails/${media.uuid}`;
  };

  const getFallbackThumbnailUrl = () => {
    if (!media.uuid) {
      return '/images/placeholder.jpg';
    }
    
    // If poster fails, try thumbnail; if thumbnail fails, try poster
    if (variant === 'portrait') {
      return `${apiUrl}/api/thumbnails/${media.uuid}`;
    }
    return `${apiUrl}/api/posters/${media.uuid}`;
  };

  const getPreviewUrl = () => {
    if (!media.uuid) {
      console.warn('No UUID for preview:', media.title);
      return '';
    }
    return `${apiUrl}/api/preview-clips/${media.uuid}`;
  };
  
  // Netflix-style preloading for card assets
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
    preloadDistance: 1
  });

  const sizeClasses = {
    small: variant === 'portrait' ? 'w-50 h-72' : 'w-70 h-40',
    medium: variant === 'portrait' ? 'w-60 h-80' : 'w-80 h-48',
    large: variant === 'portrait' ? 'w-70 h-96' : 'w-90 h-52'
  };

  useEffect(() => {
    // Setup intersection observer for preloading
    const cardElement = document.querySelector(`[data-media-uuid="${media.uuid}"]`);
    if (cardElement) {
      observeElement(cardElement as HTMLElement, 0);
    }
    
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, [media.uuid, observeElement]);

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
    console.log('Image error for:', media.title, 'trying fallback');
    if (!imageError) {
      setImageError(true);
    } else if (!fallbackError) {
      setFallbackError(true);
      console.log('All image sources failed for:', media.title);
    }
  };

  const handleVideoLoad = async () => {
    console.log('Video loaded for card:', media.title);
    setIsVideoLoaded(true);
    
    // Setup cross-browser audio with ALAC support
    const video = videoRef.current;
    if (video) {
      try {
        const audioSuccess = await setupCrossBrowserVideo(video, media.uuid, {
          enableALAC: isALACEnabled,
          fallbackToAAC: true,
          spatialAudio: false, // Disable for card previews to avoid conflicts
          quality: 'lossless',
          maxRetries: 2,
          retryDelay: 500
        });
        
        if (audioSuccess) {
          setIsPlaying(true);
          setIsMuted(false);
          
          // Set as current audio element
          muteAll();
          setCurrentAudioElement(video);
          
          // Initialize enhanced audio if available
          if (isALACEnabled && alacEngine) {
            try {
              await initializeEnhancedAudio();
              console.log('🎵 Enhanced ALAC audio initialized for card preview');
            } catch (error) {
              console.log('Enhanced audio fallback for card preview');
            }
          }
          
          console.log('🎵 Cross-browser preview video playing for:', media.title);
        } else {
          // Fallback to basic playback
          muteAll();
          setCurrentAudioElement(video);
          video.muted = false;
          video.volume = 0.3;
          
          await video.play();
          setIsPlaying(true);
          setIsMuted(false);
          console.log('Preview video playing (fallback) for:', media.title);
        }
      } catch (error) {
        console.log('Preview video play failed for:', media.title, error);
        setIsVideoLoaded(false);
        setIsPlaying(false);
      }
    }
  };

  const handleVideoError = (error?: any) => {
    console.log('Video error for card:', media.title, error);
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
    // Simple algorithm based on rating and popularity
    const baseMatch = 75;
    const ratingBoost = media.rating ? Math.min(media.rating * 5, 20) : 0;
    return Math.min(baseMatch + ratingBoost, 99);
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
      data-media-uuid={media.uuid}
      style={{
        // Ensure hover cards can overflow their containers
        zIndex: isHovered ? 50 : 1,
      }}
    >
      {/* Base Card */}
      <motion.div
        className={`relative ${sizeClasses[size]} bg-gray-900 rounded-lg overflow-hidden shadow-2xl`}
        animate={{ 
          scale: isHovered ? 1.5 : 1,
          y: isHovered ? -30 : 0,
        }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        style={{
          transformOrigin: 'center center',
          zIndex: isHovered ? 50 : 1,
        }}
      >
        {/* Netflix-optimized Thumbnail Image */}
        <motion.div
          className="absolute inset-0"
          animate={{ 
            opacity: showPreview && isVideoLoaded ? 0 : 1,
            scale: showPreview && isVideoLoaded ? 1.05 : 1
          }}
          transition={{ duration: 0.5 }}
        >
          {!fallbackError ? (
            <NetflixImage
              src={imageError ? getFallbackThumbnailUrl() : getThumbnailUrl()}
              alt={extractNiceTitle(media.title)}
              className="w-full h-full object-cover"
              priority={priority ? 'high' : 'medium'}
              progressive={false}
              preload={priority}
              fallbackSrc={imageError ? undefined : getFallbackThumbnailUrl()}
              onError={() => handleImageError()}
              onLoad={() => {
                console.log('Thumbnail loaded for:', media.title);
              }}
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
        </motion.div>

        {/* Netflix-optimized Preview Video */}
        {showPreview && (
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: isVideoLoaded ? 1 : 0 }}
            transition={{ duration: 0.5 }}
          >
            <video
              ref={videoRef}
              src={getPreviewUrl()}
              className="w-full h-full object-cover"
              muted={isMuted}
              loop
              autoPlay={false}
              playsInline
              preload="metadata"
              poster={getThumbnailUrl()}
              onLoadedData={handleVideoLoad}
              onError={handleVideoError}
              onCanPlay={() => {
                const video = videoRef.current;
                if (video && isHovered) {
                  video.play().catch(() => {
                    console.log('Preview video autoplay failed for:', media.title);
                    setIsVideoLoaded(false);
                  });
                }
              }}
              onLoadStart={() => {
                console.log('Loading preview for:', media.title);
              }}
            />
          </motion.div>
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
        <AnimatePresence>
          {showPreview && isVideoLoaded && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={(e) => {
                e.stopPropagation();
                const newMuted = !isMuted;
                setIsMuted(newMuted);
                if (videoRef.current) {
                  videoRef.current.muted = newMuted;
                  if (!newMuted) {
                    videoRef.current.volume = 0.3;
                    muteAll();
                    setCurrentAudioElement(videoRef.current);
                  }
                }
              }}
              className="absolute top-2 right-2 bg-black/50 text-white p-1.5 rounded-full hover:bg-black/70 transition-all duration-200 cursor-pointer z-20 border border-white/20"
            >
              {isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
            </motion.button>
          )}
        </AnimatePresence>

        {/* Netflix-style Title Overlay with Enhanced Gradient */}
        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/100 via-black/80 to-transparent"
            >
              <TextureEffects 
                genre={media.genres?.[0]?.name || 'drama'} 
                effectType="both"
                className="font-bold text-base line-clamp-2 mb-2 drop-shadow-[0_2px_12px_rgba(0,0,0,1)]"
              >
                {extractNiceTitle(media.title)}
              </TextureEffects>
              
              {/* Netflix-style metadata row */}
              <div className="flex items-center gap-2 text-sm text-gray-200 mb-3">
                <span className="text-green-400 font-bold">
                  {getMatchPercentage()}% Match
                </span>
                {media.rating && (
                  <>
                    <span className="text-gray-500">•</span>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-400 fill-current" />
                      <span className="font-semibold">{media.rating}</span>
                    </div>
                  </>
                )}
                <span className="text-gray-500">•</span>
                <span className="capitalize font-medium">{media.type}</span>
                {media.duration && (
                  <>
                    <span className="text-gray-500">•</span>
                    <span className="font-medium">{formatDuration(media.duration)}</span>
                  </>
                )}
              </div>

              {/* Action buttons row */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePlayClick}
                  disabled={isLoading}
                  className="bg-white text-black px-4 py-2 rounded-md font-bold hover:bg-gray-200 transition-colors duration-200 flex items-center gap-2 cursor-pointer text-sm"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 fill-current" />
                  )}
                  Play
                </button>
                
                <button className="bg-gray-700/80 text-white p-2 rounded-full hover:bg-gray-600 transition-colors duration-200 cursor-pointer backdrop-blur-sm">
                  <Plus className="w-4 h-4" />
                </button>
                
                <button className="bg-gray-700/80 text-white p-2 rounded-full hover:bg-gray-600 transition-colors duration-200 cursor-pointer backdrop-blur-sm">
                  <ThumbsUp className="w-4 h-4" />
                </button>
                
                <button
                  onClick={handleInfoClick}
                  className="bg-gray-700/80 text-white p-2 rounded-full hover:bg-gray-600 transition-colors duration-200 ml-auto cursor-pointer backdrop-blur-sm"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>

              {/* Genres */}
              {media.genres && media.genres.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {media.genres.slice(0, 3).map((genre, index) => (
                    <span
                      key={genre.id || index}
                      className="text-xs text-gray-200 bg-gray-800/60 backdrop-blur-sm px-2 py-1 rounded-full border border-gray-700/50"
                    >
                      {genre.name}
                    </span>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
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
                className="bg-white text-black rounded-full p-2 hover:bg-gray-200 transition-colors duration-200 flex items-center gap-2"
              >
                <Play className="w-4 h-4 fill-current" />
                <span className="text-sm font-medium">Play</span>
              </button>
              
              <MyListButton 
                media={media}
                variant="ghost"
                size="sm"
                showText={false}
                className="bg-gray-800/80 text-white rounded-full"
              />
            </div>

            {/* Media Info */}
            <div className="flex items-center gap-2 text-sm mb-3">
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
