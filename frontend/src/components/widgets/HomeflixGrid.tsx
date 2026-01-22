"use client";

import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Play, Info, Star, Film } from 'lucide-react';
import { Media } from '@/types/media';
import { getApiUrl } from '@/lib/api';
import { useNavigate } from '@/hooks/useNavigate';
import { navigateToMedia } from '@/lib/mediaNavigation';

interface HomeflixGridProps {
  media: Media[];
  title: string;
  subtitle?: string;
  maxItems?: number;
  showRating?: boolean;
  showYear?: boolean;
  autoScroll?: boolean;
  scrollInterval?: number;
  className?: string;
  onPlay?: (media: Media) => void;
  onInfo?: (media: Media) => void;
}

interface HomeflixCardProps {
  media: Media;
  onPlay?: (media: Media) => void;
  onInfo?: (media: Media) => void;
  priority?: boolean;
  delay?: number;
  showRating?: boolean;
}

const HomeflixCard: React.FC<HomeflixCardProps> = ({
  media,
  onPlay,
  onInfo,
  priority = false,
  delay = 0,
  showRating = true,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [tmdbLogoUrl, setTmdbLogoUrl] = useState<string | null>(null);
  const navigate = useNavigate();
  const apiUrl = getApiUrl();

  // Get poster image URL - prioritize backdrop, then poster, then thumbnail
  const getPosterUrl = () => {
    if (media.tmdb_backdrop_url) return media.tmdb_backdrop_url;
    if (media.poster_url) return media.poster_url;
    if (media.tmdb_poster_url) return media.tmdb_poster_url;
    if (media.poster_path) return `${getApiUrl()}/api/media/poster/${media.id}`;
    if (media.thumbnail_path) return `${getApiUrl()}/api/media/thumbnail/${media.id}`;
    return null;
  };

  // Get logo URL - try local first, then TMDB
  const getLogoUrl = () => {
    // Use fetched TMDB logo if available
    if (tmdbLogoUrl) return tmdbLogoUrl;
    // Use local logo if available
    if (media.logo_path) {
      if (media.logo_path.startsWith('http')) return media.logo_path;
      return `${apiUrl}/api/logos/${media.logo_path.split('/').pop()}`;
    }
    return null;
  };

  // Fetch TMDB logo if media has tmdb_id but no local logo
  useEffect(() => {
    if (!media.tmdb_id || media.logo_path) return;

    const fetchTmdbLogo = async () => {
      try {
        const type = media.type === 'tv' || media.type === 'series' ? 'tv' : 'movie';
        const res = await fetch(`${apiUrl}/api/tmdb/${type}/${media.tmdb_id}/images`);
        if (!res.ok) return;
        const data = await res.json();
        const logos = data?.logos || [];
        const preferred = logos.find((l: any) => l.iso_639_1 === 'en') || logos[0];
        if (preferred?.file_path) {
          setTmdbLogoUrl(`https://image.tmdb.org/t/p/w500${preferred.file_path}`);
        }
      } catch { /* ignore */ }
    };

    fetchTmdbLogo();
  }, [media.tmdb_id, media.logo_path, media.type, apiUrl]);

  const posterUrl = getPosterUrl();
  const logoUrl = getLogoUrl();

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onPlay) {
      onPlay(media);
    } else {
      navigateToMedia(navigate, media);
    }
  };

  const handleInfo = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onInfo) {
      onInfo(media);
    } else {
      navigateToMedia(navigate, media);
    }
  };

  const handleCardClick = () => {
    navigateToMedia(navigate, media);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: delay / 1000 }}
      className="group relative cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
    >
      {/* Main Card Container */}
      <div className="relative aspect-[16/9] bg-gray-800 rounded-lg overflow-hidden shadow-lg transition-all duration-300 group-hover:scale-105 group-hover:shadow-2xl">
        {/* Background Image */}
        {posterUrl && !imageError && (
          <img
            src={posterUrl}
            alt={media.title}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            loading={priority ? 'eager' : 'lazy'}
          />
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Rating Badge */}
        {showRating && media.rating && (
          <div className="absolute top-4 right-4 flex items-center gap-1 bg-black/70 backdrop-blur-sm px-2 py-1 rounded-full">
            {/* <Star className="w-3 h-3 text-yellow-400 fill-current" /> */}
            <span className="text-xs font-medium text-white">
              {media.year && media.year > 0 ? media.year : ''}
            </span>
          </div>
        )}

        {/* Hover Overlay */}
        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 flex items-center justify-center"
            >
              <div className="flex items-center gap-3">
                <motion.button
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  transition={{ delay: 0.1 }}
                  onClick={handlePlay}
                  className="flex items-center justify-center w-12 h-12 bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30 rounded-full transition-all duration-200 hover:scale-110"
                >
                  <Play className="w-5 h-5 text-white ml-0.5" />
                </motion.button>
                <motion.button
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  transition={{ delay: 0.2 }}
                  onClick={handleInfo}
                  className="flex items-center justify-center w-12 h-12 bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30 rounded-full transition-all duration-200 hover:scale-110"
                >
                  <Info className="w-5 h-5 text-white" />
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Fallback for missing images */}
        {(!posterUrl || imageError) && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
            <div className="text-center text-gray-400">
              <div className="w-16 h-16 mx-auto mb-2 bg-gray-700 rounded-lg flex items-center justify-center">
                <Play className="w-8 h-8" />
              </div>
              <p className="text-sm font-medium">{media.title}</p>
            </div>
          </div>
        )}
      </div>

      {/* Title - Logo or Text */}
      <div className="mt-3 px-1 h-10 flex items-center">
        {logoUrl && !logoError ? (
          <img
            src={logoUrl}
            alt={media.title}
            className="max-h-10 w-auto filter drop-shadow-md mx-auto"
            loading="lazy"
            onError={() => setLogoError(true)}
          />
        ) : (
          <h3 className="text-white font-medium text-sm line-clamp-1 group-hover:text-red-400 transition-colors">
            {media.title}
          </h3>
        )}
      </div>
    </motion.div>
  );
};

