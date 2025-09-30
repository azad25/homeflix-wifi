"use client";

import React, { useState, useEffect } from "react";
import { Search, Filter, Calendar, Play, Info, Plus, X, Film, Tv, Star, Clock } from "lucide-react";
import { Media } from "../../types/media";
import VideoPlayer from "../../components/VideoPlayer";
import Navbar from "../../components/Navbar";
import { getApiUrl } from "../../lib/api";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface SearchFilters {
  type: string;
  genre: string;
  rating: string;
  year: string;
  sortBy: string;
}

export default function SearchPage() {
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
    }
  }, []);

  useEffect(() => {
    if (searchQuery.trim() || hasSearched) {
      performSearch();
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
      const apiUrl = getApiUrl();
      
      // Build search URL with filters
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.append('q', searchQuery);
      if (filters.type !== 'all') params.append('type', filters.type);
      if (filters.genre !== 'all') params.append('genre', filters.genre);
      if (filters.rating !== 'all') params.append('min_rating', filters.rating);
      if (filters.year !== 'all') params.append('year', filters.year);
      if (filters.sortBy !== 'relevance') params.append('sort', filters.sortBy);
      
      const response = await fetch(`${apiUrl}/api/search/advanced?${params.toString()}`);
      const results = await response.json();
      
      setSearchResults(results);
      setHasSearched(true);
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
    console.log("Show info for:", media.title);
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
    <div className="min-h-screen bg-black">
      <Navbar />
      
      <div className="pt-20 px-4 md:px-8 lg:px-16">
        {/* Search Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-6 flex items-center gap-3">
            <Search className="w-10 h-10" />
            Search
          </h1>
          
          {/* Search Bar */}
          <div className="relative max-w-2xl">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search for movies, TV shows..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-800 text-white pl-12 pr-4 py-4 rounded-lg border border-gray-700 focus:border-red-500 focus:outline-none text-lg"
            />
          </div>
        </div>

        {/* Filters Section */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <Button
              onClick={() => setShowFilters(!showFilters)}
              variant="outline"
              className="border-gray-600 text-white hover:bg-gray-800"
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
              {activeFiltersCount > 0 && (
                <span className="ml-2 bg-red-600 text-white rounded-full px-2 py-1 text-xs">
                  {activeFiltersCount}
                </span>
              )}
            </Button>
            
            {activeFiltersCount > 0 && (
              <Button
                onClick={clearFilters}
                variant="ghost"
                className="text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4 mr-2" />
                Clear Filters
              </Button>
            )}
          </div>

          {/* Filter Controls */}
          {showFilters && (
            <div className="bg-gray-900 p-6 rounded-lg border border-gray-700">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Type Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Type</label>
                  <Select value={filters.type} onValueChange={(value) => setFilters(prev => ({ ...prev, type: value }))}>
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      <SelectItem value="all" className="text-white hover:bg-gray-700">All Types</SelectItem>
                      <SelectItem value="movie" className="text-white hover:bg-gray-700">Movies</SelectItem>
                      <SelectItem value="episode" className="text-white hover:bg-gray-700">TV Shows</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Genre Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Genre</label>
                  <Select value={filters.genre} onValueChange={(value) => setFilters(prev => ({ ...prev, genre: value }))}>
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      <SelectItem value="all" className="text-white hover:bg-gray-700">All Genres</SelectItem>
                      {allGenres.map(genre => (
                        <SelectItem key={genre} value={genre} className="text-white hover:bg-gray-700">
                          {genre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Rating Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Min Rating</label>
                  <Select value={filters.rating} onValueChange={(value) => setFilters(prev => ({ ...prev, rating: value }))}>
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      <SelectItem value="all" className="text-white hover:bg-gray-700">Any Rating</SelectItem>
                      <SelectItem value="7" className="text-white hover:bg-gray-700">7+ Stars</SelectItem>
                      <SelectItem value="8" className="text-white hover:bg-gray-700">8+ Stars</SelectItem>
                      <SelectItem value="9" className="text-white hover:bg-gray-700">9+ Stars</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Year Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Year</label>
                  <Select value={filters.year} onValueChange={(value) => setFilters(prev => ({ ...prev, year: value }))}>
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      <SelectItem value="all" className="text-white hover:bg-gray-700">Any Year</SelectItem>
                      <SelectItem value="2024" className="text-white hover:bg-gray-700">2024</SelectItem>
                      <SelectItem value="2023" className="text-white hover:bg-gray-700">2023</SelectItem>
                      <SelectItem value="2022" className="text-white hover:bg-gray-700">2022</SelectItem>
                      <SelectItem value="2021" className="text-white hover:bg-gray-700">2021</SelectItem>
                      <SelectItem value="2020" className="text-white hover:bg-gray-700">2020</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Sort Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Sort By</label>
                  <Select value={filters.sortBy} onValueChange={(value) => setFilters(prev => ({ ...prev, sortBy: value }))}>
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      <SelectItem value="relevance" className="text-white hover:bg-gray-700">Relevance</SelectItem>
                      <SelectItem value="title" className="text-white hover:bg-gray-700">Title A-Z</SelectItem>
                      <SelectItem value="rating" className="text-white hover:bg-gray-700">Highest Rated</SelectItem>
                      <SelectItem value="year" className="text-white hover:bg-gray-700">Newest First</SelectItem>
                      <SelectItem value="popular" className="text-white hover:bg-gray-700">Most Popular</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Results Section */}
        {loading ? (
          <div className="text-center py-16">
            <div className="text-white text-xl">Searching...</div>
          </div>
        ) : hasSearched ? (
          <div>
            {/* Results Header */}
            <div className="mb-6">
              <p className="text-gray-400">
                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} 
                {searchQuery && ` for "${searchQuery}"`}
              </p>
            </div>

            {/* Results Grid */}
            {searchResults.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
                {searchResults.map((media) => (
                  <div
                    key={media.id}
                    className="group relative bg-gray-900 rounded-lg overflow-hidden hover:scale-105 transition-all duration-300"
                  >
                    {/* Thumbnail */}
                    <div className="aspect-[2/3] bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center relative">
                      <img
                        src={`${getApiUrl()}/api/thumbnails/${media.id}`}
                        alt={media.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = '/placeholder-thumbnail.jpg';
                        }}
                      />
                      <div className={`flex items-center justify-center w-full h-full ${media.thumbnail_path ? 'hidden' : ''}`}>
                        {media.type === "movie" ? (
                          <Film className="w-12 h-12 text-gray-600" />
                        ) : (
                          <Tv className="w-12 h-12 text-gray-600" />
                        )}
                      </div>
                      
                      {/* Type Badge */}
                      <div className="absolute top-2 left-2">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          media.type === "movie" ? "bg-red-600" : "bg-blue-600"
                        } text-white`}>
                          {media.type === "movie" ? "MOVIE" : "TV"}
                        </span>
                      </div>
                      
                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handlePlay(media)}
                            size="sm"
                            className="bg-white text-black hover:bg-gray-200"
                          >
                            <span className="w-4 h-4 mr-1">▶</span>
                            Play
                          </Button>
                        </div>
                      </div>
                    </div>
                    
                    {/* Content Info */}
                    <div className="p-4">
                      <h3 className="text-white font-semibold text-sm mb-2 line-clamp-2 leading-tight">
                        {media.title}
                      </h3>
                      
                      <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                        <span>{media.type === "movie" ? "Movie" : "TV Show"}</span>
                        {(media.rating || 0) > 0 && (
                          <span className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-yellow-400 fill-current" />
                            {(media.rating || 0).toFixed(1)}
                          </span>
                        )}
                      </div>

                      {(media.duration || 0) > 0 && (
                        <div className="flex items-center text-xs text-gray-400 mb-2">
                          <Clock className="w-3 h-3 mr-1" />
                          {formatDuration(media.duration || 0)}
                        </div>
                      )}
                      
                      {/* Genres */}
                      <div className="flex flex-wrap gap-1">
                        {(media.genres || []).slice(0, 2).map((genre, index) => (
                          <span
                            key={index}
                            className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded"
                          >
                            {genre.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <Search className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl text-white mb-2">No results found</h3>
                <p className="text-gray-400 mb-6">
                  Try adjusting your search terms or filters
                </p>
                <Button
                  onClick={clearFilters}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Clear Filters
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-16">
            <Search className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl text-white mb-2">Search your library</h3>
            <p className="text-gray-400">
              Enter a search term above to find movies and TV shows
            </p>
          </div>
        )}
      </div>

      {/* Video Player Modal */}
      {selectedMedia && (
        <VideoPlayer
          media={selectedMedia}
          isOpen={isPlayerOpen}
          onClose={() => setIsPlayerOpen(false)}
        />
      )}
    </div>
  );
}
