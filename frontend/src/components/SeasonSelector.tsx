"use client";

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Play, Clock, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import LazyImage from './LazyImage';
import { getApiUrl } from '@/lib/api';

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

interface Season {
  id: number;
  season_number: number;
  name: string;
  overview: string;
  poster_path?: string;
  air_date?: string;
  episode_count: number;
  episodes?: Episode[];
}

interface SeasonSelectorProps {
  seasons: Season[];
  selectedSeason: number;
  onSeasonChange: (seasonNumber: number) => void;
  onEpisodePlay: (episode: any) => void;
  loading?: boolean;
}

export default function SeasonSelector({
  seasons,
  selectedSeason,
  onSeasonChange,
  onEpisodePlay,
  loading = false
}: SeasonSelectorProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [expandedEpisodes, setExpandedEpisodes] = useState<Set<number>>(new Set());

  const currentSeason = seasons.find(s => s.season_number === selectedSeason);

  const toggleEpisodeExpansion = (episodeId: number) => {
    const newExpanded = new Set(expandedEpisodes);
    if (newExpanded.has(episodeId)) {
      newExpanded.delete(episodeId);
    } else {
      newExpanded.add(episodeId);
    }
    setExpandedEpisodes(newExpanded);
  };

  const getThumbnailUrl = (episode: Episode) => {
    const apiUrl = getApiUrl();
    return episode.still_path 
      ? `${apiUrl}/api/thumbnails/${episode.id}`
      : '/placeholder-episode.jpg';
  };

  const formatRuntime = (minutes?: number) => {
    if (!minutes) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Season Selector Dropdown */}
      <div className="relative mb-8">
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center justify-between w-full md:w-auto min-w-[200px] bg-gray-800/80 hover:bg-gray-700/80 backdrop-blur-sm border border-gray-600/50 rounded-lg px-4 py-3 text-white transition-all duration-200"
        >
          <span className="font-medium">
            {currentSeason?.name || `Season ${selectedSeason}`}
          </span>
          {isDropdownOpen ? (
            <ChevronUp className="w-5 h-5 ml-2" />
          ) : (
            <ChevronDown className="w-5 h-5 ml-2" />
          )}
        </button>

        <AnimatePresence>
          {isDropdownOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-0 right-0 md:right-auto md:min-w-[200px] mt-2 bg-gray-800/95 backdrop-blur-sm border border-gray-600/50 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto"
            >
              {seasons.map((season) => (
                <button
                  key={season.season_number}
                  onClick={() => {
                    onSeasonChange(season.season_number);
                    setIsDropdownOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-700/80 transition-colors ${
                    season.season_number === selectedSeason
                      ? 'bg-red-600/20 text-red-400'
                      : 'text-white'
                  }`}
                >
                  <div className="font-medium">{season.name}</div>
                  <div className="text-sm text-gray-400">
                    {season.episode_count} episodes
                  </div>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Episodes List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
          <span className="ml-3 text-gray-400">Loading episodes...</span>
        </div>
      ) : (
        <div className="space-y-4">
          {currentSeason?.episodes?.map((episode, index) => (
            <motion.div
              key={episode.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-gray-900/50 backdrop-blur-sm border border-gray-700/50 rounded-lg overflow-hidden hover:bg-gray-800/50 transition-all duration-200"
            >
              <div className="flex items-center p-4">
                {/* Episode Number */}
                <div className="flex-shrink-0 w-12 h-12 bg-gray-800 rounded-lg flex items-center justify-center text-white font-bold mr-4">
                  {episode.episode_number}
                </div>

                {/* Episode Thumbnail */}
                <div className="flex-shrink-0 w-24 h-14 rounded-lg overflow-hidden mr-4">
                  <LazyImage
                    src={getThumbnailUrl(episode)}
                    alt={episode.name}
                    width={96}
                    height={56}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Episode Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-medium truncate mb-1">
                    {episode.name}
                  </h3>
                  <div className="flex items-center space-x-4 text-sm text-gray-400">
                    {episode.runtime && (
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 mr-1" />
                        {formatRuntime(episode.runtime)}
                      </div>
                    )}
                    {episode.vote_average && episode.vote_average > 0 && (
                      <div className="flex items-center">
                        <Star className="w-4 h-4 mr-1 text-yellow-500" />
                        {episode.vote_average.toFixed(1)}
                      </div>
                    )}
                  </div>
                  {episode.overview && (
                    <p className={`text-gray-300 text-sm mt-2 ${
                      expandedEpisodes.has(episode.id) ? '' : 'line-clamp-2'
                    }`}>
                      {episode.overview}
                    </p>
                  )}
                </div>

                {/* Play Button */}
                <button
                  onClick={() => onEpisodePlay(episode)}
                  className="flex-shrink-0 w-12 h-12 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center text-white transition-colors ml-4"
                >
                  <Play className="w-5 h-5 ml-0.5" />
                </button>
              </div>

              {/* Expand/Collapse for long descriptions */}
              {episode.overview && episode.overview.length > 150 && (
                <div className="px-4 pb-4">
                  <button
                    onClick={() => toggleEpisodeExpansion(episode.id)}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    {expandedEpisodes.has(episode.id) ? 'Show less' : 'Show more'}
                  </button>
                </div>
              )}
            </motion.div>
          )) || (
            <div className="text-center py-12">
              <p className="text-gray-400 text-lg">No episodes found for this season.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
