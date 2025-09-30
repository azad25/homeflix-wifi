"use client";

import React, { useState, useEffect } from 'react';
import { Play, Info, Plus, ChevronLeft, ChevronRight, VolumeX, Volume2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { Media } from '../types/media';
import { getApiUrl } from '../lib/api';
import DynamicTitle from './DynamicTitle';

interface HeroSectionProps {
  featuredMedia?: Media[];
  onPlay: (media: Media) => void;
  onInfo: (media: Media) => void;
}

const HeroSection: React.FC<HeroSectionProps> = ({
  featuredMedia = [],
  onPlay,
  onInfo,
}) => {
  const [isMuted, setIsMuted] = useState(true);
  const [imageError, setImageError] = useState<{[key: number]: boolean}>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  const currentMedia = featuredMedia[currentIndex] || featuredMedia[0];

  const getHeroImageUrl = (media: Media) => {
    // Priority: banner -> poster -> thumbnail
    if (media.banner_path) {
      return `${getApiUrl()}/api/admin/assets/${media.banner_path.split('/').pop()}`;
    }
    if (media.poster_path) {
      return `${getApiUrl()}/api/posters/${media.id}`;
    }
    return `${getApiUrl()}/api/thumbnails/${media.id}`;
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
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

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 5000);
  };

  // Auto-slide functionality
  useEffect(() => {
    if (!isAutoPlaying || featuredMedia.length <= 1) return;

    const interval = setInterval(() => {
      nextSlide();
    }, 8000); // Change slide every 8 seconds

    return () => clearInterval(interval);
  }, [isAutoPlaying, featuredMedia.length]);

  // Pause auto-play on hover
  const handleMouseEnter = () => setIsAutoPlaying(false);
  const handleMouseLeave = () => setIsAutoPlaying(true);

  if (!currentMedia) {
    return (
      <div className="relative h-screen w-full overflow-hidden bg-gradient-to-br from-red-900 via-black to-gray-900 flex items-center justify-center">
        <h1 className="text-white text-4xl font-bold">Loading...</h1>
      </div>
    );
  }

  return (
    <div 
      className="relative h-screen w-full overflow-hidden"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Background Images with Smooth Transitions */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 1.2, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          {!imageError[currentMedia.id] ? (
            <Image
              src={getHeroImageUrl(currentMedia)}
              alt={currentMedia.title}
              fill
              className="object-cover"
              priority={currentIndex === 0}
              onError={() => setImageError(prev => ({ ...prev, [currentMedia.id]: true }))}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-red-900 via-black to-gray-900" />
          )}
          
          {/* Gradient overlays */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        </motion.div>
      </AnimatePresence>

      {/* Navigation Arrows */}
      {featuredMedia.length > 1 && (
        <>
          <button
            onClick={prevSlide}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 bg-black/50 text-white p-3 rounded-full hover:bg-black/70 transition-all duration-200 opacity-0 hover:opacity-100 group-hover:opacity-100"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={nextSlide}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 bg-black/50 text-white p-3 rounded-full hover:bg-black/70 transition-all duration-200 opacity-0 hover:opacity-100 group-hover:opacity-100"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Content */}
      <div className="relative z-10 flex flex-col justify-center h-full px-8 md:px-16 lg:px-24">
        <div className="max-w-2xl">
          {/* Dynamic Title */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`title-${currentIndex}`}
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <DynamicTitle media={currentMedia} className="mb-4" />
            </motion.div>
          </AnimatePresence>

          {/* Tagline */}
          {currentMedia.tagline && (
            <AnimatePresence mode="wait">
              <motion.p
                key={`tagline-${currentIndex}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="text-xl text-white/90 italic mb-4"
              >
                &ldquo;{currentMedia.tagline}&rdquo;
              </motion.p>
            </AnimatePresence>
          )}

          {/* Metadata */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`metadata-${currentIndex}`}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="flex items-center gap-4 text-white/80 mb-6"
            >
              <span className="bg-red-600 text-white px-2 py-1 rounded text-sm font-semibold">
                {currentMedia.type.toUpperCase()}
              </span>
              {currentMedia.quality && (
                <span className="bg-blue-600 text-white px-2 py-1 rounded text-sm font-semibold">
                  {currentMedia.quality}
                </span>
              )}
              <span className="text-2xl font-bold text-white/90">
                &ldquo;Experience cinema like never before&rdquo;
              </span>
              <span>{formatDuration(currentMedia.duration || 7200)}</span>
              <span>{currentMedia.year || new Date().getFullYear()}</span>
              {currentMedia.country && (
                <span className="text-blue-400">• {currentMedia.country}</span>
              )}
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
              {(currentMedia.genre_names || currentMedia.genres?.map(g => g.name) || []).slice(0, 3).map((genre, index) => (
                <span
                  key={index}
                  className="text-white/70 text-sm border border-white/30 px-3 py-1 rounded-full"
                >
                  {typeof genre === 'string' ? genre : genre}
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
              className="text-white/90 text-lg leading-relaxed mb-8 max-w-xl"
            >
              {currentMedia.long_desc || currentMedia.short_desc || currentMedia.description || 
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
                className="flex items-center gap-3 bg-white text-black px-8 py-3 rounded-lg font-semibold hover:bg-white/90 transition-all duration-200 hover:scale-105"
              >
                <Play className="w-5 h-5 fill-current" />
                Play
              </button>
              
              <button
                onClick={() => onInfo(currentMedia)}
                className="flex items-center gap-3 bg-gray-600/80 text-white px-8 py-3 rounded-lg font-semibold hover:bg-gray-600 transition-all duration-200 hover:scale-105"
              >
                <Info className="w-5 h-5" />
                More Info
              </button>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Volume Control */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 1 }}
        onClick={() => setIsMuted(!isMuted)}
        className="absolute bottom-8 right-8 bg-black/50 text-white p-3 rounded-full hover:bg-black/70 transition-colors"
      >
        {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
      </motion.button>

      {/* Slide Indicators */}
      {featuredMedia.length > 1 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2"
        >
          {featuredMedia.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                index === currentIndex 
                  ? 'bg-red-600 scale-125' 
                  : 'bg-white/40 hover:bg-white/60'
              }`}
            />
          ))}
        </motion.div>
      )}

      {/* Progress Bar */}
      {featuredMedia.length > 1 && isAutoPlaying && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute bottom-20 left-1/2 -translate-x-1/2 w-64 h-1 bg-white/20 rounded-full overflow-hidden"
        >
          <motion.div
            key={currentIndex}
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 8, ease: 'linear' }}
            className="h-full bg-red-600 rounded-full"
          />
        </motion.div>
      )}
    </div>
  );
};

export default HeroSection;
