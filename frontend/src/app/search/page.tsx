"use client";

import React, { useState, useEffect, useCallback } from "react";
import { usePageTitle } from '@/hooks/usePageTitle';
import { Search, Filter, X, Film, Tv, Star, Calendar, Clock, Grid, List, SortAsc, SortDesc } from 'lucide-react';
import Navbar from "../../components/Navbar";
import RedLoader from "../../components/RedLoader";
import { getApiUrl } from "../../lib/api";
import { 
  ScrollReveal, 
  MagneticButton,
  FloatingElement
} from '@/components/scrollx';
import { useNavigate } from "@/hooks/useNavigate";
import { motion, AnimatePresence } from "framer-motion";

interface SearchResult {
  id: number;
  title: string;
  original_title?: string;
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
  type?: string;
  year?: number;
  duration?: number;
  description?: string;
  _source?: 'tmdb' | 'local';
  genres?: Array<{ id: number; name: string }>;
  quality?: string;
  view_count?: number;
  is_local?: boolean;
}

interface TMDBSearchResponse {
  page: number;
  results: SearchResult[];
  total_pages: number;
  total_results: number;
}

interface SearchFilters {
  type: string;
  rating: string;
  year: string;
  sortBy: string;
  source: string;
}

export default function SearchPage() {
  usePageTitle('Search');
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    type: "all",
    rating: "all",
    year: "all",
    sortBy: "relevance",
    source: "all"
  });

  // Get search query from URL on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const queryParam = urlParams.get('q') || '';
      if (queryParam) {
        setSearchQuery(queryParam);
        performSearch(queryParam);
      }
    }
  }, []);

  // Debounced search effect
  useEffect(() => {
    if (searchQuery.trim()) {
      const timeoutId = setTimeout(() => {
        performSearch(searchQuery.trim());
      }, 300);
      
      return () => clearTimeout(timeoutId);
    } else {
      setSearchResults([]);
      setHasSearched(false);
      setTotalResults(0);
    }
  }, [searchQuery, filters]);

  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      setTotalResults(0);
      return;
    }

    setLoading(true);
    setHasSearched(true);

    try {
      const apiUrl = getApiUrl();
      
      // Search both local and TMDB in parallel
      const [localResponse, tmdbResponse] = await Promise.allSettled([
        fetch(`${apiUrl}/api/media/search?q=${encodeURIComponent(query)}`),
        fetch(`${apiUrl}/api/tmdb/suggestions?q=${encodeURIComponent(query)}`)
      ]);

      let combinedResults: SearchResult[] = [];

      // Process local results
      if (localResponse.status === 'fulfilled' && localResponse.value.ok) {
        const localData = await localResponse.value.json();
        if (Array.isArray(localData)) {
          const localMapped: SearchResult[] = localData.map((item: any) => ({
            id: item.id,
            title: item.title,
            name: item.title,
            overview: item.description || item.long_desc || item.short_desc || '',
            release_date: item.release_date || '',
            first_air_date: item.first_air_date || '',
            poster_path: item.poster_path ? `/api/posters/${item.id}` : '',
            backdrop_path: item.backdrop_path ? `/api/backdrops/${item.id}` : '',
            vote_average: item.rating || 0,
            vote_count: item.vote_count || 0,
            popularity: item.popularity || 0,
            media_type: (item.type === 'tv' || item.type === 'series' || item.type === 'episode') ? 'tv' as const : 'movie' as const,
            adult: false,
            genre_ids: [],
            type: item.type,
            year: item.year,
            duration: item.duration,
            description: item.description,
            _source: 'local' as const,
            genres: item.genres || [],
            quality: item.quality,
            view_count: item.view_count || 0,
            is_local: true
          }));
          combinedResults = [...localMapped];
        }
      }

      // Process TMDB results
      if (tmdbResponse.status === 'fulfilled' && tmdbResponse.value.ok) {
        const tmdbData = await tmdbResponse.value.json();
        const tmdbResults = tmdbData.results || [];
        
        // Filter out TMDB results that are already in local results
        const localTitles = new Set(combinedResults.map(r => `${r.title.toLowerCase()}-${r.media_type}`));
        
        const newTmdbResults = tmdbResults.filter((item: any) => 
          !localTitles.has(`${item.title.toLowerCase()}-${item.media_type}`)
        ).map((item: any) => ({
          ...item,
          _source: 'tmdb' as const,
          is_local: false
        }));
        
        combinedResults = [...combinedResults, ...newTmdbResults];
      }

      // Apply filters
      const filteredResults = applyFilters(combinedResults);
      
      // Sort results
      const sortedResults = sortResults(filteredResults);

      setSearchResults(sortedResults);
      setTotalResults(sortedResults.length);
      
      console.log(`🔍 Search returned ${combinedResults.length} total results for "${query}"`);
      
    } catch (error) {
      console.error("Error performing search:", error);
      setSearchResults([]);
      setTotalResults(0);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const applyFilters = useCallback((results: SearchResult[]) => {
    return results.filter(result => {
      // Type filter
      if (filters.type !== 'all' && result.media_type !== filters.type) {
        return false;
      }

      // Source filter
      if (filters.source !== 'all' && result._source !== filters.source) {
        return false;
      }

      // Rating filter
      if (filters.rating !== 'all') {
        const minRating = parseFloat(filters.rating);
        if (result.vote_average < minRating) {
          return false;
        }
      }

      // Year filter
      if (filters.year !== 'all') {
        const releaseYear = result.release_date ? new Date(result.release_date).getFullYear() : 
                           result.first_air_date ? new Date(result.first_air_date).getFullYear() : 
                           result.year;
        if (releaseYear !== parseInt(filters.year)) {
          return false;
        }
      }

      return true;
    });
  }, [filters]);

  const sortResults = useCallback((results: SearchResult[]) => {
    return [...results].sort((a, b) => {
      switch (filters.sortBy) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'rating':
          return (b.vote_average || 0) - (a.vote_average || 0);
        case 'year':
          const yearA = a.release_date ? new Date(a.release_date).getFullYear() : 
                      a.first_air_date ? new Date(a.first_air_date).getFullYear() : 
                      a.year || 0;
          const yearB = b.release_date ? new Date(b.release_date).getFullYear() : 
                      b.first_air_date ? new Date(b.first_air_date).getFullYear() : 
                      b.year || 0;
          return yearB - yearA;
        case 'popularity':
          return (b.popularity || 0) - (a.popularity || 0);
        case 'views':
          return (b.view_count || 0) - (a.view_count || 0);
        case 'relevance':
        default:
          // Local results first, then by popularity/rating
          if (a._source === 'local' && b._source !== 'local') return -1;
          if (a._source !== 'local' && b._source === 'local') return 1;
          return (b.popularity || 0) - (a.popularity || 0) || 
                 (b.vote_average || 0) - (a.vote_average || 0);
      }
    });
  }, [filters.sortBy]);

  const handleResultClick = (result: SearchResult) => {
    if (result._source === 'local') {
      // Navigate to local content page
      if (result.media_type === 'movie') {
        navigate.push(`/movie/${result.id}`);
      } else {
        // For TV series, use series_id if available, otherwise use id
        const seriesId = (result as any).series_id || result.id;
        navigate.push(`/tv-series/${seriesId}`);
      }
    } else {
      // Navigate to TMDB content page
      navigate.push(`/tmdb-movie/${result.id}?type=${result.media_type}`);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    performSearch(query);
  };

  const clearFilters = () => {
    setFilters({
      type: "all",
      rating: "all",
      year: "all",
      sortBy: "relevance",
      source: "all"
    });
  };

  const getPosterUrl = (result: SearchResult) => {
    const apiUrl = getApiUrl();
    
    // Handle local API poster paths
    if (result._source === 'local') {
      // For TV series, use the series poster endpoint (same as TV series page)
      if (result.media_type === 'tv' || result.type === 'tv' || result.type === 'series' || result.type === 'episode') {
        const seriesId = (result as any).series_id || result.id;
        return `${apiUrl}/api/series/${seriesId}/poster`;
      }
      
      // For movies, use the existing poster path logic
      if (result.poster_path) {
        if (result.poster_path.startsWith('/api/')) {
          return `${apiUrl}${result.poster_path}`;
        }
        return result.poster_path;
      }
    }
    
    // Handle TMDB poster paths
    if (result.poster_path) {
      return `https://image.tmdb.org/t/p/w500${result.poster_path}`;
    }
    
    // Fallback to backdrop if available
    if (result.backdrop_path) {
      if (result._source === 'local' && result.backdrop_path.startsWith('/api/')) {
        return `${apiUrl}${result.backdrop_path}`;
      }
      return `https://image.tmdb.org/t/p/w500${result.backdrop_path}`;
    }
    
    // Default placeholder
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQ1MCIgdmlld0JveD0iMCAwIDMwMCA0NTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iNDUwIiBmaWxsPSIjMzc0MTUxIi8+CjxwYXRoIGQ9Ik0xNTAgMjAwQzE4Ny4yNzkgMjAwIDIxOCAxNjkuMjc5IDIxOCAxMzJDMjE4IDk0LjcyMDggMTg3LjI3OSA2NCAxNTAgNjRDMTEyLjcyMSA2NCA4MiA5NC43MjA4IDgyIDEzMkM4MiAxNjkuMjc5IDExMi43MjEgMjAwIDE1MCAyMDBaIiBmaWxsPSIjNkI3Mjg4Ii8+CjxwYXRoIGQ9Ik04MiAyNzZDODIgMjM4LjY4IDExMi42OCAyMDggMTUwIDIwOEgxNTBDMTg3LjMyIDIwOCAyMTggMjM4LjY4IDIxOCAyNzZWMzUwSDgyVjI3NloiIGZpbGw9IiM2QjcyODgiLz4KPHN2Zz4K';
  };

  const formatDate = (dateString?: string | null): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const year = date.getFullYear();
    return isNaN(year) ? '' : year.toString();
  };

  const activeFiltersCount = Object.values(filters).filter(value => 
    value !== "all" && value !== "relevance"
  ).length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-900/20 via-black to-black text-white">
      <Navbar onSearch={handleSearch} />

      {/* Main Content Container */}
      <div className="relative bg-gradient-to-b from-red-900/20 via-black to-black min-h-screen pt-24">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          {/* Search Header */}
          <div className="mb-8">
            <div className="text-center mb-8">
              <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 flex items-center justify-center gap-4 tracking-wider">
                <FloatingElement>
                  <Search className="w-12 h-12" />
                </FloatingElement>
                S E A R C H   L I B R A R Y
              </h1>
              
              {/* Search Bar */}
              <div className="relative max-w-3xl mx-auto">
                <Search className="absolute left-6 top-1/2 transform -translate-y-1/2 text-gray-400 w-6 h-6" />
                <input
                  type="text"
                  placeholder="Search for movies, TV shows, genres..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value || '')}
                  className="w-full bg-black/50 backdrop-blur-md text-white pl-16 pr-6 py-6 rounded-2xl border border-white/20 focus:border-red-500 focus:outline-none text-xl placeholder-gray-400"
                />
              </div>
            </div>

            {/* Filter Controls */}
            <div className="flex flex-wrap justify-center gap-4 mb-8">
              <MagneticButton
                onClick={() => setShowFilters(!showFilters)}
                className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                  showFilters 
                    ? 'bg-red-600 hover:bg-red-700 text-white' 
                    : 'bg-black/50 backdrop-blur-md border border-white/20 text-white hover:bg-white/10'
                }`}
              >
                <Filter className="w-4 h-4 mr-2" />
                Filters
                {activeFiltersCount > 0 && (
                  <span className="ml-2 bg-red-600 text-white rounded-full px-2 py-1 text-xs">
                    {activeFiltersCount}
                  </span>
                )}
              </MagneticButton>
              
              {activeFiltersCount > 0 && (
                <MagneticButton
                  onClick={clearFilters}
                  className="px-6 py-3 rounded-lg font-semibold bg-gray-600 hover:bg-gray-700 text-white"
                >
                  <X className="w-4 h-4 mr-2" />
                  Clear Filters
                </MagneticButton>
              )}
            </div>

            {/* Advanced Filters */}
            {showFilters && (
              <ScrollReveal direction="up" delay={0.2}>
                <div className="bg-black/50 backdrop-blur-md p-8 rounded-2xl border border-white/20 max-w-4xl mx-auto">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Type Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-3">Content Type</label>
                      <select
                        value={filters.type}
                        onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
                        className="w-full bg-black/50 backdrop-blur-md border border-white/20 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        <option value="all">All Types</option>
                        <option value="movie">Movies Only</option>
                        <option value="tv">TV Shows Only</option>
                      </select>
                    </div>

                    {/* Source Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-3">Source</label>
                      <select
                        value={filters.source}
                        onChange={(e) => setFilters(prev => ({ ...prev, source: e.target.value }))}
                        className="w-full bg-black/50 backdrop-blur-md border border-white/20 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        <option value="all">All Sources</option>
                        <option value="local">Local Library</option>
                        <option value="tmdb">TMDB Database</option>
                      </select>
                    </div>

                    {/* Rating Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-3">Min Rating</label>
                      <select
                        value={filters.rating}
                        onChange={(e) => setFilters(prev => ({ ...prev, rating: e.target.value }))}
                        className="w-full bg-black/50 backdrop-blur-md border border-white/20 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        <option value="all">Any Rating</option>
                        <option value="7">7+ Stars</option>
                        <option value="8">8+ Stars</option>
                        <option value="9">9+ Stars</option>
                      </select>
                    </div>

                    {/* Year Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-3">Release Year</label>
                      <select
                        value={filters.year}
                        onChange={(e) => setFilters(prev => ({ ...prev, year: e.target.value }))}
                        className="w-full bg-black/50 backdrop-blur-md border border-white/20 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        <option value="all">Any Year</option>
                        <option value="2024">2024</option>
                        <option value="2023">2023</option>
                        <option value="2022">2022</option>
                        <option value="2021">2021</option>
                        <option value="2020">2020</option>
                        <option value="2019">2019</option>
                        <option value="2018">2018</option>
                      </select>
                    </div>

                    {/* Sort Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-3">Sort By</label>
                      <select
                        value={filters.sortBy}
                        onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value }))}
                        className="w-full bg-black/50 backdrop-blur-md border border-white/20 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        <option value="relevance">Most Relevant</option>
                        <option value="popularity">Most Popular</option>
                        <option value="title">Title A-Z</option>
                        <option value="rating">Highest Rated</option>
                        <option value="year">Newest First</option>
                        <option value="views">Most Viewed</option>
                      </select>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            )}
          </div>

          {/* Results Section */}
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="text-center py-16">
                <RedLoader size="large" />
              </div>
            ) : hasSearched ? (
              <div>
                {/* Results Header */}
                <div className="mb-6">
                  <p className="text-gray-300 text-lg">
                    {totalResults} result{totalResults !== 1 ? 's' : ''} 
                    {searchQuery && ` for "${searchQuery}"`}
                  </p>
                </div>

                {/* Results Display */}
                {searchResults.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                    {searchResults.map((result) => (
                      <div key={`${result._source}-${result.media_type}-${result.id}`} className="group">
                        <div 
                          onClick={() => handleResultClick(result)}
                          className="bg-gray-800/50 rounded-lg overflow-hidden hover:bg-gray-700/50 transition-all duration-300 cursor-pointer hover:scale-105 hover:shadow-2xl"
                        >
                          {/* Poster */}
                          <div className="aspect-[2/3] relative overflow-hidden">
                            <img
                              src={getPosterUrl(result)}
                              alt={result.title}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 bg-gray-800"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                const apiUrl = getApiUrl();
                                
                                // Try fallback sources for TV series
                                if (result._source === 'local' && (result.media_type === 'tv' || result.type === 'tv' || result.type === 'series')) {
                                  // First fallback: try TMDB poster if available
                                  if (result.poster_path && !target.src.includes('tmdb')) {
                                    target.src = `https://image.tmdb.org/t/p/w500${result.poster_path}`;
                                    return;
                                  }
                                  // Second fallback: try thumbnail endpoint
                                  if (!target.src.includes('/api/thumbnails/')) {
                                    target.src = `${apiUrl}/api/thumbnails/${result.id}`;
                                    return;
                                  }
                                }
                                
                                // Final fallback: clean black background with title initial
                                const parent = target.parentElement;
                                if (parent) {
                                  const initial = result.title?.charAt(0)?.toUpperCase() || '?';
                                  const mediaIcon = result.media_type === 'movie' ? '🎬' : '📺';
                                  parent.innerHTML = `
                                    <div class="w-full h-full bg-black flex flex-col items-center justify-center text-white">
                                      <div class="text-5xl mb-2">${mediaIcon}</div>
                                      <div class="text-6xl font-bold text-gray-700">${initial}</div>
                                    </div>
                                  `;
                                }
                              }}
                            />
                            
                            {/* Media Type Badge */}
                            <div className="absolute top-2 left-2 flex flex-col gap-1">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                result.media_type === 'movie' 
                                  ? 'bg-blue-600 text-white' 
                                  : 'bg-green-600 text-white'
                              }`}>
                                {result.media_type === 'movie' ? 'Movie' : 'TV'}
                              </span>
                              {result._source === 'local' && (
                                <span className="bg-yellow-600 text-white text-xs px-2 py-0.5 rounded-full font-semibold">
                                  Library
                                </span>
                              )}
                            </div>

                            {/* Rating Badge */}
                            {result.vote_average > 0 && (
                              <div className="absolute top-2 right-2">
                                <span className="bg-black/70 text-yellow-400 px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                                  ★ {result.vote_average.toFixed(1)}
                                </span>
                              </div>
                            )}

                            {/* Hover Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                              <div className="absolute bottom-4 left-4 right-4">
                                <button className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg font-semibold transition-colors">
                                  View Details
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Info */}
                          <div className="p-4">
                            <h3 className="font-semibold text-white mb-2 line-clamp-2 group-hover:text-red-400 transition-colors">
                              {result.title}
                            </h3>
                            
                            <div className="flex items-center text-sm text-gray-400 mb-2">
                              <span>{result.year || (result.release_date ? new Date(result.release_date).getFullYear() : new Date().getFullYear())}</span>
                            </div>

                            {result.overview && (
                              <p className="text-gray-400 text-sm line-clamp-3">
                                {result.overview}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <FloatingElement>
                      <Search className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    </FloatingElement>
                    <h3 className="text-2xl text-white mb-4">No results found</h3>
                    <p className="text-gray-400 mb-8">
                      {searchQuery 
                        ? `No results for "${searchQuery}". Try different search terms or adjust your filters.`
                        : "Try adjusting your search terms or filters"
                      }
                    </p>
                    <MagneticButton
                      onClick={clearFilters}
                      className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold"
                    >
                      Clear Filters
                    </MagneticButton>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-16">
                <FloatingElement>
                  <Search className="w-20 h-20 text-gray-600 mx-auto mb-6" />
                </FloatingElement>
                <h3 className="text-3xl text-white mb-4">Search Your Library</h3>
                <p className="text-gray-400 text-lg max-w-md mx-auto">
                  Enter a search term above to discover movies and TV shows in your collection and from TMDB
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}