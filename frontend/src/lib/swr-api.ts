import React from 'react';
import useSWR, { SWRConfiguration, mutate } from 'swr';
import { getApiUrl, getSessionId, apiCall, apiCallWithSession } from './api';
import { Media } from '@/types/media';

// Optimized SWR Configuration for instant loading
export const swrConfig: SWRConfiguration = {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  refreshInterval: 0, // Disable auto-refresh completely
  dedupingInterval: 60000, // 1 minute deduplication for better caching
  errorRetryCount: 1, // Minimal retries for speed
  errorRetryInterval: 1000, // Fast retry
  loadingTimeout: 8000, // Longer timeout for widget data
  focusThrottleInterval: 60000,
  refreshWhenHidden: false,
  refreshWhenOffline: false,
  shouldRetryOnError: false, // No retries for instant loading
  keepPreviousData: true, // Keep previous data while loading new
  fallbackData: [], // Always provide fallback to prevent loading states
};

// Cache keys for different data types
export const CACHE_KEYS = {
  // Media
  MEDIA: '/api/media',
  MOVIES: '/api/media/movies',
  TV_SHOWS: '/api/media/tv-shows',
  SERIES: '/api/series',
  GENRES: '/api/genres',
  
  // Recommendations
  RECOMMENDATIONS_UNIQUE: (type: string, limit: number) => `/api/recommendations/unique?type=${type}&limit=${limit}`,
  RECOMMENDATIONS_TRENDING: (limit: number) => `/api/recommendations/trending?limit=${limit}`,
  RECOMMENDATIONS_POPULAR: (limit: number) => `/api/recommendations/popular?limit=${limit}`,
  RECOMMENDATIONS_SCIFI: (limit: number) => `/api/recommendations/scifi?limit=${limit}`,
  
  // TMDB
  TMDB_UPCOMING_MOVIES: '/api/upcoming-movies',
  TMDB_UPCOMING_TV: '/api/upcoming-tv-series',
  TMDB_NOW_PLAYING: '/api/tmdb/movie/now-playing',
  TMDB_POPULAR_MOVIES: '/api/tmdb/movie/popular',
  TMDB_DISCOVER: (genres: string) => `/api/tmdb/discover/movie?with_genres=${genres}`,
  
  // Widgets
  WIDGETS: '/api/widgets',
  WIDGETS_PAGE: (page: string) => `/api/widgets/page/${page}`,
  WIDGETS_META: '/api/widgets/meta',
  
  // Playback
  PLAYBACK_RECENT: '/api/playback/recent',
  PLAYBACK_CONTINUE: '/api/playback/continue',
  MY_LIST: '/api/mylist',
  
  // Music
  MUSIC_TRENDING: '/api/music/trending',
  MUSIC_PLAYLISTS: '/api/music/playlists',
  MUSIC_LIKED: '/api/music/tracks/liked',
  
  // Search
  SEARCH: (query: string) => `/api/media/search?q=${encodeURIComponent(query)}`,
  GENRE_MEDIA: (genre: string, page: number, limit: number) => `/api/media/genre/${encodeURIComponent(genre)}?page=${page}&limit=${limit}`,
};

