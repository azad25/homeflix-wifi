"use client";

import React, { useEffect, useState, useCallback, useRef } from 'react';
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
  VolumeX
} from 'lucide-react';
import { Widget, parseWidgetConfig, getColorPaletteByGenre, DominantColors } from '@/types/widgets';
import type { Notification } from '@/types/notifications';
import { getApiUrl } from '@/lib/api';
import { useNavigate } from '@/hooks/useNavigate';


// Declare global YouTube types
declare global {
    interface Window {
        YT: any;
        onYouTubeIframeAPIReady: () => void;
    }
}

interface NotificationWidgetProps {
  widget: Widget;
  className?: string;
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
  enhanced_data?: {
    backdrop_url?: string;
    logo_url?: string;
    trailer_key?: string;
    cast?: string[];
    director?: string;
    rating?: number;
    genre_colors?: DominantColors;
  };
}

const NotificationWidget: React.FC<NotificationWidgetProps> = ({ widget, className = '' }) => {
  console.log('🔔 NotificationWidget mounted with widget:', widget);
  console.log('🔔 NotificationWidget className:', className);
  
  const [notifications, setNotifications] = useState<EnhancedNotification[]>([]);
  const [tmdbDetails, setTmdbDetails] = useState<Record<string, TMDBMovieDetails>>({});
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isInMyList, setIsInMyList] = useState<Record<string, boolean>>({});
  const [isMuted, setIsMuted] = useState(true);
  const [colors, setColors] = useState<DominantColors>(getColorPaletteByGenre());
  const [ytReady, setYtReady] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const autoScrollRef = useRef<NodeJS.Timeout | null>(null);
  const playerRef = useRef<any>(null);
  
  const navigate = useNavigate();
  const config = parseWidgetConfig(widget.config);
  const apiUrl = getApiUrl();

  // DEBUG: Add visible test element
  console.log('🔔 NotificationWidget rendering - config:', config);

  // Early return for testing
  if (false) {
    return (
      <div className={`bg-red-500 text-white p-4 m-4 rounded ${className}`}>
        <h2>🔔 NOTIFICATION WIDGET TEST</h2>
        <p>Widget ID: {widget.id}</p>
        <p>Widget Name: {widget.name}</p>
        <p>Config: {JSON.stringify(config)}</p>
        <p>Loading: {loading.toString()}</p>
        <p>Notifications: {notifications.length}</p>
      </div>
    );
  }

  // Create sample notifications when API doesn't return any
  const createSampleNotifications = async (): Promise<Notification[]> => {
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
      console.log('Could not fetch movies for sample notifications');
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
  };

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
    console.log('NotificationWidget: fetchNotifications called');
    fetchNotifications();
  }, []);

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
        }, 10000); // Changed to 3 seconds as requested
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

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      console.log('Fetching notifications from:', `${apiUrl}/api/notifications?limit=${widget.maxItems || 10}`);
      
      const response = await fetch(`${apiUrl}/api/notifications?limit=${widget.maxItems || 10}`);
      console.log('Notifications API response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Notifications API response data:', data);
        
        let filteredNotifications = filterNotifications(data.notifications || []);
        console.log('Filtered notifications:', filteredNotifications);
        
        // If no notifications from API, create some sample ones for testing
        if (filteredNotifications.length === 0) {
          console.log('No notifications from API, creating sample notifications');
          filteredNotifications = await createSampleNotifications();
        }
        
        filteredNotifications = await enhanceNotifications(filteredNotifications);
        
        filteredNotifications.sort((a, b) => {
          const priorityOrder: Record<string, number> = { high: 3, medium: 2, low: 1 };
          const aPriority = priorityOrder[(a as EnhancedNotification).priority || 'medium'];
          const bPriority = priorityOrder[(b as EnhancedNotification).priority || 'medium'];
          
          if (aPriority !== bPriority) return bPriority - aPriority;
          return b.timestamp - a.timestamp;
        });
        
        console.log('Final notifications to display:', filteredNotifications);
        setNotifications(filteredNotifications);
        
        if (filteredNotifications.length > 0) {
          await fetchTMDBDetails(filteredNotifications);
          await fetchLocalMediaDetails(filteredNotifications);
        }
      } else {
        console.log('API response not ok, status:', response.status, 'creating sample notifications');
        const sampleNotifications = await createSampleNotifications();
        const enhancedSample = await enhanceNotifications(sampleNotifications);
        setNotifications(enhancedSample);
        await fetchTMDBDetails(enhancedSample);
        await fetchLocalMediaDetails(enhancedSample);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      // Fallback to sample notifications
      try {
        console.log('Creating fallback sample notifications due to error');
        const sampleNotifications = await createSampleNotifications();
        const enhancedSample = await enhanceNotifications(sampleNotifications);
        setNotifications(enhancedSample);
        await fetchTMDBDetails(enhancedSample);
        await fetchLocalMediaDetails(enhancedSample);
      } catch (sampleError) {
        console.error('Failed to create sample notifications:', sampleError);
      }
    } finally {
      setLoading(false);
    }
  };

  const enhanceNotifications = async (notifications: Notification[]): Promise<EnhancedNotification[]> => {
    return notifications.map(notification => {
      let priority: 'high' | 'medium' | 'low' = 'medium';
      let category: 'trending' | 'new' | 'recommended' | 'watchlist' = 'new';
      
      const hoursSinceCreated = (Date.now() / 1000 - notification.timestamp) / 3600;
      
      switch (notification.type) {
        case 'tmdb_now_playing':
        case 'tmdb_trending':
          priority = hoursSinceCreated < 24 ? 'high' : 'medium';
          category = 'trending';
          break;
        case 'tmdb_upcoming':
        case 'tmdb_upcoming_tv':
          priority = 'medium';
          category = 'new';
          break;
        case 'tmdb_now_airing_tv':
          priority = hoursSinceCreated < 12 ? 'high' : 'medium';
          category = 'trending';
          break;
        case 'movie_suggestion':
        case 'single_movie_suggestion':
          priority = 'medium';
          category = 'recommended';
          break;
        case 'watch_again':
          priority = 'low';
          category = 'watchlist';
          break;
        case 'new_episodes':
          priority = hoursSinceCreated < 12 ? 'high' : 'medium';
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

  const fetchTMDBDetails = async (notifications: EnhancedNotification[]) => {
    const tmdbNotifications = notifications.filter(n => 
      (n.type === 'tmdb_upcoming' || n.type === 'tmdb_now_playing' || n.type === 'movie_suggestion') && 
      n.tmdb_ids && n.tmdb_ids.length > 0
    );

    for (const notification of tmdbNotifications) {
      if (notification.tmdb_ids) {
        for (const tmdbId of notification.tmdb_ids) {
          try {
            const response = await fetch(`${apiUrl}/api/tmdb-movie/${tmdbId}`);
            if (response.ok) {
              const movieData = await response.json();
              
              // Fetch additional data
              try {
                const videosResponse = await fetch(`${apiUrl}/api/tmdb/movie/${tmdbId}/videos`);
                if (videosResponse.ok) {
                  const videosData = await videosResponse.json();
                  movieData.videos = videosData;
                }
              } catch (e) {
                console.log('Videos not available for', tmdbId);
              }
              
              try {
                const imagesResponse = await fetch(`${apiUrl}/api/tmdb/movie/${tmdbId}/images`);
                if (imagesResponse.ok) {
                  const imagesData = await imagesResponse.json();
                  const logo = imagesData.logos?.find((logo: any) => 
                    logo.iso_639_1 === 'en' || logo.iso_639_1 === null
                  );
                  if (logo) {
                    movieData.logo_path = logo.file_path;
                  }
                }
              } catch (e) {
                console.log('Images not available for', tmdbId);
              }
              
              setTmdbDetails(prev => ({
                ...prev,
                [`tmdb_${tmdbId}`]: movieData
              }));
            } else {
              console.log(`TMDB API returned ${response.status} for movie ${tmdbId}`);
            }
          } catch (error) {
            console.error(`Failed to fetch TMDB details for ${tmdbId}:`, error);
          }
        }
      }
    }
  };

  const fetchLocalMediaDetails = async (notifications: EnhancedNotification[]) => {
    const localNotifications = notifications.filter(n => 
      (n.type === 'movie_suggestion' || n.type === 'watch_again' || n.type === 'new_movies') && 
      n.movie_ids && n.movie_ids.length > 0
    );

    for (const notification of localNotifications) {
      if (notification.movie_ids) {
        for (const movieId of notification.movie_ids) {
          try {
            const response = await fetch(`${apiUrl}/api/media/${movieId}`);
            if (response.ok) {
              const mediaData = await response.json();
              
              setTmdbDetails(prev => ({
                ...prev,
                [`local_${movieId}`]: {
                  id: mediaData.id,
                  title: mediaData.title,
                  overview: mediaData.description || mediaData.overview || 'No description available',
                  backdrop_path: mediaData.tmdb_backdrop_url || mediaData.banner_path || mediaData.backdrop_path,
                  poster_path: mediaData.poster_path,
                  release_date: mediaData.release_date || `${mediaData.year || '2024'}-01-01`,
                  vote_average: mediaData.rating || 0,
                  genres: mediaData.genres || [],
                  runtime: mediaData.duration ? Math.floor(mediaData.duration / 60) : 0,
                  media_type: mediaData.type || 'movie',
                  original_language: 'en',
                  popularity: mediaData.view_count || 0,
                  adult: false,
                  tagline: mediaData.tagline,
                  videos: mediaData.tmdb_trailer_url ? {
                    results: [{
                      key: extractYouTubeKey(mediaData.tmdb_trailer_url) || '',
                      type: 'Trailer',
                      site: 'YouTube',
                      name: 'Official Trailer',
                      official: true
                    }]
                  } : { results: [] },
                  logo_path: mediaData.logo_path
                }
              }));
            } else {
              console.log(`Local media API returned ${response.status} for movie ${movieId}`);
            }
          } catch (error) {
            console.error(`Failed to fetch local media details for ${movieId}:`, error);
          }
        }
      }
    }
  };

  const handleNotificationClick = (notification: EnhancedNotification, index?: number) => {
    if (notification.type === 'tmdb_upcoming' || 
        notification.type === 'tmdb_now_playing' || 
        notification.type === 'tmdb_trending' ||
        notification.type === 'tmdb_upcoming_tv' ||
        notification.type === 'tmdb_now_airing_tv') {
      if (notification.tmdb_ids && notification.tmdb_ids.length > 0) {
        const tmdbId = index !== undefined ? notification.tmdb_ids[index] : notification.tmdb_ids[0];
        // Check if it's a TV series notification
        if (notification.type === 'tmdb_upcoming_tv' || notification.type === 'tmdb_now_airing_tv') {
          navigate.push(`/tmdb-movie/${tmdbId}?type=tv`);
        } else {
          navigate.push(`/tmdb-movie/${tmdbId}?type=movie`);
        }
      }
    } else if (notification.type === 'new_episodes' && notification.series_id) {
      navigate.push(`/tv-series/${notification.series_id}`);
    } else if (notification.movie_ids && notification.movie_ids.length > 0) {
      const movieId = index !== undefined ? notification.movie_ids[index] : notification.movie_ids[0];
      if (movieId && movieId > 0) {
        navigate.push(`/movie/${movieId}`);
      }
    }
  };

  const getNotificationIcon = (type: string, priority?: string) => {
    const iconProps = {
      className: `w-4 h-4 ${priority === 'high' ? 'animate-pulse' : ''}`,
      style: { filter: priority === 'high' ? 'drop-shadow(0 0 8px currentColor)' : undefined }
    };

    switch (type) {
      case 'tmdb_upcoming':
      case 'tmdb_upcoming_tv':
        return <Calendar {...iconProps} />;
      case 'tmdb_now_playing':
      case 'tmdb_now_airing_tv':
        return <Sparkles {...iconProps} />;
      case 'tmdb_trending':
        return <TrendingUp {...iconProps} />;
      case 'new_episodes':
        return <Tv {...iconProps} />;
      case 'movie_suggestion':
        return <Award {...iconProps} />;
      case 'single_movie_suggestion':
        return <Star {...iconProps} />;
      case 'watch_again':
        return <Eye {...iconProps} />;
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

  const toggleMyList = (notificationId: string) => {
    setIsInMyList(prev => ({
      ...prev,
      [notificationId]: !prev[notificationId]
    }));
  };

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
    if (notification.type === 'tmdb_upcoming' || 
        notification.type === 'tmdb_now_playing' || 
        notification.type === 'tmdb_trending' ||
        notification.type === 'tmdb_upcoming_tv' ||
        notification.type === 'tmdb_now_airing_tv') {
      if (notification.tmdb_ids && notification.tmdb_ids.length > 0) {
        const tmdbId = notification.tmdb_ids[0];
        const movieDetails = tmdbDetails[`tmdb_${tmdbId}`];
        if (movieDetails?.backdrop_path) {
          return `https://image.tmdb.org/t/p/w1280${movieDetails.backdrop_path}`;
        }
      }
    } else if (notification.movie_ids && notification.movie_ids.length > 0) {
      const movieId = notification.movie_ids[0];
      const localDetails = tmdbDetails[`local_${movieId}`];
      if (localDetails?.backdrop_path) {
        if (localDetails.backdrop_path.startsWith('http')) {
          return localDetails.backdrop_path;
        } else {
          return `${apiUrl}/api/admin/assets/${localDetails.backdrop_path.split('/').pop()}`;
        }
      }
      return `${apiUrl}/api/thumbnails/${movieId}`;
    }
    return null;
  };

  const getLogoUrl = (notification: EnhancedNotification) => {
    if (notification.type === 'tmdb_upcoming' || 
        notification.type === 'tmdb_now_playing' || 
        notification.type === 'tmdb_trending' ||
        notification.type === 'tmdb_upcoming_tv' ||
        notification.type === 'tmdb_now_airing_tv') {
      if (notification.tmdb_ids && notification.tmdb_ids.length > 0) {
        const tmdbId = notification.tmdb_ids[0];
        const movieDetails = tmdbDetails[`tmdb_${tmdbId}`];
        if (movieDetails?.logo_path) {
          return `https://image.tmdb.org/t/p/w500${movieDetails.logo_path}`;
        }
      }
    } else if (notification.movie_ids && notification.movie_ids.length > 0) {
      const movieId = notification.movie_ids[0];
      const localDetails = tmdbDetails[`local_${movieId}`];
      if (localDetails?.logo_path) {
        return `${apiUrl}/api/${localDetails.logo_path}`;
      }
    }
    return null;
  };

  const getPosterUrl = (notification: EnhancedNotification) => {
    if (notification.type === 'tmdb_upcoming' || 
        notification.type === 'tmdb_now_playing' || 
        notification.type === 'tmdb_trending' ||
        notification.type === 'tmdb_upcoming_tv' ||
        notification.type === 'tmdb_now_airing_tv') {
      if (notification.tmdb_ids && notification.tmdb_ids.length > 0) {
        const tmdbId = notification.tmdb_ids[0];
        const movieDetails = tmdbDetails[`tmdb_${tmdbId}`];
        if (movieDetails?.poster_path) {
          return `https://image.tmdb.org/t/p/w500${movieDetails.poster_path}`;
        }
      }
    } else if (notification.movie_ids && notification.movie_ids.length > 0) {
      const movieId = notification.movie_ids[0];
      const localDetails = tmdbDetails[`local_${movieId}`];
      if (localDetails?.poster_path) {
        if (localDetails.poster_path.startsWith('http')) {
          return localDetails.poster_path;
        } else {
          return `${apiUrl}/api/posters/${movieId}`;
        }
      }
    }
    return null;
  };

  const getMovieDetails = (notification: EnhancedNotification) => {
    if (notification.type === 'tmdb_upcoming' || 
        notification.type === 'tmdb_now_playing' || 
        notification.type === 'tmdb_trending' ||
        notification.type === 'tmdb_upcoming_tv' ||
        notification.type === 'tmdb_now_airing_tv') {
      if (notification.tmdb_ids && notification.tmdb_ids.length > 0) {
        const tmdbId = notification.tmdb_ids[0];
        return tmdbDetails[`tmdb_${tmdbId}`];
      }
    } else if (notification.movie_ids && notification.movie_ids.length > 0) {
      const movieId = notification.movie_ids[0];
      return tmdbDetails[`local_${movieId}`];
    }
    return null;
  };

  const getAllMovieDetails = (notification: EnhancedNotification) => {
    const details = [];
    
    if (notification.type === 'tmdb_upcoming' || 
        notification.type === 'tmdb_now_playing' || 
        notification.type === 'tmdb_trending' ||
        notification.type === 'tmdb_upcoming_tv' ||
        notification.type === 'tmdb_now_airing_tv') {
      if (notification.tmdb_ids) {
        for (const tmdbId of notification.tmdb_ids) {
          const movieDetail = tmdbDetails[`tmdb_${tmdbId}`];
          if (movieDetail && movieDetail.title !== `Movie ${tmdbId}`) {
            details.push({ ...movieDetail, sourceType: 'tmdb', sourceId: tmdbId });
          }
        }
      }
    } else if (notification.movie_ids) {
      for (const movieId of notification.movie_ids) {
        const movieDetail = tmdbDetails[`local_${movieId}`];
        if (movieDetail && movieDetail.title !== `Movie ${movieId}`) {
          details.push({ ...movieDetail, sourceType: 'local', sourceId: movieId });
        }
      }
    }
    
    return details;
  };

  const getTrailerKey = (notification: EnhancedNotification) => {
    if (notification.type === 'tmdb_upcoming' || 
        notification.type === 'tmdb_now_playing' || 
        notification.type === 'tmdb_trending' ||
        notification.type === 'tmdb_upcoming_tv' ||
        notification.type === 'tmdb_now_airing_tv') {
      if (notification.tmdb_ids && notification.tmdb_ids.length > 0) {
        const tmdbId = notification.tmdb_ids[0];
        const movieDetails = tmdbDetails[`tmdb_${tmdbId}`];
        const trailer = movieDetails?.videos?.results?.find(
          video => video.type === 'Trailer' && video.site === 'YouTube'
        );
        return trailer?.key;
      }
    } else if (notification.movie_ids && notification.movie_ids.length > 0) {
      const movieId = notification.movie_ids[0];
      const localDetails = tmdbDetails[`local_${movieId}`];
      const trailer = localDetails?.videos?.results?.find(
        video => video.type === 'Trailer' && video.site === 'YouTube'
      );
      return trailer?.key;
    }
    return null;
  };

  const getThemeColors = (notification: EnhancedNotification) => {
    if ((notification.type === 'tmdb_upcoming' || 
         notification.type === 'tmdb_now_playing' || 
         notification.type === 'tmdb_trending' ||
         notification.type === 'tmdb_upcoming_tv' ||
         notification.type === 'tmdb_now_airing_tv') && 
        notification.tmdb_ids && notification.tmdb_ids.length > 0) {
      const tmdbId = notification.tmdb_ids[0];
      const movieDetails = tmdbDetails[`tmdb_${tmdbId}`];
      
      if (movieDetails && movieDetails.genres && movieDetails.genres.length > 0) {
        const genres = movieDetails.genres.map(g => g.name);
        return getColorPaletteByGenre(genres);
      }
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
      <div className={`relative overflow-hidden rounded-xl border border-white/10 backdrop-blur-sm h-full ${className}`}>
        <div className="h-full bg-gradient-to-br from-gray-900 via-gray-800 to-black relative">
          <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 via-blue-500/10 to-purple-500/10 animate-pulse" />
          
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin mx-auto" />
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-white/20 rounded-full w-48 mx-auto animate-pulse" />
                <div className="h-3 bg-white/10 rounded-full w-32 mx-auto animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  console.log('NotificationWidget render:', { 
    notificationsLength: notifications.length, 
    loading, 
    currentIndex, 
    tmdbDetailsKeys: Object.keys(tmdbDetails),
    config: config,
    autoScroll: config.autoScroll,
    isHovering
  });

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
        className={`relative overflow-hidden rounded-xl border border-white/10 backdrop-blur-sm h-full ${className}`}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        style={{
          background: `linear-gradient(135deg, ${themeColors.primary}05 0%, transparent 50%, ${themeColors.accent}05 100%)`,
          boxShadow: `0 8px 32px ${themeColors.primary}20, inset 0 1px 0 rgba(255,255,255,0.1)`
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
            <div className="absolute top-6 right-6 flex items-center gap-3 z-20">
              {getPriorityBadge(currentNotification.priority || 'medium')}
              <div 
                className="flex items-center gap-2 px-3 py-1 rounded-full backdrop-blur-md border"
                style={{ 
                  backgroundColor: `${themeColors.primary}20`,
                  borderColor: `${themeColors.primary}40`
                }}
              >
                {getCategoryIcon(currentNotification.category || 'new')}
                <span className="text-xs font-medium text-white uppercase tracking-wider">
                  {currentNotification.category}
                </span>
              </div>
            </div>

            {/* Main Content */}
            <div className="absolute inset-0 flex items-center z-20">
              <div className="w-full px-6 md:px-12 lg:px-16">
                <div className="max-w-3xl">
                  {/* Logo or Title */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`${currentIndex}-title`}
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.6, delay: 0.2 }}
                      className="mb-6"
                    >
                      {config.showNotificationIcon && (
                        <div className="flex items-center gap-4 mb-4">
                          <div 
                            className="p-3 rounded-full backdrop-blur-md border"
                            style={{ 
                              backgroundColor: `${themeColors.primary}30`,
                              borderColor: `${themeColors.primary}50`,
                              boxShadow: `0 0 30px ${themeColors.primary}40`
                            }}
                          >
                            {getNotificationIcon(currentNotification.type, currentNotification.priority)}
                          </div>
                          {config.showTimestamp && (
                            <div className="text-sm text-white/70 font-medium">
                              {formatTimestamp(currentNotification.timestamp)}
                            </div>
                          )}
                        </div>
                      )}

                      {logoUrl ? (
                        <img
                          src={logoUrl}
                          alt={currentNotification.title}
                          className="max-h-16 md:max-h-20 lg:max-h-24 w-auto drop-shadow-2xl"
                          style={{ filter: 'drop-shadow(0 0 20px rgba(0,0,0,0.8))' }}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                            if (fallback) fallback.style.display = 'block';
                          }}
                        />
                      ) : null}
                      
                      <h1
                        className="text-3xl md:text-4xl lg:text-6xl font-bold leading-tight"
                        style={{
                          display: logoUrl ? 'none' : 'block',
                          textShadow: `0 0 40px ${themeColors.primary}60, 0 4px 20px rgba(0,0,0,0.8)`,
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
                    className="mb-6"
                  >
                    <p className="text-lg md:text-xl text-white/90 mb-4 max-w-2xl leading-relaxed">
                      {currentNotification.message}
                    </p>
                    
                    {/* Show movie details based on notification type */}
                    {(() => {
                      const allMovies = getAllMovieDetails(currentNotification);
                      const singleMovie = getMovieDetails(currentNotification);
                      
                      // Only show recommendation cards for multi-movie suggestions (more than 1 movie)
                      if (currentNotification.type === 'movie_suggestion' && allMovies.length > 1) {
                        return (
                          <div className="mb-6">
                            <h4 className="text-lg font-semibold text-white mb-3">Recommended Movies</h4>
                            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                              <style jsx>{`
                                .scrollbar-hide::-webkit-scrollbar {
                                  display: none;
                                }
                              `}</style>
                              {allMovies.slice(0, 6).map((movie, idx) => (
                                <motion.div
                                  key={`${movie.sourceType}_${movie.sourceId}`}
                                  initial={{ opacity: 0, x: 20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: 0.1 * idx }}
                                  className="flex-shrink-0 cursor-pointer group"
                                  onClick={() => handleNotificationClick(currentNotification, idx)}
                                >
                                  <div className="relative w-24 h-36 rounded-lg overflow-hidden border border-white/20 group-hover:border-white/40 transition-all group-hover:scale-105">
                                    <img
                                      src={movie.sourceType === 'tmdb' 
                                        ? `https://image.tmdb.org/t/p/w300${movie.poster_path}`
                                        : movie.poster_path?.startsWith('http') 
                                          ? movie.poster_path
                                          : `${apiUrl}/api/posters/${movie.sourceId}`
                                      }
                                      alt={movie.title || movie.name}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        e.currentTarget.src = `${apiUrl}/api/thumbnails/${movie.sourceId}`;
                                      }}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div className="absolute bottom-1 left-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <p className="text-white text-xs font-medium truncate">
                                        {movie.title || movie.name}
                                      </p>
                                      {movie.vote_average > 0 && (
                                        <div className="flex items-center gap-1">
                                          <Star className="w-2 h-2 text-yellow-400 fill-current" />
                                          <span className="text-yellow-400 text-xs">
                                            {movie.vote_average.toFixed(1)}
                                          </span>
                                        </div>
                                      )}
                                    </div>
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
                          <div className="flex items-start gap-6 mb-6">
                            {/* Enhanced Poster */}
                            {getPosterUrl(currentNotification) && (
                              <div className="relative flex-shrink-0">
                                <img
                                  src={getPosterUrl(currentNotification)!}
                                  alt="Movie Poster"
                                  className="w-32 h-48 object-cover rounded-xl shadow-2xl border border-white/20"
                                  onError={(e) => {
                                    if (currentNotification.movie_ids && currentNotification.movie_ids[0]) {
                                      e.currentTarget.src = `${apiUrl}/api/thumbnails/${currentNotification.movie_ids[0]}`;
                                    }
                                  }}
                                />
                                {/* Quality Badge on Poster */}
                                <div className="absolute top-2 right-2">
                                  <div className="px-2 py-1 bg-black/80 backdrop-blur-sm rounded text-xs font-bold text-white border border-white/20">
                                    4K
                                  </div>
                                </div>
                                {/* Rating Badge on Poster */}
                                {singleMovie.vote_average > 0 && (
                                  <div className="absolute top-2 left-2">
                                    <div 
                                      className="flex items-center gap-1 px-2 py-1 rounded-full backdrop-blur-md border"
                                      style={{
                                        backgroundColor: `${themeColors.primary}30`,
                                        borderColor: `${themeColors.primary}50`
                                      }}
                                    >
                                      <Star className="w-3 h-3 text-yellow-400 fill-current" />
                                      <span className="text-xs font-semibold text-white">
                                        {singleMovie.vote_average.toFixed(1)}
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* Enhanced Movie Details */}
                            <div className="flex-1 min-w-0">
                              <h3 className="text-2xl md:text-3xl font-bold text-white mb-3 leading-tight">
                                {singleMovie.title || singleMovie.name}
                              </h3>
                              
                              {/* Enhanced Meta Information */}
                              <div className="flex flex-wrap items-center gap-4 mb-4">
                                {singleMovie.release_date && (
                                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
                                    <Calendar className="w-4 h-4 text-white/80" />
                                    <span className="text-white font-medium text-sm">
                                      {new Date(singleMovie.release_date).getFullYear()}
                                    </span>
                                  </div>
                                )}
                                
                                {singleMovie.runtime && singleMovie.runtime > 0 && (
                                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
                                    <Clock className="w-4 h-4 text-white/80" />
                                    <span className="text-white font-medium text-sm">
                                      {Math.floor(singleMovie.runtime / 60)}h {singleMovie.runtime % 60}m
                                    </span>
                                  </div>
                                )}

                                {singleMovie.original_language && (
                                  <div className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
                                    <span className="text-white text-sm font-medium uppercase">
                                      {singleMovie.original_language}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Enhanced Genres */}
                              {singleMovie.genres && singleMovie.genres.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-4">
                                  {singleMovie.genres.slice(0, 4).map((genre) => (
                                    <span
                                      key={genre.id}
                                      className="px-3 py-1 text-sm rounded-full border font-medium"
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

                              {/* Enhanced Description */}
                              {singleMovie.overview && singleMovie.overview !== 'Details not available' && (
                                <p className="text-white/90 text-base leading-relaxed line-clamp-3 max-w-2xl mb-4">
                                  {singleMovie.overview}
                                </p>
                              )}

                              {/* Tagline */}
                              {singleMovie.tagline && (
                                <p className="text-white/70 italic text-sm mb-4 max-w-xl">
                                  "{singleMovie.tagline}"
                                </p>
                              )}

                              {/* Production Info */}
                              {singleMovie.production_companies && singleMovie.production_companies.length > 0 && (
                                <div className="flex items-center gap-2 text-sm text-white/60">
                                  <span>Produced by:</span>
                                  <span className="font-medium">
                                    {singleMovie.production_companies.slice(0, 2).map(company => company.name).join(', ')}
                                  </span>
                                </div>
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
                    className="flex items-center gap-3 mt-8"
                  >
                    <button
                      onClick={() => handleNotificationClick(currentNotification)}
                      className="flex items-center gap-2 px-4 py-2 bg-white text-black font-semibold rounded-md hover:bg-white/90 transition-all transform hover:scale-105 shadow-lg text-sm"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      Watch Now
                    </button>
                    
                    <button
                      onClick={() => handleNotificationClick(currentNotification)}
                      className="flex items-center gap-2 px-3 py-2 backdrop-blur-md border font-medium rounded-md transition-all hover:scale-105 text-sm"
                      style={{ 
                        backgroundColor: `${themeColors.primary}20`,
                        borderColor: `${themeColors.primary}50`,
                        color: 'white'
                      }}
                    >
                      <Info className="w-4 h-4" />
                      More Info
                    </button>

                    <button
                      onClick={() => toggleMyList(currentNotification.id)}
                      className="p-2 backdrop-blur-md rounded-full border transition-all hover:scale-110"
                      style={{ 
                        backgroundColor: isInMyList[currentNotification.id] ? `${themeColors.primary}40` : `${themeColors.primary}20`,
                        borderColor: `${themeColors.primary}50`
                      }}
                    >
                      {isInMyList[currentNotification.id] ? 
                        <Check className="w-4 h-4" style={{ color: themeColors.primary }} /> : 
                        <Plus className="w-4 h-4 text-white" />
                      }
                    </button>

                    {trailerKey && (
                      <button
                        onClick={() => setIsMuted(!isMuted)}
                        className="p-2 backdrop-blur-md rounded-full border transition-all hover:scale-110"
                        style={{ 
                          backgroundColor: `${themeColors.primary}20`,
                          borderColor: `${themeColors.primary}50`
                        }}
                      >
                        {isMuted ? 
                          <VolumeX className="w-4 h-4 text-white" /> : 
                          <Volume2 className="w-4 h-4 text-white" />
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
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-2 backdrop-blur-md rounded-full border transition-all z-30"
                  style={{ 
                    backgroundColor: `${themeColors.primary}20`,
                    borderColor: `${themeColors.primary}40`,
                    opacity: isHovering ? 1 : 0
                  }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <ChevronLeft className="w-5 h-5 text-white" />
                </motion.button>
                
                <motion.button
                  onClick={handleNext}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 backdrop-blur-md rounded-full border transition-all z-30"
                  style={{ 
                    backgroundColor: `${themeColors.primary}20`,
                    borderColor: `${themeColors.primary}40`,
                    opacity: isHovering ? 1 : 0
                  }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <ChevronRight className="w-5 h-5 text-white" />
                </motion.button>
              </>
            )}

            {/* Enhanced Progress Indicators */}
            {notifications.length > 1 && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 z-30">
                {notifications.slice(0, 8).map((notification, idx) => (
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
                      className={`h-1 rounded-full transition-all duration-300 ${
                        idx === currentIndex ? 'w-8' : 'w-2'
                      }`}
                      style={{
                        backgroundColor: idx === currentIndex ? themeColors.primary : 'rgba(255,255,255,0.4)',
                        boxShadow: idx === currentIndex ? `0 0 10px ${themeColors.primary}80` : 'none'
                      }}
                    />
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {notification.title}
                    </div>
                  </motion.button>
                ))}
                {notifications.length > 8 && (
                  <span className="text-xs text-white/50 ml-2 font-medium">
                    +{notifications.length - 8} more
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