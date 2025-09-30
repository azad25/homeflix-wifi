"use client";

import React, { useState, useEffect } from "react";
import { Filter, Film } from "lucide-react";
import { useRouter } from 'next/navigation';
import { Media } from "../../types/media";
import VideoPlayer from "../../components/VideoPlayer";
import Navbar from "../../components/Navbar";
import RecentlyWatched from "../../components/RecentlyWatched";
import { getApiUrl } from "../../lib/api";
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
  const [featuredMedia, setFeaturedMedia] = useState<Media[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("recent");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    filterAndSortMedia();
  }, [allMedia, selectedGenre, sortBy, searchQuery]);

  const fetchData = async () => {
    try {
      const apiUrl = getApiUrl();
      
      // Fetch all media
      const mediaResponse = await fetch(`${apiUrl}/api/media`);
      const mediaData = await mediaResponse.json();
      
      // Fetch genres
      const genresResponse = await fetch(`${apiUrl}/api/genres`);
      const genresData = await genresResponse.json();
      
      setAllMedia(mediaData);
      setGenres(genresData);
      
      // Set featured media (top 5 highest rated)
      const featured = [...mediaData]
        .sort((a, b) => (b.rating || 0) - (a.rating || 0))
        .slice(0, 5);
      setFeaturedMedia(featured);
      
      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      setLoading(false);
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

  const groupedByGenre = () => {
    const grouped: { [key: string]: Media[] } = {};
    
    filteredMedia.forEach(media => {
      if (media.genres && media.genres.length > 0) {
        media.genres.forEach(genre => {
          if (!grouped[genre.name]) {
            grouped[genre.name] = [];
          }
          grouped[genre.name].push(media);
        });
      } else {
        if (!grouped["Uncategorized"]) {
          grouped["Uncategorized"] = [];
        }
        grouped["Uncategorized"].push(media);
      }
    });
    
    return grouped;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading Browse...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar onSearch={handleSearch} />

      {/* Hero Section */}
      {featuredMedia.length > 0 && (
        <ScrollXHero
          featuredMedia={featuredMedia}
          onPlay={handlePlay}
          onInfo={handleInfo}
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
                    <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
                      Browse Collection
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

          {/* Content by Genre */}
          <div className="space-y-8">
            {Object.entries(groupedByGenre()).map(([genreName, genreMedia], index) => (
              <ParallaxSection key={genreName} speed={0.4 + index * 0.1}>
                <ScrollReveal direction="up" delay={0.3 + index * 0.1}>
                  <NetflixHorizontalRow
                    title={genreName}
                    media={genreMedia}
                    onPlay={handlePlay}
                    onInfo={handleInfo}
                    variant="portrait"
                    size="medium"
                  />
                </ScrollReveal>
              </ParallaxSection>
            ))}
          </div>

          {/* No Results */}
          {filteredMedia.length === 0 && (
            <ParallaxSection speed={0.5}>
              <ScrollReveal direction="up" delay={0.4}>
                <div className="text-center py-16 px-4">
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
              </ScrollReveal>
            </ParallaxSection>
          )}
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
