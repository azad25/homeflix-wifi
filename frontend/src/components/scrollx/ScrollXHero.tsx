"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Play, Info, ChevronLeft, ChevronRight, Film, Tv, Volume2, VolumeX } from 'lucide-react';
import { Media } from '@/types/media';
import { getApiUrl } from '@/lib/api';
import { MagneticButton, GradientBackground, ParallaxSection, ParticleField, ScrollReveal } from './index';
import { useAudio } from '@/contexts/EnhancedAudioContext';
import DynamicTitle from '@/components/DynamicTitle';

interface ScrollXHeroProps {
  featuredMedia: Media[];
  onPlay: (media: Media) => void;
  onInfo: (media: Media) => void;
  pageType?: string;
}

const ScrollXHero: React.FC<ScrollXHeroProps> = ({
  featuredMedia,
  onPlay,
  onInfo,
  pageType = 'home',
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [, setIsPlayButtonLoading] = useState(false);
  const [, setIsInfoButtonLoading] = useState(false);
  const [, setIsMouseOver] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const safariStallTimerRef = useRef<NodeJS.Timeout | null>(null);
  
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

  // Browser detection at component level
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua) || /iPhone|iPad|iPod/i.test(ua);
  const isChrome = /chrome/i.test(ua) && !/edg/i.test(ua);
  const isFirefox = /firefox/i.test(ua);
  const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);

  const y = useTransform(scrollYProgress, [0, 1], [0, -200]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  const currentMedia = featuredMedia[currentIndex] || featuredMedia[0];

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

  const getVideoUrl = (media: Media): string | null => {
    if (!media) return null;
    
    try {
      const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
      const protocol = window?.location?.protocol === 'https:' ? 'https:' : 'http:';
      const apiUrl = `${protocol}//${host === 'localhost' ? 'localhost' : host}:8251`;
      
      // For hero section, prioritize trailers and preview clips over full files
      if (media.trailer_path) {
        return `${apiUrl}/api/admin/assets/${media.trailer_path.split('/').pop()}`;
      }
      
      // Use preview clips as they're optimized for this purpose
      if (media.id) {
        return `${apiUrl}/api/preview-clips/${media.id}`;
      }
      
      // Last resort: try streaming endpoint
      if (media.id) {
        return `${apiUrl}/api/stream/${media.id}`;
      }
      
      return null;
    } catch (error) {
      console.error('Error generating video URL:', error);
      return null;
    }
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
      setCurrentIndex((prev) => (prev + 1) % featuredMedia.length);
    }
  };

  const prevSlide = () => {
    if (featuredMedia.length > 1) {
      setCurrentIndex((prev) => (prev - 1 + featuredMedia.length) % featuredMedia.length);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      // Force unmuted state - video should always play with full sound
      videoRef.current.muted = false;
      videoRef.current.volume = 1.0; // Always full volume for ALAC quality
      setIsMuted(false);
      
      // Mute any other playing audio first
      muteAll();
      setCurrentAudioElement(videoRef.current);
      
      // Initialize ALAC processing if available
      if (isALACEnabled && alacEngine) {
        initializeEnhancedAudio().then(() => {
          console.log('ALAC audio enabled for hero video');
        });
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

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
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

  // Universal video loading with audio support for all browsers
  useEffect(() => {
    if (!currentMedia) return;
    
    const video = videoRef.current;
    if (!video) return;
    
    console.log('ScrollXHero: Loading video for media:', currentMedia.title);
    
    // Reset states
    setIsVideoLoaded(false);
    setIsPlaying(false);
    setIsMuted(true);
    
    const videoUrl = getVideoUrl(currentMedia);
    console.log('ScrollXHero: Video URL:', videoUrl);
    
    if (!videoUrl) {
      console.log('ScrollXHero: No video URL available, using background image only');
      return;
    }
    
    console.log('ScrollXHero: Browser detection', { isSafari, isChrome, isFirefox, isMobile });
    
    let hasTriedPlay = false;
    let audioEnabled = false;
    let safariStallTimer: NodeJS.Timeout | null = null;
    let safariRecoveryCount = 0;
    const maxSafariRecovery = 3;
    
    // Universal stall detection and recovery for all browsers
    const handleSafariStall = () => {
      // Clear any existing timer
      if (safariStallTimer) {
        clearTimeout(safariStallTimer);
      }
      
      safariStallTimer = setTimeout(() => {
        if (video && (video.readyState < 3 || video.paused) && safariRecoveryCount < maxSafariRecovery) {
          console.log('ScrollXHero: Video stalled, attempting recovery');
          
          safariRecoveryCount++;
          
          // Force video restart
          video.currentTime = 0;
          video.load();
          
          setTimeout(async () => {
            try {
              await video.play();
              console.log('ScrollXHero: Stall recovery successful');
              setIsVideoLoaded(true);
              setIsPlaying(true);
              
              // Continue monitoring
              handleSafariStall();
            } catch (e) {
              console.log('ScrollXHero: Stall recovery failed:', e);
              if (safariRecoveryCount < maxSafariRecovery) {
                handleSafariStall(); // Try again
              }
            }
          }, 500);
        } else if (video && !video.paused && video.readyState >= 3) {
          // Video is playing fine, continue monitoring
          handleSafariStall();
        }
      }, 3000); // Check every 3 seconds
    };
    
    const clearSafariStallTimer = () => {
      if (safariStallTimer) {
        clearTimeout(safariStallTimer);
        safariStallTimer = null;
      }
    };
    
    // Universal audio enabler
    const enableAudio = () => {
      if (video && !audioEnabled && !video.paused) {
        try {
          video.muted = false;
          video.volume = 1.0;
          setIsMuted(false);
          audioEnabled = true;
          console.log('ScrollXHero: Audio enabled via user interaction');
          
          // Initialize ALAC audio if available
          if (isALACEnabled && alacEngine) {
            initializeEnhancedAudio().then(() => {
              console.log('ScrollXHero: ALAC audio initialized');
            }).catch(() => {
              console.log('ScrollXHero: ALAC fallback to standard audio');
            });
          }
        } catch (error) {
          console.log('ScrollXHero: Audio enable failed:', error);
        }
      }
    };
    
    // Safari-specific video play handler
    const safariPlayVideo = async () => {
      if (isSafari && !hasTriedPlay) {
        try {
          console.log('ScrollXHero: Safari attempting video play via user interaction');
          video.muted = true;
          video.volume = 1.0;
          video.currentTime = 0;
          
          await video.play();
          console.log('ScrollXHero: Safari video started via interaction');
          
          setIsVideoLoaded(true);
          setIsPlaying(true);
          setIsMuted(true);
          setCurrentAudioElement(video);
          hasTriedPlay = true;
          
          // Start monitoring
          handleSafariStall();
          
          // Enable audio after video starts
          setTimeout(() => {
            if (!audioEnabled && !video.paused) {
              video.muted = false;
              setIsMuted(false);
              audioEnabled = true;
              console.log('ScrollXHero: Safari audio enabled after interaction');
            }
          }, 500);
          
        } catch (error) {
          console.log('ScrollXHero: Safari interaction play failed:', error);
        }
      }
    };
    
    // Add universal interaction listeners for audio and Safari video
    const interactionEvents = ['click', 'touchstart', 'keydown', 'mousemove', 'scroll'];
    interactionEvents.forEach(event => {
      document.addEventListener(event, () => {
        enableAudio();
        safariPlayVideo();
      }, { once: true, passive: true });
    });
    
    const handleCanPlay = async () => {
      if (hasTriedPlay) return;
      
      console.log('ScrollXHero: Video can play, attempting playback');
      
      // Safari requires user interaction - don't auto-play
      if (isSafari) {
        console.log('ScrollXHero: Safari detected - waiting for user interaction');
        
        // Set up video but don't play
        video.muted = true;
        video.volume = 1.0;
        video.currentTime = 0;
        video.playbackRate = 1.0;
        video.setAttribute('webkit-playsinline', 'true');
        video.setAttribute('playsinline', 'true');
        
        // Show background image until user interacts
        setIsVideoLoaded(false);
        setIsPlaying(false);
        return;
      }
      
      // Non-Safari browsers can auto-play
      hasTriedPlay = true;
      
      try {
        // Reset video state
        video.muted = true;
        video.volume = 1.0;
        video.currentTime = 0;
        video.playbackRate = 1.0;
        
        // Set required attributes
        video.setAttribute('webkit-playsinline', 'true');
        video.setAttribute('playsinline', 'true');
        
        // Start playback
        const playPromise = video.play();
        await playPromise;
        
        console.log('ScrollXHero: Video playing successfully');
        
        setIsVideoLoaded(true);
        setIsPlaying(true);
        setIsMuted(true);
        setCurrentAudioElement(video);
        
        // Start monitoring
        handleSafariStall();
        
        // Enable audio after short delay
        setTimeout(() => {
          if (!audioEnabled && !video.paused) {
            try {
              video.muted = false;
              setIsMuted(false);
              audioEnabled = true;
              console.log('ScrollXHero: Audio enabled automatically');
              
              if (isALACEnabled && alacEngine) {
                initializeEnhancedAudio().then(() => {
                  console.log('ScrollXHero: ALAC audio initialized');
                }).catch(() => {
                  console.log('ScrollXHero: ALAC fallback to standard audio');
                });
              }
            } catch (error) {
              console.log('ScrollXHero: Audio enable failed:', error);
            }
          }
        }, 100);
        
      } catch (playError) {
        console.error('ScrollXHero: Video play failed:', playError);
        
        if (isSafari && safariRecoveryCount < maxSafariRecovery) {
          safariRecoveryCount++;
          console.log(`ScrollXHero: Safari retry ${safariRecoveryCount}/${maxSafariRecovery}`);
          
          setTimeout(() => {
            video.currentTime = 0;
            video.load();
            
            setTimeout(async () => {
              try {
                await video.play();
                console.log('ScrollXHero: Safari retry successful');
                setIsVideoLoaded(true);
                setIsPlaying(true);
                setIsMuted(true);
                setCurrentAudioElement(video);
                handleSafariStall();
              } catch (retryError) {
                console.log('ScrollXHero: Safari retry failed');
              }
            }, 500);
          }, 200);
        } else {
          console.log('ScrollXHero: Video requires user interaction');
          setIsVideoLoaded(false);
          setIsPlaying(false);
        }
      }
    };
    
    const handleError = (e: Event) => {
      console.error('ScrollXHero: Video error:', e);
      clearSafariStallTimer();
      
      if (isSafari && safariRecoveryCount < maxSafariRecovery) {
        safariRecoveryCount++;
        console.log(`ScrollXHero: Safari error recovery attempt ${safariRecoveryCount}`);
        
        setTimeout(() => {
          video.load();
          setTimeout(() => {
            video.play().catch(err => {
              console.log('ScrollXHero: Safari error recovery failed:', err);
              if (safariRecoveryCount >= maxSafariRecovery) {
                setIsVideoLoaded(false);
                setIsPlaying(false);
              }
            });
          }, 1000);
        }, 2000);
      } else {
        setIsVideoLoaded(false);
        setIsPlaying(false);
      }
    };
    
    const handleStalled = () => {
      console.log('ScrollXHero: Video stalled event detected');
      clearSafariStallTimer();
      
      if (safariRecoveryCount < maxSafariRecovery) {
        safariRecoveryCount++;
        console.log(`ScrollXHero: Stall recovery attempt ${safariRecoveryCount}`);
        
        setTimeout(() => {
          video.currentTime = 0;
          video.load();
          
          setTimeout(async () => {
            try {
              await video.play();
              console.log('ScrollXHero: Stall event recovery successful');
              setIsVideoLoaded(true);
              setIsPlaying(true);
              handleSafariStall(); // Resume monitoring
            } catch (e) {
              console.log('ScrollXHero: Stall event recovery failed:', e);
            }
          }, 300);
        }, 200);
      }
    };
    
    const handleSuspend = () => {
      console.log('ScrollXHero: Video suspended');
      clearSafariStallTimer();
      
      setTimeout(() => {
        if (video && video.readyState === 0) {
          console.log('ScrollXHero: Reloading suspended video');
          video.load();
          
          setTimeout(async () => {
            try {
              await video.play();
              console.log('ScrollXHero: Suspend recovery successful');
              setIsVideoLoaded(true);
              setIsPlaying(true);
              handleSafariStall(); // Resume monitoring
            } catch (e) {
              console.log('ScrollXHero: Suspend recovery failed:', e);
            }
          }, 500);
        }
      }, 1000);
    };
    
    const handleLoadStart = () => {
      console.log('ScrollXHero: Video load started');
    };
    
    const handleLoadedMetadata = () => {
      console.log('ScrollXHero: Video metadata loaded');
    };
    
    const handleLoadedData = () => {
      console.log('ScrollXHero: Video data loaded');
    };
    
    // Clean up function
    const cleanup = () => {
      clearSafariStallTimer();
      
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
      video.removeEventListener('stalled', handleStalled);
      video.removeEventListener('suspend', handleSuspend);
      video.removeEventListener('loadstart', handleLoadStart);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('loadeddata', handleLoadedData);
      
      // Remove interaction listeners
      interactionEvents.forEach(event => {
        document.removeEventListener(event, enableAudio);
      });
    };
    
    // Add event listeners
    video.addEventListener('canplay', handleCanPlay, { once: true });
    video.addEventListener('error', handleError);
    video.addEventListener('stalled', handleStalled);
    video.addEventListener('suspend', handleSuspend);
    video.addEventListener('loadstart', handleLoadStart);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('loadeddata', handleLoadedData);
    
    // Immediate video loading for all browsers
    video.currentTime = 0;
    video.playbackRate = 1.0;
    video.preload = 'auto';
    video.load();
    
    console.log('ScrollXHero: Video loading initiated for', isSafari ? 'Safari' : 'other browser');
    
    return cleanup;
  }, [currentMedia, setCurrentAudioElement, isALACEnabled, alacEngine, initializeEnhancedAudio]);

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

  // Simple audio integration
  useEffect(() => {
    if (videoRef.current && isVideoLoaded) {
      setCurrentAudioElement(videoRef.current);
    }
  }, [isVideoLoaded, setCurrentAudioElement]);

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
            {(() => {
              const videoUrl = getVideoUrl(currentMedia);
              if (!videoUrl) return null;
              
              return (
                <video
                  ref={videoRef}
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-out ${
                    isVideoLoaded && isPlaying ? 'opacity-100' : 'opacity-0'
                  }`}
                  autoPlay={false}
                  muted={true}
                  loop
                  playsInline
                  preload="metadata"
                  controls={false}
                  disablePictureInPicture
                  disableRemotePlayback
                  crossOrigin="anonymous"
                  onClick={() => {
                    // Safari click-to-play fallback
                    if (isSafari && !isPlaying) {
                      const video = videoRef.current;
                      if (video) {
                        video.muted = true;
                        video.play().then(() => {
                          console.log('ScrollXHero: Safari video started via click');
                          setIsVideoLoaded(true);
                          setIsPlaying(true);
                          setCurrentAudioElement(video);
                          
                          // Enable audio after video starts
                          setTimeout(() => {
                            video.muted = false;
                            setIsMuted(false);
                            console.log('ScrollXHero: Safari audio enabled via click');
                          }, 200);
                        }).catch(e => {
                          console.log('ScrollXHero: Safari click play failed:', e);
                        });
                      }
                    }
                  }}
                  style={{ 
                    zIndex: isVideoLoaded && isPlaying ? 5 : 1,
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    transform: 'translateZ(0)',
                    WebkitTransform: 'translateZ(0)',
                    cursor: isSafari && !isPlaying ? 'pointer' : 'default'
                  }}
                >
                  <source src={videoUrl} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              );
            })()}
            
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
              className="bg-black/50 backdrop-blur-md text-white p-4 rounded-full hover:bg-black/70 transition-all duration-300 border border-white/20"
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
              className="bg-black/50 backdrop-blur-md text-white p-4 rounded-full hover:bg-black/70 transition-all duration-300 border border-white/20"
            >
              <ChevronRight className="w-8 h-8" />
            </MagneticButton>
          </motion.div>
        </>
      )}

      {/* Content - Netflix-style left positioning */}
      <div className="absolute inset-0 z-20 flex items-center">
        <div className="w-full max-w-none px-8 md:px-16 lg:px-24">
          <div className="max-w-2xl">
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
              
              {/* Year */}
              {currentMedia.release_date && (
                <span className="text-white font-medium">
                  {new Date(currentMedia.release_date).getFullYear()}
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
            </motion.div>
          </ScrollReveal>

          {/* Enhanced Dynamic Title with Genre-based styling */}
          <ScrollReveal delay={0.2}>
            <DynamicTitle
              key={`title-${currentMedia.id}`}
              media={currentMedia}
              variant="hero"
              pageType={pageType}
              showGenreIndicator={true}
              animated={true}
              enable3D={true}
              enableParticles={true}
              particleIntensity="high"
              className="mb-4"
            />
          </ScrollReveal>

          {/* Genres */}
          <ScrollReveal delay={0.3}>
            <motion.div 
              key={`genres-${currentMedia.id}`}
              className="flex flex-wrap gap-2 mb-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              {currentMedia.genres?.slice(0, 3).map((genre, index) => (
                <span 
                  key={genre.id}
                  className="text-gray-300 text-sm bg-black/30 backdrop-blur-sm px-3 py-1 rounded-full border border-white/20"
                >
                  {genre.name}
                </span>
              ))}
            </motion.div>
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
                  // Enable video playback on Safari first
                  if (isSafari && !isPlaying) {
                    const video = videoRef.current;
                    if (video) {
                      video.muted = true;
                      video.play().then(() => {
                        console.log('ScrollXHero: Safari video started via Play button');
                        setIsVideoLoaded(true);
                        setIsPlaying(true);
                        setCurrentAudioElement(video);
                        
                        // Enable audio immediately
                        setTimeout(() => {
                          video.muted = false;
                          setIsMuted(false);
                          console.log('ScrollXHero: Safari audio enabled via Play button');
                        }, 100);
                      }).catch(e => {
                        console.log('ScrollXHero: Safari Play button failed:', e);
                      });
                    }
                  }
                  
                  setIsPlayButtonLoading(true);
                  setTimeout(() => {
                    onPlay(currentMedia);
                    setIsPlayButtonLoading(false);
                  }, 300);
                }}
                className="bg-white text-black px-8 py-3 rounded-md font-bold text-lg hover:bg-gray-200 transition-all duration-300 flex items-center gap-2"
              >
                <Play className="w-6 h-6 fill-current" />
                {isSafari && !isPlaying ? 'Start Video' : 'Play'}
              </MagneticButton>

              <MagneticButton
                onClick={() => {
                  setIsInfoButtonLoading(true);
                  setTimeout(() => {
                    onInfo(currentMedia);
                    setIsInfoButtonLoading(false);
                  }, 300);
                }}
                className="bg-gray-600/80 text-white px-8 py-3 rounded-md font-bold text-lg hover:bg-gray-500/80 transition-all duration-300 flex items-center gap-2"
              >
                <Info className="w-6 h-6" />
                More Info
              </MagneticButton>
              
              {/* Audio Toggle Button */}
              <MagneticButton
                onClick={() => {
                  const video = videoRef.current;
                  if (video) {
                    if (video.muted) {
                      video.muted = false;
                      setIsMuted(false);
                      console.log('ScrollXHero: Audio unmuted via button');
                    } else {
                      video.muted = true;
                      setIsMuted(true);
                      console.log('ScrollXHero: Audio muted via button');
                    }
                  }
                }}
                className="bg-black/50 text-white p-3 rounded-full hover:bg-black/70 transition-all duration-300 border border-white/20"
              >
                {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
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
          <div className="flex gap-3">
            {featuredMedia.map((_, index) => (
              <MagneticButton
                key={index}
                onClick={() => goToSlide(index)}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  index === currentIndex 
                    ? 'bg-white scale-125' 
                    : 'bg-white/50 hover:bg-white/80'
                }`}
              >
                <span className="sr-only">Go to slide {index + 1}</span>
              </MagneticButton>
            ))}
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
