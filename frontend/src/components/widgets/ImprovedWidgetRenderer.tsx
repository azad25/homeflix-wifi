"use client";

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Media } from '@/types/media';
import { useAsyncWidgets } from '@/hooks/useAsyncWidgets';
import AsyncWidgetLoader from './AsyncWidgetLoader';
import ErrorBoundary from '@/components/ErrorBoundary';
import { cacheUtils } from '@/lib/swr-api';

interface ImprovedWidgetRendererProps {
  page: string;
  media?: Media[];
  upcomingMovies?: any[];
  className?: string;
  enableCaching?: boolean;
}

export default function ImprovedWidgetRenderer({
  page,
  media = [],
  upcomingMovies = [],
  className = '',
  enableCaching = true
}: ImprovedWidgetRendererProps) {
  const {
    widgets,
    widgetsLoading,
    widgetsError,
    widgetData,
    widgetLoading,
    widgetErrors,
    widgetLoaded
  } = useAsyncWidgets({
    page,
    media,
    upcomingMovies,
    enableCaching
  });

  // Debug logging
  useEffect(() => {
    console.log('ImprovedWidgetRenderer state:', {
      page,
      widgetsCount: widgets.length,
      widgetsLoading,
      widgetsError,
      mediaCount: media.length,
      widgetDataSize: widgetData.size,
      widgets: widgets.map(w => ({ 
        id: w.id, 
        name: w.name, 
        type: w.type, 
        dataSource: w.dataSource,
        enabled: w.enabled,
        hasData: widgetData.has(w.id),
        dataCount: widgetData.get(w.id)?.length || 0
      }))
    });

    // If SWR is failing, log additional debug info
    if (widgetsError) {
      console.error('ImprovedWidgetRenderer SWR error details:', {
        error: widgetsError,
        page,
        apiUrl: 'http://localhost:8252',
        fullUrl: `http://localhost:8252/api/widgets/page/${page}`
      });
    }
  }, [page, widgets.length, widgetsLoading, widgetsError, media.length, widgetData.size, widgets, widgetData]);

  // Get standardized widget height based on type and layout
  const getWidgetHeight = (widget: any) => {
    // Full-height widgets (hero/banner types)
    if (widget.type === 'featured-banner' || 
        widget.type === 'backdrop-slideshow' || 
        widget.type === 'notifications') {
      return 'h-[500px] md:h-[600px] lg:h-[700px]';
    }
    
    // Medium height widgets (half/third layouts)
    if (widget.layout === 'half' || widget.layout === 'third') {
      return 'h-[350px] md:h-[400px]';
    }
    
    // Standard height for grid/slideshow widgets
    return 'h-[280px] md:h-[320px]';
  };

  // Group widgets by layout for responsive rendering with consistent heights
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

        elements.push(
          <motion.div
            key={`third-group-${i}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            className="w-full px-4 md:px-8 lg:px-12"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 w-full">
              {thirdWidgets.map(w => (
                <div key={w.id} className={`w-full ${getWidgetHeight(w)} rounded-xl overflow-hidden`}>
                  <ErrorBoundary>
                    <AsyncWidgetLoader
                      widget={w}
                      media={widgetData.get(w.id) || []}
                      className="h-full w-full"
                    />
                  </ErrorBoundary>
                </div>
              ))}
            </div>
          </motion.div>
        );
        i = j;
      } else if (widget.layout === 'half') {
        // Check if next widget is also half
        const nextWidget = widgets[i + 1];
        if (nextWidget && nextWidget.layout === 'half') {
          elements.push(
            <motion.div
              key={`half-pair-${widget.id}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="w-full px-4 md:px-8 lg:px-12"
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 w-full">
                <div className={`w-full ${getWidgetHeight(widget)} rounded-xl overflow-hidden`}>
                  <ErrorBoundary>
                    <AsyncWidgetLoader
                      widget={widget}
                      media={widgetData.get(widget.id) || []}
                      className="h-full w-full"
                    />
                  </ErrorBoundary>
                </div>
                <div className={`w-full ${getWidgetHeight(nextWidget)} rounded-xl overflow-hidden`}>
                  <ErrorBoundary>
                    <AsyncWidgetLoader
                      widget={nextWidget}
                      media={widgetData.get(nextWidget.id) || []}
                      className="h-full w-full"
                    />
                  </ErrorBoundary>
                </div>
              </div>
            </motion.div>
          );
          i += 2;
        } else {
          elements.push(
            <motion.div
              key={widget.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="w-full px-4 md:px-8 lg:px-12"
            >
              <div className="w-full max-w-4xl mx-auto">
                <div className={`w-full ${getWidgetHeight(widget)} rounded-xl overflow-hidden`}>
                  <ErrorBoundary>
                    <AsyncWidgetLoader
                      widget={widget}
                      media={widgetData.get(widget.id) || []}
                      className="h-full w-full"
                    />
                  </ErrorBoundary>
                </div>
              </div>
            </motion.div>
          );
          i++;
        }
      } else {
        // Full width widget
        elements.push(
          <motion.div
            key={widget.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            className="w-full px-4 md:px-8 lg:px-12"
          >
            <div className={`w-full ${getWidgetHeight(widget)} rounded-xl overflow-hidden`}>
              <ErrorBoundary>
                <AsyncWidgetLoader
                  widget={widget}
                  media={widgetData.get(widget.id) || []}
                  className="h-full w-full"
                />
              </ErrorBoundary>
            </div>
          </motion.div>
        );
        i++;
      }
    }

    return elements;
  };

  // Loading state with skeleton placeholders
  if (widgetsLoading) {
    return (
      <div className={`w-full px-4 md:px-8 ${className}`}>
        <div className="w-full max-w-7xl mx-auto space-y-8">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="animate-pulse space-y-8"
          >
            {/* Featured widget skeleton */}
            <div className="h-64 md:h-80 lg:h-96 bg-gradient-to-r from-gray-800/50 to-gray-700/50 rounded-lg">
              <div className="p-6 h-full flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="h-6 bg-gray-600/50 rounded w-1/3"></div>
                  <div className="h-4 bg-gray-600/30 rounded w-1/2"></div>
                </div>
                <div className="flex space-x-4">
                  <div className="bg-gray-600/40 rounded-lg px-6 py-3 w-24"></div>
                  <div className="bg-gray-600/30 rounded-lg px-6 py-3 w-20"></div>
                </div>
              </div>
            </div>

            {/* Grid widgets skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-48 md:h-64 bg-gradient-to-r from-gray-800/50 to-gray-700/50 rounded-lg"></div>
              <div className="h-48 md:h-64 bg-gradient-to-r from-gray-800/50 to-gray-700/50 rounded-lg"></div>
            </div>

            {/* Slideshow widgets skeleton */}
            <div className="space-y-6">
              <div className="h-8 bg-gray-600/50 rounded w-48"></div>
              <div className="flex space-x-4 overflow-hidden">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="w-32 h-48 bg-gray-600/40 rounded flex-shrink-0"></div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Error state
  if (widgetsError) {
    return (
      <div className={`w-full px-4 md:px-8 ${className}`}>
        <div className="w-full max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-12 bg-red-900/20 border border-red-500/30 rounded-lg"
          >
            <h3 className="text-red-400 font-medium mb-2">Widget System Error</h3>
            <p className="text-red-300/70 text-sm mb-4">
              Unable to load widgets for this page
            </p>
            <button
              onClick={() => {
                console.log('Refreshing widgets cache...');
                cacheUtils.refreshWidgets();
              }}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm transition-colors mb-2"
            >
              Refresh Widgets
            </button>
            <p className="text-gray-500 text-xs">
              The page will continue to work normally
            </p>
          </motion.div>
        </div>
      </div>
    );
  }

  // Empty state
  if (widgets.length === 0) {
    // If not loading and no error, but still no widgets, show debug info
    if (!widgetsLoading && !widgetsError) {
      return (
        <div className={`w-full px-4 md:px-8 ${className}`}>
          <div className="w-full max-w-7xl mx-auto">
            <div className="text-center py-8 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
              <h3 className="text-yellow-400 font-medium mb-2">No Widgets Found</h3>
              <p className="text-yellow-300/70 text-sm mb-2">
                Page: {page}
              </p>
              <p className="text-yellow-300/70 text-sm mb-4">
                No widgets are configured for this page
              </p>
              <button
                onClick={() => {
                  console.log('Refreshing widgets cache for page:', page);
                  cacheUtils.refreshWidgets();
                }}
                className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
              >
                Refresh Widgets
              </button>
            </div>
          </div>
        </div>
      );
    }
    // Don't show anything if loading or there's an error (handled above)
    return null;
  }

  // Render widgets
  return (
    <div className={`w-full ${className}`}>
      <div className="w-full space-y-8 md:space-y-12">
        <AnimatePresence mode="wait">
          {renderWidgets()}
        </AnimatePresence>
      </div>
    </div>
  );
}