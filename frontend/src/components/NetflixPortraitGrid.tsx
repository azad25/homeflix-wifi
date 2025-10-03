"use client";

import React, { useState, useEffect } from 'react';
import { Media } from '@/types/media';
import NetflixMovieCard from './scrollx/NetflixMovieCard';
import { motion } from 'framer-motion';

interface NetflixPortraitGridProps {
  media: Media[];
  onPlay: (media: Media) => void;
  onInfo: (media: Media) => void;
  title?: string;
  loading?: boolean;
  className?: string;
  itemsPerRow?: number;
  showTitle?: boolean;
}

const NetflixPortraitGrid: React.FC<NetflixPortraitGridProps> = ({
  media,
  onPlay,
  onInfo,
  title,
  loading = false,
  className = "",
  itemsPerRow = 6,
  showTitle = true
}) => {
  const [visibleItems, setVisibleItems] = useState(18); // Start with 3 rows
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Load more items when scrolling near bottom
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 1000) {
        if (visibleItems < media.length && !isLoadingMore) {
          setIsLoadingMore(true);
          setTimeout(() => {
            setVisibleItems(prev => Math.min(prev + 12, media.length));
            setIsLoadingMore(false);
          }, 500);
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [visibleItems, media.length, isLoadingMore]);

  const getGridCols = () => {
    switch (itemsPerRow) {
      case 4: return 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4';
      case 5: return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5';
      case 6: return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6';
      case 7: return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7';
      case 8: return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8';
      default: return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6';
    }
  };

  if (loading) {
    return (
      <div className={`${className}`}>
        {showTitle && title && (
          <h2 className="text-2xl font-bold text-white mb-6 px-4 md:px-8 lg:px-16">
            {title}
          </h2>
        )}
        <div className={`grid ${getGridCols()} gap-4 px-4 md:px-8 lg:px-16`}>
          {Array.from({ length: 12 }).map((_, index) => (
            <div
              key={index}
              className="aspect-[2/3] bg-gray-800 rounded-lg animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (media.length === 0) {
    return null;
  }

  const visibleMedia = media.slice(0, visibleItems);

  return (
    <div className={`${className}`}>
      {showTitle && title && (
        <motion.h2 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-2xl font-bold text-white mb-6 px-4 md:px-8 lg:px-16"
        >
          {title}
        </motion.h2>
      )}
      
      <div className={`grid ${getGridCols()} gap-4 px-4 md:px-8 lg:px-16`}>
        {visibleMedia.map((item, index) => (
          <motion.div
            key={item.uuid}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: (index % 12) * 0.05 }}
          >
            <NetflixMovieCard
              media={item}
              onPlay={onPlay}
              onInfo={onInfo}
              variant="portrait"
              size="medium"
              priority={index < 6}
              delay={index * 50}
            />
          </motion.div>
        ))}
      </div>

      {/* Load More Indicator */}
      {isLoadingMore && (
        <div className="flex justify-center py-8">
          <div className="flex items-center gap-2 text-white">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Loading more...</span>
          </div>
        </div>
      )}

      {/* Show remaining count */}
      {visibleItems < media.length && !isLoadingMore && (
        <div className="text-center py-6">
          <p className="text-gray-400">
            Showing {visibleItems} of {media.length} items
          </p>
        </div>
      )}
    </div>
  );
};

export default NetflixPortraitGrid;
