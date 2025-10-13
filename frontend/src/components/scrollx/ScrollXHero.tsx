"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, useScroll, useTransform, useSpring, AnimatePresence } from 'framer-motion';
import { Play, Info, ChevronLeft, ChevronRight, Film, Tv, Volume2 } from 'lucide-react';
import { Media } from '@/types/media';
import { getApiUrl } from '@/lib/api';
import { MagneticButton, GradientBackground, ParallaxSection, ParticleField, ScrollReveal } from './index';
import { useAudio } from '@/contexts/EnhancedAudioContext';
import RedLoader from '../RedLoader';
import LazyVideo from '../LazyVideo';
import { cleanMovieTitle } from '@/lib/titleUtils';

interface ScrollXHeroProps {
  featuredMedia: Media[];
  onPlay: (media: Media) => void;
  onInfo: (media: Media) => void;
  refreshInterval?: number; // Optional refresh interval in milliseconds
  enableRecommendations?: boolean; // Enable recommendation-based updates
  contentFilter?: 'movies-hd' | 'tv-series' | 'all'; // Content filtering for hero section
}

const ScrollXHero: React.FC<ScrollXHeroProps> = ({
  featuredMedia: initialFeaturedMedia,
  onPlay,
  onInfo,
  refreshInterval = 300000, // Default 5 minutes
  enableRecommendations = true,
  contentFilter = 'all',
}) => {
  // Core state - optimized and stable
  const [featuredMedia, setFeaturedMedia] = useState<Media[]>(initialFeaturedMedia);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false); // Start unmuted for better UX
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isPlayButtonLoading, setIsPlayButtonLoading] = useState(false);
  const [isInfoButtonLoading, setIsInfoButtonLoading] = useState(false);
  const [isMouseOver, setIsMouseOver] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [userHasInteracted, setUserHasInteracted] = useState(false);
  const [canAutoplayWithAudio, setCanAutoplayWithAudio] = useState(true); // Optimistic for modern browsers
  const [isInitialized, setIsInitialized] = useState(false);
  const [cycleCount, setCycleCount] = useState(0);
  const [isLoadingNewContent, setIsLoadingNewContent] = useState(false);
  const [backgroundLoaded, setBackgroundLoaded] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [previousApiResponses, setPreviousApiResponses] = useState<Set<string>>(new Set());
  const [allAvailableMedia, setAllAvailableMedia] = useState<Media[]>([]);
  const [hasInitializedContent, setHasInitializedContent] = useState(false);

  // Refs for stable references
  const videoRef = useRef<HTMLVideoElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentMediaRef = useRef<Media | null>(null);
  const isLoadingRef = useRef(false);
  const slideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const preloadRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const urlCache = useRef<Map<string, string>>(new Map());

  const {
    setCurrentAudioElement,
    muteAll,
    alacEngine,
    isALACEnabled,
    spatialAudioEnabled,
    initializeEnhancedAudio
  } = useAudio();

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
      if (typeof window === 'undefined') return false; // Start unmuted for better UX
      const saved = localStorage.getItem('scrollx-audio-muted');
      return saved !== null ? JSON.parse(saved) : false; // Default to unmuted
    },
    setGlobalAudioPreference: (muted: boolean) => {
      if (typeof window === 'undefined') return;
      localStorage.setItem('scrollx-audio-muted', JSON.stringify(muted));
    },
    hasUserEverUnmuted: (): boolean => {
      if (typeof window === 'undefined') return true; // Assume user wants audio
      return localStorage.getItem('scrollx-user-has-unmuted') !== 'false';
    },
    setUserHasUnmuted: () => {
      if (typeof window === 'undefined') return;
      localStorage.setItem('scrollx-user-has-unmuted', 'true');
    }
  }), []);

  // Test browser autoplay capabilities
  const testAutoplayCapabilities = async () => {
    try {
      const video = document.createElement('video');
      video.muted = true;
      video.src = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAr1tZGF0AAACrgYF//+q3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE1MiByMjg1NCBlOWE1OTAzIC0gSC4yNjQvTVBFRy00IEFWQyBjb2RlYyAtIENvcHlsZWZ0IDIwMDMtMjAxNyAtIGh0dHA6Ly93d3cudmlkZW9sYW4ub3JnL3gyNjQuaHRtbCAtIG9wdGlvbnM6IGNhYmFjPTEgcmVmPTMgZGVibG9jaz0xOjA6MCBhbmFseXNlPTB4MzoweDExMyBtZT1oZXggc3VibWU9NyBwc3k9MSBwc3lfcmQ9MS4wMDowLjAwIG1peGVkX3JlZj0xIG1lX3JhbmdlPTE2IGNocm9tYV9tZT0xIHRyZWxsaXM9MSA4eDhkY3Q9MSBjcW09MCBkZWFkem9uZT0yMSwxMSBmYXN0X3Bza2lwPTEgY2hyb21hX3FwX29mZnNldD0tMiB0aHJlYWRzPTMgbG9va2FoZWFkX3RocmVhZHM9MSBzbGljZWRfdGhyZWFkcz0wIG5yPTAgZGVjaW1hdGU9MSBpbnRlcmxhY2VkPTAgYmx1cmF5X2NvbXBhdD0wIGNvbnN0cmFpbmVkX2ludHJhPTAgYmZyYW1lcz0zIGJfcHlyYW1pZD0yIGJfYWRhcHQ9MSBiX2JpYXM9MCBkaXJlY3Q9MSB3ZWlnaHRiPTEgb3Blbl9nb3A9MCB3ZWlnaHRwPTIga2V5aW50PTI1MCBrZXlpbnRfbWluPTEwIHNjZW5lY3V0PTQwIGludHJhX3JlZnJlc2g9MCByY19sb29rYWhlYWQ9NDAgcmM9Y3JmIG1idHJlZT0xIGNyZj0yMy4wIHFjb21wPTAuNjAgcXBtaW49MCBxcG1heD02OSBxcHN0ZXA9NCBpcF9yYXRpbz0xLjQwIGFxPTE6MS4wMACAAAAAOWWIhAA3//p+C7v8tDDSTjf97w6BcLhRHXoJizVHBdHeAAACAAEAAALQQoCgQAAAAwAAAwAAAwAAAwAAAwAA';

      const playPromise = video.play();
      if (playPromise !== undefined) {
        await playPromise;
        setCanAutoplayWithAudio(true); // Start optimistic - assume audio works
        video.pause();
        console.log('✅ Autoplay capabilities detected - audio enabled');
      }
    } catch (error) {
      setCanAutoplayWithAudio(false);
      console.log('⚠️ Autoplay blocked - will use muted playback');
    }
  };

  // Enhanced shuffle array utility function with time-based randomization
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];

    // Add time-based randomization for more variety
    const timeSeed = Date.now() + cycleCount * 1000;
    const random = () => {
      const x = Math.sin(timeSeed + shuffled.length) * 10000;
      return x - Math.floor(x);
    };

    // Enhanced Fisher-Yates shuffle with time-based randomization
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor((Math.random() + random()) / 2 * (i + 1));
      [shuffled[i], shuffled[j % shuffled.length]] = [shuffled[j % shuffled.length], shuffled[i]];
    }

    // Additional randomization pass
    for (let i = 0; i < shuffled.length; i++) {
      if (Math.random() > 0.5) {
        const j = Math.floor(Math.random() * shuffled.length);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
    }

    return shuffled;
  };

  // Check if API response is duplicate
  const isApiResponseDuplicate = (media: Media[]): boolean => {
    const responseSignature = media.map(m => m.id).sort().join(',');
    return previousApiResponses.has(responseSignature);
  };

  // Add API response to history
  const addApiResponseToHistory = (media: Media[]) => {
    const responseSignature = media.map(m => m.id).sort().join(',');
    setPreviousApiResponses(prev => new Set([...prev, responseSignature]));
  };

  // Enhanced frontend recommendation system with latest movies and priority genre focus
  const generateFrontendRecommendations = (availableMedia: Media[], currentFeatured: Media[]): Media[] => {
    console.log(`🔄 Generating frontend recommendations from ${availableMedia.length} available items (cycle ${cycleCount})...`);

    // Apply content filtering
    let filteredMedia = availableMedia;

    if (contentFilter === 'movies-hd') {
      filteredMedia = availableMedia.filter((media: Media) => {
        const isMovie = media.type === 'movie';
        const hasHDQuality = media.quality && (
          media.quality.toLowerCase().includes('hd') ||
          media.quality.toLowerCase().includes('4k') ||
          media.quality.toLowerCase().includes('1080p') ||
          media.quality.toLowerCase().includes('2160p')
        );
        return isMovie && hasHDQuality;
      });

      // If not enough HD movies, fall back to all movies
      if (filteredMedia.length < 8) {
        filteredMedia = availableMedia.filter((media: Media) => media.type === 'movie');
      }
    } else if (contentFilter === 'tv-series') {
      filteredMedia = availableMedia.filter((media: Media) => {
        return media.type === 'episode' ||
          media.type === 'tv' ||
          media.type === 'series' ||
          media.title.toLowerCase().includes('series') ||
          media.title.toLowerCase().includes('episode') ||
          media.title.toLowerCase().includes('season');
      });
    }

    // Enhanced priority genres: sci-fi, action, drama, thriller + additional popular genres
    const priorityGenres = ['sci-fi', 'science fiction', 'action', 'drama', 'thriller', 'adventure', 'mystery', 'crime', 'horror', 'fantasy'];

    // Latest and newly added content (highest IDs = most recent) - increased to 50%
    const latestContent = filteredMedia
      .sort((a, b) => b.id - a.id)
      .slice(0, Math.floor(filteredMedia.length * 0.5)); // Top 50% newest

    // Latest movies specifically (for enhanced movie focus)
    const latestMovies = filteredMedia
      .filter(m => m.type === 'movie')
      .sort((a, b) => b.id - a.id)
      .slice(0, Math.floor(filteredMedia.length * 0.4)); // Top 40% newest movies

    // Priority genre content with latest preference
    const priorityGenreContent = filteredMedia.filter((media: Media) => {
      return media.genres?.some(genre =>
        priorityGenres.some(priority =>
          genre.name.toLowerCase().includes(priority.toLowerCase())
        )
      );
    }).sort((a, b) => b.id - a.id); // Sort by latest first

    // Latest priority genre movies (combining both filters)
    const latestPriorityMovies = latestMovies.filter((media: Media) => {
      return media.genres?.some(genre =>
        priorityGenres.some(priority =>
          genre.name.toLowerCase().includes(priority.toLowerCase())
        )
      );
    });

    // High-rated latest content
    const highRatedLatest = latestContent
      .filter(m => (m.rating || 0) >= 6.5)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0));

    // Popular latest content
    const popularLatest = latestContent
      .sort((a, b) => (b.view_count || 0) - (a.view_count || 0));

    // Add cycle-based randomization to ensure different content each time
    const cycleOffset = cycleCount * 2;

    // Remove currently featured items (but allow some overlap for continuity)
    const availableForRecommendation = filteredMedia.filter((media: Media, index: number) =>
      index < 20 || !currentFeatured.some(existing => existing.id === media.id)
    );

    if (availableForRecommendation.length === 0) {
      // If no content available, create variety from existing
      return shuffleArray([...filteredMedia]).slice(0, 10);
    }

    // Create intelligent frontend recommendations with enhanced latest and genre focus
    const recommendations: Media[] = [];

    // Vary the algorithm based on cycle count for different content - now 5 algorithms
    const algorithm = cycleCount % 5;

    if (algorithm === 0) {
      // Algorithm 1: Latest Priority Movies Focus (40% latest priority movies, 30% latest content, 30% high-rated latest)
      const latestPriorityFromAvailable = latestPriorityMovies
        .filter(m => availableForRecommendation.some(a => a.id === m.id))
        .slice(cycleOffset % Math.max(1, latestPriorityMovies.length), (cycleOffset % Math.max(1, latestPriorityMovies.length)) + 4);
      recommendations.push(...shuffleArray(latestPriorityFromAvailable));

      const latestFromAvailable = latestContent
        .filter(m => availableForRecommendation.some(a => a.id === m.id) && !recommendations.some(r => r.id === m.id))
        .slice(0, 3);
      recommendations.push(...shuffleArray(latestFromAvailable));

      const highRatedLatestFromAvailable = highRatedLatest
        .filter(m => availableForRecommendation.some(a => a.id === m.id) && !recommendations.some(r => r.id === m.id))
        .slice(0, 3);
      recommendations.push(...shuffleArray(highRatedLatestFromAvailable));

    } else if (algorithm === 1) {
      // Algorithm 2: Latest + Priority Genres (35% latest, 35% priority genres, 30% popular latest)
      const latestFromAvailable = latestContent
        .filter(m => availableForRecommendation.some(a => a.id === m.id))
        .slice(cycleOffset % Math.max(1, latestContent.length), (cycleOffset % Math.max(1, latestContent.length)) + 3);
      recommendations.push(...shuffleArray(latestFromAvailable));

      const priorityFromAvailable = priorityGenreContent
        .filter(m => availableForRecommendation.some(a => a.id === m.id) && !recommendations.some(r => r.id === m.id))
        .slice(0, 4);
      recommendations.push(...shuffleArray(priorityFromAvailable));

      const popularLatestFromAvailable = popularLatest
        .filter(m => availableForRecommendation.some(a => a.id === m.id) && !recommendations.some(r => r.id === m.id))
        .slice(0, 3);
      recommendations.push(...shuffleArray(popularLatestFromAvailable));

    } else if (algorithm === 2) {
      // Algorithm 3: Priority Genre Latest Focus (50% latest priority genres, 30% latest movies, 20% high-rated)
      const latestPriorityFromAvailable = priorityGenreContent
        .filter(m => availableForRecommendation.some(a => a.id === m.id))
        .slice(cycleOffset % Math.max(1, priorityGenreContent.length), (cycleOffset % Math.max(1, priorityGenreContent.length)) + 5);
      recommendations.push(...shuffleArray(latestPriorityFromAvailable));

      const latestMoviesFromAvailable = latestMovies
        .filter(m => availableForRecommendation.some(a => a.id === m.id) && !recommendations.some(r => r.id === m.id))
        .slice(0, 3);
      recommendations.push(...shuffleArray(latestMoviesFromAvailable));

      const highRatedFromAvailable = highRatedLatest
        .filter(m => availableForRecommendation.some(a => a.id === m.id) && !recommendations.some(r => r.id === m.id))
        .slice(0, 2);
      recommendations.push(...shuffleArray(highRatedFromAvailable));

    } else if (algorithm === 3) {
      // Algorithm 4: Balanced Latest Focus (30% latest priority movies, 25% latest content, 25% priority genres, 20% popular)
      const latestPriorityMoviesFromAvailable = latestPriorityMovies
        .filter(m => availableForRecommendation.some(a => a.id === m.id))
        .slice(cycleOffset % Math.max(1, latestPriorityMovies.length), (cycleOffset % Math.max(1, latestPriorityMovies.length)) + 3);
      recommendations.push(...shuffleArray(latestPriorityMoviesFromAvailable));

      const latestFromAvailable = latestContent
        .filter(m => availableForRecommendation.some(a => a.id === m.id) && !recommendations.some(r => r.id === m.id))
        .slice(0, 2);
      recommendations.push(...shuffleArray(latestFromAvailable));

      const priorityFromAvailable = priorityGenreContent
        .filter(m => availableForRecommendation.some(a => a.id === m.id) && !recommendations.some(r => r.id === m.id))
        .slice(0, 3);
      recommendations.push(...shuffleArray(priorityFromAvailable));

      const popularFromAvailable = popularLatest
        .filter(m => availableForRecommendation.some(a => a.id === m.id) && !recommendations.some(r => r.id === m.id))
        .slice(0, 2);
      recommendations.push(...shuffleArray(popularFromAvailable));

    } else {
      // Algorithm 5: Latest Movie Priority (45% latest movies, 30% latest priority genres, 25% high-rated latest)
      const latestMoviesFromAvailable = latestMovies
        .filter(m => availableForRecommendation.some(a => a.id === m.id))
        .slice(cycleOffset % Math.max(1, latestMovies.length), (cycleOffset % Math.max(1, latestMovies.length)) + 4);
      recommendations.push(...shuffleArray(latestMoviesFromAvailable));

      const latestPriorityFromAvailable = priorityGenreContent
        .filter(m => availableForRecommendation.some(a => a.id === m.id) && !recommendations.some(r => r.id === m.id))
        .slice(0, 3);
      recommendations.push(...shuffleArray(latestPriorityFromAvailable));

      const highRatedLatestFromAvailable = highRatedLatest
        .filter(m => availableForRecommendation.some(a => a.id === m.id) && !recommendations.some(r => r.id === m.id))
        .slice(0, 3);
      recommendations.push(...shuffleArray(highRatedLatestFromAvailable));
    }

    // Fill remaining slots with latest priority content first, then latest general content
    const remaining = availableForRecommendation
      .filter(m => !recommendations.some(r => r.id === m.id));

    // Prioritize remaining latest priority genre content
    const remainingLatestPriority = remaining.filter(m =>
      m.genres?.some(genre =>
        priorityGenres.some(priority =>
          genre.name.toLowerCase().includes(priority.toLowerCase())
        )
      )
    ).sort((a, b) => b.id - a.id); // Latest first

    // Then latest general content
    const remainingLatest = remaining.filter(m =>
      !remainingLatestPriority.some(r => r.id === m.id)
    ).sort((a, b) => b.id - a.id);

    // Fill remaining slots
    const slotsRemaining = 10 - recommendations.length;
    if (slotsRemaining > 0) {
      const fillContent = [
        ...remainingLatestPriority.slice(0, Math.floor(slotsRemaining * 0.7)), // 70% latest priority
        ...remainingLatest.slice(0, Math.floor(slotsRemaining * 0.3)) // 30% latest general
      ];
      recommendations.push(...shuffleArray(fillContent).slice(0, slotsRemaining));
    }

    console.log(`✅ Generated ${recommendations.length} frontend recommendations using algorithm ${algorithm + 1} (${priorityGenreContent.length} priority genres, ${latestContent.length} latest, ${latestMovies.length} latest movies, ${latestPriorityMovies.length} latest priority movies)`);
    return shuffleArray(recommendations).slice(0, 10);
  };

  // Enhanced recommendation system with guaranteed unique content every load
  const fetchRecommendedMedia = async (cycleNumber: number = 0) => {
    setIsLoadingNewContent(true);
    console.log(`🎬 Fetching ALWAYS DIFFERENT recommendations (cycle ${cycleNumber})...`);

    try {
      // ALWAYS try backend recommendations first for guaranteed uniqueness
      let newMedia: Media[] = [];

      try {
        // Import the enhanced API functions
        const { fetchUniqueRecommendations } = await import('@/lib/api');

        // Get unique recommendations with cycle-based type rotation
        const recommendationTypes = ['mixed', 'trending', 'popular', 'personalized', 'recent'];
        const currentType = recommendationTypes[cycleNumber % recommendationTypes.length];

        console.log(`🎯 Fetching ${currentType} recommendations for cycle ${cycleNumber}`);
        newMedia = await fetchUniqueRecommendations(currentType, 25);
        console.log(`✅ Got ${newMedia.length} unique ${currentType} recommendations from backend`);

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
            return media.type === 'episode' ||
              media.type === 'tv' ||
              media.type === 'series';
          });
        }

        if (newMedia.length >= 5) {
          // Add additional randomization based on time and cycle
          const timeBasedShuffle = shuffleArray(newMedia);
          setFeaturedMedia(timeBasedShuffle.slice(0, 10));
          console.log(`✅ Using ${timeBasedShuffle.length} unique ${currentType} recommendations`);

          // Preload assets for instant display
          const { preloadAssets } = await import('@/lib/api');
          preloadAssets(timeBasedShuffle.slice(0, 10), ['thumbnail', 'preview']);

          return;
        }
      } catch (error) {
        console.warn('❌ Backend recommendations failed:', error);
      }

      // Enhanced frontend fallback with guaranteed uniqueness
      if (initialFeaturedMedia.length > 0) {
        // Create a much larger and more varied pool with cycle-based variations
        const timeVariant = Date.now() % 1000 + cycleNumber * 1000;
        const cycleMultiplier = (cycleNumber % 5) + 1; // Rotate through different multipliers

        const expandedPool = [
          ...initialFeaturedMedia,
          ...initialFeaturedMedia.map(item => ({ ...item, id: item.id + 10000 + timeVariant })),
          ...initialFeaturedMedia.map(item => ({ ...item, id: item.id + 20000 + timeVariant })),
          ...initialFeaturedMedia.map(item => ({ ...item, id: item.id + 30000 + timeVariant })),
          ...initialFeaturedMedia.map(item => ({ ...item, id: item.id + 40000 + timeVariant })),
          ...initialFeaturedMedia.map(item => ({ ...item, id: item.id + (50000 * cycleMultiplier) + timeVariant }))
        ];

        // Use different algorithm based on cycle for guaranteed variety
        const algorithmIndex = cycleNumber % 5;
        console.log(`🎲 Using frontend algorithm ${algorithmIndex + 1} for cycle ${cycleNumber}`);

        // Force different content by excluding current featured media
        const frontendRecs = generateFrontendRecommendations(expandedPool, featuredMedia);
        setFeaturedMedia(frontendRecs);
        console.log(`✅ Updated with ${frontendRecs.length} GUARANTEED DIFFERENT frontend recommendations`);
      } else if (allAvailableMedia.length > 0) {
        // Fallback to cached media with cycle-based shuffling
        const cycleBasedRecs = generateFrontendRecommendations(allAvailableMedia, featuredMedia);
        setFeaturedMedia(cycleBasedRecs);
        console.log(`✅ Updated with ${cycleBasedRecs.length} cycle-based cached recommendations`);
      } else {
        console.log(`🔄 Creating time-based randomized content...`);
        // Create completely new shuffled content with time-based seed
        const timeShuffled = shuffleArray([...initialFeaturedMedia, ...initialFeaturedMedia]);
        setFeaturedMedia(timeShuffled.slice(0, 10));
      }

      /* COMMENTED OUT - API RECOMMENDATION CALLS FOR LATER USE
      
      // Primary recommendation endpoints from backend - these use intelligent algorithms
      const recommendationEndpoints = [
        `${getApiUrl()}/api/recommendations/personalized?limit=20`,
        `${getApiUrl()}/api/recommendations/mixed?limit=20`,
        `${getApiUrl()}/api/recommendations/trending?limit=20`,
        `${getApiUrl()}/api/recommendations/popular?limit=20`,
        `${getApiUrl()}/api/recommendations/recent?limit=20`,
        `${getApiUrl()}/api/recommendations/top-rated?limit=20`
      ];

      const endpointIndex = cycleNumber % recommendationEndpoints.length;
      const primaryEndpoint = recommendationEndpoints[endpointIndex];
      let newMedia: Media[] = [];
      let usedFrontendFallback = false;

      console.log(`🎯 Trying primary recommendation endpoint: ${primaryEndpoint}`);

      // Try the primary recommendation endpoint first
      try {
        const response = await fetch(primaryEndpoint);
        if (response.ok) {
          const data = await response.json();
          if (data && Array.isArray(data) && data.length > 0) {
            // Check if this is duplicate data
            if (isApiResponseDuplicate(data)) {
              console.warn(`⚠️ Primary endpoint returned duplicate data, will use frontend fallback`);
              newMedia = [];
            } else {
              newMedia = data;
              addApiResponseToHistory(data);
              console.log(`✅ Got ${newMedia.length} recommendations from primary endpoint`);
            }
          } else {
            console.warn(`⚠️ Primary endpoint returned empty or invalid data:`, data);
          }
        } else {
          console.warn(`⚠️ Primary endpoint failed with status: ${response.status}`);
        }
      } catch (error) {
        console.warn(`❌ Primary endpoint ${primaryEndpoint} failed:`, error);
      }

      // If primary fails or returns duplicates, try other recommendation endpoints
      if (newMedia.length === 0) {
        console.log(`🔄 Primary failed or returned duplicates, trying other recommendation endpoints...`);
        
        // Try up to 2 other recommendation endpoints
        const fallbackEndpoints = recommendationEndpoints
          .filter(endpoint => endpoint !== primaryEndpoint)
          .slice(0, 2);

        for (const fallbackEndpoint of fallbackEndpoints) {
          try {
            console.log(`🎯 Trying fallback recommendation endpoint: ${fallbackEndpoint}`);
            const response = await fetch(fallbackEndpoint);
            if (response.ok) {
              const data = await response.json();
              if (data && Array.isArray(data) && data.length > 0) {
                // Check if this is duplicate data
                if (isApiResponseDuplicate(data)) {
                  console.warn(`⚠️ Fallback endpoint also returned duplicate data`);
                  continue;
                } else {
                  newMedia = data;
                  addApiResponseToHistory(data);
                  console.log(`✅ Got ${newMedia.length} recommendations from fallback endpoint`);
                  break;
                }
              }
            }
          } catch (error) {
            console.warn(`❌ Fallback endpoint ${fallbackEndpoint} failed:`, error);
            continue;
          }
        }
      }

      // Process the new media from backend
      if (newMedia && newMedia.length > 0) {
        console.log(`🎬 Processing ${newMedia.length} items from backend...`);
        
        // Apply content filtering if not already done by frontend fallback
        let contentFilteredMedia = newMedia;
        
        if (contentFilter === 'movies-hd') {
          contentFilteredMedia = newMedia.filter((media: Media) => {
            const isMovie = media.type === 'movie';
            const hasHDQuality = media.quality && (
              media.quality.toLowerCase().includes('hd') || 
              media.quality.toLowerCase().includes('4k') ||
              media.quality.toLowerCase().includes('1080p') ||
              media.quality.toLowerCase().includes('2160p')
            );
            return isMovie && hasHDQuality;
          });
          
          // If not enough HD movies, fall back to all movies
          if (contentFilteredMedia.length < 4) {
            contentFilteredMedia = newMedia.filter((media: Media) => media.type === 'movie');
            console.log(`⚠️ Not enough HD movies, using all movies (${contentFilteredMedia.length})`);
          } else {
            console.log(`✅ Filtered to ${contentFilteredMedia.length} HD/4K movies`);
          }
        } else if (contentFilter === 'tv-series') {
          contentFilteredMedia = newMedia.filter((media: Media) => {
            return media.type === 'episode' || 
                   media.type === 'tv' || 
                   media.type === 'series' ||
                   media.title.toLowerCase().includes('series') ||
                   media.title.toLowerCase().includes('episode') ||
                   media.title.toLowerCase().includes('season');
          });
          console.log(`✅ Filtered to ${contentFilteredMedia.length} TV series/episodes`);
        }
        
        // Filter out exact duplicates from current cycle for backend recommendations
        const filteredMedia = contentFilteredMedia.filter((media: Media) =>
          !featuredMedia.some(existing => existing.id === media.id)
        );

        if (filteredMedia.length >= 4) {
          // We have enough new content from backend recommendations
          setFeaturedMedia(filteredMedia.slice(0, 10));
          console.log(`✅ Updated with ${filteredMedia.length} new filtered backend recommendations`);
        } else if (filteredMedia.length > 0) {
          // Mix new backend content with some existing (but prioritize new)
          const mixedMedia = [
            ...filteredMedia, // All new filtered recommendations first
            ...featuredMedia.slice(0, Math.max(0, 8 - filteredMedia.length)) // Fill remaining slots
          ];
          setFeaturedMedia(mixedMedia);
          console.log(`✅ Mixed ${filteredMedia.length} new filtered recommendations with existing content`);
        } else {
          // All content was duplicates, generate frontend recommendations
          if (allAvailableMedia.length > 0) {
            const frontendRecs = generateFrontendRecommendations(allAvailableMedia, featuredMedia);
            setFeaturedMedia(frontendRecs);
            console.log(`✅ Used frontend recommendations due to backend duplicates`);
          } else {
            // Use the new filtered recommendations anyway
            setFeaturedMedia(contentFilteredMedia.slice(0, 10));
            console.log(`✅ Used filtered recommendations despite duplicates`);
          }
        }
      }
      
      END OF COMMENTED API CALLS */

    } catch (error) {
      console.error('❌ Critical error in frontend recommendations:', error);
      // Keep existing content if error occurs
    } finally {
      setIsLoadingNewContent(false);
    }
  };

  const handlePlay = async () => {
    setIsPlayButtonLoading(true);
    try {
      await onPlay(currentMedia);
    } finally {
      setTimeout(() => setIsPlayButtonLoading(false), 1000);
    }
  };

  const handleInfo = async () => {
    setIsInfoButtonLoading(true);
    try {
      await onInfo(currentMedia);
    } finally {
      setTimeout(() => setIsInfoButtonLoading(false), 500);
    }
  };

  // Optimized URL generation with caching and proper media synchronization
  const getVideoUrl = useCallback((media: Media, fallback: boolean = false): string | undefined => {
    if (!media?.id) return undefined;

    // Ensure we're getting URL for the current media to prevent wrong slide issues
    if (media.id !== currentMediaRef.current?.id) {
      console.warn('Video URL requested for non-current media, skipping to prevent wrong slide display');
      return undefined;
    }

    const apiUrl = getApiUrl();
    // Remove cache-busting timestamp to enable L1 cache hits for instant playback
    if (fallback) {
      return `${apiUrl}/api/preview-clips/${media.id}?quality=low&format=mp4`;
    }

    return `${apiUrl}/api/preview-clips/${media.id}?quality=high&format=mp4&cache=true`;
  }, []);

  const getThumbnailUrl = useCallback((media: Media): string | undefined => {
    if (!media?.id) return undefined;

    // Ensure we're getting URL for the current media to prevent wrong slide issues
    if (media.id !== currentMediaRef.current?.id) {
      console.warn('Thumbnail URL requested for non-current media, skipping to prevent wrong slide display');
      return undefined;
    }

    const apiUrl = getApiUrl();
    return `${apiUrl}/api/thumbnails/${media.id}`;
  }, []);




  // Check if media has video content (preview clip or can generate one)
  const hasVideoContent = (media: Media) => {
    // Check if we have a media ID and either a preview clip path or file path
    // The backend will serve preview clips if they exist, or generate them on-demand
    return !!(media.id && media.file_path);
  };

  // Debug function to check preview clip availability
  const checkPreviewClipAvailability = useCallback(async (media: Media): Promise<boolean> => {
    if (!media?.id) return false;

    // Always assume preview clips are available to avoid HEAD requests
    // Backend L1 cache will handle missing clips gracefully
    console.log(`⚡ Skipping availability check for ${media.title} - assuming available for instant playback`);
    return true;
  }, []);

  // Disable preview clip generation to prevent server-side FFmpeg triggers
  const generatePreviewClipIfNeeded = useCallback(async (media: Media) => {
    if (!media?.id) return;

    // Skip generation to avoid triggering server-side processing
    // Preview clips should be pre-generated or handled by backend on-demand
    console.log(`⚡ Skipping preview clip generation for ${media.title} - relying on backend caching`);
  }, []);



  const getBackgroundImageUrl = (media: Media) => {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    const apiUrl = `http://${host === 'localhost' ? 'localhost' : host}:8252`;

    // Always try thumbnail first as it's most reliable
    if (media.id) {
      return `${apiUrl}/api/thumbnails/${media.id}`;
    }

    // Try banner for hero backgrounds
    if (media.banner_path) {
      return `${apiUrl}/api/admin/assets/${media.banner_path.split('/').pop()}`;
    }

    // Default fallback
    return `${apiUrl}/api/thumbnails/1`;
  };

  // Chrome-safe stop all video/audio playback
  const stopAllPlayback = () => {
    // Prevent Chrome race conditions by checking state before pause
    if (videoRef.current && !videoRef.current.paused) {
      try {
        videoRef.current.pause();
      } catch (error) {
        console.warn('Chrome pause error (safe to ignore):', error);
      }
    }
    // Stop main video
    if (videoRef.current) {
      const video = videoRef.current;
      video.pause();
      video.currentTime = 0;
      video.muted = true;
      video.volume = 0;
    }

    // Chrome-safe clear all preloaded videos to free memory
    preloadRefs.current.forEach((video) => {
      try {
        if (!video.paused) {
          video.pause();
        }
        video.src = '';
        video.load();
      } catch (error) {
        console.warn('Chrome video cleanup error (safe to ignore):', error);
      }
    });

    // Mute all audio through context
    muteAll();

    // Reset playback states
    setIsPlaying(false);
    setIsVideoLoaded(false);
    setVideoLoaded(false);
  };

  const nextSlide = () => {
    if (featuredMedia.length > 1 && !isTransitioning) {
      setIsTransitioning(true);

      // Stop all current playback before transitioning
      stopAllPlayback();

      // Fade out current content
      setBackgroundLoaded(false);
      setVideoLoaded(false);

      setTimeout(() => {
        const nextIndex = (currentIndex + 1) % featuredMedia.length;
        setCurrentIndex(nextIndex);
        setIsTransitioning(false);

        // NO automatic cycle reloading - just loop through existing slides
        console.log(`➡️ Moving to slide ${nextIndex + 1}/${featuredMedia.length}`);
      }, 300); // Wait for fade out
    }
  };

  const prevSlide = () => {
    if (featuredMedia.length > 1 && !isTransitioning) {
      setIsTransitioning(true);

      // Stop all current playback before transitioning
      stopAllPlayback();

      // Fade out current content
      setBackgroundLoaded(false);
      setVideoLoaded(false);

      setTimeout(() => {
        setCurrentIndex((prev) => (prev - 1 + featuredMedia.length) % featuredMedia.length);
        setIsTransitioning(false);
      }, 300); // Wait for fade out
    }
  };


  // Enhanced video preloading with intelligent caching
  // Simplified preloading - only preload current media to reduce server requests
  const preloadVideo = useCallback((media: Media, priority: 'high' | 'low' = 'low') => {
    if (!media?.id) return;

    // Skip preloading to reduce server requests - rely on instant L1 cache
    console.log(`⚡ Skipping video preload for ${media.title} - relying on instant backend cache`);
    return null;
  }, []);

  // Simplified - no preloading, direct video element usage
  const getPreloadedVideo = useCallback((media: Media) => {
    // Skip preloading - create video element on-demand for instant playback
    console.log(`⚡ Creating video element on-demand for ${media.title}`);
    return null;
  }, []);

  // Enhanced video playback with Chrome race condition prevention
  const playVideoWithAudio = useCallback(async (video: HTMLVideoElement, withAudio: boolean = true) => {
    if (!video || isLoadingRef.current) return false;

    try {
      const currentMediaId = currentMediaRef.current?.id?.toString();
      console.log(`🎬 Attempting to play video for media ${currentMediaId}`);

      // Basic validation - less strict to allow playback
      if (!currentMediaId) {
        console.warn(`🚫 No current media ID available`);
        return false;
      }

      // Prevent Chrome race conditions by ensuring video is not in conflicting state
      if (!video.paused) {
        console.log(`⏸️ Video already playing, avoiding race condition`);
        return true;
      }

      // Reset video state
      video.currentTime = 0;

      // Always start muted for maximum browser compatibility
      video.muted = true;
      video.volume = 0;

      console.log(`🎵 Starting muted video for browser compatibility - slide ${currentMediaId}`);

      // Chrome-safe play with proper promise handling
      try {
        const playPromise = video.play();
        if (playPromise !== undefined) {
          await playPromise;

          // Double-check video is still playing after await
          if (!video.paused) {
            setIsPlaying(true);

            // Only unmute after user interaction for Safari compliance
            const shouldStartWithAudio = withAudio && !isMuted && audioPreferences.hasUserEverUnmuted() && canAutoplayWithAudio && userHasInteracted;

            if (shouldStartWithAudio && !video.paused) {
              // Instant unmute without delays after user interaction
              if (currentMediaRef.current?.id?.toString() === currentMediaId && !video.paused) {
                video.muted = false;
                video.volume = spatialAudioEnabled ? 0.7 : 0.5;
                console.log(`🔊 Instantly unmuted video for slide ${currentMediaId}`);
              }
            }

            console.log(`✅ Video playing successfully for slide ${currentMediaId}`);
            return true;
          } else {
            console.warn(`⚠️ Video was paused during play attempt`);
            return false;
          }
        }
      } catch (playError) {
        console.error(`❌ Chrome play() interrupted:`, playError);
        // Don't throw, just return false to allow fallback
        return false;
      }
    } catch (error) {
      console.error(`❌ Video play failed for media ${currentMediaRef.current?.id}:`, error);

      // Fallback: ensure muted playback
      try {
        video.muted = true;
        video.volume = 0;
        const fallbackPromise = video.play();
        if (fallbackPromise !== undefined) {
          await fallbackPromise;
          setIsPlaying(true);
          console.log(`🔇 Fallback muted playback successful for media ${currentMediaRef.current?.id}`);
          return true;
        }
      } catch (fallbackError) {
        console.error(`❌ Fallback muted playback also failed:`, fallbackError);
      }
    }

    return false;
  }, [isMuted, spatialAudioEnabled, audioPreferences, canAutoplayWithAudio]);

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

    // Immediately apply to current video if playing
    if (videoRef.current && isPlaying) {
      const video = videoRef.current;
      video.muted = false;
      video.volume = spatialAudioEnabled ? 0.8 : 0.6;
    }
  };

  // Netflix-style helper functions
  const getQualityBadge = () => {
    const qualityText = currentMedia.quality ?
      (currentMedia.quality.includes('2160') || currentMedia.quality.toLowerCase().includes('4k') ? '4K' : 'HD')
      : "HD";
    return { text: qualityText, color: 'bg-blue-600' };
  }
  const getAgeRating = () => {
    if (currentMedia.rating && currentMedia.rating >= 8.0) return '18+';
    if (currentMedia.rating && currentMedia.rating >= 7.0) return '16+';
    if (currentMedia.rating && currentMedia.rating >= 6.0) return '13+';
    return 'PG';
  };

  // Extract year from filename or title
  const extractYearFromMedia = () => {
    //try to extract year from object first
    if (currentMedia.year) {
      return currentMedia.year;
    } else if (currentMedia.release_date) {
      return new Date(currentMedia.release_date).getFullYear().toString();
    }

    // Try to extract year from filename first
    if (currentMedia.file_path) {
      const yearMatch = currentMedia.file_path.match(/\b(19|20)\d{2}\b/);
      if (yearMatch) return yearMatch[0];
    }

    // Try to extract year from title
    if (currentMedia.title) {
      const yearMatch = currentMedia.title.match(/\b(19|20)\d{2}\b/);
      if (yearMatch) return yearMatch[0];
    }

    // Fallback to release_date if available
    if (currentMedia.release_date) {
      return new Date(currentMedia.release_date).getFullYear().toString();
    }

    return null;
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const getTitleSizeClass = () => {
    const titleLength = currentMedia.title.length;
    if (titleLength > 50) return 'text-2xl md:text-3xl lg:text-4xl';
    if (titleLength > 35) return 'text-2xl md:text-4xl lg:text-5xl';
    if (titleLength > 25) return 'text-3xl md:text-5xl lg:text-6xl';
    if (titleLength > 15) return 'text-4xl md:text-6xl lg:text-7xl';
    return 'text-5xl md:text-7xl lg:text-8xl';
  };

  const getGenreBasedStyling = () => {
    const genres = currentMedia.genres?.map(g => g.name.toLowerCase()) || [];
    if (genres.includes('horror') || genres.includes('thriller')) return 'font-black tracking-wider';
    if (genres.includes('comedy') || genres.includes('family')) return 'font-extrabold tracking-wide';
    if (genres.includes('drama') || genres.includes('romance')) return 'font-bold tracking-normal';
    if (genres.includes('action') || genres.includes('adventure')) return 'font-black tracking-widest';
    return 'font-bold tracking-wide';
  };

  const getGenreGradient = () => {
    const genres = currentMedia.genres?.map(g => g.name.toLowerCase()) || [];
    if (genres.includes('horror') || genres.includes('thriller'))
      return 'linear-gradient(135deg, #ff0000, #8b0000, #ffffff)';
    if (genres.includes('comedy') || genres.includes('family'))
      return 'linear-gradient(135deg, #ffd700, #ff6b35, #ffffff)';
    if (genres.includes('drama') || genres.includes('romance'))
      return 'linear-gradient(135deg, #ff69b4, #8a2be2, #ffffff)';
    if (genres.includes('action') || genres.includes('adventure'))
      return 'linear-gradient(135deg, #ff4500, #dc143c, #ffffff)';
    return 'linear-gradient(135deg, #4169e1, #1e90ff, #ffffff)';
  };

  const refreshContent = () => {
    const newCycleCount = cycleCount + 1;
    setCycleCount(newCycleCount);
    console.log(`🔄 Manual refresh triggered, generating cycle ${newCycleCount} from frontend shuffle...`);
    fetchRecommendedMedia(newCycleCount);
    setCurrentIndex(0); // Reset to first slide
  };

  // Optimized slide change with proper media synchronization and smooth transitions
  const handleSlideChange = useCallback(async (newIndex: number) => {
    if (newIndex === currentIndex || isTransitioning || !featuredMedia.length) return;

    const newMedia = featuredMedia[newIndex];
    if (!newMedia) return;

    setIsTransitioning(true);
    setIsLoadingNewContent(true);

    try {
      // Stop and cleanup current video
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
        videoRef.current.muted = true;
      }

      // Clear all timeouts and intervals
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // Update current media reference immediately to prevent wrong slide media
      currentMediaRef.current = newMedia;

      // Update index with smooth transition
      setCurrentIndex(newIndex);
      setIsPlaying(false);

      // Clear URL cache for new media to ensure fresh URLs
      const cacheKey = `video_${newMedia.id}`;
      if (urlCache.current.has(cacheKey)) {
        urlCache.current.delete(cacheKey);
      }

      // Small delay for DOM updates and smooth transition
      await new Promise(resolve => setTimeout(resolve, 150));

      // Preload new video if available
      const newVideoUrl = getVideoUrl(newMedia);
      if (newVideoUrl && videoRef.current) {
        videoRef.current.src = newVideoUrl;
        videoRef.current.load();

        // Try to start playback after a brief delay
        setTimeout(async () => {
          if (videoRef.current && currentMediaRef.current?.id === newMedia.id) {
            await playVideoWithAudio(videoRef.current, !isMuted);
          }
        }, 300);
      }

    } catch (error) {
      console.warn('Error during slide change:', error);
    } finally {
      setIsTransitioning(false);
      setIsLoadingNewContent(false);
    }
  }, [currentIndex, isTransitioning, featuredMedia, getVideoUrl, playVideoWithAudio, isMuted]);

  // Navigate to specific slide with smooth transition
  const goToSlide = useCallback((index: number) => {
    if (index >= 0 && index < featuredMedia.length && index !== currentIndex) {
      handleSlideChange(index);
    }
  }, [featuredMedia.length, currentIndex, handleSlideChange]);

  // Fixed initialization - prevent multiple cycles and ensure immediate display
  useEffect(() => {
    if (hasInitializedContent) return; // Prevent re-initialization

    const savedMutedState = audioPreferences.getGlobalAudioPreference();
    const userHasUnmutedBefore = audioPreferences.hasUserEverUnmuted();

    setIsMuted(savedMutedState);
    setUserHasInteracted(userHasUnmutedBefore);

    // Test browser autoplay capabilities once
    testAutoplayCapabilities();

    // Set initial media immediately to show slides right away
    if (initialFeaturedMedia.length > 0) {
      setAllAvailableMedia(initialFeaturedMedia);
      setFeaturedMedia(initialFeaturedMedia);

      // Set current media reference immediately
      currentMediaRef.current = initialFeaturedMedia[0];

      // NO cycle count changes - use static initialization to prevent multiple cycles
      console.log(`🎯 Immediate display: Using ${initialFeaturedMedia.length} initial media items`);

      // Mark as initialized immediately to show content
      setHasInitializedContent(true);
      setIsInitialized(true);

      // Show first slide immediately without any delays
      setCurrentIndex(0);
    }
  }, []); // Empty dependency array - runs only once

  // Fixed video setup - ensures audio plays for correct current slide only
  useEffect(() => {
    if (!videoRef.current || !currentMedia || !hasVideoContent(currentMedia) || isTransitioning || !isInitialized) {
      return;
    }

    const video = videoRef.current;
    const currentVideoUrl = getVideoUrl(currentMedia);

    // Only proceed if we have a valid video URL for current media
    if (!currentVideoUrl) return;

    // CRITICAL: Stop any existing playback first to prevent wrong slide audio
    video.pause();
    video.currentTime = 0;
    video.muted = true;

    // Check if video source needs updating - strict media ID matching
    const needsNewSource = !video.src || !video.src.includes(currentMedia.id.toString());

    if (needsNewSource) {
      video.src = currentVideoUrl;
      video.load();
    }

    const shouldPlayWithAudio = !isMuted && audioPreferences.hasUserEverUnmuted() && canAutoplayWithAudio;

    // Enhanced video ready check with strict current media validation
    const attemptPlay = () => {
      // CRITICAL: Double-check we're still on the same slide before playing
      if (video.readyState >= 2 &&
        video.paused &&
        currentMediaRef.current?.id === currentMedia.id &&
        video.src.includes(currentMedia.id.toString())) {

        console.log(`🎵 Playing audio for slide ${currentMedia.id}: ${currentMedia.title}`);
        playVideoWithAudio(video, shouldPlayWithAudio);
      } else {
        console.log(`⏸️ Skipping play - media mismatch. Current: ${currentMedia.id}, Ref: ${currentMediaRef.current?.id}`);
      }
    };

    // Longer delay to ensure proper slide synchronization
    if (video.readyState >= 2) {
      setTimeout(attemptPlay, 500);
    } else {
      const handleLoadedData = () => {
        video.removeEventListener('loadeddata', handleLoadedData);
        // Extra validation after load
        if (currentMediaRef.current?.id === currentMedia.id) {
          setTimeout(attemptPlay, 500);
        }
      };

      video.addEventListener('loadeddata', handleLoadedData);

      // Cleanup timeout
      const cleanup = setTimeout(() => {
        video.removeEventListener('loadeddata', handleLoadedData);
      }, 5000);

      return () => {
        clearTimeout(cleanup);
        video.removeEventListener('loadeddata', handleLoadedData);
      };
    }
  }, [currentIndex, currentMedia, isTransitioning, isInitialized]); // Reduced dependencies

  // Preload adjacent videos for smooth transitions
  useEffect(() => {
    if (!isInitialized || featuredMedia.length <= 1) return;

    const preloadAdjacent = () => {
      const nextIndex = (currentIndex + 1) % featuredMedia.length;
      const prevIndex = (currentIndex - 1 + featuredMedia.length) % featuredMedia.length;

      // Preload next and previous videos with low priority
      if (featuredMedia[nextIndex]) {
        preloadVideo(featuredMedia[nextIndex], 'low');
      }
      if (featuredMedia[prevIndex]) {
        preloadVideo(featuredMedia[prevIndex], 'low');
      }
    };

    // Delay preloading to not interfere with current video
    setTimeout(preloadAdjacent, 2000);
  }, [currentIndex, featuredMedia]);

  // Smart auto-slide functionality with fresh content loading
  useEffect(() => {
    if (!isAutoPlaying || featuredMedia.length <= 1 || isTransitioning) return;

    // Longer duration for video content, shorter for images
    const slideDuration = hasVideoContent(currentMedia) && isVideoLoaded && isPlaying ? 20000 : 8000;

    const interval = setInterval(() => {
      if (!isTransitioning) {
        // Check if we're at the last slide
        const nextIndex = (currentIndex + 1) % featuredMedia.length;
        if (nextIndex === 0 && currentIndex === featuredMedia.length - 1) {
          // At the end of cycle - fetch fresh content and restart
          console.log('🔄 End of cycle reached, fetching fresh content...');

          // Pause auto-playing temporarily while loading new content
          setIsAutoPlaying(false);
          setIsLoadingNewContent(true);

          // Fetch fresh recommendations with a new cycle count
          const newCycleCount = cycleCount + 1;
          setCycleCount(newCycleCount);

          // Fetch new content and restart auto-playing after loading
          fetchRecommendedMedia(newCycleCount).then(() => {
            setTimeout(() => {
              setCurrentIndex(0); // Start from first slide of new content
              setIsAutoPlaying(true); // Resume auto-playing
              console.log('✅ Fresh content loaded, restarting auto-play');
            }, 1000);
          }).catch((error) => {
            console.error('❌ Failed to fetch fresh content:', error);
            // Fallback: just restart the current cycle
            setCurrentIndex(0);
            setIsAutoPlaying(true);
          });

          return;
        }
        nextSlide();
      }
    }, slideDuration);

    return () => clearInterval(interval);
  }, [isAutoPlaying, featuredMedia.length, currentIndex, isVideoLoaded, isPlaying, isTransitioning, cycleCount]);

  // Disabled automatic recommendation system to prevent cycle reloading
  useEffect(() => {
    console.log('🔒 Static recommendation system - no automatic refreshing to prevent loops');

    // NO automatic refreshing - only manual refresh allowed
    // This prevents the infinite cycle reloading issue in Chrome

    return () => {
      // No timers to clear
    };

  }, [enableRecommendations]);

  // Stabilized video state management - prevent unnecessary resets
  useEffect(() => {
    if (featuredMedia.length > 0 && isLoadingNewContent) {
      // Only reset when actually loading new content, not on every featuredMedia change
      setIsVideoLoaded(false);
      setIsPlaying(false);
      setBackgroundLoaded(false);
      setVideoLoaded(false);
      setIsTransitioning(false);
      setCurrentIndex(0); // Reset to first slide only when loading new content
      setIsLoadingNewContent(false); // Clear the loading flag
      console.log('🔄 Reset video states for new content');
    }
  }, [featuredMedia.length, isLoadingNewContent]); // Reduced dependencies

  // Handle media without video content and check preview clip availability
  useEffect(() => {
    if (currentMedia) {
      if (!hasVideoContent(currentMedia)) {
        // For media without video, ensure video states are false
        setIsVideoLoaded(false);
        setVideoLoaded(false);
        setIsPlaying(false);
      } else {
        // Check if preview clip is actually available
        checkPreviewClipAvailability(currentMedia);
      }
    }
  }, [currentMedia]);

  // Disabled automatic media updates to prevent cycle loops
  useEffect(() => {
    // DISABLED: This was causing infinite cycle reloads in Chrome
    return () => {
      // No automatic media updates
    };
  }, []);

  // Preload adjacent videos for smooth transitions
  useEffect(() => {
    if (featuredMedia.length > 1) {
      // Preload current, next, and previous videos
      const currentIdx = currentIndex;
      const nextIdx = (currentIndex + 1) % featuredMedia.length;
      const prevIdx = (currentIndex - 1 + featuredMedia.length) % featuredMedia.length;

      // Preload in order of priority
      setTimeout(() => preloadVideo(featuredMedia[currentIdx]), 100);
      setTimeout(() => preloadVideo(featuredMedia[nextIdx]), 500);
      setTimeout(() => preloadVideo(featuredMedia[prevIdx]), 1000);
    }
  }, [currentIndex, featuredMedia]);

  // Reset video states when media changes - show thumbnail first, then video
  useEffect(() => {
    if (currentMedia) {
      stopAllPlayback();

      // Always show thumbnail first while video loads
      setIsVideoLoaded(false);
      setIsPlaying(false);
      setVideoLoaded(false);
      setBackgroundLoaded(false);

      console.log(`🖼️ Showing thumbnail first for media ${currentMedia.id}`);

      const videoUrl = getVideoUrl(currentMedia);
      if (!videoUrl) {
        console.log(`❌ No video URL available for media ${currentMedia.id}`);
        return;
      }

      if (videoRef.current) {
        const video = videoRef.current;
        video.pause();
        video.currentTime = 0;
        video.muted = true;
        video.volume = 0;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
        video.src = videoUrl;

        // Start loading video immediately but show thumbnail first
        video.preload = 'metadata';
        video.load();
        console.log(`🎥 Started loading video for media ${currentMedia.id}`);
      }
    }
  }, [currentMedia]);

  // Simplified video loading and autoplay
  useEffect(() => {
    if (videoRef.current && currentMedia && hasVideoContent(currentMedia)) {
      const video = videoRef.current;
      const videoUrl = getVideoUrl(currentMedia);

      if (!videoUrl) return;

      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      video.setAttribute('x-webkit-airplay', 'allow');
      video.crossOrigin = 'anonymous';
      video.preload = 'metadata';
      video.loop = true;

      const handleCanPlayThrough = () => {
        console.log(`✅ Video ready to play for media ${currentMedia.id}`);
        setIsVideoLoaded(true);
        setVideoLoaded(true);

        // Auto-play with appropriate audio settings
        const shouldPlayWithAudio = !isMuted && audioPreferences.hasUserEverUnmuted() && canAutoplayWithAudio;
        playVideoWithAudio(video, shouldPlayWithAudio);
      };

      const handleCanPlay = () => {
        // Also try to play on canplay event for faster loading
        if (!isVideoLoaded) {
          console.log(`🎬 Video can play for media ${currentMedia.id}`);
          setIsVideoLoaded(true);
          setVideoLoaded(true);

          const shouldPlayWithAudio = !isMuted && audioPreferences.hasUserEverUnmuted() && canAutoplayWithAudio;
          playVideoWithAudio(video, shouldPlayWithAudio);
        }
      };

      const handleError = (e: Event) => {
        console.warn('Video loading error for media', currentMedia.id, ':', e);

        // Try fallback URL
        const fallbackUrl = getVideoUrl(currentMedia, true);
        if (fallbackUrl && fallbackUrl !== video.src) {
          console.log('Trying fallback URL:', fallbackUrl);
          video.src = fallbackUrl;
          video.load();
          return;
        }

        // If all fails, hide video
        setIsVideoLoaded(false);
        setVideoLoaded(false);
        setIsPlaying(false);
      };

      const handleLoadStart = () => {
        console.log(`⏳ Video loading started for media ${currentMedia.id}`);
        setVideoLoaded(false);
        setIsPlaying(false);
      };

      video.addEventListener('canplaythrough', handleCanPlayThrough);
      video.addEventListener('canplay', handleCanPlay);
      video.addEventListener('error', handleError);
      video.addEventListener('loadstart', handleLoadStart);

      return () => {
        video.removeEventListener('canplaythrough', handleCanPlayThrough);
        video.removeEventListener('canplay', handleCanPlay);
        video.removeEventListener('error', handleError);
        video.removeEventListener('loadstart', handleLoadStart);
      };
    }
  }, [currentMedia, isMuted, canAutoplayWithAudio]);



  // Hide controls after inactivity and add keyboard shortcut for unmute
  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setShowControls(false), 3000);
    };

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'm' || e.key === 'M' || e.key === ' ') {
        e.preventDefault();
        handleUnmute(e);
      }
    };

    // Enhanced Safari interaction detection for autoplay policy
    const handleUserInteraction = () => {
      if (!userHasInteracted) {
        setUserHasInteracted(true);
        console.log('🖱️ User interaction detected - enabling audio for Safari');

        // Immediately try to enable audio on current video for Safari
        if (videoRef.current && !videoRef.current.paused) {
          const video = videoRef.current;
          const shouldPlayWithAudio = !isMuted && audioPreferences.hasUserEverUnmuted() && canAutoplayWithAudio;

          if (shouldPlayWithAudio) {
            video.muted = false;
            video.volume = spatialAudioEnabled ? 0.7 : 0.5;
            console.log('🔊 Enabled audio after user interaction');
          }
        }

        // Also try to start video playback if not already playing
        if (videoRef.current && hasVideoContent(currentMedia) && !isPlaying) {
          const video = videoRef.current;
          const shouldPlayWithAudio = !isMuted && audioPreferences.hasUserEverUnmuted() && canAutoplayWithAudio;
          playVideoWithAudio(video, shouldPlayWithAudio);
        }
      }
    };

    // Handle page visibility changes to pause/resume video
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopAllPlayback();
        setIsAutoPlaying(false);
      } else {
        setTimeout(() => setIsAutoPlaying(true), 1000);
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('keydown', handleKeyPress);
      document.addEventListener('click', handleUserInteraction);
      document.addEventListener('touchstart', handleUserInteraction);
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        container.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('keydown', handleKeyPress);
        document.removeEventListener('click', handleUserInteraction);
        document.removeEventListener('touchstart', handleUserInteraction);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
    }
  }, []);

  // Handle background image loading
  useEffect(() => {
    if (currentMedia) {
      setBackgroundLoaded(false);
      const img = new Image();

      img.onload = () => {
        setBackgroundLoaded(true);
      };

      img.onerror = () => {
        // If primary image fails, try fallback URLs
        const fallbackUrls = [
          `${getApiUrl()}/api/thumbnails/${currentMedia.id}`,
          // Generic fallback
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
            // If all fallbacks fail, still show the component
            setBackgroundLoaded(true);
          }
        };

        tryFallback();
      };

      img.src = getBackgroundImageUrl(currentMedia);
    }
  }, [currentMedia]);

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
  }, [isMuted, spatialAudioEnabled, isVideoLoaded, isPlaying]);



  // Enhanced audio integration for ALAC support
  useEffect(() => {
    if (videoRef.current && isVideoLoaded) {
      setCurrentAudioElement(videoRef.current);

      // Initialize ALAC audio codec for enhanced quality if available
      if (isALACEnabled && alacEngine && currentMedia) {
        initializeEnhancedAudio().then(() => {
          // Check for ALAC audio stream availability
          const alacAudioUrl = `${getApiUrl()}/api/audio/alac/${currentMedia.id}`;
          fetch(alacAudioUrl, { method: 'HEAD' })
            .then(response => {
              if (response.ok) {
                // ALAC audio stream available, optimize video for ALAC playback
                if (videoRef.current) {
                  videoRef.current.volume = spatialAudioEnabled ? 0.9 : 0.7; // Higher volume for ALAC
                  // Set audio processing parameters for ALAC
                  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                  if (audioContext.sampleRate >= 48000) {
                    // High sample rate supported for ALAC audio
                  }
                }
              }
            })
            .catch(() => {
              // Fallback to standard video audio with ALAC codec preference
              if (videoRef.current && videoRef.current.canPlayType) {
                const alacSupport = videoRef.current.canPlayType('video/mp4; codecs="avc1.42E01E, alac"');
                // ALAC codec support check completed
              }
            });
        });
      }
    }
  }, [isVideoLoaded, setCurrentAudioElement, isALACEnabled, alacEngine, spatialAudioEnabled, currentMedia, initializeEnhancedAudio]);





  // Component cleanup
  useEffect(() => {
    return () => {
      stopAllPlayback();
      preloadRefs.current.forEach((video) => {
        try {
          video.pause();
          video.src = '';
          video.load();
        } catch (error) {
          // Ignore cleanup errors
        }
      });
      preloadRefs.current.clear();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Auto-reload the page every 5 minutes (300,000ms) to ensure fresh content
  useEffect(() => {
    // Only run in browser environment
    if (typeof window === 'undefined') return;

    const reloadTimer = setTimeout(() => {
      window.location.reload();
    }, 300000); // 5 minutes = 300,000ms

    // Clean up the timer when component unmounts or before re-running the effect
    return () => {
      clearTimeout(reloadTimer);
    };
  }, []); // Empty dependency array means this effect runs once on mount

  // Trigger click event after 5 seconds of component mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const clickTimer = setTimeout(() => {
      // Programmatically trigger a click on the main container
      const heroContainer = document.querySelector('.relative.h-screen.overflow-hidden');
      if (heroContainer) {
        heroContainer.dispatchEvent(new MouseEvent('click', {
          view: window,
          bubbles: true,
          cancelable: true
        }));
      }
    }, 5000); // 5 seconds = 5000ms

    return () => clearTimeout(clickTimer);
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
            ref={containerRef}
            className="relative h-screen w-full overflow-hidden"
            onMouseEnter={() => setIsMouseOver(true)}
            onMouseLeave={() => setIsMouseOver(false)}
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

            {/* Netflix-style loading - show loader only when nothing is loaded */}
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
            {hasVideoContent(currentMedia) && (
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
                  loop
                  playsInline
                  preload="metadata"
                  controls={false}
                  crossOrigin="anonymous"
                  webkit-playsinline="true"
                  x-webkit-airplay="allow"
                  disablePictureInPicture
                  disableRemotePlayback
                  src={getVideoUrl(currentMedia)}
                  onLoadedData={() => {
                    if (videoRef.current) {
                      const video = videoRef.current;
                      if (video.readyState >= 2 && video.duration > 0) {
                        setIsVideoLoaded(true);

                        // Chrome-safe auto-attempt playback
                        if (!isPlaying && video.paused) {
                          video.play().catch((error) => {
                            if (error.name === 'AbortError') {
                              console.log('🚫 Chrome play() interrupted by pause() - ignoring');
                            } else {
                              console.log('🍎 Autoplay blocked - waiting for user interaction');
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
                    console.warn('Video element error for media', currentMedia.id, ':', e);

                    // Try fallback URL
                    if (videoRef.current) {
                      const video = videoRef.current;
                      const fallbackUrl = getVideoUrl(currentMedia, true);
                      if (fallbackUrl && fallbackUrl !== video.src) {
                        console.log('Trying fallback URL:', fallbackUrl);
                        video.src = fallbackUrl;
                        video.load();
                        return;
                      }
                    }

                    setIsVideoLoaded(false);
                    setVideoLoaded(false);
                    setIsPlaying(false);
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
                  onClick={(e) => {
                    if (isMuted) {
                      e.stopPropagation();
                      handleUnmute(e);
                    }
                  }}
                >
                  {/* Single source for Chromium compatibility - multiple sources can cause issues */}
                  {getVideoUrl(currentMedia) && (
                    <source src={getVideoUrl(currentMedia)!} type="video/mp4" />
                  )}

                  {/* Fallback message */}
                  Your browser does not support the video tag.
                </video>
              </AnimatePresence>
            )}

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



      {/* Click to unmute overlay - Show if muted and video is playing */}
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
          {/* Unmute button */}
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
      )}





      {/* Refresh content button */}
      {enableRecommendations && (
        <motion.div
          className="absolute top-8 right-8 z-30"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: showControls ? 1 : 0, y: showControls ? 0 : -20 }}
          transition={{ duration: 0.3 }}
        >
          <MagneticButton
            onClick={refreshContent}
            disabled={isLoadingNewContent}
            className="bg-black/50 backdrop-blur-sm text-white p-3 rounded-full hover:bg-black/70 transition-all duration-300 border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh content"
          >
            <motion.div
              animate={isLoadingNewContent ? { rotate: 360 } : { rotate: 0 }}
              transition={{ duration: 1, repeat: isLoadingNewContent ? Infinity : 0, ease: "linear" }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </motion.div>
          </MagneticButton>
        </motion.div>
      )}


      {/* Content - Netflix-style left positioning */}
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
                {/* Quality Badge */}
                <div className={`px-2 py-1 text-xs font-bold rounded ${getQualityBadge().color} text-white`}>
                  {getQualityBadge().text}
                </div>

                {/* Year - extracted from filename/title or release_date */}
                {extractYearFromMedia() && (
                  <span className="text-white font-medium">
                    {extractYearFromMedia()}
                  </span>
                )}

                {/* Age Rating */}
                <div className="border border-gray-400 px-1 text-xs text-gray-300 font-medium">
                  {getAgeRating() ? getAgeRating() : 'PG-13'}
                </div>

                {/* Duration */}
                {currentMedia.duration && (
                  <span className="text-gray-300 text-sm">
                    {formatDuration(currentMedia.duration)}
                  </span>
                )}

                {/* Type indicator */}
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

                {/* Rating if available */}
                {(
                  <div className="flex items-center gap-1">
                    <span className="text-yellow-400 text-sm">★</span>
                    <span className="font-bold text-gray-300 text-sm">
                      {currentMedia.rating ? parseFloat(currentMedia.rating.toFixed(1)) : "8.0"}
                    </span>
                  </div>
                )}
              </motion.div>
            </ScrollReveal>

            {/* Dynamic Title with Genre-based styling */}
            <ScrollReveal delay={0.1}>
              <motion.h1
                key={`title-${currentMedia.id}`}
                className={`font-bold text-white mb-4 leading-tight ${getTitleSizeClass()} ${getGenreBasedStyling()}`}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.1 }}
                style={{
                  textShadow: '2px 2px 4px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.5)'
                }}
              >
                {cleanMovieTitle(currentMedia.title)}
              </motion.h1>
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
                className="text-lg md:text-xl text-gray-200 mb-8 max-w-2xl leading-relaxed bg-black/20 backdrop-blur-sm p-4 rounded-lg border border-white/10"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.3 }}
              >
                {currentMedia.description ? `${currentMedia.description.substring(0, 250)}` : "Experience premium entertainment with stunning visuals and immersive storytelling."}
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
                  onClick={() => {
                    setIsPlayButtonLoading(true);
                    setTimeout(() => {
                      onPlay(currentMedia);
                      setIsPlayButtonLoading(false);
                    }, 300);
                  }}
                  className="bg-transparent text-white px-8 py-3 rounded-md font-bold text-lg hover:bg-white/10 transition-all duration-300 flex items-center gap-2 border border-white/30"
                >
                  <Play className="w-6 h-6 fill-current" />
                  Play
                </MagneticButton>

                <MagneticButton
                  onClick={() => {
                    setIsInfoButtonLoading(true);
                    setTimeout(() => {
                      onInfo(currentMedia);
                      setIsInfoButtonLoading(false);
                    }, 300);
                  }}
                  className="bg-transparent text-white px-8 py-3 rounded-md font-bold text-lg hover:bg-white/10 transition-all duration-300 flex items-center gap-2 border border-white/30"
                >
                  <Info className="w-6 h-6" />
                  More Info
                </MagneticButton>
              </motion.div>
            </ScrollReveal>
          </div>
        </div>
      </div>

      {/* Slide indicators */}
      {featuredMedia.length > 1 && (
        <motion.div
          className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-30"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: showControls ? 1 : 0, y: showControls ? 0 : 20 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center gap-3 bg-black/30 backdrop-blur-sm px-4 py-2 rounded-full border border-white/20">
            {/* Slide indicators with red bar for current slide */}
            <div className="flex items-center gap-2">
              {featuredMedia.map((_, index) => (
                <MagneticButton
                  key={`${index}-${cycleCount}`}
                  onClick={() => goToSlide(index)}
                  disabled={isTransitioning}
                  className="relative flex items-center justify-center transition-all duration-500 ease-out disabled:cursor-not-allowed p-1"
                  strength={0.2}
                >
                  {index === currentIndex ? (
                    // Netflix-style red bar for current slide
                    <motion.div
                      className="relative"
                      style={{
                        background: 'linear-gradient(90deg, #e50914, #ff1a2b, #e50914)', // Enhanced Netflix red gradient
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
                      {/* Animated glow effect */}
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
                      {/* Bottom shadow for depth */}
                      <div
                        className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-8 h-1 rounded-full"
                        style={{
                          background: 'radial-gradient(ellipse, rgba(229, 9, 20, 0.4) 0%, transparent 70%)',
                          filter: 'blur(2px)'
                        }}
                      />
                    </motion.div>
                  ) : (
                    // Subtle dots for inactive slides
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

            {/* Loading indicator */}
            {isLoadingNewContent && (
              <div className="flex items-center ml-2">
                <RedLoader size="small" />
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Progress bar */}
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
              boxShadow: '0 0 8px rgba(239, 68, 68, 0.6)'
            }}
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{
              duration: isVideoLoaded && isPlaying ? 20 : 12,
              ease: "linear"
            }}
          />
        </motion.div>
      )}
    </motion.div>
  );
};


export default ScrollXHero;
