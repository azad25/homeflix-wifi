"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from 'next/navigation';
import Navbar from "@/components/Navbar";
import VideoPlayer from '@/components/VideoPlayer';
import { getApiUrl } from '@/lib/api';
import { Media } from '@/types/media';
import { ScrollXHero, ScrollXCarousel, ParallaxSection, GradientBackground, ScrollReveal } from '@/components/scrollx';
import RecentlyWatched from '@/components/RecentlyWatched';

export default function TVSeries() {
  const router = useRouter();
  const [featuredSeries, setFeaturedSeries] = useState<Media[]>([]);
  const [popularSeries, setPopularSeries] = useState<Media[]>([]);
  const [trendingSeries, setTrendingSeries] = useState<Media[]>([]);
  const [comedySeries, setComedySeries] = useState<Media[]>([]);
  const [dramaSeries, setDramaSeries] = useState<Media[]>([]);
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
      
      // Fetch all media data
      const response = await fetch(`${apiUrl}/api/media`);
      const allMedia = await response.json();

      // Filter for TV series/episodes only
      const allSeries = allMedia.filter((item: Media) => 
        item.type === 'episode' || 
        item.type === 'tv' || 
        item.title.toLowerCase().includes('series') ||
        item.title.toLowerCase().includes('episode')
      );

      // Get high-quality series for hero section
      // Try to get TV series recommendations from backend first
      let highQualitySeries: Media[] = [];
      try {
        const recommendationEndpoints = [
          `${getApiUrl()}/api/recommendations/personalized?limit=20`,
          `${getApiUrl()}/api/recommendations/mixed?limit=20`,
          `${getApiUrl()}/api/recommendations/trending?limit=20`,
          `${getApiUrl()}/api/recommendations/recent?limit=20`
        ];

        for (const endpoint of recommendationEndpoints) {
          try {
            const recommendationResponse = await fetch(endpoint);
            if (recommendationResponse.ok) {
              const recommendedData = await recommendationResponse.json();
              if (recommendedData && Array.isArray(recommendedData) && recommendedData.length > 0) {
                // Filter for TV series/episodes only
                const tvContent = recommendedData.filter((item: Media) => 
                  item.type === 'episode' || 
                  item.type === 'tv' || 
                  item.type === 'series' ||
                  item.title.toLowerCase().includes('series') ||
                  item.title.toLowerCase().includes('episode') ||
                  item.title.toLowerCase().includes('season')
                );
                
                if (tvContent.length >= 5) {
                  highQualitySeries = tvContent;
                  console.log(`✅ Using backend recommendations for TV series from ${endpoint}`);
                  break;
                }
              }
            }
          } catch (error) {
            console.warn(`❌ Failed to fetch TV recommendations from ${endpoint}:`, error);
            continue;
          }
        }
      } catch (error) {
        console.warn('⚠️ Backend recommendations failed for TV series, using fallback');
      }

      // Fallback to TV shows endpoint if recommendations don't have enough TV content
      if (highQualitySeries.length < 5) {
        try {
          const tvShowsResponse = await fetch(`${getApiUrl()}/api/media/tv-shows?limit=20`);
          if (tvShowsResponse.ok) {
            const tvShowsData = await tvShowsResponse.json();
            if (tvShowsData && Array.isArray(tvShowsData) && tvShowsData.length > 0) {
              highQualitySeries = tvShowsData;
              console.log('✅ Using TV shows endpoint for hero section');
            }
          }
        } catch (error) {
          console.warn('❌ TV shows endpoint failed:', error);
        }
      }

      // Final fallback to filtered allSeries
      if (highQualitySeries.length === 0) {
        highQualitySeries = allSeries
          .filter((item: Media) => (item.rating || 0) >= 6.0)
          .slice(0, 10);
      }

      const featuredSelection = highQualitySeries
        .sort((a: Media, b: Media) => (b.rating || 0) - (a.rating || 0))
        .slice(0, 8);

      setFeaturedSeries(featuredSelection.length > 0 ? featuredSelection : allSeries.slice(0, 8));
      
      // Popular series (most viewed)
      const popularSeriesData = allSeries
        .sort((a: Media, b: Media) => (b.view_count || 0) - (a.view_count || 0))
        .slice(0, 20);
      setPopularSeries(popularSeriesData);
      
      // Trending series (highest rated)
      const trendingSeriesData = allSeries
        .sort((a: Media, b: Media) => (b.rating || 0) - (a.rating || 0))
        .slice(0, 20);
      setTrendingSeries(trendingSeriesData);
      
      // Filter by genres if available
      setComedySeries(allSeries.filter((item: Media) => 
        item.genres?.some(genre => genre.name.toLowerCase().includes('comedy'))
      ).slice(0, 20));
      
      setDramaSeries(allSeries.filter((item: Media) => 
        item.genres?.some(genre => genre.name.toLowerCase().includes('drama'))
      ).slice(0, 20));

    } catch (error) {
      console.error("Error fetching TV series data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = (media: Media, startTime?: number) => {
    setSelectedMedia(media);
    setIsPlayerOpen(true);
  };

  const handleInfo = (media: Media) => {
    router.push(`/movie/${media.id}`);
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
          enableRecommendations={true}
          refreshInterval={300000}
          contentFilter="tv-series"
        />
      )}

      {/* Main Content with Parallax Background */}
      <GradientBackground variant="aurora" animate={true} className="relative">
        <div className="relative z-10 py-20">
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
