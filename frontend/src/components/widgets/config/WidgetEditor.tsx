"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Save, X, Search, Palette, Settings, Layers, Star, Flame, Zap, Crown, Heart, Sparkles, Award, TrendingUp, Clock, Calendar, Play, Eye, ThumbsUp, Gift, Rocket, Target, Shield, Diamond } from 'lucide-react';
import { Widget, WidgetType, LayoutType, DataSourceType, ContentType, ColorScheme } from '@/types/widgets';
import { getApiUrl } from '@/lib/api';

interface WidgetEditorProps {
  widget: Widget;
  onSave: (widget: Partial<Widget>) => void;
  onCancel: () => void;
  onOpenContentSelector: () => void;
  selectedContent: any[];
  selectedGenres: number[];
  selectedLanguages: string[];
  selectedCountries: string[];
  genres: Genre[];
  onGenreToggle: (genreId: number) => void;
  onContentToggle: (content: any) => void;
}

interface Genre {
  id: number;
  name: string;
}

const widgetTypes: { value: WidgetType; label: string; description: string; icon: string }[] = [
  { value: 'featured-banner', label: 'Featured Banner', description: 'Large hero banner with featured content', icon: '🎬' },
  { value: 'half-banner', label: 'Half Banner', description: 'Half-width banner for secondary content', icon: '📱' },
  { value: 'backdrop-slideshow', label: 'Backdrop Slideshow', description: 'Full-width slideshow with backdrop images', icon: '🖼️' },
  { value: 'trending-slideshow', label: 'Trending Slideshow', description: 'Horizontal scrolling content row', icon: '🔥' },
  { value: 'movie-grid', label: 'Movie Grid', description: 'Grid layout for multiple items', icon: '📱' },
  { value: 'homeflix-grid', label: 'Homeflix Grid', description: 'Netflix-style grid with backdrop and logo', icon: '🎯' },
  { value: 'genre-based', label: 'Genre Based', description: 'Content filtered by specific genre', icon: '🎭' },
  { value: 'coming-soon', label: 'Coming Soon', description: 'Upcoming releases banner', icon: '⏰' },
  { value: 'new-releases', label: 'New Releases', description: 'Recently added content', icon: '🆕' },
  { value: 'popular', label: 'Popular', description: 'Most popular content', icon: '⭐' },
  { value: 'recently-added', label: 'Recently Added', description: 'Latest additions', icon: '📅' },
  { value: 'recently-watched', label: 'Recently Watched', description: 'User\'s viewing history', icon: '👁️' },
  { value: 'continue-watching', label: 'Continue Watching', description: 'Resume watching progress', icon: '▶️' },
  { value: 'preview-video', label: 'Preview Video Hero', description: 'Autoplay hero using local preview clips', icon: '🎞️' },
  { value: 'media-trailer', label: 'Media Trailer Hero', description: 'Hero highlighting official trailers', icon: '📽️' },
  { value: 'mixed-video', label: 'Mixed Video Hero', description: 'Hybrid hero that mixes previews and trailers', icon: '🎛️' },
  { value: 'trailer', label: 'Trailer Widget', description: 'Video trailers and previews', icon: '🎥' },
  { value: 'notifications', label: 'Notifications', description: 'Display system notifications and alerts', icon: '🔔' }
];

const layouts: { value: LayoutType; label: string; description: string; icon: string }[] = [
  { value: 'full', label: 'Full Width', description: 'Takes full container width', icon: '━━━' },
  { value: 'half', label: 'Half Width', description: 'Takes half container width', icon: '━━' },
  { value: 'third', label: 'Third Width', description: 'Takes one-third container width', icon: '━' }
];



const contentTypes: { value: ContentType; label: string; icon: string }[] = [
  { value: 'mixed', label: 'Mixed Content', icon: '🎭' },
  { value: 'movies', label: 'Movies Only', icon: '🎬' },
  { value: 'tv-shows', label: 'TV Shows Only', icon: '📺' }
];

const colorSchemes: { value: ColorScheme; label: string; preview: string }[] = [
  { value: 'auto', label: 'Auto', preview: 'bg-gradient-to-r from-blue-500/20 to-purple-500/20' },
  { value: 'dark', label: 'Dark', preview: 'bg-gradient-to-r from-gray-800/50 to-gray-900/50' },
  { value: 'light', label: 'Light', preview: 'bg-gradient-to-r from-gray-100/20 to-gray-200/20' },
  { value: 'custom', label: 'Custom', preview: 'bg-gradient-to-r from-red-500/20 to-blue-500/20' }
];

