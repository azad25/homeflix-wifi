"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Settings, 
  Plus, 
  Edit3, 
  Trash2, 
  Save, 
  X, 
  Eye, 
  EyeOff,
  ArrowUp,
  ArrowDown,
  Copy,
  BarChart3
} from 'lucide-react';
import { Widget, WidgetType, PageType, LayoutType, DataSourceType, ContentType, ColorScheme } from '@/types/widgets';
import { getApiUrl } from '@/lib/api';
import WidgetPerformanceDashboard from './WidgetPerformanceDashboard';

interface WidgetConfigPanelProps {
  page: string;
  isOpen: boolean;
  onClose: () => void;
  onWidgetsChange?: () => void;
}

const widgetTypes: { value: WidgetType; label: string; description: string }[] = [
  { value: 'featured-banner', label: 'Featured Banner', description: 'Large hero banner with featured content' },
  { value: 'half-banner', label: 'Half Banner', description: 'Half-width banner for secondary content' },
  { value: 'backdrop-slideshow', label: 'Backdrop Slideshow', description: 'Full-width slideshow with backdrop images' },
  { value: 'trending-slideshow', label: 'Trending Slideshow', description: 'Horizontal scrolling content row' },
  { value: 'movie-grid', label: 'Movie Grid', description: 'Grid layout for multiple items' },
  { value: 'genre-based', label: 'Genre Based', description: 'Content filtered by specific genre' },
  { value: 'coming-soon', label: 'Coming Soon', description: 'Upcoming releases banner' },
  { value: 'new-releases', label: 'New Releases', description: 'Recently added content' },
  { value: 'popular', label: 'Popular', description: 'Most popular content' },
  { value: 'recently-added', label: 'Recently Added', description: 'Latest additions' },
  { value: 'recently-watched', label: 'Recently Watched', description: 'User\'s viewing history' },
  { value: 'continue-watching', label: 'Continue Watching', description: 'Resume watching progress' },
  { value: 'trailer', label: 'Trailer Widget', description: 'Video trailers and previews' }
];

const layouts: { value: LayoutType; label: string }[] = [
  { value: 'full', label: 'Full Width' },
  { value: 'half', label: 'Half Width' },
  { value: 'third', label: 'Third Width' }
];

const dataSources: { value: DataSourceType; label: string }[] = [
  { value: 'local', label: 'Local Media' },
  { value: 'tmdb', label: 'TMDB API' },
  { value: 'trending', label: 'Trending' },
  { value: 'popular', label: 'Popular' },
  { value: 'recent', label: 'Recent' },
  { value: 'now-playing', label: 'Now Playing' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'top-rated', label: 'Top Rated' }
];

const contentTypes: { value: ContentType; label: string }[] = [
  { value: 'mixed', label: 'Mixed Content' },
  { value: 'movies', label: 'Movies Only' },
  { value: 'tv-shows', label: 'TV Shows Only' }
];

