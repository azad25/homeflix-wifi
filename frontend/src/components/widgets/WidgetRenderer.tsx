"use client";

import React, { useState, useEffect } from 'react';
import { Widget, parseWidgetConfig } from '@/types/widgets';
import { Media } from '@/types/media';
import { getApiUrl } from '@/lib/api';
import { useWidgetsByPage } from '@/lib/swr-api';

// Import widget components
import FeaturedBanner from './FeaturedBanner';
import HalfWidthBanner from './HalfWidthBanner';
import TrendingSlideshow from './TrendingSlideshow';
import ComingSoonBanner from './ComingSoonBanner';
import MovieGridWidget from './MovieGridWidget';
import GenreBasedWidget from './GenreBasedWidget';
import BackdropSlideshow from './BackdropSlideshow';
import TrailerWidget from './TrailerWidget';
import RecentlyWatchedWidget from './RecentlyWatchedWidget';
import NotificationWidget from './NotificationWidget';
import HomeflixGrid from './HomeflixGrid';

interface WidgetRendererProps {
    page: string;
    media?: Media[];
    upcomingMovies?: any[];
    className?: string;
}

export default function WidgetRenderer({
    page,
    media = [],
    upcomingMovies = [],
    className = '',
}: WidgetRendererProps) {
    const [widgetData, setWidgetData] = useState<Map<number, Media[]>>(new Map());
    const [loading, setLoading] = useState(false); // Start as false for instant loading
    const [dataCache, setDataCache] = useState<Map<string, { data: Media[], timestamp: number }>>(new Map());
    const [error, setError] = useState<string | null>(null);

    const apiUrl = getApiUrl();

    // Use SWR-based hook for better performance and caching
    const { data: rawWidgets = [], isLoading: widgetsLoading, error: widgetsError } = useWidgetsByPage(page, {
        fallbackData: [],
        keepPreviousData: true
    });

    // Add error boundary with better handling
    useEffect(() => {
        if (widgetsError) {
            console.warn('Widget loading error (non-blocking):', widgetsError);
            setError(null); // Don't show errors for widgets
            setLoading(false); // Don't block the page
        }
    }, [widgetsError]);

    // Debug logging and manual API test
    useEffect(() => {
        const testApiUrl = getApiUrl();
        console.log('WidgetRenderer render:', { 
            page, 
            mediaCount: media.length, 
            widgetsLoading, 
            widgetsCount: rawWidgets.length,
            hasError: !!widgetsError,
            errorMessage: widgetsError || 'No error',
            apiUrl: testApiUrl,
            fullWidgetUrl: `${testApiUrl}/api/widgets/page/${page}`,
            rawWidgets: rawWidgets.slice(0, 2) // Log first 2 widgets for debugging
        });

        // Manual API test to debug SWR issues
        if (page === 'browse') {
            console.log('Testing manual API call for browse page...');
            console.log('Error details:', widgetsError);
            
            // Test basic connectivity first
            fetch(`${testApiUrl}/api/widgets/page/${page}`)
                .then(response => {
                    console.log('Browse Widget API response:', response.status, response.statusText);
                    return response.json();
                })
                .then(data => {
                    console.log('Browse Widget API data:', data);
                })
                .catch(error => {
                    console.error('Browse Widget API call failed:', error);
                    console.error('Error type:', error.constructor.name);
                    console.error('Error message:', error.message);
                });
        }
    }, [page, media.length, widgetsLoading, rawWidgets.length, widgetsError]);

    // Normalize widgets (handle snake_case from backend)
    const widgets = React.useMemo(() => {
        if (!rawWidgets || rawWidgets.length === 0) return [];
        return rawWidgets.map((w: any) => ({
            ...w,
            dataSource: w.data_source || w.dataSource || 'tmdb',
            contentType: w.content_type || w.contentType || 'mixed',
            maxItems: w.max_items || w.maxItems || 10,
            colorScheme: w.color_scheme || w.colorScheme || 'auto',
            layout: w.layout || 'full'
        }));
    }, [rawWidgets]);

    // Fetch TMDB data based on widget configuration with caching
    const fetchTMDBData = React.useCallback(async (widget: Widget): Promise<Media[]> => {
        const config = parseWidgetConfig(widget.config);
        const cacheKey = `${widget.dataSource}-${widget.contentType}-${widget.type}-${JSON.stringify(config.genreFilter)}`;
        
        // Check cache first (5 minute cache)
        const cached = dataCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < 300000) {
            return cached.data;
        }

        let tmdbData: any[] = [];

        try {
            // Add timeout for TMDB requests
            const fetchWithTimeout = async (url: string, timeout = 5000) => {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);
                
                try {
                    const response = await fetch(url, { signal: controller.signal });
                    clearTimeout(timeoutId);
                    return response;
                } catch (error) {
                    clearTimeout(timeoutId);
                    throw error;
                }
            };

            switch (widget.dataSource) {
                case 'now-playing':
                    const nowPlayingResponse = await fetchWithTimeout(`${apiUrl}/api/tmdb/movie/now-playing`);
                    if (nowPlayingResponse.ok) {
                        const data = await nowPlayingResponse.json();
                        tmdbData = data.results || [];
                    }
                    break;

                case 'upcoming':
                    const upcomingResponse = await fetchWithTimeout(`${apiUrl}/api/upcoming-movies`);
                    if (upcomingResponse.ok) {
                        const data = await upcomingResponse.json();
                        tmdbData = data.results || [];
                    }
                    break;

                case 'top-rated':
                case 'popular':
                    if (widget.contentType === 'movies') {
                        const popularResponse = await fetchWithTimeout(`${apiUrl}/api/tmdb/movie/popular`);
                        if (popularResponse.ok) {
                            const data = await popularResponse.json();
                            tmdbData = data.results || [];
                        }
                    } else if (widget.contentType === 'tv-shows') {
                        const tvResponse = await fetchWithTimeout(`${apiUrl}/api/upcoming-tv-series?section=popular`);
                        if (tvResponse.ok) {
                            const data = await tvResponse.json();
                            tmdbData = data.results || [];
                        }
                    }
                    break;

                case 'tmdb':
                default:
                    // Handle widget type specific TMDB fetching
                    switch (widget.type) {
                        case 'coming-soon':
                            const comingSoonResponse = await fetchWithTimeout(`${apiUrl}/api/upcoming-movies`);
                            if (comingSoonResponse.ok) {
                                const data = await comingSoonResponse.json();
                                tmdbData = data.results || [];
                            }
                            break;

                        case 'trending-slideshow':
                        case 'backdrop-slideshow':
                            if (widget.contentType === 'movies') {
                                const trendingResponse = await fetchWithTimeout(`${apiUrl}/api/tmdb/movie/now-playing`);
                                if (trendingResponse.ok) {
                                    const data = await trendingResponse.json();
                                    tmdbData = data.results || [];
                                }
                            } else if (widget.contentType === 'tv-shows') {
                                const tvResponse = await fetchWithTimeout(`${apiUrl}/api/upcoming-tv-series?section=trending`);
                                if (tvResponse.ok) {
                                    const data = await tvResponse.json();
                                    tmdbData = data.results || [];
                                }
                            }
                            break;

                        case 'trailer':
                            // For trailers, use popular movies/shows
                            const trailerResponse = await fetchWithTimeout(`${apiUrl}/api/tmdb/movie/popular`);
                            if (trailerResponse.ok) {
                                const data = await trailerResponse.json();
                                tmdbData = data.results || [];
                            }
                            break;

                        case 'genre-based':
                            if (config.genreFilter && config.genreFilter.length > 0) {
                                const genreQuery = config.genreFilter.join(',');
                                const discoverResponse = await fetchWithTimeout(`${apiUrl}/api/tmdb/discover/movie?with_genres=${genreQuery}`);
                                if (discoverResponse.ok) {
                                    const data = await discoverResponse.json();
                                    tmdbData = data.results || [];
                                }
                            }
                            break;

                        default:
                            // For other widget types, use popular content
                            const defaultResponse = await fetchWithTimeout(`${apiUrl}/api/tmdb/movie/popular`);
                            if (defaultResponse.ok) {
                                const data = await defaultResponse.json();
                                tmdbData = data.results || [];
                            }
                            break;
                    }
                    break;
            }

            // Convert TMDB data to Media format
            const convertedData = tmdbData.map((item: any) => ({
                id: item.id,
                tmdb_id: item.id, // Set tmdb_id for TMDB content navigation
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
                popularity: item.popularity,
                vote_count: item.vote_count,
                adult: item.adult,
                original_language: item.original_language,
                original_title: item.original_title || item.original_name,
                video: item.video,
                // Additional fields for compatibility
                thumbnail_path: undefined,
                banner_path: undefined,
                file_path: undefined,
                duration: undefined,
                view_count: Math.floor(item.popularity || 0),
                genres: item.genres || []
            }));

            // Cache the result
            setDataCache(prev => new Map(prev).set(cacheKey, { data: convertedData, timestamp: Date.now() }));
            
            return convertedData;

        } catch (error) {
            console.error('Failed to fetch TMDB data:', error);
            return [];
        }
    }, [apiUrl]);

    // Memoize the media array to prevent unnecessary re-renders
    const memoizedMedia = React.useMemo(() => media, [media]);

    // Memoize the getWidgetData function to prevent re-renders
    const getWidgetData = React.useCallback(async (widget: Widget): Promise<Media[]> => {
        const config = parseWidgetConfig(widget.config);
        let filteredMedia: Media[] = [];

        // Check if widget has selected content first
        if (config.selectedContent && config.selectedContent.length > 0) {
            console.log('Using selectedContent for widget:', widget.name, config.selectedContent);
            
            // Convert selected content to Media format
            filteredMedia = config.selectedContent.map((item: any) => ({
                id: item.id,
                tmdb_id: item.id, // Set tmdb_id for TMDB content navigation
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
            
            console.log('Converted selectedContent to Media format:', filteredMedia);
            return filteredMedia.slice(0, widget.maxItems || 10);
        }

        // Determine if we should use TMDB data based on widget type and configuration
        const shouldUseTMDB = widget.dataSource === 'tmdb' || 
                             widget.dataSource === 'now-playing' || 
                             widget.dataSource === 'upcoming' || 
                             widget.dataSource === 'top-rated' ||
                             widget.dataSource === 'popular' ||
                             // Force TMDB for these widget types regardless of data_source setting
                             widget.type === 'trending-slideshow' ||
                             widget.type === 'coming-soon' ||
                             widget.type === 'backdrop-slideshow' ||
                             widget.type === 'trailer' ||
                             widget.type === 'featured-banner' ||
                             widget.type === 'movie-grid' ||
                             // Default to TMDB if data_source is "local" but no local media available
                             (widget.dataSource === 'local' && memoizedMedia.length === 0);

        if (shouldUseTMDB) {
            filteredMedia = await fetchTMDBData(widget);
        } else {
            // Use local media data
            filteredMedia = [...memoizedMedia];

            // Filter by content type
            if (widget.contentType === 'movies') {
                filteredMedia = filteredMedia.filter(m => m.type === 'movie');
            } else if (widget.contentType === 'tv-shows') {
                filteredMedia = filteredMedia.filter(m => m.type === 'tv' || m.type === 'episode' || m.type === 'series');
            }
        }

        // Apply additional filters
        if (config.genreFilter && config.genreFilter.length > 0) {
            filteredMedia = filteredMedia.filter(m =>
                m.genre_names?.some(g => config.genreFilter!.includes(g)) ||
                m.genres?.some(g => config.genreFilter!.includes(g.name))
            );
        }

        // Filter by year
        if (config.yearFilter) {
            filteredMedia = filteredMedia.filter(m => m.year === config.yearFilter);
        }

        // Filter by rating
        if (config.ratingFilter) {
            filteredMedia = filteredMedia.filter(m => (m.rating || 0) >= config.ratingFilter!);
        }

        // Sort based on data source or widget type
        if (shouldUseTMDB) {
            // Keep TMDB order or sort by rating
            filteredMedia.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        } else {
            switch (widget.dataSource) {
                case 'trending':
                    filteredMedia.sort((a, b) => (b.popularity || b.view_count || 0) - (a.popularity || a.view_count || 0));
                    break;
                case 'popular':
                    filteredMedia.sort((a, b) => (b.vote_count || b.view_count || 0) - (a.vote_count || a.view_count || 0));
                    break;
                case 'recent':
                    filteredMedia.sort((a, b) => (b.year || 0) - (a.year || 0));
                    break;
                default:
                    // Keep original order for 'local'
                    break;
            }
        }

        // Limit items
        const finalData = filteredMedia.slice(0, widget.maxItems || 10);

        return finalData;
    }, [memoizedMedia, fetchTMDBData]);

    // Fetch widget data when widgets change
    useEffect(() => {
        let isMounted = true;
        
        const fetchWidgetData = async () => {
            if (!widgets.length) {
                if (isMounted) setLoading(false);
                return;
            }

            try {
                if (isMounted) setLoading(true);
                const dataMap = new Map<number, Media[]>();

                // Add timeout to prevent infinite loading
                const timeout = setTimeout(() => {
                    console.warn('Widget data fetch timeout, using fallback');
                    if (isMounted) {
                        setLoading(false);
                        // Set empty data for all widgets to prevent infinite loading
                        const fallbackMap = new Map<number, Media[]>();
                        widgets.forEach(widget => fallbackMap.set(widget.id, []));
                        setWidgetData(fallbackMap);
                    }
                }, 10000); // 10 second timeout

                // Process widgets in parallel for better performance
                const widgetPromises = widgets.map(async (widget) => {
                    try {
                        const data = await getWidgetData(widget);
                        return { id: widget.id, data };
                    } catch (error) {
                        console.error(`Failed to fetch data for widget ${widget.name}:`, error);
                        return { id: widget.id, data: [] };
                    }
                });

                const results = await Promise.allSettled(widgetPromises);
                
                if (isMounted) {
                    results.forEach((result) => {
                        if (result.status === 'fulfilled') {
                            const { id, data } = result.value;
                            dataMap.set(id, data);
                        }
                    });
                    
                    clearTimeout(timeout);
                    setWidgetData(dataMap);
                    setLoading(false);
                }
            } catch (error) {
                console.error('Failed to fetch widget data:', error);
                if (isMounted) {
                    setLoading(false);
                    // Set empty data to prevent infinite loading
                    const fallbackMap = new Map<number, Media[]>();
                    widgets.forEach(widget => fallbackMap.set(widget.id, []));
                    setWidgetData(fallbackMap);
                }
            }
        };

        // Only fetch if widgets have changed (not just loading state)
        if (!widgetsLoading && widgets.length > 0) {
            fetchWidgetData();
        } else if (!widgetsLoading && widgets.length === 0) {
            if (isMounted) setLoading(false);
        }

        return () => {
            isMounted = false;
        };
    }, [widgets, widgetsLoading, getWidgetData]);

    // Render a single widget
    const renderWidget = (widget: Widget) => {
        try {
            const config = parseWidgetConfig(widget.config);
            const widgetMediaData = widgetData.get(widget.id) || [];

            // Skip if no data and not a special widget type
            if (widgetMediaData.length === 0 && widget.type !== 'coming-soon' && widget.type !== 'notifications') {
                return null;
            }

        switch (widget.type) {
            case 'featured-banner':
                return (
                    <FeaturedBanner
                        key={widget.id}
                        media={widgetMediaData}
                        autoScroll={config.autoScroll}
                        scrollInterval={config.scrollInterval}
                        showLogo={config.showLogo}
                        showDescription={config.showDescription}
                        showRating={config.showRating}
                    />
                );

            case 'half-banner':
                return widgetMediaData[0] ? (
                    <HalfWidthBanner
                        key={widget.id}
                        media={widgetMediaData[0]}
                        showLogo={config.showLogo}
                        showDescription={config.showDescription}
                    />
                ) : null;

            case 'backdrop-slideshow':
                return (
                    <BackdropSlideshow
                        key={widget.id}
                        media={widgetMediaData}
                        autoScroll={config.autoScroll}
                        scrollInterval={config.scrollInterval}
                        showLogo={config.showLogo}
                        showInfo={config.showDescription}
                    />
                );

            case 'trending-slideshow':
                return (
                    <TrendingSlideshow
                        key={widget.id}
                        media={widgetMediaData}
                        title={config.title || widget.name}
                        autoScroll={config.autoScroll}
                        scrollInterval={config.scrollInterval}
                        maxItems={widget.maxItems}
                    />
                );

            case 'coming-soon':
                // Use upcomingMovies or TMDB data for coming soon
                const comingSoonData = widget.dataSource === 'tmdb' ? widgetMediaData : upcomingMovies;
                return comingSoonData.length > 0 ? (
                    <ComingSoonBanner
                        key={widget.id}
                        movies={comingSoonData}
                        autoScroll={config.autoScroll}
                        scrollInterval={config.scrollInterval}
                    />
                ) : null;

            case 'movie-grid':
            case 'new-releases':
            case 'recently-added':
                return (
                    <MovieGridWidget
                        key={widget.id}
                        media={widgetMediaData}
                        title={config.title || widget.name}
                        subtitle={config.subtitle}
                        maxItems={widget.maxItems}
                        showRating={config.showRating}
                    />
                );

            case 'genre-based':
                const genre = config.genreFilter?.[0] || 'Action';
                return (
                    <GenreBasedWidget
                        key={widget.id}
                        media={widgetMediaData}
                        genre={genre}
                        title={config.title || widget.name}
                        maxItems={widget.maxItems}
                    />
                );

            case 'trailer':
                return (
                    <TrailerWidget
                        key={widget.id}
                        media={widgetMediaData}
                        title={config.title || widget.name}
                        maxItems={widget.maxItems}
                        autoPlay={config.autoPlay}
                        showInfo={config.showDescription}
                    />
                );

            case 'recently-watched':
            case 'continue-watching':
                return (
                    <RecentlyWatchedWidget
                        key={widget.id}
                        title={config.title || widget.name}
                        maxItems={widget.maxItems}
                        layout={widget.layout === 'full' ? 'banner' : 'slideshow'}
                        showProgress={config.showRating !== false}
                        className={widget.layout === 'full' ? 'mb-8' : ''}
                    />
                );

            case 'popular':
                return (
                    <TrendingSlideshow
                        key={widget.id}
                        media={widgetMediaData}
                        title={config.title || 'Popular Now'}
                        maxItems={widget.maxItems}
                    />
                );

            case 'notifications':
                console.log('Rendering NotificationWidget with widget:', widget);
                return (
                    <NotificationWidget
                        key={widget.id}
                        widget={widget}
                        className="w-full"
                    />
                );

            case 'homeflix-grid':
                return (
                    <HomeflixGrid
                        key={widget.id}
                        media={widgetMediaData}
                        title={config.title || widget.name}
                        maxItems={widget.maxItems}
                        showRating={config.showRating !== false}
                        showYear={config.showYear !== false}
                    />
                );

            default:
                return null;
        }
        } catch (error) {
            console.error(`Error rendering widget ${widget.name}:`, error);
            return (
                <div key={widget.id} className="w-full p-4 bg-red-900/20 rounded-lg">
                    <p className="text-red-400 text-sm">
                        Error loading widget: {widget.name}
                    </p>
                </div>
            );
        }
    };

    // Group widgets by layout for side-by-side rendering with proper viewport width
    const renderWidgets = () => {
        const elements: React.ReactNode[] = [];
        let i = 0;

        while (i < widgets.length) {
            const widget = widgets[i];

            if (widget.layout === 'third') {
                // Collect up to 3 third-width widgets
                const thirdWidgets = [];
                let j = i;
                while (j < widgets.length && widgets[j].layout === 'third' && thirdWidgets.length < 3) {
                    thirdWidgets.push(widgets[j]);
                    j++;
                }

                // Render third-width widgets in a responsive row
                elements.push(
                    <div key={`third-group-${i}`} className="w-full">
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 w-full">
                            {thirdWidgets.map(w => (
                                <div key={w.id} className="w-full min-h-0">
                                    {renderWidget(w)}
                                </div>
                            ))}
                        </div>
                    </div>
                );
                i = j;
            } else if (widget.layout === 'half') {
                // Check if next widget is also half
                const nextWidget = widgets[i + 1];
                if (nextWidget && nextWidget.layout === 'half') {
                    // Render side by side with responsive breakpoints
                    elements.push(
                        <div key={`half-pair-${widget.id}`} className="w-full">
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 w-full">
                                <div className="w-full min-h-0">
                                    {renderWidget(widget)}
                                </div>
                                <div className="w-full min-h-0">
                                    {renderWidget(nextWidget)}
                                </div>
                            </div>
                        </div>
                    );
                    i += 2;
                } else {
                    // Single half widget - use full width on mobile, centered on desktop
                    elements.push(
                        <div key={widget.id} className="w-full">
                            <div className="w-full max-w-5xl mx-auto">
                                {renderWidget(widget)}
                            </div>
                        </div>
                    );
                    i++;
                }
            } else {
                // Full width widget
                elements.push(
                    <div key={widget.id} className="w-full">
                        {renderWidget(widget)}
                    </div>
                );
                i++;
            }
        }

        return elements;
    };

    if (loading || widgetsLoading) {
        // Don't block the page - show widgets container with loading placeholders
        return (
            <div className={`w-full px-4 md:px-8 ${className}`}>
                <div className="w-full max-w-7xl mx-auto space-y-8">
                    {/* Loading placeholders for widgets */}
                    <div className="animate-pulse space-y-8">
                        <div className="h-64 bg-white/5 rounded-lg"></div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div className="h-48 bg-white/5 rounded-lg"></div>
                            <div className="h-48 bg-white/5 rounded-lg"></div>
                        </div>
                        <div className="h-32 bg-white/5 rounded-lg"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (error || widgetsError) {
        // Show a subtle error message that doesn't block the page
        return (
            <div className={`w-full px-4 md:px-8 ${className}`}>
                <div className="w-full max-w-7xl mx-auto">
                    <div className="text-center text-gray-500 py-8 bg-white/5 rounded-lg">
                        <p className="text-sm">Widgets temporarily unavailable</p>
                        <p className="text-xs text-gray-600 mt-1">The page will continue to work normally</p>
                    </div>
                </div>
            </div>
        );
    }

    if (widgets.length === 0) {
        console.log('No widgets found for page:', page, 'rawWidgets:', rawWidgets);
        // Show a message instead of returning null
        return (
            <div className={`w-full px-4 md:px-8 ${className}`}>
                <div className="w-full max-w-7xl mx-auto">
                    <div className="text-center text-gray-400 py-4">
                        No widgets configured for page: {page}
                    </div>
                </div>
            </div>
        );
    }

    console.log('Rendering widgets for page:', page, 'widgets:', widgets.map(w => ({ id: w.id, name: w.name, type: w.type })));

    try {
        return (
            <div className={`w-full px-4 md:px-8 ${className}`}>
                <div className="w-full max-w-7xl mx-auto space-y-8">
                    {renderWidgets()}
                </div>
            </div>
        );
    } catch (renderError) {
        console.error('Widget render error:', renderError);
        return (
            <div className={`w-full px-4 md:px-8 ${className}`}>
                <div className="w-full max-w-7xl mx-auto">
                    <div className="text-center text-red-400 py-4">
                        Widget rendering error. Please refresh the page.
                    </div>
                </div>
            </div>
        );
    }
}