"use client";

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Play,
  Info,
  Star,
  Calendar,
  Clock,
  ChevronRight,
  Sparkles,
  Plus,
  Check,
  ChevronLeft,
  Tv,
  TrendingUp,
  Award,
  Zap,
  Eye,
  Heart,
  Volume2,
  VolumeX,
  RotateCcw
} from 'lucide-react';
import { Widget, parseWidgetConfig, getColorPaletteByGenre, DominantColors } from '@/types/widgets';
import type { Notification } from '@/types/notifications';
import { getApiUrl } from '@/lib/api';
import { useNavigate } from '@/hooks/useNavigate';
import { resolveMediaRoute } from '@/lib/mediaNavigation';
import { Media } from '@/types/media';
import { useMyList } from '@/hooks/useMyList';
import MyListTooltip from '@/components/ui/MyListTooltip';


// Declare global YouTube types
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface TMDBMovieDetails {
  id: number;
  title: string;
  name?: string;
  overview: string;
  backdrop_path: string;
  poster_path: string;
  release_date: string;
  first_air_date?: string;
  vote_average: number;
  genres: { id: number; name: string }[];
  runtime?: number;
  episode_run_time?: number[];
  logo_path?: string;
  media_type?: 'movie' | 'tv';
  original_language: string;
  popularity: number;
  adult: boolean;
  tagline?: string;
  production_companies?: { id: number; name: string; logo_path?: string }[];
  videos?: {
    results: {
      key: string;
      type: string;
      site: string;
      name: string;
      official?: boolean;
    }[];
  };
}

interface EnhancedNotification extends Notification {
  priority?: 'high' | 'medium' | 'low';
  category?: 'trending' | 'new' | 'recommended' | 'watchlist';
  // Backend-provided enhanced data (snake_case from API)
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
  // Continue watching specific fields
  progress?: number;
  remaining_min?: number;
  days_until?: number;
  genre_highlight?: string;
  media_details?: {
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
  }[];
}

interface NotificationWidgetProps {
  widget: Widget;
  className?: string;
  initialData?: EnhancedNotification[];
}

