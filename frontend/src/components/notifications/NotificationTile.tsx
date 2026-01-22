"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, 
  Star, 
  Calendar, 
  Clock, 
  TrendingUp, 
  Sparkles, 
  Award, 
  Heart,
  RotateCcw,
  Plus,
  Tv,
  Zap,
  Eye,
  Volume2,
  VolumeX
} from 'lucide-react';
import { Notification } from '@/types/notifications';
import { getApiUrl } from '@/lib/api';
import { getColorPaletteByGenre } from '@/types/widgets';
import TileEffects from './TileEffects';

interface NotificationTileProps {
  notification: Notification;
  size: 'small' | 'medium' | 'large' | 'banner' | 'hero';
  className?: string;
  onTrailerEnd?: () => void;
  onTrailerStart?: () => void;
  onTileClick?: () => void;
}

// Enhanced notification interface with backend data
interface EnhancedNotification extends Notification {
  backdrop_url?: string;
  poster_url?: string;
  logo_url?: string;
  trailer_key?: string;
  rating?: number;
  release_date?: string;
  runtime?: number;
  genres?: string[];
  overview?: string;
  tagline?: string;
  language?: string;
  popularity?: number;
  companies?: string[];
  priority?: string;
  category?: string;
  progress?: number;
  remaining_min?: number;
  days_until?: number;
  genre_highlight?: string;
  media_details?: Array<{
    id: number;
    title: string;
    poster_url: string;
    backdrop_url: string;
    rating: number;
    year: number;
    runtime: number;
    genres: string[];
    overview: string;
    source_type: string;
    source_id: string;
  }>;
}

// Declare global YouTube types
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

