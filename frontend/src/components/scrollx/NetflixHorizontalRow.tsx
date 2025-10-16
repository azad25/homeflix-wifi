"use client";

import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Media } from '../../types/media';
import NetflixMovieCard from './NetflixMovieCard';
import MagneticButton from './MagneticButton';

interface NetflixHorizontalRowProps {
  title: string;
  media: Media[];
  onPlay: (media: Media) => void;
  onInfo: (media: Media) => void;
  priority?: boolean;
  variant?: 'portrait' | 'landscape';
  size?: 'small' | 'medium' | 'large';
  showTitle?: boolean;
}

const NetflixHorizontalRow: React.FC<NetflixHorizontalRowProps> = ({
  title,
  media,
  onPlay,
  onInfo,
  priority = false,
  variant = 'portrait',
  size = 'medium',
  showTitle = true
}) => {
  const [scrollPosition, setScrollPosition] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const cardWidths = {
    small: variant === 'portrait' ? 200 : 280, // w-50 : w-70 (bigger)
    medium: variant === 'portrait' ? 240 : 320, // w-60 : w-80 (bigger)
    large: variant === 'portrait' ? 280 : 360 // w-70 : w-90 (bigger)
  };

  const cardWidth = cardWidths[size];
  const gap = 12; // gap-3
  const visibleCards = Math.floor((window?.innerWidth || 1200) / (cardWidth + gap));
  const scrollAmount = (cardWidth + gap) * Math.min(visibleCards, 6);

  useEffect(() => {
    updateScrollButtons();
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
      className="relative group mb-20 py-8"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ 
        overflow: 'visible',
        zIndex: 1
      }}
    >
      {/* Title */}
      {showTitle && (
        <div className="px-4 md:px-8 lg:px-16 mb-6 relative z-20">
          <h2 className="text-white text-xl md:text-2xl font-bold hover:text-gray-300 transition-colors cursor-pointer bg-black/20 backdrop-blur-sm px-4 py-2 rounded-lg inline-block">
            {title}
          </h2>
        </div>
      )}

      {/* Row Container */}
      <div className="relative" style={{ overflow: 'visible' }}>
        {/* Left Arrow */}
        <AnimatePresence>
          {canScrollLeft && isHovered && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="absolute left-2 top-1/2 transform -translate-y-1/2 z-50"
            >
              <MagneticButton
                onClick={scrollLeft}
                className="bg-black/80 backdrop-blur-sm text-white p-3 rounded-full hover:bg-black/90 transition-all duration-300 border border-white/20 shadow-lg"
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
              className="absolute right-2 top-1/2 transform -translate-y-1/2 z-50"
            >
              <MagneticButton
                onClick={scrollRight}
                className="bg-black/80 backdrop-blur-sm text-white p-3 rounded-full hover:bg-black/90 transition-all duration-300 border border-white/20 shadow-lg"
              >
                <ChevronRight className="w-6 h-6" />
              </MagneticButton>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cards Container */}
        <div
          ref={scrollContainerRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide px-4 md:px-8 lg:px-16"
          onScroll={handleScroll}
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            overflowY: 'visible',
            paddingTop: '20px',
            paddingBottom: '160px', // Extra space for expanded cards
            marginBottom: '-120px' // Compensate for extra padding
          }}
        >
          {media.map((item, index) => (
            <div key={item.id} className="flex-shrink-0" style={{ minHeight: '400px' }}>
              <NetflixMovieCard
                media={item}
                onPlay={onPlay}
                onInfo={onInfo}
                priority={priority && index < 6}
                delay={index * 50}
                variant={variant}
                size={size}
              />
            </div>
          ))}
        </div>

        {/* Gradient Fade Effects */}
        <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-black/50 to-transparent pointer-events-none z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-black/50 to-transparent pointer-events-none z-10" />
      </div>
    </div>
  );
};

export default NetflixHorizontalRow;
