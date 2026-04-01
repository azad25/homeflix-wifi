"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { Play, Info, Star, Clock, Calendar, ChevronDown, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Media } from '@/types/media';
import { getApiUrl, preloadAssets } from '@/lib/api';
import RedLoader from '@/components/RedLoader';
import Navbar from '@/components/Navbar';
import VideoPlayer from '@/components/VideoPlayer';
import { useNavigate } from "@/hooks/useNavigate";

interface Season {
  id: number;
  season_number: number;
  name: string;
  overview: string;
  description?: string; // Alternative field for season description
  air_date?: string;
  episode_count: number;
  episodes?: Episode[];
  poster_path?: string;
  release_date?: string;
}

interface Episode {
  id: number;
  episode_number: number;
  name: string;
  overview: string;
  still_path?: string;
  air_date?: string;
  runtime?: number;
  vote_average?: number;
  media?: Media;
}

const getGenreTextStyle = (genres: string[]) => {
  const genreList = genres.map(g => g.toLowerCase());
  if (genreList.includes('sci-fi') || genreList.includes('science fiction')) {
    return { className: "font-mono tracking-wide text-blue-200" };
  }
  if (genreList.includes('horror') || genreList.includes('thriller')) {
    return { className: "font-serif tracking-tighter text-red-100" };
  }
  if (genreList.includes('comedy')) {
    return { className: "font-sans text-yellow-100/90" };
  }
  if (genreList.includes('romance') || genreList.includes('drama')) {
    return { className: "font-serif text-serif text-pink-100/90" };
  }
  return { className: "font-sans text-white/80" };
};

