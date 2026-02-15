"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, X } from 'lucide-react';
import { Media } from '@/types/media';
import { MagneticButton } from './scrollx';

interface NextEpisodePreviewProps {
  nextEpisode: Media | null;
  currentTime: number;
  duration: number;
  onPlayNext: () => void;
  onCancel: () => void;
}

const NextEpisodePreview: React.FC<NextEpisodePreviewProps> = ({
  nextEpisode,
  currentTime,
  duration,
  onPlayNext,
  onCancel,
}) => {
  const [countdown, setCountdown] = useState(15);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    // Show preview 30 seconds before end
    const timeRemaining = duration - currentTime;
    if (timeRemaining <= 30 && timeRemaining > 0 && nextEpisode) {
      setShowPreview(true);
    } else {
      setShowPreview(false);
    }
  }, [currentTime, duration, nextEpisode]);

  useEffect(() => {
    if (!showPreview || !nextEpisode) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          console.log('NextEpisodePreview: Auto-playing next episode:', nextEpisode.title);
          onPlayNext();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [showPreview, nextEpisode, onPlayNext]);

  if (!showPreview || !nextEpisode) return null;

  // Get episode title - prioritize episode_title from TMDB
  const episodeTitle = nextEpisode.episode_title || nextEpisode.title;
  
  // Get episode description - prioritize description fields
  const episodeDescription = nextEpisode.description || nextEpisode.long_desc || nextEpisode.short_desc || 'No description available';

  // Get episode still URL with fallbacks
  const getEpisodeStillUrl = () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8252';
    
    // First try episode still if available
    if (nextEpisode.episode_still_path) {
      return `${apiUrl}/api/episode-stills/${nextEpisode.id}`;
    }
    
    // Fallback to thumbnail
    return `${apiUrl}/api/thumbnails/${nextEpisode.id}`;
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 100 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 100 }}
        className="fixed bottom-24 right-8 z-50 w-96"
      >
        <div className="bg-black/95 backdrop-blur-xl rounded-lg border border-white/20 overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div>
              <h3 className="text-white font-semibold text-sm">Next Episode</h3>
              <p className="text-gray-400 text-xs">Playing in {countdown}s</p>
            </div>
            <button
              onClick={onCancel}
              className="text-white/70 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Episode Info */}
          <div className="p-4">
            <div className="flex gap-4">
              {/* Episode Still/Thumbnail */}
              <div className="w-32 h-20 bg-black rounded overflow-hidden flex-shrink-0">
                <img
                  src={getEpisodeStillUrl()}
                  alt={episodeTitle}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    // Hide broken image, show black background
                    target.style.display = 'none';
                  }}
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h4 className="text-white font-medium text-sm mb-1 truncate">
                  {nextEpisode.season_number && nextEpisode.episode_number
                    ? `S${nextEpisode.season_number}:E${nextEpisode.episode_number}`
                    : ''}{' '}
                  {episodeTitle}
                </h4>
                <p className="text-gray-400 text-xs line-clamp-2">
                  {episodeDescription}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-4">
              <MagneticButton
                onClick={() => {
                  console.log('NextEpisodePreview: Play Now clicked');
                  onPlayNext();
                }}
                className="flex-1 flex items-center justify-center gap-2 bg-white text-black px-4 py-2 rounded font-semibold hover:bg-white/90 transition-colors"
              >
                <Play className="w-4 h-4 fill-current" />
                Play Now
              </MagneticButton>
              <button
                onClick={onCancel}
                className="px-4 py-2 rounded border border-white/20 text-white hover:bg-white/10 transition-colors text-sm"
              >
                Cancel
              </button>
            </div>

            {/* Progress Bar - Fixed to count down properly */}
            <div className="mt-3 h-1 bg-gray-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-red-600"
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 15, ease: 'linear' }}
              />
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default NextEpisodePreview;
