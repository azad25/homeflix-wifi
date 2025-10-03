"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Play, Info } from 'lucide-react';
import { Media } from '@/types/media';
import { useContinueWatching } from '@/hooks/useContinueWatching';
import { getApiUrl } from '@/lib/api';

interface ContinueWatchingProps {
  onPlay: (media: Media, startTime?: number) => void;
  onInfo: (media: Media) => void;
}

const ContinueWatching: React.FC<ContinueWatchingProps> = ({ onPlay, onInfo }) => {
  const { continueWatching, loading, error, getProgressPercentage, formatTime } = useContinueWatching();

  if (loading) {
    return (
      <div className="px-6 py-8">
        <h2 className="text-2xl font-bold text-white mb-6">Continue Watching</h2>
        <div className="text-white/70">Loading...</div>
      </div>
    );
  }

  // Silent error handling - don't show errors to users
  if (error || continueWatching.length === 0) {
    return null;
  }

  return (
    <div className="px-6 py-8">
      <h2 className="text-2xl font-bold text-white mb-6">Continue Watching</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {continueWatching.map((item, index) => {
          const progressPercentage = getProgressPercentage(item);
          
          return (
            <motion.div
              key={item.media_id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group cursor-pointer"
            >
              <div className="relative">
                <img
                  src={`${getApiUrl()}/api/thumbnails/${item.media_id}`}
                  alt={item.media.title}
                  className="w-full aspect-video object-cover rounded-lg group-hover:scale-105 transition-transform duration-300"
                  onError={(e) => {
                    e.currentTarget.src = '/placeholder-thumbnail.jpg';
                  }}
                />
                
                {/* Progress Bar */}
                <div className="absolute bottom-0 left-0 right-0 bg-gray-900/80 p-3 rounded-b-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-white font-semibold text-sm truncate">{item.media.title}</h3>
                    <span className="text-gray-300 text-xs">{formatTime(item.progress_time)}</span>
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
                    onClick={() => onPlay(item.media, item.progress_time)}
                    className="bg-white/20 backdrop-blur-sm text-white p-3 rounded-full hover:bg-white/30 transition-colors duration-200"
                  >
                    <Play className="w-6 h-6 fill-current" />
                  </button>
                </div>

                {/* More Info Button */}
                <button
                  onClick={() => onInfo(item.media)}
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
