"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from 'next/navigation';
import Navbar from "@/components/Navbar";
import VideoPlayer from '@/components/VideoPlayer';
import { getApiUrl } from '@/lib/api';
import { Media } from '@/types/media';
import { ScrollXHero, ScrollXCarousel, ParallaxSection, GradientBackground, ScrollReveal } from '@/components/scrollx';
import RecentlyWatched from '@/components/RecentlyWatched';
import ContinueWatching from '@/components/ContinueWatching';
import RecommendedContent from '@/components/RecommendedContent';
import { useRecommendations } from '@/contexts/RecommendationContext';

export default function TVSeries() {
  const router = useRouter();
  const { refreshRecommendations, trackClick } = useRecommendations();
  const [featuredSeries, setFeaturedSeries] = useState<Media[]>([]);
  const [popularSeries, setPopularSeries] = useState<Media[]>([]);
  const [trendingSeries, setTrendingSeries] = useState<Media[]>([]);
  const [comedySeries, setComedySeries] = useState<Media[]>([]);
  const [dramaSeries, setDramaSeries] = useState<Media[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTVSeriesData();
  }, []);

  const fetchTVSeriesData = async () => {
    try {
      const apiUrl = getApiUrl();
      
      // Fetch TV series data
      const [seriesResponse, popularResponse] = await Promise.all([
        fetch(`${apiUrl}/api/media/tv-shows`),
        fetch(`${apiUrl}/api/media/popular`)
      ]);

      const seriesData = await seriesResponse.json();
      const popularData = await popularResponse.json();

      // Filter for TV series only
      const allSeries = seriesData.media || [];
      const popularSeriesData = (popularData.media || []).filter((item: Media) => 
        item.type === 'tv' || item.title.toLowerCase().includes('series')
      );

      setFeaturedSeries(allSeries.slice(0, 5));
      setPopularSeries(popularSeriesData.slice(0, 20));
      setTrendingSeries(allSeries.slice(5, 25));
      
      // Filter by genres if available
      setComedySeries(allSeries.filter((item: Media) => 
        item.genres?.some(genre => genre.name.toLowerCase().includes('comedy'))
      ).slice(0, 20));
      
      setDramaSeries(allSeries.filter((item: Media) => 
        item.genres?.some(genre => genre.name.toLowerCase().includes('drama'))
      ).slice(0, 20));
      
      // Refresh recommendations with TV series data
      refreshRecommendations([...allSeries, ...popularSeriesData]);

    } catch (error) {
      console.error("Error fetching TV series data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = (media: Media, startTime?: number) => {
    trackClick(media.id, 'play', 'tv-series');
    setSelectedMedia(media);
    setIsPlayerOpen(true);
  };

  const handleInfo = (media: Media) => {
    trackClick(media.id, 'info', 'tv-series');
    router.push(`/tv-show/${media.uuid}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading TV Series...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar onSearch={() => {}} />

      {/* Hero Section */}
      {featuredSeries.length > 0 && (
        <ScrollXHero
          featuredMedia={featuredSeries}
          onPlay={handlePlay}
          onInfo={handleInfo}
          pageType="tv-series"
        />
      )}

      {/* Main Content with Parallax Background */}
      <GradientBackground variant="aurora" animate={true} className="relative">
        <div className="relative z-10 py-20">
          {/* Continue Watching TV Series */}
          <ParallaxSection speed={0.2}>
            <ScrollReveal direction="up" delay={0.1}>
              <ContinueWatching
                onPlay={handlePlay}
                onInfo={handleInfo}
              />
            </ScrollReveal>
          </ParallaxSection>
          
          {/* Recommended TV Series */}
          <ParallaxSection speed={0.25}>
            <ScrollReveal direction="up" delay={0.15}>
              <RecommendedContent
                allMedia={[...popularSeries, ...trendingSeries, ...comedySeries, ...dramaSeries]}
                onPlay={handlePlay}
                onInfo={handleInfo}
              />
            </ScrollReveal>
          </ParallaxSection>

          {/* Recently Watched TV Series */}
          <ParallaxSection speed={0.3}>
            <ScrollReveal direction="up" delay={0.2}>
              <RecentlyWatched
                onPlay={handlePlay}
                onInfo={handleInfo}
              />
            </ScrollReveal>
          </ParallaxSection>

          {/* Popular TV Series */}
          <ParallaxSection speed={0.4}>
            <ScrollReveal direction="up" delay={0.4}>
              <ScrollXCarousel
                title="Popular TV Series"
                media={popularSeries}
                onPlay={handlePlay}
                onInfo={handleInfo}
                priority={true}
                variant="glass"
              />
            </ScrollReveal>
          </ParallaxSection>

          {/* Trending Now */}
          <ParallaxSection speed={0.5}>
            <ScrollReveal direction="up" delay={0.6}>
              <ScrollXCarousel
                title="Trending TV Series"
                media={trendingSeries}
                onPlay={handlePlay}
                onInfo={handleInfo}
                variant="gradient"
              />
            </ScrollReveal>
          </ParallaxSection>

          {/* Comedy Series */}
          {comedySeries.length > 0 && (
            <ParallaxSection speed={0.6}>
              <ScrollReveal direction="up" delay={0.8}>
                <ScrollXCarousel
                  title="Comedy Series"
                  media={comedySeries}
                  onPlay={handlePlay}
                  onInfo={handleInfo}
                  variant="solid"
                />
              </ScrollReveal>
            </ParallaxSection>
          )}

          {/* Drama Series */}
          {dramaSeries.length > 0 && (
            <ParallaxSection speed={0.7}>
              <ScrollReveal direction="up" delay={1.0}>
                <ScrollXCarousel
                  title="Drama Series"
                  media={dramaSeries}
                  onPlay={handlePlay}
                  onInfo={handleInfo}
                  variant="glass"
                />
              </ScrollReveal>
            </ParallaxSection>
          )}
        </div>
      </GradientBackground>

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