// Custom fetcher with session support and optimized performance
const fetcher = async (url: string) => {
  const baseUrl = getApiUrl();
  const fullUrl = `${baseUrl}${url}`;
  
  try {
    // Optimized timeout for widget loading
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 15000); // 15 second timeout for widgets with data
    
    const response = await fetch(fullUrl, {
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': '1',
        ...(typeof window !== 'undefined' ? { 'X-Session-ID': getSessionId() } : {}),
      },
      signal: controller.signal,
      // Enable browser caching for better performance
      cache: 'default',
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Log the actual error for debugging
      console.error(`API Error ${response.status} for ${fullUrl}:`, response.statusText);
      
      // For widgets, always throw error to trigger SWR error handling
      if (url.includes('/widgets')) {
        throw new Error(`Widget API Error: ${response.status} ${response.statusText}`);
      }
      
      // Return empty array for optional endpoints instead of throwing
      if (response.status === 404 && url.includes('/mylist')) {
        console.warn(`404 for ${url}, returning empty array`);
        return [];
      }
      
      // For other errors, return empty array to prevent loading states
      console.warn(`API Error ${response.status} for ${fullUrl}, returning empty array`);
      return [];
    }

    const data = await response.json();
    console.log(`SWR Fetcher success for ${url}:`, Array.isArray(data) ? `${data.length} items` : typeof data);
    return data;
    
  } catch (error) {
    // Handle AbortError gracefully
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('SWR Fetcher: Request aborted (timeout) for', fullUrl);
      // For widgets, throw error to trigger SWR error handling
      if (url.includes('/widgets')) {
        throw new Error('Widget request timeout');
      }
      return [];
    }
    
    console.error('SWR Fetcher: Error for', fullUrl, error);
    
    // For widgets, throw error to trigger SWR error handling
    if (url.includes('/widgets')) {
      console.error('Widget fetch failed, throwing error');
      throw error;
    }
    
    // For optional endpoints, return empty array instead of throwing
    if (url.includes('/mylist')) {
      return [];
    }
    
    // For critical endpoints, throw the error
    throw error;
  }
};

// Hook for fetching all media with caching
export function useMedia(config?: SWRConfiguration) {
  return useSWR<Media[]>(CACHE_KEYS.MEDIA, fetcher, {
    ...swrConfig,
    refreshInterval: 0, // Disable auto-refresh to prevent re-renders
    ...config,
  });
}

// Hook for fetching movies with caching
export function useMovies(config?: SWRConfiguration) {
  return useSWR<Media[]>(CACHE_KEYS.MOVIES, fetcher, {
    ...swrConfig,
    refreshInterval: 60000, // Refresh every minute
    ...config,
  });
}

// Hook for fetching TV shows with caching
export function useTVShows(config?: SWRConfiguration) {
  return useSWR<Media[]>(CACHE_KEYS.TV_SHOWS, fetcher, {
    ...swrConfig,
    refreshInterval: 60000,
    ...config,
  });
}

// Hook for fetching series with caching
export function useSeries(config?: SWRConfiguration) {
  return useSWR<any[]>(CACHE_KEYS.SERIES, fetcher, {
    ...swrConfig,
    refreshInterval: 60000,
    ...config,
  });
}

// Hook for fetching genres with caching
export function useGenres(config?: SWRConfiguration) {
  return useSWR<any[]>(CACHE_KEYS.GENRES, fetcher, {
    ...swrConfig,
    refreshInterval: 300000, // Refresh every 5 minutes (genres change rarely)
    ...config,
  });
}

// Hook for unique recommendations with caching
export function useUniqueRecommendations(type: string = 'mixed', limit: number = 20, config?: SWRConfiguration) {
  return useSWR<Media[]>(
    CACHE_KEYS.RECOMMENDATIONS_UNIQUE(type, limit),
    fetcher,
    {
      ...swrConfig,
      refreshInterval: 0, // Disable auto-refresh to prevent re-renders
      ...config,
    }
  );
}

// Hook for trending recommendations with caching
export function useTrendingRecommendations(limit: number = 20, config?: SWRConfiguration) {
  return useSWR<Media[]>(
    CACHE_KEYS.RECOMMENDATIONS_TRENDING(limit),
    fetcher,
    {
      ...swrConfig,
      refreshInterval: 0, // Disable auto-refresh to prevent re-renders
      ...config,
    }
  );
}

// Hook for popular recommendations with caching
export function usePopularRecommendations(limit: number = 20, config?: SWRConfiguration) {
  return useSWR<Media[]>(
    CACHE_KEYS.RECOMMENDATIONS_POPULAR(limit),
    fetcher,
    {
      ...swrConfig,
      refreshInterval: 0, // Disable auto-refresh to prevent re-renders
      ...config,
    }
  );
}

