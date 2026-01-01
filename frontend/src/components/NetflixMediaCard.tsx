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
  disableHover?: boolean;
}

const NetflixMediaCard: React.FC<NetflixMediaCardProps> = ({
  media,
  onPlay,
  onInfo,
  onAddToList,
  isInList = false,
  priority = 'normal',
  showPreviewOnHover = true,
  disableHover = false,
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
    if (disableHover) return;
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
      className={`group relative transition-all duration-200 ${isHovered && !disableHover ? 'z-50 scale-105' : 'z-10'
        }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Main Card */}
      <div className="aspect-[2/3] bg-gray-800 rounded-md overflow-hidden relative">
        {/* Loading State */}
        {isLoading && (
          <div className="absolute inset-0 bg-gray-800 animate-pulse flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
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
            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
            onError={handleImageError}
            loading={priority === 'high' ? 'eager' : 'lazy'}
          />
        )}

        {/* Fallback for missing images */}
        {(fallbackError || !getDisplayImage()) && !isLoading && (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <div className="text-xl mb-1">🎬</div>
              <div className="text-[10px] font-medium px-1">{media.title}</div>
            </div>
          </div>
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

        {/* Controls Overlay (Netflix-style) */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="flex gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPlay(media);
              }}
              className="bg-white text-black p-2 rounded-full hover:bg-gray-200 transition-colors shadow-lg"
              title="Play"
            >
              <Play className="w-3 h-3 fill-current" />
            </button>

            {onAddToList && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAddToList(media);
                }}
                className="bg-gray-800/80 text-white p-2 rounded-full hover:bg-gray-700/80 transition-colors shadow-lg border border-gray-600"
                title={isInList ? "Remove from My List" : "Add to My List"}
              >
                {isInList ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
              </button>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                onInfo(media);
              }}
              className="bg-gray-800/80 text-white p-2 rounded-full hover:bg-gray-700/80 transition-colors shadow-lg border border-gray-600"
              title="More Info"
            >
              <Info className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Rating Badge */}
        {media.rating && (
          <div className="absolute top-1.5 right-1.5 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm">
            {formatRating(media.rating)}
          </div>
        )}

        {/* Quality Badge */}
        {media.quality && (
          <div className="absolute top-1.5 left-1.5 border border-white/50 text-white text-[9px] px-1 py-0.5 rounded font-medium backdrop-blur-sm">
            {media.quality.includes('2160') || media.quality.toLowerCase().includes('4k') ? '4K' : 'HD'}
          </div>
        )}
      </div>

      {/* Title and Info (Netflix-style) */}
      <div className="mt-1.5 px-0.5">
        <h3
          className="text-white text-xs font-medium truncate group-hover:text-red-400 transition-colors cursor-pointer"
          onClick={() => onInfo(media)}
          title={media.title}
        >
          {media.title}
        </h3>

        <div className="flex items-center justify-between mt-0.5">
          <p className="text-gray-400 text-[10px] capitalize">
            {media.type === 'episode' ? 'TV Series' : media.type}
          </p>

          <p className="text-gray-500 text-[10px]">
            {media.year || (media.release_date ? new Date(media.release_date).getFullYear() : (media.created_at ? new Date(media.created_at).getFullYear() : ''))}
          </p>
        </div>

        {/* Genres (shown on hover) */}
        {media.genres && media.genres.length > 0 && (
          <div className="absolute left-0 right-0 px-0.5 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto">
            <div className="flex flex-wrap gap-0.5">
              {media.genres.slice(0, 2).map((genre, index) => (
                <span
                  key={index}
                  className="text-[9px] text-gray-300 bg-gray-800/90 px-1.5 py-0.5 rounded backdrop-blur-md border border-white/10"
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