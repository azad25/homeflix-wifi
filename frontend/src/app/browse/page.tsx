"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Filter, Film, Search, X, Grid, List } from "lucide-react";
import { useNavigate } from '@/hooks/useNavigate';
import { Media } from "../../types/media";
import VideoPlayer from "../../components/VideoPlayer";
import Navbar from "../../components/Navbar";
import RecentlyWatched from "../../components/RecentlyWatched";
import LazyMediaGrid from "../../components/LazyMediaGrid";
import RedLoader from "../../components/RedLoader";
import { getApiUrl, fetchUniqueRecommendations, preloadAssets, smartSearch, fetchMediaByGenre } from "../../lib/api";
import NetflixMediaCard from "../../components/NetflixMediaCard";
import { 
  NetflixHorizontalRow, 
  ScrollXHero, 
  ParallaxSection, 
  GradientBackground, 
  ScrollReveal, 
  MagneticButton,
  FloatingElement
} from '@/components/scrollx';

interface Genre {
  id: number;
  name: string;
  description: string;
}

export default function BrowsePage() {
  const navigate = useNavigate();
  const [allMedia, setAllMedia] = useState<Media[]>([]);
  const [filteredMedia, setFilteredMedia] = useState<Media[]>([]);
  const [displayedMedia, setDisplayedMedia] = useState<Media[]>([]);
  const [featuredMedia, setFeaturedMedia] = useState<Media[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("recent");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showGenreSidebar, setShowGenreSidebar] = useState<boolean>(false); // Start closed on mobile
  const [viewMode, setViewMode] = useState<string>("grid");
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const ITEMS_PER_PAGE = 24;

  useEffect(() => {
    fetchData();
    
    // Open sidebar on desktop by default
    const checkScreenSize = () => {
      setShowGenreSidebar(window.innerWidth >= 1024); // lg breakpoint
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  useEffect(() => {
    // Debounce search to avoid too many API calls
    const timeoutId = setTimeout(() => {
      filterAndSortMedia();
    }, searchQuery.trim() ? 300 : 0); // 300ms delay for search, immediate for other filters
    
    return () => clearTimeout(timeoutId);
  }, [allMedia, selectedGenre, sortBy, searchQuery]);

  useEffect(() => {
    // Reset pagination when filters change
    setCurrentPage(1);
    setDisplayedMedia([]);
    setHasMore(true);
    loadMoreMedia(1);
  }, [filteredMedia]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const apiUrl = getApiUrl();
      
      // Fetch movies, TV series (not episodes), and genres
      const [moviesResponse, tvSeriesResponse, genresResponse] = await Promise.all([
        fetch(`${apiUrl}/api/media/movies`),
        fetch(`${apiUrl}/api/media/tv-shows`),
        fetch(`${apiUrl}/api/genres`)
      ]);
      
      const moviesData = await moviesResponse.json();
      const tvSeriesData = await tvSeriesResponse.json();
      const genresData = await genresResponse.json();
      
      // Combine movies and TV series (main titles only, no episodes)
      const mediaData = [...moviesData, ...tvSeriesData];
      
      setAllMedia(mediaData);
      setGenres(genresData);
      
      // Fetch featured media from recommendations with fallback
      await fetchFeaturedMedia();
      
      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      setLoading(false);
    }
  };

  const fetchFeaturedMedia = async () => {
    try {
      console.log('🎬 Fetching unique featured media with session awareness...');
      
      // Use enhanced unique recommendations
      let featured: Media[] = [];
      
      try {
        featured = await fetchUniqueRecommendations('mixed', 20);
        console.log(`✅ Got ${featured.length} unique recommendations`);
      } catch (error) {
        console.warn('❌ Unique recommendations failed, using fallback');
        
        // Fallback to regular API
        const apiUrl = getApiUrl();
        const response = await fetch(`${apiUrl}/api/movies?limit=20`);
        if (response.ok) {
          featured = await response.json();
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

      // If still no movies, use highest rated movies from allMedia
      if (featured.length === 0 && allMedia.length > 0) {
        const movies = allMedia.filter((item: Media) => item.type === 'movie');
        featured = movies
          .sort((a, b) => (b.rating || 0) - (a.rating || 0))
          .slice(0, 8);
        console.log(`✅ Using ${featured.length} highest rated movies from allMedia`);
      }

      setFeaturedMedia(featured);
      
      // Preload assets for hero section
      if (featured.length > 0) {
        preloadAssets(featured, ['thumbnail', 'preview']);
      }
    } catch (error) {
      console.error("Error fetching featured media:", error);
      // Fallback to highest rated from allMedia
      if (allMedia.length > 0) {
        const featured = [...allMedia]
          .sort((a, b) => (b.rating || 0) - (a.rating || 0))
          .slice(0, 8);
        setFeaturedMedia(featured);
      }
    }
  };

  const filterAndSortMedia = async () => {
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
      } catch (error) {
        console.error("Backend search failed, falling back to client-side search:", error);
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
        } catch (error) {
          console.error("Backend genre fetch failed, falling back to client-side filtering:", error);
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
  };

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
      {featuredMedia.length > 0 && (
        <ScrollXHero
          featuredMedia={featuredMedia}
          onPlay={handlePlay}
          onInfo={handleInfo}
          contentFilter="movies-hd"
        />
      )}

      {/* Search Bar Section */}
      <ParallaxSection speed={0.1}>
        <div className="relative z-10 py-8 px-4 md:px-8 lg:px-16">
          <ScrollReveal direction="up" delay={0.1}>
            <div className="max-w-4xl mx-auto">
              <div className="relative">
                {searchLoading ? (
                  <div className="absolute left-6 top-1/2 transform -translate-y-1/2">
                    <RedLoader size="small" />
                  </div>
                ) : (
                  <Search className="absolute left-6 top-1/2 transform -translate-y-1/2 text-gray-400 w-6 h-6" />
                )}
                <input
                  type="text"
                  placeholder="Search your collection..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-black/50 backdrop-blur-md text-white pl-16 pr-12 py-4 rounded-2xl border border-white/20 focus:border-red-500 focus:outline-none text-lg placeholder-gray-400 transition-all"
                />
                {searchQuery && !searchLoading && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          </ScrollReveal>
        </div>
      </ParallaxSection>

      {/* Main Content with Parallax Background */}
      <div className="relative bg-gradient-to-b from-red-900/20 via-black to-black">
        <div className="relative z-10 py-8">
          {/* Content Layout with Sidebar */}
          <div className="flex">
            {/* Genre Sidebar */}
            <div className={`transition-all duration-300 ${showGenreSidebar ? 'w-80 lg:w-80' : 'w-0'} overflow-hidden ${showGenreSidebar ? 'fixed lg:relative' : ''} ${showGenreSidebar ? 'inset-0 lg:inset-auto' : ''} ${showGenreSidebar ? 'z-50 lg:z-auto' : ''} ${showGenreSidebar ? 'bg-black/80 lg:bg-transparent' : ''}`}>
              <div className="sticky top-20 h-screen overflow-y-auto px-4 py-6 lg:px-4">
                <ScrollReveal direction="left" delay={0.1}>
                  <div className="bg-black/30 backdrop-blur-md rounded-2xl border border-white/10 p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-bold text-white">Genres</h3>
                      <button
                        onClick={() => setShowGenreSidebar(false)}
                        className="text-gray-400 hover:text-white transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    
                    {/* All Genres Option */}
                    <button
                      onClick={() => setSelectedGenre("all")}
                      className={`w-full text-left px-4 py-3 rounded-lg mb-2 transition-all ${
                        selectedGenre === "all"
                          ? "bg-red-600 text-white"
                          : "text-gray-300 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>All Genres</span>
                        <span className="text-sm opacity-70">{allMedia.length}</span>
                      </div>
                    </button>
                    
                    {/* Genre List */}
                    <div className="space-y-1 max-h-96 overflow-y-auto">
                      {genres.map((genre) => {
                        const genreCount = allMedia.filter(media => 
                          media.genres?.some(g => g.name === genre.name)
                        ).length;
                        
                        return (
                          <button
                            key={genre.id}
                            onClick={() => setSelectedGenre(genre.name)}
                            className={`w-full text-left px-4 py-3 rounded-lg transition-all ${
                              selectedGenre === genre.name
                                ? "bg-red-600 text-white"
                                : "text-gray-300 hover:bg-white/10 hover:text-white"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span>{genre.name}</span>
                              <span className="text-sm opacity-70">{genreCount}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </ScrollReveal>
              </div>
            </div>
            
            {/* Main Content Area */}
            <div className="flex-1 px-4 md:px-8 lg:px-16 w-full lg:w-auto">
              {/* Header and Controls */}
              <ParallaxSection speed={0.2}>
                <ScrollReveal direction="up" delay={0.1}>
                  <div className="mb-8">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                      <div>
                        <h1 className="text-3xl md:text-5xl font-bold text-white mb-4 tracking-wider">
                          B R O W S E   C O L L E C T I O N
                        </h1>
                        <p className="text-gray-300 text-lg">
                          Discover your next favorite from {allMedia.length} titles
                        </p>
                      </div>
                      
                      {/* View Controls */}
                      <div className="flex items-center gap-4">
                        {/* Genre Sidebar Toggle */}
                        {!showGenreSidebar && (
                          <MagneticButton
                            onClick={() => setShowGenreSidebar(true)}
                            className="bg-black/50 backdrop-blur-md border border-white/20 text-white px-4 py-2 rounded-lg hover:bg-white/10 transition-all"
                          >
                            <Filter className="w-4 h-4 mr-2" />
                            {selectedGenre === "all" ? "Genres" : selectedGenre}
                          </MagneticButton>
                        )}
                        
                        {/* Sort Filter */}
                        <div className="relative">
                          <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="bg-black/50 backdrop-blur-md border border-white/20 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                          >
                            <option value="recent">Recently Added</option>
                            <option value="popular">Most Popular</option>
                            <option value="rating">Highest Rated</option>
                            <option value="title">A-Z</option>
                          </select>
                        </div>
                        
                        {/* View Mode Toggle */}
                        <div className="flex bg-black/50 backdrop-blur-md border border-white/20 rounded-lg overflow-hidden">
                          <button
                            onClick={() => setViewMode("grid")}
                            className={`px-3 py-2 transition-all ${
                              viewMode === "grid" ? "bg-red-600 text-white" : "text-gray-400 hover:text-white"
                            }`}
                          >
                            <Grid className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setViewMode("list")}
                            className={`px-3 py-2 transition-all ${
                              viewMode === "list" ? "bg-red-600 text-white" : "text-gray-400 hover:text-white"
                            }`}
                          >
                            <List className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Results Count and Active Filters */}
                    <div className="mt-6 flex flex-wrap items-center gap-4">
                      <p className="text-gray-400">
                        Showing {filteredMedia.length} {filteredMedia.length === 1 ? 'title' : 'titles'}
                        {selectedGenre !== "all" && ` in ${selectedGenre}`}
                        {searchQuery && <> matching &quot;{searchQuery}&quot;</>}
                      </p>
                      
                      {/* Active Filters */}
                      {(selectedGenre !== "all" || searchQuery) && (
                        <div className="flex items-center gap-2">
                          {selectedGenre !== "all" && (
                            <span className="bg-red-600/20 text-red-400 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                              {selectedGenre}
                              <button
                                onClick={() => setSelectedGenre("all")}
                                className="hover:text-red-300 transition-colors"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          )}
                          {searchQuery && (
                            <span className="bg-blue-600/20 text-blue-400 px-3 py-1 rounded-full text-sm flex items-center gap-2">
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
                  </div>
                </ScrollReveal>
              </ParallaxSection>

              {/* Recently Watched */}
              <ParallaxSection speed={0.3}>
                <ScrollReveal direction="up" delay={0.2}>
                  <RecentlyWatched
                    onPlay={handlePlay}
                    onInfo={handleInfo}
                  />
                </ScrollReveal>
              </ParallaxSection>

              {/* Content Grid with Lazy Loading */}
              <ParallaxSection speed={0.4}>
                <ScrollReveal direction="up" delay={0.3}>
                  <div>
                    {filteredMedia.length > 0 ? (
                      <div className={viewMode === "grid" 
                        ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
                        : "space-y-4"
                      }>
                        {displayedMedia.map((media, index) => (
                          <NetflixMediaCard
                            key={media.id}
                            media={media}
                            onPlay={handlePlay}
                            onInfo={handleInfo}
                            priority={index < 12 ? 'high' : 'normal'}
                            showPreviewOnHover={true}
                          />
                        ))}
                        
                        {/* Load More Button */}
                        {hasMore && (
                          <div className={viewMode === "grid" ? "col-span-full flex justify-center mt-8" : "flex justify-center mt-8"}>
                            <MagneticButton
                              onClick={handleLoadMore}
                              disabled={loadingMore}
                              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
                            >
                              {loadingMore ? <RedLoader size="small" /> : 'Load More'}
                            </MagneticButton>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-16">
                        <FloatingElement>
                          <Film className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                        </FloatingElement>
                        <h3 className="text-2xl text-white mb-4">No content found</h3>
                        <p className="text-gray-400 mb-8">
                          {searchQuery 
                            ? `No results for "${searchQuery}". Try a different search term.`
                            : "Try adjusting your filters to see more content."
                          }
                        </p>
                        <MagneticButton
                          onClick={() => {
                            setSearchQuery("");
                            setSelectedGenre("all");
                          }}
                          className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold"
                        >
                          Clear Filters
                        </MagneticButton>
                      </div>
                    )}
                  </div>
                </ScrollReveal>
              </ParallaxSection>
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
        />
      )}
    </div>
  );
}
