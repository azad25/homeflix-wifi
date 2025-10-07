"use client";

import React from 'react';
import { Media } from '@/types/media';
import SimpleMediaCard from './SimpleMediaCard';

interface MediaGridProps {
  media: Media[];
  onPlay: (media: Media) => void;
  onInfo: (media: Media) => void;
  loading?: boolean;
  title?: string;
  showPreview?: boolean; // Control whether cards show preview on hover
}

const MediaGrid: React.FC<MediaGridProps> = ({
  media,
  onPlay,
  onInfo,
  loading = false,
  title,
  showPreview = false // Default to false for browse/search pages
}) => {
  if (loading) {
    return (
      <div className="space-y-6">
        {title && (
          <h2 className="text-white text-2xl font-bold px-4 md:px-0">
            {title}
          </h2>
        )}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 px-4 md:px-0">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="aspect-video bg-gray-800/30 rounded-lg animate-pulse backdrop-blur-sm border border-gray-700/30"
            />
          ))}
        </div>
      </div>
    );
  }

  if (media.length === 0) {
    return (
      <div className="space-y-6">
        {title && (
          <h2 className="text-white text-2xl font-bold px-4 md:px-0">
            {title}
          </h2>
        )}
        <div className="text-center py-12">
          <div className="text-gray-400 text-lg mb-2">No media found</div>
          <div className="text-gray-500 text-sm">Try adjusting your search or browse different categories</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {title && (
        <h2 className="text-white text-2xl font-bold px-4 md:px-0">
          {title}
        </h2>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 px-4 md:px-0">
        {media.map((item, index) => (
          <SimpleMediaCard
            key={item.id}
            media={item}
            onPlay={onPlay}
            onInfo={onInfo}
            priority={index < 6} // Prioritize first 6 items
            delay={index * 50} // Stagger animations
            showPreview={showPreview} // Pass through preview control
          />
        ))}
      </div>
    </div>
  );
};

export default MediaGrid;