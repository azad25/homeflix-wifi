"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { Play, Info, ChevronLeft, ChevronRight, Volume2, VolumeX } from 'lucide-react';
import { Media } from '@/types/media';
import { getApiUrl } from '@/lib/api';
import { MagneticButton, GradientBackground, ParallaxSection, ParticleField } from './index';
import { useAudio } from '@/contexts/AudioContext';

interface ScrollXHeroProps {
  featuredMedia: Media[];
  onPlay: (media: Media) => void;
  onInfo: (media: Media) => void;
}

const ScrollXHero: React.FC<ScrollXHeroProps> = ({
  featuredMedia,
  onPlay,
  onInfo,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false); // Start with sound enabled
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isPlayButtonLoading, setIsPlayButtonLoading] = useState(false);
  const [isInfoButtonLoading, setIsInfoButtonLoading] = useState(false);
  const [isMouseOver, setIsMouseOver] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { setCurrentAudioElement, muteAll } = useAudio();

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  });

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
      const newMutedState = !isMuted;
      setIsMuted(newMutedState);
      if (newMutedState) {
        // Mute this video and remove from audio context
        videoRef.current.muted = true;
        videoRef.current.volume = 0;
        setCurrentAudioElement(null);
      } else {
        // Unmute this video and set as current audio source
        muteAll(); // Mute any other playing audio first
        videoRef.current.muted = false;
        videoRef.current.volume = 0.3;
        setCurrentAudioElement(videoRef.current);
      }
    }
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
            setIsVideoLoaded(true);
            // Register this video as the current audio source
            setCurrentAudioElement(video);
            // Start video playback - try with sound first, fallback to muted
            video.muted = false;
            video.volume = 0.3;
            video.play().then(() => {
              setIsPlaying(true);
            }).catch((error) => {
              // Fallback to muted autoplay if sound fails
              console.warn('Video autoplay with sound failed, trying muted:', error);
              video.muted = true;
              video.play().then(() => {
                setIsPlaying(true);
              }).catch(() => {
                setIsVideoLoaded(false);
                setIsPlaying(false);
              });
            });
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
              // Try with sound first
              video.muted = false;
              video.volume = 0.3;
              video.play().then(() => {
                setIsPlaying(true);
              }).catch(() => {
                // Fallback to muted
                video.muted = true;
                video.play().then(() => {
                  setIsPlaying(true);
                }).catch(() => {
                  setIsVideoLoaded(false);
                  setIsPlaying(false);
                });
              });
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
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
                isVideoLoaded && isPlaying ? 'opacity-100' : 'opacity-0'
              }`}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              style={{ zIndex: 1 }}
            >
              <source src={getVideoUrl(currentMedia)} type="video/mp4" />
            </video>
            
            {/* Gradient overlays */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" style={{ zIndex: 2 }} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" style={{ zIndex: 2 }} />
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

      {/* Volume control */}
      {isVideoLoaded && isPlaying && (
        <motion.div
          className="absolute top-8 right-8 z-20"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: showControls ? 1 : 0, scale: showControls ? 1 : 0.8 }}
          transition={{ duration: 0.3 }}
        >
          <MagneticButton
            onClick={toggleMute}
            className="bg-black/50 backdrop-blur-md text-white p-3 rounded-full hover:bg-black/70 transition-all duration-300 border border-white/20"
          >
            {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
          </MagneticButton>
        </motion.div>
      )}

      {/* Content */}
      <div className="relative z-10 flex flex-col justify-center h-full px-8 md:px-16 lg:px-24">
        <div className="max-w-4xl">
          {/* Title */}
          <motion.h1
            key={currentMedia.id}
            className="text-5xl md:text-7xl lg:text-8xl font-bold text-white mb-6 drop-shadow-2xl bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent"
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
          >
            {currentMedia.title}
          </motion.h1>

          {/* Metadata */}
          <motion.div
            className="flex items-center gap-4 text-white/90 mb-6"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <span className="bg-red-600 text-white px-3 py-1 rounded text-sm font-bold">
              {currentMedia.type.toUpperCase()}
            </span>
            <span className="flex items-center gap-1 text-green-400 font-semibold">
              ⭐ {currentMedia.rating || 8.5}
            </span>
            <span className="text-white/80">{new Date().getFullYear()}</span>
            <span className="text-green-400 font-medium">
              {(currentMedia.view_count || 0).toLocaleString()} views
            </span>
          </motion.div>

          {/* Genres */}
          <motion.div
            className="flex flex-wrap gap-2 mb-6"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            {(currentMedia.genres || []).slice(0, 4).map((genre, index) => (
              <span
                key={index}
                className="text-white/80 text-sm border border-white/40 px-3 py-1 rounded-full backdrop-blur-sm bg-white/10"
              >
                {genre.name}
              </span>
            ))}
          </motion.div>

          {/* Description */}
          <motion.p
            className="text-white/90 text-lg md:text-xl leading-relaxed mb-8 max-w-3xl drop-shadow-lg"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
          >
            {currentMedia.description || "Experience the ultimate entertainment with this amazing content. Watch now and immerse yourself in a world of endless possibilities."}
          </motion.p>

          {/* Action buttons */}
          <motion.div
            className="flex flex-wrap gap-4"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1 }}
          >
            <MagneticButton
              onClick={handlePlay}
              disabled={isPlayButtonLoading}
              className={`flex items-center gap-3 px-8 py-4 rounded-xl font-bold transition-all duration-300 shadow-2xl ${
                isPlayButtonLoading 
                  ? 'bg-gray-200 text-gray-600 cursor-wait' 
                  : 'bg-white text-black hover:bg-white/90 hover:cursor-pointer cursor-pointer'
              }`}
            >
              {isPlayButtonLoading ? (
                <>
                  <div className="w-6 h-6 animate-spin">
                    <svg className="w-6 h-6" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                  </div>
                  Loading...
                </>
              ) : (
                <>
                  <Play className="w-6 h-6 fill-current" />
                  Play Now
                </>
              )}
            </MagneticButton>
            
            <MagneticButton
              onClick={handleInfo}
              disabled={isInfoButtonLoading}
              className={`flex items-center gap-3 px-8 py-4 rounded-xl font-bold transition-all duration-300 border border-white/20 ${
                isInfoButtonLoading 
                  ? 'bg-gray-700 text-gray-400 cursor-wait' 
                  : 'bg-gray-600/80 backdrop-blur-md text-white hover:bg-gray-600 hover:cursor-pointer cursor-pointer'
              }`}
            >
              {isInfoButtonLoading ? (
                <>
                  <div className="w-6 h-6 animate-spin">
                    <svg className="w-6 h-6" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                  </div>
                  Loading...
                </>
              ) : (
                <>
                  <Info className="w-6 h-6" />
                  More Info
                </>
              )}
            </MagneticButton>
          </motion.div>
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