// Hook for sci-fi recommendations with caching
export function useSciFiRecommendations(limit: number = 20, config?: SWRConfiguration) {
  return useSWR<Media[]>(
    CACHE_KEYS.RECOMMENDATIONS_SCIFI(limit),
    fetcher,
    {
      ...swrConfig,
      refreshInterval: 0, // Disable auto-refresh to prevent re-renders
      ...config,
    }
  );
}

// Hook for TMDB upcoming movies with caching
export function useTMDBUpcomingMovies(config?: SWRConfiguration) {
  return useSWR<any>(CACHE_KEYS.TMDB_UPCOMING_MOVIES, fetcher, {
    ...swrConfig,
    refreshInterval: 3600000, // Refresh every hour (TMDB data changes slowly)
    ...config,
  });
}

// Hook for TMDB upcoming TV series with caching
export function useTMDBUpcomingTV(config?: SWRConfiguration) {
  return useSWR<any>(CACHE_KEYS.TMDB_UPCOMING_TV, fetcher, {
    ...swrConfig,
    refreshInterval: 3600000, // Refresh every hour
    ...config,
  });
}

// Hook for TMDB now playing movies with caching
export function useTMDBNowPlaying(config?: SWRConfiguration) {
  return useSWR<any>(CACHE_KEYS.TMDB_NOW_PLAYING, fetcher, {
    ...swrConfig,
    refreshInterval: 3600000, // Refresh every hour
    ...config,
  });
}

// Hook for TMDB popular movies with caching
export function useTMDBPopularMovies(config?: SWRConfiguration) {
  return useSWR<any>(CACHE_KEYS.TMDB_POPULAR_MOVIES, fetcher, {
    ...swrConfig,
    refreshInterval: 3600000, // Refresh every hour
    ...config,
  });
}

// Hook for widgets with caching
export function useWidgets(config?: SWRConfiguration) {
  return useSWR<any[]>(CACHE_KEYS.WIDGETS, fetcher, {
    ...swrConfig,
    refreshInterval: 300000, // Refresh every 5 minutes
    ...config,
  });
}

// Hook for widgets by page with caching
export function useWidgetsByPage(page: string, config?: SWRConfiguration) {
  const key = page ? CACHE_KEYS.WIDGETS_PAGE(page) : null;
  
  console.log('useWidgetsByPage called:', { page, key });
  
  return useSWR<any[]>(
    key,
    fetcher,
    {
      ...swrConfig,
      refreshInterval: 300000, // Refresh every 5 minutes
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      errorRetryCount: 2, // Reduce retry count to avoid infinite loops
      errorRetryInterval: 3000,
      shouldRetryOnError: (error) => {
        // Don't retry on certain errors to prevent crashes
        if (error?.message?.includes('Failed to fetch')) {
          console.log('SWR: Not retrying fetch error to prevent crashes');
          return false;
        }
        return true;
      },
      fallbackData: [], // Provide fallback data to prevent crashes
      onError: (error) => {
        console.error('SWR useWidgetsByPage error:', {
          page,
          key,
          error: error.message,
          stack: error.stack
        });
      },
      onSuccess: (data) => {
        console.log('SWR useWidgetsByPage success:', {
          page,
          key,
          dataLength: Array.isArray(data) ? data.length : 'not array',
          data: Array.isArray(data) ? data.slice(0, 2) : data // Log first 2 items
        });
      },
      onLoadingSlow: () => {
        console.warn('SWR useWidgetsByPage loading slowly for page:', page);
      },
      ...config,
    }
  );
}

