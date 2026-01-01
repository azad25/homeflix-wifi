"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Search, X, TrendingUp, Clock } from 'lucide-react';
import { MusicAPI } from '@/lib/musicApi';
import { Track } from '@/types/music';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';

interface MusicSearchProps {
  onClose?: () => void;
  className?: string;
}

export default function MusicSearch({ onClose, className = '' }: MusicSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [trendingTracks, setTrendingTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { playTrack } = useMusicPlayer();

  useEffect(() => {
    // Load recent searches from localStorage
    const saved = localStorage.getItem('musicRecentSearches');
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }

    // Load trending tracks for suggestions
    loadTrendingTracks();

    // Focus input
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const loadTrendingTracks = async () => {
    try {
      const trending = await MusicAPI.getTrendingTracks(10);
      setTrendingTracks(trending);
    } catch (error) {
      console.error('Failed to load trending tracks:', error);
    }
  };

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setLoading(true);
    setShowResults(true);

    try {
      const searchResults = await MusicAPI.searchTracks(searchQuery, 20);
      setResults(searchResults);
      
      // Save to recent searches
      const newRecentSearches = [searchQuery, ...recentSearches.filter(s => s !== searchQuery)].slice(0, 5);
      setRecentSearches(newRecentSearches);
      localStorage.setItem('musicRecentSearches', JSON.stringify(newRecentSearches));
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    
    // Debounce search
    const timeoutId = setTimeout(() => {
      handleSearch(value);
    }, 300);

    return () => clearTimeout(timeoutId);
  };

  const handlePlayTrack = (track: Track) => {
    playTrack(track, results.length > 0 ? results : [track]);
    if (onClose) onClose();
  };

  const handleRecentSearch = (searchTerm: string) => {
    setQuery(searchTerm);
    handleSearch(searchTerm);
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('musicRecentSearches');
  };

  return (
    <div className={`bg-gray-900 rounded-lg ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search songs, artists, albums..."
          value={query}
          onChange={handleInputChange}
          className="w-full pl-12 pr-12 py-4 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-green-500 focus:outline-none text-lg"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
              setShowResults(false);
            }}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Search Results or Suggestions */}
      <div className="mt-4 max-h-96 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
          </div>
        ) : showResults && results.length > 0 ? (
          /* Search Results */
          <div className="space-y-2">
            <h3 className="text-white font-semibold mb-3">Search Results</h3>
            {results.map((track) => (
              <div
                key={track.id}
                onClick={() => handlePlayTrack(track)}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 cursor-pointer transition-colors"
              >
                <img
                  src={track.thumbnail_url}
                  alt={track.title}
                  className="w-12 h-12 rounded object-cover"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="text-white font-medium truncate">{track.title}</h4>
                  <p className="text-gray-400 text-sm truncate">{track.artist}</p>
                </div>
                <div className="text-gray-400 text-sm">
                  {MusicAPI.formatDuration(track.duration)}
                </div>
              </div>
            ))}
          </div>
        ) : showResults && query ? (
          /* No Results */
          <div className="text-center py-8">
            <Search size={48} className="mx-auto text-gray-600 mb-4" />
            <p className="text-gray-400">No results found for "{query}"</p>
          </div>
        ) : (
          /* Suggestions */
          <div className="space-y-6">
            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white font-semibold flex items-center gap-2">
                    <Clock size={18} />
                    Recent Searches
                  </h3>
                  <button
                    onClick={clearRecentSearches}
                    className="text-gray-400 hover:text-white text-sm"
                  >
                    Clear
                  </button>
                </div>
                <div className="space-y-1">
                  {recentSearches.map((search, index) => (
                    <button
                      key={index}
                      onClick={() => handleRecentSearch(search)}
                      className="block w-full text-left px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded transition-colors"
                    >
                      {search}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Trending Tracks */}
            {trendingTracks.length > 0 && (
              <div>
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <TrendingUp size={18} />
                  Trending Now
                </h3>
                <div className="space-y-2">
                  {trendingTracks.slice(0, 5).map((track) => (
                    <div
                      key={track.id}
                      onClick={() => handlePlayTrack(track)}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 cursor-pointer transition-colors"
                    >
                      <img
                        src={track.thumbnail_url}
                        alt={track.title}
                        className="w-10 h-10 rounded object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white font-medium truncate text-sm">{track.title}</h4>
                        <p className="text-gray-400 text-xs truncate">{track.artist}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}