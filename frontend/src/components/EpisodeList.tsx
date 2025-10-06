"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, Check, Clock } from 'lucide-react';
import { Media } from '@/types/media';
import { getApiUrl } from '@/lib/api';
import Image from 'next/image';

interface EpisodeListProps {
  seriesId: number;
  currentEpisodeId?: number;
  onEpisodeSelect: (episode: Media) => void;
}

const EpisodeList: React.FC<EpisodeListProps> = ({
  seriesId,
  currentEpisodeId,
  onEpisodeSelect,
}) => {
  const [episodes, setEpisodes] = useState<Media[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [playbackProgress, setPlaybackProgress] = useState<Record<number, number>>({});

  useEffect(() => {
    fetchEpisodes();
    fetchPlaybackProgress();
  }, [seriesId, selectedSeason]);

  const fetchEpisodes = async () => {
    try {
      const response = await fetch(`${getApiUrl()}/api/media`);
      const allMedia = await response.json();
      
      // Filter episodes for this series and season
      const seriesEpisodes = allMedia.filter(
        (m: Media) => 
          m.series_id === seriesId && 
          m.season_number === selectedSeason &&
          m.type === 'episode'
      ).sort((a: Media, b: Media) => 
        (a.episode_number || 0) - (b.episode_number || 0)
      );
      
      setEpisodes(seriesEpisodes);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching episodes:', error);
      setLoading(false);
    }
  };

  const fetchPlaybackProgress = async () => {
    try {
      const response = await fetch(`${getApiUrl()}/api/playback/history`);
      const history = await response.json();
      
      const progressMap: Record<number, number> = {};
      history.forEach((item: any) => {
        if (item.media_id && item.progress) {
          progressMap[item.media_id] = item.progress;
        }
      });
      
      setPlaybackProgress(progressMap);
    } catch (error) {
      console.error('Error fetching playback progress:', error);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    return `${mins}m`;
  };

  const getProgressPercentage = (episodeId: number, duration: number) => {
    const progress = playbackProgress[episodeId] || 0;
    return duration > 0 ? (progress / duration) * 100 : 0;
  };

  const isWatched = (episodeId: number, duration: number) => {
    const progress = getProgressPercentage(episodeId, duration);
    return progress > 90; // Consider watched if > 90% complete
  };

  const seasons = Array.from(
    new Set(episodes.map(e => e.season_number).filter(Boolean))
  ).sort((a, b) => (a || 0) - (b || 0));

  if (loading) {
    return (
      <div className="py-8 text-center text-white/60">
        Loading episodes...
      </div>
    );
  }

  return (
    <div className="py-8">
      {/* Season Selector */}
      {seasons.length > 1 && (
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {seasons.map((season) => (
            <button
              key={season}
              onClick={() => setSelectedSeason(season || 1)}
              className={`px-6 py-2 rounded-lg font-semibold whitespace-nowrap transition-all ${
                selectedSeason === season
                  ? 'bg-white text-black'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              Season {season}
            </button>
          ))}
        </div>
      )}

      {/* Episodes Grid */}
      <div className="space-y-4">
        {episodes.map((episode, index) => {
          const watched = isWatched(episode.id, episode.duration || 0);
          const progress = getProgressPercentage(episode.id, episode.duration || 0);
          const isCurrent = episode.id === currentEpisodeId;

          return (
            <motion.div
              key={episode.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => onEpisodeSelect(episode)}
              className={`group relative bg-zinc-900/50 backdrop-blur-sm rounded-lg overflow-hidden cursor-pointer transition-all hover:bg-zinc-800/70 border ${
                isCurrent ? 'border-red-600' : 'border-white/10'
              }`}
            >
              <div className="flex gap-4 p-4">
                {/* Episode Number & Thumbnail */}
                <div className="relative flex-shrink-0">
                  <div className="w-40 h-24 bg-zinc-800 rounded overflow-hidden relative">
                    <Image
                      src={`${getApiUrl()}/api/posters/${episode.id}`}
                      alt={episode.title}
                      fill
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = `${getApiUrl()}/api/thumbnails/${episode.id}`;
                        // If thumbnail also fails, hide the image
                        target.onerror = () => {
                          target.style.display = 'none';
                        };
                      }}
                      sizes="160px"
                      className="object-cover"
                    />
                    
                    {/* Play Button Overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                        <Play className="w-6 h-6 text-black fill-current ml-1" />
                      </div>
                    </div>

                    {/* Watched Badge */}
                    {watched && (
                      <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-green-600 flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}

                    {/* Progress Bar */}
                    {progress > 0 && progress < 90 && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                        <div
                          className="h-full bg-red-600"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                  
                  {/* Episode Number */}
                  <div className="absolute -left-2 -top-2 w-8 h-8 rounded-full bg-zinc-800 border-2 border-zinc-900 flex items-center justify-center text-white font-bold text-sm">
                    {episode.episode_number}
                  </div>
                </div>

                {/* Episode Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <h3 className="text-white font-semibold text-lg group-hover:text-red-500 transition-colors">
                      {episode.title}
                    </h3>
                    <div className="flex items-center gap-2 text-white/60 text-sm flex-shrink-0">
                      <Clock className="w-4 h-4" />
                      {formatDuration(episode.duration || 0)}
                    </div>
                  </div>

                  <p className="text-white/70 text-sm line-clamp-2 mb-2">
                    {episode.description || 'No description available'}
                  </p>

                  {/* Metadata */}
                  <div className="flex items-center gap-4 text-xs text-white/50">
                    {episode.release_date && (
                      <span>{new Date(episode.release_date).getFullYear()}</span>
                    )}
                    {episode.rating && (
                      <span className="flex items-center gap-1">
                        ⭐ {episode.rating.toFixed(1)}
                      </span>
                    )}
                    {episode.resolution && (
                      <span className="px-2 py-0.5 bg-white/10 rounded">
                        {episode.resolution}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {episodes.length === 0 && (
        <div className="text-center py-12 text-white/60">
          No episodes found for Season {selectedSeason}
        </div>
      )}
    </div>
  );
};

export default EpisodeList;
