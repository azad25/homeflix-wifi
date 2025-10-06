"use client";

import React, { useState, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import { Media } from '@/types/media';
import { getApiUrl } from '@/lib/api';
import NetflixCard from './NetflixCard';

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

interface ContinueWatchingProps {
  onPlay: (media: Media, startTime?: number) => void;
  onInfo: (media: Media) => void;
}

export const ContinueWatching: React.FC<ContinueWatchingProps> = ({
  onPlay,
  onInfo
}) => {
  const [continueItems, setContinueItems] = useState<ContinueWatchingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchContinueWatching();
  }, []);

  const fetchContinueWatching = async () => {
    try {
      setLoading(true);
      setError(null);
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/playback/continue?limit=10`, {
        headers: {
          'X-User-ID': '1' // Default user for now
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setContinueItems(data || []);
      } else {
        throw new Error('Failed to fetch continue watching items');
      }
    } catch (error) {
      console.error('Failed to fetch continue watching:', error);
      setError('Failed to load continue watching items');
    } finally {
      setLoading(false);
    }
  };



  if (loading) {
    return (
      <div className="mb-12">
        <div className="flex items-center justify-between mb-6 px-4 md:px-12">
          <h2 className="text-2xl md:text-3xl font-bold text-white bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
            Continue Watching
          </h2>
        </div>
        <div className="flex gap-4 overflow-x-auto scrollbar-hide px-4 md:px-12 pb-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex-shrink-0 w-80 h-48 bg-gray-800/50 rounded-lg animate-pulse backdrop-blur-sm" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-12">
        <div className="flex items-center justify-between mb-6 px-4 md:px-12">
          <h2 className="text-2xl md:text-3xl font-bold text-white bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
            Continue Watching
          </h2>
        </div>
        <div className="px-4 md:px-12">
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6 text-center">
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={fetchContinueWatching}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (continueItems.length === 0) {
    return null;
  }

  return (
    <div className="mb-12">
      <div className="flex items-center justify-between mb-6 px-4 md:px-0">
        <h2 className="text-white text-xl font-semibold">
          Continue Watching
        </h2>
        <button
          onClick={fetchContinueWatching}
          className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10"
          title="Refresh"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
      </div>
      
      <div className="relative">
        <div className="flex gap-2 overflow-x-auto pb-4 px-4 md:px-0" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <style jsx>{`
            div::-webkit-scrollbar {
              display: none;
            }
          `}</style>
          {continueItems.map((item, index) => (
            <div key={item.id} className="flex-none w-64 md:w-80">
              <NetflixCard
                media={item.media}
                onPlay={(media) => onPlay(media, item.position)}
                onInfo={onInfo}
                priority={index < 3}
                delay={index * 100}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};



export default ContinueWatching;