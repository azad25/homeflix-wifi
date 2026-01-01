"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, Play, Star, ChevronLeft, ChevronRight, Plus, Check, Info, Calendar, Clock } from 'lucide-react';
import { Media } from '@/types/media';
import { getApiUrl, preloadAssets } from '@/lib/api';
import { useNavigate } from '@/hooks/useNavigate';
import { getColorPaletteByGenre } from '@/types/widgets';

interface TrendingSlideshowProps {
    media: Media[];
    title?: string;
    autoScroll?: boolean;
    scrollInterval?: number;
    maxItems?: number;
    className?: string;
}

export default function TrendingSlideshow({
    media,
    title = 'Trending Now',
    autoScroll = true,
    scrollInterval = 5,
    maxItems = 20,
    className = '',
}: TrendingSlideshowProps) {
    const navigate = useNavigate();
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(true);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [isInMyList, setIsInMyList] = useState<Record<number, boolean>>({});

    const apiUrl = getApiUrl();
    const displayMedia = media.slice(0, maxItems);

    // Check scroll position
    const updateScrollButtons = () => {
        const container = scrollContainerRef.current;
        if (container) {
            setCanScrollLeft(container.scrollLeft > 0);
            setCanScrollRight(container.scrollLeft < container.scrollWidth - container.clientWidth - 10);
        }
    };

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (container) {
            container.addEventListener('scroll', updateScrollButtons);
            updateScrollButtons();
            return () => container.removeEventListener('scroll', updateScrollButtons);
        }
    }, []);

    // Preload assets
    useEffect(() => {
        preloadAssets(displayMedia.slice(0, 10), ['thumbnail', 'poster']);
    }, [displayMedia]);

    const scroll = (direction: 'left' | 'right') => {
        const container = scrollContainerRef.current;
        if (container) {
            const scrollAmount = container.clientWidth * 0.8;
            container.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth',
            });
        }
    };

    const handleCardClick = (item: Media) => {
        // Check if it's TMDB content (has tmdb_id) or local content
        if (item.tmdb_id) {
            // Navigate to TMDB movie page with proper media type detection
            const mediaType = item.type === 'tv' || item.type === 'series' || item.type === 'episode' ? 'tv' : 'movie';
            navigate.push(`/tmdb-movie/${item.tmdb_id}?type=${mediaType}`);
        } else {
            // Navigate to local movie page
            if (item.type === 'episode' || item.type === 'tv' || item.type === 'series') {
                const seriesId = item.series_id || item.id;
                navigate.push(`/tv-series/${seriesId}`);
            } else {
                navigate.push(`/movie/${item.id}`);
            }
        }
    };

    const toggleMyList = (mediaId: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setIsInMyList(prev => ({
            ...prev,
            [mediaId]: !prev[mediaId]
        }));
    };

    const getImageUrl = (item: Media, type: 'poster' | 'backdrop' = 'poster') => {
        if (type === 'poster') {
            // Priority: TMDB poster > local poster > thumbnail fallback
            if (item.tmdb_poster_url) return item.tmdb_poster_url;
            if (item.poster_url) return item.poster_url;
            if (item.poster_path) {
                const filename = item.poster_path.includes('/') ? item.poster_path.split('/').pop() : item.poster_path;
                return `${apiUrl}/api/posters/${filename}`;
            }
            return `${apiUrl}/api/posters/${item.id}`;
        } else {
            // Priority: TMDB backdrop > local banner > thumbnail fallback
            if (item.tmdb_backdrop_url) return item.tmdb_backdrop_url;
            if (item.banner_path) {
                const filename = item.banner_path.includes('/') ? item.banner_path.split('/').pop() : item.banner_path;
                return `${apiUrl}/api/admin/assets/${filename}`;
            }
            return `${apiUrl}/api/thumbnails/${item.id}`;
        }
    };

    const getLogoUrl = (item: Media) => {
        // Priority: TMDB logo > local logo
        if (item.tmdb_id) {
            // For TMDB content, we'll fetch the logo from TMDB images API
            // This would need to be implemented as a separate API call
            // For now, fall back to local logo handling
        }
        
        if (item.logo_path) {
            // Check if logo_path is already a full URL (TMDB logo)
            if (item.logo_path.startsWith('http')) {
                return item.logo_path;
            }
            // Handle local logo paths - could be relative or absolute
            if (item.logo_path.startsWith('/api/')) {
                return `${apiUrl}${item.logo_path}`;
            }
            // For simple filenames or relative paths
            const filename = item.logo_path.includes('/') ? item.logo_path.split('/').pop() : item.logo_path;
            return `${apiUrl}/api/logos/${filename}`;
        }
        return null;
    };

    if (!displayMedia.length) return null;

    return (
        <div className={`relative py-6 ${className}`}>
            {/* Enhanced Header */}
            <div className="flex items-center justify-between px-4 md:px-8 mb-6">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-red-500/20 to-red-600/20 backdrop-blur-sm border border-red-400/30 rounded-xl flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-red-300" />
                        </div>
                        <div>
                            <h2 className="text-xl md:text-2xl font-bold text-white">{title}</h2>
                            <div className="flex items-center gap-2 mt-1">
                                <div className="px-2 py-1 bg-red-500/20 backdrop-blur-sm border border-red-400/30 rounded-full">
                                    <span className="text-red-300 text-xs font-semibold uppercase tracking-wider">
                                        Top {displayMedia.length}
                                    </span>
                                </div>
                                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Enhanced Navigation */}
                <div className="flex items-center gap-2">
                    <motion.button
                        onClick={() => scroll('left')}
                        disabled={!canScrollLeft}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        className={`p-3 rounded-full backdrop-blur-md border transition-all ${
                            !canScrollLeft 
                                ? 'opacity-30 cursor-not-allowed bg-white/5 border-white/10' 
                                : 'bg-white/10 hover:bg-white/20 border-white/20 hover:border-white/30'
                        }`}
                    >
                        <ChevronLeft className="w-5 h-5 text-white" />
                    </motion.button>
                    <motion.button
                        onClick={() => scroll('right')}
                        disabled={!canScrollRight}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        className={`p-3 rounded-full backdrop-blur-md border transition-all ${
                            !canScrollRight 
                                ? 'opacity-30 cursor-not-allowed bg-white/5 border-white/10' 
                                : 'bg-white/10 hover:bg-white/20 border-white/20 hover:border-white/30'
                        }`}
                    >
                        <ChevronRight className="w-5 h-5 text-white" />
                    </motion.button>
                </div>
            </div>

            {/* Enhanced Scrollable Container */}
            <div
                ref={scrollContainerRef}
                className="flex gap-4 overflow-x-auto scrollbar-hide px-4 md:px-8 pb-6"
                style={{ scrollSnapType: 'x mandatory' }}
            >
                {displayMedia.map((item, index) => {
                    const colors = getColorPaletteByGenre(item.genre_names || []);
                    const logoUrl = getLogoUrl(item);
                    
                    return (
                        <motion.div
                            key={item.id}
                            className="flex-shrink-0 relative group cursor-pointer"
                            style={{ scrollSnapAlign: 'start' }}
                            onMouseEnter={() => setHoveredIndex(index)}
                            onMouseLeave={() => setHoveredIndex(null)}
                            onClick={() => handleCardClick(item)}
                            whileHover={{ scale: 1.05, zIndex: 20 }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                        >
                            {/* Enhanced Ranking Number */}
                            <div className="absolute -left-6 bottom-0 z-10">
                                <div className="relative">
                                    <span
                                        className="text-6xl md:text-7xl font-black leading-none"
                                        style={{
                                            WebkitTextStroke: '3px rgba(0,0,0,0.8)',
                                            WebkitTextFillColor: 'transparent',
                                            fontFamily: 'system-ui, -apple-system, sans-serif',
                                            filter: 'drop-shadow(0 0 10px rgba(0,0,0,0.5))'
                                        }}
                                    >
                                        {index + 1}
                                    </span>
                                    <div 
                                        className="absolute inset-0 text-6xl md:text-7xl font-black leading-none opacity-20"
                                        style={{
                                            background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.accent} 100%)`,
                                            WebkitBackgroundClip: 'text',
                                            WebkitTextFillColor: 'transparent',
                                            backgroundClip: 'text'
                                        }}
                                    >
                                        {index + 1}
                                    </div>
                                </div>
                            </div>

                            {/* Enhanced Card */}
                            <div className="relative w-36 md:w-44 h-52 md:h-64 ml-8">
                                {/* Main Image */}
                                <div className="relative w-full h-full rounded-xl overflow-hidden shadow-2xl">
                                    <img
                                        src={getImageUrl(item, 'poster')}
                                        alt={item.title}
                                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                                        loading="lazy"
                                        onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            const currentSrc = target.src;
                                            
                                            // Try fallback sequence: poster -> backdrop -> thumbnail
                                            if (currentSrc.includes('tmdb') || currentSrc.includes('posters')) {
                                                if (item.tmdb_backdrop_url && !currentSrc.includes('backdrop')) {
                                                    target.src = item.tmdb_backdrop_url;
                                                } else if (!currentSrc.includes('thumbnails')) {
                                                    target.src = `${apiUrl}/api/thumbnails/${item.id}`;
                                                }
                                            }
                                        }}
                                    />
                                    
                                    {/* Gradient Overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                    
                                    {/* Quality Badge */}
                                    <div className="absolute top-3 right-3">
                                        <div className="px-2 py-1 bg-black/80 backdrop-blur-sm rounded text-xs font-bold text-white border border-white/20">
                                            HD
                                        </div>
                                    </div>

                                    {/* Rating Badge */}
                                    {item.rating && item.rating > 0 && (
                                        <div className="absolute top-3 left-3">
                                            <div 
                                                className="flex items-center gap-1 px-2 py-1 rounded-full backdrop-blur-md border"
                                                style={{
                                                    backgroundColor: `${colors.primary}30`,
                                                    borderColor: `${colors.primary}50`
                                                }}
                                            >
                                                <Star className="w-3 h-3 text-yellow-400 fill-current" />
                                                <span className="text-xs font-semibold text-white">
                                                    {item.rating.toFixed(1)}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Enhanced Hover Content */}
                                <AnimatePresence>
                                    {hoveredIndex === index && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 20 }}
                                            transition={{ duration: 0.2 }}
                                            className="absolute inset-0 flex flex-col justify-end p-4"
                                        >
                                            {/* Logo or Title */}
                                            <div className="mb-3">
                                                {logoUrl ? (
                                                    <img
                                                        src={logoUrl}
                                                        alt={`${item.title} logo`}
                                                        className="max-h-8 w-auto drop-shadow-lg"
                                                        onError={(e) => {
                                                            const target = e.target as HTMLImageElement;
                                                            target.style.display = 'none';
                                                            const fallback = target.nextElementSibling as HTMLElement;
                                                            if (fallback && fallback.tagName === 'H3') {
                                                                fallback.style.display = 'block';
                                                            }
                                                        }}
                                                    />
                                                ) : null}
                                                <h3 
                                                    className="text-sm font-bold line-clamp-2 text-white drop-shadow-lg"
                                                    style={{ display: logoUrl ? 'none' : 'block' }}
                                                >
                                                    {item.title}
                                                </h3>
                                            </div>

                                            {/* Meta Info */}
                                            <div className="flex items-center gap-2 text-xs text-white/80 mb-3">
                                                {(item.year || item.release_date) && (
                                                    <span className="flex items-center gap-1">
                                                        <Calendar className="w-3 h-3" />
                                                        {item.year || new Date(item.release_date!).getFullYear()}
                                                    </span>
                                                )}
                                                {(item.duration || item.runtime) && (
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {Math.floor((item.duration || item.runtime!) / 3600)}h {Math.floor(((item.duration || item.runtime!) % 3600) / 60)}m
                                                    </span>
                                                )}
                                            </div>

                                            {/* Genres */}
                                            {(item.genre_names || item.genres) && (item.genre_names || item.genres)!.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mb-3">
                                                    {(item.genre_names || item.genres?.map(g => g.name) || []).slice(0, 2).map((genre, idx) => (
                                                        <span
                                                            key={idx}
                                                            className="px-2 py-1 rounded-full text-xs font-medium backdrop-blur-sm border"
                                                            style={{
                                                                backgroundColor: `${colors.primary}20`,
                                                                borderColor: `${colors.primary}40`,
                                                                color: colors.accent
                                                            }}
                                                        >
                                                            {genre}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Action Buttons */}
                                            <div className="flex items-center gap-2">
                                                <motion.button 
                                                    whileHover={{ scale: 1.05 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleCardClick(item);
                                                    }}
                                                    className="flex-1 flex items-center justify-center gap-1 py-2 bg-white text-black rounded-lg text-xs font-bold hover:bg-white/90 transition-colors"
                                                >
                                                    <Play className="w-3 h-3 fill-current" />
                                                    {item.tmdb_id ? 'View' : 'Play'}
                                                </motion.button>
                                                
                                                <motion.button
                                                    whileHover={{ scale: 1.1 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={(e) => toggleMyList(item.id, e)}
                                                    className="p-2 rounded-full backdrop-blur-md border border-white/30 hover:border-white/50 transition-colors"
                                                    style={{
                                                        backgroundColor: isInMyList[item.id] ? `${colors.primary}40` : 'rgba(255,255,255,0.1)'
                                                    }}
                                                >
                                                    {isInMyList[item.id] ? 
                                                        <Check className="w-3 h-3 text-white" /> : 
                                                        <Plus className="w-3 h-3 text-white" />
                                                    }
                                                </motion.button>
                                                
                                                <motion.button
                                                    whileHover={{ scale: 1.1 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleCardClick(item);
                                                    }}
                                                    className="p-2 rounded-full backdrop-blur-md border border-white/30 hover:border-white/50 transition-colors bg-white/10"
                                                >
                                                    <Info className="w-3 h-3 text-white" />
                                                </motion.button>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* Enhanced Gradient Masks */}
            <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-black via-black/50 to-transparent pointer-events-none z-10" />
            <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-black via-black/50 to-transparent pointer-events-none z-10" />
        </div>
    );
}
