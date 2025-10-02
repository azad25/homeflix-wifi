"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Play, Info, Star, Clock, Calendar, Users } from 'lucide-react';
import Navbar from "@/components/Navbar";
import VideoPlayer from '@/components/VideoPlayer';
import ScrollXHero from '@/components/scrollx/ScrollXHero';
import RecommendationSection from '@/components/RecommendationSection';
import { getApiUrl } from '@/lib/api';
import { Media } from '@/types/media';
import GenreTitle from '@/components/GenreTitle';
import { cleanMovieTitle, findSimilarMovies } from '@/lib/titleUtils';
import { MagneticButton } from '@/components/scrollx';

export default function TVShowPage() {
  const params = useParams();
  const router = useRouter();
  const [media, setMedia] = useState<Media | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [showTitleOverlay, setShowTitleOverlay] = useState(true);
  const [isHoveringTitle, setIsHoveringTitle] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [browserInfo, setBrowserInfo] = useState<{browser: string, version: string, mobile: boolean}>({browser: '', version: '', mobile: false});
  const [relatedMedia, setRelatedMedia] = useState<Media[]>([]);

  // Browser detection for video compatibility
  useEffect(() => {
    const detectBrowser = () => {
      const ua = navigator.userAgent;
      const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
      
      let browser = 'unknown';
      let version = '0';
      
      if (ua.includes('Chrome') && !ua.includes('Edg')) {
        browser = 'chrome';
        version = ua.match(/Chrome\/(\d+)/)?.[1] || '0';
      } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
        browser = 'safari';
        version = ua.match(/Version\/(\d+)/)?.[1] || '0';
      } else if (ua.includes('Firefox')) {
        browser = 'firefox';
        version = ua.match(/Firefox\/(\d+)/)?.[1] || '0';
      } else if (ua.includes('Edg')) {
        browser = 'edge';
        version = ua.match(/Edg\/(\d+)/)?.[1] || '0';
      }
      
      setBrowserInfo({ browser, version, mobile });
      console.log('TV show page - Detected browser:', { browser, version, mobile });
    };
    
    detectBrowser();
  }, []);

  useEffect(() => {
    if (params.id) {
      fetchTVShowData(params.id as string);
    }
  }, [params.id]);

  useEffect(() => {
    if (!loading && media) {
      const timer = setTimeout(() => {
        setShowTitleOverlay(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [loading, media]);

  const fetchTVShowData = async (id: string) => {
    try {
      const apiUrl = getApiUrl();
      
      // Fetch specific TV show
      const response = await fetch(`${apiUrl}/api/media/${id}`);
      if (!response.ok) {
        throw new Error('TV show not found');
      }
      const tvShowData = await response.json();
      setMedia(tvShowData);

      // Fetch all media for related content
      const allMediaResponse = await fetch(`${apiUrl}/api/media`);
      const allMedia = await allMediaResponse.json();
      
      // Find related TV shows
      const related = findSimilarMovies(tvShowData, allMedia)
        .filter(item => item.type === 'episode' || item.type === 'tv')
        .slice(0, 12) as Media[];
      setRelatedMedia(related);

    } catch (error) {
      console.error("Error fetching TV show:", error);
      router.push('/tv-series');
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = (mediaItem?: Media) => {
    const playMedia = mediaItem || media;
    if (playMedia) {
      console.log('Playing:', playMedia.title);
      setSelectedMedia(playMedia);
      setIsPlayerOpen(true);
    }
  };

  const handleInfo = (mediaItem: Media) => {
    router.push(`/tv-show/${mediaItem.uuid}`);
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const formatFileSize = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)} GB`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading TV Show...</div>
      </div>
    );
  }

  if (!media) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">TV Show not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar onSearch={() => {}} />
      
      {/* Hero Section using ScrollXHero */}
      <ScrollXHero
        featuredMedia={[media]}
        onPlay={handlePlay}
        onInfo={() => {}}
        pageType="tv-show"
      />

      {/* Recommendations Section */}
      <div className="relative z-10 bg-black">
        <RecommendationSection 
          currentMedia={media}
          onPlay={handlePlay}
          onInfo={handleInfo}
        />
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
  );
}
