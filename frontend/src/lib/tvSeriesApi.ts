import { getApiUrl } from './api';
import { Media } from '@/types/media';

/**
 * TV Series API utilities that match backend routes
 */

export interface Series {
  id: number;
  title: string;
  description?: string;
  total_seasons: number;
  total_episodes: number;
  genres?: Array<{ name: string }>;
  rating?: number;
  year?: number;
  poster_path?: string;
  banner_path?: string;
}

export interface Season {
  id: number;
  series_id: number;
  season_number: number;
  name: string;
  overview?: string;
  episode_count: number;
  air_date?: string;
}

export interface Episode extends Media {
  series_id: number;
  season_number: number;
  episode_number: number;
}

/**
 * Get all TV series (main series entries, not episodes)
 */
export const getAllSeries = async (): Promise<Series[]> => {
  const apiUrl = getApiUrl();
  const response = await fetch(`${apiUrl}/api/series`);
  if (!response.ok) {
    throw new Error(`Failed to fetch series: ${response.status}`);
  }
  return response.json();
};

/**
 * Get a specific TV series by ID
 */
export const getSeriesById = async (seriesId: number | string): Promise<Series> => {
  const apiUrl = getApiUrl();
  const response = await fetch(`${apiUrl}/api/series/${seriesId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch series ${seriesId}: ${response.status}`);
  }
  return response.json();
};

/**
 * Get all seasons for a specific series
 */
export const getSeasonsBySeriesId = async (seriesId: number | string): Promise<Season[]> => {
  const apiUrl = getApiUrl();
  const response = await fetch(`${apiUrl}/api/series/${seriesId}/seasons`);
  if (!response.ok) {
    throw new Error(`Failed to fetch seasons for series ${seriesId}: ${response.status}`);
  }
  return response.json();
};

/**
 * Get all episodes for a specific series and season
 */
export const getEpisodesBySeriesAndSeason = async (
  seriesId: number | string, 
  seasonNumber: number | string
): Promise<Episode[]> => {
  const apiUrl = getApiUrl();
  const response = await fetch(`${apiUrl}/api/series/${seriesId}/seasons/${seasonNumber}/episodes`);
  if (!response.ok) {
    throw new Error(`Failed to fetch episodes for series ${seriesId} season ${seasonNumber}: ${response.status}`);
  }
  return response.json();
};

/**
 * Get TV shows (episodes) - matches existing endpoint
 */
export const getTVShows = async (): Promise<Media[]> => {
  const apiUrl = getApiUrl();
  const response = await fetch(`${apiUrl}/api/media/tv-shows`);
  if (!response.ok) {
    throw new Error(`Failed to fetch TV shows: ${response.status}`);
  }
  return response.json();
};

/**
 * Find next episode in a series
 */
export const findNextEpisode = async (currentEpisode: Media): Promise<Media | null> => {
  try {
    if (currentEpisode.type !== 'episode') return null;
    
    // If we have series_id, use the hierarchical API
    if (currentEpisode.series_id && currentEpisode.season_number && currentEpisode.episode_number) {
      try {
        // Try to get next episode in same season
        const episodes = await getEpisodesBySeriesAndSeason(
          currentEpisode.series_id, 
          currentEpisode.season_number
        );
        
        const nextEpisode = episodes.find(ep => 
          ep.episode_number === (currentEpisode.episode_number || 0) + 1
        );
        
        if (nextEpisode) return nextEpisode;
        
        // Try first episode of next season
        try {
          const nextSeasonEpisodes = await getEpisodesBySeriesAndSeason(
            currentEpisode.series_id,
            (currentEpisode.season_number || 0) + 1
          );
          
          return nextSeasonEpisodes.find(ep => ep.episode_number === 1) || null;
        } catch {
          return null;
        }
      } catch {
        // Fall back to the old method
      }
    }
    
    // Fallback to searching through all TV shows
    const allEpisodes = await getTVShows();
    
    // Extract season and episode numbers from title
    const currentSeasonMatch = currentEpisode.title.match(/[Ss](\d+)[Ee](\d+)/);
    if (!currentSeasonMatch) return null;
    
    const currentSeason = parseInt(currentSeasonMatch[1]);
    const currentEpisodeNum = parseInt(currentSeasonMatch[2]);
    
    // Find episodes from the same series
    const seriesEpisodes = allEpisodes.filter((media: Media) => {
      if (media.type !== 'episode') return false;
      
      // Check if it belongs to the same series
      return media.series_id === currentEpisode.series_id ||
             media.title.toLowerCase().includes(currentEpisode.title.split(' ')[0].toLowerCase()) ||
             (media.file_path && currentEpisode.file_path && 
              media.file_path.includes(currentEpisode.file_path.split('/').slice(0, -1).join('/')));
    });
    
    // Find next episode in same season
    const nextEpisodeInSeason = seriesEpisodes.find((media: Media) => {
      const episodeMatch = media.title.match(/[Ss](\d+)[Ee](\d+)/);
      if (!episodeMatch) return false;
      
      const season = parseInt(episodeMatch[1]);
      const episode = parseInt(episodeMatch[2]);
      
      return season === currentSeason && episode === currentEpisodeNum + 1;
    });
    
    if (nextEpisodeInSeason) return nextEpisodeInSeason;
    
    // Find first episode of next season
    const firstEpisodeNextSeason = seriesEpisodes.find((media: Media) => {
      const episodeMatch = media.title.match(/[Ss](\d+)[Ee](\d+)/);
      if (!episodeMatch) return false;
      
      const season = parseInt(episodeMatch[1]);
      const episode = parseInt(episodeMatch[2]);
      
      return season === currentSeason + 1 && episode === 1;
    });
    
    return firstEpisodeNextSeason || null;
  } catch (error) {
    console.error('Error finding next episode:', error);
    return null;
  }
};