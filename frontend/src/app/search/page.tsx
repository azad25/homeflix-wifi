"use client";

import React, { useState, useEffect } from "react";
import { Search, Filter, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Media } from "../../types/media";
import VideoPlayer from "../../components/VideoPlayer";
import Navbar from "../../components/Navbar";
import RedLoader from "../../components/RedLoader";
import { getApiUrl, smartSearch, preloadAssets } from "../../lib/api";
import NetflixMediaCard from "../../components/NetflixMediaCard";
import { 
  NetflixHorizontalRow, 
  ParallaxSection, 
  GradientBackground, 
  ScrollReveal, 
  MagneticButton,
  FloatingElement
} from '@/components/scrollx';
import { useNavigate } from "@/hooks/useNavigate";

interface SearchFilters {
  type: string;
  genre: string;
  rating: string;
  year: string;
  sortBy: string;
}

export default function SearchPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Media[]>([]);
  const [allGenres, setAllGenres] = useState<string[]>([]);
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
      performSearch();
    }
  }, []);

  useEffect(() => {
    if (searchQuery.trim() || hasSearched) {
      // Debounce search to avoid too many API calls
      const timeoutId = setTimeout(() => {
        performSearch();
      }, 300);
      
      return () => clearTimeout(timeoutId);
    }
  }, [searchQuery, filters]);

  const fetchGenres = async () => {
    try {
      const apiUrl = getApiUrl();
      
      const response = await fetch(`${apiUrl}/api/media`);
      const allMedia = await response.json();
      
      const genres = new Set<string>();
      allMedia.forEach((media: Media) => {
        (media.genres || []).forEach(genre => genres.add(genre.name));
      });
      
      setAllGenres(Array.from(genres).sort());
    } catch (error) {
      console.error("Error fetching genres:", error);
    }
  };

  const performSearch = async () => {
    setLoading(true);
    try {
      let results: Media[] = [];
      
      if (searchQuery.trim()) {
        // Use enhanced smart search
        results = await smartSearch(searchQuery);
        console.log(`🔍 Smart search returned ${results.length} results for "${searchQuery}"`);
      } else {
        // Get all media if no search query
        const apiUrl = getApiUrl();
        const response = await fetch(`${apiUrl}/api/media`);
        results = await response.json();
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
      
      // Sort results (smart search already provides relevance-based ordering)
      if (filters.sortBy !== 'relevance' || !searchQuery.trim()) {
        switch (filters.sortBy) {
          case 'title':
            results.sort((a, b) => a.title.localeCompare(b.title));
            break;
          case 'rating':
            results.sort((a, b) => (b.rating || 0) - (a.rating || 0));
            break;
          case 'year':
            results.sort((a, b) => b.id - a.id);
            break;
          case 'popular':
            results.sort((a, b) => (b.view_count || 0) - (a.view_count || 0));
            break;
        }
      }
      
      // Limit results to maximum 10 items
      const limitedResults = results.slice(0, 10);
      setSearchResults(limitedResults);
      setHasSearched(true);
      
      // Preload assets for better performance
      if (results.length > 0) {
        preloadAssets(results.slice(0, 12), ['thumbnail']);
      }
      
    } catch (error) {
      console.error("Error performing search:", error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = (media: Media) => {
    setSelectedMedia(media);
    setIsPlayerOpen(true);
  };

  const handleInfo = (media: Media) => {
    navigate.push(`/movie/${media.id}`);
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
                            className="w-full bg-black/50 backdrop-blur-md border border-white/20 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
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
                        className="w-full bg-black/50 backdrop-blur-md border border-white/20 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
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
                        <option value="relevance">Relevance</option>
                        <option value="title">Title A-Z</option>
                        <option value="rating">Highest Rated</option>
                        <option value="year">Newest First</option>
                        <option value="popular">Most Popular</option>
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
                      {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} 
                      {searchQuery && ` for "${searchQuery}"`}
                    </p>
                  </div>

                  {/* Results Display - Compact Grid (Max 10 items) */}
                  {searchResults.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {searchResults.map((media, index) => (
                        <div key={media.id} className="group">
                          <NetflixMediaCard
                            media={media}
                            onPlay={handlePlay}
                            onInfo={handleInfo}
                            priority={index < 12 ? 'high' : 'normal'}
                            showPreviewOnHover={false}
                          />
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

      {/* Video Player Modal */}
      {selectedMedia && (
        <VideoPlayer
          media={selectedMedia}
          isOpen={isPlayerOpen}
          onClose={() => setIsPlayerOpen(false)}
          startTime={0}
          onPlayNext={(nextMedia) => {
            console.log('Playing next episode:', nextMedia.title);
            setSelectedMedia(nextMedia);
            // Keep player open and switch to next episode
          }}
        />
      )}
    </div>
  );
}
