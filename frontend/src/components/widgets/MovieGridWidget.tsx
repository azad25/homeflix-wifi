"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Play, Star, Plus, Check, Info, Calendar, Clock, Grid3X3 } from 'lucide-react';
import { Media } from '@/types/media';
import { getApiUrl, preloadAssets } from '@/lib/api';
import { getColorPaletteByGenre } from '@/types/widgets';
import { useNavigate } from '@/hooks/useNavigate';
import { isComingSoon, getYear } from '@/utils/dateUtils';
import { useHoverVideo } from '@/hooks/useHoverVideo';

// Genre-based text styling utility
const getGenreTextStyle = (genres: string[] = []) => {
    const primaryGenre = genres[0]?.toLowerCase() || '';

    // Font family based on genre
    let fontFamily = 'font-sans'; // default
    if (primaryGenre.includes('horror') || primaryGenre.includes('thriller')) {
        fontFamily = 'font-mono'; // monospace for tension
    } else if (primaryGenre.includes('romance') || primaryGenre.includes('drama')) {
        fontFamily = 'font-serif'; // serif for elegance
    } else if (primaryGenre.includes('sci') || primaryGenre.includes('science')) {
        fontFamily = 'font-mono'; // monospace for tech feel
    } else if (primaryGenre.includes('comedy')) {
        fontFamily = 'font-sans'; // clean sans for readability
    }

    // Text size and styling
    const textSize = 'text-sm'; // Smaller for grid items
    const maxWidth = 'max-w-full'; // Full width for grid items
    const lineHeight = 'leading-relaxed';

    return {
        fontFamily,
        textSize,
        maxWidth,
        lineHeight,
        className: `${fontFamily} ${textSize} ${maxWidth} ${lineHeight}`
    };
};

interface MovieGridCardProps {
    item: Media;
    columns: number;
    showRating: boolean;
    apiUrl: string;
    handleCardClick: (item: Media) => void;
}

