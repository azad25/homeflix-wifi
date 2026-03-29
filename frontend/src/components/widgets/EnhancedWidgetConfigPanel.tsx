"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, BarChart3 } from 'lucide-react';
import { Widget } from '@/types/widgets';
import { getApiUrl } from '@/lib/api';
import WidgetList from './config/WidgetList';
import WidgetEditor from './config/WidgetEditor';
import ContentSelector from './config/ContentSelector';
import { widgetCache } from '@/utils/widgetCache';
import WidgetPerformanceDashboard from './WidgetPerformanceDashboard';

interface EnhancedWidgetConfigPanelProps {
  page: string;
  isOpen: boolean;
  onClose: () => void;
  onWidgetsChange?: () => void;
}

export default function EnhancedWidgetConfigPanel({
  page,
  isOpen,
  onClose,
  onWidgetsChange
}: EnhancedWidgetConfigPanelProps) {
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingWidget, setEditingWidget] = useState<Widget | null>(null);
  const [showContentSelector, setShowContentSelector] = useState(false);
  const [showPerformance, setShowPerformance] = useState(false);
  const [selectedContent, setSelectedContent] = useState<any[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [genres, setGenres] = useState<{ id: number; name: string }[]>([]);

  const apiUrl = getApiUrl();

  useEffect(() => {
    if (isOpen) {
      fetchWidgets();
      fetchGenres();
    }
  }, [isOpen, page]);

  useEffect(() => {
    if (!editingWidget) {
      setSelectedContent([]);
      setSelectedGenres([]);
      setSelectedLanguages([]);
      setSelectedCountries([]);
      return;
    }

    try {
      const parsedConfig = editingWidget.config ? JSON.parse(editingWidget.config) : {};

      if (Array.isArray(parsedConfig.selectedContent)) {
        setSelectedContent(parsedConfig.selectedContent);
      } else {
        setSelectedContent([]);
      }

      if (Array.isArray(parsedConfig.selectedGenres)) {
        setSelectedGenres(parsedConfig.selectedGenres.filter((id: unknown) => typeof id === 'number'));
      } else {
        setSelectedGenres([]);
      }

      if (Array.isArray(parsedConfig.selectedLanguages)) {
        setSelectedLanguages(parsedConfig.selectedLanguages.filter((language: unknown) => typeof language === 'string'));
      } else if (Array.isArray(parsedConfig.languageFilter)) {
        setSelectedLanguages(parsedConfig.languageFilter.filter((language: unknown) => typeof language === 'string'));
      } else {
        setSelectedLanguages([]);
      }

      if (Array.isArray(parsedConfig.selectedCountries)) {
        setSelectedCountries(parsedConfig.selectedCountries.filter((country: unknown) => typeof country === 'string'));
      } else if (Array.isArray(parsedConfig.countryFilter)) {
        setSelectedCountries(parsedConfig.countryFilter.filter((country: unknown) => typeof country === 'string'));
      } else {
        setSelectedCountries([]);
      }
    } catch (err) {
      console.error('Error parsing widget config for selected content:', err);
      setSelectedContent([]);
      setSelectedGenres([]);
      setSelectedLanguages([]);
      setSelectedCountries([]);
    }
  }, [editingWidget]);

  const fetchGenres = async () => {
    try {
      const [movieGenres, tvGenres] = await Promise.all([
        fetch(`${apiUrl}/api/tmdb/genres/movie`).then(r => r.ok ? r.json() : { genres: [] }),
        fetch(`${apiUrl}/api/tmdb/genres/tv`).then(r => r.ok ? r.json() : { genres: [] })
      ]);

      const allGenres = [...movieGenres.genres, ...tvGenres.genres];
      const uniqueGenres = allGenres.filter((genre, index, self) =>
        index === self.findIndex(g => g.id === genre.id)
      );

      setGenres(uniqueGenres);
    } catch (error) {
      console.error('Error fetching genres:', error);
    }
  };

  const fetchWidgets = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${apiUrl}/api/widgets/page/${page}`);
      if (response.ok) {
        const data = await response.json();
        setWidgets(Array.isArray(data) ? data : []);
      } else {
        throw new Error('Failed to fetch widgets');
      }
    } catch (error) {
      console.error('Error fetching widgets:', error);
      setError('Failed to load widgets');
    } finally {
      setLoading(false);
    }
  };

  // Add this function to fetch widget-specific data:
  const fetchWidgetData = async (widgetId: number) => {
    try {
      const response = await fetch(`${apiUrl}/api/widgets/${widgetId}/data`);
      if (response.ok) {
        const data = await response.json();
        return data.data; // Returns the actual media items based on config
      }
    } catch (error) {
      console.error('Error fetching widget data:', error);
    }
    return [];
  };

  const saveWidget = async (widget: Partial<Widget>) => {
    try {
      const method = widget.id ? 'PUT' : 'POST';
      const url = widget.id ? `${apiUrl}/api/widgets/${widget.id}` : `${apiUrl}/api/widgets`;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(widget)
      });

      if (response.ok) {
        await fetchWidgets();
        widgetCache.invalidate(page); // Invalidate cache on save
        setEditingWidget(null);
        onWidgetsChange?.();
      } else {
        throw new Error('Failed to save widget');
      }
    } catch (error) {
      console.error('Error saving widget:', error);
      setError('Failed to save widget');
    }
  };

  const deleteWidget = async (widgetId: number) => {
    if (!confirm('Are you sure you want to delete this widget?')) return;

    try {
      const response = await fetch(`${apiUrl}/api/widgets/${widgetId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await fetchWidgets();
        widgetCache.invalidate(page); // Invalidate cache on delete
        onWidgetsChange?.();
      } else {
        throw new Error('Failed to delete widget');
      }
    } catch (error) {
      console.error('Error deleting widget:', error);
      setError('Failed to delete widget');
    }
  };

  const reorderWidgets = async (reorderedWidgets: Widget[]) => {
    try {
      const updates = reorderedWidgets.map((widget, index) => ({
        id: widget.id,
        position: index + 1
      }));

      const response = await fetch(`${apiUrl}/api/widgets/reorder`, {
        method: 'POST', // Changed from PUT to POST to match backend route
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widgets: updates })
      });

      if (response.ok) {
        setWidgets(reorderedWidgets);
        widgetCache.invalidate(page); // Invalidate cache on reorder
        onWidgetsChange?.();
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to reorder widgets');
      }
    } catch (error) {
      console.error('Error reordering widgets:', error);
      setError(`Failed to reorder widgets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const createNewWidget = async () => {
    // Convert selectedGenres (IDs) to genre names for backend compatibility
    let genreNames: string[] = [];
    if (selectedGenres.length > 0) {
      try {
        // Fetch TMDB genres to get names from IDs
        const [movieGenres, tvGenres] = await Promise.all([
          fetch(`${apiUrl}/api/tmdb/genres/movie`).then(r => r.ok ? r.json() : { genres: [] }),
          fetch(`${apiUrl}/api/tmdb/genres/tv`).then(r => r.ok ? r.json() : { genres: [] })
        ]);

        const allGenres = [...movieGenres.genres, ...tvGenres.genres];
        const uniqueGenres = allGenres.filter((genre, index, self) =>
          index === self.findIndex(g => g.id === genre.id)
        );

        genreNames = selectedGenres
          .map(id => uniqueGenres.find(g => g.id === id)?.name)
          .filter(name => name) as string[];
      } catch (error) {
        console.error('Error converting genre IDs to names:', error);
      }
    }

    // Default notification types for notification widgets - COMPLETE BACKEND MATCH
    const defaultNotificationTypes = [
      'new_movies',
      'new_episodes',
      'recently_added',
      'movie_suggestion',
      'single_movie_suggestion',
      'watch_again',
      'continue_watching',
      'genre_based',
      'local_trending',
      'tmdb_upcoming',
      'tmdb_now_playing',
      'tmdb_trending',
      'tmdb_upcoming_tv',
      'tmdb_now_airing_tv',
      'tmdb_coming_soon',
      'download_complete'
    ];

    const newWidget: Partial<Widget> = {
      name: 'New Widget',
      type: 'homeflix-grid',
      page: page as any,
      position: widgets.length + 1,
      enabled: true,
      config: JSON.stringify({
        selectedContent,
        selectedGenres,
        selectedLanguages,
        selectedCountries,
        genreFilter: genreNames, // Add genreFilter for backend compatibility
        languageFilter: selectedLanguages,
        countryFilter: selectedCountries,
        notificationTypes: defaultNotificationTypes, // Add all notification types by default
        show_logo: true,
        show_description: true,
        show_timestamp: true,
        show_notification_icon: true,
        highlight_style: 'banner',
        auto_scroll: true,
        scroll_interval: 10
      }),
      contentType: 'mixed',
      dataSource: genreNames.length > 0 ? 'local' : 'tmdb', // Use local data source for genre filtering
      maxItems: 10,
      layout: 'full',
      colorScheme: 'auto'
    };
    setEditingWidget(newWidget as Widget);
  };

  const handleGenreToggle = (genreId: number) => {
    setSelectedGenres(prev =>
      prev.includes(genreId)
        ? prev.filter(id => id !== genreId)
        : [...prev, genreId]
    );
  };

  const handleContentToggle = (content: any) => {
    setSelectedContent(prev => {
      const exists = prev.find(item => item.id === content.id);
      if (exists) {
        return prev.filter(item => item.id !== content.id);
      } else {
        return [...prev, content];
      }
    });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative w-full max-w-7xl max-h-[95vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Glassmorphism Container */}
          <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-red-500/20 to-red-600/20 backdrop-blur-sm border border-white/10 rounded-xl flex items-center justify-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  >
                    <div className="w-6 h-6 bg-gradient-to-br from-red-400 to-red-500 rounded-lg" />
                  </motion.div>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    Widget Configuration
                  </h2>
                  <p className="text-white/60 text-sm">
                    {page.charAt(0).toUpperCase() + page.slice(1)} Page
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowPerformance(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 backdrop-blur-sm border border-red-400/20 text-red-200 rounded-xl transition-all duration-200 hover:scale-105"
                >
                  <BarChart3 className="w-4 h-4" />
                  Performance
                </button>
                <button
                  onClick={createNewWidget}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 backdrop-blur-sm border border-red-500/20 text-red-200 rounded-xl transition-all duration-200 hover:scale-105"
                >
                  <Plus className="w-4 h-4" />
                  Add Widget
                </button>
                <button
                  onClick={onClose}
                  className="p-2 text-white/60 hover:text-white hover:bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl transition-all duration-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(95vh-120px)]">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 p-4 bg-red-500/20 backdrop-blur-sm border border-red-400/30 rounded-xl"
                >
                  <p className="text-red-200">{error}</p>
                </motion.div>
              )}

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="relative">
                    <div className="w-12 h-12 border-4 border-white/20 border-t-red-400 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 w-12 h-12 border-4 border-transparent border-r-red-500 rounded-full animate-spin animate-reverse"></div>
                  </div>
                </div>
              ) : (
                <WidgetList
                  widgets={widgets}
                  onEdit={setEditingWidget}
                  onDelete={deleteWidget}
                  onReorder={reorderWidgets}
                  onToggle={async (widget, enabled) => {
                    await saveWidget({ ...widget, enabled });
                  }}
                  onDuplicate={async (widget) => {
                    const duplicate = {
                      ...widget,
                      id: undefined,
                      name: `${widget.name} (Copy)`,
                      position: widgets.length + 1
                    };
                    await saveWidget(duplicate);
                  }}
                />
              )}
            </div>
          </div>
        </motion.div>

        {/* Widget Editor Modal */}
        {editingWidget && (
          <WidgetEditor
            widget={editingWidget}
            onSave={saveWidget}
            onCancel={() => setEditingWidget(null)}
            onOpenContentSelector={() => setShowContentSelector(true)}
            selectedContent={selectedContent}
            selectedGenres={selectedGenres}
            selectedLanguages={selectedLanguages}
            selectedCountries={selectedCountries}
            genres={genres}
            onGenreToggle={handleGenreToggle}
            onContentToggle={handleContentToggle}
          />
        )}

        {/* Content Selector Modal */}
        <ContentSelector
          isOpen={showContentSelector}
          onClose={() => setShowContentSelector(false)}
          selectedContent={selectedContent}
          onContentChange={setSelectedContent}
          selectedGenres={selectedGenres}
          onGenresChange={setSelectedGenres}
          selectedLanguages={selectedLanguages}
          onLanguagesChange={setSelectedLanguages}
          selectedCountries={selectedCountries}
          onCountriesChange={setSelectedCountries}
        />

        {/* Performance Dashboard */}
        <WidgetPerformanceDashboard
          isOpen={showPerformance}
          onClose={() => setShowPerformance(false)}
        />
      </motion.div>
    </AnimatePresence>
  );
}
