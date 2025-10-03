"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Play, Info, ChevronLeft, ChevronRight, Film, Tv, Volume2, VolumeX } from 'lucide-react';
import { Media } from '@/types/media';
import { getApiUrl } from '@/lib/api';
import { MagneticButton, GradientBackground, ParallaxSection, ParticleField, ScrollReveal } from './index';
import { useAudio } from '@/contexts/EnhancedAudioContext';
import DynamicTitle from '@/components/DynamicTitle';
import { fetchRecommendations } from '@/lib/api/recommendations';
import { NetflixImage, NetflixVideo } from '@/components';
import { useNetflixPreloader } from '@/hooks/useNetflixPreloader';
import { crossBrowserAudio, setupCrossBrowserVideo } from '@/lib/audio/crossBrowserAudio';

interface ScrollXHeroProps {
  featuredMedia?: Media[];
  onPlay: (media: Media) => void;
  onInfo: (media: Media) => void;
  pageType?: string;
}

const ScrollXHero: React.FC<ScrollXHeroProps> = ({
  featuredMedia: propsFeaturedMedia,
  onPlay,
  onInfo,
  pageType = 'home',
}) => {
  const [featuredMedia, setFeaturedMedia] = useState<Media[]>(propsFeaturedMedia || []);
  const [isLoading, setIsLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [, setIsPlayButtonLoading] = useState(false);
  const [, setIsInfoButtonLoading] = useState(false);
  const [, setIsMouseOver] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Netflix-style preloading
  const preloadItems = featuredMedia.map((media, index) => ([
    {
      src: `${getApiUrl()}/api/thumbnails/${media.uuid}`,
      type: 'image' as const,
      priority: index === currentIndex ? 'high' as const : 'medium' as const
    },
    {
      src: `${getApiUrl()}/api/preview-clips/${media.uuid}`,
      type: 'video' as const,
      priority: index === currentIndex ? 'high' as const : 'low' as const
    }
  ])).flat();
  
  const { observeElement, preloadNearbyItems } = useNetflixPreloader(preloadItems, {
    enabled: true,
    maxConcurrent: 4,
    preloadDistance: 2
  });
  
  const { 
    setCurrentAudioElement, 
    muteAll, 
    alacEngine, 
    isALACEnabled, 
    initializeEnhancedAudio 
  } = useAudio();

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  });

  const y = useTransform(scrollYProgress, [0, 1], [0, -200]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  // Fetch recommended media for hero section
  useEffect(() => {
    const fetchHeroMedia = async () => {
      if (propsFeaturedMedia && propsFeaturedMedia.length > 0) {
        setFeaturedMedia(propsFeaturedMedia);
        // Preload assets for provided media
        setTimeout(() => preloadNearbyItems(0), 100);
        return;
      }

      setIsLoading(true);
      try {
        // Get different recommendation categories based on page type
        let heroMedia: any[] = [];
        
        const defaultUserId = '1'; // Default user ID for recommendations
        
        if (pageType === 'movies') {
          // For movies page, get popular movies and top picks
          const [popularResponse, topPicksResponse] = await Promise.all([
            fetch(`${getApiUrl()}/api/media/movies?limit=5`),
            fetch(`${getApiUrl()}/api/recommendations?user_id=${defaultUserId}&category=top_picks&limit=3`)
          ]);
          
          const popularMovies = popularResponse.ok ? await popularResponse.json() : [];
          const topPicksData = topPicksResponse.ok ? await topPicksResponse.json() : { items: [] };
          const topPicks = topPicksData.items || [];
          
          heroMedia = [...topPicks, ...popularMovies.slice(0, 3)].slice(0, 5);
        } else if (pageType === 'tv-series') {
          // For TV series page, get series titles with random episode previews
          const [seriesHeroResponse, tvSeriesRecommendationsResponse] = await Promise.all([
            fetch(`${getApiUrl()}/api/media/tv-series-hero?limit=5`),
            fetch(`${getApiUrl()}/api/recommendations/tv-series?user_id=${defaultUserId}&limit=3`)
          ]);
          
          const seriesHero = seriesHeroResponse.ok ? await seriesHeroResponse.json() : [];
          const tvRecommendationsData = tvSeriesRecommendationsResponse.ok ? 
            await tvSeriesRecommendationsResponse.json() : { items: [] };
          const tvRecommendations = tvRecommendationsData.items || [];
          
          heroMedia = [...seriesHero, ...tvRecommendations].slice(0, 5);
        } else {
          // For home page, get personalized recommendations
          const [forYouResponse, trendingResponse, topPicksResponse] = await Promise.all([
            fetch(`${getApiUrl()}/api/recommendations?user_id=${defaultUserId}&category=for_you&limit=3`),
            fetch(`${getApiUrl()}/api/recommendations?user_id=${defaultUserId}&category=trending&limit=2`),
            fetch(`${getApiUrl()}/api/recommendations?user_id=${defaultUserId}&category=top_picks&limit=2`)
          ]);
          
          const forYouData = forYouResponse.ok ? await forYouResponse.json() : { items: [] };
          const trendingData = trendingResponse.ok ? await trendingResponse.json() : { items: [] };
          const topPicksData = topPicksResponse.ok ? await topPicksResponse.json() : { items: [] };
          
          const forYou = forYouData.items || [];
          const trending = trendingData.items || [];
          const topPicks = topPicksData.items || [];
          
          heroMedia = [...forYou, ...trending, ...topPicks].slice(0, 5);
        }
        
        // Convert API response to Media format if needed
        const processedMedia: Media[] = heroMedia.map((item: any) => ({
          ...item,
          id: item.id || item.mediaId || Math.floor(Math.random() * 10000),
          uuid: item.uuid || item.mediaId || `550e8400-e29b-41d4-a716-${String(item.id || Math.floor(Math.random() * 10000)).padStart(12, '0')}`,
          genres: item.genres || [],
          title: item.title || 'Untitled',
          description: item.description || 'No description available',
          type: item.type || 'movie',
          rating: item.rating || 0,
          duration: item.duration || 0,
          view_count: item.view_count || 0,
        }));
        
        setFeaturedMedia(processedMedia.length > 0 ? processedMedia : [
          {
            id: 1,
            uuid: "550e8400-e29b-41d4-a716-446655440001",
            title: "Discover Amazing Content",
            description: "Experience premium entertainment with stunning visuals and immersive storytelling tailored just for you.",
            type: "movie",
            rating: 8.5,
            duration: 7200,
            genres: [{ id: 1, name: "Entertainment" }],
            view_count: 1250,
          }
        ]);
      } catch (error) {
        console.error('Error fetching hero media:', error);
        // Fallback to default content
        setFeaturedMedia([{
          id: 1,
          uuid: "550e8400-e29b-41d4-a716-446655440001",
          title: "Welcome to HomeFlix",
          description: "Your personalized entertainment experience awaits. Discover movies and shows tailored to your taste.",
          type: "movie",
          rating: 8.5,
          duration: 7200,
          genres: [{ id: 1, name: "Entertainment" }],
          view_count: 1250,
        }]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHeroMedia();
  }, [pageType, propsFeaturedMedia]);

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
      // First try trailer path if available
      if (media.trailer_path) {
        return `/api/admin/assets/${media.trailer_path.split('/').pop()}`;
      }
      
      // Then try preview clips (shorter videos for hero section)
      if (media.uuid) {
        return `/api/preview-clips/${media.uuid}`;
      }
      
      // Fallback to full stream if no preview available
      if (media.id) {
        return `/api/stream/${media.id}`;
      }
      
      return null;
    } catch (error) {
      console.error('Error generating video URL:', error);
      return null;
    }
  };

  const getBackgroundImageUrl = (media: Media) => {
    if (!media) return '/api/thumbnails/default';
    
    // Try banner path first (best quality for hero background)
    if (media.banner_path) {
      return `/api/admin/assets/${media.banner_path.split('/').pop()}`;
    }
    
    // Try poster with UUID
    if (media.uuid && media.poster_path) {
      return `/api/posters/${media.uuid}`;
    }
    
    // Try thumbnail with UUID
    if (media.uuid) {
      return `/api/thumbnails/${media.uuid}`;
    }
    
    // Fallback to ID-based paths
    if (media.id) {
      return `/api/thumbnails/${media.id}`;
    }
    
    return '/api/thumbnails/default';
  };

  const nextSlide = () => {
    if (featuredMedia.length > 1) {
      const nextIndex = (currentIndex + 1) % featuredMedia.length;
      goToSlide(nextIndex);
    }
  };

  const prevSlide = () => {
    if (featuredMedia.length > 1) {
      const prevIndex = (currentIndex - 1 + featuredMedia.length) % featuredMedia.length;
      goToSlide(prevIndex);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      if (videoRef.current.muted) {
        videoRef.current.muted = false;
        videoRef.current.volume = 1.0;
        setIsMuted(false);
        
        if (videoRef.current.paused) {
          videoRef.current.play().catch(e => {
            console.log('ScrollXHero: Video resume failed:', e);
          });
        }
        
        muteAll();
        setCurrentAudioElement(videoRef.current);
        
        if (isALACEnabled && alacEngine) {
          initializeEnhancedAudio();
        }
      } else {
        videoRef.current.muted = true;
        setIsMuted(true);
      }
    }
  };

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

  const goToSlide = (index: number) => {
    if (index === currentIndex) return;
    
    // Pause current video before switching
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
    
    setCurrentIndex(index);
    setIsAutoPlaying(false);
    setIsVideoLoaded(false);
    setIsPlaying(false);
    
    // Resume autoplay after transition
    setTimeout(() => setIsAutoPlaying(true), 3000);
  };

  // Global interaction detector - enables audio across the entire app
  useEffect(() => {
    const enableAudioOnInteraction = () => {
      if (!hasUserInteracted) {
        setHasUserInteracted(true);
        console.log('ScrollXHero: User interaction detected - audio enabled globally');
      }
    };

    const events = ['click', 'touchstart', 'keydown'];
    events.forEach(event => {
      document.addEventListener(event, enableAudioOnInteraction, { once: true, passive: true });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, enableAudioOnInteraction);
      });
    };
  }, [hasUserInteracted]);

  // Auto-slide functionality
  useEffect(() => {
    if (!isAutoPlaying || featuredMedia.length <= 1) return;

    const slideDuration = isVideoLoaded && isPlaying ? 20000 : 12000;
    
    const interval = setInterval(() => {
      nextSlide();
    }, slideDuration);

    return () => clearInterval(interval);
  }, [isAutoPlaying, featuredMedia.length, currentIndex, isVideoLoaded, isPlaying]);

  // Cross-browser video and audio setup
  useEffect(() => {
    if (!currentMedia) return;
    
    console.log('ScrollXHero: Setting up cross-browser media for:', currentMedia.title);
    
    // Reset states for new media
    setIsVideoLoaded(false);
    setIsPlaying(false);
    setIsMuted(false);
    
    const videoUrl = getVideoUrl(currentMedia);
    
    if (!videoUrl) {
      console.log('ScrollXHero: No video URL available for:', currentMedia.title);
      return;
    }
    
    // Setup cross-browser audio when video element is ready
    const setupAudio = async () => {
      const video = videoRef.current;
      if (!video) return;
      
      try {
        const audioSuccess = await setupCrossBrowserVideo(video, currentMedia.uuid, {
          enableALAC: isALACEnabled,
          fallbackToAAC: true,
          spatialAudio: true,
          quality: 'lossless',
          maxRetries: 3,
          retryDelay: 1000
        });
        
        if (audioSuccess) {
          console.log('🎵 Cross-browser audio setup successful for:', currentMedia.title);
          muteAll();
          setCurrentAudioElement(video);
          
          if (isALACEnabled && alacEngine) {
            initializeEnhancedAudio().catch(() => {
              console.log('ScrollXHero: ALAC fallback');
            });
          }
        }
      } catch (error) {
        console.warn('Cross-browser audio setup failed:', error);
      }
    };
    
    // Setup audio after a short delay to ensure video element is ready
    const timeoutId = setTimeout(setupAudio, 100);
    
    return () => {
      clearTimeout(timeoutId);
    };
  }, [currentMedia, setCurrentAudioElement, isALACEnabled, alacEngine, initializeEnhancedAudio, muteAll]);

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

  if (isLoading) {
    return (
      <div className="relative h-screen overflow-hidden bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading amazing content...</div>
      </div>
    );
  }

  if (!currentMedia) return null;

  return (
    <motion.div 
      ref={containerRef}
      className="relative h-screen overflow-hidden"
      style={{ y, opacity }}
    >
      <ParallaxSection speed={0.5} className="relative">
        <GradientBackground variant="netflix" className="relative">
          <div 
            className="relative h-screen w-full overflow-hidden"
            onMouseEnter={() => setIsMouseOver(true)}
            onMouseLeave={() => setIsMouseOver(false)}
          >
            {/* Background Image with Netflix-style zoom animation */}
            <motion.div
              key={`bg-${currentMedia.uuid}`}
              className="absolute inset-0 w-full h-full"
              initial={{ scale: 1.05, opacity: 0 }}
              animate={{ 
                scale: isVideoLoaded && isPlaying ? 1.02 : 1.05, 
                opacity: isVideoLoaded && isPlaying ? 0 : 1 
              }}
              transition={{ duration: 2, ease: "easeOut" }}
            >
              <NetflixImage
                src={getBackgroundImageUrl(currentMedia)}
                alt={currentMedia.title}
                className="w-full h-full object-cover"
                priority="high"
                progressive={false}
                preload={true}
                fallbackSrc={`/api/thumbnails/${currentMedia.uuid}`}
                onLoad={() => {
                  // Preload next/previous items when background loads
                  preloadNearbyItems(currentIndex);
                }}
                onError={() => {
                  console.log('Background image failed to load for:', currentMedia.title);
                }}
              />
            </motion.div>
            
            {/* Background Video with Netflix-style fade in */}
            {(() => {
              const videoUrl = getVideoUrl(currentMedia);
              if (!videoUrl) return null;
              
              return (
                <motion.div
                  key={`video-${currentMedia.uuid}`}
                  className="absolute inset-0 w-full h-full"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: isVideoLoaded && isPlaying ? 1 : 0 }}
                  transition={{ duration: 1, ease: "easeInOut" }}
                >
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    className="w-full h-full object-cover"
                    autoPlay
                    muted={false}
                    loop
                    playsInline
                    preload="metadata"
                    poster={getBackgroundImageUrl(currentMedia)}
                    onLoadedData={() => {
                      console.log('ScrollXHero: Video loaded data for:', currentMedia.title);
                      setIsVideoLoaded(true);
                    }}
                    onCanPlay={() => {
                      console.log('ScrollXHero: Video can play for:', currentMedia.title);
                      const video = videoRef.current;
                      if (video && !isPlaying) {
                        video.muted = false;
                        video.volume = 1.0;
                        video.play().then(() => {
                          setIsPlaying(true);
                          console.log('ScrollXHero: Video playing with audio for:', currentMedia.title);
                          
                          // Set as current audio element
                          muteAll();
                          setCurrentAudioElement(video);
                          
                          if (isALACEnabled && alacEngine) {
                            initializeEnhancedAudio().catch(() => {
                              console.log('ScrollXHero: ALAC fallback');
                            });
                          }
                        }).catch((error) => {
                          console.error('ScrollXHero: Video play failed:', error);
                          setIsVideoLoaded(false);
                        });
                      }
                    }}
                    onError={(e) => {
                      console.error('ScrollXHero: Video error for:', currentMedia.title, e);
                      setIsVideoLoaded(false);
                      setIsPlaying(false);
                    }}
                    onLoadStart={() => {
                      console.log('ScrollXHero: Video load start for:', currentMedia.title);
                    }}
                    style={{
                      transform: isVideoLoaded && isPlaying ? 'scale(1)' : 'scale(1.02)',
                      transition: 'transform 2s ease-out'
                    }}
                  />
                </motion.div>
              );
            })()}
            
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" style={{ zIndex: 10 }} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" style={{ zIndex: 10 }} />
          </div>
        </GradientBackground>
      </ParallaxSection>

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

      {/* Content */}
      <div className="absolute inset-0 z-20 flex items-center">
        <div className="w-full max-w-none px-8 md:px-16 lg:px-24">
          <div className="max-w-2xl">
            <ScrollReveal delay={0.1}>
              <motion.div 
                key={`metadata-${currentMedia.uuid}`}
                className="flex items-center gap-4 mb-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
              >
                <div className={`px-2 py-1 text-xs font-bold rounded ${getQualityBadge().color} text-white`}>
                  {getQualityBadge().text}
                </div>
                
                {(currentMedia.release_date || currentMedia.year) && (
                  <span className="text-white font-medium">
                    {currentMedia.year || new Date(currentMedia.release_date).getFullYear()}
                  </span>
                )}
                
                <div className="border border-gray-400 px-1 text-xs text-gray-300 font-medium">
                  {getAgeRating()}
                </div>
                
                {currentMedia.duration && (
                  <span className="text-gray-300 text-sm">
                    {formatDuration(currentMedia.duration)}
                  </span>
                )}
                
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

            <ScrollReveal delay={0.2}>
              <div className="py-2">
                <DynamicTitle 
                  key={`title-${currentMedia.uuid}`}
                  media={currentMedia}
                  variant="hero"
                  pageType={pageType}
                  className="py-4 ml-4"
                />
              </div>
            </ScrollReveal>

            <ScrollReveal delay={0.3}>
              <motion.div 
                key={`genres-${currentMedia.uuid}`}
                className="flex flex-wrap gap-2 mb-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
              >
                {currentMedia.genres?.slice(0, 3).map((genre) => (
                  <span 
                    key={genre.id}
                    className="text-gray-300 text-sm bg-black/30 backdrop-blur-sm px-3 py-1 rounded-full border border-white/20"
                  >
                    {genre.name}
                  </span>
                ))}
              </motion.div>
            </ScrollReveal>

            <ScrollReveal delay={0.4}>
              <motion.p 
                key={`desc-${currentMedia.uuid}`}
                className="text-lg md:text-xl text-gray-200 mb-8 max-w-2xl leading-relaxed px-4 py-2"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
              >
                {currentMedia.description || "Experience premium entertainment with stunning visuals and immersive storytelling."}
              </motion.p>
            </ScrollReveal>

            <ScrollReveal delay={0.5}>
              <motion.div 
                className="flex items-center gap-4 mb-6"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.5 }}
              >
                <button
                  onClick={handlePlay}
                  className="bg-transparent border-2 border-white text-white px-8 py-3 rounded-md font-bold text-lg hover:bg-white/10 transition-colors duration-300 flex items-center gap-2 backdrop-blur-sm"
                >
                  <Play className="w-6 h-6 fill-current" />
                  Play
                </button>

                <button
                  onClick={handleInfo}
                  className="bg-transparent border-2 border-gray-400 text-white px-8 py-3 rounded-md font-bold text-lg hover:bg-gray-400/10 transition-colors duration-300 flex items-center gap-2 backdrop-blur-sm"
                >
                  <Info className="w-6 h-6" />
                  More Info
                </button>
                
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