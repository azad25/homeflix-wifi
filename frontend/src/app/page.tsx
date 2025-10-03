"use client";

import React, { useState, useEffect } from "react";
import { Film, Tv, Star, Clock } from "lucide-react";
import { useRouter } from 'next/navigation';
import Navbar from "@/components/Navbar";
import ContinueWatching from '@/components/ContinueWatching';
import VideoPlayer from '@/components/VideoPlayer';
import { getApiUrl } from '@/lib/api';
import { trackClick } from '@/lib/analytics';
import { useRecommendations } from '@/contexts/RecommendationContext';
import { cachedFetch } from '@/lib/cache';
import { Media } from '@/types/media';
import { ScrollXHero, NetflixHorizontalRow, ParallaxSection, GradientBackground, ParticleField, ScrollReveal } from '@/components/scrollx';
import RecommendationSection from '@/components/RecommendationSection';

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
    
    // Set up recommendation refresh timer (every 5 minutes)
    const refreshInterval = setInterval(() => {
      console.log('Refreshing recommendations...');
      fetchData();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(refreshInterval);
  }, []);

  const fetchData = async () => {
    try {
      const apiUrl = getApiUrl();
      const defaultUserId = '1';
      
      // Fetch recommendations from backend using cache
      const [
        forYouData,
        trendingData,
        popularMoviesData,
        popularSeriesData
      ] = await Promise.all([
        cachedFetch(`${apiUrl}/api/recommendations?user_id=${defaultUserId}&category=for_you&limit=20`).catch(() => ({ items: [] })),
        cachedFetch(`${apiUrl}/api/recommendations?user_id=${defaultUserId}&category=trending&limit=20`).catch(() => ({ items: [] })),
        cachedFetch(`${apiUrl}/api/media/movies?limit=20`).catch(() => []),
        cachedFetch(`${apiUrl}/api/media/tv-shows?limit=20`).catch(() => [])
      ]);

      // Set featured media from recommendations
      setFeaturedMedia(forYouData.items || []);
      
      // Set trending content
      setTrendingNow(trendingData.items || []);
      
      // Set popular content
      setPopularMovies(popularMoviesData.slice(0, 20));
      setPopularSeries(popularSeriesData.slice(0, 20));
      
      // Set genre-based content from popular movies
      setActionMovies(popularMoviesData.filter((m: Media) => 
        m.genres?.some(g => g.name.toLowerCase().includes('action'))
      ).slice(0, 20));
      
      setComedyMovies(popularMoviesData.filter((m: Media) => 
        m.genres?.some(g => g.name.toLowerCase().includes('comedy'))
      ).slice(0, 20));
      
      setDramaMovies(popularMoviesData.filter((m: Media) => 
        m.genres?.some(g => g.name.toLowerCase().includes('drama'))
      ).slice(0, 20));
      
      // Set recent movies
      setRecentMovies(popularMoviesData.slice(0, 20));

      // Initialize recommendations with all data
      
      // Initialize recommendations context
      const allRecommendations = [
        ...(forYouData.items || []),
        ...(trendingData.items || []),
        ...popularMoviesData,
        ...popularSeriesData
      ];
      refreshRecommendations(allRecommendations);
      
      setLoading(false);
    } catch (error) {
      console.error("Error fetching recommendations:", error);
      
      // Fallback to basic media fetch if recommendations fail
      try {
        const apiUrl = getApiUrl();
        const fallbackResponse = await fetch(`${apiUrl}/api/media`);
        if (fallbackResponse.ok) {
          const allMedia = await fallbackResponse.json();
          const movies = allMedia.filter((item: Media) => item.type === "movie");
          const series = allMedia.filter((item: Media) => item.type === "tv");
          
          // Set fallback data
          setFeaturedMedia(movies.slice(0, 5));
          setTrendingNow(movies.slice(5, 15));
          setActionMovies(movies.slice(15, 25));
          setComedyMovies(movies.slice(25, 35));
          setDramaMovies(movies.slice(35, 45));
          setHorrorMovies([]);
          setPopularMovies(movies.slice(0, 20));
          setPopularSeries(series.slice(0, 20));
          setRecentMovies(movies.slice(0, 20));
          
          refreshRecommendations([...movies, ...series]);
        }
      } catch (fallbackError) {
        console.error("Fallback data fetch also failed:", fallbackError);
      }
      
      setComedyMovies([]);
      setDramaMovies([]);
      setHorrorMovies([]);
      setLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/media/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      setSearchResults(data || []);
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
      <GradientBackground variant="netflix" className="min-h-screen">
        <div className="relative z-10">
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
      </GradientBackground>

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
