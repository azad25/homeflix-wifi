"use client";

import React, { useState, useEffect } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { motion } from 'framer-motion';
import { Media } from '@/types/media';
import { ScrollXHero } from '@/components/scrollx';
import { NewContentSection } from '@/components/sections/NewContentSection';
import { PopularContentSection } from '@/components/sections/PopularContentSection';
import { TrendingSection } from '@/components/sections/TrendingSection';
import { apiCall, preloadAssets } from '@/lib/api';
import Navbar from '@/components/Navbar';
import RedLoader from '@/components/RedLoader';
import UpcomingMovies from '@/components/UpcomingMovies';
import UpcomingTVSeries from '@/components/UpcomingTVSeries';
import { useRouter } from 'next/navigation';
import { useNavigate } from '@/hooks/useNavigate';

const NewPopularPage: React.FC = () => {
  usePageTitle('New & Popular');
  const router = useRouter();
  const navigate = useNavigate();
  const [featuredMedia, setFeaturedMedia] = useState<Media[]>([]);
  const [newContent, setNewContent] = useState<Media[]>([]);
  const [popularContent, setPopularContent] = useState<Media[]>([]);
  const [trendingContent, setTrendingContent] = useState<Media[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch content using enhanced recommendation APIs (no episodes included)
        const [
          recentMovies,
          popularMovies,
          trendingMovies
        ] = await Promise.all([
          apiCall('/api/recommendations/recent?limit=20'),
          apiCall('/api/recommendations/popular?limit=20'),
          apiCall('/api/recommendations/trending?limit=20')
        ]);

        // Ensure we have content
        if (!recentMovies?.length && !popularMovies?.length && !trendingMovies?.length) {
          throw new Error('No content available');
        }

        // Get featured content (mix of trending and popular for hero section)
        const featured = [
          ...(trendingMovies?.slice(0, 3) || []),
          ...(popularMovies?.slice(0, 2) || [])
        ].slice(0, 5);

        setFeaturedMedia(featured);
        setNewContent(recentMovies || []);
        setPopularContent(popularMovies || []);
        setTrendingContent(trendingMovies || []);

        // Preload assets for better performance (poster first, then thumbnail, then preview)
        const allContentForPreload = [
          ...featured,
          ...(recentMovies?.slice(0, 10) || []),
          ...(popularMovies?.slice(0, 10) || []),
          ...(trendingMovies?.slice(0, 10) || [])
        ];

        if (allContentForPreload.length > 0) {
          preloadAssets(allContentForPreload, ['poster', 'thumbnail', 'preview']);
        }

      } catch (err) {
        console.error('Error fetching content:', err);
        setError(err instanceof Error ? err.message : 'Failed to load content');
      } finally {
        setIsLoading(false);
      }
    };

    fetchContent();
  }, []);

  const handlePlay = (media: Media) => {
    navigate.push(`/movie/${media.id}`);
  };

  const handleInfo = (media: Media) => {
    navigate.push(`/movie/${media.id}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <RedLoader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Something went wrong</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black overflow-visible">
      <Navbar />
      
      {/* Hero Section */}
      {featuredMedia.length > 0 && (
        <ScrollXHero
          featuredMedia={featuredMedia}
          onPlay={handlePlay}
          onInfo={handleInfo}
          contentFilter="movies-hd"
          enableRecommendations={true}
        />
      )}

      {/* Content Sections */}
      <div className="relative z-10 -mt-32 overflow-visible">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="space-y-12 pb-20 overflow-visible"
        >
          {/* New Releases Section */}
          <NewContentSection 
            media={newContent}
            onMediaClick={handlePlay}
          />

          {/* Popular Content Section */}
          <PopularContentSection 
            media={popularContent}
            onMediaClick={handlePlay}
          />

          {/* Trending Section */}
          <TrendingSection 
            media={trendingContent}
            onMediaClick={handlePlay}
          />

          {/* TMDB Now Playing in Theaters */}
          <UpcomingMovies 
            showSection="now_playing"
            maxItems={15}
            className="px-4 md:px-8"
          />

          {/* TMDB Coming Soon */}
          <UpcomingMovies 
            showSection="upcoming"
            maxItems={12}
            className="px-4 md:px-8"
          />

          {/* TMDB Trending Weekly */}
          <UpcomingMovies 
            showSection="trending_weekly"
            maxItems={10}
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
        </motion.div>
      </div>
    </div>
  );
};

export default NewPopularPage;
