"use client";

import React, { useState, useEffect } from "react";
import { Search, Filter, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Media } from "../../types/media";
import VideoPlayer from "../../components/VideoPlayer";
import Navbar from "../../components/Navbar";
import { getApiUrl, apiCall, API_ENDPOINTS } from "../../lib/api";
import ErrorBoundary from "../../components/ErrorBoundary";
import { 
  ScrollReveal, 
  MagneticButton,
  FloatingElement,
  GradientBackground
} from '@/components/scrollx';
import NetflixPortraitGrid from '@/components/NetflixPortraitGrid';

interface SearchFilters {
  type: string;
  genre: string;
  rating: string;
  year: string;
  sortBy: string;
}

export default function SearchPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Media[]>([]);
  const [allGenres, setAllGenres] = useState<string[]>([]);
  const [allMedia, setAllMedia] = useState<Media[]>([]);
  const [filters, setFilters] = useState<SearchFilters>({
    type: "all",
    genre: "all",
    rating: "all",
    year: "all",
    sortBy: "relevance"
  });
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    fetchGenres();
    
    // Check for search query in URL
    const urlParams = new URLSearchParams(window.location.search);
    const queryParam = urlParams.get('q');
    if (queryParam) {
      setSearchQuery(queryParam);
      setHasSearched(true);
    }
  }, []);

  useEffect(() => {
    if (searchQuery.trim() || hasSearched) {
      performSearch();
    }
  }, [searchQuery, filters]);

  const fetchGenres = async () => {
    try {
      const allMedia = await apiCall(API_ENDPOINTS.media);
      
      const genres = new Set<string>();
      allMedia.forEach((media: Media) => {
        (media.genres || []).forEach(genre => genres.add(genre.name));
      });
      
      setAllGenres(Array.from(genres).sort());
    } catch (error) {
      console.error("Error fetching genres:", error);
      setAllGenres([]);
    }
  };

  const performSearch = async () => {
    setLoading(true);
    try {
      // Fetch all media with retry logic
      const allMedia = await apiCall(API_ENDPOINTS.media);
      
      setAllMedia(allMedia);
      
      let results = [...allMedia];
      
      // Filter by search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        results = results.filter(media => 
          media.title.toLowerCase().includes(query) ||
          (media.description || '').toLowerCase().includes(query) ||
          (media.genres || []).some((genre: any) => 
            genre.name.toLowerCase().includes(query)
          )
        );
      }
      
      // Apply filters
      if (filters.type !== 'all') {
        results = results.filter(media => media.type === filters.type);
      }
      
      if (filters.genre !== 'all') {
        results = results.filter(media => 
          (media.genres || []).some((genre: any) => genre.name === filters.genre)
        );
      }
      
      if (filters.rating !== 'all') {
        const minRating = parseFloat(filters.rating);
        results = results.filter(media => (media.rating || 0) >= minRating);
      }
      
      // Sort results
      switch (filters.sortBy) {
        case 'title':
          results.sort((a, b) => a.title.localeCompare(b.title));
          break;
        case 'rating':
          results.sort((a, b) => (b.rating || 0) - (a.rating || 0));
          break;
        case 'year':
          results.sort((a, b) => b.id - a.id); // Assuming newer IDs = newer content
          break;
        case 'popular':
          results.sort((a, b) => (b.view_count || 0) - (a.view_count || 0));
          break;
        default: // relevance
          // Keep original order for relevance
          break;
      }
      
      setSearchResults(results);
      setHasSearched(true);
    } catch (error) {
      console.error("Error performing search:", error);
      setSearchResults([]);
      setAllMedia([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = (media: Media) => {
    setSelectedMedia(media);
    setIsPlayerOpen(true);
  };

  const handleInfo = (media: Media) => {
    router.push(`/movie/${media.uuid}`);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setHasSearched(true);
  };

  const clearFilters = () => {
    setFilters({
      type: "all",
      genre: "all",
      rating: "all",
      year: "all",
      sortBy: "relevance"
    });
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const activeFiltersCount = Object.values(filters).filter(value => value !== "all" && value !== "relevance").length;

  return (
    <GradientBackground variant="netflix" className="min-h-screen">
      <div className="min-h-screen text-white relative z-10">
      <Navbar onSearch={(query) => setSearchQuery(query)} />

      {/* Header Section */}
      <div className="pt-20 pb-8">
        <ScrollReveal direction="up" delay={0.1}>
          <div className="px-4 md:px-8 lg:px-16">
            <div className="text-center mb-8">
              <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 flex items-center justify-center gap-4">
                <FloatingElement>
                  <Search className="w-12 h-12 text-red-500" />
                </FloatingElement>
                Search Library
              </h1>
              
              {/* Search Bar */}
              <div className="relative max-w-3xl mx-auto mb-8">
                <Search className="absolute left-6 top-1/2 transform -translate-y-1/2 text-gray-400 w-6 h-6" />
                <input
                  type="text"
                  placeholder="Search for movies, TV shows, genres..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-gray-900/80 backdrop-blur-md text-white pl-16 pr-6 py-6 rounded-2xl border border-gray-700 focus:border-red-500 focus:outline-none text-xl placeholder-gray-400"
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
                    : 'bg-gray-900/80 backdrop-blur-md border border-gray-700 text-white hover:bg-gray-800'
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
                <div className="bg-gray-900/80 backdrop-blur-md p-8 rounded-2xl border border-gray-700 max-w-4xl mx-auto mb-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Type Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-3">Content Type</label>
                      <select
                        value={filters.type}
                        onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
                        className="w-full bg-gray-800 border border-gray-600 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        <option value="all">All Types</option>
                        <option value="movie">Movies</option>
                        <option value="episode">TV Shows</option>
                      </select>
                    </div>

                    {/* Genre Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-3">Genre</label>
                      <select
                        value={filters.genre}
                        onChange={(e) => setFilters(prev => ({ ...prev, genre: e.target.value }))}
                        className="w-full bg-gray-800 border border-gray-600 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        <option value="all">All Genres</option>
                        {allGenres.map(genre => (
                          <option key={genre} value={genre}>{genre}</option>
                        ))}
                      </select>
                    </div>

                    {/* Rating Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-3">Min Rating</label>
                      <select
                        value={filters.rating}
                        onChange={(e) => setFilters(prev => ({ ...prev, rating: e.target.value }))}
                        className="w-full bg-gray-800 border border-gray-600 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
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
                        className="w-full bg-gray-800 border border-gray-600 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        <option value="relevance">Relevance</option>
                        <option value="title">Title A-Z</option>
                        <option value="rating">Highest Rated</option>
                        <option value="year">Newest First</option>
                        <option value="popular">Most Popular</option>
                      </select>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            )}

            {/* Results Count */}
            {hasSearched && (
              <div className="text-center mb-8">
                <p className="text-gray-300 text-lg">
                  {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} 
                  {searchQuery && ` for "${searchQuery}"`}
                </p>
              </div>
            )}
          </div>
        </ScrollReveal>
      </div>

      {/* Results Section */}
      <div className="pb-20">
        <ErrorBoundary
          showRetry={true}
          retryText="Retry Search"
          onError={(error) => console.error('Search page error:', error)}
        >
          {loading ? (
            <div className="text-center py-16">
              <FloatingElement>
                <Search className="w-16 h-16 text-gray-400 mx-auto mb-4 animate-pulse" />
              </FloatingElement>
              <div className="text-white text-2xl">Searching...</div>
            </div>
          ) : hasSearched ? (
            searchResults.length > 0 ? (
              <NetflixPortraitGrid
                media={searchResults}
                onPlay={handlePlay}
                onInfo={handleInfo}
                loading={loading}
                itemsPerRow={6}
                showTitle={false}
              />
            ) : (
              <ScrollReveal direction="up" delay={0.3}>
                <div className="text-center py-20 px-4">
                  <FloatingElement>
                    <Search className="w-20 h-20 text-gray-600 mx-auto mb-6" />
                  </FloatingElement>
                  <h3 className="text-3xl text-white mb-4">No results found</h3>
                  <p className="text-gray-400 mb-8 max-w-md mx-auto">
                    {searchQuery 
                      ? `No results for "${searchQuery}". Try different search terms or adjust your filters.`
                      : "Try adjusting your search terms or filters"
                    }
                  </p>
                  <MagneticButton
                    onClick={clearFilters}
                    className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-lg font-semibold"
                  >
                    Clear Filters
                  </MagneticButton>
                </div>
              </ScrollReveal>
            )
          ) : (
            <ScrollReveal direction="up" delay={0.2}>
              <div className="text-center py-20 px-4">
                <FloatingElement>
                  <Search className="w-24 h-24 text-gray-600 mx-auto mb-8" />
                </FloatingElement>
                <h3 className="text-4xl text-white mb-6">Search Your Library</h3>
                <p className="text-gray-400 text-xl max-w-lg mx-auto">
                  Enter a search term above to discover movies and TV shows in your collection
                </p>
              </div>
            </ScrollReveal>
          )}
        </ErrorBoundary>
      </div>

      {/* Video Player Modal */}
      {selectedMedia && (
        <VideoPlayer
          media={selectedMedia}
          isOpen={isPlayerOpen}
          onClose={() => setIsPlayerOpen(false)}
          startTime={0}
        />
      )}
      </div>
    </GradientBackground>
  );
}
