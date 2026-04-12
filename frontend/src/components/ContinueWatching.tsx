"use client";

import React, { useState, useEffect } from 'react';
import { RotateCcw, Play, Info, Clock, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Media } from '@/types/media';
import { getApiUrl } from '@/lib/api';
import { cleanMovieTitle } from '@/lib/titleUtils';
import { useNavigate } from '@/hooks/useNavigate';
import ImageWithFallback from '@/components/ImageWithFallback';

interface ContinueWatchingItem {
  id: number;
  media_id: number;
  user_id: string;
  position: number;
  duration: number;
  progress: number;
  completed: boolean;
  last_watched: string;
  media: Media;
  next_episode?: Media; // Add next episode info
}

interface ContinueWatchingProps {
  onPlay: (media: Media, startTime?: number) => void;
  onInfo: (media: Media) => void;
}

interface ContinueWatchingCardProps {
  item: ContinueWatchingItem;
  onPlay: (media: Media, startTime?: number) => void;
  onInfo: (media: Media) => void;
  index: number;
}

const ContinueWatchingCard: React.FC<ContinueWatchingCardProps> = ({
  item,
  onPlay,
  onInfo,
  index
}) => {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLoading(true);
    setTimeout(() => {
      onPlay(item.media, item.position);
      setIsLoading(false);
    }, 300);
  };

  const handleInfoClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.media.type === 'episode' || item.media.type === 'tv' || item.media.type === 'series') {
      const seriesId = item.media.series_id || item.media.id;
      navigate.push(`/tv-series/${seriesId}`);
    } else {
      navigate.push(`/movie/${item.media.id}`);
    }
  };

  const handleCardClick = () => {
    if (item.media.type === 'episode' || item.media.type === 'tv' || item.media.type === 'series') {
      const seriesId = item.media.series_id || item.media.id;
      navigate.push(`/tv-series/${seriesId}`);
    } else {
      navigate.push(`/movie/${item.media.id}`);
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const getYear = () => {
    if (item.media.year) {
      return item.media.year;
    } else if (item.media.release_date) {
      return new Date(item.media.release_date).getFullYear().toString();
    }

    if (item.media.file_path) {
      const yearMatch = item.media.file_path.match(/\b(19|20)\d{2}\b/);
      if (yearMatch) return yearMatch[0];
    }

    if (item.media.title) {
      const yearMatch = item.media.title.match(/\b(19|20)\d{2}\b/);
      if (yearMatch) return yearMatch[0];
    }

    return null;
  };

  const getQualityBadge = () => {
    const qualityText = item.media.quality ?
      (item.media.quality.includes('2160') || item.media.quality.toLowerCase().includes('4k') ? '4K' : 'HD')
      : "HD";
    return { text: qualityText, color: 'bg-blue-600' };
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="relative group cursor-pointer flex-none w-72 md:w-80"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
      style={{ zIndex: isHovered ? 50 : 1 }}
    >
      <motion.div
        className="relative bg-gray-900 rounded-xl overflow-hidden shadow-xl"
        animate={{
          scale: isHovered ? 1.05 : 1,
          y: isHovered ? -8 : 0,
        }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        style={{
          transformOrigin: 'center center',
          zIndex: isHovered ? 50 : 1,
        }}
      >
        {/* Main Image Container */}
        <div className="relative h-48 md:h-52 overflow-hidden">
          <ImageWithFallback
            mediaId={item.media.id}
            alt={cleanMovieTitle(item.media.title)}
            fill
            sizes="(max-width: 768px) 50vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            loading={index < 3 ? "eager" : "lazy"}
            priority={index < 3}
          />

          {/* Quality Badge */}
          <div className="absolute top-3 right-3 z-10">
            <span className={`${getQualityBadge().color} text-white text-xs px-2 py-1 rounded-md font-bold shadow-lg`}>
              {getQualityBadge().text}
            </span>
          </div>

          {/* Next Episode Badge */}
          {item.progress === 0 && item.media.type === 'episode' && (
            <div className="absolute top-3 left-3 bg-green-600 text-white text-xs px-2 py-1 rounded-full font-semibold shadow-lg">
              NEXT
            </div>
          )}

          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

          {/* Progress Bar */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
            <motion.div
              className="bg-red-600 h-full"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(Math.max(item.progress, 0), 100)}%` }}
              transition={{ duration: 0.8, delay: index * 0.1 }}
            />
          </div>

          {/* Content Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
            {/* Title */}
            <h3 className="text-white font-bold text-base line-clamp-2 mb-2 drop-shadow-lg">
              {cleanMovieTitle(item.media.title)}
            </h3>

            {/* Progress Text */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-300 text-sm">
                <Clock className="w-4 h-4" />
                <span>
                  {item.progress === 0 && item.media.type === 'episode' ?
                    'Next Episode' :
                    `${Math.round(item.progress)}% watched`
                  }
                </span>
              </div>
              
              {getYear() && (
                <span className="text-gray-300 text-sm font-medium">
                  {getYear()}
                </span>
              )}
            </div>

            {/* Rating */}
            {item.media.rating && item.media.rating > 0 && (
              <div className="flex items-center gap-1 mt-2">
                <Star className="w-3 h-3 text-yellow-400 fill-current" />
                <span className="text-white text-sm font-medium">{item.media.rating.toFixed(1)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons - Show on Hover */}
        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-4 right-4 flex gap-2 z-30"
            >
              <button
                onClick={handleInfoClick}
                className="bg-gray-800/90 backdrop-blur-sm text-white p-2 rounded-full hover:bg-gray-700/90 transition-colors shadow-lg"
                title="More Info"
              >
                <Info className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
};

export const ContinueWatching: React.FC<ContinueWatchingProps> = ({
  onPlay,
  onInfo
}) => {
  const [continueItems, setContinueItems] = useState<ContinueWatchingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchContinueWatching();
  }, []);

  // Helper function to find the next episode in a series
  const findNextEpisode = async (currentEpisode: Media, allMedia: Media[]): Promise<Media | null> => {
    try {
      // Extract season and episode numbers from metadata or title
      let currentSeason = currentEpisode.season_number;
      let currentEpisodeNum = currentEpisode.episode_number;

      if (!currentSeason || !currentEpisodeNum) {
        const currentSeasonMatch = currentEpisode.title.match(/[Ss](\d+)[Ee](\d+)/);
        if (!currentSeasonMatch) {
          console.log('Could not extract season/episode from title:', currentEpisode.title);
          return null;
        }
        currentSeason = parseInt(currentSeasonMatch[1]);
        currentEpisodeNum = parseInt(currentSeasonMatch[2]);
      }

      console.log(`Looking for next episode after S${currentSeason}E${currentEpisodeNum} of ${currentEpisode.title}`);

      // Find episodes from the same series
      const seriesEpisodes = allMedia.filter((media: Media) => {
        if (media.type !== 'episode') return false;

        // Check if it belongs to the same series using multiple methods
        const belongsToSeries =
          (currentEpisode.series_id && media.series_id === currentEpisode.series_id) ||
          (currentEpisode.title && media.title.toLowerCase().includes(
            currentEpisode.title.split(' ')[0].toLowerCase()
          )) ||
          (currentEpisode.file_path && media.file_path &&
            media.file_path.includes(currentEpisode.file_path.split('/').slice(0, -1).join('/')));

        return belongsToSeries;
      });

      console.log(`Found ${seriesEpisodes.length} episodes in the same series`);

      // First, try to find the next episode in the same season
      const nextEpisodeInSeason = seriesEpisodes.find((media: Media) => {
        let season = media.season_number;
        let episode = media.episode_number;

        if (!season || !episode) {
          const episodeMatch = media.title.match(/[Ss](\d+)[Ee](\d+)/);
          if (!episodeMatch) return false;
          season = parseInt(episodeMatch[1]);
          episode = parseInt(episodeMatch[2]);
        }

        return season === currentSeason && episode === currentEpisodeNum + 1;
      });

      if (nextEpisodeInSeason) {
        console.log(`Found next episode in same season: ${nextEpisodeInSeason.title}`);
        return nextEpisodeInSeason;
      }

      // If no next episode in current season, try first episode of next season
      const firstEpisodeNextSeason = seriesEpisodes.find((media: Media) => {
        let season = media.season_number;
        let episode = media.episode_number;

        if (!season || !episode) {
          const episodeMatch = media.title.match(/[Ss](\d+)[Ee](\d+)/);
          if (!episodeMatch) return false;
          season = parseInt(episodeMatch[1]);
          episode = parseInt(episodeMatch[2]);
        }

        return season === currentSeason + 1 && episode === 1;
      });

      if (firstEpisodeNextSeason) {
        console.log(`Found first episode of next season: ${firstEpisodeNextSeason.title}`);
      } else {
        console.log('No next episode found');
      }

      return firstEpisodeNextSeason || null;
    } catch (error) {
      console.error('Error finding next episode:', error);
      return null;
    }
  };

  const fetchContinueWatching = async () => {
    try {
      setLoading(true);
      setError(null);
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/playback/continue?limit=20`, {
        headers: {
          'X-User-ID': '1' // Default user for now
        }
      });

      if (response.ok) {
        const data = await response.json();

  // Fetch all media to find next episodes
  const allMediaResponse = await fetch(`${apiUrl}/api/media`);
  const allMedia = await allMediaResponse.json();

        // Filter out duplicates, invalid items, and ensure we have real content
        const validItems = await Promise.all((data || [])
          .filter((item: ContinueWatchingItem) => {
            // Must have valid media object with basic required fields
            if (!item.media || !item.media.id || !item.media.title) {
              console.log('🔍 Filtered out: missing media data', item);
              return false;
            }

            // Much more lenient progress filtering - allow any progress between 0.1% and 99.9%
            if (item.progress === undefined || item.progress < 0.1 || item.progress > 99.9) {
              console.log('🔍 Filtered out: invalid progress', item.progress, item.media.title);
              return false;
            }

            // Only require position to exist (can be 0), duration should be positive
            if (item.position === undefined || item.duration === undefined || item.duration <= 0) {
              console.log('🔍 Filtered out: invalid position/duration', {
                position: item.position,
                duration: item.duration,
                title: item.media.title
              });
              return false;
            }

            // Filter out obvious placeholder or test content
            const title = item.media.title.toLowerCase();
            if (title.includes('test_') || title.includes('placeholder_') || title.includes('sample_')) {
              console.log('🔍 Filtered out: test content', title);
              return false;
            }

            return true;
          })
          .map(async (item: ContinueWatchingItem) => {
            // For TV series episodes that are nearly complete (>90%), find the next episode
            if (item.media.type === 'episode' && item.progress > 90) {
              const nextEpisode = await findNextEpisode(item.media, allMedia);
              if (nextEpisode) {
                console.log(`📺 Found next episode for ${item.media.title}: ${nextEpisode.title}`);
                return {
                  ...item,
                  media: nextEpisode,
                  position: 0, // Start from beginning of next episode
                  progress: 0
                };
              }
            }
            return item;
          }));

        const processedItems = validItems
          // Remove duplicates based on media_id
          .filter((item: ContinueWatchingItem, index: number, array: ContinueWatchingItem[]) => {
            return array.findIndex(i => i.media_id === item.media_id) === index;
          })
          // Sort by last watched (most recent first)
          .sort((a: ContinueWatchingItem, b: ContinueWatchingItem) => {
            return new Date(b.last_watched).getTime() - new Date(a.last_watched).getTime();
          })
          // Limit to 10 items
          .slice(0, 10);

        setContinueItems(processedItems);
        console.log(`✅ Loaded ${processedItems.length} valid continue watching items`);

        // Debug logging for continue watching data
        if (data && data.length > 0) {
          console.log('📊 Continue watching raw data:', data.length, 'items');
          console.log('📊 Sample item:', data[0]);
          console.log('📊 Filtered to:', processedItems.length, 'valid items');

          // Log all items for debugging
          data.forEach((item: ContinueWatchingItem, idx: number) => {
            console.log(`📊 Item ${idx + 1}:`, {
              id: item.id,
              media_id: item.media_id,
              title: item.media?.title,
              progress: item.progress,
              position: item.position,
              duration: item.duration,
              hasValidMedia: !!(item.media && item.media.id && item.media.title)
            });
          });
        } else {
          console.log('📝 No continue watching data returned from API');
        }

        // Additional debugging for filtered items
        if (data && data.length > 0 && processedItems.length === 0) {
          console.log('🔍 All items were filtered out. Checking reasons...');
          data.forEach((item: ContinueWatchingItem, idx: number) => {
            if (idx < 5) { // Check first 5 items
              const reasons = [];
              if (!item.media || !item.media.id || !item.media.title) reasons.push('invalid media');
              if (item.progress === undefined || item.progress < 0.1 || item.progress > 99.9) reasons.push(`progress: ${item.progress}%`);
              if (item.position === undefined || item.duration === undefined || item.duration <= 0) reasons.push('invalid position/duration');
              const title = item.media?.title?.toLowerCase() || '';
              if (title.includes('test_') || title.includes('placeholder_') || title.includes('sample_')) reasons.push('test content');

              console.log(`🔍 Item ${idx + 1} (${item.media?.title}): filtered because: ${reasons.join(', ')}`);
            }
          });
        }
      } else if (response.status === 404) {
        // No continue watching data found - this is normal for new users
        setContinueItems([]);
        console.log('📝 No continue watching data found - user hasn\'t started watching anything yet');
      } else {
        // Log the response for debugging
        const errorText = await response.text();
        console.error('❌ Continue watching API error:', response.status, errorText);
        throw new Error(`Failed to fetch continue watching items: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to fetch continue watching:', error);
      setError('Failed to load continue watching items');
    } finally {
      setLoading(false);
    }
  };



  if (loading) {
    return (
      <div className="mb-12">
        <div className="flex items-center justify-between mb-6 px-4 md:px-0">
          <h2 className="text-white text-xl font-semibold">
            Continue Watching
          </h2>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-4 px-4 md:px-0" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <style jsx>{`
            div::-webkit-scrollbar {
              display: none;
            }
          `}</style>
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="flex-none w-72 md:w-80 h-52 bg-gray-800/30 rounded-xl animate-pulse backdrop-blur-sm border border-gray-700/30"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-12">
        <div className="flex items-center justify-between mb-6 px-4 md:px-12">
          <h2 className="text-2xl md:text-3xl font-bold text-white bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
            Continue Watching
          </h2>
        </div>
        <div className="px-4 md:px-12">
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6 text-center">
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={fetchContinueWatching}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (continueItems.length === 0) {
    return null;
  }

  return (
    <div className="mb-12">
      <div className="flex items-center justify-between mb-6 px-4 md:px-0">
        <h2 className="text-white text-xl font-semibold">
          Continue Watching
        </h2>
        <button
          onClick={fetchContinueWatching}
          className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10"
          title="Refresh"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
      </div>

      <div className="relative">
        <div className="flex gap-2 overflow-x-auto pb-4 px-4 md:px-0" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <style jsx>{`
            div::-webkit-scrollbar {
              display: none;
            }
          `}</style>
          {continueItems.map((item, index) => (
            <ContinueWatchingCard
              key={item.id}
              item={item}
              onPlay={onPlay}
              onInfo={onInfo}
              index={index}
            />
          ))}
        </div>
      </div>
    </div>
  );
};



export default ContinueWatching;