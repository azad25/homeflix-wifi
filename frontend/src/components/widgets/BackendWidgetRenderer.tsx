"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getApiUrl } from '@/lib/api';
import WidgetPerformanceMonitor from './WidgetPerformanceMonitor';
import { widgetCache } from '@/utils/widgetCache';

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
import HeroVideoWidget from './HeroVideoWidget';

interface BackendWidgetRendererProps {
    page: string;
    className?: string;
    onRefresh?: () => void; // Callback for when widgets are refreshed
}

interface WidgetWithData {
    id: number;
    name: string;
    type: string;
    page: string;
    position: number;
    enabled: boolean;
    config: string;
    content_type: string;
    data_source: string;
    max_items: number;
    layout: string;
    color_scheme: string;
    data: MediaItem[];
}

interface MediaItem {
    id: number;
    title: string;
    description?: string;
    type: string;
    rating?: number;
    year?: number;
    duration?: number;
    genre_names?: string[];
    thumbnail_path?: string;
    poster_path?: string;
    backdrop_path?: string;
    logo_path?: string;
    tmdb_poster_url?: string;
    tmdb_backdrop_url?: string;
    tmdb_trailer_url?: string;
    media_type?: string;
    preview_path?: string;
    preview_clip_path?: string;
    trailer_path?: string;
    tmdb_id?: number;
    popularity?: number;
    vote_count?: number;
    adult?: boolean;
    original_language?: string;
    original_title?: string;
    video?: boolean;
    view_count?: number;
    series_id?: number;
    release_date?: string;
    first_air_date?: string;
    runtime?: number;
    certification?: string;
    tagline?: string;
    genres?: Array<{ id: number; name: string }>;
    is_local?: boolean;
    file_path?: string;
    notification_data?: any; // Add notification data
}

// Convert backend MediaItem to frontend Media format
const convertToFrontendMedia = (items: MediaItem[]) => {
    if (!items || !Array.isArray(items)) return [];
    return items.map(item => ({
        id: item.id,
        title: item.title,
        description: item.description || '',
        type: item.type,
        media_type: item.media_type,
        rating: item.rating || 0,
        year: item.year || 0,
        duration: item.duration || 0,
        genre_names: item.genre_names || [],
        thumbnail_path: item.thumbnail_path,
        poster_path: item.poster_path,
        backdrop_path: item.backdrop_path,
        logo_path: item.logo_path,
        tmdb_poster_url: item.tmdb_poster_url,
        tmdb_backdrop_url: item.tmdb_backdrop_url,
        tmdb_trailer_url: item.tmdb_trailer_url,
        preview_path: item.preview_path,
        preview_clip_path: item.preview_clip_path,
        trailer_path: item.trailer_path,
        tmdb_id: item.tmdb_id,
        popularity: item.popularity || 0,
        vote_count: item.vote_count || 0,
        adult: item.adult || false,
        original_language: item.original_language || 'en',
        original_title: item.original_title || item.title,
        video: item.video || false,
        view_count: item.view_count || 0,
        series_id: item.series_id,
        release_date: item.release_date,
        first_air_date: item.first_air_date,
        runtime: item.runtime,
        certification: item.certification,
        tagline: item.tagline,
        genres: item.genres || [],
        is_local: item.is_local || false,
        poster_url: item.tmdb_poster_url || item.poster_path,
        banner_path: item.tmdb_backdrop_url || item.backdrop_path,
        file_path: item.file_path,
        notification_data: item.notification_data, // Pass through notification data
    }));
};

// Parse widget config
const parseConfig = (configStr: string) => {
    try {
        return JSON.parse(configStr || '{}');
    } catch {
        return {};
    }
};