export default function HomeflixGrid({
  media,
  title,
  subtitle,
  maxItems = 12,
  showRating = true,
  showYear = true,
  autoScroll = false,
  scrollInterval = 5000,
  className = '',
  onPlay,
  onInfo,
}: HomeflixGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  const itemWidth = 280; // Width of each card
  const gap = 16; // Gap between cards
  const scrollAmount = itemWidth * 4 + gap * 3; // Scroll 4 items at a time

  // Limit media items
  const displayMedia = media.slice(0, maxItems);

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

  // Auto scroll functionality
  useEffect(() => {
    if (!autoScroll || isHovered) return;

    const interval = setInterval(() => {
      if (scrollRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;

        if (scrollLeft >= scrollWidth - clientWidth - 10) {
          // Reset to beginning
          scrollRef.current.scrollTo({ left: 0, behavior: "smooth" });
        } else {
          scroll("right");
        }
      }
    }, scrollInterval);

    return () => clearInterval(interval);
  }, [autoScroll, scrollInterval, isHovered]);

  useEffect(() => {
    updateScrollButtons();
    const handleResize = () => updateScrollButtons();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [displayMedia]);

  if (!displayMedia || displayMedia.length === 0) return null;

  return (
    <div
      className={`relative mb-12 group ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header */}
      <div className="px-4 md:px-12 mb-6">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <Film className="w-6 h-6 md:w-7 md:h-7 text-red-500" />
          {title}
        </h2>
        {subtitle && (
          <p className="text-white/70 text-sm md:text-base pl-9 md:pl-10">
            {subtitle}
          </p>
        )}
      </div>

      <div className="relative">
        {/* Left scroll button */}
        {canScrollLeft && (
          <button
            onClick={() => scroll("left")}
            className={`absolute left-0 top-0 bottom-0 z-20 bg-black/80 text-white px-2 flex items-center justify-center transition-all duration-300 cursor-pointer ${isHovered ? 'opacity-100' : 'opacity-0'
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
            className={`absolute right-0 top-0 bottom-0 z-20 bg-black/80 text-white px-2 flex items-center justify-center transition-all duration-300 cursor-pointer ${isHovered ? 'opacity-100' : 'opacity-0'
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
          className="flex gap-4 overflow-x-auto scrollbar-hide px-4 md:px-12 pb-4"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            scrollSnapType: "x mandatory"
          }}
        >
          {displayMedia.map((mediaItem, index) => (
            <div
              key={mediaItem.id}
              className="flex-shrink-0"
              style={{
                width: `${itemWidth}px`,
                scrollSnapAlign: "start"
              }}
            >
              <HomeflixCard
                media={mediaItem}
                onPlay={onPlay}
                onInfo={onInfo}
                priority={index < 6}
                delay={index * 100}
                showRating={showRating}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}