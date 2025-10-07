"use client";

import React, { useState } from 'react';
import { Play, Plus, ThumbsUp, ChevronDown, Star, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import LazyImage from './LazyImage';
import { Media } from '../types/media';
import { getApiUrl } from '../lib/api';

interface SimpleMediaCardProps {
  media: Media;
  onPlay: (media: Media) => void;
  onInfo: (media: Media) => void;
  priority?: boolean;
  delay?: number;
  showPreview?: boolean; // Control whether to show preview on hover
}

const SimpleMediaCard: React.FC<SimpleMediaCardProps> = ({
  media,
  onPlay,
  onInfo,
  priority = false,
  delay = 0,
  showPreview = false // Default to false for browse/search pages
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const apiUrl = getApiUrl();

  const getThumbnailUrl = () => {
    return `${apiUrl}/api/thumbnails/${media.id}`;
  };

  const getPosterUrl = () => {
    return `${apiUrl}/api/posters/${media.id}`;
  };

  const handlePlayClick = () => {
    setIsLoading(true);
    setTimeout(() => {
      onPlay(media);
      setIsLoading(false);
    }, 500);
  };

  const handleImageError = () => {
    setImageError(true);
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: delay / 1000 }}
      className={`relative group cursor-pointer ${isHovered ? 'z-50' : 'z-10'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onInfo(media)}
      style={{
        zIndex: isHovered ? 50 : 10,
      }}
    >
      {/* Base Card */}
      <motion.div
        className="relative w-full aspect-video bg-gray-900 rounded-lg overflow-hidden"
        animate={{
          scale: isHovered && showPreview ? 1.05 : 1,
        }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        style={{
          transformOrigin: 'center center',
        }}
      >
        {/* Thumbnail Image with Fallback */}
        {!imageError ? (
          <LazyImage
            src={media.poster_path ? getPosterUrl() : getThumbnailUrl()}
            alt={media.title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="transition-opacity duration-300 opacity-100"
            priority={priority}
            onError={() => {
              // Try thumbnail fallback if poster fails
              if (media.poster_path) {
                const img = document.querySelector(`img[alt="${media.title}"]`) as HTMLImageElement;
                if (img && img.src.includes('/posters/')) {
                  img.src = getThumbnailUrl();
                  return;
                }
              }
              handleImageError();
            }}
            loaderSize="medium"
            showLoader={true}
            fallbackSrc={getThumbnailUrl()}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900 flex items-center justify-center">
            <div className="text-white text-center">
              <div className="text-3xl mb-2">🎬</div>
              <div className="text-sm font-medium line-clamp-2 px-2">{media.title}</div>
              <div className="text-xs text-gray-400 mt-1">No Image Available</div>
            </div>
          </div>
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Quick Play Button (center) - Only show on hover */}
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePlayClick();
              }}
              disabled={isLoading}
              className="bg-white/20 backdrop-blur-sm rounded-full p-4 hover:bg-white/30 transition-all duration-200 cursor-pointer"
            >
              {isLoading ? (
                <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Play className="w-8 h-8 text-white fill-white" />
              )}
            </button>
          </motion.div>
        )}

        {/* Title and Info Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="text-white font-semibold text-sm line-clamp-1 mb-1">
            {media.title}
          </h3>
          <div className="flex items-center gap-2 text-xs text-white/80">
            {media.rating && (
              <div className="flex items-center gap-1">
                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                <span>{media.rating}</span>
              </div>
            )}
            <span className="text-gray-400 capitalize">{media.type}</span>
            {media.duration && (
              <>
                <span className="text-gray-400">•</span>
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{formatDuration(media.duration)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </motion.div>

      {/* Expanded Info Panel (Only if showPreview is true) */}
      {isHovered && showPreview && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="absolute top-full left-0 right-0 bg-gray-900 rounded-b-lg shadow-2xl p-4 border border-gray-700"
          style={{ zIndex: 60, marginTop: '4px' }}
        >
          {/* Title */}
          <h3 className="text-white font-bold text-lg mb-2 line-clamp-1">
            {media.title}
          </h3>

          {/* Metadata */}
          <div className="flex items-center gap-2 mb-3 text-sm">
            <span className="text-green-500 font-semibold">
              {Math.round(((media.view_count || 0) / 1000) * 10) / 10}K views
            </span>
            <span className="text-gray-400">•</span>
            <span className="text-gray-400 capitalize">{media.type}</span>
            {media.duration && (
              <>
                <span className="text-gray-400">•</span>
                <span className="text-gray-400">{formatDuration(media.duration)}</span>
              </>
            )}
            {media.rating && (
              <>
                <span className="text-gray-400">•</span>
                <span className="text-yellow-400">⭐ {media.rating}</span>
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePlayClick();
              }}
              disabled={isLoading}
              className="bg-white text-black px-4 py-2 rounded-md font-bold hover:bg-gray-200 transition-colors duration-200 flex items-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <Play className="w-4 h-4 fill-current" />
              )}
              Play
            </button>

            <button className="bg-gray-700 text-white p-2 rounded-full hover:bg-gray-600 transition-colors duration-200 cursor-pointer">
              <Plus className="w-4 h-4" />
            </button>

            <button className="bg-gray-700 text-white p-2 rounded-full hover:bg-gray-600 transition-colors duration-200 cursor-pointer">
              <ThumbsUp className="w-4 h-4" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onInfo(media);
              }}
              className="bg-gray-700 text-white p-2 rounded-full hover:bg-gray-600 transition-colors duration-200 ml-auto cursor-pointer"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* Genres */}
          {media.genres && media.genres.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {media.genres.slice(0, 3).map((genre, index) => (
                <span
                  key={genre.id || index}
                  className="text-xs text-gray-300 bg-gray-800 px-2 py-1 rounded"
                >
                  {genre.name}
                </span>
              ))}
            </div>
          )}

          {/* Description (if available) */}
          {media.description && (
            <p className="text-gray-400 text-sm mt-2 line-clamp-2">
              {media.description}
            </p>
          )}
        </motion.div>
      )}
    </motion.div>
  );
};

export default SimpleMediaCard;