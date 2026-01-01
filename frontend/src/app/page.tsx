"use client";

import React, { useState, useCallback } from "react";
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

export default function Home() {
  usePageTitle('Home');
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);

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