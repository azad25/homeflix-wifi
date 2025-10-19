"use client";

import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Media } from '../../types/media';
import EnhancedMovieCard from './EnhancedMovieCard';
import MagneticButton from './MagneticButton';

interface EnhancedHorizontalRowProps {
  title: string;
  media: Media[];
  onPlay: (media: Media) => void;
  onInfo: (media: Media) => void;
  priority?: boolean;
  size?: 'small' | 'medium' | 'large';
  showTitle?: boolean;
}

const EnhancedHorizontalRow: React.FC<EnhancedHorizontalRowProps> = ({
  title,
  media,
  onPlay,
  onInfo,
  priority = false,
  size = 'medium',
  showTitle = true
}) => {
  const [scrollPosition, setScrollPosition] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const cardWidths = {
    small: isMobile ? 220 : 240, // w-52 + gap on mobile, w-56 + gap on desktop
    medium: isMobile ? 240 : 280, // w-56 + gap on mobile, w-64 + gap on desktop
    large: isMobile ? 280 : 320 // w-64 + gap on mobile, w-72 + gap on desktop
  };

  const cardWidth = cardWidths[size];
  const gap = 16; // gap-4
  const visibleCards = Math.floor((window?.innerWidth || 1200) / (cardWidth + gap));
  const scrollAmount = (cardWidth + gap) * Math.min(visibleCards, 5);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    updateScrollButtons();
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, [scrollPosition, media.length]);

  const updateScrollButtons = () => {
    if (!scrollContainerRef.current) return;
    
    const container = scrollContainerRef.current;
    const maxScroll = container.scrollWidth - container.clientWidth;
    
    setCanScrollLeft(scrollPosition > 0);
    setCanScrollRight(scrollPosition < maxScroll - 10);
  };

  const scrollLeft = () => {
    if (!scrollContainerRef.current) return;
    
    const newPosition = Math.max(0, scrollPosition - scrollAmount);
    setScrollPosition(newPosition);
    scrollContainerRef.current.scrollTo({
      left: newPosition,
      behavior: 'smooth'
    });
  };

  const scrollRight = () => {
    if (!scrollContainerRef.current) return;
    
    const container = scrollContainerRef.current;
    const maxScroll = container.scrollWidth - container.clientWidth;
    const newPosition = Math.min(maxScroll, scrollPosition + scrollAmount);
    
    setScrollPosition(newPosition);
    container.scrollTo({
      left: newPosition,
      behavior: 'smooth'
    });
  };

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    setScrollPosition(scrollContainerRef.current.scrollLeft);
  };

  if (!media || media.length === 0) return null;

  return (
    <div 
      className="relative group mb-16 py-4"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ 
        overflow: 'visible',
        zIndex: 50
      }}
    >
      {/* Title */}
      {showTitle && (
        <div className="px-4 md:px-8 lg:px-16 mb-4 sm:mb-6 relative z-[60]">
          <h2 className="text-white text-xl sm:text-2xl md:text-3xl font-bold hover:text-red-400 transition-colors cursor-pointer bg-black/30 backdrop-blur-sm px-4 sm:px-6 py-2 sm:py-3 rounded-xl inline-block border border-red-900/20">
            {title}
          </h2>
        </div>
      )}

      {/* Row Container */}
      <div className="relative isolate" style={{ overflow: 'visible' }}>
        {/* Left Arrow */}
        <AnimatePresence>
          {canScrollLeft && isHovered && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="absolute left-4 top-1/2 transform -translate-y-1/2 z-[150]"
            >
              <MagneticButton
                onClick={scrollLeft}
                className="bg-black/95 backdrop-blur-md text-white p-4 rounded-full hover:bg-red-600/90 transition-all duration-300 border border-red-900/50 shadow-2xl ring-2 ring-black/20"
              >
                <ChevronLeft className="w-6 h-6" />
              </MagneticButton>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Right Arrow */}
        <AnimatePresence>
          {canScrollRight && isHovered && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 z-[150]"
            >
              <MagneticButton
                onClick={scrollRight}
                className="bg-black/95 backdrop-blur-md text-white p-4 rounded-full hover:bg-red-600/90 transition-all duration-300 border border-red-900/50 shadow-2xl ring-2 ring-black/20"
              >
                <ChevronRight className="w-6 h-6" />
              </MagneticButton>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cards Container */}
        <div
          ref={scrollContainerRef}
          className="flex gap-4 sm:gap-6 overflow-x-auto scrollbar-hide px-4 md:px-8 lg:px-16"
          onScroll={handleScroll}
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            overflowY: 'visible',
            paddingTop: '40px', // Increased padding for hover scaling
            paddingBottom: isMobile ? '60px' : '80px',
            marginTop: '-30px', // Compensate for increased padding
            marginBottom: isMobile ? '-40px' : '-60px',
            transformStyle: 'preserve-3d'
          }}
        >
          {media.map((item, index) => (
            <div key={item.id} className="flex-shrink-0 relative" style={{ minHeight: isMobile ? '320px' : '400px', zIndex: 10 }}>
              <EnhancedMovieCard
                media={item}
                onPlay={onPlay}
                onInfo={onInfo}
                priority={priority && index < 6}
                delay={index * 50}
                size={size}
              />
            </div>
          ))}
        </div>

        {/* Gradient Fade Effects */}
        <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-black via-black/50 to-transparent pointer-events-none z-[30]" />
        <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-black via-black/50 to-transparent pointer-events-none z-[30]" />
      </div>
    </div>
  );
};

export default EnhancedHorizontalRow;