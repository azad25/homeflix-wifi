"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { Media } from '@/types/media';
import { getApiUrl, preloadAssets } from '@/lib/api';
import { useNavigate } from '@/hooks/useNavigate';

interface GenreBasedWidgetProps {
    media: Media[];
    genre: string;
    title?: string;
    showHotBadge?: boolean;
    maxItems?: number;
    className?: string;
}

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
    const [logoErrors, setLogoErrors] = useState<Record<number, boolean>>({});

    const apiUrl = getApiUrl();
    const displayMedia = useMemo(() => media.slice(0, maxItems), [media, maxItems]);

    useEffect(() => {
        preloadAssets(displayMedia.slice(0, 10), ['thumbnail']);
    }, [displayMedia]);

    const updateScrollButtons = () => {
        const container = scrollContainerRef.current;
        if (container) {
            setCanScrollLeft(container.scrollLeft > 0);
            const maxScrollValue = container.scrollWidth - container.clientWidth;
            setCanScrollRight(container.scrollLeft < maxScrollValue - 2);
        }
    };

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (container) {
            container.addEventListener('scroll', updateScrollButtons);
            setTimeout(updateScrollButtons, 100);
            window.addEventListener('resize', updateScrollButtons);
            
            return () => {
                container.removeEventListener('scroll', updateScrollButtons);
                window.removeEventListener('resize', updateScrollButtons);
            };
        }
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
        <div className={`w-full mb-8 lg:mb-12 relative group ${className}`}>
            {/* Header Area */}
            <div className="px-[4%] md:px-[60px] mb-2 lg:mb-3 flex items-center justify-between z-30 relative">
                <div className="flex flex-col md:flex-row md:items-end gap-2 md:gap-4">
                    <h2 className="text-[1.2vw] font-bold text-[#e5e5e5] min-[18px]:text-lg tracking-wide inline-block leading-tight select-none cursor-pointer hover:text-white transition-colors">
                        {title || genre}
                    </h2>
                    {showHotBadge && (
                        <span className="text-[10px] md:text-xs font-semibold text-[#e50914] bg-[#e50914]/10 px-2 py-0.5 rounded uppercase tracking-wider hidden md:inline-block">
                            Top Picks
                        </span>
                    )}
                </div>
            </div>

            {/* Row Content Wrapper */}
            <div className="relative w-full overflow-y-visible">
                {/* Left Scroll Control - Replaces solid block with transparent/gradient & visible arrow on hover */}
                {canScrollLeft && (
                    <div
                        className="absolute z-20 left-0 top-0 bottom-0 w-[5%] min-w-[50px] bg-gradient-to-r from-black/80 to-transparent flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 cursor-pointer"
                        onClick={() => scroll('left')}
                    >
                        <ChevronLeft className="w-10 h-10 md:w-14 md:h-14 text-white hover:scale-125 transition-transform drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]" />
                    </div>
                )}

                {/* Right Scroll Control  */}
                {canScrollRight && (
                    <div
                        className="absolute z-20 right-0 top-0 bottom-0 w-[5%] min-w-[50px] bg-gradient-to-l from-black/80 to-transparent flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 cursor-pointer"
                        onClick={() => scroll('right')}
                    >
                        <ChevronRight className="w-10 h-10 md:w-14 md:h-14 text-white hover:scale-125 transition-transform drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]" />
                    </div>
                )}

                {/* Scrollable Container */}
                <div
                    ref={scrollContainerRef}
                    className="flex gap-2 md:gap-3 overflow-x-auto scrollbar-hide px-[4%] md:px-[60px] py-4 snap-x snap-mandatory"
                    style={{ WebkitOverflowScrolling: 'touch', overflowY: 'visible' }}
                >
                    {displayMedia.map((item) => {
                        const isHovered = hoveredId === item.id;
                        const rating = item.rating && item.rating > 0 ? item.rating.toFixed(1) : null;
                        const matchPercentage = rating ? Math.floor(Number(rating) * 10) : 85 + Math.floor(Math.random() * 14);

                        // Use landscape assets
                        const imageSrc = item.tmdb_backdrop_url || item.backdrop_url || item.backdrop_path || `${apiUrl}/api/backdrops/${item.id}`;

                        let logoSrc: string | null = null;
                        if (item.tmdb_logo_url) {
                            logoSrc = item.tmdb_logo_url;
                        } else if (item.logo_path) {
                            if (item.logo_path.startsWith('http')) logoSrc = item.logo_path;
                            else if (item.logo_path.startsWith('/') && !item.logo_path.startsWith('/api')) logoSrc = `https://image.tmdb.org/t/p/w500${item.logo_path}`;
                            else if (item.logo_path.startsWith('/api')) logoSrc = `${apiUrl}${item.logo_path}`;
                            else logoSrc = `${apiUrl}/api/logos/${item.logo_path.split('/').pop()}`;
                        }

                        return (
                            <motion.div
                                key={item.id}
                                className="flex-shrink-0 relative cursor-pointer snap-start rounded-md overflow-visible"
                                style={{ width: '26vw', minWidth: '260px', maxWidth: '400px' }}
                                onMouseEnter={() => setHoveredId(item.id)}
                                onMouseLeave={() => setHoveredId(null)}
                                onClick={() => handleCardClick(item)}
                                initial={{ opacity: 0.9 }}
                                animate={{ opacity: 1 }}
                                whileHover={{
                                    scale: 1.15,
                                    zIndex: 50,
                                    transition: { duration: 0.3, delay: 0.35, ease: 'easeOut' },
                                }}
                            >
                                <div className="aspect-video w-full rounded-md shadow-md bg-[#141414] overflow-hidden relative border border-transparent hover:border-white/10 transition-colors">
                                    <img
                                        src={imageSrc}
                                        alt={item.title}
                                        className="w-full h-full object-cover transition-opacity duration-300 bg-[#141414]"
                                        loading="lazy"
                                        onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            target.src = `${apiUrl}/api/thumbnails/${item.id}`;
                                        }}
                                    />

                                    {/* Default Shadow Overlay at Bottom */}
                                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none transition-opacity duration-300"
                                         style={{ opacity: isHovered ? 0 : 1 }}
                                    />
                                    
                                    {/* Title fallback if not hovered */}
                                    <div className="absolute inset-x-0 bottom-0 p-3 pointer-events-none transition-opacity duration-300" style={{ opacity: isHovered ? 0 : 1 }}>
                                        {(logoSrc && !logoErrors[item.id]) ? (
                                            <img src={logoSrc} className="max-h-6 md:max-h-8 w-auto object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />
                                        ) : (
                                            <h4 className="text-[13px] md:text-[15px] font-semibold text-white drop-shadow-md truncate">
                                                {item.title}
                                            </h4>
                                        )}
                                    </div>

                                    {/* Advanced Hover Card Content */}
                                    <AnimatePresence>
                                        {isHovered && (
                                            <motion.div
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/90 to-[#141414]/20 flex flex-col justify-end p-3 md:p-4 pointer-events-none"
                                            >
                                                {(logoSrc && !logoErrors[item.id]) ? (
                                                    <div className="mb-2">
                                                        <img
                                                            src={logoSrc}
                                                            alt={item.title}
                                                            className="max-h-8 md:max-h-12 w-auto drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] object-contain"
                                                            loading="lazy"
                                                            onError={() => setLogoErrors(prev => ({...prev, [item.id]: true}))}
                                                        />
                                                    </div>
                                                ) : (
                                                    <h4 className="text-sm md:text-lg font-bold text-white leading-tight line-clamp-1 mb-2 drop-shadow-md shadow-black">
                                                        {item.title}
                                                    </h4>
                                                )}
                                                
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-[11px] md:text-sm font-bold text-[#46d369]">
                                                        {matchPercentage}% Match
                                                    </span>
                                                    {item.year && item.year > 1900 && (
                                                        <span className="text-[11px] md:text-xs text-white/70">
                                                            {item.year}
                                                        </span>
                                                    )}
                                                    <span className="border border-white/40 text-white/70 px-1 rounded-sm text-[8px] md:text-[10px] font-bold tracking-widest">
                                                        HD
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-2 text-[10px] md:text-[11px] text-white/60">
                                                    {item.genre_names?.slice(0, 3).map((g, i) => (
                                                        <React.Fragment key={g}>
                                                            <span>{g}</span>
                                                            {i < (item.genre_names?.slice(0, 3).length || 0) - 1 && (
                                                                <span className="w-1 h-1 rounded-full bg-white/40" />
                                                            )}
                                                        </React.Fragment>
                                                    )) || <span>Explosive • Action • Thriller</span>}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
