"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Play, Info, Star, Clock, Calendar, ChevronDown, Check, Plus, ThumbsUp, Volume2, VolumeX, Film } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Media } from '@/types/media';
import { getApiUrl, preloadAssets } from '@/lib/api';
import RedLoader from '@/components/RedLoader';
import Navbar from '@/components/Navbar';
import VideoPlayer from '@/components/VideoPlayer';
import { useNavigate } from "@/hooks/useNavigate";

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

export default function SeasonPage() {
  const params = useParams();
  const navigate = useNavigate();
  const [series, setSeries] = useState<Media | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentSeason, setCurrentSeason] = useState<number>(1);
  const [totalSeasons, setTotalSeasons] = useState<number>(1);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (params.id && params.season) {
      setCurrentSeason(parseInt(params.season as string));
      fetchSeasonData();
    }
  }, [params.id, params.season]);

  const fetchSeasonData = async () => {
    try {
      const apiUrl = getApiUrl();
      const seasonNumber = parseInt(params.season as string);
      
      // First try to use the hierarchical API
      try {
        // Get series info from hierarchical API
        const seriesResponse = await fetch(`${apiUrl}/api/series/${params.id}`);
        if (seriesResponse.ok) {
          const seriesData = await seriesResponse.json();
          setSeries(seriesData);

          // Get episodes for this specific season
          const episodesResponse = await fetch(`${apiUrl}/api/series/${params.id}/seasons/${seasonNumber}/episodes`);
          if (episodesResponse.ok) {
            const episodesData = await episodesResponse.json();
            
            // Convert to Episode format and sort
            const episodeList: Episode[] = episodesData
              .map((media: Media, index: number) => ({
                id: media.id,
                episode_number: media.episode_number || extractEpisodeNumber(media.title) || index + 1,
                name: media.title,
                overview: media.description || '',
                still_path: media.thumbnail_path,
                air_date: media.release_date,
                runtime: media.duration ? Math.floor(media.duration / 60) : undefined,
                vote_average: media.rating,
                media: media
              }))
              .sort((a: Episode, b: Episode) => a.episode_number - b.episode_number);

            setEpisodes(episodeList);

            // Get all seasons to calculate total
            const seasonsResponse = await fetch(`${apiUrl}/api/series/${params.id}/seasons`);
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
      const seriesResponse = await fetch(`${apiUrl}/api/media/${params.id}`);
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
          name: media.title,
          overview: media.description || '',
          still_path: media.thumbnail_path,
          air_date: media.release_date,
          runtime: media.duration ? Math.floor(media.duration / 60) : undefined,
          vote_average: media.rating,
          media: media
        }))
        .sort((a: Episode, b: Episode) => a.episode_number - b.episode_number);

      setEpisodes(episodeList);

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
      navigate.push(`/tv-series/${params.id}/season/${params.season}`);
    }
  };

  const navigateSeason = (direction: 'prev' | 'next') => {
    const newSeason = direction === 'prev' ? currentSeason - 1 : currentSeason + 1;
    if (newSeason >= 1 && newSeason <= totalSeasons) {
      navigate.push(`/tv-series/${params.id}/season/${newSeason}`);
    }
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

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      
      {/* Netflix-Style Hero Section with Red-Black Gradient */}
      <div className="relative w-full h-[85vh] overflow-hidden">
        {/* Backdrop Background Image - Shows when video not playing */}
        <div
          className={`absolute inset-0 pointer-events-none transition-opacity duration-1000 ${
            !isVideoLoaded || !isVideoPlaying ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ zIndex: 2 }}
        >
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
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          muted={false}
          loop
          playsInline
          preload="metadata"
          style={{ zIndex: 5 }}
          onLoadedData={() => {
            setIsVideoLoaded(true);
            if (videoRef.current) {
              videoRef.current.volume = 0.6;
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
          
        {/* Multi-layer Red-Black Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent z-10" />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-transparent to-black/60 z-10" />
        <div className="absolute inset-0 bg-gradient-to-b from-red-950/30 via-transparent to-black z-10" />
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent z-10" />

        {/* Content */}
        <div className="relative z-20 h-full flex flex-col justify-end pb-20">
          <div className="container mx-auto px-4 md:px-8 lg:px-16">
            {/* Back Button */}
            <button
              onClick={() => navigate.push(`/tv-series/${params.id}`)}
              className="mb-6 flex items-center gap-2 text-white/80 hover:text-white transition-colors group"
            >
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              <span className="text-sm font-medium">Back to Series</span>
            </button>

            {/* Series Title */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-4xl md:text-6xl lg:text-7xl font-bold mb-4 drop-shadow-2xl"
            >
              {series.title}
            </motion.h1>

            {/* Season Selector */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mb-6"
            >
              <div className="relative inline-block">
                <select
                  value={currentSeason}
                  onChange={(e) => navigate.push(`/tv-series/${params.id}/season/${e.target.value}`)}
                  className="appearance-none bg-black/60 backdrop-blur-sm border-2 border-white/20 hover:border-white/40 text-white px-6 py-3 pr-12 rounded text-lg font-semibold cursor-pointer transition-all focus:outline-none focus:border-red-500"
                >
                  {Array.from({ length: totalSeasons }, (_, i) => i + 1).map((season) => (
                    <option key={season} value={season}>
                      Season {season}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none" />
              </div>
            </motion.div>

            {/* Series Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="flex flex-wrap items-center gap-3 mb-6 text-sm md:text-base"
            >
              {series.rating && (
                <div className="flex items-center gap-1 bg-yellow-500/20 px-3 py-1 rounded-full">
                  <Star className="w-4 h-4 text-yellow-400 fill-current" />
                  <span className="font-semibold">{series.rating.toFixed(1)}</span>
                </div>
              )}
              {series.release_date && (
                <div className="flex items-center gap-1 bg-blue-500/20 px-3 py-1 rounded-full">
                  <Calendar className="w-4 h-4 text-blue-400" />
                  <span>{new Date(series.release_date).getFullYear()}</span>
                </div>
              )}
              <span className="text-white/80">
                {episodes.length} Episodes
              </span>
            </motion.div>

            {/* Genres */}
            {series.genres && series.genres.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.25 }}
                className="flex flex-wrap gap-2 mb-6"
              >
                {series.genres.slice(0, 3).map((genre, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-red-600/30 border border-red-500/50 rounded-full text-sm font-medium"
                  >
                    {typeof genre === 'string' ? genre : genre.name || String(genre)}
                  </span>
                ))}
              </motion.div>
            )}

            {/* Description */}
            {series.description && (
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="max-w-2xl text-base md:text-lg text-white/90 leading-relaxed mb-8 line-clamp-3"
              >
                {series.description}
              </motion.p>
            )}

            {/* Action Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex items-center gap-4"
            >
              <button
                onClick={() => handlePlay(firstEpisode)}
                className="bg-white hover:bg-white/90 text-black px-8 py-3 rounded flex items-center gap-3 font-semibold text-lg transition-all transform hover:scale-105"
              >
                <Play className="w-6 h-6 fill-current" />
                Play
              </button>
              
              <button
                onClick={() => handleInfo(firstEpisode)}
                className="bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-8 py-3 rounded flex items-center gap-3 font-semibold text-lg transition-all border-2 border-white/20 hover:border-white/40"
              >
                <Info className="w-6 h-6" />
                More Info
              </button>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Episodes Section */}
      <div className="relative bg-gradient-to-b from-black via-red-950/5 to-black">
        <div className="container mx-auto px-4 md:px-8 lg:px-16 py-12">
          {/* Section Header */}
          <div className="mb-8">
            <h2 className="text-2xl md:text-3xl font-bold mb-2">Episodes</h2>
            <p className="text-white/60">Season {currentSeason}</p>
          </div>

          {/* Episodes List */}
          <div className="space-y-4">
            {episodes.map((episode, index) => (
              <motion.div
                key={episode.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                className="group"
              >
                <div className="bg-zinc-900/50 hover:bg-zinc-800/70 rounded-lg overflow-hidden transition-all duration-300 border border-white/5 hover:border-red-500/30">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4">
                    {/* Episode Number */}
                    <div className="hidden md:flex items-center justify-center md:col-span-1">
                      <span className="text-4xl font-bold text-white/20 group-hover:text-red-500/50 transition-colors">
                        {episode.episode_number}
                      </span>
                    </div>

                    {/* Episode Thumbnail */}
                    <div className="md:col-span-4">
                      <div className="relative aspect-video bg-zinc-800 rounded overflow-hidden cursor-pointer"
                        onClick={() => handlePlay(episode)}
                      >
                        {episode.media && (
                          <>
                            <img
                              src={`${getApiUrl()}/api/thumbnails/${episode.media.id}`}
                              alt={episode.name}
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                              loading={index < 3 ? 'eager' : 'lazy'}
                              onError={(e) => {
                                e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="640" height="360"%3E%3Crect fill="%2318181b" width="640" height="360"/%3E%3C/svg%3E';
                              }}
                            />
                            
                            {/* Play Overlay */}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <div className="bg-white/90 rounded-full p-3 transform scale-75 group-hover:scale-100 transition-transform">
                                <Play className="w-8 h-8 text-black fill-current" />
                              </div>
                            </div>

                            {/* Episode Number Badge (Mobile) */}
                            <div className="md:hidden absolute top-2 left-2 bg-black/80 backdrop-blur-sm px-3 py-1 rounded text-sm font-bold">
                              {episode.episode_number}
                            </div>

                            {/* Duration Badge */}
                            {episode.runtime && (
                              <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-sm px-2 py-1 rounded text-xs font-semibold">
                                {formatRuntime(episode.runtime)}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Episode Info */}
                    <div className="md:col-span-7 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="text-lg md:text-xl font-semibold text-white group-hover:text-red-400 transition-colors line-clamp-1">
                            {episode.name}
                          </h3>
                          
                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 ml-4">
                            <button
                              onClick={() => handlePlay(episode)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/10 hover:bg-white/20 p-2 rounded-full"
                              title="Play"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                            <button
                              className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/10 hover:bg-white/20 p-2 rounded-full"
                              title="Add to My List"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                            <button
                              className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/10 hover:bg-white/20 p-2 rounded-full"
                              title="Rate"
                            >
                              <ThumbsUp className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Episode Metadata */}
                        <div className="flex items-center gap-3 text-sm text-white/60 mb-3">
                          {episode.air_date && (
                            <span>{formatDate(episode.air_date)}</span>
                          )}
                          {episode.vote_average && (
                            <span className="flex items-center gap-1 text-yellow-500">
                              <Star className="w-3 h-3 fill-current" />
                              {episode.vote_average.toFixed(1)}
                            </span>
                          )}
                        </div>

                        {/* Episode Description */}
                        <p className="text-sm md:text-base text-white/70 leading-relaxed line-clamp-2 md:line-clamp-3">
                          {episode.overview || `Episode ${episode.episode_number} of ${series.title} Season ${currentSeason}.`}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Series Metadata Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="mt-16"
          >
            <h2 className="text-2xl md:text-3xl font-bold mb-8">About {series.title}</h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Series Information */}
              <div className="bg-zinc-900/50 rounded-lg p-6 border border-white/5">
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <Info className="w-5 h-5 text-red-400" />
                  Series Information
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex">
                    <span className="w-32 text-white/60">Type</span>
                    <span className="text-white">TV Series</span>
                  </div>
                  {series.genres && series.genres.length > 0 && (
                    <div className="flex">
                      <span className="w-32 text-white/60">Genres</span>
                      <span className="text-white">
                        {series.genres.map(g => typeof g === 'string' ? g : g).join(', ')}
                      </span>
                    </div>
                  )}
                  <div className="flex">
                    <span className="w-32 text-white/60">Seasons</span>
                    <span className="text-white">{totalSeasons}</span>
                  </div>
                  <div className="flex">
                    <span className="w-32 text-white/60">Episodes</span>
                    <span className="text-white">{episodes.length}</span>
                  </div>
                  {series.rating && (
                    <div className="flex">
                      <span className="w-32 text-white/60">Rating</span>
                      <span className="text-white flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-400 fill-current" />
                        {series.rating.toFixed(1)}
                      </span>
                    </div>
                  )}
                  {series.release_date && (
                    <div className="flex">
                      <span className="w-32 text-white/60">Release Year</span>
                      <span className="text-white">{new Date(series.release_date).getFullYear()}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Production Details */}
              <div className="bg-zinc-900/50 rounded-lg p-6 border border-white/5">
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <Film className="w-5 h-5 text-red-400" />
                  Production Details
                </h3>
                <div className="space-y-3 text-sm">
                  {series.director && (
                    <div className="flex">
                      <span className="w-32 text-white/60">Creator</span>
                      <span className="text-white">{series.director}</span>
                    </div>
                  )}
                  {series.stars && (
                    <div className="flex">
                      <span className="w-32 text-white/60">Cast</span>
                      <span className="text-white">{series.stars}</span>
                    </div>
                  )}
                  {series.country && (
                    <div className="flex">
                      <span className="w-32 text-white/60">Country</span>
                      <span className="text-white">{series.country}</span>
                    </div>
                  )}
                  {series.language && (
                    <div className="flex">
                      <span className="w-32 text-white/60">Language</span>
                      <span className="text-white">{series.language}</span>
                    </div>
                  )}
                  {series.quality && (
                    <div className="flex">
                      <span className="w-32 text-white/60">Quality</span>
                      <span className="text-white">{series.quality}</span>
                    </div>
                  )}
                  {series.file_size && (
                    <div className="flex">
                      <span className="w-32 text-white/60">File Size</span>
                      <span className="text-white">{series.file_size}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Full Description */}
            {series.description && (
              <div className="mt-8 bg-zinc-900/50 rounded-lg p-6 border border-white/5">
                <h3 className="text-xl font-semibold text-white mb-4">Synopsis</h3>
                <p className="text-white/80 leading-relaxed">
                  {series.description}
                </p>
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Video Player Modal */}
      {selectedMedia && (
        <VideoPlayer
          key={selectedMedia.id} // Force re-render when media changes
          media={selectedMedia}
          isOpen={isPlayerOpen}
          onClose={() => setIsPlayerOpen(false)}
          startTime={0}
          onPlayNext={(nextMedia) => {
            console.log('🎬 Season page onPlayNext called with:', nextMedia.title);
            
            // Find current episode index
            const currentIndex = episodes.findIndex(ep => ep.media?.id === selectedMedia.id);
            console.log('🎬 Current episode index:', currentIndex, 'of', episodes.length);
            
            // Get next episode in the season
            if (currentIndex !== -1 && currentIndex < episodes.length - 1) {
              const nextEpisode = episodes[currentIndex + 1];
              if (nextEpisode.media) {
                console.log('🎬 Playing next episode in season:', nextEpisode.media.title);
                setSelectedMedia(nextEpisode.media);
                return;
              }
            }
            
            // If no next episode in current season, try to go to next season
            const nextSeasonNumber = currentSeason + 1;
            console.log('🎬 No more episodes in season, trying season', nextSeasonNumber);
            if (nextSeasonNumber <= totalSeasons) {
              // Navigate to next season and play first episode
              console.log('🎬 Navigating to next season:', nextSeasonNumber);
              navigate.push(`/tv-series/${params.id}/season/${nextSeasonNumber}`);
            } else {
              // No more episodes, close player
              console.log('🎬 No more seasons, closing player');
              setIsPlayerOpen(false);
            }
          }}
        />
      )}
    </div>
  );
}