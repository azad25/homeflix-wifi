"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Filter, Film } from "lucide-react";
import { useRouter } from 'next/navigation';
import { Media } from "../../types/media";
import VideoPlayer from "../../components/VideoPlayer";
import Navbar from "../../components/Navbar";
import RecentlyWatched from "../../components/RecentlyWatched";
import LazyMediaGrid from "../../components/LazyMediaGrid";
import { getApiUrl, fetchUniqueRecommendations, preloadAssets } from "../../lib/api";
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
  const router = useRouter();
  const [allMedia, setAllMedia] = useState<Media[]>([]);
  const [filteredMedia, setFilteredMedia] = useState<Media[]>([]);
  const [displayedMedia, setDisplayedMedia] = useState<Media[]>([]);
  const [featuredMedia, setFeaturedMedia] = useState<Media[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("recent");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const ITEMS_PER_PAGE = 24;

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    filterAndSortMedia();
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
      
      // Fetch all media and genres
      const [mediaResponse, genresResponse] = await Promise.all([
        fetch(`${apiUrl}/api/media`),
        fetch(`${apiUrl}/api/genres`)
      ]);
      const mediaData = await mediaResponse.json();
      const genresData = await genresResponse.json();
      
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

  const filterAndSortMedia = () => {
    let filtered = [...allMedia];

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(media => 
        media.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (media.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (media.genres || []).some(genre => 
          genre.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    }

    // Filter by genre
    if (selectedGenre !== "all") {
      filtered = filtered.filter(media => 
        (media.genres || []).some(genre => genre.name === selectedGenre)
      );
    }

    // Sort media
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

    setFilteredMedia(filtered);
  };

  const handlePlay = (media: Media) => {
    setSelectedMedia(media);
    setIsPlayerOpen(true);
  };

  const handleInfo = (media: Media) => {
    router.push(`/movie/${media.id}`);
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
        <div className="text-white text-xl">Loading Browse...</div>
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

      {/* Main Content with Parallax Background */}
      <div className="relative bg-gradient-to-b from-red-900/20 via-black to-black">
        <div className="relative z-10 py-20">
          {/* Search and Filter Controls */}
          <ParallaxSection speed={0.2}>
            <ScrollReveal direction="up" delay={0.1}>
              <div className="px-4 md:px-8 lg:px-16 mb-12">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div>
                    <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 tracking-wider">
                      B R O W S E   C O L L E C T I O N
                    </h1>
                    <p className="text-gray-300 text-lg">
                      Discover your next favorite from {allMedia.length} titles
                    </p>
                  </div>
                  
                  {/* Filter Controls */}
                  <div className="flex flex-wrap gap-4">
                    {/* Genre Filter */}
                    <div className="relative">
                      <select
                        value={selectedGenre}
                        onChange={(e) => setSelectedGenre(e.target.value)}
                        className="bg-black/50 backdrop-blur-md border border-white/20 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        <option value="all">All Genres</option>
                        {genres.map(genre => (
                          <option key={genre.id} value={genre.name}>
                            {genre.name}
                          </option>
                        ))}
                      </select>
                    </div>

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
                  </div>
                </div>

                {/* Results Count */}
                <div className="mt-6">
                  <p className="text-gray-400">
                    Showing {filteredMedia.length} {filteredMedia.length === 1 ? 'title' : 'titles'}
                    {selectedGenre !== "all" && ` in ${selectedGenre}`}
                    {searchQuery && ` matching "${searchQuery}"`}
                  </p>
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
              <div className="px-4 md:px-8 lg:px-16">
                {filteredMedia.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
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
                      <div className="col-span-full flex justify-center mt-8">
                        <button
                          onClick={handleLoadMore}
                          disabled={loadingMore}
                          className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
                        >
                          {loadingMore ? 'Loading...' : 'Load More'}
                        </button>
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
