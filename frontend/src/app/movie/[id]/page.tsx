"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import { usePageTitle } from '@/hooks/usePageTitle';
import { ArrowLeft, Play, Plus, Check, Share, Download, Info, Star, Clock, Calendar, Globe, Users, Award, Film, Tv, User, Mic, ChevronDown, ChevronUp, Volume2, VolumeX, Users as Cast, User as Director, X, Pause, Settings, RotateCcw, PlayCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from 'next/image';
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

// Local Related Media Component for local media files
interface LocalRelatedMediaProps {
  currentMedia: Media;
  className?: string;
}

interface LocalMediaItem {
  id: number;
  title: string;
  year: number;
  rating: number;
  genres: Array<{ name: string }>;
  poster_url?: string;
  overview?: string;
  description?: string;
  duration?: number;
  quality?: string;
}

const LocalRelatedMedia: React.FC<LocalRelatedMediaProps> = ({ currentMedia, className = '' }) => {
  const [relatedMedia, setRelatedMedia] = useState<LocalMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const fetchedRef = useRef<number | null>(null); // Track fetched media ID to prevent duplicate fetches
  const abortControllerRef = useRef<AbortController | null>(null);

  // Memoize similarity calculation function
  const calculateSimilarityMemo = useCallback((movie1: Media, movie2: LocalMediaItem): number => {
    let score = 0;
    try {
      if (movie1?.genres && movie2?.genres && Array.isArray(movie1.genres) && Array.isArray(movie2.genres)) {
        const genres1 = movie1.genres
          .map(g => {
            if (typeof g === 'string') return g;
            if (g && typeof g === 'object' && 'name' in g) return g.name;
            return null;
          })
          .filter(Boolean) as string[];
        const genres2 = movie2.genres.map(g => g?.name).filter(Boolean) as string[];
        if (genres1.length > 0 && genres2.length > 0) {
          const commonGenres = genres1.filter(g => genres2.includes(g));
          const genreSimilarity = commonGenres.length / Math.max(genres1.length, genres2.length, 1);
          score += genreSimilarity * 0.6;
        }
      }
      if (movie1?.year && movie2?.year && typeof movie1.year === 'number' && typeof movie2.year === 'number') {
        const yearDiff = Math.abs(movie1.year - movie2.year);
        const yearSimilarity = Math.max(0, 1 - yearDiff / 20);
        score += yearSimilarity * 0.2;
      }
      if (movie1?.rating && movie2?.rating && typeof movie1.rating === 'number' && typeof movie2.rating === 'number') {
        const ratingDiff = Math.abs(movie1.rating - movie2.rating);
        const ratingSimilarity = Math.max(0, 1 - ratingDiff / 5);
        score += ratingSimilarity * 0.2;
      }
    } catch (error) {
      return 0;
    }
    return Math.max(0, Math.min(1, score));
  }, []);

  useEffect(() => {
    // Skip if already fetched for this media ID
    if (!currentMedia?.id || fetchedRef.current === currentMedia.id) {
      if (!currentMedia?.id) setLoading(false);
      return;
    }

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const fetchRelatedMedia = async () => {
      try {
        setLoading(true);
        setError(null);

        const apiUrl = getApiUrl();
        if (!apiUrl) throw new Error('API URL not available');

        const response = await fetch(`${apiUrl}/api/media/movies`, {
          signal: controller.signal
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const allMovies = await response.json();
        if (!Array.isArray(allMovies)) {
          setRelatedMedia([]);
          return;
        }

        const otherMovies = allMovies.filter((movie: LocalMediaItem) =>
          movie && movie.id && movie.id !== currentMedia.id
        );

        const similarMovies = otherMovies
          .map((movie: LocalMediaItem) => ({
            ...movie,
            similarity: calculateSimilarityMemo(currentMedia, movie)
          }))
          .filter((movie: any) => movie && movie.similarity > 0.1)
          .sort((a: any, b: any) => (b.similarity || 0) - (a.similarity || 0))
          .slice(0, 12);

        setRelatedMedia(similarMovies);
        fetchedRef.current = currentMedia.id; // Mark as fetched
        setError(null);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Error fetching related media:', err);
          setError('Failed to load related content');
          setRelatedMedia([]);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchRelatedMedia();

    return () => {
      controller.abort();
    };
  }, [currentMedia?.id, calculateSimilarityMemo]);

  // Note: Similarity calculation moved to memoized callback above

  const getPosterUrl = (movie: LocalMediaItem) => {
    try {
      if (movie?.poster_url) return movie.poster_url;
      const apiUrl = getApiUrl();
      if (!apiUrl || !movie?.id) {
        return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQ1MCIgdmlld0JveD0iMCAwIDMwMCA0NTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iNDUwIiBmaWxsPSIjMzc0MTUxIi8+CjxwYXRoIGQ9Ik0xNTAgMjAwQzE4Ny4yNzkgMjAwIDIxOCAxNjkuMjc5IDIxOCAxMzJDMjE4IDk0LjcyMDggMTg3LjI3OSA2NCAxNTAgNjRDMTEyLjcyMSA2NCA4MiA5NC43MjA4IDgyIDEzMkM4MiAxNjkuMjc5IDExMi43MjEgMjAwIDE1MCAyMDBaIiBmaWxsPSIjNkI3Mjg4Ii8+CjxwYXRoIGQ9Ik04MiAyNzZDODIgMjM4LjY4IDExMi42OCAyMDggMTUwIDIwOEgxNTBDMTg3LjMyIDIwOCAyMTggMjM4LjY4IDIxOCAyNzZWMzUwSDgyVjI3NloiIGZpbGw9IiM2QjcyODgiLz4KPHN2Zz4K';
      }
      return `${apiUrl}/api/posters/${movie.id}`;
    } catch (error) {
      console.error('Error getting poster URL:', error);
      return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQ1MCIgdmlld0JveD0iMCAwIDMwMCA0NTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iNDUwIiBmaWxsPSIjMzc0MTUxIi8+CjxwYXRoIGQ9Ik0xNTAgMjAwQzE4Ny4yNzkgMjAwIDIxOCAxNjkuMjc5IDIxOCAxMzJDMjE4IDk0LjcyMDggMTg3LjI3OSA2NCAxNTAgNjRDMTEyLjcyMSA2NCA4MiA5NC43MjA4IDgyIDEzMkM4MiAxNjkuMjc5IDExMi43MjEgMjAwIDE1MCAyMDBaIiBmaWxsPSIjNkI3Mjg4Ii8+CjxwYXRoIGQ9Ik04MiAyNzZDODIgMjM4LjY4IDExMi42OCAyMDggMTUwIDIwOEgxNTBDMTg3LjMyIDIwOCAyMTggMjM4LjY4IDIxOCAyNzZWMzUwSDgyVjI3NloiIGZpbGw9IiM2QjcyODgiLz4KPHN2Zz4K';
    }
  };

  const handleMediaClick = (movie: LocalMediaItem) => {
    try {
      if (movie?.id && router) {
        router.push(`/movie/${movie.id}`);
      }
    } catch (error) {
      console.error('Error navigating to movie:', error);
    }
  };

  const formatRuntime = (minutes: number) => {
    try {
      if (!minutes || typeof minutes !== 'number' || minutes <= 0) return '';
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    } catch (error) {
      console.error('Error formatting runtime:', error);
      return '';
    }
  };

  if (loading) {
    return (
      <div className={`${className}`}>
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-bold text-white mb-6">
            Related Movies
          </h2>
          <div className="flex items-center justify-center py-12">
            <RedLoader />
          </div>
        </div>
      </div>
    );
  }

  if (error || relatedMedia.length === 0) {
    return null; // Don't show section if no related content
  }

  return (
    <div className={`${className}`}>
      <div className="max-w-7xl mx-auto">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
          <Film className="w-6 h-6 text-red-500" />
          Related Movies
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {relatedMedia.map((movie) => {
            if (!movie?.id) return null;

            return (
              <motion.div
                key={movie.id}
                className="group cursor-pointer"
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.2 }}
                onClick={() => handleMediaClick(movie)}
              >
                <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-gray-800 shadow-lg">
                  <img
                    src={getPosterUrl(movie)}
                    alt={movie.title || 'Movie poster'}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQ1MCIgdmlld0JveD0iMCAwIDMwMCA0NTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iNDUwIiBmaWxsPSIjMzc0MTUxIi8+CjxwYXRoIGQ9Ik0xNTAgMjAwQzE4Ny4yNzkgMjAwIDIxOCAxNjkuMjc5IDIxOCAxMzJDMjE4IDk0LjcyMDggMTg3LjI3OSA2NCAxNTAgNjRDMTEyLjcyMSA2NCA4MiA5NC43MjA4IDgyIDEzMkM4MiAxNjkuMjc5IDExMi43MjEgMjAwIDE1MCAyMDBaIiBmaWxsPSIjNkI3Mjg4Ii8+CjxwYXRoIGQ9Ik04MiAyNzZDODIgMjM4LjY4IDExMi42OCAyMDggMTUwIDIwOEgxNTBDMTg3LjMyIDIwOCAyMTggMjM4LjY4IDIxOCAyNzZWMzUwSDgyVjI3NloiIGZpbGw9IiM2QjcyODgiLz4KPHN2Zz4K';
                    }}
                  />

                  {/* Overlay with rating */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  {movie.rating && movie.rating > 0 && (
                    <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1">
                      <Star className="w-3 h-3 text-yellow-400 fill-current" />
                      <span className="text-xs font-semibold text-white">
                        {movie.rating.toFixed(1)}
                      </span>
                    </div>
                  )}

                  {/* Quality badge */}
                  {movie.quality && (
                    <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm rounded px-1 py-0.5">
                      <span className="text-xs font-bold text-white">
                        {movie.quality.includes('2160') || movie.quality.toLowerCase().includes('4k') ? '4K' :
                          movie.quality.includes('1080') || movie.quality.toLowerCase().includes('hd') ? 'HD' :
                            movie.quality.includes('720') ? '720p' : 'HD'}
                      </span>
                    </div>
                  )}

                  {/* Play button overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="bg-red-600/90 backdrop-blur-sm rounded-full p-3">
                      <Play className="w-6 h-6 text-white fill-current" />
                    </div>
                  </div>
                </div>

                {/* Title and metadata */}
                <div className="mt-2 px-1">
                  <h3 className="text-sm font-medium text-white line-clamp-2 group-hover:text-red-400 transition-colors">
                    {movie.title || 'Unknown Title'}
                  </h3>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                    {movie.year && <span>{movie.year}</span>}
                    {movie.duration && (
                      <>
                        <span>•</span>
                        <span>{formatRuntime(Math.floor(movie.duration / 60))}</span>
                      </>
                    )}
                  </div>
                  {movie.genres && Array.isArray(movie.genres) && movie.genres.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {movie.genres.slice(0, 2).map((genre, index) => {
                        if (!genre?.name) return null;
                        return (
                          <span
                            key={index}
                            className="text-xs text-gray-500 bg-gray-800/50 px-1 py-0.5 rounded"
                          >
                            {genre.name}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Custom hook to manage background video lifecycle
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

    // Don't listen to focus/blur events to avoid conflicts with address bar clicks
    const handleWindowFocus = () => {
      // Don't auto-resume video on focus to prevent unwanted audio
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('unload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handleHashChange);
    // Removed blur/focus listeners to prevent address bar conflicts
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
      // Removed blur/focus listeners cleanup
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

export default function MoviePage() {
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

  const [media, setMedia] = useState<Media | null>(null);

  // Update page title when media is loaded
  usePageTitle(media?.title || 'Movie');
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [isInMyList, setIsInMyList] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const [hasWatchedBefore, setHasWatchedBefore] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [lastWatched, setLastWatched] = useState<string | null>(null);
  const [showMoreInfo, setShowMoreInfo] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showTitleOverlay, setShowTitleOverlay] = useState(true); // Netflix-style title overlay
  const [isHoveringTitle, setIsHoveringTitle] = useState(false); // Hover state for title area
  const [forceStartFromBeginning, setForceStartFromBeginning] = useState(false); // Force start from beginning flag
  const [isShowingTrailer, setIsShowingTrailer] = useState(false); // Trailer mode state
  const [trailerKey, setTrailerKey] = useState<string | null>(null); // YouTube trailer key
  const [showControls, setShowControls] = useState(true); // Show/hide trailer controls
  const [trailerLoaded, setTrailerLoaded] = useState(false); // Track if trailer iframe is loaded
  const [trailerReady, setTrailerReady] = useState(false); // Track if trailer is ready to play
  const [forceShowBackdrop, setForceShowBackdrop] = useState(false); // Force show backdrop when player closes
  const [userPausedTrailer, setUserPausedTrailer] = useState(false); // Track if user manually paused trailer
  const [useYouTubeFallback, setUseYouTubeFallback] = useState(false); // Use YouTube trailer as background fallback
  const [ytReady, setYtReady] = useState(false); // YouTube API ready state
  const [ytPlayerRef, setYtPlayerRef] = useState<any>(null); // YouTube player reference for background

  // Use the new backend-connected My List hook
  const { myList, collections, isInMyList: isInMyListHook, toggleMyList: toggleMyListHook, addToCollection, fetchCollections } = useMyList();

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

  // Safe video operation wrapper to prevent client-side exceptions
  const safeVideoOperation = (operation: () => void, errorMessage: string) => {
    try {
      if (isMountedRef.current) {
        operation();
      }
    } catch (error) {
      console.warn(`${errorMessage}:`, error);
    }
  };

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

  // Use custom hook for background video management
  const {
    isVideoPlaying,
    setIsVideoPlaying,
    isMuted,
    setIsMuted,
    stopVideo,
    pauseVideo,
    destroyVideo
  } = useBackgroundVideo(videoRef, isPlayerOpen || isShowingTrailer); // Also stop when showing trailer

  // Performance optimization - manage low power mode
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        performanceOptimizationRef.current.isInLowPowerMode = true;
        // Force show backdrop when page is hidden to save resources
        setForceShowBackdrop(true);
        setIsVideoPlaying(false);
        setIsVideoLoaded(false);
      } else {
        performanceOptimizationRef.current.isInLowPowerMode = false;
        // Don't auto-resume video when page becomes visible - let user decide
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);



  // Pathname change detection for App Router
  useEffect(() => {
    // This will trigger when pathname changes, indicating navigation
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

  // Intersection Observer to stop video when component is not visible
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting && !isPlayerOpen) {
            stopVideo();
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(video);

    return () => {
      observer.disconnect();
      destroyVideo();
    };
  }, [stopVideo, destroyVideo, isPlayerOpen]);

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
      fetchMedia();
      checkMyList();
      loadPlaybackProgress();
    }
  }, [params?.id]);

  // Video loading timeout - show backdrop if video takes too long to load
  useEffect(() => {
    if (media && !isPlayerOpen && !isShowingTrailer) {
      // Set a timeout to show backdrop if video doesn't load within 10 seconds
      const videoLoadTimeout = setTimeout(() => {
        if (!isVideoLoaded || !isVideoPlaying) {
          console.warn('Video loading timeout - showing backdrop');
          setForceShowBackdrop(true);
          setIsVideoLoaded(false);
          setIsVideoPlaying(false);

          // Hide video element
          const video = videoRef.current;
          if (video) {
            video.style.display = 'none';
            video.style.visibility = 'hidden';
            video.style.opacity = '0';
          }
        }
      }, 10000); // 10 second timeout

      return () => clearTimeout(videoLoadTimeout);
    }
  }, [media, isPlayerOpen, isShowingTrailer, isVideoLoaded, isVideoPlaying]);

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





  // Controlled auto-play - only when appropriate and page is visible
  useEffect(() => {
    const forceVideoPlay = () => {
      const video = videoRef.current;
      // Only play if player is NOT open, trailer is NOT showing, page is visible, and video sources are available
      if (video && media && !isPlayerOpen && !isShowingTrailer && !loading && !document.hidden && !forceShowBackdrop) {
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
        }).catch((error) => {
          console.warn('Failed to play video with sound, trying muted:', error);
          // Fallback to muted play
          video.muted = true;
          setIsMuted(true);
          video.play().then(() => {
            setIsVideoPlaying(true);
            setForceShowBackdrop(false);
          }).catch((muteError) => {
            console.warn('Failed to play video even muted, showing backdrop:', muteError);
            setForceShowBackdrop(true);
            setIsVideoLoaded(false);
            setIsVideoPlaying(false);
          });
        });
      }
    };

    // Only trigger auto-play when conditions are right and page is visible
    if (media && !loading && !isPlayerOpen && !isShowingTrailer && !document.hidden && !forceShowBackdrop) {
      const timer = setTimeout(forceVideoPlay, 500);
      return () => clearTimeout(timer);
    }
  }, [media, loading, isPlayerOpen, isShowingTrailer, forceShowBackdrop]);

  // Check if preview is available and show backdrop if not
  useEffect(() => {
    if (!media || loading || isPlayerOpen || isShowingTrailer) return;

    const videoUrl = getBackgroundVideoUrl(media);
    const hasPreview = videoUrl && (
      videoUrl.includes('/api/preview-clips/') || 
      (media?.preview_clip_path && media.preview_clip_path.trim()) ||
      (media?.trailer_path && media.trailer_path.trim())
    );

    if (!hasPreview) {
      console.log('🎬 No preview available, checking for trailer fallback');
      // No preview available - try trailer fallback or show backdrop
      if (media?.tmdb_trailer_url && extractYouTubeKey(media.tmdb_trailer_url)) {
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
  }, [media, loading, isPlayerOpen, isShowingTrailer, extractYouTubeKey]);

  // Note: Removed duplicate video play effect - video already plays via onLoadedData and onCanPlay handlers

  // Cookie-based playback progress management
  const savePlaybackProgress = (mediaId: string, currentTime: number, duration: number) => {
    try {
      if (!mediaId || typeof currentTime !== 'number' || typeof duration !== 'number' || duration <= 0) {
        console.error('Invalid parameters for saving playback progress');
        return;
      }

      const progressData = {
        currentTime: Math.max(0, currentTime),
        duration: Math.max(0, duration),
        percentage: Math.min(100, Math.max(0, (currentTime / duration) * 100)),
        timestamp: new Date().toISOString(),
        lastWatched: new Date().toISOString()
      };

      // Save to cookie with 30 days expiration
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 30);

      const cookieValue = encodeURIComponent(JSON.stringify(progressData));
      document.cookie = `playback_${mediaId}=${cookieValue}; expires=${expirationDate.toUTCString()}; path=/; SameSite=Lax`;

      // Update local state
      setPlaybackProgress(progressData.currentTime);
      setPlaybackDuration(progressData.duration);
      setHasWatchedBefore(true);
      setLastWatched(progressData.lastWatched);
    } catch (error) {
      console.error('Error saving playback progress:', error);
    }
  };

  const getPlaybackProgressFromCookie = (mediaId: string) => {
    if (typeof document === 'undefined' || !mediaId) return null;

    try {
      const cookies = document.cookie?.split(';') || [];
      const progressCookie = cookies.find(cookie =>
        cookie?.trim().startsWith(`playback_${mediaId}=`)
      );

      if (progressCookie) {
        const cookieValue = progressCookie.split('=')[1];
        if (cookieValue) {
          const progressData = JSON.parse(decodeURIComponent(cookieValue));
          // Validate the progress data structure
          if (progressData && typeof progressData === 'object') {
            return progressData;
          }
        }
      }
    } catch (error) {
      console.error('Error parsing playback progress cookie:', error);
    }
    return null;
  };

  const clearPlaybackProgress = (mediaId: string) => {
    try {
      if (!mediaId) {
        console.error('No media ID provided for clearing progress');
        return;
      }

      // Clear cookie by setting expiration to past date
      document.cookie = `playback_${mediaId}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;

      // Reset local state
      setPlaybackProgress(0);
      setPlaybackDuration(0);
      setHasWatchedBefore(false);
      setLastWatched(null);
    } catch (error) {
      console.error('Error clearing playback progress:', error);
    }
  };

  // Netflix-style title overlay animation
  useEffect(() => {
    if (!loading && media) {
      // Start the drop-down animation after a brief delay
      const timer = setTimeout(() => {
        setShowTitleOverlay(false);
      }, 1500); // 1.5 second delay to show title first

      return () => clearTimeout(timer);
    }
  }, [loading, media]);

  // Auto-hide trailer controls after 3 seconds when playing
  useEffect(() => {
    if (!isShowingTrailer || !isVideoPlaying || !showControls) return;

    // Clear existing timeout
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

  // Handle trailer video loading and sound initialization - only auto-play if user hasn't paused
  useEffect(() => {
    if (isShowingTrailer && trailerRef.current && !userPausedTrailer) {
      // Ensure video plays with sound when trailer is showing (only if user hasn't paused)
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

  // Auto-play trailer when it becomes ready - only if user hasn't paused
  useEffect(() => {
    if (isShowingTrailer && trailerReady && trailerRef.current && !isVideoPlaying && !userPausedTrailer) {
      // Force play with sound when trailer is ready (only if user hasn't paused)
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
        console.log('YouTube message:', data);

        if (data.event === 'video-progress') {
          // Video progress updates
          if (data.info && typeof data.info.playerState !== 'undefined') {
            const playerState = data.info.playerState;
            // YouTube player states: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (cued)
            const isPlaying = playerState === 1;
            const isPaused = playerState === 2;
            const isReady = playerState >= 0; // Ready when not unstarted

            console.log('Video progress - playerState:', playerState, 'isPlaying:', isPlaying);

            setIsVideoPlaying(isPlaying);
            setTrailerReady(isReady);

            // When trailer starts playing, aggressively stop background video
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

              // Auto-hide controls when playing
              setTimeout(() => {
                setShowControls(false);
              }, 3000);
            } else if (isPaused) {
              // Keep controls visible when paused (don't set userPausedTrailer here as it might be from auto-play effects)
              setShowControls(true);
            }
          }
        } else if (data.event === 'onReady') {
          // Trailer is ready to play - ensure background video is stopped
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

          console.log('YouTube player ready');
          setTrailerReady(true);
          setTrailerLoaded(true);
          // Auto-play with sound after ready (only if user hasn't paused)
          setTimeout(() => {
            if (trailerRef.current && !userPausedTrailer) {
              console.log('Auto-playing trailer after ready');
              // Ensure sound is enabled first
              trailerRef.current.contentWindow?.postMessage('{"event":"command","func":"unMute","args":""}', '*');
              // Then start playing
              trailerRef.current.contentWindow?.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
              setIsVideoPlaying(true);
              setIsMuted(false);
            }
          }, 500);
        } else if (data.event === 'onStateChange') {
          // State change events
          if (data.info && typeof data.info === 'number') {
            const playerState = data.info;
            const isPlaying = playerState === 1;
            const isPaused = playerState === 2;
            const isEnded = playerState === 0;
            const isBuffering = playerState === 3;

            console.log('YouTube state change:', playerState, isPlaying ? 'playing' : isPaused ? 'paused' : isEnded ? 'ended' : isBuffering ? 'buffering' : 'other');

            // Update state immediately based on YouTube's state
            setIsVideoPlaying(isPlaying);
            setTrailerReady(playerState >= 0);

            // When trailer starts playing, aggressively stop background video
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

              // Auto-hide controls when playing
              setTimeout(() => {
                setShowControls(false);
              }, 3000);
            } else if (isPaused || isEnded) {
              // Keep controls visible when paused or ended (don't set userPausedTrailer here as it might be from auto-play effects)
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

  // Force show buttons after initial load to ensure they're always clickable
  const [forceShowButtons, setForceShowButtons] = useState(false);

  useEffect(() => {
    // Force show buttons after 3 seconds regardless of overlay state
    const timer = setTimeout(() => {
      setForceShowButtons(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const shouldShowButtons = !loading && media && (forceShowButtons || !showTitleOverlay || isHoveringTitle);
  const shouldShowMetadata = !loading && media && (forceShowButtons || !showTitleOverlay || isHoveringTitle);

  const fetchMedia = async () => {
    try {
      if (!params?.id) {
        console.error('No media ID provided');
        setMedia(null);
        return;
      }

      const apiUrl = getApiUrl();
      if (!apiUrl) {
        throw new Error('API URL not available');
      }

      const response = await fetch(`${apiUrl}/api/media/${params.id}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (!data) {
        throw new Error('No data received from API');
      }

      // Ensure data has required properties with defaults and proper type checking
      const mediaData = {
        ...data,
        id: data.id || params.id,
        genres: Array.isArray(data.genres) ? data.genres : [],
        stars: Array.isArray(data.stars) ? data.stars : [],
        title: data.title || 'Unknown Title',
        description: data.description || data.overview || '',
        year: data.year || (data.release_date ? new Date(data.release_date).getFullYear() : new Date().getFullYear()),
        rating: typeof data.rating === 'number' ? data.rating : 0,
        duration: typeof data.duration === 'number' ? data.duration : 0,
        director: data.director || null,
        country: data.country || null,
        language: data.language || null,
        quality: data.quality || null
      };

      setMedia(mediaData);
    } catch (error) {
      console.error('Error fetching media:', error);
      setMedia(null);
    } finally {
      setLoading(false);
    }
  };



  const checkMyList = async () => {
    if (params?.id) {
      try {
        const mediaId = parseInt(params.id as string);
        if (!isNaN(mediaId) && mediaId > 0) {
          const inList = isInWishlist(mediaId);
          setIsInMyList(Boolean(inList));
        } else {
          setIsInMyList(false);
        }
      } catch (error) {
        console.error('Error checking wishlist:', error);
        setIsInMyList(false);
      }
    } else {
      setIsInMyList(false);
    }
  };

  const toggleMyList = async () => {
    try {
      if (!params?.id) {
        console.error('No media ID available for wishlist operation');
        return;
      }

      const mediaId = parseInt(params.id as string);
      if (isNaN(mediaId) || mediaId <= 0) {
        console.error('Invalid media ID for wishlist operation');
        return;
      }

      let success = false;

      if (isInMyList) {
        success = removeFromWishlist(mediaId);
      } else {
        success = addToWishlist(mediaId);
      }

      if (success) {
        setIsInMyList(!isInMyList);
      } else {
        console.error('Failed to update wishlist');
      }
    } catch (error) {
      console.error('Error toggling wishlist:', error);
    }
  };

  const loadPlaybackProgress = async () => {
    if (!params?.id) {
      console.warn('No media ID available for loading playback progress');
      return;
    }

    try {
      // First try to load from backend API (same as ContinueWatching component)
      const apiUrl = getApiUrl();
      if (apiUrl) {
        const response = await fetch(`${apiUrl}/api/playback/progress/${params.id}`, {
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

    // Fallback to cookie system
    try {
      const cookieProgress = getPlaybackProgressFromCookie(params.id as string);
      if (cookieProgress && typeof cookieProgress.currentTime === 'number') {
        (cookieProgress.currentTime || 0);
        setPlaybackDuration(cookieProgress.duration || 0);
        setHasWatchedBefore(true);
        setLastWatched(cookieProgress.lastWatched || new Date().toISOString());
        return;
      }
    } catch (error) {
      console.error('Error loading playback progress from cookies:', error);
    }

    // Final fallback to localStorage (legacy system)
    try {
      if (typeof localStorage !== 'undefined') {
        const progress = localStorage.getItem(`progress_${params.id}`);
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

  const handlePlay = () => {
    // Immediately and aggressively stop background video and trailer when opening player
    const video = videoRef.current;
    if (video) {
      // Force complete stop
      video.pause();
      video.muted = true;
      video.volume = 0;
      video.currentTime = 0;

      // Remove attributes that could cause restart
      video.removeAttribute('autoplay');
      video.removeAttribute('loop');

      // Clear sources to prevent any background loading
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

    // Ensure backdrop shows when opening player
    setIsVideoLoaded(false);
    setIsVideoPlaying(false);
    setForceShowBackdrop(false); // Reset backdrop force state
    setIsPlayerOpen(true);
  };

  const handlePlayFromBeginning = () => {
    // Immediately and aggressively stop background video when opening player
    const video = videoRef.current;
    if (video) {
      // Force complete stop
      video.pause();
      video.muted = true;
      video.volume = 0;
      video.currentTime = 0;

      // Remove attributes that could cause restart
      video.removeAttribute('autoplay');
      video.removeAttribute('loop');

      // Clear sources to prevent any background loading
      const sources = video.querySelectorAll('source');
      sources.forEach(source => source.remove());
      video.src = '';
      video.load();

      setIsVideoPlaying(false);
      setIsMuted(true);
    }

    if (params?.id) {
      clearPlaybackProgress(params.id as string);
    }
    // Reset local playback state to ensure we start from beginning
    setPlaybackProgress(0);
    setPlaybackDuration(0);
    setHasWatchedBefore(false);
    setLastWatched(null);
    setForceStartFromBeginning(true);

    // Ensure backdrop shows when opening player
    setIsVideoLoaded(false);
    setIsVideoPlaying(false);
    setForceShowBackdrop(false); // Reset backdrop force state
    setIsPlayerOpen(true);
  };

  const handlePlayerClose = () => {
    try {
      setIsPlayerOpen(false);
      setForceStartFromBeginning(false);

      // Show backdrop instead of auto-restarting video to prevent unnecessary API calls
      setIsVideoPlaying(false);
      setIsMuted(true);
      setIsVideoLoaded(false);
      setForceShowBackdrop(true);

      // Stop background video but DON'T reload sources to avoid API calls
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

      // Reset YouTube fallback state
      setUseYouTubeFallback(false);

      // Reset backdrop state after delay (user can manually unmute to restart video)
      setTimeout(() => {
        if (isMountedRef.current) {
          setForceShowBackdrop(false);
        }
      }, 1000);
    } catch (error) {
      console.error('Error in handlePlayerClose:', error);
      // Ensure player is closed even if there's an error
      setIsPlayerOpen(false);
    }
  };

  // Handle cast button click
  const handleCastClick = () => {
    if (castState.isConnected) {
      disconnectFromCast();
    } else {
      connectToCast();
    }
  };

  // Start casting media when connected
  const handleStartCasting = () => {
    if (!media || !castState.isConnected) return;

    const streamUrl = `${getApiUrl()}/api/stream/${media.id}?quality=4k&format=mp4`;
    const thumbnailUrl = `${getApiUrl()}/api/thumbnails/${media.id}`;

    const castMedia: CastMedia = {
      contentId: streamUrl,
      contentType: 'video/mp4',
      title: media.title,
      subtitle: `${media.year || ''} • ${media.genres || ''}`,
      metadata: {
        title: media.title,
        subtitle: `${media.year || ''} • ${media.genres || ''}`,
        images: [{
          url: thumbnailUrl
        }]
      }
    };

    loadCastMedia(castMedia);

  };

  // Initialize YouTube background player when fallback is triggered
  useEffect(() => {
    if (!useYouTubeFallback || !ytReady || !media || isPlayerOpen || isShowingTrailer) return;

    const videoKey = media?.tmdb_trailer_url
      ? extractYouTubeKey(media.tmdb_trailer_url)
      : null;

    if (!videoKey) return;

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
      const containerId = `yt-player-background-${media.id}`;
      const container = document.getElementById(containerId);
      if (!container) return;

      console.log(`📺 Initializing YouTube background player for: ${media.title}`);

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
          cc_lang_pref: '',
          enablejsapi: 1,
          start: 10,
          loop: 1,
          playlist: videoKey,
          origin: window.location.origin,
        },
        events: {
          onStateChange: (event: any) => {
            if (event.data === 1) { // playing
              setIsVideoPlaying(true);
              setIsMuted(false);
              setForceShowBackdrop(false);
            } else if (event.data === 0) { // ended - restart
              event.target.seekTo(10);
              event.target.playVideo();
            }
          },
          onReady: (event: any) => {
            event.target.unMute();
            event.target.seekTo(10, true);
            event.target.playVideo();
            setIsVideoPlaying(true);
            setIsMuted(false);
            setForceShowBackdrop(false);
          },
          onError: (event: any) => {
            console.error('YouTube background player error:', event.data);
            setUseYouTubeFallback(false);
            setForceShowBackdrop(true);
          },
        },
      });

      setYtPlayerRef(player);
    }, 100);

    return () => {
      clearTimeout(timer);
    };
  }, [useYouTubeFallback, ytReady, media, isPlayerOpen, isShowingTrailer, extractYouTubeKey]);

  // Auto-start casting when connected and cast button is clicked
  React.useEffect(() => {
    if (castState.isConnected && media) {
      handleStartCasting();
    }
  }, [castState.isConnected, media]);

  const handlePlayerProgress = async (currentTime: number, duration: number) => {
    if (!params?.id || !duration) return;

    try {
      // Save to backend API (same as ContinueWatching component expects)
      const apiUrl = getApiUrl();
      await fetch(`${apiUrl}/api/playback/progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': '1' // Default user for now
        },
        body: JSON.stringify({
          media_id: parseInt(params.id as string),
          position: currentTime,
          duration: duration,
          progress: (currentTime / duration) * 100
        })
      });
    } catch (error) {
    }

    // Save to cookie-based system as fallback
    if (params?.id) {
      savePlaybackProgress(params.id as string, currentTime, duration);
    }

    // Also save to localStorage for backward compatibility
    const progressData = {
      progress: currentTime,
      timestamp: new Date().toISOString(),
    };
    if (params?.id) {
      localStorage.setItem(`progress_${params.id}`, JSON.stringify(progressData));
    }
  };

  // Helper function to check if all video sources have failed and trigger fallback
  const checkAllSourcesFailed = useCallback((videoElement: HTMLVideoElement | null, mediaItem: Media) => {
    if (!videoElement) return;
    
    const sources = Array.from(videoElement.querySelectorAll('source'));
    const activeSources = sources.filter(s => s.style.display !== 'none');
    
    if (activeSources.length === 0) {
      // All sources have failed, try trailer fallback
      setTimeout(() => {
        if (mediaItem?.tmdb_trailer_url && extractYouTubeKey(mediaItem.tmdb_trailer_url)) {
          console.log('🎬 All movie preview sources failed, switching to trailer fallback');
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

  const handleInfo = (media: Media) => {
    // Browse page only shows movies
    navigate.push(`/movie/${media.id}`);
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

  const formatProgressPercentage = (progress: number) => {
    return Math.round(progress * 100);
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

      // Fallback to thumbnail
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

      // Fallback to thumbnail (not poster for backdrop)
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

      // First try local trailer for background (lighter than full media file)
      if (media?.trailer_path && typeof media.trailer_path === 'string' && media.trailer_path.trim()) {
        const fileName = media.trailer_path.split('/').pop();
        if (fileName && fileName.trim()) {
          return `${apiUrl}/api/admin/assets/${fileName}`;
        }
      }

      // Then try preview clips (optimized for background)
      if (media?.preview_clip_path && typeof media.preview_clip_path === 'string' && media.preview_clip_path.trim()) {
        const fileName = media.preview_clip_path.split('/').pop();
        if (fileName && fileName.trim()) {
          return `${apiUrl}/api/admin/assets/${fileName}`;
        }
      }

      // Check if preview clips endpoint exists for this media
      if (media?.id) {
        return `${apiUrl}/api/preview-clips/${media.id}`;
      }

      // No valid video source found
      console.warn('No valid background video source found for media:', media?.id);
      return null;
    } catch (error) {
      console.error('Error getting background video URL:', error);
      return null;
    }
  };

  const handleWatchTrailer = () => {
    try {
      if (!media?.tmdb_trailer_url || typeof media.tmdb_trailer_url !== 'string' || !media.tmdb_trailer_url.trim()) {
        console.warn('No valid trailer URL available');
        // Show user-friendly message
        alert('Trailer not available for this movie');
        return;
      }

      const key = extractYouTubeKey(media.tmdb_trailer_url);
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
        setIsMuted(false); // Ensure trailer starts with sound
        setUserPausedTrailer(false); // Reset user pause state

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
        console.warn('Could not extract YouTube key from trailer URL:', media.tmdb_trailer_url);
        // Show user-friendly message
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
      setUserPausedTrailer(false); // Reset user pause state

      // Ensure background video stays stopped and backdrop shows
      const video = videoRef.current;
      if (video && media && !isPlayerOpen) {
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

  const handleMouseMove = () => {
    if (isShowingTrailer) {
      setShowControls(true);
    }
  };

  // Cleanup YouTube players on unmount
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

        // Cleanup YouTube trailer player
        if (ytPlayerRef.current) {
          try {
            if (typeof ytPlayerRef.current.destroy === 'function') {
              ytPlayerRef.current.destroy();
            }
          } catch (e) {
            console.warn('Error destroying YouTube trailer player:', e);
          }
          ytPlayerRef.current = null;
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
      </div>
    );
  }

  if (!media) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-center p-6">
        <h1 className="text-4xl font-bold text-white mb-4">Media Not Found</h1>
        <p className="text-xl text-white/80 mb-8">The requested media could not be found.</p>
        <button
          onClick={() => safeNavigate.back()}
          className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  const renderMediaContent = (media: Media) => (
    <div className="min-h-screen bg-gradient-to-b from-red-900/20 via-black to-black text-white">
      <Navbar />
      <GradientBackground variant="cosmic" animate={true} className="fixed inset-0 -z-10 pointer-events-none" />

      {/* Hero Section */}
      <div className="relative h-screen overflow-hidden">
        {/* Backdrop Background Image - Shows when video not playing, not loaded, player is open, or forcing backdrop (but not when using YouTube fallback) */}
        <div
          className={`absolute inset-0 pointer-events-none transition-opacity duration-1000 ${isPlayerOpen || (forceShowBackdrop && !useYouTubeFallback) || (!useYouTubeFallback && (!isVideoLoaded || !isVideoPlaying)) ? 'opacity-100' : 'opacity-0'
            }`}
          style={{ zIndex: 2 }}
        >
          <img
            src={getBackdropImageUrl(media)}
            alt={media.title}
            className="w-full h-full object-cover"
            loading="eager"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              const apiUrl = getApiUrl();
              // First fallback to thumbnail
              if (!target.src.includes('/api/thumbnails/')) {
                target.src = `${apiUrl}/api/thumbnails/${media?.id || 'default'}`;
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

        {/* Background Video - Load preview/trailer, not full media file */}
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
                  console.warn('Preview video failed to play with sound, trying muted:', error);
                  video.muted = true;
                  setIsMuted(true);
                  video.play().then(() => {
                    setIsVideoPlaying(true);
                    setForceShowBackdrop(false);
                  }).catch((muteError) => {
                    console.warn('Preview video failed completely, trying trailer fallback:', muteError);
                    // Try trailer fallback if preview fails
                    if (media?.tmdb_trailer_url && extractYouTubeKey(media.tmdb_trailer_url)) {
                      console.log('🎬 Preview failed, switching to trailer fallback');
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
            console.warn('Background video failed to load, trying trailer fallback');

            // Try trailer fallback if preview fails to load
            if (media?.tmdb_trailer_url && extractYouTubeKey(media.tmdb_trailer_url)) {
              console.log('🎬 Preview failed to load, switching to trailer fallback');
              setUseYouTubeFallback(true);
              setIsVideoLoaded(false);
              setIsVideoPlaying(false);
              setForceShowBackdrop(false); // Don't force backdrop when using trailer fallback
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
          onLoadStart={() => {
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
          {/* Preview/trailer sources - try preview clips first */}
          {(() => {
            const videoUrl = getBackgroundVideoUrl(media);
            
            // Check if preview is actually available
            const hasPreview = videoUrl && (
              videoUrl.includes('/api/preview-clips/') || 
              (media?.preview_clip_path && media.preview_clip_path.trim()) ||
              (media?.trailer_path && media.trailer_path.trim())
            );

            // If no preview, don't render any sources - this will trigger onError
            if (!hasPreview) {
              console.log('🎬 No preview available for media:', media.id);
              return null;
            }

            // Preview is available - try to load it
            console.log('🎬 Loading preview for media:', media.id, 'URL:', videoUrl);
            return (
              <>
                {/* Primary source: Preview clips with high quality */}
                <source
                  src={`${getApiUrl()}/api/preview-clips/${media.id}?quality=high&format=mp4&cache=true`}
                  type="video/mp4"
                  onError={(e) => {
                    console.warn('High quality preview clip failed to load');
                    e.currentTarget.style.display = 'none';
                    checkAllSourcesFailed(videoRef.current, media);
                  }}
                />
                {/* Secondary source: Preview clips with medium quality */}
                <source
                  src={`${getApiUrl()}/api/preview-clips/${media.id}?quality=medium&format=mp4`}
                  type="video/mp4"
                  onError={(e) => {
                    console.warn('Medium quality preview clip failed to load');
                    e.currentTarget.style.display = 'none';
                    checkAllSourcesFailed(videoRef.current, media);
                  }}
                />
                {/* Tertiary source: Local trailer/preview file only if it's not an API endpoint */}
                {videoUrl && !videoUrl.includes('/api/preview-clips/') && (
                  <source
                    src={videoUrl}
                    type="video/mp4"
                    onError={(e) => {
                      console.warn('Local video source failed to load');
                      e.currentTarget.style.display = 'none';
                      checkAllSourcesFailed(videoRef.current, media);
                    }}
                  />
                )}
              </>
            );
          })()}
          Your browser does not support the video tag.
        </video>

        {/* YouTube Background Fallback Player - Only show when video is playing */}
        {useYouTubeFallback && !isPlayerOpen && !isShowingTrailer && extractYouTubeKey(media.tmdb_trailer_url || '') && (
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
                id={`yt-player-background-${media.id}`}
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
                  backgroundImage: `url(${getBackdropImageUrl(media)})`,
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
                  {/* Close button - Top right */}
                  {/* <div className="absolute top-8 right-8 z-[30] pointer-events-auto">
                    <button
                      onClick={handleCloseTrailer}
                      className="p-3 bg-black/70 backdrop-blur-sm rounded-full text-white hover:bg-black/90 transition-all duration-300 hover:scale-110"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div> */}

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

        {/* Hero Content - Left Aligned with Poster */}
        <div className="absolute inset-0 z-[20] flex items-center justify-start p-8 pl-16 pointer-events-auto">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="flex flex-col md:flex-row items-start gap-8 max-w-5xl"
          >
            {/* Movie Poster */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex-shrink-0"
            >
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-red-500/30 to-purple-500/30 rounded-lg blur-lg" />
                <div className="relative w-48 md:w-56 lg:w-64 h-72 md:h-84 lg:h-96 rounded-lg overflow-hidden shadow-2xl border border-white/10">
                  <ImageWithFallback
                    mediaId={media.id}
                    alt={cleanMovieTitle(media.title)}
                    fill={true}
                    sizes="256px"
                    className="object-cover"
                    loading="eager"
                  />

                  {/* Progress Bar */}
                  {hasWatchedBefore && playbackProgress > 0 && playbackDuration > 0 && (
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

            {/* Movie Details */}
            <div className="flex-1 text-left space-y-6 ml-12">
              {/* Movie Title - Logo or Text */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
              >
                {media.logo_path ? (
                  <img
                    src={`${getApiUrl()}/api/${media.logo_path}`}
                    alt={media.title}
                    className="max-h-16 md:max-h-24 w-auto mb-4 drop-shadow-[0_4px_20px_rgba(0,0,0,0.8)]"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                      if (fallback) fallback.style.display = 'block';
                    }}
                  />
                ) : null}
                <h1
                  className="text-3xl md:text-4xl lg:text-5xl font-bold mb-3 text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.8)]"
                  style={{ display: media.logo_path ? 'none' : 'block' }}
                >
                  {media.title}
                </h1>

                {media.tagline && (
                  <p className="text-lg text-red-400 mb-4 italic font-medium">
                    "{media.tagline}"
                  </p>
                )}
              </motion.div>

              {/* Stats Row */}
              <motion.div
                className="flex flex-wrap items-center gap-2 text-xs"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.4 }}
              >
                {media.rating && media.rating > 0 ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-semibold backdrop-blur-sm border bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
                    <Star className="w-3 h-3 fill-current" />
                    {media.rating.toFixed(1)}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-semibold backdrop-blur-sm border bg-gray-500/10 text-gray-400 border-gray-500/20">
                    <Star className="w-3 h-3" />
                    N/A
                  </span>
                )}

                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full backdrop-blur-sm border bg-blue-500/10 text-blue-400 border-blue-500/20">
                  <Calendar className="w-3 h-3" />
                  {media.year || (media.release_date && new Date(media.release_date).getFullYear()) || new Date().getFullYear()}
                </span>

                {media.duration && media.duration > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full backdrop-blur-sm border bg-green-500/10 text-green-400 border-green-500/20">
                    <Clock className="w-3 h-3" />
                    {formatRuntime(Math.floor(media.duration / 60))}
                  </span>
                )}

                {/* Quality Tags - Netflix-style tags */}
                {media.quality_tags && media.quality_tags.length > 0 && (
                  <QualityTags
                    tags={media.quality_tags}
                    size="sm"
                    variant="compact"
                    className="flex-wrap"
                  />
                )}
              </motion.div>

              {/* Genres */}
              {media.genres && media.genres.length > 0 && (
                <motion.div
                  className="flex flex-wrap items-center gap-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.65, duration: 0.4 }}
                >
                  {media.genres.slice(0, 3).map((genre, index) => (
                    <span
                      key={index}
                      className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-600/40 border border-red-500/30 text-white backdrop-blur-md"
                    >
                      {typeof genre === 'string' ? genre : genre?.name || 'Unknown'}
                    </span>
                  ))}
                </motion.div>
              )}

              {/* Overview */}
              <motion.p
                className={`text-white/70 max-w-2xl line-clamp-3 ${getGenreTextStyle(media.genres?.map(g => typeof g === 'string' ? g : g?.name).filter(Boolean) || []).className}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7, duration: 0.4 }}
              >
                {media.description || "Experience the ultimate entertainment with this amazing content. Watch now and immerse yourself in a world of endless possibilities."}
              </motion.p>

              {/* Action Buttons - Smaller with Different Icons */}
              <motion.div
                className="flex items-center gap-2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.4 }}
              >
                <div className="group relative">
                  <button
                    onClick={handlePlay}
                    className="group p-2 rounded-full bg-red-600/40 border border-red-500/30 text-white backdrop-blur-md hover:bg-red-600/60 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-110"
                  >
                    {hasWatchedBefore && playbackProgress > 0 ? (
                      <PlayCircle className="w-4 h-4 fill-current" />
                    ) : (
                      <Play className="w-4 h-4 fill-current" />
                    )}
                  </button>
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/90 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {hasWatchedBefore && playbackProgress > 0 ? 'Resume' : 'Play'}
                  </div>
                </div>

                {hasWatchedBefore && playbackProgress > 0 && (
                  <div className="group relative">
                    <button
                      onClick={handlePlayFromBeginning}
                      className="group p-2 bg-white/20 text-white rounded-full backdrop-blur-md border border-white/30 hover:bg-white/30 transition-all duration-200 hover:scale-110"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/90 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      From Beginning
                    </div>
                  </div>
                )}

                {media.tmdb_trailer_url && (
                  <div className="group relative">
                    <button
                      onClick={handleWatchTrailer}
                      className="group p-2 bg-blue-600/40 border border-blue-500/30 text-white rounded-full backdrop-blur-md hover:bg-blue-600/60 transition-all duration-200 hover:scale-110"
                    >
                      <Tv className="w-4 h-4" />
                    </button>
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/90 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      Watch Trailer
                    </div>
                  </div>
                )}

                <MyListTooltip
                  media={media}
                  isInMyList={isInMyListHook(media.id)}
                  collections={collections}
                  onToggleMyList={() => toggleMyListHook(media.id)}
                  onAddToCollection={(collectionId) => addToCollection(collectionId, media.id)}
                  onCollectionCreated={fetchCollections}
                >
                  <button className="group p-2 bg-white/20 text-white rounded-full backdrop-blur-md border border-white/30 hover:bg-white/30 transition-all duration-200 hover:scale-110">
                    {isInMyListHook(media.id) ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  </button>
                </MyListTooltip>

                <div className="group relative">
                  <button className="group p-2 bg-white/20 text-white rounded-full backdrop-blur-md border border-white/30 hover:bg-white/30 transition-all duration-200 hover:scale-110">
                    <Share className="w-4 h-4" />
                  </button>
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/90 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    Share
                  </div>
                </div>

                <div className="group relative">
                  <button
                    onClick={() => safeNavigate.push(`/settings?tab=media&media=${encodeURIComponent(JSON.stringify({ id: media.id, type: media.type || 'movie', title: media.title }))}`)}
                    className="group p-2 bg-white/20 text-white rounded-full backdrop-blur-md border border-white/30 hover:bg-white/30 transition-all duration-200 hover:scale-110"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/90 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    Settings
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Details Section - Bottom Left */}
      <div className="relative z-[10] bg-black pt-16 pb-24">
        <div className="container mx-auto px-6 md:px-12 lg:px-16">
          <div className="flex justify-start">
            <div className="w-full">
              {/* Media Info */}
              <div className="bg-gradient-to-r from-black/80 via-black/60 to-transparent p-8 rounded-2xl backdrop-blur-sm border border-white/10 shadow-2xl">
                <h2 className="text-2xl font-bold text-white mb-8">About {cleanMovieTitle(media.title)}</h2>
                {/* About Section with Poster Layout */}
                <div className="flex flex-col lg:flex-row gap-8">
                  {/* Left side - Text content */}
                  <div className="flex-1">
                    <div className="space-y-8">
                      <div className="grid grid-cols-1 gap-8">
                        <div>
                          <div className="flex items-center gap-3 mb-6">
                            <Info className="w-6 h-6 text-red-500" />
                            <h3 className="text-xl font-semibold text-white">Details</h3>
                          </div>
                          <div className="space-y-4 pl-9">
                            {media.genres && media.genres.length > 0 && (
                              <div className="flex flex-col gap-3">
                                <span className="text-white/60 font-medium">Genres</span>
                                <div className="flex flex-wrap gap-2">
                                  {media.genres.map((genre, index) => (
                                    <span
                                      key={index}
                                      className="px-3 py-1.5 bg-gradient-to-r from-red-600/20 to-red-500/20 text-red-300 text-sm font-medium rounded-full border border-red-500/30 hover:from-red-600/30 hover:to-red-500/30 transition-all duration-200"
                                    >
                                      {typeof genre === 'string' ? genre : genre?.name || 'Unknown'}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {media.duration && media.duration > 0 && (
                              <div className="flex">
                                <span className="w-32 text-white/60 font-medium">Duration</span>
                                <span className="text-white">{formatRuntime(Math.floor(media.duration / 60))}</span>
                              </div>
                            )}
                            {media.director && media.director.length > 0 && (
                              <div className="flex">
                                <span className="w-32 text-white/60 font-medium">Director</span>
                                <span className="text-white">
                                  {Array.isArray(media.director)
                                    ? media.director.filter(d => d && d.trim()).join(', ')
                                    : media.director
                                  }
                                </span>
                              </div>
                            )}
                            {media.stars && media.stars.length > 0 && (
                              <div className="flex flex-col gap-3">
                                <span className="text-white/60 font-medium">Cast</span>
                                <div className="flex flex-wrap gap-2">
                                  {media.stars.filter(star => star && star.trim()).slice(0, 6).map((star: string, index: number) => (
                                    <span
                                      key={index}
                                      className="px-3 py-1.5 bg-gradient-to-r from-blue-600/20 to-blue-500/20 text-blue-300 text-sm font-medium rounded-full border border-blue-500/30 hover:from-blue-600/30 hover:to-blue-500/30 transition-all duration-200"
                                    >
                                      {star?.trim()}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {media.year && media.year > 0 && (
                              <div className="flex">
                                <span className="w-32 text-white/60 font-medium">Release</span>
                                <span className="text-white">{media.year}</span>
                              </div>
                            )}
                            {media.country && media.country.trim() && (
                              <div className="flex">
                                <span className="w-32 text-white/60 font-medium">Country</span>
                                <span className="text-white">{media.country}</span>
                              </div>
                            )}
                            {media.language && media.language.trim() && (
                              <div className="flex">
                                <span className="w-32 text-white/60 font-medium">Language</span>
                                <span className="text-white">{media.language}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Box Office & Financial Information */}
                      {(media.box_office || media.budget || media.revenue) && (
                        <div className="mt-8">
                          <div className="flex items-center gap-2 mb-4">
                            <Award className="w-5 h-5 text-green-500" />
                            <h3 className="text-lg font-semibold text-white">Box Office & Financial</h3>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {media.box_office && (
                              <div className="bg-gradient-to-r from-green-500/10 to-green-600/10 p-4 rounded-lg border border-green-500/20">
                                <div className="text-green-400 text-sm font-medium mb-1">Box Office</div>
                                <div className="text-white text-xl font-bold">{media.box_office}</div>
                              </div>
                            )}
                            {media.budget && media.budget > 0 && (
                              <div className="bg-gradient-to-r from-blue-500/10 to-blue-600/10 p-4 rounded-lg border border-blue-500/20">
                                <div className="text-blue-400 text-sm font-medium mb-1">Budget</div>
                                <div className="text-white text-xl font-bold">
                                  {media.budget >= 1000000000
                                    ? `$${(media.budget / 1000000000).toFixed(1)}B`
                                    : media.budget >= 1000000
                                      ? `$${(media.budget / 1000000).toFixed(1)}M`
                                      : `$${media.budget.toLocaleString()}`
                                  }
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      {/* Additional Metadata */}
                      {(media.imdb_id || media.homepage || media.collection) && (
                        <div className="mt-8">
                          <div className="flex items-center gap-2 mb-4">
                            <Film className="w-5 h-5 text-red-500" />
                            <h3 className="text-lg font-semibold text-white">Additional Information</h3>
                          </div>
                          <div className="space-y-2">
                            {media.imdb_id && (
                              <div className="flex">
                                <span className="w-32 text-white/60">IMDB ID</span>
                                <a
                                  href={`https://www.imdb.com/title/${media.imdb_id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-yellow-400 hover:text-yellow-300 underline"
                                >
                                  {media.imdb_id}
                                </a>
                              </div>
                            )}
                            {media.homepage && (
                              <div className="flex">
                                <span className="w-32 text-white/60">Official Site</span>
                                <a
                                  href={media.homepage}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-400 hover:text-blue-300 underline"
                                >
                                  Visit Website
                                </a>
                              </div>
                            )}
                            {media.collection && (
                              <div className="flex">
                                <span className="w-32 text-white/60">Collection</span>
                                <span className="text-white">{media.collection}</span>
                              </div>
                            )}
                            {media.runtime && (
                              <div className="flex">
                                <span className="w-32 text-white/60">Runtime</span>
                                <span className="text-white">{formatRuntime(media.runtime)}</span>
                              </div>
                            )}
                            {media.vote_count && (
                              <div className="flex">
                                <span className="w-32 text-white/60">Votes</span>
                                <span className="text-white">{media.vote_count.toLocaleString()}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Additional Stats Section */}
                      {/* <div className="mt-8">
                        <h3 className="text-lg font-semibold text-white mb-3">Statistics</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {media.rating && (
                            <div className="bg-gray-800/50 p-4 rounded-lg text-center">
                              <div className="flex items-center justify-center gap-1 text-yellow-400 mb-1">
                                <Star className="w-4 h-4" />
                                <span className="text-xl font-bold">{media.rating.toFixed(1)}</span>
                              </div>
                              <span className="text-white/60 text-sm">Rating</span>
                            </div>
                          )}
                          <div className="bg-gray-800/50 p-4 rounded-lg text-center">
                            <div className="text-xl font-bold text-white mb-1">
                              {(media.view_count || 0).toLocaleString()}
                            </div>
                            <span className="text-white/60 text-sm">Views</span>
                          </div>
                          <div className="bg-gray-800/50 p-4 rounded-lg text-center">
                            <div className="text-xl font-bold text-white mb-1">
                              {media.year}
                            </div>
                            <span className="text-white/60 text-sm">Year</span>
                          </div>
                          {media.genres && media.genres.length > 0 && (
                            <div className="bg-gray-800/50 p-4 rounded-lg text-center">
                              <div className="text-xl font-bold text-white mb-1">
                                {media.genres.length}
                              </div>
                              <span className="text-white/60 text-sm">Genres</span>
                            </div>
                          )}
                        </div>
                      </div> */}
                    </div>
                  </div>

                  {/* Sidebar */}
                  <div className="hidden lg:block space-y-6 ml-6">
                    {/* Cast & Crew Section with Images */}
                    {((media.stars && media.stars.length > 0) || (media.director && media.director.length > 0)) && (
                      <CastSection
                        media={media}
                        showMoreInfo={showMoreInfo}
                        setShowMoreInfo={setShowMoreInfo}
                      />
                    )}
                  </div>

                  {/* Right side - Movie Poster */}
                  <div className="lg:w-64 flex-shrink-0">
                    <div className="sticky top-8">
                      <div className="relative w-full h-80 lg:h-96 rounded-xl overflow-hidden shadow-2xl border border-white/10">
                        <ImageWithFallback
                          mediaId={media.id}
                          alt={cleanMovieTitle(media.title)}
                          fill={true}
                          sizes="(max-width: 1024px) 100vw, 256px"
                          className="object-cover transition-transform duration-300 hover:scale-105"
                          loading="eager"
                        />

                        {/* Progress Bar - Similar to ContinueWatching component */}
                        {hasWatchedBefore && playbackProgress > 0 && playbackDuration > 0 && (
                          <>
                            {/* Progress indicator */}
                            <div className="absolute bottom-2 left-2 right-2 bg-black/50 rounded-full h-1 z-10">
                              <div
                                className="bg-red-600 h-full rounded-full transition-all duration-300"
                                style={{ width: `${Math.min(Math.max((playbackProgress / playbackDuration) * 100, 0), 100)}%` }}
                              />
                            </div>
                            {/* Progress text */}
                            <div className="absolute bottom-4 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded z-10">
                              {Math.round((playbackProgress / playbackDuration) * 100)}%
                            </div>
                          </>
                        )}

                        {/* Overlay with movie info */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300">
                          <div className="absolute bottom-0 left-0 right-0 p-4">
                            <h3 className="text-white font-bold text-sm mb-1">{cleanMovieTitle(media.title)}</h3>
                            {media.year && (
                              <p className="text-white/80 text-xs mb-1">{media.year}</p>
                            )}
                            {media.rating && (
                              <div className="flex items-center gap-1">
                                <Star className="w-3 h-3 text-yellow-400 fill-current" />
                                <span className="text-white text-xs font-medium">{media.rating.toFixed(1)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div >


      <div className="mb-6 p-5">
        <RecentlyWatched
          onPlay={handlePlay}
          onInfo={handleInfo}
        />
      </div>

      {/* Related Movies Section */}
      <div className="py-8 bg-gray-900">
        <div className="container mx-auto px-6 md:px-12 lg:px-16">
          <LocalRelatedMedia
            currentMedia={media}
            className="mb-8"
          />
        </div>
      </div>

      {/* Recommendations */}
      {/* Enhanced Recommendations Section */}
      <div className="py-8 bg-black">
        <div className="container mx-auto px-6 md:px-12 lg:px-16">
          <RecommendationSection
            currentMedia={media}
            onPlay={(m: Media) => {
              setMedia(m);
              setIsPlayerOpen(true);
            }}
            onInfo={(m: Media) => safeNavigate.push(`/movie/${m.id}`)}
          />
        </div>
      </div>

      {/* Video Player Modal */}
      {
        media && (() => {
          const startTimeValue = hasWatchedBefore && playbackProgress > 0 ? playbackProgress : 0;
          // console.log('🎬 Movie Page: VideoPlayer props:', {
          //   startTime: startTimeValue,
          //   forceStartFromBeginning,
          //   hasWatchedBefore,
          //   playbackProgress
          // });
          return (
            <VideoPlayer
              media={media}
              isOpen={isPlayerOpen}
              onClose={handlePlayerClose}
              startTime={startTimeValue}
              forceStartFromBeginning={forceStartFromBeginning}
              onPlayNext={(nextMedia) => {
                // For movies, this would typically not be used, but we'll handle it gracefully
                window.location.href = `/movie/${nextMedia.id}`;
              }}
              onVideoPlay={() => {
                // Immediately stop background video when main video starts playing
                const video = videoRef.current;
                if (video) {
                  video.pause();
                  video.muted = true;
                  video.volume = 0;
                  video.currentTime = 0;
                  setIsVideoPlaying(false);
                  setIsMuted(true);
                }
              }}
              onProgress={handlePlayerProgress}
            />
          );
        })()
      }
    </div>
  );

  return (
    <div className="min-h-screen bg-black">
      {media ? (
        renderMediaContent(media)
      ) : (
        <div className="flex items-center justify-center h-screen">
        </div>
      )}
    </div>
  );
}
