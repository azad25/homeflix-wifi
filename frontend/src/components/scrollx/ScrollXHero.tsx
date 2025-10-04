"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { Play, Info, ChevronLeft, ChevronRight, Volume2, VolumeX, Film, Tv } from 'lucide-react';
import { Media } from '@/types/media';
import { getApiUrl } from '@/lib/api';
import { MagneticButton, GradientBackground, ParallaxSection, ParticleField, ScrollReveal } from './index';
import { useAudio } from '@/contexts/EnhancedAudioContext';

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
  const [isMuted, setIsMuted] = useState(false); // Always start with ALAC audio enabled
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isPlayButtonLoading, setIsPlayButtonLoading] = useState(false);
  const [isInfoButtonLoading, setIsInfoButtonLoading] = useState(false);
  const [isMouseOver, setIsMouseOver] = useState(false);
  const [cycleCount, setCycleCount] = useState(0);
  const [isLoadingNewContent, setIsLoadingNewContent] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
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

  const getVideoUrl = (media: Media) => {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    const apiUrl = `http://${host === 'localhost' ? 'localhost' : host}:8251`;
    
    // For hero section, prioritize trailers and preview clips over full files
    // Full files might be too large for background video
    if (media.trailer_path) {
      return `${apiUrl}/api/admin/assets/${media.trailer_path.split('/').pop()}`;
    }
    // Use preview clips as they're optimized for this purpose
    if (media.id) {
      return `${apiUrl}/api/preview-clips/${media.id}`;
    }
    // Last resort: try streaming endpoint
    return `${apiUrl}/api/stream/${media.id}`;
  };

  const getBackgroundImageUrl = (media: Media) => {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    const apiUrl = `http://${host === 'localhost' ? 'localhost' : host}:8251`;
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
    if (featuredMedia.length > 1) {
      const nextIndex = (currentIndex + 1) % featuredMedia.length;
      setCurrentIndex(nextIndex);
      
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
    }
  };

  const prevSlide = () => {
    if (featuredMedia.length > 1) {
      setCurrentIndex((prev) => (prev - 1 + featuredMedia.length) % featuredMedia.length);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const newMutedState = !isMuted;
      setIsMuted(newMutedState);
      if (newMutedState) {
        // Mute this video and remove from audio context
        videoRef.current.muted = true;
        videoRef.current.volume = 0;
        setCurrentAudioElement(null);
      } else {
        // Unmute this video and set as current audio source with ALAC
        muteAll(); // Mute any other playing audio first
        videoRef.current.muted = false;
        videoRef.current.volume = spatialAudioEnabled ? 0.8 : 0.6; // Higher volume for ALAC quality
        setCurrentAudioElement(videoRef.current);
        
        // Initialize ALAC processing if available
        if (isALACEnabled && alacEngine) {
          initializeEnhancedAudio().then(() => {
            console.log('ALAC audio enabled for hero video');
          });
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
    if(currentMedia.year){
      return currentMedia.year;
    } else if(currentMedia.release_date){
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
    setCurrentIndex(index);
    setIsAutoPlaying(false);
    setIsVideoLoaded(false);
    setIsPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 5000);
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
    const slideDuration = isVideoLoaded && isPlaying ? 20000 : 12000;
    
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
      // Reset to first slide when content changes
      if (isLoadingNewContent) {
        setCurrentIndex(0);
      }
    }
  }, [featuredMedia, isLoadingNewContent]);

  // Update featured media when initialFeaturedMedia changes
  useEffect(() => {
    setFeaturedMedia(initialFeaturedMedia);
  }, [initialFeaturedMedia]);

  // Enhanced video loading and playback with better error handling
  useEffect(() => {
    if (currentMedia) {
      // Reset video states when media changes
      setIsVideoLoaded(false);
      setIsPlaying(false);
      
      // Try to load video after a short delay
      const loadVideo = async () => {
        if (videoRef.current) {
          const video = videoRef.current;
          
          const handleLoadedData = () => {
            console.log('Hero video loaded successfully');
            setIsVideoLoaded(true);
            // Register this video as the current audio source
            setCurrentAudioElement(video);
            
            // Start video playback with ALAC audio codec - always unmuted
            video.currentTime = 0;
            video.volume = 0.9; // Higher volume for ALAC quality
            video.muted = false; // Always start with audio enabled
            
            // Set audio codec preference for ALAC
            const alacSupport = video.canPlayType('video/mp4; codecs="avc1.42E01E, alac"');
            console.log('ALAC codec support in hero:', alacSupport);
            
            // Enhanced audio setup for ALAC
            const playWithHighQualityAudio = async () => {
              try {
                // Try to enable high quality audio first
                if (isALACEnabled && alacEngine) {
                  await initializeEnhancedAudio();
                  console.log('Enhanced ALAC audio initialized for hero video');
                }
                
                // Set optimal audio properties
                video.volume = spatialAudioEnabled ? 0.9 : 0.8;
                video.muted = false;
                
                await video.play();
                console.log('Hero video playing successfully with ALAC audio codec');
                setIsPlaying(true);
              } catch (error) {
                console.warn('Hero video autoplay with ALAC audio failed:', error);
                
                // Try with user interaction
                const enableAudioButton = document.createElement('button');
                enableAudioButton.style.position = 'fixed';
                enableAudioButton.style.top = '20px';
                enableAudioButton.style.right = '20px';
                enableAudioButton.style.zIndex = '9999';
                enableAudioButton.style.padding = '8px 16px';
                enableAudioButton.style.backgroundColor = 'rgba(229, 9, 20, 0.9)';
                enableAudioButton.style.color = 'white';
                enableAudioButton.style.border = 'none';
                enableAudioButton.style.borderRadius = '4px';
                enableAudioButton.style.cursor = 'pointer';
                enableAudioButton.style.fontSize = '14px';
                enableAudioButton.textContent = '🔊 Enable Audio';
                
                enableAudioButton.onclick = async () => {
                  try {
                    video.muted = false;
                    video.volume = 0.9;
                    await video.play();
                    setIsPlaying(true);
                    document.body.removeChild(enableAudioButton);
                    console.log('Hero audio enabled successfully with ALAC');
                  } catch (err) {
                    console.log('Final fallback to muted hero video:', err);
                    video.muted = true;
                    await video.play();
                    setIsPlaying(true);
                    document.body.removeChild(enableAudioButton);
                  }
                };
                
                document.body.appendChild(enableAudioButton);
                
                // Also try muted playback as immediate fallback
                video.muted = true;
                video.play().then(() => {
                  setIsPlaying(true);
                }).catch(() => {
                  setIsVideoLoaded(false);
                  setIsPlaying(false);
                });
              }
            };
            
            playWithHighQualityAudio();
          };

          const handleError = (e: Event) => {
            console.warn('Video loading failed for:', currentMedia.title, e);
            setIsVideoLoaded(false);
            setIsPlaying(false);
          };

          const handleCanPlay = () => {
            if (!isVideoLoaded) {
              setIsVideoLoaded(true);
              setCurrentAudioElement(video);
              // Try with ALAC audio first - always start with audio enabled
              video.muted = false;
              video.volume = 0.8; // Higher volume for ALAC quality
              
              // Check for ALAC codec support
              const alacSupport = video.canPlayType('video/mp4; codecs="avc1.42E01E, alac"');
              console.log('ALAC codec support in canPlay:', alacSupport);
              
              // Enhanced audio playback
              const attemptHighQualityPlayback = async () => {
                try {
                  // Initialize enhanced audio processing first
                  if (isALACEnabled && alacEngine) {
                    await initializeEnhancedAudio();
                    video.volume = spatialAudioEnabled ? 0.9 : 0.8;
                  }
                  
                  await video.play();
                  setIsPlaying(true);
                  console.log('Hero video canPlay with ALAC audio successful');
                } catch (error) {
                  console.log('Hero video canPlay with audio failed:', error);
                  // Fallback to muted
                  video.muted = true;
                  video.play().then(() => {
                    setIsPlaying(true);
                  }).catch(() => {
                    setIsVideoLoaded(false);
                    setIsPlaying(false);
                  });
                }
              };
              
              attemptHighQualityPlayback();
            }
          };

          const handleEnded = () => {
            video.currentTime = 0;
            video.play().catch(() => {
              setIsVideoLoaded(false);
              setIsPlaying(false);
            });
          };

          // Clean up previous listeners
          video.removeEventListener('loadeddata', handleLoadedData);
          video.removeEventListener('error', handleError);
          video.removeEventListener('canplay', handleCanPlay);
          video.removeEventListener('ended', handleEnded);

          // Add new listeners
          video.addEventListener('loadeddata', handleLoadedData);
          video.addEventListener('error', handleError);
          video.addEventListener('canplay', handleCanPlay);
          video.addEventListener('ended', handleEnded);

          // Force reload the video source
          video.load();
        }
      };

      // Load video after a short delay to ensure DOM is ready
      const timeoutId = setTimeout(loadVideo, 1000);
      
      return () => {
        clearTimeout(timeoutId);
        if (videoRef.current) {
          const video = videoRef.current;
          video.removeEventListener('loadeddata', () => {});
          video.removeEventListener('error', () => {});
          video.removeEventListener('canplay', () => {});
          video.removeEventListener('ended', () => {});
        }
      };
    }
  }, [currentMedia, isMuted]);

  // Hide controls after inactivity
  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setShowControls(false), 3000);
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('mousemove', handleMouseMove);
      return () => {
        container.removeEventListener('mousemove', handleMouseMove);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
    }
  }, []);

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
          >  {/* Always show background image first */}
            <motion.div
              key={`bg-${currentMedia.id}`}
              className="w-full h-full bg-cover bg-center bg-no-repeat"
              style={{
                backgroundImage: `url(${getBackgroundImageUrl(currentMedia)})`,
              }}
              initial={{ scale: 1.1, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 1.5, ease: "easeOut" }}
            />
            
            {/* Video overlay when loaded and playing */}
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover opacity-100"
              autoPlay
              muted={false}
              loop
              playsInline
              preload="auto"
              controls={false}
              style={{ zIndex: 5 }}
            >
              <source src={`${getVideoUrl(currentMedia)}?audio=alac&quality=high`} type="video/mp4; codecs=&quot;avc1.42E01E, alac&quot;" />
              <source src={`${getVideoUrl(currentMedia)}?audio=alac`} type="video/mp4; codecs=&quot;avc1.42E01E, alac&quot;" />
              <source src={getVideoUrl(currentMedia)} type="video/mp4" />
              <source src={`${getVideoUrl(currentMedia)}?format=webm&audio=opus`} type="video/webm; codecs=&quot;vp9, opus&quot;" />
            </video>
            
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
            className="absolute left-8 top-1/2 transform -translate-y-1/2 z-20"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: showControls ? 1 : 0, x: showControls ? 0 : -20 }}
            transition={{ duration: 0.3 }}
          >
            <MagneticButton
              onClick={prevSlide}
              className="bg-transparent text-white p-4 rounded-full hover:bg-white/10 transition-all duration-300 border border-white/20"
            >
              <ChevronLeft className="w-8 h-8" />
            </MagneticButton>
          </motion.div>

          <motion.div
            className="absolute right-8 top-1/2 transform -translate-y-1/2 z-20"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: showControls ? 1 : 0, x: showControls ? 0 : 20 }}
            transition={{ duration: 0.3 }}
          >
            <MagneticButton
              onClick={nextSlide}
              className="bg-transparent text-white p-4 rounded-full hover:bg-white/10 transition-all duration-300 border border-white/20"
            >
              <ChevronRight className="w-8 h-8" />
            </MagneticButton>
          </motion.div>
        </>
      )}

      {/* Refresh content button */}
      {enableRecommendations && (
        <motion.div
          className="absolute top-8 right-8 z-20"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: showControls ? 1 : 0, y: showControls ? 0 : -20 }}
          transition={{ duration: 0.3 }}
        >
          <MagneticButton
            onClick={refreshContent}
            disabled={isLoadingNewContent}
            className="bg-transparent text-white p-3 rounded-full hover:bg-white/10 transition-all duration-300 border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
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
          {/* Media Tags - Above Title */}
          <ScrollReveal delay={0.05}>
            <motion.div 
              key={`tags-${currentMedia.id}`}
              className="flex flex-wrap gap-2 mb-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.05 }}
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

          {/* Netflix-style metadata */}
          <ScrollReveal delay={0.1}>
            <motion.div 
              key={`metadata-${currentMedia.id}`}
              className="flex items-center gap-4 mb-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
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
          <ScrollReveal delay={0.2}>
            <motion.h1 
              key={`title-${currentMedia.id}`}
              className={`font-bold text-white mb-4 leading-tight ${getTitleSizeClass()} ${getGenreBasedStyling()}`}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              style={{
                textShadow: '2px 2px 4px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.5)'
              }}
            >
              {currentMedia.title}
            </motion.h1>
          </ScrollReveal>



          {/* Description */}
          <ScrollReveal delay={0.4}>
            <motion.p 
              key={`desc-${currentMedia.id}`}
              className="text-lg md:text-xl text-gray-200 mb-8 max-w-2xl leading-relaxed bg-black/20 backdrop-blur-sm p-4 rounded-lg border border-white/10"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              {currentMedia.description || "Experience premium entertainment with stunning visuals and immersive storytelling."}
            </motion.p>
          </ScrollReveal>

          {/* Action Buttons */}
          <ScrollReveal delay={0.5}>
            <motion.div 
              className="flex items-center gap-4 mb-6"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.5 }}
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
          className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: showControls ? 1 : 0, y: showControls ? 0 : 20 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center gap-3">
            {/* Cycle indicator */}
            {cycleCount > 0 && (
              <div className="text-white/60 text-xs mr-2 bg-transparent px-2 py-1 rounded-full border border-white/20">
                Cycle {cycleCount + 1}
              </div>
            )}
            
            {/* Slide dots */}
            <div className="flex gap-3">
              {featuredMedia.map((_, index) => (
                <MagneticButton
                  key={`${index}-${cycleCount}`}
                  onClick={() => goToSlide(index)}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    index === currentIndex 
                      ? 'bg-white scale-125' 
                      : 'bg-white/50 hover:bg-white/80'
                  } ${isLoadingNewContent ? 'animate-pulse' : ''}`}
                >
                  <span className="sr-only">Go to slide {index + 1}</span>
                </MagneticButton>
              ))}
            </div>
            
            {/* Loading indicator */}
            {isLoadingNewContent && (
              <div className="text-white/80 text-xs ml-2 bg-transparent px-2 py-1 rounded-full border border-white/30 animate-pulse">
                Loading fresh content...
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Progress bar */}
      {featuredMedia.length > 1 && isAutoPlaying && (
        <motion.div
          className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 z-20"
          initial={{ opacity: 0 }}
          animate={{ opacity: showControls ? 1 : 0 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            key={`progress-${currentIndex}-${isVideoLoaded}-${isPlaying}`}
            className="h-full bg-red-600"
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
