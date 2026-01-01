"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { usePageTitle } from '@/hooks/usePageTitle';
import { useNavigate } from '@/hooks/useNavigate';
import Navbar from "@/components/Navbar";
import VideoPlayer from '@/components/VideoPlayer';
import RedLoader from '@/components/RedLoader';
import { preloadAssets } from '@/lib/api';
import { Media } from '@/types/media';
import { EnhancedHorizontalRow } from '@/components/scrollx';
import RecentlyWatched from '@/components/RecentlyWatched';
import UpcomingMovies from '@/components/UpcomingMovies';
import UpcomingTVSeries from '@/components/UpcomingTVSeries';
import HomeflixHero from '@/components/HomeflixHero';
import { WidgetRenderer, WidgetManagementButton } from '@/components/widgets';
import BackendWidgetRenderer from '@/components/widgets/BackendWidgetRenderer';
import ErrorBoundary from "@/components/ErrorBoundary";
import {
  useMedia,
  useSeries,
  useUniqueRecommendations,
  useTrendingRecommendations,
  usePopularRecommendations,
  useSciFiRecommendations,
  usePreloadData,
  useSearch
} from '@/lib/swr-api';

// Memoized components for better performance
const MemoizedEnhancedHorizontalRow = React.memo(EnhancedHorizontalRow);
const MemoizedRecentlyWatched = React.memo(RecentlyWatched);
const MemoizedUpcomingMovies = React.memo(UpcomingMovies);
const MemoizedUpcomingTVSeries = React.memo(UpcomingTVSeries);
const MemoizedHomeflixHero = React.memo(HomeflixHero);
const MemoizedWidgetRenderer = React.memo(WidgetRenderer);

