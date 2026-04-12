"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Star, Flame, Sparkles } from 'lucide-react';
import { Media } from '@/types/media';
import { getApiUrl, preloadAssets } from '@/lib/api';
import { genreColorPalettes } from '@/types/widgets';
import { useNavigate } from '@/hooks/useNavigate';

interface GenreBasedWidgetProps {
    media: Media[];
    genre: string;
    title?: string;
    showHotBadge?: boolean;
    maxItems?: number;
    className?: string;
}

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

    const apiUrl = getApiUrl();
    const genreLower = genre.toLowerCase();
    const colors = useMemo(() => genreColorPalettes[genreLower] || genreColorPalettes.default, [genreLower]);
    const displayMedia = useMemo(() => media.slice(0, maxItems), [media, maxItems]);

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

    const handleCardClick = (item: Media) => {
        const isLocal = (item as any).is_local;
        if (isLocal || !item.tmdb_id) {
            if (item.type === 'episode' || item.type === 'tv' || item.type === 'series') {
                const seriesId = item.series_id || item.id;
                navigate.push(`/tv-series/${seriesId}`);
            } else {
                navigate.push(`/movie/${item.id}`);
            }
        } else {
            const mediaType = item.type === 'tv' || item.type === 'series' || item.type === 'episode' ? 'tv' : 'movie';
            navigate.push(`/tmdb-movie/${item.tmdb_id}?type=${mediaType}`);
        }
    };

    if (!displayMedia.length) return null;

    return (
        <div
            className={`relative overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b0b] ${className}`}
            style={{
                backgroundImage: `linear-gradient(140deg, ${colors.primary}24 0%, rgba(0,0,0,0.35) 45%, rgba(0,0,0,0.86) 100%)`,
            }}
        >
            <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: `radial-gradient(circle at 0% 0%, ${colors.primary}30 0%, transparent 50%)` }}
            />
            <div
                className="absolute left-0 top-0 bottom-0 w-1.5"
                style={{ backgroundColor: colors.primary }}
            />

            <div className="relative z-10 pt-6 px-4 md:px-8">
                <div className="flex items-center justify-between gap-4 mb-5">
                    <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center border"
                        style={{
                            backgroundColor: `${colors.primary}26`,
                            borderColor: `${colors.primary}55`,
                            color: '#ffffff',
                        }}
                    >
                        {genreIcons[genreLower] || <Sparkles className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                                {title || genre}
                            </h2>
                            {showHotBadge && (
                                <span
                                    className="px-2.5 py-0.5 text-[10px] font-semibold rounded-full border"
                                    style={{
                                        backgroundColor: `${colors.primary}22`,
                                        borderColor: `${colors.primary}66`,
                                        color: '#ffffff',
                                    }}
                                >
                                    TRENDING
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-white/55 mt-0.5">{displayMedia.length} titles curated for {genre}</p>
                    </div>
                    <div className="hidden md:flex items-center gap-2">
                        <button
                            onClick={() => scroll('left')}
                            disabled={!canScrollLeft}
                            className={`w-9 h-9 rounded-full border backdrop-blur-sm flex items-center justify-center transition-all ${!canScrollLeft ? 'opacity-30 cursor-not-allowed' : 'hover:scale-105'}`}
                            style={{ backgroundColor: `${colors.primary}22`, borderColor: `${colors.primary}55` }}
                        >
                            <ChevronLeft className="w-5 h-5 text-white" />
                        </button>
                        <button
                            onClick={() => scroll('right')}
                            disabled={!canScrollRight}
                            className={`w-9 h-9 rounded-full border backdrop-blur-sm flex items-center justify-center transition-all ${!canScrollRight ? 'opacity-30 cursor-not-allowed' : 'hover:scale-105'}`}
                            style={{ backgroundColor: `${colors.primary}22`, borderColor: `${colors.primary}55` }}
                        >
                            <ChevronRight className="w-5 h-5 text-white" />
                        </button>
                    </div>
                </div>
            </div>

            <div
                ref={scrollContainerRef}
                className="relative z-10 flex gap-4 overflow-x-auto scrollbar-hide px-4 md:px-8 pb-6 pr-8 snap-x snap-mandatory"
            >
                {displayMedia.map((item, index) => {
                    const isHovered = hoveredId === item.id;
                    const rating = item.rating && item.rating > 0 ? item.rating.toFixed(1) : null;

                    return (
                        <motion.div
                            key={item.id}
                            className="flex-shrink-0 relative group cursor-pointer snap-start"
                            onMouseEnter={() => setHoveredId(item.id)}
                            onMouseLeave={() => setHoveredId(null)}
                            onClick={() => handleCardClick(item)}
                            whileHover={{ scale: 1.05, y: -8 }}
                            transition={{ duration: 0.22 }}
                            style={{ width: '180px' }}
                        >
                            <div
                                className="relative aspect-[2/3] rounded-xl overflow-hidden border border-white/10"
                                style={{
                                    boxShadow: isHovered
                                        ? `0 18px 40px ${colors.primary}42`
                                        : '0 10px 25px rgba(0,0,0,0.45)',
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

                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

                                <div className="absolute top-2 left-2 px-2 py-1 rounded-md text-sm font-bold bg-black/60 border border-red-500/30 text-red-400">
                                    {index + 1}
                                </div>

                                {rating && (
                                    <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-black/70 border border-white/10 rounded-md text-xs text-white">
                                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                        <span>{rating}</span>
                                    </div>
                                )}

                                <AnimatePresence>
                                    {isHovered && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 8 }}
                                            className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/80 to-black/20 flex flex-col justify-end p-3"
                                        >
                                            <h4 className="text-sm font-semibold line-clamp-2 mb-1 text-white">{item.title}</h4>
                                            {item.year && item.year > 1900 && (
                                                <p className="text-[11px] text-white/70 mb-2">{item.year}</p>
                                            )}
                                            <p className="text-[11px] text-white/70 line-clamp-2">
                                                {item.description || 'A cinematic pick tailored for this genre.'}
                                            </p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <div
                                    className="absolute inset-0 pointer-events-none rounded-lg transition-all"
                                    style={{
                                        border: isHovered ? `2px solid ${colors.primary}` : '2px solid transparent',
                                    }}
                                />
                            </div>

                            <h4 className="text-sm font-semibold mt-2 line-clamp-1 text-white/90">
                                {item.title}
                            </h4>
                        </motion.div>
                    );
                })}
            </div>

            <div
                className="absolute left-0 top-0 bottom-0 w-14 pointer-events-none"
                style={{
                    background: 'linear-gradient(90deg, rgba(0,0,0,0.9) 0%, transparent 100%)',
                }}
            />
            <div
                className="absolute right-0 top-0 bottom-0 w-16 pointer-events-none"
                style={{
                    background: 'linear-gradient(270deg, rgba(0,0,0,0.95) 0%, transparent 100%)',
                }}
            />
        </div>
    );
}
