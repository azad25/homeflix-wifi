"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Search, 
  Filter, 
  Star, 
  Calendar, 
  Film, 
  Tv, 
  Check,
  Loader2,
  Globe,
  Database
} from 'lucide-react';
import { getApiUrl } from '@/lib/api';

interface ContentSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  selectedContent: any[];
  onContentChange: (content: any[]) => void;
  selectedGenres: number[];
  onGenresChange: (genres: number[]) => void;
}

interface Genre {
  id: number;
  name: string;
}

interface TMDBSearchResult {
  id: number;
  title?: string;
  name?: string;
  overview: string;
  release_date?: string;
  first_air_date?: string;
  poster_path: string;
  backdrop_path: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  media_type: "movie" | "tv";
  adult: boolean;
  genre_ids: number[];
}

export default function ContentSelector({
  isOpen,
  onClose,
  selectedContent,
  onContentChange,
  selectedGenres,
  onGenresChange
}: ContentSelectorProps) {
  const [activeTab, setActiveTab] = useState<'search' | 'genres' | 'featured'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TMDBSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [localGenres, setLocalGenres] = useState<Genre[]>([]);
  const [tmdbGenres, setTmdbGenres] = useState<Genre[]>([]);
  const [featuredContent, setFeaturedContent] = useState<TMDBSearchResult[]>([]);
  const [loadingFeatured, setLoadingFeatured] = useState(false);

  const apiUrl = getApiUrl();

  useEffect(() => {
    if (isOpen) {
      fetchLocalGenres();
      fetchTMDBGenres();
    }
  }, [isOpen]);

  useEffect(() => {
    if (activeTab === 'featured' && featuredContent.length === 0) {
      fetchFeaturedContent();
    }
  }, [activeTab]);

  // Debounced search
  useEffect(() => {
    if (searchQuery.trim().length > 1) {
      const timeoutId = setTimeout(() => {
        searchTMDBContent(searchQuery.trim());
      }, 300);
      return () => clearTimeout(timeoutId);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const fetchLocalGenres = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/genres`);
      if (response.ok) {
        const data = await response.json();
        setLocalGenres(data || []);
      }
    } catch (error) {
      console.error('Error fetching local genres:', error);
    }
  };

  const fetchTMDBGenres = async () => {
    try {
      const [movieGenres, tvGenres] = await Promise.all([
        fetch(`${apiUrl}/api/tmdb/genres/movie`).then(r => r.ok ? r.json() : { genres: [] }),
        fetch(`${apiUrl}/api/tmdb/genres/tv`).then(r => r.ok ? r.json() : { genres: [] })
      ]);
      
      const allGenres = [...movieGenres.genres, ...tvGenres.genres];
      const uniqueGenres = allGenres.filter((genre, index, self) => 
        index === self.findIndex(g => g.id === genre.id)
      );
      
      setTmdbGenres(uniqueGenres.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error('Error fetching TMDB genres:', error);
    }
  };

  const searchTMDBContent = async (query: string) => {
    if (!query.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch(`${apiUrl}/api/tmdb/suggestions?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.results || []);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error("Error searching TMDB content:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const fetchFeaturedContent = async () => {
    setLoadingFeatured(true);
    try {
      const endpoints = [
        `${apiUrl}/api/tmdb/movie/popular`,
        `${apiUrl}/api/tmdb/movie/now-playing`,
        `${apiUrl}/api/upcoming-tv-series?section=popular`
      ];
      
      const responses = await Promise.all(
        endpoints.map(url => fetch(url).then(r => r.ok ? r.json() : { results: [] }))
      );
      
      const allResults = responses.flatMap(data => data.results || []);
      
      const processedResults = allResults.map(item => ({
        ...item,
        media_type: item.media_type || (item.title ? 'movie' : 'tv'),
        title: item.title || item.name
      }));
      
      const uniqueResults = processedResults.filter((item, index, self) => 
        index === self.findIndex(i => i.id === item.id && i.media_type === item.media_type)
      ).slice(0, 20);
      
      setFeaturedContent(uniqueResults);
    } catch (error) {
      console.error("Error fetching featured content:", error);
    } finally {
      setLoadingFeatured(false);
    }
  };

  const toggleContent = (item: TMDBSearchResult) => {
    const exists = selectedContent.some(c => c.id === item.id && c.media_type === item.media_type);
    if (exists) {
      onContentChange(selectedContent.filter(c => !(c.id === item.id && c.media_type === item.media_type)));
    } else {
      onContentChange([...selectedContent, item]);
    }
  };

  const toggleGenre = (genreId: number) => {
    if (selectedGenres.includes(genreId)) {
      onGenresChange(selectedGenres.filter(id => id !== genreId));
    } else {
      onGenresChange([...selectedGenres, genreId]);
    }
  };

  const getPosterUrl = (posterPath: string) => {
    if (!posterPath) return '/placeholder-poster.jpg';
    return `https://image.tmdb.org/t/p/w185${posterPath}`;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const year = new Date(dateString).getFullYear();
    return year ? `(${year})` : '';
  };

  const getFilteredByGenres = () => {
    if (selectedGenres.length === 0) return featuredContent;
    return featuredContent.filter(item => 
      item.genre_ids?.some(genreId => selectedGenres.includes(genreId))
    );
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-md z-70 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="w-full max-w-6xl max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Glassmorphism Container */}
          <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-red-500/20 to-red-600/20 backdrop-blur-sm border border-white/10 rounded-xl flex items-center justify-center">
                  <Search className="w-6 h-6 text-red-200" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    Content & Genre Selection
                  </h2>
                  <p className="text-white/60 text-sm">
                    Choose specific content and filter by genres
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-white/60 hover:text-white hover:bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl transition-all duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/10">
              {[
                { id: 'search', label: 'TMDB Search', icon: Globe },
                { id: 'genres', label: 'Local Genres', icon: Database },
                { id: 'featured', label: 'Featured & Trending', icon: Star }
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id as any)}
                  className={`flex items-center gap-3 px-6 py-4 text-sm font-medium transition-all duration-200 ${
                    activeTab === id
                      ? 'text-red-200 border-b-2 border-red-400 bg-red-400/10'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="overflow-y-auto max-h-[60vh]">
              {/* Search Tab */}
              {activeTab === 'search' && (
                <div className="p-6 space-y-6">
                  {/* Search Input */}
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/40" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search for movies & TV shows..."
                      className="w-full bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl pl-12 pr-4 py-4 text-white placeholder-white/40 focus:border-red-400/50 focus:outline-none transition-colors"
                    />
                    {isSearching && (
                      <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                        <Loader2 className="w-5 h-5 text-red-400 animate-spin" />
                      </div>
                    )}
                  </div>

                  {/* Search Results */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {searchResults.map((item) => (
                      <ContentCard
                        key={`${item.media_type}-${item.id}`}
                        item={item}
                        isSelected={selectedContent.some(c => c.id === item.id && c.media_type === item.media_type)}
                        onToggle={() => toggleContent(item)}
                      />
                    ))}
                  </div>

                  {searchQuery.trim() && !isSearching && searchResults.length === 0 && (
                    <div className="text-center py-12">
                      <Search className="w-16 h-16 text-white/20 mx-auto mb-4" />
                      <p className="text-white/60">No results found for "{searchQuery}"</p>
                    </div>
                  )}
                </div>
              )}

              {/* Genres Tab */}
              {activeTab === 'genres' && (
                <div className="p-6 space-y-6">
                  {/* Local Genres */}
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <Database className="w-5 h-5 text-green-400" />
                      <h3 className="text-lg font-semibold text-white">Local Media Genres</h3>
                      <span className="text-sm text-white/60">({localGenres.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {localGenres.map((genre) => (
                        <button
                          key={`local-${genre.id}`}
                          onClick={() => toggleGenre(genre.id)}
                          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 hover:scale-105 ${
                            selectedGenres.includes(genre.id)
                              ? 'bg-green-500/20 border border-green-400/50 text-green-200 shadow-lg shadow-green-500/10'
                              : 'bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 hover:border-white/20'
                          }`}
                        >
                          {genre.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* TMDB Genres */}
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <Globe className="w-5 h-5 text-blue-400" />
                      <h3 className="text-lg font-semibold text-white">TMDB Genres</h3>
                      <span className="text-sm text-white/60">({tmdbGenres.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {tmdbGenres.map((genre) => (
                        <button
                          key={`tmdb-${genre.id}`}
                          onClick={() => toggleGenre(genre.id)}
                          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 hover:scale-105 ${
                            selectedGenres.includes(genre.id)
                              ? 'bg-blue-500/20 border border-blue-400/50 text-blue-200 shadow-lg shadow-blue-500/10'
                              : 'bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 hover:border-white/20'
                          }`}
                        >
                          {genre.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {selectedGenres.length > 0 && (
                    <div className="flex items-center justify-between p-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl">
                      <span className="text-white/80">{selectedGenres.length} genres selected</span>
                      <button
                        onClick={() => onGenresChange([])}
                        className="text-sm text-red-400 hover:text-red-300 transition-colors"
                      >
                        Clear all
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Featured Tab */}
              {activeTab === 'featured' && (
                <div className="p-6 space-y-6">
                  {loadingFeatured ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="relative">
                        <div className="w-12 h-12 border-4 border-white/20 border-t-blue-400 rounded-full animate-spin"></div>
                        <div className="absolute inset-0 w-12 h-12 border-4 border-transparent border-r-purple-400 rounded-full animate-spin animate-reverse"></div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                      {getFilteredByGenres().map((item) => (
                        <ContentCard
                          key={`${item.media_type}-${item.id}`}
                          item={item}
                          isSelected={selectedContent.some(c => c.id === item.id && c.media_type === item.media_type)}
                          onToggle={() => toggleContent(item)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-white/10 flex items-center justify-between">
              <div className="text-sm text-white/60">
                {selectedContent.length} items selected
                {selectedGenres.length > 0 && `, ${selectedGenres.length} genres filtered`}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    onContentChange([]);
                    onGenresChange([]);
                  }}
                  className="px-4 py-2 text-white/60 hover:text-white hover:bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl transition-all duration-200"
                >
                  Clear All
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-gradient-to-r from-blue-500/20 to-purple-500/20 hover:from-blue-500/30 hover:to-purple-500/30 backdrop-blur-sm border border-blue-400/30 text-blue-200 rounded-xl transition-all duration-200 hover:scale-105"
                >
                  Apply Selection
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Content Card Component
interface ContentCardProps {
  item: TMDBSearchResult;
  isSelected: boolean;
  onToggle: () => void;
}

function ContentCard({ item, isSelected, onToggle }: ContentCardProps) {
  const getPosterUrl = (posterPath: string) => {
    if (!posterPath) return '/placeholder-poster.jpg';
    return `https://image.tmdb.org/t/p/w185${posterPath}`;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const year = new Date(dateString).getFullYear();
    return year ? `(${year})` : '';
  };

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`relative cursor-pointer rounded-xl overflow-hidden transition-all duration-200 ${
        isSelected 
          ? 'ring-2 ring-blue-400 shadow-lg shadow-blue-500/20' 
          : 'hover:ring-1 hover:ring-white/20'
      }`}
      onClick={onToggle}
    >
      <div className="aspect-[2/3] relative bg-white/5 backdrop-blur-sm">
        <img
          src={getPosterUrl(item.poster_path)}
          alt={item.title || item.name}
          className="w-full h-full object-cover"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = '/placeholder-poster.jpg';
          }}
        />
        
        {/* Selection overlay */}
        {isSelected && (
          <div className="absolute inset-0 bg-blue-500/20 backdrop-blur-sm flex items-center justify-center">
            <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
              <Check className="w-6 h-6 text-white" />
            </div>
          </div>
        )}

        {/* Media type badge */}
        <div className="absolute top-2 left-2">
          <div className={`p-1.5 rounded-lg backdrop-blur-sm border ${
            item.media_type === 'movie' 
              ? 'bg-blue-500/20 border-blue-400/30' 
              : 'bg-green-500/20 border-green-400/30'
          }`}>
            {item.media_type === 'movie' ? (
              <Film className="w-3 h-3 text-blue-200" />
            ) : (
              <Tv className="w-3 h-3 text-green-200" />
            )}
          </div>
        </div>

        {/* Rating */}
        {item.vote_average > 0 && (
          <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-black/70 backdrop-blur-sm rounded-lg text-xs">
            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
            <span className="text-white font-medium">{item.vote_average.toFixed(1)}</span>
          </div>
        )}
      </div>

      <div className="p-3 bg-white/5 backdrop-blur-sm">
        <h4 className="text-sm font-medium text-white line-clamp-2 mb-1">
          {item.title || item.name}
        </h4>
        <div className="flex items-center gap-2 text-xs text-white/60">
          <Calendar className="w-3 h-3" />
          <span>{formatDate(item.release_date || item.first_air_date || '')}</span>
          <span>•</span>
          <span className="capitalize">{item.media_type}</span>
        </div>
      </div>
    </motion.div>
  );
}