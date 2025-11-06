"use client";

import React, { useState, useEffect } from "react";
import { usePageTitle } from '@/hooks/usePageTitle';
import { Play, Info, Star } from "lucide-react";
import { useNavigate } from '@/hooks/useNavigate';
import Navbar from "@/components/Navbar";
import VideoPlayer from '@/components/VideoPlayer';
import RedLoader from '@/components/RedLoader';
import { getApiUrl, fetchUniqueRecommendations, preloadAssets } from '@/lib/api';

import { Media } from '@/types/media';
import { ScrollXHero, ParallaxSection, ScrollReveal } from '@/components/scrollx';


interface Series {
  id: number | string;
  title: string;
  description?: string;
  rating?: number;
  total_seasons?: number;
  total_episodes?: number;
  genres?: Array<{ name: string }>;
  episodes: Media[];
  seasons: Season[];
  thumbnail_path?: string;
  banner_path?: string;
  poster_path?: string;
}

interface Season {
  id: number;
  season_number: number;
  name: string;
  episode_count: number;
  episodes: Media[];
  thumbnail_path?: string;
}

export default function TVShowsPage() {
  usePageTitle('TV Shows');
  const navigate = useNavigate();
  const [featuredSeries, setFeaturedSeries] = useState<Series[]>([]);
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [actionSeries, setActionSeries] = useState<Series[]>([]);
  const [dramaSeries, setDramaSeries] = useState<Series[]>([]);
  const [comedySeries, setComedySeries] = useState<Series[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);



  const extractSeasonNumber = (title: string): number | null => {
    const seasonMatch = title.match(/[Ss](\d+)[Ee](\d+)|[Ss]eason\s*(\d+)/i);
    if (seasonMatch) {
      return parseInt(seasonMatch[1] || seasonMatch[3]);
    }
    return null;
  };

  const extractEpisodeNumber = (title: string): number | null => {
    const episodeMatch = title.match(/[Ss](\d+)[Ee](\d+)|[Ee]pisode\s*(\d+)/i);
    if (episodeMatch) {
      return parseInt(episodeMatch[2] || episodeMatch[3]);
    }
    return null;
  };

  const handlePlayNext = (nextMedia: Media) => {
    setSelectedMedia(nextMedia);
    setIsPlayerOpen(true);
  };

  useEffect(() => {
    fetchData();

    // Set up auto-refresh every 5 minutes for recommendations
    const interval = setInterval(() => {
      fetchData();
      setRefreshKey(prev => prev + 1); // Force refresh of cached assets
    }, 5 * 60 * 1000); // 5 minutes in milliseconds

    return () => clearInterval(interval);
  }, []);

  // Add manual refresh function for debugging
  const forceRefresh = () => {
    setLoading(true);
    setRefreshKey(prev => prev + 1);
    fetchData();
  };

  // Helper function to generate poster URL with cache busting
  const getPosterUrl = (seriesId: number | string) => {
    return `${getApiUrl()}/api/posters/${seriesId}?v=${refreshKey}`;
  };

  const fetchData = async () => {
    try {
      const apiUrl = getApiUrl();

      // First try to fetch series using the proper hierarchical API
      try {
        const seriesResponse = await fetch(`${apiUrl}/api/series`);

        if (seriesResponse.ok) {
          const seriesData = await seriesResponse.json();
          console.log(`Fetched ${seriesData.length} TV series from /api/series`);

          if (Array.isArray(seriesData) && seriesData.length > 0) {
            // Process series data and fetch seasons for each
            const processedSeries = await Promise.all(
              seriesData.map(async (series: any) => {
                try {
                  // Fetch seasons for this series
                  const seasonsResponse = await fetch(`${apiUrl}/api/series/${series.id}/seasons`);
                  const seasons = seasonsResponse.ok ? await seasonsResponse.json() : [];

                  return {
                    id: series.id,
                    title: series.title || series.name || 'Untitled Series',
                    description: series.description || series.overview || '',
                    rating: series.rating || series.vote_average || 0,
                    total_seasons: series.total_seasons || seasons.length || 0,
                    total_episodes: series.total_episodes || 0,
                    genres: series.genres || [],
                    episodes: [], // Episodes will be in seasons
                    seasons: await Promise.all(seasons.map(async (season: any) => {
                      // Fetch episodes for this season
                      try {
                        const episodesResponse = await fetch(`${apiUrl}/api/series/${series.id}/seasons/${season.season_number || season.id}/episodes`);
                        const seasonEpisodes = episodesResponse.ok ? await episodesResponse.json() : [];

                        return {
                          id: season.id || season.season_number,
                          season_number: season.season_number || season.id,
                          name: season.name || `Season ${season.season_number || season.id}`,
                          episode_count: season.episode_count || seasonEpisodes.length || 0,
                          episodes: seasonEpisodes.map((ep: any) => ({
                            id: ep.id,
                            title: ep.title || ep.name,
                            thumbnail_path: ep.thumbnail_path || ep.still_path,
                            description: ep.description || ep.overview
                          })),
                          thumbnail_path: season.poster_path || season.thumbnail_path
                        };
                      } catch (error) {
                        console.warn(`Error fetching episodes for season ${season.season_number}:`, error);
                        return {
                          id: season.id || season.season_number,
                          season_number: season.season_number || season.id,
                          name: season.name || `Season ${season.season_number || season.id}`,
                          episode_count: season.episode_count || 0,
                          episodes: [],
                          thumbnail_path: season.poster_path || season.thumbnail_path
                        };
                      }
                    })),
                    thumbnail_path: series.poster_path || series.thumbnail_path,
                    banner_path: series.backdrop_path || series.banner_path,
                    poster_path: series.poster_path
                  } as Series;
                } catch (error) {
                  console.warn(`Error processing series ${series.id}:`, error);
                  return {
                    id: series.id,
                    title: series.title || series.name || 'Untitled Series',
                    description: series.description || '',
                    rating: series.rating || 0,
                    genres: series.genres || [],
                    episodes: [],
                    seasons: [],
                    total_seasons: 0,
                    total_episodes: 0
                  } as Series;
                }
              })
            );

            setSeriesList(processedSeries);
            setFeaturedSeries(processedSeries.slice(0, 5));

            // Categorize series by genre
            setActionSeries(processedSeries.filter(series =>
              series.genres?.some(g => g.name.toLowerCase().includes('action'))
            ).slice(0, 10));

            setDramaSeries(processedSeries.filter(series =>
              series.genres?.some(g => g.name.toLowerCase().includes('drama'))
            ).slice(0, 10));

            setComedySeries(processedSeries.filter(series =>
              series.genres?.some(g => g.name.toLowerCase().includes('comedy'))
            ).slice(0, 10));

            setLoading(false);
            return;
          }
        }
      } catch (error) {
        console.warn("Series API not available, falling back to episodes:", error);
      }

      // Fallback: Fetch TV episodes and build series from them
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
          // Build fallback series from filtered episodes
          const fallbackSeriesMap = new Map<string, Series>();

          filteredEpisodes.forEach((ep: Media) => {
            const title = ep.title.replace(/\s*-\s*S\d+E\d+.*$/i, '');

            if (!fallbackSeriesMap.has(title)) {
              fallbackSeriesMap.set(title, {
                id: ep.id,
                title,
                description: ep.description || '',
                rating: ep.rating || 0,
                genres: ep.genres || [],
                episodes: [],
                seasons: [],
                thumbnail_path: ep.thumbnail_path,
                banner_path: ep.banner_path,
                poster_path: ep.thumbnail_path
              });
            }

            fallbackSeriesMap.get(title)!.episodes.push(ep);
          });

          const fallbackSeries = Array.from(fallbackSeriesMap.values());
          setFeaturedSeries(fallbackSeries.slice(0, 5));
          setSeriesList(fallbackSeries);
          setLoading(false);
          return;
        }
      }

      // Build series groups from episodes
      const seriesMap = new Map<string | number, Series>();
      episodes.forEach((ep: Media) => {
        // Extract series info - prefer explicit series_id, then embedded series object, else fallback to media id
        const sid = ep.series_id ?? ep.series?.id ?? ep.id;
        const title = (ep.series?.title || ep.title || 'Untitled Series').replace(/\s*-\s*S\d+E\d+.*$/i, '');

        if (!seriesMap.has(sid)) {
          seriesMap.set(sid, {
            id: sid as number | string,
            title,
            description: ep.series?.description || ep.description || '',
            rating: ep.rating || 0,
            total_seasons: ep.series?.total_seasons,
            total_episodes: ep.series?.total_episodes,
            genres: ep.genres || [],
            episodes: [],
            seasons: [],
            thumbnail_path: ep.thumbnail_path,
            banner_path: ep.banner_path,
            poster_path: ep.thumbnail_path
          });
        }

        const group = seriesMap.get(sid)!;
        group.episodes.push(ep);
      });

      // Process each series to build seasons
      const allSeries = Array.from(seriesMap.values()).map(series => {
        // Group episodes by season
        const seasonMap = new Map<number, Season>();

        series.episodes.forEach(ep => {
          const seasonNum = extractSeasonNumber(ep.title) || 1;

          if (!seasonMap.has(seasonNum)) {
            seasonMap.set(seasonNum, {
              id: seasonNum,
              season_number: seasonNum,
              name: `Season ${seasonNum}`,
              episode_count: 0,
              episodes: [],
              thumbnail_path: ep.thumbnail_path
            });
          }

          const season = seasonMap.get(seasonNum)!;
          season.episodes.push(ep);
          season.episode_count = season.episodes.length;
        });

        // Convert seasons map to array and sort
        const seasons = Array.from(seasonMap.values())
          .sort((a, b) => a.season_number - b.season_number);

        // Sort episodes within each season
        seasons.forEach(season => {
          season.episodes.sort((a, b) => {
            const aEp = extractEpisodeNumber(a.title) || 0;
            const bEp = extractEpisodeNumber(b.title) || 0;
            return aEp - bEp;
          });
        });

        return {
          ...series,
          seasons,
          episodes: series.episodes.sort((a, b) => (b.id || 0) - (a.id || 0)),
          total_seasons: seasons.length,
          total_episodes: series.episodes.length
        };
      }).sort((a, b) => b.episodes.length - a.episodes.length || (b.episodes[0]?.id || 0) - (a.episodes[0]?.id || 0));

      setSeriesList(allSeries);

      // Set featured series for hero section (top rated series)
      const featuredSeriesList = allSeries
        .sort((a, b) => (b.rating || 0) - (a.rating || 0))
        .slice(0, 5);
      setFeaturedSeries(featuredSeriesList);

      // Categorize series by genre
      setActionSeries(allSeries.filter(series =>
        series.genres?.some(g => g.name.toLowerCase().includes('action'))
      ).slice(0, 10));

      setDramaSeries(allSeries.filter(series =>
        series.genres?.some(g => g.name.toLowerCase().includes('drama'))
      ).slice(0, 10));

      setComedySeries(allSeries.filter(series =>
        series.genres?.some(g => g.name.toLowerCase().includes('comedy'))
      ).slice(0, 10));

      setLoading(false);
    } catch (error) {
      console.error("Error fetching TV shows:", error);
      setLoading(false);
    }
  };

  const handlePlay = (media: Media | Series, startTime?: number) => {
    if ('seasons' in media) {
      // If it's a series, find the first episode from the first season
      const firstSeason = media.seasons.find(season => season.episodes.length > 0);
      if (firstSeason && firstSeason.episodes.length > 0) {
        // Convert the episode data to Media format
        const firstEpisode = firstSeason.episodes[0];
        setSelectedMedia({
          id: firstEpisode.id,
          title: firstEpisode.title,
          thumbnail_path: firstEpisode.thumbnail_path,
          description: firstEpisode.description,
          type: 'episode',
          series_id: media.id
        } as Media);
      }
    } else {
      // If it's an episode
      setSelectedMedia(media as Media);
    }
    setIsPlayerOpen(true);
  };

  const handleInfo = (media: Media | Series) => {
    if ('seasons' in media) {
      // If it's a series, go to series detail page
      navigate.push(`/tv-series/${media.id}`);
    } else {
      // If it's an episode, try to get the series ID, otherwise use the media ID
      const seriesId = (media as Media).series_id || media.id;
      navigate.push(`/tv-series/${seriesId}`);
    }
  };

  const handleSeasonClick = (series: Series, seasonNumber: number) => {
    navigate.push(`/tv-series/${series.id}/season/${seasonNumber}`);
  };






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
          featuredMedia={featuredSeries.map(series => {
            // Get first episode from first season for fallback
            const firstSeason = series.seasons.find(season => season.episodes.length > 0);
            const firstEpisode = firstSeason?.episodes[0];

            return {
              id: series.id,
              title: series.title,
              description: series.description,
              rating: series.rating,
              // Prioritize poster, then episode thumbnail, then series thumbnail
              thumbnail_path: series.poster_path || firstEpisode?.thumbnail_path || series.thumbnail_path,
              banner_path: series.banner_path,
              poster_path: series.poster_path,
              type: 'series',
              series_id: series.id
            } as Media;
          })}
          onPlay={(media) => {
            const series = featuredSeries.find(s => s.id === media.series_id || s.id === media.id);
            if (series) handlePlay(series);
          }}
          onInfo={(media) => {
            const series = featuredSeries.find(s => s.id === media.series_id || s.id === media.id);
            if (series) handleInfo(series);
          }}
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

          {/* All TV Series */}
          {seriesList.length > 0 && (
            <ParallaxSection speed={0.3}>
              <ScrollReveal direction="up" delay={0.1}>
                <div className="container mx-auto px-6 md:px-12 lg:px-16 mb-16">
                  <h2 className="text-3xl font-bold text-white mb-8">All TV Series</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                    {seriesList.map((series) => {
                      // Get fallback thumbnail from first available episode
                      const getFallbackThumbnail = () => {
                        if (series.seasons.length === 0) {
                          return null;
                        }

                        // Get first season with episodes
                        const firstSeasonWithEpisodes = series.seasons.find(season => season.episodes && season.episodes.length > 0);
                        
                        if (firstSeasonWithEpisodes && firstSeasonWithEpisodes.episodes.length > 0) {
                          return firstSeasonWithEpisodes.episodes[0];
                        }

                        return null;
                      };

                      const fallbackEpisode = getFallbackThumbnail();

                      return (
                        <div key={series.id} className="group cursor-pointer">
                          <div
                            className="relative aspect-[2/3] bg-gray-800 rounded-lg overflow-hidden mb-3 group-hover:scale-105 transition-transform duration-300"
                            onClick={() => handleInfo(series)}
                          >
                            {/* Always try poster first with cache busting */}
                            <img
                              src={getPosterUrl(series.id)}
                              alt={series.title}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              onError={(e) => {
                                // Fallback to episode thumbnail if poster fails
                                if (fallbackEpisode) {
                                  (e.target as HTMLImageElement).src = `${getApiUrl()}/api/thumbnails/${fallbackEpisode?.id}`;
                                } else if (series.thumbnail_path) {
                                  (e.target as HTMLImageElement).src = `${getApiUrl()}/api/thumbnails/${series.id}`;
                                } else {
                                  // Show gradient fallback
                                  const parent = (e.target as HTMLImageElement).parentElement!;
                                  parent.innerHTML = `
                                    <div class="w-full h-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center">
                                      <span class="text-2xl font-bold text-white">${series.title.charAt(0)}</span>
                                    </div>
                                  `;
                                }
                              }}
                            />
                            {/* Remove the conditional poster_path check */}
                            {false && fallbackEpisode ? (
                              <img
                                src={`${getApiUrl()}/api/thumbnails/${fallbackEpisode?.id}`}
                                alt={series.title}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : series.thumbnail_path ? (
                              <img
                                src={`${getApiUrl()}/api/thumbnails/${series.id}`}
                                alt={series.title}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center">
                                <span className="text-2xl font-bold text-white">{series.title.charAt(0)}</span>
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            <div className="absolute bottom-0 left-0 right-0 p-3 transform translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePlay(series);
                                }}
                                className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg text-sm font-medium flex items-center justify-center gap-2 mb-2"
                              >
                                <Play className="w-4 h-4" />
                                Play
                              </button>
                              <div className="text-white text-xs text-center">
                                {series.seasons.length} Season{series.seasons.length !== 1 ? 's' : ''} • {series.seasons.reduce((total, season) => total + season.episode_count, 0)} Episodes
                              </div>
                            </div>
                          </div>
                          <h3 className="text-white font-medium text-sm group-hover:text-red-400 transition-colors duration-300 line-clamp-2">
                            {series.title}
                          </h3>
                          {series.rating && (
                            <div className="flex items-center gap-1 mt-1">
                              <Star className="w-3 h-3 text-yellow-400" />
                              <span className="text-white/60 text-xs">{series.rating}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </ScrollReveal>
            </ParallaxSection>
          )}

          {/* Series with Seasons */}
          {seriesList.length > 0 && (
            <div>
              {seriesList.slice(0, 8).map((series, index) => (
                <ParallaxSection key={`series-${series.id}`} speed={0.4 + index * 0.05}>
                  <ScrollReveal direction="up" delay={0.2 + index * 0.1}>
                    <div className="container mx-auto px-6 md:px-12 lg:px-16 mb-12">
                      <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-white">{series.title}</h2>
                        <button
                          onClick={() => handleInfo(series)}
                          className="text-red-400 hover:text-red-300 text-sm font-medium flex items-center gap-1"
                        >
                          View Series
                          <Info className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Seasons Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {series.seasons.map((season) => {
                          // Use random episode from season for thumbnail
                          const randomEpisode = season.episodes.length > 0
                            ? season.episodes[Math.floor(Math.random() * season.episodes.length)]
                            : season.episodes[0];

                          return (
                            <div
                              key={`${series.id}-season-${season.season_number}`}
                              className="group cursor-pointer"
                              onClick={() => handleSeasonClick(series, season.season_number)}
                            >
                              <div className="relative aspect-[2/3] bg-gray-800 rounded-lg overflow-hidden mb-3 group-hover:scale-105 transition-transform duration-300">
                                {randomEpisode?.thumbnail_path && (
                                  <img
                                    src={`${getApiUrl()}/api/thumbnails/${randomEpisode.id}`}
                                    alt={`${series.title} ${season.name}`}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                  />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-1 rounded text-xs font-semibold">
                                  S{season.season_number}
                                </div>
                                <div className="absolute bottom-0 left-0 right-0 p-3 transform translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (season.episodes.length > 0) {
                                        const firstEpisode = season.episodes[0];
                                        setSelectedMedia({
                                          id: firstEpisode.id,
                                          title: firstEpisode.title,
                                          thumbnail_path: firstEpisode.thumbnail_path,
                                          description: firstEpisode.description,
                                          type: 'episode',
                                          series_id: series.id
                                        } as Media);
                                        setIsPlayerOpen(true);
                                      }
                                    }}
                                    className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-3 rounded text-xs font-medium flex items-center justify-center gap-1"
                                  >
                                    <Play className="w-3 h-3" />
                                    Play
                                  </button>
                                </div>
                              </div>
                              <h3 className="text-white font-medium text-sm group-hover:text-red-400 transition-colors duration-300">
                                {season.name}
                              </h3>
                              <p className="text-white/60 text-xs mt-1">
                                {season.episode_count} Episode{season.episode_count !== 1 ? 's' : ''}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </ScrollReveal>
                </ParallaxSection>
              ))}
            </div>
          )}

          {/* Action Series */}
          {actionSeries.length > 0 && (
            <ParallaxSection speed={0.6}>
              <ScrollReveal direction="up" delay={0.8}>
                <div className="container mx-auto px-6 md:px-12 lg:px-16 mb-12">
                  <h2 className="text-2xl font-bold text-white mb-6">Action & Adventure Series</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {actionSeries.map((series) => {
                      // Get fallback thumbnail from first available episode
                      const getFallbackThumbnail = () => {
                        if (series.seasons.length === 0) {
                          return null;
                        }

                        // Get first season with episodes
                        const firstSeasonWithEpisodes = series.seasons.find(season => season.episodes && season.episodes.length > 0);
                        
                        if (firstSeasonWithEpisodes && firstSeasonWithEpisodes.episodes.length > 0) {
                          return firstSeasonWithEpisodes.episodes[0];
                        }

                        return null;
                      };

                      const fallbackEpisode = getFallbackThumbnail();

                      return (
                        <div key={series.id} className="group cursor-pointer" onClick={() => handleInfo(series)}>
                          <div className="relative aspect-[2/3] bg-gray-800 rounded-lg overflow-hidden mb-3 group-hover:scale-105 transition-transform duration-300">
                            <img
                              src={getPosterUrl(series.id)}
                              alt={series.title}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              onError={(e) => {
                                // Fallback to episode thumbnail if poster fails
                                if (fallbackEpisode) {
                                  (e.target as HTMLImageElement).src = `${getApiUrl()}/api/thumbnails/${fallbackEpisode?.id}`;
                                } else if (series.thumbnail_path) {
                                  (e.target as HTMLImageElement).src = `${getApiUrl()}/api/thumbnails/${series.id}`;
                                } else {
                                  // Show gradient fallback
                                  const parent = (e.target as HTMLImageElement).parentElement!;
                                  parent.innerHTML = `
                                    <div class="w-full h-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center">
                                      <span class="text-2xl font-bold text-white">${series.title.charAt(0)}</span>
                                    </div>
                                  `;
                                }
                              }}
                            />
                            {false && fallbackEpisode ? (
                              <img
                                src={`${getApiUrl()}/api/thumbnails/${fallbackEpisode?.id}`}
                                alt={series.title}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : series.thumbnail_path ? (
                              <img
                                src={`${getApiUrl()}/api/thumbnails/${series.id}`}
                                alt={series.title}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center">
                                <span className="text-2xl font-bold text-white">{series.title.charAt(0)}</span>
                              </div>
                            )}
                          </div>
                          <h3 className="text-white font-medium text-sm group-hover:text-red-400 transition-colors duration-300 line-clamp-2">
                            {series.title}
                          </h3>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </ScrollReveal>
            </ParallaxSection>
          )}

          {/* Drama Series */}
          {dramaSeries.length > 0 && (
            <ParallaxSection speed={0.7}>
              <ScrollReveal direction="up" delay={1.0}>
                <div className="container mx-auto px-6 md:px-12 lg:px-16 mb-12">
                  <h2 className="text-2xl font-bold text-white mb-6">Drama Series</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {dramaSeries.map((series) => {
                      // Get fallback thumbnail from first available episode
                      const getFallbackThumbnail = () => {
                        if (series.seasons.length === 0) {
                          return null;
                        }

                        // Get first season with episodes
                        const firstSeasonWithEpisodes = series.seasons.find(season => season.episodes && season.episodes.length > 0);
                        
                        if (firstSeasonWithEpisodes && firstSeasonWithEpisodes.episodes.length > 0) {
                          return firstSeasonWithEpisodes.episodes[0];
                        }

                        return null;
                      };

                      const fallbackEpisode = getFallbackThumbnail();

                      return (
                        <div key={series.id} className="group cursor-pointer" onClick={() => handleInfo(series)}>
                          <div className="relative aspect-[2/3] bg-gray-800 rounded-lg overflow-hidden mb-3 group-hover:scale-105 transition-transform duration-300">
                            {series.poster_path ? (
                              <img
                                src={getPosterUrl(series.id)}
                                alt={series.title}
                                className="w-full h-full object-cover"
                                loading="lazy"
                                onError={(e) => {
                                  // Fallback to thumbnail if poster fails
                                  if (fallbackEpisode) {
                                    (e.target as HTMLImageElement).src = `${getApiUrl()}/api/thumbnails/${fallbackEpisode?.id}`;
                                  } else if (series.thumbnail_path) {
                                    (e.target as HTMLImageElement).src = `${getApiUrl()}/api/thumbnails/${series.id}`;
                                  }
                                }}
                              />
                            ) : fallbackEpisode ? (
                              <img
                                src={`${getApiUrl()}/api/thumbnails/${fallbackEpisode?.id}`}
                                alt={series.title}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : series.thumbnail_path ? (
                              <img
                                src={`${getApiUrl()}/api/thumbnails/${series.id}`}
                                alt={series.title}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center">
                                <span className="text-2xl font-bold text-white">{series.title.charAt(0)}</span>
                              </div>
                            )}
                          </div>
                          <h3 className="text-white font-medium text-sm group-hover:text-red-400 transition-colors duration-300 line-clamp-2">
                            {series.title}
                          </h3>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </ScrollReveal>
            </ParallaxSection>
          )}

          {/* Comedy Series */}
          {comedySeries.length > 0 && (
            <ParallaxSection speed={0.8}>
              <ScrollReveal direction="up" delay={1.2}>
                <div className="container mx-auto px-6 md:px-12 lg:px-16 mb-12">
                  <h2 className="text-2xl font-bold text-white mb-6">Comedy Series</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {comedySeries.map((series) => {
                      // Get fallback thumbnail from first available episode
                      const getFallbackThumbnail = () => {
                        if (series.seasons.length === 0) {
                          return null;
                        }

                        // Get first season with episodes
                        const firstSeasonWithEpisodes = series.seasons.find(season => season.episodes && season.episodes.length > 0);
                        
                        if (firstSeasonWithEpisodes && firstSeasonWithEpisodes.episodes.length > 0) {
                          return firstSeasonWithEpisodes.episodes[0];
                        }

                        return null;
                      };

                      const fallbackEpisode = getFallbackThumbnail();

                      return (
                        <div key={series.id} className="group cursor-pointer" onClick={() => handleInfo(series)}>
                          <div className="relative aspect-[2/3] bg-gray-800 rounded-lg overflow-hidden mb-3 group-hover:scale-105 transition-transform duration-300">
                            {series.poster_path ? (
                              <img
                                src={`${getApiUrl()}/api/posters/${series.id}`}
                                alt={series.title}
                                className="w-full h-full object-cover"
                                loading="lazy"
                                onError={(e) => {
                                  // Fallback to thumbnail if poster fails
                                  if (fallbackEpisode) {
                                    (e.target as HTMLImageElement).src = `${getApiUrl()}/api/thumbnails/${fallbackEpisode?.id}`;
                                  } else if (series.thumbnail_path) {
                                    (e.target as HTMLImageElement).src = `${getApiUrl()}/api/thumbnails/${series.id}`;
                                  }
                                }}
                              />
                            ) : fallbackEpisode ? (
                              <img
                                src={`${getApiUrl()}/api/thumbnails/${fallbackEpisode?.id}`}
                                alt={series.title}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : series.thumbnail_path ? (
                              <img
                                src={`${getApiUrl()}/api/thumbnails/${series.id}`}
                                alt={series.title}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center">
                                <span className="text-2xl font-bold text-white">{series.title.charAt(0)}</span>
                              </div>
                            )}
                          </div>
                          <h3 className="text-white font-medium text-sm group-hover:text-red-400 transition-colors duration-300 line-clamp-2">
                            {series.title}
                          </h3>
                        </div>
                      );
                    })}
                  </div>
                </div>
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
          onPlayNext={(nextMedia) => {
            console.log('🎬 TV shows page onPlayNext called with:', nextMedia.title);
            setSelectedMedia(nextMedia);
            console.log('🎬 Updated selectedMedia to:', nextMedia.title);
            // Keep player open and switch to next episode
          }}
        />
      )}
    </div>
  );
}
