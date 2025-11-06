"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import { usePageTitle } from '@/hooks/usePageTitle';
import { ArrowLeft, Play, Plus, Check, Share, Download, Info, Star, Clock, Calendar, Globe, Users, Award, Film, Tv, User, Mic, ChevronDown, ChevronUp, Volume2, VolumeX, Users as Cast, User as Director } from "lucide-react";
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
import { addToWishlist, removeFromWishlist, isInWishlist } from '@/lib/wishlist';
import CastButton from '@/components/CastButton';
import { useChromecast, CastMedia } from '@/hooks/useChromecast';
import ImageWithFallback from '@/components/ImageWithFallback';
import CastSection from '@/components/CastSection';

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

  useEffect(() => {
    if (currentMedia) {
      fetchRelatedMedia();
    }
  }, [currentMedia]);

  const fetchRelatedMedia = async () => {
    try {
      setLoading(true);
      const apiUrl = getApiUrl();

      // Get all movies and filter for similar ones
      const response = await fetch(`${apiUrl}/api/media/movies`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const allMovies = await response.json();

      // Filter out current movie and find similar ones
      const otherMovies = allMovies.filter((movie: LocalMediaItem) => movie.id !== currentMedia.id);

      // Simple similarity algorithm based on genres, year, and rating
      const similarMovies = otherMovies
        .map((movie: LocalMediaItem) => ({
          ...movie,
          similarity: calculateSimilarity(currentMedia, movie)
        }))
        .filter((movie: any) => movie.similarity > 0.1) // Only include movies with some similarity
        .sort((a: any, b: any) => b.similarity - a.similarity) // Sort by similarity score
        .slice(0, 12); // Limit to 12 movies

      setRelatedMedia(similarMovies);
      setError(null);
    } catch (err) {
      console.error('Error fetching related media:', err);
      setError('Failed to load related content');
      setRelatedMedia([]);
    } finally {
      setLoading(false);
    }
  };

  // Simple similarity calculation based on genres, year, and rating
  const calculateSimilarity = (movie1: Media, movie2: LocalMediaItem): number => {
    let score = 0;

    // Genre similarity (most important factor)
    if (movie1.genres && movie2.genres) {
      const genres1 = movie1.genres.map(g => typeof g === 'string' ? g : g.name).filter(Boolean);
      const genres2 = movie2.genres.map(g => g.name).filter(Boolean);

      const commonGenres = genres1.filter(g => genres2.includes(g));
      const genreSimilarity = commonGenres.length / Math.max(genres1.length, genres2.length, 1);
      score += genreSimilarity * 0.6; // 60% weight for genres
    }

    // Year similarity (movies from similar time periods)
    if (movie1.year && movie2.year) {
      const yearDiff = Math.abs(movie1.year - movie2.year);
      const yearSimilarity = Math.max(0, 1 - yearDiff / 20); // Similar if within 20 years
      score += yearSimilarity * 0.2; // 20% weight for year
    }

    // Rating similarity (movies with similar ratings)
    if (movie1.rating && movie2.rating) {
      const ratingDiff = Math.abs(movie1.rating - movie2.rating);
      const ratingSimilarity = Math.max(0, 1 - ratingDiff / 5); // Similar if within 5 rating points
      score += ratingSimilarity * 0.2; // 20% weight for rating
    }

    return score;
  };

  const getPosterUrl = (movie: LocalMediaItem) => {
    if (movie.poster_url) return movie.poster_url;
    const apiUrl = getApiUrl();
    return `${apiUrl}/api/posters/${movie.id}`;
  };

  const handleMediaClick = (movie: LocalMediaItem) => {
    router.push(`/movie/${movie.id}`);
  };

  const formatRuntime = (minutes: number) => {
    if (!minutes) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
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
          {relatedMedia.map((movie) => (
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
                  alt={movie.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQ1MCIgdmlld0JveD0iMCAwIDMwMCA0NTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iNDUwIiBmaWxsPSIjMzc0MTUxIi8+CjxwYXRoIGQ9Ik0xNTAgMjAwQzE4Ny4yNzkgMjAwIDIxOCAxNjkuMjc5IDIxOCAxMzJDMjE4IDk0LjcyMDggMTg3LjI3OSA2NCAxNTAgNjRDMTEyLjcyMSA2NCA4MiA5NC43MjA4IDgyIDEzMkM4MiAxNjkuMjc5IDExMi43MjEgMjAwIDE1MCAyMDBaIiBmaWxsPSIjNkI3Mjg4Ii8+CjxwYXRoIGQ9Ik04MiAyNzZDODIgMjM4LjY4IDExMi42OCAyMDggMTUwIDIwOEgxNTBDMTg3LjMyIDIwOCAyMTggMjM4LjY4IDIxOCAyNzZWMzUwSDgyVjI3NloiIGZpbGw9IiM2QjcyODgiLz4KPHN2Zz4K';
                  }}
                />

                {/* Overlay with rating */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                {movie.rating > 0 && (
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
                  {movie.title}
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
                {movie.genres && movie.genres.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {movie.genres.slice(0, 2).map((genre, index) => (
                      <span
                        key={index}
                        className="text-xs text-gray-500 bg-gray-800/50 px-1 py-0.5 rounded"
                      >
                        {genre.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Custom hook to manage background video lifecycle
const useBackgroundVideo = (videoRef: React.RefObject<HTMLVideoElement | null>, isPlayerOpen: boolean) => {
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

  // Main effect to handle player open state only
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isPlayerOpen) return;

    // Player opened - stop background video
    video.pause();
    video.muted = true;
    video.volume = 0;
    video.currentTime = 0;
    safeSetIsVideoPlaying(false);
    safeSetIsMuted(true);
  }, [isPlayerOpen, safeSetIsVideoPlaying, safeSetIsMuted]);

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
  const isMountedRef = useRef(true);

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
  } = useBackgroundVideo(videoRef, isPlayerOpen);



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

  // Background video control when player opens/closes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlayerOpen) {
      // Player opened - stop and hide background video
      video.pause();
      video.muted = true;
      video.volume = 0;
      setIsVideoPlaying(false);
      setIsMuted(true);
      video.style.display = 'none';
      video.style.visibility = 'hidden';
    }
  }, [isPlayerOpen]);

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

  // Aggressive background video control - check every 100ms when player is open
  useEffect(() => {
    if (!isPlayerOpen) return;

    const interval = setInterval(() => {
      const video = videoRef.current;
      if (video && !video.paused) {
        video.pause();
        video.muted = true;
        video.volume = 0;
        setIsVideoPlaying(false);
        setIsMuted(true);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isPlayerOpen]);





  // Aggressive auto-play with multiple triggers
  useEffect(() => {
    const forceVideoPlay = () => {
      const video = videoRef.current;
      if (video && media && !isPlayerOpen) {
        // Set video properties including loop
        video.loop = true;
        video.muted = false;
        video.volume = 1.0;
        video.currentTime = 0;
        setIsMuted(false);

        // Force play with multiple attempts
        const playAttempt = () => {
          video.play().then(() => {
            setIsVideoPlaying(true);
          }).catch((error) => {
            video.muted = true;
            setIsMuted(true);
            video.play().then(() => {
              setIsVideoPlaying(true);
            }).catch(() => {
            });
          });
        };

        // Try immediately and with delays
        playAttempt();
        setTimeout(playAttempt, 100);
        setTimeout(playAttempt, 500);
      }
    };

    // Multiple triggers for auto-play
    if (media && !loading) {
      forceVideoPlay();
      const timer1 = setTimeout(forceVideoPlay, 200);
      const timer2 = setTimeout(forceVideoPlay, 1000);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }
  }, [media, loading, isPlayerOpen]);

  // Additional trigger when video becomes loaded
  useEffect(() => {
    if (isVideoLoaded && !isVideoPlaying && !isPlayerOpen) {
      const video = videoRef.current;
      if (video) {
        video.loop = true;
        video.muted = false;
        video.volume = 1.0;
        video.play().then(() => {
          setIsVideoPlaying(true);
          setIsMuted(false);
        }).catch(() => {
          video.muted = true;
          setIsMuted(true);
          video.play().catch(() => {

          });
        });
      }
    }
  }, [isVideoLoaded, isVideoPlaying, isPlayerOpen]);

  // Cookie-based playback progress management
  const savePlaybackProgress = (mediaId: string, currentTime: number, duration: number) => {
    const progressData = {
      currentTime,
      duration,
      percentage: (currentTime / duration) * 100,
      timestamp: new Date().toISOString(),
      lastWatched: new Date().toISOString()
    };

    // Save to cookie with 30 days expiration
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 30);

    document.cookie = `playback_${mediaId}=${JSON.stringify(progressData)}; expires=${expirationDate.toUTCString()}; path=/; SameSite=Lax`;

    // Update local state
    setPlaybackProgress(currentTime);
    setPlaybackDuration(duration);
    setHasWatchedBefore(true);
    setLastWatched(progressData.lastWatched);


  };

  const getPlaybackProgressFromCookie = (mediaId: string) => {
    if (typeof document === 'undefined') return null;

    const cookies = document.cookie?.split(';') || [];
    const progressCookie = cookies.find(cookie =>
      cookie?.trim().startsWith(`playback_${mediaId}=`)
    );

    if (progressCookie) {
      try {
        const cookieValue = progressCookie.split('=')[1];
        if (cookieValue) {
          const progressData = JSON.parse(cookieValue);
          return progressData;
        }
      } catch (error) {
        console.error('Error parsing playback progress cookie:', error);
        return null;
      }
    }
    return null;
  };

  const clearPlaybackProgress = (mediaId: string) => {
    // Clear cookie by setting expiration to past date
    document.cookie = `playback_${mediaId}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;

    // Reset local state
    setPlaybackProgress(0);
    setPlaybackDuration(0);
    setHasWatchedBefore(false);
    setLastWatched(null);


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
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/media/${params.id}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();

      // Ensure data has required properties with defaults
      const mediaData = {
        ...data,
        genres: data.genres || [],
        stars: data.stars || [],
        title: data.title || 'Unknown Title',
        description: data.description || '',
        year: data.year || new Date().getFullYear()
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
        if (!isNaN(mediaId)) {
          const inList = isInWishlist(mediaId);
          setIsInMyList(inList);
        }
      } catch (error) {
        console.error('Error checking wishlist:', error);
        setIsInMyList(false);
      }
    }
  };

  const toggleMyList = async () => {
    try {
      if (!params.id) return;

      const mediaId = parseInt(params.id as string);
      let success = false;

      if (isInMyList) {
        success = removeFromWishlist(mediaId);
      } else {
        success = addToWishlist(mediaId);
      }

      if (success) {
        setIsInMyList(!isInMyList);

      }
    } catch (error) {

    }
  };

  const loadPlaybackProgress = async () => {
    if (!params?.id) return;

    try {
      // First try to load from backend API (same as ContinueWatching component)
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/playback/progress/${params.id}`, {
        headers: {
          'X-User-ID': '1' // Default user for now
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.position !== undefined && data.duration > 0) {
          setPlaybackProgress(data.position);
          setPlaybackDuration(data.duration);
          setHasWatchedBefore(true);
          setLastWatched(data.last_watched || new Date().toISOString());
          return;
        }
      }
    } catch (error) {
      console.error('Error loading playback progress from API:', error);
    }

    // Fallback to cookie system
    try {
      const cookieProgress = getPlaybackProgressFromCookie(params.id as string);
      if (cookieProgress && cookieProgress.currentTime !== undefined) {
        setPlaybackProgress(cookieProgress.currentTime || 0);
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
    // Immediately stop background video when opening player
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.muted = true;
      video.volume = 0;
      video.currentTime = 0;
      setIsVideoPlaying(false);
      setIsMuted(true);
    }
    setIsPlayerOpen(true);
  };

  const handlePlayFromBeginning = () => {
    // Immediately stop background video when opening player
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.muted = true;
      video.volume = 0;
      video.currentTime = 0;
      setIsVideoPlaying(false);
      setIsMuted(true);
    }
    if (params.id) {
      clearPlaybackProgress(params.id as string);
    }
    // Reset local playback state to ensure we start from beginning
    setPlaybackProgress(0);
    setPlaybackDuration(0);
    setHasWatchedBefore(false);
    setLastWatched(null);
    setForceStartFromBeginning(true);
    setIsPlayerOpen(true);
  };

  const handlePlayerClose = () => {
    setIsPlayerOpen(false);
    setForceStartFromBeginning(false);

    // Resume background video with loop
    setTimeout(() => {
      const video = videoRef.current;
      if (video && media) {
        video.style.display = 'block';
        video.style.visibility = 'visible';
        video.currentTime = 0;
        video.loop = true;
        video.muted = false;
        video.volume = 1.0;
        setIsMuted(false);

        video.play().then(() => {
          setIsVideoPlaying(true);
        }).catch(() => {
          video.muted = true;
          setIsMuted(true);
          video.play().then(() => {
            setIsVideoPlaying(true);
          }).catch(() => { });
        });
      }
    }, 100);
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

  // Auto-start casting when connected and cast button is clicked
  React.useEffect(() => {
    if (castState.isConnected && media) {
      handleStartCasting();
    }
  }, [castState.isConnected, media]);

  const handlePlayerProgress = async (currentTime: number, duration: number) => {
    if (!params.id || !duration) return;

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
    savePlaybackProgress(params.id as string, currentTime, duration);

    // Also save to localStorage for backward compatibility
    const progressData = {
      progress: currentTime,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(`progress_${params.id}`, JSON.stringify(progressData));
  };

  const formatRuntime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
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
    const apiUrl = getApiUrl();
    if (media.banner_path) {
      return `${apiUrl}/api/admin/assets/${media.banner_path.split('/').pop()}`;
    }
    return `${apiUrl}/api/thumbnails/${media.id}`;
  };

  const getBackgroundVideoUrl = (media: Media) => {
    const apiUrl = getApiUrl();
    // First try trailer for background (lighter than full media file)
    if (media.trailer_path) {
      return `${apiUrl}/api/admin/assets/${media.trailer_path.split('/').pop()}`;
    }
    // Then try preview clips (optimized for background)
    if (media.preview_clip_path) {
      return `${apiUrl}/api/admin/assets/${media.preview_clip_path.split('/').pop()}`;
    }
    // Fallback to preview clips endpoint
    return `${apiUrl}/api/preview-clips/${media.id}`;
  };

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
        {/* Background Image with Lazy Loading */}
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 }}>
          <LazyImage
            src={getBackgroundImageUrl(media)}
            alt={media.title}
            fill
            className={`transition-opacity duration-1000 ${isVideoLoaded && isVideoPlaying ? 'opacity-0' : 'opacity-100'
              }`}
            priority
            sizes="100vw"
            loaderSize="large"
            showLoader={true}
          />
        </div>

        {/* Poster Background Overlay (TMDB Style) - Shows when video not playing */}
        <div
          className={`absolute inset-0 pointer-events-none transition-opacity duration-1000 ${!isVideoLoaded || !isVideoPlaying ? 'opacity-100' : 'opacity-0'
            }`}
          style={{ zIndex: 2 }}
        >
          <ImageWithFallback
            mediaId={media.id}
            alt={media.title}
            fill={true}
            sizes="100vw"
            className="object-cover"
            loading="eager"
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
            // Hide video completely when player is open
            display: isPlayerOpen ? 'none' : 'block',
            visibility: isPlayerOpen ? 'hidden' : 'visible',
            opacity: isPlayerOpen ? 0 : 1,
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
                }).catch((error) => {
                  video.muted = true;
                  setIsMuted(true);
                  video.play().then(() => {
                    setIsVideoPlaying(true);
                  }).catch(() => {
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
            setIsVideoLoaded(false);
            setIsVideoPlaying(false);
            // Stop video completely on error
            const video = videoRef.current;
            if (video) {
              video.pause();
              video.muted = true;
              video.volume = 0;
              video.currentTime = 0;
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
        >
          {/* Preview/trailer sources - not full media file */}
          <source src={`${getBackgroundVideoUrl(media)}?audio=aac&quality=medium`} type="video/mp4" />
          <source src={`${getBackgroundVideoUrl(media)}`} type="video/mp4" />
          <source src={getAssetUrl('preview', media.id, false) as string} type="video/mp4" />
          Your browser does not support the video tag.
        </video>

        {/* Minimal overlay for text readability only */}
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent z-[10] pointer-events-none" />

        {/* Navigation */}
        <div className="absolute top-0 left-0 right-0 z-[20] p-6 flex justify-between items-center pointer-events-auto">

        </div>

        {/* Hero Content - Bottom Left with Poster (TMDB Style) */}
        <div className="absolute bottom-0 left-0 z-[20] p-8 pointer-events-auto w-2/3">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="flex gap-6 items-end"
          >
            {/* Movie Poster */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex-shrink-0"
            >
              <div className="relative w-64 h-96 rounded-lg overflow-hidden shadow-2xl border border-white/10">
                <ImageWithFallback
                  mediaId={media.id}
                  alt={cleanMovieTitle(media.title)}
                  fill={true}
                  sizes="256px"
                  className="object-cover"
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
              </div>
            </motion.div>

            {/* Movie Details */}
            <div className="flex-1 space-y-4 pb-4">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold mb-2 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                  {media.title}
                </h1>

                {media.tagline && (
                  <p className="text-lg text-red-400 mb-3 italic font-medium">
                    "{media.tagline}"
                  </p>
                )}
              </div>

              {/* Stats Row - Compact */}
              <div className="flex flex-wrap items-center gap-3 text-sm">
                {media.rating && (
                  <div className="flex items-center gap-1 bg-yellow-500/20 px-2 py-1 rounded-full">
                    <Star className="w-4 h-4 text-yellow-400 fill-current" />
                    <span className="font-semibold">{media.rating.toFixed(1)}</span>
                  </div>
                )}

                <div className="flex items-center gap-1 bg-blue-500/20 px-2 py-1 rounded-full">
                  <Calendar className="w-4 h-4 text-blue-400" />
                  <span>{media.year || (media.release_date && new Date(media.release_date).getFullYear()) || new Date().getFullYear()}</span>
                </div>

                {media.duration && (
                  <div className="flex items-center gap-1 bg-green-500/20 px-2 py-1 rounded-full">
                    <Clock className="w-4 h-4 text-green-400" />
                    <span>{formatRuntime(Math.floor(media.duration / 60))}</span>
                  </div>
                )}

                {media.quality && (
                  <div className="flex items-center gap-1 border border-white/30 px-2 py-1 rounded-sm">
                    <span className="text-white text-xs font-bold">
                      {media.quality.includes('2160') || media.quality.toLowerCase().includes('4k') ? '4K' :
                        media.quality.includes('1080') || media.quality.toLowerCase().includes('hd') ? 'HD' :
                          media.quality.includes('720') ? '720p' : 'HD'}
                    </span>
                  </div>
                )}
              </div>

              {/* Genres - Compact */}
              <div className="flex flex-wrap gap-1">
                {media.genres?.slice(0, 3).map((genre, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-red-600/30 border border-red-500/50 rounded-full text-xs font-medium"
                  >
                    {typeof genre === 'string' ? genre : genre?.name || 'Unknown'}
                  </span>
                ))}
              </div>

              {/* Overview - Truncated */}
              <p className="text-sm text-gray-300 leading-relaxed line-clamp-3">
                {media.description || "Experience the ultimate entertainment with this amazing content. Watch now and immerse yourself in a world of endless possibilities."}
              </p>

              {/* Action Buttons - Compact */}
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  onClick={handlePlay}
                  className="flex items-center gap-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-semibold transition-all duration-300 hover:scale-105"
                >
                  <Play className="w-4 h-4" />
                  {hasWatchedBefore && playbackProgress > 0 ? 'Resume' : 'Play'}
                </button>

                {hasWatchedBefore && playbackProgress > 0 && (
                  <button
                    onClick={handlePlayFromBeginning}
                    className="flex items-center gap-1 px-4 py-2 bg-gray-800/80 hover:bg-gray-700 rounded-lg text-sm font-semibold transition-all duration-300 hover:scale-105"
                  >
                    <Play className="w-4 h-4" />
                    From Beginning
                  </button>
                )}

                <button
                  onClick={toggleMyList}
                  className="flex items-center gap-1 px-4 py-2 bg-gray-800/80 hover:bg-gray-700 rounded-lg text-sm font-semibold transition-all duration-300 hover:scale-105"
                >
                  {isInMyList ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  Watchlist
                </button>

                <button className="flex items-center gap-1 px-4 py-2 bg-gray-800/80 hover:bg-gray-700 rounded-lg text-sm font-semibold transition-all duration-300 hover:scale-105">
                  <Share className="w-4 h-4" />
                  Share
                </button>
              </div>
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
                            {media.duration && (
                              <div className="flex">
                                <span className="w-32 text-white/60 font-medium">Duration</span>
                                <span className="text-white">{formatRuntime(Math.floor(media.duration / 60))}</span>
                              </div>
                            )}
                            {media.director && (
                              <div className="flex">
                                <span className="w-32 text-white/60 font-medium">Director</span>
                                <span className="text-white">
                                  {Array.isArray(media.director)
                                    ? media.director.filter(d => d).join(', ')
                                    : media.director
                                  }
                                </span>
                              </div>
                            )}
                            {media.stars && media.stars.length > 0 && (
                              <div className="flex flex-col gap-3">
                                <span className="text-white/60 font-medium">Cast</span>
                                <div className="flex flex-wrap gap-2">
                                  {media.stars.slice(0, 6).map((star: string, index: number) => (
                                    <span
                                      key={index}
                                      className="px-3 py-1.5 bg-gradient-to-r from-blue-600/20 to-blue-500/20 text-blue-300 text-sm font-medium rounded-full border border-blue-500/30 hover:from-blue-600/30 hover:to-blue-500/30 transition-all duration-200"
                                    >
                                      {star?.trim() || star}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {media.year && (
                              <div className="flex">
                                <span className="w-32 text-white/60 font-medium">Release</span>
                                <span className="text-white">{media.year}</span>
                              </div>
                            )}
                            {media.country && (
                              <div className="flex">
                                <span className="w-32 text-white/60 font-medium">Country</span>
                                <span className="text-white">{media.country}</span>
                              </div>
                            )}
                            {media.language && (
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
                            {media.revenue && media.revenue > 0 && (
                              <div className="bg-gradient-to-r from-purple-500/10 to-purple-600/10 p-4 rounded-lg border border-purple-500/20">
                                <div className="text-purple-400 text-sm font-medium mb-1">Revenue</div>
                                <div className="text-white text-xl font-bold">
                                  {media.revenue >= 1000000000
                                    ? `$${(media.revenue / 1000000000).toFixed(1)}B`
                                    : media.revenue >= 1000000
                                      ? `$${(media.revenue / 1000000).toFixed(1)}M`
                                      : `$${media.revenue.toLocaleString()}`
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
                      <div className="mt-8">
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
                      </div>
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
