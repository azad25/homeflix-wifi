"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useTransform, useSpring, AnimatePresence } from 'framer-motion';
import { Play, Info, ChevronLeft, ChevronRight, Film, Tv, Volume2 } from 'lucide-react';
import { Media } from '@/types/media';
import { getApiUrl } from '@/lib/api';
import { MagneticButton, GradientBackground, ParallaxSection, ParticleField, ScrollReveal } from './index';
import { useAudio } from '@/contexts/EnhancedAudioContext';
import RedLoader from '../RedLoader';
import LazyVideo from '../LazyVideo';

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
  const [featuredMedia, setFeaturedMedia] = useState<Media[]>(initialFeaturedMedia);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isPlayButtonLoading, setIsPlayButtonLoading] = useState(false);
  const [isInfoButtonLoading, setIsInfoButtonLoading] = useState(false);
  const [isMouseOver, setIsMouseOver] = useState(false);
  const [cycleCount, setCycleCount] = useState(0);
  const [isLoadingNewContent, setIsLoadingNewContent] = useState(false);
  const [backgroundLoaded, setBackgroundLoaded] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [userHasInteracted, setUserHasInteracted] = useState(false);
  const [canAutoplayWithAudio, setCanAutoplayWithAudio] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const preloadRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
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

  const currentMedia = featuredMedia[currentIndex] || featuredMedia[0];

  // Global audio preference management
  const getGlobalAudioPreference = (): boolean => {
    if (typeof window === 'undefined') return true; // SSR fallback
    const saved = localStorage.getItem('scrollx-audio-muted');
    return saved !== null ? JSON.parse(saved) : true; // Default to muted
  };

  const setGlobalAudioPreference = (muted: boolean) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('scrollx-audio-muted', JSON.stringify(muted));
  };

  const hasUserEverUnmuted = (): boolean => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('scrollx-user-has-unmuted') === 'true';
  };

  const setUserHasUnmuted = () => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('scrollx-user-has-unmuted', 'true');
  };

  // Test browser autoplay capabilities
  const testAutoplayCapabilities = async () => {
    try {
      const video = document.createElement('video');
      video.muted = true;
      video.src = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAr1tZGF0AAACrgYF//+q3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE1MiByMjg1NCBlOWE1OTAzIC0gSC4yNjQvTVBFRy00IEFWQyBjb2RlYyAtIENvcHlsZWZ0IDIwMDMtMjAxNyAtIGh0dHA6Ly93d3cudmlkZW9sYW4ub3JnL3gyNjQuaHRtbCAtIG9wdGlvbnM6IGNhYmFjPTEgcmVmPTMgZGVibG9jaz0xOjA6MCBhbmFseXNlPTB4MzoweDExMyBtZT1oZXggc3VibWU9NyBwc3k9MSBwc3lfcmQ9MS4wMDowLjAwIG1peGVkX3JlZj0xIG1lX3JhbmdlPTE2IGNocm9tYV9tZT0xIHRyZWxsaXM9MSA4eDhkY3Q9MSBjcW09MCBkZWFkem9uZT0yMSwxMSBmYXN0X3Bza2lwPTEgY2hyb21hX3FwX29mZnNldD0tMiB0aHJlYWRzPTMgbG9va2FoZWFkX3RocmVhZHM9MSBzbGljZWRfdGhyZWFkcz0wIG5yPTAgZGVjaW1hdGU9MSBpbnRlcmxhY2VkPTAgYmx1cmF5X2NvbXBhdD0wIGNvbnN0cmFpbmVkX2ludHJhPTAgYmZyYW1lcz0zIGJfcHlyYW1pZD0yIGJfYWRhcHQ9MSBiX2JpYXM9MCBkaXJlY3Q9MSB3ZWlnaHRiPTEgb3Blbl9nb3A9MCB3ZWlnaHRwPTIga2V5aW50PTI1MCBrZXlpbnRfbWluPTEwIHNjZW5lY3V0PTQwIGludHJhX3JlZnJlc2g9MCByY19sb29rYWhlYWQ9NDAgcmM9Y3JmIG1idHJlZT0xIGNyZj0yMy4wIHFjb21wPTAuNjAgcXBtaW49MCBxcG1heD02OSBxcHN0ZXA9NCBpcF9yYXRpbz0xLjQwIGFxPTE6MS4wMACAAAAAOWWIhAA3//p+C7v8tDDSTjf97w6BcLhRHXoJizVHBdHeAAACAAEAAALQQoCgQAAAAwAAAwAAAwAAAwAAAwAA';

      const playPromise = video.play();
      if (playPromise !== undefined) {
        await playPromise;
        setCanAutoplayWithAudio(false); // Muted autoplay works
        video.pause();

        // Test with audio
        video.muted = false;
        video.volume = 0.1;
        try {
          const audioPlayPromise = video.play();
          if (audioPlayPromise !== undefined) {
            await audioPlayPromise;
            setCanAutoplayWithAudio(true); // Audio autoplay works
            video.pause();
          }
        } catch {
          setCanAutoplayWithAudio(false); // Audio autoplay blocked
        }
      }
    } catch {
      setCanAutoplayWithAudio(false);
    }
  };

  // Fetch recommended/trending media for hero slides - prioritize backend recommendations
  const fetchRecommendedMedia = async (cycleNumber: number = 0) => {
    setIsLoadingNewContent(true);
    console.log(`🎬 Fetching recommendations from backend (cycle ${cycleNumber})...`);
    
    try {
      // Primary recommendation endpoints from backend - these use intelligent algorithms
      const recommendationEndpoints = [
        `${getApiUrl()}/api/recommendations/personalized?limit=12`,
        `${getApiUrl()}/api/recommendations/mixed?limit=12`,
        `${getApiUrl()}/api/recommendations/trending?limit=12`,
        `${getApiUrl()}/api/recommendations/popular?limit=12`,
        `${getApiUrl()}/api/recommendations/recent?limit=12`,
        `${getApiUrl()}/api/recommendations/top-rated?limit=12`
      ];

      const endpointIndex = cycleNumber % recommendationEndpoints.length;
      const primaryEndpoint = recommendationEndpoints[endpointIndex];
      let newMedia: Media[] = [];

      console.log(`🎯 Trying primary recommendation endpoint: ${primaryEndpoint}`);

      // Try the primary recommendation endpoint first
      try {
        const response = await fetch(primaryEndpoint);
        if (response.ok) {
          const data = await response.json();
          if (data && Array.isArray(data) && data.length > 0) {
            newMedia = data;
            console.log(`✅ Got ${newMedia.length} recommendations from primary endpoint`);
          } else {
            console.warn(`⚠️ Primary endpoint returned empty or invalid data:`, data);
          }
        } else {
          console.warn(`⚠️ Primary endpoint failed with status: ${response.status}`);
        }
      } catch (error) {
        console.warn(`❌ Primary endpoint ${primaryEndpoint} failed:`, error);
      }

      // If primary fails, try other recommendation endpoints (but be more selective)
      if (newMedia.length === 0) {
        console.log(`🔄 Primary failed, trying other recommendation endpoints...`);
        
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
                newMedia = data;
                console.log(`✅ Got ${newMedia.length} recommendations from fallback endpoint`);
                break;
              }
            }
          } catch (error) {
            console.warn(`❌ Fallback endpoint ${fallbackEndpoint} failed:`, error);
            continue;
          }
        }
      }

      // ONLY if ALL recommendation endpoints fail, use content-specific endpoints as last resort
      if (newMedia.length === 0) {
        console.warn(`⚠️ All recommendation endpoints failed, using content-specific endpoints as last resort...`);
        
        let basicEndpoints: string[] = [];
        
        if (contentFilter === 'movies-hd') {
          basicEndpoints = [
            `${getApiUrl()}/api/movies?limit=20`,
            `${getApiUrl()}/api/media?limit=20`
          ];
        } else if (contentFilter === 'tv-series') {
          basicEndpoints = [
            `${getApiUrl()}/api/media/tv-shows?limit=20`,
            `${getApiUrl()}/api/media?limit=20`
          ];
        } else {
          basicEndpoints = [
            `${getApiUrl()}/api/media?limit=20`
          ];
        }

        for (const basicEndpoint of basicEndpoints) {
          try {
            const response = await fetch(basicEndpoint);
            if (response.ok) {
              const data = await response.json();
              if (data && Array.isArray(data) && data.length > 0) {
                newMedia = data;
                console.log(`✅ Got ${newMedia.length} items from ${basicEndpoint} as last resort`);
                break;
              }
            }
          } catch (error) {
            console.warn(`❌ Basic endpoint ${basicEndpoint} failed:`, error);
            continue;
          }
        }
      }

      // Process the new media from backend
      if (newMedia && newMedia.length > 0) {
        console.log(`🎬 Processing ${newMedia.length} items from backend...`);
        
        // Apply content filtering based on contentFilter prop
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
        
        // Filter out exact duplicates from current cycle
        const filteredMedia = contentFilteredMedia.filter((media: Media) =>
          !featuredMedia.some(existing => existing.id === media.id)
        );

        if (filteredMedia.length >= 4) {
          // We have enough new content from backend recommendations
          setFeaturedMedia(filteredMedia.slice(0, 10));
          console.log(`✅ Updated with ${filteredMedia.length} new filtered recommendations`);
        } else if (filteredMedia.length > 0) {
          // Mix new backend content with some existing (but prioritize new)
          const mixedMedia = [
            ...filteredMedia, // All new filtered recommendations first
            ...featuredMedia.slice(0, Math.max(0, 8 - filteredMedia.length)) // Fill remaining slots
          ];
          setFeaturedMedia(mixedMedia);
          console.log(`✅ Mixed ${filteredMedia.length} new filtered recommendations with existing content`);
        } else {
          // All content was duplicates, use the new filtered recommendations anyway
          setFeaturedMedia(contentFilteredMedia.slice(0, 10));
          console.log(`✅ Used filtered recommendations despite duplicates`);
        }
      } else {
        // WORST CASE: All endpoints failed - keep existing content
        console.error(`❌ All endpoints failed, keeping existing content`);
        // Don't shuffle - keep the existing intelligent content
      }
    } catch (error) {
      console.error('❌ Critical error fetching recommended media:', error);
      // Keep existing content without shuffling
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

  const getVideoUrl = (media: Media, fallback: boolean = false): string | undefined => {
    if (!media.id) return undefined;

    const apiUrl = getApiUrl();

    if (fallback) {
      // Try alternative endpoints if primary fails
      const alternatives = [
        `${apiUrl}/api/preview-clips/${media.id}?quality=low&format=mp4`,
        `${apiUrl}/api/preview-clips/${media.id}?quality=medium&format=mp4`,
        `${apiUrl}/api/stream/${media.id}?preview=true`
      ];

      // Return first valid alternative
      for (const alt of alternatives) {
        if (alt && alt !== `${apiUrl}/api/preview-clips/${media.id}`) {
          return alt;
        }
      }
    }

    // Primary endpoint - use the preview-clips API endpoint with optimized settings
    return `${apiUrl}/api/preview-clips/${media.id}?quality=high&format=mp4`;
  };



  // Check if media has video content (preview clip or can generate one)
  const hasVideoContent = (media: Media) => {
    // Check if we have a media ID and either a preview clip path or file path
    // The backend will serve preview clips if they exist, or generate them on-demand
    return !!(media.id && media.file_path);
  };

  // Debug function to check preview clip availability
  const checkPreviewClipAvailability = async (media: Media) => {
    if (!media.id) return false;
    
    try {
      const videoUrl = getVideoUrl(media);
      if (!videoUrl) return false;
      
      const response = await fetch(videoUrl, { method: 'HEAD' });
      const isAvailable = response.ok;
      
      if (!isAvailable) {
        console.log(`Preview clip not available for media ${media.id} (${media.title})`);
        console.log(`Tried URL: ${videoUrl}`);
        console.log(`Response status: ${response.status}`);
        
        // Try to generate preview clip if it doesn't exist
        await generatePreviewClipIfNeeded(media);
      } else {
        console.log(`Preview clip available for media ${media.id} (${media.title})`);
      }
      
      return isAvailable;
    } catch (error) {
      console.warn(`Error checking preview clip for media ${media.id}:`, error);
      return false;
    }
  };

  // Generate preview clip if needed
  const generatePreviewClipIfNeeded = async (media: Media) => {
    try {
      const generateUrl = `${getApiUrl()}/api/admin/preview-clips/${media.id}/generate`;
      console.log(`Attempting to generate preview clip for media ${media.id}...`);
      
      const response = await fetch(generateUrl, { method: 'POST' });
      
      if (response.ok) {
        console.log(`Preview clip generation started for media ${media.id}`);
        
        // Wait a bit and then try to reload the video
        setTimeout(() => {
          if (videoRef.current && currentMedia?.id === media.id) {
            const video = videoRef.current;
            const newVideoUrl = getVideoUrl(media);
            if (newVideoUrl) {
              video.src = newVideoUrl;
              video.load();
            }
          }
        }, 3000); // Wait 3 seconds for generation
      } else {
        console.warn(`Failed to generate preview clip for media ${media.id}:`, response.status);
      }
    } catch (error) {
      console.warn(`Error generating preview clip for media ${media.id}:`, error);
    }
  };



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

    // Fallback to poster
    if (media.poster_path) {
      return `${apiUrl}/api/posters/${media.id}`;
    }

    // Default fallback
    return `${apiUrl}/api/thumbnails/1`;
  };

  // Stop all video/audio playback
  const stopAllPlayback = () => {
    // Stop main video
    if (videoRef.current) {
      const video = videoRef.current;
      video.pause();
      video.currentTime = 0;
      video.muted = true;
      video.volume = 0;
    }

    // Stop all preloaded videos
    preloadRefs.current.forEach((video) => {
      try {
        video.pause();
        video.currentTime = 0;
        video.muted = true;
        video.volume = 0;
      } catch (error) {
        // Ignore cleanup errors
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

        // Check if we've completed a full cycle
        if (nextIndex === 0 && currentIndex === featuredMedia.length - 1) {
          const newCycleCount = cycleCount + 1;
          setCycleCount(newCycleCount);

          // Load new content from backend after completing a cycle
          console.log(`🔄 Cycle ${newCycleCount} completed, fetching new recommendations from backend...`);
          setTimeout(() => {
            fetchRecommendedMedia(newCycleCount);
          }, 1000); // Reduced delay for faster backend fetching
        }
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

  // Preload videos for smooth transitions
  const preloadVideo = (media: Media) => {
    if (!hasVideoContent(media)) return;

    const videoId = media.id.toString();

    if (preloadRefs.current.has(videoId)) {
      const existingVideo = preloadRefs.current.get(videoId);
      if (existingVideo) {
        existingVideo.pause();
        existingVideo.currentTime = 0;
        existingVideo.muted = true;
        existingVideo.volume = 0;
      }
      return;
    }

    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    video.crossOrigin = 'anonymous';
    video.volume = 0;

    const videoUrl = getVideoUrl(media);
    if (videoUrl) {
      video.src = videoUrl;

      video.addEventListener('error', () => {
        preloadRefs.current.delete(videoId);
      });

      video.addEventListener('loadeddata', () => {
        video.pause();
        video.currentTime = 0;
        video.muted = true;
        video.volume = 0;
      });

      preloadRefs.current.set(videoId, video);
      video.load();
    }
  };

  // Get preloaded video or create new one
  const getPreloadedVideo = (media: Media) => {
    const videoId = media.id.toString();
    return preloadRefs.current.get(videoId);
  };

  // Simplified video playback with audio handling
  const playVideoWithAudio = async (video: HTMLVideoElement, withAudio: boolean = false) => {
    try {
      // Ensure video is ready to play
      if (video.readyState < 3) {
        // Wait for video to be ready
        await new Promise((resolve) => {
          const handleCanPlay = () => {
            video.removeEventListener('canplay', handleCanPlay);
            resolve(void 0);
          };
          video.addEventListener('canplay', handleCanPlay);
          
          // Timeout after 3 seconds
          setTimeout(() => {
            video.removeEventListener('canplay', handleCanPlay);
            resolve(void 0);
          }, 3000);
        });
      }

      // Always start muted for autoplay compliance
      video.muted = true;
      video.volume = 0;
      video.currentTime = 0;

      const playPromise = video.play();
      if (playPromise !== undefined) {
        await playPromise;
        setIsPlaying(true);

        // If audio is requested and user has interacted, try to unmute
        if (withAudio && userHasInteracted && hasUserEverUnmuted()) {
          setTimeout(() => {
            if (video && !video.paused) {
              video.muted = false;
              video.volume = spatialAudioEnabled ? 0.8 : 0.6;
            }
          }, 500);
        }

        return true;
      }
    } catch (error) {
      console.warn('Video play failed, trying fallback:', error);
      
      // Fallback: ensure video is muted and try again
      video.muted = true;
      video.volume = 0;
      video.currentTime = 0;
      
      try {
        const fallbackPromise = video.play();
        if (fallbackPromise !== undefined) {
          await fallbackPromise;
          setIsPlaying(true);
          return true;
        }
      } catch (fallbackError) {
        console.warn('Video fallback play also failed:', fallbackError);
        return false;
      }
    }
    return false;
  };

  // Universal unmute functionality
  const handleUnmute = async (e?: React.MouseEvent | KeyboardEvent) => {
    setUserHasInteracted(true);
    setUserHasUnmuted();

    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    setIsMuted(false);
    setGlobalAudioPreference(false);

    // Immediately apply to current video if playing
    if (videoRef.current && isPlaying) {
      const video = videoRef.current;
      video.muted = false;
      video.volume = spatialAudioEnabled ? 0.8 : 0.6;
    }
  };

  // Netflix-style helper functions
  const getQualityBadge = () => {
    return { text: currentMedia.quality || "HD", color: 'bg-blue-600' };
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
    if (genres.includes('sci-fi') || genres.includes('fantasy'))
      return 'linear-gradient(135deg, #00bfff, #4169e1, #ffffff)';
    return 'linear-gradient(135deg, #e50914, #ffffff, #ffffff)';
  };

  const goToSlide = (index: number) => {
    if (index !== currentIndex && !isTransitioning) {
      setIsTransitioning(true);
      setIsAutoPlaying(false);

      // Stop all current playback before transitioning
      stopAllPlayback();

      // Fade out current content
      setBackgroundLoaded(false);
      setVideoLoaded(false);

      setTimeout(() => {
        setCurrentIndex(index);
        setIsVideoLoaded(false);
        setIsPlaying(false);
        setIsTransitioning(false);
        setTimeout(() => setIsAutoPlaying(true), 5000);
      }, 300); // Wait for fade out
    }
  };

  // Function to manually trigger content refresh from backend
  const refreshContent = () => {
    const newCycleCount = cycleCount + 1;
    setCycleCount(newCycleCount);
    console.log(`🔄 Manual refresh triggered, fetching cycle ${newCycleCount} from backend...`);
    fetchRecommendedMedia(newCycleCount);
    setCurrentIndex(0); // Reset to first slide
  };

  // Initialize audio preferences and test autoplay capabilities
  useEffect(() => {
    const savedMutedState = getGlobalAudioPreference();
    const userHasUnmutedBefore = hasUserEverUnmuted();

    setIsMuted(savedMutedState);
    setUserHasInteracted(userHasUnmutedBefore);

    // Test browser autoplay capabilities
    testAutoplayCapabilities();
  }, []);

  // Handle slide changes - simplified video setup
  useEffect(() => {
    if (videoRef.current && currentMedia && hasVideoContent(currentMedia) && !isTransitioning) {
      const video = videoRef.current;
      const shouldPlayWithAudio = !isMuted && hasUserEverUnmuted() && canAutoplayWithAudio;

      // Small delay to ensure video element is ready after slide change
      setTimeout(() => {
        if (video && hasVideoContent(currentMedia) && video.readyState >= 3 && video.paused) {
          playVideoWithAudio(video, shouldPlayWithAudio);
        }
      }, 300);
    }
  }, [currentIndex, currentMedia, isMuted, isTransitioning, canAutoplayWithAudio]);

  // Auto-slide functionality with enhanced timing
  useEffect(() => {
    if (!isAutoPlaying || featuredMedia.length <= 1) return;

    // Longer duration for video content, shorter for images
    const slideDuration = hasVideoContent(currentMedia) && isVideoLoaded && isPlaying ? 20000 : 8000;

    const interval = setInterval(() => {
      nextSlide();
    }, slideDuration);

    return () => clearInterval(interval);
  }, [isAutoPlaying, featuredMedia.length, currentIndex, isVideoLoaded, isPlaying]);

  // Recommendation-based hero slide updates - prioritize backend calls
  useEffect(() => {
    if (!enableRecommendations) return;

    console.log('🚀 Setting up recommendation system...');

    // Initial fetch after component mounts - fetch from backend immediately
    const initialDelay = setTimeout(() => {
      console.log('🎬 Initial recommendation fetch from backend...');
      fetchRecommendedMedia(0);
    }, 2000); // Reduced delay - fetch sooner

    // More frequent refresh to get fresh backend recommendations
    const refreshTimer = setInterval(() => {
      console.log('⏰ Periodic recommendation refresh from backend...');
      refreshContent();
    }, refreshInterval); // Use original interval, not doubled

    return () => {
      clearTimeout(initialDelay);
      clearInterval(refreshTimer);
    };
  }, [enableRecommendations, refreshInterval]);

  // Reset video states when featured media changes
  useEffect(() => {
    if (featuredMedia.length > 0) {
      setIsVideoLoaded(false);
      setIsPlaying(false);
      setBackgroundLoaded(false);
      setVideoLoaded(false);
      setIsTransitioning(false);
      // Reset to first slide when content changes
      if (isLoadingNewContent) {
        setCurrentIndex(0);
      }
    }
  }, [featuredMedia, isLoadingNewContent]);

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

  // Update featured media when initialFeaturedMedia changes
  useEffect(() => {
    setFeaturedMedia(initialFeaturedMedia);
  }, [initialFeaturedMedia]);

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

  // Reset video states when media changes - simplified
  useEffect(() => {
    if (currentMedia) {
      stopAllPlayback();
      setIsVideoLoaded(false);
      setIsPlaying(false);
      setVideoLoaded(false);

      const videoUrl = getVideoUrl(currentMedia);
      if (!videoUrl) return;

      if (videoRef.current) {
        const video = videoRef.current;
        video.pause();
        video.currentTime = 0;
        video.muted = true;
        video.volume = 0;
        video.preload = 'metadata';
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
        video.src = videoUrl;
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
        const shouldPlayWithAudio = !isMuted && hasUserEverUnmuted() && canAutoplayWithAudio;
        playVideoWithAudio(video, shouldPlayWithAudio);
      };

      const handleCanPlay = () => {
        // Also try to play on canplay event for faster loading
        if (!isVideoLoaded) {
          setIsVideoLoaded(true);
          setVideoLoaded(true);

          const shouldPlayWithAudio = !isMuted && hasUserEverUnmuted() && canAutoplayWithAudio;
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

    // Global interaction detection for autoplay policy
    const handleUserInteraction = () => {
      if (!userHasInteracted) {
        setUserHasInteracted(true);

        // Try to start video playback after first interaction
        if (videoRef.current && hasVideoContent(currentMedia) && !isPlaying) {
          const video = videoRef.current;
          const shouldPlayWithAudio = !isMuted && hasUserEverUnmuted() && canAutoplayWithAudio;
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
          `${getApiUrl()}/api/posters/${currentMedia.id}`,
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
      } else if (hasUserEverUnmuted()) {
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
                  poster={getBackgroundImageUrl(currentMedia)}
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${videoLoaded && isPlaying ? 'opacity-100' : 'opacity-0'
                    }`}
                  style={{
                    zIndex: 5,
                    objectFit: 'cover',
                    objectPosition: 'center'
                  }}
                  autoPlay={false}
                  muted={isMuted}
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
                        setVideoLoaded(true);
                        setCurrentAudioElement(video);
                      }
                    }
                  }}
                  onCanPlay={() => {
                    if (videoRef.current && !isPlaying && !isTransitioning) {
                      const video = videoRef.current;
                      video.currentTime = 0;

                      const shouldStartWithAudio = !isMuted && hasUserEverUnmuted() && canAutoplayWithAudio;
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
                  {getAgeRating()}
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
                {currentMedia.title}
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
