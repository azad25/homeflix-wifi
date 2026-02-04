"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { Play, Info, Star, Clock, Calendar, ChevronDown } from "lucide-react";
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
    if (params?.id && params?.season) {
      setCurrentSeason(parseInt(params?.season as string));
      fetchSeasonData();
    }
  }, [params?.id, params?.season]);

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

          // Get episodes for this specific season
          const episodesResponse = await fetch(`${apiUrl}/api/series/${params?.id}/seasons/${seasonNumber}/episodes`);
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
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40" />

        {/* Content */}
        <div className="relative z-10 h-full flex items-end">
          <div className="container mx-auto px-8 pb-16">
            {/* Series Logo/Title */}
            <div className="mb-6">
              <img
                src={`${getApiUrl()}/api/series/${series.id}/logo`}
                alt={series.title}
                className="max-h-32 w-auto drop-shadow-2xl"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  const parent = target.parentElement!;
                  parent.innerHTML = `<h1 class="text-6xl font-bold text-white drop-shadow-2xl mb-4">${series.title}</h1>`;
                }}
              />
            </div>

            {/* Season Selector */}
            <div className="relative inline-block mb-6">
              <select
                value={currentSeason}
                onChange={(e) => navigate.push(`/tv-series/${params?.id}/season/${e.target.value}`)}
                className={`appearance-none bg-gradient-to-r ${themeGradients.accent} backdrop-blur-sm border-2 border-white/30 hover:border-white/50 text-white px-6 py-3 pr-12 rounded-lg text-lg font-bold cursor-pointer transition-all focus:outline-none focus:border-white/70 ${themeGradients.glow}`}
              >
                {Array.from({ length: totalSeasons }, (_, i) => i + 1).map((season) => (
                  <option key={season} value={season} className="bg-black">
                    Season {season}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none" />
            </div>

            {/* Series Info */}
            <div className="flex items-center gap-4 mb-6">
              {series.rating && (
                <div className="flex items-center gap-2 bg-yellow-500/20 backdrop-blur-sm px-3 py-1.5 rounded-full border border-yellow-500/30">
                  <Star className="w-4 h-4 text-yellow-400 fill-current" />
                  <span className="font-bold text-sm">{series.rating.toFixed(1)}</span>
                </div>
              )}
              {series.release_date && (
                <div className="flex items-center gap-2 bg-blue-500/20 backdrop-blur-sm px-3 py-1.5 rounded-full border border-blue-500/30">
                  <Calendar className="w-4 h-4 text-blue-400" />
                  <span className="font-semibold text-sm">{new Date(series.release_date).getFullYear()}</span>
                </div>
              )}
              <span className="text-white/90 font-semibold text-sm">
                {episodes.length} Episodes
              </span>
            </div>

            {/* Genres */}
            {series.genres && series.genres.length > 0 && (
              <div className="flex gap-2 mb-6">
                {series.genres.slice(0, 3).map((genre, index) => (
                  <span
                    key={index}
                    className={`px-3 py-1.5 bg-gradient-to-r ${themeGradients.accent}/20 backdrop-blur-sm border border-white/20 rounded-full text-sm font-semibold`}
                  >
                    {typeof genre === 'string' ? genre : genre.name || String(genre)}
                  </span>
                ))}
              </div>
            )}

            {/* Series Description */}
            {series.description && (
              <div className="mb-8 max-w-2xl">
                <p className="text-white/90 text-base leading-relaxed line-clamp-3">
                  {series.description}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => handlePlay(firstEpisode)}
                className={`bg-gradient-to-r ${themeGradients.accent} hover:opacity-90 text-white px-8 py-3 rounded-lg flex items-center gap-3 text-lg font-bold transition-all transform hover:scale-105 ${themeGradients.glow}`}
              >
                <Play className="w-5 h-5 fill-current" />
                Play Season
              </button>
              
              <button
                onClick={() => navigate.push(`/tv-series/${params?.id}`)}
                className="bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white px-8 py-3 rounded-lg flex items-center gap-3 text-lg font-semibold transition-all border border-white/20 hover:border-white/40"
              >
                <Info className="w-5 h-5" />
                Series Info
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Episodes Section */}
      <div className="container mx-auto px-8 py-12">
        <div className="flex items-start gap-8">
          {/* Main Content Area */}
          <div className="flex-1">
            <h2 className="text-3xl font-bold text-white mb-2">Episodes</h2>
            <p className="text-white/70 mb-8">Season {currentSeason} • {episodes.length} Episodes</p>
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
                  {episodes.map((episode, index) => (
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
                          {/* Episode Thumbnail */}
                          <div className="flex-shrink-0 relative">
                            <div className="w-24 h-14 bg-white/10 rounded-lg overflow-hidden border border-white/10">
                              <img
                                src={episode.still_path ? 
                                  (episode.still_path.startsWith('http') ? 
                                    episode.still_path : 
                                    `${getApiUrl()}/api/admin/assets/${episode.still_path.split('/').pop()}`
                                  ) : 
                                  `${getApiUrl()}/api/thumbnails/${episode.media?.id || episode.id}`
                                }
                                alt={episode.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  // Fallback to series backdrop
                                  target.src = getBackdropImageUrl(series!);
                                  target.onerror = () => {
                                    // Final fallback to a placeholder
                                    target.src = `${getApiUrl()}/api/thumbnails/default`;
                                  };
                                }}
                              />
                              {/* Play overlay */}
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                                <Play className="w-4 h-4 text-white fill-current" />
                              </div>
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
                            <h4 className="text-white font-semibold text-sm line-clamp-1 mb-2">
                              {episode.name}
                            </h4>
                            
                            {/* Episode Overview */}
                            {episode.overview && (
                              <p className="text-white/70 text-xs line-clamp-2 mb-2 leading-relaxed">
                                {episode.overview}
                              </p>
                            )}
                            
                            {/* Episode Metadata */}
                            <div className="flex items-center gap-3 text-xs text-white/60">
                              {episode.runtime && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatRuntime(episode.runtime)}
                                </span>
                              )}
                              {episode.vote_average && episode.vote_average > 0 && (
                                <span className="flex items-center gap-1 text-yellow-500">
                                  <Star className="w-3 h-3 fill-current" />
                                  {episode.vote_average.toFixed(1)}
                                </span>
                              )}
                              {episode.air_date && (
                                <span className="flex items-center gap-1 text-blue-400">
                                  <Calendar className="w-3 h-3" />
                                  {formatDate(episode.air_date)}
                                </span>
                              )}
                            </div>
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
                  ))}
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