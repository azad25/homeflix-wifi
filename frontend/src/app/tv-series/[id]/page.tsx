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
import CastCircleRow from '@/components/CastCircleRow';
import ImageWithFallback from '@/components/ImageWithFallback';
import CastSection from '@/components/CastSection';
import { useMyList } from '@/hooks/useMyList';
import MyListTooltip from '@/components/ui/MyListTooltip';
import GenreStyledText from '@/components/GenreStyledText';
import { isPlaceholderVideo, checkAndHandlePlaceholder, detectPlaceholderOnLoad } from '@/lib/videoUtils';
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
  release_date?: string;
  episode_count: number;
  episodes?: Episode[];
  poster_path?: string;
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
  guest_stars?: string[];
}

// Genre-based text styling utility
const getGenreTextStyle = (genres: string[] = []) => {
  const primaryGenre = genres[0]?.toLowerCase() || '';

  // Font family based on genre
  let fontFamily = 'font-sans'; // default
  if (primaryGenre.includes('horror') || primaryGenre.includes('thriller')) {
    fontFamily = 'font-mono'; // monospace for tension
  } else if (primaryGenre.includes('romance') || primaryGenre.includes('drama')) {
    fontFamily = 'font-serif'; // serif for elegance
  } else if (primaryGenre.includes('sci') || primaryGenre.includes('science')) {
    fontFamily = 'font-mono'; // monospace for tech feel
  } else if (primaryGenre.includes('comedy')) {
    fontFamily = 'font-sans'; // clean sans for readability
  }

  // Text size and styling
  const textSize = 'text-sm md:text-base'; // Reduced from lg
  const maxWidth = 'max-w-lg'; // Reduced from xl to lg
  const lineHeight = 'leading-relaxed';

  return {
    fontFamily,
    textSize,
    maxWidth,
    lineHeight,
    className: `${fontFamily} ${textSize} ${maxWidth} ${lineHeight}`
  };
};

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
  const [continueWatchingBySeason, setContinueWatchingBySeason] = useState<Map<number, { episode: Media, progress: number, position: number, duration: number, seasonNumber: number, episodeNumber: number, lastWatched: string }>>(new Map());
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
  const [recentSeries, setRecentSeries] = useState<Media[]>([]);

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
    if (params?.id) {
      fetchSeriesData();
      checkMyList();
      loadPlaybackProgress();
    }
  }, [params?.id]);

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

  const currentYear = new Date().getFullYear();
  const hasNewSeasonThisYear = React.useMemo(() => {
    if (!seasons || seasons.length === 0) return false;
    return seasons.some(season => {
      if (season.season_number === 0) return false; // Skip specials
      const dateStr = season.air_date || season.release_date;
      if (!dateStr) return false;
      try {
        return new Date(dateStr).getFullYear() === currentYear;
      } catch (e) {
        return false;
      }
    });
  }, [seasons, currentYear]);

  const fetchSeriesData = async () => {
    try {
      const apiUrl = getApiUrl();
      console.log('🔍 Fetching series data for ID:', params?.id);

      // First try to get series info from the series API
      let seriesData = null;
      try {
        const seriesResponse = await fetch(`${apiUrl}/api/series/${params?.id}`);
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
          const mediaResponse = await fetch(`${apiUrl}/api/media/${params?.id}`);
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
            media.series_id?.toString() === params?.id?.toString() ||
            media.id?.toString() === params?.id?.toString()
          )
        );

        if (possibleEpisodes.length > 0) {
          // Create series data from first episode
          const firstEpisode = possibleEpisodes[0];
          seriesData = {
            id: params?.id,
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
        console.error('❌ No series data found for ID:', params?.id);
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
          media.series_id?.toString() === params?.id?.toString() ||
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
          name: episode.episode_title || episode.title, // Use episode_title if available
          overview: episode.description || episode.long_desc || episode.short_desc || '',
          still_path: episode.episode_still_path || episode.thumbnail_path, // Use episode_still_path if available
          air_date: episode.release_date,
          runtime: episode.duration ? Math.floor(episode.duration / 60) : undefined,
          vote_average: episode.rating,
          guest_stars: episode.guest_stars // Include guest stars
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

      // Load continue watching after episodes are set - fetch progress for ALL episodes
      if (seriesEpisodes.length > 0) {
        const apiUrl2 = getApiUrl();
        const progressMap = new Map<number, { episode: Media, progress: number, position: number, duration: number, seasonNumber: number, episodeNumber: number, lastWatched: string }>();

        // Fetch progress for all episodes in parallel
        const progressPromises = seriesEpisodes.map(async (ep: Media) => {
          try {
            const resp = await fetch(`${apiUrl2}/api/playback/progress/${ep.id}`, {
              headers: { 'X-User-ID': '1' }
            });
            if (resp.ok) {
              const data = await resp.json();
              if (data && data.position > 0 && data.duration > 0) {
                const pct = (data.position / data.duration) * 100;
                // Skip completed episodes (>95%)
                if (pct < 95) {
                  return { episode: ep, data };
                }
              }
            }
          } catch (err) {
            // ignore individual failures
          }
          return null;
        });

        const results = await Promise.all(progressPromises);

        // Group by season: keep the most recently watched episode per season
        results.forEach((result) => {
          if (!result) return;
          const { episode: ep, data } = result;
          const sNum = extractSeasonNumber(ep.title) || 1;
          const eNum = extractEpisodeNumber(ep.title) || 1;
          const existing = progressMap.get(sNum);
          const lastWatched = data.last_watched || '';

          if (!existing || lastWatched > existing.lastWatched) {
            progressMap.set(sNum, {
              episode: ep,
              progress: (data.position / data.duration) * 100,
              position: data.position,
              duration: data.duration,
              seasonNumber: sNum,
              episodeNumber: eNum,
              lastWatched,
            });
          }
        });

        setContinueWatchingBySeason(progressMap);
      }

      // Fetch recent TV series (excluding current series)
      await fetchRecentSeries();

    } catch (error) {
      console.error('Error fetching series data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentSeries = async () => {
    try {
      const apiUrl = getApiUrl();
      console.log('🔍 Fetching recent TV series...');

      // Get all series directly from the series API
      const seriesResponse = await fetch(`${apiUrl}/api/series`);
      if (!seriesResponse.ok) {
        throw new Error('Failed to fetch series');
      }

      const allSeries = await seriesResponse.json();

      // Filter out current series and get recent ones
      const recentSeriesArray = allSeries
        .filter((s: Media) => s.id?.toString() !== params?.id?.toString())
        .sort((a: Media, b: Media) => {
          const aDate = new Date(a.created_at || a.release_date || 0);
          const bDate = new Date(b.created_at || b.release_date || 0);
          return bDate.getTime() - aDate.getTime();
        })
        .slice(0, 5); // Get top 5 recent series

      console.log('✅ Found recent series:', recentSeriesArray.map((s: Media) => s.title));
      setRecentSeries(recentSeriesArray);

    } catch (error) {
      console.error('Error fetching recent series:', error);
      setRecentSeries([]);
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

  // Check if preview is available and show backdrop if not
  useEffect(() => {
    if (!series || loading || isPlayerOpen || isShowingTrailer) return;

    const videoUrl = getBackgroundVideoUrl(series);
    const episodeToUse = latestEpisode || series;
    const hasPreview = videoUrl && (
      videoUrl.includes('/api/preview-clips/') ||
      (episodeToUse?.preview_clip_path && episodeToUse.preview_clip_path.trim()) ||
      (episodeToUse?.trailer_path && episodeToUse.trailer_path.trim())
    );

    if (!hasPreview) {
      console.log('🎬 No episode preview available, checking for trailer fallback');
      // No preview available - try trailer fallback or show backdrop
      if (series?.tmdb_trailer_url && extractYouTubeKey(series.tmdb_trailer_url)) {
        console.log('🎬 Using trailer fallback');
        setUseYouTubeFallback(true);
        setForceShowBackdrop(false);
      } else {
        console.log('🎬 No trailer available, showing backdrop');
        setForceShowBackdrop(true);
        setIsVideoLoaded(false);
        setIsVideoPlaying(false);
      }
    }
    // Don't disable YouTube fallback here - let the video onLoadedData handler do it
  }, [series, latestEpisode, loading, isPlayerOpen, isShowingTrailer, extractYouTubeKey]);



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
    } else if (continueWatchingBySeason.size > 0) {
      // Pick the most recently watched episode across all seasons
      const sorted = Array.from(continueWatchingBySeason.values()).sort((a, b) => b.lastWatched.localeCompare(a.lastWatched));
      setSelectedMedia(sorted[0].episode);
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
    navigate.push(`/tv-series/${params?.id}/season/${seasonNumber}`);
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

  // Helper function to check if all video sources have failed and trigger fallback
  const checkAllSourcesFailed = useCallback((videoElement: HTMLVideoElement | null, seriesItem: Media) => {
    if (!videoElement) return;

    const sources = Array.from(videoElement.querySelectorAll('source'));
    const activeSources = sources.filter(s => s.style.display !== 'none');

    if (activeSources.length === 0) {
      // All sources have failed, try trailer fallback
      setTimeout(() => {
        if (seriesItem?.tmdb_trailer_url && extractYouTubeKey(seriesItem.tmdb_trailer_url)) {
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
      }, 100);
    }
  }, [extractYouTubeKey]);

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

  // Global video play event listener to catch any video that starts playing
  useEffect(() => {
    const handleGlobalVideoPlay = (event: Event) => {
      const playingVideo = event.target as HTMLVideoElement;
      const backgroundVideo = videoRef.current;

      // If any video starts playing and it's not our background video, stop the background video
      if (backgroundVideo && playingVideo !== backgroundVideo) {
        backgroundVideo.pause();
        backgroundVideo.muted = true;
        backgroundVideo.volume = 0;
        setIsVideoPlaying(false);
        setIsMuted(true);
      }
    };

    const handleGlobalVideoLoadStart = (event: Event) => {
      const loadingVideo = event.target as HTMLVideoElement;
      const backgroundVideo = videoRef.current;

      // If any video starts loading and player is open, stop background video
      if (backgroundVideo && loadingVideo !== backgroundVideo && isPlayerOpen) {
        backgroundVideo.pause();
        backgroundVideo.muted = true;
        backgroundVideo.volume = 0;
        setIsVideoPlaying(false);
        setIsMuted(true);
      }
    };

    // Listen for all video events in the document
    document.addEventListener('play', handleGlobalVideoPlay, true);
    document.addEventListener('loadstart', handleGlobalVideoLoadStart, true);
    document.addEventListener('canplay', handleGlobalVideoPlay, true);

    return () => {
      document.removeEventListener('play', handleGlobalVideoPlay, true);
      document.removeEventListener('loadstart', handleGlobalVideoLoadStart, true);
      document.removeEventListener('canplay', handleGlobalVideoPlay, true);
    };
  }, [isPlayerOpen]);

  // Stop background video when player or trailer is active (event-driven, no polling)
  useEffect(() => {
    if (!isPlayerOpen && !isShowingTrailer) return;

    const video = videoRef.current;
    if (!video) return;

    // Stop video immediately when player opens
    const stopAndHide = () => {
      video.pause();
      video.muted = true;
      video.volume = 0;
      video.currentTime = 0;
      video.removeAttribute('autoplay');
      video.removeAttribute('loop');
      video.style.display = 'none';
      video.style.visibility = 'hidden';
      video.style.opacity = '0';
      setIsVideoPlaying(false);
      setIsMuted(true);
    };

    // Initial stop
    stopAndHide();

    // Event listener to catch any attempts to play while player is open
    const handlePlay = () => stopAndHide();
    video.addEventListener('play', handlePlay);
    video.addEventListener('playing', handlePlay);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('playing', handlePlay);
    };
  }, [isPlayerOpen, isShowingTrailer]);

  // Background video control when player opens/closes or trailer shows
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlayerOpen || isShowingTrailer) {
      // Player opened or trailer showing - completely stop and hide background video
      video.pause();
      video.muted = true;
      video.volume = 0;
      video.currentTime = 0;

      // Force stop all audio contexts
      try {
        video.pause();
        video.muted = true;
        video.volume = 0;
        video.currentTime = 0;

        // Remove all event listeners temporarily to prevent auto-restart
        video.removeAttribute('autoplay');
        video.removeAttribute('loop');

        // Clear all sources to stop loading
        const sources = video.querySelectorAll('source');
        sources.forEach(source => source.remove());
        video.src = '';
        video.load();
      } catch (error) {
        console.warn('Error stopping background video:', error);
      }

      setIsVideoPlaying(false);
      setIsMuted(true);
      video.style.display = 'none';
      video.style.visibility = 'hidden';
      video.style.opacity = '0';
    }
  }, [isPlayerOpen, isShowingTrailer]);



  // Controlled auto-play - only when appropriate and page is visible
  useEffect(() => {
    const forceVideoPlay = () => {
      const video = videoRef.current;
      // Only play if player is NOT open, trailer is NOT showing, page is visible, and video sources are available
      if (video && series && !isPlayerOpen && !isShowingTrailer && !loading && !document.hidden && !forceShowBackdrop) {
        // Check if video has valid sources before attempting to play
        const sources = video.querySelectorAll('source');
        const hasValidSources = Array.from(sources).some(source =>
          source.src && !source.style.display.includes('none')
        );

        if (!hasValidSources) {
          console.warn('No valid video sources available, showing backdrop');
          setForceShowBackdrop(true);
          setIsVideoLoaded(false);
          setIsVideoPlaying(false);
          return;
        }

        // Set video properties including loop
        video.loop = true;
        video.muted = false;
        video.volume = 1.0;
        video.currentTime = 0;
        setIsMuted(false);

        // Single play attempt with proper error handling
        video.play().then(() => {
          setIsVideoPlaying(true);
          setForceShowBackdrop(false);
          // Disable YouTube fallback when regular video plays successfully
          setUseYouTubeFallback(false);
        }).catch((error) => {
          console.warn('Failed to play video with sound, trying muted:', error);
          // Fallback to muted play
          video.muted = true;
          setIsMuted(true);
          video.play().then(() => {
            setIsVideoPlaying(true);
            setForceShowBackdrop(false);
            // Disable YouTube fallback when regular video plays successfully
            setUseYouTubeFallback(false);
          }).catch((muteError) => {
            console.warn('Failed to play video even muted, trying trailer fallback:', muteError);
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
      }
    };

    // Only trigger auto-play when conditions are right and page is visible
    if (series && !loading && !isPlayerOpen && !isShowingTrailer && !document.hidden && !forceShowBackdrop) {
      const timer = setTimeout(forceVideoPlay, 500);
      return () => clearTimeout(timer);
    }
  }, [series, loading, isPlayerOpen, isShowingTrailer, forceShowBackdrop, extractYouTubeKey]);

  // Initialize YouTube background player when fallback is triggered
  useEffect(() => {
    // Only initialize YouTube fallback if:
    // 1. YouTube fallback is enabled
    // 2. YouTube API is ready
    // 3. Series exists
    // 4. Player is not open
    // 5. Trailer overlay is not showing
    // 6. Regular video is NOT already playing (prevent conflict)
    // 7. No preview video is available or it failed to load
    if (!useYouTubeFallback || !ytReady || !series || isPlayerOpen || isShowingTrailer) return;

    // Don't start YouTube fallback if regular video is already playing successfully
    if (isVideoPlaying && isVideoLoaded && !forceShowBackdrop) {
      console.log('🎬 Regular video is playing, skipping YouTube fallback');
      return;
    }

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
              } else if (event.data === 0) { // ended - loop back
                console.log('🎬 YouTube background trailer ended, looping');
                event.target.seekTo(10);
                event.target.playVideo();
              } else if (event.data === 2) { // paused
                console.log('🎬 YouTube background trailer paused');
              }
            },
            onReady: (event: any) => {
              console.log('🎬 YouTube background trailer ready');
              // Triple-check that regular video isn't playing before starting YouTube
              if (!isVideoPlaying || forceShowBackdrop) {
                event.target.mute(); // Muting ensures browser playback isn't blocked automatically
                event.target.seekTo(10, true);
                event.target.playVideo();
                setIsVideoPlaying(true);
                setIsMuted(true);
                setForceShowBackdrop(false);
                setIsVideoLoaded(true);
              } else {
                console.log('🎬 Regular video is playing, not starting YouTube trailer');
              }
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
  }, [useYouTubeFallback, ytReady, series, isPlayerOpen, isShowingTrailer, extractYouTubeKey, latestEpisode]);
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
    <div className="min-h-screen bg-black text-white">
      <Navbar />

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
            // Hide video only when player is open, showing backdrop, or using YouTube fallback
            display: isPlayerOpen || forceShowBackdrop || useYouTubeFallback ? 'none' : 'block',
            visibility: isPlayerOpen || forceShowBackdrop || useYouTubeFallback ? 'hidden' : 'visible',
            opacity: isPlayerOpen || forceShowBackdrop || useYouTubeFallback ? 0 : 1,
            transition: 'opacity 0.3s ease-in-out'
          }}

          onLoadedData={() => {
            setIsVideoLoaded(true);
            if (videoRef.current) {
              const video = videoRef.current;

              // Check for placeholder video immediately
              detectPlaceholderOnLoad(video, () => {
                console.log('🎬 Placeholder detected, switching to trailer fallback');
                if (series?.tmdb_trailer_url && extractYouTubeKey(series.tmdb_trailer_url)) {
                  setUseYouTubeFallback(true);
                  setForceShowBackdrop(false);
                } else {
                  setForceShowBackdrop(true);
                }
              });

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
                  // Disable YouTube fallback when regular video plays successfully
                  setUseYouTubeFallback(false);
                }).catch((error) => {
                  console.warn('Episode preview failed to play with sound, trying muted:', error);
                  video.muted = true;
                  setIsMuted(true);
                  video.play().then(() => {
                    setIsVideoPlaying(true);
                    setForceShowBackdrop(false);
                    // Disable YouTube fallback when regular video plays successfully
                    setUseYouTubeFallback(false);
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
                  // Disable YouTube fallback when regular video plays successfully
                  setUseYouTubeFallback(false);
                }).catch(() => {
                  video.muted = true;
                  setIsMuted(true);
                  video.play().then(() => {
                    setIsVideoPlaying(true);
                    // Disable YouTube fallback when regular video plays successfully
                    setUseYouTubeFallback(false);
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
                  // Disable YouTube fallback when regular video plays successfully
                  setUseYouTubeFallback(false);
                }).catch(() => {
                  video.muted = true;
                  setIsMuted(true);
                  video.play().then(() => {
                    setIsVideoPlaying(true);
                    // Disable YouTube fallback when regular video plays successfully
                    setUseYouTubeFallback(false);
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

            // Check if preview is actually available
            const episodeToUse = latestEpisode || series;
            const hasPreview = videoUrl && (
              videoUrl.includes('/api/preview-clips/') ||
              (episodeToUse?.preview_clip_path && episodeToUse.preview_clip_path.trim()) ||
              (episodeToUse?.trailer_path && episodeToUse.trailer_path.trim())
            );

            // If no preview, don't render any sources - this will trigger onError
            if (!hasPreview) {
              console.log('🎬 No episode preview available for series:', series.id);
              return null;
            }

            // Preview is available - try to load it
            console.log('🎬 Loading episode preview for series:', series.id, 'Episode:', episodeId);
            return (
              <>
                {/* Primary source: Latest episode preview clips with high quality */}
                <source
                  src={`${getApiUrl()}/api/preview-clips/${episodeId}?quality=high&format=mp4&cache=true`}
                  type="video/mp4"
                  onError={(e) => {
                    console.warn('High quality episode preview clip failed to load');
                    e.currentTarget.style.display = 'none';
                    checkAllSourcesFailed(videoRef.current, series);
                  }}
                />
                {/* Secondary source: Latest episode preview clips with medium quality */}
                <source
                  src={`${getApiUrl()}/api/preview-clips/${episodeId}?quality=medium&format=mp4`}
                  type="video/mp4"
                  onError={(e) => {
                    console.warn('Medium quality episode preview clip failed to load');
                    e.currentTarget.style.display = 'none';
                    checkAllSourcesFailed(videoRef.current, series);
                  }}
                />
                {/* Tertiary source: Local episode trailer/preview file only if not an API endpoint */}
                {videoUrl && !videoUrl.includes('/api/preview-clips/') && (
                  <source
                    src={videoUrl}
                    type="video/mp4"
                    onError={(e) => {
                      console.warn('Local episode video source failed to load');
                      e.currentTarget.style.display = 'none';
                      checkAllSourcesFailed(videoRef.current, series);
                    }}
                  />
                )}
              </>
            );
          })()}
          Your browser does not support the video tag.
        </video>

        {/* YouTube Background Fallback Player - Always show when active, never hide */}
        {useYouTubeFallback && !isPlayerOpen && !isShowingTrailer && extractYouTubeKey(series.tmdb_trailer_url || '') && (
          <div
            className="absolute inset-0 z-[6] flex items-center justify-center overflow-hidden pointer-events-none"
            style={{
              clipPath: 'inset(0)',
              display: 'block',
              visibility: 'visible',
              opacity: 1,
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

              {/* Trailer Indicator removed per user request */}
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
              referrerPolicy="strict-origin-when-cross-origin"
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

                  {/* Gradient overlay for text readability */}
                  <div className="absolute inset-y-0 left-0 w-full md:w-3/4 lg:w-2/3 bg-gradient-to-r from-black/90 via-black/40 to-transparent z-[10] pointer-events-none" />
                  <div className="absolute inset-x-0 bottom-0 h-1/2 md:h-1/3 bg-gradient-to-t from-black via-black/70 to-transparent z-[10] pointer-events-none" />

                  {/* Hero Content */}
                  <div className="absolute inset-0 z-[20] flex items-end justify-between pb-4 md:pb-6 p-6 md:px-12 lg:px-16 pointer-events-auto w-full">
                    <motion.div
                      initial={{ opacity: 0, y: 50 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.8, delay: 0.2 }}
                      className="flex flex-row items-end justify-between gap-6 md:gap-8 w-full mb-0 md:mb-2 relative"
                    >
                      {/* Poster thumbnail in Info Section */}
                      <div className="hidden md:block absolute right-0 bottom-0 w-28 md:w-40 lg:w-48 xl:w-52 flex-shrink-0 rounded-xl overflow-hidden shadow-[0_16px_40px_rgba(0,0,0,0.8)] border border-white/10 aspect-[2/3] z-10">
                        <ImageWithFallback
                          mediaId={series.id}
                          alt={series.title}
                          posterUrl={series.tmdb_poster_url || null}
                          mediaType="series"
                          fill={true}
                          sizes="(max-width: 1024px) 200px, 300px"
                          className="object-cover opacity-90 hover:opacity-100 transition-opacity"
                        />
                      </div>

                      {/* Main Info Column */}
                      <div className="flex flex-col items-start gap-3 flex-1 min-w-0 pr-4 lg:max-w-[55%] xl:max-w-[50%] z-20">
                        {/* Series Title - Logo or Text */}
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.6, delay: 0.5 }}
                          className="w-full"
                        >
                          {series.logo_path ? (
                            <img
                              src={`${getApiUrl()}/api/${series.logo_path}`}
                              alt={series.title}
                              className="max-h-20 md:max-h-28 lg:max-h-32 w-auto mb-2 drop-shadow-[0_4px_24px_rgba(0,0,0,0.8)]"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                if (fallback) fallback.style.display = 'block';
                              }}
                            />
                          ) : null}
                          <h1
                            className="text-3xl md:text-4xl lg:text-5xl font-extrabold mb-1 text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.8)]"
                            style={{ display: series.logo_path ? 'none' : 'block' }}
                          >
                            {series.title}
                          </h1>
                        </motion.div>

                        {/* Seasons and Episodes Count */}
                        <div className="text-white/80 text-sm md:text-base font-medium -mt-2">
                          {seasons.length} Season{seasons.length !== 1 ? 's' : ''} • {episodes.length} Episodes
                        </div>

                        {/* Genres */}
                        {series.genres && series.genres.length > 0 && (
                          <motion.div
                            className="flex flex-wrap items-center gap-1.5 min-w-0 mb-1"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.65, duration: 0.4 }}
                          >
                            {series.genres.slice(0, 4).map((genre, index, arr) => (
                              <React.Fragment key={index}>
                                <span className="text-sm md:text-base font-semibold text-white drop-shadow-md">
                                  {typeof genre === 'string' ? genre : genre?.name || 'Unknown'}
                                </span>
                                {index < arr.length - 1 && <span className="w-1.5 h-1.5 rounded-full bg-white/60 mx-1 shadow-sm" />}
                              </React.Fragment>
                            ))}
                          </motion.div>
                        )}

                        {/* Overview */}
                        <motion.p
                          className="text-white/80 max-w-2xl line-clamp-3 md:line-clamp-4 drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] mb-2 text-sm md:text-base leading-snug"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.7, duration: 0.4 }}
                        >
                          <GenreStyledText genres={series.genres?.map(g => typeof g === 'string' ? g : g?.name).filter(Boolean) || []}>
                            {series.description || "Experience this amazing TV series with compelling characters and engaging storylines that will keep you watching episode after episode."}
                          </GenreStyledText>
                        </motion.p>

                        {/* Continue Watching or Latest Episode Alert */}
                        {(continueWatchingBySeason.size > 0 || latestEpisode) && shouldShowMetadata && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.75 }}
                            className="mb-2"
                          >
                            <div className="bg-white/10 backdrop-blur-md rounded border border-white/20 px-3 py-1.5 inline-flex items-center gap-2">
                              <PlayCircle className="w-3.5 h-3.5 text-red-400" />
                              <span className="text-white font-medium text-xs">
                                {continueWatchingBySeason.size > 0 ? 'Continue Watching: ' : 'Latest Episode: '}
                                <span className="text-white/80 font-normal">
                                  {continueWatchingBySeason.size > 0 ? (() => {
                                    const sorted = Array.from(continueWatchingBySeason.values()).sort((a, b) => b.lastWatched.localeCompare(a.lastWatched));
                                    const latest = sorted[0];
                                    return `S${latest.seasonNumber} E${latest.episodeNumber} • ${Math.round(latest.progress)}%`;
                                  })() : (
                                    latestEpisode?.title || 'Available'
                                  )}
                                </span>
                              </span>
                            </div>
                          </motion.div>
                        )}

                        {/* Stats Row */}
                        <motion.div
                          className="flex flex-wrap items-center gap-3 text-sm md:text-base font-medium text-white/90 drop-shadow-md mb-2"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.6, duration: 0.4 }}
                        >
                          {hasNewSeasonThisYear && (
                            <span className="text-green-400 font-bold uppercase text-xs border border-green-500/30 bg-green-500/10 px-1.5 py-0.5 rounded shadow-[0_0_10px_rgba(34,197,94,0.2)] tracking-wider">New Season</span>
                          )}
                          <span>{series.year || (series.release_date && new Date(series.release_date).getFullYear()) || new Date().getFullYear()}</span>
                          {series.rating && series.rating > 0 && (
                            <>
                              <span className="text-white/40">|</span>
                              <span className="flex items-center gap-1">
                                {series.rating.toFixed(1)} <span className="bg-yellow-500 text-black text-[10px] font-bold px-1 rounded-sm ml-0.5 mt-0.5" style={{ lineHeight: '1.2' }}>IMDb</span>
                              </span>
                            </>
                          )}
                          {/* Quality Tags */}
                          {latestEpisode?.quality_tags && latestEpisode.quality_tags.length > 0 ? (
                            <>
                              <span className="text-white/40">|</span>
                              <QualityTags
                                tags={latestEpisode.quality_tags}
                                size="sm"
                                variant="compact"
                                className="flex-wrap opacity-90"
                              />
                            </>
                          ) : series.quality && series.quality.trim() ? (
                            <>
                              <span className="text-white/40">|</span>
                              <span className="px-1.5 py-0.5 rounded bg-white/10 text-white/90 text-xs font-bold tracking-wider border border-white/20 uppercase shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
                                {series.quality.toLowerCase().includes('4k') || series.quality.toLowerCase().includes('2160') ? '4K' :
                                  series.quality.toLowerCase().includes('1080') ? '1080p' :
                                    series.quality.toLowerCase().includes('720') ? '720p' : series.quality}
                              </span>
                            </>
                          ) : null}
                        </motion.div>

                        {/* Action Buttons */}
                        <motion.div
                          className="flex flex-wrap items-center gap-2 mt-1"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.8, duration: 0.4 }}
                        >
                          <button
                            onClick={() => handlePlay()}
                            className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 bg-white text-black hover:bg-white/80 font-bold rounded shadow-lg transition-all duration-200 hover:scale-105 text-xs md:text-sm mr-2"
                          >
                            <Play className="w-3.5 h-3.5 md:w-4 md:h-4 fill-current" />
                            <span>{continueWatchingBySeason.size > 0 ? 'Continue' : 'Play'}</span>
                          </button>

                          {series.tmdb_trailer_url && (
                            <button
                              onClick={handleWatchTrailer}
                              className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 bg-gray-500/40 hover:bg-gray-500/60 text-white font-bold rounded backdrop-blur-md shadow-lg transition-all duration-200 hover:scale-105 text-xs md:text-sm"
                            >
                              <Tv className="w-3.5 h-3.5 md:w-4 md:h-4" />
                              <span className="hidden sm:inline">Trailer</span>
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
                            <button className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 bg-gray-500/40 hover:bg-gray-500/60 text-white font-bold rounded backdrop-blur-md shadow-lg transition-all duration-200 hover:scale-105 text-xs md:text-sm">
                              {isInMyListHook(series.id) ? (
                                <>
                                  <Check className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                  <span className="hidden sm:inline">In List</span>
                                </>
                              ) : (
                                <>
                                  <Plus className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                  <span className="hidden sm:inline">Watch List</span>
                                </>
                              )}
                            </button>
                          </MyListTooltip>

                          <button
                            onClick={() => safeNavigate.push(`/settings?tab=media&media=${encodeURIComponent(JSON.stringify({ id: series.id, type: 'tv', title: series.title }))}`)}
                            className="flex items-center justify-center p-2 md:p-2.5 bg-gray-500/40 hover:bg-gray-500/60 text-white rounded backdrop-blur-md shadow-lg transition-all duration-200 hover:scale-105"
                            title="Settings"
                          >
                            <Settings className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          </button>

                          {(getBackgroundVideoUrl(series) || extractYouTubeKey(series.tmdb_trailer_url || '')) && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isVideoPlaying) {
                                    if (useYouTubeFallback && ytPlayerRef) {
                                      try { ytPlayerRef.pauseVideo(); } catch (err) { }
                                    } else if (videoRef.current) {
                                      videoRef.current.pause();
                                    }
                                    setIsVideoPlaying(false);
                                    setUserPausedTrailer(true);
                                  } else {
                                    if (useYouTubeFallback && ytPlayerRef) {
                                      try { ytPlayerRef.playVideo(); } catch (err) { }
                                    } else if (videoRef.current) {
                                      videoRef.current.play().catch(e => console.error('Play failed', e));
                                    }
                                    setIsVideoPlaying(true);
                                    setForceShowBackdrop(false);
                                    setUserPausedTrailer(false);
                                  }
                                }}
                                className="flex items-center justify-center w-10 h-10 ml-4 border border-white/30 bg-black/40 hover:bg-black/60 text-white rounded-full backdrop-blur-md shadow-lg transition-all duration-200 hover:scale-110"
                                title={isVideoPlaying ? "Pause Video" : "Play Video"}
                              >
                                {isVideoPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isMuted) {
                                    if (useYouTubeFallback && ytPlayerRef) {
                                      try { ytPlayerRef.unMute(); } catch (err) { ytPlayerRef.contentWindow?.postMessage('{"event":"command","func":"unMute","args":""}', '*'); }
                                    }
                                    else if (videoRef.current) videoRef.current.muted = false;
                                    setIsMuted(false);
                                  } else {
                                    if (useYouTubeFallback && ytPlayerRef) {
                                      try { ytPlayerRef.mute(); } catch (err) { ytPlayerRef.contentWindow?.postMessage('{"event":"command","func":"mute","args":""}', '*'); }
                                    }
                                    else if (videoRef.current) videoRef.current.muted = true;
                                    setIsMuted(true);
                                  }
                                }}
                                className="flex items-center justify-center w-10 h-10 border border-white/30 bg-black/40 hover:bg-black/60 text-white rounded-full backdrop-blur-md shadow-lg transition-all duration-200 hover:scale-110"
                                title={isMuted ? "Unmute" : "Mute"}
                              >
                                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                              </button>
                            </>
                          )}
                        </motion.div>
                      </div>
                    </motion.div>
                  </div>
                </div>

              {/* Continue Watching Section */}
              {
                continueWatchingBySeason.size > 0 && (
                  <div className="relative z-10 bg-black pt-12 pb-4">
                    <div className="container mx-auto px-6 md:px-12 lg:px-16">
                      <ScrollReveal direction="up" delay={0.1}>
                        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                          <PlayCircle className="w-7 h-7 text-red-500" />
                          Continue Watching
                        </h2>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                          {Array.from(continueWatchingBySeason.entries())
                            .sort(([a], [b]) => a - b)
                            .map(([seasonNum, item]) => {
                              const episodeStill = item.episode.episode_still_path
                                ? `${getApiUrl()}/api/episode-stills/${item.episode.id}`
                                : `${getApiUrl()}/api/thumbnails/${item.episode.id}`;

                              return (
                                <motion.div
                                  key={`cw-s${seasonNum}`}
                                  className="group cursor-pointer"
                                  onClick={() => handlePlay(item.episode)}
                                  whileHover={{ scale: 1.03 }}
                                  transition={{ duration: 0.2 }}
                                >
                                  <div className="bg-white/5 hover:bg-white/10 rounded-xl overflow-hidden transition-all duration-200 border border-white/5 hover:border-white/20">
                                    {/* Episode Thumbnail */}
                                    <div className="relative aspect-video bg-black overflow-hidden">
                                      <img
                                        src={episodeStill}
                                        alt={item.episode.episode_title || item.episode.title}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        onError={(e) => {
                                          const target = e.target as HTMLImageElement;
                                          target.style.display = 'none';
                                        }}
                                      />

                                      {/* Play Overlay */}
                                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                                        <div className="bg-white rounded-full p-3">
                                          <Play className="w-6 h-6 text-black fill-current" />
                                        </div>
                                      </div>

                                      {/* Season/Episode Badge */}
                                      <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-sm px-2.5 py-1 rounded-md border border-white/20">
                                        <span className="text-xs font-bold text-white">S{item.seasonNumber} · E{item.episodeNumber}</span>
                                      </div>

                                      {/* Progress percentage */}
                                      <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-sm px-2 py-1 rounded-md border border-white/20">
                                        <span className="text-xs font-semibold text-white">{Math.round(item.progress)}%</span>
                                      </div>

                                      {/* Red Progress Bar */}
                                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-600/80">
                                        <div
                                          className="h-full bg-red-600 transition-all duration-300"
                                          style={{ width: `${Math.min(item.progress, 100)}%` }}
                                        />
                                      </div>
                                    </div>

                                    {/* Episode Info */}
                                    <div className="p-3">
                                      <p className="text-white/50 text-xs mb-0.5">Season {item.seasonNumber}</p>
                                      <h4 className="text-white font-semibold text-sm line-clamp-1">
                                        {item.episode.episode_title || item.episode.title}
                                      </h4>
                                    </div>
                                  </div>
                                </motion.div>
                              );
                            })}
                        </div>
                      </ScrollReveal>
                    </div>
                  </div>
                )
              }

              {/* Seasons Section */}
              <div className="relative z-10 bg-black pt-16 pb-24">
                <div className="container mx-auto px-6 md:px-12 lg:px-16">
                  <ScrollReveal direction="up" delay={0.2}>
                    <h2 className="text-3xl font-bold text-white mb-8 flex items-center gap-2">
                      <Tv className="w-8 h-8 text-red-500" />
                      Seasons
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
                            <div className="relative aspect-video bg-gray-800 rounded-lg overflow-hidden mb-3 group-hover:scale-105 transition-transform duration-300">
                              {/* Use series backdrop for seasons */}
                              <img
                                src={getBackdropImageUrl(series)}
                                alt={`${series?.title} ${season.name}`}
                                className="w-full h-full object-cover"
                                loading="lazy"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  const apiUrl = getApiUrl();
                                  // Fallback to thumbnail if backdrop fails
                                  if (!target.src.includes('/api/thumbnails/')) {
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

                  {/* Cast & Crew Section (Horizontal Circle Row) */}
                  <ScrollReveal direction="up" delay={0.3}>
                    <CastCircleRow mediaId={series.id} type="series" />
                  </ScrollReveal>

                  {/* Recent TV Series Section */}
                  {recentSeries.length > 0 && (
                    <ScrollReveal direction="up" delay={0.4}>
                      <div className="mt-16">
                        <h2 className="text-3xl font-bold text-white mb-8 flex items-center gap-2">
                          <Film className="w-8 h-8 text-red-500" />
                          Recent TV Series
                        </h2>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                          {recentSeries.map((recentSeriesItem) => (
                            <motion.div
                              key={recentSeriesItem.id}
                              className="group cursor-pointer"
                              onClick={() => safeNavigate.push(`/tv-series/${recentSeriesItem.id}`)}
                              whileHover={{ scale: 1.05 }}
                              transition={{ duration: 0.2 }}
                            >
                              <div className="relative aspect-[2/3] bg-gray-800 rounded-lg overflow-hidden mb-3 group-hover:scale-105 transition-transform duration-300">
                                <img
                                  src={`${getApiUrl()}/api/series/${recentSeriesItem.id}/poster`}
                                  alt={recentSeriesItem.title}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    const apiUrl = getApiUrl();
                                    // Fallback chain: TMDB poster -> thumbnail -> gradient
                                    if (recentSeriesItem.tmdb_poster_url && !target.src.includes('tmdb')) {
                                      target.src = recentSeriesItem.tmdb_poster_url;
                                    } else if (!target.src.includes('/api/thumbnails/')) {
                                      target.src = `${apiUrl}/api/thumbnails/${recentSeriesItem.id}`;
                                    } else {
                                      // Final fallback: Show gradient with series initial
                                      const parent = target.parentElement!;
                                      const initial = recentSeriesItem.title?.charAt(0)?.toUpperCase() || 'S';
                                      parent.innerHTML = `
                                <div class="w-full h-full bg-gradient-to-br from-blue-600 to-blue-800 flex flex-col items-center justify-center">
                                  <span class="text-4xl font-bold text-white">${initial}</span>
                                  <span class="text-xs font-medium text-white/80 text-center px-2 mt-1">TV Series</span>
                                </div>
                              `;
                                    }
                                  }}
                                />

                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                                {/* TV Series Badge */}
                                <div className="absolute top-2 left-2 bg-blue-600 text-white px-2 py-1 rounded text-xs font-semibold flex items-center gap-1">
                                  <Tv className="w-3 h-3" />
                                  TV
                                </div>

                                {/* Rating Badge */}
                                {recentSeriesItem.rating && recentSeriesItem.rating > 0 && (
                                  <div className="absolute top-2 right-2 bg-yellow-500/90 text-black px-2 py-1 rounded text-xs font-semibold flex items-center gap-1">
                                    <Star className="w-3 h-3 fill-current" />
                                    {recentSeriesItem.rating.toFixed(1)}
                                  </div>
                                )}

                                {/* Play Button Overlay */}
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      safeNavigate.push(`/tv-series/${recentSeriesItem.id}`);
                                    }}
                                    className="bg-red-600/90 backdrop-blur-sm rounded-full p-4 hover:bg-red-700/90 transition-all duration-300 hover:scale-110"
                                  >
                                    <Play className="w-6 h-6 text-white fill-current" />
                                  </button>
                                </div>

                                {/* Info Overlay */}
                                <div className="absolute bottom-0 left-0 right-0 p-3 transform translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                                  <div className="text-white text-xs text-center mb-2">
                                    {recentSeriesItem.year && `${recentSeriesItem.year} • `}
                                    {recentSeriesItem.genres && recentSeriesItem.genres.length > 0 && (
                                      <span>
                                        {recentSeriesItem.genres.slice(0, 2).map(g =>
                                          typeof g === 'string' ? g : g?.name
                                        ).filter(Boolean).join(' • ')}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <h3 className="text-white font-medium text-sm group-hover:text-red-400 transition-colors duration-300 line-clamp-2">
                                {recentSeriesItem.title}
                              </h3>

                              {recentSeriesItem.description && (
                                <p className="text-white/60 text-xs mt-1 line-clamp-2">
                                  {recentSeriesItem.description.length > 80
                                    ? recentSeriesItem.description.substring(0, 80) + '...'
                                    : recentSeriesItem.description}
                                </p>
                              )}
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    </ScrollReveal>
                  )}

                  {/* Series Details */}
                </div>
              </div>

              {/* Video Player Modal */}
              {
                selectedMedia && (
                  <VideoPlayer
                    media={selectedMedia}
                    isOpen={isPlayerOpen}
                    onClose={handlePlayerClose}
                    startTime={(() => { const sorted = Array.from(continueWatchingBySeason.values()).sort((a, b) => b.lastWatched.localeCompare(a.lastWatched)); return sorted.length > 0 ? sorted[0].position : 0; })()}
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
                )
              }
          </div >
        );

        return renderSeriesContent(series);
}
