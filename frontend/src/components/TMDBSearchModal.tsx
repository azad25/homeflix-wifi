"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Film, Tv, Star, Calendar } from 'lucide-react';
import { getApiUrl } from '@/lib/api';

interface TMDBSearchResult {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  release_date: string;
  poster_path: string;
  backdrop_path: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  media_type: "movie" | "tv";
  adult: boolean;
  genre_ids: number[];
}

interface TMDBSuggestionsResponse {
  results: TMDBSearchResult[];
  total_results: number;
}

interface TMDBSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (result: TMDBSearchResult) => void;
  initialQuery?: string;
  mediaType?: 'movie' | 'tv' | 'all';
  title?: string;
}

const TMDBSearchModal: React.FC<TMDBSearchModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  initialQuery = '',
  mediaType = 'all',
  title = 'Search TMDB'
}) => {
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<TMDBSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery(initialQuery);
      setSelectedIndex(-1);
      setSuggestions([]);
      // Focus input after a short delay to ensure modal is rendered
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, initialQuery]);

  // Debounced search for suggestions
  useEffect(() => {
    if (searchQuery.trim().length > 1) {
      const timeoutId = setTimeout(() => {
        fetchSuggestions(searchQuery.trim());
      }, 300);

      return () => clearTimeout(timeoutId);
    } else {
      setSuggestions([]);
      setSelectedIndex(-1);
    }
  }, [searchQuery]);

  const fetchSuggestions = async (query: string) => {
    if (!query.trim()) return;

    setIsLoading(true);
    try {
      const apiUrl = getApiUrl();
      let endpoint = '/api/tmdb/suggestions';
      
      // Use specific endpoints based on media type
      if (mediaType === 'movie') {
        endpoint = '/api/tmdb/search';
      } else if (mediaType === 'tv') {
        endpoint = '/api/tmdb/search';
      }
      
      const response = await fetch(`${apiUrl}${endpoint}?q=${encodeURIComponent(query)}&type=${mediaType}`);

      if (response.ok) {
        const data: TMDBSuggestionsResponse = await response.json();
        let results = data.results || [];
        
        // Filter by media type if specified
        if (mediaType !== 'all') {
          results = results.filter(result => result.media_type === mediaType);
        }
        
        setSuggestions(results);
        setSelectedIndex(-1);
      } else {
        console.error("Failed to fetch suggestions:", response.statusText);
        setSuggestions([]);
      }
    } catch (error) {
      console.error("Error fetching suggestions:", error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => 
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && suggestions[selectedIndex]) {
        handleSelect(suggestions[selectedIndex]);
      }
    }
  };

  const handleSelect = (result: TMDBSearchResult) => {
    onSelect(result);
    onClose();
  };

  const getPosterUrl = (posterPath: string) => {
    if (!posterPath) {
      return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA0OCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjY0IiBmaWxsPSIjMzc0MTUxIi8+CjxwYXRoIGQ9Ik0yNCAzMkMzMC42Mjc0IDMyIDM2IDI2LjYyNzQgMzYgMjBDMzYgMTMuMzcyNiAzMC42Mjc0IDggMjQgOEMxNy4zNzI2IDggMTIgMTMuMzcyNiAxMiAyMEMxMiAyNi42Mjc0IDE3LjM3MjYgMzIgMjQgMzJaIiBmaWxsPSIjNkI3Mjg4Ii8+CjxwYXRoIGQ9Ik0xMiA0NEMxMiAzNi4yNjggMTguMjY4IDMwIDI2IDMwSDIyQzI5LjczMiAzMCAzNiAzNi4yNjggMzYgNDRWNTZIMTJWNDRaIiBmaWxsPSIjNkI3Mjg4Ii8+Cjwvc3ZnPgo=';
    }
    return `https://image.tmdb.org/t/p/w92${posterPath}`;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const year = new Date(dateString).getFullYear();
    return year ? `(${year})` : '';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          
          {/* Modal */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative w-full max-w-2xl bg-black/95 backdrop-blur-sm border border-white/20 rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <Search className="w-5 h-5 text-[#E50914]" />
                {title}
              </h2>
              <button
                onClick={onClose}
                className="text-white/60 hover:text-white transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="p-6 border-b border-white/10">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/50" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Search for ${mediaType === 'all' ? 'movies & TV shows' : mediaType === 'movie' ? 'movies' : 'TV shows'}...`}
                  className="w-full bg-white/10 border border-white/20 rounded-lg pl-10 pr-4 py-3 text-white placeholder-white/50 focus:border-[#E50914] focus:outline-none transition-colors"
                />
                {isLoading && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin w-4 h-4 border-2 border-[#E50914] border-t-transparent rounded-full"></div>
                  </div>
                )}
              </div>
            </div>

            {/* Results */}
            <div className="max-h-96 overflow-y-auto">
              {isLoading ? (
                <div className="p-8 text-center text-white/60">
                  <div className="animate-spin w-8 h-8 border-2 border-[#E50914] border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p>Searching TMDB...</p>
                </div>
              ) : suggestions.length > 0 ? (
                <div className="py-2">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={`${suggestion.media_type}-${suggestion.id}`}
                      onClick={() => handleSelect(suggestion)}
                      className={`w-full px-6 py-4 text-left hover:bg-white/10 transition-colors flex items-center gap-4 group ${
                        index === selectedIndex ? 'bg-white/10' : ''
                      }`}
                    >
                      <div className="flex-shrink-0">
                        <img
                          src={getPosterUrl(suggestion.poster_path)}
                          alt={suggestion.title}
                          className="w-12 h-16 object-cover rounded bg-gray-800"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA0OCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjY0IiBmaWxsPSIjMzc0MTUxIi8+CjxwYXRoIGQ9Ik0yNCAzMkMzMC42Mjc0IDMyIDM2IDI2LjYyNzQgMzYgMjBDMzYgMTMuMzcyNiAzMC42Mjc0IDggMjQgOEMxNy4zNzI2IDggMTIgMTMuMzcyNiAxMiAyMEMxMiAyNi42Mjc0IDE3LjM3MjYgMzIgMjQgMzJaIiBmaWxsPSIjNkI3Mjg4Ii8+CjxwYXRoIGQ9Ik0xMiA0NEMxMiAzNi4yNjggMTguMjY4IDMwIDI2IDMwSDIyQzI5LjczMiAzMCAzNiAzNi4yNjggMzYgNDRWNTZIMTJWNDRaIiBmaWxsPSIjNkI3Mjg4Ii8+Cjwvc3ZnPgo=';
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {suggestion.media_type === 'movie' ? (
                            <Film className="w-4 h-4 text-blue-400 flex-shrink-0" />
                          ) : (
                            <Tv className="w-4 h-4 text-green-400 flex-shrink-0" />
                          )}
                          <h4 className="text-white font-medium truncate group-hover:text-[#E50914] transition-colors">
                            {suggestion.title}
                          </h4>
                          <span className="text-gray-400 text-sm flex-shrink-0 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(suggestion.release_date)}
                          </span>
                        </div>
                        {suggestion.overview && (
                          <p className="text-gray-400 text-sm line-clamp-2 mb-2">
                            {suggestion.overview}
                          </p>
                        )}
                        <div className="flex items-center gap-3">
                          <span className="text-yellow-400 text-sm flex items-center gap-1">
                            <Star className="w-3 h-3" />
                            {suggestion.vote_average.toFixed(1)}
                          </span>
                          <span className="text-gray-500 text-xs px-2 py-1 bg-white/10 rounded">
                            {suggestion.media_type === 'movie' ? 'Movie' : 'TV Show'}
                          </span>
                          <span className="text-gray-500 text-xs">
                            ID: {suggestion.id}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : searchQuery.trim() && !isLoading ? (
                <div className="p-8 text-center text-white/60">
                  <Search className="w-12 h-12 mx-auto mb-4 text-white/30" />
                  <p>No results found for "{searchQuery}"</p>
                  <p className="text-sm mt-2">Try a different search term or check the spelling.</p>
                </div>
              ) : (
                <div className="p-8 text-center text-white/60">
                  <Search className="w-12 h-12 mx-auto mb-4 text-white/30" />
                  <p>Start typing to search TMDB</p>
                  <p className="text-sm mt-2">Find movies and TV shows to update your media metadata.</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/10 text-center">
              <p className="text-xs text-white/50">
                Use ↑↓ arrow keys to navigate, Enter to select, Esc to close
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TMDBSearchModal;