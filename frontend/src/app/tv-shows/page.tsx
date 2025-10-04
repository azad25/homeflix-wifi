"use client";

import React, { useState, useEffect } from "react";
import { Tv, Play, Info, Plus, Check, Clock } from "lucide-react";
import { useRouter } from 'next/navigation';
import Navbar from "@/components/Navbar";
import { Media } from '../../types/media';
import VideoPlayer from "@/components/VideoPlayer";
import { getApiUrl } from '@/lib/api';
import { ScrollXHero, NetflixHorizontalRow, ParallaxSection, GradientBackground, ScrollReveal } from '@/components/scrollx';
import { Button } from "@/components/ui/button";

interface Series {
  id: number;
  title: string;
  description: string;
  rating: number;
  total_seasons: number;
  total_episodes: number;
  genres: Array<{ name: string }>;
  episodes: Media[];
}

export default function TVShowsPage() {
  const router = useRouter();
  const [featuredSeries, setFeaturedSeries] = useState<Media[]>([]);
  const [continueWatching, setContinueWatching] = useState<Media[]>([]);
  const [recentEpisodes, setRecentEpisodes] = useState<Media[]>([]);
  const [popularSeries, setPopularSeries] = useState<Media[]>([]);
  const [actionSeries, setActionSeries] = useState<Media[]>([]);
  const [dramaSeries, setDramaSeries] = useState<Media[]>([]);
  const [comedySeries, setComedySeries] = useState<Media[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    
    // Set up auto-refresh every 5 minutes for recommendations
    const interval = setInterval(() => {
      fetchData();
    }, 5 * 60 * 1000); // 5 minutes in milliseconds
    
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const apiUrl = getApiUrl();
      
      // Fetch TV shows specifically
      const tvShowsResponse = await fetch(`${apiUrl}/api/media/tv-shows`);
      const episodes = await tvShowsResponse.json();
      
      // Set featured episodes for hero section
      const sortedEpisodes = episodes.sort((a: Media, b: Media) => (b.rating || 0) - (a.rating || 0));
      setFeaturedSeries(sortedEpisodes.slice(0, 5));

      // Recent episodes
      setRecentEpisodes(episodes.sort((a: Media, b: Media) => b.id - a.id).slice(0, 20));
      
      // Popular series (represented by their episodes)
      setPopularSeries(episodes.sort((a: Media, b: Media) => (b.view_count ?? 0) - (a.view_count ?? 0)).slice(0, 20));

      // Categorize by genre
      setActionSeries(episodes.filter((e: Media) => 
        e.genres?.some(g => g.name.toLowerCase().includes('action'))
      ).slice(0, 20));
      
      setDramaSeries(episodes.filter((e: Media) => 
        e.genres?.some(g => g.name.toLowerCase().includes('drama'))
      ).slice(0, 20));
      
      setComedySeries(episodes.filter((e: Media) => 
        e.genres?.some(g => g.name.toLowerCase().includes('comedy'))
      ).slice(0, 20));
      
      setLoading(false);
    } catch (error) {
      console.error("Error fetching TV shows:", error);
      setLoading(false);
    }
  };

  const handlePlay = (media: Media, startTime?: number) => {
    setSelectedMedia(media);
    setIsPlayerOpen(true);
  };

  const handleInfo = (media: Media) => {
    router.push(`/tv-show/${media.id}`);
  };


  const formatEpisodeTitle = (media: Media) => {
    if (media.season_number && media.episode_number) {
      return `S${media.season_number}:E${media.episode_number} - ${media.title}`;
    }
    return media.title;
  };

  const parallaxCards = [
    {
      id: 1,
      title: "Binge-Worthy Series",
      description: "Complete seasons ready for your next marathon session",
      icon: <Tv />,
      variant: "default" as const,
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    },
    {
      id: 2,
      title: "Episode Tracking",
      description: "Never lose your place with automatic progress tracking",
      icon: <Clock />,
      variant: "outline" as const,
      background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    },
    {
      id: 3,
      title: "Series Discovery",
      description: "Find your next favorite show from your collection",
      icon: <Play />,
      variant: "secondary" as const,
      background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading TV Shows...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      
      {/* Hero Section */}
      {featuredSeries.length > 0 && (
        <ScrollXHero
          featuredMedia={featuredSeries}
          onPlay={handlePlay}
          onInfo={handleInfo}
        />
      )}

      {/* Main Content with Parallax Background */}
      <div className="relative bg-gradient-to-b from-red-900/20 via-black to-black">
        <div className="relative z-10 py-20">
          {/* Popular TV Shows */}
          <ParallaxSection speed={0.4}>
            <ScrollReveal direction="up" delay={0.4}>
              <NetflixHorizontalRow
                title="Popular TV Shows"
                media={popularSeries}
                onPlay={handlePlay}
                onInfo={handleInfo}
                variant="portrait"
                size="medium"
              />
            </ScrollReveal>
          </ParallaxSection>

          {/* Recent Episodes */}
          <ParallaxSection speed={0.5}>
            <ScrollReveal direction="up" delay={0.6}>
              <NetflixHorizontalRow
                title="Recently Added Episodes"
                media={recentEpisodes}
                onPlay={handlePlay}
                onInfo={handleInfo}
                variant="portrait"
                size="medium"
              />
            </ScrollReveal>
          </ParallaxSection>

          {/* Action Series */}
          {actionSeries.length > 0 && (
            <ParallaxSection speed={0.6}>
              <ScrollReveal direction="up" delay={0.8}>
                <NetflixHorizontalRow
                  title="Action & Adventure Series"
                  media={actionSeries}
                  onPlay={handlePlay}
                  onInfo={handleInfo}
                  variant="portrait"
                  size="medium"
                />
              </ScrollReveal>
            </ParallaxSection>
          )}

          {/* Drama Series */}
          {dramaSeries.length > 0 && (
            <ParallaxSection speed={0.7}>
              <ScrollReveal direction="up" delay={1.0}>
                <NetflixHorizontalRow
                  title="Drama Series"
                  media={dramaSeries}
                  onPlay={handlePlay}
                  onInfo={handleInfo}
                  variant="portrait"
                  size="medium"
                />
              </ScrollReveal>
            </ParallaxSection>
          )}

          {/* Comedy Series */}
          {comedySeries.length > 0 && (
            <ParallaxSection speed={0.8}>
              <ScrollReveal direction="up" delay={1.2}>
                <NetflixHorizontalRow
                  title="Comedy Series"
                  media={comedySeries}
                  onPlay={handlePlay}
                  onInfo={handleInfo}
                  variant="portrait"
                  size="medium"
                />
              </ScrollReveal>
            </ParallaxSection>
          )}
        </div>
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
