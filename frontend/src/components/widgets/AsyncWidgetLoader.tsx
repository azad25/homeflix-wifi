"use client";

import React, { Suspense, lazy, useState, useEffect } from 'react';
import { Widget } from '@/types/widgets';
import { Media } from '@/types/media';
import { motion, AnimatePresence } from 'framer-motion';

interface AsyncWidgetLoaderProps {
  widget: Widget;
  media: Media[];
  className?: string;
}

// Widget loading skeleton component
const WidgetSkeleton = ({ widget }: { widget: Widget }) => {
  const getSkeletonHeight = () => {
    switch (widget.type) {
      case 'featured-banner':
      case 'backdrop-slideshow':
        return 'h-64 md:h-80 lg:h-96';
      case 'half-banner':
        return 'h-48 md:h-64';
      case 'trending-slideshow':
      case 'movie-grid':
        return 'h-48 md:h-56';
      default:
        return 'h-32 md:h-40';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`w-full ${getSkeletonHeight()} bg-gradient-to-r from-gray-800/50 to-gray-700/50 rounded-lg animate-pulse`}
    >
      <div className="p-4 h-full flex flex-col justify-between">
        <div className="space-y-2">
          <div className="h-4 bg-gray-600/50 rounded w-1/3"></div>
          <div className="h-3 bg-gray-600/30 rounded w-1/2"></div>
        </div>
        <div className="flex space-x-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="w-16 h-20 bg-gray-600/40 rounded"></div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

// Error fallback component
const WidgetError = ({ widget, onRetry }: { widget: Widget; onRetry: () => void }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    className="w-full p-6 bg-red-900/20 border border-red-500/30 rounded-lg"
  >
    <div className="text-center">
      <h3 className="text-red-400 font-medium mb-2">Widget Load Error</h3>
      <p className="text-red-300/70 text-sm mb-4">
        Failed to load "{widget.name}" widget
      </p>
      <button
        onClick={onRetry}
        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
      >
        Retry
      </button>
    </div>
  </motion.div>
);

// Lazy load widget components
const LazyFeaturedBanner = lazy(() => import('./FeaturedBanner'));
const LazyHalfWidthBanner = lazy(() => import('./HalfWidthBanner'));
const LazyBackdropSlideshow = lazy(() => import('./BackdropSlideshow'));
const LazyTrendingSlideshow = lazy(() => import('./TrendingSlideshow'));
const LazyComingSoonBanner = lazy(() => import('./ComingSoonBanner'));
const LazyMovieGridWidget = lazy(() => import('./MovieGridWidget'));
const LazyHomeflixGrid = lazy(() => import('./HomeflixGrid'));
const LazyGenreBasedWidget = lazy(() => import('./GenreBasedWidget'));
const LazyTrailerWidget = lazy(() => import('./TrailerWidget'));
const LazyRecentlyWatchedWidget = lazy(() => import('./RecentlyWatchedWidget'));

export default function AsyncWidgetLoader({ widget, media, className = '' }: AsyncWidgetLoaderProps) {
  const [hasError, setHasError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  // Debug logging
  console.log('AsyncWidgetLoader rendering:', {
    widgetId: widget.id,
    widgetName: widget.name,
    widgetType: widget.type,
    mediaCount: media.length,
    hasError
  });
  useEffect(() => {
    console.log('AsyncWidgetLoader rendering:', {
      widgetId: widget.id,
      widgetName: widget.name,
      widgetType: widget.type,
      mediaCount: media.length,
      hasError
    });
  }, [widget.id, widget.name, widget.type, media.length, hasError]);

  const handleRetry = () => {
    setHasError(false);
    setRetryKey(prev => prev + 1);
  };

  const renderWidget = () => {
    const config = JSON.parse(widget.config || '{}');

    try {
      switch (widget.type) {
        case 'featured-banner':
          return media.length > 0 ? (
            <LazyFeaturedBanner
              media={media}
              autoScroll={config.autoScroll}
              scrollInterval={config.scrollInterval}
              showLogo={config.showLogo}
              showDescription={config.showDescription}
              showRating={config.showRating}
            />
          ) : (
            <div className="w-full h-64 bg-gray-800/50 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <h3 className="text-white font-medium mb-2">{widget.name}</h3>
                <p className="text-gray-400 text-sm">No featured content available</p>
              </div>
            </div>
          );

        case 'half-banner':
          return media[0] ? (
            <LazyHalfWidthBanner
              media={media[0]}
              showLogo={config.showLogo}
              showDescription={config.showDescription}
            />
          ) : (
            <div className="w-full h-48 bg-gray-800/50 rounded-lg flex items-center justify-center">
              <p className="text-gray-400 text-sm">No content available for {widget.name}</p>
            </div>
          );

        case 'backdrop-slideshow':
          return (
            <LazyBackdropSlideshow
              media={media}
              autoScroll={config.autoScroll}
              scrollInterval={config.scrollInterval}
              showLogo={config.showLogo}
              showInfo={config.showDescription}
            />
          );

        case 'trending-slideshow':
          return (
            <LazyTrendingSlideshow
              media={media}
              title={config.title || widget.name}
              autoScroll={config.autoScroll}
              scrollInterval={config.scrollInterval}
              maxItems={widget.maxItems}
              className="netflix-card"
            />
          );

        case 'coming-soon':
          return media.length > 0 ? (
            <LazyComingSoonBanner
              movies={media}
              autoScroll={config.autoScroll}
              scrollInterval={config.scrollInterval}
            />
          ) : (
            <div className="w-full p-4 bg-gray-800/50 rounded-lg">
              <h3 className="text-white font-medium mb-2">{widget.name}</h3>
              <p className="text-gray-400 text-sm">No upcoming content available</p>
            </div>
          );

        case 'movie-grid':
        case 'new-releases':
        case 'recently-added':
          return (
            <LazyMovieGridWidget
              media={media}
              title={config.title || widget.name}
              subtitle={config.subtitle}
              maxItems={widget.maxItems}
              showRating={config.showRating}
              className="netflix-card"
            />
          );

        case 'homeflix-grid':
          return (
            <LazyHomeflixGrid
              media={media}
              title={config.title || widget.name}
              subtitle={config.subtitle}
              maxItems={widget.maxItems}
              showRating={config.showRating}
              showYear={config.showYear}
              autoScroll={config.autoScroll}
              scrollInterval={config.scrollInterval}
            />
          );

        case 'genre-based':
          const genre = config.genreFilter?.[0] || 'Action';
          return media.length > 0 ? (
            <LazyGenreBasedWidget
              media={media}
              genre={genre}
              title={config.title || widget.name}
              maxItems={widget.maxItems}
              className="netflix-card"
            />
          ) : (
            <div className="w-full p-4 bg-gray-800/50 rounded-lg">
              <h3 className="text-white font-medium mb-2">{widget.name}</h3>
              <p className="text-gray-400 text-sm">Genre: {genre}</p>
              <p className="text-gray-400 text-sm">No media available</p>
            </div>
          );

        case 'trailer':
          return (
            <LazyTrailerWidget
              media={media}
              title={config.title || widget.name}
              maxItems={widget.maxItems}
              autoPlay={config.autoPlay}
              showInfo={config.showDescription}
            />
          );

        case 'recently-watched':
        case 'continue-watching':
          return (
            <LazyRecentlyWatchedWidget
              title={config.title || widget.name}
              maxItems={widget.maxItems}
              layout={widget.layout === 'full' ? 'banner' : 'slideshow'}
              showProgress={config.showRating !== false}
              className={widget.layout === 'full' ? 'mb-8' : ''}
            />
          );

        case 'popular':
          return (
            <LazyTrendingSlideshow
              media={media}
              title={config.title || 'Popular Now'}
              maxItems={widget.maxItems}
            />
          );

        default:
          return (
            <div className="w-full p-4 bg-gray-800/50 rounded-lg">
              <h3 className="text-white font-medium mb-2">{widget.name}</h3>
              <p className="text-gray-400 text-sm">Widget type: {widget.type}</p>
              <p className="text-gray-400 text-sm">Data source: {widget.dataSource}</p>
              <p className="text-gray-400 text-sm">Media count: {media.length}</p>
            </div>
          );
      }
    } catch (error) {
      console.error(`Error rendering widget ${widget.name}:`, error);
      setHasError(true);
      return null;
    }
  };

  if (hasError) {
    return <WidgetError widget={widget} onRetry={handleRetry} />;
  }

  return (
    <div className={className} key={retryKey}>
      <Suspense fallback={<WidgetSkeleton widget={widget} />}>
        <AnimatePresence mode="wait">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            {renderWidget()}
          </motion.div>
        </AnimatePresence>
      </Suspense>
    </div>
  );
}