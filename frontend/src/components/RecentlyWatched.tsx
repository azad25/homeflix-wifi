"use client";

import React, { useState, useEffect } from 'react';
import { Play, Clock, MoreHorizontal } from 'lucide-react';
import { motion } from 'framer-motion';
import { Media } from '@/types/media';
import { getApiUrl } from '@/lib/api';
import { useGlobalCache } from '@/hooks/useGlobalCache';
import { ScrollXCarousel, GlassCard, MagneticButton } from '@/components/scrollx';

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

export const RecentlyWatched: React.FC<RecentlyWatchedProps> = ({
  onPlay,
  onInfo
}) => {
  // Use global cache for recently watched data
  const { data: recentItems, loading } = useGlobalCache<RecentlyWatchedItem[]>(
    `${getApiUrl()}/api/playback/recently-watched`,
    {
      headers: {
        'X-User-ID': '1' // Default user for now
      }
    },
    { customTTL: 5 * 60 * 1000 } // 5 minutes cache for recently watched
  );

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
      <div className="mb-16">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-6 px-4 md:px-12">
          Continue Watching
        </h2>
        <div className="flex gap-4 px-4 md:px-12">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="w-80 h-48 bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!recentItems || recentItems.length === 0) {
    return null;
  }

  return (
    <div className="mb-16">
      <h2 className="text-2xl md:text-3xl font-bold text-white mb-6 px-4 md:px-12 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
        Continue Watching
      </h2>
      
      <div className="flex gap-4 overflow-x-auto scrollbar-hide px-4 md:px-12 pb-4">
        {recentItems?.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex-shrink-0 w-80"
          >
            <RecentlyWatchedCard
              item={item}
              onPlay={onPlay}
              onInfo={onInfo}
              formatProgress={formatProgress}
              formatTime={formatTime}
              formatLastWatched={formatLastWatched}
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
};

interface RecentlyWatchedCardProps {
  item: RecentlyWatchedItem;
  onPlay: (media: Media, startTime?: number) => void;
  onInfo: (media: Media) => void;
  formatProgress: (progress: number, duration: number) => number;
  formatTime: (seconds: number) => string;
  formatLastWatched: (dateString: string) => string;
}

const RecentlyWatchedCard: React.FC<RecentlyWatchedCardProps> = ({
  item,
  onPlay,
  onInfo,
  formatProgress,
  formatTime,
  formatLastWatched
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);

  const getThumbnailUrl = () => {
    const apiUrl = getApiUrl();
    if (item.media.poster_path) {
      return `${apiUrl}/api/posters/${item.media.id}`;
    }
    return `${apiUrl}/api/thumbnails/${item.media.id}`;
  };

  const progressPercent = formatProgress(item.progress_seconds, item.duration_seconds);

  return (
    <motion.div
      className="relative group cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ scale: 1.02, y: -5 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <GlassCard className="overflow-hidden bg-white/10 backdrop-blur-md border border-white/20">
        {/* Thumbnail */}
        <div className="relative aspect-video overflow-hidden">
          {!imageError ? (
            <motion.img
              src={getThumbnailUrl()}
              alt={item.media.title}
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.3 }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900 flex items-center justify-center">
              <div className="text-white text-center">
                <div className="text-3xl mb-2">🎬</div>
                <div className="text-sm font-medium">{item.media.title}</div>
              </div>
            </div>
          )}

          {/* Progress Bar */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
            <motion.div
              className="h-full bg-red-600"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>

          {/* Hover Overlay */}
          <motion.div
            className="absolute inset-0 bg-black/40 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: isHovered ? 1 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <MagneticButton
              onClick={() => onPlay(item.media, item.progress_seconds)}
              className="bg-white/20 backdrop-blur-sm text-white p-4 rounded-full hover:bg-white/30 transition-all duration-200"
            >
              <Play className="w-6 h-6 fill-current" />
            </MagneticButton>
          </motion.div>

          {/* Time Remaining Badge */}
          <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm text-white text-xs px-2 py-1 rounded">
            {formatTime(item.duration_seconds - item.progress_seconds)} left
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="text-white font-bold text-lg mb-2 line-clamp-1">
            {item.media.title}
          </h3>
          
          <div className="flex items-center justify-between text-sm text-gray-300 mb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>{formatLastWatched(item.last_watched_at)}</span>
            </div>
            <span className="text-green-400">
              {Math.round(progressPercent)}% watched
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <MagneticButton
              onClick={() => onPlay(item.media, item.progress_seconds)}
              className="flex-1 bg-white text-black px-4 py-2 rounded-lg font-bold hover:bg-gray-200 transition-colors duration-200 text-sm"
            >
              Resume
            </MagneticButton>
            <MagneticButton
              onClick={() => onInfo(item.media)}
              className="bg-gray-700/80 backdrop-blur-sm text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors duration-200 text-sm"
            >
              Info
            </MagneticButton>
            <MagneticButton className="bg-gray-700/80 backdrop-blur-sm text-white px-3 py-2 rounded-lg hover:bg-gray-600 transition-colors duration-200">
              <MoreHorizontal className="w-4 h-4" />
            </MagneticButton>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
};

export default RecentlyWatched;
