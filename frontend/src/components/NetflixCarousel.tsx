"use client";

import React, { useRef, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from 'lucide-react';
import NetflixCard from './NetflixCard';
import { Media } from '../types/media';

interface NetflixCarouselProps {
  title: string;
  media: Media[];
  onPlay: (media: Media) => void;
  onInfo: (media: Media) => void;
  priority?: boolean;
}

const NetflixCarousel: React.FC<NetflixCarouselProps> = ({
  title,
  media,
  onPlay,
  onInfo,
  priority = false,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  const itemWidth = 300; // Width of each card
  const gap = 8; // Gap between cards
  const scrollAmount = itemWidth * 6 + gap * 5; // Scroll 6 items at a time

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
    <div 
      className="relative mb-12 group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Title */}
      <h2 className="text-xl md:text-2xl font-bold text-white mb-4 px-4 md:px-12">
        {title}
      </h2>
      
      <div className="relative">
        {/* Left scroll button */}
        {canScrollLeft && (
          <button
            onClick={() => scroll("left")}
            className={`absolute left-0 top-0 bottom-0 z-20 bg-black/80 text-white px-2 flex items-center justify-center transition-all duration-300 cursor-pointer ${
              isHovered ? 'opacity-100' : 'opacity-0'
            } hover:bg-black/90`}
            style={{ width: '60px' }}
          >
            <ChevronLeft className="w-8 h-8" />
          </button>
        )}

        {/* Right scroll button */}
        {canScrollRight && (
          <button
            onClick={() => scroll("right")}
            className={`absolute right-0 top-0 bottom-0 z-20 bg-black/80 text-white px-2 flex items-center justify-center transition-all duration-300 cursor-pointer ${
              isHovered ? 'opacity-100' : 'opacity-0'
            } hover:bg-black/90`}
            style={{ width: '60px' }}
          >
            <ChevronRight className="w-8 h-8" />
          </button>
        )}

        {/* Carousel container */}
        <div
          ref={scrollRef}
          onScroll={updateScrollButtons}
          className="flex gap-2 overflow-x-auto scrollbar-hide px-4 md:px-12 pb-4"
          style={{ 
            scrollbarWidth: "none", 
            msOverflowStyle: "none",
            scrollSnapType: "x mandatory"
          }}
        >
          {media.map((mediaItem, index) => (
            <div 
              key={mediaItem.id} 
              className="flex-shrink-0"
              style={{ 
                width: `${itemWidth}px`,
                scrollSnapAlign: "start"
              }}
            >
              <NetflixCard
                media={mediaItem}
                onPlay={onPlay}
                onInfo={onInfo}
                priority={priority && index < 6}
                delay={index * 100}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NetflixCarousel;
