"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import Image from 'next/image';
import LazyImage from './LazyImage';
import { Play, Info, Plus, ThumbsUp, ChevronDown } from 'lucide-react';
import { Media } from '../types/media';
import { getApiUrl } from '../lib/api';
import QualityBadge from './QualityBadge';

interface MediaCardProps {
  media: Media;
  onPlay: (media: Media) => void;
  onInfo: (media: Media) => void;
  size?: "small" | "medium" | "large";
}

const MediaCard: React.FC<MediaCardProps> = ({ 
  media, 
  onPlay, 
  onInfo, 
  size = "medium" 
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);

  const sizeClasses = {
    small: "w-48 h-28",
    medium: "w-64 h-36", 
    large: "w-80 h-48"
  };

  const getImageUrl = (media: Media) => {
    // Prefer poster for movies, thumbnail for episodes/series
    if (media.poster_path && media.type === 'movie') {
      return `${getApiUrl()}/api/posters/${media.id}`;
    }
    return `${getApiUrl()}/api/thumbnails/${media.id}`;
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  return (
    <motion.div
      className={`relative ${sizeClasses[size]} rounded-lg overflow-hidden cursor-pointer group`}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      whileHover={{ scale: 1.05 }}
      transition={{ duration: 0.3 }}
    >
      {/* Thumbnail */}
      <div className="relative w-full h-full">
        {!imageError ? (
          <LazyImage
            src={getImageUrl(media)}
            alt={media.title}
            fill
            className="object-cover"
            onError={() => setImageError(true)}
            loaderSize="medium"
            showLoader={true}
            fallbackSrc={`${getApiUrl()}/api/thumbnails/${media.id}`}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
            <Play className="w-12 h-12 text-white/50" />
          </div>
        )}
        
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-all duration-300" />
        
        {/* Content overlay */}
        <motion.div
          className="absolute inset-0 flex flex-col justify-end p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <h3 className="text-white font-semibold text-sm mb-1 line-clamp-1">
            {media.title}
          </h3>
          
          <div className="flex items-center gap-2 text-xs text-white/80 mb-2">
            <span>{media.type}</span>
            <span>•</span>
            <span>{formatDuration(media.duration || 0)}</span>
            <span>•</span>
            <span>⭐ {(media.rating || 0).toFixed(1)}</span>
          </div>
          
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPlay(media);
              }}
              className="bg-white text-black rounded-full p-1.5 hover:bg-white/90 transition-colors"
            >
              <Play className="w-3 h-3 fill-current" />
            </button>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                // Add to watchlist
              }}
              className="bg-black/50 text-white rounded-full p-1.5 hover:bg-black/70 transition-colors"
            >
              <Plus className="w-3 h-3" />
            </button>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                onInfo(media);
              }}
              className="bg-black/50 text-white rounded-full p-1.5 hover:bg-black/70 transition-colors"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>
        </motion.div>
        
        {/* Play button for non-hover state */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 0 : 1 }}
          transition={{ duration: 0.2 }}
        >
          <button
            onClick={() => onPlay(media)}
            className="bg-black/50 text-white rounded-full p-3 hover:bg-black/70 transition-colors"
          >
            <Play className="w-6 h-6 fill-current" />
          </button>
        </motion.div>
      </div>
      
      {/* Type indicator */}
      <div className="absolute top-2 left-2">
        <span className="bg-red-600 text-white text-xs px-2 py-1 rounded">
          {media.type.toUpperCase()}
        </span>
      </div>
      
      {/* Quality Badge */}
      {media.quality && (
        <div className="absolute top-2 left-1/2 transform -translate-x-1/2">
          <QualityBadge quality={media.quality} size="sm" />
        </div>
      )}
      
    </motion.div>
  );
};

export default MediaCard;
