"use client";

import React, { useState, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import { Media } from '@/types/media';
import { getApiUrl } from '@/lib/api';
import ContinueWatchingCard from './ContinueWatchingCard';
import { useGlobalCache } from '@/hooks/useGlobalCache';

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
  const [error, setError] = useState<string | null>(null);
  
  // Use global cache for continue watching data with longer cache and debouncing
  const { data: continueData, loading } = useGlobalCache<ContinueWatchingItem[]>(
    `${getApiUrl()}/api/playback/continue?limit=20`,
    { headers: { 'X-User-ID': '1' } },
    { 
      customTTL: 5 * 60 * 1000, // 5 minutes cache for user progress data
      staleWhileRevalidate: true,
      refetchInterval: undefined // Disable auto-refetch to prevent excessive calls
    }
  );

  useEffect(() => {
    // Debounce updates to prevent rapid successive processing
    const debounceTimer = setTimeout(() => {
      if (continueData) {
      // Filter and process the data
      const validItems = continueData
        .filter((item: ContinueWatchingItem) => {
          // Must have valid media data
          if (!item.media || !item.media.id || !item.media.title) {
            return false;
          }
          
          // Must have meaningful progress (not at beginning or end)
          if (item.progress === undefined || item.progress <= 1 || item.progress >= 98) {
            return false;
          }
          
          // Must have valid position and duration
          if (item.position === undefined || item.duration === undefined || item.duration <= 0) {
            return false;
          }
          
          // Filter out test content
          const title = item.media.title.toLowerCase();
          if (title.includes('test_') || title.includes('placeholder_') || title.includes('sample_')) {
            return false;
          }
          
          return true;
        })
        // Remove duplicates based on media_id
        .filter((item: ContinueWatchingItem, index: number, array: ContinueWatchingItem[]) => {
          return array.findIndex(i => i.media_id === item.media_id) === index;
        })
        // Sort by last watched (most recent first)
        .sort((a: ContinueWatchingItem, b: ContinueWatchingItem) => {
          return new Date(b.last_watched).getTime() - new Date(a.last_watched).getTime();
        })
        // Limit to 10 items
        .slice(0, 10);
      
        setContinueItems(validItems);
        setError(null);
        console.log(`✅ Loaded ${validItems.length} valid continue watching items`);
      }
    }, 100); // 100ms debounce

    return () => clearTimeout(debounceTimer);
  }, [continueData]);

  const refreshData = () => {
    // Force refresh by invalidating cache
    window.location.reload();
  };




  if (loading) {
    return (
      <div className="mb-12">
        <div className="flex items-center justify-between mb-6 px-4 md:px-0">
          <h2 className="text-white text-xl font-semibold">
            Continue Watching
          </h2>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-4 px-4 md:px-0" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <style jsx>{`
            div::-webkit-scrollbar {
              display: none;
            }
          `}</style>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex-none w-64 md:w-80 h-48 bg-gray-800/30 rounded-lg animate-pulse backdrop-blur-sm border border-gray-700/30" />
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
              onClick={refreshData}
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
          onClick={refreshData}
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
              <ContinueWatchingCard
                item={item}
                onPlay={onPlay}
                onInfo={onInfo}
                priority={index < 3 ? "high" : "normal"}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};



export default ContinueWatching;