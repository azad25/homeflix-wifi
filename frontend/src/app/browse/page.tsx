"use client";

import React, { useState, useEffect, useCallback } from "react";
import { usePageTitle } from '@/hooks/usePageTitle';
import { Film, Search, X, Grid, List } from "lucide-react";
import { useNavigate } from '@/hooks/useNavigate';
import { Media } from "../../types/media";
import VideoPlayer from "../../components/VideoPlayer";
import Navbar from "../../components/Navbar";
import RedLoader from "../../components/RedLoader";
import { getApiUrl, fetchUniqueRecommendations, preloadAssets, smartSearch, fetchMediaByGenre } from "../../lib/api";
import NetflixMediaCard from "../../components/NetflixMediaCard";
import {
  MagneticButton,
  FloatingElement
} from '@/components/scrollx';
import HomeflixHero from "@/components/HomeflixHero";
import { BackendWidgetRenderer } from '@/components/widgets';

interface Genre {
  id: number;
  name: string;
  description: string;
}

export default function BrowsePage() {
  usePageTitle('Browse Collection');
  const navigate = useNavigate();
  const [allMedia, setAllMedia] = useState<Media[]>([]);
  const [filteredMedia, setFilteredMedia] = useState<Media[]>([]);
  const [displayedMedia, setDisplayedMedia] = useState<Media[]>([]);
  const [featuredMedia, setFeaturedMedia] = useState<Media[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("recent");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [viewMode, setViewMode] = useState<string>("grid");
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const ITEMS_PER_PAGE = 24;

  const fetchFeaturedMedia = useCallback(async (mediaData: Media[]) => {
    try {
      console.log('🎬 Fetching unique featured media with session awareness...');

      // Use enhanced unique recommendations
      let featured: Media[] = [];

      try {
        featured = await fetchUniqueRecommendations('mixed', 20);
        console.log(`✅ Got ${featured.length} unique recommendations`);
      } catch {
        console.warn('❌ Unique recommendations failed, using fallback');

        // Fallback to regular API
        const apiUrl = getApiUrl();
        try {
          const response = await fetch(`${apiUrl}/api/movies?limit=20`);
          if (response.ok) {
            featured = await response.json();
          }
        } catch (fallbackError) {
          console.warn('❌ Fallback API also failed, using provided media data');
          featured = mediaData.slice(0, 20);
        }
      }

      // Filter for movies with HD/4K quality only for hero section
      if (featured.length > 0) {
        const hdMovies = featured.filter((item: Media) => {
          const isMovie = item.type === 'movie';
          const hasHDQuality = item.quality && (
            item.quality.toLowerCase().includes('hd') ||
            item.quality.toLowerCase().includes('4k') ||
            item.quality.toLowerCase().includes('1080p') ||
            item.quality.toLowerCase().includes('2160p')
          );
          return isMovie && hasHDQuality;
        });

        // If we have HD movies, use them; otherwise fall back to all movies
        if (hdMovies.length >= 5) {
          featured = hdMovies.slice(0, 8);
          console.log(`✅ Using ${featured.length} HD/4K movies for hero section`);
        } else {
          // Fall back to all movies if not enough HD content
          const allMovies = featured.filter((item: Media) => item.type === 'movie');
          featured = allMovies.slice(0, 8);
          console.log(`⚠️ Not enough HD content, using ${featured.length} movies for hero section`);
        }
      }

      // If still no movies, use highest rated movies from provided data
      if (featured.length === 0 && mediaData.length > 0) {
        const movies = mediaData.filter((item: Media) => item.type === 'movie');
        featured = movies
          .sort((a, b) => (b.rating || 0) - (a.rating || 0))
          .slice(0, 8);
        console.log(`✅ Using ${featured.length} highest rated movies from provided data`);
      }

      setFeaturedMedia(featured);

      // Preload assets for hero section (poster first, then thumbnail, then preview)
      if (featured.length > 0) {
        preloadAssets(featured, ['poster', 'thumbnail', 'preview']);
      }
    } catch (error) {
      console.error("Error fetching featured media:", error);
      // Fallback to highest rated from provided data
      if (mediaData.length > 0) {
        const featured = [...mediaData]
          .sort((a, b) => (b.rating || 0) - (a.rating || 0))
          .slice(0, 8);
        setFeaturedMedia(featured);
      }
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const apiUrl = getApiUrl();

      // Fetch movies only and genres with error handling
      const [moviesResponse, genresResponse] = await Promise.all([
        fetch(`${apiUrl}/api/media/movies`).catch(() => null),
        fetch(`${apiUrl}/api/genres`).catch(() => null)
      ]);

      let mediaData: Media[] = [];
      let genresData: Genre[] = [];

      if (moviesResponse && moviesResponse.ok) {
        mediaData = await moviesResponse.json();
      } else {
        console.warn('Failed to fetch movies, trying fallback endpoint');
        try {
          const fallbackResponse = await fetch(`${apiUrl}/api/movies`);
          if (fallbackResponse.ok) {
            mediaData = await fallbackResponse.json();
          }
        } catch (fallbackError) {
          console.error('Fallback movies endpoint also failed:', fallbackError);
        }
      }

      if (genresResponse && genresResponse.ok) {
        genresData = await genresResponse.json();
      } else {
        console.warn('Failed to fetch genres, using empty array');
      }

      setAllMedia(mediaData);
      setGenres(genresData);

      // Fetch featured media from recommendations with fallback
      await fetchFeaturedMedia(mediaData);

    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, [fetchFeaturedMedia]);

  const filterAndSortMedia = useCallback(async () => {
    let filtered = [...allMedia];

    // Use backend search if there's a search query
    if (searchQuery.trim()) {
      setSearchLoading(true);
      try {
        console.log(`🔍 Performing backend search for: "${searchQuery}"`);
        const searchResults = await smartSearch(searchQuery);

        // Filter search results to only include items that are in allMedia
        // This ensures we only show movies and TV series, not episodes
        const mediaIds = new Set(allMedia.map(m => m.id));
        filtered = searchResults.filter((media: Media) => mediaIds.has(media.id));

        console.log(`✅ Backend search returned ${searchResults.length} results, filtered to ${filtered.length} main titles`);
      } catch (searchError) {
        console.error("Backend search failed, falling back to client-side search:", searchError);
        // Fallback to client-side search
        filtered = allMedia.filter(media =>
          media.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (media.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (media.genres || []).some(genre =>
            genre.name.toLowerCase().includes(searchQuery.toLowerCase())
          )
        );
      } finally {
        setSearchLoading(false);
      }
    }

    // Filter by genre - use backend API if no search query, otherwise filter client-side
    if (selectedGenre !== "all") {
      if (!searchQuery.trim()) {
        // Use backend genre API for better performance
        try {
          console.log(`🎭 Fetching media for genre: "${selectedGenre}"`);
          const genreResults = await fetchMediaByGenre(selectedGenre, 1, 200); // Get up to 200 items

          // Filter to only include items that are in allMedia (movies and TV series)
          const mediaIds = new Set(allMedia.map(m => m.id));
          filtered = genreResults.filter((media: Media) => mediaIds.has(media.id));

          console.log(`✅ Backend genre API returned ${genreResults.length} results, filtered to ${filtered.length} main titles`);
        } catch (genreError) {
          console.error("Backend genre fetch failed, falling back to client-side filtering:", genreError);
          // Fallback to client-side filtering
          filtered = filtered.filter(media =>
            (media.genres || []).some(genre => genre.name === selectedGenre)
          );
        }
      } else {
        // Client-side filtering when we already have search results
        filtered = filtered.filter(media =>
          (media.genres || []).some(genre => genre.name === selectedGenre)
        );
      }
    }

    // Filter by year
    if (selectedYear !== "all") {
      const year = parseInt(selectedYear);
      filtered = filtered.filter(media => media.year === year);
    }

    // Sort media (only if not using search results, which are already relevance-sorted)
    if (!searchQuery.trim()) {
      switch (sortBy) {
        case "recent":
          filtered.sort((a, b) => b.id - a.id);
          break;
        case "popular":
          filtered.sort((a, b) => (b.view_count || 0) - (a.view_count || 0));
          break;
        case "rating":
          filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
          break;
        case "title":
          filtered.sort((a, b) => a.title.localeCompare(b.title));
          break;
      }
    } else if (sortBy !== "recent") {
      // Apply secondary sorting to search results if needed
      switch (sortBy) {
        case "popular":
          filtered.sort((a, b) => (b.view_count || 0) - (a.view_count || 0));
          break;
        case "rating":
          filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
          break;
        case "title":
          filtered.sort((a, b) => a.title.localeCompare(b.title));
          break;
      }
    }

    setFilteredMedia(filtered);
  }, [allMedia, selectedGenre, sortBy, searchQuery, selectedYear]);

  const loadMoreMedia = useCallback((page: number = currentPage) => {
    const startIndex = (page - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const newItems = filteredMedia.slice(startIndex, endIndex);

    if (page === 1) {
      setDisplayedMedia(newItems);
    } else {
      setDisplayedMedia(prev => [...prev, ...newItems]);
    }

    setHasMore(endIndex < filteredMedia.length);
    setLoadingMore(false);
  }, [filteredMedia, currentPage, ITEMS_PER_PAGE]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    // Debounce search to avoid too many API calls
    const timeoutId = setTimeout(() => {
      filterAndSortMedia();
    }, searchQuery.trim() ? 300 : 0); // 300ms delay for search, immediate for other filters

    return () => clearTimeout(timeoutId);
  }, [allMedia, selectedGenre, sortBy, searchQuery, selectedYear, filterAndSortMedia]);

  useEffect(() => {
    // Reset pagination when filters change
    setCurrentPage(1);

    // Initialize displayed media directly to avoid dependency cycle
    const initialItems = filteredMedia.slice(0, ITEMS_PER_PAGE);
    setDisplayedMedia(initialItems);
    setHasMore(filteredMedia.length > ITEMS_PER_PAGE);

    // Don't call loadMoreMedia here to avoid dependency cycle
  }, [filteredMedia, ITEMS_PER_PAGE]);

  const handlePlay = (media: Media) => {
    setSelectedMedia(media);
    setIsPlayerOpen(true);
  };

  const handleInfo = (media: Media) => {
    // Browse page only shows movies
    navigate.push(`/movie/${media.id}`);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      setLoadingMore(true);
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      setTimeout(() => loadMoreMedia(nextPage), 100); // Small delay for better UX
    }
  }, [loadingMore, hasMore, currentPage, loadMoreMedia]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <RedLoader size="large" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-900/20 via-black to-black text-white">
      <Navbar onSearch={handleSearch} />

      {/* Hero Section */}
      <HomeflixHero
        onPlay={handlePlay}
        onInfo={handleInfo}
        maxMovies={10}
        contentFilter="movies-hd"
        playCountPerSlide={1}
        sortMode="latest"
      />

      {/* Widget System Integration - Full viewport width */}
      <BackendWidgetRenderer 
        page="browse" 
        className="py-8"
      />

      {/* Main Content with Responsive Layout */}
      <div className="relative bg-gradient-to-b from-red-900/20 via-black to-black min-h-screen">
        <div className="flex flex-col lg:flex-row h-full">
          {/* Mobile Genre Filter - Horizontal scroll on mobile */}
          <div className="lg:hidden px-4 py-4 border-b border-white/10">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              <button
                onClick={() => setSelectedGenre("all")}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm transition-all ${selectedGenre === "all"
                  ? "bg-red-600 text-white"
                  : "bg-black/50 text-gray-300 hover:bg-white/10 hover:text-white"
                  }`}
              >
                All ({allMedia.length})
              </button>
              {genres.map((genre) => {
                const genreCount = allMedia.filter(media =>
                  media.genres?.some(g => g.name === genre.name)
                ).length;

                return (
                  <button
                    key={genre.id}
                    onClick={() => setSelectedGenre(genre.name)}
                    className={`flex-shrink-0 px-4 py-2 rounded-full text-sm transition-all ${selectedGenre === genre.name
                      ? "bg-red-600 text-white"
                      : "bg-black/50 text-gray-300 hover:bg-white/10 hover:text-white"
                      }`}
                  >
                    {genre.name} ({genreCount})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Desktop Genre Sidebar - Hidden on mobile */}
          <div className="hidden lg:block w-80 flex-shrink-0 border-r border-white/10">
            <div className="sticky top-20 px-4 py-6">
              <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-white/20 p-6">
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-white">Genres</h3>
                </div>

                {/* All Genres Option */}
                <button
                  onClick={() => setSelectedGenre("all")}
                  className={`w-full text-left px-4 py-2 rounded-lg mb-2 transition-all text-sm ${selectedGenre === "all"
                    ? "bg-red-600 text-white"
                    : "text-gray-300 hover:bg-white/10 hover:text-white"
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <span>All Genres</span>
                    <span className="text-xs opacity-70">{allMedia.length}</span>
                  </div>
                </button>

                {/* Genre List - All items visible without scrollbar */}
                <div className="space-y-1">
                  {genres.map((genre) => {
                    const genreCount = allMedia.filter(media =>
                      media.genres?.some(g => g.name === genre.name)
                    ).length;

                    return (
                      <button
                        key={genre.id}
                        onClick={() => setSelectedGenre(genre.name)}
                        className={`w-full text-left px-4 py-2 rounded-lg transition-all text-sm ${selectedGenre === genre.name
                          ? "bg-red-600 text-white"
                          : "text-gray-300 hover:bg-white/10 hover:text-white"
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>{genre.name}</span>
                          <span className="text-xs opacity-70">{genreCount}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 px-4 lg:px-6 py-4 lg:py-6 overflow-hidden">
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
                Browse Collection
              </h1>
              <p className="text-gray-300">
                Discover your next favorite from {allMedia.length} titles
              </p>
            </div>

            {/* Search Bar */}
            <div className="mb-4 lg:mb-6">
              <div className="relative">
                {searchLoading ? (
                  <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                    <RedLoader size="small" />
                  </div>
                ) : (
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                )}
                <input
                  type="text"
                  placeholder="Search your collection..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-black/50 backdrop-blur-md text-white pl-12 pr-10 py-3 rounded-xl border border-white/20 focus:border-red-500 focus:outline-none placeholder-gray-400 transition-all text-sm lg:text-base"
                />
                {searchQuery && !searchLoading && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            {/* Controls */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 mb-4">
              {/* Sort Filter */}
              <div className="relative w-full sm:w-auto">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full sm:w-auto bg-black/50 backdrop-blur-md border border-white/20 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
                >
                  <option value="recent">Recently Added</option>
                  <option value="popular">Most Popular</option>
                  <option value="rating">Highest Rated</option>
                  <option value="title">A-Z</option>
                </select>
              </div>

              {/* Year Filter */}
              <div className="relative w-full sm:w-auto">
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full sm:w-auto bg-black/50 backdrop-blur-md border border-white/20 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
                >
                  <option value="all">All Years</option>
                  {Array.from({ length: 10 }, (_, i) => 2025 - i).map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>

              {/* View Mode Toggle */}
              <div className="flex bg-black/50 backdrop-blur-md border border-white/20 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`px-3 py-2 transition-all ${viewMode === "grid" ? "bg-red-600 text-white" : "text-gray-400 hover:text-white"
                    }`}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`px-3 py-2 transition-all ${viewMode === "list" ? "bg-red-600 text-white" : "text-gray-400 hover:text-white"
                    }`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Results Count and Active Filters */}
            <div className="flex flex-wrap items-center gap-4 mb-4">
              <p className="text-gray-400 text-sm">
                Showing {filteredMedia.length} {filteredMedia.length === 1 ? 'title' : 'titles'}
                {selectedGenre !== "all" && ` in ${selectedGenre}`}
                {selectedYear !== "all" && ` from ${selectedYear}`}
                {searchQuery && <> matching &quot;{searchQuery}&quot;</>}
              </p>

              {/* Active Filters */}
              {(selectedGenre !== "all" || selectedYear !== "all" || searchQuery) && (
                <div className="flex items-center gap-2">
                  {selectedGenre !== "all" && (
                    <span className="bg-red-600/20 text-red-400 px-2 py-1 rounded-full text-xs flex items-center gap-1">
                      {selectedGenre}
                      <button
                        onClick={() => setSelectedGenre("all")}
                        className="hover:text-red-300 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {selectedYear !== "all" && (
                    <span className="bg-green-600/20 text-green-400 px-2 py-1 rounded-full text-xs flex items-center gap-1">
                      {selectedYear}
                      <button
                        onClick={() => setSelectedYear("all")}
                        className="hover:text-green-300 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {searchQuery && (
                    <span className="bg-blue-600/20 text-blue-400 px-2 py-1 rounded-full text-xs flex items-center gap-1">
                      &quot;{searchQuery}&quot;
                      <button
                        onClick={() => setSearchQuery("")}
                        className="hover:text-blue-300 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Recently Watched
            <div className="mb-6">
              <RecentlyWatched
                onPlay={handlePlay}
                onInfo={handleInfo}
              />
            </div> */}

            {/* Content Grid - Responsive grid */}
            <div className="pb-20">
              <div>
                {filteredMedia.length > 0 ? (
                  <div className={viewMode === "grid"
                    ? "grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12 gap-1.5 sm:gap-2"
                    : "space-y-3"
                  }>
                    {displayedMedia.map((media, index) => (
                      <div key={media.id} className="group">
                        <div>
                          <NetflixMediaCard
                            media={media}
                            onPlay={handlePlay}
                            onInfo={handleInfo}
                            priority={index < 15 ? 'high' : 'normal'}
                            showPreviewOnHover={false}
                            disableHover={true}
                          />
                        </div>
                      </div>
                    ))}

                    {/* Load More Button */}
                    {hasMore && (
                      <div className={viewMode === "grid" ? "col-span-full flex justify-center mt-4 lg:mt-6" : "flex justify-center mt-4 lg:mt-6"}>
                        <MagneticButton
                          onClick={handleLoadMore}
                          disabled={loadingMore}
                          className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white px-4 lg:px-6 py-2 rounded-lg font-semibold transition-colors text-sm"
                        >
                          {loadingMore ? <RedLoader size="small" /> : 'Load More'}
                        </MagneticButton>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FloatingElement>
                      <Film className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    </FloatingElement>
                    <h3 className="text-xl text-white mb-3">No content found</h3>
                    <p className="text-gray-400 mb-6 text-sm">
                      {searchQuery
                        ? `No results for "${searchQuery}". Try a different search term.`
                        : "Try adjusting your filters to see more content."
                      }
                    </p>
                    <MagneticButton
                      onClick={() => {
                        setSearchQuery("");
                        setSelectedGenre("all");
                        setSelectedYear("all");
                      }}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold text-sm"
                    >
                      Clear Filters
                    </MagneticButton>
                  </div>
                )}
              </div>
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