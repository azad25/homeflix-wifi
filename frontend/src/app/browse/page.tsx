"use client";

import React, { useState, useEffect } from "react";
import { Search, Filter, Film, Grid3X3 } from "lucide-react";
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
import GenreSidebar from '@/components/GenreSidebar';

interface Genre {
  id: number;
  name: string;
  description: string;
}

export default function BrowsePage() {
  const router = useRouter();
  const [allMedia, setAllMedia] = useState<Media[]>([]);
  const [filteredMedia, setFilteredMedia] = useState<Media[]>([]);
  const [randomMedia, setRandomMedia] = useState<Media[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("recent");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    filterAndSortMedia();
  }, [allMedia, randomMedia, selectedGenre, sortBy, searchQuery]);

  const fetchData = async () => {
    try {
      // Fetch all media with retry logic
      const mediaData = await apiCall(API_ENDPOINTS.media);
      
      // Fetch genres with retry logic
      const genresData = await apiCall(API_ENDPOINTS.genres);
      
      setAllMedia(mediaData);
      setGenres(genresData);
      
      // Set random media for initial display
      const shuffled = [...mediaData].sort(() => Math.random() - 0.5);
      setRandomMedia(shuffled);
      
      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      setLoading(false);
      // Set empty arrays to prevent crashes
      setAllMedia([]);
      setGenres([]);
      setRandomMedia([]);
    }
  };

  const filterAndSortMedia = () => {
    let filtered = searchQuery || selectedGenre !== "all" ? [...allMedia] : [...randomMedia];

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
      case "random":
        filtered = filtered.sort(() => Math.random() - 0.5);
        break;
    }

    setFilteredMedia(filtered);
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
  };

  const handleGenreSelect = (genre: string) => {
    setSelectedGenre(genre);
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading Browse...</div>
      </div>
    );
  }

  return (
    <GradientBackground variant="netflix" className="min-h-screen">
      <div className="min-h-screen text-white flex relative z-10">
      {/* Genre Sidebar */}
      <GenreSidebar
        genres={genres}
        selectedGenre={selectedGenre}
        onGenreSelect={handleGenreSelect}
        isOpen={isSidebarOpen}
        onToggle={toggleSidebar}
        className="hidden lg:block"
      />

      {/* Mobile Sidebar */}
      <GenreSidebar
        genres={genres}
        selectedGenre={selectedGenre}
        onGenreSelect={handleGenreSelect}
        isOpen={isSidebarOpen}
        onToggle={toggleSidebar}
        className="lg:hidden"
      />

      {/* Main Content */}
      <div className="flex-1 min-h-screen">
        <Navbar onSearch={handleSearch} />

        {/* Header Section */}
        <div className="pt-20 pb-8">
          <ScrollReveal direction="up" delay={0.1}>
            <div className="px-4 md:px-8 lg:px-16">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
                <div>
                  <h1 className="text-3xl md:text-5xl font-bold text-white mb-4 flex items-center gap-4">
                    <Grid3X3 className="w-8 h-8 md:w-12 md:h-12 text-red-500" />
                    Browse Collection
                  </h1>
                  <p className="text-gray-300 text-lg">
                    Discover from {allMedia.length} titles
                    {selectedGenre !== "all" && ` in ${selectedGenre}`}
                    {searchQuery && ` matching "${searchQuery}"`}
                  </p>
                </div>
                
                {/* Search Bar */}
                <div className="relative w-full lg:w-96">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search movies and shows..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-gray-900/80 backdrop-blur-md text-white pl-12 pr-4 py-3 rounded-xl border border-gray-700 focus:border-red-500 focus:outline-none text-sm"
                  />
                </div>
              </div>

              {/* Sort Controls */}
              <div className="flex flex-wrap gap-4 mb-6">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-gray-900/80 backdrop-blur-md border border-gray-700 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
                >
                  <option value="recent">Recently Added</option>
                  <option value="popular">Most Popular</option>
                  <option value="rating">Highest Rated</option>
                  <option value="title">A-Z</option>
                  <option value="random">Random</option>
                </select>
                
                <div className="text-gray-400 text-sm flex items-center">
                  Showing {filteredMedia.length} {filteredMedia.length === 1 ? 'title' : 'titles'}
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>

        {/* Content Grid */}
        <div className="pb-20">
          <ErrorBoundary
            showRetry={true}
            retryText="Reload Content"
            onError={(error) => console.error('Browse page error:', error)}
          >
            {filteredMedia.length > 0 ? (
              <NetflixPortraitGrid
                media={filteredMedia}
                onPlay={handlePlay}
                onInfo={handleInfo}
                loading={loading}
                itemsPerRow={6}
                showTitle={false}
              />
            ) : (
              <ScrollReveal direction="up" delay={0.2}>
                <div className="text-center py-20 px-4">
                  <FloatingElement>
                    <Film className="w-20 h-20 text-gray-600 mx-auto mb-6" />
                  </FloatingElement>
                  <h3 className="text-3xl text-white mb-4">No content found</h3>
                  <p className="text-gray-400 mb-8 max-w-md mx-auto">
                    {searchQuery 
                      ? `No results for "${searchQuery}". Try a different search term or browse by genre.`
                      : "Try selecting a different genre or adjusting your search."
                    }
                  </p>
                  <MagneticButton
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedGenre("all");
                      setSortBy("random");
                    }}
                    className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-lg font-semibold"
                  >
                    Show All Content
                  </MagneticButton>
                </div>
              </ScrollReveal>
            )}
          </ErrorBoundary>
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
    </GradientBackground>
  );
}
