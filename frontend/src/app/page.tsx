"use client";

import React, { useState, useCallback, useEffect } from "react";
import { usePageTitle } from '@/hooks/usePageTitle';
import { useNavigate } from '@/hooks/useNavigate';
import Navbar from "@/components/Navbar";
import VideoPlayer from '@/components/VideoPlayer';
import { Media } from '@/types/media';
import HomeflixHero from '@/components/HomeflixHero';
import { WidgetManagementButton } from '@/components/widgets';
import BackendWidgetRenderer from '@/components/widgets/BackendWidgetRenderer';
import ErrorBoundary from "@/components/ErrorBoundary";

// Memoized components for better performance
const MemoizedHomeflixHero = React.memo(HomeflixHero);

import { getApiUrl } from "@/lib/api";

export default function Home() {
  usePageTitle('Home');
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);

  // Check if there's a custom home page and redirect
  useEffect(() => {
    const checkHomePage = async () => {
      // Only run this check once when the component mounts
      // and only if we're actually on the root path
      if (window.location.pathname !== '/') {
        return;
      }

      try {
        const apiUrl = getApiUrl();
        const response = await fetch(`${apiUrl}/api/pages/home`);
        if (response.ok) {
          const data = await response.json();
          
          // Handle two response formats:
          // 1. When no home page: {"home_page": null}
          // 2. When home page exists: {page object with slug, title, etc.}
          
          let customPage = null;
          if (data.home_page === null) {
            // No custom home page set, stay on default home
            return;
          } else if (data.slug) {
            // Direct page object response
            customPage = data;
          }
          
          // Only redirect if we have a valid custom page with a slug
          if (customPage && customPage.slug && customPage.slug !== 'home' && customPage.slug !== '') {
            // Use replace instead of push to avoid adding to history
            navigate.replace(`/${customPage.slug}`);
          }
        }
      } catch (error) {
        console.error('Failed to fetch home page:', error);
        // On error, stay on default home page
      }
    };
    
    // Only run once on mount
    checkHomePage();
  }, []); // Empty dependency array means this only runs once

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