// Hook for widgets with data by page - optimized for fast loading
export function useWidgetsWithDataByPage(page: string, config?: SWRConfiguration) {
  const key = page ? `/api/widgets/page/${page}/with-data` : null;
  
  console.log('useWidgetsWithDataByPage called:', { page, key });
  
  const result = useSWR<any[]>(
    key,
    fetcher,
    {
      ...swrConfig,
      refreshInterval: 600000, // Refresh every 10 minutes (widgets change rarely)
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      errorRetryCount: 2,
      errorRetryInterval: 3000,
      shouldRetryOnError: (error) => {
        console.log('SWR shouldRetryOnError:', error?.message);
        if (error?.message?.includes('Failed to fetch')) {
          console.log('SWR: Not retrying fetch error for widgets with data');
          return false;
        }
        return true;
      },
      fallbackData: [], // Provide fallback data to prevent crashes
      onError: (error) => {
        console.error('SWR useWidgetsWithDataByPage error:', {
          page,
          key,
          error: error.message,
          stack: error.stack
        });
      },
      onSuccess: (data) => {
        console.log('SWR useWidgetsWithDataByPage success:', {
          page,
          key,
          dataLength: Array.isArray(data) ? data.length : 'not array',
          data: Array.isArray(data) ? data.slice(0, 1) : data // Log first item
        });
      },
      onLoadingSlow: () => {
        console.warn('SWR useWidgetsWithDataByPage loading slowly for page:', page);
      },
      // Enable background revalidation for better UX
      revalidateIfStale: true,
      // Keep data fresh but don't block UI
      revalidateOnMount: true,
      ...config,
    }
  );

  console.log('useWidgetsWithDataByPage result:', {
    page,
    data: result.data,
    dataLength: Array.isArray(result.data) ? result.data.length : 'not array',
    isLoading: result.isLoading,
    error: result.error?.message,
    isValidating: result.isValidating
  });

  return result;
}

// Hook for widget metadata with caching
export function useWidgetMeta(config?: SWRConfiguration) {
  return useSWR<any>(CACHE_KEYS.WIDGETS_META, fetcher, {
    ...swrConfig,
    refreshInterval: 600000, // Refresh every 10 minutes (meta data changes rarely)
    ...config,
  });
}

// Hook for recently watched with caching
export function useRecentlyWatched(config?: SWRConfiguration) {
  return useSWR<Media[]>(CACHE_KEYS.PLAYBACK_RECENT, fetcher, {
    ...swrConfig,
    refreshInterval: 30000, // Refresh every 30 seconds
    ...config,
  });
}

// Hook for continue watching with caching
export function useContinueWatching(config?: SWRConfiguration) {
  return useSWR<Media[]>(CACHE_KEYS.PLAYBACK_CONTINUE, fetcher, {
    ...swrConfig,
    refreshInterval: 30000, // Refresh every 30 seconds
    ...config,
  });
}

// Hook for my list with caching
export function useMyList(config?: SWRConfiguration) {
  return useSWR<Media[]>(CACHE_KEYS.MY_LIST, fetcher, {
    ...swrConfig,
    refreshInterval: 60000, // Refresh every minute
    ...config,
  });
}

// Hook for music trending with caching
export function useMusicTrending(config?: SWRConfiguration) {
  return useSWR<any[]>(CACHE_KEYS.MUSIC_TRENDING, fetcher, {
    ...swrConfig,
    refreshInterval: 300000, // Refresh every 5 minutes
    ...config,
  });
}

// Hook for music playlists with caching
export function useMusicPlaylists(config?: SWRConfiguration) {
  return useSWR<any[]>(CACHE_KEYS.MUSIC_PLAYLISTS, fetcher, {
    ...swrConfig,
    refreshInterval: 60000, // Refresh every minute
    ...config,
  });
}

// Hook for liked music tracks with caching
export function useLikedTracks(config?: SWRConfiguration) {
  return useSWR<any[]>(CACHE_KEYS.MUSIC_LIKED, fetcher, {
    ...swrConfig,
    refreshInterval: 60000, // Refresh every minute
    ...config,
  });
}

