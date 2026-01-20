"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import { usePageTitle } from '@/hooks/usePageTitle';
import { ArrowLeft, Play, Plus, Check, Share, Download, Info, Star, Clock, Calendar, Globe, Users, Award, Film, Tv, User, Mic, ChevronDown, ChevronUp, Volume2, VolumeX, PlayCircle, X, Pause, Settings, RotateCcw, Users as Cast, User as Director } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Media } from '@/types/media';
import { getApiUrl, getAssetUrl } from '@/lib/api';
import RedLoader from '@/components/RedLoader';
import LazyImage from '@/components/LazyImage';
import LazyVideo from '@/components/LazyVideo';
import { updatePlaybackProgress, getPlaybackProgress } from '@/lib/playback';
import Navbar from '@/components/Navbar';
import { cleanMovieTitle, findSimilarMovies } from '@/lib/titleUtils';
import VideoPlayer from '@/components/VideoPlayer';
import GenreTitle from '@/components/GenreTitle';
import QualityBadge from '../../../components/QualityBadge';
import QualityTags from '@/components/QualityTags';
import { addToWishlist, removeFromWishlist, isInWishlist } from '@/lib/wishlist';
import CastButton from '@/components/CastButton';
import { useChromecast, CastMedia } from '@/hooks/useChromecast';
import ImageWithFallback from '@/components/ImageWithFallback';
import CastSection from '@/components/CastSection';
import { useMyList } from '@/hooks/useMyList';
import MyListTooltip from '@/components/ui/MyListTooltip';
import {
  NetflixHorizontalRow,
  ParallaxSection,
  ScrollReveal,
  GlassCard,
  GradientBackground,
  FloatingElement,
  MagneticButton,
  ParticleField
} from '@/components/scrollx';
import RecommendationSection from '@/components/RecommendationSection';
import DynamicTitle from '@/components/DynamicTitle';
import { useNavigate } from "@/hooks/useNavigate";
import RecentlyWatched from "@/components/RecentlyWatched";

interface Season {
  id: number;
  season_number: number;
  name: string;
  overview: string;
  air_date?: string;
  episode_count: number;
  episodes?: Episode[];
}

interface Episode {
  id: number;
  episode_number: number;
  name: string;
  overview: string;
  still_path?: string;
  air_date?: string;
  runtime?: number;
  vote_average?: number;
}

