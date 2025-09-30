"use client";

import React, { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import HoverVideoCard from './HoverVideoCard';
import MediaCard from "./MediaCard";
import { Media } from '../types/media';

interface MediaCarouselProps {
  title: string;
  media: Media[];
  onPlay: (media: Media) => void;
  onInfo: (media: Media) => void;
}

const MediaCarousel: React.FC<MediaCarouselProps> = ({
  title,
  media,
  onPlay,
  onInfo,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;

    const scrollAmount = 300;
    const newScrollLeft =
      scrollRef.current.scrollLeft +
      (direction === "left" ? -scrollAmount : scrollAmount);

    scrollRef.current.scrollTo({
      left: newScrollLeft,
      behavior: "smooth",
    });

    // Update scroll button states
    setTimeout(() => {
      if (scrollRef.current) {
        setCanScrollLeft(scrollRef.current.scrollLeft > 0);
        setCanScrollRight(
          scrollRef.current.scrollLeft <
            scrollRef.current.scrollWidth - scrollRef.current.clientWidth
        );
      }
    }, 300);
  };

  const handleScroll = () => {
    if (!scrollRef.current) return;

    setCanScrollLeft(scrollRef.current.scrollLeft > 0);
    setCanScrollRight(
      scrollRef.current.scrollLeft <
        scrollRef.current.scrollWidth - scrollRef.current.clientWidth
    );
  };

  return (
    <div className="relative mb-8">
      <h2 className="text-2xl font-bold text-white mb-4 px-4">{title}</h2>
      
      <div className="relative group">
        {/* Left scroll button */}
        {canScrollLeft && (
          <button
            onClick={() => scroll("left")}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Right scroll button */}
        {canScrollRight && (
          <button
            onClick={() => scroll("right")}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}

        {/* Carousel container */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex gap-4 overflow-x-auto scrollbar-hide px-4 pb-4"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {media.map((media, index) => (
            <div key={media.id} className="flex-shrink-0 w-80 mr-4">
              <HoverVideoCard
                media={media}
                onPlay={onPlay}
                delay={800}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MediaCarousel;
