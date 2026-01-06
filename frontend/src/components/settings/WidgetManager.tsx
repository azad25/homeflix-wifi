"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, Trash2, GripVertical, Edit2, Save, X, Eye, EyeOff,
    Layout, Monitor, Film, Tv, Compass, Sparkles, Settings2, Check,
    Search, Star, Calendar, Filter
} from 'lucide-react';
import { Widget, WidgetType, PageType, LayoutType, WidgetMeta, DataSourceType, ContentType } from '@/types/widgets';
import { NotificationType } from '@/types/notifications';
import { getApiUrl } from '@/lib/api';

interface Genre {
    id: number;
    name: string;
}

interface TMDBSearchResult {
    id: number;
    title: string;
    original_title: string;
    overview: string;
    release_date: string;
    poster_path: string;
    backdrop_path: string;
    vote_average: number;
    vote_count: number;
    popularity: number;
    media_type: "movie" | "tv";
    adult: boolean;
    genre_ids: number[];
}

interface WidgetManagerProps {
    className?: string;
}

// Notification types with descriptions - COMPLETE BACKEND MATCH
const NOTIFICATION_TYPES = [
    // Library Updates
    { 
        value: 'new_movies' as NotificationType, 
        label: 'New Movies', 
        description: 'Newly added movies to library',
        category: 'Library Updates'
    },
    { 
        value: 'new_episodes' as NotificationType, 
        label: 'New Episodes', 
        description: 'New TV show episodes',
        category: 'Library Updates'
    },
    { 
        value: 'recently_added' as NotificationType, 
        label: 'Recently Added', 
        description: 'Recently added content highlights',
        category: 'Library Updates'
    },
    // Recommendations
    { 
        value: 'movie_suggestion' as NotificationType, 
        label: 'Movie Suggestions', 
        description: 'Multiple movie recommendations based on watch history',
        category: 'Recommendations'
    },
    { 
        value: 'single_movie_suggestion' as NotificationType, 
        label: 'Single Movie Pick', 
        description: 'Perfect movie match for you',
        category: 'Recommendations'
    },
    { 
        value: 'watch_again' as NotificationType, 
        label: 'Watch Again', 
        description: 'Resume watching suggestions for partially watched content',
        category: 'Recommendations'
    },
    { 
        value: 'continue_watching' as NotificationType, 
        label: 'Continue Watching', 
        description: 'In-progress content with progress tracking',
        category: 'Recommendations'
    },
    { 
        value: 'genre_based' as NotificationType, 
        label: 'Genre Based', 
        description: 'Recommendations based on favorite genres',
        category: 'Recommendations'
    },
    // Trending & Local
    { 
        value: 'local_trending' as NotificationType, 
        label: 'Local Trending', 
        description: 'Trending content in your library',
        category: 'Local Content'
    },
    // System
    { 
        value: 'download_complete' as NotificationType, 
        label: 'Download Complete', 
        description: 'Finished downloads',
        category: 'System'
    },
    // TMDB Updates
    { 
        value: 'tmdb_upcoming' as NotificationType, 
        label: 'TMDB Upcoming', 
        description: 'Coming soon to theaters (1-60 days)',
        category: 'TMDB Updates'
    },
    { 
        value: 'tmdb_now_playing' as NotificationType, 
        label: 'TMDB Now Playing', 
        description: 'Currently in theaters',
        category: 'TMDB Updates'
    },
    { 
        value: 'tmdb_trending' as NotificationType, 
        label: 'TMDB Trending', 
        description: 'Trending movies worldwide',
        category: 'TMDB Updates'
    },
    { 
        value: 'tmdb_upcoming_tv' as NotificationType, 
        label: 'Upcoming TV', 
        description: 'Upcoming TV episodes and series',
        category: 'TMDB Updates'
    },
    { 
        value: 'tmdb_now_airing_tv' as NotificationType, 
        label: 'Now Airing TV', 
        description: 'Currently airing TV shows',
        category: 'TMDB Updates'
    },
    { 
        value: 'tmdb_coming_soon' as NotificationType, 
        label: 'TMDB Coming Soon', 
        description: 'Curated upcoming movie releases',
        category: 'TMDB Updates'
    },
    // Legacy/Unused (kept for compatibility)
    { 
        value: 'coming_soon' as NotificationType, 
        label: 'Coming Soon (Legacy)', 
        description: 'Legacy coming soon notification',
        category: 'Deprecated'
    },
] as const;

const pageIcons: Record<string, React.ReactNode> = {
    home: <Monitor className="w-4 h-4" />,
    movies: <Film className="w-4 h-4" />,
    'tv-shows': <Tv className="w-4 h-4" />,
    browse: <Compass className="w-4 h-4" />,
    'new-popular': <Sparkles className="w-4 h-4" />,
};

