"use client";

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Play, Star, Plus, Check, Flame, Sparkles } from 'lucide-react';
import { Media } from '@/types/media';
import { getApiUrl, preloadAssets } from '@/lib/api';
import { getColorPaletteByGenre, DominantColors, genreColorPalettes } from '@/types/widgets';
import { useNavigate } from '@/hooks/useNavigate';

interface GenreBasedWidgetProps {
    media: Media[];
    genre: string;
    title?: string;
    showHotBadge?: boolean;
    maxItems?: number;
    className?: string;
}

// Genre icons mapping
const genreIcons: Record<string, React.ReactNode> = {
    action: <Flame className="w-5 h-5" />,
    comedy: <Sparkles className="w-5 h-5" />,
    drama: <Sparkles className="w-5 h-5" />,
    horror: <Sparkles className="w-5 h-5" />,
    scifi: <Sparkles className="w-5 h-5" />,
    romance: <Sparkles className="w-5 h-5" />,
    thriller: <Sparkles className="w-5 h-5" />,
};

export default function GenreBasedWidget({
    media,
    genre,
    title,
    showHotBadge = true,
    maxItems = 15,
    className = '',
}: GenreBasedWidgetProps) {
    const navigate = useNavigate();
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(true);
    const [hoveredId, setHoveredId] = useState<number | null>(null);
    const [myList, setMyList] = useState<Set<number>>(new Set());

    const apiUrl = getApiUrl();
    const genreLower = genre.toLowerCase();
    const colors = genreColorPalettes[genreLower] || genreColorPalettes.default;
    const displayMedia = media.slice(0, maxItems);

    useEffect(() => {
        preloadAssets(displayMedia.slice(0, 8), ['poster']);
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

    if (!displayMedia.length) return null;

    return (
        <div
            className={`relative py-6 ${className}`}
            style={{
                background: `linear-gradient(90deg, ${colors.primary}15 0%, transparent 50%, ${colors.primary}10 100%)`,
            }}
        >
            {/* Decorative accent line */}
            <div
                className="absolute left-0 top-0 bottom-0 w-1"
                style={{ backgroundColor: colors.primary }}
            />

            {/* Header */}
            <div className="flex items-center justify-between px-4 md:px-12 mb-4">
                <div className="flex items-center gap-3">
                    <div
                        className="p-2 rounded-lg"
                        style={{
                            backgroundColor: `${colors.primary}30`,
                            color: colors.primary,
                        }}
                    >
                        {genreIcons[genreLower] || <Sparkles className="w-5 h-5" />}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl md:text-2xl font-bold text-white">
                                {title || `${genre} Movies`}
                            </h2>
                            {showHotBadge && (
                                <span
                                    className="px-2 py-0.5 text-xs font-bold rounded-full animate-pulse"
                                    style={{
                                        backgroundColor: colors.primary,
                                        color: '#fff',
                                    }}
                                >
                                    HOT
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-white/50">{displayMedia.length} titles</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => scroll('left')}
                        disabled={!canScrollLeft}
                        className={`p-2 rounded-full transition-all ${!canScrollLeft ? 'opacity-30 cursor-not-allowed' : ''
                            }`}
                        style={{
                            backgroundColor: canScrollLeft ? `${colors.primary}30` : 'rgba(255,255,255,0.1)',
                        }}
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => scroll('right')}
                        disabled={!canScrollRight}
                        className={`p-2 rounded-full transition-all ${!canScrollRight ? 'opacity-30 cursor-not-allowed' : ''
                            }`}
                        style={{
                            backgroundColor: canScrollRight ? `${colors.primary}30` : 'rgba(255,255,255,0.1)',
                        }}
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Scrollable content */}
            <div
                ref={scrollContainerRef}
                className="flex gap-3 overflow-x-auto scrollbar-hide px-4 md:px-12 pb-4"
            >
                {displayMedia.map((item, index) => {
                    const isHovered = hoveredId === item.id;
                    const inMyList = myList.has(item.id);

                    return (
                        <motion.div
                            key={item.id}
                            className="flex-shrink-0 relative group cursor-pointer"
                            onMouseEnter={() => setHoveredId(item.id)}
                            onMouseLeave={() => setHoveredId(null)}
                            onClick={() => handleCardClick(item)}
                            whileHover={{ scale: 1.05, y: -5 }}
                            transition={{ duration: 0.2 }}
                            style={{ width: '160px' }}
                        >
                            {/* Poster */}
                            <div
                                className="relative aspect-[2/3] rounded-lg overflow-hidden shadow-lg"
                                style={{
                                    boxShadow: isHovered
                                        ? `0 8px 30px ${colors.primary}40`
                                        : '0 4px 15px rgba(0,0,0,0.3)',
                                }}
                            >
                                <img
                                    src={item.tmdb_poster_url || `${apiUrl}/api/posters/${item.id}`}
                                    alt={item.title}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                    onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.src = `${apiUrl}/api/thumbnails/${item.id}`;
                                    }}
                                />

                                {/* Top badge for first 3 items */}
                                {index < 3 && (
                                    <div
                                        className="absolute top-2 left-2 px-2 py-0.5 rounded text-xs font-bold"
                                        style={{ backgroundColor: colors.primary }}
                                    >
                                        TOP {index + 1}
                                    </div>
                                )}

                                {/* Rating */}
                                {item.rating && item.rating > 0 && (
                                    <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 bg-black/70 rounded text-xs">
                                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                        <span>{item.rating.toFixed(1)}</span>
                                    </div>
                                )}

                                {/* Hover overlay */}
                                <AnimatePresence>
                                    {isHovered && (
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent flex flex-col justify-end p-3"
                                        >
                                            <h4 className="text-sm font-semibold line-clamp-2 mb-1">{item.title}</h4>
                                            <div className="flex items-center gap-2 text-xs text-white/60 mb-2">
                                                {item.year && <span>{item.year}</span>}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-xs font-semibold"
                                                    style={{ backgroundColor: colors.primary }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleCardClick(item);
                                                    }}
                                                >
                                                    <Play className="w-3 h-3 fill-current" />
                                                    {item.tmdb_id ? 'View' : 'Play'}
                                                </button>
                                                <button
                                                    onClick={(e) => toggleMyList(e, item.id)}
                                                    className={`p-1.5 rounded transition-all ${inMyList ? 'bg-white text-black' : 'bg-white/20'
                                                        }`}
                                                >
                                                    {inMyList ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                                                </button>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Border accent */}
                                <div
                                    className="absolute inset-0 pointer-events-none rounded-lg transition-all"
                                    style={{
                                        border: isHovered ? `2px solid ${colors.primary}` : '2px solid transparent',
                                    }}
                                />
                            </div>

                            {/* Title below poster */}
                            <h4 className="text-sm font-medium mt-2 line-clamp-1 text-center text-white/80">
                                {item.title}
                            </h4>
                        </motion.div>
                    );
                })}
            </div>

            {/* Gradient masks */}
            <div
                className="absolute left-0 top-16 bottom-4 w-12 pointer-events-none"
                style={{
                    background: `linear-gradient(90deg, ${colors.primary}20 0%, transparent 100%)`,
                }}
            />
            <div
                className="absolute right-0 top-16 bottom-4 w-12 pointer-events-none"
                style={{
                    background: `linear-gradient(270deg, ${colors.primary}10 0%, transparent 100%)`,
                }}
            />
        </div>
    );
}
