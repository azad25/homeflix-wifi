"use client";

import React, { useState, useEffect } from "react";
import { useNavigate } from '@/hooks/useNavigate';
import Navbar from "@/components/Navbar";
import VideoPlayer from '@/components/VideoPlayer';
import RedLoader from '@/components/RedLoader';
import { getApiUrl, fetchUniqueRecommendations, preloadAssets } from '@/lib/api';
import NetflixMediaCard from '@/components/NetflixMediaCard';
import { Media } from '@/types/media';
import { ScrollXHero, ScrollXCarousel, ParallaxSection, GradientBackground, ScrollReveal } from '@/components/scrollx';
import RecentlyWatched from '@/components/RecentlyWatched';

export default function TVSeries() {
  const navigate = useNavigate();
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
      if (!apiUrl) {
        throw new Error('API URL not available');
      }
      
      // Fetch all media data
      const response = await fetch(`${apiUrl}/api/media`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const allMedia = await response.json();
      
      if (!Array.isArray(allMedia)) {
        console.warn('Expected array of media, got:', typeof allMedia);
        return;
      }

      // Helper function to extract season number
      const extractSeasonNumber = (title: string): number | null => {
        const seasonMatch = title.match(/[Ss](\d+)[Ee](\d+)|[Ss]eason\s*(\d+)/i);
        if (seasonMatch) {
          return parseInt(seasonMatch[1] || seasonMatch[3]);
        }
        return null;
      };

      // Filter for TV series/episodes only
      const allSeries = allMedia.filter((item: Media) => 
        item.type === 'episode' || 
        item.type === 'tv' || 
        item.title.toLowerCase().includes('series') ||
        item.title.toLowerCase().includes('episode')
      );

      // Group episodes by series to create series objects with seasons
      const seriesMap = new Map<string | number, any>();
      allSeries.forEach((ep: Media) => {
        const sid = ep.series_id ?? ep.series?.id ?? ep.id;
        const title = (ep.series?.title || ep.title || 'Untitled Series').replace(/\s*-\s*S\d+E\d+.*$/i, '');

        if (!seriesMap.has(sid)) {
          seriesMap.set(sid, {
            id: sid,
            title,
            description: ep.series?.description || ep.description || '',
            rating: ep.rating || 0,
            genres: ep.genres || [],
            episodes: [],
            seasons: new Map<number, any>()
          });
        }

        const series = seriesMap.get(sid)!;
        series.episodes.push(ep);

        // Extract season info
        const seasonNum = extractSeasonNumber(ep.title) || 1;
        if (!series.seasons.has(seasonNum)) {
          series.seasons.set(seasonNum, {
            season_number: seasonNum,
            episodes: []
          });
        }
        series.seasons.get(seasonNum)!.episodes.push(ep);
      });

      // Convert series map to array and process seasons
      const processedSeries = Array.from(seriesMap.values()).map(series => ({
        ...series,
        seasons: Array.from(series.seasons.values()).sort((a: any, b: any) => a.season_number - b.season_number)
      }));

      // Get high-quality series for hero section
      // Try to get TV series recommendations from enhanced backend
      let highQualitySeries: Media[] = [];
      try {
        console.log('🎬 Fetching unique TV series recommendations...');
        const recommendations = await fetchUniqueRecommendations('mixed', 30);
        
        // Filter for TV series/episodes only
        const tvContent = recommendations.filter((item: Media) => 
          item.type === 'episode' || 
          item.type === 'tv' || 
          item.type === 'series' ||
          item.title.toLowerCase().includes('series') ||
          item.title.toLowerCase().includes('episode') ||
          item.title.toLowerCase().includes('season')
        );
        
        if (tvContent.length >= 5) {
          highQualitySeries = tvContent;
          console.log(`✅ Using ${tvContent.length} unique TV recommendations from backend`);
        }
      } catch (error) {
        console.warn('⚠️ Enhanced TV recommendations failed, using fallback');
      }

      // Fallback to TV shows endpoint if recommendations don't have enough TV content
      if (highQualitySeries.length < 5) {
        try {
          const apiUrl = getApiUrl();
          if (apiUrl) {
            const tvShowsResponse = await fetch(`${apiUrl}/api/media/tv-shows?limit=20`);
            if (tvShowsResponse.ok) {
              const tvShowsData = await tvShowsResponse.json();
              if (tvShowsData && Array.isArray(tvShowsData) && tvShowsData.length > 0) {
                highQualitySeries = tvShowsData;
                console.log('✅ Using TV shows endpoint for hero section');
              }
            } else {
              console.warn(`TV shows endpoint returned ${tvShowsResponse.status}`);
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

      // Use processed series for better thumbnails, but fallback to episodes for hero
      const featuredSelection = highQualitySeries
        .sort((a: Media, b: Media) => (b.rating || 0) - (a.rating || 0))
        .slice(0, 8)
        .map(episode => {
          // Find the series this episode belongs to and use random season thumbnail
          const parentSeries = processedSeries.find(s => 
            s.episodes.some((ep: Media) => ep.id === episode.id)
          );
          
          if (parentSeries && parentSeries.seasons.length > 0) {
            // Get random season thumbnail
            const randomSeason = parentSeries.seasons[Math.floor(Math.random() * parentSeries.seasons.length)];
            if (randomSeason.episodes.length > 0) {
              const randomEpisode = randomSeason.episodes[Math.floor(Math.random() * randomSeason.episodes.length)];
              return {
                ...episode,
                thumbnail_path: randomEpisode.thumbnail_path,
                series_info: parentSeries
              };
            }
          }
          
          return episode;
        });

      setFeaturedSeries(featuredSelection.length > 0 ? featuredSelection : allSeries.slice(0, 8));
      
      // Helper function to add random season thumbnails
      const addRandomSeasonThumbnails = (episodes: Media[]) => {
        return episodes.map(episode => {
          const parentSeries = processedSeries.find(s => 
            s.episodes.some((ep: Media) => ep.id === episode.id)
          );
          
          if (parentSeries && parentSeries.seasons.length > 0) {
            const randomSeason = parentSeries.seasons[Math.floor(Math.random() * parentSeries.seasons.length)];
            if (randomSeason.episodes.length > 0) {
              const randomEpisode = randomSeason.episodes[Math.floor(Math.random() * randomSeason.episodes.length)];
              return {
                ...episode,
                thumbnail_path: randomEpisode.thumbnail_path,
                series_info: parentSeries
              };
            }
          }
          
          return episode;
        });
      };

      // Popular series (most viewed)
      const popularSeriesData = addRandomSeasonThumbnails(
        allSeries
          .sort((a: Media, b: Media) => (b.view_count || 0) - (a.view_count || 0))
          .slice(0, 20)
      );
      setPopularSeries(popularSeriesData);
      
      // Trending series (highest rated)
      const trendingSeriesData = addRandomSeasonThumbnails(
        allSeries
          .sort((a: Media, b: Media) => (b.rating || 0) - (a.rating || 0))
          .slice(0, 20)
      );
      setTrendingSeries(trendingSeriesData);
      
      // Filter by genres if available
      try {
        const comedySeriesData = allSeries.filter((item: Media) => 
          Array.isArray(item.genres) && item.genres.some(genre => 
            genre && typeof genre === 'object' && genre.name && 
            genre.name.toLowerCase().includes('comedy')
          )
        ).slice(0, 20);
        setComedySeries(addRandomSeasonThumbnails(comedySeriesData));
        
        const dramaSeriesData = allSeries.filter((item: Media) => 
          Array.isArray(item.genres) && item.genres.some(genre => 
            genre && typeof genre === 'object' && genre.name && 
            genre.name.toLowerCase().includes('drama')
          )
        ).slice(0, 20);
        setDramaSeries(addRandomSeasonThumbnails(dramaSeriesData));
      } catch (error) {
        console.error('Error filtering series by genre:', error);
        setComedySeries([]);
        setDramaSeries([]);
      }

      // Preload assets for better performance
      try {
        if (allSeries.length > 0) {
          await preloadAssets(allSeries.slice(0, 20), ['thumbnail', 'preview']);
        }
      } catch (error) {
        console.warn('Failed to preload assets:', error);
      }

    } catch (error) {
      console.error("Error fetching TV series data:", error);
      // Set empty arrays to prevent UI crashes
      setFeaturedSeries([]);
      setPopularSeries([]);
      setTrendingSeries([]);
      setComedySeries([]);
      setDramaSeries([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = (media: Media, startTime?: number) => {
    setSelectedMedia(media);
    setIsPlayerOpen(true);
  };

  const handleInfo = (media: Media) => {
    // Check if it's a TV series/episode and route accordingly
    if (media.type === 'episode' || media.type === 'tv' || media.type === 'series') {
      // If it's an episode, try to get the series ID, otherwise use the media ID
      const seriesId = media.series_id || media.id;
      navigate.push(`/tv-series/${seriesId}`);
    } else {
      navigate.push(`/movie/${media.id}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <RedLoader size="large" />
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
          onPlayNext={(nextMedia) => {
            console.log('Playing next episode:', nextMedia.title);
            setSelectedMedia(nextMedia);
            // Keep player open and switch to next episode
          }}
        />
      )}
    </div>
  );
}
