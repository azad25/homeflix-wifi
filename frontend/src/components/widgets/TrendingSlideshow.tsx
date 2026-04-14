"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, Play, Star, ChevronLeft, ChevronRight, Plus, Check, Info, Calendar, Clock } from 'lucide-react';
import { Media } from '@/types/media';
import { getApiUrl, preloadAssets } from '@/lib/api';
import { useNavigate } from '@/hooks/useNavigate';
import { getColorPaletteByGenre } from '@/types/widgets';
import { useHoverVideo } from '@/hooks/useHoverVideo';
import { getRobustGenres } from '../../utils/tmdbGenres';
import { isComingSoon, getYear } from '../../utils/dateUtils';

interface TrendingSlideshowProps {
    media: Media[];
    title?: string;
    autoScroll?: boolean;
    scrollInterval?: number;
    maxItems?: number;
    className?: string;
}

// --- Per-card component for hook support ---
interface TrendingCardProps {
    item: Media;
    index: number;
    isInMyList: Record<number, boolean>;
    toggleMyList: (mediaId: number, e: React.MouseEvent) => void;
    onCardClick: (item: Media) => void;
    tmdbLogoUrl?: string;
}

function TrendingCard({ item, index, isInMyList, toggleMyList, onCardClick, tmdbLogoUrl }: TrendingCardProps) {
    const apiUrl = getApiUrl();
    const colors = getColorPaletteByGenre(item.genre_names || []);
    const [logoError, setLogoError] = useState(false);

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
        setVideoReady,
    } = useHoverVideo(item, 700);

    const handleNativeVideoLoaded = useCallback(() => {
        setVideoReady(true);
        // Unmute after playback starts
        if (videoRef.current) {
            videoRef.current.muted = false;
            videoRef.current.volume = 0.5;
        }
    }, [setVideoReady, videoRef]);

    const getImageUrl = (type: 'poster' | 'backdrop' = 'poster') => {
        if (type === 'poster') {
            if (item.tmdb_poster_url) return item.tmdb_poster_url;
            if (item.poster_url) return item.poster_url;
            if (item.poster_path) {
                const filename = item.poster_path.includes('/') ? item.poster_path.split('/').pop() : item.poster_path;
                return `${apiUrl}/api/posters/${filename}`;
            }
            return `${apiUrl}/api/posters/${item.id}`;
        } else {
            if (item.tmdb_backdrop_url) return item.tmdb_backdrop_url;
            if (item.banner_path) {
                const filename = item.banner_path.includes('/') ? item.banner_path.split('/').pop() : item.banner_path;
                return `${apiUrl}/api/admin/assets/${filename}`;
            }
            return `${apiUrl}/api/thumbnails/${item.id}`;
        }
    };

    const getLogoUrl = (): string | null => {
        if (tmdbLogoUrl) return tmdbLogoUrl;
        if (item.tmdb_logo_url) return item.tmdb_logo_url;
        if (item.logo_path) {
            if (item.logo_path.startsWith('http')) return item.logo_path;
            if (item.logo_path.startsWith('/') && !item.logo_path.startsWith('/api')) return `https://image.tmdb.org/t/p/w500${item.logo_path}`;
            if (item.logo_path.startsWith('/api')) return `${apiUrl}${item.logo_path}`;
            return `${apiUrl}/api/logos/${item.logo_path.split('/').pop()}`;
        }
        return null;
    };
    const logoUrl = getLogoUrl();

    return (
        <motion.div
            className="flex-shrink-0 relative group cursor-pointer flex items-end ml-2 lg:ml-6"
            style={{ scrollSnapAlign: 'start' }}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onClick={() => onCardClick(item)}
            whileHover={{ scale: 1.2, zIndex: 20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
        >
            {/* Netflix Style Ranking Number */}
            <div className="relative z-0 -mr-[18%] md:-mr-[22%] mb-[-4%] md:mb-[-6%] pointer-events-none">
                <span
                    className="text-[120px] md:text-[160px] lg:text-[220px] font-black leading-none tracking-tighter select-none"
                    style={{
                        color: '#000000',
                        WebkitTextStroke: index + 1 === 10 ? '3px #595959' : '4px #595959',
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                        textShadow: '0 0 20px rgba(0,0,0,0.5)'
                    }}
                >
                    {index + 1}
                </span>
            </div>

            {/* Standard 2:3 Poster Card */}
            <div className="relative w-[130px] md:w-[160px] lg:w-[200px] aspect-[2/3] z-10">
                {/* Main Image */}
                <div className="relative w-full h-full rounded-md overflow-hidden shadow-2xl border border-white/5 group-hover:border-white/20 transition-colors bg-gray-900">
                    {/* Coming Soon Tag */}
                    {isComingSoon(item) && (
                        <div className="absolute top-2 right-2 bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow z-[60] tracking-wider pointer-events-none">
                            COMING SOON
                        </div>
                    )}
                    <img
                        src={getImageUrl('poster')}
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

                    {/* Hover Video: YouTube Trailer (priority) */}
                    {shouldPlay && useYouTube && (
                        <div
                            className="absolute inset-0 z-[5] overflow-hidden transition-opacity duration-700 ease-in pointer-events-none"
                            style={{ opacity: videoReady ? 1 : 0 }}
                        >
                            <div
                                id={ytContainerId}
                                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                                style={{ width: '300%', height: '200%', minWidth: '300%', minHeight: '180%' }}
                            />
                        </div>
                    )}

                    {/* Hover Video: Native Preview Clip (fallback) */}
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
                            onError={() => { }}
                            crossOrigin="anonymous"
                        />
                    )}

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                </div>

                {/* Enhanced Hover Content */}
                <AnimatePresence>
                    {isHovered && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="absolute inset-0 flex flex-col justify-end p-3 pointer-events-auto"
                        >
                            {/* Extra inner gradient to ensure bottom content legibility */}
                            <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none rounded-b-md" />

                            <div className="relative z-10 w-full">
                                {/* Logo or Title */}
                                {(logoUrl && !logoError) ? (
                                    <img
                                        src={logoUrl}
                                        alt={item.title}
                                        className="max-h-6 md:max-h-10 w-auto object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] mb-1"
                                        onError={() => setLogoError(true)}
                                    />
                                ) : (
                                    <h4 className="text-[11px] md:text-sm font-bold text-white leading-tight line-clamp-2 mb-1 drop-shadow-md">
                                        {item.title}
                                    </h4>
                                )}
                                <div className="flex items-center gap-1.5 text-[10px] text-white/60 mb-1.5">
                                    {(() => {
                                        const year = getYear(item);
                                        return year && year > 1900 ? (
                                            <span className="font-medium">{year}</span>
                                        ) : null;
                                    })()}
                                    {((item.duration || item.runtime) && (item.duration || item.runtime)! > 0) ? (
                                        <>
                                            <span className="w-1 h-1 rounded-full bg-white/40" />
                                            <span>
                                                {Math.floor((item.duration || item.runtime!) / 3600) > 0 ? `${Math.floor((item.duration || item.runtime!) / 3600)}h ` : ''}
                                                {Math.floor(((item.duration || item.runtime!) % 3600) / 60)}m
                                            </span>
                                        </>
                                    ) : null}
                                </div>

                                {/* Genres */}
                                {(() => {
                                    const genres = getRobustGenres(item);
                                    if (!genres || genres.length === 0) return null;
                                    return (
                                        <div className="flex flex-wrap items-center gap-1 min-w-0">
                                            {genres.slice(0, 2).map((genre, idx, arr) => (
                                                <React.Fragment key={idx}>
                                                    <span className="text-[9px] text-white/70 font-medium leading-none">
                                                        {genre}
                                                    </span>
                                                    {idx < arr.length - 1 && <span className="w-1 h-1 rounded-full bg-white/30 shrink-0" />}
                                                </React.Fragment>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
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
    const [tmdbLogoUrls, setTmdbLogoUrls] = useState<Record<number, string>>({});
    
    const displayMedia = media.slice(0, maxItems);
    
    useEffect(() => {
        const fetchLogos = async () => {
            const apiUrl = getApiUrl();
            const updates: Record<number, string> = {};
            for (const item of displayMedia) {
                const actualTmdbId = item.tmdb_id || item.id;
                if (!actualTmdbId || item.logo_path || tmdbLogoUrls[item.id]) continue;
                try {
                    const type = item.type === 'tv' || item.type === 'series' || item.type === 'episode' ? 'tv' : 'movie';
                    const res = await fetch(`${apiUrl}/api/tmdb/${type}/${actualTmdbId}/images`);
                    if (res.ok) {
                        const data = await res.json();
                        const preferred = data?.logos?.find((l: any) => l.iso_639_1 === 'en') || data?.logos?.[0];
                        if (preferred?.file_path) {
                            updates[item.id] = `https://image.tmdb.org/t/p/w500${preferred.file_path}`;
                        }
                    }
                } catch { /* ignore */ }
            }
            if (Object.keys(updates).length > 0) {
                setTmdbLogoUrls(prev => ({ ...prev, ...updates }));
            }
        };
        fetchLogos();
    }, [displayMedia]);
    const [isInMyList, setIsInMyList] = useState<Record<number, boolean>>({});

    const apiUrl = getApiUrl();

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
        // Local content always routes to local pages, even if it has tmdb_id from metadata enrichment
        const isLocal = (item as any).is_local;
        if (isLocal || !item.tmdb_id) {
            // Navigate to local content pages
            if (item.type === 'episode' || item.type === 'tv' || item.type === 'series') {
                const seriesId = item.series_id || item.id;
                navigate.push(`/tv-series/${seriesId}`);
            } else {
                // Local movie - navigate to local movie page
                navigate.push(`/movie/${item.id}`);
            }
        } else {
            // Navigate to TMDB movie page with proper media type detection
            const mediaType = item.type === 'tv' || item.type === 'series' || item.type === 'episode' ? 'tv' : 'movie';
            navigate.push(`/tmdb-movie/${item.tmdb_id}?type=${mediaType}`);
        }
    };

    const toggleMyList = (mediaId: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setIsInMyList(prev => ({
            ...prev,
            [mediaId]: !prev[mediaId]
        }));
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
                                {displayMedia.length > 0 && (
                                    <div className="px-2 py-1 bg-red-500/20 backdrop-blur-sm border border-red-400/30 rounded-full">
                                        <span className="text-red-300 text-xs font-semibold uppercase tracking-wider">
                                            Top {displayMedia.length}
                                        </span>
                                    </div>
                                )}
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

            {/* Enhanced Scrollable Container */}
            <div
                ref={scrollContainerRef}
                className="flex gap-2 md:gap-4 overflow-x-auto scrollbar-hide px-4 md:px-8 pb-12 pt-8"
                style={{ scrollSnapType: 'x mandatory' }}
            >
                {displayMedia.map((item, index) => (
                    <TrendingCard
                        key={item.id}
                        item={item}
                        index={index}
                        isInMyList={isInMyList}
                        toggleMyList={toggleMyList}
                        onCardClick={handleCardClick}
                        tmdbLogoUrl={tmdbLogoUrls[item.id]}
                    />
                ))}
            </div>

            {/* Enhanced Gradient Masks */}
            <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-black via-black/50 to-transparent pointer-events-none z-10" />
            <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-black via-black/50 to-transparent pointer-events-none z-10" />
        </div>
    );
}

