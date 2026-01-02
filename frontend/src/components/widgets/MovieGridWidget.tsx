"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Play, Star, Plus, Check, Info, Calendar, Clock, Grid3X3 } from 'lucide-react';
import { Media } from '@/types/media';
import { getApiUrl, preloadAssets } from '@/lib/api';
import { getColorPaletteByGenre } from '@/types/widgets';
import { useNavigate } from '@/hooks/useNavigate';

interface MovieGridWidgetProps {
    media: Media[];
    title: string;
    subtitle?: string;
    maxItems?: number;
    columns?: 4 | 5 | 6 | 8;
    showRating?: boolean;
    className?: string;
}

export default function MovieGridWidget({
    media,
    title,
    subtitle,
    maxItems = 20,
    columns = 5,
    showRating = true,
    className = '',
}: MovieGridWidgetProps) {
    const navigate = useNavigate();
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(true);
    const [hoveredId, setHoveredId] = useState<number | null>(null);
    const [myList, setMyList] = useState<Set<number>>(new Set());

    const apiUrl = getApiUrl();
    const displayMedia = media.slice(0, maxItems);

    useEffect(() => {
        preloadAssets(displayMedia.slice(0, 10), ['poster']);
    }, [displayMedia]);

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

    const toggleMyList = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        setMyList(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };

    const handleCardClick = (item: Media) => {
        // Check if it's TMDB content (has tmdb_id) or local content
        if (item.tmdb_id) {
            // Navigate to TMDB movie page with proper media type detection
            const mediaType = item.type === 'tv' || item.type === 'series' || item.type === 'episode' ? 'tv' : 'movie';
            navigate.push(`/tmdb-movie/${item.tmdb_id}?type=${mediaType}`);
        } else {
            // Navigate to local content pages
            if (item.type === 'episode' || item.type === 'tv' || item.type === 'series') {
                const seriesId = item.series_id || item.id;
                navigate.push(`/tv-series/${seriesId}`);
            } else {
                // Local movie - navigate to local movie page
                navigate.push(`/movie/${item.id}`);
            }
        }
    };

    const getImageUrl = (item: Media, type: 'poster' | 'backdrop' = 'poster') => {
        if (type === 'poster') {
            return item.tmdb_poster_url || `${apiUrl}/api/posters/${item.id}`;
        } else {
            return item.tmdb_backdrop_url || `${apiUrl}/api/thumbnails/${item.id}`;
        }
    };

    const getLogoUrl = (item: Media) => {
        if (item.logo_path) {
            return `${apiUrl}/api/${item.logo_path}`;
        }
        return null;
    };

    if (!displayMedia.length) return null;

    return (
        <div className={`relative w-full py-6 ${className}`}>
            {/* Enhanced Header */}
            <div className="flex items-center justify-between px-4 md:px-8 mb-6">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-red-500/20 to-red-600/20 backdrop-blur-sm border border-red-400/30 rounded-xl flex items-center justify-center">
                        <Grid3X3 className="w-5 h-5 text-red-300" />
                    </div>
                    <div>
                        <h2 className="text-xl md:text-2xl font-bold text-white">{title}</h2>
                        {subtitle && (
                            <p className="text-sm text-white/60 mt-1">{subtitle}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                            <div className="px-2 py-1 bg-red-500/20 backdrop-blur-sm border border-red-400/30 rounded-full">
                                <span className="text-red-300 text-xs font-semibold">
                                    {displayMedia.length} Items
                                </span>
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

            {/* Enhanced Grid/Scroll Container */}
            <div
                ref={scrollContainerRef}
                className="flex gap-3 md:gap-4 overflow-x-auto scrollbar-hide px-4 md:px-8 pb-6"
                style={{ scrollSnapType: 'x mandatory' }}
            >
                {displayMedia.map((item) => {
                    const colors = getColorPaletteByGenre(item.genre_names || []);
                    const isHovered = hoveredId === item.id;
                    const inMyList = myList.has(item.id);
                    const logoUrl = getLogoUrl(item);

                    return (
                        <motion.div
                            key={item.id}
                            className="flex-shrink-0 relative group cursor-pointer"
                            style={{ 
                                scrollSnapAlign: 'start',
                                width: `calc((100vw - 8rem) / ${Math.min(columns, 6)})`,
                                minWidth: '140px',
                                maxWidth: '220px',
                            }}
                            onMouseEnter={() => setHoveredId(item.id)}
                            onMouseLeave={() => setHoveredId(null)}
                            onClick={() => handleCardClick(item)}
                            whileHover={{ scale: 1.05, zIndex: 20 }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                        >
                            {/* Enhanced Card */}
                            <div className="relative aspect-[2/3] rounded-xl overflow-hidden shadow-2xl">
                                {/* Main Image */}
                                <img
                                    src={getImageUrl(item, 'poster')}
                                    alt={item.title}
                                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                                    loading="lazy"
                                    onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.src = getImageUrl(item, 'backdrop');
                                    }}
                                />

                                {/* Quality Badge */}
                                <div className="absolute top-3 right-3">
                                    <div className="px-2 py-1 bg-black/80 backdrop-blur-sm rounded text-xs font-bold text-white border border-white/20">
                                        {item.type === 'movie' ? 'HD' : 'TV'}
                                    </div>
                                </div>

                                {/* Rating Badge */}
                                {showRating && item.rating && item.rating > 0 && (
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

                                {/* My List Indicator */}
                                {inMyList && (
                                    <div className="absolute bottom-3 right-3">
                                        <div 
                                            className="p-2 rounded-full backdrop-blur-md border"
                                            style={{
                                                backgroundColor: `${colors.primary}40`,
                                                borderColor: `${colors.primary}60`
                                            }}
                                        >
                                            <Check className="w-3 h-3 text-white" />
                                        </div>
                                    </div>
                                )}

                                {/* Gradient Overlay */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                                {/* Enhanced Hover Content */}
                                <AnimatePresence>
                                    {isHovered && (
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
                                                        alt={item.title}
                                                        className="max-h-6 w-auto drop-shadow-lg"
                                                        onError={(e) => {
                                                            e.currentTarget.style.display = 'none';
                                                            const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                                            if (fallback) fallback.style.display = 'block';
                                                        }}
                                                    />
                                                ) : null}
                                                <h4 
                                                    className="text-sm font-bold line-clamp-2 text-white drop-shadow-lg"
                                                    style={{ display: logoUrl ? 'none' : 'block' }}
                                                >
                                                    {item.title}
                                                </h4>
                                            </div>

                                            {/* Meta Info */}
                                            <div className="flex items-center gap-2 text-xs text-white/80 mb-3">
                                                {item.year && (
                                                    <span className="flex items-center gap-1">
                                                        <Calendar className="w-3 h-3" />
                                                        {item.year}
                                                    </span>
                                                )}
                                                {item.duration && (
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {Math.floor(item.duration / 3600)}h {Math.floor((item.duration % 3600) / 60)}m
                                                    </span>
                                                )}
                                            </div>

                                            {/* Genres */}
                                            {item.genre_names && item.genre_names.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mb-3">
                                                    {item.genre_names.slice(0, 2).map((genre, idx) => (
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
                                                    className="flex-1 flex items-center justify-center gap-1 py-2 bg-white text-black rounded-lg text-xs font-bold hover:bg-white/90 transition-colors"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleCardClick(item);
                                                    }}
                                                >
                                                    <Play className="w-3 h-3 fill-current" />
                                                    {item.tmdb_id ? 'View' : 'Play'}
                                                </motion.button>
                                                
                                                <motion.button
                                                    whileHover={{ scale: 1.1 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={(e) => toggleMyList(e, item.id)}
                                                    className="p-2 rounded-full backdrop-blur-md border border-white/30 hover:border-white/50 transition-colors"
                                                    style={{
                                                        backgroundColor: inMyList ? `${colors.primary}40` : 'rgba(255,255,255,0.1)'
                                                    }}
                                                >
                                                    {inMyList ? 
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

                                {/* Enhanced Border Accent */}
                                <motion.div
                                    className="absolute inset-0 pointer-events-none rounded-xl"
                                    animate={{
                                        boxShadow: isHovered
                                            ? `inset 0 0 0 2px ${colors.primary}, 0 0 30px ${colors.primary}40`
                                            : 'none'
                                    }}
                                    transition={{ duration: 0.3 }}
                                />
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
