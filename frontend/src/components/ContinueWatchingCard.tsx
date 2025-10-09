"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Play, Info } from 'lucide-react';
import { Media } from '@/types/media';
import { getApiUrl } from '@/lib/api';
import { useAssetUrl } from '@/hooks/useGlobalCache';

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

interface ContinueWatchingCardProps {
  item: ContinueWatchingItem;
  onPlay: (media: Media, startTime?: number) => void;
  onInfo: (media: Media) => void;
  priority?: 'high' | 'normal' | 'low';
}

const ContinueWatchingCard: React.FC<ContinueWatchingCardProps> = ({
  item,
  onPlay,
  onInfo,
  priority = 'normal',
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  
  // Use global cache for assets - backend expects numeric IDs, not UUIDs
  const { data: thumbnailUrl, loading: thumbnailLoading } = useAssetUrl('thumbnails', item.media.id.toString());
  const { data: previewUrl, loading: previewLoading } = useAssetUrl('previews', item.media.id.toString());
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previewTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    setIsHovered(true);
    
    if (previewUrl && !previewError) {
      // Delay preview to avoid triggering on quick hovers
      hoverTimeoutRef.current = setTimeout(() => {
        setShowPreview(true);
        // Start video after a brief delay
        previewTimeoutRef.current = setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.currentTime = 0;
            videoRef.current.play().catch(() => {
              setPreviewError(true);
            });
          }
        }, 200);
      }, 500); // 500ms delay like Netflix
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setShowPreview(false);
    
    // Clear timeouts
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
    }
    
    // Stop video
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  const handleImageError = () => {
    setImageError(true);
  };

  const handleVideoError = () => {
    setPreviewError(true);
    setShowPreview(false);
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

  const formatTimeRemaining = (position: number, duration: number) => {
    const remaining = duration - position;
    return formatTime(remaining);
  };

  // Generate fallback image URL
  const getFallbackImageUrl = () => {
    const apiUrl = getApiUrl();
    return `${apiUrl}/api/thumbnails/${item.media.id}`;
  };

  const getDisplayImage = () => {
    if (imageError) {
      return getFallbackImageUrl();
    }
    return thumbnailUrl || getFallbackImageUrl();
  };

  return (
    <div 
      className={`group relative transition-all duration-300 ${
        isHovered ? 'z-50 scale-105' : 'z-10'
      }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Main Card */}
      <div className="aspect-video bg-gray-800 rounded-lg overflow-hidden relative">
        {/* Loading State */}
        {thumbnailLoading && (
          <div className="absolute inset-0 bg-gray-800 animate-pulse flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {/* Preview Video */}
        {showPreview && previewUrl && !previewError && (
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover z-20"
            muted
            loop
            playsInline
            onError={handleVideoError}
          >
            <source src={previewUrl} type="video/mp4" />
          </video>
        )}

        {/* Thumbnail Image */}
        {!showPreview && (
          <img
            src={getDisplayImage()}
            alt={item.media.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={handleImageError}
            loading={priority === 'high' ? 'eager' : 'lazy'}
          />
        )}

        {/* Fallback for missing images */}
        {!getDisplayImage() && !thumbnailLoading && (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <div className="text-3xl mb-2">{item.media.type === 'movie' ? '🎬' : '📺'}</div>
              <div className="text-xs font-medium px-2 leading-tight">{item.media.title}</div>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        <div className="absolute bottom-0 left-0 right-0 bg-black/50 h-1">
          <div 
            className="bg-red-600 h-full transition-all duration-300"
            style={{ width: `${Math.min(Math.max(item.progress, 0), 100)}%` }}
          />
        </div>

        {/* Progress Text */}
        <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
          {Math.round(item.progress)}%
        </div>

        {/* Time Remaining */}
        <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
          {formatTimeRemaining(item.position, item.duration)} left
        </div>

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Controls Overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPlay(item.media, item.position);
              }}
              className="bg-white text-black p-3 rounded-full hover:bg-gray-200 transition-colors shadow-lg"
              title="Continue Watching"
            >
              <Play className="w-4 h-4 fill-current" />
            </button>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                onInfo(item.media);
              }}
              className="bg-gray-800/80 text-white p-3 rounded-full hover:bg-gray-700/80 transition-colors shadow-lg border border-gray-600"
              title="More Info"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quality Badge */}
        {item.media.quality && (
          <div className="absolute top-2 left-2 bg-red-600/90 text-white text-xs px-2 py-1 rounded font-semibold">
            {item.media.quality.toUpperCase()}
          </div>
        )}
      </div>

      {/* Title and Info */}
      <div className="mt-2 px-1">
        <h3 
          className="text-white text-sm font-medium truncate group-hover:text-red-400 transition-colors cursor-pointer"
          onClick={() => onInfo(item.media)}
          title={item.media.title}
        >
          {item.media.title}
        </h3>
        
        <div className="flex items-center justify-between mt-1">
          <p className="text-gray-400 text-xs capitalize">
            {item.media.type === 'episode' ? 'TV Series' : item.media.type}
          </p>
          
          <p className="text-gray-500 text-xs">
            {formatTime(item.position)} / {formatTime(item.duration)}
          </p>
        </div>

        {/* Episode Info for TV Series */}
        {item.media.type === 'episode' && (item.media.season_number || item.media.episode_number) && (
          <div className="mt-1">
            <p className="text-gray-500 text-xs">
              S{item.media.season_number?.toString().padStart(2, '0')}E{item.media.episode_number?.toString().padStart(2, '0')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContinueWatchingCard;
