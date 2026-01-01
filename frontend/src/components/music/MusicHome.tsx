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
      <div className={`${cardSizes[size]} flex-shrink-0 bg-gradient-to-br from-gray-900/60 to-red-900/30 rounded-xl p-4 hover:from-gray-800/70 hover:to-red-800/40 transition-all duration-300 cursor-pointer group backdrop-blur-sm border border-red-800/20`}>
        <div className={`${imageSizes[size]} relative mb-4 rounded-xl overflow-hidden`}>
          <img
            src={track.thumbnail_url}
            alt={track.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => handlePlayTrack(track, queue)}
              className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white rounded-full p-4 transform hover:scale-110 transition-all duration-300 shadow-lg"
            >
              <Play size={size === 'large' ? 28 : 24} className="ml-1" />
            </button>
          </div>
          {isPlaying && (
            <div className="absolute top-3 right-3 bg-red-500 rounded-full p-2">
              <div className="flex gap-1">
                <div className="w-1 h-2 bg-white rounded animate-pulse" />
                <div className="w-1 h-3 bg-white rounded animate-pulse" style={{ animationDelay: '150ms' }} />
                <div className="w-1 h-2 bg-white rounded animate-pulse" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <h3 className="text-white font-semibold text-sm truncate group-hover:text-red-300 transition-colors">
            {track.title}
          </h3>
          <p className="text-red-300 text-xs truncate">{track.artist}</p>
          <div className="flex items-center justify-between text-xs text-red-400">
            <span>{MusicAPI.formatNumber(track.view_count)} views</span>
            <span>{MusicAPI.formatDuration(track.duration)}</span>
          </div>
        </div>
      </div>
    );
  };

  const SectionRow = ({ sectionKey, section }: { sectionKey: string, section: MusicSection }) => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={section.color}>
            {section.icon}
          </div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-red-400 to-red-600 bg-clip-text text-transparent">{section.title}</h2>
        </div>
        <div className="flex items-center gap-3">
          {section.tracks.length > 0 && (
            <button
              onClick={() => handleShufflePlay(section.tracks)}
              className="flex items-center gap-2 text-red-300 hover:text-white transition-colors transform hover:scale-105"
            >
              <Shuffle size={18} />
              <span className="text-sm font-medium">Shuffle</span>
            </button>
          )}
          <ChevronRight className="text-red-400" size={24} />
        </div>
      </div>

      {section.loading ? (
        <div className="flex gap-6 overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="w-44 flex-shrink-0 bg-gradient-to-br from-gray-900/60 to-red-900/30 rounded-xl p-4 animate-pulse border border-red-800/20">
              <div className="w-44 h-44 bg-red-900/40 rounded-xl mb-4"></div>
              <div className="space-y-3">
                <div className="h-4 bg-red-900/40 rounded"></div>
                <div className="h-3 bg-red-900/40 rounded w-2/3"></div>
              </div>
            </div>
          ))}
        </div>
      ) : section.tracks.length > 0 ? (
        <div className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide">
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
        <div className="text-center py-12 text-red-300">
          <Music size={64} className="mx-auto mb-6 opacity-50" />
          <p className="text-lg">No tracks available</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-8 pb-24">
      {/* Featured Hero Section */}
      {featuredTrack && (
        <div className="relative h-96 rounded-xl overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${featuredTrack.thumbnail_url})`,
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
          <div className="relative h-full flex items-center px-8">
            <div className="max-w-2xl space-y-4">
              <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
                <TrendingUp size={16} />
                <span>TRENDING NOW</span>
              </div>
              <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight">
                {featuredTrack.title}
              </h1>
              <p className="text-xl text-gray-300">{featuredTrack.artist}</p>
              <div className="flex items-center gap-4 text-gray-400">
                <span>{MusicAPI.formatNumber(featuredTrack.view_count)} views</span>
                <span>•</span>
                <span>{MusicAPI.formatDuration(featuredTrack.duration)}</span>
              </div>
              <div className="flex items-center gap-4 pt-4">
                <button
                  onClick={() => handlePlayTrack(featuredTrack, sections.trending.tracks)}
                  className="flex items-center gap-3 bg-green-500 hover:bg-green-600 text-white px-8 py-3 rounded-full font-medium transition-colors"
                >
                  <Play size={20} className="ml-1" />
                  Play Now
                </button>
                <button className="flex items-center gap-3 bg-white/20 hover:bg-white/30 text-white px-8 py-3 rounded-full font-medium transition-colors">
                  <Heart size={20} />
                  Like
                </button>
              </div>
            </div>
          </div>
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
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white">Browse by Genre</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[
            { name: 'Pop', color: 'bg-pink-500', emoji: '🎵' },
            { name: 'Rock', color: 'bg-orange-500', emoji: '🎸' },
            { name: 'Hip Hop', color: 'bg-purple-500', emoji: '🎤' },
            { name: 'Electronic', color: 'bg-blue-500', emoji: '🎧' },
            { name: 'Jazz', color: 'bg-yellow-500', emoji: '🎺' },
            { name: 'Classical', color: 'bg-indigo-500', emoji: '🎼' },
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
              className={`${genre.color} rounded-lg p-6 text-white font-bold text-lg hover:scale-105 transition-transform`}
            >
              <div className="text-2xl mb-2">{genre.emoji}</div>
              {genre.name}
            </button>
          ))}
        </div>
      </div>

      {/* Mood Playlists */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white">Music for Every Mood</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { name: 'Chill', color: 'bg-gradient-to-br from-cyan-400 to-blue-500', emoji: '😌' },
            { name: 'Workout', color: 'bg-gradient-to-br from-red-500 to-orange-500', emoji: '💪' },
            { name: 'Focus', color: 'bg-gradient-to-br from-green-400 to-teal-500', emoji: '🧠' },
            { name: 'Party', color: 'bg-gradient-to-br from-purple-500 to-pink-500', emoji: '🎉' },
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
              className={`${mood.color} rounded-xl p-6 text-white font-bold text-lg hover:scale-105 transition-transform`}
            >
              <div className="text-3xl mb-2">{mood.emoji}</div>
              <div>{mood.name}</div>
              <div className="text-sm opacity-80 mt-1">Perfect vibes</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}