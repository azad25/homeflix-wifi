'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Play, Info, Plus, Volume2, VolumeX, ThumbsUp } from 'lucide-react';
import Image from 'next/image';
import { Media } from '../types/media';
import { getApiUrl } from '../lib/api';

interface HoverVideoCardProps {
  media: Media;
  onPlay: (media: Media) => void;
  onInfo?: (media: Media) => void;
  delay?: number; // Delay before showing video preview (ms)
}

export default function HoverVideoCard({ 
  media, 
  onPlay, 
  onInfo, 
  delay = 1000 
}: HoverVideoCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const apiUrl = getApiUrl();
  const getThumbnailUrl = () => {
    if (media.poster_path) {
      return `${apiUrl}/api/posters/${media.id}`;
    }
    return `${apiUrl}/api/thumbnails/${media.id}`;
  };
  const thumbnailUrl = getThumbnailUrl();
  const previewUrl = `${apiUrl}/api/preview-clips/${media.id}`;

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  const handleMouseEnter = () => {
    setIsHovered(true);
    
    // Clear any existing hide timeout
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }

    // Set timeout to show video preview
    hoverTimeoutRef.current = setTimeout(() => {
      setShowVideo(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    
    // Clear hover timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }

    // Set timeout to hide video (with small delay for smooth UX)
    hideTimeoutRef.current = setTimeout(() => {
      setShowVideo(false);
      setIsVideoLoaded(false);
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
    }, 300);
  };

  const handleVideoLoad = () => {
    setIsVideoLoaded(true);
    if (videoRef.current && showVideo) {
      videoRef.current.play().catch(console.error);
    }
  };

  const handleVideoError = () => {
    console.error('Failed to load preview video for:', media.title);
    setShowVideo(false);
  };

  return (
    <div 
      className="relative group cursor-pointer transition-all duration-300 hover:scale-105 hover:z-10"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Base Card */}
      <div className="relative w-full aspect-video bg-gray-900 rounded-lg overflow-hidden">
        {/* Thumbnail */}
        <Image
          src={thumbnailUrl}
          alt={media.title}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className={`object-cover transition-opacity duration-300 ${
            showVideo && isVideoLoaded ? 'opacity-0' : 'opacity-100'
          }`}
          loading="lazy"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            // Create a gradient background as fallback
            target.style.display = 'none';
            const parent = target.parentElement;
            if (parent && !parent.querySelector('.fallback-bg')) {
              const fallback = document.createElement('div');
              fallback.className = 'fallback-bg absolute inset-0 bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900 flex items-center justify-center';
              fallback.innerHTML = `<div class="text-white text-center"><div class="text-2xl mb-2">🎬</div><div class="text-sm">${media.title}</div></div>`;
              parent.appendChild(fallback);
            }
          }}
        />

        {/* Video Preview */}
        {showVideo && (
          <video
            ref={videoRef}
            src={previewUrl}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
              isVideoLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            muted
            loop
            playsInline
            onLoadedData={handleVideoLoad}
            onError={handleVideoError}
          />
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Play Button Overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <button
            onClick={() => onPlay(media)}
            className="bg-white/20 backdrop-blur-sm rounded-full p-4 hover:bg-white/30 transition-colors duration-200"
          >
            <Play className="w-8 h-8 text-white fill-white" />
          </button>
        </div>
      </div>

      {/* Expanded Info Panel (Netflix-style) - Always show on hover */}
      <div className={`absolute top-full left-0 right-0 bg-gray-900 rounded-b-lg shadow-2xl p-4 z-20 transform transition-all duration-300 ${
        isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
      }`}>
        <h3 className="text-white font-semibold text-lg mb-2 line-clamp-1">
          {media.title}
        </h3>
        
        <div className="flex items-center gap-2 mb-3">
          <span className="text-green-500 font-semibold">
            {Math.round(((media.view_count || 0) / 1000) * 10) / 10}K views
          </span>
          <span className="text-gray-400">•</span>
          <span className="text-gray-400 capitalize">{media.type}</span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => onPlay(media)}
            className="bg-white text-black px-4 py-2 rounded-md font-semibold hover:bg-gray-200 transition-colors duration-200 flex items-center gap-2"
          >
            <Play className="w-4 h-4 fill-current" />
            Play
          </button>
          
          <button className="bg-gray-700 text-white p-2 rounded-full hover:bg-gray-600 transition-colors duration-200">
            <Plus className="w-4 h-4" />
          </button>
          
          <button className="bg-gray-700 text-white p-2 rounded-full hover:bg-gray-600 transition-colors duration-200">
            <ThumbsUp className="w-4 h-4" />
          </button>
          
          {onInfo && (
            <button
              onClick={() => onInfo(media)}
              className="bg-gray-700 text-white p-2 rounded-full hover:bg-gray-600 transition-colors duration-200 ml-auto"
            >
              <Info className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Genres */}
        {media.genres && media.genres.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {media.genres.slice(0, 3).map((genre) => (
              <span
                key={genre.id}
                className="text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded"
              >
                {genre.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
