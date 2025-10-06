"use client";

import React, { useState, useEffect } from 'react';
import { Play, Clock, MoreHorizontal, RotateCcw, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Media } from '@/types/media';
import { getApiUrl } from '@/lib/api';
import { ScrollXCarousel, GlassCard, MagneticButton } from '@/components/scrollx';

interface ContinueWatchingItem {
  id: number;
  media_id: number;
  user_id: string;
  position: number;
  duration: number;
  progress: number;
  completed: boolean;
  last_watched: string;
  media: Media;
}

interface ContinueWatchingProps {
  onPlay: (media: Media, startTime?: number) => void;
  onInfo: (media: Media) => void;
}

export const ContinueWatching: React.FC<ContinueWatchingProps> = ({
  onPlay,
  onInfo
}) => {
  const [continueItems, setContinueItems] = useState<ContinueWatchingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchContinueWatching();
  }, []);

  const fetchContinueWatching = async () => {
    try {
      setLoading(true);
      setError(null);
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/playback/continue?limit=10`, {
        headers: {
          'X-User-ID': '1' // Default user for now
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setContinueItems(data || []);
      } else {
        throw new Error('Failed to fetch continue watching items');
      }
    } catch (error) {
      console.error('Failed to fetch continue watching:', error);
      setError('Failed to load continue watching items');
    } finally {
      setLoading(false);
    }
  };

  const removeFromContinueWatching = async (itemId: number) => {
    try {
      // Optimistically remove from UI
      setContinueItems(prev => prev.filter(item => item.id !== itemId));
      
      // TODO: Add API call to mark as completed or remove from continue watching
      // For now, we'll just remove from local state
    } catch (error) {
      console.error('Failed to remove item:', error);
      // Refresh the list on error
      fetchContinueWatching();
    }
  };

  const formatProgress = (progress: number) => {
    return Math.min(Math.max(progress, 0), 100);
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
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
        <div className="flex items-center justify-between mb-6 px-4 md:px-12">
          <h2 className="text-2xl md:text-3xl font-bold text-white bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
            Continue Watching
          </h2>
        </div>
        <div className="flex gap-4 overflow-x-auto scrollbar-hide px-4 md:px-12 pb-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex-shrink-0 w-80 h-48 bg-gray-800/50 rounded-lg animate-pulse backdrop-blur-sm" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-12">
        <div className="flex items-center justify-between mb-6 px-4 md:px-12">
          <h2 className="text-2xl md:text-3xl font-bold text-white bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
            Continue Watching
          </h2>
        </div>
        <div className="px-4 md:px-12">
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6 text-center">
            <p className="text-red-400 mb-4">{error}</p>
            <MagneticButton
              onClick={fetchContinueWatching}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Try Again
            </MagneticButton>
          </div>
        </div>
      </div>
    );
  }

  if (continueItems.length === 0) {
    return null;
  }

  return (
    <div className="mb-12">
      <div className="flex items-center justify-between mb-6 px-4 md:px-12">
        <h2 className="text-2xl md:text-3xl font-bold text-white bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
          Continue Watching
        </h2>
        <MagneticButton
          onClick={fetchContinueWatching}
          className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10"
          title="Refresh"
        >
          <RotateCcw className="w-5 h-5" />
        </MagneticButton>
      </div>
      
      <div className="flex gap-4 overflow-x-auto scrollbar-hide px-4 md:px-12 pb-4">
        <AnimatePresence>
          {continueItems.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ delay: index * 0.1 }}
              className="flex-shrink-0 w-80"
            >
              <ContinueWatchingCard
                item={item}
                onPlay={onPlay}
                onInfo={onInfo}
                onRemove={removeFromContinueWatching}
                formatProgress={formatProgress}
                formatTime={formatTime}
                formatLastWatched={formatLastWatched}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

interface ContinueWatchingCardProps {
  item: ContinueWatchingItem;
  onPlay: (media: Media, startTime?: number) => void;
  onInfo: (media: Media) => void;
  onRemove: (itemId: number) => void;
  formatProgress: (progress: number) => number;
  formatTime: (seconds: number) => string;
  formatLastWatched: (dateString: string) => string;
}

const ContinueWatchingCard: React.FC<ContinueWatchingCardProps> = ({
  item,
  onPlay,
  onInfo,
  onRemove,
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

  const progressPercent = formatProgress(item.progress);
  const timeRemaining = item.duration - item.position;

  return (
    <motion.div
      className="relative group cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ scale: 1.02, y: -5 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <GlassCard className="overflow-hidden bg-white/10 backdrop-blur-md border border-white/20 hover:border-white/40 transition-all duration-300">
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
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/60">
            <motion.div
              className="h-full bg-gradient-to-r from-red-500 to-red-600 shadow-lg"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>

          {/* Hover Overlay */}
          <motion.div
            className="absolute inset-0 bg-black/50 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: isHovered ? 1 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <MagneticButton
              onClick={() => onPlay(item.media, item.position)}
              className="bg-white/20 backdrop-blur-sm text-white p-4 rounded-full hover:bg-white/30 transition-all duration-200 hover:scale-110"
            >
              <Play className="w-6 h-6 fill-current" />
            </MagneticButton>
          </motion.div>

          {/* Remove Button */}
          <motion.button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(item.id);
            }}
            className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm text-white p-1.5 rounded-full hover:bg-red-600/80 transition-all duration-200 opacity-0 group-hover:opacity-100"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <X className="w-4 h-4" />
          </motion.button>

          {/* Time Remaining Badge */}
          <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full">
            {formatTime(timeRemaining)} left
          </div>

          {/* Episode Info for TV Shows */}
          {item.media.type === 'episode' && (item.media.season_number || item.media.episode_number) && (
            <div className="absolute bottom-6 left-2 bg-black/70 backdrop-blur-sm text-white text-xs px-2 py-1 rounded">
              S{item.media.season_number || 1}:E{item.media.episode_number || 1}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="text-white font-bold text-lg mb-2 line-clamp-1 group-hover:text-red-400 transition-colors">
            {item.media.title}
          </h3>
          
          <div className="flex items-center justify-between text-sm text-gray-300 mb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>{formatLastWatched(item.last_watched)}</span>
            </div>
            <span className="text-green-400 font-medium">
              {Math.round(progressPercent)}% watched
            </span>
          </div>

          {/* Media Type and Rating */}
          <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
            <span className="capitalize bg-gray-700/50 px-2 py-1 rounded">
              {item.media.type}
            </span>
            {item.media.rating && (
              <div className="flex items-center gap-1">
                <span className="text-yellow-400">★</span>
                <span>{item.media.rating.toFixed(1)}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <MagneticButton
              onClick={() => onPlay(item.media, item.position)}
              className="flex-1 bg-white text-black px-4 py-2 rounded-lg font-bold hover:bg-gray-200 transition-colors duration-200 text-sm flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" />
              Resume
            </MagneticButton>
            <MagneticButton
              onClick={() => onInfo(item.media)}
              className="bg-gray-700/80 backdrop-blur-sm text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors duration-200 text-sm"
            >
              Info
            </MagneticButton>
            <MagneticButton 
              className="bg-gray-700/80 backdrop-blur-sm text-white px-3 py-2 rounded-lg hover:bg-gray-600 transition-colors duration-200"
              title="More options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </MagneticButton>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
};

export default ContinueWatching;