"use client";

import React, { useState, useEffect } from "react";
import { Search, Filter, X } from 'lucide-react';
import Navbar from "../../components/Navbar";
import RedLoader from "../../components/RedLoader";
import { getApiUrl } from "../../lib/api";
import { 
  ScrollReveal, 
  MagneticButton,
  FloatingElement
} from '@/components/scrollx';
import { useNavigate } from "@/hooks/useNavigate";

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

interface TMDBSearchResponse {
  page: number;
  results: TMDBSearchResult[];
  total_pages: number;
  total_results: number;
}

interface SearchFilters {
  type: string;
  rating: string;
  year: string;
  sortBy: string;
}

export default function SearchPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<TMDBSearchResult[]>([]);
  const [filters, setFilters] = useState<SearchFilters>({
    type: "multi",
    rating: "all",
    year: "all",
    sortBy: "popularity"
  });
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);

  useEffect(() => {
    // Check for search query in URL
    const urlParams = new URLSearchParams(window.location.search);
    const queryParam = urlParams.get('q');
    if (queryParam) {
      setSearchQuery(queryParam);
      setHasSearched(true);
      performSearch(queryParam, 1);
    }
  }, []);

  useEffect(() => {
    if (searchQuery.trim() || hasSearched) {
      // Debounce search to avoid too many API calls
      const timeoutId = setTimeout(() => {
        performSearch(searchQuery, 1);
      }, 300);
      
      return () => clearTimeout(timeoutId);
    }
  }, [searchQuery, filters]);

  const performSearch = async (query: string, page: number = 1) => {
    if (!query.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    try {
      const apiUrl = getApiUrl();
      
      // Build search URL with filters
      const params = new URLSearchParams({
        q: query.trim(),
        page: page.toString(),
        type: filters.type
      });

      const response = await fetch(`${apiUrl}/api/tmdb/search?${params}`);
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }
      
      const data: TMDBSearchResponse = await response.json();
      let results = data.results || [];
      
      // Apply client-side filters
      if (filters.rating !== 'all') {
        const minRating = parseFloat(filters.rating);
        results = results.filter(item => item.vote_average >= minRating);
      }
      
      if (filters.year !== 'all') {
        const targetYear = parseInt(filters.year);
        results = results.filter(item => {
          const year = new Date(item.release_date).getFullYear();
          return year === targetYear;
        });
      }
      
      // Sort results
      switch (filters.sortBy) {
        case 'title':
          results.sort((a, b) => a.title.localeCompare(b.title));
          break;
        case 'rating':
          results.sort((a, b) => b.vote_average - a.vote_average);
          break;
        case 'year':
          results.sort((a, b) => {
            const yearA = new Date(a.release_date).getFullYear();
            const yearB = new Date(b.release_date).getFullYear();
            return yearB - yearA;
          });
          break;
        case 'popularity':
        default:
          results.sort((a, b) => b.popularity - a.popularity);
          break;
      }
      
      setSearchResults(results);
      setCurrentPage(data.page);
      setTotalPages(data.total_pages);
      setTotalResults(data.total_results);
      setHasSearched(true);
      
      console.log(`🔍 TMDB search returned ${results.length} results for "${query}"`);
      
    } catch (error) {
      console.error("Error performing TMDB search:", error);
      setSearchResults([]);
      setTotalResults(0);
    } finally {
      setLoading(false);
    }
  };

  const handleResultClick = (result: TMDBSearchResult) => {
    // Navigate to TMDB movie/TV page
    navigate.push(`/tmdb-movie/${result.id}`);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
    performSearch(query, 1);
  };

  const clearFilters = () => {
    setFilters({
      type: "multi",
      rating: "all",
      year: "all",
      sortBy: "popularity"
    });
  };

  const getPosterUrl = (posterPath: string) => {
    if (!posterPath) {
      return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQ1MCIgdmlld0JveD0iMCAwIDMwMCA0NTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iNDUwIiBmaWxsPSIjMzc0MTUxIi8+CjxwYXRoIGQ9Ik0xNTAgMjAwQzE4Ny4yNzkgMjAwIDIxOCAxNjkuMjc5IDIxOCAxMzJDMjE4IDk0LjcyMDggMTg3LjI3OSA2NCAxNTAgNjRDMTEyLjcyMSA2NCA4MiA5NC43MjA4IDgyIDEzMkM4MiAxNjkuMjc5IDExMi43MjEgMjAwIDE1MCAyMDBaIiBmaWxsPSIjNkI3Mjg4Ii8+CjxwYXRoIGQ9Ik04MiAyNzZDODIgMjM4LjY4IDExMi42OCAyMDggMTUwIDIwOEgxNTBDMTg3LjMyIDIwOCAyMTggMjM4LjY4IDIxOCAyNzZWMzUwSDgyVjI3NloiIGZpbGw9IiM2QjcyODgiLz4KPHN2Zz4K';
    }
    return `https://image.tmdb.org/t/p/w500${posterPath}`;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const year = new Date(dateString).getFullYear();
    return year ? year.toString() : '';
  };

  const activeFiltersCount = Object.values(filters).filter(value => value !== "multi" && value !== "all" && value !== "popularity").length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-900/20 via-black to-black text-white">
      <Navbar onSearch={handleSearch} />

      {/* Main Content Container */}
      <div className="relative bg-gradient-to-b from-red-900/20 via-black to-black min-h-screen">
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
                      onChange={(e) => setSearchQuery(e.target.value)}
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
                            <option value="multi">All Types</option>
                            <option value="movie">Movies Only</option>
                            <option value="tv">TV Shows Only</option>
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
                            <option value="popularity">Most Popular</option>
                            <option value="title">Title A-Z</option>
                            <option value="rating">Highest Rated</option>
                            <option value="year">Newest First</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </ScrollReveal>
                )}
          </div>

          {/* Results Section */}
          <div className="flex gap-8">
            {/* Filters Sidebar */}
            <div className="w-80 flex-shrink-0">
              <div className="sticky top-24">
                <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-white/20 p-6">
                  <h3 className="text-xl font-bold text-white mb-6">Filters</h3>
                  
                  {/* Filter Controls */}
                  <div className="space-y-6">
                    {/* Type Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-3">Content Type</label>
                      <select
                        value={filters.type}
                        onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
                        className="w-full bg-black/50 backdrop-blur-md border border-white/20 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        <option value="multi">All Types</option>
                        <option value="movie">Movies Only</option>
                        <option value="tv">TV Shows Only</option>
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

                    {/* Sort Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-3">Sort By</label>
                      <select
                        value={filters.sortBy}
                        onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value }))}
                        className="w-full bg-black/50 backdrop-blur-md border border-white/20 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        <option value="popularity">Most Popular</option>
                        <option value="title">Title A-Z</option>
                        <option value="rating">Highest Rated</option>
                        <option value="year">Newest First</option>
                      </select>
                    </div>
                    
                    {/* Clear Filters Button */}
                    {activeFiltersCount > 0 && (
                      <MagneticButton
                        onClick={clearFilters}
                        className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg font-semibold transition-colors"
                      >
                        Clear All Filters
                      </MagneticButton>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Results Content */}
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
                      {totalResults > 0 && ` (showing ${searchResults.length})`}
                    </p>
                  </div>

                  {/* Results Display - TMDB Cards */}
                  {searchResults.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                      {searchResults.map((result) => (
                        <div key={`${result.media_type}-${result.id}`} className="group">
                          <div 
                            onClick={() => handleResultClick(result)}
                            className="bg-gray-800/50 rounded-lg overflow-hidden hover:bg-gray-700/50 transition-all duration-300 cursor-pointer hover:scale-105 hover:shadow-2xl"
                          >
                            {/* Poster */}
                            <div className="aspect-[2/3] relative overflow-hidden">
                              <img
                                src={getPosterUrl(result.poster_path)}
                                alt={result.title}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 bg-gray-800"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQ1MCIgdmlld0JveD0iMCAwIDMwMCA0NTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iNDUwIiBmaWxsPSIjMzc0MTUxIi8+CjxwYXRoIGQ9Ik0xNTAgMjAwQzE4Ny4yNzkgMjAwIDIxOCAxNjkuMjc5IDIxOCAxMzJDMjE4IDk0LjcyMDggMTg3LjI3OSA2NCAxNTAgNjRDMTEyLjcyMSA2NCA4MiA5NC43MjA4IDgyIDEzMkM4MiAxNjkuMjc5IDExMi43MjEgMjAwIDE1MCAyMDBaIiBmaWxsPSIjNkI3Mjg4Ii8+CjxwYXRoIGQ9Ik04MiAyNzZDODIgMjM4LjY4IDExMi42OCAyMDggMTUwIDIwOEgxNTBDMTg3LjMyIDIwOCAyMTggMjM4LjY4IDIxOCAyNzZWMzUwSDgyVjI3NloiIGZpbGw9IiM2QjcyODgiLz4KPHN2Zz4K';
                                }}
                              />
                              
                              {/* Media Type Badge */}
                              <div className="absolute top-2 left-2">
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                  result.media_type === 'movie' 
                                    ? 'bg-blue-600 text-white' 
                                    : 'bg-green-600 text-white'
                                }`}>
                                  {result.media_type === 'movie' ? 'Movie' : 'TV'}
                                </span>
                              </div>

                              {/* Rating Badge */}
                              {result.vote_average > 0 && (
                                <div className="absolute top-2 right-2">
                                  <span className="bg-black/70 text-yellow-400 px-2 py-1 rounded-full text-xs font-semibold">
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
                              
                              <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
                                <span>{formatDate(result.release_date)}</span>
                                <span className="capitalize">{result.media_type}</span>
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
                    Enter a search term above to discover movies and TV shows in your collection
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>


    </div>
  );
}
