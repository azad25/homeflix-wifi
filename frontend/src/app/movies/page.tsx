"use client";

import React, { useState, useCallback } from "react";
import { usePageTitle } from '@/hooks/usePageTitle';
import { useNavigate } from '@/hooks/useNavigate';
import Navbar from "@/components/Navbar";
import { Media } from '../../types/media';
import VideoPlayer from "@/components/VideoPlayer";
import { WidgetManagementButton } from '@/components/widgets';
import BackendWidgetRenderer from '@/components/widgets/BackendWidgetRenderer';
import ErrorBoundary from "@/components/ErrorBoundary";

export default function MoviesPage() {
  usePageTitle('Movies');
  const navigate = useNavigate();
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);

  // Memoized event handlers
  const handlePlay = useCallback((media: Media, startTime?: number) => {
    setSelectedMedia(media);
    setIsPlayerOpen(true);
  }, []);

  const handleInfo = useCallback((media: Media) => {
    navigate.push(`/movie/${media.id}`);
  }, [navigate]);

  const handleClosePlayer = useCallback(() => {
    setIsPlayerOpen(false);
  }, []);

  const handlePlayNext = useCallback((nextMedia: Media) => {
    setSelectedMedia(nextMedia);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar onSearch={() => {}} />

      {/* Widget System Integration */}
      <ErrorBoundary>
        <BackendWidgetRenderer 
          page="movies" 
          className="py-8 mt-12 px-3 md:px-6 lg:px-8"
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
      <WidgetManagementButton page="movies" showPerformance={true} />
    </div>
  );
}