export default function BackendWidgetRenderer({
    page,
    className = '',
    onRefresh,
}: BackendWidgetRendererProps) {
    const [widgets, setWidgets] = useState<WidgetWithData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const fetchedRef = useRef(false);

    // Fetch widgets with in-memory caching for instant subsequent loads
    useEffect(() => {
        const controller = new AbortController();

        const fetchWidgets = async () => {
            const apiUrl = getApiUrl();

            // Check smart cache first for instant loading
            const cachedData = widgetCache.get(page);
            if (cachedData) {
                console.log('BackendWidgetRenderer: Using cached widgets from widgetCache');
                setWidgets(cachedData as WidgetWithData[]);
                setLoading(false);
                if (onRefresh) onRefresh();
                return;
            }

            const url = `${apiUrl}/api/widgets/page/${page}/with-data`;

            try {
                // Only show loading on true first load (no cache at all)
                if (!fetchedRef.current && widgets.length === 0) setLoading(true);
                setError(null);

                const startTime = performance.now();
                const response = await fetch(url, {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-User-ID': '1',
                    },
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                const loadTime = performance.now() - startTime;

                if (Array.isArray(data) && !controller.signal.aborted) {
                    setWidgets(data);
                    // Cache the data using smart cache for instant subsequent loads
                    widgetCache.set(page, data);
                    if (onRefresh) onRefresh();
                    
                    console.log(`⚡ Widgets loaded for page ${page} in ${loadTime.toFixed(2)}ms`);
                } else if (!controller.signal.aborted) {
                    setWidgets([]);
                }
            } catch (err) {
                if (controller.signal.aborted) return;
                console.error('BackendWidgetRenderer: Error fetching widgets:', err);
                setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                    fetchedRef.current = true;
                }
            }
        };

        if (page) {
            fetchWidgets();
        }

        return () => controller.abort();
    }, [page, onRefresh]);

    // Memoize widget rendering for better performance
    const renderWidget = useMemo(() => (widgetWithData: WidgetWithData) => {
        try {
            const config = parseConfig(widgetWithData.config);
            let media = convertToFrontendMedia(widgetWithData.data || []);

            if (config.selectedContent && Array.isArray(config.selectedContent)) {
                media = media.map(item => {
                    const selectedItem = config.selectedContent.find((c: any) => c.id === item.id && c?._source === 'local');
                    const isLocal = Boolean(item.is_local || selectedItem);

                    if (isLocal) {
                        return {
                            ...item,
                            is_local: true,
                            poster_path: item.poster_path,
                            backdrop_path: item.backdrop_path,
                            logo_path: item.logo_path,
                            trailer_path: item.trailer_path,
                            tmdb_trailer_url: item.tmdb_trailer_url,
                            tmdb_poster_url: item.tmdb_poster_url,
                            tmdb_backdrop_url: item.tmdb_backdrop_url,
                        };
                    }
                    return item;
                });
            }

            console.log(`Rendering widget ${widgetWithData.name}:`, {
                type: widgetWithData.type,
                dataSource: widgetWithData.data_source,
                dataCount: media.length,
                config: config,
                hasSelectedContent: config.selectedContent && config.selectedContent.length > 0,
                rawDataCount: widgetWithData.data?.length || 0,
                rawData: widgetWithData.data?.slice(0, 2), // Show first 2 items for debugging
                convertedData: media.slice(0, 2), // Show first 2 converted items
            });

            // For specific content widgets, always render even with no data (they might have selected content)
            const shouldRenderWithoutData = [
                'specific-content',
                'coming-soon',
                'notifications',
                'featured-banner', // Add featured-banner to always render
                'recently-watched',
                'continue-watching'
            ].includes(widgetWithData.type);

            // For widgets with "recent" data source, always try to render
            const isRecentDataSource = widgetWithData.data_source === 'recent';

            // Skip if no data and not a special widget type or recent data source
            if (media.length === 0 && !shouldRenderWithoutData && !isRecentDataSource) {
                console.log(`Skipping widget ${widgetWithData.name} - no data and not a special type`);
                return null;
            }

            switch (widgetWithData.type) {
                case 'featured-banner':
                case 'specific-content':
                    return (
                        <FeaturedBanner
                            key={widgetWithData.id}
                            media={media}
                            autoScroll={config.autoScroll !== false}
                            scrollInterval={config.scrollInterval || 8}
                            showLogo={config.showLogo !== false}
                            showDescription={config.showDescription !== false}
                            showRating={config.showRating !== false}
                            config={config}
                        />
                    );

                case 'preview-video':
                    return (
                        <HeroVideoWidget
                            key={widgetWithData.id}
                            media={media}
                            mode="preview"
                            autoPlay={config.autoPlay !== false}
                            slideDurationMs={(config.scrollInterval ? config.scrollInterval * 1000 : 8000)}
                            config={config}
                            isMuted={config.isMuted}
                        />
                    );

                case 'media-trailer':
                    return (
                        <HeroVideoWidget
                            key={widgetWithData.id}
                            media={media}
                            mode="trailer"
                            autoPlay={config.autoPlay !== false}
                            slideDurationMs={(config.scrollInterval ? config.scrollInterval * 1000 : 8000)}
                            config={config}
                            isMuted={config.isMuted}
                        />
                    );

                case 'mixed-video':
                    return (
                        <HeroVideoWidget
                            key={widgetWithData.id}
                            media={media}
                            mode="mixed"
                            autoPlay={config.autoPlay !== false}
                            slideDurationMs={(config.scrollInterval ? config.scrollInterval * 1000 : 8000)}
                            config={config}
                            isMuted={config.isMuted}
                        />
                    );

                case 'half-banner':
                    return media.length > 0 ? (
                        <HalfWidthBanner
                            key={widgetWithData.id}
                            media={media.length === 1 ? media[0] : media}
                            showLogo={config.showLogo !== false}
                            showDescription={config.showDescription !== false}
                            showPoster={config.showPoster === true}
                        />
                    ) : null;

                case 'backdrop-slideshow':
                    return (
                        <BackdropSlideshow
                            key={widgetWithData.id}
                            media={media}
                            autoScroll={config.autoScroll !== false}
                            scrollInterval={config.scrollInterval || 10}
                            showLogo={config.showLogo !== false}
                            showInfo={config.showDescription !== false}
                            config={config}
                        />
                    );

                case 'trending-slideshow':
                    return (
                        <TrendingSlideshow
                            key={widgetWithData.id}
                            media={media}
                            title={config.title || widgetWithData.name}
                            autoScroll={config.autoScroll !== false}
                            scrollInterval={config.scrollInterval || 5}
                            maxItems={widgetWithData.max_items}
                        />
                    );

                case 'coming-soon':
                    return media.length > 0 ? (
                        <ComingSoonBanner
                            key={widgetWithData.id}
                            movies={media}
                            autoScroll={config.autoScroll !== false}
                            scrollInterval={config.scrollInterval || 8}
                            config={config}
                        />
                    ) : null;

                case 'movie-grid':
                case 'new-releases':
                case 'recently-added':
                    return (
                        <MovieGridWidget
                            key={widgetWithData.id}
                            media={media}
                            title={config.title || widgetWithData.name}
                            subtitle={config.subtitle}
                            maxItems={widgetWithData.max_items}
                            showRating={config.showRating !== false}
                        />
                    );

                case 'homeflix-grid':
                    return (
                        <HomeflixGrid
                            key={widgetWithData.id}
                            media={media}
                            title={config.title || widgetWithData.name}
                            subtitle={config.subtitle}
                            maxItems={widgetWithData.max_items}
                            showRating={config.showRating !== false}
                            showYear={config.showYear !== false}
                            autoScroll={config.autoScroll !== false}
                            scrollInterval={config.scrollInterval || 5000}
                        />
                    );

                case 'genre-based':
                    const genre = config.genreFilter?.[0] || config.genre_filter?.[0] || 'Action';
                    return (
                        <GenreBasedWidget
                            key={widgetWithData.id}
                            media={media}
                            genre={genre}
                            title={config.title || widgetWithData.name}
                            maxItems={widgetWithData.max_items}
                        />
                    );

                case 'trailer':
                    return (
                        <TrailerWidget
                            key={widgetWithData.id}
                            media={media}
                            title={config.title || widgetWithData.name}
                            maxItems={widgetWithData.max_items}
                            autoPlay={config.autoPlay !== false}
                            showInfo={config.showDescription !== false}
                            autoScroll={config.autoScroll !== false}
                            scrollInterval={config.scrollInterval || 8}
                            config={config}
                            isMuted={config.isMuted}
                        />
                    );

                case 'recently-watched':
                case 'continue-watching':
                    return (
                        <RecentlyWatchedWidget
                            key={widgetWithData.id}
                            title={config.title || widgetWithData.name}
                            maxItems={widgetWithData.max_items}
                            layout={widgetWithData.layout === 'full' ? 'banner' : 'slideshow'}
                            showProgress={config.showRating !== false}
                            className={widgetWithData.layout === 'full' ? 'mb-8' : ''}
                        />
                    );

                case 'popular':
                    return (
                        <TrendingSlideshow
                            key={widgetWithData.id}
                            media={media}
                            title={config.title || 'Popular Now'}
                            maxItems={widgetWithData.max_items}
                        />
                    );

                case 'notifications':
                    const notificationWidget = {
                        id: widgetWithData.id,
                        name: widgetWithData.name,
                        type: widgetWithData.type as 'notifications',
                        page: widgetWithData.page as any,
                        position: widgetWithData.position,
                        enabled: widgetWithData.enabled,
                        config: widgetWithData.config,
                        contentType: widgetWithData.content_type as any,
                        dataSource: widgetWithData.data_source as any,
                        maxItems: widgetWithData.max_items,
                        layout: widgetWithData.layout as any,
                        colorScheme: widgetWithData.color_scheme as any,
                    };
                    console.log('🔔 BackendWidgetRenderer: Rendering NotificationWidget with config:', notificationWidget);
                    console.log('🔔 BackendWidgetRenderer: Widget enabled:', widgetWithData.enabled);
                    // Don't pass cached data as initialData for notifications - let the widget fetch fresh data
                    return (
                        <NotificationWidget
                            key={widgetWithData.id}
                            widget={notificationWidget}
                            className="w-full h-full"
                        />
                    );

                default:
                    console.warn(`Unknown widget type: ${widgetWithData.type}`);
                    return null;
            }
        } catch (err) {
            console.error(`Error rendering widget ${widgetWithData.name}:`, err);
            return null;
        }
    }, []);

    // Memoize widget layout rendering for better performance
    const renderedWidgets = useMemo(() => {
        if (!widgets || widgets.length === 0) return [];

        const elements: React.ReactNode[] = [];
        let i = 0;

        while (i < widgets.length) {
            const widget = widgets[i];

            if (widget.layout === 'third') {
                const thirdWidgets = [];
                let j = i;
                while (j < widgets.length && widgets[j].layout === 'third' && thirdWidgets.length < 3) {
                    thirdWidgets.push(widgets[j]);
                    j++;
                }
                elements.push(
                    <div key={`third-group-${i}`} className="w-full mb-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 w-full px-4 md:px-8">
                            {thirdWidgets.map(w => (
                                <div key={w.id} className="w-full min-h-0 relative">
                                    {renderWidget(w)}
                                </div>
                            ))}
                        </div>
                    </div>
                );
                i = j;
            } else if (widget.layout === 'half') {
                const nextWidget = widgets[i + 1];
                if (nextWidget && nextWidget.layout === 'half') {
                    elements.push(
                        <div key={`half-pair-${widget.id}`} className="w-full mb-8">
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 w-full px-4 md:px-8">
                                <div className="w-full min-h-0 relative">{renderWidget(widget)}</div>
                                <div className="w-full min-h-0 relative">{renderWidget(nextWidget)}</div>
                            </div>
                        </div>
                    );
                    i += 2;
                } else {
                    elements.push(
                        <div key={widget.id} className="w-full mb-8">
                            <div className="max-w-4xl mx-auto px-4 md:px-8 relative">{renderWidget(widget)}</div>
                        </div>
                    );
                    i++;
                }
            } else {
                // Full width widgets - provide proper spacing and containment
                const needsHeight = ['notifications', 'featured-banner', 'backdrop-slideshow', 'trailer'].includes(widget.type);
                const heightClass = needsHeight ? 'min-h-[400px] md:min-h-[600px]' : '';
                const marginClass = widget.type === 'featured-banner' ? 'mb-12' : 'mb-8';

                elements.push(
                    <div key={widget.id} className={`w-full ${heightClass} ${marginClass} relative overflow-hidden`}>
                        {renderWidget(widget)}
                    </div>
                );
                i++;
            }
        }

        return elements;
    }, [widgets, renderWidget]);

    if (loading && widgets.length === 0) {
        return (
            <div className={`w-full ${className}`}>
                <div className="w-full space-y-8">
                    <div className="animate-pulse space-y-8 px-4 md:px-8">
                        <div className="h-64 bg-white/5 rounded-lg"></div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div className="h-48 bg-white/5 rounded-lg"></div>
                            <div className="h-48 bg-white/5 rounded-lg"></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        console.error('Widget loading error:', error);
        // Don't return null, show widgets if we have them from previous load
        if (widgets.length === 0) {
            return null; // Only hide if no widgets at all
        }
    }

    if (widgets.length === 0 && !loading) {
        return null; // Don't show message, just hide widgets section
    }

    return (
        <div
            className={`w-full select-none ${className}`}
            onContextMenu={(e) => e.preventDefault()}
        >
            <div className="w-full space-y-0">
                {renderedWidgets}
            </div>
            <WidgetPerformanceMonitor
                page={page}
                widgetCount={widgets.length}
                loading={loading}
                error={error ? new Error(error) : null}
            />
        </div>
    );
}
