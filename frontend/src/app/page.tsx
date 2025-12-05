"use client";

import React, { useState, useEffect } from "react";
import { usePageTitle } from '@/hooks/usePageTitle';
import { Film, Tv, Star, Clock } from "lucide-react";
import { useNavigate } from '@/hooks/useNavigate';
import Navbar from "@/components/Navbar";
import VideoPlayer from '@/components/VideoPlayer';
import RedLoader from '@/components/RedLoader';
import { getApiUrl, fetchUniqueRecommendations, preloadAssets } from '@/lib/api';
import { Media } from '@/types/media';
import { ScrollXHero, EnhancedHorizontalRow } from '@/components/scrollx';
import RecentlyWatched from '@/components/RecentlyWatched';
import ContinueWatching from '@/components/ContinueWatching';
import UpcomingMovies from '@/components/UpcomingMovies';
import UpcomingTVSeries from '@/components/UpcomingTVSeries';
import HomeflixHero from '@/components/HomeflixHero';

export default function Home() {
  usePageTitle('Home');
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
  const [scifiMovies, setScifiMovies] = useState<Media[]>([]);
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

      // Popular movies - use enhanced API endpoint with mixed criteria (views, rating, year, genres)
      let popularMovies: Media[] = [];
      try {
        const popularResponse = await fetch(`${getApiUrl()}/api/recommendations/popular?limit=20`);
        if (popularResponse.ok) {
          popularMovies = await popularResponse.json();
          console.log(`✅ Got ${popularMovies.length} enhanced popular movies with mixed criteria`);
        } else {
          throw new Error('Popular API failed');
        }
      } catch (error) {
        console.warn('⚠️ Enhanced popular movies failed, using fallback');
        // Fallback to mixed criteria sorting (views, rating, year, genres)
        popularMovies = allMedia
          .filter((item: Media) => item.type === "movie")
          .sort((a: Media, b: Media) => {
            const currentYear = new Date().getFullYear();
            const viewScoreA = (a.view_count || 0) * 0.4;
            const viewScoreB = (b.view_count || 0) * 0.4;
            const ratingScoreA = (a.rating || 0) * 10;
            const ratingScoreB = (b.rating || 0) * 10;
            const yearScoreA = ((a.year || 0) >= currentYear - 2) ? 25 : ((a.year || 0) >= currentYear - 5) ? 15 : 0;
            const yearScoreB = ((b.year || 0) >= currentYear - 2) ? 25 : ((b.year || 0) >= currentYear - 5) ? 15 : 0;
            const genreScoreA = (a.genres || []).some(g =>
              ['Action', 'Drama', 'Comedy', 'Sci-Fi'].includes(g.name)
            ) ? 10 : 0;
            const genreScoreB = (b.genres || []).some(g =>
              ['Action', 'Drama', 'Comedy', 'Sci-Fi'].includes(g.name)
            ) ? 10 : 0;

            const totalScoreA = viewScoreA + ratingScoreA + yearScoreA + genreScoreA;
            const totalScoreB = viewScoreB + ratingScoreB + yearScoreB + genreScoreB;
            return totalScoreB - totalScoreA;
          })
          .slice(0, 20);
      }
      setPopularMovies(popularMovies);

      // Popular series (most viewed TV shows) - Group episodes into series
      const tvEpisodes = allMedia.filter((item: Media) => item.type === "episode");

      // Build series groups from episodes (same logic as TV shows page)
      const seriesMap = new Map<string | number, any>();
      tvEpisodes.forEach((ep: Media) => {
        // Extract series ID - prefer series_id, fallback to extracting from title
        const sid = ep.series_id ?? ep.series?.id ?? extractSeriesIdFromTitle(ep.title) ?? ep.id;

        // Clean series title - remove episode info and technical prefixes
        let seriesTitle = ep.series?.title || ep.title || 'Untitled Series';

        // Remove episode patterns like "- S01E01", "S1E1", "Episode 1", etc.
        seriesTitle = seriesTitle
          .replace(/\s*-\s*S\d+E\d+.*$/i, '')
          .replace(/\s*S\d+E\d+.*$/i, '')
          .replace(/\s*Season\s+\d+.*$/i, '')
          .replace(/\s*Episode\s+\d+.*$/i, '')
          .replace(/\s*Ep\s*\d+.*$/i, '')
          .replace(/\s*\d+x\d+.*$/i, '')
          .trim();

        if (!seriesMap.has(sid)) {
          seriesMap.set(sid, {
            id: sid,
            title: seriesTitle,
            description: ep.series?.description || ep.description || '',
            rating: ep.rating || 0,
            type: 'series',
            series_id: sid,
            genres: ep.genres || [],
            episodes: [],
            thumbnail_path: ep.thumbnail_path,
            banner_path: ep.banner_path,
            // Use proper poster URLs for series - prioritize TMDB poster, then series poster endpoint
            poster_path: (ep.series as any)?.tmdb_poster_url || ep.tmdb_poster_url || ep.series?.poster_path || undefined,
            tmdb_poster_url: (ep.series as any)?.tmdb_poster_url || ep.tmdb_poster_url,
            poster_url: (ep.series as any)?.tmdb_poster_url || ep.tmdb_poster_url,
            view_count: 0,
            // Add these fields to make it more compatible with Media interface
            file_path: undefined,
            duration: undefined
          });
        }

        const group = seriesMap.get(sid)!;
        group.episodes.push(ep);
        // Sum up view counts from all episodes for series popularity
        group.view_count += (ep.view_count || 0);

        // Update rating to average of all episodes
        const totalRating = group.episodes.reduce((sum: number, episode: Media) => sum + (episode.rating || 0), 0);
        group.rating = totalRating / group.episodes.length;
      });

      // Helper function to extract series ID from title patterns
      function extractSeriesIdFromTitle(title: string): string | null {
        // Try to extract series name from common patterns
        const patterns = [
          /^(.+?)\s*-\s*S\d+E\d+/i,
          /^(.+?)\s*S\d+E\d+/i,
          /^(.+?)\s*Season\s+\d+/i,
          /^(.+?)\s*Episode\s+\d+/i,
        ];

        for (const pattern of patterns) {
          const match = title.match(pattern);
          if (match) {
            return match[1].trim();
          }
        }
        return null;
      }

      // Convert to array and sort by total view count
      const popularSeries = Array.from(seriesMap.values())
        .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
        .slice(0, 20);

      setPopularSeries(popularSeries);

      // Trending now - use enhanced API endpoint with mixed criteria (views, genres, latest year, high rating)
      let trendingNow: Media[] = [];
      try {
        const trendingResponse = await fetch(`${getApiUrl()}/api/recommendations/trending?limit=20`);
        if (trendingResponse.ok) {
          trendingNow = await trendingResponse.json();
          console.log(`✅ Got ${trendingNow.length} enhanced trending movies with mixed criteria`);
        } else {
          throw new Error('Trending API failed');
        }
      } catch (error) {
        console.warn('⚠️ Enhanced trending failed, using fallback');
        // Fallback to mixed criteria sorting (views, genres, latest year, high rating)
        const currentYear = new Date().getFullYear();
        trendingNow = allMedia
          .sort((a: Media, b: Media) => {
            const yearBoostA = ((a.year || 0) >= currentYear - 1) ? 50 : ((a.year || 0) >= currentYear - 3) ? 25 : 0;
            const yearBoostB = ((b.year || 0) >= currentYear - 1) ? 50 : ((b.year || 0) >= currentYear - 3) ? 25 : 0;
            const genreBoostA = (a.genres || []).some(g =>
              g.name.toLowerCase().includes('action') ||
              g.name.toLowerCase().includes('sci-fi') ||
              g.name.toLowerCase().includes('science') ||
              g.name.toLowerCase().includes('thriller')
            ) ? 20 : 0;
            const genreBoostB = (b.genres || []).some(g =>
              g.name.toLowerCase().includes('action') ||
              g.name.toLowerCase().includes('sci-fi') ||
              g.name.toLowerCase().includes('science') ||
              g.name.toLowerCase().includes('thriller')
            ) ? 20 : 0;
            const viewBoostA = (a.view_count || 0) * 0.2;
            const viewBoostB = (b.view_count || 0) * 0.2;
            const ratingBoostA = (a.rating || 0) * 8;
            const ratingBoostB = (b.rating || 0) * 8;

            const scoreA = viewBoostA + ratingBoostA + yearBoostA + genreBoostA;
            const scoreB = viewBoostB + ratingBoostB + yearBoostB + genreBoostB;
            return scoreB - scoreA;
          })
          .slice(0, 20);
      }
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

      // Sci-Fi Movies - use enhanced API endpoint
      let scifiMovies: Media[] = [];
      try {
        const scifiResponse = await fetch(`${getApiUrl()}/api/recommendations/scifi?limit=20`);
        if (scifiResponse.ok) {
          scifiMovies = await scifiResponse.json();
          console.log(`✅ Got ${scifiMovies.length} enhanced sci-fi movies`);
        } else {
          throw new Error('Sci-Fi API failed');
        }
      } catch (error) {
        console.warn('⚠️ Enhanced sci-fi failed, using fallback');
        // Fallback to local filtering
        scifiMovies = allMedia
          .filter((item: Media) =>
            item.type === "movie" &&
            (item.genres || []).some(genre =>
              genre.name.toLowerCase().includes('sci-fi') ||
              genre.name.toLowerCase().includes('science fiction') ||
              genre.name.toLowerCase().includes('science') ||
              genre.name.toLowerCase().includes('fantasy')
            )
          )
          .sort((a: Media, b: Media) => (b.rating || 0) - (a.rating || 0))
          .slice(0, 20);
      }
      setScifiMovies(scifiMovies);

      // Preload assets for better performance (poster first, then thumbnail, then preview)
      const allContentForPreload = [
        ...featuredSelection,
        ...recentMovies.slice(0, 10),
        ...popularMovies.slice(0, 10),
        ...trendingNow.slice(0, 10),
        ...scifiMovies.slice(0, 10)
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
    // Check if this is a series object (has episodes array)
    if (media.type === 'series' && (media as any).episodes && (media as any).episodes.length > 0) {
      // Play the first episode of the series
      const firstEpisode = (media as any).episodes[0];
      setSelectedMedia({
        id: firstEpisode.id,
        title: firstEpisode.title,
        thumbnail_path: firstEpisode.thumbnail_path,
        description: firstEpisode.description,
        type: 'episode',
        series_id: media.series_id || media.id
      } as Media);
    } else {
      // Regular media (movie or episode)
      setSelectedMedia(media);
    }
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

      {/* HomeflixHero Section - Mixed content for homepage */}
      <HomeflixHero onPlay={handlePlay} onInfo={handleInfo} sortMode="mixed" />

      {/* ScrollX Hero Section - Commented out */}
      {/* {featuredMedia.length > 0 && (
        <ScrollXHero
          featuredMedia={featuredMedia}
          onPlay={handlePlay}
          onInfo={handleInfo}
          enableRecommendations={true}
          refreshInterval={300000}
          contentFilter="movies-hd"
        />
      )} */}

      {/* Main Content - Netflix Style */}
      <div className="relative bg-black" style={{ overflow: 'visible', zIndex: 10 }}>
        {searchResults.length > 0 ? (
          <div className="py-12" style={{ overflow: 'visible' }}>
            <EnhancedHorizontalRow
              title="Search Results"
              media={searchResults}
              onPlay={handlePlay}
              onInfo={handleInfo}
              priority={true}
              size="medium"
            />
          </div>
        ) : (
          <div className="space-y-2 pb-10" style={{ overflow: 'visible', transformStyle: 'preserve-3d' }}>

            <div className="px-4 md:px-8">
              {/* Continue Watching */}
              <RecentlyWatched
                onPlay={handlePlay}
                onInfo={handleInfo}
              />
            </div>

            {/* TMDB Upcoming Movies - Now Playing in Theaters */}
            <UpcomingMovies
              showSection="now_playing"
              maxItems={15}
              className="px-4 md:px-8"
            />

            {/* Trending Now */}
            {trendingNow.length > 0 && (
              <EnhancedHorizontalRow
                title="Trending Now"
                media={trendingNow}
                onPlay={handlePlay}
                onInfo={handleInfo}
                size="large"
                priority={true}
              />
            )}

            {/* Popular Movies */}
            {popularMovies.length > 0 && (
              <EnhancedHorizontalRow
                title="Popular Movies"
                media={popularMovies}
                onPlay={handlePlay}
                onInfo={handleInfo}
                size="medium"
              />
            )}

            {/* Popular TV Shows */}
            {popularSeries.length > 0 && (
              <EnhancedHorizontalRow
                title="Popular TV Shows"
                media={popularSeries}
                onPlay={handlePlay}
                onInfo={handleInfo}
                size="medium"
              />
            )}

            {/* Action Movies */}
            {actionMovies.length > 0 && (
              <EnhancedHorizontalRow
                title="Action & Adventure"
                media={actionMovies}
                onPlay={handlePlay}
                onInfo={handleInfo}
                size="medium"
              />
            )}

            {/* Comedy Movies */}
            {comedyMovies.length > 0 && (
              <EnhancedHorizontalRow
                title="Comedy Movies"
                media={comedyMovies}
                onPlay={handlePlay}
                onInfo={handleInfo}
                size="medium"
              />
            )}

            {/* Drama Movies */}
            {dramaMovies.length > 0 && (
              <EnhancedHorizontalRow
                title="Drama Movies"
                media={dramaMovies}
                onPlay={handlePlay}
                onInfo={handleInfo}
                size="medium"
              />
            )}

            {/* Horror & Thriller */}
            {horrorMovies.length > 0 && (
              <EnhancedHorizontalRow
                title="Horror & Thriller"
                media={horrorMovies}
                onPlay={handlePlay}
                onInfo={handleInfo}
                size="medium"
              />
            )}

            {/* Sci-Fi Movies - Enhanced API */}
            {scifiMovies.length > 0 && (
              <EnhancedHorizontalRow
                title="Sci-Fi & Fantasy"
                media={scifiMovies}
                onPlay={handlePlay}
                onInfo={handleInfo}
                size="medium"
              />
            )}

            {/* Recently Added */}
            {recentMovies.length > 0 && (
              <EnhancedHorizontalRow
                title="Recently Added"
                media={recentMovies}
                onPlay={handlePlay}
                onInfo={handleInfo}
                size="medium"
              />
            )}

            {/* TMDB Coming Soon */}
            <UpcomingMovies
              showSection="upcoming"
              maxItems={12}
              className="px-4 md:px-8"
            />

            {/* TMDB Trending This Week */}
            <UpcomingMovies
              showSection="trending_weekly"
              maxItems={10}
              className="px-4 md:px-8"
            />

            {/* TMDB Trending Daily - Bottom Section */}
            <UpcomingMovies
              showSection="trending_daily"
              maxItems={15}
              className="px-4 md:px-8"
            />

            {/* TV Series - Airing Today */}
            <UpcomingTVSeries
              showSection="airing_today"
              maxItems={15}
              className="px-4 md:px-8"
            />

            {/* TV Series - On the Air */}
            <UpcomingTVSeries
              showSection="on_the_air"
              maxItems={12}
              className="px-4 md:px-8"
            />

            {/* TV Series - Trending Daily */}
            <UpcomingTVSeries
              showSection="trending_daily"
              maxItems={10}
              className="px-4 md:px-8"
            />
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
