"use client";

import React, { useState, useEffect } from 'react';
import { Music, Play, TrendingUp, Heart, Clock, ChevronRight } from 'lucide-react';
import { MusicAPI } from '@/lib/musicApi';
import { Track } from '@/types/music';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import { useNavigate } from '@/hooks/useNavigate';

interface MusicWidgetProps {
  className?: string;
  showTrending?: boolean;
  showRecentlyPlayed?: boolean;
  showLiked?: boolean;
  maxItems?: number;
}

export default function MusicWidget({ 
  className = '',
  showTrending = true,
  showRecentlyPlayed = true,
  showLiked = true,
  maxItems = 6
}: MusicWidgetProps) {
  const [trendingTracks, setTrendingTracks] = useState<Track[]>([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState<Track[]>([]);
  const [likedTracks, setLikedTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const { playTrack, state } = useMusicPlayer();
  const navigate = useNavigate();

  useEffect(() => {
    loadMusicData();
  }, []); // Remove dependencies to prevent reloading

  const loadMusicData = async () => {
    try {
      setLoading(true);
      const promises = [];

      if (showTrending) {
        promises.push(MusicAPI.getTrendingTracks(maxItems));
      }
      if (showRecentlyPlayed) {
        promises.push(MusicAPI.getRecentlyPlayed(maxItems).then(recent => recent.map(r => r.track)));
      }
      if (showLiked) {
        promises.push(MusicAPI.getLikedTracks());
      }

      const results = await Promise.all(promises);
      let index = 0;

      if (showTrending) {
        setTrendingTracks(results[index++] || []);
      }
      if (showRecentlyPlayed) {
        setRecentlyPlayed(results[index++] || []);
      }
      if (showLiked) {
        setLikedTracks((results[index++] || []).slice(0, maxItems));
      }
    } catch (error) {
      console.error('Failed to load music data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayTrack = (track: Track, queue: Track[]) => {
    playTrack(track, queue);
  };

  const TrackRow = ({ track, queue }: { track: Track, queue: Track[] }) => (
    <div
      onClick={() => handlePlayTrack(track, queue)}
      className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 cursor-pointer transition-colors group"
    >
      <div className="relative">
        <img
          src={track.thumbnail_url}
          alt={track.title}
          className="w-12 h-12 rounded object-cover"
        />
        {state.currentTrack?.id === track.id && state.isPlaying ? (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded">
            <div className="w-3 h-3 bg-green-500 rounded animate-pulse" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity">
            <Play size={16} className="text-white" />
          </div>
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <h4 className="text-white font-medium truncate text-sm">{track.title}</h4>
        <p className="text-gray-400 text-xs truncate">{track.artist}</p>
      </div>
      
      <div className="text-gray-400 text-xs">
        {MusicAPI.formatDuration(track.duration)}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className={`bg-gray-900 rounded-lg p-6 ${className}`}>
        <div className="flex items-center gap-3 mb-6">
          <Music className="text-green-500" size={24} />
          <h2 className="text-xl font-bold text-white">Music</h2>
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-700 rounded mb-2"></div>
              <div className="space-y-2">
                {[...Array(2)].map((_, j) => (
                  <div key={j} className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gray-700 rounded"></div>
                    <div className="flex-1">
                      <div className="h-3 bg-gray-700 rounded mb-1"></div>
                      <div className="h-2 bg-gray-700 rounded w-2/3"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const hasAnyTracks = trendingTracks.length > 0 || recentlyPlayed.length > 0 || likedTracks.length > 0;

  if (!hasAnyTracks) {
    return (
      <div className={`bg-gray-900 rounded-lg p-6 ${className}`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Music className="text-green-500" size={24} />
            <h2 className="text-xl font-bold text-white">Music</h2>
          </div>
          <button
            onClick={() => navigate.push('/music')}
            className="text-green-500 hover:text-green-400 transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>
        
        <div className="text-center py-8">
          <Music size={48} className="mx-auto text-gray-600 mb-4" />
          <p className="text-gray-400 mb-4">Discover amazing music</p>
          <button
            onClick={() => navigate.push('/music')}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Explore Music
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gray-900 rounded-lg p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Music className="text-green-500" size={24} />
          <h2 className="text-xl font-bold text-white">Music</h2>
        </div>
        <button
          onClick={() => navigate.push('/music')}
          className="text-green-500 hover:text-green-400 transition-colors"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="space-y-6">
        {/* Trending Tracks */}
        {showTrending && trendingTracks.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={16} className="text-green-500" />
              <h3 className="text-white font-medium">Trending Now</h3>
            </div>
            <div className="space-y-1">
              {trendingTracks.slice(0, 3).map((track) => (
                <TrackRow key={track.id} track={track} queue={trendingTracks} />
              ))}
            </div>
          </div>
        )}

        {/* Recently Played */}
        {showRecentlyPlayed && recentlyPlayed.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Clock size={16} className="text-blue-500" />
              <h3 className="text-white font-medium">Recently Played</h3>
            </div>
            <div className="space-y-1">
              {recentlyPlayed.slice(0, 2).map((track) => (
                <TrackRow key={track.id} track={track} queue={recentlyPlayed} />
              ))}
            </div>
          </div>
        )}

        {/* Liked Tracks */}
        {showLiked && likedTracks.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Heart size={16} className="text-red-500" />
              <h3 className="text-white font-medium">Liked Songs</h3>
            </div>
            <div className="space-y-1">
              {likedTracks.slice(0, 2).map((track) => (
                <TrackRow key={track.id} track={track} queue={likedTracks} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* View All Button */}
      <div className="mt-6 pt-4 border-t border-gray-800">
        <button
          onClick={() => navigate.push('/music')}
          className="w-full text-center text-green-500 hover:text-green-400 transition-colors font-medium"
        >
          View All Music
        </button>
      </div>
    </div>
  );
}