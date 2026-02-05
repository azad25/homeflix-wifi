"use client";

import React, { useState, useEffect } from 'react';
import { Play, TrendingUp, Star, Music, Heart, Clock, ChevronRight, Shuffle } from 'lucide-react';
import { MusicAPI } from '@/lib/musicApi';
import { Track } from '@/types/music';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import PopularArtists from './PopularArtists';
import RedLoader from '@/components/RedLoader';

interface MusicSection {
  title: string;
  tracks: Track[];
  loading: boolean;
  icon?: React.ReactNode;
  color?: string;
}

export default function MusicHome() {
  const [sections, setSections] = useState<Record<string, MusicSection>>({
    trending: { title: 'Trending Now', tracks: [], loading: true, icon: <TrendingUp size={20} />, color: 'text-red-500' },
    charts: { title: 'Top Charts', tracks: [], loading: true, icon: <Star size={20} />, color: 'text-yellow-500' },
    newReleases: { title: 'New Releases', tracks: [], loading: true, icon: <Music size={20} />, color: 'text-green-500' },
    pop: { title: 'Pop Hits', tracks: [], loading: true, icon: <Heart size={20} />, color: 'text-pink-500' },
    rock: { title: 'Rock Classics', tracks: [], loading: true, icon: <Music size={20} />, color: 'text-orange-500' },
    hiphop: { title: 'Hip Hop', tracks: [], loading: true, icon: <Music size={20} />, color: 'text-purple-500' },
    electronic: { title: 'Electronic', tracks: [], loading: true, icon: <Music size={20} />, color: 'text-blue-500' },
    chill: { title: 'Chill Vibes', tracks: [], loading: true, icon: <Clock size={20} />, color: 'text-cyan-500' },
    workout: { title: 'Workout Mix', tracks: [], loading: true, icon: <Music size={20} />, color: 'text-red-600' },
  });

  const [featuredTrack, setFeaturedTrack] = useState<Track | null>(null);
  const { playTrack, state } = useMusicPlayer();

  useEffect(() => {
    loadAllSections();
  }, []);

  const loadAllSections = async () => {
    try {
      // Load all sections in parallel
      const promises = [
        MusicAPI.getTrendingTracks(20),
        MusicAPI.getTopCharts(20),
        MusicAPI.getNewReleases(20),
        MusicAPI.getGenreMusic('pop', 15),
        MusicAPI.getGenreMusic('rock', 15),
        MusicAPI.getGenreMusic('hip hop', 15),
        MusicAPI.getGenreMusic('electronic', 15),
        MusicAPI.getMoodMusic('chill', 15),
        MusicAPI.getMoodMusic('workout', 15),
      ];

      const [
        trending,
        charts,
        newReleases,
        pop,
        rock,
        hiphop,
        electronic,
        chill,
        workout,
      ] = await Promise.all(promises);

      // Set featured track from trending
      if (trending.length > 0) {
        setFeaturedTrack(trending[0]);
      }

      setSections({
        trending: { ...sections.trending, tracks: trending, loading: false },
        charts: { ...sections.charts, tracks: charts, loading: false },
        newReleases: { ...sections.newReleases, tracks: newReleases, loading: false },
        pop: { ...sections.pop, tracks: pop, loading: false },
        rock: { ...sections.rock, tracks: rock, loading: false },
        hiphop: { ...sections.hiphop, tracks: hiphop, loading: false },
        electronic: { ...sections.electronic, tracks: electronic, loading: false },
        chill: { ...sections.chill, tracks: chill, loading: false },
        workout: { ...sections.workout, tracks: workout, loading: false },
      });
    } catch (error) {
      console.error('Failed to load music sections:', error);
      // Set all sections to not loading on error
      setSections(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(key => {
          updated[key] = { ...updated[key], loading: false };
        });
        return updated;
      });
    }
  };

  const handlePlayTrack = (track: Track, queue: Track[]) => {
    playTrack(track, queue);
  };

  const handleShufflePlay = (tracks: Track[]) => {
    if (tracks.length === 0) return;
    const shuffled = [...tracks].sort(() => Math.random() - 0.5);
    playTrack(shuffled[0], shuffled);
  };

  const handleLikeTrack = async (trackId: number) => {
    try {
      await MusicAPI.likeTrack(trackId);
      console.log('Track liked successfully');
    } catch (error) {
      console.error('Failed to like track:', error);
    }
  };

  const TrackCard = ({ track, queue, size = 'medium' }: { track: Track, queue: Track[], size?: 'small' | 'medium' | 'large' }) => {
    const isPlaying = state.currentTrack?.id === track.id && state.isPlaying;
    
    const cardSizes = {
      small: 'w-36',
      medium: 'w-44',
      large: 'w-52'
    };

    const imageSizes = {
      small: 'w-36 h-36',
      medium: 'w-44 h-44',
      large: 'w-52 h-52'
    };

    return (
      <div className={`${cardSizes[size]} flex-shrink-0 bg-gradient-to-br from-gray-900/80 to-red-900/40 rounded-2xl p-4 hover:from-gray-800/90 hover:to-red-800/50 transition-all duration-300 cursor-pointer group backdrop-blur-md border border-red-800/30 hover:border-red-600/50 shadow-lg hover:shadow-2xl hover:shadow-red-900/20 transform hover:-translate-y-1`}>
        <div className={`${imageSizes[size]} relative mb-4 rounded-xl overflow-hidden shadow-xl`}>
          <img
            src={track.thumbnail_url}
            alt={track.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <button
              onClick={() => handlePlayTrack(track, queue)}
              className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white rounded-full p-5 transform hover:scale-110 transition-all duration-300 shadow-2xl"
            >
              <Play size={size === 'large' ? 32 : 28} className="ml-1" fill="white" />
            </button>
          </div>
          {isPlaying && (
            <div className="absolute top-3 right-3 bg-gradient-to-r from-red-500 to-red-600 rounded-full p-2 shadow-lg animate-pulse">
              <div className="flex gap-1">
                <div className="w-1 h-2 bg-white rounded animate-bounce" />
                <div className="w-1 h-3 bg-white rounded animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1 h-2 bg-white rounded animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <h3 className="text-white font-bold text-sm truncate group-hover:text-red-300 transition-colors leading-tight">
            {track.title}
          </h3>
          <p className="text-red-300/80 text-xs truncate font-medium">{track.artist}</p>
          <div className="flex items-center justify-between text-xs text-red-400/70 font-medium">
            <span>{MusicAPI.formatNumber(track.view_count)} views</span>
            <span>{MusicAPI.formatDuration(track.duration)}</span>
          </div>
        </div>
      </div>
    );
  };

  const SectionRow = ({ sectionKey, section }: { sectionKey: string, section: MusicSection }) => (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-4">
          <div className={`${section.color} bg-gradient-to-br from-gray-900/50 to-red-900/30 p-3 rounded-xl border border-red-800/30`}>
            {section.icon}
          </div>
          <h2 className="text-3xl font-black bg-gradient-to-r from-red-400 via-red-500 to-red-600 bg-clip-text text-transparent drop-shadow-lg">{section.title}</h2>
        </div>
        <div className="flex items-center gap-3">
          {section.tracks.length > 0 && (
            <button
              onClick={() => handleShufflePlay(section.tracks)}
              className="flex items-center gap-2 bg-gradient-to-r from-red-600/20 to-red-700/20 hover:from-red-600/40 hover:to-red-700/40 text-red-300 hover:text-white px-4 py-2 rounded-full transition-all duration-300 transform hover:scale-105 border border-red-600/30 backdrop-blur-sm"
            >
              <Shuffle size={18} />
              <span className="text-sm font-bold">Shuffle Play</span>
            </button>
          )}
          <button className="text-red-400 hover:text-red-300 transition-colors transform hover:scale-110">
            <ChevronRight size={28} />
          </button>
        </div>
      </div>

      {section.loading ? (
        <div className="flex gap-6 overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="w-44 flex-shrink-0 bg-gradient-to-br from-gray-900/80 to-red-900/40 rounded-2xl p-4 animate-pulse border border-red-800/30 shadow-lg">
              <div className="w-44 h-44 bg-red-900/50 rounded-xl mb-4"></div>
              <div className="space-y-3">
                <div className="h-4 bg-red-900/50 rounded"></div>
                <div className="h-3 bg-red-900/50 rounded w-2/3"></div>
              </div>
            </div>
          ))}
        </div>
      ) : section.tracks.length > 0 ? (
        <div className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide scroll-smooth">
          {section.tracks.map((track) => (
            <TrackCard
              key={track.id}
              track={track}
              queue={section.tracks}
              size={sectionKey === 'trending' ? 'large' : 'medium'}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-gradient-to-br from-gray-900/50 to-red-900/20 rounded-2xl border border-red-800/20">
          <Music size={80} className="mx-auto mb-6 text-red-500/30" />
          <p className="text-xl font-semibold text-red-300/70">No tracks available</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-8 pb-24">
      {/* Featured Hero Section */}
      {featuredTrack && (
        <div className="relative h-[500px] rounded-2xl overflow-hidden shadow-2xl mb-12">
          {/* Background Image with Blur */}
          <div
            className="absolute inset-0 bg-cover bg-center transform scale-110 blur-sm"
            style={{
              backgroundImage: `url(${featuredTrack.thumbnail_url})`,
            }}
          />
          
          {/* Gradient Overlays */}
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
          
          {/* Content */}
          <div className="relative h-full flex items-end px-12 pb-12">
            <div className="max-w-3xl space-y-6">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 bg-red-600/90 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg">
                <TrendingUp size={16} className="animate-pulse" />
                <span>TRENDING NOW #1</span>
              </div>
              
              {/* Title */}
              <h1 className="text-5xl md:text-7xl font-black text-white leading-tight drop-shadow-2xl">
                {featuredTrack.title}
              </h1>
              
              {/* Artist */}
              <p className="text-2xl md:text-3xl text-red-300 font-semibold drop-shadow-lg">
                {featuredTrack.artist}
              </p>
              
              {/* Stats */}
              <div className="flex items-center gap-6 text-gray-200 text-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="font-semibold">{MusicAPI.formatNumber(featuredTrack.view_count)} views</span>
                </div>
                <span className="text-red-400">•</span>
                <span className="font-medium">{MusicAPI.formatDuration(featuredTrack.duration)}</span>
              </div>
              
              {/* Action Buttons */}
              <div className="flex items-center gap-4 pt-4">
                <button
                  onClick={() => handlePlayTrack(featuredTrack, sections.trending.tracks)}
                  className="flex items-center gap-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white px-10 py-4 rounded-full font-bold text-lg transition-all duration-300 transform hover:scale-105 shadow-2xl"
                >
                  <Play size={24} className="ml-1" fill="white" />
                  Play Now
                </button>
                <button 
                  onClick={() => handleLikeTrack(featuredTrack.id)}
                  className="flex items-center gap-3 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white px-8 py-4 rounded-full font-bold text-lg transition-all duration-300 border-2 border-white/20 hover:border-white/40 transform hover:scale-105"
                >
                  <Heart size={24} />
                  Like
                </button>
                <button className="flex items-center justify-center w-14 h-14 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white rounded-full transition-all duration-300 border-2 border-white/20 hover:border-white/40 transform hover:scale-105">
                  <Shuffle size={20} />
                </button>
              </div>
            </div>
          </div>
          
          {/* Decorative Elements */}
          <div className="absolute top-8 right-8 w-32 h-32 bg-red-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-8 right-24 w-48 h-48 bg-red-600/10 rounded-full blur-3xl" />
        </div>
      )}

      {/* Popular Artists */}
      <PopularArtists />

      {/* Music Sections */}
      <div className="space-y-12">
        {Object.entries(sections).map(([key, section]) => (
          <SectionRow key={key} sectionKey={key} section={section} />
        ))}
      </div>

      {/* Quick Access Genres */}
      <div className="space-y-6">
        <h2 className="text-3xl font-black bg-gradient-to-r from-red-400 via-red-500 to-red-600 bg-clip-text text-transparent drop-shadow-lg">Browse by Genre</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { name: 'Pop', color: 'from-pink-500 to-pink-600', emoji: '🎵', shadow: 'shadow-pink-500/50' },
            { name: 'Rock', color: 'from-orange-500 to-orange-600', emoji: '🎸', shadow: 'shadow-orange-500/50' },
            { name: 'Hip Hop', color: 'from-purple-500 to-purple-600', emoji: '🎤', shadow: 'shadow-purple-500/50' },
            { name: 'Electronic', color: 'from-blue-500 to-blue-600', emoji: '🎧', shadow: 'shadow-blue-500/50' },
            { name: 'Jazz', color: 'from-yellow-500 to-yellow-600', emoji: '🎺', shadow: 'shadow-yellow-500/50' },
            { name: 'Classical', color: 'from-indigo-500 to-indigo-600', emoji: '🎼', shadow: 'shadow-indigo-500/50' },
          ].map((genre) => (
            <button
              key={genre.name}
              onClick={() => {
                // Load genre music when clicked
                MusicAPI.getGenreMusic(genre.name.toLowerCase(), 20).then(tracks => {
                  if (tracks.length > 0) {
                    handlePlayTrack(tracks[0], tracks);
                  }
                });
              }}
              className={`bg-gradient-to-br ${genre.color} rounded-2xl p-8 text-white font-black text-lg hover:scale-105 transition-all duration-300 shadow-xl ${genre.shadow} hover:shadow-2xl border border-white/10 relative overflow-hidden group`}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative">
                <div className="text-4xl mb-3 transform group-hover:scale-110 transition-transform">{genre.emoji}</div>
                <div className="text-xl">{genre.name}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Mood Playlists */}
      <div className="space-y-6">
        <h2 className="text-3xl font-black bg-gradient-to-r from-red-400 via-red-500 to-red-600 bg-clip-text text-transparent drop-shadow-lg">Music for Every Mood</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { name: 'Chill', color: 'from-cyan-400 via-cyan-500 to-blue-500', emoji: '😌', desc: 'Relax & Unwind', shadow: 'shadow-cyan-500/50' },
            { name: 'Workout', color: 'from-red-500 via-red-600 to-orange-500', emoji: '💪', desc: 'Get Pumped', shadow: 'shadow-red-500/50' },
            { name: 'Focus', color: 'from-green-400 via-green-500 to-teal-500', emoji: '🧠', desc: 'Stay Productive', shadow: 'shadow-green-500/50' },
            { name: 'Party', color: 'from-purple-500 via-pink-500 to-pink-600', emoji: '🎉', desc: 'Turn It Up', shadow: 'shadow-purple-500/50' },
          ].map((mood) => (
            <button
              key={mood.name}
              onClick={() => {
                // Load mood music when clicked
                MusicAPI.getMoodMusic(mood.name.toLowerCase(), 20).then(tracks => {
                  if (tracks.length > 0) {
                    handlePlayTrack(tracks[0], tracks);
                  }
                });
              }}
              className={`bg-gradient-to-br ${mood.color} rounded-2xl p-8 text-white font-black text-xl hover:scale-105 transition-all duration-300 shadow-xl ${mood.shadow} hover:shadow-2xl border border-white/10 relative overflow-hidden group`}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative text-left">
                <div className="text-5xl mb-4 transform group-hover:scale-110 transition-transform">{mood.emoji}</div>
                <div className="text-2xl mb-2">{mood.name}</div>
                <div className="text-sm font-medium opacity-90">{mood.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

 
     <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
