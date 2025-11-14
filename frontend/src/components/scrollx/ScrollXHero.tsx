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
  const performanceMetrics = useRef({
    renderCount: 0,
    lastRenderTime: Date.now(),
    memoryUsage: 0,
    slideCount: 0,
    startTime: Date.now()
  });

  // 24/7 BROWSER DETECTION AND OPTIMIZATION
  const browserOptimizations = useMemo(() => {
    if (typeof window === 'undefined') return { name: 'server', optimizations: {} };

    const userAgent = navigator.userAgent;
    const isChrome = /Chrome/.test(userAgent) && !/Edge/.test(userAgent);
    const isFirefox = /Firefox/.test(userAgent);
    const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);
    const isEdge = /Edge/.test(userAgent);

    return {
      name: isChrome ? 'chrome' : isFirefox ? 'firefox' : isSafari ? 'safari' : isEdge ? 'edge' : 'unknown',
      optimizations: {
        // Chrome: Aggressive memory management
        memoryCleanupInterval: isChrome ? 90000 : 120000, // 1.5min vs 2min
        videoBufferClear: isChrome,
        forceGC: isChrome,
        // Firefox: Reduced DOM manipulation
        reducedAnimations: isFirefox,
        // Safari: Conservative resource usage
        conservativeMode: isSafari,
        // Edge: Balanced approach
        balancedMode: isEdge
      }
    };
  }, []);

  // 24/7 PERFORMANCE MONITORING
  // const monitor24x7Performance = useCallback(() => {
  //   const metrics = performanceMetrics.current;
  //   metrics.slideCount++;

  //   // Log performance stats every 100 slides
  //   if (metrics.slideCount % 100 === 0) {
  //     const uptime = Date.now() - metrics.startTime;
  //     const uptimeHours = (uptime / (1000 * 60 * 60)).toFixed(2);

  //     console.log(`📊 24/7 Performance Stats (${browserOptimizations.name}):`);
  //     console.log(`  ⏱️ Uptime: ${uptimeHours} hours`);
  //     console.log(`  🎥 Slides shown: ${metrics.slideCount}`);
  //     console.log(`  💾 URL cache size: ${urlCache.current.size}`);
  //     console.log(`  🎦 Video elements: ${preloadRefs.current.size}`);

  //     // Memory usage estimation
  //     if ('memory' in performance) {
  //       const memory = (performance as any).memory;
  //       console.log(`  🧠 Memory: ${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`);

  //       // Browser-specific memory warnings
  //       const memoryMB = memory.usedJSHeapSize / 1024 / 1024;
  //       if (memoryMB > 200) {
  //         console.warn(`⚠️ High memory usage detected: ${memoryMB.toFixed(2)}MB`);
  //         // Note: Cleanup will be triggered by health check system
  //       }
  //     }
  //   }
  // }, [browserOptimizations.name]);

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
      }
    } catch (error) {
      setCanAutoplayWithAudio(false);
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

  // Add API response to history with size limit to prevent memory leaks
  const addApiResponseToHistory = (media: Media[]) => {
    const responseSignature = media.map(m => m.id).sort().join(',');
    setPreviousApiResponses(prev => {
      const newSet = new Set([...prev, responseSignature]);
      // Limit to last 20 responses to prevent memory buildup
      if (newSet.size > 20) {
        const array = Array.from(newSet);
        return new Set(array.slice(-20));
      }
      return newSet;
    });
  };

  // 24/7 BROWSER-OPTIMIZED MEMORY CLEANUP: Tailored for continuous operation
  const cleanupMemory = useCallback(() => {
    const now = Date.now();
    const opts = browserOptimizations.optimizations;

    // Browser-specific cleanup intervals
    const cleanupInterval = opts.memoryCleanupInterval || 120000;
    if (now - lastCleanupTime.current < cleanupInterval) return;

    // BROWSER-SPECIFIC URL CACHE CLEANUP
    const maxCacheSize = opts.conservativeMode ? 20 : 30;
    const keepSize = opts.conservativeMode ? 10 : 15;

    if (urlCache.current.size > maxCacheSize) {
      const entries = Array.from(urlCache.current.entries());
      urlCache.current.clear();
      entries.slice(-keepSize).forEach(([key, value]) => {
        urlCache.current.set(key, value);
      });
    }

    // AGGRESSIVE VIDEO ELEMENT CLEANUP
    const currentId = currentMedia?.id?.toString();
    const keepIds = new Set([currentId].filter(Boolean));

    preloadRefs.current.forEach((video, id) => {
      if (!keepIds.has(id)) {
        try {
          video.pause();
          video.src = '';
          video.load();

          // Chrome-specific: Force DOM removal
          if (opts.videoBufferClear) {
            video.remove();
          }
        } catch (error) {
          // Ignore cleanup errors
        }
        preloadRefs.current.delete(id);
      }
    });

    // BROWSER-SPECIFIC API RESPONSE CLEANUP
    const maxResponses = opts.conservativeMode ? 5 : 10;
    const keepResponses = opts.conservativeMode ? 3 : 5;

    setPreviousApiResponses(prev => {
      if (prev.size > maxResponses) {
        const array = Array.from(prev);
        return new Set(array.slice(-keepResponses));
      }
      return prev;
    });

    // BROWSER-SPECIFIC GARBAGE COLLECTION
    if (opts.forceGC && typeof window !== 'undefined' && 'gc' in window) {
      try {
        (window as any).gc();
      } catch (e) {
        // Ignore if not available
      }
    }

    lastCleanupTime.current = now;
  }, [currentMedia, browserOptimizations]);

  // Update performance monitoring to use cleanupMemory
  // useEffect(() => {
  //   const originalMonitor = monitor24x7Performance;
  //   return () => {};
  // }, []);

  // 24/7 HEALTH CHECK SYSTEM
  // useEffect(() => {
  //   const healthCheckInterval = setInterval(() => {
  //     const metrics = performanceMetrics.current;
  //     const uptime = Date.now() - metrics.startTime;

  //     // Health check every hour
  //     if (uptime % (60 * 60 * 1000) < 10000) { // Within 10 seconds of each hour
  //       console.log('👨‍⚕️ 24/7 Health Check:');
  //       console.log(`  ✅ System running for ${(uptime / (1000 * 60 * 60)).toFixed(2)} hours`);
  //       console.log(`  ✅ ${metrics.slideCount} slides displayed`);
  //       console.log(`  ✅ Browser: ${browserOptimizations.name}`);

  //       // Auto-cleanup if memory is high
  //       if ('memory' in performance) {
  //         const memory = (performance as any).memory;
  //         const memoryMB = memory.usedJSHeapSize / 1024 / 1024;
  //         if (memoryMB > 150) {
  //           console.log('👨‍⚕️ Triggering health cleanup due to high memory');
  //           cleanupMemory();
  //         }
  //       }
  //     }
  //   }, 10000); // Check every 10 seconds

  //   return () => clearInterval(healthCheckInterval);
  // }, [browserOptimizations.name, cleanupMemory]);

  // Enhanced frontend recommendation system with latest movies and priority genre focus
  const generateFrontendRecommendations = (availableMedia: Media[], currentFeatured: Media[]): Media[] => {

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

    return shuffleArray(recommendations).slice(0, 10);
  };

  // Enhanced recommendation system with guaranteed unique content every load
  const fetchRecommendedMedia = async (cycleNumber: number = 0) => {
    setIsLoadingNewContent(true);

    try {
      // ALWAYS try backend recommendations first for guaranteed uniqueness
      let newMedia: Media[] = [];

      try {
        // Use the available recommendation API endpoints with proper cycling
        const apiUrl = getApiUrl();

        // Available recommendation endpoints from backend routes
        const recommendationEndpoints = [
          `${apiUrl}/api/recommendations/mixed?limit=25`,
          `${apiUrl}/api/recommendations/trending?limit=25`,
          `${apiUrl}/api/recommendations/popular?limit=25`,
          `${apiUrl}/api/recommendations/recent?limit=25`,
          `${apiUrl}/api/recommendations/personalized?limit=25`,
          `${apiUrl}/api/recommendations/unique?limit=25`,
          `${apiUrl}/api/recommendations/top-rated?limit=25`,
          `${apiUrl}/api/recommendations/genre?limit=25`
        ];

        // Use timestamp-based randomization to ensure different endpoints each time
        const timestamp = Date.now();
        const randomOffset = Math.floor(Math.random() * recommendationEndpoints.length);
        const endpointIndex = (cycleNumber + randomOffset + Math.floor(timestamp / 10000)) % recommendationEndpoints.length;
        const currentEndpoint = recommendationEndpoints[endpointIndex];
        const endpointName = currentEndpoint.split('/').pop()?.split('?')[0] || 'unknown';


        // Call the specific recommendation endpoint with session and cache-busting in URL only
        const cacheBustingUrl = `${currentEndpoint}&_t=${timestamp}&_r=${randomOffset}&_session=hero-${timestamp}-${cycleNumber}-${randomOffset}`;
        const response = await fetch(cacheBustingUrl, {
          method: 'GET'
          // No custom headers to avoid CORS issues
        });

        if (response.ok) {
          newMedia = await response.json();
        } else {

          // Try randomized fallback endpoints if primary fails
          const shuffledEndpoints = [...recommendationEndpoints].sort(() => Math.random() - 0.5);
          const fallbackEndpoints = shuffledEndpoints.filter((_, index) => index !== endpointIndex).slice(0, 2);

          for (const fallbackEndpoint of fallbackEndpoints) {
            try {
              const fallbackName = fallbackEndpoint.split('/').pop()?.split('?')[0] || 'fallback';
              const fallbackTimestamp = Date.now();

              const fallbackCacheBustingUrl = `${fallbackEndpoint}&_t=${fallbackTimestamp}&_r=${Math.random()}&_session=hero-fallback-${fallbackTimestamp}-${cycleNumber}`;
              const fallbackResponse = await fetch(fallbackCacheBustingUrl, {
                method: 'GET'
                // No custom headers to avoid CORS issues
              });

              if (fallbackResponse.ok) {
                newMedia = await fallbackResponse.json();
                break;
              }
            } catch (fallbackError) {
              continue;
            }
          }

          if (newMedia.length === 0) {
            newMedia = [];
          }
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
            return media.type === 'episode' ||
              media.type === 'tv' ||
              media.type === 'series';
          });
        }

        if (newMedia.length >= 5) {
          // Add additional randomization based on time and cycle
          const timeBasedShuffle = shuffleArray(newMedia);
          setFeaturedMedia(timeBasedShuffle.slice(0, 10));

          // Preload assets for instant display
          const { preloadAssets } = await import('@/lib/api');
          preloadAssets(timeBasedShuffle.slice(0, 10), ['thumbnail', 'preview']);

          return;
        }
      } catch (error) {
      }

      // Enhanced frontend fallback with proper media handling (no fake IDs)
      if (initialFeaturedMedia.length > 0) {

        // Use only real media items - no fake ID generation to prevent 404 errors
        const validMedia = initialFeaturedMedia.filter(item => item && item.id && typeof item.id === 'number');

        if (validMedia.length === 0) {
          return;
        }

        // Create variety through different shuffling algorithms with timestamp-based randomization
        const timestamp = Date.now();
        const randomSeed = Math.floor(Math.random() * 1000) + timestamp;
        const algorithmIndex = (cycleNumber + Math.floor(randomSeed / 1000)) % 5; // Increased to 5 algorithms
        let shuffledMedia: Media[] = [];


        if (algorithmIndex === 0) {
          // Algorithm 1: Random shuffle with timestamp-based seed
          shuffledMedia = validMedia.sort(() => Math.sin(randomSeed + Math.random()) - 0.5);
        } else if (algorithmIndex === 1) {
          // Algorithm 2: Sort by rating then randomize
          const ratedMedia = validMedia.sort((a, b) => (b.rating || 0) - (a.rating || 0));
          shuffledMedia = ratedMedia.sort(() => Math.sin(randomSeed * 2 + Math.random()) - 0.5);
        } else if (algorithmIndex === 2) {
          // Algorithm 3: Sort by ID (newest first) then randomize
          const newestMedia = validMedia.sort((a, b) => b.id - a.id);
          shuffledMedia = newestMedia.sort(() => Math.sin(randomSeed * 3 + Math.random()) - 0.5);
        } else if (algorithmIndex === 3) {
          // Algorithm 4: Genre-based randomization
          const genreGroups = validMedia.reduce((acc, media) => {
            const genre = media.genres?.[0]?.name || 'Unknown';
            if (!acc[genre]) acc[genre] = [];
            acc[genre].push(media);
            return acc;
          }, {} as Record<string, Media[]>);

          shuffledMedia = Object.values(genreGroups)
            .flat()
            .sort(() => Math.sin(randomSeed * 4 + Math.random()) - 0.5);
        } else {
          // Algorithm 5: Reverse chronological with random offset
          const offset = Math.floor(Math.random() * validMedia.length);
          shuffledMedia = [...validMedia.slice(offset), ...validMedia.slice(0, offset)]
            .sort(() => Math.sin(randomSeed * 5 + Math.random()) - 0.5);
        }

        // Ensure we get different content by filtering out current items first
        const availableMedia = shuffledMedia.filter(item =>
          !featuredMedia.some(current => current.id === item.id)
        );

        // If not enough different items, use all shuffled media
        const newFeaturedMedia = availableMedia.length >= 5
          ? availableMedia.slice(0, 10)
          : shuffledMedia.slice(0, 10);

        // If we don't have enough different items, supplement with shuffled existing
        if (newFeaturedMedia.length < 5) {
          const supplemental = shuffleArray(validMedia).slice(0, 10 - newFeaturedMedia.length);
          newFeaturedMedia.push(...supplemental);
        }

        setFeaturedMedia(newFeaturedMedia.slice(0, 10));
      } else if (allAvailableMedia.length > 0) {
        // Fallback to cached media with cycle-based shuffling
        const cycleBasedRecs = generateFrontendRecommendations(allAvailableMedia, featuredMedia);
        setFeaturedMedia(cycleBasedRecs);
      } else {
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

  // ZERO-LATENCY URL GENERATION: Aggressive caching with no cache-busting
  const getVideoUrl = useCallback((media: Media, fallback: boolean = false): string | undefined => {
    if (!media?.id || typeof media.id !== 'number' || media.id <= 0) {
      return undefined;
    }

    // Generate cache key for URL caching
    const cacheKey = `video_${media.id}_${fallback ? 'low' : 'high'}`;

    // Check URL cache first for instant response
    if (urlCache.current.has(cacheKey)) {
      return urlCache.current.get(cacheKey);
    }

    const apiUrl = getApiUrl();
    // CRITICAL: NO cache-busting timestamps for L1 cache hits
    const url = fallback
      ? `${apiUrl}/api/preview-clips/${media.id}?quality=low&format=mp4`
      : `${apiUrl}/api/preview-clips/${media.id}?quality=high&format=mp4&cache=true`;

    // Cache the URL for instant future access
    urlCache.current.set(cacheKey, url);
    return url;
  }, []);

  // ZERO-LATENCY THUMBNAIL URLS: Aggressive caching with no validation overhead
  const getThumbnailUrl = useCallback((media: Media): string | undefined => {
    if (!media?.id || typeof media.id !== 'number' || media.id <= 0) {
      return undefined;
    }

    // Generate cache key for URL caching
    const cacheKey = `thumbnail_${media.id}`;

    // Check URL cache first for instant response
    if (urlCache.current.has(cacheKey)) {
      return urlCache.current.get(cacheKey);
    }

    const apiUrl = getApiUrl();
    // CRITICAL: NO cache-busting parameters for maximum cache efficiency
    const url = `${apiUrl}/api/thumbnails/${media.id}`;

    // Cache the URL for instant future access
    urlCache.current.set(cacheKey, url);
    return url;
  }, []);




  // Check if media has video content (preview clip or can generate one)
  const hasVideoContent = (media: Media) => {
    // Validate media ID before checking content
    if (!media?.id || typeof media.id !== 'number' || media.id <= 0) {
      return false;
    }
    // Check if we have a media ID and either a preview clip path or file path
    // The backend will serve preview clips if they exist, or generate them on-demand
    return !!(media.id && media.file_path);
  };

  // ELIMINATED AVAILABILITY CHECKS: Always assume assets exist for zero-latency
  const checkPreviewClipAvailability = useCallback(async (media: Media): Promise<boolean> => {
    // CRITICAL: Never make HEAD requests - always assume available
    // Backend handles 404s gracefully with automatic generation
    return true;
  }, []);

  // ELIMINATED PREVIEW GENERATION: Backend handles all generation automatically
  const generatePreviewClipIfNeeded = useCallback(async (media: Media) => {
    // CRITICAL: Never trigger generation from frontend
    // Backend automatically generates on first 404 request
    return;
  }, []);



  // ZERO-LATENCY BACKGROUND IMAGES: Prioritize TMDB backdrop, fallback to thumbnails
  const getBackgroundImageUrl = useCallback((media: Media): string => {
    if (!media?.id || typeof media.id !== 'number' || media.id <= 0) {
      // Return optimized placeholder for invalid media
      return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTkyMCIgaGVpZ2h0PSIxMDgwIiB2aWV3Qm94PSIwIDAgMTkyMCAxMDgwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxOTIwIiBoZWlnaHQ9IjEwODAiIGZpbGw9IiMxMTEiLz48dGV4dCB4PSI5NjAiIHk9IjU0MCIgZmlsbD0iIzY2NiIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjQ4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5Mb2FkaW5nLi4uPC90ZXh0Pjwvc3ZnPg==';
    }

    // Generate cache key for background URL
    const cacheKey = `background_${media.id}`;

    // Check URL cache first for instant response
    if (urlCache.current.has(cacheKey)) {
      return urlCache.current.get(cacheKey)!;
    }

    let url: string;

    // PRIORITY 1: Use TMDB backdrop URL if available
    if (media.tmdb_backdrop_url && media.tmdb_backdrop_url.trim() !== '') {
      url = media.tmdb_backdrop_url;
    } else {
      // FALLBACK: Use thumbnail endpoint for maximum reliability and caching
      const apiUrl = getApiUrl();
      url = `${apiUrl}/api/thumbnails/${media.id}`;
    }

    // Cache the URL for instant future access
    urlCache.current.set(cacheKey, url);
    return url;
  }, []);


  // Chrome-safe stop all video/audio playback
  const stopAllPlayback = () => {
    // Prevent Chrome race conditions by checking state before pause
    if (videoRef.current && !videoRef.current.paused) {
      try {
        videoRef.current.pause();
      } catch (error) {
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

        // 24/7 PERFORMANCE MONITORING
        //monitor24x7Performance();
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
    return null;
  }, []);

  // Simplified - no preloading, direct video element usage
  const getPreloadedVideo = useCallback((media: Media) => {
    // Skip preloading - create video element on-demand for instant playback
    return null;
  }, []);

  // Enhanced video playback with Chrome race condition prevention
  const playVideoWithAudio = useCallback(async (video: HTMLVideoElement, withAudio: boolean = true) => {
    if (!video || isLoadingRef.current) return false;

    try {
      const currentMediaId = currentMediaRef.current?.id?.toString();

      // Basic validation - less strict to allow playback
      if (!currentMediaId) {
        return false;
      }

      // Prevent Chrome race conditions by ensuring video is not in conflicting state
      if (!video.paused) {
        return true;
      }

      // Reset video state
      video.currentTime = 0;

      // Always start muted for maximum browser compatibility
      video.muted = true;
      video.volume = 0;


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
              }
            }

            return true;
          } else {
            return false;
          }
        }
      } catch (playError) {
        // Don't throw, just return false to allow fallback
        return false;
      }
    } catch (error) {

      // Fallback: ensure muted playback
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

        playVideoWithAudio(video, shouldPlayWithAudio);
      } else {
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

  // Optimized preloading - minimal to prevent memory accumulation
  useEffect(() => {
    if (!isInitialized || featuredMedia.length <= 1) return;

    // Cleanup old preloaded videos first
    cleanupMemory();

    // Skip preloading - rely on backend L1 cache for instant playback
  }, [currentIndex, featuredMedia, cleanupMemory]);

  // Smart auto-slide functionality with fresh content loading
  useEffect(() => {
    if (!isAutoPlaying || featuredMedia.length <= 1 || isTransitioning) return;

    // Fixed 30-second slide duration for all slides
    const slideDuration = 30000; // 30 seconds for all slides

    const interval = setInterval(() => {
      if (!isTransitioning) {
        // Check if we're at the last slide
        const nextIndex = (currentIndex + 1) % featuredMedia.length;
        if (nextIndex === 0 && currentIndex === featuredMedia.length - 1) {
          // At the end of cycle - fetch fresh content and restart

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
            }, 1000);
          }).catch((error) => {
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

  // Enhanced recommendation cycling system with API endpoint rotation and memory management
  useEffect(() => {
    if (!enableRecommendations) {
      return;
    }

    // Clear any existing timer to prevent multiple timers
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }


    // Initial fetch on mount
    if (featuredMedia.length === 0 || !hasInitializedContent) {
      fetchRecommendedMedia(0);
    }

    // Set up interval to cycle through different recommendation endpoints
    refreshTimerRef.current = setInterval(() => {
      const newCycleCount = cycleCount + 1;
      setCycleCount(newCycleCount);

      // Perform memory cleanup every few cycles
      if (newCycleCount % 3 === 0) {
        cleanupMemory();
      }

      fetchRecommendedMedia(newCycleCount);
    }, refreshInterval);

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };

  }, [enableRecommendations, refreshInterval]); // Removed cycleCount dependency to prevent timer recreation

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

  // Optimized - skip preloading to prevent memory accumulation
  useEffect(() => {
    if (featuredMedia.length > 1) {
      // Skip preloading - rely on backend L1 cache for instant playback

      // Perform memory cleanup instead
      cleanupMemory();
    }
  }, [currentIndex, featuredMedia, cleanupMemory]);

  // Reset video states when media changes - show thumbnail first, then video
  useEffect(() => {
    if (currentMedia) {
      stopAllPlayback();

      // Always show thumbnail first while video loads
      setIsVideoLoaded(false);
      setIsPlaying(false);
      setVideoLoaded(false);
      setBackgroundLoaded(false);


      const videoUrl = getVideoUrl(currentMedia);
      if (!videoUrl) {
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
        setIsVideoLoaded(true);
        setVideoLoaded(true);

        // Auto-play with appropriate audio settings
        const shouldPlayWithAudio = !isMuted && audioPreferences.hasUserEverUnmuted() && canAutoplayWithAudio;
        playVideoWithAudio(video, shouldPlayWithAudio);
      };

      const handleCanPlay = () => {
        // Also try to play on canplay event for faster loading
        if (!isVideoLoaded) {
          setIsVideoLoaded(true);
          setVideoLoaded(true);

          const shouldPlayWithAudio = !isMuted && audioPreferences.hasUserEverUnmuted() && canAutoplayWithAudio;
          playVideoWithAudio(video, shouldPlayWithAudio);
        }
      };

      const handleError = (e: Event) => {

        // Try fallback URL
        const fallbackUrl = getVideoUrl(currentMedia, true);
        if (fallbackUrl && fallbackUrl !== video.src) {
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
      // Don't interfere when the user is typing into a form field or contenteditable
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        const isEditable = (target as HTMLElement).isContentEditable;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || isEditable) {
          return; // allow typing normally (spaces, 'm', etc.)
        }
      }

      if (e.key === 'm' || e.key === 'M' || e.key === ' ') {
        e.preventDefault();
        handleUnmute(e);
      }
    };

    // Enhanced Safari interaction detection for autoplay policy
    const handleUserInteraction = () => {
      if (!userHasInteracted) {
        setUserHasInteracted(true);

        // Immediately try to enable audio on current video for Safari
        if (videoRef.current && !videoRef.current.paused) {
          const video = videoRef.current;
          const shouldPlayWithAudio = !isMuted && audioPreferences.hasUserEverUnmuted() && canAutoplayWithAudio;

          if (shouldPlayWithAudio) {
            video.muted = false;
            video.volume = spatialAudioEnabled ? 0.7 : 0.5;
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





  // Enhanced component cleanup with comprehensive timer and memory management
  useEffect(() => {
    return () => {

      // Stop all video playback
      stopAllPlayback();

      // Clean up all preloaded videos
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

      // Clear all timers
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

      // Clear caches
      urlCache.current.clear();

    };
  }, []);

  // Auto-reload the page every 10 minutes (600,000ms) to ensure fresh content
  useEffect(() => {
    // Only run in browser environment
    if (typeof window === 'undefined') return;

    const reloadTimer = setTimeout(() => {
      window.location.reload();
    }, 600000); // 10 minutes = 600,000ms

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
    }, 10000); // 10 seconds = 10000ms

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
                  loop={true}
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

                    // Try fallback URL
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
                    // Let video loop naturally - no manual restart needed
                    // The video element has loop=true so it will repeat automatically

                    // 24/7 MEMORY OPTIMIZATION: Trigger cleanup every 2 minutes of video time (less frequent)
                    if (Math.floor(video.currentTime) % 120 === 0 && video.currentTime > 0) {
                      cleanupMemory();
                    }
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
                  onClick={() => {
                    setIsPlayButtonLoading(true);
                    setTimeout(() => {
                      // onPlay(currentMedia);
                      onInfo(currentMedia);
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

            {/* Manual refresh button with memory cleanup and forced randomization */}
            <MagneticButton
              onClick={() => {
                // Perform memory cleanup before refresh
                cleanupMemory();

                // Force a random cycle count to ensure different content
                const randomCycleBoost = Math.floor(Math.random() * 100) + Date.now() % 1000;
                const newCycleCount = cycleCount + 1 + randomCycleBoost;
                setCycleCount(newCycleCount);

                fetchRecommendedMedia(newCycleCount);
              }}
              disabled={isLoadingNewContent}
              className="ml-3 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Refresh recommendations and clean memory"
            >
              <svg
                className={`w-4 h-4 text-white ${isLoadingNewContent ? 'animate-spin' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </MagneticButton>

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
              duration: 30, // 30 seconds to match slide duration
              ease: "linear"
            }}
          />
        </motion.div>
      )}
    </motion.div>
  );
};


export default ScrollXHero;
