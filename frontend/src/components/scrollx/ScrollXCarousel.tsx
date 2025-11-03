"use client";

import React, { useRef, useState, useEffect } from "react";
import { motion, useScroll, useTransform } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Media } from '../../types/media';
import ScrollReveal from './ScrollReveal';
import GlassCard from './GlassCard';
import MagneticButton from './MagneticButton';

interface ScrollXCarouselProps {
  title: string;
  media: Media[];
  onPlay: (media: Media) => void;
  onInfo: (media: Media) => void;
  priority?: boolean;
  variant?: 'glass' | 'solid' | 'gradient';
}

const ScrollXCarousel: React.FC<ScrollXCarouselProps> = ({
  title,
  media,
  onPlay,
  onInfo,
  priority = false,
  variant = 'glass'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [isCardHovered, setIsCardHovered] = useState(false);
  const [audioContextResumed, setAudioContextResumed] = useState(false);

  // Resume audio context on first user interaction
  const resumeAudioContext = async () => {
    if (audioContextResumed) return;
    
    try {
      if (typeof window !== 'undefined' && 'AudioContext' in window) {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
          setAudioContextResumed(true);
          console.log('Audio context resumed');
        }
      }
    } catch (error) {
      console.warn('Failed to resume audio context:', error);
    }
  };

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  const y = useTransform(scrollYProgress, [0, 1], [0, -50]);
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);

  const itemWidth = 320;
  const gap = 16;
  const scrollAmount = itemWidth * 4 + gap * 3;

  const updateScrollButtons = () => {
    if (!scrollRef.current) return;
    
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  };

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;

    const newScrollLeft = scrollRef.current.scrollLeft + 
      (direction === "left" ? -scrollAmount : scrollAmount);

    scrollRef.current.scrollTo({
      left: newScrollLeft,
      behavior: "smooth",
    });

    setTimeout(updateScrollButtons, 300);
  };

  useEffect(() => {
    updateScrollButtons();
    const handleResize = () => updateScrollButtons();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [media]);

  if (!media || media.length === 0) return null;

  return (
    <motion.div 
      ref={containerRef}
      style={{ y, opacity }}
      className="relative mb-16"
      onMouseEnter={() => {
        setIsHovered(true);
        resumeAudioContext();
      }}
      onMouseLeave={() => setIsHovered(false)}
      onClick={resumeAudioContext}
    >
      <ScrollReveal direction="left" delay={0.1}>
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-6 px-4 md:px-12 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
          {title}
        </h2>
      </ScrollReveal>
      
      <div className="relative">
        {/* Left scroll button */}
        {canScrollLeft && (
          <motion.div
            className="absolute left-2 top-0 bottom-0 z-20 flex items-center"
            initial={{ opacity: 0, x: -20 }}
            animate={{ 
              opacity: isHovered ? 1 : 0,
              x: isHovered ? 0 : -20
            }}
            transition={{ duration: 0.3 }}
          >
            <MagneticButton
              onClick={() => scroll("left")}
              className="bg-black/80 backdrop-blur-md text-white p-3 rounded-full hover:bg-black/90 transition-all duration-300 border border-white/20"
            >
              <ChevronLeft className="w-6 h-6" />
            </MagneticButton>
          </motion.div>
        )}

        {/* Right scroll button */}
        {canScrollRight && (
          <motion.div
            className="absolute right-2 top-0 bottom-0 z-20 flex items-center"
            initial={{ opacity: 0, x: 20 }}
            animate={{ 
              opacity: isHovered ? 1 : 0,
              x: isHovered ? 0 : 20
            }}
            transition={{ duration: 0.3 }}
          >
            <MagneticButton
              onClick={() => scroll("right")}
              className="bg-black/80 backdrop-blur-md text-white p-3 rounded-full hover:bg-black/90 transition-all duration-300 border border-white/20"
            >
              <ChevronRight className="w-6 h-6" />
            </MagneticButton>
          </motion.div>
        )}

        {/* Carousel container */}
        <div
          ref={scrollRef}
          onScroll={updateScrollButtons}
          className="flex gap-4 overflow-x-auto scrollbar-hide px-4 md:px-12 pb-4"
          style={{ 
            scrollbarWidth: "none", 
            msOverflowStyle: "none",
            scrollSnapType: "x mandatory"
          }}
        >
          {media.map((mediaItem, index) => (
            <ScrollReveal
              key={mediaItem.id}
              direction="up"
              delay={index * 0.1}
              className="flex-shrink-0"
              style={{ 
                width: `${itemWidth}px`,
                scrollSnapAlign: "start"
              }}
            >
              <ScrollXMediaCard
                media={mediaItem}
                onPlay={onPlay}
                onInfo={onInfo}
                priority={priority && index < 4}
                variant={variant}
              />
            </ScrollReveal>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

interface ScrollXMediaCardProps {
  media: Media;
  onPlay: (media: Media) => void;
  onInfo: (media: Media) => void;
  priority?: boolean;
  variant?: 'glass' | 'solid' | 'gradient';
}

const ScrollXMediaCard: React.FC<ScrollXMediaCardProps> = ({
  media,
  onPlay,
  onInfo,
  priority = false,
  variant = 'glass'
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isPlayLoading, setIsPlayLoading] = useState(false);
  const [isInfoLoading, setIsInfoLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasTriedAutoplay, setHasTriedAutoplay] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Auto-play audio when card comes into view
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
        if (entry.isIntersecting && !hasTriedAutoplay && priority) {
          // Try to auto-play for priority items (first few cards)
          tryAutoPlay();
        }
      },
      { threshold: 0.5 }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [hasTriedAutoplay, priority]);

  // Auto-play on hover for non-priority items
  useEffect(() => {
    if (isHovered && !hasTriedAutoplay && !priority) {
      tryAutoPlay();
    }
  }, [isHovered, hasTriedAutoplay, priority]);

  const tryAutoPlay = async () => {
    if (hasTriedAutoplay || audioRef.current) return;
    
    setHasTriedAutoplay(true);
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const mediaUrl = `${apiUrl}/api/stream/${media.id}`;
      
      // Strategy 1: Try direct audio play
      const audio = new Audio(mediaUrl);
      audio.volume = 1.0;
      audio.preload = 'auto';
      audio.crossOrigin = 'anonymous';
      audio.muted = false;
      audio.defaultMuted = false;
      
      // Force audio context resume (helps with Chrome autoplay policy)
      if (typeof window !== 'undefined' && 'AudioContext' in window) {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        if (audioContext.state === 'suspended') {
          try {
            await audioContext.resume();
          } catch (e) {
            console.warn('AudioContext resume failed:', e);
          }
        }
      }
      
      audioRef.current = audio;
      
      // Add event listeners
      audio.addEventListener('play', () => setIsPlaying(true));
      audio.addEventListener('pause', () => setIsPlaying(false));
      audio.addEventListener('ended', () => setIsPlaying(false));
      audio.addEventListener('error', () => {
        console.warn('Audio failed to load for:', media.title);
        setIsPlaying(false);
      });
      
      // Strategy 2: Start muted then unmute (more likely to work)
      audio.muted = true;
      await audio.play();
      
      // Immediately unmute for full volume
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.muted = false;
          audioRef.current.volume = 1.0;
        }
      }, 100);
      
      // Auto-stop after 3 seconds to preview
      setTimeout(() => {
        if (audioRef.current && isPlaying) {
          audioRef.current.pause();
          setIsPlaying(false);
        }
      }, 3000);
      
    } catch (error) {
      console.warn('Auto-play failed for:', media.title, error);
      
      // Strategy 3: Fallback - preload for instant play on user interaction
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
        const mediaUrl = `${apiUrl}/api/stream/${media.id}`;
        const audio = new Audio(mediaUrl);
        audio.preload = 'auto';
        audio.volume = 1.0;
        audioRef.current = audio;
      } catch (preloadError) {
        console.warn('Preload also failed:', preloadError);
      }
      
      setIsPlaying(false);
    }
  };

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setIsPlaying(false);
    };
  }, []);

  const getThumbnailUrl = () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
    return `${apiUrl}/api/thumbnails/${media.id}`;
  };

  const handlePlay = async () => {
    setIsPlayLoading(true);
    try {
      // If audio is already loaded and playing, just navigate to player
      if (audioRef.current && isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
        onPlay(media);
        return;
      }

      // If audio exists but not playing, try to play it
      if (audioRef.current) {
        try {
          await audioRef.current.play();
          setTimeout(() => {
            if (audioRef.current) {
              audioRef.current.pause();
              setIsPlaying(false);
            }
            onPlay(media);
          }, 2000);
          return;
        } catch (error) {
          console.warn('Failed to play existing audio:', error);
        }
      }

      // Create new audio element
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const mediaUrl = `${apiUrl}/api/stream/${media.id}`;
      
      const audio = new Audio(mediaUrl);
      audio.volume = 1.0;
      audio.preload = 'auto';
      audio.crossOrigin = 'anonymous';
      audio.muted = false;
      audio.defaultMuted = false;
      audioRef.current = audio;
      
      // Add event listeners
      audio.addEventListener('play', () => setIsPlaying(true));
      audio.addEventListener('pause', () => setIsPlaying(false));
      audio.addEventListener('ended', () => setIsPlaying(false));
      
      try {
        await audio.play();
        
        // Brief preview then navigate to full player
        setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.pause();
            setIsPlaying(false);
          }
          onPlay(media);
        }, 2000);
        
      } catch (error) {
        console.warn('Playback failed, navigating to info:', error);
        await onInfo(media);
      }
      
    } catch (error) {
      console.error('Error in handlePlay:', error);
      await onInfo(media);
    } finally {
      setTimeout(() => setIsPlayLoading(false), 1000);
    }
  };

  const handleInfo = async () => {
    setIsInfoLoading(true);
    try {
      await onInfo(media);
    } finally {
      setTimeout(() => setIsInfoLoading(false), 500);
    }
  };

  const cardVariants = {
    glass: "bg-white/10 backdrop-blur-md border border-white/20",
    solid: "bg-gray-900 border border-gray-700",
    gradient: "bg-gradient-to-br from-purple-900/50 to-blue-900/50 backdrop-blur-md border border-white/20"
  };

  return (
    <motion.div
      ref={cardRef}
      className="relative group cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ scale: 1.05, y: -10 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <GlassCard
        className={`overflow-hidden ${cardVariants[variant]}`}
        hover={false}
      >
        {/* Image */}
        <div className="relative aspect-video overflow-hidden">
          {!imageError ? (
            <motion.img
              src={getThumbnailUrl()}
              alt={media.title}
              className="w-full h-full object-cover"
              loading={priority ? "eager" : "lazy"}
              onError={() => setImageError(true)}
              whileHover={{ scale: 1.1 }}
              transition={{ duration: 0.3 }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900 flex items-center justify-center">
              <div className="text-white text-center">
                <div className="text-3xl mb-2">🎬</div>
                <div className="text-sm font-medium">{media.title}</div>
              </div>
            </div>
          )}
          
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
          
          {/* Audio playing indicator */}
          {isPlaying && (
            <motion.div
              className="absolute top-3 right-3 bg-green-500/90 backdrop-blur-sm text-white px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              AUTO-PLAYING
            </motion.div>
          )}
          
          {/* In view indicator for priority items */}
          {isInView && priority && !isPlaying && hasTriedAutoplay && (
            <motion.div
              className="absolute top-3 left-3 bg-blue-500/90 backdrop-blur-sm text-white px-2 py-1 rounded-full text-xs font-bold"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              PRIORITY
            </motion.div>
          )}
          
          {/* Hover overlay */}
          <motion.div
            className="absolute inset-0 bg-black/40 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: isHovered ? 1 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <MagneticButton
              onClick={handlePlay}
              disabled={isPlayLoading}
              className={`backdrop-blur-sm text-white p-4 rounded-full transition-all duration-200 cursor-pointer ${
                isPlaying 
                  ? 'bg-green-500/30 border-2 border-green-400' 
                  : 'bg-white/20 hover:bg-white/30'
              } ${
                isPlayLoading ? 'opacity-75 cursor-wait' : 'hover:cursor-pointer'
              }`}
            >
              {isPlayLoading ? (
                <div className="w-6 h-6 animate-spin">
                  <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                </div>
              ) : isPlaying ? (
                <div className="w-6 h-6 flex items-center justify-center">
                  <div className="flex gap-1">
                    <div className="w-1 h-4 bg-white animate-pulse"></div>
                    <div className="w-1 h-4 bg-white animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-1 h-4 bg-white animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              ) : (
                <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              )}
            </MagneticButton>
          </motion.div>
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="text-white font-bold text-lg mb-2 line-clamp-1">
            {media.title}
          </h3>
          
          <div className="flex items-center gap-2 mb-2 text-sm">
            <span className="text-green-400 font-semibold">
              ⭐ {(media.rating || 8.5).toFixed(1)}
            </span>
            <span className="text-gray-400">•</span>
            <span className="text-gray-400 capitalize">{media.type}</span>
            {media.view_count && (
              <>
                <span className="text-gray-400">•</span>
                <span className="text-gray-400">{media.view_count} views</span>
              </>
            )}
          </div>

          {/* Genres */}
          {media.genres && media.genres.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {media.genres.slice(0, 2).map((genre, index) => (
                <span
                  key={genre.id || index}
                  className="text-xs text-gray-300 bg-white/10 px-2 py-1 rounded-full backdrop-blur-sm"
                >
                  {genre.name}
                </span>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <MagneticButton
              onClick={handlePlay}
              disabled={isPlayLoading}
              className={`flex-1 bg-white text-black px-4 py-2 rounded-lg font-bold transition-all duration-200 text-sm flex items-center justify-center ${
                isPlayLoading 
                  ? 'opacity-75 cursor-wait bg-gray-200' 
                  : 'hover:bg-gray-200 hover:cursor-pointer cursor-pointer'
              }`}
            >
              {isPlayLoading ? (
                <>
                  <div className="w-4 h-4 animate-spin mr-2">
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                  </div>
                  Loading...
                </>
              ) : (
                'Play'
              )}
            </MagneticButton>
            <MagneticButton
              onClick={handleInfo}
              disabled={isInfoLoading}
              className={`bg-gray-700/80 backdrop-blur-sm text-white px-4 py-2 rounded-lg transition-all duration-200 text-sm flex items-center justify-center ${
                isInfoLoading 
                  ? 'opacity-75 cursor-wait bg-gray-600' 
                  : 'hover:bg-gray-600 hover:cursor-pointer cursor-pointer'
              }`}
            >
              {isInfoLoading ? (
                <>
                  <div className="w-4 h-4 animate-spin mr-2">
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                  </div>
                  Loading...
                </>
              ) : (
                'Info'
              )}
            </MagneticButton>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
};

export default ScrollXCarousel;