// Custom hook to manage background video lifecycle (same as movie page)
const useBackgroundVideo = (videoRef: React.RefObject<HTMLVideoElement | null>, shouldStop: boolean) => {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const isMountedRef = useRef(true);

  // Function to pause video (don't remove sources)
  const stopVideo = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.muted = true;
      video.currentTime = 0;
      video.volume = 0;
    }
  }, []);

  // Function to completely destroy video (for navigation/unmount)
  const destroyVideo = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.muted = true;
      video.currentTime = 0;
      video.volume = 0;

      // Remove all sources to completely stop loading
      const sources = video.querySelectorAll('source');
      sources.forEach(source => source.remove());

      // Clear src and load to stop any ongoing requests
      video.src = '';
      video.load();

      // Force garbage collection of video element
      try {
        video.removeAttribute('src');
        video.removeAttribute('currentSrc');
      } catch (e) {
        // Silent fail
      }
    }
  }, []);

  // Function to pause video
  const pauseVideo = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.muted = true;
    }
  }, []);

  // Safe state updater that checks if component is still mounted
  const safeSetIsVideoPlaying = useCallback((playing: boolean) => {
    // Use requestAnimationFrame to defer state update and avoid insertion effect conflicts
    requestAnimationFrame(() => {
      if (isMountedRef.current) {
        setIsVideoPlaying(playing);
      }
    });
  }, []);

  const safeSetIsMuted = useCallback((muted: boolean) => {
    // Use requestAnimationFrame to defer state update and avoid insertion effect conflicts
    requestAnimationFrame(() => {
      if (isMountedRef.current) {
        setIsMuted(muted);
      }
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Main effect to handle when video should be stopped (player open or trailer showing)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !shouldStop) return;

    // Stop background video completely
    video.pause();
    video.muted = true;
    video.volume = 0;
    video.currentTime = 0;
    video.style.display = 'none';
    video.style.visibility = 'hidden';
    video.style.opacity = '0';
    safeSetIsVideoPlaying(false);
    safeSetIsMuted(true);
  }, [shouldStop, safeSetIsVideoPlaying, safeSetIsMuted]);

  // Global cleanup listeners
  useEffect(() => {
    const handleBeforeUnload = () => destroyVideo();
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // More aggressive cleanup when page becomes hidden
        destroyVideo();
      }
    };

    // Navigation cleanup - listen for Next.js route changes
    const handleRouteChange = () => {
      destroyVideo();
    };

    // Listen for popstate (back/forward navigation)
    const handlePopState = () => {
      destroyVideo();
    };

    // Listen for hash changes
    const handleHashChange = () => {
      destroyVideo();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('unload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handleHashChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Next.js specific route change detection
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function (...args) {
      handleRouteChange();
      return originalPushState.apply(this, args);
    };

    window.history.replaceState = function (...args) {
      handleRouteChange();
      return originalReplaceState.apply(this, args);
    };

    return () => {
      destroyVideo();
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handleHashChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      // Restore original methods
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, [destroyVideo, pauseVideo]);

  return {
    isVideoPlaying,
    setIsVideoPlaying: safeSetIsVideoPlaying,
    isMuted,
    setIsMuted: safeSetIsMuted,
    stopVideo,
    pauseVideo,
    destroyVideo
  };
};

export default function TVSeriesPage() {
  const params = useParams();
  const router = useRouter();
  const navigate = useNavigate();
  const pathname = usePathname();

  // Refs and state declarations first
  const videoRef = useRef<HTMLVideoElement>(null);
  const trailerRef = useRef<HTMLIFrameElement>(null);
  const isMountedRef = useRef(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const performanceOptimizationRef = useRef({
    lastStopTime: 0,
    isInLowPowerMode: false
  });

  const [series, setSeries] = useState<Media | null>(null);

  // Update page title when series is loaded
  usePageTitle(series?.title || 'TV Series');
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [episodes, setEpisodes] = useState<Media[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [isInMyList, setIsInMyList] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [showTitleOverlay, setShowTitleOverlay] = useState(true);
  const [isHoveringTitle, setIsHoveringTitle] = useState(false);
  const [continueWatching, setContinueWatching] = useState<{ episode: Media, progress: number } | null>(null);
  const [isShowingTrailer, setIsShowingTrailer] = useState(false);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [trailerLoaded, setTrailerLoaded] = useState(false);
  const [trailerReady, setTrailerReady] = useState(false);
  const [userPausedTrailer, setUserPausedTrailer] = useState(false);
  const [forceShowBackdrop, setForceShowBackdrop] = useState(false);
  const [useYouTubeFallback, setUseYouTubeFallback] = useState(false);
  const [ytReady, setYtReady] = useState(false);
  const [ytPlayerRef, setYtPlayerRef] = useState<any>(null);
  const [latestEpisode, setLatestEpisode] = useState<Media | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const [hasWatchedBefore, setHasWatchedBefore] = useState(false);
  const [lastWatched, setLastWatched] = useState<string | null>(null);

  // Use the new backend-connected My List hook
  const { myList, collections, isInMyList: isInMyListHook, toggleMyList: toggleMyListHook, addToCollection, fetchCollections } = useMyList();

  // Use custom hook for background video management
  const {
    isVideoPlaying,
    setIsVideoPlaying,
    isMuted,
    setIsMuted,
    stopVideo,
    pauseVideo,
    destroyVideo
  } = useBackgroundVideo(videoRef, isPlayerOpen || isShowingTrailer);

  // Load YouTube IFrame API for fallback trailers
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
  const extractYouTubeKey = useCallback((url: string): string | null => {
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
  }, []);

  // Component mount/unmount tracking
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      // Ensure video is stopped when component unmounts
      const video = videoRef.current;
      if (video) {
        video.pause();
        video.muted = true;
        video.currentTime = 0;
        video.volume = 0;
        video.src = '';
        video.load();
      }
    };
  }, []);

  // Performance optimization - manage low power mode
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        performanceOptimizationRef.current.isInLowPowerMode = true;
        setForceShowBackdrop(true);
        setIsVideoPlaying(false);
        setIsVideoLoaded(false);
      } else {
        performanceOptimizationRef.current.isInLowPowerMode = false;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Pathname change detection for App Router
  useEffect(() => {
    return () => {
      if (isMountedRef.current) {
        destroyVideo();
      }
    };
  }, [pathname, destroyVideo]);

  // Override navigate functions to destroy video
  const safeNavigate = {
    push: (url: string) => {
      destroyVideo();
      setTimeout(() => {
        navigate.push(url);
      }, 50);
    },
    back: () => {
      destroyVideo();
      setTimeout(() => {
        navigate.back();
      }, 50);
    },
    replace: (url: string) => {
      destroyVideo();
      setTimeout(() => {
        navigate.replace(url);
      }, 50);
    }
  };

  // Chromecast integration
  const {
    castState,
    connect: connectToCast,
    disconnect: disconnectFromCast,
    loadMedia: loadCastMedia,
  } = useChromecast();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      destroyVideo();
    };
  }, [destroyVideo]);

  useEffect(() => {
    if (params.id) {
      fetchSeriesData();
      checkMyList();
      loadPlaybackProgress();
    }
  }, [params.id]);

  // Netflix-style title overlay animation
  useEffect(() => {
    if (!loading && series) {
      const timer = setTimeout(() => {
        setShowTitleOverlay(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [loading, series]);

  // Auto-hide trailer controls after 3 seconds when playing
  useEffect(() => {
    if (!isShowingTrailer || !isVideoPlaying || !showControls) return;

    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }

    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);

    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [showControls, isShowingTrailer, isVideoPlaying]);

  // Handle trailer video loading and sound initialization
  useEffect(() => {
    if (isShowingTrailer && trailerRef.current && !userPausedTrailer) {
      const timer = setTimeout(() => {
        if (trailerRef.current && !userPausedTrailer) {
          trailerRef.current.contentWindow?.postMessage('{"event":"command","func":"unMute","args":""}', '*');
          trailerRef.current.contentWindow?.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
          setIsVideoPlaying(true);
          setIsMuted(false);
        }
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [isShowingTrailer, trailerLoaded, userPausedTrailer]);

  // Auto-play trailer when it becomes ready
  useEffect(() => {
    if (isShowingTrailer && trailerReady && trailerRef.current && !isVideoPlaying && !userPausedTrailer) {
      const timer = setTimeout(() => {
        if (trailerRef.current && !userPausedTrailer) {
          trailerRef.current.contentWindow?.postMessage('{"event":"command","func":"unMute","args":""}', '*');
          trailerRef.current.contentWindow?.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
          setIsVideoPlaying(true);
          setIsMuted(false);
        }
      }, 200);

      return () => clearTimeout(timer);
    }
  }, [isShowingTrailer, trailerReady, isVideoPlaying, userPausedTrailer]);

  // Handle escape key to close trailer
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isShowingTrailer) {
        handleCloseTrailer();
      }
    };

    if (isShowingTrailer) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isShowingTrailer]);

  // YouTube API message listener for trailer state sync
  useEffect(() => {
    const handleYouTubeMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://www.youtube.com' || !isShowingTrailer) return;

      try {
        const data = JSON.parse(event.data);

        if (data.event === 'video-progress') {
          if (data.info && typeof data.info.playerState !== 'undefined') {
            const playerState = data.info.playerState;
            const isPlaying = playerState === 1;
            const isPaused = playerState === 2;
            const isReady = playerState >= 0;

            setIsVideoPlaying(isPlaying);
            setTrailerReady(isReady);

            if (isPlaying) {
              const video = videoRef.current;
              if (video) {
                video.pause();
                video.muted = true;
                video.volume = 0;
                video.currentTime = 0;
                video.style.display = 'none';
                video.style.visibility = 'hidden';
                video.style.opacity = '0';
              }

              setTimeout(() => {
                setShowControls(false);
              }, 3000);
            } else if (isPaused) {
              setShowControls(true);
            }
          }
        } else if (data.event === 'onReady') {
          const video = videoRef.current;
          if (video) {
            video.pause();
            video.muted = true;
            video.volume = 0;
            video.currentTime = 0;
            video.style.display = 'none';
            video.style.visibility = 'hidden';
            video.style.opacity = '0';
          }

          setTrailerReady(true);
          setTrailerLoaded(true);
          setTimeout(() => {
            if (trailerRef.current && !userPausedTrailer) {
              trailerRef.current.contentWindow?.postMessage('{"event":"command","func":"unMute","args":""}', '*');
              trailerRef.current.contentWindow?.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
              setIsVideoPlaying(true);
              setIsMuted(false);
            }
          }, 500);
        } else if (data.event === 'onStateChange') {
          if (data.info && typeof data.info === 'number') {
            const playerState = data.info;
            const isPlaying = playerState === 1;
            const isPaused = playerState === 2;
            const isEnded = playerState === 0;
            const isBuffering = playerState === 3;

            setIsVideoPlaying(isPlaying);
            setTrailerReady(playerState >= 0);

            if (isPlaying) {
              const video = videoRef.current;
              if (video) {
                video.pause();
                video.muted = true;
                video.volume = 0;
                video.currentTime = 0;
                video.style.display = 'none';
                video.style.visibility = 'hidden';
                video.style.opacity = '0';
              }

              setTimeout(() => {
                setShowControls(false);
              }, 3000);
            } else if (isPaused || isEnded) {
              setShowControls(true);
            }
          }
        }
      } catch (error) {
        console.warn('Error parsing YouTube message:', error);
      }
    };

    if (isShowingTrailer) {
      window.addEventListener('message', handleYouTubeMessage);
    }

    return () => {
      window.removeEventListener('message', handleYouTubeMessage);
    };
  }, [isShowingTrailer]);

  // Force show buttons after initial load
  const [forceShowButtons, setForceShowButtons] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setForceShowButtons(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const shouldShowButtons = !loading && series && (forceShowButtons || !showTitleOverlay || isHoveringTitle);
  const shouldShowMetadata = !loading && series && (forceShowButtons || !showTitleOverlay || isHoveringTitle);

  const fetchSeriesData = async () => {
    try {
      const apiUrl = getApiUrl();
      console.log('🔍 Fetching series data for ID:', params.id);

      // First try to get series info from the series API
      let seriesData = null;
      try {
        const seriesResponse = await fetch(`${apiUrl}/api/series/${params.id}`);
        if (seriesResponse.ok) {
          seriesData = await seriesResponse.json();
          console.log('✅ Found series data:', seriesData);
        }
      } catch (error) {
        console.warn('Series API not available, trying media API');
      }

      // If no series found, try to get it from media API
      if (!seriesData) {
        try {
          const mediaResponse = await fetch(`${apiUrl}/api/media/${params.id}`);
          if (mediaResponse.ok) {
            seriesData = await mediaResponse.json();
            console.log('✅ Found media data:', seriesData);
          }
        } catch (error) {
          console.warn('Media API failed:', error);
        }
      }

      // If still no series data, try to build it from episodes
      if (!seriesData) {
        console.log('🔍 Building series data from episodes...');
        const allMediaResponse = await fetch(`${apiUrl}/api/media`);
        const allMedia = await allMediaResponse.json();

        // Find episodes that might belong to this series
        const possibleEpisodes = allMedia.filter((media: Media) =>
          media.type === 'episode' && (
            media.series_id?.toString() === params.id?.toString() ||
            media.id?.toString() === params.id?.toString()
          )
        );

        if (possibleEpisodes.length > 0) {
          // Create series data from first episode
          const firstEpisode = possibleEpisodes[0];
          seriesData = {
            id: params.id,
            title: firstEpisode.series?.title || firstEpisode.title.replace(/\s*-\s*S\d+E\d+.*$/i, '') || 'Unknown Series',
            description: firstEpisode.series?.description || firstEpisode.description || '',
            rating: firstEpisode.rating || 0,
            type: 'series',
            thumbnail_path: firstEpisode.thumbnail_path,
            banner_path: firstEpisode.banner_path,
            genres: firstEpisode.genres || [],
            year: firstEpisode.year || (firstEpisode.release_date ? new Date(firstEpisode.release_date).getFullYear() : new Date().getFullYear()),
            tmdb_backdrop_url: firstEpisode.tmdb_backdrop_url,
            tmdb_poster_url: firstEpisode.tmdb_poster_url,
            tmdb_trailer_url: firstEpisode.tmdb_trailer_url
          };
          console.log('✅ Built series data from episodes:', seriesData);
        }
      }

      if (!seriesData) {
        console.error('❌ No series data found for ID:', params.id);
        setLoading(false);
        return;
      }

      setSeries(seriesData);

      // Get all episodes for this series
      const allMediaResponse = await fetch(`${apiUrl}/api/media`);
      const allMedia = await allMediaResponse.json();

      // Filter episodes that belong to this series
      const seriesEpisodes = allMedia.filter((media: Media) => {
        return media.type === 'episode' && (
          media.series_id?.toString() === params.id?.toString() ||
          (seriesData.title && media.title.toLowerCase().includes(seriesData.title.toLowerCase())) ||
          (media.file_path && seriesData.file_path &&
            media.file_path.includes(seriesData.file_path.split('/').slice(0, -1).join('/')))
        );
      });

      console.log('🔍 Found episodes:', seriesEpisodes.length);
      setEpisodes(seriesEpisodes);

      // Find latest episode (highest season and episode number)
      if (seriesEpisodes.length > 0) {
        const sortedEpisodes = seriesEpisodes.sort((a: Media, b: Media) => {
          const aSeasonNum = extractSeasonNumber(a.title) || 1;
          const bSeasonNum = extractSeasonNumber(b.title) || 1;
          const aEpisodeNum = extractEpisodeNumber(a.title) || 1;
          const bEpisodeNum = extractEpisodeNumber(b.title) || 1;
          
          if (aSeasonNum !== bSeasonNum) {
            return bSeasonNum - aSeasonNum; // Latest season first
          }
          return bEpisodeNum - aEpisodeNum; // Latest episode first
        });
        
        setLatestEpisode(sortedEpisodes[0]);
        console.log('🎬 Latest episode:', sortedEpisodes[0].title);
      }

      // Group episodes by season
      const seasonMap = new Map<number, Episode[]>();
      seriesEpisodes.forEach((episode: Media) => {
        const seasonNum = extractSeasonNumber(episode.title) || 1;
        if (!seasonMap.has(seasonNum)) {
          seasonMap.set(seasonNum, []);
        }
        seasonMap.get(seasonNum)?.push({
          id: episode.id,
          episode_number: extractEpisodeNumber(episode.title) || 1,
          name: episode.title,
          overview: episode.description || '',
          still_path: episode.thumbnail_path,
          air_date: episode.release_date,
          runtime: episode.duration ? Math.floor(episode.duration / 60) : undefined,
          vote_average: episode.rating
        });
      });

      // Create seasons array
      const seasonsArray: Season[] = Array.from(seasonMap.entries()).map(([seasonNum, eps]) => ({
        id: seasonNum,
        season_number: seasonNum,
        name: `Season ${seasonNum}`,
        overview: `Season ${seasonNum} of ${seriesData.title}`,
        episode_count: eps.length,
        episodes: eps.sort((a, b) => a.episode_number - b.episode_number)
      }));

      setSeasons(seasonsArray.sort((a, b) => a.season_number - b.season_number));

      // Load continue watching after episodes are set
      if (seriesEpisodes.length > 0) {
        // Check for continue watching episode
        const episodeWithProgress = seriesEpisodes.find((ep: Media) => {
          const progress = localStorage.getItem(`progress_${ep.id}`);
          return progress && JSON.parse(progress).progress > 0;
        });

        if (episodeWithProgress) {
          const progressData = JSON.parse(localStorage.getItem(`progress_${episodeWithProgress.id}`) || '{}');
          setContinueWatching({
            episode: episodeWithProgress,
            progress: progressData.progress || 0
          });
        }
      }

    } catch (error) {
      console.error('Error fetching series data:', error);
    } finally {
      setLoading(false);
    }
  };

  const extractSeasonNumber = (title: string): number | null => {
    const seasonMatch = title.match(/[Ss](\d+)[Ee](\d+)|[Ss]eason\s*(\d+)/i);
    if (seasonMatch) {
      return parseInt(seasonMatch[1] || seasonMatch[3]);
    }
    return null;
  };

  const extractEpisodeNumber = (title: string): number | null => {
    const episodeMatch = title.match(/[Ss](\d+)[Ee](\d+)|[Ee]pisode\s*(\d+)/i);
    if (episodeMatch) {
      return parseInt(episodeMatch[2] || episodeMatch[3]);
    }
    return null;
  };

  const checkMyList = () => {
    // Implementation for checking if series is in user's list
    setIsInMyList(false);
  };

  const loadPlaybackProgress = async () => {
    if (!latestEpisode?.id) {
      console.warn('No latest episode available for loading playback progress');
      return;
    }

    try {
      // First try to load from backend API
      const apiUrl = getApiUrl();
      if (apiUrl) {
        const response = await fetch(`${apiUrl}/api/playback/progress/${latestEpisode.id}`, {
          headers: {
            'X-User-ID': '1' // Default user for now
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data && typeof data.position === 'number' && typeof data.duration === 'number' && data.duration > 0) {
            setPlaybackProgress(Math.max(0, data.position));
            setPlaybackDuration(Math.max(0, data.duration));
            setHasWatchedBefore(true);
            setLastWatched(data.last_watched || new Date().toISOString());
            return;
          }
        }
      }
    } catch (error) {
      console.error('Error loading playback progress from API:', error);
    }

    // Fallback to localStorage
    try {
      if (typeof localStorage !== 'undefined') {
        const progress = localStorage.getItem(`progress_${latestEpisode.id}`);
        if (progress) {
          const progressData = JSON.parse(progress);
          if (progressData && progressData.progress !== undefined) {
            setPlaybackProgress(progressData.progress || 0);
            setLastWatched(progressData.timestamp || new Date().toISOString());
            setHasWatchedBefore((progressData.progress || 0) > 0);
          }
        }
      }
    } catch (error) {
      console.error('Error loading playback progress from localStorage:', error);
    }
  };

  // Load playback progress when latest episode is found
  useEffect(() => {
    if (latestEpisode) {
      loadPlaybackProgress();
    }
  }, [latestEpisode]);



  const handlePlay = (media?: Media) => {
    // Immediately and aggressively stop background video and trailer when opening player
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.muted = true;
      video.volume = 0;
      video.currentTime = 0;
      video.removeAttribute('autoplay');
      video.removeAttribute('loop');
      const sources = video.querySelectorAll('source');
      sources.forEach(source => source.remove());
      video.src = '';
      video.load();
      setIsVideoPlaying(false);
      setIsMuted(true);
    }

    // Close trailer if it's showing
    if (isShowingTrailer) {
      setIsShowingTrailer(false);
      setTrailerKey(null);
    }

    if (media) {
      setSelectedMedia(media);
    } else if (continueWatching) {
      setSelectedMedia(continueWatching.episode);
    } else if (latestEpisode) {
      // Start with latest episode
      setSelectedMedia(latestEpisode);
    } else if (episodes.length > 0) {
      // Fallback to first episode
      setSelectedMedia(episodes[0]);
    }

    setIsVideoLoaded(false);
    setIsVideoPlaying(false);
    setForceShowBackdrop(false);
    setIsPlayerOpen(true);
  };

  const handlePlayerClose = () => {
    try {
      setIsPlayerOpen(false);

      // Show backdrop instead of auto-restarting video
      setIsVideoPlaying(false);
      setIsMuted(true);
      setIsVideoLoaded(false);
      setForceShowBackdrop(true);

      // Stop background video
      const video = videoRef.current;
      if (video) {
        try {
          video.pause();
          video.muted = true;
          video.volume = 0;
          video.currentTime = 0;
          video.style.display = 'none';
          video.style.visibility = 'hidden';
          video.style.opacity = '0';
        } catch (videoError) {
          console.warn('Error stopping background video:', videoError);
        }
      }

      // Cleanup YouTube players safely
      if (ytPlayerRef) {
        try {
          ytPlayerRef.destroy();
          setYtPlayerRef(null);
        } catch (ytError) {
          console.warn('Error destroying YouTube player:', ytError);
        }
      }

      setUseYouTubeFallback(false);

      setTimeout(() => {
        if (isMountedRef.current) {
          setForceShowBackdrop(false);
        }
      }, 1000);
    } catch (error) {
      console.error('Error in handlePlayerClose:', error);
      setIsPlayerOpen(false);
    }
  };

  const handleSeasonSelect = (seasonNumber: number) => {
    setSelectedSeason(seasonNumber);
    navigate.push(`/tv-series/${params.id}/season/${seasonNumber}`);
  };

  const toggleMyList = () => {
    setIsInMyList(!isInMyList);
  };

  const getBackgroundImageUrl = (media: Media) => {
    try {
      const apiUrl = getApiUrl();

      // First try TMDB backdrop if available
      if (media?.tmdb_backdrop_url && typeof media.tmdb_backdrop_url === 'string' && media.tmdb_backdrop_url.trim()) {
        return media.tmdb_backdrop_url;
      }

      // Then try local banner
      if (media?.banner_path && typeof media.banner_path === 'string' && media.banner_path.trim()) {
        const fileName = media.banner_path.split('/').pop();
        if (fileName && fileName.trim()) {
          return `${apiUrl}/api/admin/assets/${fileName}`;
        }
      }

      // Use latest episode thumbnail if available
      if (latestEpisode?.thumbnail_path) {
        return `${apiUrl}/api/thumbnails/${latestEpisode.id}`;
      }

      // Try series poster as fallback
      if (media?.tmdb_poster_url) {
        return media.tmdb_poster_url;
      }

      // Fallback to series thumbnail
      return `${apiUrl}/api/thumbnails/${media?.id || 'default'}`;
    } catch (error) {
      console.error('Error getting background image URL:', error);
      const apiUrl = getApiUrl();
      return `${apiUrl}/api/thumbnails/default`;
    }
  };

  const getBackdropImageUrl = (media: Media) => {
    try {
      const apiUrl = getApiUrl();

      // First try TMDB backdrop if available (high priority for backdrop)
      if (media?.tmdb_backdrop_url && typeof media.tmdb_backdrop_url === 'string' && media.tmdb_backdrop_url.trim()) {
        return media.tmdb_backdrop_url;
      }

      // Then try local banner
      if (media?.banner_path && typeof media.banner_path === 'string' && media.banner_path.trim()) {
        const fileName = media.banner_path.split('/').pop();
        if (fileName && fileName.trim()) {
          return `${apiUrl}/api/admin/assets/${fileName}`;
        }
      }

      // Use latest episode thumbnail if available
      if (latestEpisode?.thumbnail_path) {
        return `${apiUrl}/api/thumbnails/${latestEpisode.id}`;
      }

      // Try series poster as fallback
      if (media?.tmdb_poster_url) {
        return media.tmdb_poster_url;
      }

      // Fallback to series thumbnail
      return `${apiUrl}/api/thumbnails/${media?.id || 'default'}`;
    } catch (error) {
      console.error('Error getting backdrop image URL:', error);
      const apiUrl = getApiUrl();
      return `${apiUrl}/api/thumbnails/default`;
    }
  };

  const getBackgroundVideoUrl = (media: Media) => {
    try {
      const apiUrl = getApiUrl();
      if (!apiUrl) {
        console.warn('No API URL available for background video');
        return null;
      }

      // Use latest episode for background video if available
      const episodeToUse = latestEpisode || media;
      if (!episodeToUse?.id) {
        console.warn('No episode available for background video');
        return null;
      }

      console.log('🎬 Getting background video for episode:', episodeToUse.title, 'ID:', episodeToUse.id);

      // First try local trailer for background
      if (episodeToUse?.trailer_path && typeof episodeToUse.trailer_path === 'string' && episodeToUse.trailer_path.trim()) {
        const fileName = episodeToUse.trailer_path.split('/').pop();
        if (fileName && fileName.trim()) {
          console.log('🎬 Using local trailer:', fileName);
          return `${apiUrl}/api/admin/assets/${fileName}`;
        }
      }

      // Then try preview clips (optimized for background)
      if (episodeToUse?.preview_clip_path && typeof episodeToUse.preview_clip_path === 'string' && episodeToUse.preview_clip_path.trim()) {
        const fileName = episodeToUse.preview_clip_path.split('/').pop();
        if (fileName && fileName.trim()) {
          console.log('🎬 Using preview clip:', fileName);
          return `${apiUrl}/api/admin/assets/${fileName}`;
        }
      }

      // Check if preview clips endpoint exists for this episode
      console.log('🎬 Using preview clips endpoint for episode:', episodeToUse.id);
      return `${apiUrl}/api/preview-clips/${episodeToUse.id}`;
    } catch (error) {
      console.error('Error getting background video URL:', error);
      return null;
    }
  };

  const handleWatchTrailer = () => {
    try {
      if (!series?.tmdb_trailer_url || typeof series.tmdb_trailer_url !== 'string' || !series.tmdb_trailer_url.trim()) {
        console.warn('No valid trailer URL available');
        alert('Trailer not available for this series');
        return;
      }

      const key = extractYouTubeKey(series.tmdb_trailer_url);
      if (key && typeof key === 'string' && key.trim()) {
        // IMMEDIATELY stop and destroy background video/audio
        const video = videoRef.current;
        if (video) {
          video.pause();
          video.muted = true;
          video.volume = 0;
          video.currentTime = 0;

          // Remove all sources to completely stop loading
          const sources = video.querySelectorAll('source');
          sources.forEach(source => source.remove());

          // Clear src and load to stop any ongoing requests
          video.src = '';
          video.load();

          // Hide video completely
          video.style.display = 'none';
          video.style.visibility = 'hidden';
          video.style.opacity = '0';
        }

        // Force stop using the hook's destroy method
        destroyVideo();

        // Update all video-related states immediately
        setIsVideoPlaying(false);
        setIsMuted(true);
        setIsVideoLoaded(false);
        setForceShowBackdrop(true);

        // Set trailer states - start with sound enabled
        setTrailerKey(key);
        setIsShowingTrailer(true);
        setShowControls(true);
        setTrailerLoaded(false);
        setTrailerReady(false);
        setIsMuted(false);
        setUserPausedTrailer(false);

        // Stop any other videos on the page
        const allVideos = document.querySelectorAll('video');
        allVideos.forEach(v => {
          if (v !== video) {
            v.pause();
            v.muted = true;
            v.volume = 0;
          }
        });

        // Stop any audio elements
        const allAudio = document.querySelectorAll('audio');
        allAudio.forEach(a => {
          a.pause();
          a.muted = true;
          a.volume = 0;
        });
      } else {
        console.warn('Could not extract YouTube key from trailer URL:', series.tmdb_trailer_url);
        alert('Invalid trailer URL format');
      }
    } catch (error) {
      console.error('Error handling trailer:', error);
      alert('Error loading trailer');
    }
  };

  const handleCloseTrailer = () => {
    try {
      setIsShowingTrailer(false);
      setTrailerKey(null);
      setIsVideoPlaying(false);
      setIsMuted(true);
      setShowControls(true);
      setTrailerLoaded(false);
      setTrailerReady(false);
      setUserPausedTrailer(false);

      // Ensure background video stays stopped and backdrop shows
      const video = videoRef.current;
      if (video && series && !isPlayerOpen) {
        try {
          video.pause();
          video.muted = true;
          video.volume = 0;
          video.currentTime = 0;
          setIsVideoPlaying(false);
          setIsMuted(true);
          setIsVideoLoaded(false);
          setForceShowBackdrop(true);

          // Keep video hidden to ensure backdrop is visible
          video.style.display = 'none';
          video.style.visibility = 'hidden';
          video.style.opacity = '0';
        } catch (videoError) {
          console.warn('Error stopping background video in handleCloseTrailer:', videoError);
        }

        // Don't reload video sources immediately - let user decide if they want video back
        setTimeout(() => {
          if (isMountedRef.current) {
            setForceShowBackdrop(false);
          }
        }, 3000);
      }
    } catch (error) {
      console.error('Error in handleCloseTrailer:', error);
    }
  };

  const formatRuntime = (minutes: number) => {
    if (!minutes || minutes <= 0) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));

    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 48) return 'Yesterday';
    return date.toLocaleDateString();
  };

  // Initialize YouTube background player when fallback is triggered
  useEffect(() => {
    if (!useYouTubeFallback || !ytReady || !series || isPlayerOpen || isShowingTrailer) return;

    const videoKey = series?.tmdb_trailer_url
      ? extractYouTubeKey(series.tmdb_trailer_url)
      : null;

    if (!videoKey) {
      console.warn('No valid YouTube trailer key found for background fallback');
      setUseYouTubeFallback(false);
      setForceShowBackdrop(true);
      return;
    }

    // Destroy previous player
    if (ytPlayerRef) {
      try {
        ytPlayerRef.destroy();
      } catch (e) {
        // Ignore
      }
      setYtPlayerRef(null);
    }

    const timer = setTimeout(() => {
      const containerId = `yt-player-background-${series.id}`;
      const container = document.getElementById(containerId);
      if (!container) {
        console.warn('YouTube background container not found');
        return;
      }

      console.log(`📺 Initializing YouTube background player for: ${series.title}`);

      try {
        const player = new window.YT.Player(containerId, {
          videoId: videoKey,
          playerVars: {
            autoplay: 1,
            mute: 0,
            controls: 0,
            showinfo: 0,
            rel: 0,
            iv_load_policy: 3,
            modestbranding: 1,
            playsinline: 1,
            disablekb: 1,
            fs: 0,
            cc_load_policy: 0,
            start: 10,
            loop: 1,
            playlist: videoKey,
            origin: window.location.origin,
          },
          events: {
            onStateChange: (event: any) => {
              if (event.data === 1) { // playing
                console.log('🎬 YouTube background trailer started playing');
                setIsVideoPlaying(true);
                setIsMuted(false);
                setForceShowBackdrop(false);
                setIsVideoLoaded(true);
              } else if (event.data === 0) { // ended - restart
                console.log('🎬 YouTube background trailer ended, restarting');
                event.target.seekTo(10);
                event.target.playVideo();
              } else if (event.data === 2) { // paused
                console.log('🎬 YouTube background trailer paused');
                setIsVideoPlaying(false);
              }
            },
            onReady: (event: any) => {
              console.log('🎬 YouTube background trailer ready');
              event.target.unMute();
              event.target.seekTo(10, true);
              event.target.playVideo();
              setIsVideoPlaying(true);
              setIsMuted(false);
              setForceShowBackdrop(false);
              setIsVideoLoaded(true);
            },
            onError: (event: any) => {
              console.error('YouTube background player error:', event.data);
              setUseYouTubeFallback(false);
              setForceShowBackdrop(true);
              setIsVideoLoaded(false);
              setIsVideoPlaying(false);
            },
          },
        });

        setYtPlayerRef(player);
      } catch (error) {
        console.error('Error creating YouTube background player:', error);
        setUseYouTubeFallback(false);
        setForceShowBackdrop(true);
        setIsVideoLoaded(false);
        setIsVideoPlaying(false);
      }
    }, 100);

    return () => {
      clearTimeout(timer);
    };
  }, [useYouTubeFallback, ytReady, series, isPlayerOpen, isShowingTrailer, extractYouTubeKey]);
  useEffect(() => {
    return () => {
      try {
        // Cleanup YouTube background player
        if (ytPlayerRef) {
          try {
            if (typeof ytPlayerRef.destroy === 'function') {
              ytPlayerRef.destroy();
            }
          } catch (e) {
            console.warn('Error destroying YouTube background player:', e);
          }
          setYtPlayerRef(null);
        }

        // Stop any background video
        const video = videoRef.current;
        if (video) {
          try {
            video.pause();
            video.muted = true;
            video.volume = 0;
            video.currentTime = 0;
            video.src = '';
            video.load();
          } catch (e) {
            console.warn('Error stopping background video:', e);
          }
        }
      } catch (error) {
        console.error('Error in cleanup useEffect:', error);
      }
    };
  }, [ytPlayerRef]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <RedLoader />
      </div>
    );
  }

  if (!series) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-center p-6">
        <h1 className="text-4xl font-bold text-white mb-4">Series Not Found</h1>
        <p className="text-xl text-white/80 mb-8">The requested TV series could not be found.</p>
        <button
          onClick={() => safeNavigate.back()}
          className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  const renderSeriesContent = (series: Media) => (
    <div className="min-h-screen bg-gradient-to-b from-red-900/20 via-black to-black text-white">
      <Navbar />
      <GradientBackground variant="cosmic" animate={true} className="fixed inset-0 -z-10 pointer-events-none" />

      {/* Hero Section */}
      <div className="relative h-screen overflow-hidden">
        {/* Backdrop Background Image - Shows when video not playing, not loaded, or player is open */}
        <div
          className={`absolute inset-0 pointer-events-none transition-opacity duration-1000 ${!isVideoLoaded || !isVideoPlaying || isPlayerOpen || forceShowBackdrop || (!useYouTubeFallback && !isVideoPlaying) ? 'opacity-100' : 'opacity-0'
            }`}
          style={{ zIndex: 2 }}
        >
          <img
            src={getBackdropImageUrl(series)}
            alt={series.title}
            className="w-full h-full object-cover"
            loading="eager"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              const apiUrl = getApiUrl();
              // First fallback to thumbnail
              if (!target.src.includes('/api/thumbnails/')) {
                target.src = `${apiUrl}/api/thumbnails/${series?.id || 'default'}`;
              } else if (!target.src.includes('default')) {
                // Second fallback to default thumbnail
                target.src = `${apiUrl}/api/thumbnails/default`;
              } else {
                // Final fallback to a solid color background
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent) {
                  parent.style.background = 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)';
                }
              }
            }}
          />
          {/* Gradient overlay for better text readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-black/20" />
        </div>

        {/* Background Video - Load latest episode preview */}
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover opacity-100 pointer-events-none"
          autoPlay={true}
          muted={false}
          loop={true}
          playsInline={true}
          preload="auto"
          controls={false}
          crossOrigin="anonymous"
          webkit-playsinline="true"
          x-webkit-airplay="allow"
          data-setup="{}"
          style={{
            zIndex: 5,
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            // Hide video completely when player is open, when we want to show backdrop, or when using YouTube fallback
            display: isPlayerOpen || !isVideoLoaded || !isVideoPlaying || forceShowBackdrop || useYouTubeFallback ? 'none' : 'block',
            visibility: isPlayerOpen || !isVideoLoaded || !isVideoPlaying || forceShowBackdrop || useYouTubeFallback ? 'hidden' : 'visible',
            opacity: isPlayerOpen || !isVideoLoaded || !isVideoPlaying || forceShowBackdrop || useYouTubeFallback ? 0 : 1,
            transition: 'opacity 0.3s ease-in-out'
          }}

          onLoadedData={() => {
            setIsVideoLoaded(true);
            if (videoRef.current) {
              const video = videoRef.current;

              video.currentTime = 0;
              video.volume = 1.0;
              video.muted = false;
              video.loop = true;

              // Immediate play attempt
              const immediatePlay = () => {
                video.play().then(() => {
                  setIsVideoPlaying(true);
                  setIsMuted(false);
                  setForceShowBackdrop(false);
                }).catch((error) => {
                  console.warn('Episode preview failed to play with sound, trying muted:', error);
                  video.muted = true;
                  setIsMuted(true);
                  video.play().then(() => {
                    setIsVideoPlaying(true);
                    setForceShowBackdrop(false);
                  }).catch((muteError) => {
                    console.warn('Episode preview failed completely, trying trailer fallback:', muteError);
                    // Try trailer fallback if preview fails
                    if (series?.tmdb_trailer_url && extractYouTubeKey(series.tmdb_trailer_url)) {
                      console.log('🎬 Episode preview failed, switching to trailer fallback');
                      setUseYouTubeFallback(true);
                      setForceShowBackdrop(false);
                    } else {
                      console.log('🎬 No trailer available, showing backdrop');
                      setForceShowBackdrop(true);
                    }
                  });
                });
              };

              // Try multiple times
              immediatePlay();
              setTimeout(immediatePlay, 50);
              setTimeout(immediatePlay, 200);
            }
          }}
          onError={(e) => {
            console.warn('Background episode preview failed to load, trying trailer fallback');
            
            // Try trailer fallback if preview fails to load
            if (series?.tmdb_trailer_url && extractYouTubeKey(series.tmdb_trailer_url)) {
              console.log('🎬 Episode preview failed to load, switching to trailer fallback');
              setUseYouTubeFallback(true);
              setIsVideoLoaded(false);
              setIsVideoPlaying(false);
              setForceShowBackdrop(false);
            } else {
              console.log('🎬 No trailer available, showing backdrop');
              setIsVideoLoaded(false);
              setIsVideoPlaying(false);
              setForceShowBackdrop(true);
            }
            
            // Stop video completely on error
            const video = videoRef.current;
            if (video) {
              video.pause();
              video.muted = true;
              video.volume = 0;
              video.currentTime = 0;
              // Remove failed sources to prevent retry loops
              const sources = video.querySelectorAll('source');
              sources.forEach(source => {
                if (source.src === e.currentTarget.currentSrc) {
                  source.remove();
                }
              });
              // Hide video element completely
              video.style.display = 'none';
              video.style.visibility = 'hidden';
              video.style.opacity = '0';
            }
          }}
          onCanPlay={() => {
            const video = videoRef.current;
            if (video) {
              video.muted = false;
              video.volume = 1.0;
              video.loop = true;

              const canPlayAttempt = () => {
                video.play().then(() => {
                  setIsVideoPlaying(true);
                  setIsMuted(false);
                }).catch(() => {
                  video.muted = true;
                  setIsMuted(true);
                  video.play().then(() => {
                    setIsVideoPlaying(true);
                  }).catch(() => {
                  });
                });
              };

              canPlayAttempt();
              setTimeout(canPlayAttempt, 100);
            }
          }}
          onPlay={() => {
            setIsVideoPlaying(true);
            setIsMuted(false);
          }}
          onPause={() => {
            setIsVideoPlaying(false);
          }}
          onLoadedMetadata={() => {
            const video = videoRef.current;
            if (video) {
              video.muted = false;
              video.volume = 1.0;
              video.loop = true;

              const metadataPlay = () => {
                video.play().then(() => {
                  setIsVideoPlaying(true);
                  setIsMuted(false);
                }).catch(() => {
                  video.muted = true;
                  setIsMuted(true);
                  video.play().then(() => {
                    setIsVideoPlaying(true);
                  }).catch(() => {
                  });
                });
              };

              metadataPlay();
              setTimeout(metadataPlay, 50);
            }
          }}
          onEnded={() => {
            // Ensure video loops even if loop attribute fails
            const video = videoRef.current;
            if (video && !isPlayerOpen) {
              video.currentTime = 0;
              video.play().catch(() => {
                console.warn('Failed to restart video loop');
              });
            }
          }}
        >
          {/* Episode preview sources - try latest episode preview clips first */}
          {(() => {
            const videoUrl = getBackgroundVideoUrl(series);
            const episodeId = latestEpisode?.id || series.id;
            
            console.log('🎬 Video URL:', videoUrl, 'Episode ID:', episodeId);
            
            if (!videoUrl && !episodeId) {
              // No video sources available - try trailer fallback immediately
              setTimeout(() => {
                if (series?.tmdb_trailer_url && extractYouTubeKey(series.tmdb_trailer_url)) {
                  console.log('🎬 No episode preview available, using trailer fallback');
                  setUseYouTubeFallback(true);
                  setForceShowBackdrop(false);
                } else {
                  console.log('🎬 No video sources available, showing backdrop');
                  setForceShowBackdrop(true);
                  setIsVideoLoaded(false);
                  setIsVideoPlaying(false);
                }
              }, 100);
              return null;
            }
            
            return (
              <>
                {/* Primary source: Latest episode preview clips with high quality */}
                <source
                  src={`${getApiUrl()}/api/preview-clips/${episodeId}?quality=high&format=mp4&cache=true`}
                  type="video/mp4"
                  onError={(e) => {
                    console.warn('High quality episode preview clip failed to load');
                    e.currentTarget.style.display = 'none';
                  }}
                />
                {/* Secondary source: Latest episode preview clips with medium quality */}
                <source
                  src={`${getApiUrl()}/api/preview-clips/${episodeId}?quality=medium&format=mp4`}
                  type="video/mp4"
                  onError={(e) => {
                    console.warn('Medium quality episode preview clip failed to load');
                    e.currentTarget.style.display = 'none';
                  }}
                />
                {/* Tertiary source: Local episode trailer/preview file */}
                {videoUrl && (
                  <source
                    src={videoUrl}
                    type="video/mp4"
                    onError={(e) => {
                      console.warn('Local episode video source failed to load');
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
                {/* Quaternary source: Asset URL */}
                <source
                  src={getAssetUrl('preview', episodeId, false) as string}
                  type="video/mp4"
                  onError={(e) => {
                    console.warn('Asset episode preview source failed to load - will try trailer fallback');
                    e.currentTarget.style.display = 'none';
                    // If this is the last source and it fails, trigger trailer fallback
                    const video = videoRef.current;
                    if (video) {
                      const remainingSources = Array.from(video.querySelectorAll('source')).filter(s => 
                        s.style.display !== 'none' && s !== e.currentTarget
                      );
                      if (remainingSources.length === 0) {
                        // All sources failed, try trailer fallback
                        setTimeout(() => {
                          if (series?.tmdb_trailer_url && extractYouTubeKey(series.tmdb_trailer_url)) {
                            console.log('🎬 All episode preview sources failed, switching to trailer fallback');
                            setUseYouTubeFallback(true);
                            setIsVideoLoaded(false);
                            setIsVideoPlaying(false);
                            setForceShowBackdrop(false);
                          } else {
                            console.log('🎬 No trailer available, showing backdrop');
                            setForceShowBackdrop(true);
                            setIsVideoLoaded(false);
                            setIsVideoPlaying(false);
                          }
                        }, 500);
                      }
                    }
                  }}
                />
                {/* Final fallback: Series-level preview if available */}
                <source
                  src={`${getApiUrl()}/api/preview-clips/${series.id}?quality=medium&format=mp4`}
                  type="video/mp4"
                  onError={(e) => {
                    console.warn('Series preview source failed to load - trying trailer fallback');
                    e.currentTarget.style.display = 'none';
                    // If this is truly the last source, trigger trailer fallback
                    const video = videoRef.current;
                    if (video) {
                      const remainingSources = Array.from(video.querySelectorAll('source')).filter(s => 
                        s.style.display !== 'none' && s !== e.currentTarget
                      );
                      if (remainingSources.length === 0) {
                        // All sources failed, try trailer fallback
                        setTimeout(() => {
                          if (series?.tmdb_trailer_url && extractYouTubeKey(series.tmdb_trailer_url)) {
                            console.log('🎬 All preview sources failed, switching to trailer fallback');
                            setUseYouTubeFallback(true);
                            setIsVideoLoaded(false);
                            setIsVideoPlaying(false);
                            setForceShowBackdrop(false);
                          } else {
                            console.log('🎬 No trailer available, showing backdrop');
                            setForceShowBackdrop(true);
                            setIsVideoLoaded(false);
                            setIsVideoPlaying(false);
                          }
                        }, 500);
                      }
                    }
                  }}
                />
              </>
            );
          })()}
          Your browser does not support the video tag.
        </video>

        {/* YouTube Background Fallback Player - Only show when video is playing */}
        {useYouTubeFallback && !isPlayerOpen && !isShowingTrailer && extractYouTubeKey(series.tmdb_trailer_url || '') && (
          <div
            className="absolute inset-0 z-[6] flex items-center justify-center overflow-hidden pointer-events-none"
            style={{
              clipPath: 'inset(0)',
              display: isPlayerOpen || forceShowBackdrop ? 'none' : 'block',
              visibility: isPlayerOpen || forceShowBackdrop ? 'hidden' : 'visible',
              opacity: isPlayerOpen || forceShowBackdrop ? 0 : 1,
            }}
          >
            <div className="relative w-full h-full overflow-hidden">
              <div
                id={`yt-player-background-${series.id}`}
                className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
                style={{
                  width: '120vw',
                  height: '120vh',
                  minWidth: '200vh',
                  minHeight: '70vw',
                  pointerEvents: 'none'
                }}
              />
              
              {/* Trailer Indicator - Shows when using trailer as background */}
              <div className="absolute top-4 left-4 z-[10] bg-black/70 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg pointer-events-none">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-xs font-semibold">Official Trailer</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* YouTube Trailer Overlay */}
        {isShowingTrailer && trailerKey && (
          <div
            className="absolute inset-0 z-[15] bg-black cursor-pointer"
            onMouseMove={() => {
              // Ensure background video is stopped when interacting with trailer
              const video = videoRef.current;
              if (video) {
                video.pause();
                video.muted = true;
                video.volume = 0;
                video.currentTime = 0;
                video.style.display = 'none';
                video.style.visibility = 'hidden';
                video.style.opacity = '0';
              }

              setShowControls(true);
              // Clear existing timeout
              if (controlsTimeoutRef.current) {
                clearTimeout(controlsTimeoutRef.current);
              }
              // Auto-hide controls after 3 seconds when playing
              if (isVideoPlaying) {
                controlsTimeoutRef.current = setTimeout(() => {
                  setShowControls(false);
                }, 3000);
              }
            }}
            onMouseLeave={() => {
              // Clear existing timeout
              if (controlsTimeoutRef.current) {
                clearTimeout(controlsTimeoutRef.current);
              }
              // Hide controls when mouse leaves if video is playing
              if (isVideoPlaying) {
                controlsTimeoutRef.current = setTimeout(() => {
                  setShowControls(false);
                }, 1000);
              }
            }}
            onClick={(e) => {
              // Only toggle play/pause if clicking on the overlay itself, not the controls
              if (e.target === e.currentTarget) {
                // Toggle play/pause on backdrop click
                if (trailerRef.current && trailerReady) {
                  const iframe = trailerRef.current;
                  if (isVideoPlaying) {
                    iframe.contentWindow?.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
                    setIsVideoPlaying(false);
                    setUserPausedTrailer(true); // Mark as user paused
                    console.log('User pausing trailer via backdrop click');
                  } else {
                    iframe.contentWindow?.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
                    setIsVideoPlaying(true);
                    setUserPausedTrailer(false); // Clear user paused state
                    console.log('User playing trailer via backdrop click');
                  }
                  setShowControls(true);

                  // Clear existing timeout
                  if (controlsTimeoutRef.current) {
                    clearTimeout(controlsTimeoutRef.current);
                  }
                  // Auto-hide controls after 3 seconds when playing
                  if (!isVideoPlaying) { // This will be true after we set it above
                    controlsTimeoutRef.current = setTimeout(() => {
                      setShowControls(false);
                    }, 3000);
                  }
                }
              }
            }}
          >
            <iframe
              ref={trailerRef}
              src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=0&controls=0&showinfo=0&rel=0&iv_load_policy=3&modestbranding=1&enablejsapi=1&loop=1&playlist=${trailerKey}&disablekb=1&fs=0&cc_load_policy=0&start=5&origin=${typeof window !== 'undefined' ? window.location.origin : ''}&vq=hd1080&hd=1&quality=hd1080`}
              className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 transition-opacity duration-500 ${trailerLoaded && trailerReady ? 'opacity-100' : 'opacity-0'}`}
              allow="autoplay; encrypted-media"
              allowFullScreen
              style={{
                width: '120vw',
                height: '120vh',
                minWidth: '200vh',
                minHeight: '70vw',
                pointerEvents: 'none',
                border: 'none',
                outline: 'none'
              }}
              onLoad={() => {
                setTrailerLoaded(true);
                // Initialize YouTube API communication and auto-play with sound (only if user hasn't paused)
                setTimeout(() => {
                  if (trailerRef.current && !userPausedTrailer) {
                    trailerRef.current.contentWindow?.postMessage('{"event":"listening","id":"trailer"}', '*');
                    // Force unmute and play
                    trailerRef.current.contentWindow?.postMessage('{"event":"command","func":"unMute","args":""}', '*');
                    trailerRef.current.contentWindow?.postMessage('{"event":"command","func":"seekTo","args":[3, true]}', '*');
                    trailerRef.current.contentWindow?.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
                    setIsVideoPlaying(true);
                    setIsMuted(false);
                  }
                }, 1000);
              }}
            />
            {/* Show backdrop image when video is paused or not loaded */}
            {(!trailerLoaded || !trailerReady || !isVideoPlaying) && (
              <div
                className="absolute inset-0 z-[10] bg-cover bg-center bg-no-repeat transition-opacity duration-500"
                style={{
                  backgroundImage: `url(${getBackdropImageUrl(series)})`,
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-black/20" />
                <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />

                {/* Loading indicator when trailer is loading */}
                {!trailerLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-black/70 backdrop-blur-sm rounded-full p-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                    </div>
                  </div>
                )}

                {/* Play button when trailer is ready but paused */}
                {trailerLoaded && trailerReady && !isVideoPlaying && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <button
                      onClick={() => {
                        if (trailerRef.current) {
                          trailerRef.current.contentWindow?.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
                          setIsVideoPlaying(true);
                          setUserPausedTrailer(false); // Clear user paused state
                          setShowControls(true);
                          console.log('User playing trailer via play button');
                        }
                      }}
                      className="bg-red-600/90 backdrop-blur-sm rounded-full p-6 hover:bg-red-700/90 transition-all duration-300 hover:scale-110"
                    >
                      <Play className="w-12 h-12 text-white fill-current" />
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent pointer-events-none" />
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

            {/* Trailer Controls */}
            <AnimatePresence>
              {showControls && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 pointer-events-none z-[25]"
                >
                  {/* Video Controls - Bottom right */}
                  <div className="absolute bottom-8 right-8 z-[30] flex gap-3 pointer-events-auto">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (trailerRef.current && trailerReady) {
                          const iframe = trailerRef.current;
                          if (isVideoPlaying) {
                            // User is pausing the video
                            iframe.contentWindow?.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
                            setIsVideoPlaying(false);
                            setUserPausedTrailer(true); // Mark as user paused
                            console.log('User pausing trailer');
                          } else {
                            // User is playing the video
                            iframe.contentWindow?.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
                            setIsVideoPlaying(true);
                            setUserPausedTrailer(false); // Clear user paused state
                            console.log('User playing trailer');
                          }
                          setShowControls(true);

                          // Clear existing timeout
                          if (controlsTimeoutRef.current) {
                            clearTimeout(controlsTimeoutRef.current);
                          }
                          // Auto-hide controls after 3 seconds when playing
                          if (!isVideoPlaying) { // This will be true after we set it above
                            controlsTimeoutRef.current = setTimeout(() => {
                              setShowControls(false);
                            }, 3000);
                          }
                        }
                      }}
                      className="p-3 bg-black/70 backdrop-blur-sm rounded-full text-white hover:bg-black/90 transition-all duration-300 hover:scale-110"
                      disabled={!trailerReady}
                    >
                      {isVideoPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (trailerRef.current && trailerReady) {
                          const iframe = trailerRef.current;
                          if (isMuted) {
                            // Unmute the video
                            iframe.contentWindow?.postMessage('{"event":"command","func":"unMute","args":""}', '*');
                            setIsMuted(false);
                            console.log('Unmuting trailer');
                          } else {
                            // Mute the video
                            iframe.contentWindow?.postMessage('{"event":"command","func":"mute","args":""}', '*');
                            setIsMuted(true);
                            console.log('Muting trailer');
                          }
                          setShowControls(true);

                          // Clear existing timeout
                          if (controlsTimeoutRef.current) {
                            clearTimeout(controlsTimeoutRef.current);
                          }
                          // Keep controls visible for a bit after mute/unmute
                          controlsTimeoutRef.current = setTimeout(() => {
                            if (isVideoPlaying) {
                              setShowControls(false);
                            }
                          }, 3000);
                        }
                      }}
                      className="p-3 bg-black/70 backdrop-blur-sm rounded-full text-white hover:bg-black/90 transition-all duration-300 hover:scale-110"
                      disabled={!trailerReady}
                    >
                      {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Minimal overlay for text readability only */}
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent z-[10] pointer-events-none" />

        {/* Volume Control - Only show when video is not playing or is muted */}
        {(!isVideoPlaying || isMuted) && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }} 
            animate={{ opacity: 1, x: 0 }} 
            transition={{ delay: 0.5, duration: 0.4 }} 
            className="absolute top-6 right-6 z-30"
          >
            <div className="group relative">
              <button 
                onClick={() => {
                  const video = videoRef.current;
                  if (video) {
                    video.muted = !video.muted;
                    setIsMuted(video.muted);
                  }
                }} 
                className="group p-3 rounded-full bg-black/40 backdrop-blur-md border border-white/20 hover:bg-black/60 hover:border-white/40 transition-all duration-200 hover:scale-110"
              >
                {isMuted ? <VolumeX className="w-5 h-5 text-white/80 group-hover:text-white transition-colors" /> : <Volume2 className="w-5 h-5 text-white/80 group-hover:text-white transition-colors" />}
              </button>
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/90 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                {isMuted ? "Unmute" : "Mute"}
              </div>
            </div>
          </motion.div>
        )}

        {/* Hero Content - Left Aligned with Poster */}
        <div className="absolute inset-0 z-[20] flex items-center justify-start p-8 pl-16 pointer-events-auto">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="flex flex-col md:flex-row items-start gap-8 max-w-5xl"
          >
            {/* Series Poster */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex-shrink-0"
            >
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-red-500/30 to-purple-500/30 rounded-lg blur-lg" />
                <div className="relative w-48 md:w-56 lg:w-64 h-72 md:h-84 lg:h-96 rounded-lg overflow-hidden shadow-2xl border border-white/10">
                  <img
                    src={(() => {
                      const apiUrl = getApiUrl();
                      // Prioritize server poster endpoint first
                      if (series.id) return `${apiUrl}/api/series/${series.id}/poster`;
                      // Then try TMDB poster
                      if (series.tmdb_poster_url) return series.tmdb_poster_url;
                      // Try poster path
                      if (series.poster_path) return `${apiUrl}/api/admin/assets/${series.poster_path.split('/').pop()}`;
                      // Fallback to thumbnail
                      return `${apiUrl}/api/thumbnails/${series.id}`;
                    })()}
                    alt={cleanMovieTitle(series.title)}
                    className="w-full h-full object-cover"
                    loading="eager"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      const apiUrl = getApiUrl();
                      // Fallback chain - try TMDB if server poster fails
                      if (!target.src.includes('tmdb') && series.tmdb_poster_url) {
                        target.src = series.tmdb_poster_url;
                      } else if (!target.src.includes('/api/thumbnails/')) {
                        target.src = `${apiUrl}/api/thumbnails/${series.id}`;
                      } else {
                        // Final fallback: gradient with series initial
                        const parent = target.parentElement!;
                        const initial = series.title?.charAt(0)?.toUpperCase() || 'S';
                        parent.innerHTML = `
                          <div class="w-full h-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center">
                            <span class="text-6xl font-bold text-white">${initial}</span>
                          </div>
                        `;
                      }
                    }}
                  />

                  {/* Progress Bar for latest episode */}
                  {hasWatchedBefore && playbackProgress > 0 && playbackDuration > 0 && latestEpisode && (
                    <>
                      <div className="absolute bottom-2 left-2 right-2 bg-black/50 rounded-full h-1 z-10">
                        <div
                          className="bg-red-600 h-full rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(Math.max((playbackProgress / playbackDuration) * 100, 0), 100)}%` }}
                        />
                      </div>
                      <div className="absolute bottom-4 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded z-10">
                        {Math.round((playbackProgress / playbackDuration) * 100)}%
                      </div>
                    </>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Series Details */}
            <div className="flex-1 text-left space-y-6 ml-12">
              {/* Series Title - Logo or Text */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <Tv className="w-6 h-6 text-red-500" />
                  <span className="text-red-400 font-semibold text-sm">TV SERIES</span>
                </div>

                {series.logo_path ? (
                  <img
                    src={`${getApiUrl()}/api/${series.logo_path}`}
                    alt={series.title}
                    className="max-h-20 md:max-h-28 w-auto mb-3 drop-shadow-2xl"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                      if (fallback) fallback.style.display = 'block';
                    }}
                  />
                ) : null}
                <h1
                  className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-3 leading-tight bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent"
                  style={{ display: series.logo_path ? 'none' : 'block' }}
                >
                  {series.title}
                </h1>

                <div className="text-white/80 text-base font-medium mb-3">
                  {seasons.length} Season{seasons.length !== 1 ? 's' : ''} • {episodes.length} Episodes
                </div>
              </motion.div>

              {/* Continue Watching or Latest Episode */}
              {(continueWatching || latestEpisode) && shouldShowMetadata && (
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                  className="mb-4"
                >
                  <div className="bg-white/10 backdrop-blur-md rounded-lg p-3 border border-white/20">
                    <div className="flex items-center gap-2 mb-1">
                      <PlayCircle className="w-4 h-4 text-red-400" />
                      <span className="text-white font-medium text-sm">
                        {continueWatching ? 'Continue Watching' : 'Latest Episode'}
                      </span>
                    </div>
                    <p className="text-white/80 text-xs">
                      {continueWatching ? (
                        `${continueWatching.episode.title} • ${Math.round((continueWatching.progress / (continueWatching.episode.duration || 1)) * 100)}% complete`
                      ) : (
                        latestEpisode?.title || 'New Episode Available'
                      )}
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Stats Row - Compact */}
              {shouldShowMetadata && (
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="flex flex-wrap items-center gap-2 text-sm mb-3"
                >
                  {series.rating && series.rating > 0 ? (
                    <div className="flex items-center gap-1 bg-yellow-500/20 px-2 py-1 rounded-full">
                      <Star className="w-4 h-4 text-yellow-400 fill-current" />
                      <span className="font-semibold">{series.rating.toFixed(1)}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 bg-gray-500/20 px-2 py-1 rounded-full">
                      <Star className="w-4 h-4 text-gray-400" />
                      <span className="font-semibold text-gray-400">N/A</span>
                    </div>
                  )}

                  <div className="flex items-center gap-1 bg-blue-500/20 px-2 py-1 rounded-full">
                    <Calendar className="w-4 h-4 text-blue-400" />
                    <span>{series.year || new Date().getFullYear()}</span>
                  </div>

                  {/* Quality Tags - Netflix-style tags */}
                  {latestEpisode?.quality_tags && latestEpisode.quality_tags.length > 0 && (
                    <QualityTags 
                      tags={latestEpisode.quality_tags} 
                      size="sm" 
                      variant="compact"
                      className="flex-wrap"
                    />
                  )}
                </motion.div>
              )}

              {/* Genres - Compact */}
              {series.genres && series.genres.length > 0 && shouldShowMetadata && (
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.25 }}
                  className="flex flex-wrap gap-1 mb-3"
                >
                  {series.genres.slice(0, 3).map((genre, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-red-600/30 border border-red-500/50 rounded-full text-xs font-medium"
                    >
                      {typeof genre === 'string' ? genre : genre?.name || 'Unknown'}
                    </span>
                  ))}
                </motion.div>
              )}

              {/* Action Buttons - Compact */}
              {shouldShowButtons && (
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                  className="flex flex-wrap gap-2 mb-4"
                >
                  <button
                    onClick={() => handlePlay()}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-xs font-semibold transition-all duration-300 hover:scale-105"
                  >
                    {continueWatching ? (
                      <PlayCircle className="w-3 h-3" />
                    ) : (
                      <Play className="w-3 h-3" />
                    )}
                    {continueWatching ? 'Continue' : 'Play'}
                  </button>

                  {/* Watch Trailer Button - Only show if TMDB trailer is available */}
                  {series.tmdb_trailer_url && (
                    <button
                      onClick={handleWatchTrailer}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-600/80 hover:bg-blue-700 rounded-lg text-xs font-semibold transition-all duration-300 hover:scale-105"
                    >
                      <Tv className="w-3 h-3" />
                      Trailer
                    </button>
                  )}

                  <MyListTooltip
                    media={series}
                    isInMyList={isInMyListHook(series.id)}
                    collections={collections}
                    onToggleMyList={() => toggleMyListHook(series.id)}
                    onAddToCollection={(collectionId) => addToCollection(collectionId, series.id)}
                    onCollectionCreated={fetchCollections}
                  >
                    <button className="flex items-center gap-1 px-3 py-1.5 bg-gray-800/80 hover:bg-gray-700 rounded-lg text-xs font-semibold transition-all duration-300 hover:scale-105">
                      {isInMyListHook(series.id) ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                      List
                    </button>
                  </MyListTooltip>

                  <button className="flex items-center gap-1 px-3 py-1.5 bg-gray-800/80 hover:bg-gray-700 rounded-lg text-xs font-semibold transition-all duration-300 hover:scale-105">
                    <Share className="w-3 h-3" />
                    Share
                  </button>
                </motion.div>
              )}

              {/* Description - Compact */}
              {shouldShowMetadata && (
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                >
                  <p className="text-sm text-gray-300 leading-relaxed line-clamp-3">
                    {series.description || "Experience this amazing TV series with compelling characters and engaging storylines that will keep you watching episode after episode."}
                  </p>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Seasons Section */}
      <div className="relative z-10 bg-black pt-16 pb-24">
        <div className="container mx-auto px-6 md:px-12 lg:px-16">
          <ScrollReveal direction="up" delay={0.2}>
            <h2 className="text-3xl font-bold text-white mb-8 flex items-center gap-2">
              <Tv className="w-8 h-8 text-red-500" />
              Seasons & Episodes
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {seasons.sort((a, b) => a.season_number - b.season_number).map((season) => {
                return (
                  <motion.div
                    key={season.id}
                    className="group cursor-pointer"
                    onClick={() => handleSeasonSelect(season.season_number)}
                    whileHover={{ scale: 1.05 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="relative aspect-[2/3] bg-gray-800 rounded-lg overflow-hidden mb-3 group-hover:scale-105 transition-transform duration-300">
                      {/* Use series poster for seasons */}
                      <img
                        src={`${getApiUrl()}/api/series/${series.id}/poster`}
                        alt={`${series?.title} ${season.name}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          const apiUrl = getApiUrl();
                          // Fallback chain: server poster -> TMDB poster -> series thumbnail -> gradient
                          if (series.tmdb_poster_url && !target.src.includes('tmdb')) {
                            target.src = series.tmdb_poster_url;
                          } else if (!target.src.includes('/api/thumbnails/')) {
                            target.src = `${apiUrl}/api/thumbnails/${series.id}`;
                          } else {
                            // Final fallback: Show gradient with season number
                            const parent = target.parentElement!;
                            parent.innerHTML = `
                              <div class="w-full h-full bg-gradient-to-br from-red-600 to-red-800 flex flex-col items-center justify-center">
                                <span class="text-4xl font-bold text-white">S${season.season_number}</span>
                                <span class="text-sm font-medium text-white/80 text-center px-2">${series.title}</span>
                              </div>
                            `;
                          }
                        }}
                      />

                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                      <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-1 rounded text-xs font-semibold">
                        S{season.season_number}
                      </div>

                      <div className="absolute bottom-0 left-0 right-0 p-3 transform translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                        <div className="text-white text-xs text-center mb-2">
                          {season.episode_count} Episode{season.episode_count !== 1 ? 's' : ''}
                        </div>
                        {season.episodes && season.episodes.length > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const firstEpisode = episodes.find(ep => ep.id === season.episodes![0].id);
                              if (firstEpisode) handlePlay(firstEpisode);
                            }}
                            className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-3 rounded text-xs font-medium flex items-center justify-center gap-1"
                          >
                            <Play className="w-3 h-3" />
                            Play
                          </button>
                        )}
                      </div>
                    </div>

                    <h3 className="text-white font-medium text-sm group-hover:text-red-400 transition-colors duration-300">
                      {season.name}
                    </h3>

                    {season.overview && (
                      <p className="text-white/60 text-xs mt-1 line-clamp-2">
                        {season.overview}
                      </p>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </ScrollReveal>

          {/* Series Details */}
          <ScrollReveal direction="up" delay={0.6}>
            <div className="mt-16">
              <h2 className="text-3xl font-bold text-white mb-8 flex items-center gap-2">
                <Info className="w-8 h-8 text-red-500" />
                About {series.title}
              </h2>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div>
                  <h3 className="text-xl font-semibold text-white mb-4">Series Information</h3>
                  <div className="space-y-3">
                    <div className="flex">
                      <span className="w-32 text-white/60">Type</span>
                      <span className="text-white">TV Series</span>
                    </div>
                    {series.genres && series.genres.length > 0 && (
                      <div className="flex">
                        <span className="w-32 text-white/60">Genres</span>
                        <span className="text-white">
                          {series.genres.map(g => typeof g === 'string' ? g : g?.name).filter(Boolean).join(', ')}
                        </span>
                      </div>
                    )}
                    <div className="flex">
                      <span className="w-32 text-white/60">Seasons</span>
                      <span className="text-white">{seasons.length}</span>
                    </div>
                    <div className="flex">
                      <span className="w-32 text-white/60">Episodes</span>
                      <span className="text-white">{episodes.length}</span>
                    </div>
                    {series.rating && (
                      <div className="flex">
                        <span className="w-32 text-white/60">Rating</span>
                        <span className="text-white flex items-center gap-1">
                          <Star className="w-4 h-4 text-yellow-400" />
                          {series.rating.toFixed(1)}
                        </span>
                      </div>
                    )}
                    {series.year && (
                      <div className="flex">
                        <span className="w-32 text-white/60">Year</span>
                        <span className="text-white">{series.year}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-white mb-4">Production Details</h3>
                  <div className="space-y-3">
                    {series.director && (
                      <div className="flex">
                        <span className="w-32 text-white/60">Creator</span>
                        <span className="text-white">{series.director}</span>
                      </div>
                    )}
                    {series.stars && (
                      <div className="flex">
                        <span className="w-32 text-white/60">Cast</span>
                        <span className="text-white">{series.stars}</span>
                      </div>
                    )}
                    {series.country && (
                      <div className="flex">
                        <span className="w-32 text-white/60">Country</span>
                        <span className="text-white">{series.country}</span>
                      </div>
                    )}
                    {series.language && (
                      <div className="flex">
                        <span className="w-32 text-white/60">Language</span>
                        <span className="text-white">{series.language}</span>
                      </div>
                    )}
                    {series.quality && (
                      <div className="flex">
                        <span className="w-32 text-white/60">Quality</span>
                        <span className="text-white">{series.quality}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>

      {/* Video Player Modal */}
      {selectedMedia && (
        <VideoPlayer
          media={selectedMedia}
          isOpen={isPlayerOpen}
          onClose={handlePlayerClose}
          startTime={continueWatching?.progress || 0}
          onPlayNext={(nextMedia) => {
            console.log('Playing next episode:', nextMedia.title);
            setSelectedMedia(nextMedia);
            // Keep player open and switch to next episode
          }}
          onProgress={async (currentTime: number, duration: number) => {
            if (!selectedMedia?.id || !duration) return;

            try {
              // Save to backend API
              const apiUrl = getApiUrl();
              await fetch(`${apiUrl}/api/playback/progress`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-User-ID': '1' // Default user for now
                },
                body: JSON.stringify({
                  media_id: parseInt(selectedMedia.id.toString()),
                  position: currentTime,
                  duration: duration,
                  progress: (currentTime / duration) * 100
                })
              });
            } catch (error) {
              console.error('Error saving playback progress:', error);
            }

            // Also save to localStorage for backward compatibility
            const progressData = {
              progress: currentTime,
              timestamp: new Date().toISOString(),
            };
            localStorage.setItem(`progress_${selectedMedia.id}`, JSON.stringify(progressData));
          }}
        />
      )}
    </div>
  );

  return renderSeriesContent(series);
}