export default function WidgetManager({ className = '' }: WidgetManagerProps) {
    const [widgets, setWidgets] = useState<Widget[]>([]);
    const [widgetMeta, setWidgetMeta] = useState<WidgetMeta | null>(null);
    const [selectedPage, setSelectedPage] = useState<PageType>('home');
    const [loading, setLoading] = useState(true);
    const [editingWidget, setEditingWidget] = useState<number | null>(null);
    const [isAddingNew, setIsAddingNew] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    
    // TMDB Search & Genre Selection State
    const [showContentSelector, setShowContentSelector] = useState(false);
    const [genres, setGenres] = useState<Genre[]>([]);
    const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<TMDBSearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [contentSelectionMode, setContentSelectionMode] = useState<'search' | 'genres' | 'featured'>('search');
    const [featuredContent, setFeaturedContent] = useState<TMDBSearchResult[]>([]);
    const [selectedContent, setSelectedContent] = useState<TMDBSearchResult[]>([]);
    const [editingSelectedContent, setEditingSelectedContent] = useState<TMDBSearchResult[]>([]);
    const [editingSelectedGenres, setEditingSelectedGenres] = useState<number[]>([]);

    // Widget editing state

    const apiUrl = getApiUrl();

    // New widget form state
    const [newWidget, setNewWidget] = useState<Partial<Widget>>({
        name: '',
        type: 'movie-grid' as WidgetType,
        page: 'home' as PageType,
        enabled: true,
        config: '{}',
        contentType: 'mixed',
        dataSource: 'tmdb',
        maxItems: 10,
        layout: 'full' as LayoutType,
        colorScheme: 'auto'
    });

    // Fetch widgets and meta
    useEffect(() => {
        fetchWidgets();
        fetchWidgetMeta();
        fetchGenres();
    }, []);

    // Debounced search for TMDB content
    useEffect(() => {
        if (contentSelectionMode === 'search' && searchQuery.trim().length > 1) {
            const timeoutId = setTimeout(() => {
                fetchTMDBContent(searchQuery.trim());
            }, 300);
            return () => clearTimeout(timeoutId);
        } else if (contentSelectionMode === 'search') {
            setSearchResults([]);
        }
    }, [searchQuery, contentSelectionMode]);

    const fetchWidgets = async () => {
        try {
            const response = await fetch(`${apiUrl}/api/widgets`);
            if (response.ok) {
                const data = await response.json();
                setWidgets(data);
            }
        } catch (error) {
            console.error('Failed to fetch widgets:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchWidgetMeta = async () => {
        try {
            const response = await fetch(`${apiUrl}/api/widgets/meta`);
            if (response.ok) {
                const data = await response.json();
                setWidgetMeta(data);
            }
        } catch (error) {
            console.error('Failed to fetch widget meta:', error);
        }
    };

    // Fetch genres from TMDB
    const fetchGenres = async () => {
        try {
            const [movieGenres, tvGenres] = await Promise.all([
                fetch(`${apiUrl}/api/tmdb/genres/movie`).then(r => r.ok ? r.json() : { genres: [] }),
                fetch(`${apiUrl}/api/tmdb/genres/tv`).then(r => r.ok ? r.json() : { genres: [] })
            ]);
            
            // Combine and deduplicate genres
            const allGenres = [...movieGenres.genres, ...tvGenres.genres];
            const uniqueGenres = allGenres.filter((genre, index, self) => 
                index === self.findIndex(g => g.id === genre.id)
            );
            
            setGenres(uniqueGenres.sort((a, b) => a.name.localeCompare(b.name)));
        } catch (error) {
            console.error('Error fetching genres:', error);
        }
    };

    // Search TMDB content
    const fetchTMDBContent = async (query: string) => {
        if (!query.trim()) return;

        setIsSearching(true);
        try {
            const response = await fetch(`${apiUrl}/api/tmdb/suggestions?q=${encodeURIComponent(query)}`);
            if (response.ok) {
                const data = await response.json();
                setSearchResults(data.results || []);
            } else {
                setSearchResults([]);
            }
        } catch (error) {
            console.error("Error fetching TMDB content:", error);
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    // Fetch featured/trending content
    const fetchFeaturedContent = async () => {
        try {
            const endpoints = [
                `${apiUrl}/api/tmdb/trending/movie/week`,
                `${apiUrl}/api/tmdb/trending/tv/week`,
                `${apiUrl}/api/tmdb/movie/popular`,
                `${apiUrl}/api/tmdb/tv/popular`
            ];
            
            const responses = await Promise.all(
                endpoints.map(url => fetch(url).then(r => r.ok ? r.json() : { results: [] }))
            );
            
            const allResults = responses.flatMap(data => data.results || []);
            
            // Process results and remove duplicates
            const processedResults = allResults.map(item => ({
                ...item,
                media_type: item.media_type || (item.title ? 'movie' : 'tv'),
                title: item.title || item.name
            }));
            
            const uniqueResults = processedResults.filter((item, index, self) => 
                index === self.findIndex(i => i.id === item.id && i.media_type === item.media_type)
            ).slice(0, 20);
            
            setFeaturedContent(uniqueResults);
        } catch (error) {
            console.error("Error fetching featured content:", error);
        }
    };

    // Filter content by selected genres
    const getFilteredByGenres = () => {
        if (selectedGenres.length === 0) return featuredContent;
        return featuredContent.filter(item => 
            item.genre_ids?.some(genreId => selectedGenres.includes(genreId))
        );
    };

    // Get poster URL
    const getPosterUrl = (posterPath: string) => {
        if (!posterPath) return '/placeholder-poster.jpg';
        return `https://image.tmdb.org/t/p/w185${posterPath}`;
    };

    // Format date
    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        const year = new Date(dateString).getFullYear();
        return year ? `(${year})` : '';
    };

    const filteredWidgets = widgets.filter(widget => widget.page === selectedPage);

    const handleCreateWidget = async () => {
        if (!newWidget.name?.trim()) return;

        setSaveStatus('saving');
        try {
            // Parse existing config and add selected content/genres
            let config: any = {};
            try {
                config = JSON.parse(newWidget.config || '{}');
            } catch (e) {
                config = {};
            }

            // Add selected content and genres to config
            if (selectedContent.length > 0) {
                config.selectedContent = selectedContent;
            }
            if (selectedGenres.length > 0) {
                config.selectedGenres = selectedGenres;
                // Also add genreFilter for backend compatibility
                const genreNames = selectedGenres.map(id => {
                    const genre = genres.find(g => g.id === id);
                    return genre ? genre.name : '';
                }).filter(name => name);
                config.genreFilter = genreNames;
            }

            const response = await fetch(`${apiUrl}/api/widgets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...newWidget,
                    page: selectedPage,
                    config: JSON.stringify(config)
                })
            });

            if (response.ok) {
                const createdWidget = await response.json();
                setWidgets(prev => [...prev, createdWidget]);
                setNewWidget({
                    name: '',
                    type: 'movie-grid' as WidgetType,
                    page: selectedPage,
                    enabled: true,
                    config: '{}',
                    contentType: 'mixed',
                    dataSource: 'tmdb',
                    maxItems: 10,
                    layout: 'full' as LayoutType,
                    colorScheme: 'auto'
                });
                setSelectedContent([]);
                setSelectedGenres([]);
                setIsAddingNew(false);
                setSaveStatus('saved');
                setTimeout(() => setSaveStatus('idle'), 2000);
            } else {
                setSaveStatus('error');
            }
        } catch (error) {
            console.error('Failed to create widget:', error);
            setSaveStatus('error');
        }
    };

    const handleCancelEdit = () => {
        setEditingWidget(null);
        setEditingSelectedContent([]);
        setEditingSelectedGenres([]);
    };

    const handleUpdateWidget = async (id: number, updates: Partial<Widget>) => {
        setSaveStatus('saving');
        try {
            const response = await fetch(`${apiUrl}/api/widgets/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });

            if (response.ok) {
                const updatedWidget = await response.json();
                setWidgets(prev => prev.map(w => w.id === id ? updatedWidget : w));
                setEditingWidget(null);
                setSaveStatus('saved');
                setTimeout(() => setSaveStatus('idle'), 2000);
            } else {
                setSaveStatus('error');
            }
        } catch (error) {
            console.error('Failed to update widget:', error);
            setSaveStatus('error');
        }
    };

    const handleDeleteWidget = async (id: number) => {
        if (!confirm('Are you sure you want to delete this widget?')) return;

        try {
            const response = await fetch(`${apiUrl}/api/widgets/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                setWidgets(prev => prev.filter(w => w.id !== id));
            }
        } catch (error) {
            console.error('Failed to delete widget:', error);
        }
    };

    const handleToggleWidget = async (id: number, enabled: boolean) => {
        try {
            const response = await fetch(`${apiUrl}/api/widgets/${id}/toggle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled })
            });

            if (response.ok) {
                setWidgets(prev => prev.map(w => w.id === id ? { ...w, enabled } : w));
            }
        } catch (error) {
            console.error('Failed to toggle widget:', error);
        }
    };

    const handleDuplicateWidget = async (id: number) => {
        try {
            const response = await fetch(`${apiUrl}/api/widgets/${id}/duplicate`, {
                method: 'POST'
            });

            if (response.ok) {
                const duplicatedWidget = await response.json();
                setWidgets(prev => [...prev, duplicatedWidget]);
            }
        } catch (error) {
            console.error('Failed to duplicate widget:', error);
        }
    };

    if (loading) {
        return (
            <div className={`p-6 ${className}`}>
                <div className="animate-pulse">
                    <div className="h-8 bg-black/40 backdrop-blur-sm border border-white/20 rounded mb-4"></div>
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-16 bg-black/30 backdrop-blur-sm border border-white/10 rounded"></div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`p-6 ${className}`}>
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Widget Manager</h2>
                {saveStatus === 'saved' && (
                    <div className="flex items-center text-green-400">
                        <Check className="w-4 h-4 mr-2" />
                        Saved
                    </div>
                )}
            </div>

            {/* Page Selector */}
            <div className="flex space-x-2 mb-6 bg-black/40 backdrop-blur-sm border border-white/20 rounded-lg p-1">
                {widgetMeta?.pages?.map((page: any) => (
                    <button
                        key={page.page}
                        onClick={() => setSelectedPage(page.page)}
                        className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                            selectedPage === page.page
                                ? 'bg-red-600 text-white border border-red-500/50'
                                : 'text-gray-300 hover:text-white hover:bg-white/10 border border-transparent'
                        }`}
                    >
                        {pageIcons[page.page]}
                        <span className="ml-2">{page.name}</span>
                    </button>
                ))}
            </div>

            {/* Add New Widget Form */}
            <AnimatePresence>
                {isAddingNew && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-gray-800 rounded-lg p-4 mb-4 border border-gray-700"
                    >
                        <h3 className="text-lg font-semibold text-white mb-4">Add New Widget</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Name</label>
                                <input
                                    type="text"
                                    value={newWidget.name || ''}
                                    onChange={(e) => setNewWidget(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                                    placeholder="Widget name"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Type</label>
                                <select
                                    value={newWidget.type || 'movie-grid'}
                                    onChange={(e) => setNewWidget(prev => ({ ...prev, type: e.target.value as WidgetType }))}
                                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                                >
                                    {widgetMeta?.types?.map((type: any) => (
                                        <option key={type.type} value={type.type}>{type.name}</option>
                                    ))}
                                    <option value="notifications">Notifications</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Data Source</label>
                                <select
                                    value={newWidget.dataSource || 'tmdb'}
                                    onChange={(e) => setNewWidget(prev => ({ ...prev, dataSource: e.target.value as DataSourceType }))}
                                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                                >
                                    <option value="tmdb">TMDB</option>
                                    <option value="local">Local</option>
                                    <option value="popular">Popular</option>
                                    <option value="trending">Trending</option>
                                    <option value="now-playing">Now Playing</option>
                                    <option value="upcoming">Upcoming</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Content Type</label>
                                <select
                                    value={newWidget.contentType || 'mixed'}
                                    onChange={(e) => setNewWidget(prev => ({ ...prev, contentType: e.target.value as ContentType }))}
                                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                                >
                                    <option value="mixed">Mixed</option>
                                    <option value="movies">Movies</option>
                                    <option value="tv-shows">TV Shows</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Layout</label>
                                <select
                                    value={newWidget.layout || 'full'}
                                    onChange={(e) => setNewWidget(prev => ({ ...prev, layout: e.target.value as LayoutType }))}
                                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                                >
                                    {widgetMeta?.layouts?.map((layout: any) => (
                                        <option key={layout.layout} value={layout.layout}>{layout.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Max Items</label>
                                <input
                                    type="number"
                                    value={newWidget.maxItems || 10}
                                    onChange={(e) => setNewWidget(prev => ({ ...prev, maxItems: parseInt(e.target.value) }))}
                                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                                    min="1"
                                    max="50"
                                />
                            </div>
                        </div>
                        
                        {/* Content Selection Button for New Widget */}
                        {(newWidget.dataSource === 'tmdb' || newWidget.dataSource === 'local') && newWidget.type !== 'notifications' && (
                            <div className="mt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowContentSelector(true)}
                                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500"
                                >
                                    <Search className="w-4 h-4 mr-2" />
                                    Select Content & Genres
                                </button>
                                {selectedContent.length > 0 && (
                                    <p className="text-sm text-gray-400 mt-2">
                                        {selectedContent.length} items selected
                                    </p>
                                )}
                            </div>
                        )}
                        
                        {/* Notification Widget Settings */}
                        {newWidget.type === 'notifications' && (
                            <div className="mt-4 p-4 bg-gray-700 rounded-lg">
                                <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                                    Notification Widget Settings
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">Display Style</label>
                                        <select
                                            value={JSON.parse(newWidget.config || '{}').highlightStyle || 'banner'}
                                            onChange={(e) => {
                                                const config = JSON.parse(newWidget.config || '{}');
                                                config.highlightStyle = e.target.value;
                                                setNewWidget(prev => ({ ...prev, config: JSON.stringify(config) }));
                                            }}
                                            className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-md text-white"
                                        >
                                            <option value="banner">Enhanced Banner (Recommended)</option>
                                            <option value="card">Card List</option>
                                            <option value="minimal">Minimal List</option>
                                        </select>
                                        <p className="text-xs text-gray-400 mt-1">Banner style provides cinematic experience with trailers</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">Auto Scroll</label>
                                        <select
                                            value={JSON.parse(newWidget.config || '{}').autoScroll !== false ? 'true' : 'false'}
                                            onChange={(e) => {
                                                const config = JSON.parse(newWidget.config || '{}');
                                                config.autoScroll = e.target.value === 'true';
                                                setNewWidget(prev => ({ ...prev, config: JSON.stringify(config) }));
                                            }}
                                            className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-md text-white"
                                        >
                                            <option value="true">Enabled (10s intervals)</option>
                                            <option value="false">Disabled</option>
                                        </select>
                                        <p className="text-xs text-gray-400 mt-1">Automatically cycle through notifications</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">Show Timestamps</label>
                                        <select
                                            value={JSON.parse(newWidget.config || '{}').showTimestamp !== false ? 'true' : 'false'}
                                            onChange={(e) => {
                                                const config = JSON.parse(newWidget.config || '{}');
                                                config.showTimestamp = e.target.value === 'true';
                                                setNewWidget(prev => ({ ...prev, config: JSON.stringify(config) }));
                                            }}
                                            className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-md text-white"
                                        >
                                            <option value="true">Show (e.g., "2h ago")</option>
                                            <option value="false">Hide</option>
                                        </select>
                                        <p className="text-xs text-gray-400 mt-1">Display when notification was created</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">Show Icons</label>
                                        <select
                                            value={JSON.parse(newWidget.config || '{}').showNotificationIcon !== false ? 'true' : 'false'}
                                            onChange={(e) => {
                                                const config = JSON.parse(newWidget.config || '{}');
                                                config.showNotificationIcon = e.target.value === 'true';
                                                setNewWidget(prev => ({ ...prev, config: JSON.stringify(config) }));
                                            }}
                                            className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-md text-white"
                                        >
                                            <option value="true">Show Type Icons</option>
                                            <option value="false">Hide Icons</option>
                                        </select>
                                        <p className="text-xs text-gray-400 mt-1">Display notification type icons</p>
                                    </div>
                                </div>
                                <div className="mt-4">
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Notification Types</label>
                                    <div className="grid grid-cols-1 gap-2">
                                        {NOTIFICATION_TYPES.map((type) => {
                                            const config = JSON.parse(newWidget.config || '{}');
                                            const notificationTypes = config.notificationTypes || [];
                                            const isChecked = notificationTypes.includes(type.value);
                                            
                                            return (
                                                <div key={type.value} className="group">
                                                    <label className="flex items-start space-x-3 text-sm p-3 rounded-lg hover:bg-gray-600 transition-colors cursor-pointer border border-gray-600 hover:border-gray-500">
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={(e) => {
                                                                const config = JSON.parse(newWidget.config || '{}');
                                                                let notificationTypes = config.notificationTypes || [];
                                                                
                                                                if (e.target.checked) {
                                                                    notificationTypes = [...notificationTypes, type.value];
                                                                } else {
                                                                    notificationTypes = notificationTypes.filter((t: string) => t !== type.value);
                                                                }
                                                                
                                                                config.notificationTypes = notificationTypes;
                                                                setNewWidget(prev => ({ ...prev, config: JSON.stringify(config) }));
                                                            }}
                                                            className="mt-0.5 rounded border-gray-500 bg-gray-600 text-red-600 focus:ring-red-500"
                                                        />
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-gray-300 font-medium">{type.label}</span>
                                                                <span className="px-2 py-0.5 bg-gray-600 text-gray-300 text-xs rounded-full">
                                                                    {type.category}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-gray-400 mt-0.5">{type.description}</p>
                                                        </div>
                                                    </label>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="mt-3 p-3 bg-gray-600 rounded-lg">
                                        <p className="text-xs text-gray-300 mb-2">
                                            💡 <strong>Configuration Tips:</strong>
                                        </p>
                                        <ul className="text-xs text-gray-400 space-y-1">
                                            <li>• Leave empty to show all notification types</li>
                                            <li>• Select specific types to filter content</li>
                                            <li>• TMDB types require API key configuration</li>
                                            <li>• Library types show local content updates</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        {/* Content Selection Button */}
                        {(newWidget.dataSource === 'tmdb' || newWidget.dataSource === 'local') && newWidget.type !== 'notifications' && (
                            <div className="mt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowContentSelector(true);
                                        if (contentSelectionMode === 'featured') {
                                            fetchFeaturedContent();
                                        }
                                    }}
                                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500"
                                >
                                    <Search className="w-4 h-4 mr-2" />
                                    Select Content & Genres
                                </button>
                                {selectedContent.length > 0 && (
                                    <p className="text-sm text-gray-400 mt-2">
                                        {selectedContent.length} items selected
                                    </p>
                                )}
                            </div>
                        )}
                        <div className="flex justify-end space-x-2 mt-4">
                            <button
                                onClick={() => setIsAddingNew(false)}
                                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateWidget}
                                disabled={!newWidget.name?.trim() || saveStatus === 'saving'}
                                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-500 disabled:opacity-50"
                            >
                                {saveStatus === 'saving' ? 'Creating...' : 'Create Widget'}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Add Widget Button */}
            {!isAddingNew && (
                <button
                    onClick={() => setIsAddingNew(true)}
                    className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 mb-4"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Widget
                </button>
            )}

            {/* Widget List */}
            <div className="space-y-4">
                {filteredWidgets.map((widget) => (
                    <WidgetCard
                        key={widget.id}
                        widget={widget}
                        widgetMeta={widgetMeta}
                        isEditing={editingWidget === widget.id}
                        onEdit={() => {
                            setEditingWidget(widget.id);
                            // Initialize editing state with current widget config
                            try {
                                const config = JSON.parse(widget.config || '{}');
                                setEditingSelectedContent(config.selectedContent || []);
                                setEditingSelectedGenres(config.selectedGenres || []);
                            } catch (e) {
                                setEditingSelectedContent([]);
                                setEditingSelectedGenres([]);
                            }
                        }}
                        onSave={(updates) => handleUpdateWidget(widget.id, updates)}
                        onCancel={handleCancelEdit}
                        onDelete={() => handleDeleteWidget(widget.id)}
                        onToggle={(enabled) => handleToggleWidget(widget.id, enabled)}
                        onDuplicate={() => handleDuplicateWidget(widget.id)}
                        saveStatus={saveStatus}
                        editingSelectedContent={editingSelectedContent}
                        setEditingSelectedContent={setEditingSelectedContent}
                        editingSelectedGenres={editingSelectedGenres}
                        setEditingSelectedGenres={setEditingSelectedGenres}
                        selectedContent={selectedContent}
                        setSelectedContent={setSelectedContent}
                        selectedGenres={selectedGenres}
                        setSelectedGenres={setSelectedGenres}
                        setShowContentSelector={setShowContentSelector}
                    />
                ))}
            </div>

            {filteredWidgets.length === 0 && (
                <div className="text-center py-12">
                    <Layout className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                    <p className="text-gray-400">No widgets configured for this page</p>
                    <p className="text-gray-500 text-sm">Add a widget to get started</p>
                </div>
            )}

            {/* Content Selector Modal */}
            <AnimatePresence>
                {showContentSelector && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4"
                        onClick={() => setShowContentSelector(false)}
                    >
                        {/* Backdrop */}
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

                        {/* Modal */}
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="relative w-full max-w-4xl bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-h-[90vh] overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between p-6 border-b border-gray-700">
                                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                                    <Filter className="w-5 h-5 text-blue-400" />
                                    Select Content & Genres
                                </h2>
                                <button
                                    onClick={() => setShowContentSelector(false)}
                                    className="text-gray-400 hover:text-white transition-colors p-1"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Tabs */}
                            <div className="flex border-b border-gray-700">
                                <button
                                    onClick={() => setContentSelectionMode('search')}
                                    className={`px-6 py-3 text-sm font-medium transition-colors ${
                                        contentSelectionMode === 'search' 
                                            ? 'text-blue-400 border-b-2 border-blue-400' 
                                            : 'text-gray-400 hover:text-white'
                                    }`}
                                >
                                    Search TMDB
                                </button>
                                <button
                                    onClick={() => setContentSelectionMode('genres')}
                                    className={`px-6 py-3 text-sm font-medium transition-colors ${
                                        contentSelectionMode === 'genres' 
                                            ? 'text-blue-400 border-b-2 border-blue-400' 
                                            : 'text-gray-400 hover:text-white'
                                    }`}
                                >
                                    Browse by Genre
                                </button>
                                <button
                                    onClick={() => {
                                        setContentSelectionMode('featured');
                                        fetchFeaturedContent();
                                    }}
                                    className={`px-6 py-3 text-sm font-medium transition-colors ${
                                        contentSelectionMode === 'featured' 
                                            ? 'text-blue-400 border-b-2 border-blue-400' 
                                            : 'text-gray-400 hover:text-white'
                                    }`}
                                >
                                    Featured & Trending
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto max-h-[60vh]">
                                {/* Search Tab */}
                                {contentSelectionMode === 'search' && (
                                    <div className="p-6">
                                        <div className="relative mb-4">
                                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input
                                                type="text"
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                placeholder="Search for movies & TV shows..."
                                                className="w-full bg-gray-800 border border-gray-600 rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-400 focus:border-blue-400 focus:outline-none transition-colors"
                                            />
                                            {isSearching && (
                                                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                                    <div className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full"></div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Search Results */}
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                            {searchResults.map((item) => (
                                                <ContentCard
                                                    key={`${item.media_type}-${item.id}`}
                                                    item={item}
                                                    isSelected={selectedContent.some(c => c.id === item.id && c.media_type === item.media_type)}
                                                    onToggle={() => {
                                                        setSelectedContent(prev => {
                                                            const exists = prev.some(c => c.id === item.id && c.media_type === item.media_type);
                                                            if (exists) {
                                                                return prev.filter(c => !(c.id === item.id && c.media_type === item.media_type));
                                                            } else {
                                                                return [...prev, item];
                                                            }
                                                        });
                                                    }}
                                                />
                                            ))}
                                        </div>

                                        {searchQuery.trim() && !isSearching && searchResults.length === 0 && (
                                            <div className="text-center py-8 text-gray-400">
                                                <Search className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                                                <p>No results found for "{searchQuery}"</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Genres Tab */}
                                {contentSelectionMode === 'genres' && (
                                    <div className="p-6">
                                        <div className="mb-6">
                                            <h3 className="text-sm font-medium text-gray-300 mb-3">Select Genres</h3>
                                            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                                                {genres.map((genre) => (
                                                    <button
                                                        key={genre.id}
                                                        onClick={() => {
                                                            setSelectedGenres(prev => 
                                                                prev.includes(genre.id) 
                                                                    ? prev.filter(id => id !== genre.id)
                                                                    : [...prev, genre.id]
                                                            );
                                                        }}
                                                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                                            selectedGenres.includes(genre.id)
                                                                ? 'bg-blue-600 text-white'
                                                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                                        }`}
                                                    >
                                                        {genre.name}
                                                    </button>
                                                ))}
                                            </div>
                                            {selectedGenres.length > 0 && (
                                                <button
                                                    onClick={() => setSelectedGenres([])}
                                                    className="text-xs text-gray-400 hover:text-gray-300 transition-colors mt-2"
                                                >
                                                    Clear all genres
                                                </button>
                                            )}
                                        </div>

                                        {/* Filtered Content */}
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                            {getFilteredByGenres().map((item) => (
                                                <ContentCard
                                                    key={`${item.media_type}-${item.id}`}
                                                    item={item}
                                                    isSelected={selectedContent.some(c => c.id === item.id && c.media_type === item.media_type)}
                                                    onToggle={() => {
                                                        setSelectedContent(prev => {
                                                            const exists = prev.some(c => c.id === item.id && c.media_type === item.media_type);
                                                            if (exists) {
                                                                return prev.filter(c => !(c.id === item.id && c.media_type === item.media_type));
                                                            } else {
                                                                return [...prev, item];
                                                            }
                                                        });
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Featured Tab */}
                                {contentSelectionMode === 'featured' && (
                                    <div className="p-6">
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                            {featuredContent.map((item) => (
                                                <ContentCard
                                                    key={`${item.media_type}-${item.id}`}
                                                    item={item}
                                                    isSelected={selectedContent.some(c => c.id === item.id && c.media_type === item.media_type)}
                                                    onToggle={() => {
                                                        setSelectedContent(prev => {
                                                            const exists = prev.some(c => c.id === item.id && c.media_type === item.media_type);
                                                            if (exists) {
                                                                return prev.filter(c => !(c.id === item.id && c.media_type === item.media_type));
                                                            } else {
                                                                return [...prev, item];
                                                            }
                                                        });
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="p-6 border-t border-gray-700 flex items-center justify-between">
                                <div className="text-sm text-gray-400">
                                    {selectedContent.length} items selected
                                    {selectedGenres.length > 0 && `, ${selectedGenres.length} genres filtered`}
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => {
                                            setSelectedContent([]);
                                            setSelectedGenres([]);
                                        }}
                                        className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600"
                                    >
                                        Clear All
                                    </button>
                                    <button
                                        onClick={() => {
                                            // If we're editing a widget, save to editing state
                                            if (editingWidget !== null) {
                                                setEditingSelectedContent(selectedContent);
                                                setEditingSelectedGenres(selectedGenres);
                                            }
                                            setShowContentSelector(false);
                                        }}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500"
                                    >
                                        Apply Selection
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// Content Card Component
interface ContentCardProps {
    item: TMDBSearchResult;
    isSelected: boolean;
    onToggle: () => void;
}

function ContentCard({ item, isSelected, onToggle }: ContentCardProps) {
    const getPosterUrl = (posterPath: string) => {
        if (!posterPath) return '/placeholder-poster.jpg';
        return `https://image.tmdb.org/t/p/w185${posterPath}`;
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        const year = new Date(dateString).getFullYear();
        return year ? `(${year})` : '';
    };

    return (
        <div
            className={`relative cursor-pointer rounded-lg overflow-hidden transition-all ${
                isSelected ? 'ring-2 ring-blue-400 bg-blue-400/10' : 'hover:bg-gray-800'
            }`}
            onClick={onToggle}
        >
            <div className="aspect-[2/3] relative">
                <img
                    src={getPosterUrl(item.poster_path)}
                    alt={item.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = '/placeholder-poster.jpg';
                    }}
                />
                
                {/* Selection overlay */}
                {isSelected && (
                    <div className="absolute inset-0 bg-blue-400/20 flex items-center justify-center">
                        <div className="w-8 h-8 bg-blue-400 rounded-full flex items-center justify-center">
                            <Check className="w-5 h-5 text-white" />
                        </div>
                    </div>
                )}

                {/* Media type badge */}
                <div className="absolute top-2 left-2">
                    {item.media_type === 'movie' ? (
                        <Film className="w-4 h-4 text-blue-400" />
                    ) : (
                        <Tv className="w-4 h-4 text-green-400" />
                    )}
                </div>

                {/* Rating */}
                {item.vote_average > 0 && (
                    <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 bg-black/70 rounded text-xs">
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-white">{item.vote_average.toFixed(1)}</span>
                    </div>
                )}
            </div>

            <div className="p-3">
                <h4 className="text-sm font-medium text-white line-clamp-2 mb-1">
                    {item.title}
                </h4>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Calendar className="w-3 h-3" />
                    <span>{formatDate(item.release_date)}</span>
                    <span>•</span>
                    <span className="capitalize">{item.media_type}</span>
                </div>
            </div>
        </div>
    );
}

interface WidgetCardProps {
    widget: Widget;
    widgetMeta: WidgetMeta | null;
    isEditing: boolean;
    onEdit: () => void;
    onSave: (updates: Partial<Widget>) => void;
    onCancel: () => void;
    onDelete: () => void;
    onToggle: (enabled: boolean) => void;
    onDuplicate: () => void;
    saveStatus: 'idle' | 'saving' | 'saved' | 'error';
    editingSelectedContent: TMDBSearchResult[];
    setEditingSelectedContent: (content: TMDBSearchResult[]) => void;
    editingSelectedGenres: number[];
    setEditingSelectedGenres: (genres: number[]) => void;
    selectedContent: TMDBSearchResult[];
    setSelectedContent: (content: TMDBSearchResult[]) => void;
    selectedGenres: number[];
    setSelectedGenres: (genres: number[]) => void;
    setShowContentSelector: (show: boolean) => void;
}

function WidgetCard({ 
    widget, 
    widgetMeta, 
    isEditing, 
    onEdit, 
    onSave, 
    onCancel, 
    onDelete, 
    onToggle, 
    onDuplicate, 
    saveStatus,
    editingSelectedContent,
    setEditingSelectedContent,
    editingSelectedGenres,
    setEditingSelectedGenres,
    selectedContent,
    setSelectedContent,
    selectedGenres,
    setSelectedGenres,
    setShowContentSelector
}: WidgetCardProps) {
    const [editForm, setEditForm] = useState<Partial<Widget>>(widget);

    useEffect(() => {
        if (isEditing) {
            setEditForm(widget);
            console.log('Widget editing mode activated for:', widget.name);
        } else {
            // Reset form when not editing
            setEditForm(widget);
        }
    }, [isEditing, widget]);

    const handleSave = () => {
        // Parse existing config and add selected content/genres
        let config: any = {};
        try {
            config = JSON.parse(editForm.config || '{}');
        } catch (e) {
            config = {};
        }

        // Add selected content and genres to config
        if (editingSelectedContent.length > 0) {
            config.selectedContent = editingSelectedContent;
        }
        if (editingSelectedGenres.length > 0) {
            config.selectedGenres = editingSelectedGenres;
            // Also add genreFilter for backend compatibility
            const genreNames = editingSelectedGenres.map(id => {
                // You'll need to get genres from parent component or fetch them
                // For now, we'll use a basic mapping
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
                return genreMap[id] || '';
            }).filter(name => name);
            config.genreFilter = genreNames;
        }
        
        onSave({
            ...editForm,
            config: JSON.stringify(config)
        });
    };

    if (isEditing) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-gray-800 rounded-lg p-4 border border-gray-700"
            >
                <h3 className="text-lg font-semibold text-white mb-4">Edit Widget</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Name</label>
                        <input
                            type="text"
                            value={editForm.name || ''}
                            onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Type</label>
                        <select
                            value={editForm.type || 'movie-grid'}
                            onChange={(e) => setEditForm(prev => ({ ...prev, type: e.target.value as WidgetType }))}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                        >
                            {widgetMeta?.types?.map((type: any) => (
                                <option key={type.type} value={type.type}>{type.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Data Source</label>
                        <select
                            value={editForm.dataSource || 'tmdb'}
                            onChange={(e) => setEditForm(prev => ({ ...prev, dataSource: e.target.value as DataSourceType }))}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                        >
                            <option value="tmdb">TMDB</option>
                            <option value="local">Local</option>
                            <option value="popular">Popular</option>
                            <option value="trending">Trending</option>
                            <option value="now-playing">Now Playing</option>
                            <option value="upcoming">Upcoming</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Content Type</label>
                        <select
                            value={editForm.contentType || 'mixed'}
                            onChange={(e) => setEditForm(prev => ({ ...prev, contentType: e.target.value as ContentType }))}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                        >
                            <option value="mixed">Mixed</option>
                            <option value="movies">Movies</option>
                            <option value="tv-shows">TV Shows</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Layout</label>
                        <select
                            value={editForm.layout || 'full'}
                            onChange={(e) => setEditForm(prev => ({ ...prev, layout: e.target.value as LayoutType }))}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                        >
                            {widgetMeta?.layouts?.map((layout: any) => (
                                <option key={layout.layout} value={layout.layout}>{layout.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Max Items</label>
                        <input
                            type="number"
                            value={editForm.maxItems || 10}
                            onChange={(e) => setEditForm(prev => ({ ...prev, maxItems: parseInt(e.target.value) }))}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                            min="1"
                            max="50"
                        />
                    </div>
                </div>
                
                {/* Notification Widget Settings for Edit Form */}
                {editForm.type === 'notifications' && (
                    <div className="mt-4 p-4 bg-gray-700 rounded-lg">
                        <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                            Notification Widget Settings
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Display Style</label>
                                <select
                                    value={JSON.parse(editForm.config || '{}').highlightStyle || 'banner'}
                                    onChange={(e) => {
                                        const config = JSON.parse(editForm.config || '{}');
                                        config.highlightStyle = e.target.value;
                                        setEditForm(prev => ({ ...prev, config: JSON.stringify(config) }));
                                    }}
                                    className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-md text-white"
                                >
                                    <option value="banner">Enhanced Banner (Recommended)</option>
                                    <option value="card">Card List</option>
                                    <option value="minimal">Minimal List</option>
                                </select>
                                <p className="text-xs text-gray-400 mt-1">Banner style provides cinematic experience with trailers</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Auto Scroll</label>
                                <select
                                    value={JSON.parse(editForm.config || '{}').autoScroll !== false ? 'true' : 'false'}
                                    onChange={(e) => {
                                        const config = JSON.parse(editForm.config || '{}');
                                        config.autoScroll = e.target.value === 'true';
                                        setEditForm(prev => ({ ...prev, config: JSON.stringify(config) }));
                                    }}
                                    className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-md text-white"
                                >
                                    <option value="true">Enabled (10s intervals)</option>
                                    <option value="false">Disabled</option>
                                </select>
                                <p className="text-xs text-gray-400 mt-1">Automatically cycle through notifications</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Show Timestamps</label>
                                <select
                                    value={JSON.parse(editForm.config || '{}').showTimestamp !== false ? 'true' : 'false'}
                                    onChange={(e) => {
                                        const config = JSON.parse(editForm.config || '{}');
                                        config.showTimestamp = e.target.value === 'true';
                                        setEditForm(prev => ({ ...prev, config: JSON.stringify(config) }));
                                    }}
                                    className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-md text-white"
                                >
                                    <option value="true">Show (e.g., "2h ago")</option>
                                    <option value="false">Hide</option>
                                </select>
                                <p className="text-xs text-gray-400 mt-1">Display when notification was created</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Show Icons</label>
                                <select
                                    value={JSON.parse(editForm.config || '{}').showNotificationIcon !== false ? 'true' : 'false'}
                                    onChange={(e) => {
                                        const config = JSON.parse(editForm.config || '{}');
                                        config.showNotificationIcon = e.target.value === 'true';
                                        setEditForm(prev => ({ ...prev, config: JSON.stringify(config) }));
                                    }}
                                    className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-md text-white"
                                >
                                    <option value="true">Show Type Icons</option>
                                    <option value="false">Hide Icons</option>
                                </select>
                                <p className="text-xs text-gray-400 mt-1">Display notification type icons</p>
                            </div>
                        </div>
                        <div className="mt-4">
                            <label className="block text-sm font-medium text-gray-300 mb-2">Notification Types</label>
                            <div className="grid grid-cols-1 gap-2">
                                {NOTIFICATION_TYPES.map((type) => {
                                    const config = JSON.parse(editForm.config || '{}');
                                    const notificationTypes = config.notificationTypes || [];
                                    const isChecked = notificationTypes.includes(type.value);
                                    
                                    return (
                                        <div key={type.value} className="group">
                                            <label className="flex items-start space-x-3 text-sm p-3 rounded-lg hover:bg-gray-600 transition-colors cursor-pointer border border-gray-600 hover:border-gray-500">
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={(e) => {
                                                        const config = JSON.parse(editForm.config || '{}');
                                                        let notificationTypes = config.notificationTypes || [];
                                                        
                                                        if (e.target.checked) {
                                                            notificationTypes = [...notificationTypes, type.value];
                                                        } else {
                                                            notificationTypes = notificationTypes.filter((t: string) => t !== type.value);
                                                        }
                                                        
                                                        config.notificationTypes = notificationTypes;
                                                        setEditForm(prev => ({ ...prev, config: JSON.stringify(config) }));
                                                    }}
                                                    className="mt-0.5 rounded border-gray-500 bg-gray-600 text-red-600 focus:ring-red-500"
                                                />
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-gray-300 font-medium">{type.label}</span>
                                                        <span className="px-2 py-0.5 bg-gray-600 text-gray-300 text-xs rounded-full">
                                                            {type.category}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-gray-400 mt-0.5">{type.description}</p>
                                                </div>
                                            </label>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="mt-3 p-3 bg-gray-600 rounded-lg">
                                <p className="text-xs text-gray-300 mb-2">
                                    💡 <strong>Configuration Tips:</strong>
                                </p>
                                <ul className="text-xs text-gray-400 space-y-1">
                                    <li>• Leave empty to show all notification types</li>
                                    <li>• Select specific types to filter content</li>
                                    <li>• TMDB types require API key configuration</li>
                                    <li>• Library types show local content updates</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                )}
                
                {/* Content Selection Button for Edit Form */}
                {(editForm.dataSource === 'tmdb' || editForm.dataSource === 'local') && editForm.type !== 'notifications' && (
                    <div className="mt-4">
                        <button
                            type="button"
                            onClick={() => {
                                // Set the current editing state to the modal state
                                setSelectedContent(editingSelectedContent);
                                setSelectedGenres(editingSelectedGenres);
                                setShowContentSelector(true);
                            }}
                            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500"
                        >
                            <Search className="w-4 h-4 mr-2" />
                            Select Content & Genres
                        </button>
                        {(editingSelectedContent.length > 0 || editingSelectedGenres.length > 0) && (
                            <p className="text-sm text-gray-400 mt-2">
                                {editingSelectedContent.length} items, {editingSelectedGenres.length} genres selected
                            </p>
                        )}
                    </div>
                )}
                
                <div className="flex justify-end space-x-2 mt-4">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saveStatus === 'saving'}
                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-500 disabled:opacity-50"
                    >
                        {saveStatus === 'saving' ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            layout
            className={`bg-gray-800 rounded-lg p-4 border ${
                widget.enabled ? 'border-gray-700' : 'border-gray-600 opacity-60'
            }`}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <GripVertical className="w-5 h-5 text-gray-500 cursor-move" />
                    <div>
                        <h3 className="text-lg font-semibold text-white">{widget.name}</h3>
                        <div className="flex items-center space-x-2 text-sm text-gray-400">
                            <span className="bg-gray-700 px-2 py-1 rounded">{widget.type}</span>
                            {widget.type !== 'notifications' && (
                                <>
                                    <span className="bg-blue-600 px-2 py-1 rounded">{widget.dataSource}</span>
                                    <span className="bg-green-600 px-2 py-1 rounded">{widget.contentType}</span>
                                </>
                            )}
                            <span className="bg-purple-600 px-2 py-1 rounded">{widget.layout}</span>
                            {widget.type === 'notifications' && (
                                <span className="bg-red-600 px-2 py-1 rounded">Live Updates</span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center space-x-2">
                    <button
                        onClick={() => onToggle(!widget.enabled)}
                        className={`p-2 rounded-md ${
                            widget.enabled ? 'text-green-400 hover:bg-green-400/10' : 'text-gray-500 hover:bg-gray-700'
                        }`}
                    >
                        {widget.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <button
                        onClick={onEdit}
                        className="p-2 text-blue-400 hover:bg-blue-400/10 rounded-md"
                    >
                        <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={onDuplicate}
                        className="p-2 text-yellow-400 hover:bg-yellow-400/10 rounded-md"
                    >
                        <Settings2 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={onDelete}
                        className="p-2 text-red-400 hover:bg-red-400/10 rounded-md"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </motion.div>
    );
}