export default function WidgetConfigPanel({ page, isOpen, onClose, onWidgetsChange }: WidgetConfigPanelProps) {
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingWidget, setEditingWidget] = useState<Widget | null>(null);
  const [showPerformance, setShowPerformance] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = getApiUrl();

  useEffect(() => {
    if (isOpen) {
      fetchWidgets();
    }
  }, [isOpen, page]);

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
        onWidgetsChange?.();
      } else {
        throw new Error('Failed to delete widget');
      }
    } catch (error) {
      console.error('Error deleting widget:', error);
      setError('Failed to delete widget');
    }
  };

  const toggleWidgetEnabled = async (widget: Widget) => {
    await saveWidget({ ...widget, enabled: !widget.enabled });
  };

  const moveWidget = async (widget: Widget, direction: 'up' | 'down') => {
    const currentIndex = widgets.findIndex(w => w.id === widget.id);
    const newPosition = direction === 'up' ? widget.position - 1 : widget.position + 1;
    
    if (newPosition < 1 || newPosition > widgets.length) return;

    await saveWidget({ ...widget, position: newPosition });
  };

  const duplicateWidget = async (widget: Widget) => {
    const duplicate = {
      ...widget,
      id: undefined,
      name: `${widget.name} (Copy)`,
      position: widgets.length + 1
    };
    await saveWidget(duplicate);
  };

  const createNewWidget = () => {
    const newWidget: Partial<Widget> = {
      name: 'New Widget',
      type: 'movie-grid',
      page: page as PageType,
      position: widgets.length + 1,
      enabled: true,
      config: '{}',
      contentType: 'mixed',
      dataSource: 'tmdb',
      maxItems: 10,
      layout: 'full',
      colorScheme: 'auto'
    };
    setEditingWidget(newWidget as Widget);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-gray-900 border border-gray-700 rounded-xl max-w-6xl w-full max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <Settings className="w-6 h-6 text-blue-400" />
              <h2 className="text-xl font-semibold text-white">
                Widget Configuration - {page.charAt(0).toUpperCase() + page.slice(1)}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPerformance(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                <BarChart3 className="w-4 h-4" />
                Performance
              </button>
              <button
                onClick={createNewWidget}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Widget
              </button>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
            {error && (
              <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-6">
                <p className="text-red-200">{error}</p>
              </div>
            )}

            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-gray-400">Loading widgets...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {widgets.map((widget) => (
                  <motion.div
                    key={widget.id}
                    layout
                    className={`bg-gray-800/50 border rounded-lg p-4 ${
                      widget.enabled ? 'border-gray-600' : 'border-gray-700 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleWidgetEnabled(widget)}
                          className={`p-1 rounded ${
                            widget.enabled ? 'text-green-400' : 'text-gray-500'
                          }`}
                        >
                          {widget.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                        <div>
                          <h3 className="font-medium text-white">{widget.name}</h3>
                          <div className="flex items-center gap-2 text-sm text-gray-400">
                            <span>{widget.type}</span>
                            <span>•</span>
                            <span>{widget.layout}</span>
                            <span>•</span>
                            <span>{widget.dataSource}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => moveWidget(widget, 'up')}
                          disabled={widget.position === 1}
                          className="p-1 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => moveWidget(widget, 'down')}
                          disabled={widget.position === widgets.length}
                          className="p-1 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => duplicateWidget(widget)}
                          className="p-1 text-gray-400 hover:text-white"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingWidget(widget)}
                          className="p-1 text-gray-400 hover:text-white"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteWidget(widget.id)}
                          className="p-1 text-gray-400 hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}

                {widgets.length === 0 && (
                  <div className="text-center py-12">
                    <Settings className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-400 mb-2">No widgets configured</h3>
                    <p className="text-gray-500 mb-6">Add your first widget to get started</p>
                    <button
                      onClick={createNewWidget}
                      className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors mx-auto"
                    >
                      <Plus className="w-4 h-4" />
                      Add Widget
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>

        {/* Widget Editor Modal */}
        {editingWidget && (
          <WidgetEditor
            widget={editingWidget}
            onSave={saveWidget}
            onCancel={() => setEditingWidget(null)}
          />
        )}

        {/* Performance Dashboard */}
        <WidgetPerformanceDashboard
          isOpen={showPerformance}
          onClose={() => setShowPerformance(false)}
        />
      </motion.div>
    </AnimatePresence>
  );
}

// Widget Editor Component
function WidgetEditor({ 
  widget, 
  onSave, 
  onCancel 
}: { 
  widget: Widget; 
  onSave: (widget: Partial<Widget>) => void; 
  onCancel: () => void; 
}) {
  const [formData, setFormData] = useState(widget);
  const [config, setConfig] = useState(() => {
    try {
      return JSON.parse(widget.config || '{}');
    } catch {
      return {};
    }
  });

  const handleSave = () => {
    onSave({
      ...formData,
      config: JSON.stringify(config)
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/90 backdrop-blur-sm z-60 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-gray-800 border border-gray-600 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-600">
          <h3 className="text-lg font-semibold text-white">
            {widget.id ? 'Edit Widget' : 'Create Widget'}
          </h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-4">
          {/* Basic Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as WidgetType })}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
              >
                {widgetTypes.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Layout</label>
              <select
                value={formData.layout}
                onChange={(e) => setFormData({ ...formData, layout: e.target.value as LayoutType })}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
              >
                {layouts.map(layout => (
                  <option key={layout.value} value={layout.value}>{layout.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Data Source</label>
              <select
                value={formData.dataSource}
                onChange={(e) => setFormData({ ...formData, dataSource: e.target.value as DataSourceType })}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
              >
                {dataSources.map(source => (
                  <option key={source.value} value={source.value}>{source.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Content Type</label>
              <select
                value={formData.contentType}
                onChange={(e) => setFormData({ ...formData, contentType: e.target.value as ContentType })}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
              >
                {contentTypes.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Max Items</label>
              <input
                type="number"
                min="1"
                max="50"
                value={formData.maxItems}
                onChange={(e) => setFormData({ ...formData, maxItems: parseInt(e.target.value) })}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
              />
            </div>
          </div>

          {/* Configuration */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Title (Optional)</label>
            <input
              type="text"
              value={config.title || ''}
              onChange={(e) => setConfig({ ...config, title: e.target.value })}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
              placeholder="Custom widget title"
            />
          </div>

          {/* Widget-specific options */}
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={config.autoScroll || false}
                onChange={(e) => setConfig({ ...config, autoScroll: e.target.checked })}
                className="rounded"
              />
              Auto Scroll
            </label>

            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={config.showRating !== false}
                onChange={(e) => setConfig({ ...config, showRating: e.target.checked })}
                className="rounded"
              />
              Show Rating
            </label>

            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={config.showDescription !== false}
                onChange={(e) => setConfig({ ...config, showDescription: e.target.checked })}
                className="rounded"
              />
              Show Description
            </label>

            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={formData.enabled}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                className="rounded"
              />
              Enabled
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-600">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Save className="w-4 h-4" />
            Save Widget
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}