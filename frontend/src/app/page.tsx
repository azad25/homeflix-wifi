"use client";

import React, { useState, useEffect } from "react";
import { Film, Tv, Star, Clock } from "lucide-react";
import { useRouter } from 'next/navigation';
import Navbar from "@/components/Navbar";
import VideoPlayer from '@/components/VideoPlayer';
import { getApiUrl } from '@/lib/api';
import { Media } from '@/types/media';
import { ScrollXHero, NetflixHorizontalRow, ParallaxSection, GradientBackground, ParticleField, ScrollReveal } from '@/components/scrollx';
import RecommendationSection from '@/components/RecommendationSection';
import { useRecommendations } from '@/contexts/RecommendationContext';

export default function Home() {
  const router = useRouter();
  const { refreshRecommendations, trackClick } = useRecommendations();
  const [featuredMedia, setFeaturedMedia] = useState<Media[]>([]);
  const [recentMovies, setRecentMovies] = useState<Media[]>([]);
  const [popularMovies, setPopularMovies] = useState<Media[]>([]);
  const [popularSeries, setPopularSeries] = useState<Media[]>([]);
  const [trendingNow, setTrendingNow] = useState<Media[]>([]);
  const [actionMovies, setActionMovies] = useState<Media[]>([]);
  const [comedyMovies, setComedyMovies] = useState<Media[]>([]);
  const [dramaMovies, setDramaMovies] = useState<Media[]>([]);
  const [horrorMovies, setHorrorMovies] = useState<Media[]>([]);
  const [searchResults, setSearchResults] = useState<Media[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { getApiUrl, API_ENDPOINTS, apiCall } = await import('../lib/api');
      
      // Fetch all media
      const allMedia = await apiCall(API_ENDPOINTS.media);
      
      // Initialize recommendations with all media
      refreshRecommendations(allMedia);
      
      // Get random high-quality movies and TV shows for hero section
      const highQualityMedia = allMedia
        .filter((item: Media) => (item.rating || 0) >= 6.0) // Only show content with decent ratings
        .sort(() => Math.random() - 0.5) // Randomize the order
        .slice(0, 10); // Get more items to choose from
      
      // Mix movies and TV shows, prioritize higher rated content
      const featuredSelection = highQualityMedia
        .sort((a: Media, b: Media) => (b.rating || 0) - (a.rating || 0))
        .slice(0, 5);
      
      setFeaturedMedia(featuredSelection.length > 0 ? featuredSelection : allMedia.slice(0, 5));
      
      // Recent movies (latest by ID)
      const recentMovies = allMedia
        .filter((item: Media) => item.type === "movie")
        .sort((a: Media, b: Media) => b.id - a.id)
        .slice(0, 20);
      setRecentMovies(recentMovies);
      
      // Popular movies (most viewed)
      const popularMovies = allMedia
        .filter((item: Media) => item.type === "movie")
        .sort((a: Media, b: Media) => (b.view_count || 0) - (a.view_count || 0))
        .slice(0, 20);
      setPopularMovies(popularMovies);
      
      // Popular series (most viewed TV shows)
      const popularSeries = allMedia
        .filter((item: Media) => item.type === "episode")
        .sort((a: Media, b: Media) => (b.view_count || 0) - (a.view_count || 0))
        .slice(0, 20);
      setPopularSeries(popularSeries);
      
      // Trending now (highest rated recent content)
      const trendingNow = allMedia
        .sort((a: Media, b: Media) => (b.rating || 0) - (a.rating || 0))
        .slice(0, 20);
      setTrendingNow(trendingNow);
      
      // Genre-based collections
      const actionMovies = allMedia
        .filter((item: Media) => 
          item.type === "movie" && 
          (item.genres || []).some(genre => genre.name.toLowerCase().includes('action'))
        )
        .sort((a: Media, b: Media) => (b.rating || 0) - (a.rating || 0))
        .slice(0, 20);
      setActionMovies(actionMovies);
      
      const comedyMovies = allMedia
        .filter((item: Media) => 
          item.type === "movie" && 
          (item.genres || []).some(genre => genre.name.toLowerCase().includes('comedy'))
        )
        .sort((a: Media, b: Media) => (b.rating || 0) - (a.rating || 0))
        .slice(0, 20);
      setComedyMovies(comedyMovies);
      
      const dramaMovies = allMedia
        .filter((item: Media) => 
          item.type === "movie" && 
          (item.genres || []).some(genre => genre.name.toLowerCase().includes('drama'))
        )
        .sort((a: Media, b: Media) => (b.rating || 0) - (a.rating || 0))
        .slice(0, 20);
      setDramaMovies(dramaMovies);
      
      const horrorMovies = allMedia
        .filter((item: Media) => 
          item.type === "movie" && 
          (item.genres || []).some(genre => 
            genre.name.toLowerCase().includes('horror') || 
            genre.name.toLowerCase().includes('thriller')
          )
        )
        .sort((a: Media, b: Media) => (b.rating || 0) - (a.rating || 0))
        .slice(0, 20);
      setHorrorMovies([]);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      // Don't fall back to mock data - show empty state instead
      setFeaturedMedia([]);
      setRecentMovies([]);
      setPopularMovies([]);
      setPopularSeries([]);
      setTrendingNow([]);
      setActionMovies([]);
      setComedyMovies([]);
      setDramaMovies([]);
      setHorrorMovies([]);
      setLoading(false);
    }
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

  const handlePlay = (media: Media, startTime?: number) => {
    trackClick(media.id, 'play', 'home');
    setSelectedMedia(media);
    setIsPlayerOpen(true);
  };

  const handleInfo = (media: Media) => {
    trackClick(media.id, 'info', 'home');
    if (media.type === 'episode' || media.type === 'tv') {
      router.push(`/tv-show/${media.uuid}`);
    } else {
      router.push(`/movie/${media.uuid}`);
    }
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
      
      {/* ScrollX Hero Section */}
      {featuredMedia.length > 0 && (
        <ScrollXHero
          featuredMedia={featuredMedia}
          onPlay={handlePlay}
          onInfo={handleInfo}
          pageType="home"
        />
      )}

      {/* Main Content - Netflix Style */}
      <div className="relative bg-black">
        {searchResults.length > 0 ? (
          <div className="py-8">
            <NetflixHorizontalRow
              title="Search Results"
              media={searchResults}
              onPlay={handlePlay}
              onInfo={handleInfo}
              priority={true}
              variant="portrait"
              size="medium"
            />
          </div>
        ) : (
          <div className="space-y-8 pb-20">
            {/* Netflix-style Recommendations */}
            {featuredMedia.length > 0 && (
              <RecommendationSection
                currentMedia={featuredMedia[0]}
                onPlay={handlePlay}
                onInfo={handleInfo}
              />
            )}

            {/* Fallback: Traditional Genre-based Rows */}
            {/* Popular Movies */}
            {popularMovies.length > 0 && (
              <NetflixHorizontalRow
                title="Popular Movies"
                media={popularMovies}
                onPlay={handlePlay}
                onInfo={handleInfo}
                variant="portrait"
                size="medium"
              />
            )}

            {/* Popular TV Shows */}
            {popularSeries.length > 0 && (
              <NetflixHorizontalRow
                title="Popular TV Shows"
                media={popularSeries}
                onPlay={handlePlay}
                onInfo={handleInfo}
                variant="portrait"
                size="medium"
              />
            )}

            {/* Action Movies */}
            {actionMovies.length > 0 && (
              <NetflixHorizontalRow
                title="Action & Adventure"
                media={actionMovies}
                onPlay={handlePlay}
                onInfo={handleInfo}
                variant="portrait"
                size="medium"
              />
            )}

            {/* Comedy Movies */}
            {comedyMovies.length > 0 && (
              <NetflixHorizontalRow
                title="Comedy Movies"
                media={comedyMovies}
                onPlay={handlePlay}
                onInfo={handleInfo}
                variant="portrait"
                size="medium"
              />
            )}
          </div>
        )}
      </div>

      {/* Additional content sections can be added here */}

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
