"use client";

import React, { useState, useEffect } from "react";
import { Film, Tv, Star, Clock } from "lucide-react";
import { useRouter } from 'next/navigation';
import Navbar from "@/components/Navbar";
import VideoPlayer from '@/components/VideoPlayer';
import PageTransition from '@/components/PageTransition';
import { getApiUrl } from '@/lib/api';
import { useGlobalCache, useBatchCache, useRecommendationCache } from '@/hooks/useGlobalCache';
import { fetchMedia, fetchRecommendations } from '@/lib/globalApiCache';
import { Media } from '@/types/media';
import { ScrollXHero, NetflixHorizontalRow } from '@/components/scrollx';
import RecentlyWatched from '@/components/RecentlyWatched';
import ContinueWatching from '@/components/ContinueWatching';

export default function Home() {
  const router = useRouter();
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
  
  // Use global cache for media data
  const { data: allMediaData, loading } = useGlobalCache<Media[]>(
    `${getApiUrl()}/api/media`,
    {},
    { customTTL: 10 * 60 * 1000 } // 10 minutes cache
  );
  
  // Use global cache for recommendations
  const { data: recommendationsData } = useRecommendationCache('trending', 20);

  useEffect(() => {
    // Process cached data when available
    if (allMediaData && allMediaData.length > 0) {
      processMediaData(allMediaData);
    }
    
    if (recommendationsData && recommendationsData.length > 0) {
      setFeaturedMedia(recommendationsData.slice(0, 8));
    }
  }, [allMediaData, recommendationsData]);

  const processMediaData = (allMedia: Media[]) => {
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
        (item.genres || []).some(genre => {
          const genreName = (typeof genre === 'string' ? genre : genre.name).toLowerCase();
          return genreName.includes('action');
        })
      )
      .sort((a: Media, b: Media) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 20);
    setActionMovies(actionMovies);
    
    const comedyMovies = allMedia
      .filter((item: Media) => 
        item.type === "movie" && 
        (item.genres || []).some(genre => {
          const genreName = (typeof genre === 'string' ? genre : genre.name).toLowerCase();
          return genreName.includes('comedy');
        })
      )
      .sort((a: Media, b: Media) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 20);
    setComedyMovies(comedyMovies);
    
    const dramaMovies = allMedia
      .filter((item: Media) => 
        item.type === "movie" && 
        (item.genres || []).some(genre => {
          const genreName = (typeof genre === 'string' ? genre : genre.name).toLowerCase();
          return genreName.includes('drama');
        })
      )
      .sort((a: Media, b: Media) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 20);
    setDramaMovies(dramaMovies);
    
    const horrorMovies = allMedia
      .filter((item: Media) => 
        item.type === "movie" && 
        (item.genres || []).some(genre => {
          const genreName = (typeof genre === 'string' ? genre : genre.name).toLowerCase();
          return genreName.includes('horror') || genreName.includes('thriller');
        })
      )
      .sort((a: Media, b: Media) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 20);
    setHorrorMovies(horrorMovies);
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
    router.push(`/movie/${media.id}`);
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

  return (
    <PageTransition isLoading={loading} text="Loading HomeFlix...">
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
          />
        )}
      </div>
    </PageTransition>
  );
}
