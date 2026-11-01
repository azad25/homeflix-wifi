"use client";

import { TVGridSkeleton } from '@/components/tv/TVPage';
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
    <div className="min-h-screen bg-black text-white">
      <Navbar onSearch={handleSearch} />

      {/* Main Content Container */}
      <div className="relative bg-black min-h-screen pt-24">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          {/* Search Header */}
          <div className="mb-8">
            <div className="mb-8">
              <h1 className="mb-5 text-[34px] font-bold tracking-[-0.03em] text-white md:text-5xl">Search</h1>

              {/* Search Bar */}
              <div className="relative max-w-3xl">
                <Search className="pointer-events-none absolute left-5 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-white/50" />
                <input
                  type="search"
                  autoFocus
                  placeholder="Movies, TV shows, genres…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value || '')}
                  aria-label="Search"
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.08] py-4 pl-14 pr-5 text-lg text-white placeholder-white/40 backdrop-blur-xl transition-colors focus:border-white/40 focus:bg-white/[0.12] focus:outline-none md:text-xl"
                />
              </div>
            </div>

            {/* Filter Controls */}
            <div className="mb-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                aria-expanded={showFilters}
                className={`tv-btn ${showFilters ? 'tv-btn-primary' : 'tv-btn-secondary'}`}
              >
                <Filter className="h-4 w-4" />
                Filters
                {activeFiltersCount > 0 && (
                  <span className={`rounded-full px-1.5 text-xs font-bold leading-5 ${showFilters ? 'bg-black/10' : 'bg-white/20'}`}>
                    {activeFiltersCount}
                  </span>
                )}
              </button>

              {activeFiltersCount > 0 && (
                <button type="button" onClick={clearFilters} className="tv-btn tv-btn-secondary">
                  <X className="h-4 w-4" />
                  Clear
                </button>
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
                        className="w-full bg-white/[0.08] backdrop-blur-xl border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-white/40"
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
                        className="w-full bg-white/[0.08] backdrop-blur-xl border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-white/40"
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
                        className="w-full bg-white/[0.08] backdrop-blur-xl border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-white/40"
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
                        className="w-full bg-white/[0.08] backdrop-blur-xl border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-white/40"
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
                        className="w-full bg-white/[0.08] backdrop-blur-xl border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-white/40"
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
              <TVGridSkeleton count={12} />
            ) : hasSearched ? (
              <div>
                {/* Results Header */}
                <div className="mb-6">
                  <p className="text-[15px] text-[var(--tv-text-secondary)]">
                    {totalResults} result{totalResults !== 1 ? 's' : ''} 
                    {searchQuery && ` for "${searchQuery}"`}
                  </p>
                </div>

                {/* Results Display */}
                {searchResults.length > 0 ? (
                  <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                    {searchResults.map((result) => {
                      const d = result.release_date || result.first_air_date;
                      const y = result.year || (d ? new Date(d).getFullYear() : null);
                      const isTv = result.media_type !== 'movie';
                      return (
                        <SearchResultCard
                          key={`${result._source}-${result.media_type}-${result.id}`}
                          title={result.title}
                          src={getPosterUrl(result)}
                          fallbacks={[
                            result._source === 'local' && result.poster_path ? `https://image.tmdb.org/t/p/w500${result.poster_path}` : null,
                            result._source === 'local' ? `${getApiUrl()}/api/thumbnails/${result.id}` : null,
                          ]}
                          caption={[Number.isFinite(y) ? y : null, isTv ? 'TV Show' : 'Movie', result.vote_average > 0 ? `★ ${result.vote_average.toFixed(1)}` : null].filter(Boolean).join(' · ')}
                          badge={result._source === 'local' ? 'In Library' : null}
                          onSelect={() => handleResultClick(result)}
                        />
                      );
                    })}
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
                    <button type="button" onClick={clearFilters} className="tv-btn tv-btn-primary">
                      Clear Filters
                    </button>
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

/** Apple TV poster result. Image fallbacks are tried in order without
 * touching the DOM directly (the old card overwrote innerHTML on error). */
function SearchResultCard({ title, src, fallbacks, caption, badge, onSelect }: {
  title: string;
  src: string;
  fallbacks: (string | null)[];
  caption: string;
  badge?: string | null;
  onSelect: () => void;
}) {
  const chain = React.useMemo(() => [src, ...fallbacks].filter(Boolean) as string[], [src, fallbacks]);
  const [idx, setIdx] = useState(0);
  const current = chain[idx];
  return (
    <button type="button" onClick={onSelect} className="tv-card-group block w-full text-left outline-none" aria-label={title}>
      <div className="tv-card aspect-[2/3] w-full">
        {current ? (
          <img
            src={current}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setIdx((i) => i + 1)}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-zinc-800 to-zinc-900 p-3 text-center">
            <span className="text-3xl font-bold text-white/30">{title?.charAt(0)?.toUpperCase() || '?'}</span>
            <span className="line-clamp-2 text-xs font-semibold text-white/60">{title}</span>
          </div>
        )}
        {badge && (
          <span className="absolute left-2 top-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-md">{badge}</span>
        )}
      </div>
      <p className="mt-2.5 truncate text-[14px] font-semibold text-[var(--tv-text)]">{title}</p>
      {caption && <p className="tv-caption mt-0.5 truncate">{caption}</p>}
    </button>
  );
}