export default function Home() {
  usePageTitle('Home');
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);

  // Use SWR hooks for data fetching with caching - all with fallback data
  const { data: allMedia = [], isLoading: mediaLoading } = useMedia({ fallbackData: [] });
  const { data: seriesData = [] } = useSeries({ fallbackData: [] });
  const { data: uniqueRecommendations = [] } = useUniqueRecommendations('mixed', 20, { fallbackData: [] });
  const { data: trendingNow = [] } = useTrendingRecommendations(20, { fallbackData: [] });
  const { data: popularMovies = [] } = usePopularRecommendations(20, { fallbackData: [] });
  const { data: scifiMovies = [] } = useSciFiRecommendations(20, { fallbackData: [] });
  const { data: searchResults = [] } = useSearch(searchQuery.trim() ? searchQuery : '', { fallbackData: [] });

  // Preload data for better performance - memoized to prevent re-renders
  const { preloadHomeData } = usePreloadData();

  useEffect(() => {
    preloadHomeData();
  }, [preloadHomeData]);

  // Memoized data processing with stable dependencies
  const featuredMedia = useMemo(() => {
    if (uniqueRecommendations.length > 0) {
      return uniqueRecommendations.filter((item: Media) => item.type === 'movie').slice(0, 5);
    }
    return allMedia.filter((item: Media) => item.type === 'movie')
      .sort((a: Media, b: Media) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 5);
  }, [uniqueRecommendations, allMedia]);

  const recentMovies = useMemo(() => {
    return allMedia
      .filter((item: Media) => item.type === "movie")
      .sort((a: Media, b: Media) => b.id - a.id)
      .slice(0, 20);
  }, [allMedia]);

  const popularSeries = useMemo(() => {
    return seriesData
      .map((series: any) => ({
        id: series.id,
        title: series.title,
        description: series.description,
        rating: series.rating || 0,
        type: 'series' as const,
        series_id: series.id,
        genres: series.genre_names ? series.genre_names.map((name: string, idx: number) => ({ id: idx, name })) : [],
        thumbnail_path: series.backdrop_path || series.tmdb_backdrop_url,
        banner_path: series.backdrop_path || series.tmdb_backdrop_url,
        poster_path: series.poster_path,
        tmdb_poster_url: series.tmdb_poster_url,
        poster_url: series.tmdb_poster_url,
        tmdb_backdrop_url: series.tmdb_backdrop_url,
        view_count: series.total_episodes || 0,
        file_path: undefined,
        duration: undefined,
        year: series.release_date ? new Date(series.release_date).getFullYear() : undefined
      }))
      .sort((a: Media, b: Media) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 20);
  }, [seriesData]);

  // Genre-based collections with memoization and stable sorting
  const genreMovies = useMemo(() => {
    const filterByGenre = (genreName: string) => 
      allMedia
        .filter((item: Media) =>
          item.type === "movie" &&
          (item.genres || []).some(genre => genre.name.toLowerCase().includes(genreName.toLowerCase()))
        )
        .sort((a: Media, b: Media) => (b.rating || 0) - (a.rating || 0))
        .slice(0, 20);

    return {
      action: filterByGenre('action'),
      comedy: filterByGenre('comedy'),
      drama: filterByGenre('drama'),
      horror: filterByGenre('horror') || filterByGenre('thriller'),
    };
  }, [allMedia]);

  // Memoize combined media array to prevent widget re-renders
  const combinedMedia = useMemo(() => {
    if (allMedia.length === 0) return [];
    
    return [
      ...recentMovies,
      ...popularMovies,
      ...trendingNow,
      ...genreMovies.action,
      ...genreMovies.comedy,
      ...genreMovies.drama,
      ...genreMovies.horror,
      ...scifiMovies
    ];
  }, [
    allMedia.length,
    recentMovies,
    popularMovies,
    trendingNow,
    genreMovies.action,
    genreMovies.comedy,
    genreMovies.drama,
    genreMovies.horror,
    scifiMovies
  ]);

  // Optimized asset preloading
  useEffect(() => {
    if (allMedia.length === 0) return;
    
    const allContentForPreload = [
      ...featuredMedia.slice(0, 3), // Reduce preload count
      ...recentMovies.slice(0, 5),
      ...popularMovies.slice(0, 5),
      ...trendingNow.slice(0, 5),
    ];

    if (allContentForPreload.length > 0) {
      // Use requestIdleCallback for non-blocking preload
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        window.requestIdleCallback(() => {
          preloadAssets(allContentForPreload, ['thumbnail']);
        });
      } else {
        setTimeout(() => {
          preloadAssets(allContentForPreload, ['thumbnail']);
        }, 100);
      }
    }
  }, [allMedia.length, featuredMedia, recentMovies, popularMovies, trendingNow]);

  // Memoized event handlers
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handlePlay = useCallback((media: Media) => {
    if (media.type === 'series' && (media as any).episodes && (media as any).episodes.length > 0) {
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
      setSelectedMedia(media);
    }
    setIsPlayerOpen(true);
  }, []);

  const handleInfo = useCallback((media: Media) => {
    if (media.type === 'episode' || media.type === 'tv' || media.type === 'series') {
      const seriesId = media.series_id || media.id;
      navigate.push(`/tv-series/${seriesId}`);
    } else {
      navigate.push(`/movie/${media.id}`);
    }
  }, [navigate]);

  const handleClosePlayer = useCallback(() => {
    setIsPlayerOpen(false);
  }, []);

  const handlePlayNext = useCallback((nextMedia: Media) => {
    setSelectedMedia(nextMedia);
  }, []);

  // Show minimal loading only for critical data
  if (mediaLoading && allMedia.length === 0) {
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
      <MemoizedHomeflixHero onPlay={handlePlay} onInfo={handleInfo} sortMode="mixed" />

      {/* Widget System Integration - Backend Data */}
      <ErrorBoundary>
        <BackendWidgetRenderer 
          page="home" 
          className="py-8"
        />
      </ErrorBoundary>

      {/* Main Content - Netflix Style */}
      <div className="relative bg-black" style={{ overflow: 'visible', zIndex: 10 }}>
        {searchResults.length > 0 ? (
          <div className="py-12" style={{ overflow: 'visible' }}>
            <MemoizedEnhancedHorizontalRow
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
              <MemoizedRecentlyWatched
                onPlay={handlePlay}
                onInfo={handleInfo}
              />
            </div>

            {/* TMDB Upcoming Movies - Now Playing in Theaters */}
            <MemoizedUpcomingMovies
              showSection="now_playing"
              maxItems={15}
              className="px-4 md:px-8"
            />

            {/* Trending Now */}
            {trendingNow.length > 0 && (
              <MemoizedEnhancedHorizontalRow
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
              <MemoizedEnhancedHorizontalRow
                title="Popular Movies"
                media={popularMovies}
                onPlay={handlePlay}
                onInfo={handleInfo}
                size="medium"
              />
            )}

            {/* Popular TV Shows */}
            {popularSeries.length > 0 && (
              <MemoizedEnhancedHorizontalRow
                title="Popular TV Shows"
                media={popularSeries}
                onPlay={handlePlay}
                onInfo={handleInfo}
                size="medium"
              />
            )}

            {/* Action Movies */}
            {genreMovies.action.length > 0 && (
              <MemoizedEnhancedHorizontalRow
                title="Action & Adventure"
                media={genreMovies.action}
                onPlay={handlePlay}
                onInfo={handleInfo}
                size="medium"
              />
            )}

            {/* Comedy Movies */}
            {genreMovies.comedy.length > 0 && (
              <MemoizedEnhancedHorizontalRow
                title="Comedy Movies"
                media={genreMovies.comedy}
                onPlay={handlePlay}
                onInfo={handleInfo}
                size="medium"
              />
            )}

            {/* Drama Movies */}
            {genreMovies.drama.length > 0 && (
              <MemoizedEnhancedHorizontalRow
                title="Drama Movies"
                media={genreMovies.drama}
                onPlay={handlePlay}
                onInfo={handleInfo}
                size="medium"
              />
            )}

            {/* Horror & Thriller */}
            {genreMovies.horror.length > 0 && (
              <MemoizedEnhancedHorizontalRow
                title="Horror & Thriller"
                media={genreMovies.horror}
                onPlay={handlePlay}
                onInfo={handleInfo}
                size="medium"
              />
            )}

            {/* Sci-Fi Movies - Enhanced API */}
            {scifiMovies.length > 0 && (
              <MemoizedEnhancedHorizontalRow
                title="Sci-Fi & Fantasy"
                media={scifiMovies}
                onPlay={handlePlay}
                onInfo={handleInfo}
                size="medium"
              />
            )}

            {/* Recently Added */}
            {recentMovies.length > 0 && (
              <MemoizedEnhancedHorizontalRow
                title="Recently Added"
                media={recentMovies}
                onPlay={handlePlay}
                onInfo={handleInfo}
                size="medium"
              />
            )}

            {/* TMDB Coming Soon */}
            <MemoizedUpcomingMovies
              showSection="upcoming"
              maxItems={12}
              className="px-4 md:px-8"
            />

            {/* TMDB Trending This Week */}
            <MemoizedUpcomingMovies
              showSection="trending_weekly"
              maxItems={10}
              className="px-4 md:px-8"
            />

            {/* TMDB Trending Daily - Bottom Section */}
            <MemoizedUpcomingMovies
              showSection="trending_daily"
              maxItems={15}
              className="px-4 md:px-8"
            />

            {/* TV Series - Airing Today */}
            <MemoizedUpcomingTVSeries
              showSection="airing_today"
              maxItems={15}
              className="px-4 md:px-8"
            />

            {/* TV Series - On the Air */}
            <MemoizedUpcomingTVSeries
              showSection="on_the_air"
              maxItems={12}
              className="px-4 md:px-8"
            />

            {/* TV Series - Trending Daily */}
            <MemoizedUpcomingTVSeries
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
          onClose={handleClosePlayer}
          startTime={0}
          onPlayNext={handlePlayNext}
        />
      )}

      {/* Widget Management Button (Development Only) */}
      <WidgetManagementButton page="home" showPerformance={true} />
    </div>
  );
}