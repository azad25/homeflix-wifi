"use client";

import React, { useState, useEffect } from "react";
import { Film, Tv, Star, Clock } from "lucide-react";
import Navbar from "@/components/Navbar";
import MediaCarousel from '@/components/MediaCarousel';
import HeroSection from '@/components/HeroSection';
import VideoPlayer from '@/components/VideoPlayer';
import { getApiUrl } from '@/lib/api';
import { Media } from '@/types/media';

export default function Home() {
  const [featuredMedia, setFeaturedMedia] = useState<Media[]>([]);
  const [recentMovies, setRecentMovies] = useState<Media[]>([]);
  const [popularMovies, setPopularMovies] = useState<Media[]>([]);
  const [popularSeries, setPopularSeries] = useState<Media[]>([]);
  const [searchResults, setSearchResults] = useState<Media[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const { getApiUrl, API_ENDPOINTS, apiCall } = await import('../lib/api');
      
      // Fetch latest movies for hero section (sorted by ID descending for newest first)
      const allMedia = await apiCall(API_ENDPOINTS.media);
      
      // Get latest movies (highest IDs = most recently added)
      const latestMovies = allMedia
        .filter((item: Media) => item.type === "movie")
        .sort((a: Media, b: Media) => b.id - a.id)
        .slice(0, 5);
      
      setFeaturedMedia(latestMovies.length > 0 ? latestMovies : [allMedia[0]]);
      
      // Fetch recent movies (latest movies by ID)
      const recentMovies = allMedia
        .filter((item: Media) => item.type === "movie")
        .sort((a: Media, b: Media) => b.id - a.id)
        .slice(0, 20);
      setRecentMovies(recentMovies);
      
      // Fetch popular series (most viewed TV shows)
      const popularSeries = allMedia
        .filter((item: Media) => item.type === "episode")
        .sort((a: Media, b: Media) => (b.view_count || 0) - (a.view_count || 0))
        .slice(0, 20);
      setPopularSeries(popularSeries);
      
      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      setLoading(false);
    }
  };

  const setMockData = () => {
    const mockMediaList: Media[] = [
      {
        id: 1,
        title: "Epic Adventure",
        description: "Experience the ultimate entertainment with this amazing content. Watch now and immerse yourself in a world of endless possibilities.",
        type: "movie",
        rating: 8.5,
        duration: 7200,
        genres: [{ name: "Action" }, { name: "Adventure" }, { name: "Sci-Fi" }],
        view_count: 1250,
      },
      {
        id: 2,
        title: "Thrilling Drama",
        description: "A captivating story that will keep you on the edge of your seat from start to finish.",
        type: "movie",
        rating: 9.1,
        duration: 6900,
        genres: [{ name: "Drama" }, { name: "Thriller" }, { name: "Mystery" }],
        view_count: 2100,
      },
      {
        id: 3,
        title: "Comedy Gold",
        description: "Laugh out loud with this hilarious comedy that brings joy and entertainment to your screen.",
        type: "movie",
        rating: 7.8,
        duration: 5400,
        genres: [{ name: "Comedy" }, { name: "Romance" }, { name: "Family" }],
        view_count: 890,
      }
    ];

    setFeaturedMedia(mockMediaList);
    setRecentMovies(mockMediaList);
    setPopularSeries(mockMediaList);
  };

  const handleSearch = async (query: string) => {
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      setSearchResults(data.media || []);
    } catch (error) {
      console.error("Error searching:", error);
    }
  };

  const handlePlay = (media: Media) => {
    setSelectedMedia(media);
    setIsPlayerOpen(true);
  };

  const handleInfo = (media: Media) => {
    // TODO: Implement media info modal
    console.log("Show info for:", media.title);
  };

  const parallaxCards = [
    {
      id: 1,
      title: "Endless Entertainment",
      description: "Discover thousands of movies and TV shows from your personal collection",
      icon: <Film />,
      variant: "default" as const,
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    },
    {
      id: 2,
      title: "Smart Organization",
      description: "Automatically categorized by genre, year, and rating for easy browsing",
      icon: <Star />,
      variant: "outline" as const,
      background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    },
    {
      id: 3,
      title: "High Quality Streaming",
      description: "Enjoy your content in the highest quality with adaptive streaming",
      icon: <Tv />,
      variant: "secondary" as const,
      background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    },
    {
      id: 4,
      title: "Watch Anywhere",
      description: "Stream your personal library on any device, anytime, anywhere",
      icon: <Clock />,
      variant: "ghost" as const,
      background: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading HomeFlix...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <Navbar onSearch={handleSearch} />
      
      {featuredMedia.length > 0 && (
        <HeroSection
          featuredMedia={featuredMedia}
          onPlay={handlePlay}
          onInfo={handleInfo}
        />
      )}

      <div className="relative z-10 -mt-32">
        {searchResults.length > 0 ? (
          <MediaCarousel
            title="Search Results"
            media={searchResults as any}
            onPlay={handlePlay as any}
            onInfo={handleInfo as any}
          />
        ) : (
          <>
            <MediaCarousel
              title="Recent Movies"
              media={recentMovies as any}
              onPlay={handlePlay as any}
              onInfo={handleInfo as any}
            />

            <MediaCarousel
              title="Popular Movies"
              media={popularMovies as any}
              onPlay={handlePlay as any}
              onInfo={handleInfo as any}
            />

            {popularSeries.length > 0 && (
              <MediaCarousel
                title="Popular TV Shows"
                media={popularSeries as any}
                onPlay={handlePlay as any}
                onInfo={handleInfo as any}
              />
            )}

            <MediaCarousel
              title="Action & Adventure"
              media={featuredMedia as any}
              onPlay={handlePlay as any}
              onInfo={handleInfo as any}
            />

            <MediaCarousel
              title="Trending Now"
              media={popularSeries as any}
              onPlay={handlePlay as any}
              onInfo={handleInfo as any}
            />
          </>
        )}
      </div>

      {/* Additional content sections can be added here */}

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
