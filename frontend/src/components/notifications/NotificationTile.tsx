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
  autoPlayAudio?: boolean;
  canPlayVideo?: boolean; // New prop to control video playback
}

// Enhanced notification interface with backend data
interface EnhancedNotification extends Notification {
  backdrop_url?: string;
  poster_url?: string;
  logo_url?: string;
  trailer_key?: string;
  rating?: number;
  release_date?: string;
  year?: number;
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
  onTileClick,
  canPlayVideo = true // Default to true for backward compatibility
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
  const [usePreviewVideo, setUsePreviewVideo] = useState(false);
  const [previewVideoLoaded, setPreviewVideoLoaded] = useState(false);
  const playerRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerInitializedRef = useRef(false);
  const imageRetryCountRef = useRef(0);
  const failedUrlsRef = useRef<Set<string>>(new Set());
  const trailerTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasPlayedRef = useRef(false);

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

  // Initialize YouTube player - STRICT SIZE AND TRAILER CHECKS
  useEffect(() => {
    // STRICT CHECKS: Only hero and large tiles with explicit trailers
    if (!ytReady ||
      (size !== 'hero' && size !== 'large') ||
      !enhancedNotification.trailer_key) return; // Only hero and large tiles

    const containerId = `yt-player-${notification.id}`;

    // Only initialize once per notification
    if (playerInitializedRef.current) return;

    console.log(`🎬 Initializing trailer for ${size} tile:`, notification.title);

    // Set timeout to fallback to preview video if trailer takes too long (3 seconds - reduced)
    trailerTimeoutRef.current = setTimeout(() => {
      if (!videoReady && !trailerPlaying) {
        console.log('⏱️ Trailer timeout, switching to preview video:', notification.title);
        setUsePreviewVideo(true);
      }
    }, 3000); // Reduced from 5s to 3s

    // IMMEDIATE initialization - no delay for instant playback
    const container = document.getElementById(containerId);
    if (!container) {
      // Container not ready yet, try again very soon
      setTimeout(() => {
        const retryContainer = document.getElementById(containerId);
        if (!retryContainer) return;
        initializePlayer(retryContainer);
      }, 100);
      return;
    }

    initializePlayer(container);

    function initializePlayer(container: HTMLElement) {
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
            loop: 0,
            start: 10, // Start 10 seconds in to skip intro
            origin: window.location.origin,
          },
          events: {
            onStateChange: (event: any) => {
              if (event.data === 1) { // Playing
                setVideoReady(true);
                setTrailerPlaying(true);
                setUsePreviewVideo(false); // Cancel preview fallback
                if (trailerTimeoutRef.current) {
                  clearTimeout(trailerTimeoutRef.current);
                }
                onTrailerStart?.();
              } else if (event.data === 0) { // Ended
                console.log('🎬 YouTube trailer ended for:', notification.title);
                hasPlayedRef.current = true; // Mark as played
                event.target.stopVideo(); // FORCE STOP to prevent looping/restarting
                setVideoReady(false);
                setTrailerPlaying(false);
                onTrailerEnd?.(); // Notify parent that trailer ended
              } else if (event.data === 2) { // Paused
                setTrailerPlaying(false);
              }
            },
            onReady: (event: any) => {
              if (hasPlayedRef.current) return; // Don't replay if already finished
              const iframe = event.target.getIframe();
              if (iframe) {
                iframe.referrerPolicy = "strict-origin-when-cross-origin";
              }
              if (!isMuted) {
                event.target.unMute();
              }
              event.target.seekTo(10, true); // Explicitly seek to 10s with allowSeekAhead
              event.target.playVideo();
              console.log('✅ Trailer ready:', notification.title);

              // Set up interval to end video 15 seconds early (matching LocalMoviesHeroSlider)
              const checkEndTime = setInterval(() => {
                try {
                  const player = event.target;
                  const duration = player.getDuration();
                  const currentTime = player.getCurrentTime();

                  // End 15 seconds before actual end
                  if (duration > 0 && currentTime >= duration - 15) {
                    clearInterval(checkEndTime);
                    console.log('🎬 YouTube trailer ending early for:', notification.title);
                    hasPlayedRef.current = true;
                    player.stopVideo();
                    setVideoReady(false);
                    setTrailerPlaying(false);
                    onTrailerEnd?.();
                  }
                } catch (e) {
                  // Player might be destroyed
                  clearInterval(checkEndTime);
                }
              }, 500);

              // Store interval ref for cleanup
              (event.target as any)._endCheckInterval = checkEndTime;
            },
            onError: (event: any) => {
              console.error('❌ Trailer error:', event.data, '- switching to preview');
              setVideoReady(false);
              setUsePreviewVideo(true); // Fallback to preview on error
            }
          },
        });
        playerInitializedRef.current = true;
        console.log('🎬 Initialized trailer for:', notification.title);
      } catch (error) {
        console.error('Failed to initialize trailer:', error);
        setUsePreviewVideo(true); // Fallback to preview on error
      }
    }

    return () => {
      if (trailerTimeoutRef.current) {
        clearTimeout(trailerTimeoutRef.current);
      }
    };
  }, [ytReady, notification.id, notification.title, enhancedNotification.trailer_key, size, onTrailerStart, videoReady, trailerPlaying]);

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
    const apiUrl = getApiUrl();

    // Priority 1: TMDB backdrop URL (highest quality) - ALWAYS try this first for TMDB content
    if (enhancedNotification.backdrop_url?.startsWith('https://image.tmdb.org/t/p/')) {
      if (!failedUrlsRef.current.has(enhancedNotification.backdrop_url)) {
        console.log('🎬 Using TMDB backdrop:', enhancedNotification.backdrop_url.substring(0, 60) + '...');
        return enhancedNotification.backdrop_url;
      }
    }

    // Priority 2: Check for TMDB content with tmdb_ids - construct TMDB URL
    if ((notification as any).tmdb_ids && (notification as any).tmdb_ids.length > 0) {
      const tmdbId = (notification as any).tmdb_ids[0];
      // Use TMDB's original backdrop URL (w1280 for high quality)
      const tmdbBackdropUrl = `https://image.tmdb.org/t/p/w1280${enhancedNotification.backdrop_url || ''}`;
      if (enhancedNotification.backdrop_url && !failedUrlsRef.current.has(tmdbBackdropUrl)) {
        console.log('🎬 Constructed TMDB backdrop URL:', tmdbBackdropUrl.substring(0, 60) + '...');
        return tmdbBackdropUrl;
      }
    }

    // Priority 3: Check media_details for TMDB content
    if (enhancedNotification.media_details && enhancedNotification.media_details.length > 0) {
      const firstMedia = enhancedNotification.media_details[0];

      // Use TMDB backdrop if available
      if (firstMedia.backdrop_url?.startsWith('https://image.tmdb.org/t/p/')) {
        if (!failedUrlsRef.current.has(firstMedia.backdrop_url)) {
          console.log('🎬 Using media_details TMDB backdrop:', firstMedia.backdrop_url.substring(0, 60) + '...');
          return firstMedia.backdrop_url;
        }
      }

      // Try local media ID with different sources for local content only
      if (firstMedia.source_type === 'local' && firstMedia.id) {
        const backdropSources = [
          `${apiUrl}/api/admin/assets/banner_${firstMedia.id}.jpg`,
          `${apiUrl}/api/admin/assets/backdrop_${firstMedia.id}.jpg`,
          `${apiUrl}/api/thumbnails/${firstMedia.id}`,
          `${apiUrl}/api/posters/${firstMedia.id}`,
        ];

        for (const backdropUrl of backdropSources) {
          if (!failedUrlsRef.current.has(backdropUrl)) {
            return backdropUrl;
          }
        }
      }
    }

    // Priority 4: Check if this is a local movie/series with movie_ids
    if (notification.movie_ids && notification.movie_ids.length > 0) {
      const movieId = notification.movie_ids[0];

      // Try different backdrop sources like HomeflixHero
      const backdropSources = [
        `${apiUrl}/api/admin/assets/banner_${movieId}.jpg`, // Banner (best for backdrop)
        `${apiUrl}/api/admin/assets/backdrop_${movieId}.jpg`, // Direct backdrop
        `${apiUrl}/api/thumbnails/${movieId}`, // Thumbnail fallback
        `${apiUrl}/api/posters/${movieId}`, // Poster as last resort
      ];

      for (const backdropUrl of backdropSources) {
        if (!failedUrlsRef.current.has(backdropUrl)) {
          return backdropUrl;
        }
      }
    }

    return null;
  };

  const getPosterUrl = () => {
    const apiUrl = getApiUrl();

    // Priority 1: TMDB poster URL
    if (enhancedNotification.poster_url?.startsWith('https://image.tmdb.org/t/p/')) {
      if (!failedUrlsRef.current.has(enhancedNotification.poster_url)) {
        return enhancedNotification.poster_url;
      }
    }

    // Priority 2: Check if this is a local movie/series with movie_ids
    if (notification.movie_ids && notification.movie_ids.length > 0) {
      const movieId = notification.movie_ids[0];
      const posterUrl = `${apiUrl}/api/posters/${movieId}`;
      if (!failedUrlsRef.current.has(posterUrl)) {
        return posterUrl;
      }
    }

    // Priority 3: Check media_details for local content
    if (enhancedNotification.media_details && enhancedNotification.media_details.length > 0) {
      const firstMedia = enhancedNotification.media_details[0];

      // Use TMDB poster if available
      if (firstMedia.poster_url?.startsWith('https://image.tmdb.org/t/p/')) {
        if (!failedUrlsRef.current.has(firstMedia.poster_url)) {
          return firstMedia.poster_url;
        }
      }

      // Try local media ID
      if (firstMedia.id) {
        const posterUrl = `${apiUrl}/api/posters/${firstMedia.id}`;
        if (!failedUrlsRef.current.has(posterUrl)) {
          return posterUrl;
        }
      }
    }

    return null;
  };

  // Helper function to determine if this is a TV series notification
  const isTVSeries = () => {
    return notification.type === 'tmdb_upcoming_tv' || 
           notification.type === 'tmdb_now_airing_tv' ||
           notification.type === 'new_episodes' ||
           (enhancedNotification.media_details && 
            enhancedNotification.media_details.some(media => media.source_type === 'tmdb' && 
            (notification.type.includes('tv') || media.title?.toLowerCase().includes('season'))));
  };

  const getLogoUrl = () => {
    const apiUrl = getApiUrl();

    // Priority 1: Check if notification has logo_url (from backend)
    if (enhancedNotification.logo_url && enhancedNotification.logo_url.trim()) {
      if (!failedUrlsRef.current.has(enhancedNotification.logo_url)) {
        return enhancedNotification.logo_url;
      }
    }

    // Priority 2: Check for TMDB content with tmdb_ids
    if ((notification as any).tmdb_ids && (notification as any).tmdb_ids.length > 0) {
      const tmdbId = (notification as any).tmdb_ids[0];
      const mediaType = isTVSeries() ? 'tv' : 'movie'; // Determine media type for TV series
      
      // Try TMDB logo formats with correct media type
      const tmdbLogoFormats = [
        `${apiUrl}/api/tmdb/${mediaType}/${tmdbId}/logo`, // TMDB logo endpoint with correct type
        `${apiUrl}/api/admin/assets/tmdb_${mediaType}_logo_${tmdbId}.png`, // Cached TMDB logo with type
        `${apiUrl}/api/admin/assets/tmdb_logo_${tmdbId}.png`, // Fallback cached TMDB logo
        `${apiUrl}/api/admin/assets/tmdb_logo_${tmdbId}.jpg`,
      ];

      for (const logoUrl of tmdbLogoFormats) {
        if (!failedUrlsRef.current.has(logoUrl)) {
          return logoUrl;
        }
      }
    }

    // Priority 3: Check media_details for TMDB content
    if (enhancedNotification.media_details && enhancedNotification.media_details.length > 0) {
      const firstMedia = enhancedNotification.media_details[0];

      // Check if it's TMDB content (source_type = 'tmdb')
      if (firstMedia.source_type === 'tmdb' && firstMedia.source_id) {
        const tmdbId = firstMedia.source_id;
        const mediaType = isTVSeries() ? 'tv' : 'movie'; // Determine media type for TV series
        
        const tmdbLogoFormats = [
          `${apiUrl}/api/tmdb/${mediaType}/${tmdbId}/logo`, // TMDB logo endpoint with correct type
          `${apiUrl}/api/admin/assets/tmdb_${mediaType}_logo_${tmdbId}.png`, // Cached with type
          `${apiUrl}/api/admin/assets/tmdb_logo_${tmdbId}.png`, // Fallback cached
          `${apiUrl}/api/admin/assets/tmdb_logo_${tmdbId}.jpg`,
        ];

        for (const logoUrl of tmdbLogoFormats) {
          if (!failedUrlsRef.current.has(logoUrl)) {
            return logoUrl;
          }
        }
      }
    }

    // Priority 4: Check if this is a local movie/series with movie_ids
    if (notification.movie_ids && notification.movie_ids.length > 0) {
      const movieId = notification.movie_ids[0];

      // Try different logo formats like HomeflixHero
      const logoFormats = [
        `${apiUrl}/api/admin/assets/logo_${movieId}.png`,
        `${apiUrl}/api/admin/assets/logo_${movieId}.jpg`,
        `${apiUrl}/api/admin/assets/logo_${movieId}.svg`,
        `${apiUrl}/api/logo_path/${movieId}`, // Direct logo path endpoint
      ];

      for (const logoUrl of logoFormats) {
        if (!failedUrlsRef.current.has(logoUrl)) {
          return logoUrl;
        }
      }
    }

    // Priority 5: Check media_details for local content
    if (enhancedNotification.media_details && enhancedNotification.media_details.length > 0) {
      const firstMedia = enhancedNotification.media_details[0];

      // Try local media ID with different formats (only for local content)
      if (firstMedia.source_type === 'local' && firstMedia.id) {
        const logoFormats = [
          `${apiUrl}/api/admin/assets/logo_${firstMedia.id}.png`,
          `${apiUrl}/api/admin/assets/logo_${firstMedia.id}.jpg`,
          `${apiUrl}/api/admin/assets/logo_${firstMedia.id}.svg`,
          `${apiUrl}/api/logo_path/${firstMedia.id}`,
        ];

        for (const logoUrl of logoFormats) {
          if (!failedUrlsRef.current.has(logoUrl)) {
            return logoUrl;
          }
        }
      }
    }

    // No logo found - return null so text title will be used
    return null;
  };

  const getPreviewVideoUrl = () => {
    const apiUrl = getApiUrl();

    // Only for local content with movie_ids
    if (notification.movie_ids && notification.movie_ids.length > 0) {
      const movieId = notification.movie_ids[0];
      return `${apiUrl}/api/preview-clips/${movieId}?quality=medium&format=mp4`;
    }

    // Check media_details for local content
    if (enhancedNotification.media_details && enhancedNotification.media_details.length > 0) {
      const firstMedia = enhancedNotification.media_details[0];
      if (firstMedia.id) {
        return `${apiUrl}/api/preview-clips/${firstMedia.id}?quality=medium&format=mp4`;
      }
    }

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
  const logoUrl = getLogoUrl();
  const previewVideoUrl = getPreviewVideoUrl();

  // Debug logging for tile size and video restrictions
  useEffect(() => {
    console.log(`🏷️ Tile ${notification.id}: Title="${notification.title}", Size="${size}", HasTrailer="${!!enhancedNotification.trailer_key}", CanPlayVideo="${size === 'hero' || size === 'large'}"`);
  }, [notification.id, notification.title, size, enhancedNotification.trailer_key]);

  // Size-specific styling - ENHANCED for better content display at all sizes
  const getSizeClasses = () => {
    switch (size) {
      case 'hero':
        return {
          container: 'p-4 md:p-6',
          title: 'text-xl sm:text-2xl md:text-3xl font-bold',
          message: 'text-sm sm:text-base md:text-lg',
          showDetails: true,
          showTrailer: true, // Hero tiles show trailers
          showPoster: true,
        };
      case 'banner':
        return {
          container: 'p-3 md:p-4',
          title: 'text-lg sm:text-xl md:text-2xl font-bold',
          message: 'text-sm sm:text-base',
          showDetails: true,
          showTrailer: false, // Banner tiles don't show trailers
          showPoster: true,
        };
      case 'large':
        return {
          container: 'p-3 md:p-4',
          title: 'text-base sm:text-lg md:text-xl font-bold',
          message: 'text-sm',
          showDetails: true,
          showTrailer: true, // Large tiles show trailers
          showPoster: true,
        };
      case 'medium':
        return {
          container: 'p-2 md:p-3',
          title: 'text-sm sm:text-base md:text-lg font-bold',
          message: 'text-xs sm:text-sm',
          showDetails: true,
          showTrailer: false, // Medium tiles NO TRAILERS
          showPoster: true,
        };
      case 'small':
        return {
          container: 'p-2 md:p-3',
          title: 'text-sm font-bold text-white leading-tight',
          message: 'text-xs text-white/90 leading-tight',
          showDetails: true, // Show content for small tiles
          showTrailer: false, // Small tiles NEVER show trailers
          showPoster: false, // Don't show poster for small tiles to save space
        };
      default:
        return {
          container: 'p-3',
          title: 'text-base font-bold',
          message: 'text-sm',
          showDetails: true,
          showTrailer: false, // Default: no trailers
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
      {/* Background Image - Show backdrop, hide when trailer plays */}
      {backdropUrl && !imageError ? (
        <motion.div
          initial={{ scale: 1.05, opacity: 0 }}
          animate={{ 
            scale: imageLoaded ? 1 : 1.05,
            opacity: (videoReady || previewVideoLoaded) ? 0 : (imageLoaded ? 1 : 0)
          }}
          transition={{ 
            scale: { duration: 1.2, ease: "easeOut" },
            opacity: { duration: 0.5, ease: "easeInOut" }
          }}
          className="absolute inset-0 z-0"
        >
          <img
            src={currentImageUrl || backdropUrl}
            alt="Backdrop"
            className="w-full h-full object-cover"
            loading="eager"
            onLoad={() => {
              setImageLoaded(true);
              setImageError(false);
              console.log('✅ Backdrop loaded:', notification.title);
            }}
            onError={() => {
              console.warn('❌ Backdrop failed:', currentImageUrl || backdropUrl);
              handleImageError(currentImageUrl || backdropUrl);
              // Try poster as backdrop fallback
              if (posterUrl && currentImageUrl !== posterUrl && !failedUrlsRef.current.has(posterUrl)) {
                console.log('🔄 Trying poster as backdrop fallback');
                setCurrentImageUrl(posterUrl);
                setImageError(false);
                setImageLoaded(false);
              } else {
                setImageError(true);
                setImageLoaded(true);
              }
            }}
          />
        </motion.div>
      ) : null}

      {/* YouTube Player - ONLY for Hero and Large tiles - Hidden until ready */}
      {(size === 'hero' || size === 'large') && enhancedNotification.trailer_key && !usePreviewVideo && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden"
          style={{
            opacity: videoReady ? 1 : 0,
            pointerEvents: videoReady ? 'auto' : 'none',
            transition: 'opacity 0.6s ease-out'
          }}
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
        </div>
      )}

      {/* Preview Video Player - ONLY for Hero and Large tiles - Hidden until ready */}
      {(size === 'hero' || size === 'large') && previewVideoUrl && (usePreviewVideo || !enhancedNotification.trailer_key) && (
        <div
          className="absolute inset-0 z-10"
          style={{
            opacity: previewVideoLoaded ? 1 : 0,
            pointerEvents: previewVideoLoaded ? 'auto' : 'none',
            transition: 'opacity 0.6s ease-out'
          }}
        >
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            autoPlay
            muted={isMuted}
            playsInline
            onLoadedData={() => {
              setPreviewVideoLoaded(true);
              console.log('✅ Preview video loaded:', notification.title);
              onTrailerStart?.();
            }}
            onEnded={() => {
              console.log('🎬 Preview video ended:', notification.title);
              setPreviewVideoLoaded(false);
              onTrailerEnd?.(); // Notify parent that video ended
            }}
            onError={(e) => {
              console.error('❌ Preview video error:', notification.title);
              setPreviewVideoLoaded(false);
            }}
          >
            <source src={previewVideoUrl} type="video/mp4" />
          </video>
        </div>
      )}

      {/* Gradient Overlays - Always present for text readability */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="absolute inset-0 z-15 pointer-events-none"
      >
        {/* Minimal gradients to preserve backdrop/video visibility while ensuring text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
        {/* Text area protection */}
        <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black/95 to-transparent" />
      </motion.div>

      {/* Tile Effects */}
      <TileEffects priority={enhancedNotification.priority || 'medium'} themeColors={themeColors} />

      {/* Content */}
      <div className={`absolute inset-0 flex flex-col justify-end z-20 ${sizeConfig.container} pb-4`}>
        {/* Icon and Timestamp with conditional visibility enhancement */}
        <div className="flex items-center gap-2 mb-2">
          <div
            className="rounded-full backdrop-blur-md border p-1.5"
            style={{
              backgroundColor: `${themeColors.primary}40`,
              borderColor: `${themeColors.primary}60`,
              boxShadow: '0 2px 8px rgba(0,0,0,0.8)',
            }}
          >
            {getNotificationIcon(notification.type)}
          </div>
          {/* TV Series indicator for small tiles */}
          {isTVSeries() && size === 'small' && (
            <div
              className="rounded-full backdrop-blur-md border p-1"
              style={{
                backgroundColor: `${themeColors.accent}40`,
                borderColor: `${themeColors.accent}60`,
                boxShadow: '0 2px 8px rgba(0,0,0,0.8)',
              }}
            >
              <Tv className="w-3 h-3 text-red-400" />
            </div>
          )}
          <div
            className="text-xs font-medium"
            style={{
              color: '#ef4444',
              textShadow: '0 1px 3px rgba(0,0,0,0.9), 0 2px 6px rgba(0,0,0,0.8)',
            }}
          >
            {formatTimestamp(notification.timestamp)}
          </div>
        </div>

        {/* Title Section - Logo with text fallback */}
        <div className="mb-2">
          {/* Logo - only for larger tiles and when available */}
          {logoUrl && size !== 'small' && (
            <img
              src={logoUrl}
              alt={notification.title}
              className={`w-auto mb-2 ${size === 'hero' ? 'max-h-16 md:max-h-20' :
                size === 'large' ? 'max-h-12 md:max-h-16' :
                  size === 'banner' ? 'max-h-10 md:max-h-12' :
                    size === 'medium' ? 'max-h-8 md:max-h-10' :
                      'max-h-6 md:max-h-8'
                }`}
              onLoad={() => {
                console.log('✅ Logo loaded successfully:', logoUrl);
                // Hide text title when logo loads successfully
                const textTitle = document.getElementById(`text-title-${notification.id}`);
                if (textTitle) {
                  textTitle.style.display = 'none';
                }
              }}
              onError={(e) => {
                console.log('❌ Logo failed, showing text title:', notification.title);
                e.currentTarget.style.display = 'none';
                // Ensure text title is visible
                const textTitle = document.getElementById(`text-title-${notification.id}`);
                if (textTitle) {
                  textTitle.style.display = 'block';
                }
                handleImageError(logoUrl);
              }}
            />
          )}

          {/* Text Title - ALWAYS present as fallback */}
          <h1
            id={`text-title-${notification.id}`}
            className={`${sizeConfig.title}`}
            style={{
              display: 'block', // Always visible initially
              color: '#e50914', // Netflix red
              fontWeight: 'bold',
              zIndex: 100,
              position: 'relative',
              lineHeight: size === 'small' ? '1.2' : '1.3',
            }}
          >
            {notification.title}
          </h1>
        </div>

        {/* Enhanced Description with strong text shadow */}
        {(size === 'hero' || size === 'large' || size === 'banner') && enhancedNotification.overview ? (
          <p
            className={`leading-relaxed mb-3 line-clamp-2 ${sizeConfig.message}`}
            style={{
              color: '#ffffff',
              textShadow: '0 1px 3px rgba(0,0,0,1), 0 2px 6px rgba(0,0,0,0.9), 1px 1px 0px rgba(0,0,0,0.8)',
            }}
          >
            {enhancedNotification.overview.length > 100
              ? enhancedNotification.overview.substring(0, 100) + '...'
              : enhancedNotification.overview}
          </p>
        ) : (
          <p
            className={`leading-relaxed mb-2 line-clamp-2 ${sizeConfig.message}`}
            style={{
              color: '#ffffff',
              textShadow: '0 1px 3px rgba(0,0,0,1), 0 2px 6px rgba(0,0,0,0.9), 1px 1px 0px rgba(0,0,0,0.8)',
            }}
          >
            {notification.message.length > 80
              ? notification.message.substring(0, 80) + '...'
              : notification.message}
          </p>
        )}

        {/* Movie Details Row - Rating, Year, Genres, TV Tag */}
        {(size === 'hero' || size === 'large' || size === 'banner') && (
          <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
            {/* TV Series Tag */}
            {isTVSeries() && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                <Tv className="w-3 h-3" />
                TV
              </span>
            )}
            {enhancedNotification.rating && enhancedNotification.rating > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                <Star className="w-3 h-3 fill-current" />
                {enhancedNotification.rating.toFixed(1)}
              </span>
            )}
            {((enhancedNotification.year && enhancedNotification.year > 1900) || enhancedNotification.release_date) && (
              <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                {(enhancedNotification.year && enhancedNotification.year > 1900) ? enhancedNotification.year : new Date(enhancedNotification.release_date!).getFullYear()}
              </span>
            )}
            {enhancedNotification.genres && enhancedNotification.genres.length > 0 && (
              <span className="inline-flex items-center px-2 py-1 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                {enhancedNotification.genres.slice(0, 2).join(' • ')}
              </span>
            )}
            {enhancedNotification.runtime && enhancedNotification.runtime > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                <Clock className="w-3 h-3" />
                {Math.floor(enhancedNotification.runtime / 60)}h {enhancedNotification.runtime % 60}m
              </span>
            )}
          </div>
        )}

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

        {/* Movie Grid for Multi-item Notifications - TMDB and Local URLs */}
        {sizeConfig.showDetails && enhancedNotification.media_details && enhancedNotification.media_details.length > 1 && (
          <div className="flex gap-2 mb-3 overflow-x-auto scrollbar-hide">
            {enhancedNotification.media_details.slice(0, size === 'hero' ? 6 : 4).map((media) => {
              // Get poster URL - try TMDB first, then local
              let mediaPosterUrl = null;
              if (media.poster_url?.startsWith('https://image.tmdb.org/t/p/')) {
                mediaPosterUrl = media.poster_url;
              } else if (media.id) {
                mediaPosterUrl = `${apiUrl}/api/posters/${media.id}`;
              }

              if (!mediaPosterUrl) return null;

              return (
                <div key={`${media.source_type}_${media.source_id}`} className="flex-shrink-0">
                  <div className="w-12 h-16 rounded overflow-hidden border border-white/20 bg-gray-800">
                    <img
                      src={mediaPosterUrl}
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

        {/* Single Movie Details - TMDB and Local URLs */}
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
                    handleImageError(posterUrl);
                  }}
                />
              </div>
            </div>
            {sizeConfig.showDetails && (
              <div className="flex-1 min-w-0">
                {/* TV Series Tag for single movie details */}
                {isTVSeries() && (
                  <div className="flex items-center gap-1 mb-1">
                    <Tv className="w-3 h-3 text-red-400" />
                    <span className="text-red-400 text-xs font-medium">TV Series</span>
                  </div>
                )}
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

        {/* Sound Control Icon - ONLY for Hero and Large tiles with video */}
        {(size === 'hero' || size === 'large') && (enhancedNotification.trailer_key || previewVideoUrl) && (
          <div className="absolute top-2 right-2 z-30">
            <button
              onClick={(e) => {
                e.stopPropagation();
                const newMutedState = !isMuted;
                setIsMuted(newMutedState);

                // Control YouTube player audio
                if (playerRef.current && !usePreviewVideo) {
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

                // Control preview video audio
                if (videoRef.current && (usePreviewVideo || !enhancedNotification.trailer_key)) {
                  videoRef.current.muted = newMutedState;
                  console.log(newMutedState ? '🔇 Muted preview' : '🔊 Unmuted preview');
                }
              }}
              className="backdrop-blur-md rounded-full border p-2 transition-all hover:scale-110 bg-black/50 hover:bg-black/70"
              style={{
                borderColor: `${themeColors.primary}50`
              }}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ?
                <VolumeX className="w-4 h-4 text-white" /> :
                <Volume2 className="w-4 h-4 text-white" />
              }
            </button>
          </div>
        )}

        {/* No Action Buttons - Removed for cleaner tile appearance */}
      </div>
    </motion.div>
  );
});

export default NotificationTile;