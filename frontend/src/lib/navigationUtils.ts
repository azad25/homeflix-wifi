import { Media } from '@/types/media';

/**
 * Navigation utilities for consistent routing across the app
 */

export const getMediaDetailUrl = (media: Media): string => {
  // Route TV series/episodes to TV series detail page
  if (media.type === 'episode' || media.type === 'tv' || media.type === 'series') {
    // If it's an episode, try to get the series ID, otherwise use the media ID
    const seriesId = media.series_id || media.id;
    return `/tv-series/${seriesId}`;
  }
  
  // Route movies to movie detail page
  return `/movie/${media.id}`;
};

export const getSeasonUrl = (seriesId: number | string, seasonNumber: number): string => {
  return `/tv-series/${seriesId}/season/${seasonNumber}`;
};

export const getEpisodeSeasonUrl = (media: Media): string => {
  const seriesId = media.series_id || media.id;
  const seasonNumber = extractSeasonNumber(media.title) || 1;
  return getSeasonUrl(seriesId, seasonNumber);
};

export const extractSeasonNumber = (title: string): number | null => {
  const seasonMatch = title.match(/[Ss](\d+)[Ee](\d+)|[Ss]eason\s*(\d+)/i);
  if (seasonMatch) {
    return parseInt(seasonMatch[1] || seasonMatch[3]);
  }
  return null;
};

export const extractEpisodeNumber = (title: string): number | null => {
  const episodeMatch = title.match(/[Ss](\d+)[Ee](\d+)|[Ee]pisode\s*(\d+)/i);
  if (episodeMatch) {
    return parseInt(episodeMatch[2] || episodeMatch[3]);
  }
  return null;
};

export const isSeriesContent = (media: Media): boolean => {
  return media.type === 'episode' || media.type === 'tv' || media.type === 'series';
};

export const isMovieContent = (media: Media): boolean => {
  return media.type === 'movie';
};