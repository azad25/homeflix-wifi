"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Play, Info } from 'lucide-react';
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
          const progressPercentage = getProgressPercentage(media.mediaId);
          const progressTime = getProgressTime(media.mediaId);
          
          return (
            <motion.div
              key={media.mediaId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group cursor-pointer"
            >
              <div className="relative">
                <img
                  src={`${getApiUrl()}/api/thumbnail/${media.mediaId}`}
                  alt={media.title}
                  className="w-full aspect-video object-cover rounded-lg group-hover:scale-105 transition-transform duration-300"
                  onError={(e) => {
                    e.currentTarget.src = '/placeholder-thumbnail.jpg';
                  }}
                />
                
                {/* Progress Bar */}
                <div className="absolute bottom-0 left-0 right-0 bg-gray-900/80 p-3 rounded-b-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-white font-semibold text-sm truncate">{media.title}</h3>
                    <span className="text-gray-300 text-xs">{formatTime(progressTime)}</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-1">
                    <div 
                      className="bg-red-600 h-1 rounded-full transition-all duration-300" 
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                </div>

                {/* Play Button Overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/50 rounded-lg">
                  <button
                    onClick={() => onPlay({ ...media, id: media.mediaId } as Media)}
                    className="bg-white/20 backdrop-blur-sm text-white p-3 rounded-full hover:bg-white/30 transition-colors duration-200"
                  >
                    <Play className="w-6 h-6 fill-current" />
                  </button>
                </div>

                {/* More Info Button */}
                <button
                  onClick={() => onInfo({ ...media, id: media.mediaId } as Media)}
                  className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-black/70"
                >
                  <Info className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default ContinueWatching;
