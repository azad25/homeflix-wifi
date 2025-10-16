"use client";

import React, { useState, useEffect } from "react";
import { Tv, Play, Info, Plus, Check, Clock } from "lucide-react";
import { useNavigate } from '@/hooks/useNavigate';
import Navbar from "@/components/Navbar";
import VideoPlayer from '@/components/VideoPlayer';
import RedLoader from '@/components/RedLoader';
import { getApiUrl, fetchUniqueRecommendations, preloadAssets } from '@/lib/api';
import NetflixMediaCard from '@/components/NetflixMediaCard';
import { Media } from '@/types/media';
import { ScrollXHero, ScrollXCarousel, ParallaxSection, GradientBackground, ScrollReveal } from '@/components/scrollx';
import NetflixHorizontalRow from '@/components/scrollx/NetflixHorizontalRow';
import RecentlyWatched from '@/components/RecentlyWatched';

interface Series {
  id: number | string;
  title: string;
  description?: string;
  rating?: number;
  total_seasons?: number;
  total_episodes?: number;
  genres?: Array<{ name: string }>;
  episodes: Media[];
}

export default function TVShowsPage() {
  const navigate = useNavigate();
  const [featuredSeries, setFeaturedSeries] = useState<Media[]>([]);
  const [continueWatching, setContinueWatching] = useState<Media[]>([]);
  const [recentEpisodes, setRecentEpisodes] = useState<Media[]>([]);
  const [popularSeries, setPopularSeries] = useState<Media[]>([]);
  const [seriesList, setSeriesList] = useState<Series[]>([]);
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
      
      if (!tvShowsResponse.ok) {
        throw new Error(`HTTP error! status: ${tvShowsResponse.status}`);
      }
      
      const episodes = await tvShowsResponse.json();
      
      // Ensure we have valid data
      if (!Array.isArray(episodes)) {
        console.warn("TV shows API returned non-array data:", episodes);
        setLoading(false);
        return;
      }
      
      console.log(`Fetched ${episodes.length} TV show episodes`);
      
      // If no episodes found, try fallback to all media filtered for episodes
      if (episodes.length === 0) {
        console.log("No episodes found via TV shows endpoint, trying fallback...");
        const allMediaResponse = await fetch(`${apiUrl}/api/media`);
        const allMedia = await allMediaResponse.json();
        
        const filteredEpisodes = allMedia.filter((item: Media) => 
          item.type === 'episode' || 
          item.type === 'tv' || 
          item.title.toLowerCase().includes('series') ||
          item.title.toLowerCase().includes('episode')
        );
        
        console.log(`Fallback found ${filteredEpisodes.length} episodes`);
        
        if (filteredEpisodes.length > 0) {
          const sortedEpisodes = filteredEpisodes.sort((a: Media, b: Media) => (b.rating || 0) - (a.rating || 0));
          setFeaturedSeries(sortedEpisodes.slice(0, 5));
          
          // Update other arrays with fallback data
          setRecentEpisodes(filteredEpisodes.sort((a: Media, b: Media) => b.id - a.id).slice(0, 20));
          setPopularSeries(filteredEpisodes.sort((a: Media, b: Media) => (b.view_count ?? 0) - (a.view_count ?? 0)).slice(0, 20));
          
          setActionSeries(filteredEpisodes.filter((e: Media) => 
            e.genres?.some(g => g.name.toLowerCase().includes('action'))
          ).slice(0, 20));
          
          setDramaSeries(filteredEpisodes.filter((e: Media) => 
            e.genres?.some(g => g.name.toLowerCase().includes('drama'))
          ).slice(0, 20));
          
          setComedySeries(filteredEpisodes.filter((e: Media) => 
            e.genres?.some(g => g.name.toLowerCase().includes('comedy'))
          ).slice(0, 20));
          
          setLoading(false);
          return;
        }
      }
      
      // Build series groups from episodes so we can render a carousel per series
      const seriesMap = new Map<string | number, Series>();
      episodes.forEach((ep: Media) => {
        // Prefer explicit series_id, then embedded series object, else fallback to media id
        const sid = ep.series_id ?? ep.series?.id ?? ep.id;
        const title = (ep.series?.title || ep.title || 'Untitled Series');

        if (!seriesMap.has(sid)) {
          seriesMap.set(sid, {
            id: sid as number | string,
            title,
            description: ep.series?.description || ep.description || '',
            rating: ep.rating || 0,
            total_seasons: ep.series?.total_seasons,
            total_episodes: ep.series?.total_episodes,
            genres: ep.genres || [],
            episodes: []
          });
        }

        const group = seriesMap.get(sid)!;
        group.episodes.push(ep);
      });

      // Convert to array and sort series by number of episodes (desc) and latest episode id
      const allSeries = Array.from(seriesMap.values())
        .map(s => ({
          ...s,
          episodes: s.episodes.sort((a, b) => (b.id || 0) - (a.id || 0))
        }))
        .sort((a, b) => b.episodes.length - a.episodes.length || (b.episodes[0]?.id || 0) - (a.episodes[0]?.id || 0));

      setSeriesList(allSeries);

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
    // Route to TV series detail page
    // If it's an episode, try to get the series ID, otherwise use the media ID
    const seriesId = media.series_id || media.id;
    navigate.push(`/tv-series/${seriesId}`);
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
        <RedLoader size="large" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      
      {/* Hero Section */}
      {featuredSeries.length > 0 ? (
        <ScrollXHero
          featuredMedia={featuredSeries}
          onPlay={handlePlay}
          onInfo={handleInfo}
        />
      ) : (
        !loading && (
          <div className="h-96 bg-gradient-to-r from-red-900/50 to-black flex items-center justify-center">
            <div className="text-center text-white">
              <h2 className="text-2xl font-bold mb-2">No TV Shows Found</h2>
              <p className="text-gray-400">No TV show episodes are available in your library.</p>
            </div>
          </div>
        )
      )}

      {/* Main Content with Parallax Background */}
      <div className="relative bg-gradient-to-b from-red-900/20 via-black to-black" style={{ overflow: 'visible' }}>
        <div className="relative z-10 py-12" style={{ overflow: 'visible' }}>
          {/* Series carousels - one row per series title */}
          {seriesList.length > 0 && (
            <div>
              {seriesList.slice(0, 12).map((series) => (
                <ParallaxSection key={series.id} speed={0.4}>
                  <ScrollReveal direction="up" delay={0.2}>
                    <NetflixHorizontalRow
                      title={series.title}
                      media={series.episodes}
                      onPlay={handlePlay}
                      onInfo={handleInfo}
                      variant="portrait"
                      size="medium"
                    />
                  </ScrollReveal>
                </ParallaxSection>
              ))}
            </div>
          )}

          {/* Season carousels for each series (grouped by season_number) */}
          {seriesList.length > 0 && (
            <div>
              {seriesList.slice(0, 12).map((series) => (
                <div key={`seasons-${series.id}`}>
                  {/* Build seasons map for this series */}
                  {(() => {
                    const seasonsMap = new Map<number, Media[]>();
                    series.episodes.forEach((ep) => {
                      const sn = (ep.season_number ?? ep.season ?? 1) as number;
                      if (!seasonsMap.has(sn)) seasonsMap.set(sn, []);
                      seasonsMap.get(sn)!.push(ep);
                    });

                    const seasons = Array.from(seasonsMap.entries()).sort((a, b) => a[0] - b[0]);

                    return seasons.map(([seasonNum, eps]) => (
                      <ParallaxSection key={`${series.id}-season-${seasonNum}`} speed={0.45}>
                        <ScrollReveal direction="up" delay={0.25}>
                          <NetflixHorizontalRow
                            title={`${series.title} — Season ${seasonNum}`}
                            media={eps.sort((a, b) => (b.episode_number ?? 0) - (a.episode_number ?? 0))}
                            onPlay={handlePlay}
                            onInfo={handleInfo}
                            variant="portrait"
                            size="small"
                            showTitle={true}
                          />
                        </ScrollReveal>
                      </ParallaxSection>
                    ));
                  })()}
                </div>
              ))}
            </div>
          )}

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
