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
      const response = await fetch(`${apiUrl}/api/playback/continue?limit=20`, {
        headers: {
          'X-User-ID': '1' // Default user for now
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Filter out duplicates, invalid items, and ensure we have real content
        const validItems = (data || [])
          .filter((item: ContinueWatchingItem) => {
            // Must have valid media object with basic required fields
            if (!item.media || !item.media.id || !item.media.title) {
              console.log('🔍 Filtered out: missing media data', item);
              return false;
            }
            
            // Much more lenient progress filtering - allow any progress between 0.1% and 99.9%
            if (item.progress === undefined || item.progress < 0.1 || item.progress > 99.9) {
              console.log('🔍 Filtered out: invalid progress', item.progress, item.media.title);
              return false;
            }
            
            // Only require position to exist (can be 0), duration should be positive
            if (item.position === undefined || item.duration === undefined || item.duration <= 0) {
              console.log('🔍 Filtered out: invalid position/duration', {
                position: item.position,
                duration: item.duration,
                title: item.media.title
              });
              return false;
            }
            
            // Filter out obvious placeholder or test content
            const title = item.media.title.toLowerCase();
            if (title.includes('test_') || title.includes('placeholder_') || title.includes('sample_')) {
              console.log('🔍 Filtered out: test content', title);
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
        console.log(`✅ Loaded ${validItems.length} valid continue watching items`);
        
        // Debug logging for continue watching data
        if (data && data.length > 0) {
          console.log('📊 Continue watching raw data:', data.length, 'items');
          console.log('📊 Sample item:', data[0]);
          console.log('📊 Filtered to:', validItems.length, 'valid items');
          
          // Log all items for debugging
          data.forEach((item: ContinueWatchingItem, idx: number) => {
            console.log(`📊 Item ${idx + 1}:`, {
              id: item.id,
              media_id: item.media_id,
              title: item.media?.title,
              progress: item.progress,
              position: item.position,
              duration: item.duration,
              hasValidMedia: !!(item.media && item.media.id && item.media.title)
            });
          });
        } else {
          console.log('📝 No continue watching data returned from API');
        }

        // Additional debugging for filtered items
        if (data && data.length > 0 && validItems.length === 0) {
          console.log('🔍 All items were filtered out. Checking reasons...');
          data.forEach((item: ContinueWatchingItem, idx: number) => {
            if (idx < 5) { // Check first 5 items
              const reasons = [];
              if (!item.media || !item.media.id || !item.media.title) reasons.push('invalid media');
              if (item.progress === undefined || item.progress < 0.1 || item.progress > 99.9) reasons.push(`progress: ${item.progress}%`);
              if (item.position === undefined || item.duration === undefined || item.duration <= 0) reasons.push('invalid position/duration');
              const title = item.media?.title?.toLowerCase() || '';
              if (title.includes('test_') || title.includes('placeholder_') || title.includes('sample_')) reasons.push('test content');
              
              console.log(`🔍 Item ${idx + 1} (${item.media?.title}): filtered because: ${reasons.join(', ')}`);
            }
          });
        }
      } else if (response.status === 404) {
        // No continue watching data found - this is normal for new users
        setContinueItems([]);
        console.log('📝 No continue watching data found - user hasn\'t started watching anything yet');
      } else {
        // Log the response for debugging
        const errorText = await response.text();
        console.error('❌ Continue watching API error:', response.status, errorText);
        throw new Error(`Failed to fetch continue watching items: ${response.status}`);
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
            <div key={item.id} className="flex-none w-64 md:w-80 relative">
              <NetflixCard
                media={item.media}
                onPlay={(media) => onPlay(media, item.position)}
                onInfo={onInfo}
                priority={index < 3}
                delay={index * 100}
              />
              {/* Progress indicator */}
              <div className="absolute bottom-2 left-2 right-2 bg-black/50 rounded-full h-1">
                <div 
                  className="bg-red-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(Math.max(item.progress, 0), 100)}%` }}
                />
              </div>
              {/* Progress text */}
              <div className="absolute bottom-4 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                {Math.round(item.progress)}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};



export default ContinueWatching;