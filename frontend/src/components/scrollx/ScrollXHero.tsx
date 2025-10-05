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
}

const ScrollXHero: React.FC<ScrollXHeroProps> = ({
  featuredMedia: initialFeaturedMedia,
  onPlay,
  onInfo,
  refreshInterval = 300000, // Default 5 minutes
  enableRecommendations = true,
}) => {
  const [featuredMedia, setFeaturedMedia] = useState<Media[]>(initialFeaturedMedia);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true); // Start muted, unmute on click
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
  const [preloadedVideos, setPreloadedVideos] = useState<Map<string, HTMLVideoElement>>(new Map());
  const [userHasInteracted, setUserHasInteracted] = useState(false);
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

  // Fetch recommended/trending media for hero slides
  const fetchRecommendedMedia = async (cycleNumber: number = 0) => {
    setIsLoadingNewContent(true);
    try {
      // Vary the content based on cycle count for diversity
      const endpoints = [
        `${getApiUrl()}/api/recommendations/trending?limit=10`,
        `${getApiUrl()}/api/media?sort=rating&limit=8`,
        `${getApiUrl()}/api/media?sort=view_count&limit=8`,
        `${getApiUrl()}/api/media?sort=created_at&limit=8`,
        `${getApiUrl()}/api/recommendations/popular?limit=10`
      ];

      const endpointIndex = cycleNumber % endpoints.length;
      const response = await fetch(endpoints[endpointIndex]);

      if (response.ok) {
        const newMedia = await response.json();
        if (newMedia && newMedia.length > 0) {
          // Filter out media that was in the previous cycle to ensure fresh content
          const filteredMedia = newMedia.filter((media: Media) =>
            !featuredMedia.some(existing => existing.id === media.id)
          );

          if (filteredMedia.length > 0) {
            // Mix new content with some fresh picks
            const mixedMedia = [
              ...filteredMedia.slice(0, 6), // New content
              ...initialFeaturedMedia.slice(0, 2) // Keep some original variety
            ];
            setFeaturedMedia(mixedMedia);
            console.log(`Hero slides updated with fresh content (cycle ${cycleNumber + 1})`);
          } else {
            // If no new content, shuffle existing content
            const shuffledMedia = [...featuredMedia].sort(() => 0.5 - Math.random());
            setFeaturedMedia(shuffledMedia);
            console.log('Hero slides shuffled for variety');
          }
        }
      }
    } catch (error) {
      console.warn('Failed to fetch recommended media for hero:', error);
      // Fallback to shuffling existing content
      const shuffledMedia = [...featuredMedia].sort(() => 0.5 - Math.random());
      setFeaturedMedia(shuffledMedia);
      console.log('Hero slides shuffled as fallback');
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
    // Check if media has preview clip available
    if (media.preview_clip_path || media.id) {
      const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
      const apiUrl = `http://${host === 'localhost' ? 'localhost' : host}:8252`;
      
      if (fallback) {
        // Try alternative endpoints if primary fails
        const alternatives = [
          `${apiUrl}/api/preview-clips/${media.id}?format=mp4`,
          `${apiUrl}/api/preview-clips/${media.id}?quality=low`,
          `${apiUrl}/api/media/${media.id}/preview`,
          media.preview_clip_path?.startsWith('http') ? media.preview_clip_path : `${apiUrl}${media.preview_clip_path}`
        ];
        
        // Return first valid alternative
        for (const alt of alternatives) {
          if (alt && alt !== `${apiUrl}/api/preview-clips/${media.id}`) {
            console.log('🔄 Trying fallback URL:', alt);
            return alt;
          }
        }
      }
      
      // Use the preview-clips API endpoint which is working according to backend logs
      return `${apiUrl}/api/preview-clips/${media.id}`;
    }
    
    // Return undefined if no preview clip available
    return undefined;
  };



  // Check if media has video content (only preview clip)
  const hasVideoContent = (media: Media) => {
    return !!(media.preview_clip_path);
  };



  const getBackgroundImageUrl = (media: Media) => {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    const apiUrl = `http://${host === 'localhost' ? 'localhost' : host}:8252`;
    // Try banner first for hero backgrounds
    if (media.banner_path) {
      return `${apiUrl}/api/admin/assets/${media.banner_path.split('/').pop()}`;
    }
    // Fallback to poster
    if (media.poster_path) {
      return `${apiUrl}/api/posters/${media.id}`;
    }
    // Final fallback to thumbnail
    return `${apiUrl}/api/thumbnails/${media.id}`;
  };

  const nextSlide = () => {
    if (featuredMedia.length > 1 && !isTransitioning) {
      setIsTransitioning(true);

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
          console.log(`Completed cycle ${newCycleCount}, loading fresh content...`);

          // Load new content after completing a cycle
          setTimeout(() => {
            fetchRecommendedMedia(newCycleCount);
          }, 2000); // Small delay to let the transition complete
        }
      }, 300); // Wait for fade out
    }
  };

  const prevSlide = () => {
    if (featuredMedia.length > 1 && !isTransitioning) {
      setIsTransitioning(true);

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
    // Only preload if media has preview clip
    if (!hasVideoContent(media)) return;
    
    const videoId = media.id.toString();
    if (preloadRefs.current.has(videoId)) return;

    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true; // Always preload muted
    video.loop = true;
    video.playsInline = true;
    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    video.crossOrigin = 'anonymous';
    
    // Only use preview clip as source
    const videoUrl = getVideoUrl(media);
    if (videoUrl) {
      // Add multiple source formats for better compatibility
      const mp4Source = document.createElement('source');
      mp4Source.src = videoUrl;
      mp4Source.type = 'video/mp4';
      video.appendChild(mp4Source);

      // Store the preloaded video
      preloadRefs.current.set(videoId, video);
      
      // Start loading
      video.load();
      console.log('Preloading preview clip for:', media.title, 'URL:', videoUrl);
    }
  };

  // Get preloaded video or create new one
  const getPreloadedVideo = (media: Media) => {
    const videoId = media.id.toString();
    return preloadRefs.current.get(videoId);
  };

  // Universal unmute functionality for all browsers
  const handleUnmute = async (e?: React.MouseEvent | KeyboardEvent) => {
    console.log('🔊 UNMUTE CLICKED - Universal browser support');
    
    // Mark user interaction for autoplay policy
    setUserHasInteracted(true);
    
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    // Update state immediately
    setIsMuted(false);
    console.log('✅ State updated: isMuted = false');

    // Handle video element
    if (videoRef.current) {
      const video = videoRef.current;
      
      try {
        // Set volume and unmute
        video.muted = false;
        video.volume = spatialAudioEnabled ? 0.8 : 0.7;
        
        // Ensure video is playing
        if (video.paused) {
          const playPromise = video.play();
          if (playPromise !== undefined) {
            await playPromise;
            console.log('✅ Video playing with audio');
          }
        }
        
        console.log('✅ Unmute successful');
      } catch (error) {
        console.log('⚠️ Unmute failed, trying recovery:', error);
        
        // Recovery attempt
        try {
          video.load();
          await new Promise(resolve => setTimeout(resolve, 500));
          video.muted = false;
          video.volume = spatialAudioEnabled ? 0.8 : 0.7;
          
          if (video.paused) {
            await video.play();
          }
          console.log('✅ Recovery successful');
        } catch (recoveryError) {
          console.log('❌ Recovery failed:', recoveryError);
        }
      }
    }
  };

  // Netflix-style helper functions
  const getQualityBadge = () => {
    if (currentMedia.rating && currentMedia.rating >= 8.5) return { text: '4K', color: 'bg-green-600' };
    if (currentMedia.rating && currentMedia.rating >= 7.5) return { text: 'HD', color: 'bg-blue-600' };
    return { text: 'SD', color: 'bg-gray-600' };
  };

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

  // Function to manually trigger content refresh
  const refreshContent = () => {
    const newCycleCount = cycleCount + 1;
    setCycleCount(newCycleCount);
    fetchRecommendedMedia(newCycleCount);
    setCurrentIndex(0); // Reset to first slide
  };

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

  // Recommendation-based hero slide updates
  useEffect(() => {
    if (!enableRecommendations) return;

    // Initial fetch after component mounts
    const initialDelay = setTimeout(() => {
      fetchRecommendedMedia(0);
    }, 5000); // Wait 5 seconds after mount

    // Set up periodic refresh as backup (longer interval since cycle-based refresh is primary)
    const refreshTimer = setInterval(() => {
      refreshContent();
    }, refreshInterval * 2); // Double the interval since we have cycle-based refresh

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

  // Handle media without video content
  useEffect(() => {
    if (currentMedia && !hasVideoContent(currentMedia)) {
      // For media without video, mark video as "loaded" so UI behaves correctly
      setIsVideoLoaded(false);
      setVideoLoaded(false);
      setIsPlaying(false);
      console.log('Media has no video content, using thumbnail only:', currentMedia.title);
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

  // Reset video states when media changes and force video load
  useEffect(() => {
    if (currentMedia) {
      setIsVideoLoaded(false);
      setIsPlaying(false);
      setVideoLoaded(false);
      
      // Check if we have a valid video URL (preview clip)
      const videoUrl = getVideoUrl(currentMedia);
      if (!videoUrl) {
        console.warn('No preview clip available for:', currentMedia.title);
        return;
      }

      // Force video element to load new source
      if (videoRef.current) {
        const video = videoRef.current;
        video.pause();
        video.currentTime = 0;
        video.load(); // Force reload of video element
        console.log('🎬 Loading video for:', currentMedia.title);
        console.log('🔗 Video URL:', videoUrl);
        console.log('📁 Preview clip path:', currentMedia.preview_clip_path);
        console.log('🆔 Media ID:', currentMedia.id);
        
        // Test if URL is accessible and handle 404s
        fetch(videoUrl, { method: 'HEAD' })
          .then(response => {
            console.log('🌐 Video URL test:', response.status, response.ok ? 'OK' : 'FAILED');
            if (response.status === 404) {
              console.log('🚫 404 Error - Video not found, this will cause playback issues');
              // Mark video as not loaded to prevent playback attempts
              setIsVideoLoaded(false);
              setVideoLoaded(false);
              setIsPlaying(false);
            }
          })
          .catch(error => {
            console.log('❌ Video URL not accessible:', error);
            // Network error - also prevent playback attempts
            setIsVideoLoaded(false);
            setVideoLoaded(false);
            setIsPlaying(false);
          });
      }
    }
  }, [currentMedia]);

  // Enhanced video loading and autoplay effect
  useEffect(() => {
    if (videoRef.current && currentMedia && hasVideoContent(currentMedia)) {
      const video = videoRef.current;
      const videoUrl = getVideoUrl(currentMedia);
      
      if (!videoUrl) return;

      // Set up video properties for cross-browser compatibility
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      video.muted = isMuted;
      video.volume = isMuted ? 0 : (spatialAudioEnabled ? 0.8 : 0.6);
      video.preload = 'auto';

      const handleLoadedMetadata = () => {
        console.log('Video metadata loaded for:', currentMedia.title);
        video.currentTime = 0;
      };

      const handleCanPlayThrough = () => {
        console.log('Video can play through for:', currentMedia.title);
        setIsVideoLoaded(true);
        setVideoLoaded(true);
        
        // Attempt immediate playback
        const playVideo = async () => {
          try {
            video.muted = isMuted;
            const playPromise = video.play();
            if (playPromise !== undefined) {
              await playPromise;
              setIsPlaying(true);
              console.log('Video started playing:', currentMedia.title);
            }
          } catch (error) {
            console.log('Autoplay blocked, trying muted:', error);
            try {
              video.muted = true;
              setIsMuted(true);
              const mutedPromise = video.play();
              if (mutedPromise !== undefined) {
                await mutedPromise;
                setIsPlaying(true);
                console.log('Video playing muted:', currentMedia.title);
              }
            } catch (mutedError) {
              console.error('Failed to play video:', mutedError);
            }
          }
        };

        playVideo();
      };

      const handleError = (e: Event) => {
        const videoElement = e.target as HTMLVideoElement;
        const error = videoElement.error;
        
        console.error('🚨 Video error for:', currentMedia.title);
        console.error('Error details:', {
          code: error?.code,
          message: error?.message,
          url: videoUrl
        });

        // Handle specific error types
        if (error) {
          switch (error.code) {
            case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
              console.error('❌ Video format not supported or 404 error');
              break;
            case MediaError.MEDIA_ERR_NETWORK:
              console.error('❌ Network error loading video');
              break;
            case MediaError.MEDIA_ERR_DECODE:
              console.error('❌ Video decode error');
              break;
            case MediaError.MEDIA_ERR_ABORTED:
              console.error('❌ Video loading aborted');
              break;
            default:
              console.error('❌ Unknown video error');
          }
        }

        // Test the URL to confirm if it's a 404
        fetch(videoUrl, { method: 'HEAD' })
          .then(response => {
            if (response.status === 404) {
              console.error('🚫 Confirmed: Video URL returns 404 - this prevents audio playback');
            } else if (!response.ok) {
              console.error('🚫 Video URL error:', response.status, response.statusText);
            } else {
              console.log('🤔 Video URL is accessible but video element failed to load');
            }
          })
          .catch(fetchError => {
            console.error('🌐 Network error testing video URL:', fetchError);
          });
        
        // Try fallback URLs before giving up
        const fallbackUrl = getVideoUrl(currentMedia, true);
        if (fallbackUrl && fallbackUrl !== videoUrl && videoElement) {
          console.log('🔄 Trying fallback video URL:', fallbackUrl);
          
          // Update video source to fallback URL
          const sources = videoElement.querySelectorAll('source');
          if (sources.length > 0) {
            sources[0].src = fallbackUrl;
            videoElement.load();
            return; // Don't reset states yet, give fallback a chance
          }
        }
        
        // Reset video states to prevent broken playback
        setIsVideoLoaded(false);
        setVideoLoaded(false);
        setIsPlaying(false);
        
        // Force fallback to image-only mode
        console.log('🔄 All video URLs failed, falling back to image-only mode');
      };

      // Add event listeners
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('canplaythrough', handleCanPlayThrough);
      video.addEventListener('error', handleError);

      // Cleanup
      return () => {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('canplaythrough', handleCanPlayThrough);
        video.removeEventListener('error', handleError);
      };
    }
  }, [currentMedia, isMuted, spatialAudioEnabled]);

  // Periodic video health check to detect 404s and other issues
  useEffect(() => {
    if (!videoRef.current || !isVideoLoaded) return;

    const healthCheck = setInterval(() => {
      const video = videoRef.current;
      if (video && video.error) {
        console.log('🏥 Video health check detected error:', video.error.code);
        
        // Clear the interval to prevent spam
        clearInterval(healthCheck);
        
        // Try to recover from the error
        const currentUrl = getVideoUrl(currentMedia);
        if (currentUrl) {
          console.log('🔄 Attempting video recovery...');
          video.src = currentUrl;
          video.load();
        }
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(healthCheck);
  }, [isVideoLoaded, currentMedia]);

  // Hide controls after inactivity and add keyboard shortcut for unmute
  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setShowControls(false), 3000);
    };

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'm' || e.key === 'M' || e.key === ' ') {
        console.log('🎹 Key pressed for unmute:', e.key);
        e.preventDefault();
        handleUnmute(e);
      }
    };

    // Global interaction detection for Chromium autoplay policy
    const handleUserInteraction = () => {
      if (!userHasInteracted) {
        console.log('👆 First user interaction detected');
        setUserHasInteracted(true);
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('keydown', handleKeyPress);
      document.addEventListener('click', handleUserInteraction);
      document.addEventListener('touchstart', handleUserInteraction);
      
      return () => {
        container.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('keydown', handleKeyPress);
        document.removeEventListener('click', handleUserInteraction);
        document.removeEventListener('touchstart', handleUserInteraction);
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
        // If image fails to load, still show the component
        setBackgroundLoaded(true);
      };
      img.src = getBackgroundImageUrl(currentMedia);
    }
  }, [currentMedia]);

  // Update video muted state when isMuted changes
  useEffect(() => {
    console.log('isMuted state changed to:', isMuted);
    if (videoRef.current) {
      console.log('Updating video muted state to:', isMuted);
      videoRef.current.muted = isMuted;
      if (!isMuted) {
        videoRef.current.volume = spatialAudioEnabled ? 0.8 : 0.6;
        console.log('Video volume set to:', videoRef.current.volume);
      }
    }
  }, [isMuted, spatialAudioEnabled]);

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
                  console.log('ALAC audio stream detected, using enhanced audio quality');

                  // Set audio processing parameters for ALAC
                  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                  if (audioContext.sampleRate >= 48000) {
                    console.log('High sample rate supported for ALAC audio');
                  }
                }
              }
            })
            .catch(() => {
              // Fallback to standard video audio with ALAC codec preference
              console.log('ALAC audio stream not available, using standard video with ALAC codec preference');
              if (videoRef.current && videoRef.current.canPlayType) {
                const alacSupport = videoRef.current.canPlayType('video/mp4; codecs="avc1.42E01E, alac"');
                if (alacSupport) {
                  console.log('ALAC codec supported in video container');
                }
              }
            });
        });
      }
    }
  }, [isVideoLoaded, setCurrentAudioElement, isALACEnabled, alacEngine, spatialAudioEnabled, currentMedia, initializeEnhancedAudio]);

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

            {/* Netflix-style loading - show loader only briefly */}
            <AnimatePresence>
              {!backgroundLoaded && (!hasVideoContent(currentMedia) || !videoLoaded) && (
                <motion.div
                  className="absolute inset-0 bg-black flex items-center justify-center z-30"
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <RedLoader size="large" showText text="Loading..." />
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
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
                    videoLoaded && isPlaying ? 'opacity-100' : 'opacity-0'
                  }`}
                  style={{ 
                    zIndex: 5,
                    objectFit: 'cover',
                    objectPosition: 'center'
                  }}
                  autoPlay
                  muted={isMuted}
                  loop
                  playsInline
                  preload="auto"
                  controls={false}
                  crossOrigin="anonymous"
                  webkit-playsinline="true"
                  x-webkit-airplay="allow"
                  disablePictureInPicture
                  disableRemotePlayback
                  onLoadedData={() => {
                    console.log('Hero video loaded successfully:', currentMedia.title);
                    setIsVideoLoaded(true);
                    setVideoLoaded(true);
                    setCurrentAudioElement(videoRef.current);
                  }}
                  onCanPlay={() => {
                    console.log('Hero video can play');
                    if (videoRef.current && !isPlaying) {
                      const video = videoRef.current;
                      video.currentTime = 0;
                      video.volume = isMuted ? 0 : (spatialAudioEnabled ? 0.8 : 0.6);
                      video.muted = isMuted;

                      // Enhanced playback with cross-browser compatibility
                      const attemptPlay = async () => {
                        try {
                          // Try to play with current muted state
                          const playPromise = video.play();
                          if (playPromise !== undefined) {
                            await playPromise;
                            console.log('Hero video playing successfully');
                            setIsPlaying(true);
                          }
                        } catch (error) {
                          console.log('Autoplay failed, trying muted fallback:', error);
                          try {
                            // Force muted for autoplay compliance
                            video.muted = true;
                            setIsMuted(true);
                            const mutedPlayPromise = video.play();
                            if (mutedPlayPromise !== undefined) {
                              await mutedPlayPromise;
                              setIsPlaying(true);
                              console.log('Hero video playing muted');
                            }
                          } catch (mutedError) {
                            console.log('Video playback failed completely:', mutedError);
                            setIsVideoLoaded(false);
                            setVideoLoaded(false);
                            setIsPlaying(false);
                          }
                        }
                      };

                      // Small delay to ensure video is ready
                      setTimeout(attemptPlay, 100);
                    }
                  }}
                  onError={(e) => {
                    console.log('Hero video error occurred:', e);
                    setIsVideoLoaded(false);
                    setVideoLoaded(false);
                    setIsPlaying(false);
                  }}

                  onPlay={() => {
                    console.log('Hero video started playing');
                    setIsPlaying(true);
                  }}
                  onPause={() => {
                    console.log('Hero video paused');
                    setIsPlaying(false);
                  }}
                  onLoadStart={() => {
                    console.log('Hero video load started');
                    setVideoLoaded(false);
                    setIsPlaying(false);
                  }}
                  onLoadedMetadata={() => {
                    console.log('Hero video metadata loaded');
                  }}
                  onClick={(e) => {
                    console.log('🎬 Video element clicked directly');
                    if (isMuted) {
                      e.stopPropagation();
                      handleUnmute(e);
                    }
                  }}
                >
                  {/* Multiple source formats for cross-browser compatibility */}
                  {getVideoUrl(currentMedia) && (
                    <>
                      <source src={getVideoUrl(currentMedia)!} type="video/mp4" />
                      <source src={getVideoUrl(currentMedia)!} type="video/webm" />
                      <source src={getVideoUrl(currentMedia)!} type="video/ogg" />
                    </>
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



      {/* Click to unmute overlay - Universal browser support */}
      {isMuted && isVideoLoaded && hasVideoContent(currentMedia) && (
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
                {currentMedia.rating && (
                  <div className="flex items-center gap-1">
                    <span className="text-yellow-400 text-sm">★</span>
                    <span className="text-gray-300 text-sm">
                      {currentMedia.rating.toFixed(1)}
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
                {currentMedia.short_desc || "Experience premium entertainment with stunning visuals and immersive storytelling."}
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
                  className="relative flex items-center justify-center transition-all duration-500 ease-out disabled:cursor-not-allowed"
                >
                  {index === currentIndex ? (
                    // Red bar for current slide with glow effect
                    <motion.div
                      className={`bg-red-600 rounded-full relative ${isTransitioning ? 'animate-pulse' : ''}`}
                      style={{
                        boxShadow: isTransitioning 
                          ? '0 0 8px rgba(239, 68, 68, 0.4), 0 0 16px rgba(239, 68, 68, 0.2)'
                          : '0 0 12px rgba(239, 68, 68, 0.6), 0 0 24px rgba(239, 68, 68, 0.3)'
                      }}
                      initial={{ width: 12, height: 12 }}
                      animate={{ 
                        width: 32, 
                        height: 4,
                        borderRadius: 2,
                        opacity: isTransitioning ? 0.7 : 1
                      }}
                      transition={{ 
                        duration: 0.5, 
                        ease: "easeOut",
                        type: "spring",
                        stiffness: 300,
                        damping: 30
                      }}
                    />
                  ) : (
                    // Dots for inactive slides
                    <motion.div
                      className={`bg-white/50 hover:bg-white/80 rounded-full cursor-pointer ${isLoadingNewContent ? 'animate-pulse' : ''}`}
                      initial={{ width: 32, height: 4 }}
                      animate={{ 
                        width: 12, 
                        height: 12,
                        borderRadius: 6,
                        backgroundColor: "rgba(255, 255, 255, 0.5)"
                      }}
                      whileHover={{ 
                        scale: 1.2,
                        backgroundColor: "rgba(255, 255, 255, 0.8)"
                      }}
                      whileTap={{ 
                        scale: 0.9 
                      }}
                      transition={{ 
                        duration: 0.5, 
                        ease: "easeOut",
                        type: "spring",
                        stiffness: 300,
                        damping: 30
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
                <RedLoader size="small" className="mr-2" />
                <span className="text-white/80 text-xs">Loading...</span>
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
