"use client";

import React, { useState, useEffect } from 'react';
import { Music, Heart, Clock, TrendingUp, PlayCircle, Users, Headphones, Radio, Disc3 } from 'lucide-react';
import { MusicAPI } from '@/lib/musicApi';
import { Track, Playlist } from '@/types/music';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';

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
  const { playTrack, state } = useMusicPlayer();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load all data in parallel with error handling
      const [playlists, likedTracks, recentlyPlayed, trendingTracks] = await Promise.all([
        MusicAPI.getPlaylists().catch(() => []),
        MusicAPI.getLikedTracks().catch(() => []),
        MusicAPI.getRecentlyPlayed(50).catch(() => []),
        MusicAPI.getTrendingTracks(10).catch(() => [])
      ]);

      // Calculate stats
      const totalTracks = new Set([
        ...likedTracks.map(t => t.youtube_id),
        ...recentlyPlayed.map(r => r.track.youtube_id),
        ...playlists.flatMap(p => p.tracks?.map(t => t.youtube_id) || [])
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
    gradient = 'from-red-500 to-red-600',
    iconBg = 'from-red-500/20 to-red-600/20'
  }: {
    icon: React.ElementType;
    title: string;
    value: string | number;
    subtitle?: string;
    gradient?: string;
    iconBg?: string;
  }) => (
    <div className="relative bg-gradient-to-br from-gray-900/80 to-red-900/40 rounded-2xl p-6 hover:from-gray-800/90 hover:to-red-800/50 transition-all duration-300 border border-red-800/30 hover:border-red-600/50 shadow-lg hover:shadow-2xl hover:shadow-red-900/20 transform hover:-translate-y-1 overflow-hidden group">
      {/* Decorative gradient orb */}
      <div className={`absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-br ${gradient} rounded-full blur-3xl opacity-20 group-hover:opacity-30 transition-opacity`} />
      
      <div className="relative flex items-start justify-between">
        <div className="flex-1">
          <div className={`inline-flex p-4 rounded-xl bg-gradient-to-br ${iconBg} border border-red-700/30 mb-4 group-hover:scale-110 transition-transform`}>
            <Icon size={28} className={`bg-gradient-to-br ${gradient} bg-clip-text text-transparent`} style={{ WebkitTextFillColor: 'transparent', WebkitBackgroundClip: 'text' }} />
          </div>
          <h3 className="text-4xl font-black text-white mb-2 bg-gradient-to-r from-white to-red-100 bg-clip-text text-transparent">{value}</h3>
          <p className="text-red-300/80 font-semibold text-sm">{title}</p>
          {subtitle && <p className="text-red-400/50 text-xs mt-1 font-medium">{subtitle}</p>}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gradient-to-br from-gray-900/80 to-red-900/40 rounded-2xl p-6 animate-pulse border border-red-800/30 shadow-lg">
              <div className="flex flex-col gap-4">
                <div className="w-16 h-16 bg-red-900/50 rounded-xl"></div>
                <div className="space-y-3">
                  <div className="h-8 w-20 bg-red-900/50 rounded"></div>
                  <div className="h-4 w-32 bg-red-900/50 rounded"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-24">
      {/* Welcome Banner */}
      <div className="relative bg-gradient-to-r from-red-600 via-red-700 to-red-800 rounded-2xl p-8 overflow-hidden shadow-2xl">
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-red-900/30 rounded-full blur-3xl" />
        
        <div className="relative">
          <div className="flex items-center gap-3 mb-4">
            <Headphones size={32} className="text-white" />
            <h1 className="text-3xl font-black text-white">Your Music Dashboard</h1>
          </div>
          <p className="text-red-100 text-lg font-medium">Track your listening habits and discover new favorites</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={Disc3}
          title="Total Tracks"
          value={stats.totalTracks}
          subtitle="In your library"
          gradient="from-green-500 to-emerald-600"
          iconBg="from-green-500/20 to-emerald-600/20"
        />
        
        <StatCard
          icon={Heart}
          title="Liked Songs"
          value={stats.likedTracks}
          subtitle="Your favorites"
          gradient="from-red-500 to-pink-600"
          iconBg="from-red-500/20 to-pink-600/20"
        />
        
        <StatCard
          icon={PlayCircle}
          title="Playlists"
          value={stats.totalPlaylists}
          subtitle="Created by you"
          gradient="from-blue-500 to-cyan-600"
          iconBg="from-blue-500/20 to-cyan-600/20"
        />
        
        <StatCard
          icon={Clock}
          title="Listening Time"
          value={formatPlaytime(stats.totalPlaytime)}
          subtitle="Recently played"
          gradient="from-purple-500 to-violet-600"
          iconBg="from-purple-500/20 to-violet-600/20"
        />
      </div>

      {/* Top Tracks */}
      {topTracks.length > 0 && (
        <div className="bg-gradient-to-br from-gray-900/80 to-red-900/40 rounded-2xl p-8 border border-red-800/30 shadow-lg">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-red-500/20 to-red-600/20 border border-red-700/30">
                <TrendingUp className="text-red-400" size={28} />
              </div>
              <div>
                <h2 className="text-3xl font-black bg-gradient-to-r from-red-400 via-red-500 to-red-600 bg-clip-text text-transparent">Trending Tracks</h2>
                <p className="text-red-300/70 text-sm font-medium">Most popular right now</p>
              </div>
            </div>
            <button 
              onClick={() => playTrack(topTracks[0], topTracks)}
              className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white px-6 py-3 rounded-full font-bold transition-all duration-300 transform hover:scale-105 shadow-lg"
            >
              <PlayCircle size={20} />
              Play All
            </button>
          </div>
          
          <div className="space-y-3">
            {topTracks.map((track, index) => {
              const isPlaying = state.currentTrack?.youtube_id === track.youtube_id && state.isPlaying;
              
              return (
                <div
                  key={track.youtube_id || index}
                  onClick={() => playTrack(track, topTracks)}
                  className="flex items-center gap-6 p-4 rounded-xl bg-gradient-to-r from-gray-900/50 to-red-900/20 hover:from-gray-800/60 hover:to-red-800/30 transition-all duration-300 group cursor-pointer border border-red-800/20 hover:border-red-600/40"
                >
                  <div className="relative">
                    <div className={`text-2xl font-black w-12 h-12 flex items-center justify-center rounded-lg ${
                      index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-black' :
                      index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-black' :
                      index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-black' :
                      'bg-gradient-to-br from-red-900/50 to-red-800/50 text-red-300'
                    }`}>
                      #{index + 1}
                    </div>
                  </div>
                  
                  <div className="relative">
                    <img
                      src={track.thumbnail_url}
                      alt={track.title}
                      className="w-16 h-16 rounded-xl object-cover shadow-lg group-hover:scale-105 transition-transform"
                    />
                    {isPlaying && (
                      <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
                        <div className="flex gap-1">
                          <div className="w-1 h-3 bg-red-500 rounded animate-pulse" />
                          <div className="w-1 h-4 bg-red-500 rounded animate-pulse" style={{ animationDelay: '150ms' }} />
                          <div className="w-1 h-2 bg-red-500 rounded animate-pulse" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-bold text-lg truncate group-hover:text-red-300 transition-colors">{track.title}</h3>
                    <p className="text-red-300/80 text-sm truncate font-medium">{track.artist}</p>
                  </div>
                  
                  <div className="flex items-center gap-6 text-red-300/70 text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <Users size={16} />
                      <span>{MusicAPI.formatNumber(track.view_count)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock size={16} />
                      <span>{MusicAPI.formatDuration(track.duration)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-gradient-to-br from-gray-900/80 to-red-900/40 rounded-2xl p-8 border border-red-800/30 shadow-lg">
        <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-3">
          <Radio size={28} className="text-red-400" />
          Quick Actions
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="flex items-center gap-4 p-6 bg-gradient-to-br from-green-900/30 to-emerald-900/30 hover:from-green-800/40 hover:to-emerald-800/40 rounded-xl transition-all duration-300 border border-green-700/30 hover:border-green-600/50 group transform hover:-translate-y-1 shadow-lg hover:shadow-green-900/20">
            <div className="p-3 rounded-lg bg-green-500/20 group-hover:bg-green-500/30 transition-colors">
              <TrendingUp className="text-green-400" size={24} />
            </div>
            <div className="text-left">
              <span className="text-white font-bold text-lg block">Discover</span>
              <span className="text-green-300/70 text-sm">Trending music</span>
            </div>
          </button>
          
          <button className="flex items-center gap-4 p-6 bg-gradient-to-br from-red-900/30 to-pink-900/30 hover:from-red-800/40 hover:to-pink-800/40 rounded-xl transition-all duration-300 border border-red-700/30 hover:border-red-600/50 group transform hover:-translate-y-1 shadow-lg hover:shadow-red-900/20">
            <div className="p-3 rounded-lg bg-red-500/20 group-hover:bg-red-500/30 transition-colors">
              <Heart className="text-red-400" size={24} />
            </div>
            <div className="text-left">
              <span className="text-white font-bold text-lg block">Liked Songs</span>
              <span className="text-red-300/70 text-sm">Your favorites</span>
            </div>
          </button>
          
          <button className="flex items-center gap-4 p-6 bg-gradient-to-br from-blue-900/30 to-cyan-900/30 hover:from-blue-800/40 hover:to-cyan-800/40 rounded-xl transition-all duration-300 border border-blue-700/30 hover:border-blue-600/50 group transform hover:-translate-y-1 shadow-lg hover:shadow-blue-900/20">
            <div className="p-3 rounded-lg bg-blue-500/20 group-hover:bg-blue-500/30 transition-colors">
              <PlayCircle className="text-blue-400" size={24} />
            </div>
            <div className="text-left">
              <span className="text-white font-bold text-lg block">Playlists</span>
              <span className="text-blue-300/70 text-sm">Create & manage</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}