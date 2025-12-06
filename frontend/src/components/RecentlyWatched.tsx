"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Play, Clock, MoreHorizontal, Info, Star, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Media } from '@/types/media';
import { getApiUrl } from '@/lib/api';
import { cleanMovieTitle } from '@/lib/titleUtils';
import { useNavigate } from '@/hooks/useNavigate';
import ImageWithFallback from '@/components/ImageWithFallback';

interface RecentlyWatchedItem {
  id: number;
  media_id: number;
  user_id: number;
  last_watched_at: string;
  progress_seconds: number;
  duration_seconds: number;
  media: Media;
}

interface RecentlyWatchedProps {
  onPlay: (media: Media, startTime?: number) => void;
  onInfo: (media: Media) => void;
}

interface RecentlyWatchedCardProps {
  item: RecentlyWatchedItem;
  onPlay: (media: Media, startTime?: number) => void;
  onInfo: (media: Media) => void;
  index: number;
}

const RecentlyWatchedCard: React.FC<RecentlyWatchedCardProps> = ({
  item,
  onPlay,
  onInfo,
  index
}) => {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLoading(true);
    setTimeout(() => {
      onPlay(item.media, item.progress_seconds);
      setIsLoading(false);
    }, 300);
  };

  const handleInfoClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.media.type === 'episode' || item.media.type === 'tv' || item.media.type === 'series') {
      const seriesId = item.media.series_id || item.media.id;
      navigate.push(`/tv-series/${seriesId}`);
    } else {
      navigate.push(`/movie/${item.media.id}`);
    }
  };

  const handleCardClick = () => {
    if (item.media.type === 'episode' || item.media.type === 'tv' || item.media.type === 'series') {
      const seriesId = item.media.series_id || item.media.id;
      navigate.push(`/tv-series/${seriesId}`);
    } else {
      navigate.push(`/movie/${item.media.id}`);
    }
  };

  const formatProgress = (progressSeconds: number, durationSeconds: number) => {
    const progressPercent = (progressSeconds / durationSeconds) * 100;
    return Math.min(Math.max(progressPercent, 0), 100);
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatLastWatched = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getYear = () => {
    if (item.media.year) {
      return item.media.year;
    } else if (item.media.release_date) {
      return new Date(item.media.release_date).getFullYear().toString();
    }

    if (item.media.file_path) {
      const yearMatch = item.media.file_path.match(/\b(19|20)\d{2}\b/);
      if (yearMatch) return yearMatch[0];
    }

    if (item.media.title) {
      const yearMatch = item.media.title.match(/\b(19|20)\d{2}\b/);
      if (yearMatch) return yearMatch[0];
    }

    return null;
  };

  const getQualityBadge = () => {
    const qualityText = item.media.quality ?
      (item.media.quality.includes('2160') || item.media.quality.toLowerCase().includes('4k') ? '4K' : 'HD')
      : "HD";
    return { text: qualityText, color: 'bg-blue-600' };
  };

  const progressPercent = formatProgress(item.progress_seconds, item.duration_seconds);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="relative group cursor-pointer flex-none w-80 md:w-96"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
      style={{ zIndex: isHovered ? 50 : 1 }}
    >
      <motion.div
        className="relative bg-gray-900 rounded-xl overflow-hidden shadow-xl"
        animate={{
          scale: isHovered ? 1.03 : 1,
          y: isHovered ? -8 : 0,
        }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        style={{
          transformOrigin: 'center center',
          zIndex: isHovered ? 50 : 1,
        }}
      >
        {/* Main Image Container */}
        <div className="relative aspect-video overflow-hidden">
          <ImageWithFallback
            mediaId={item.media.id}
            alt={cleanMovieTitle(item.media.title)}
            fill
            sizes="(max-width: 768px) 50vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            loading={index < 3 ? "eager" : "lazy"}
            priority={index < 3}
            posterUrl={item.media.banner_path ? `${getApiUrl()}/api/admin/assets/${item.media.banner_path.split('/').pop()}` : null}
          />

          {/* Quality Badge */}
          <div className="absolute top-3 right-3 z-10 border border-white/50 px-2 py-1 text-xs font-bold rounded text-white backdrop-blur-sm">
            {getQualityBadge().text}
          </div>

          {/* Time Remaining Badge */}
          <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-md shadow-lg">
            {formatTime(item.duration_seconds - item.progress_seconds)} left
          </div>

          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

          {/* Play Button Overlay */}
          <AnimatePresence>
            {isHovered && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute inset-0 flex items-center justify-center z-20 bg-black/30"
              >
                <button
                  onClick={handlePlayClick}
                  disabled={isLoading}
                  className="bg-white/90 backdrop-blur-sm rounded-full p-4 hover:bg-white transition-all duration-200 shadow-xl"
                >
                  {isLoading ? (
                    <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Play className="w-6 h-6 text-black fill-black" />
                  )}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Progress Bar */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
            <motion.div
              className="bg-red-600 h-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.8, delay: index * 0.1 }}
            />
          </div>

          {/* Content Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
            {/* Title */}
            <h3 className="text-white font-bold text-lg line-clamp-2 mb-2 drop-shadow-lg">
              {cleanMovieTitle(item.media.title)}
            </h3>

            {/* Progress and Time Info */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-gray-300 text-sm">
                <Clock className="w-4 h-4" />
                <span>{formatLastWatched(item.last_watched_at)}</span>
              </div>

              <span className="text-green-400 text-sm font-medium">
                {Math.round(progressPercent)}% watched
              </span>
            </div>

            {/* Year and Rating */}
            <div className="flex items-center justify-between">
              {getYear() && (
                <span className="text-gray-300 text-sm font-medium">
                  {getYear()}
                </span>
              )}

              {item.media.rating && (
                <div className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-yellow-400 fill-current" />
                  <span className="text-white text-sm font-medium">{item.media.rating.toFixed(1)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons - Show on Hover */}
        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-4 right-4 flex gap-2 z-30"
            >
              <button
                onClick={handleInfoClick}
                className="bg-gray-800/90 backdrop-blur-sm text-white p-2 rounded-full hover:bg-gray-700/90 transition-colors shadow-lg"
                title="More Info"
              >
                <Info className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
};

export const RecentlyWatched: React.FC<RecentlyWatchedProps> = ({
  onPlay,
  onInfo
}) => {
  const [recentItems, setRecentItems] = useState<RecentlyWatchedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRecentlyWatched();
  }, []);

  const updateScrollButtons = () => {
    if (!scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const maxScroll = container.scrollWidth - container.clientWidth;

    setCanScrollLeft(container.scrollLeft > 10);
    setCanScrollRight(container.scrollLeft < maxScroll - 10);
  };

  useEffect(() => {
    // Initial check with slight delay to ensure DOM is ready
    const timeout = setTimeout(() => {
      updateScrollButtons();
    }, 100);

    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', updateScrollButtons);
      // Also check on resize
      window.addEventListener('resize', updateScrollButtons);
      return () => {
        clearTimeout(timeout);
        container.removeEventListener('scroll', updateScrollButtons);
        window.removeEventListener('resize', updateScrollButtons);
      };
    }
  }, [recentItems]);

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -400, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 400, behavior: 'smooth' });
    }
  };

  const fetchRecentlyWatched = async () => {
    try {
      setLoading(true);
      setError(null);
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/playback/recently-watched`, {
        headers: {
          'X-User-ID': '1' // Default user for now
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Filter out invalid items and only show movies
        const validItems = (data || [])
          .filter((item: RecentlyWatchedItem) => {
            // Only include movies, exclude episodes and TV series
            return item.media &&
              item.media.id &&
              item.media.title &&
              item.media.type !== 'episode' &&
              item.media.type !== 'tv' &&
              item.media.type !== 'series';
          })
          .sort((a: RecentlyWatchedItem, b: RecentlyWatchedItem) => {
            return new Date(b.last_watched_at).getTime() - new Date(a.last_watched_at).getTime();
          })
          .slice(0, 10); // Limit to 10 items

        setRecentItems(validItems);
        console.log(`✅ Loaded ${validItems.length} recently watched movies`);
      } else if (response.status === 404) {
        setRecentItems([]);
        console.log('📝 No recently watched data found');
      } else {
        throw new Error(`Failed to fetch recently watched items: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to fetch recently watched:', error);
      setError('Failed to load recently watched items');
    } finally {
      setLoading(false);
    }
  };

  const formatProgress = (progressSeconds: number, durationSeconds: number) => {
    const progressPercent = (progressSeconds / durationSeconds) * 100;
    return Math.min(Math.max(progressPercent, 0), 100);
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatLastWatched = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="mb-12">
        <div className="flex items-center justify-between mb-6 px-4 md:px-0">
          <h2 className="text-white text-xl font-semibold">
            Recently Watched
          </h2>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-4 px-4 md:px-0" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <style jsx>{`
            div::-webkit-scrollbar {
              display: none;
            }
          `}</style>
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="flex-none w-80 md:w-96 aspect-video bg-gray-800/30 rounded-xl animate-pulse backdrop-blur-sm border border-gray-700/30"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-12">
        <div className="flex items-center justify-between mb-6 px-4 md:px-0">
          <h2 className="text-white text-xl font-semibold">
            Recently Watched
          </h2>
        </div>
        <div className="px-4 md:px-0">
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6 text-center">
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={fetchRecentlyWatched}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (recentItems.length === 0) {
    return null;
  }

  return (
    <div className="mb-12">
      <div className="flex items-center justify-between mb-6 px-4 md:px-0">
        <h2 className="text-white text-xl font-semibold">
          Continue Watching
        </h2>
        <button
          onClick={fetchRecentlyWatched}
          className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10"
          title="Refresh"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
      </div>

      <div
        className="relative"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Previous Button */}
        <AnimatePresence>
          {isHovered && canScrollLeft && (
            <motion.button
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              onClick={scrollLeft}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-[150] bg-black/95 hover:bg-red-600/90 text-white p-3 rounded-full shadow-2xl backdrop-blur-md transition-all hover:scale-110 border border-red-900/50"
              style={{ marginLeft: '8px' }}
            >
              <ChevronLeft className="w-6 h-6" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Next Button */}
        <AnimatePresence>
          {isHovered && canScrollRight && (
            <motion.button
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              onClick={scrollRight}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-[150] bg-black/95 hover:bg-red-600/90 text-white p-3 rounded-full shadow-2xl backdrop-blur-md transition-all hover:scale-110 border border-red-900/50"
              style={{ marginRight: '8px' }}
            >
              <ChevronRight className="w-6 h-6" />
            </motion.button>
          )}
        </AnimatePresence>

        <div
          ref={scrollContainerRef}
          className="flex gap-4 overflow-x-auto pb-4 px-4 md:px-0"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <style jsx>{`
            div::-webkit-scrollbar {
              display: none;
            }
          `}</style>
          {recentItems.map((item, index) => (
            <RecentlyWatchedCard
              key={item.id}
              item={item}
              onPlay={onPlay}
              onInfo={onInfo}
              index={index}
            />
          ))}
        </div>
      </div>
    </div>
  );
};



export default RecentlyWatched;