const NotificationTile: React.FC<NotificationTileProps> = React.memo(({ 
  notification, 
  size, 
  className = '', 
  onTrailerEnd,
  onTrailerStart,
  onTileClick
}) => {
  const apiUrl = getApiUrl();
  const enhancedNotification = notification as EnhancedNotification;
  
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [ytReady, setYtReady] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [trailerPlaying, setTrailerPlaying] = useState(false);
  const playerRef = useRef<any>(null);
  const playerInitializedRef = useRef(false);
  const imageRetryCountRef = useRef(0);
  const failedUrlsRef = useRef<Set<string>>(new Set());

  // Initialize image URL once
  useEffect(() => {
    const backdropUrl = getBackdropUrl();
    if (backdropUrl && !currentImageUrl) {
      setCurrentImageUrl(backdropUrl);
    }
  }, [notification.id]); // Only on mount or ID change

  // Load YouTube IFrame API
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setYtReady(true);
      return;
    }

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      setYtReady(true);
    };
  }, []);

  // Initialize YouTube player - STABLE, no recreation
  useEffect(() => {
    if (!ytReady || (size !== 'hero' && size !== 'large') || !enhancedNotification.trailer_key) return;

    const containerId = `yt-player-${notification.id}`;
    
    // Only initialize once per notification
    if (playerInitializedRef.current) return;

    const timer = setTimeout(() => {
      const container = document.getElementById(containerId);
      if (!container) return;

      try {
        playerRef.current = new window.YT.Player(containerId, {
          videoId: enhancedNotification.trailer_key,
          playerVars: {
            autoplay: 1,
            mute: 1,
            controls: 0,
            showinfo: 0,
            rel: 0,
            iv_load_policy: 3,
            modestbranding: 1,
            playsinline: 1,
            disablekb: 1,
            fs: 0,
            cc_load_policy: 0,
            enablejsapi: 1,
            loop: 1,
            playlist: enhancedNotification.trailer_key,
            origin: window.location.origin,
          },
          events: {
            onStateChange: (event: any) => {
              if (event.data === 1) { // Playing
                setVideoReady(true);
                setTrailerPlaying(true);
                onTrailerStart?.();
              } else if (event.data === 0) { // Ended - loop it
                event.target.playVideo();
              }
            },
            onReady: (event: any) => {
              event.target.playVideo();
              console.log('✅ Trailer ready:', notification.title);
            },
            onError: (event: any) => {
              console.error('❌ Trailer error:', event.data);
              setVideoReady(false);
            }
          },
        });
        playerInitializedRef.current = true;
        console.log('🎬 Initialized trailer for:', notification.title);
      } catch (error) {
        console.error('Failed to initialize trailer:', error);
      }
    }, 800);

    return () => {
      clearTimeout(timer);
    };
  }, [ytReady, notification.id, notification.title, enhancedNotification.trailer_key, size, onTrailerStart]);

  const getNotificationIcon = (type: string) => {
    const iconProps = { className: "w-4 h-4" };
    
    switch (type) {
      case 'tmdb_upcoming':
      case 'tmdb_upcoming_tv':
      case 'tmdb_coming_soon':
        return <Calendar {...iconProps} />;
      case 'tmdb_now_playing':
      case 'tmdb_now_airing_tv':
        return <Sparkles {...iconProps} />;
      case 'tmdb_trending':
      case 'local_trending':
        return <TrendingUp {...iconProps} />;
      case 'new_episodes':
        return <Tv {...iconProps} />;
      case 'new_movies':
      case 'recently_added':
        return <Plus {...iconProps} />;
      case 'movie_suggestion':
        return <Award {...iconProps} />;
      case 'single_movie_suggestion':
        return <Star {...iconProps} />;
      case 'watch_again':
      case 'continue_watching':
        return <RotateCcw {...iconProps} />;
      case 'genre_based':
        return <Heart {...iconProps} />;
      default:
        return <Zap {...iconProps} />;
    }
  };

  const getThemeColors = () => {
    if (enhancedNotification.genres && enhancedNotification.genres.length > 0) {
      return getColorPaletteByGenre(enhancedNotification.genres);
    }

    switch (enhancedNotification.category || notification.type) {
      case 'trending':
        return {
          primary: '#ff6b35',
          secondary: '#ff8c42',
          accent: '#ffa726',
          background: 'linear-gradient(135deg, #1a0f00 0%, #331e00 50%, #000000 100%)',
          text: '#ffffff',
        };
      case 'new':
        return {
          primary: '#4caf50',
          secondary: '#66bb6a',
          accent: '#81c784',
          background: 'linear-gradient(135deg, #0d1a0d 0%, #1a331a 50%, #000000 100%)',
          text: '#ffffff',
        };
      case 'recommended':
        return {
          primary: '#e91e63',
          secondary: '#f06292',
          accent: '#f48fb1',
          background: 'linear-gradient(135deg, #1a0d14 0%, #330d1a 50%, #000000 100%)',
          text: '#ffffff',
        };
      default:
        return {
          primary: '#e50914',
          secondary: '#831010',
          accent: '#ff6b6b',
          background: 'linear-gradient(135deg, #141414 0%, #1a1a1a 50%, #000000 100%)',
          text: '#ffffff',
        };
    }
  };

  const getBackdropUrl = () => {
    // STRICT: Only use valid TMDB URLs
    if (enhancedNotification.backdrop_url?.startsWith('https://image.tmdb.org/t/p/')) {
      if (!failedUrlsRef.current.has(enhancedNotification.backdrop_url)) {
        return enhancedNotification.backdrop_url;
      }
    }
    
    // NO LOCAL API CALLS - they cause 404s
    return null;
  };

  const getPosterUrl = () => {
    // STRICT: Only use valid TMDB poster URLs
    if (enhancedNotification.poster_url?.startsWith('https://image.tmdb.org/t/p/')) {
      if (!failedUrlsRef.current.has(enhancedNotification.poster_url)) {
        return enhancedNotification.poster_url;
      }
    }
    
    // NO LOCAL API CALLS - they cause 404s
    return null;
  };

  const handleImageError = useCallback((url: string) => {
    console.warn('❌ Image failed:', url);
    failedUrlsRef.current.add(url);
    setImageError(true);
    setImageLoaded(true);
  }, []);

  const formatTimestamp = (timestamp: number) => {
    const now = Date.now() / 1000;
    const diff = now - timestamp;

    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const themeColors = getThemeColors();
  const backdropUrl = getBackdropUrl();
  const posterUrl = getPosterUrl();

  // Size-specific styling - optimized for better content display
  const getSizeClasses = () => {
    switch (size) {
      case 'hero':
        return {
          container: 'p-4 md:p-6',
          title: 'text-xl sm:text-2xl md:text-3xl lg:text-4xl',
          message: 'text-sm md:text-base lg:text-lg',
          showDetails: true,
          showTrailer: true,
          showPoster: true,
        };
      case 'banner':
        return {
          container: 'p-3 md:p-4',
          title: 'text-lg sm:text-xl md:text-2xl',
          message: 'text-xs sm:text-sm md:text-base',
          showDetails: true,
          showTrailer: false,
          showPoster: true,
        };
      case 'large':
        return {
          container: 'p-3 md:p-4',
          title: 'text-base sm:text-lg md:text-xl',
          message: 'text-xs sm:text-sm',
          showDetails: true,
          showTrailer: true,
          showPoster: true,
        };
      case 'medium':
        return {
          container: 'p-2 md:p-3',
          title: 'text-sm sm:text-base md:text-lg',
          message: 'text-xs',
          showDetails: true,
          showTrailer: false,
          showPoster: true,
        };
      case 'small':
        return {
          container: 'p-2',
          title: 'text-xs sm:text-sm md:text-base',
          message: 'text-xs',
          showDetails: false,
          showTrailer: false,
          showPoster: true,
        };
      default:
        return {
          container: 'p-3',
          title: 'text-base',
          message: 'text-sm',
          showDetails: false,
          showTrailer: false,
          showPoster: true,
        };
    }
  };

  const sizeConfig = getSizeClasses();

  return (
    <motion.div
      className={`relative overflow-hidden rounded-xl border border-white/10 backdrop-blur-sm ${className} cursor-pointer`}
      style={{
        background: themeColors.background,
        boxShadow: `0 8px 32px ${themeColors.primary}20, inset 0 1px 0 rgba(255,255,255,0.1)`,
      }}
      onClick={(e) => {
        // Only trigger if not clicking on buttons
        if ((e.target as HTMLElement).closest('button')) return;
        onTileClick?.();
      }}
      transition={{ duration: 0.2 }}
      animate={{
        // Subtle breathing animation for high priority items
        ...(enhancedNotification.priority === 'high' && {
          boxShadow: [
            `0 8px 32px ${themeColors.primary}20, inset 0 1px 0 rgba(255,255,255,0.1)`,
            `0 12px 40px ${themeColors.primary}40, inset 0 1px 0 rgba(255,255,255,0.15)`,
            `0 8px 32px ${themeColors.primary}20, inset 0 1px 0 rgba(255,255,255,0.1)`,
          ]
        })
      }}
      {...(enhancedNotification.priority === 'high' && {
        transition: { 
          boxShadow: { duration: 2, repeat: Infinity, ease: "easeInOut" },
        }
      })}
    >
      {/* Background Image or Gradient */}
      {backdropUrl && !imageError ? (
        <motion.div
          initial={{ scale: 1.1 }}
          animate={{ scale: imageLoaded ? 1 : 1.1 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="absolute inset-0"
        >
          <img
            src={currentImageUrl || backdropUrl}
            alt="Backdrop"
            className="w-full h-full object-cover"
            onLoad={() => {
              setImageLoaded(true);
              setImageError(false);
            }}
            onError={() => handleImageError(currentImageUrl || backdropUrl)}
          />
        </motion.div>
      ) : (
        <div 
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${themeColors.primary}15 0%, ${themeColors.secondary}10 50%, #000 100%)`
          }}
        />
      )}

      {/* YouTube Player for Hero and Large tiles */}
      {(size === 'hero' || size === 'large') && enhancedNotification.trailer_key && (
        <AnimatePresence mode="wait">
          <motion.div
            key={`video-${notification.id}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: videoReady ? 1 : 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden"
          >
            <div className="relative w-full h-full overflow-hidden">
              <div
                id={`yt-player-${notification.id}`}
                className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
                style={{
                  width: '120vw',
                  height: '120vh',
                  minWidth: '200vh',
                  minHeight: '70vw',
                }}
              />
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      {/* Gradient Overlays */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
      <div
        className="absolute bottom-0 left-0 right-0 h-32"
        style={{
          background: `linear-gradient(to top, ${themeColors.primary}15 0%, transparent 100%)`
        }}
      />

      {/* Tile Effects */}
      <TileEffects priority={enhancedNotification.priority || 'medium'} themeColors={themeColors} />

      {/* Priority Badge */}
      {enhancedNotification.priority === 'high' && (
        <div className="absolute top-2 right-2 z-20">
          <div className="px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-red-500 text-white shadow-lg">
            HOT
          </div>
        </div>
      )}

      {/* Content */}
      <div className={`absolute inset-0 flex flex-col justify-end z-20 ${sizeConfig.container}`}>
        {/* Icon and Timestamp */}
        <div className="flex items-center gap-2 mb-2">
          <div
            className="rounded-full backdrop-blur-md border p-1.5"
            style={{
              backgroundColor: `${themeColors.primary}30`,
              borderColor: `${themeColors.primary}50`,
            }}
          >
            {getNotificationIcon(notification.type)}
          </div>
          <div className="text-white/70 text-xs font-medium">
            {formatTimestamp(notification.timestamp)}
          </div>
        </div>

        {/* Title */}
        <h1
          className={`font-bold leading-tight mb-2 ${sizeConfig.title}`}
          style={{
            textShadow: `0 0 30px ${themeColors.primary}60, 0 4px 15px rgba(0,0,0,0.8)`,
            background: `linear-gradient(135deg, ${themeColors.primary} 0%, ${themeColors.accent} 100%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}
        >
          {notification.title}
        </h1>

        {/* Message */}
        <p className={`text-white/90 leading-relaxed mb-3 line-clamp-2 ${sizeConfig.message}`}>
          {notification.message}
        </p>

        {/* Continue Watching Progress */}
        {notification.type === 'continue_watching' && enhancedNotification.progress && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-white/70 mb-1">
              <span>{Math.round(enhancedNotification.progress)}% watched</span>
              {enhancedNotification.remaining_min && (
                <span>{enhancedNotification.remaining_min}m left</span>
              )}
            </div>
            <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-red-600"
                initial={{ width: 0 }}
                animate={{ width: `${enhancedNotification.progress}%` }}
                transition={{ duration: 1, delay: 0.5 }}
              />
            </div>
          </div>
        )}

        {/* Movie Grid for Multi-item Notifications - ONLY TMDB URLs */}
        {sizeConfig.showDetails && enhancedNotification.media_details && enhancedNotification.media_details.length > 1 && (
          <div className="flex gap-2 mb-3 overflow-x-auto scrollbar-hide">
            {enhancedNotification.media_details.slice(0, size === 'hero' ? 6 : 4).map((media) => {
              // Only show if has valid TMDB poster URL
              if (!media.poster_url?.startsWith('https://image.tmdb.org/t/p/')) return null;
              
              return (
                <div key={`${media.source_type}_${media.source_id}`} className="flex-shrink-0">
                  <div className="w-12 h-16 rounded overflow-hidden border border-white/20 bg-gray-800">
                    <img
                      src={media.poster_url}
                      alt={media.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Just hide on error, no retries
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Single Movie Details - ONLY TMDB URLs */}
        {sizeConfig.showPoster && posterUrl && !enhancedNotification.media_details && (
          <div className="flex items-start gap-3 mb-3">
            <div className="flex-shrink-0">
              <div className="w-16 h-24 rounded border border-white/20 bg-gray-800 overflow-hidden">
                <img
                  src={posterUrl}
                  alt="Poster"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Just hide on error, no retries
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            </div>
            {sizeConfig.showDetails && (
              <div className="flex-1 min-w-0">
                {enhancedNotification.rating && enhancedNotification.rating > 0 && (
                  <div className="flex items-center gap-1 mb-1">
                    <Star className="w-3 h-3 text-yellow-400 fill-current" />
                    <span className="text-white/80 text-xs font-medium">
                      {enhancedNotification.rating.toFixed(1)}
                    </span>
                  </div>
                )}
                {enhancedNotification.genres && enhancedNotification.genres.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {enhancedNotification.genres.slice(0, 2).map((genre) => (
                      <span
                        key={genre}
                        className="px-1.5 py-0.5 text-xs rounded-full border font-medium"
                        style={{
                          backgroundColor: `${themeColors.primary}20`,
                          borderColor: `${themeColors.primary}40`,
                          color: themeColors.accent
                        }}
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Action Buttons - Icon Only */}
        <div className="flex items-center gap-1.5">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onTileClick?.();
            }}
            className="bg-white/90 hover:bg-white text-black rounded-full p-2 transition-all transform hover:scale-110 shadow-lg"
            title="Play"
          >
            <Play className="w-4 h-4 fill-current" />
          </button>
          
          {size === 'hero' && enhancedNotification.trailer_key && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const newMutedState = !isMuted;
                setIsMuted(newMutedState);
                
                // Control YouTube player audio
                if (playerRef.current) {
                  try {
                    if (newMutedState) {
                      playerRef.current.mute();
                      console.log('🔇 Muted trailer');
                    } else {
                      playerRef.current.unMute();
                      console.log('🔊 Unmuted trailer');
                    }
                  } catch (error) {
                    console.error('Failed to control audio:', error);
                  }
                }
              }}
              className="backdrop-blur-md rounded-full border p-2 transition-all hover:scale-110"
              style={{
                backgroundColor: `${themeColors.primary}20`,
                borderColor: `${themeColors.primary}50`
              }}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? 
                <VolumeX className="w-4 h-4 text-white" /> :
                <Volume2 className="w-4 h-4 text-white" />
              }
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
});

export default NotificationTile;