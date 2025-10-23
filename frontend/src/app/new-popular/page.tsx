"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Media } from '@/types/media';
import { ScrollXHero } from '@/components/scrollx';
import { NewContentSection } from '@/components/sections/NewContentSection';
import { PopularContentSection } from '@/components/sections/PopularContentSection';
import { TrendingSection } from '@/components/sections/TrendingSection';
import { apiCall, preloadAssets } from '@/lib/api';
import Navbar from '@/components/Navbar';
import RedLoader from '@/components/RedLoader';
import { useRouter } from 'next/navigation';
import { useNavigate } from '@/hooks/useNavigate';

const NewPopularPage: React.FC = () => {
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

        // Fetch movies only for New & Popular page
        const allMovies: Media[] = await apiCall('/api/media/movies?limit=100');

        if (allMovies.length === 0) {
          throw new Error('No movie content available');
        }

        // Sort by creation date for new content (most recent first)
        const sortedByDate = [...allMovies].sort((a, b) => {
          const dateA = new Date(a.created_at || 0).getTime();
          const dateB = new Date(b.created_at || 0).getTime();
          return dateB - dateA;
        });

        // Sort by view count for popular content
        const sortedByViews = [...allMovies].sort((a, b) => {
          return (b.view_count || 0) - (a.view_count || 0);
        });

        // Sort by rating for trending content
        const sortedByRating = [...allMovies].sort((a, b) => {
          return (b.rating || 0) - (a.rating || 0);
        });

        // Get featured content (top movies for hero section)
        const featured = [
          ...sortedByDate.slice(0, 3),
          ...sortedByViews.slice(0, 2)
        ].slice(0, 5);

        setFeaturedMedia(featured);
        setNewContent(sortedByDate.slice(0, 20));
        setPopularContent(sortedByViews.slice(0, 20));
        setTrendingContent(sortedByRating.slice(0, 20));

        // Preload assets for better performance (poster first, then thumbnail, then preview)
        const allContentForPreload = [
          ...featured,
          ...sortedByDate.slice(0, 10),
          ...sortedByViews.slice(0, 10),
          ...sortedByRating.slice(0, 10)
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
        </motion.div>
      </div>
    </div>
  );
};

export default NewPopularPage;
