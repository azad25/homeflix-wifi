"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Film } from 'lucide-react';
import { Media } from '@/types/media';
import { getApiUrl } from '@/lib/api';
import { MagneticButton, FloatingElement } from '@/components/scrollx';

interface LazyMediaGridProps {
  media: Media[];
  onPlay: (media: Media) => void;
  onInfo: (media: Media) => void;
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  className?: string;
}

interface LazyImageProps {
  src: string;
  alt: string;
  fallbackSrc?: string;
  className?: string;
  onError?: () => void;
}

const LazyImage: React.FC<LazyImageProps> = ({ 
  src, 
  alt, 
  fallbackSrc, 
  className = "", 
  onError 
}) => {
  const [imageSrc, setImageSrc] = useState<string>('');
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !imageSrc) {
            setImageSrc(src);
            observer.unobserve(img);
          }
        });
      },
      { threshold: 0.1, rootMargin: '50px' }
    );

    observer.observe(img);

    return () => {
      observer.unobserve(img);
    };
  }, [src, imageSrc]);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    if (!hasError && fallbackSrc) {
      setHasError(true);
      setImageSrc(fallbackSrc);
    } else {
      onError?.();
    }
  };

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {!isLoaded && (
        <div className="absolute inset-0 bg-gray-800 animate-pulse flex items-center justify-center">
          <Film className="w-8 h-8 text-gray-600" />
        </div>
      )}
      <img
        ref={imgRef}
        src={imageSrc}
        alt={alt}
        className={`w-full h-full object-cover transition-all duration-300 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  );
};

const LazyMediaCard: React.FC<{
  media: Media;
  onPlay: (media: Media) => void;
  onInfo: (media: Media) => void;
}> = ({ media, onPlay, onInfo }) => {
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.unobserve(card);
          }
        });
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    observer.observe(card);

    return () => {
      observer.unobserve(card);
    };
  }, []);

  if (!isVisible) {
    return (
      <div ref={cardRef} className="aspect-[2/3] bg-gray-800 rounded-lg animate-pulse">
        <div className="w-full h-full flex items-center justify-center">
          <Film className="w-8 h-8 text-gray-600" />
        </div>
      </div>
    );
  }

  return (
    <div ref={cardRef} className="group relative">
      <div className="aspect-[2/3] bg-gray-800 rounded-lg overflow-hidden relative">
        <LazyImage
          src={`${getApiUrl()}/api/posters/${media.id}`}
          alt={media.title}
          fallbackSrc={`${getApiUrl()}/api/thumbnails/${media.id}`}
          className="w-full h-full transition-transform duration-300 group-hover:scale-105"
        />
        
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <div className="flex gap-2">
            <button
              onClick={() => onPlay(media)}
              className="bg-white text-black p-2 rounded-full hover:bg-gray-200 transition-colors"
              title="Play"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </button>
            <button
              onClick={() => onInfo(media)}
              className="bg-gray-600 text-white p-2 rounded-full hover:bg-gray-500 transition-colors"
              title="More Info"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Rating Badge */}
        {media.rating && (
          <div className="absolute top-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
            ⭐ {media.rating.toFixed(1)}
          </div>
        )}
        
        {/* Type Badge */}
        <div className="absolute top-2 left-2 bg-red-600 text-white text-xs px-2 py-1 rounded capitalize">
          {media.type === 'episode' ? 'TV' : media.type}
        </div>
      </div>
      
      {/* Title and Info */}
      <div className="mt-2">
        <h3 className="text-white text-sm font-medium truncate group-hover:text-red-400 transition-colors">
          {media.title}
        </h3>
        <div className="flex items-center justify-between mt-1">
          <p className="text-gray-400 text-xs capitalize">
            {media.type === 'episode' ? 'TV Series' : media.type}
          </p>
          {media.view_count && (
            <p className="text-gray-500 text-xs">
              {media.view_count} views
            </p>
          )}
        </div>
        {/* Genres */}
        {media.genres && media.genres.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {media.genres.slice(0, 2).map((genre, idx) => (
              <span key={idx} className="text-gray-500 text-xs bg-gray-800 px-1 py-0.5 rounded">
                {genre.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const LazyMediaGrid: React.FC<LazyMediaGridProps> = ({
  media,
  onPlay,
  onInfo,
  loading = false,
  hasMore = false,
  onLoadMore,
  className = ""
}) => {
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Intersection observer for infinite scroll
  useEffect(() => {
    if (!hasMore || !onLoadMore) return;

    const loadMoreElement = loadMoreRef.current;
    if (!loadMoreElement) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !loading) {
            onLoadMore();
          }
        });
      },
      { threshold: 0.1, rootMargin: '200px' }
    );

    observer.observe(loadMoreElement);

    return () => {
      observer.unobserve(loadMoreElement);
    };
  }, [hasMore, onLoadMore, loading]);

  if (media.length === 0 && !loading) {
    return (
      <div className="text-center py-16">
        <FloatingElement>
          <Film className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        </FloatingElement>
        <h3 className="text-2xl text-white mb-4">No content found</h3>
        <p className="text-gray-400 mb-8">
          Try adjusting your filters to see more content.
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {media.map((item) => (
          <LazyMediaCard
            key={item.id}
            media={item}
            onPlay={onPlay}
            onInfo={onInfo}
          />
        ))}
        
        {/* Loading skeleton cards */}
        {loading && (
          <>
            {Array.from({ length: 12 }).map((_, index) => (
              <div key={`skeleton-${index}`} className="aspect-[2/3] bg-gray-800 rounded-lg animate-pulse">
                <div className="w-full h-full flex items-center justify-center">
                  <Film className="w-8 h-8 text-gray-600" />
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Load more trigger */}
      {hasMore && (
        <div ref={loadMoreRef} className="flex justify-center mt-8">
          {loading ? (
            <div className="text-white">Loading more...</div>
          ) : (
            <MagneticButton
              onClick={onLoadMore}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold"
            >
              Load More
            </MagneticButton>
          )}
        </div>
      )}
    </div>
  );
};

export default LazyMediaGrid;