const NotificationWidget: React.FC<NotificationWidgetProps> = ({ widget, className = '', initialData }) => {
  const navigate = useNavigate();
  const { isInMyList, toggleMyList, collections, addToCollection, fetchCollections } = useMyList();
  const config = parseWidgetConfig(widget.config);
  const apiUrl = getApiUrl();

  const [notifications, setNotifications] = useState<EnhancedNotification[]>(initialData || []);
  const [loading, setLoading] = useState(!initialData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [colors, setColors] = useState<DominantColors>(getColorPaletteByGenre());
  const [ytReady, setYtReady] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const autoScrollRef = useRef<NodeJS.Timeout | null>(null);
  const playerRef = useRef<any>(null);
  const fetchControllerRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<{ data: EnhancedNotification[]; timestamp: number } | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const CACHE_TTL = 7 * 60 * 1000; // 7 minutes cache for notifications (between 5-10 minutes)
  const REFRESH_INTERVAL = 8 * 60 * 1000; // 8 minutes refresh interval
  const STORAGE_KEY = 'homeflix_notifications_cache';

  // Helper function to clear expired cache
  const clearExpiredCache = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedCache = localStorage.getItem(STORAGE_KEY);
        if (storedCache) {
          const parsedCache = JSON.parse(storedCache);
          if (!parsedCache.timestamp || Date.now() - parsedCache.timestamp >= CACHE_TTL) {
            localStorage.removeItem(STORAGE_KEY);
          }
        }
      } catch (error) {
        // Invalid cache data, remove it
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, [CACHE_TTL, STORAGE_KEY]);

  // Initialize cache from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedCache = localStorage.getItem(STORAGE_KEY);
        if (storedCache) {
          const parsedCache = JSON.parse(storedCache);
          // Check if stored cache is still valid
          if (parsedCache.timestamp && Date.now() - parsedCache.timestamp < CACHE_TTL) {
            cacheRef.current = parsedCache;
            // If no initialData provided, use cached data
            if (!initialData || initialData.length === 0) {
              setNotifications(parsedCache.data || []);
              setLoading(false);
            }
          }
        }
      } catch (error) {
        // Invalid cache data, ignore
      }
    }
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const updateSize = () => {
      const width = element.getBoundingClientRect().width;
      setContainerWidth((prev) => (Math.abs(prev - width) > 1 ? width : prev));
    };

    updateSize();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateSize);
      return () => {
        window.removeEventListener('resize', updateSize);
      };
    }

    const resizeObserver = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.target === element) {
          const width = entry.contentRect.width;
          setContainerWidth((prev) => (Math.abs(prev - width) > 1 ? width : prev));
        }
      });
    });

    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const layoutVariant = useMemo<'full' | 'half' | 'third'>(() => {
    if (containerWidth >= 960) return 'full';
    if (containerWidth >= 640) return 'half';
    if (containerWidth > 0) return 'third';
    return 'full';
  }, [containerWidth]);

  const containerMinHeight = useMemo(() => {
    if (!containerWidth) {
      return 380;
    }

    // More compact heights for better responsiveness
    const ratio = layoutVariant === 'full' ? 0.4 : layoutVariant === 'half' ? 0.5 : 0.7;
    const minCap = layoutVariant === 'full' ? 350 : layoutVariant === 'half' ? 300 : 280;
    const maxCap = layoutVariant === 'full' ? 550 : layoutVariant === 'half' ? 450 : 400;
    const candidate = containerWidth * ratio;
    return Math.max(minCap, Math.min(maxCap, candidate));
  }, [containerWidth, layoutVariant]);

  const horizontalPaddingClasses = useMemo(() => {
    switch (layoutVariant) {
      case 'third':
        return 'px-3 sm:px-4';
      case 'half':
        return 'px-4 lg:px-6';
      default:
        return 'px-4 md:px-8 lg:px-12';
    }
  }, [layoutVariant]);

  const contentWidthClass = useMemo(() => {
    switch (layoutVariant) {
      case 'third':
        return 'max-w-full';
      case 'half':
        return 'max-w-xl xl:max-w-2xl';
      default:
        return 'max-w-2xl lg:max-w-3xl';
    }
  }, [layoutVariant]);

  // Responsive text sizes
  const titleSizeClass = useMemo(() => {
    switch (layoutVariant) {
      case 'third':
        return 'text-lg sm:text-xl';
      case 'half':
        return 'text-xl sm:text-2xl md:text-3xl';
      default:
        return 'text-2xl sm:text-3xl md:text-4xl lg:text-5xl';
    }
  }, [layoutVariant]);

  const messageSizeClass = useMemo(() => {
    switch (layoutVariant) {
      case 'third':
        return 'text-xs sm:text-sm';
      case 'half':
        return 'text-sm md:text-base';
      default:
        return 'text-sm md:text-base lg:text-lg';
    }
  }, [layoutVariant]);

  const posterSizeClass = useMemo(() => {
    switch (layoutVariant) {
      case 'third':
        return 'w-20 h-28';
      case 'half':
        return 'w-24 h-36';
      default:
        return 'w-28 h-40 md:w-32 md:h-48';
    }
  }, [layoutVariant]);

  // Create sample notifications when API doesn't return any
  const createSampleNotifications = useCallback(async (): Promise<Notification[]> => {
    try {
      // Try to fetch some movies from the local API to create realistic notifications
      const response = await fetch(`${apiUrl}/api/media/movies?limit=10`);
      if (response.ok) {
        const movies = await response.json();
        if (movies.length > 0) {
          return [
            // Movie recommendation with multiple movies
            {
              id: 'sample_recommendations',
              type: 'movie_suggestion',
              title: 'Recommended Movies for You',
              message: 'Based on your watch history, you might enjoy these!',
              timestamp: Date.now() / 1000 - 1800,
              movie_ids: movies.slice(0, 6).map((m: any) => m.id),
              tmdb_ids: movies.slice(0, 6).map((m: any) => m.tmdb_id).filter(Boolean),
              read: false
            },
            // Single trending movie
            {
              id: 'sample_trending',
              type: 'tmdb_now_playing',
              title: 'Trending Now',
              message: 'This movie is getting amazing reviews!',
              timestamp: Date.now() / 1000 - 3600,
              tmdb_ids: [550], // Fight Club as example
              read: false
            },
            // Coming soon
            {
              id: 'sample_upcoming',
              type: 'tmdb_upcoming',
              title: 'Coming Soon',
              message: 'Get ready for this upcoming blockbuster!',
              timestamp: Date.now() / 1000 - 7200,
              tmdb_ids: [1003579], // Avatar: Fire and Ash
              read: false
            }
          ];
        }
      }
    } catch (error) {
      // Could not fetch movies for sample notifications
    }

    // Fallback sample notifications with real TMDB IDs
    return [
      {
        id: 'sample_1',
        type: 'tmdb_trending',
        title: 'Trending Worldwide',
        message: 'These movies are breaking records and getting amazing reviews!',
        timestamp: Date.now() / 1000 - 1800,
        tmdb_ids: [550, 13, 680], // Multiple trending movies
        read: false
      },
      {
        id: 'sample_2',
        type: 'single_movie_suggestion',
        title: 'Perfect Match for You',
        message: 'Based on your viewing history, this movie is exactly what you need.',
        timestamp: Date.now() / 1000 - 3600,
        tmdb_ids: [155], // The Dark Knight
        read: false
      },
      {
        id: 'sample_3',
        type: 'tmdb_upcoming',
        title: 'Coming Soon to Theaters',
        message: 'Get ready for these highly anticipated blockbusters!',
        timestamp: Date.now() / 1000 - 7200,
        tmdb_ids: [1003579, 1022789], // Multiple upcoming movies
        read: false
      },
      {
        id: 'sample_4',
        type: 'tmdb_now_airing_tv',
        title: 'Now Airing',
        message: 'These popular series are currently airing new episodes!',
        timestamp: Date.now() / 1000 - 10800,
        tmdb_ids: [1399, 94605], // Game of Thrones, Arcane
        read: false
      }
    ];
  }, [apiUrl]);

  const fetchNotifications = useCallback(async () => {
    // Check cache first for instant load
    if (cacheRef.current && Date.now() - cacheRef.current.timestamp < CACHE_TTL) {
      setNotifications(cacheRef.current.data);
      setLoading(false);
      return;
    }

    // Abort any pending request
    if (fetchControllerRef.current) {
      fetchControllerRef.current.abort();
    }
    fetchControllerRef.current = new AbortController();

    try {
      // Only show loading for initial load, not for background refreshes
      const isInitialLoad = notifications.length === 0;
      if (isInitialLoad) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }

      const response = await fetch(
        `${apiUrl}/api/notifications?limit=${widget.maxItems || 10}`,
        {
          signal: fetchControllerRef.current.signal,
          headers: { 'Content-Type': 'application/json' }
        }
      );

      if (response.ok) {
        const data = await response.json();
        let filteredNotifications = filterNotifications(data.notifications || []);

        if (filteredNotifications.length === 0) {
          // Fallback to samples if no real notifications
          const samples = await createSampleNotifications();
          filteredNotifications = filterNotifications(samples);
        }

        if (filteredNotifications.length > 0) {
          filteredNotifications = await enhanceNotifications(filteredNotifications);

          filteredNotifications.sort((a, b) => {
            const priorityOrder: Record<string, number> = { high: 3, medium: 2, low: 1 };
            const aPriority = priorityOrder[(a as EnhancedNotification).priority || 'medium'];
            const bPriority = priorityOrder[(b as EnhancedNotification).priority || 'medium'];

            if (aPriority !== bPriority) return bPriority - aPriority;
            return b.timestamp - a.timestamp;
          });

          // Cache the results with current timestamp
          const cacheData = { data: filteredNotifications, timestamp: Date.now() };
          cacheRef.current = cacheData;
          
          // Also save to localStorage for persistence across sessions
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(cacheData));
            } catch (error) {
              // localStorage might be full or disabled, ignore
            }
          }
          
          setNotifications(filteredNotifications);
        } else {
          setNotifications([]);
        }
      } else {
        // API Error fallback - only use samples if we don't have cached data
        if (!cacheRef.current || cacheRef.current.data.length === 0) {
          const samples = await createSampleNotifications();
          let processed = await enhanceNotifications(filterNotifications(samples));
          setNotifications(processed);
        }
        // If we have cached data, keep using it even if API fails
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return; // Request was aborted, ignore
      }

      // Error fallback - only use samples if we don't have cached data
      if (!cacheRef.current || cacheRef.current.data.length === 0) {
        const samples = await createSampleNotifications();
        let processed = await enhanceNotifications(filterNotifications(samples));
        setNotifications(processed);
      }
      // If we have cached data, keep using it even if there's an error
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [apiUrl, widget.maxItems, createSampleNotifications, notifications.length]);

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

  // Extract YouTube video key from URL
  const extractYouTubeKey = (url: string): string | null => {
    if (!url) return null;
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?\s]+)/,
      /^([a-zA-Z0-9_-]{11})$/
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  useEffect(() => {
    if (!initialData || initialData.length === 0) {
      fetchNotifications();
    } else {
      setLoading(false); // Ensure loading is false when using initialData
    }

    // Cleanup on unmount
    return () => {
      if (fetchControllerRef.current) {
        fetchControllerRef.current.abort();
      }
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [initialData, fetchNotifications]);

  // Periodic refresh effect - refresh notifications every 8 minutes
  useEffect(() => {
    // Set up periodic refresh
    refreshIntervalRef.current = setInterval(() => {
      // Clear expired cache first
      clearExpiredCache();
      
      // Only refresh if we have notifications and component is still mounted
      if (notifications.length > 0) {
        fetchNotifications();
      }
    }, REFRESH_INTERVAL);

    // Cleanup interval on unmount
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [fetchNotifications, notifications.length, clearExpiredCache]);

  // Auto-scroll with hover pause - 3 seconds as requested, enabled by default
  useEffect(() => {
    if (notifications.length > 1) {
      // Auto-scroll is enabled by default (when config.autoScroll is undefined or true)
      const shouldAutoScroll = config.autoScroll !== false;
      if (shouldAutoScroll && !isHovering) {
        autoScrollRef.current = setInterval(() => {
          setCurrentIndex((prev) => (prev + 1) % notifications.length);
          setImageLoaded(false);
          setVideoReady(false);
        }, 5000); // 5 seconds auto-scroll for faster perceived performance
      }
    }
    return () => {
      if (autoScrollRef.current) clearInterval(autoScrollRef.current);
    };
  }, [notifications.length, isHovering, config.autoScroll]);

  // Initialize YouTube player when slide changes
  useEffect(() => {
    if (!ytReady || notifications.length === 0) return;

    const currentNotification = notifications[currentIndex];
    const trailerKey = getTrailerKey(currentNotification);

    if (!trailerKey) return;

    // Destroy previous player
    if (playerRef.current) {
      try {
        playerRef.current.destroy();
      } catch (e) {
        // Ignore
      }
      playerRef.current = null;
    }

    const timer = setTimeout(() => {
      const containerId = `yt-player-notification-${currentNotification.id}`;
      const container = document.getElementById(containerId);
      if (!container) return;

      playerRef.current = new window.YT.Player(containerId, {
        videoId: trailerKey,
        playerVars: {
          autoplay: 1,
          mute: isMuted ? 1 : 0,
          controls: 0,
          showinfo: 0,
          rel: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          playsinline: 1,
          disablekb: 1,
          fs: 0,
          cc_load_policy: 0,
          cc_lang_pref: '',
          enablejsapi: 1,
          start: 10,
          origin: window.location.origin,
        },
        events: {
          onStateChange: (event: any) => {
            if (event.data === 1) {
              setVideoReady(true);
            } else if (event.data === 0) {
              setVideoReady(false);
              setCurrentIndex((prev) => (prev + 1) % notifications.length);
            }
          },
          onReady: (event: any) => {
            if (!isMuted) {
              event.target.unMute();
            }
            event.target.seekTo(10, true);
            event.target.playVideo();
          },
        },
      });
    }, 100);

    return () => {
      clearTimeout(timer);
    };
  }, [ytReady, currentIndex, notifications, isMuted]);

  // Handle mute toggle
  useEffect(() => {
    if (playerRef.current && typeof playerRef.current.isMuted === 'function') {
      try {
        if (isMuted) {
          playerRef.current.mute();
        } else {
          playerRef.current.unMute();
        }
      } catch (e) {
        // Player might not be ready
      }
    }
  }, [isMuted]);

  const enhanceNotifications = async (notifications: Notification[]): Promise<EnhancedNotification[]> => {
    return notifications.map(notification => {
      let priority: 'high' | 'medium' | 'low' = 'medium';
      let category: 'trending' | 'new' | 'recommended' | 'watchlist' = 'new';

      const hoursSinceCreated = (Date.now() / 1000 - notification.timestamp) / 3600;

      switch (notification.type) {
        // High Priority - Trending
        case 'tmdb_now_playing':
        case 'tmdb_trending':
        case 'tmdb_now_airing_tv':
        case 'local_trending':
          priority = hoursSinceCreated < 24 ? 'high' : 'medium';
          category = 'trending';
          break;
        // Medium Priority - Coming Soon
        case 'tmdb_upcoming':
        case 'tmdb_upcoming_tv':
        case 'tmdb_coming_soon':
          priority = 'medium';
          category = 'new';
          break;
        // Medium Priority - Recommendations
        case 'movie_suggestion':
        case 'single_movie_suggestion':
        case 'genre_based':
          priority = 'medium';
          category = 'recommended';
          break;
        // Low Priority - Watch Again
        case 'watch_again':
        case 'continue_watching':
          priority = 'low';
          category = 'watchlist';
          break;
        // High Priority - New Content
        case 'new_episodes':
        case 'new_movies':
        case 'recently_added':
          priority = hoursSinceCreated < 12 ? 'high' : 'medium';
          category = 'new';
          break;
        // Low Priority - System
        case 'download_complete':
          priority = 'low';
          category = 'new';
          break;
        default:
          priority = 'medium';
          category = 'new';
      }

      return {
        ...notification,
        priority,
        category,
        enhanced_data: {}
      };
    });
  };

  const filterNotifications = (notifications: Notification[]) => {
    if (!config.notificationTypes || config.notificationTypes.length === 0) {
      return notifications;
    }

    return notifications.filter(notification =>
      config.notificationTypes!.includes(notification.type)
    );
  };

  const getThemeColors = (notification: EnhancedNotification) => {
    // Use backend-provided genres for theme colors
    if (notification.genres && notification.genres.length > 0) {
      return getColorPaletteByGenre(notification.genres);
    }

    switch (notification.category) {
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

  const handleNotificationClick = (notification: EnhancedNotification, index?: number) => {
    // Handle continue watching and local content
    if (
      notification.type === 'continue_watching' ||
      notification.type === 'recently_added' ||
      notification.type === 'local_trending' ||
      notification.type === 'genre_based' ||
      notification.type === 'watch_again'
    ) {
      if (notification.movie_ids && notification.movie_ids.length > 0) {
        const movieId = index !== undefined && notification.movie_ids[index]
          ? notification.movie_ids[index]
          : notification.movie_ids[0];
        if (movieId && movieId > 0) {
          navigate.push(`/movie/${movieId}`);
        }
      }
      return;
    }

    // Handle TMDB content
    if (
      notification.type === 'tmdb_upcoming' ||
      notification.type === 'tmdb_now_playing' ||
      notification.type === 'tmdb_trending' ||
      notification.type === 'tmdb_upcoming_tv' ||
      notification.type === 'tmdb_now_airing_tv' ||
      notification.type === 'tmdb_coming_soon'
    ) {
      if (notification.tmdb_ids && notification.tmdb_ids.length > 0) {
        const tmdbId = index !== undefined ? notification.tmdb_ids[index] : notification.tmdb_ids[0];
        // Check if it's a TV series notification
        if (notification.type === 'tmdb_upcoming_tv' || notification.type === 'tmdb_now_airing_tv') {
          navigate.push(`/tmdb-movie/${tmdbId}?type=tv`);
        } else {
          navigate.push(`/tmdb-movie/${tmdbId}?type=movie`);
        }
      }
      return;
    }

    // Handle episodes
    if (notification.type === 'new_episodes' && notification.series_id) {
      navigate.push(`/tv-series/${notification.series_id}`);
      return;
    }

    // Handle movie suggestions and new movies
    if (
      notification.type === 'movie_suggestion' ||
      notification.type === 'single_movie_suggestion' ||
      notification.type === 'new_movies'
    ) {
      if (notification.movie_ids && notification.movie_ids.length > 0) {
        const movieId = index !== undefined ? notification.movie_ids[index] : notification.movie_ids[0];
        if (movieId && movieId > 0) {
          navigate.push(`/movie/${movieId}`);
        }
      }
      return;
    }

    // Default: try movie IDs first, then TMDB IDs
    if (notification.movie_ids && notification.movie_ids.length > 0) {
      const movieId = index !== undefined ? notification.movie_ids[index] : notification.movie_ids[0];
      if (movieId && movieId > 0) {
        navigate.push(`/movie/${movieId}`);
      }
    } else if (notification.tmdb_ids && notification.tmdb_ids.length > 0) {
      const tmdbId = index !== undefined ? notification.tmdb_ids[index] : notification.tmdb_ids[0];
      navigate.push(`/tmdb-movie/${tmdbId}?type=movie`);
    }
  };

  const getNotificationIcon = (type: string, priority?: string) => {
    const iconProps = {
      className: `w-4 h-4 ${priority === 'high' ? 'animate-pulse' : ''}`,
      style: { filter: priority === 'high' ? 'drop-shadow(0 0 8px currentColor)' : undefined }
    };

    switch (type) {
      // Upcoming & Coming Soon
      case 'tmdb_upcoming':
      case 'tmdb_upcoming_tv':
      case 'tmdb_coming_soon':
        return <Calendar {...iconProps} />;
      // Now Playing/Airing
      case 'tmdb_now_playing':
      case 'tmdb_now_airing_tv':
        return <Sparkles {...iconProps} />;
      // Trending
      case 'tmdb_trending':
      case 'local_trending':
        return <TrendingUp {...iconProps} />;
      // Episodes
      case 'new_episodes':
        return <Tv {...iconProps} />;
      // New/Recently Added
      case 'new_movies':
      case 'recently_added':
        return <Plus {...iconProps} />;
      // Recommendations
      case 'movie_suggestion':
        return <Award {...iconProps} />;
      case 'single_movie_suggestion':
        return <Star {...iconProps} />;
      // Continue/Watch Again
      case 'watch_again':
      case 'continue_watching':
        return <RotateCcw {...iconProps} />;
      // Genre Based
      case 'genre_based':
        return <Heart {...iconProps} />;
      // System
      case 'download_complete':
        return <Check {...iconProps} />;
      // Default
      default:
        return <Bell {...iconProps} />;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'trending':
        return <TrendingUp className="w-3 h-3" />;
      case 'new':
        return <Zap className="w-3 h-3" />;
      case 'recommended':
        return <Heart className="w-3 h-3" />;
      case 'watchlist':
        return <Eye className="w-3 h-3" />;
      default:
        return <Bell className="w-3 h-3" />;
    }
  };

  const getPriorityBadge = (priority: string) => {
    const badges = {
      high: { text: 'HOT', color: '#ff4444', glow: 'shadow-red-500/50' },
      medium: { text: 'NEW', color: '#ffa500', glow: 'shadow-orange-500/50' },
      low: { text: '', color: '#888888', glow: '' }
    };

    const badge = badges[priority as keyof typeof badges] || badges.medium;

    if (!badge.text) return null;

    return (
      <div
        className={`px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${badge.glow} shadow-lg`}
        style={{
          backgroundColor: badge.color,
          color: 'white',
          textShadow: '0 0 10px rgba(0,0,0,0.8)'
        }}
      >
        {badge.text}
      </div>
    );
  };

  // This function is no longer needed as we use the hook directly

  const handlePrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + notifications.length) % notifications.length);
    setImageLoaded(false);
    setVideoReady(false);
  }, [notifications.length]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % notifications.length);
    setImageLoaded(false);
    setVideoReady(false);
  }, [notifications.length]);

  const getBackdropUrl = (notification: EnhancedNotification) => {
    // Use backend-provided backdrop URL
    if (notification.backdrop_url) {
      // Handle relative paths from backend
      if (notification.backdrop_url.startsWith('/api/')) {
        return `${apiUrl}${notification.backdrop_url}`;
      }
      return notification.backdrop_url;
    }

    // Fallback for local media
    if (notification.movie_ids && notification.movie_ids.length > 0) {
      return `${apiUrl}/api/thumbnails/${notification.movie_ids[0]}`;
    }

    return null;
  };

  const getLogoUrl = (notification: EnhancedNotification) => {
    // Use backend-provided logo URL
    if (notification.logo_url) {
      // Handle relative paths from backend
      if (notification.logo_url.startsWith('/api/')) {
        return `${apiUrl}${notification.logo_url}`;
      }
      return notification.logo_url;
    }
    return null;
  };

  const getPosterUrl = (notification: EnhancedNotification) => {
    // Use backend-provided poster URL
    if (notification.poster_url) {
      // Handle relative paths from backend
      if (notification.poster_url.startsWith('/api/')) {
        return `${apiUrl}${notification.poster_url}`;
      }
      return notification.poster_url;
    }

    // Fallback for local media
    if (notification.movie_ids && notification.movie_ids.length > 0) {
      return `${apiUrl}/api/posters/${notification.movie_ids[0]}`;
    }

    return null;
  };

  const getMovieDetails = (notification: EnhancedNotification) => {
    // Create movie details from backend-enhanced notification data
    if (!notification.backdrop_url && !notification.poster_url && !notification.overview) {
      return null;
    }

    return {
      id: notification.tmdb_ids?.[0] || notification.movie_ids?.[0] || 0,
      title: notification.tmdb_titles?.[0] || notification.title,
      name: notification.tmdb_titles?.[0] || notification.title,
      overview: notification.overview || 'No description available',
      backdrop_path: notification.backdrop_url?.replace('https://image.tmdb.org/t/p/w1280', '') || '',
      poster_path: notification.poster_url?.replace('https://image.tmdb.org/t/p/w500', '') || '',
      release_date: notification.release_date || '',
      first_air_date: notification.release_date || '',
      vote_average: notification.rating || 0,
      genres: (notification.genres || []).map((name, index) => ({ id: index, name })),
      runtime: notification.runtime || 0,
      episode_run_time: notification.runtime ? [notification.runtime] : [],
      logo_path: notification.logo_url?.replace('https://image.tmdb.org/t/p/w500', '') || '',
      media_type: notification.type?.includes('tv') ? 'tv' : 'movie',
      original_language: notification.language || 'en',
      popularity: notification.popularity || 0,
      adult: false,
      tagline: notification.tagline || '',
      production_companies: (notification.companies || []).map((name, index) => ({
        id: index,
        name,
        logo_path: ''
      })),
      videos: notification.trailer_key ? {
        results: [{
          key: notification.trailer_key,
          type: 'Trailer',
          site: 'YouTube',
          name: 'Official Trailer',
          official: true
        }]
      } : { results: [] }
    };
  };

  const getAllMovieDetails = (notification: EnhancedNotification) => {
    // Use backend-provided media details if available
    if (notification.media_details && notification.media_details.length > 0) {
      return notification.media_details.map(media => {
        // Handle poster URL - prepend API URL if it's a relative path
        let posterUrl = media.poster_url || '';
        if (posterUrl && posterUrl.startsWith('/api/')) {
          posterUrl = `${apiUrl}${posterUrl}`;
        }

        // Handle backdrop URL - prepend API URL if it's a relative path
        let backdropUrl = media.backdrop_url || '';
        if (backdropUrl && backdropUrl.startsWith('/api/')) {
          backdropUrl = `${apiUrl}${backdropUrl}`;
        }

        return {
          id: media.id,
          title: media.title,
          name: media.title,
          overview: media.overview || 'No description available',
          backdrop_path: backdropUrl,
          poster_path: posterUrl,
          release_date: media.year ? `${media.year}-01-01` : '',
          vote_average: media.rating || 0,
          genres: (media.genres || []).map((name, index) => ({ id: index, name })),
          runtime: media.runtime || 0,
          media_type: media.source_type === 'tmdb' ? 'movie' : 'movie',
          original_language: 'en',
          popularity: 0,
          adult: false,
          sourceType: media.source_type,
          sourceId: media.source_id
        };
      });
    }

    // Fallback: create single movie detail from main notification data
    const singleMovie = getMovieDetails(notification);
    return singleMovie ? [{ ...singleMovie, sourceType: 'backend', sourceId: notification.id }] : [];
  };

  const getTrailerKey = (notification: EnhancedNotification) => {
    // Use backend-provided trailer key
    return notification.trailer_key || null;
  };

  const formatTimestamp = (timestamp: number) => {
    const now = Date.now() / 1000;
    const diff = now - timestamp;

    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className={`relative overflow-hidden rounded-xl border border-white/10 backdrop-blur-sm ${className}`} style={{ minHeight: `${containerMinHeight}px` }}>
        <div className="h-full bg-gradient-to-br from-gray-900 via-gray-800 to-black relative" style={{ minHeight: `${containerMinHeight}px` }}>
          <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 via-blue-500/5 to-purple-500/5" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className={`relative overflow-hidden rounded-xl border border-white/10 backdrop-blur-sm h-full ${className}`}>
        <div className="h-full bg-gradient-to-br from-gray-900/50 via-gray-800/50 to-black/50 backdrop-blur-sm">
          <div className="absolute inset-0 flex items-center justify-center text-center p-8">
            <div className="space-y-6">
              <div className="relative">
                <div className="w-20 h-20 bg-gradient-to-br from-red-500/20 to-red-600/20 rounded-full flex items-center justify-center mx-auto backdrop-blur-sm border border-red-400/30">
                  <Bell className="w-10 h-10 text-red-300" />
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-white">No Notifications</h3>
                <p className="text-gray-400 max-w-sm">
                  No new updates available at the moment.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentNotification = notifications[currentIndex];
  const themeColors = getThemeColors(currentNotification);
  const backdropUrl = getBackdropUrl(currentNotification);
  const logoUrl = getLogoUrl(currentNotification);
  const trailerKey = getTrailerKey(currentNotification);

  // Enhanced Banner style (default)
  if (config.highlightStyle === 'banner' || !config.highlightStyle) {
    return (
      <div
        ref={containerRef}
        className={`relative overflow-hidden rounded-xl border border-white/10 backdrop-blur-sm h-full ${className}`}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        style={{
          background: `linear-gradient(135deg, ${themeColors.primary}05 0%, transparent 50%, ${themeColors.accent}05 100%)`,
          boxShadow: `0 8px 32px ${themeColors.primary}20, inset 0 1px 0 rgba(255,255,255,0.1)`,
          minHeight: `${containerMinHeight}px`
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="relative h-full"
            style={{ background: themeColors.background }}
          >
            {/* Background Image with Parallax Effect */}
            {backdropUrl && (
              <motion.div
                initial={{ scale: 1.1 }}
                animate={{ scale: imageLoaded ? 1 : 1.1 }}
                transition={{ duration: 1.2, ease: "easeOut" }}
                className="absolute inset-0"
              >
                <img
                  src={backdropUrl}
                  alt="Backdrop"
                  className="w-full h-full object-cover"
                  onLoad={() => setImageLoaded(true)}
                  onError={() => setImageLoaded(true)}
                />
              </motion.div>
            )}

            {/* YouTube Player */}
            <AnimatePresence mode="wait">
              {trailerKey && (
                <motion.div
                  key={`video-${currentNotification.id}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: videoReady ? 1 : 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden pointer-events-none"
                >
                  <div className="relative w-full h-full overflow-hidden">
                    <div
                      id={`yt-player-notification-${currentNotification.id}`}
                      className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
                      style={{
                        width: '120vw',
                        height: '120vh',
                        minWidth: '200vh',
                        minHeight: '70vw',
                        pointerEvents: 'none'
                      }}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Dynamic Gradient Overlays */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
            <div
              className="absolute bottom-0 left-0 right-0 h-32"
              style={{
                background: `linear-gradient(to top, ${themeColors.primary}15 0%, transparent 100%)`
              }}
            />

            {/* Floating Elements */}
            <div className={`absolute top-4 right-4 flex items-center gap-2 z-20 ${layoutVariant === 'third' ? 'scale-90' : ''}`}>
              {/* Refresh indicator */}
              {isRefreshing && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-full backdrop-blur-md border border-white/20 bg-white/10">
                  <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                  <span className="text-xs text-white/80 font-medium">Updating</span>
                </div>
              )}
              {getPriorityBadge(currentNotification.priority || 'medium')}
              {layoutVariant !== 'third' && (
                <div
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded-full backdrop-blur-md border text-xs"
                  style={{
                    backgroundColor: `${themeColors.primary}20`,
                    borderColor: `${themeColors.primary}40`
                  }}
                >
                  {getCategoryIcon(currentNotification.category || 'new')}
                  <span className="font-medium text-white uppercase tracking-wider">
                    {currentNotification.category}
                  </span>
                </div>
              )}
            </div>

            {/* Main Content */}
            <div className="absolute inset-0 flex items-center z-20">
              <div className={`w-full ${horizontalPaddingClasses}`}>
                <div className={contentWidthClass}>
                  {/* Logo or Title */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`${currentIndex}-title`}
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.6, delay: 0.2 }}
                      className={layoutVariant === 'third' ? 'mb-3' : 'mb-4'}
                    >
                      {config.showNotificationIcon && (
                        <div className={`flex items-center gap-2 ${layoutVariant === 'third' ? 'mb-2' : 'mb-3'}`}>
                          <div
                            className={`rounded-full backdrop-blur-md border ${layoutVariant === 'third' ? 'p-1.5' : 'p-2'}`}
                            style={{
                              backgroundColor: `${themeColors.primary}30`,
                              borderColor: `${themeColors.primary}50`,
                              boxShadow: `0 0 20px ${themeColors.primary}40`
                            }}
                          >
                            {getNotificationIcon(currentNotification.type, currentNotification.priority)}
                          </div>
                          {config.showTimestamp && (
                            <div className={`text-white/70 font-medium ${layoutVariant === 'third' ? 'text-xs' : 'text-sm'}`}>
                              {formatTimestamp(currentNotification.timestamp)}
                            </div>
                          )}
                        </div>
                      )}

                      {logoUrl ? (
                        <img
                          src={logoUrl}
                          alt={currentNotification.title}
                          className={`w-auto drop-shadow-2xl ${layoutVariant === 'third' ? 'max-h-10' : layoutVariant === 'half' ? 'max-h-14' : 'max-h-16 md:max-h-20'
                            }`}
                          style={{ filter: 'drop-shadow(0 0 20px rgba(0,0,0,0.8))' }}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                            if (fallback) fallback.style.display = 'block';
                          }}
                        />
                      ) : null}

                      <h1
                        className={`font-bold leading-tight ${titleSizeClass}`}
                        style={{
                          display: logoUrl ? 'none' : 'block',
                          textShadow: `0 0 30px ${themeColors.primary}60, 0 4px 15px rgba(0,0,0,0.8)`,
                          background: `linear-gradient(135deg, ${themeColors.primary} 0%, ${themeColors.accent} 100%)`,
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text'
                        }}
                      >
                        {config.title || currentNotification.title}
                      </h1>
                    </motion.div>
                  </AnimatePresence>

                  {/* Enhanced Message with Movie Details */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className={layoutVariant === 'third' ? 'mb-2' : 'mb-3'}
                  >
                    <p className={`text-white/90 max-w-2xl leading-relaxed ${layoutVariant === 'third' ? 'text-xs line-clamp-1' : layoutVariant === 'half' ? 'text-sm line-clamp-2 mb-2' : 'text-sm md:text-base line-clamp-2 mb-3'
                      }`}>
                      {currentNotification.message}
                    </p>

                    {/* Show movie details based on notification type */}
                    {(() => {
                      const allMovies = getAllMovieDetails(currentNotification);
                      const singleMovie = getMovieDetails(currentNotification);

                      // Continue Watching UI with progress bars (like ContinueWatching.tsx)
                      if (currentNotification.type === 'continue_watching' && allMovies.length > 0) {
                        return (
                          <div className={layoutVariant === 'third' ? 'mb-2' : 'mb-4'}>
                            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                              <style jsx>{`
                                .scrollbar-hide::-webkit-scrollbar {
                                  display: none;
                                }
                              `}</style>
                              {allMovies.slice(0, layoutVariant === 'third' ? 3 : 5).map((movie, idx) => {
                                const progress = idx === 0 ? (currentNotification.progress || 0) : Math.random() * 60 + 20;
                                return (
                                  <motion.div
                                    key={`continue_${movie.sourceId}`}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.1 * idx }}
                                    className="flex-shrink-0 cursor-pointer group"
                                    onClick={() => handleNotificationClick(currentNotification, idx)}
                                  >
                                    <div className={`relative rounded-xl overflow-hidden border border-white/20 group-hover:border-white/40 transition-all group-hover:scale-105 shadow-lg ${layoutVariant === 'third' ? 'w-28 h-16' : 'w-40 h-24'
                                      }`}>
                                      <img
                                        src={movie.backdrop_path?.startsWith('http')
                                          ? movie.backdrop_path
                                          : movie.poster_path?.startsWith('http')
                                            ? movie.poster_path
                                            : `${apiUrl}/api/thumbnails/${movie.sourceId}`
                                        }
                                        alt={movie.title || movie.name}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                          e.currentTarget.src = `${apiUrl}/api/thumbnails/${movie.sourceId}`;
                                        }}
                                      />
                                      {/* Gradient overlay */}
                                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                                      {/* Progress bar */}
                                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                                        <motion.div
                                          className="h-full bg-red-600"
                                          initial={{ width: 0 }}
                                          animate={{ width: `${progress}%` }}
                                          transition={{ duration: 0.8, delay: idx * 0.1 }}
                                        />
                                      </div>

                                      {/* Title and progress info */}
                                      <div className="absolute bottom-1 left-2 right-2">
                                        <p className="text-white text-xs font-medium line-clamp-1 drop-shadow-lg">
                                          {movie.title}
                                        </p>
                                        <div className="flex items-center justify-between mt-0.5">
                                          <span className="text-white/70 text-[10px]">{Math.round(progress)}%</span>
                                          {movie.vote_average > 0 && (
                                            <div className="flex items-center gap-0.5">
                                              <Star className="w-2 h-2 text-yellow-400 fill-current" />
                                              <span className="text-white/70 text-[10px]">{movie.vote_average.toFixed(1)}</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      {/* Play button on hover */}
                                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                                        <div className="bg-white/90 rounded-full p-2">
                                          <Play className="w-4 h-4 text-black fill-black" />
                                        </div>
                                      </div>
                                    </div>
                                  </motion.div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }

                      // Only show recommendation cards for multi-movie suggestions (more than 1 movie)
                      if (currentNotification.type === 'movie_suggestion' && allMovies.length > 1) {
                        return (
                          <div className={layoutVariant === 'third' ? 'mb-2' : 'mb-4'}>
                            <h4 className={`font-semibold text-white ${layoutVariant === 'third' ? 'text-sm mb-1' : 'text-base mb-2'}`}>Recommended</h4>
                            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                              <style jsx>{`
                                .scrollbar-hide::-webkit-scrollbar {
                                  display: none;
                                }
                              `}</style>
                              {allMovies.slice(0, layoutVariant === 'third' ? 3 : 6).map((movie, idx) => (
                                <motion.div
                                  key={`${movie.sourceType}_${movie.sourceId}`}
                                  initial={{ opacity: 0, x: 20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: 0.1 * idx }}
                                  className="flex-shrink-0 cursor-pointer group"
                                  onClick={() => handleNotificationClick(currentNotification, idx)}
                                >
                                  <div className={`relative rounded-lg overflow-hidden border border-white/20 group-hover:border-white/40 transition-all group-hover:scale-105 ${layoutVariant === 'third' ? 'w-14 h-20' : 'w-20 h-28'
                                    }`}>
                                    <img
                                      src={movie.poster_path?.startsWith('http')
                                        ? movie.poster_path
                                        : movie.sourceType === 'tmdb'
                                          ? `https://image.tmdb.org/t/p/w300${movie.poster_path}`
                                          : `${apiUrl}/api/posters/${movie.sourceId}`
                                      }
                                      alt={movie.title || movie.name}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        e.currentTarget.src = `${apiUrl}/api/thumbnails/${movie.sourceId}`;
                                      }}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </div>
                                </motion.div>
                              ))}
                            </div>
                          </div>
                        );
                      }

                      // For all other notifications (single movies, trending, upcoming, single suggestions), show individual poster and details
                      if (singleMovie && singleMovie.title !== `Movie ${singleMovie.id}`) {
                        return (
                          <div className={`flex items-start gap-2 ${layoutVariant === 'third' ? 'mb-2' : 'mb-3'}`}>
                            {/* Enhanced Poster */}
                            {getPosterUrl(currentNotification) && (
                              <div className="relative flex-shrink-0">
                                <img
                                  src={getPosterUrl(currentNotification)!}
                                  alt="Movie Poster"
                                  className={`object-cover rounded-lg shadow-xl border border-white/20 ${posterSizeClass}`}
                                  onError={(e) => {
                                    if (currentNotification.movie_ids && currentNotification.movie_ids[0]) {
                                      e.currentTarget.src = `${apiUrl}/api/thumbnails/${currentNotification.movie_ids[0]}`;
                                    }
                                  }}
                                />
                                {/* Rating Badge on Poster */}
                                {singleMovie.vote_average > 0 && layoutVariant !== 'third' && (
                                  <div className="absolute top-1 left-1">
                                    <div
                                      className="flex items-center gap-0.5 px-1 py-0.5 rounded-full backdrop-blur-md border text-xs"
                                      style={{
                                        backgroundColor: `${themeColors.primary}30`,
                                        borderColor: `${themeColors.primary}50`
                                      }}
                                    >
                                      <Star className="w-2 h-2 text-yellow-400 fill-current" />
                                      <span className="font-semibold text-white text-[10px]">
                                        {singleMovie.vote_average.toFixed(1)}
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Enhanced Movie Details */}
                            <div className="flex-1 min-w-0">
                              <h3 className={`font-bold text-white leading-tight line-clamp-2 ${layoutVariant === 'third' ? 'text-sm mb-1' : layoutVariant === 'half' ? 'text-base mb-1' : 'text-lg md:text-xl mb-2'
                                }`}>
                                {singleMovie.title || singleMovie.name}
                              </h3>

                              {/* Enhanced Meta Information - Compact */}
                              <div className={`flex flex-wrap items-center gap-1.5 ${layoutVariant === 'third' ? 'mb-1' : 'mb-2'}`}>
                                {singleMovie.release_date && (
                                  <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-[10px]">
                                    <Calendar className="w-2.5 h-2.5 text-white/80" />
                                    <span className="text-white font-medium">
                                      {new Date(singleMovie.release_date).getFullYear()}
                                    </span>
                                  </div>
                                )}

                                {singleMovie.runtime && singleMovie.runtime > 0 && layoutVariant === 'full' && (
                                  <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-[10px]">
                                    <Clock className="w-2.5 h-2.5 text-white/80" />
                                    <span className="text-white font-medium">
                                      {Math.floor(singleMovie.runtime / 60)}h {singleMovie.runtime % 60}m
                                    </span>
                                  </div>
                                )}

                                {/* Rating badge for third layout */}
                                {singleMovie.vote_average > 0 && layoutVariant === 'third' && (
                                  <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-[10px]">
                                    <Star className="w-2.5 h-2.5 text-yellow-400 fill-current" />
                                    <span className="text-white font-medium">
                                      {singleMovie.vote_average.toFixed(1)}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Enhanced Genres - Compact */}
                              {singleMovie.genres && singleMovie.genres.length > 0 && layoutVariant !== 'third' && (
                                <div className="flex flex-wrap gap-1 mb-1">
                                  {singleMovie.genres.slice(0, layoutVariant === 'half' ? 2 : 3).map((genre) => (
                                    <span
                                      key={genre.id}
                                      className="px-1.5 py-0.5 text-[10px] rounded-full border font-medium"
                                      style={{
                                        backgroundColor: `${themeColors.primary}20`,
                                        borderColor: `${themeColors.primary}40`,
                                        color: themeColors.accent
                                      }}
                                    >
                                      {genre.name}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Enhanced Description - Only on full layout */}
                              {singleMovie.overview && singleMovie.overview !== 'Details not available' && layoutVariant === 'full' && (
                                <p className="text-white/80 text-xs leading-relaxed line-clamp-2 max-w-lg">
                                  {singleMovie.overview}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      }

                      return null;
                    })()}
                  </motion.div>

                  {/* Enhanced Action Buttons */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                    className={`flex items-center gap-2 ${layoutVariant === 'third' ? 'mt-3' : 'mt-4'}`}
                  >
                    <button
                      onClick={() => handleNotificationClick(currentNotification)}
                      className={`flex items-center gap-1.5 bg-white text-black font-semibold rounded-md hover:bg-white/90 transition-all transform hover:scale-105 shadow-lg ${layoutVariant === 'third' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'
                        }`}
                    >
                      <Play className={layoutVariant === 'third' ? 'w-3 h-3 fill-current' : 'w-3.5 h-3.5 fill-current'} />
                      {layoutVariant === 'third' ? 'Watch' : 'Watch Now'}
                    </button>

                    <button
                      onClick={() => handleNotificationClick(currentNotification)}
                      className={`flex items-center gap-1.5 backdrop-blur-md border font-medium rounded-md transition-all hover:scale-105 ${layoutVariant === 'third' ? 'px-2 py-1 text-xs' : 'px-2.5 py-1.5 text-sm'
                        }`}
                      style={{
                        backgroundColor: `${themeColors.primary}20`,
                        borderColor: `${themeColors.primary}50`,
                        color: 'white'
                      }}
                    >
                      <Info className={layoutVariant === 'third' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
                      {layoutVariant === 'third' ? 'Info' : 'More Info'}
                    </button>

                    {/* MyListTooltip for Add to List */}
                    <MyListTooltip
                      media={{
                        id: currentNotification.tmdb_ids?.[0] ? parseInt(`9${currentNotification.tmdb_ids[0]}`) : (currentNotification.movie_ids?.[0] || 0),
                        title: currentNotification.title,
                        type: currentNotification.type?.includes('tv') ? 'episode' : 'movie',
                        year: currentNotification.release_date ? new Date(currentNotification.release_date).getFullYear() : new Date().getFullYear(),
                        rating: currentNotification.rating || 0,
                        genres: (currentNotification.genres || []).map((name, index) => ({ id: index, name })),
                        tmdb_id: currentNotification.tmdb_ids?.[0],
                        poster_url: currentNotification.poster_url,
                        description: currentNotification.overview
                      }}
                      isInMyList={isInMyList(currentNotification.tmdb_ids?.[0] ? parseInt(`9${currentNotification.tmdb_ids[0]}`) : (currentNotification.movie_ids?.[0] || 0))}
                      collections={collections}
                      onToggleMyList={() => toggleMyList(currentNotification.tmdb_ids?.[0] ? parseInt(`9${currentNotification.tmdb_ids[0]}`) : (currentNotification.movie_ids?.[0] || 0))}
                      onAddToCollection={(collectionId) => addToCollection(collectionId, currentNotification.tmdb_ids?.[0] ? parseInt(`9${currentNotification.tmdb_ids[0]}`) : (currentNotification.movie_ids?.[0] || 0))}
                      onCollectionCreated={fetchCollections}
                    >
                      <button
                        className={`backdrop-blur-md rounded-full border transition-all hover:scale-110 ${layoutVariant === 'third' ? 'p-1' : 'p-1.5'
                          }`}
                        style={{
                          backgroundColor: isInMyList(currentNotification.tmdb_ids?.[0] ? parseInt(`9${currentNotification.tmdb_ids[0]}`) : (currentNotification.movie_ids?.[0] || 0)) ? `${themeColors.primary}40` : `${themeColors.primary}20`,
                          borderColor: `${themeColors.primary}50`
                        }}
                      >
                        {isInMyList(currentNotification.tmdb_ids?.[0] || currentNotification.movie_ids?.[0] || 0) ?
                          <Check className={layoutVariant === 'third' ? 'w-3 h-3' : 'w-3.5 h-3.5'} style={{ color: themeColors.primary }} /> :
                          <Plus className={layoutVariant === 'third' ? 'w-3 h-3 text-white' : 'w-3.5 h-3.5 text-white'} />
                        }
                      </button>
                    </MyListTooltip>

                    {trailerKey && (
                      <button
                        onClick={() => setIsMuted(!isMuted)}
                        className={`backdrop-blur-md rounded-full border transition-all hover:scale-110 ${layoutVariant === 'third' ? 'p-1' : 'p-1.5'
                          }`}
                        style={{
                          backgroundColor: `${themeColors.primary}20`,
                          borderColor: `${themeColors.primary}50`
                        }}
                      >
                        {isMuted ?
                          <VolumeX className={layoutVariant === 'third' ? 'w-3 h-3 text-white' : 'w-3.5 h-3.5 text-white'} /> :
                          <Volume2 className={layoutVariant === 'third' ? 'w-3 h-3 text-white' : 'w-3.5 h-3.5 text-white'} />
                        }
                      </button>
                    )}
                  </motion.div>
                </div>
              </div>
            </div>

            {/* Navigation Controls */}
            {notifications.length > 1 && (
              <>
                <motion.button
                  onClick={handlePrevious}
                  className={`absolute left-2 top-1/2 -translate-y-1/2 backdrop-blur-md rounded-full border transition-all z-30 ${layoutVariant === 'third' ? 'p-1' : 'p-1.5'
                    }`}
                  style={{
                    backgroundColor: `${themeColors.primary}20`,
                    borderColor: `${themeColors.primary}40`,
                    opacity: isHovering ? 1 : 0
                  }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <ChevronLeft className={layoutVariant === 'third' ? 'w-4 h-4 text-white' : 'w-5 h-5 text-white'} />
                </motion.button>

                <motion.button
                  onClick={handleNext}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 backdrop-blur-md rounded-full border transition-all z-30 ${layoutVariant === 'third' ? 'p-1' : 'p-1.5'
                    }`}
                  style={{
                    backgroundColor: `${themeColors.primary}20`,
                    borderColor: `${themeColors.primary}40`,
                    opacity: isHovering ? 1 : 0
                  }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <ChevronRight className={layoutVariant === 'third' ? 'w-4 h-4 text-white' : 'w-5 h-5 text-white'} />
                </motion.button>
              </>
            )}

            {/* Enhanced Progress Indicators */}
            {notifications.length > 1 && (
              <div className={`absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-30 ${layoutVariant === 'third' ? 'bottom-3' : 'bottom-4'
                }`}>
                {notifications.slice(0, layoutVariant === 'third' ? 5 : 8).map((notification, idx) => (
                  <motion.button
                    key={idx}
                    onClick={() => {
                      setCurrentIndex(idx);
                      setImageLoaded(false);
                      setVideoReady(false);
                    }}
                    className="relative group"
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <div
                      className={`rounded-full transition-all duration-300 ${idx === currentIndex
                        ? layoutVariant === 'third' ? 'w-5 h-1' : 'w-6 h-1'
                        : 'w-1.5 h-1.5'
                        }`}
                      style={{
                        backgroundColor: idx === currentIndex ? themeColors.primary : 'rgba(255,255,255,0.4)',
                        boxShadow: idx === currentIndex ? `0 0 8px ${themeColors.primary}80` : 'none'
                      }}
                    />
                  </motion.button>
                ))}
                {notifications.length > (layoutVariant === 'third' ? 5 : 8) && (
                  <span className="text-[10px] text-white/50 ml-1 font-medium">
                    +{notifications.length - (layoutVariant === 'third' ? 5 : 8)}
                  </span>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  // Return minimal style for other configurations
  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Bell className="w-5 h-5 text-red-400" />
          Recent Updates
        </h3>
        <div className="text-sm text-white/60">
          {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
        </div>
      </div>
      {notifications.slice(0, widget.maxItems || 8).map((notification, index) => (
        <div key={notification.id} className="p-4 rounded-xl bg-gray-800/50 border border-gray-700 cursor-pointer hover:bg-gray-700/50 transition-colors" onClick={() => handleNotificationClick(notification)}>
          <div className="flex items-center gap-3">
            {getNotificationIcon(notification.type, (notification as EnhancedNotification).priority)}
            <div className="flex-1">
              <p className="text-white font-medium">{notification.title}</p>
              <p className="text-gray-400 text-sm">{notification.message}</p>
              {config.showTimestamp && (
                <p className="text-xs text-gray-500 mt-1">
                  {formatTimestamp(notification.timestamp)}
                </p>
              )}
            </div>
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </div>
        </div>
      ))}
    </div>
  );
};

export default NotificationWidget;