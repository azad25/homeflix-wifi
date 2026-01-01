"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { Play, Info, ChevronLeft, ChevronRight, Film, Tv, Volume2, VolumeX, Plus, Check } from 'lucide-react';
import { Media } from '@/types/media';
import { getApiUrl } from '@/lib/api';
import { MagneticButton, GradientBackground, ParallaxSection, ParticleField, ScrollReveal } from './index';
import { useAudio } from '@/contexts/EnhancedAudioContext';
import RedLoader from '../RedLoader';
import { cleanMovieTitle } from '@/lib/titleUtils';
import { useMyList } from '@/hooks/useMyList';
import MyListTooltip from '@/components/ui/MyListTooltip';

// Declare global YouTube types
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface ScrollXHeroProps {
  featuredMedia: Media[];
  onPlay: (media: Media) => void;
  onInfo: (media: Media) => void;
  refreshInterval?: number;
  enableRecommendations?: boolean;
  contentFilter?: 'movies-hd' | 'tv-series' | 'all';
}

const ScrollXHero: React.FC<ScrollXHeroProps> = ({
  featuredMedia: initialFeaturedMedia,
  onPlay,
  onInfo,
  refreshInterval = 300000,
  enableRecommendations = true,
  contentFilter = 'all',
}) => {
  // Core state
  const [featuredMedia, setFeaturedMedia] = useState<Media[]>(initialFeaturedMedia);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [userHasInteracted, setUserHasInteracted] = useState(false);
  const [canAutoplayWithAudio, setCanAutoplayWithAudio] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [cycleCount, setCycleCount] = useState(0);
  const [isLoadingNewContent, setIsLoadingNewContent] = useState(false);
  const [backgroundLoaded, setBackgroundLoaded] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);

  // YouTube and preloading state
  const [useYouTubeFallback, setUseYouTubeFallback] = useState(false);
  const [ytReady, setYtReady] = useState(false);
  const [ytVideoReady, setYtVideoReady] = useState(false);
  const [trailerProgress, setTrailerProgress] = useState(0);
  const [currentPlayCount, setCurrentPlayCount] = useState(0);

  // Refs for stable references with memory management
  const videoRef = useRef<HTMLVideoElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentMediaRef = useRef<Media | null>(null);
  const isLoadingRef = useRef(false);
  const slideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const preloadRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const urlCache = useRef<Map<string, string>>(new Map());
  const lastCleanupTime = useRef<number>(Date.now());
  const ytPlayerRef = useRef<any>(null);
  const preloadedVideos = useRef<Map<number, HTMLVideoElement>>(new Map());
  const preloadedUrls = useRef<Map<number, string>>(new Map());
  const prefetchedBatches = useRef<Map<number, Media[]>>(new Map());
  const isBackgroundLoading = useRef(false);
  const videoLoadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    setCurrentAudioElement,
    muteAll,
    alacEngine,
    isALACEnabled,
    spatialAudioEnabled,
    initializeEnhancedAudio
  } = useAudio();

  // Use the new backend-connected My List hook
  const { myList, collections, isInMyList, toggleMyList: toggleMyListHook, addToCollection } = useMyList();

  // Wrapper function to handle the media parameter
  const toggleMyList = useCallback((media: Media) => {
    toggleMyListHook(media.id);
  }, [toggleMyListHook]);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  });

  const y = useTransform(scrollYProgress, [0, 1], [0, -200]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  // Memoized current media to prevent unnecessary re-renders
  const currentMedia = useMemo(() => {
    const media = featuredMedia[currentIndex] || featuredMedia[0];
    currentMediaRef.current = media;
    return media;
  }, [featuredMedia, currentIndex]);

  // Optimized audio preference management with caching
  const audioPreferences = useMemo(() => ({
    getGlobalAudioPreference: (): boolean => {
      if (typeof window === 'undefined') return false;
      const saved = localStorage.getItem('scrollx-audio-muted');
      return saved !== null ? JSON.parse(saved) : false;
    },
    setGlobalAudioPreference: (muted: boolean) => {
      if (typeof window === 'undefined') return;
      localStorage.setItem('scrollx-audio-muted', JSON.stringify(muted));
    },
    hasUserEverUnmuted: (): boolean => {
      if (typeof window === 'undefined') return true;
      return localStorage.getItem('scrollx-user-has-unmuted') !== 'false';
    },
    setUserHasUnmuted: () => {
      if (typeof window === 'undefined') return;
      localStorage.setItem('scrollx-user-has-unmuted', 'true');
    }
  }), []);

  // Load YouTube IFrame API for trailer fallback
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

  // Get preview clip URL with cache headers
  const getPreviewClipUrl = useCallback((movie: Media): string => {
    return `${getApiUrl()}/api/preview-clips/${movie.id}?quality=high&format=mp4&cache=true`;
  }, []);

  // Preload a single video
  const preloadVideo = useCallback((movie: Media) => {
    if (preloadedVideos.current.has(movie.id)) return;

    const url = getPreviewClipUrl(movie);
    preloadedUrls.current.set(movie.id, url);

    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    video.src = url;
    video.load();

    preloadedVideos.current.set(movie.id, video);
    console.log(`🎬 Preloading video for: ${movie.title} (ID: ${movie.id})`);
  }, [getPreviewClipUrl]);

  // Preload all videos for faster playback
  const preloadAllVideos = useCallback((mediaList: Media[]) => {
    // Clear old preloaded videos
    preloadedVideos.current.forEach((video) => {
      video.pause();
      video.src = '';
      video.load();
    });
    preloadedVideos.current.clear();
    preloadedUrls.current.clear();

    // Preload new videos
    mediaList.forEach((movie) => {
      preloadVideo(movie);
    });

    console.log(`✅ Preloading ${mediaList.length} videos`);
  }, [preloadVideo]);

  // Background prefetching system - load next batches while current trailer plays
  const prefetchNextBatches = useCallback(async () => {
    if (isBackgroundLoading.current) return;
    isBackgroundLoading.current = true;

    try {
      console.log('🔮 Background prefetching next batches...');
      
      // Fetch all available media
      const response = await fetch(`${getApiUrl()}/api/media/movies`);
      if (!response.ok) throw new Error('Failed to fetch movies');
      
      const allMovies: Media[] = await response.json();
      
      // Apply content filtering
      let filteredMedia = allMovies;
      if (contentFilter === 'movies-hd') {
        filteredMedia = allMovies.filter((media: Media) => {
          const isMovie = media.type === 'movie';
          const hasHDQuality = media.quality && (
            media.quality.toLowerCase().includes('hd') ||
            media.quality.toLowerCase().includes('4k') ||
            media.quality.toLowerCase().includes('1080p') ||
            media.quality.toLowerCase().includes('2160p')
          );
          const hasFilePath = !!media.file_path;
          const hasPoster = !!(media.poster_path || media.tmdb_poster_url);
          const hasBackdrop = !!(media.tmdb_backdrop_url || media.banner_path || media.thumbnail_path);
          const hasMinDuration = media.duration && media.duration >= 60;
          return isMovie && (hasHDQuality || !media.quality) && hasFilePath && hasPoster && hasBackdrop && hasMinDuration;
        });
      } else if (contentFilter === 'tv-series') {
        filteredMedia = allMovies.filter((media: Media) => {
          return media.type === 'episode' || media.type === 'tv' || media.type === 'series';
        });
      }

      // Sort by ID (newest first)
      const sortedMovies = filteredMedia.sort((a, b) => (b.id || 0) - (a.id || 0));

      // Prefetch next 3 batches (30 movies total)
      for (let i = 1; i <= 3; i++) {
        const nextCycleCount = cycleCount + i;
        const startIndex = nextCycleCount * 10;
        const batchMovies = sortedMovies.slice(startIndex, startIndex + 10);
        
        if (batchMovies.length > 0) {
          prefetchedBatches.current.set(nextCycleCount, batchMovies);
          
          // Preload videos for this batch
          batchMovies.forEach(movie => {
            const url = getPreviewClipUrl(movie);
            preloadedUrls.current.set(movie.id, url);
            const video = document.createElement('video');
            video.preload = 'auto';
            video.muted = true;
            video.src = url;
            video.load();
            preloadedVideos.current.set(movie.id, video);
          });
          
          console.log(`✅ Prefetched batch ${nextCycleCount} with ${batchMovies.length} movies`);
        }
      }
      
    } catch (error) {
      console.warn('Background prefetch failed:', error);
    } finally {
      isBackgroundLoading.current = false;
    }
  }, [contentFilter, cycleCount, getPreviewClipUrl]);

  // Enhanced recommendation system with guaranteed unique content every load
  const fetchRecommendedMedia = useCallback(async (cycleNumber: number = 0) => {
    setIsLoadingNewContent(true);

    try {
      // Check if we have prefetched content for this cycle
      if (prefetchedBatches.current.has(cycleNumber)) {
        const prefetchedContent = prefetchedBatches.current.get(cycleNumber)!;
        console.log(`⚡ Using prefetched content for cycle ${cycleNumber}`);
        setFeaturedMedia(prefetchedContent);
        preloadAllVideos(prefetchedContent);
        return;
      }

      // Fallback to API fetch if no prefetched content
      const apiUrl = getApiUrl();
      const recommendationEndpoints = [
        `${apiUrl}/api/recommendations/mixed?limit=25`,
        `${apiUrl}/api/recommendations/trending?limit=25`,
        `${apiUrl}/api/recommendations/popular?limit=25`,
        `${apiUrl}/api/recommendations/recent?limit=25`,
      ];

      const timestamp = Date.now();
      const randomOffset = Math.floor(Math.random() * recommendationEndpoints.length);
      const endpointIndex = (cycleNumber + randomOffset + Math.floor(timestamp / 10000)) % recommendationEndpoints.length;
      const currentEndpoint = recommendationEndpoints[endpointIndex];

      const cacheBustingUrl = `${currentEndpoint}&_t=${timestamp}&_r=${randomOffset}&_session=hero-${timestamp}-${cycleNumber}-${randomOffset}`;
      const response = await fetch(cacheBustingUrl, { method: 'GET' });

      let newMedia: Media[] = [];
      if (response.ok) {
        newMedia = await response.json();
      }

      // Apply content filtering
      if (contentFilter === 'movies-hd') {
        newMedia = newMedia.filter((media: Media) => {
          const isMovie = media.type === 'movie';
          const hasHDQuality = media.quality && (
            media.quality.toLowerCase().includes('hd') ||
            media.quality.toLowerCase().includes('4k') ||
            media.quality.toLowerCase().includes('1080p') ||
            media.quality.toLowerCase().includes('2160p')
          );
          return isMovie && hasHDQuality;
        });
      } else if (contentFilter === 'tv-series') {
        newMedia = newMedia.filter((media: Media) => {
          return media.type === 'episode' || media.type === 'tv' || media.type === 'series';
        });
      }

      if (newMedia.length >= 5) {
        setFeaturedMedia(newMedia.slice(0, 10));
        preloadAllVideos(newMedia.slice(0, 10));
        return;
      }

      // Enhanced frontend fallback
      if (initialFeaturedMedia.length > 0) {
        const validMedia = initialFeaturedMedia.filter(item => item && item.id && typeof item.id === 'number');
        if (validMedia.length > 0) {
          const shuffled = validMedia.sort(() => Math.random() - 0.5);
          setFeaturedMedia(shuffled.slice(0, 10));
          preloadAllVideos(shuffled.slice(0, 10));
        }
      }

    } catch (error) {
      console.error('Error fetching recommended media:', error);
    } finally {
      setIsLoadingNewContent(false);
    }
  }, [contentFilter, initialFeaturedMedia, preloadAllVideos]);

  // ZERO-LATENCY URL GENERATION
  const getVideoUrl = useCallback((media: Media, fallback: boolean = false): string | undefined => {
    if (!media?.id || typeof media.id !== 'number' || media.id <= 0) {
      return undefined;
    }

    const cacheKey = `video_${media.id}_${fallback ? 'low' : 'high'}`;
    if (urlCache.current.has(cacheKey)) {
      return urlCache.current.get(cacheKey);
    }

    const apiUrl = getApiUrl();
    const url = fallback
      ? `${apiUrl}/api/preview-clips/${media.id}?quality=low&format=mp4`
      : `${apiUrl}/api/preview-clips/${media.id}?quality=high&format=mp4&cache=true`;

    urlCache.current.set(cacheKey, url);
    return url;
  }, []);

  // ZERO-LATENCY BACKGROUND IMAGES
  const getBackgroundImageUrl = useCallback((media: Media): string => {
    if (!media?.id || typeof media.id !== 'number' || media.id <= 0) {
      return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTkyMCIgaGVpZ2h0PSIxMDgwIiB2aWV3Qm94PSIwIDAgMTkyMCAxMDgwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxOTIwIiBoZWlnaHQ9IjEwODAiIGZpbGw9IiMxMTEiLz48dGV4dCB4PSI5NjAiIHk9IjU0MCIgZmlsbD0iIzY2NiIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjQ4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5Mb2FkaW5nLi4uPC90ZXh0Pjwvc3ZnPg==';
    }

    const cacheKey = `background_${media.id}`;
    if (urlCache.current.has(cacheKey)) {
      return urlCache.current.get(cacheKey)!;
    }

    let url: string;
    if (media.tmdb_backdrop_url && media.tmdb_backdrop_url.trim() !== '') {
      url = media.tmdb_backdrop_url;
    } else {
      const apiUrl = getApiUrl();
      url = `${apiUrl}/api/thumbnails/${media.id}`;
    }

    urlCache.current.set(cacheKey, url);
    return url;
  }, []);

  // Check if media has video content
  const hasVideoContent = (media: Media) => {
    if (!media?.id || typeof media.id !== 'number' || media.id <= 0) {
      return false;
    }
    return !!(media.id && media.file_path);
  };

  // Chrome-safe stop all video/audio playback
  const stopAllPlayback = () => {
    if (videoRef.current && !videoRef.current.paused) {
      try {
        videoRef.current.pause();
      } catch (error) {
        // Ignore
      }
    }
    if (videoRef.current) {
      const video = videoRef.current;
      video.pause();
      video.currentTime = 0;
      video.muted = true;
      video.volume = 0;
    }

    preloadRefs.current.forEach((video) => {
      try {
        if (!video.paused) {
          video.pause();
        }
        video.src = '';
        video.load();
      } catch (error) {
        // Ignore
      }
    });

    muteAll();
    setIsPlaying(false);
    setIsVideoLoaded(false);
    setVideoLoaded(false);
  }; 
 const nextSlide = () => {
    if (featuredMedia.length > 1 && !isTransitioning) {
      setIsTransitioning(true);
      stopAllPlayback();
      setBackgroundLoaded(false);
      setVideoLoaded(false);

      setTimeout(() => {
        const nextIndex = (currentIndex + 1) % featuredMedia.length;
        setCurrentIndex(nextIndex);
        setIsTransitioning(false);
        setCurrentPlayCount(0);
        setTrailerProgress(0);
      }, 300);
    }
  };

  const prevSlide = () => {
    if (featuredMedia.length > 1 && !isTransitioning) {
      setIsTransitioning(true);
      stopAllPlayback();
      setBackgroundLoaded(false);
      setVideoLoaded(false);

      setTimeout(() => {
        setCurrentIndex((prev) => (prev - 1 + featuredMedia.length) % featuredMedia.length);
        setIsTransitioning(false);
        setCurrentPlayCount(0);
        setTrailerProgress(0);
      }, 300);
    }
  };

  // Enhanced video playback with Chrome race condition prevention
  const playVideoWithAudio = useCallback(async (video: HTMLVideoElement, withAudio: boolean = true) => {
    if (!video || isLoadingRef.current) return false;

    try {
      const currentMediaId = currentMediaRef.current?.id?.toString();
      if (!currentMediaId) return false;

      if (!video.paused) return true;

      video.currentTime = 0;
      video.muted = true;
      video.volume = 0;

      try {
        const playPromise = video.play();
        if (playPromise !== undefined) {
          await playPromise;

          if (!video.paused) {
            setIsPlaying(true);

            const shouldStartWithAudio = withAudio && !isMuted && audioPreferences.hasUserEverUnmuted() && canAutoplayWithAudio && userHasInteracted;

            if (shouldStartWithAudio && !video.paused) {
              if (currentMediaRef.current?.id?.toString() === currentMediaId && !video.paused) {
                video.muted = false;
                video.volume = spatialAudioEnabled ? 0.7 : 0.5;
              }
            }

            return true;
          }
        }
      } catch (playError) {
        return false;
      }
    } catch (error) {
      try {
        video.muted = true;
        video.volume = 0;
        const fallbackPromise = video.play();
        if (fallbackPromise !== undefined) {
          await fallbackPromise;
          setIsPlaying(true);
          return true;
        }
      } catch (fallbackError) {
        // Ignore
      }
    }

    return false;
  }, [isMuted, spatialAudioEnabled, audioPreferences, canAutoplayWithAudio, userHasInteracted]);

  // Universal unmute functionality
  const handleUnmute = async (e?: React.MouseEvent | KeyboardEvent) => {
    setUserHasInteracted(true);
    audioPreferences.setUserHasUnmuted();

    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    setIsMuted(false);
    audioPreferences.setGlobalAudioPreference(false);

    if (videoRef.current && isPlaying) {
      const video = videoRef.current;
      video.muted = false;
      video.volume = spatialAudioEnabled ? 0.8 : 0.6;
    }
  };

  // Helper functions
  const getQualityBadge = () => {
    const qualityText = currentMedia.quality ?
      (currentMedia.quality.includes('2160') || currentMedia.quality.toLowerCase().includes('4k') ? '4K' : 'HD')
      : "HD";
    return { text: qualityText, color: 'bg-blue-600' };
  };

  const getAgeRating = () => {
    if (currentMedia.rating && currentMedia.rating >= 8.0) return '18+';
    if (currentMedia.rating && currentMedia.rating >= 7.0) return '16+';
    if (currentMedia.rating && currentMedia.rating >= 6.0) return '13+';
    return 'PG';
  };

  const extractYearFromMedia = () => {
    if (currentMedia.year) {
      return currentMedia.year;
    } else if (currentMedia.release_date) {
      return new Date(currentMedia.release_date).getFullYear().toString();
    }

    if (currentMedia.file_path) {
      const yearMatch = currentMedia.file_path.match(/\b(19|20)\d{2}\b/);
      if (yearMatch) return yearMatch[0];
    }

    if (currentMedia.title) {
      const yearMatch = currentMedia.title.match(/\b(19|20)\d{2}\b/);
      if (yearMatch) return yearMatch[0];
    }

    if (currentMedia.release_date) {
      return new Date(currentMedia.release_date).getFullYear().toString();
    }

    return null;
  };

  const getTitleSizeClass = () => {
    const titleLength = currentMedia.title.length;
    if (titleLength > 50) return 'text-xl md:text-2xl lg:text-3xl';
    if (titleLength > 35) return 'text-xl md:text-3xl lg:text-4xl';
    if (titleLength > 25) return 'text-2xl md:text-4xl lg:text-5xl';
    if (titleLength > 15) return 'text-3xl md:text-5xl lg:text-6xl';
    return 'text-4xl md:text-6xl lg:text-7xl';
  };

  const getGenreBasedStyling = () => {
    const genres = currentMedia.genres?.map(g => g.name.toLowerCase()) || [];
    if (genres.includes('horror') || genres.includes('thriller')) return 'font-black tracking-wider';
    if (genres.includes('comedy') || genres.includes('family')) return 'font-extrabold tracking-wide';
    if (genres.includes('drama') || genres.includes('romance')) return 'font-bold tracking-normal';
    if (genres.includes('action') || genres.includes('adventure')) return 'font-black tracking-widest';
    return 'font-bold tracking-wide';
  };

  // Initialize audio preferences and start background prefetching
  useEffect(() => {
    const savedMutedState = audioPreferences.getGlobalAudioPreference();
    const userHasUnmutedBefore = audioPreferences.hasUserEverUnmuted();

    setIsMuted(savedMutedState);
    setUserHasInteracted(userHasUnmutedBefore);

    if (initialFeaturedMedia.length > 0) {
      setFeaturedMedia(initialFeaturedMedia);
      currentMediaRef.current = initialFeaturedMedia[0];
      setIsInitialized(true);
      setCurrentIndex(0);
      
      // Start background prefetching after initial load
      setTimeout(() => {
        prefetchNextBatches();
      }, 2000);
    }
  }, [audioPreferences, initialFeaturedMedia, prefetchNextBatches]);

  // Video setup with YouTube fallback
  useEffect(() => {
    if (!videoRef.current || !currentMedia || !hasVideoContent(currentMedia) || isTransitioning || !isInitialized) {
      return;
    }

    const video = videoRef.current;
    const currentVideoUrl = getVideoUrl(currentMedia);

    if (!currentVideoUrl) {
      const youtubeKey = currentMedia?.tmdb_trailer_url
        ? extractYouTubeKey(currentMedia.tmdb_trailer_url)
        : null;
      if (youtubeKey) {
        console.log(`📺 No preview clip, using YouTube trailer for: ${currentMedia.title}`);
        setUseYouTubeFallback(true);
      }
      return;
    }

    setUseYouTubeFallback(false);
    setYtVideoReady(false);

    video.pause();
    video.currentTime = 0;
    video.muted = true;

    const needsNewSource = !video.src || !video.src.includes(currentMedia.id.toString());
    if (needsNewSource) {
      video.src = currentVideoUrl;
      video.load();
    }

    const shouldPlayWithAudio = !isMuted && audioPreferences.hasUserEverUnmuted() && canAutoplayWithAudio;

    // Set timeout for video loading
    if (videoLoadTimeoutRef.current) {
      clearTimeout(videoLoadTimeoutRef.current);
    }

    const timeout = setTimeout(() => {
      console.log(`⏰ Video load timeout for: ${currentMedia.title}`);
      const youtubeKey = currentMedia?.tmdb_trailer_url
        ? extractYouTubeKey(currentMedia.tmdb_trailer_url)
        : null;
      if (youtubeKey) {
        console.log('📺 Switching to YouTube fallback due to timeout');
        setUseYouTubeFallback(true);
      }
    }, 3000);

    videoLoadTimeoutRef.current = timeout;

    const attemptPlay = () => {
      if (videoLoadTimeoutRef.current) {
        clearTimeout(videoLoadTimeoutRef.current);
        videoLoadTimeoutRef.current = null;
      }

      if (video.readyState >= 2 &&
        video.paused &&
        currentMediaRef.current?.id === currentMedia.id &&
        video.src.includes(currentMedia.id.toString())) {

        playVideoWithAudio(video, shouldPlayWithAudio);
      }
    };

    if (video.readyState >= 2) {
      setTimeout(attemptPlay, 500);
    } else {
      const handleLoadedData = () => {
        video.removeEventListener('loadeddata', handleLoadedData);
        if (currentMediaRef.current?.id === currentMedia.id) {
          setTimeout(attemptPlay, 500);
        }
      };

      video.addEventListener('loadeddata', handleLoadedData);

      const cleanup = setTimeout(() => {
        video.removeEventListener('loadeddata', handleLoadedData);
      }, 5000);

      return () => {
        clearTimeout(cleanup);
        video.removeEventListener('loadeddata', handleLoadedData);
        if (videoLoadTimeoutRef.current) {
          clearTimeout(videoLoadTimeoutRef.current);
          videoLoadTimeoutRef.current = null;
        }
      };
    }
  }, [currentIndex, currentMedia, isTransitioning, isInitialized, extractYouTubeKey, getVideoUrl, playVideoWithAudio, isMuted, audioPreferences, canAutoplayWithAudio]);

  // Initialize YouTube player when fallback is triggered
  useEffect(() => {
    if (!useYouTubeFallback || !ytReady || !currentMedia) return;

    const videoKey = currentMedia?.tmdb_trailer_url
      ? extractYouTubeKey(currentMedia.tmdb_trailer_url)
      : null;

    if (!videoKey) return;

    if (ytPlayerRef.current) {
      try {
        ytPlayerRef.current.destroy();
      } catch (e) {
        // Ignore
      }
      ytPlayerRef.current = null;
    }

    const timer = setTimeout(() => {
      const containerId = `yt-player-scrollx-${currentMedia.id}`;
      const container = document.getElementById(containerId);
      if (!container) return;

      console.log(`📺 Initializing YouTube player for: ${currentMedia.title}`);

      ytPlayerRef.current = new window.YT.Player(containerId, {
        videoId: videoKey,
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
            if (event.data === 1) { // Playing
              setYtVideoReady(true);
            } else if (event.data === 0) { // Ended
              setYtVideoReady(false);
              const newPlayCount = currentPlayCount + 1;
              if (newPlayCount >= 1) { // Play once then advance
                nextSlide();
              } else {
                setCurrentPlayCount(newPlayCount);
                event.target.seekTo(10);
                event.target.playVideo();
              }
            }
          },
          onReady: (event: any) => {
            if (!isMuted) {
              event.target.unMute();
            }
            event.target.seekTo(10, true);
            event.target.playVideo();

            // Track progress for progress bar
            const updateProgress = setInterval(() => {
              try {
                const player = event.target;
                const duration = player.getDuration();
                const currentTime = player.getCurrentTime();
                
                if (duration > 0) {
                  const progress = (currentTime / duration) * 100;
                  setTrailerProgress(progress);
                  
                  // End 10 seconds before actual end
                  if (currentTime >= duration - 10) {
                    clearInterval(updateProgress);
                    nextSlide();
                  }
                }
              } catch (e) {
                clearInterval(updateProgress);
              }
            }, 100);

            (event.target as any)._progressInterval = updateProgress;
          },
          onError: (event: any) => {
            console.error('YouTube player error:', event.data);
            setUseYouTubeFallback(false);
            setYtVideoReady(false);
          },
        },
      });
    }, 100);

    return () => {
      clearTimeout(timer);
    };
  }, [useYouTubeFallback, ytReady, currentMedia, isMuted, extractYouTubeKey, currentPlayCount, nextSlide]);

  // Auto-slide functionality with fresh content loading
  useEffect(() => {
    if (!isAutoPlaying || featuredMedia.length <= 1 || isTransitioning) return;

    const slideDuration = 30000; // 30 seconds

    const interval = setInterval(() => {
      if (!isTransitioning) {
        const nextIndex = (currentIndex + 1) % featuredMedia.length;
        if (nextIndex === 0 && currentIndex === featuredMedia.length - 1) {
          // At the end of cycle - fetch fresh content
          setIsAutoPlaying(false);
          setIsLoadingNewContent(true);

          const newCycleCount = cycleCount + 1;
          setCycleCount(newCycleCount);

          fetchRecommendedMedia(newCycleCount).then(() => {
            setTimeout(() => {
              setCurrentIndex(0);
              setIsAutoPlaying(true);
              // Start prefetching next batches
              prefetchNextBatches();
            }, 1000);
          }).catch(() => {
            setCurrentIndex(0);
            setIsAutoPlaying(true);
          });

          return;
        }
        nextSlide();
      }
    }, slideDuration);

    return () => clearInterval(interval);
  }, [isAutoPlaying, featuredMedia.length, currentIndex, isTransitioning, cycleCount, fetchRecommendedMedia, prefetchNextBatches, nextSlide]);

  // Handle background image loading
  useEffect(() => {
    if (currentMedia) {
      setBackgroundLoaded(false);
      const img = new Image();

      img.onload = () => {
        setBackgroundLoaded(true);
      };

      img.onerror = () => {
        const fallbackUrls = [
          `${getApiUrl()}/api/thumbnails/${currentMedia.id}`,
          'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTkyMCIgaGVpZ2h0PSIxMDgwIiB2aWV3Qm94PSIwIDAgMTkyMCAxMDgwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8cmVjdCB3aWR0aD0iMTkyMCIgaGVpZ2h0PSIxMDgwIiBmaWxsPSIjMTExMTExIi8+CjxwYXRoIGQ9Ik05NjAgNTQwTDEwODAgNDIwVjY2MEw5NjAgNTQwWiIgZmlsbD0iIzMzMzMzMyIvPgo8L3N2Zz4K'
        ];

        let fallbackIndex = 0;
        const tryFallback = () => {
          if (fallbackIndex < fallbackUrls.length) {
            const fallbackImg = new Image();
            fallbackImg.onload = () => setBackgroundLoaded(true);
            fallbackImg.onerror = () => {
              fallbackIndex++;
              tryFallback();
            };
            fallbackImg.src = fallbackUrls[fallbackIndex];
          } else {
            setBackgroundLoaded(true);
          }
        };

        tryFallback();
      };

      img.src = getBackgroundImageUrl(currentMedia);
    }
  }, [currentMedia, getBackgroundImageUrl]);

  // Update video audio state when muted state changes
  useEffect(() => {
    if (videoRef.current && isVideoLoaded && isPlaying) {
      const video = videoRef.current;

      if (isMuted) {
        video.muted = true;
        video.volume = 0;
      } else if (audioPreferences.hasUserEverUnmuted()) {
        video.muted = false;
        video.volume = spatialAudioEnabled ? 0.8 : 0.6;
      }
    }

    // Also update YouTube player if active
    if (ytPlayerRef.current && ytPlayerRef.current.isMuted) {
      try {
        if (isMuted) {
          ytPlayerRef.current.mute();
        } else {
          ytPlayerRef.current.unMute();
        }
      } catch (e) {
        // Player might not be ready
      }
    }
  }, [isMuted, spatialAudioEnabled, isVideoLoaded, isPlaying, audioPreferences]);

  // Enhanced component cleanup
  useEffect(() => {
    return () => {
      stopAllPlayback();

      if (ytPlayerRef.current) {
        try {
          ytPlayerRef.current.destroy();
        } catch (e) {
          // Ignore
        }
        ytPlayerRef.current = null;
      }

      preloadedVideos.current.forEach((video) => {
        try {
          video.pause();
          video.src = '';
          video.load();
        } catch (error) {
          // Ignore
        }
      });
      preloadedVideos.current.clear();
      preloadedUrls.current.clear();

      preloadRefs.current.forEach((video) => {
        try {
          video.pause();
          video.src = '';
          video.load();
        } catch (error) {
          // Ignore
        }
      });
      preloadRefs.current.clear();

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (slideTimerRef.current) {
        clearTimeout(slideTimerRef.current);
        slideTimerRef.current = null;
      }
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      if (videoLoadTimeoutRef.current) {
        clearTimeout(videoLoadTimeoutRef.current);
        videoLoadTimeoutRef.current = null;
      }

      urlCache.current.clear();
      prefetchedBatches.current.clear();
    };
  }, []);

  if (!currentMedia) return null;

  return (
    <motion.div
      ref={containerRef}
      className="relative h-screen overflow-hidden"
      style={{ y, opacity }}
    >
      {/* Background with parallax */}
      <ParallaxSection speed={0.5} className="relative">
        <GradientBackground variant="netflix" className="relative">
          <div
            className="relative h-screen w-full overflow-hidden"
            onMouseEnter={() => setShowControls(true)}
            onMouseLeave={() => setShowControls(false)}
          >
            <AnimatePresence mode="wait">
              {/* Background image with fade transitions */}
              <motion.div
                key={`bg-${currentMedia.id}`}
                className="w-full h-full bg-cover bg-center bg-no-repeat"
                style={{
                  backgroundImage: `url(${getBackgroundImageUrl(currentMedia)})`,
                }}
                initial={{ scale: 1.1, opacity: 0 }}
                animate={{
                  scale: 1,
                  opacity: backgroundLoaded ? (hasVideoContent(currentMedia) && videoLoaded && isPlaying ? 0.2 : 1) : 0
                }}
                exit={{ opacity: 0, scale: 1.1 }}
                transition={{
                  duration: 1.2,
                  ease: "easeInOut",
                  opacity: { duration: 0.8 }
                }}
              />
            </AnimatePresence>

            {/* Netflix-style loading */}
            <AnimatePresence>
              {!backgroundLoaded && (
                <motion.div
                  className="absolute inset-0 bg-black flex items-center justify-center z-30"
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <RedLoader size="large" />
                </motion.div>
              )}
            </AnimatePresence>    
        {/* Video overlay - only render if video content is available */}
            {hasVideoContent(currentMedia) && !useYouTubeFallback && (
              <AnimatePresence mode="wait">
                <video
                  ref={videoRef}
                  key={`video-${currentMedia.id}`}
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${videoLoaded && isPlaying ? 'opacity-100' : 'opacity-0'
                    }`}
                  style={{
                    zIndex: 5,
                    objectFit: 'cover',
                    objectPosition: 'center'
                  }}
                  autoPlay={true}
                  muted={true}
                  loop={true}
                  playsInline
                  preload="metadata"
                  controls={false}
                  crossOrigin="anonymous"
                  webkit-playsinline="true"
                  x-webkit-airplay="allow"
                  disablePictureInPicture
                  disableRemotePlayback
                  src={preloadedUrls.current.get(currentMedia.id) || getVideoUrl(currentMedia)}
                  onLoadedData={() => {
                    if (videoRef.current) {
                      const video = videoRef.current;
                      if (video.readyState >= 2 && video.duration > 0) {
                        setIsVideoLoaded(true);

                        if (!isPlaying && video.paused) {
                          video.play().catch((error) => {
                            if (error.name === 'AbortError') {
                              // Ignore
                            } else {
                              return;
                            }
                          });
                        }
                        setVideoLoaded(true);
                        setCurrentAudioElement(video);
                      }
                    }
                  }}
                  onCanPlay={() => {
                    if (videoRef.current && !isPlaying && !isTransitioning && videoRef.current.paused) {
                      const video = videoRef.current;
                      video.currentTime = 0;

                      const shouldStartWithAudio = !isMuted && audioPreferences.hasUserEverUnmuted() && canAutoplayWithAudio;
                      playVideoWithAudio(video, shouldStartWithAudio);
                    }
                  }}
                  onError={(e) => {
                    console.warn('Preview clip failed to load, trying YouTube fallback');

                    const youtubeKey = currentMedia?.tmdb_trailer_url
                      ? extractYouTubeKey(currentMedia.tmdb_trailer_url)
                      : null;
                    if (youtubeKey) {
                      console.log('📺 Video error, switching to YouTube fallback');
                      setUseYouTubeFallback(true);
                    } else {
                      if (videoRef.current) {
                        const video = videoRef.current;
                        const fallbackUrl = getVideoUrl(currentMedia, true);
                        if (fallbackUrl && fallbackUrl !== video.src) {
                          video.src = fallbackUrl;
                          video.load();
                          return;
                        }
                      }

                      setIsVideoLoaded(false);
                      setVideoLoaded(false);
                      setIsPlaying(false);
                    }
                  }}
                  onPlay={() => {
                    setIsPlaying(true);
                  }}
                  onPause={() => {
                    setIsPlaying(false);
                  }}
                  onLoadStart={() => {
                    setVideoLoaded(false);
                    setIsPlaying(false);
                  }}
                  onTimeUpdate={(e) => {
                    const video = e.currentTarget;
                    if (video.duration > 0) {
                      const progress = (video.currentTime / video.duration) * 100;
                      setTrailerProgress(progress);
                    }
                  }}
                  onClick={(e) => {
                    if (isMuted) {
                      e.stopPropagation();
                      handleUnmute(e);
                    }
                  }}
                >
                  {getVideoUrl(currentMedia) && (
                    <source src={getVideoUrl(currentMedia)!} type="video/mp4" />
                  )}
                  Your browser does not support the video tag.
                </video>
              </AnimatePresence>
            )}

            {/* YouTube Trailer Fallback - Full screen overlay */}
            <AnimatePresence mode="wait">
              {useYouTubeFallback && extractYouTubeKey(currentMedia?.tmdb_trailer_url || '') && (
                <motion.div
                  key={`youtube-fallback-${currentMedia.id}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: ytVideoReady ? 1 : 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden pointer-events-none"
                  style={{
                    clipPath: 'inset(0)',
                  }}
                >
                  <div className="relative w-full h-full overflow-hidden">
                    <div
                      id={`yt-player-scrollx-${currentMedia.id}`}
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

            {/* Gradient overlays */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" style={{ zIndex: 10 }} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" style={{ zIndex: 10 }} />
          </div>
        </GradientBackground>
      </ParallaxSection>  
    {/* Particle field */}
      <ParticleField count={30} className="opacity-30" />

      {/* Navigation arrows */}
      {featuredMedia.length > 1 && (
        <>
          <motion.div
            className="absolute left-8 top-1/2 transform -translate-y-1/2 z-30"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: showControls ? 1 : 0, x: showControls ? 0 : -20 }}
            transition={{ duration: 0.3 }}
          >
            <MagneticButton
              onClick={prevSlide}
              disabled={isTransitioning}
              className="bg-black/50 backdrop-blur-sm text-white p-4 rounded-full hover:bg-black/70 transition-all duration-300 border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-8 h-8" />
            </MagneticButton>
          </motion.div>

          <motion.div
            className="absolute right-8 top-1/2 transform -translate-y-1/2 z-30"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: showControls ? 1 : 0, x: showControls ? 0 : 20 }}
            transition={{ duration: 0.3 }}
          >
            <MagneticButton
              onClick={nextSlide}
              disabled={isTransitioning}
              className="bg-black/50 backdrop-blur-sm text-white p-4 rounded-full hover:bg-black/70 transition-all duration-300 border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-8 h-8" />
            </MagneticButton>
          </motion.div>
        </>
      )}

      {/* Click to unmute overlay */}
      {isMuted && isVideoLoaded && hasVideoContent(currentMedia) && isPlaying && (
        <motion.div
          className="absolute inset-0 z-50 flex items-center justify-center cursor-pointer"
          style={{
            backgroundColor: 'rgba(0,0,0,0.2)',
            pointerEvents: 'all'
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleUnmute(e);
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            handleUnmute(e as any);
          }}
        >
          <motion.button
            className="bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white px-8 py-4 rounded-full flex items-center gap-3 border border-white/30 shadow-2xl"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleUnmute(e);
            }}
            style={{
              fontSize: '16px',
              fontWeight: '600',
              textShadow: '0 2px 4px rgba(0,0,0,0.8)'
            }}
          >
            <Volume2 className="w-6 h-6" />
            <span>Click to unmute</span>
          </motion.button>
        </motion.div>
      )}      {
/* Content - Netflix-style left positioning */}
      <div className="absolute inset-0 z-20 flex items-center">
        <div className="w-full max-w-none px-8 md:px-16 lg:px-24">
          <div className="max-w-2xl">
            {/* Netflix-style metadata */}
            <ScrollReveal delay={0.05}>
              <motion.div
                key={`metadata-${currentMedia.id}`}
                className="flex items-center gap-4 mb-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.05 }}
              >
                <div className="border border-white/50 px-2 py-1 text-xs font-bold rounded text-white backdrop-blur-sm">
                  {getQualityBadge().text}
                </div>

                {extractYearFromMedia() && (
                  <span className="text-white font-medium">
                    {extractYearFromMedia()}
                  </span>
                )}

                <div className="border border-gray-400 px-1 text-xs text-gray-300 font-medium">
                  {getAgeRating()}
                </div>

                <div className="flex items-center gap-1">
                  {currentMedia.type === 'movie' ? (
                    <Film className="w-4 h-4 text-gray-400" />
                  ) : (
                    <Tv className="w-4 h-4 text-gray-400" />
                  )}
                  <span className="text-gray-400 text-sm capitalize">
                    {currentMedia.type === 'episode' ? 'Series' : currentMedia.type}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-yellow-400 text-sm">★</span>
                  <span className="font-bold text-gray-300 text-sm">
                    {currentMedia.rating ? parseFloat(currentMedia.rating.toFixed(1)) : "8.0"}
                  </span>
                </div>
              </motion.div>
            </ScrollReveal>

            {/* Dynamic Title with Logo Support or Genre-based styling */}
            <ScrollReveal delay={0.1}>
              <motion.div
                key={`title-${currentMedia.id}`}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.1 }}
              >
                {/* Movie Title - Logo or Text */}
                {currentMedia.logo_path ? (
                  <img
                    src={`${getApiUrl()}/api/${currentMedia.logo_path}`}
                    alt={currentMedia.title}
                    className="max-h-24 md:max-h-32 w-auto mb-4 drop-shadow-2xl"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                      if (fallback) fallback.style.display = 'block';
                    }}
                  />
                ) : null}
                <motion.h1
                  className={`font-bold text-white mb-4 leading-tight ${getTitleSizeClass()} ${getGenreBasedStyling()}`}
                  style={{
                    display: currentMedia.logo_path ? 'none' : 'block',
                    textShadow: '2px 2px 4px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.5)'
                  }}
                >
                  {cleanMovieTitle(currentMedia.title)}
                </motion.h1>
              </motion.div>
            </ScrollReveal>

            {/* Media Tags - Below Title */}
            <ScrollReveal delay={0.2}>
              <motion.div
                key={`tags-${currentMedia.id}`}
                className="flex flex-wrap gap-2 mb-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                {currentMedia.genres?.slice(0, 4).map((genre, index) => (
                  <span
                    key={genre.id}
                    className="text-white/90 text-xs font-medium bg-black/40 backdrop-blur-sm px-3 py-1 rounded-full border border-white/30"
                  >
                    {genre.name}
                  </span>
                ))}
              </motion.div>
            </ScrollReveal>

            {/* Description */}
            <ScrollReveal delay={0.3}>
              <motion.p
                key={`desc-${currentMedia.id}`}
                className="text-sm md:text-base text-gray-200 mb-6 max-w-2xl leading-relaxed bg-black/20 backdrop-blur-sm p-3 rounded-lg border border-white/10"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.3 }}
              >
                {currentMedia.description ? `${currentMedia.description}` : "Experience premium entertainment with stunning visuals and immersive storytelling."}
              </motion.p>
            </ScrollReveal>

            {/* Action Buttons */}
            <ScrollReveal delay={0.4}>
              <motion.div
                className="flex items-center gap-4 mb-6"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
              >
                <MagneticButton
                  onClick={() => onInfo(currentMedia)}
                  className="bg-transparent text-white px-8 py-3 rounded-md font-bold text-lg hover:bg-white/10 transition-all duration-300 flex items-center gap-2 border border-white/30"
                >
                  <Play className="w-6 h-6 fill-current" />
                  Play
                </MagneticButton>

                <MagneticButton
                  onClick={() => onInfo(currentMedia)}
                  className="bg-transparent text-white px-8 py-3 rounded-md font-bold text-lg hover:bg-white/10 transition-all duration-300 flex items-center gap-2 border border-white/30"
                >
                  <Info className="w-6 h-6" />
                  More Info
                </MagneticButton>

                <MyListTooltip
                  media={currentMedia}
                  isInMyList={isInMyList(currentMedia.id)}
                  collections={collections}
                  onToggleMyList={() => toggleMyList(currentMedia)}
                  onAddToCollection={(collectionId) => addToCollection(collectionId, currentMedia.id)}
                >
                  <MagneticButton
                    className="bg-transparent text-white px-8 py-3 rounded-md font-bold text-lg hover:bg-white/10 transition-all duration-300 flex items-center gap-2 border border-white/30"
                  >
                    {isInMyList(currentMedia.id) ? (
                      <>
                        <Check className="w-6 h-6" />
                        In My List
                      </>
                    ) : (
                      <>
                        <Plus className="w-6 h-6" />
                      </>
                    )}
                  </MagneticButton>
                </MyListTooltip>

                <MagneticButton
                  onClick={(e) => {
                    e.stopPropagation();
                    const newMuted = !isMuted;
                    setIsMuted(newMuted);
                    audioPreferences.setGlobalAudioPreference(newMuted);
                    if (!newMuted) {
                      audioPreferences.setUserHasUnmuted();
                    }
                  }}
                  className="p-3 rounded-full border border-white/30 bg-black/30 backdrop-blur-sm hover:bg-white/10 transition-colors"
                >
                  {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </MagneticButton>
              </motion.div>
            </ScrollReveal>
          </div>
        </div>
      </div>      {/* S
lide indicators */}
      {featuredMedia.length > 1 && (
        <motion.div
          className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-30"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: showControls ? 1 : 0, y: showControls ? 0 : 20 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center gap-3 bg-black/30 backdrop-blur-sm px-4 py-2 rounded-full border border-white/20">
            <div className="flex items-center gap-2">
              {featuredMedia.map((_, index) => (
                <MagneticButton
                  key={`${index}-${cycleCount}`}
                  onClick={() => {
                    if (index >= 0 && index < featuredMedia.length && index !== currentIndex) {
                      setCurrentIndex(index);
                      setTrailerProgress(0);
                    }
                  }}
                  disabled={isTransitioning}
                  className="relative flex items-center justify-center transition-all duration-500 ease-out disabled:cursor-not-allowed p-1"
                  strength={0.2}
                >
                  {index === currentIndex ? (
                    <motion.div
                      className="relative"
                      style={{
                        background: 'linear-gradient(90deg, #e50914, #ff1a2b, #e50914)',
                        borderRadius: 2,
                        boxShadow: '0 0 20px rgba(229, 9, 20, 0.9), 0 0 40px rgba(229, 9, 20, 0.5), 0 2px 4px rgba(0, 0, 0, 0.3)'
                      }}
                      initial={{ width: 12, height: 12, opacity: 0.7 }}
                      animate={{
                        width: 40,
                        height: 5,
                        opacity: 1
                      }}
                      transition={{
                        duration: 0.3,
                        ease: "easeOut",
                        type: "spring",
                        stiffness: 500,
                        damping: 30
                      }}
                    >
                      <motion.div
                        className="absolute inset-0 rounded-sm"
                        style={{
                          background: 'linear-gradient(180deg, rgba(255,255,255,0.6) 0%, transparent 40%, rgba(255,255,255,0.1) 100%)',
                          borderRadius: 2
                        }}
                        animate={{
                          opacity: [0.6, 1, 0.6]
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                      />
                      <div
                        className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-8 h-1 rounded-full"
                        style={{
                          background: 'radial-gradient(ellipse, rgba(229, 9, 20, 0.4) 0%, transparent 70%)',
                          filter: 'blur(2px)'
                        }}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      className={`rounded-full cursor-pointer ${isLoadingNewContent ? 'animate-pulse' : ''}`}
                      style={{
                        backgroundColor: "rgba(255, 255, 255, 0.25)",
                        border: "1px solid rgba(255, 255, 255, 0.2)",
                        boxShadow: "inset 0 0 3px rgba(0, 0, 0, 0.4)"
                      }}
                      initial={{ width: 40, height: 5 }}
                      animate={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: "rgba(255, 255, 255, 0.25)"
                      }}
                      whileHover={{
                        scale: 1.3,
                        backgroundColor: "rgba(255, 255, 255, 0.5)",
                        boxShadow: "0 0 12px rgba(255, 255, 255, 0.3), inset 0 0 3px rgba(0, 0, 0, 0.3)"
                      }}
                      whileTap={{
                        scale: 0.8
                      }}
                      transition={{
                        duration: 0.3,
                        ease: "easeOut",
                        type: "spring",
                        stiffness: 400,
                        damping: 25
                      }}
                    />
                  )}
                  <span className="sr-only">Go to slide {index + 1}</span>
                </MagneticButton>
              ))}
            </div>

            {isLoadingNewContent && (
              <div className="flex items-center ml-2">
                <RedLoader size="small" />
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Progress bar - synced with trailer playback */}
      {featuredMedia.length > 1 && isAutoPlaying && !isTransitioning && (
        <motion.div
          className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 z-25"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            key={`progress-${currentIndex}-${isVideoLoaded}-${isPlaying}`}
            className="h-full bg-red-600 shadow-lg"
            style={{
              boxShadow: '0 0 8px rgba(239, 68, 68, 0.6)',
              width: `${trailerProgress}%`
            }}
            initial={{ width: "0%" }}
            animate={{ width: `${trailerProgress}%` }}
            transition={{
              duration: 0.1,
              ease: "linear"
            }}
          />
        </motion.div>
      )}
    </motion.div>
  );
};

export default ScrollXHero;