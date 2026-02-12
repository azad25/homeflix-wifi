"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Play, Star, Plus, Check, Info, Calendar, Clock, Grid3X3 } from 'lucide-react';
import { Media } from '@/types/media';
import { getApiUrl, preloadAssets } from '@/lib/api';
import { getColorPaletteByGenre } from '@/types/widgets';
import { useNavigate } from '@/hooks/useNavigate';

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
            // If it's a full URL, use it directly
            if (item.logo_path.startsWith('http')) {
                return item.logo_path;
            }
            
            // If it's already an API path, use it directly
            if (item.logo_path.startsWith('/api/')) {
                return `${apiUrl}${item.logo_path}`;
            }
            
            // For local content, use the logos endpoint
            const filename = item.logo_path.includes('/') ? item.logo_path.split('/').pop() : item.logo_path;
            return `${apiUrl}/api/logos/${filename}`;
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
                            {displayMedia.length > 0 && (
                                <div className="px-2 py-1 bg-red-500/20 backdrop-blur-sm border border-red-400/30 rounded-full">
                                    <span className="text-red-300 text-xs font-semibold">
                                        {displayMedia.length} Items
                                    </span>
                                </div>
                            )}
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

            {/* Enhanced Grid/Scroll Container - Allow overflow for expansion */}
            <div
                ref={scrollContainerRef}
                className="flex gap-3 md:gap-4 overflow-x-auto scrollbar-hide px-4 md:px-8 pb-6 py-8"
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
                            className="flex-shrink-0 relative cursor-pointer"
                            onMouseEnter={() => setHoveredId(item.id)}
                            onMouseLeave={() => setHoveredId(null)}
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
                                height: '330px', // Fixed height matching poster
                            }}
                        >
                            {/* Card - fixed height, aspect changes */}
                            <div 
                                className="relative rounded-xl overflow-hidden shadow-2xl w-full h-full"
                                style={{
                                    zIndex: isHovered ? 50 : 1,
                                }}
                            >
                                {!isHovered ? (
                                    // Poster view
                                    <img
                                        src={getImageUrl(item, 'poster')}
                                        alt={item.title}
                                        className="absolute inset-0 w-full h-full object-cover"
                                        loading="lazy"
                                        onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            target.src = getImageUrl(item, 'backdrop');
                                        }}
                                    />
                                ) : (
                                    // Hover view - backdrop on top, info on bottom
                                    <div className="absolute inset-0 flex flex-col">
                                        {/* Backdrop - top 70% */}
                                        <div className="relative" style={{ height: '70%' }}>
                                            <img
                                                src={getImageUrl(item, 'backdrop')}
                                                alt={item.title}
                                                className="absolute inset-0 w-full h-full object-cover"
                                                loading="lazy"
                                                onError={(e) => {
                                                    const target = e.target as HTMLImageElement;
                                                    target.src = getImageUrl(item, 'poster');
                                                }}
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black" />
                                        </div>

                                        {/* Info section - bottom 30% */}
                                        <div className="bg-black p-2 flex flex-col justify-between" style={{ height: '30%' }}>
                                            {/* Logo/Title directly above meta */}
                                            <div className="mb-1">
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

                                            {/* Meta Info Row */}
                                            <div className="flex items-center gap-1.5 text-xs text-white/90 mb-1 flex-wrap">
                                                    {(() => {
                                                        let year = item.year;
                                                        if (!year || year <= 1900) {
                                                            if (item.release_date) {
                                                                year = new Date(item.release_date).getFullYear();
                                                            } else if (item.first_air_date) {
                                                                year = new Date(item.first_air_date).getFullYear();
                                                            }
                                                        }
                                                        
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
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Subtle shadow on hover */}
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
                })}
            </div>

            {/* Enhanced Gradient Masks */}
            <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-black via-black/50 to-transparent pointer-events-none z-10" />
            <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-black via-black/50 to-transparent pointer-events-none z-10" />
        </div>
    );
}
