"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Play, Info, Star, Clock, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { Media } from '@/types/media';
import { getApiUrl, preloadAssets } from '@/lib/api';
import RedLoader from '@/components/RedLoader';
import Navbar from '@/components/Navbar';
import VideoPlayer from '@/components/VideoPlayer';
import NetflixMediaCard from '@/components/NetflixMediaCard';
import {
  ParallaxSection,
  ScrollReveal,
  GlassCard,
  GradientBackground,
  MagneticButton
} from '@/components/scrollx';

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
  const router = useRouter();
  const [series, setSeries] = useState<Media | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentSeason, setCurrentSeason] = useState<number>(1);
  const [totalSeasons, setTotalSeasons] = useState<number>(1);

  useEffect(() => {
    if (params.id && params.season) {
      setCurrentSeason(parseInt(params.season as string));
      fetchSeasonData();
    }
  }, [params.id, params.season]);

  const fetchSeasonData = async () => {
    try {
      const apiUrl = getApiUrl();
      
      // Get series info
      const seriesResponse = await fetch(`${apiUrl}/api/media/${params.id}`);
      const seriesData = await seriesResponse.json();
      setSeries(seriesData);

      // Get all episodes
      const allMediaResponse = await fetch(`${apiUrl}/api/media`);
      const allMedia = await allMediaResponse.json();
      
      // Filter episodes for this series and season
      const seasonNumber = parseInt(params.season as string);
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
        preloadAssets(mediaList, ['poster', 'thumbnail']);
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
      router.push(`/movie/${episode.media.id}`);
    }
  };

  const navigateSeason = (direction: 'prev' | 'next') => {
    const newSeason = direction === 'prev' ? currentSeason - 1 : currentSeason + 1;
    if (newSeason >= 1 && newSeason <= totalSeasons) {
      router.push(`/tv-series/${params.id}/season/${newSeason}`);
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

      {/* Header Section */}
      <div className="relative pt-20 pb-12">
        <div className="container mx-auto px-6 md:px-12 lg:px-16">
          <ScrollReveal direction="up" delay={0.1}>
            <div className="flex items-center gap-4 mb-8">
              <MagneticButton
                onClick={() => router.back()}
                className="bg-white/10 hover:bg-white/20 text-white p-3 rounded-full"
              >
                <ArrowLeft className="w-5 h-5" />
              </MagneticButton>
              
              <div>
                <h1 className="text-4xl md:text-5xl font-bold text-white">
                  {series.title}
                </h1>
                <div className="flex items-center gap-4 mt-2">
                  <span className="text-2xl text-red-400 font-semibold">
                    Season {currentSeason}
                  </span>
                  <span className="text-white/60">
                    {episodes.length} Episodes
                  </span>
                </div>
              </div>
            </div>

            {/* Season Navigation */}
            <div className="flex items-center gap-4 mb-8">
              <MagneticButton
                onClick={() => navigateSeason('prev')}
                disabled={currentSeason <= 1}
                className="bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous Season
              </MagneticButton>
              
              <span className="text-white/60">
                Season {currentSeason} of {totalSeasons}
              </span>
              
              <MagneticButton
                onClick={() => navigateSeason('next')}
                disabled={currentSeason >= totalSeasons}
                className="bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg flex items-center gap-2"
              >
                Next Season
                <ChevronRight className="w-4 h-4" />
              </MagneticButton>
            </div>
          </ScrollReveal>
        </div>
      </div>

      {/* Episodes Grid */}
      <div className="container mx-auto px-6 md:px-12 lg:px-16 pb-24">
        <ScrollReveal direction="up" delay={0.2}>
          <div className="space-y-6">
            {episodes.map((episode, index) => (
              <motion.div
                key={episode.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <GlassCard className="p-6 hover:bg-white/5 transition-all duration-300">
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Episode Thumbnail */}
                    <div className="lg:col-span-1">
                      <div className="aspect-video bg-gray-800 rounded-lg overflow-hidden relative group cursor-pointer">
                        {episode.media && (
                          <NetflixMediaCard
                            media={episode.media}
                            onPlay={() => handlePlay(episode)}
                            onInfo={() => handleInfo(episode)}
                            showPreviewOnHover={true}
                            priority={index < 3 ? 'high' : 'normal'}
                          />
                        )}
                        
                        {/* Episode Number Overlay */}
                        <div className="absolute top-2 left-2 bg-black/80 text-white px-2 py-1 rounded text-sm font-semibold">
                          {episode.episode_number}
                        </div>
                      </div>
                    </div>

                    {/* Episode Info */}
                    <div className="lg:col-span-3">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-xl font-semibold text-white mb-2">
                            {episode.episode_number}. {episode.name}
                          </h3>
                          
                          <div className="flex items-center gap-4 text-white/60 text-sm mb-3">
                            {episode.runtime && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {formatRuntime(episode.runtime)}
                              </span>
                            )}
                            
                            {episode.air_date && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                {formatDate(episode.air_date)}
                              </span>
                            )}
                            
                            {episode.vote_average && (
                              <span className="flex items-center gap-1 text-yellow-400">
                                <Star className="w-4 h-4" />
                                {episode.vote_average}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <MagneticButton
                            onClick={() => handlePlay(episode)}
                            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                          >
                            <Play className="w-4 h-4" />
                            Play
                          </MagneticButton>
                          
                          <MagneticButton
                            onClick={() => handleInfo(episode)}
                            className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-lg"
                          >
                            <Info className="w-4 h-4" />
                          </MagneticButton>
                        </div>
                      </div>

                      {/* Episode Description */}
                      <p className="text-white/80 leading-relaxed">
                        {episode.overview || `Episode ${episode.episode_number} of ${series.title} Season ${currentSeason}.`}
                      </p>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </ScrollReveal>

        {/* Season Navigation Footer */}
        <ScrollReveal direction="up" delay={0.4}>
          <div className="flex justify-center mt-12">
            <div className="flex items-center gap-4">
              <MagneticButton
                onClick={() => navigateSeason('prev')}
                disabled={currentSeason <= 1}
                className="bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg flex items-center gap-2"
              >
                <ChevronLeft className="w-5 h-5" />
                Season {currentSeason - 1}
              </MagneticButton>
              
              <span className="text-white/60 px-4">
                {currentSeason} / {totalSeasons}
              </span>
              
              <MagneticButton
                onClick={() => navigateSeason('next')}
                disabled={currentSeason >= totalSeasons}
                className="bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg flex items-center gap-2"
              >
                Season {currentSeason + 1}
                <ChevronRight className="w-5 h-5" />
              </MagneticButton>
            </div>
          </div>
        </ScrollReveal>
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