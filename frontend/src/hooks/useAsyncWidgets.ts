import { useState, useEffect, useCallback, useRef } from 'react';
import { Widget, parseWidgetConfig } from '@/types/widgets';
import { Media } from '@/types/media';
import { 
  useWidgetsByPage, 
  useMedia, 
  useMovies, 
  useTVShows,
  useTMDBPopularMovies,
  useTMDBNowPlaying,
  useTMDBUpcomingMovies,
  useTrendingRecommendations,
  usePopularRecommendations,
  CACHE_KEYS,
  cacheUtils
} from '@/lib/swr-api';
import { usePerformanceOptimization } from './usePerformanceOptimization';

interface WidgetDataState {
  data: Map<number, Media[]>;
  loading: Set<number>;
  errors: Map<number, string>;
  loaded: Set<number>;
}

interface UseAsyncWidgetsOptions {
  page: string;
  media?: Media[];
  upcomingMovies?: any[];
  enableCaching?: boolean;
  cacheTimeout?: number;
}

export function useAsyncWidgets({
  page,
  media = [],
  upcomingMovies = [],
  enableCaching = true,
  cacheTimeout = 300000 // 5 minutes
}: UseAsyncWidgetsOptions) {
  const { debounce } = usePerformanceOptimization('useAsyncWidgets');
  
  const [widgetDataState, setWidgetDataState] = useState<WidgetDataState>({
    data: new Map(),
    loading: new Set(),
    errors: new Map(),
    loaded: new Set()
  });

  // Use SWR hooks for data fetching with caching and fallback data
  const { data: widgets = [], isLoading: widgetsLoading, error: widgetsError } = useWidgetsByPage(page, {
    fallbackData: [],
    keepPreviousData: true
  });
  const { data: allMedia = [] } = useMedia({ fallbackData: [] });
  const { data: movies = [] } = useMovies({ fallbackData: [] });
  const { data: tvShows = [] } = useTVShows({ fallbackData: [] });
  const { data: tmdbPopular } = useTMDBPopularMovies({ fallbackData: { results: [] } });
  const { data: tmdbNowPlaying } = useTMDBNowPlaying({ fallbackData: { results: [] } });
  const { data: tmdbUpcoming } = useTMDBUpcomingMovies({ fallbackData: { results: [] } });
  const { data: trendingData } = useTrendingRecommendations(20, { fallbackData: [] });
  const { data: popularData } = usePopularRecommendations(20, { fallbackData: [] });

  // Memoized data conversion function
  const convertToMediaFormat = useCallback((items: any[]): Media[] => {
    return items.map((item: any) => ({
      id: item.id,
      title: item.title || item.name,
      description: item.overview,
      type: item.media_type === 'tv' || item.first_air_date ? 'tv' : 'movie',
      rating: item.vote_average,
      year: item.release_date ? new Date(item.release_date).getFullYear() :
        item.first_air_date ? new Date(item.first_air_date).getFullYear() : undefined,
      genre_names: item.genre_names || [],
      tmdb_poster_url: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : undefined,
      tmdb_backdrop_url: item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : undefined,
      poster_path: item.poster_path,
      backdrop_path: item.backdrop_path,
      logo_path: item.logo_path ? `https://image.tmdb.org/t/p/w500${item.logo_path}` : undefined,
      popularity: item.popularity,
      vote_count: item.vote_count,
      adult: item.adult,
      original_language: item.original_language,
      original_title: item.original_title || item.original_name,
      video: item.video,
      thumbnail_path: undefined,
      banner_path: undefined,
      file_path: undefined,
      duration: undefined,
      view_count: Math.floor(item.popularity || 0),
      genres: item.genres || []
    }));
  }, []);

  // Optimized widget data getter with caching
  const getWidgetData = useCallback((widget: Widget): Media[] => {
    const config = parseWidgetConfig(widget.config);
    let sourceData: Media[] = [];

    // Check if widget has selected content first
    if (config.selectedContent && config.selectedContent.length > 0) {
      sourceData = convertToMediaFormat(config.selectedContent);
      return sourceData.slice(0, widget.maxItems || 10);
    }

    // Determine data source based on widget configuration
    switch (widget.dataSource) {
      case 'local':
        if (widget.contentType === 'movies') {
          sourceData = movies.length > 0 ? movies : allMedia.filter(m => m.type === 'movie');
        } else if (widget.contentType === 'tv-shows') {
          sourceData = tvShows.length > 0 ? tvShows : allMedia.filter(m => m.type === 'tv' || m.type === 'series');
        } else {
          sourceData = allMedia.length > 0 ? allMedia : media;
        }
        break;

      case 'now-playing':
        sourceData = convertToMediaFormat(tmdbNowPlaying?.results || []);
        break;

      case 'upcoming':
        sourceData = convertToMediaFormat(tmdbUpcoming?.results || []);
        break;

      case 'popular':
        sourceData = convertToMediaFormat(tmdbPopular?.results || []);
        break;

      case 'trending':
        sourceData = trendingData || [];
        break;

      case 'tmdb':
      default:
        switch (widget.type) {
          case 'coming-soon':
            sourceData = convertToMediaFormat(tmdbUpcoming?.results || []);
            break;
          case 'trending-slideshow':
          case 'backdrop-slideshow':
            sourceData = convertToMediaFormat(tmdbNowPlaying?.results || []);
            break;
          default:
            sourceData = convertToMediaFormat(tmdbPopular?.results || []);
            break;
        }
        break;
    }

    // Apply filters efficiently
    let filteredData = sourceData;

    // Filter by content type
    if (widget.contentType === 'movies') {
      filteredData = filteredData.filter(m => m.type === 'movie');
    } else if (widget.contentType === 'tv-shows') {
      filteredData = filteredData.filter(m => m.type === 'tv' || m.type === 'episode' || m.type === 'series');
    }

    // Apply genre filter
    if (config.genreFilter && config.genreFilter.length > 0) {
      filteredData = filteredData.filter(m =>
        m.genre_names?.some(g => config.genreFilter!.includes(g)) ||
        m.genres?.some(g => config.genreFilter!.includes(g.name))
      );
    }

    // Apply year filter
    if (config.yearFilter) {
      filteredData = filteredData.filter(m => m.year === config.yearFilter);
    }

    // Apply rating filter
    if (config.ratingFilter) {
      filteredData = filteredData.filter(m => (m.rating || 0) >= config.ratingFilter!);
    }

    // Sort data efficiently
    switch (widget.dataSource) {
      case 'trending':
        filteredData.sort((a, b) => (b.popularity || b.view_count || 0) - (a.popularity || a.view_count || 0));
        break;
      case 'popular':
        filteredData.sort((a, b) => (b.vote_count || b.view_count || 0) - (a.vote_count || a.view_count || 0));
        break;
      case 'recent':
        filteredData.sort((a, b) => (b.year || 0) - (a.year || 0));
        break;
      default:
        filteredData.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
    }

    return filteredData.slice(0, widget.maxItems || 10);
  }, [allMedia, movies, tvShows, tmdbPopular, tmdbNowPlaying, tmdbUpcoming, trendingData, popularData, convertToMediaFormat]);

  // Debounced data loading to prevent excessive updates
  const debouncedLoadData = useCallback(
    debounce(() => {
      if (widgets.length === 0) return;

      const newData = new Map<number, Media[]>();
      const newLoaded = new Set<number>();

      widgets.forEach((widget: any) => {
        const normalizedWidget = {
          ...widget,
          dataSource: widget.data_source || widget.dataSource || 'tmdb',
          contentType: widget.content_type || widget.contentType || 'mixed',
          maxItems: widget.max_items || widget.maxItems || 10,
          colorScheme: widget.color_scheme || widget.colorScheme || 'auto',
          layout: widget.layout || 'full'
        };

        const data = getWidgetData(normalizedWidget);
        newData.set(widget.id, data);
        newLoaded.add(widget.id);
      });

      setWidgetDataState(prev => ({
        ...prev,
        data: newData,
        loaded: newLoaded,
        loading: new Set(),
        errors: new Map()
      }));
    }, 100),
    [widgets, getWidgetData]
  );

  // Load widget data when dependencies change
  useEffect(() => {
    debouncedLoadData();
  }, [debouncedLoadData]);

  // Normalize widgets (handle snake_case from backend)
  const normalizedWidgets = widgets.map((w: any) => ({
    ...w,
    dataSource: w.data_source || w.dataSource || 'tmdb',
    contentType: w.content_type || w.contentType || 'mixed',
    maxItems: w.max_items || w.maxItems || 10,
    colorScheme: w.color_scheme || w.colorScheme || 'auto',
    layout: w.layout || 'full'
  }));

  return {
    widgets: normalizedWidgets,
    widgetsLoading,
    widgetsError: widgetsError?.message || null,
    widgetData: widgetDataState.data,
    widgetLoading: widgetDataState.loading,
    widgetErrors: widgetDataState.errors,
    widgetLoaded: widgetDataState.loaded,
    loadWidgetData: () => {}, // No-op since data is loaded automatically
    refetchWidgets: () => cacheUtils.refresh(CACHE_KEYS.WIDGETS_PAGE(page))
  };
}