export default function WidgetEditor({
  widget,
  onSave,
  onCancel,
  onOpenContentSelector,
  selectedContent,
  selectedGenres,
  selectedLanguages,
  selectedCountries,
  genres,
  onGenreToggle,
  onContentToggle
}: WidgetEditorProps) {
  const [formData, setFormData] = useState(widget);
  const [config, setConfig] = useState(() => {
    try {
      return JSON.parse(widget.config || '{}');
    } catch {
      return {};
    }
  });
  const [dataSources, setDataSources] = useState<{ value: DataSourceType; label: string; description: string; color: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const apiUrl = getApiUrl();

  // Fetch data sources from API
  useEffect(() => {
    const fetchDataSources = async () => {
      console.log('🔧 Fetching data sources from API:', `${apiUrl}/api/widgets/data-sources`);
      try {
        const response = await fetch(`${apiUrl}/api/widgets/data-sources`);
        console.log('🔧 API response status:', response.status);
        if (response.ok) {
          const sources = await response.json();
          console.log('🔧 Received data sources:', sources);
          const formattedSources = sources.map((source: any) => ({
            value: source.source as DataSourceType,
            label: source.name,
            description: source.description,
            color: getColorForDataSource(source.source)
          }));
          console.log('🔧 Formatted data sources:', formattedSources);
          setDataSources(formattedSources);
        }
      } catch (error) {
        console.error('❌ Error fetching data sources:', error);
        // Fallback to hardcoded sources if API fails
        setDataSources([
          { value: 'local', label: 'Local Media', description: 'Use local media library', color: 'from-green-500/20 to-green-600/20 border-green-400/30' },
          { value: 'tmdb', label: 'TMDB API', description: 'The Movie Database API', color: 'from-blue-500/20 to-blue-600/20 border-blue-400/30' }
        ]);
      } finally {
        setLoading(false);
      }
    };

    // Lock scroll when modal opens
    document.body.style.overflow = 'hidden';
    
    fetchDataSources();

    // Unlock scroll when modal closes
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [apiUrl]);

  // Helper function to assign colors to data sources
  const getColorForDataSource = (source: string): string => {
    const colorMap: { [key: string]: string } = {
      'local': 'from-green-500/20 to-green-600/20 border-green-400/30',
      'tmdb': 'from-blue-500/20 to-blue-600/20 border-blue-400/30',
      'trending': 'from-orange-500/20 to-orange-600/20 border-orange-400/30',
      'popular': 'from-purple-500/20 to-purple-600/20 border-purple-400/30',
      'recent': 'from-cyan-500/20 to-cyan-600/20 border-cyan-400/30',
      'recently-played': 'from-yellow-500/20 to-yellow-600/20 border-yellow-400/30',
      'now-playing': 'from-red-500/20 to-red-600/20 border-red-400/30',
      'upcoming': 'from-indigo-500/20 to-indigo-600/20 border-indigo-400/30',
      'top-rated': 'from-pink-500/20 to-pink-600/20 border-pink-400/30'
    };
    return colorMap[source] || 'from-gray-500/20 to-gray-600/20 border-gray-400/30';
  };

  useEffect(() => {
    setFormData(widget);
    try {
      setConfig(JSON.parse(widget.config || '{}'));
    } catch {
      setConfig({});
    }
  }, [widget]);

  const handleSave = () => {
    const updatedConfig: any = {
      ...config,
      selectedContent,
      selectedGenres,
      selectedLanguages,
      selectedCountries,
      languageFilter: selectedLanguages,
      countryFilter: selectedCountries
    };

    // Add genreFilter for backend compatibility
    if (selectedGenres.length > 0) {
      const genreMap: { [key: number]: string } = {
        28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy",
        80: "Crime", 99: "Documentary", 18: "Drama", 10751: "Family",
        14: "Fantasy", 36: "History", 27: "Horror", 10402: "Music",
        9648: "Mystery", 10749: "Romance", 878: "Science Fiction",
        10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western",
        // TV genres
        10759: "Action & Adventure", 10762: "Kids", 10763: "News",
        10764: "Reality", 10765: "Sci-Fi & Fantasy", 10766: "Soap",
        10767: "Talk", 10768: "War & Politics"
      };

      const genreNames = selectedGenres.map(id => genreMap[id] || '').filter(name => name);
      updatedConfig.genreFilter = genreNames;
    }

    onSave({
      ...formData,
      config: JSON.stringify(updatedConfig)
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-md z-50"
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 z-50 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glassmorphism Container */}
        <div className="bg-black/40 backdrop-blur-xl border border-white/10 h-full w-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10 flex-shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-red-500/20 to-red-600/20 backdrop-blur-sm border border-white/10 rounded-xl flex items-center justify-center">
                <Settings className="w-6 h-6 text-red-200" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">
                  {widget.id ? 'Edit Widget' : 'Create Widget'}
                </h3>
                <p className="text-white/60 text-sm">
                  Configure widget settings and content
                </p>
              </div>
            </div>
            <button
              onClick={onCancel}
              className="p-2 text-white/60 hover:text-white hover:bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl transition-all duration-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto flex-1 space-y-8">
            {/* Basic Settings */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-red-500/20 to-red-600/20 backdrop-blur-sm border border-red-400/30 rounded-lg flex items-center justify-center">
                  <Settings className="w-4 h-4 text-red-200" />
                </div>
                <h4 className="text-lg font-semibold text-white">Basic Settings</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-3">Widget Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:border-blue-400/50 focus:outline-none transition-colors"
                    placeholder="Enter widget name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-3">Max Items</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={formData.maxItems}
                    onChange={(e) => setFormData({ ...formData, maxItems: parseInt(e.target.value) })}
                    className="w-full bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:border-blue-400/50 focus:outline-none transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Widget Type */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-red-600/20 to-red-700/20 backdrop-blur-sm border border-red-500/30 rounded-lg flex items-center justify-center">
                  <Layers className="w-4 h-4 text-red-200" />
                </div>
                <h4 className="text-lg font-semibold text-white">Widget Type</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {widgetTypes.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setFormData({ ...formData, type: type.value })}
                    className={`p-4 rounded-xl border transition-all duration-200 text-left hover:scale-105 ${formData.type === type.value
                        ? 'bg-red-500/20 border-red-400/50 shadow-lg shadow-red-500/10'
                        : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                      }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{type.icon}</span>
                      <span className="font-medium text-white">{type.label}</span>
                    </div>
                    <p className="text-xs text-white/60">{type.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Layout */}
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-white">Layout</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {layouts.map((layout) => (
                  <button
                    key={layout.value}
                    onClick={() => setFormData({ ...formData, layout: layout.value })}
                    className={`p-4 rounded-xl border transition-all duration-200 text-left hover:scale-105 ${formData.layout === layout.value
                        ? 'bg-red-500/20 border-red-400/50 shadow-lg shadow-red-500/10'
                        : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                      }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-mono text-white/80">{layout.icon}</span>
                      <span className="font-medium text-white">{layout.label}</span>
                    </div>
                    <p className="text-xs text-white/60">{layout.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Data Source */}
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-white">Data Source</h4>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-white/20 border-t-red-400 rounded-full animate-spin"></div>
                  <span className="ml-2 text-white/60">Loading data sources...</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {dataSources.map((source) => (
                    <button
                      key={source.value}
                      onClick={() => setFormData({ ...formData, dataSource: source.value })}
                      className={`p-4 rounded-xl border transition-all duration-200 text-left hover:scale-105 ${formData.dataSource === source.value
                          ? `bg-gradient-to-br ${source.color} shadow-lg`
                          : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                        }`}
                    >
                      <div className="font-medium text-white mb-1">{source.label}</div>
                      <p className="text-xs text-white/60">{source.description}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Content Type */}
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-white">Content Type</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {contentTypes.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setFormData({ ...formData, contentType: type.value })}
                    className={`p-4 rounded-xl border transition-all duration-200 text-left hover:scale-105 ${formData.contentType === type.value
                        ? 'bg-red-500/20 border-red-400/50 shadow-lg shadow-red-500/10'
                        : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{type.icon}</span>
                      <span className="font-medium text-white">{type.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Content Selection */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-red-700/20 to-red-800/20 backdrop-blur-sm border border-red-600/30 rounded-lg flex items-center justify-center">
                  <Search className="w-4 h-4 text-red-200" />
                </div>
                <h4 className="text-lg font-semibold text-white">Content & Genres</h4>
              </div>

              {/* Genre Selection */}
              {(formData.type === 'genre-based' || formData.dataSource === 'local' || formData.dataSource === 'tmdb') && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-3">Select Genres</label>
                    <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl">
                      {genres.map((genre) => (
                        <button
                          key={genre.id}
                          onClick={() => onGenreToggle(genre.id)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${selectedGenres.includes(genre.id)
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                        >
                          {genre.name}
                        </button>
                      ))}
                    </div>
                    {selectedGenres.length > 0 && (
                      <div className="mt-2 text-sm text-white/60">
                        Selected: {selectedGenres.map(id => genres.find(g => g.id === id)?.name).filter(Boolean).join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <button
                onClick={onOpenContentSelector}
                className="w-full p-4 bg-gradient-to-r from-red-500/20 to-red-600/20 hover:from-red-500/30 hover:to-red-600/30 backdrop-blur-sm border border-red-400/30 rounded-xl transition-all duration-200 hover:scale-105"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Search className="w-5 h-5 text-red-200" />
                    <div className="text-left">
                      <div className="font-medium text-white">Advanced Content Selection</div>
                      <div className="text-sm text-white/60">
                        {selectedContent.length > 0 || selectedGenres.length > 0 || selectedLanguages.length > 0 || selectedCountries.length > 0
                          ? `${selectedContent.length} items, ${selectedGenres.length} genres, ${selectedLanguages.length} languages, ${selectedCountries.length} countries selected`
                          : 'Search and select specific content'
                        }
                      </div>
                    </div>
                  </div>
                  <div className="text-red-200">→</div>
                </div>
              </button>
            </div>

            {/* Widget Options */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-red-800/20 to-red-900/20 backdrop-blur-sm border border-red-700/30 rounded-lg flex items-center justify-center">
                  <Palette className="w-4 h-4 text-red-200" />
                </div>
                <h4 className="text-lg font-semibold text-white">Widget Options</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-3">Custom Title (Optional)</label>
                  <input
                    type="text"
                    value={config.title || ''}
                    onChange={(e) => setConfig({ ...config, title: e.target.value })}
                    className="w-full bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:border-blue-400/50 focus:outline-none transition-colors"
                    placeholder="Custom widget title"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-3">Scroll Interval (seconds)</label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={config.scrollInterval || 5}
                    onChange={(e) => setConfig({ ...config, scrollInterval: parseInt(e.target.value) })}
                    className="w-full bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:border-blue-400/50 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Tag and Heading Options */}
              <div className="space-y-6 mt-8 p-6 bg-gradient-to-br from-purple-500/10 to-purple-600/10 backdrop-blur-sm border border-purple-400/20 rounded-xl">
                <h5 className="text-lg font-semibold text-white flex items-center gap-2">
                  🏷️ Tags & Headings
                </h5>

                {/* Tag Options */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.showTag || false}
                        onChange={(e) => setConfig({ ...config, showTag: e.target.checked })}
                        className="w-4 h-4 text-purple-500 bg-white/10 border-white/20 rounded focus:ring-purple-500 focus:ring-2"
                      />
                      <span className="text-sm text-white/80 font-medium">Show Tag</span>
                    </label>
                  </div>

                  {config.showTag && (
                    <div className="grid grid-cols-1 gap-4 ml-7">
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">Tag Text</label>
                        <input
                          type="text"
                          value={config.tagText || ''}
                          onChange={(e) => setConfig({ ...config, tagText: e.target.value })}
                          className="w-full bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/40 focus:border-purple-400/50 focus:outline-none transition-colors"
                          placeholder="e.g., NEW, TRENDING, FEATURED"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">Tag Icon</label>
                        <div className="grid grid-cols-6 gap-2">
                          {[
                            { icon: Star, name: 'Star' },
                            { icon: Flame, name: 'Fire' },
                            { icon: Zap, name: 'Lightning' },
                            { icon: Crown, name: 'Crown' },
                            { icon: Heart, name: 'Heart' },
                            { icon: Sparkles, name: 'Sparkles' },
                            { icon: Award, name: 'Award' },
                            { icon: TrendingUp, name: 'Trending' },
                            { icon: Clock, name: 'Clock' },
                            { icon: Calendar, name: 'Calendar' },
                            { icon: Play, name: 'Play' },
                            { icon: Eye, name: 'Eye' },
                            { icon: ThumbsUp, name: 'Thumbs Up' },
                            { icon: Gift, name: 'Gift' },
                            { icon: Rocket, name: 'Rocket' },
                            { icon: Target, name: 'Target' },
                            { icon: Shield, name: 'Shield' },
                            { icon: Diamond, name: 'Diamond' }
                          ].map((iconOption) => {
                            const IconComponent = iconOption.icon;
                            return (
                              <button
                                key={iconOption.name}
                                onClick={() => setConfig({ ...config, tagIcon: iconOption.name })}
                                className={`w-10 h-10 rounded-lg border-2 transition-all flex items-center justify-center ${config.tagIcon === iconOption.name ? 'border-purple-400 bg-purple-500/20 scale-110' : 'border-white/20 hover:border-white/40'
                                  }`}
                                title={iconOption.name}
                              >
                                <IconComponent className="w-4 h-4 text-white" />
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">Tag Color</label>
                        <div className="flex gap-2">
                          {[
                            { color: '#ef4444', name: 'Red' },
                            { color: '#f97316', name: 'Orange' },
                            { color: '#eab308', name: 'Yellow' },
                            { color: '#22c55e', name: 'Green' },
                            { color: '#3b82f6', name: 'Blue' },
                            { color: '#8b5cf6', name: 'Purple' },
                            { color: '#ec4899', name: 'Pink' }
                          ].map((colorOption) => (
                            <button
                              key={colorOption.color}
                              onClick={() => setConfig({ ...config, tagColor: colorOption.color })}
                              className={`w-8 h-8 rounded-lg border-2 transition-all ${config.tagColor === colorOption.color ? 'border-white scale-110' : 'border-white/20'
                                }`}
                              style={{ backgroundColor: colorOption.color }}
                              title={colorOption.name}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Heading Options */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.showHeading || false}
                        onChange={(e) => setConfig({ ...config, showHeading: e.target.checked })}
                        className="w-4 h-4 text-purple-500 bg-white/10 border-white/20 rounded focus:ring-purple-500 focus:ring-2"
                      />
                      <span className="text-sm text-white/80 font-medium">Show Heading</span>
                    </label>
                  </div>

                  {config.showHeading && (
                    <div className="ml-7">
                      <label className="block text-sm font-medium text-white/80 mb-2">Heading Text</label>
                      <input
                        type="text"
                        value={config.headingText || ''}
                        onChange={(e) => setConfig({ ...config, headingText: e.target.value })}
                        className="w-full bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/40 focus:border-purple-400/50 focus:outline-none transition-colors"
                        placeholder="e.g., Latest Movies, Popular Shows"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Toggle Options */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { key: 'autoScroll', label: 'Auto Scroll' },
                  { key: 'showRating', label: 'Show Rating' },
                  { key: 'showDescription', label: 'Show Description' },
                  { key: 'showLogo', label: 'Show Logo' },
                  ...(formData.type === 'homeflix-grid' ? [{ key: 'showYear', label: 'Show Year' }] : []),
                  ...(['preview-video', 'media-trailer', 'mixed-video', 'trailer'].includes(formData.type) ? [{ key: 'isMuted', label: 'Mute Video' }] : [])
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-3 p-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl hover:bg-white/10 transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config[key] !== false}
                      onChange={(e) => setConfig({ ...config, [key]: e.target.checked })}
                      className="w-4 h-4 text-red-500 bg-white/10 border-white/20 rounded focus:ring-red-500 focus:ring-2"
                    />
                    <span className="text-sm text-white/80">{label}</span>
                  </label>
                ))}
              </div>

              {/* Homeflix Grid Specific Options */}
              {formData.type === 'homeflix-grid' && (
                <div className="space-y-6 mt-8 p-6 bg-gradient-to-br from-blue-500/10 to-blue-600/10 backdrop-blur-sm border border-blue-400/20 rounded-xl">
                  <h5 className="text-lg font-semibold text-white flex items-center gap-2">
                    🎯 Homeflix Grid Settings
                  </h5>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-white/80 mb-3">Card Width (px)</label>
                      <input
                        type="number"
                        min="200"
                        max="400"
                        value={config.cardWidth || 280}
                        onChange={(e) => setConfig({ ...config, cardWidth: parseInt(e.target.value) })}
                        className="w-full bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:border-blue-400/50 focus:outline-none transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-white/80 mb-3">Cards Per Scroll</label>
                      <input
                        type="number"
                        min="1"
                        max="8"
                        value={config.cardsPerScroll || 4}
                        onChange={(e) => setConfig({ ...config, cardsPerScroll: parseInt(e.target.value) })}
                        className="w-full bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:border-blue-400/50 focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-3">Image Priority</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {[
                        { value: 'backdrop', label: 'Backdrop First', description: 'Use backdrop, fallback to poster' },
                        { value: 'poster', label: 'Poster First', description: 'Use poster, fallback to backdrop' },
                        { value: 'backdrop-only', label: 'Backdrop Only', description: 'Only use backdrop images' }
                      ].map((priority) => (
                        <button
                          key={priority.value}
                          onClick={() => setConfig({ ...config, imagePriority: priority.value })}
                          className={`p-3 rounded-xl border transition-all duration-200 text-left hover:scale-105 ${config.imagePriority === priority.value
                              ? 'bg-blue-500/20 border-blue-400/50 shadow-lg shadow-blue-500/10'
                              : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                            }`}
                        >
                          <div className="font-medium text-white mb-1">{priority.label}</div>
                          <p className="text-xs text-white/60">{priority.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <label className="flex items-center gap-3 p-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl hover:bg-white/10 transition-colors cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.showLogo !== false}
                        onChange={(e) => setConfig({ ...config, showLogo: e.target.checked })}
                        className="w-4 h-4 text-blue-500 bg-white/10 border-white/20 rounded focus:ring-blue-500 focus:ring-2"
                      />
                      <span className="text-sm text-white/80">Show Movie Logos</span>
                    </label>
                    <label className="flex items-center gap-3 p-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl hover:bg-white/10 transition-colors cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.hoverEffects !== false}
                        onChange={(e) => setConfig({ ...config, hoverEffects: e.target.checked })}
                        className="w-4 h-4 text-blue-500 bg-white/10 border-white/20 rounded focus:ring-blue-500 focus:ring-2"
                      />
                      <span className="text-sm text-white/80">Hover Effects</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Trailer Widget Specific Options */}
              {formData.type === 'trailer' && (
                <div className="space-y-6 mt-8 p-6 bg-gradient-to-br from-red-500/10 to-red-600/10 backdrop-blur-sm border border-red-400/20 rounded-xl">
                  <h5 className="text-lg font-semibold text-white flex items-center gap-2">
                    🎥 Trailer Widget Settings
                  </h5>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-white/80 mb-3">Auto Play Trailers</label>
                      <label className="flex items-center gap-3 p-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl hover:bg-white/10 transition-colors cursor-pointer">
                        <input
                          type="checkbox"
                          checked={config.autoPlay !== false}
                          onChange={(e) => setConfig({ ...config, autoPlay: e.target.checked })}
                          className="w-4 h-4 text-red-500 bg-white/10 border-white/20 rounded focus:ring-red-500 focus:ring-2"
                        />
                        <span className="text-sm text-white/80">Auto-play video trailers</span>
                      </label>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-white/80 mb-3">Video Quality</label>
                      <div className="grid grid-cols-1 gap-2">
                        {[
                          { value: 'hd720', label: '720p HD' },
                          { value: 'hd1080', label: '1080p Full HD' },
                          { value: 'auto', label: 'Auto Quality' }
                        ].map((quality) => (
                          <button
                            key={quality.value}
                            onClick={() => setConfig({ ...config, videoQuality: quality.value })}
                            className={`p-2 rounded-lg border transition-all duration-200 text-left text-sm ${config.videoQuality === quality.value
                                ? 'bg-red-500/20 border-red-400/50 text-white'
                                : 'bg-white/5 border-white/10 hover:bg-white/10 text-white/80'
                              }`}
                          >
                            {quality.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <label className="flex items-center gap-3 p-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl hover:bg-white/10 transition-colors cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.showTrailerBadge !== false}
                        onChange={(e) => setConfig({ ...config, showTrailerBadge: e.target.checked })}
                        className="w-4 h-4 text-red-500 bg-white/10 border-white/20 rounded focus:ring-red-500 focus:ring-2"
                      />
                      <span className="text-sm text-white/80">Show Trailer Badge</span>
                    </label>
                    <label className="flex items-center gap-3 p-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl hover:bg-white/10 transition-colors cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.showVideoControls !== false}
                        onChange={(e) => setConfig({ ...config, showVideoControls: e.target.checked })}
                        className="w-4 h-4 text-red-500 bg-white/10 border-white/20 rounded focus:ring-red-500 focus:ring-2"
                      />
                      <span className="text-sm text-white/80">Video Controls</span>
                    </label>
                    <label className="flex items-center gap-3 p-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl hover:bg-white/10 transition-colors cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.showThumbnails !== false}
                        onChange={(e) => setConfig({ ...config, showThumbnails: e.target.checked })}
                        className="w-4 h-4 text-red-500 bg-white/10 border-white/20 rounded focus:ring-red-500 focus:ring-2"
                      />
                      <span className="text-sm text-white/80">Show Thumbnails</span>
                    </label>
                    <label className="flex items-center gap-3 p-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl hover:bg-white/10 transition-colors cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.openInYouTube !== false}
                        onChange={(e) => setConfig({ ...config, openInYouTube: e.target.checked })}
                        className="w-4 h-4 text-red-500 bg-white/10 border-white/20 rounded focus:ring-red-500 focus:ring-2"
                      />
                      <span className="text-sm text-white/80">YouTube Link</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Notification Widget Specific Options */}
              {formData.type === 'notifications' && (
                <div className="space-y-6 mt-8 p-6 bg-gradient-to-br from-red-500/10 to-red-600/10 backdrop-blur-sm border border-red-400/20 rounded-xl">
                  <h5 className="text-lg font-semibold text-white flex items-center gap-2">
                    🔔 Notification Settings
                  </h5>

                  {/* Highlight Style */}
                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-3">Display Style</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {[
                        { value: 'banner', label: 'Banner', description: 'Full-width hero style' },
                        { value: 'card', label: 'Card', description: 'Individual cards' },
                        { value: 'minimal', label: 'Minimal', description: 'Simple list style' }
                      ].map((style) => (
                        <button
                          key={style.value}
                          onClick={() => setConfig({ ...config, highlightStyle: style.value })}
                          className={`p-3 rounded-xl border transition-all duration-200 text-left hover:scale-105 ${config.highlightStyle === style.value
                              ? 'bg-red-500/20 border-red-400/50 shadow-lg shadow-red-500/10'
                              : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                            }`}
                        >
                          <div className="font-medium text-white mb-1">{style.label}</div>
                          <p className="text-xs text-white/60">{style.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Notification Types */}
                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-3">Notification Types</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {[
                        // Library Updates
                        { value: 'new_movies', label: 'New Movies', description: 'Newly added movies', category: '📚 Library' },
                        { value: 'new_episodes', label: 'New Episodes', description: 'New TV episodes', category: '📚 Library' },
                        { value: 'recently_added', label: 'Recently Added', description: 'Recently added highlights', category: '📚 Library' },
                        // Recommendations
                        { value: 'movie_suggestion', label: 'Movie Suggestions', description: 'Multi-movie recommendations', category: '💡 Recommendations' },
                        { value: 'single_movie_suggestion', label: 'Single Movie Pick', description: 'Perfect match', category: '💡 Recommendations' },
                        { value: 'watch_again', label: 'Watch Again', description: 'Resume watching', category: '💡 Recommendations' },
                        { value: 'continue_watching', label: 'Continue Watching', description: 'With progress tracking', category: '💡 Recommendations' },
                        { value: 'genre_based', label: 'Genre Based', description: 'By favorite genres', category: '💡 Recommendations' },
                        // Trending & Local
                        { value: 'local_trending', label: 'Local Trending', description: 'Trending in your library', category: '🔥 Trending' },
                        // TMDB Updates
                        { value: 'tmdb_upcoming', label: 'TMDB Upcoming', description: 'Coming to theaters', category: '🎬 TMDB' },
                        { value: 'tmdb_now_playing', label: 'Now Playing', description: 'In theaters now', category: '🎬 TMDB' },
                        { value: 'tmdb_trending', label: 'TMDB Trending', description: 'Trending worldwide', category: '🎬 TMDB' },
                        { value: 'tmdb_upcoming_tv', label: 'Upcoming TV', description: 'New TV series/episodes', category: '🎬 TMDB' },
                        { value: 'tmdb_now_airing_tv', label: 'Now Airing TV', description: 'Currently airing', category: '🎬 TMDB' },
                        { value: 'tmdb_coming_soon', label: 'Coming Soon', description: 'Curated upcoming movies', category: '🎬 TMDB' },
                        // System
                        { value: 'download_complete', label: 'Download Complete', description: 'Finished downloads', category: '⚙️ System' },
                      ].map((type) => (
                        <button
                          key={type.value}
                          onClick={() => {
                            const currentTypes = config.notificationTypes || [];
                            if (currentTypes.includes(type.value)) {
                              setConfig({
                                ...config,
                                notificationTypes: currentTypes.filter((t: string) => t !== type.value)
                              });
                            } else {
                              setConfig({
                                ...config,
                                notificationTypes: [...currentTypes, type.value]
                              });
                            }
                          }}
                          className={`p-3 rounded-xl border transition-all duration-200 text-left hover:scale-105 ${(config.notificationTypes || []).includes(type.value)
                              ? 'bg-red-500/20 border-red-400/50 shadow-lg shadow-red-500/10'
                              : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                            }`}
                        >
                          <div className="font-medium text-white mb-1">{type.label}</div>
                          <p className="text-xs text-white/60">{type.description}</p>
                          <span className="text-xs text-white/40 mt-1 block">{type.category}</span>
                        </button>
                      ))}
                    </div>

                    {/* Select All / None buttons */}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => setConfig({
                          ...config,
                          notificationTypes: [
                            'new_movies', 'new_episodes', 'recently_added',
                            'movie_suggestion', 'single_movie_suggestion', 'watch_again', 'continue_watching', 'genre_based',
                            'local_trending',
                            'tmdb_upcoming', 'tmdb_now_playing', 'tmdb_trending',
                            'tmdb_upcoming_tv', 'tmdb_now_airing_tv', 'tmdb_coming_soon',
                            'download_complete'
                          ]
                        })}
                        className="px-3 py-1 text-xs bg-red-500/20 hover:bg-red-500/30 border border-red-400/30 text-red-200 rounded-lg transition-colors"
                      >
                        Select All
                      </button>
                      <button
                        onClick={() => setConfig({ ...config, notificationTypes: [] })}
                        className="px-3 py-1 text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 rounded-lg transition-colors"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  {/* Notification Display Options */}
                  <div className="grid grid-cols-2 gap-4">
                    <label className="flex items-center gap-3 p-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl hover:bg-white/10 transition-colors cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.showNotificationIcon !== false}
                        onChange={(e) => setConfig({ ...config, showNotificationIcon: e.target.checked })}
                        className="w-4 h-4 text-red-500 bg-white/10 border-white/20 rounded focus:ring-red-500 focus:ring-2"
                      />
                      <span className="text-sm text-white/80">Show Icons</span>
                    </label>
                    <label className="flex items-center gap-3 p-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl hover:bg-white/10 transition-colors cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.showTimestamp !== false}
                        onChange={(e) => setConfig({ ...config, showTimestamp: e.target.checked })}
                        className="w-4 h-4 text-red-500 bg-white/10 border-white/20 rounded focus:ring-red-500 focus:ring-2"
                      />
                      <span className="text-sm text-white/80">Show Timestamps</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-white/10 flex-shrink-0">
            <button
              onClick={onCancel}
              className="px-6 py-3 text-white/60 hover:text-white hover:bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl transition-all duration-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-500/20 to-red-600/20 hover:from-red-500/30 hover:to-red-600/30 backdrop-blur-sm border border-red-400/30 text-red-200 rounded-xl transition-all duration-200 hover:scale-105"
            >
              <Save className="w-4 h-4" />
              Save Widget
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
