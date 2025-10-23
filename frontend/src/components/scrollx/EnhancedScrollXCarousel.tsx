"use client";

import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Media } from '../../types/media';
import NetflixCard from './NetflixCard';
import GenreTitle from '../GenreTitle';
import { useImageWithFallback } from '../../lib/imageUtils';

interface EnhancedScrollXCarouselProps {
  media: Media[];
  onMediaClick: (media: Media) => void;
  variant?: 'glass' | 'solid' | 'gradient';
  showMetadata?: boolean;
  customMetadata?: (media: Media, index?: number) => React.ReactNode;
  cardStyle?: React.CSSProperties;
  hoverStyle?: React.CSSProperties;
  showPlayButton?: boolean;
  playButtonIcon?: React.ReactNode;
  showRankBadges?: boolean;
  title?: string;
}

const EnhancedScrollXCarousel: React.FC<EnhancedScrollXCarouselProps> = ({
  media,
  onMediaClick,
  variant = 'glass',
  showMetadata = false,
  customMetadata,
  cardStyle,
  hoverStyle,
  showPlayButton = false,
  playButtonIcon,
  showRankBadges = false,
  title
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const itemWidth = 320;
  const gap = 20;
  const scrollAmount = itemWidth * 3 + gap * 2;

  const updateScrollButtons = () => {
    if (!scrollRef.current) return;
    
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
  };

  const scrollLeft = () => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({
      left: -scrollAmount,
      behavior: 'smooth'
    });
  };

  const scrollRight = () => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({
      left: scrollAmount,
      behavior: 'smooth'
    });
  };

  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    updateScrollButtons();
    scrollContainer.addEventListener('scroll', updateScrollButtons);
    window.addEventListener('resize', updateScrollButtons);

    return () => {
      scrollContainer.removeEventListener('scroll', updateScrollButtons);
      window.removeEventListener('resize', updateScrollButtons);
    };
  }, [media]);

  if (!media || media.length === 0) {
    return null;
  }

  // Create a mock media object for the title with appropriate genre
  const getTitleMedia = () => {
    if (!title) return null;
    
    // Enhanced genre detection based on title content
    let primaryGenre = 'default';
    const titleLower = title.toLowerCase();
    
    if (titleLower.includes('new') || titleLower.includes('latest') || titleLower.includes('recent')) {
      primaryGenre = 'action';
    } else if (titleLower.includes('popular') || titleLower.includes('trending') || titleLower.includes('top')) {
      primaryGenre = 'thriller';
    } else if (titleLower.includes('horror') || titleLower.includes('scary') || titleLower.includes('fear')) {
      primaryGenre = 'horror';
    } else if (titleLower.includes('comedy') || titleLower.includes('funny') || titleLower.includes('laugh')) {
      primaryGenre = 'comedy';
    } else if (titleLower.includes('drama') || titleLower.includes('emotional')) {
      primaryGenre = 'drama';
    } else if (titleLower.includes('sci-fi') || titleLower.includes('science') || titleLower.includes('future') || titleLower.includes('space')) {
      primaryGenre = 'sci-fi';
    } else if (titleLower.includes('fantasy') || titleLower.includes('magic') || titleLower.includes('adventure')) {
      primaryGenre = 'fantasy';
    } else if (titleLower.includes('romance') || titleLower.includes('love') || titleLower.includes('romantic')) {
      primaryGenre = 'romance';
    } else if (titleLower.includes('documentary') || titleLower.includes('real') || titleLower.includes('true')) {
      primaryGenre = 'documentary';
    } else if (titleLower.includes('animation') || titleLower.includes('animated') || titleLower.includes('cartoon')) {
      primaryGenre = 'animation';
    } else if (titleLower.includes('crime') || titleLower.includes('mystery') || titleLower.includes('detective')) {
      primaryGenre = 'crime';
    }

    return {
      id: 0,
      title: title,
      genre_names: [primaryGenre],
      genres: [{ name: primaryGenre }],
      type: 'section',
      description: '',
      rating: 0,
      release_date: '',
      duration: 0
    } as Media;
  };

  return (
    <div className="relative w-full overflow-visible py-8">
      {title && (
        <div className="mb-6 px-4 md:px-8">
          <GenreTitle 
            media={getTitleMedia()!} 
            className="[&>h1]:text-lg [&>h1]:md:text-xl [&>h1]:lg:text-2xl [&>h1]:font-semibold [&>h1]:leading-tight [&>div]:scale-75 [&>div]:origin-left"
          />
        </div>
      )}

      {/* Navigation Buttons */}
      {canScrollLeft && (
        <button
          className="absolute left-2 top-1/2 transform -translate-y-1/2 z-20 bg-black/60 hover:bg-black/80 text-white p-3 rounded-full transition-all duration-300 opacity-80 hover:opacity-100 shadow-lg"
          onClick={scrollLeft}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {canScrollRight && (
        <button
          className="absolute right-2 top-1/2 transform -translate-y-1/2 z-20 bg-black/60 hover:bg-black/80 text-white p-3 rounded-full transition-all duration-300 opacity-80 hover:opacity-100 shadow-lg"
          onClick={scrollRight}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Scrollable Container */}
      <div
        ref={scrollRef}
        className="flex gap-5 overflow-x-auto scrollbar-hide px-4 md:px-8 group"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {media.map((item, index) => (
          <NetflixCard
            key={item.id || index}
            media={item}
            index={index}
            onMediaClick={onMediaClick}
            showRankBadges={showRankBadges}
          />
        ))}
      </div>
    </div>
  );
};

const EnhancedMediaCard: React.FC<any> = ({
  media,
  index,
  onMediaClick,
  variant,
  showMetadata,
  customMetadata,
  cardStyle,
  hoverStyle,
  showPlayButton,
  playButtonIcon,
  showRankBadges
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [fallbackError, setFallbackError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { primarySrc, fallbackSrc } = useImageWithFallback(media?.id || 0);

  const handleClick = async () => {
    // Validate media before handling click
    if (!media?.id || typeof media.id !== 'number' || media.id <= 0) {
      console.warn('Invalid media for click handler:', media?.id);
      return;
    }
    setIsLoading(true);
    try {
      await onMediaClick(media);
    } finally {
      setTimeout(() => setIsLoading(false), 500);
    }
  };

  const getDefaultCardStyle = () => {
    const variants = {
      glass: {
        background: 'rgba(0,0,0,0.7)',
        border: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(10px)',
      },
      solid: {
        background: 'rgba(0,0,0,0.9)',
        border: '1px solid rgba(255,255,255,0.15)',
      },
      gradient: {
        background: 'linear-gradient(135deg, rgba(139,0,0,0.3) 0%, rgba(0,0,0,0.8) 100%)',
        border: '1px solid rgba(220,38,38,0.3)',
        backdropFilter: 'blur(8px)',
      }
    };
    return variants[variant as keyof typeof variants] || variants.glass;
  };

  const getDefaultHoverStyle = () => {
    return {
      transform: 'scale(1.05) translateY(-8px)',
      background: 'linear-gradient(135deg, rgba(220,38,38,0.8) 0%, rgba(0,0,0,0.95) 100%)',
      border: '1px solid rgba(220,38,38,0.6)',
      boxShadow: '0 20px 40px rgba(220,38,38,0.3)',
    };
  };

  return (
    <div className="overflow-visible" style={{ overflow: 'visible' }}>
      <motion.div
        className="relative group cursor-pointer overflow-visible"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleClick}
        style={{
          // Ensure the card doesn't get clipped during hover
          zIndex: isHovered ? 20 : 1,
          overflow: 'visible'
        }}
        whileHover={{
          scale: 1.05,
          y: -8,
        }}
        transition={{ 
          duration: 0.3, 
          ease: "easeOut",
          type: "spring",
          stiffness: 300,
          damping: 30
        }}
      >
      <div
        className="relative overflow-hidden rounded-lg shadow-lg"
        style={{
          ...(cardStyle || getDefaultCardStyle()),
          // Ensure smooth transitions
          transition: 'all 0.3s ease-out',
        }}
      >
        {/* Rank Badge */}
        {showRankBadges && index < 10 && (
          <div className="absolute top-2 left-2 z-10 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full">
            #{index + 1}
          </div>
        )}

        {/* Poster/Thumbnail Image */}
        <div className="relative aspect-video overflow-hidden">
          {!fallbackError ? (
            <motion.img
              src={primarySrc}
              alt={media.title}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={(e) => {
                const img = e.currentTarget;
                if (img.src === primarySrc && !imageError) {
                  // First error: poster failed, try thumbnail
                  setImageError(true);
                  img.src = fallbackSrc;
                } else if (!fallbackError) {
                  // Second error: thumbnail also failed
                  setFallbackError(true);
                }
              }}
              whileHover={{ scale: 1.1 }}
              transition={{ duration: 0.3 }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-800 via-gray-900 to-black flex items-center justify-center">
              <div className="text-white text-center">
                <div className="text-3xl mb-2">🎬</div>
                <div className="text-sm font-medium">{media.title}</div>
              </div>
            </div>
          )}
          
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
          
          {/* Hover overlay with play button */}
          <motion.div
            className="absolute inset-0 bg-black/50 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: isHovered ? 1 : 0 }}
            transition={{ duration: 0.2 }}
          >
            {showPlayButton && (
              <button
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  handleClick();
                }}
                disabled={isLoading}
                className="bg-red-600/90 backdrop-blur-sm text-white p-4 rounded-full hover:bg-red-500 transition-all duration-200 shadow-lg"
              >
                {isLoading ? (
                  <div className="w-6 h-6 animate-spin">
                    <svg className="w-6 h-6" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                  </div>
                ) : (
                  playButtonIcon || <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                )}
              </button>
            )}
          </motion.div>
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="text-white font-bold text-lg mb-2 line-clamp-2">
            {media.title}
          </h3>
          
          {/* Default metadata */}
          {!customMetadata && (
            <div className="flex items-center gap-2 mb-2 text-sm">
              <span className="text-green-400 font-semibold">
                ⭐ {(media.rating || 8.5).toFixed(1)}
              </span>
              <span className="text-gray-400">•</span>
              <span className="text-gray-400 capitalize">{media.type}</span>
              {media.year && (
                <>
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-400">{media.year}</span>
                </>
              )}
            </div>
          )}

          {/* Custom metadata */}
          {customMetadata && showMetadata && (
            <div className="mb-2">
              {customMetadata(media, index)}
            </div>
          )}

          {/* Genres */}
          {media.genres && media.genres.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {media.genres.slice(0, 2).map((genre: any, genreIndex: number) => (
                <span
                  key={genre.id || genreIndex}
                  className="text-xs text-gray-300 bg-red-600/20 border border-red-500/30 px-2 py-1 rounded-full backdrop-blur-sm"
                >
                  {genre.name}
                </span>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                handleClick();
              }}
              disabled={isLoading}
              className={`flex-1 bg-red-600 text-white px-4 py-2 rounded-lg font-bold transition-all duration-200 text-sm flex items-center justify-center ${
                isLoading 
                  ? 'opacity-75 cursor-wait bg-red-700' 
                  : 'hover:bg-red-500 hover:cursor-pointer cursor-pointer'
              }`}
            >
              {isLoading ? (
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
                <>
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  Play
                </>
              )}
            </button>
            <button
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                // Add more info action here
              }}
              className="bg-gray-600/80 text-white px-3 py-2 rounded-lg font-bold transition-all duration-200 text-sm hover:bg-gray-500 flex items-center justify-center"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      </motion.div>
    </div>
  );
};

export default EnhancedScrollXCarousel;
