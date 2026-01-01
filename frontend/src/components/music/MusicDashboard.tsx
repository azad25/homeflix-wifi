"use client";

import React, { useState, useEffect } from 'react';
import { Music, Heart, Clock, TrendingUp, PlayCircle, Users } from 'lucide-react';
import { MusicAPI } from '@/lib/musicApi';
import { Track, Playlist } from '@/types/music';

interface MusicStats {
  totalTracks: number;
  totalPlaylists: number;
  likedTracks: number;
  recentlyPlayed: number;
  totalPlaytime: number; // in seconds
}

export default function MusicDashboard() {
  const [stats, setStats] = useState<MusicStats>({
    totalTracks: 0,
    totalPlaylists: 0,
    likedTracks: 0,
    recentlyPlayed: 0,
    totalPlaytime: 0,
  });
  const [topTracks, setTopTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load all data in parallel
      const [playlists, likedTracks, recentlyPlayed, trendingTracks] = await Promise.all([
        MusicAPI.getPlaylists(),
        MusicAPI.getLikedTracks(),
        MusicAPI.getRecentlyPlayed(50),
        MusicAPI.getTrendingTracks(10)
      ]);

      // Calculate stats
      const totalTracks = new Set([
        ...likedTracks.map(t => t.id),
        ...recentlyPlayed.map(r => r.track.id),
        ...playlists.flatMap(p => p.tracks?.map(t => t.id) || [])
      ]).size;

      const totalPlaytime = recentlyPlayed.reduce((total, r) => total + r.track.duration, 0);

      setStats({
        totalTracks,
        totalPlaylists: playlists.length,
        likedTracks: likedTracks.length,
        recentlyPlayed: recentlyPlayed.length,
        totalPlaytime,
      });

      setTopTracks(trendingTracks.slice(0, 5));
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPlaytime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const StatCard = ({ 
    icon: Icon, 
    title, 
    value, 
    subtitle, 
    color = 'text-green-500' 
  }: {
    icon: React.ElementType;
    title: string;
    value: string | number;
    subtitle?: string;
    color?: string;
  }) => (
    <div className="bg-gray-800 rounded-lg p-6 hover:bg-gray-700 transition-colors">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-lg bg-gray-700 ${color}`}>
          <Icon size={24} />
        </div>
        <div>
          <h3 className="text-2xl font-bold text-white">{value}</h3>
          <p className="text-gray-400">{title}</p>
          {subtitle && <p className="text-gray-500 text-sm">{subtitle}</p>}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-800 rounded-lg p-6 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-700 rounded-lg"></div>
                <div className="space-y-2">
                  <div className="h-6 w-16 bg-gray-700 rounded"></div>
                  <div className="h-4 w-24 bg-gray-700 rounded"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={Music}
          title="Total Tracks"
          value={stats.totalTracks}
          subtitle="In your library"
          color="text-green-500"
        />
        
        <StatCard
          icon={Heart}
          title="Liked Songs"
          value={stats.likedTracks}
          subtitle="Your favorites"
          color="text-red-500"
        />
        
        <StatCard
          icon={PlayCircle}
          title="Playlists"
          value={stats.totalPlaylists}
          subtitle="Created by you"
          color="text-blue-500"
        />
        
        <StatCard
          icon={Clock}
          title="Listening Time"
          value={formatPlaytime(stats.totalPlaytime)}
          subtitle="Recently played"
          color="text-purple-500"
        />
      </div>

      {/* Top Tracks */}
      {topTracks.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <TrendingUp className="text-green-500" size={24} />
            <h2 className="text-xl font-bold text-white">Trending Tracks</h2>
          </div>
          
          <div className="space-y-3">
            {topTracks.map((track, index) => (
              <div
                key={track.id}
                className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-700 transition-colors"
              >
                <div className="text-gray-400 w-8 text-center font-medium">
                  #{index + 1}
                </div>
                
                <img
                  src={track.thumbnail_url}
                  alt={track.title}
                  className="w-12 h-12 rounded object-cover"
                />
                
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-medium truncate">{track.title}</h3>
                  <p className="text-gray-400 text-sm truncate">{track.artist}</p>
                </div>
                
                <div className="text-gray-400 text-sm">
                  {MusicAPI.formatNumber(track.view_count)} views
                </div>
                
                <div className="text-gray-400 text-sm">
                  {MusicAPI.formatDuration(track.duration)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-6">Quick Actions</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="flex items-center gap-3 p-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">
            <TrendingUp className="text-green-500" size={20} />
            <span className="text-white">Discover Trending</span>
          </button>
          
          <button className="flex items-center gap-3 p-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">
            <Heart className="text-red-500" size={20} />
            <span className="text-white">View Liked Songs</span>
          </button>
          
          <button className="flex items-center gap-3 p-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">
            <PlayCircle className="text-blue-500" size={20} />
            <span className="text-white">Create Playlist</span>
          </button>
        </div>
      </div>
    </div>
  );
}