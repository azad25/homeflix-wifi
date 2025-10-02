"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Play, Info, Plus, VolumeX, Volume2, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Media } from '../types/media';
import { getApiUrl } from '../lib/api';

interface NetflixHeroSectionProps {
  featuredMedia?: Media[];
  onPlay: (media: Media) => void;
  onInfo: (media: Media) => void;
}

const NetflixHeroSection: React.FC<NetflixHeroSectionProps> = ({
  featuredMedia = [],
  onPlay,
  onInfo,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const currentMedia = featuredMedia[currentIndex] || featuredMedia[0];

  const getVideoUrl = (media: Media) => {
    if (media.trailer_path) {
      const apiUrl = getApiUrl();
    return `${apiUrl}/api/admin/assets/${media.trailer_path.split('/').pop()}`;
    }
    const apiUrl = getApiUrl();
    return `${apiUrl}/api/preview-clips/${media.uuid}`;
  };

  const getBackgroundImageUrl = (media: Media) => {
    const apiUrl = getApiUrl();
    if (media.banner_path) {
      return `${apiUrl}/api/admin/assets/${media.banner_path.split('/').pop()}`;
    }
    return getThumbnailUrl(media);
  };

  const getThumbnailUrl = (media: Media) => {
    const apiUrl = getApiUrl();
    if (media.poster_path) {
      return `${apiUrl}/api/posters/${media.uuid}`;
    }
    return `${apiUrl}/api/thumbnails/${media.uuid}`;
  };

  const nextSlide = () => {
    if (featuredMedia.length > 1) {
      setCurrentIndex((prev) => (prev + 1) % featuredMedia.length);
      setIsVideoLoaded(false);
      setIsPlaying(false);
    }
  };

  const prevSlide = () => {
    if (featuredMedia.length > 1) {
      setCurrentIndex((prev) => (prev - 1 + featuredMedia.length) % featuredMedia.length);
      setIsVideoLoaded(false);
      setIsPlaying(false);
    }
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
    setIsAutoPlaying(false);
    setIsVideoLoaded(false);
    setIsPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 5000);
  };

  // Auto-slide functionality
  useEffect(() => {
    if (!isAutoPlaying || featuredMedia.length <= 1) return;

    const interval = setInterval(() => {
      nextSlide();
    }, 15000); // Change slide every 15 seconds (Netflix-like timing)

    return () => clearInterval(interval);
  }, [isAutoPlaying, featuredMedia.length, currentIndex]);

  // Video loading and playback
  useEffect(() => {
    if (videoRef.current && currentMedia) {
      const video = videoRef.current;
      
      const handleLoadedData = () => {
        setIsVideoLoaded(true);
        // Auto-play after 3 seconds (Netflix behavior)
        setTimeout(() => {
          if (video && !video.paused) return;
          video.play().then(() => {
            setIsPlaying(true);
          }).catch(() => {
            // Fallback to image if video fails
            setIsVideoLoaded(false);
          });
        }, 3000);
      };

      const handleError = () => {
        setIsVideoLoaded(false);
        setIsPlaying(false);
      };

      video.addEventListener('loadeddata', handleLoadedData);
      video.addEventListener('error', handleError);

      return () => {
        video.removeEventListener('loadeddata', handleLoadedData);
        video.removeEventListener('error', handleError);
      };
    }
  }, [currentMedia, currentIndex]);

  // Hide controls after inactivity
  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setShowControls(false), 3000);
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleMouseEnter = () => {
    setIsAutoPlaying(false);
    setShowControls(true);
  };

  const handleMouseLeave = () => {
    setIsAutoPlaying(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setShowControls(false), 1000);
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  if (!currentMedia) {
    return (
      <div className="relative h-screen w-full overflow-hidden bg-gradient-to-br from-red-900 via-black to-gray-900 flex items-center justify-center">
        <h1 className="text-white text-4xl font-bold">Loading...</h1>
      </div>
    );
  }

  return (
    <div 
      className="relative h-screen w-full overflow-hidden cursor-default"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Background Video/Image */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          {/* Background Image (always present) */}
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: `url(${getBackgroundImageUrl(currentMedia)})`,
            }}
          />
          
          {/* Background Video (Netflix-style) */}
          {isVideoLoaded && (
            <video
              ref={videoRef}
              src={getVideoUrl(currentMedia)}
              className="absolute inset-0 w-full h-full object-cover"
              muted={isMuted}
              loop
              playsInline
              preload="metadata"
            />
          )}
          
          {/* Gradient overlays for better text readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/80" />
        </motion.div>
      </AnimatePresence>

      {/* Navigation Arrows */}
      {featuredMedia.length > 1 && showControls && (
        <>
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={prevSlide}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 bg-black/50 text-white p-3 rounded-full hover:bg-black/70 transition-all duration-200 cursor-pointer"
          >
            <ChevronLeft className="w-6 h-6" />
          </motion.button>
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={nextSlide}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 bg-black/50 text-white p-3 rounded-full hover:bg-black/70 transition-all duration-200 cursor-pointer"
          >
            <ChevronRight className="w-6 h-6" />
          </motion.button>
        </>
      )}

      {/* Content */}
      <div className="relative z-10 flex flex-col justify-center h-full px-8 md:px-16 lg:px-24">
        <div className="max-w-2xl">
          {/* Title */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`title-${currentIndex}`}
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-4 drop-shadow-2xl">
                {currentMedia.title}
              </h1>
            </motion.div>
          </AnimatePresence>

          {/* Metadata */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`metadata-${currentIndex}`}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="flex items-center gap-4 text-white/90 mb-6"
            >
              <span className="bg-red-600 text-white px-3 py-1 rounded text-sm font-bold">
                {currentMedia.type.toUpperCase()}
              </span>
              <span className="flex items-center gap-1 text-green-400 font-semibold">
                ⭐ {currentMedia.rating || 8.5}
              </span>
              <span className="text-white/80">{formatDuration(currentMedia.duration || 7200)}</span>
              <span className="text-white/80">{new Date().getFullYear()}</span>
              <span className="text-green-400 font-medium">
                {(currentMedia.view_count || 0).toLocaleString()} views
              </span>
            </motion.div>
          </AnimatePresence>

          {/* Genres */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`genres-${currentIndex}`}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.8, delay: 0.5 }}
              className="flex flex-wrap gap-2 mb-6"
            >
              {(currentMedia.genres || []).slice(0, 3).map((genre, index) => (
                <span
                  key={index}
                  className="text-white/80 text-sm border border-white/40 px-3 py-1 rounded-full backdrop-blur-sm"
                >
                  {genre.name}
                </span>
              ))}
            </motion.div>
          </AnimatePresence>

          {/* Description */}
          <AnimatePresence mode="wait">
            <motion.p
              key={`description-${currentIndex}`}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="text-white/90 text-lg leading-relaxed mb-8 max-w-xl drop-shadow-lg"
            >
              {currentMedia.description || 
               "Experience the ultimate entertainment with this amazing content. Watch now and immerse yourself in a world of endless possibilities."}
            </motion.p>
          </AnimatePresence>

          {/* Action Buttons */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`buttons-${currentIndex}`}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.8, delay: 0.8 }}
              className="flex gap-4"
            >
              <button
                onClick={() => onPlay(currentMedia)}
                className="flex items-center gap-3 bg-white text-black px-8 py-3 rounded-lg font-bold hover:bg-white/90 transition-all duration-200 hover:scale-105 cursor-pointer shadow-lg"
              >
                <Play className="w-5 h-5 fill-current" />
                Play
              </button>
              
              <button
                onClick={() => onInfo(currentMedia)}
                className="flex items-center gap-3 bg-gray-600/80 text-white px-8 py-3 rounded-lg font-bold hover:bg-gray-600 transition-all duration-200 hover:scale-105 cursor-pointer backdrop-blur-sm"
              >
                <Info className="w-5 h-5" />
                More Info
              </button>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Volume Control */}
      {isPlaying && showControls && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={toggleMute}
          className="absolute bottom-8 right-8 bg-black/50 text-white p-3 rounded-full hover:bg-black/70 transition-colors cursor-pointer backdrop-blur-sm"
        >
          {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
        </motion.button>
      )}

      {/* Slide Indicators */}
      {featuredMedia.length > 1 && showControls && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2"
        >
          {featuredMedia.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`h-1 transition-all duration-300 cursor-pointer ${
                index === currentIndex 
                  ? 'bg-red-600 w-8' 
                  : 'bg-white/40 hover:bg-white/60 w-6'
              }`}
            />
          ))}
        </motion.div>
      )}

      {/* Progress Bar for Auto-play */}
      {featuredMedia.length > 1 && isAutoPlaying && showControls && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute bottom-12 left-1/2 -translate-x-1/2 w-64 h-1 bg-white/20 rounded-full overflow-hidden"
        >
          <motion.div
            key={currentIndex}
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 15, ease: 'linear' }}
            className="h-full bg-red-600 rounded-full"
          />
        </motion.div>
      )}
    </div>
  );
};

export default NetflixHeroSection;