const MovieGridCard: React.FC<MovieGridCardProps> = ({ item, columns, showRating, apiUrl, handleCardClick }) => {
    const [tmdbLogoUrl, setTmdbLogoUrl] = useState<string | null>(null);
    const { 
        isHovered, 
        shouldPlay, 
        videoReady, 
        useYouTube, 
        videoRef, 
        ytContainerId, 
        onMouseEnter, 
        onMouseLeave, 
        getPreviewClipUrl, 
        setVideoReady 
    } = useHoverVideo(item, 700);

    const handleNativeVideoLoaded = useCallback(() => {
        setVideoReady(true);
        if (videoRef.current) {
            videoRef.current.muted = false;
            videoRef.current.volume = 0.5;
        }
    }, [setVideoReady, videoRef]);

    useEffect(() => {
        const actualTmdbId = item.tmdb_id || item.id;
        if (!actualTmdbId || item.logo_path || item.tmdb_logo_url) return;

        const fetchTmdbLogo = async () => {
            try {
                const type = item.type === 'tv' || item.type === 'series' || item.type === 'episode' ? 'tv' : 'movie';
                const res = await fetch(`${apiUrl}/api/tmdb/${type}/${actualTmdbId}/images`);
                if (!res.ok) return;
                const data = await res.json();
                const preferred = data?.logos?.find((l: any) => l.iso_639_1 === 'en') || data?.logos?.[0];
                if (preferred?.file_path) {
                    setTmdbLogoUrl(`https://image.tmdb.org/t/p/w500${preferred.file_path}`);
                }
            } catch {
                // ignore logo fetch failures
            }
        };

        fetchTmdbLogo();
    }, [item.tmdb_id, item.id, item.logo_path, item.tmdb_logo_url, item.type, apiUrl]);

    const getImageUrl = (type: 'poster' | 'backdrop' = 'poster') => {
        if (type === 'poster') {
            const posterUrl = item.tmdb_poster_url || `${apiUrl}/api/posters/${item.id}`;
            if (posterUrl.startsWith('/api/')) return `${apiUrl}${posterUrl}`;
            return posterUrl;
        } else {
            const backdropUrl = item.tmdb_backdrop_url || item.backdrop_path || `${apiUrl}/api/thumbnails/${item.id}`;
            if (backdropUrl.startsWith('/api/')) return `${apiUrl}${backdropUrl}`;
            return backdropUrl;
        }
    };

    const getLogoUrl = () => {
        if (tmdbLogoUrl) return tmdbLogoUrl;
        if (item.tmdb_logo_url) return item.tmdb_logo_url;
        if (item.logo_path) {
            if (item.logo_path.startsWith('http')) return item.logo_path;
            if (item.logo_path.startsWith('/') && !item.logo_path.startsWith('/api/')) {
                return `https://image.tmdb.org/t/p/w500${item.logo_path}`;
            }
            if (item.logo_path.startsWith('/api/')) return `${apiUrl}${item.logo_path}`;
            const filename = item.logo_path.includes('/') ? item.logo_path.split('/').pop() : item.logo_path;
            return `${apiUrl}/api/logos/${filename}`;
        }
        return null;
    };

    const logoUrl = getLogoUrl();

    return (
        <motion.div
            className="flex-shrink-0 relative cursor-pointer"
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onClick={() => handleCardClick(item)}
            animate={{
                width: isHovered ? '400px' : `calc((100vw - 8rem) / ${Math.min(columns, 6)})`,
            }}
            transition={{
                duration: 0.5,
                ease: [0.25, 0.1, 0.25, 1]
            }}
            style={{
                scrollSnapAlign: 'start',
                minWidth: '140px',
                maxWidth: isHovered ? '400px' : '220px',
                height: '330px',
            }}
        >
            <div
                className="relative rounded-xl overflow-hidden shadow-2xl w-full h-full"
                style={{ zIndex: isHovered ? 50 : 1 }}
            >
                {isComingSoon(item) && (
                    <div className="absolute top-2 right-2 bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow z-[60] tracking-wider pointer-events-none">
                        COMING SOON
                    </div>
                )}
                {!isHovered ? (
                    <img
                        src={getImageUrl('poster')}
                        alt={item.title}
                        className="absolute inset-0 w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = getImageUrl('backdrop');
                        }}
                    />
                ) : (
                    <div className="absolute inset-0 flex flex-col">
                        <div className="relative" style={{ height: '60%' }}>
                            <img
                                src={getImageUrl('backdrop')}
                                alt={item.title}
                                className="absolute inset-0 w-full h-full object-cover z-[1]"
                                loading="lazy"
                                onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.src = getImageUrl('poster');
                                }}
                            />
                            
                            {/* Hover Video: YouTube */}
                            {shouldPlay && useYouTube && (
                                <div
                                    className="absolute inset-0 z-[5] overflow-hidden transition-opacity duration-700 ease-in pointer-events-none"
                                    style={{ opacity: videoReady ? 1 : 0 }}
                                >
                                    <div
                                        id={ytContainerId}
                                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                                        style={{ width: '180%', height: '180%', minWidth: '200%', minHeight: '120%' }}
                                    />
                                </div>
                            )}

                            {/* Hover Video: Native fallback */}
                            {shouldPlay && !useYouTube && (
                                <video
                                    ref={videoRef}
                                    src={getPreviewClipUrl()}
                                    className="absolute inset-0 w-full h-full object-cover z-[5] transition-opacity duration-700 ease-in pointer-events-none"
                                    style={{ opacity: videoReady ? 1 : 0 }}
                                    autoPlay
                                    muted
                                    loop
                                    playsInline
                                    preload="auto"
                                    onPlaying={handleNativeVideoLoaded}
                                    crossOrigin="anonymous"
                                />
                            )}
                            
                            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black z-[10]" />
                        </div>

                        <div className="bg-black p-3 flex flex-col justify-between" style={{ height: '40%', zIndex: 11 }}>
                            <div className="mb-0.5">
                                {logoUrl ? (
                                    <img
                                        src={logoUrl}
                                        alt={item.title}
                                        className="max-h-10 w-auto drop-shadow-2xl"
                                        onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                            const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                            if (fallback) fallback.style.display = 'block';
                                        }}
                                    />
                                ) : null}
                                <h4
                                    className="text-lg font-bold line-clamp-1 text-white drop-shadow-lg"
                                    style={{ display: logoUrl ? 'none' : 'block' }}
                                >
                                    {item.title}
                                </h4>
                            </div>

                            <div className="flex items-center gap-1.5 text-xs text-white/90 mb-1 flex-wrap">
                                <span className="font-bold text-[#46d369]">
                                    {item.rating ? Math.floor(Number(item.rating) * 10) : 85 + Math.floor(Math.random() * 14)}% Match
                                </span>
                                {(() => {
                                    const year = getYear(item);
                                    if (year && year > 1900) {
                                        return (
                                            <span className="flex items-center gap-0.5 px-1 py-0.5 rounded text-white/70">
                                                <Calendar className="w-2.5 h-2.5" />
                                                {year}
                                            </span>
                                        );
                                    }
                                    return null;
                                })()}
                                {showRating && item.rating && item.rating > 0 && (
                                    <span className="flex items-center gap-0.5 px-1 py-0.5 rounded text-white/70">
                                        <Star className="w-2.5 h-2.5 text-yellow-400 fill-current" />
                                        {item.rating.toFixed(1)}
                                    </span>
                                )}
                                {(() => {
                                    const duration = item.duration || item.runtime || 0;
                                    if (duration > 0) {
                                        const hours = Math.floor(duration / 3600);
                                        const minutes = Math.floor((duration % 3600) / 60);
                                        const timeStr = [
                                            hours > 0 ? `${hours}h` : '',
                                            minutes > 0 ? `${minutes}m` : ''
                                        ].filter(Boolean).join(' ');

                                        if (timeStr) {
                                            return (
                                                <span className="flex items-center gap-0.5 px-1 py-0.5 rounded text-white/70">
                                                    <Clock className="w-2.5 h-2.5" />
                                                    {timeStr}
                                                </span>
                                            );
                                        }
                                    }
                                    return null;
                                })()}
                            </div>
                            <p className="text-[10px] md:text-[11px] text-white/60 line-clamp-2 mt-auto pt-1 pb-1">
                                {item.description || item.overview || 'A cinematic piece curated just for you.'}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            <motion.div
                className="absolute inset-0 pointer-events-none rounded-xl"
                animate={{
                    boxShadow: isHovered
                        ? `0 10px 40px rgba(0,0,0,0.8)`
                        : 'none'
                }}
                transition={{ duration: 0.5 }}
            />
        </motion.div>
    );
};

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
        <div className={`relative w-full py-6 ${className}`}>
            <div className="px-[4%] md:px-[60px] mb-2 lg:mb-3 flex items-center justify-between z-30 relative">
                <div className="flex flex-col md:flex-row md:items-end gap-2 md:gap-4">
                    <h2 className="text-[1.2vw] font-bold text-[#e5e5e5] min-[18px]:text-lg tracking-wide inline-block leading-tight select-none cursor-pointer hover:text-white transition-colors">
                        {title}
                    </h2>
                    {subtitle && (
                        <span className="text-[10px] md:text-xs font-semibold text-white/50 px-2 py-0.5 rounded tracking-wide hidden md:inline-block">
                            {subtitle}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <motion.button
                        onClick={() => scroll('left')}
                        disabled={!canScrollLeft}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        className={`p-3 rounded-full backdrop-blur-md border transition-all ${!canScrollLeft
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
                        className={`p-3 rounded-full backdrop-blur-md border transition-all ${!canScrollRight
                                ? 'opacity-30 cursor-not-allowed bg-white/5 border-white/10'
                                : 'bg-white/10 hover:bg-white/20 border-white/20 hover:border-white/30'
                            }`}
                    >
                        <ChevronRight className="w-5 h-5 text-white" />
                    </motion.button>
                </div>
            </div>

            <div
                ref={scrollContainerRef}
                className="flex gap-3 md:gap-4 overflow-x-auto scrollbar-hide px-4 md:px-8 pb-6 py-8"
                style={{ scrollSnapType: 'x mandatory' }}
            >
                {displayMedia.map((item) => (
                    <MovieGridCard 
                        key={item.id}
                        item={item}
                        columns={columns}
                        showRating={showRating}
                        apiUrl={apiUrl}
                        handleCardClick={handleCardClick}
                    />
                ))}
            </div>

            <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-black via-black/50 to-transparent pointer-events-none z-10" />
            <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-black via-black/50 to-transparent pointer-events-none z-10" />
        </div>
    );
}
