"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Play, Clock, Star, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Media } from '@/types/media';
import { getApiUrl } from '@/lib/api';
import { useNavigate } from '@/hooks/useNavigate';
import { getColorPaletteByGenre } from '@/types/widgets';

interface RecentlyWatchedItem {
  id: number;
  media_id: number;
  user_id: number;
  last_watched_at: string;
  progress_seconds: number;
  duration_seconds: number;
  media: Media;
}

interface RecentlyWatchedWidgetProps {
  title?: string;
  maxItems?: number;
  layout?: 'banner' | 'slideshow' | 'grid';
  showProgress?: boolean;
  className?: string;
  onPlay?: (media: Media, startTime?: number) => void;
}

export default function RecentlyWatchedWidget({
  title = 'Continue Watching',
  maxItems = 10,
  layout: _layout = 'slideshow',
  showProgress = true,
  className = '',
  onPlay
}: RecentlyWatchedWidgetProps) {
  const [recentItems, setRecentItems] = useState<RecentlyWatchedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const apiUrl = getApiUrl();

  const itemWidth = 400;
  const gap = 16;
  const scrollAmount = itemWidth * 2 + gap;

  useEffect(() => {
    fetchRecentlyWatched();
  }, []);

  const fetchRecentlyWatched = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${apiUrl}/api/playback/recently-watched`, {
        headers: {
          'X-User-ID': '1'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const validItems = (data || [])
          .filter((item: RecentlyWatchedItem) => {
            return item.media &&
              item.media.id &&
              item.media.title &&
              item.progress_seconds > 0 &&
              item.duration_seconds > 0;
          })
          .sort((a: RecentlyWatchedItem, b: RecentlyWatchedItem) => {
            return new Date(b.last_watched_at).getTime() - new Date(a.last_watched_at).getTime();
          })
          .slice(0, maxItems);

        setRecentItems(validItems);
      } else if (response.status === 404) {
        setRecentItems([]);
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

  const handlePlay = (item: RecentlyWatchedItem) => {
    if (onPlay) {
      onPlay(item.media, item.progress_seconds);
    } else {
      // Ensure we route to local content correctly
      // Recently watched items are always local content
      const media = item.media;
      if (media.type === 'episode' || media.type === 'tv' || media.type === 'series') {
        const seriesId = media.series_id || media.id;
        navigate.push(`/tv-series/${seriesId}`);
      } else {
        // For movies, always use local movie route
        navigate.push(`/movie/${media.id}`);
      }
    }
  };

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
  }, [recentItems]);

  const formatProgress = (progressSeconds: number, durationSeconds: number) => {
    const progressPercent = (progressSeconds / durationSeconds) * 100;
    return Math.min(Math.max(progressPercent, 0), 100);
  };

  const formatTimeRemaining = (progressSeconds: number, durationSeconds: number) => {
    const remainingSeconds = durationSeconds - progressSeconds;
    const hours = Math.floor(remainingSeconds / 3600);
    const minutes = Math.floor((remainingSeconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
  };

  const formatTimeAgo = (dateString: string) => {
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

  const getBackdropUrl = (media: Media) => {
    if (media.tmdb_backdrop_url) return media.tmdb_backdrop_url;
    if (media.banner_path) return `${apiUrl}/api/admin/assets/${media.banner_path.split('/').pop()}`;
    return `${apiUrl}/api/thumbnails/${media.id}`;
  };

  const getLogoUrl = (media: Media) => {
    if (media.logo_path) {
      if (media.logo_path.startsWith('http')) return media.logo_path;
      if (media.logo_path.startsWith('/api/')) return `${apiUrl}${media.logo_path}`;
      const filename = media.logo_path.includes('/') ? media.logo_path.split('/').pop() : media.logo_path;
      return `${apiUrl}/api/logos/${filename}`;
    }
    return null;
  };

  if (loading) {
    return (
      <div className={`py-8 ${className}`}>
        <div className="flex items-center gap-4 mb-6 px-4 md:px-12">
          <div className="w-10 h-10 bg-red-500/20 rounded-xl animate-pulse" />
          <div className="h-8 w-48 bg-white/10 rounded animate-pulse" />
        </div>
        <div className="flex gap-4 overflow-hidden px-4 md:px-12">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex-none w-96 aspect-video bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`py-8 ${className}`}>
        <div className="px-4 md:px-12">
          <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-6 text-center">
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
    <div 
      className={`w-full py-8 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6 px-4 md:px-12">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-gradient-to-br from-red-500/30 to-red-600/20 backdrop-blur-sm border border-red-400/30 rounded-xl flex items-center justify-center">
            <Play className="w-5 h-5 text-red-400 fill-current" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-white">{title}</h2>
            <p className="text-sm text-white/50">{recentItems.length > 0 ? `${recentItems.length} items to continue` : 'No items to continue'}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={fetchRecentlyWatched}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors border border-white/10"
            title="Refresh"
          >
            <RotateCcw className="w-4 h-4 text-white/70" />
          </button>
          
          <motion.button
            onClick={() => scroll("left")}
            disabled={!canScrollLeft}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className={`p-3 rounded-full backdrop-blur-md border transition-all ${
              !canScrollLeft 
                ? 'opacity-30 cursor-not-allowed bg-white/5 border-white/10' 
                : 'bg-white/10 hover:bg-white/20 border-white/20'
            }`}
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </motion.button>
          <motion.button
            onClick={() => scroll("right")}
            disabled={!canScrollRight}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className={`p-3 rounded-full backdrop-blur-md border transition-all ${
              !canScrollRight 
                ? 'opacity-30 cursor-not-allowed bg-white/5 border-white/10' 
                : 'bg-white/10 hover:bg-white/20 border-white/20'
            }`}
          >
            <ChevronRight className="w-5 h-5 text-white" />
          </motion.button>
        </div>
      </div>

      {/* Scrollable Cards */}
      <div className="relative">
        <div
          ref={scrollRef}
          onScroll={updateScrollButtons}
          className="flex gap-4 overflow-x-auto pb-4 px-4 md:px-12 scrollbar-hide"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {recentItems.map((item, index) => {
            const progressPercent = formatProgress(item.progress_seconds, item.duration_seconds);
            const colors = getColorPaletteByGenre(item.media.genre_names || []);
            const logoUrl = getLogoUrl(item.media);

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: index * 0.05 }}
                className="flex-none relative cursor-pointer group hover:z-50"
                style={{ width: `${itemWidth}px`, scrollSnapAlign: "start" }}
                onClick={() => handlePlay(item)}
              >
                <motion.div
                  className="relative aspect-video rounded-xl overflow-hidden shadow-2xl bg-gray-900 border border-white/5 group-hover:border-white/20 transition-all"
                  whileHover={{ scale: 1.03, y: -4 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  style={{
                    transformOrigin: 'bottom center',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                  }}
                >
                  {/* Background Image */}
                  <img
                    src={getBackdropUrl(item.media)}
                    alt={item.media.title}
                    className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                    loading="lazy"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = `${apiUrl}/api/thumbnails/${item.media.id}`;
                    }}
                  />

                  {/* Gradient Overlays */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-80 group-hover:opacity-90 transition-opacity duration-300" />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent" />

                  {/* Progress Bar at Bottom */}
                  {showProgress && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                      <motion.div
                        className="h-full bg-red-600"
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercent}%` }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                      />
                    </div>
                  )}

                  {/* Content */}
                  <div className="absolute inset-0 p-4 flex flex-col justify-between">
                    {/* Top Row - Time Info */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="px-2 py-1 rounded-md backdrop-blur-md text-xs font-medium flex items-center gap-1"
                          style={{ backgroundColor: `${colors.primary}40`, borderColor: `${colors.primary}60` }}
                        >
                          <Clock className="w-3 h-3" />
                          {formatTimeAgo(item.last_watched_at)}
                        </div>
                      </div>
                      
                      {item.media.rating && item.media.rating > 0 && (
                        <div className="flex items-center gap-1 px-2 py-1 bg-black/60 backdrop-blur-md rounded-md">
                          <Star className="w-3 h-3 text-yellow-400 fill-current" />
                          <span className="text-xs font-semibold">{item.media.rating.toFixed(1)}</span>
                        </div>
                      )}
                    </div>

                    {/* Bottom Content */}
                    <div className="space-y-3 translate-y-3 group-hover:translate-y-0 transition-transform duration-300">
                      {/* Logo or Title */}
                      {logoUrl ? (
                        <img
                          src={logoUrl}
                          alt={item.media.title}
                          className="max-h-12 w-auto drop-shadow-2xl"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const fallback = target.nextElementSibling as HTMLElement;
                            if (fallback) fallback.style.display = 'block';
                          }}
                        />
                      ) : null}
                      <div style={{ display: logoUrl ? 'none' : 'block' }}>
                        <h3 className="text-lg font-bold text-white line-clamp-1 drop-shadow-lg">
                          {item.media.title}
                        </h3>
                      </div>
                      {/* Episode info for TV series */}
                      {(item.media.type === 'episode' || item.media.type === 'tv' || item.media.type === 'series') && 
                       (item.media.season_number || item.media.episode_number || item.media.season || item.media.episode) && (
                        <p className="text-sm text-white/70 drop-shadow-lg">
                          {(item.media.season_number || item.media.season) && `S${item.media.season_number || item.media.season}`}
                          {(item.media.episode_number || item.media.episode) && `E${item.media.episode_number || item.media.episode}`}
                        </p>
                      )}

                      {/* Progress Info */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-white/70">
                          {formatTimeRemaining(item.progress_seconds, item.duration_seconds)}
                        </span>
                        <span 
                          className="text-sm font-semibold"
                          style={{ color: colors.primary }}
                        >
                          {Math.round(progressPercent)}% complete
                        </span>
                      </div>

                    </div>
                  </div>
                </motion.div>

                {/* Genres below card */}
                {item.media.genre_names && item.media.genre_names.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {item.media.genre_names.slice(0, 3).map((genre, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 text-xs rounded-full bg-white/10 text-white/60"
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Gradient Masks */}
        <div className="absolute left-0 top-0 bottom-4 w-12 bg-gradient-to-r from-black to-transparent pointer-events-none z-10" />
        <div className="absolute right-0 top-0 bottom-4 w-12 bg-gradient-to-l from-black to-transparent pointer-events-none z-10" />
      </div>
    </div>
  );
}
