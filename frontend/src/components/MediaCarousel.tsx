"use client";

import React from "react";
import HoverVideoCard from './HoverVideoCard';
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

  return (
    <div className="relative mb-8">
      <h2 className="text-2xl font-bold text-white mb-4 px-4">{title}</h2>
      
      {/* Cards container - Grid layout instead of scroll */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 px-4 pb-4">
        {media.map((media, index) => (
          <div key={media.id} className="w-full">
            <HoverVideoCard
              media={media}
              onPlay={onPlay}
              delay={800}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default MediaCarousel;
