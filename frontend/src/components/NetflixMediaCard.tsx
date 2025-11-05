"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Play, Info, Plus, Check } from 'lucide-react';
import { Media } from '@/types/media';
import { getApiUrl, loadAssetWithFallback } from '@/lib/api';
import { useImageWithFallback } from '@/lib/imageUtils';

interface NetflixMediaCardProps {
  media: Media;
  onPlay: (media: Media) => void;
  onInfo: (media: Media) => void;
  onAddToList?: (media: Media) => void;
  isInList?: boolean;
  priority?: 'high' | 'normal' | 'low';
  showPreviewOnHover?: boolean;
}

const NetflixMediaCard: React.FC<NetflixMediaCardProps> = ({
  media,
  onPlay,
  onInfo,
  onAddToList,
  isInList = false,
  priority = 'normal',
  showPreviewOnHover = true,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [imageError, setImageError] = useState(false);
  const [fallbackError, setFallbackError] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previewTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const { primarySrc, fallbackSrc } = useImageWithFallback(media.id, media.poster_url);

  // Load assets on mount
  useEffect(() => {
    loadAssets();
  }, [media.id]);

  const loadAssets = async () => {
    setIsLoading(true);
    try {
      // Load preview only (poster/thumbnail handled by useImageWithFallback)
      const preview = await loadAssetWithFallback('preview', media.id);
      if (preview) {
        setPreviewUrl(preview);
      }
    } catch (error) {
      console.warn('Failed to load preview for media:', media.id);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    
    // Always try to show preview on hover if available
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

  const handleImageError = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    
    if (img.src === primarySrc && !imageError) {
      // First error: poster failed, try thumbnail
      setImageError(true);
      img.src = fallbackSrc;
    } else if (!fallbackError) {
      // Second error: thumbnail also failed
      setFallbackError(true);
    }
  };

  const handleVideoError = () => {
    setPreviewError(true);
    setShowPreview(false);
  };

  const getDisplayImage = () => {
    // Use poster as primary, thumbnail as fallback
    if (fallbackError) return null;
    return imageError ? fallbackSrc : primarySrc;
  };

  const formatRating = (rating: number) => {
    return rating ? `${rating.toFixed(1)}★` : '';
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return '';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  return (
    <div 
      className={`group relative transition-all duration-300 ${
        isHovered ? 'z-50 scale-110' : 'z-10'
      }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Main Card */}
      <div className="aspect-[2/3] bg-gray-800 rounded-lg overflow-hidden relative">
        {/* Loading State */}
        {isLoading && (
          <div className="absolute inset-0 bg-gray-800 animate-pulse flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {/* Preview Video (Netflix-style) */}
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
        {!showPreview && getDisplayImage() && (
          <img
            src={getDisplayImage() || ''}
            alt={media.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={handleImageError}
            loading={priority === 'high' ? 'eager' : 'lazy'}
          />
        )}

        {/* Fallback for missing images */}
        {(fallbackError || !getDisplayImage()) && !isLoading && (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <div className="text-2xl mb-2">🎬</div>
              <div className="text-xs font-medium">{media.title}</div>
            </div>
          </div>
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Controls Overlay (Netflix-style) */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPlay(media);
              }}
              className="bg-white text-black p-3 rounded-full hover:bg-gray-200 transition-colors shadow-lg"
              title="Play"
            >
              <Play className="w-4 h-4 fill-current" />
            </button>
            
            {onAddToList && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAddToList(media);
                }}
                className="bg-gray-800/80 text-white p-3 rounded-full hover:bg-gray-700/80 transition-colors shadow-lg border border-gray-600"
                title={isInList ? "Remove from My List" : "Add to My List"}
              >
                {isInList ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              </button>
            )}
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                onInfo(media);
              }}
              className="bg-gray-800/80 text-white p-3 rounded-full hover:bg-gray-700/80 transition-colors shadow-lg border border-gray-600"
              title="More Info"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Rating Badge */}
        {media.rating && (
          <div className="absolute top-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
            {formatRating(media.rating)}
          </div>
        )}

        {/* Quality Badge */}
        {media.quality && (
          <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs px-2 py-1 rounded font-semibold">
            {media.quality.includes('2160') || media.quality.toLowerCase().includes('4k') ? '4K' : 'HD'}
          </div>
        )}
      </div>

      {/* Title and Info (Netflix-style) */}
      <div className="mt-2 px-1">
        <h3 
          className="text-white text-sm font-medium truncate group-hover:text-red-400 transition-colors cursor-pointer"
          onClick={() => onInfo(media)}
          title={media.title}
        >
          {media.title}
        </h3>
        
        <div className="flex items-center justify-between mt-1">
          <p className="text-gray-400 text-xs capitalize">
            {media.type === 'episode' ? 'TV Series' : media.type}
          </p>
          
          {media.duration && (
            <p className="text-gray-500 text-xs">
              {formatDuration(media.duration)}
            </p>
          )}
        </div>

        {/* Genres (shown on hover) */}
        {isHovered && media.genres && media.genres.length > 0 && (
          <div className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="flex flex-wrap gap-1">
              {media.genres.slice(0, 2).map((genre, index) => (
                <span 
                  key={index}
                  className="text-xs text-gray-400 bg-gray-800/50 px-2 py-1 rounded"
                >
                  {genre.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NetflixMediaCard;