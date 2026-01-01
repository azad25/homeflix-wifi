"use client";

import React, { useState, useEffect } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Search, TrendingUp, Heart, Clock, Music, PlayCircle } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { MusicAPI } from '@/lib/musicApi';
import { Track, Playlist } from '@/types/music';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import MusicPlayer from '@/components/music/MusicPlayer';
import MusicDashboard from '@/components/music/MusicDashboard';
import PlaylistManager from '@/components/music/PlaylistManager';
import MusicHome from '@/components/music/MusicHome';
import MusicSuggestions from '@/components/music/MusicSuggestions';
import MusicSidebar from '@/components/music/MusicSidebar';
import RedLoader from '@/components/RedLoader';

export default function MusicPage() {
  usePageTitle('Music');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [trendingTracks, setTrendingTracks] = useState<Track[]>([]);
  const [likedTracks, setLikedTracks] = useState<Track[]>([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'dashboard' | 'trending' | 'search' | 'liked' | 'recent' | 'playlists'>('home');

  const { playTrack, state } = useMusicPlayer();

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [trending, liked, recent, userPlaylists] = await Promise.all([
        MusicAPI.getTrendingTracks(20),
        MusicAPI.getLikedTracks(),
        MusicAPI.getRecentlyPlayed(20).then(recent => recent.map(r => r.track)),
        MusicAPI.getPlaylists()
      ]);

      setTrendingTracks(trending);
      setLikedTracks(liked);
      setRecentlyPlayed(recent);
      setPlaylists(userPlaylists);
    } catch (error) {
      console.error('Failed to load music data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setSearchLoading(true);
      const results = await MusicAPI.searchTracks(query, 25);
      setSearchResults(results);
      setActiveTab('search');
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  const handlePlayTrack = (track: Track, queue?: Track[]) => {
    playTrack(track, queue);
  };

  const handleLikeTrack = async (trackId: number) => {
    try {
      await MusicAPI.likeTrack(trackId);
      // Refresh liked tracks
      const liked = await MusicAPI.getLikedTracks();
      setLikedTracks(liked);
    } catch (error) {
      console.error('Failed to like track:', error);
    }
  };

  const TrackList = ({ tracks, title, showPlayAll = true }: { tracks: Track[], title: string, showPlayAll?: boolean }) => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-red-400 to-red-600 bg-clip-text text-transparent">{title}</h2>
        {showPlayAll && tracks.length > 0 && (
          <button
            onClick={() => handlePlayTrack(tracks[0], tracks)}
            className="flex items-center gap-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white px-6 py-3 rounded-full transition-all duration-300 transform hover:scale-105 shadow-lg"
          >
            <PlayCircle size={20} />
            Play All
          </button>
        )}
      </div>
      
      <div className="space-y-3">
        {tracks.map((track, index) => (
          <div
            key={track.id}
            className="flex items-center gap-6 p-4 rounded-xl bg-gradient-to-r from-gray-900/50 to-red-900/20 hover:from-gray-800/60 hover:to-red-800/30 transition-all duration-300 group backdrop-blur-sm border border-red-800/20"
          >
            <div className="text-red-400 w-10 text-center font-bold">
              {state.currentTrack?.id === track.id && state.isPlaying ? (
                <div className="flex items-center justify-center">
                  <div className="flex gap-1">
                    <div className="w-1 h-4 bg-red-500 rounded animate-pulse" style={{ animationDelay: '0ms' }} />
                    <div className="w-1 h-6 bg-red-500 rounded animate-pulse" style={{ animationDelay: '150ms' }} />
                    <div className="w-1 h-3 bg-red-500 rounded animate-pulse" style={{ animationDelay: '300ms' }} />
                    <div className="w-1 h-5 bg-red-500 rounded animate-pulse" style={{ animationDelay: '450ms' }} />
                  </div>
                </div>
              ) : (
                <span className="group-hover:hidden">{index + 1}</span>
              )}
              <button
                onClick={() => handlePlayTrack(track, tracks)}
                className="hidden group-hover:block text-white hover:text-red-400 transition-colors"
              >
                <PlayCircle size={24} />
              </button>
            </div>
            
            <img
              src={track.thumbnail_url}
              alt={track.title}
              className="w-16 h-16 rounded-lg object-cover shadow-lg"
            />
            
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-semibold text-lg truncate">{track.title}</h3>
              <p className="text-red-300 text-sm truncate">{track.artist}</p>
            </div>
            
            <div className="flex items-center gap-6 text-red-300 text-sm">
              <span>{MusicAPI.formatNumber(track.view_count)} views</span>
              <span>{MusicAPI.formatDuration(track.duration)}</span>
              <button
                onClick={() => handleLikeTrack(track.id)}
                className="hover:text-red-400 transition-colors transform hover:scale-110"
              >
                <Heart size={18} className={likedTracks.some(t => t.id === track.id) ? 'fill-red-500 text-red-500' : ''} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-red-950 to-black">
        <Navbar onSearch={() => {}} />
        <div className="flex items-center justify-center h-96">
          <RedLoader size="large" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-red-950 to-black">
      <Navbar onSearch={() => {}} />
      
      <div className="flex mt-12">
        {/* Main Content */}
        <div className="flex-1 container mx-auto px-6 py-8 max-w-7xl mt-4 mr-96 pb-24">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-5xl font-bold bg-gradient-to-r from-red-500 via-red-400 to-red-600 bg-clip-text text-transparent mb-6 flex items-center gap-4">
              <Music className="text-red-500" size={48} />
              Music
            </h1>
            
            {/* Search Bar */}
            <div className="relative max-w-lg">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-red-400" size={20} />
              <input
                type="text"
                placeholder="Search for songs, artists..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  handleSearch(e.target.value);
                }}
                className="w-full pl-12 pr-4 py-4 bg-gradient-to-r from-gray-900/80 to-red-900/20 text-white rounded-xl border border-red-800/30 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 backdrop-blur-sm transition-all"
              />
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-8 mb-10 border-b border-red-800/30 overflow-x-auto pb-4">
            {[
              { key: 'home', label: 'Home', icon: Music },
              { key: 'dashboard', label: 'Dashboard', icon: Music },
              { key: 'trending', label: 'Trending', icon: TrendingUp },
              { key: 'search', label: 'Search Results', icon: Search },
              { key: 'liked', label: 'Liked Songs', icon: Heart },
              { key: 'recent', label: 'Recently Played', icon: Clock },
              { key: 'playlists', label: 'Playlists', icon: Music }
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key as any)}
                className={`flex items-center gap-3 pb-4 px-3 whitespace-nowrap transition-all duration-300 ${
                  activeTab === key
                    ? 'text-red-400 border-b-2 border-red-500 transform scale-105'
                    : 'text-gray-400 hover:text-red-300'
                }`}
              >
                <Icon size={20} />
                <span className="font-medium">{label}</span>
                {key === 'search' && searchResults.length > 0 && (
                  <span className="bg-gradient-to-r from-red-500 to-red-600 text-white text-xs px-2 py-1 rounded-full font-bold">
                    {searchResults.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="space-y-10">
            {activeTab === 'home' && <MusicHome />}

            {activeTab === 'dashboard' && <MusicDashboard />}

            {activeTab === 'trending' && (
              <TrackList tracks={trendingTracks} title="Trending Now" />
            )}

            {activeTab === 'search' && (
              <div>
                {searchLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <RedLoader />
                  </div>
                ) : searchResults.length > 0 ? (
                  <TrackList tracks={searchResults} title={`Search Results for "${searchQuery}"`} />
                ) : searchQuery ? (
                  <div className="text-center text-red-300 py-16">
                    <Search size={64} className="mx-auto mb-6 opacity-50" />
                    <p className="text-xl">No results found for "{searchQuery}"</p>
                  </div>
                ) : (
                  <MusicSuggestions />
                )}
              </div>
            )}

            {activeTab === 'liked' && (
              <div>
                {likedTracks.length > 0 ? (
                  <TrackList tracks={likedTracks} title="Liked Songs" />
                ) : (
                  <div className="text-center text-red-300 py-16">
                    <Heart size={64} className="mx-auto mb-6 opacity-50" />
                    <p className="text-xl">No liked songs yet. Start liking songs to see them here!</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'recent' && (
              <div>
                {recentlyPlayed.length > 0 ? (
                  <TrackList tracks={recentlyPlayed} title="Recently Played" />
                ) : (
                  <div className="text-center text-red-300 py-16">
                    <Clock size={64} className="mx-auto mb-6 opacity-50" />
                    <p className="text-xl">No recently played songs. Start listening to see your history!</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'playlists' && <PlaylistManager />}
          </div>
        </div>

        {/* Sidebar */}
        <MusicSidebar className="lg:flex" />
      </div>

      {/* Music Player */}
      {state.currentTrack && <MusicPlayer />}
    </div>
  );
}