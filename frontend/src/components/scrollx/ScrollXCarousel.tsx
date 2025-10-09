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
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
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

  const getThumbnailUrl = () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
    return `${apiUrl}/api/thumbnails/${media.id}`;
  };

  const handlePlay = async () => {
    setIsPlayLoading(true);
    try {
      await onPlay(media);
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
              className={`bg-white/20 backdrop-blur-sm text-white p-4 rounded-full hover:bg-white/30 transition-all duration-200 cursor-pointer ${
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
              ⭐ {media.rating || 8.5}
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