export default function SeasonPage() {
  const params = useParams();
  const navigate = useNavigate();
  const [series, setSeries] = useState<Media | null>(null);
  const [seasonData, setSeasonData] = useState<Season | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentSeason, setCurrentSeason] = useState<number>(1);
  const [totalSeasons, setTotalSeasons] = useState<number>(1);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [episodeProgress, setEpisodeProgress] = useState<Map<number, { position: number, duration: number }>>(new Map());
  const videoRef = React.useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (params?.id && params?.season) {
      setCurrentSeason(parseInt(params?.season as string));
      fetchSeasonData();
    }
  }, [params?.id, params?.season]);

  // Fetch playback progress for all episodes
  useEffect(() => {
    if (episodes.length === 0) return;

    const fetchProgress = async () => {
      const apiUrl = getApiUrl();
      const progressMap = new Map<number, { position: number, duration: number }>();

      const promises = episodes.map(async (ep) => {
        try {
          const resp = await fetch(`${apiUrl}/api/playback/progress/${ep.id}`, {
            headers: { 'X-User-ID': '1' }
          });
          if (resp.ok) {
            const data = await resp.json();
            if (data && data.position > 0 && data.duration > 0) {
              progressMap.set(ep.id, { position: data.position, duration: data.duration });
            }
          }
        } catch (err) {
          // ignore
        }
      });

      await Promise.all(promises);
      setEpisodeProgress(progressMap);
    };

    fetchProgress();
  }, [episodes]);

  const fetchSeasonData = async () => {
    try {
      const apiUrl = getApiUrl();
      const seasonNumber = parseInt(params?.season as string);

      // First try to use the hierarchical API
      try {
        // Get series info from hierarchical API
        const seriesResponse = await fetch(`${apiUrl}/api/series/${params?.id}`);
        if (seriesResponse.ok) {
          const seriesData = await seriesResponse.json();
          setSeries(seriesData);

          // Try to get season-specific data
          try {
            const seasonResponse = await fetch(`${apiUrl}/api/series/${params?.id}/seasons/${seasonNumber}`);
            if (seasonResponse.ok) {
              const seasonInfo = await seasonResponse.json();
              setSeasonData(seasonInfo);
              console.log('✅ Loaded season data:', seasonInfo);
            }
          } catch (error) {
            console.warn('Season-specific data not available:', error);
          }

          // Get episodes for this specific season
          const episodesResponse = await fetch(`${apiUrl}/api/series/${params?.id}/seasons/${seasonNumber}/episodes`);
          if (episodesResponse.ok) {
            const episodesData = await episodesResponse.json();

            // Convert to Episode format and sort
            const episodeList: Episode[] = episodesData
              .map((media: Media, index: number) => ({
                id: media.id,
                episode_number: media.episode_number || extractEpisodeNumber(media.title) || index + 1,
                name: media.episode_title || media.title, // Use episode_title if available
                overview: media.description || media.long_desc || media.short_desc || '',
                still_path: media.episode_still_path, // Use episode_still_path
                air_date: media.release_date,
                runtime: media.duration ? Math.floor(media.duration / 60) : undefined,
                vote_average: media.rating,
                media: media
              }))
              .sort((a: Episode, b: Episode) => a.episode_number - b.episode_number);

            setEpisodes(episodeList);
            console.log(`✅ Loaded ${episodeList.length} episodes for season ${seasonNumber}`);

            // Get all seasons to calculate total
            const seasonsResponse = await fetch(`${apiUrl}/api/series/${params?.id}/seasons`);
            if (seasonsResponse.ok) {
              const seasonsData = await seasonsResponse.json();
              setTotalSeasons(seasonsData.length);
            }

            // Preload assets
            if (episodeList.length > 0) {
              const mediaList = episodeList.map(ep => ep.media!).filter(Boolean);
              preloadAssets(mediaList, ['thumbnail']);
            }

            setLoading(false);
            return;
          }
        }
      } catch (error) {
        console.warn('Hierarchical API not available, falling back to media API:', error);
      }

      // Fallback to original method
      // Get series info
      const seriesResponse = await fetch(`${apiUrl}/api/media/${params?.id}`);
      const seriesData = await seriesResponse.json();
      setSeries(seriesData);

      // Get all episodes
      const allMediaResponse = await fetch(`${apiUrl}/api/media`);
      const allMedia = await allMediaResponse.json();

      // Filter episodes for this series and season
      const seriesEpisodes = allMedia.filter((media: Media) => {
        const belongsToSeries = media.type === 'episode' && (
          media.title.toLowerCase().includes(seriesData.title.toLowerCase()) ||
          media.series_id === seriesData.id ||
          (media.file_path && seriesData.file_path &&
            media.file_path.includes(seriesData.file_path.split('/').slice(0, -1).join('/')))
        );

        if (!belongsToSeries) return false;

        const episodeSeasonNum = extractSeasonNumber(media.title);
        return episodeSeasonNum === seasonNumber;
      });

      // Convert to Episode format and sort
      const episodeList: Episode[] = seriesEpisodes
        .map((media: Media) => ({
          id: media.id,
          episode_number: extractEpisodeNumber(media.title) || 1,
          name: media.episode_title || media.title, // Use episode_title if available
          overview: media.description || media.long_desc || media.short_desc || '',
          still_path: media.episode_still_path, // Use episode_still_path
          air_date: media.release_date,
          runtime: media.duration ? Math.floor(media.duration / 60) : undefined,
          vote_average: media.rating,
          media: media
        }))
        .sort((a: Episode, b: Episode) => a.episode_number - b.episode_number);

      setEpisodes(episodeList);
      console.log(`✅ Loaded ${episodeList.length} episodes (fallback method)`);

      // Calculate total seasons
      const allSeriesEpisodes = allMedia.filter((media: Media) => {
        return media.type === 'episode' && (
          media.title.toLowerCase().includes(seriesData.title.toLowerCase()) ||
          media.series_id === seriesData.id
        );
      });

      const seasons = new Set<number>();
      allSeriesEpisodes.forEach((media: Media) => {
        const seasonNum = extractSeasonNumber(media.title);
        if (seasonNum) seasons.add(seasonNum);
      });

      setTotalSeasons(Math.max(...Array.from(seasons)));

      // Preload assets
      if (episodeList.length > 0) {
        const mediaList = episodeList.map(ep => ep.media!).filter(Boolean);
        preloadAssets(mediaList, ['thumbnail']);
      }

    } catch (error) {
      console.error('Error fetching season data:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const handlePlay = (episode: Episode) => {
    if (episode.media) {
      setSelectedMedia(episode.media);
      setIsPlayerOpen(true);
    }
  };

  const handleInfo = (episode: Episode) => {
    if (episode.media) {
      // Episodes should link to their individual episode page or back to season
      navigate.push(`/tv-series/${params?.id}/season/${params?.season}`);
    }
  };

  const navigateSeason = (direction: 'prev' | 'next') => {
    const newSeason = direction === 'prev' ? currentSeason - 1 : currentSeason + 1;
    if (newSeason >= 1 && newSeason <= totalSeasons) {
      navigate.push(`/tv-series/${params?.id}/season/${newSeason}`);
    }
  };

  // Genre-based gradient themes
  const getGenreTheme = (genres: any[]) => {
    if (!genres || genres.length === 0) return 'default';

    const genreNames = genres.map(g =>
      typeof g === 'string' ? g.toLowerCase() : (g.name || String(g)).toLowerCase()
    );

    // Priority order for genre themes
    if (genreNames.some(g => g.includes('horror') || g.includes('thriller'))) return 'horror';
    if (genreNames.some(g => g.includes('sci-fi') || g.includes('science fiction') || g.includes('fantasy'))) return 'scifi';
    if (genreNames.some(g => g.includes('action') || g.includes('adventure'))) return 'action';
    if (genreNames.some(g => g.includes('romance') || g.includes('romantic'))) return 'romance';
    if (genreNames.some(g => g.includes('comedy'))) return 'comedy';
    if (genreNames.some(g => g.includes('drama'))) return 'drama';
    if (genreNames.some(g => g.includes('crime') || g.includes('mystery'))) return 'crime';
    if (genreNames.some(g => g.includes('documentary'))) return 'documentary';

    return 'default';
  };

  const getThemeGradients = (theme: string) => {
    const themes = {
      horror: {
        primary: 'from-red-950 via-black to-purple-950',
        secondary: 'from-red-900/20 via-black/60 to-purple-900/20',
        accent: 'from-red-600 to-purple-600',
        glow: 'shadow-red-500/20'
      },
      scifi: {
        primary: 'from-blue-950 via-black to-cyan-950',
        secondary: 'from-blue-900/20 via-black/60 to-cyan-900/20',
        accent: 'from-blue-600 to-cyan-600',
        glow: 'shadow-blue-500/20'
      },
      action: {
        primary: 'from-orange-950 via-black to-red-950',
        secondary: 'from-orange-900/20 via-black/60 to-red-900/20',
        accent: 'from-orange-600 to-red-600',
        glow: 'shadow-orange-500/20'
      },
      romance: {
        primary: 'from-pink-950 via-black to-rose-950',
        secondary: 'from-pink-900/20 via-black/60 to-rose-900/20',
        accent: 'from-pink-600 to-rose-600',
        glow: 'shadow-pink-500/20'
      },
      comedy: {
        primary: 'from-yellow-950 via-black to-orange-950',
        secondary: 'from-yellow-900/20 via-black/60 to-orange-900/20',
        accent: 'from-yellow-600 to-orange-600',
        glow: 'shadow-yellow-500/20'
      },
      drama: {
        primary: 'from-purple-950 via-black to-indigo-950',
        secondary: 'from-purple-900/20 via-black/60 to-indigo-900/20',
        accent: 'from-purple-600 to-indigo-600',
        glow: 'shadow-purple-500/20'
      },
      crime: {
        primary: 'from-gray-950 via-black to-slate-950',
        secondary: 'from-gray-900/20 via-black/60 to-slate-900/20',
        accent: 'from-gray-600 to-slate-600',
        glow: 'shadow-gray-500/20'
      },
      documentary: {
        primary: 'from-green-950 via-black to-teal-950',
        secondary: 'from-green-900/20 via-black/60 to-teal-900/20',
        accent: 'from-green-600 to-teal-600',
        glow: 'shadow-green-500/20'
      },
      default: {
        primary: 'from-red-950 via-black to-black',
        secondary: 'from-red-900/20 via-black/60 to-black',
        accent: 'from-red-600 to-red-800',
        glow: 'shadow-red-500/20'
      }
    };

    return themes[theme as keyof typeof themes] || themes.default;
  };

  const formatRuntime = (minutes: number) => {
    return `${minutes}m`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getBackdropImageUrl = (media: Media) => {
    const apiUrl = getApiUrl();

    // First try TMDB backdrop if available (high priority for backdrop)
    if (media.tmdb_backdrop_url) {
      return media.tmdb_backdrop_url;
    }

    // Then try local banner
    if (media.banner_path) {
      return `${apiUrl}/api/admin/assets/${media.banner_path.split('/').pop()}`;
    }

    // Fallback to thumbnail
    return `${apiUrl}/api/thumbnails/${media.id}`;
  };

  const getBackgroundVideoUrl = (media: Media) => {
    const apiUrl = getApiUrl();

    // Try local trailer
    if (media.trailer_path) {
      return `${apiUrl}/api/admin/assets/${media.trailer_path.split('/').pop()}`;
    }

    // Try preview clips
    if (media.preview_clip_path) {
      return `${apiUrl}/api/admin/assets/${media.preview_clip_path.split('/').pop()}`;
    }

    // Fallback to preview clips endpoint
    return `${apiUrl}/api/preview-clips/${media.id}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <RedLoader />
      </div>
    );
  }

  if (!series || episodes.length === 0) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-center p-6">
        <h1 className="text-4xl font-bold text-white mb-4">Season Not Found</h1>
        <p className="text-xl text-white/80 mb-8">No episodes found for this season.</p>
        <button
          onClick={() => navigate.back()}
          className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  const firstEpisode = episodes[0];
  const genreTheme = getGenreTheme(series?.genres || []);
  const themeGradients = getThemeGradients(genreTheme);
  const releaseYear = seasonData?.air_date || seasonData?.release_date || series.release_date
    ? new Date(seasonData?.air_date || seasonData?.release_date || series.release_date || Date.now()).getFullYear()
    : null;

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />

      {/* Hero Section with Series Backdrop */}
      <div className="relative h-[70vh] overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0">
          <img
            src={getBackdropImageUrl(series)}
            alt={series.title}
            className="w-full h-full object-cover"
            loading="eager"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              const apiUrl = getApiUrl();
              target.src = `${apiUrl}/api/thumbnails/${series?.id || 'default'}`;
            }}
          />
        </div>

        {/* Background Video */}
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover opacity-20"
          autoPlay
          muted={false}
          loop
          playsInline
          preload="metadata"
          onLoadedData={() => {
            setIsVideoLoaded(true);
            if (videoRef.current) {
              videoRef.current.volume = 0.2;
              videoRef.current.play().then(() => {
                setIsVideoPlaying(true);
              }).catch(() => {
                videoRef.current!.muted = true;
                videoRef.current!.play();
              });
            }
          }}
          onError={() => {
            setIsVideoLoaded(false);
            setIsVideoPlaying(false);
          }}
        >
          <source src={`${getBackgroundVideoUrl(series)}?audio=aac&quality=medium`} type="video/mp4" />
          <source src={getBackgroundVideoUrl(series)} type="video/mp4" />
        </video>

        {/* Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent z-[10]" />
        <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black via-black/80 to-transparent z-[10] pointer-events-none" />

        {/* Hero Content - Left Aligned */}
        <div className="absolute inset-0 z-[20] flex items-end justify-start pb-16 p-6 md:pl-12 lg:pl-16 pointer-events-auto w-full lg:w-[75%] xl:w-[60%]">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="flex flex-row items-end gap-6 md:gap-8 w-full"
          >
            {/* Season Poster thumbnail */}
            <div className="hidden sm:block w-28 md:w-36 lg:w-48 flex-shrink-0 rounded-xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.8)] border border-white/10 relative aspect-[2/3]">
              <img
                src={(() => {
                  const apiUrl = getApiUrl();
                  if (seasonData?.poster_path) return `${apiUrl}/api/${seasonData.poster_path}`;
                  if (series.id) return `${apiUrl}/api/series/${series.id}/poster`;
                  return `${apiUrl}/api/thumbnails/${series.id}`;
                })()}
                alt={seasonData?.name || `Season ${currentSeason}`}
                className="w-full h-full object-cover opacity-90 hover:opacity-100 transition-opacity"
              />
            </div>

            {/* Main Info Column */}
            <div className="flex flex-col items-start gap-4 flex-1 min-w-0">
              {/* Series Title & Season */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                className="w-full"
              >
                <div>
                  <h2 className="text-xl md:text-2xl text-white/70 font-semibold mb-1">
                    {series.title}
                  </h2>
                  <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold mb-1 text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.8)]">
                    {seasonData?.name || `Season ${currentSeason}`}
                  </h1>
                </div>
              </motion.div>

              {/* Stats Row */}
              <motion.div
                className="flex flex-wrap items-center gap-3 text-sm md:text-base font-medium text-white/90 drop-shadow-md mb-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.4 }}
              >
                <span>{episodes.length} Episode{episodes.length !== 1 ? 's' : ''}</span>
                {series.rating && series.rating > 0 && (
                  <>
                    <span className="text-white/40">|</span>
                    <span className="flex items-center gap-1">
                      {series.rating.toFixed(1)} <span className="bg-yellow-500 text-black text-[10px] font-bold px-1 rounded-sm ml-0.5 mt-0.5" style={{ lineHeight: '1.2' }}>IMDb</span>
                    </span>
                  </>
                )}
                {releaseYear && (
                  <>
                    <span className="text-white/40">|</span>
                    <span>{releaseYear}</span>
                  </>
                )}
                <span className="text-white/40">|</span>
                <div className="relative inline-block">
                  <select
                    value={currentSeason}
                    onChange={(e) => navigate.push(`/tv-series/${params?.id}/season/${e.target.value}`)}
                    className="appearance-none bg-white/10 backdrop-blur-sm border border-white/20 hover:border-white/50 text-white px-3 py-1.5 pr-8 rounded-lg text-xs md:text-sm font-bold cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-red-500 shadow-xl"
                  >
                    {Array.from({ length: totalSeasons }, (_, i) => i + 1).map((season) => (
                      <option key={season} value={season} className="bg-black text-white">
                        Season {season}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" />
                </div>
              </motion.div>

              {/* Overview */}
              <motion.p
                className={`text-white/80 max-w-2xl line-clamp-3 md:line-clamp-4 drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] mb-2 text-sm md:text-base leading-snug ${getGenreTextStyle(series.genres?.map(g => typeof g === 'string' ? g : g?.name).filter(Boolean) || []).className}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7, duration: 0.4 }}
              >
                {seasonData?.overview || seasonData?.description || series.description || `Explore Season ${currentSeason} of ${series.title}.`}
              </motion.p>

              {/* Action Buttons */}
              <motion.div
                className="flex flex-wrap items-center gap-2 mt-1"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.4 }}
              >
                <button
                  onClick={() => handlePlay(firstEpisode)}
                  className="flex items-center gap-2 px-4 py-2 md:px-5 md:py-2.5 bg-white text-black hover:bg-white/80 font-bold rounded shadow-lg transition-all duration-200 hover:scale-105 text-sm md:text-base mr-2"
                >
                  <Play className="w-4 h-4 md:w-5 md:h-5 fill-current" />
                  <span>Play Season</span>
                </button>

                <button
                  onClick={() => navigate.push(`/tv-series/${params?.id}`)}
                  className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 bg-gray-500/40 hover:bg-gray-500/60 text-white font-bold rounded backdrop-blur-md shadow-lg transition-all duration-200 hover:scale-105 text-xs md:text-sm"
                >
                  <Info className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  <span className="hidden sm:inline">Series Info</span>
                </button>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Episodes Section */}
      <div className="container mx-auto px-8 py-12">
        <div className="flex items-start gap-8">
          {/* Main Content Area - Horizontal Episode Grid */}
          <div className="flex-1">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-white mb-2">Episodes</h2>
              <p className="text-white/70 mb-6">Season {currentSeason} • {episodes.length} Episodes</p>
            </div>

            {/* Horizontal Episode Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {episodes.map((episode, index) => {
                // Use episode_title if available, fallback to name
                const episodeTitle = episode.media?.episode_title || episode.name;
                // Use episode_still_path if available, fallback to thumbnail
                const episodeStill = episode.media?.episode_still_path
                  ? `${getApiUrl()}/api/episode-stills/${episode.media.id}`
                  : `${getApiUrl()}/api/thumbnails/${episode.media?.id || episode.id}`;

                return (
                  <motion.div
                    key={episode.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className="group cursor-pointer"
                    onClick={() => handlePlay(episode)}
                  >
                    <div className="bg-white/5 hover:bg-white/10 rounded-xl overflow-hidden transition-all duration-200 border border-white/5 hover:border-white/20">
                      {/* Episode Thumbnail/Still */}
                      <div className="relative aspect-video bg-black overflow-hidden">
                        <img
                          src={episodeStill}
                          alt={episodeTitle}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            // Hide broken image, show black background
                            target.style.display = 'none';
                          }}
                        />

                        {/* Play Overlay */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                          <div className={`bg-gradient-to-r ${themeGradients.accent} p-4 rounded-full ${themeGradients.glow}`}>
                            <Play className="w-8 h-8 text-white fill-current" />
                          </div>
                        </div>

                        {/* Episode Number Badge */}
                        <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-sm px-3 py-1 rounded-md border border-white/20">
                          <span className="text-sm font-bold text-white">E{episode.episode_number}</span>
                        </div>

                        {/* Runtime Badge */}
                        {episode.runtime && (
                          <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-sm px-2 py-1 rounded-md border border-white/20">
                            <span className="text-xs font-semibold text-white">{formatRuntime(episode.runtime)}</span>
                          </div>
                        )}

                        {/* Rating Badge */}
                        {episode.vote_average && episode.vote_average > 0 && (
                          <div className="absolute bottom-2 right-2 bg-yellow-500/90 backdrop-blur-sm px-2 py-1 rounded-md border border-yellow-500/30 flex items-center gap-1">
                            <Star className="w-3 h-3 text-black fill-current" />
                            <span className="text-xs font-bold text-black">{episode.vote_average.toFixed(1)}</span>
                          </div>
                        )}

                        {/* Red Progress Bar */}
                        {episodeProgress.has(episode.id) && episodeProgress.get(episode.id)!.duration > 0 && (
                          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-600/80 z-10">
                            <div
                              className="h-full bg-red-600 rounded-r-sm"
                              style={{ width: `${Math.min((episodeProgress.get(episode.id)!.position / episodeProgress.get(episode.id)!.duration) * 100, 100)}%` }}
                            />
                          </div>
                        )}
                      </div>

                      {/* Episode Info */}
                      <div className="p-4">
                        <h4 className="text-white font-semibold text-sm line-clamp-1 mb-1">
                          {episodeTitle}
                        </h4>

                        {/* Episode Overview */}
                        {episode.overview && (
                          <p className="text-white/60 text-xs line-clamp-2 mb-2">
                            {episode.overview}
                          </p>
                        )}

                        {/* Guest Stars */}
                        {episode.media?.guest_stars && episode.media.guest_stars.length > 0 && (
                          <div className="flex items-center gap-1 text-xs text-white/50">
                            <Users className="w-3 h-3" />
                            <span className="line-clamp-1">
                              {episode.media.guest_stars.slice(0, 2).join(', ')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Episodes Sidebar */}
          <div className="w-[420px] flex-shrink-0">
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden sticky top-24">
              {/* Episodes Header */}
              <div className="px-6 py-4 border-b border-white/10 bg-white/5">
                <h3 className="text-lg font-bold text-white">All Episodes</h3>
              </div>

              {/* Episodes List */}
              <div className="max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                <div className="p-4 space-y-3">
                  {episodes.map((episode, index) => {
                    // Use episode_title if available, fallback to name
                    const episodeTitle = episode.media?.episode_title || episode.name;
                    // Use episode_still_path if available, fallback to series backdrop
                    const episodeStill = episode.media?.episode_still_path
                      ? `${getApiUrl()}/api/episode-stills/${episode.media.id}`
                      : getBackdropImageUrl(series);

                    return (
                      <motion.div
                        key={episode.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: index * 0.03 }}
                        className="group cursor-pointer"
                        onClick={() => handlePlay(episode)}
                      >
                        <div className="bg-white/5 hover:bg-white/10 rounded-xl p-4 transition-all duration-200 border border-white/5 hover:border-white/20">
                          <div className="flex gap-4 items-start">
                            {/* Episode Still/Backdrop */}
                            <div className="flex-shrink-0 relative">
                              <div className="w-24 h-14 bg-black rounded-lg overflow-hidden border border-white/10">
                                <img
                                  src={episodeStill}
                                  alt={episodeTitle}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    // Hide broken image, show black background
                                    target.style.display = 'none';
                                  }}
                                />
                                {/* Play overlay */}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                                  <Play className="w-4 h-4 text-white fill-current" />
                                </div>

                                {/* Red Progress Bar */}
                                {episodeProgress.has(episode.id) && episodeProgress.get(episode.id)!.duration > 0 && (
                                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-600/80 z-10">
                                    <div
                                      className="h-full bg-red-600 rounded-r-sm"
                                      style={{ width: `${Math.min((episodeProgress.get(episode.id)!.position / episodeProgress.get(episode.id)!.duration) * 100, 100)}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                              {/* Episode Number Badge */}
                              <div className="absolute -top-2 -left-2 w-6 h-6 bg-red-600 rounded-full flex items-center justify-center border-2 border-black">
                                <span className="text-xs font-bold text-white">
                                  {episode.episode_number}
                                </span>
                              </div>
                            </div>

                            {/* Episode Info */}
                            <div className="flex-1 min-w-0">
                              <h4 className="text-white font-semibold text-xs line-clamp-1 mb-1">
                                {episodeTitle}
                              </h4>

                              {/* Episode Overview */}
                              {episode.overview && (
                                <p className="text-white/50 text-xs line-clamp-2 mb-2">
                                  {episode.overview}
                                </p>
                              )}

                              {/* Guest Stars */}
                              {episode.media?.guest_stars && episode.media.guest_stars.length > 0 && (
                                <div className="flex items-center gap-1 text-xs text-white/40 mt-1">
                                  <Users className="w-3 h-3" />
                                  <span className="line-clamp-1">
                                    {episode.media.guest_stars.slice(0, 2).join(', ')}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Play Button */}
                            <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePlay(episode);
                                }}
                                className={`bg-gradient-to-r ${themeGradients.accent} p-2.5 rounded-full transition-all hover:scale-110 ${themeGradients.glow}`}
                              >
                                <Play className="w-4 h-4 text-white fill-current" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Video Player Modal */}
      {selectedMedia && (
        <VideoPlayer
          key={selectedMedia.id}
          media={selectedMedia}
          isOpen={isPlayerOpen}
          onClose={() => setIsPlayerOpen(false)}
          startTime={0}
          onPlayNext={(nextMedia) => {
            console.log('🎬 Season page onPlayNext called with:', nextMedia.title);

            const currentIndex = episodes.findIndex(ep => ep.media?.id === selectedMedia.id);
            console.log('🎬 Current episode index:', currentIndex, 'of', episodes.length);

            if (currentIndex !== -1 && currentIndex < episodes.length - 1) {
              const nextEpisode = episodes[currentIndex + 1];
              if (nextEpisode.media) {
                console.log('🎬 Playing next episode in season:', nextEpisode.media.title);
                setSelectedMedia(nextEpisode.media);
                return;
              }
            }

            const nextSeasonNumber = currentSeason + 1;
            console.log('🎬 No more episodes in season, trying season', nextSeasonNumber);
            if (nextSeasonNumber <= totalSeasons) {
              console.log('🎬 Navigating to next season:', nextSeasonNumber);
              navigate.push(`/tv-series/${params?.id}/season/${nextSeasonNumber}`);
            } else {
              console.log('🎬 No more seasons, closing player');
              setIsPlayerOpen(false);
            }
          }}
        />
      )}
    </div>
  );
}
