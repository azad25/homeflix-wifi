import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBatchLazyLoading } from '../hooks/useLazyLoading';
import { MediaErrorBoundary } from './ErrorBoundary';
import NetflixMovieCard from './scrollx/NetflixMovieCard';
import { Media } from '../types/media';

interface LazyMediaGridProps {
  media: Media[];
  onPlay: (media: Media) => void;
  onInfo: (media: Media) => void;
  itemsPerRow?: number;
  batchSize?: number;
  showTitle?: boolean;
  className?: string;
}

const LazyMediaGrid: React.FC<LazyMediaGridProps> = ({
  media,
  onPlay,
  onInfo,
  itemsPerRow = 6,
  batchSize = 12,
  showTitle = true,
  className = ''
}) => {
  const { shouldLoadItem, getBatchRef } = useBatchLazyLoading(media.length, batchSize);
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());

  // Memoize grid layout calculations
  const gridConfig = useMemo(() => {
    const cols = Math.min(itemsPerRow, media.length);
    return {
      cols,
      gap: 'gap-4',
      gridCols: `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-${Math.min(cols, 6)} xl:grid-cols-${cols}`
    };
  }, [itemsPerRow, media.length]);

  // Batch items for progressive loading
  const batches = useMemo(() => {
    const result: Media[][] = [];
    for (let i = 0; i < media.length; i += batchSize) {
      result.push(media.slice(i, i + batchSize));
    }
    return result;
  }, [media, batchSize]);

  const handleImageLoad = (uuid: string) => {
    setLoadedImages(prev => new Set([...prev, uuid]));
  };

  const MediaCardSkeleton = () => (
    <div className="aspect-[2/3] bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg animate-pulse">
      <div className="w-full h-full bg-gray-700/50 rounded-lg flex items-center justify-center">
        <div className="text-gray-500 text-4xl">🎬</div>
      </div>
    </div>
  );

  return (
    <div className={`px-4 md:px-8 lg:px-16 ${className}`}>
      <div className={`grid ${gridConfig.gridCols} ${gridConfig.gap}`}>
        <AnimatePresence mode="wait">
          {batches.map((batch, batchIndex) => (
            <React.Fragment key={batchIndex}>
              {batch.map((mediaItem, itemIndex) => {
                const globalIndex = batchIndex * batchSize + itemIndex;
                const shouldLoad = shouldLoadItem(globalIndex);
                
                return (
                  <motion.div
                    key={mediaItem.uuid || mediaItem.id}
                    ref={batchIndex > 0 && itemIndex === 0 ? getBatchRef(batchIndex) : undefined}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{
                      duration: 0.4,
                      delay: (globalIndex % batchSize) * 0.05,
                      ease: "easeOut"
                    }}
                    className="relative"
                  >
                    <MediaErrorBoundary mediaTitle={mediaItem.title}>
                      {shouldLoad ? (
                        <NetflixMovieCard
                          media={mediaItem}
                          onPlay={onPlay}
                          onInfo={onInfo}
                        />
                      ) : (
                        <MediaCardSkeleton />
                      )}
                    </MediaErrorBoundary>
                  </motion.div>
                );
              })}
            </React.Fragment>
          ))}
        </AnimatePresence>
      </div>
      
      {/* Loading indicator for additional content */}
      {media.length > batchSize && (
        <div className="text-center mt-8">
          <div className="text-gray-400 text-sm">
            Loaded {Math.min(loadedImages.size, media.length)} of {media.length} items
          </div>
        </div>
      )}
    </div>
  );
};

export default LazyMediaGrid;