// Hook for search with caching
export function useSearch(query: string, config?: SWRConfiguration) {
  return useSWR<Media[]>(
    query ? CACHE_KEYS.SEARCH(query) : null,
    fetcher,
    {
      ...swrConfig,
      refreshInterval: 0, // Don't auto-refresh search results
      dedupingInterval: 2000, // 2 seconds deduplication for search
      ...config,
    }
  );
}

// Hook for media by genre with caching
export function useMediaByGenre(genre: string, page: number = 1, limit: number = 50, config?: SWRConfiguration) {
  return useSWR<Media[]>(
    genre ? CACHE_KEYS.GENRE_MEDIA(genre, page, limit) : null,
    fetcher,
    {
      ...swrConfig,
      refreshInterval: 300000, // Refresh every 5 minutes
      ...config,
    }
  );
}

// Utility functions for cache management
export const cacheUtils = {
  // Clear all cache
  clearAll: () => {
    mutate(() => true, undefined, { revalidate: false });
  },

  // Clear specific cache key
  clear: (key: string) => {
    mutate(key, undefined, { revalidate: false });
  },

  // Refresh specific cache key
  refresh: (key: string) => {
    mutate(key);
  },

  // Refresh all media-related caches
  refreshMedia: () => {
    mutate(CACHE_KEYS.MEDIA);
    mutate(CACHE_KEYS.MOVIES);
    mutate(CACHE_KEYS.TV_SHOWS);
    mutate(CACHE_KEYS.SERIES);
  },

  // Refresh all recommendation caches
  refreshRecommendations: () => {
    mutate((key) => typeof key === 'string' && key.includes('/api/recommendations'));
  },

  // Refresh all TMDB caches
  refreshTMDB: () => {
    mutate((key) => typeof key === 'string' && key.includes('/api/tmdb'));
    mutate(CACHE_KEYS.TMDB_UPCOMING_MOVIES);
    mutate(CACHE_KEYS.TMDB_UPCOMING_TV);
  },

  // Refresh all widget caches
  refreshWidgets: () => {
    mutate((key) => typeof key === 'string' && key.includes('/api/widgets'));
  },

  // Preload data
  preload: (key: string) => {
    mutate(key, fetcher(key), { revalidate: false });
  },
};

// Hook for preloading data
export function usePreloadData() {
  const preloadHomeData = React.useCallback(() => {
    // Preload essential home page data
    cacheUtils.preload(CACHE_KEYS.MEDIA);
    cacheUtils.preload(CACHE_KEYS.RECOMMENDATIONS_UNIQUE('mixed', 20));
    cacheUtils.preload(CACHE_KEYS.RECOMMENDATIONS_TRENDING(20));
    cacheUtils.preload(CACHE_KEYS.RECOMMENDATIONS_POPULAR(20));
    cacheUtils.preload(CACHE_KEYS.TMDB_UPCOMING_MOVIES);
    cacheUtils.preload(CACHE_KEYS.WIDGETS_PAGE('home'));
  }, []);

  const preloadMoviesData = React.useCallback(() => {
    cacheUtils.preload(CACHE_KEYS.MOVIES);
    cacheUtils.preload(CACHE_KEYS.TMDB_POPULAR_MOVIES);
    cacheUtils.preload(CACHE_KEYS.WIDGETS_PAGE('movies'));
  }, []);

  const preloadTVData = React.useCallback(() => {
    cacheUtils.preload(CACHE_KEYS.TV_SHOWS);
    cacheUtils.preload(CACHE_KEYS.SERIES);
    cacheUtils.preload(CACHE_KEYS.TMDB_UPCOMING_TV);
    cacheUtils.preload(CACHE_KEYS.WIDGETS_PAGE('tv-shows'));
  }, []);

  return {
    preloadHomeData,
    preloadMoviesData,
    preloadTVData,
  };
}

// Export SWR for direct use when needed
export { useSWR, mutate };