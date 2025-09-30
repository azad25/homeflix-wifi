"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Play, Clock } from 'lucide-react';
import { Media } from '@/types/media';
import { useRecommendations } from '@/contexts/RecommendationContext';
import { getApiUrl } from '@/lib/api';
import { cleanMovieTitle } from '@/lib/titleUtils';

interface ContinueWatchingProps {
  onPlay: (media: Media, startTime?: number) => void;
  onInfo: (media: Media) => void;
}

const ContinueWatching: React.FC<ContinueWatchingProps> = ({ onPlay, onInfo }) => {
  const { continueWatching, engine } = useRecommendations();

  if (continueWatching.length === 0) {
    return null;
  }

  const getProgressPercentage = (mediaId: number): number => {
    if (!engine) return 0;
    const progress = engine['userPreferences']?.playbackProgress?.find(p => p.mediaId === mediaId);
    if (!progress) return 0;
    return (progress.currentTime / progress.duration) * 100;
  };

  const getProgressTime = (mediaId: number): number => {
    if (!engine) return 0;
    const progress = engine['userPreferences']?.playbackProgress?.find(p => p.mediaId === mediaId);
    return progress?.currentTime || 0;
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
    }
    return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
  };

  return (
    <div className="px-6 py-8">
      <h2 className="text-2xl font-bold text-white mb-6">Continue Watching</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {continueWatching.map((media, index) => {
          const progressPercentage = getProgressPercentage(media.id);
          const progressTime = getProgressTime(media.id);
          
          return (
            <motion.div
              key={media.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group cursor-pointer"
            >
              <div className="relative">
                {/* Thumbnail */}
                <div className="relative aspect-video bg-gray-800 rounded-lg overflow-hidden">
                  <img
                    src={`${getApiUrl()}/api/thumbnail/${media.id}`}
                    alt={cleanMovieTitle(media.title)}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      e.currentTarget.src = '/placeholder-thumbnail.jpg';
                    }}
                  />
                  
                  {/* Progress Bar */}
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-600">
                    <div 
                      className="h-full bg-red-600 transition-all duration-300"
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                  
                  {/* Play Button Overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => onPlay(media, progressTime)}
                      className="bg-white/90 text-black rounded-full p-3 hover:bg-white transition-colors"
                    >
                      <Play className="w-6 h-6 ml-1" />
                    </motion.button>
                  </div>
                </div>
                
                {/* Media Info */}
                <div className="mt-3">
                  <h3 
                    className="text-white font-medium text-sm mb-1 line-clamp-2 cursor-pointer hover:text-gray-300 transition-colors"
                    onClick={() => onInfo(media)}
                  >
                    {cleanMovieTitle(media.title)}
                  </h3>
                  
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Clock className="w-3 h-3" />
                    <span>{formatTime(progressTime)} watched</span>
                    <span>•</span>
                    <span>{Math.round(progressPercentage)}% complete</span>
                  </div>
                  
                  {media.genres && media.genres.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {media.genres.slice(0, 2).map((genre) => (
                        <span
                          key={genre.name}
                          className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded"
                        >
                          {genre.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default ContinueWatching;
