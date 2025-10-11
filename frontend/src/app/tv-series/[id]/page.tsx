"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Play, Plus, Check, Share, Download, Info, Star, Clock, Calendar, Globe, Users, Award, Film, Tv, User, Mic, ChevronDown, ChevronUp, Volume2, VolumeX, PlayCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Media } from '@/types/media';
import { getApiUrl, preloadAssets } from '@/lib/api';
import RedLoader from '@/components/RedLoader';
import LazyImage from '@/components/LazyImage';
import LazyVideo from '@/components/LazyVideo';
import Navbar from '@/components/Navbar';
import VideoPlayer from '@/components/VideoPlayer';
import NetflixMediaCard from '@/components/NetflixMediaCard';
import {
  ParallaxSection,
  ScrollReveal,
  GlassCard,
  GradientBackground,
  FloatingElement,
  MagneticButton,
  ParticleField
} from '@/components/scrollx';
import { useNavigate } from "@/hooks/useNavigate";

interface Season {
  id: number;
  season_number: number;
  name: string;
  overview: string;
  air_date?: string;
  episode_count: number;
  episodes?: Episode[];
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
}

export default function TVSeriesPage() {
  const params = useParams();
  const router = useRouter();
  const navigate = useNavigate();
  const [series, setSeries] = useState<Media | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [episodes, setEpisodes] = useState<Media[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [isInMyList, setIsInMyList] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [showTitleOverlay, setShowTitleOverlay] = useState(true);
  const [isHoveringTitle, setIsHoveringTitle] = useState(false);
  const [continueWatching, setContinueWatching] = useState<{episode: Media, progress: number} | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (params.id) {
      fetchSeriesData();
      checkMyList();
      loadContinueWatching();
    }
  }, [params.id]);

  useEffect(() => {
    if (!loading && series) {
      const timer = setTimeout(() => {
        setShowTitleOverlay(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [loading, series]);

  const fetchSeriesData = async () => {
    try {
      const apiUrl = getApiUrl();
      
      // Get series info
      const seriesResponse = await fetch(`${apiUrl}/api/media/${params.id}`);
      const seriesData = await seriesResponse.json();
      setSeries(seriesData);

      // Get all episodes for this series
      const allMediaResponse = await fetch(`${apiUrl}/api/media`);
      const allMedia = await allMediaResponse.json();
      
      // Filter episodes that belong to this series
      const seriesEpisodes = allMedia.filter((media: Media) => {
        return media.type === 'episode' && (
          media.title.toLowerCase().includes(seriesData.title.toLowerCase()) ||
          media.series_id === seriesData.id ||
          (media.file_path && seriesData.file_path && 
           media.file_path.includes(seriesData.file_path.split('/').slice(0, -1).join('/')))
        );
      });

      setEpisodes(seriesEpisodes);

      // Group episodes by season
      const seasonMap = new Map<number, Episode[]>();
      seriesEpisodes.forEach((episode: Media) => {
        const seasonNum = extractSeasonNumber(episode.title) || 1;
        if (!seasonMap.has(seasonNum)) {
          seasonMap.set(seasonNum, []);
        }
        seasonMap.get(seasonNum)?.push({
          id: episode.id,
          episode_number: extractEpisodeNumber(episode.title) || 1,
          name: episode.title,
          overview: episode.description || '',
          still_path: episode.thumbnail_path,
          air_date: episode.release_date,
          runtime: episode.duration ? Math.floor(episode.duration / 60) : undefined,
          vote_average: episode.rating
        });
      });

      // Create seasons array
      const seasonsArray: Season[] = Array.from(seasonMap.entries()).map(([seasonNum, eps]) => ({
        id: seasonNum,
        season_number: seasonNum,
        name: `Season ${seasonNum}`,
        overview: `Season ${seasonNum} of ${seriesData.title}`,
        episode_count: eps.length,
        episodes: eps.sort((a, b) => a.episode_number - b.episode_number)
      }));

      setSeasons(seasonsArray.sort((a, b) => a.season_number - b.season_number));

      // Preload assets for better performance
      if (seriesEpisodes.length > 0) {
        preloadAssets(seriesEpisodes.slice(0, 12), ['thumbnail']);
      }

    } catch (error) {
      console.error('Error fetching series data:', error);
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

  const checkMyList = () => {
    // Implementation for checking if series is in user's list
    setIsInMyList(false);
  };

  const loadContinueWatching = () => {
    // Check for continue watching episode
    if (episodes.length > 0) {
      // Find the episode with progress
      const episodeWithProgress = episodes.find(ep => {
        const progress = localStorage.getItem(`progress_${ep.id}`);
        return progress && JSON.parse(progress).progress > 0;
      });
      
      if (episodeWithProgress) {
        const progressData = JSON.parse(localStorage.getItem(`progress_${episodeWithProgress.id}`) || '{}');
        setContinueWatching({
          episode: episodeWithProgress,
          progress: progressData.progress || 0
        });
      }
    }
  };

  const handlePlay = (media?: Media) => {
    if (media) {
      setSelectedMedia(media);
    } else if (continueWatching) {
      setSelectedMedia(continueWatching.episode);
    } else if (episodes.length > 0) {
      // Start with first episode of first season
      setSelectedMedia(episodes[0]);
    }
    setIsPlayerOpen(true);
  };

  const handleSeasonSelect = (seasonNumber: number) => {
    setSelectedSeason(seasonNumber);
    navigate.push(`/tv-series/${params.id}/season/${seasonNumber}`);
  };

  const toggleMyList = () => {
    setIsInMyList(!isInMyList);
  };

  const getBackgroundImageUrl = (media: Media) => {
    const apiUrl = getApiUrl();
    if (media.banner_path) {
      return `${apiUrl}/api/admin/assets/${media.banner_path.split('/').pop()}`;
    }
    return `${apiUrl}/api/thumbnails/${media.id}`;
  };

  const getBackgroundVideoUrl = (media: Media) => {
    const apiUrl = getApiUrl();
    if (media.trailer_path) {
      return `${apiUrl}/api/admin/assets/${media.trailer_path.split('/').pop()}`;
    }
    if (media.preview_clip_path) {
      return `${apiUrl}/api/admin/assets/${media.preview_clip_path.split('/').pop()}`;
    }
    return `${apiUrl}/api/preview-clips/${media.id}`;
  };

  const formatRuntime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <RedLoader />
      </div>
    );
  }

  if (!series) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-center p-6">
        <h1 className="text-4xl font-bold text-white mb-4">Series Not Found</h1>
        <p className="text-xl text-white/80 mb-8">The requested TV series could not be found.</p>
        <button
          onClick={() => router.back()}
          className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-900/20 via-black to-black text-white">
      <Navbar />
      <GradientBackground variant="cosmic" animate={true} className="fixed inset-0 -z-10" />

      {/* Hero Section */}
      <div className="relative h-screen overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0" style={{ zIndex: 1 }}>
          <LazyImage
            src={getBackgroundImageUrl(series)}
            alt={series.title}
            fill
            className={`transition-opacity duration-1000 ${isVideoLoaded && isVideoPlaying ? 'opacity-0' : 'opacity-100'}`}
            priority
            sizes="100vw"
            loaderSize="large"
            showLoader={true}
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

        {/* Overlay */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/60 to-black/40 z-15"
          initial={{ opacity: 1 }}
          animate={{ opacity: showTitleOverlay ? 1 : 0.3 }}
          transition={{ duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94] }}
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent z-10" />

        {/* Hero Content */}
        <div className="absolute inset-0 flex items-end z-20">
          <div
            className="w-full h-full flex items-end"
            onMouseEnter={() => setIsHoveringTitle(true)}
            onMouseLeave={() => setIsHoveringTitle(false)}
          >
            <ParticleField count={50} className="absolute inset-0 opacity-30" />

            <div className="container mx-auto px-6 md:px-12 lg:px-16 relative z-10">
              <div className="max-w-4xl w-full">
                {/* Series Title */}
                <motion.div
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  className="mb-6"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <Tv className="w-8 h-8 text-red-500" />
                    <span className="text-red-400 font-semibold text-lg">TV SERIES</span>
                  </div>
                  
                  <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-4 leading-tight">
                    {series.title}
                  </h1>

                  <div className="text-white/80 text-lg font-medium">
                    {seasons.length} Season{seasons.length !== 1 ? 's' : ''} • {episodes.length} Episodes
                  </div>
                </motion.div>

                {/* Continue Watching */}
                {continueWatching && (
                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{
                      opacity: (!showTitleOverlay || isHoveringTitle) ? 1 : 0,
                      y: (!showTitleOverlay || isHoveringTitle) ? 0 : 30
                    }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                    className="mb-6"
                  >
                    <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/20">
                      <div className="flex items-center gap-3 mb-2">
                        <PlayCircle className="w-5 h-5 text-red-400" />
                        <span className="text-white font-medium">Continue Watching</span>
                      </div>
                      <p className="text-white/80 text-sm">
                        {continueWatching.episode.title} • {Math.round((continueWatching.progress / (continueWatching.episode.duration || 1)) * 100)}% complete
                      </p>
                    </div>
                  </motion.div>
                )}

                {/* Metadata */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{
                    opacity: (!showTitleOverlay || isHoveringTitle) ? 1 : 0,
                    y: (!showTitleOverlay || isHoveringTitle) ? 0 : 30
                  }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="flex items-center gap-4 text-white/90 mb-6 flex-wrap"
                >
                  {series.rating && (
                    <span className="flex items-center gap-1 text-green-400 font-semibold">
                      <Star className="w-4 h-4" />
                      {series.rating}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {series.year || new Date().getFullYear()}
                  </span>
                  {series.genres && series.genres.length > 0 && (
                    <span className="text-white/80">
                      {series.genres.slice(0, 3).map(g => g.name).join(' • ')}
                    </span>
                  )}
                </motion.div>

                {/* Action Buttons */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{
                    opacity: (!showTitleOverlay || isHoveringTitle) ? 1 : 0,
                    y: (!showTitleOverlay || isHoveringTitle) ? 0 : 30
                  }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                  className="flex flex-wrap gap-4 mb-8"
                >
                  <MagneticButton
                    onClick={() => handlePlay()}
                    className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-lg text-lg font-semibold flex items-center gap-2"
                  >
                    <Play className="w-5 h-5" />
                    {continueWatching ? 'Continue Watching' : 'Play'}
                  </MagneticButton>

                  <MagneticButton
                    onClick={toggleMyList}
                    className="bg-white/10 hover:bg-white/20 text-white p-3 rounded-full"
                  >
                    {isInMyList ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                  </MagneticButton>

                  <MagneticButton className="bg-white/10 hover:bg-white/20 text-white p-3 rounded-full">
                    <Share className="w-5 h-5" />
                  </MagneticButton>
                </motion.div>

                {/* Description */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{
                    opacity: (!showTitleOverlay || isHoveringTitle) ? 1 : 0,
                    y: (!showTitleOverlay || isHoveringTitle) ? 0 : 30
                  }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                >
                  <p className="text-white/90 mb-4 text-lg leading-relaxed max-w-3xl">
                    {series.description ? (
                      showFullDescription ? series.description : `${series.description.substring(0, 200)}${series.description.length > 200 ? '...' : ''}`
                    ) : (
                      "Experience this amazing TV series with compelling characters and engaging storylines that will keep you watching episode after episode."
                    )}
                    {series.description && series.description.length > 200 && (
                      <button
                        onClick={() => setShowFullDescription(!showFullDescription)}
                        className="text-red-400 hover:text-red-300 ml-2 font-medium"
                      >
                        {showFullDescription ? 'Show less' : 'Read more'}
                      </button>
                    )}
                  </p>
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Seasons Section */}
      <div className="relative z-10 bg-black pt-16 pb-24">
        <div className="container mx-auto px-6 md:px-12 lg:px-16">
          <ScrollReveal direction="up" delay={0.2}>
            <h2 className="text-3xl font-bold text-white mb-8">Seasons</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {seasons.map((season) => (
                <motion.div
                  key={season.id}
                  className="group cursor-pointer"
                  onClick={() => handleSeasonSelect(season.season_number)}
                  whileHover={{ scale: 1.05 }}
                  transition={{ duration: 0.2 }}
                >
                  <GlassCard className="p-6 text-center hover:bg-white/10 transition-all duration-300">
                    <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-red-500 transition-colors">
                      <span className="text-2xl font-bold text-white">{season.season_number}</span>
                    </div>
                    
                    <h3 className="text-xl font-semibold text-white mb-2">{season.name}</h3>
                    <p className="text-white/60 text-sm mb-3">{season.episode_count} Episodes</p>
                    
                    {season.overview && (
                      <p className="text-white/80 text-sm line-clamp-3">
                        {season.overview}
                      </p>
                    )}
                  </GlassCard>
                </motion.div>
              ))}
            </div>
          </ScrollReveal>

          {/* Latest Episodes Preview */}
          {episodes.length > 0 && (
            <ScrollReveal direction="up" delay={0.4}>
              <div className="mt-16">
                <h2 className="text-3xl font-bold text-white mb-8">Latest Episodes</h2>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {episodes.slice(0, 8).map((episode, index) => (
                    <NetflixMediaCard
                      key={episode.id}
                      media={episode}
                      onPlay={handlePlay}
                      onInfo={(media) => router.push(`/movie/${media.id}`)}
                      priority={index < 4 ? 'high' : 'normal'}
                      showPreviewOnHover={true}
                    />
                  ))}
                </div>
              </div>
            </ScrollReveal>
          )}

          {/* Series Details */}
          <ScrollReveal direction="up" delay={0.6}>
            <div className="mt-16">
              <h2 className="text-3xl font-bold text-white mb-8">About {series.title}</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div>
                  <h3 className="text-xl font-semibold text-white mb-4">Series Information</h3>
                  <div className="space-y-3">
                    <div className="flex">
                      <span className="w-32 text-white/60">Type</span>
                      <span className="text-white">TV Series</span>
                    </div>
                    {series.genres && series.genres.length > 0 && (
                      <div className="flex">
                        <span className="w-32 text-white/60">Genres</span>
                        <span className="text-white">{series.genres.map(g => g.name).join(', ')}</span>
                      </div>
                    )}
                    <div className="flex">
                      <span className="w-32 text-white/60">Seasons</span>
                      <span className="text-white">{seasons.length}</span>
                    </div>
                    <div className="flex">
                      <span className="w-32 text-white/60">Episodes</span>
                      <span className="text-white">{episodes.length}</span>
                    </div>
                    {series.rating && (
                      <div className="flex">
                        <span className="w-32 text-white/60">Rating</span>
                        <span className="text-white flex items-center gap-1">
                          <Star className="w-4 h-4 text-yellow-400" />
                          {series.rating}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-white mb-4">Production Details</h3>
                  <div className="space-y-3">
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
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>

      {/* Video Player Modal */}
      {selectedMedia && (
        <VideoPlayer
          media={selectedMedia}
          isOpen={isPlayerOpen}
          onClose={() => setIsPlayerOpen(false)}
          startTime={continueWatching?.progress || 0}
        />
      )}
    </div>
  );
}