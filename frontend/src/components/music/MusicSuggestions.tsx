"use client";

import React, { useState, useEffect } from 'react';
import { TrendingUp, Clock, Heart, Music, Play } from 'lucide-react';
import { MusicAPI } from '@/lib/musicApi';
import { Track } from '@/types/music';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';

export default function MusicSuggestions() {
  const [trendingTracks, setTrendingTracks] = useState<Track[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const { playTrack } = useMusicPlayer();

  useEffect(() => {
    loadSuggestions();
    loadRecentSearches();
  }, []);

  const loadSuggestions = async () => {
    try {
      const trending = await MusicAPI.getTrendingTracks(8);
      setTrendingTracks(trending);
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentSearches = () => {
    const saved = localStorage.getItem('musicRecentSearches');
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  };

  const handlePlayTrack = (track: Track) => {
    playTrack(track, trendingTracks);
  };

  const popularSearches = [
    'Taylor Swift',
    'Ed Sheeran',
    'The Weeknd',
    'Billie Eilish',
    'Drake',
    'Ariana Grande',
    'Post Malone',
    'Dua Lipa',
    'pop music',
    'rock hits',
    'chill music',
    'workout songs',
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-700 rounded w-48 mb-4"></div>
          <div className="grid grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg">
                <div className="w-12 h-12 bg-gray-700 rounded"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-700 rounded mb-2"></div>
                  <div className="h-3 bg-gray-700 rounded w-2/3"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Recent Searches */}
      {recentSearches.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Clock size={18} className="text-gray-400" />
            <h3 className="text-white font-semibold">Recent Searches</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentSearches.slice(0, 6).map((search, index) => (
              <button
                key={index}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-full text-sm transition-colors"
              >
                {search}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Trending Now */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={18} className="text-green-500" />
          <h3 className="text-white font-semibold">Trending Now</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {trendingTracks.slice(0, 6).map((track) => (
            <div
              key={track.id}
              onClick={() => handlePlayTrack(track)}
              className="flex items-center gap-3 p-3 bg-gray-800 hover:bg-gray-700 rounded-lg cursor-pointer transition-colors group"
            >
              <div className="relative">
                <img
                  src={track.thumbnail_url}
                  alt={track.title}
                  className="w-12 h-12 rounded object-cover"
                />
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded">
                  <Play size={16} className="text-white ml-0.5" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-white font-medium truncate text-sm group-hover:text-green-400 transition-colors">
                  {track.title}
                </h4>
                <p className="text-gray-400 text-xs truncate">{track.artist}</p>
              </div>
              <div className="text-gray-500 text-xs">
                {MusicAPI.formatDuration(track.duration)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Popular Searches */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Heart size={18} className="text-red-500" />
          <h3 className="text-white font-semibold">Popular Searches</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {popularSearches.map((search, index) => (
            <button
              key={index}
              className="px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg text-sm transition-colors text-left"
            >
              {search}
            </button>
          ))}
        </div>
      </div>

      {/* Browse Categories */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Music size={18} className="text-blue-500" />
          <h3 className="text-white font-semibold">Browse Categories</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { name: 'Top Charts', color: 'bg-gradient-to-br from-yellow-400 to-orange-500', emoji: '🏆' },
            { name: 'New Releases', color: 'bg-gradient-to-br from-green-400 to-teal-500', emoji: '🆕' },
            { name: 'Mood & Activity', color: 'bg-gradient-to-br from-purple-400 to-pink-500', emoji: '🎭' },
            { name: 'Genres', color: 'bg-gradient-to-br from-blue-400 to-indigo-500', emoji: '🎵' },
          ].map((category) => (
            <button
              key={category.name}
              className={`${category.color} rounded-xl p-6 text-white font-bold hover:scale-105 transition-transform`}
            >
              <div className="text-2xl mb-2">{category.emoji}</div>
              <div className="text-sm">{category.name}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}