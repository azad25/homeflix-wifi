"use client";

import React, { useState, useEffect } from "react";
import { Film, Tv, Star, Clock } from "lucide-react";
import { useNavigate } from '@/hooks/useNavigate';
import Navbar from "@/components/Navbar";
import VideoPlayer from '@/components/VideoPlayer';
import RedLoader from '@/components/RedLoader';
import { getApiUrl, fetchUniqueRecommendations, preloadAssets } from '@/lib/api';
import { Media } from '@/types/media';
import { ScrollXHero, NetflixHorizontalRow } from '@/components/scrollx';
import RecentlyWatched from '@/components/RecentlyWatched';
import ContinueWatching from '@/components/ContinueWatching';

export default function Home() {
  const navigate = useNavigate();
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
    fetchInitialData();
    
    // Set up auto-refresh every 5 minutes for recommendations
    const interval = setInterval(() => {
      fetchInitialData();
    }, 5 * 60 * 1000); // 5 minutes in milliseconds
    
    return () => clearInterval(interval);
  }, []);

  const fetchInitialData = async () => {
    try {
      const { getApiUrl, API_ENDPOINTS, apiCall } = await import('../lib/api');
      
      // Fetch all media
      const allMedia = await apiCall(API_ENDPOINTS.media);
      
      // Get unique MOVIE recommendations for hero section (HOME page shows movies only)
      let highQualityMedia: Media[] = [];
      try {
        console.log('🎬 Fetching unique movie recommendations for home page...');
        const recommendations = await fetchUniqueRecommendations('mixed', 20);
        // Filter for movies only in hero section
        highQualityMedia = recommendations.filter((item: Media) => item.type === 'movie');
        console.log(`✅ Got ${highQualityMedia.length} unique movie recommendations for home page`);
      } catch (error) {
        console.warn('⚠️ Enhanced recommendations failed, using fallback');
        // Fallback to high-rated movies only
        highQualityMedia = allMedia
          .filter((item: Media) => item.type === 'movie' && (item.rating || 0) >= 6.0)
          .slice(0, 10);
      }
      
      // If not enough movie recommendations, fallback to all movies
      if (highQualityMedia.length < 5) {
        highQualityMedia = allMedia
          .filter((item: Media) => item.type === 'movie')
          .sort((a: Media, b: Media) => (b.rating || 0) - (a.rating || 0))
          .slice(0, 10);
      }
      
      // Filter for movies only and prioritize higher rated content
      const movieRecommendations = highQualityMedia.filter((item: Media) => item.type === 'movie');
      const featuredSelection = movieRecommendations
        .sort((a: Media, b: Media) => (b.rating || 0) - (a.rating || 0))
        .slice(0, 5);
      
      // Fallback to movies from allMedia if not enough recommendations
      const fallbackMovies = allMedia.filter((item: Media) => item.type === 'movie').slice(0, 5);
      setFeaturedMedia(featuredSelection.length > 0 ? featuredSelection : fallbackMovies);
      
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
      setHorrorMovies(horrorMovies);
      
      // Preload assets for better performance
      const allContentForPreload = [
        ...featuredSelection,
        ...recentMovies.slice(0, 10),
        ...popularMovies.slice(0, 10),
        ...trendingNow.slice(0, 10)
      ];
      
      if (allContentForPreload.length > 0) {
        preloadAssets(allContentForPreload, ['thumbnail', 'preview']);
      }
      
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

  const handlePlay = (media: Media, startTime?: number) => {
    setSelectedMedia(media);
    setIsPlayerOpen(true);
  };

  const handleInfo = (media: Media) => {
    // Route to appropriate page based on media type
    if (media.type === 'episode' || media.type === 'tv' || media.type === 'series') {
      // If it's an episode, try to get the series ID, otherwise use the media ID
      const seriesId = media.series_id || media.id;
      navigate.push(`/tv-series/${seriesId}`);
    } else {
      navigate.push(`/movie/${media.id}`);
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
        <RedLoader size="large" />
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
          enableRecommendations={true}
          refreshInterval={300000}
          contentFilter="movies-hd"
        />
      )}

      {/* Main Content - Netflix Style */}
      <div className="relative bg-black" style={{ overflow: 'visible' }}>
        {searchResults.length > 0 ? (
          <div className="py-12" style={{ overflow: 'visible' }}>
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
          <div className="space-y-4 pb-32" style={{ overflow: 'visible' }}>
            {/* Continue Watching */}
            <ContinueWatching
              onPlay={handlePlay}
              onInfo={handleInfo}
            />

            {/* Recently Watched */}
            <RecentlyWatched
              onPlay={handlePlay}
              onInfo={handleInfo}
            />

            {/* Trending Now */}
            {trendingNow.length > 0 && (
              <NetflixHorizontalRow
                title="Trending Now"
                media={trendingNow}
                onPlay={handlePlay}
                onInfo={handleInfo}
                variant="portrait"
                size="large"
                priority={true}
              />
            )}

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

            {/* Drama Movies */}
            {dramaMovies.length > 0 && (
              <NetflixHorizontalRow
                title="Drama Movies"
                media={dramaMovies}
                onPlay={handlePlay}
                onInfo={handleInfo}
                variant="portrait"
                size="medium"
              />
            )}

            {/* Horror & Thriller */}
            {horrorMovies.length > 0 && (
              <NetflixHorizontalRow
                title="Horror & Thriller"
                media={horrorMovies}
                onPlay={handlePlay}
                onInfo={handleInfo}
                variant="portrait"
                size="medium"
              />
            )}

            {/* Recently Added */}
            {recentMovies.length > 0 && (
              <NetflixHorizontalRow
                title="Recently Added"
                media={recentMovies}
                onPlay={handlePlay}
                onInfo={handleInfo}
                variant="portrait"
                size="medium"
              />
            )}
          </div>
        )}
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
