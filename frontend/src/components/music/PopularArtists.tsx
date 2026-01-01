"use client";

import React, { useState, useEffect } from 'react';
import { Play, User } from 'lucide-react';
import { MusicAPI } from '@/lib/musicApi';
import { Track } from '@/types/music';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';

interface Artist {
  name: string;
  image: string;
  tracks: Track[];
}

export default function PopularArtists() {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const { playTrack } = useMusicPlayer();

  useEffect(() => {
    loadPopularArtists();
  }, []);

  const loadPopularArtists = async () => {
    try {
      setLoading(true);
      
      // Popular artists to showcase
      const popularArtists = [
        'Taylor Swift',
        'Ed Sheeran',
        'The Weeknd',
        'Billie Eilish',
        'Drake',
        'Ariana Grande',
        'Post Malone',
        'Dua Lipa',
      ];

      const artistPromises = popularArtists.map(async (artistName) => {
        try {
          const tracks = await MusicAPI.searchTracks(`${artistName} top songs`, 5);
          return {
            name: artistName,
            image: tracks[0]?.thumbnail_url || '',
            tracks: tracks,
          };
        } catch (error) {
          console.error(`Failed to load tracks for ${artistName}:`, error);
          return {
            name: artistName,
            image: '',
            tracks: [],
          };
        }
      });

      const artistsData = await Promise.all(artistPromises);
      setArtists(artistsData.filter(artist => artist.tracks.length > 0));
    } catch (error) {
      console.error('Failed to load popular artists:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayArtist = (artist: Artist) => {
    if (artist.tracks.length > 0) {
      playTrack(artist.tracks[0], artist.tracks);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white">Popular Artists</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="text-center animate-pulse">
              <div className="w-24 h-24 bg-gray-700 rounded-full mx-auto mb-2"></div>
              <div className="h-4 bg-gray-700 rounded w-16 mx-auto"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">Popular Artists</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        {artists.map((artist) => (
          <div
            key={artist.name}
            className="text-center group cursor-pointer"
            onClick={() => handlePlayArtist(artist)}
          >
            <div className="relative w-24 h-24 mx-auto mb-2">
              {artist.image ? (
                <img
                  src={artist.image}
                  alt={artist.name}
                  className="w-full h-full object-cover rounded-full"
                />
              ) : (
                <div className="w-full h-full bg-gray-700 rounded-full flex items-center justify-center">
                  <User size={32} className="text-gray-500" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Play size={20} className="text-white ml-1" />
              </div>
            </div>
            <h3 className="text-white text-sm font-medium truncate group-hover:text-green-400 transition-colors">
              {artist.name}
            </h3>
            <p className="text-gray-400 text-xs">
              {artist.tracks.length} songs
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}