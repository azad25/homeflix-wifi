"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Info, Star, ChevronLeft, ChevronRight, Plus, Check, Calendar, Clock, Volume2, VolumeX, Maximize2 } from 'lucide-react';
import { Media } from '@/types/media';
import { getApiUrl, preloadAssets } from '@/lib/api';
import { getColorPaletteByGenre, DominantColors } from '@/types/widgets';
import { useNavigate } from '@/hooks/useNavigate';

interface BackdropSlideshowProps {
    media: Media[];
    autoScroll?: boolean;
    scrollInterval?: number;
    showLogo?: boolean;
    showInfo?: boolean;
    height?: 'full' | 'large' | 'medium';
    className?: string;
}

const heightClasses = {
    full: 'h-screen',
    large: 'h-[70vh] min-h-[500px]',
    medium: 'h-[50vh] min-h-[400px]',
};

export default function BackdropSlideshow({
    media,
    autoScroll = true,
    scrollInterval = 6,
    showLogo = true,
    showInfo = true,
    height = 'large',
    className = '',
}: BackdropSlideshowProps) {
    const navigate = useNavigate();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isHovering, setIsHovering] = useState(false);
    const [colors, setColors] = useState<DominantColors>(getColorPaletteByGenre());
    const [imageLoaded, setImageLoaded] = useState(false);
    const [isInMyList, setIsInMyList] = useState<Record<number, boolean>>({});
    const [isMuted, setIsMuted] = useState(true);
    const [showTrailer, setShowTrailer] = useState(false);
    const autoScrollRef = useRef<NodeJS.Timeout | null>(null);

    const apiUrl = getApiUrl();
    const currentMedia = media[currentIndex];

    useEffect(() => {
        if (currentMedia) {
            const genres = currentMedia.genre_names || 
                          currentMedia.genres?.map((g: { name: string }) => g.name) || 
                          [];
            setColors(getColorPaletteByGenre(genres));
        }
    }, [currentMedia]);

    useEffect(() => {
        if (autoScroll && !isHovering && media.length > 1) {
            autoScrollRef.current = setInterval(() => {
                setCurrentIndex((prev) => (prev + 1) % media.length);
                setImageLoaded(false);
            }, scrollInterval * 1000);
        }
        return () => {
            if (autoScrollRef.current) clearInterval(autoScrollRef.current);
        };
    }, [autoScroll, isHovering, media.length, scrollInterval]);

    useEffect(() => {
        const nextIndex = (currentIndex + 1) % media.length;
        if (media[nextIndex]) {
            preloadAssets([media[nextIndex]], ['poster', 'thumbnail']);
        }
    }, [currentIndex, media]);

    const handlePrevious = () => {
        setCurrentIndex((prev) => (prev - 1 + media.length) % media.length);
        setImageLoaded(false);
    };

    const handleNext = () => {
        setCurrentIndex((prev) => (prev + 1) % media.length);
        setImageLoaded(false);
    };

    const toggleMyList = (mediaId: number) => {
        setIsInMyList(prev => ({
            ...prev,
            [mediaId]: !prev[mediaId]
        }));
    };

    const handleCardClick = (media: Media) => {
        // Check if it's TMDB content (has tmdb_id) or local content
        if (media.tmdb_id) {
            // Navigate to TMDB movie page with proper media type detection
            const mediaType = media.type === 'tv' || media.type === 'series' || media.type === 'episode' ? 'tv' : 'movie';
            navigate.push(`/tmdb-movie/${media.tmdb_id}?type=${mediaType}`);
        } else {
            // Navigate to local movie page
            if (media.type === 'episode' || media.type === 'tv' || media.type === 'series') {
                const seriesId = media.series_id || media.id;
                navigate.push(`/tv-series/${seriesId}`);
            } else {
                navigate.push(`/movie/${media.id}`);
            }
        }
    };

    const getBackdropUrl = (m: Media) => {
        // Priority: TMDB backdrop > local banner > thumbnail fallback
        if (m.tmdb_backdrop_url) return m.tmdb_backdrop_url;
        if (m.banner_path) {
            // Handle both full paths and just filenames
            const filename = m.banner_path.includes('/') ? m.banner_path.split('/').pop() : m.banner_path;
            return `${apiUrl}/api/admin/assets/${filename}`;
        }
        return `${apiUrl}/api/thumbnails/${m.id}`;
    };

    const getPosterUrl = (m: Media) => {
        // Priority: TMDB poster > local poster > thumbnail fallback
        if (m.tmdb_poster_url) return m.tmdb_poster_url;
        if (m.poster_url) return m.poster_url;
        if (m.poster_path) {
            const filename = m.poster_path.includes('/') ? m.poster_path.split('/').pop() : m.poster_path;
            return `${apiUrl}/api/posters/${filename}`;
        }
        return `${apiUrl}/api/posters/${m.id}`;
    };

    const getLogoUrl = (m: Media) => {
        // Priority: TMDB logo > local logo
        if (m.tmdb_id) {
            // For TMDB content, we'll fetch the logo from TMDB images API
            // This would need to be implemented as a separate API call
            // For now, fall back to local logo handling
        }
        
        if (m.logo_path) {
            // Check if logo_path is already a full URL (TMDB logo)
            if (m.logo_path.startsWith('http')) {
                return m.logo_path;
            }
            // Handle local logo paths - could be relative or absolute
            if (m.logo_path.startsWith('/api/')) {
                return `${apiUrl}${m.logo_path}`;
            }
            // For simple filenames or relative paths
            const filename = m.logo_path.includes('/') ? m.logo_path.split('/').pop() : m.logo_path;
            return `${apiUrl}/api/logos/${filename}`;
        }
        return null;
    };

    if (!currentMedia) return null;

    return (
        <div
            className={`relative w-full ${heightClasses[height]} overflow-hidden rounded-2xl ${className}`}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
        >
            {/* Enhanced Backdrop Images */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentIndex}
                    initial={{ opacity: 0, scale: 1.1 }}
                    animate={{ opacity: imageLoaded ? 1 : 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                    className="absolute inset-0"
                >
                    <img
                        src={getBackdropUrl(currentMedia)}
                        alt={currentMedia.title}
                        className="w-full h-full object-cover"
                        onLoad={() => setImageLoaded(true)}
                        onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            const currentSrc = target.src;
                            
                            // Try fallback sequence: backdrop -> banner -> thumbnail
                            if (currentSrc.includes('tmdb') && currentMedia.banner_path) {
                                const filename = currentMedia.banner_path.includes('/') ? 
                                    currentMedia.banner_path.split('/').pop() : currentMedia.banner_path;
                                target.src = `${apiUrl}/api/admin/assets/${filename}`;
                            } else if (!currentSrc.includes('thumbnails')) {
                                target.src = `${apiUrl}/api/thumbnails/${currentMedia.id}`;
                            }
                        }}
                    />
                </motion.div>
            </AnimatePresence>

            {/* Enhanced Gradient Overlays */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
            <div 
                className="absolute bottom-0 left-0 right-0 h-40"
                style={{
                    background: `linear-gradient(to top, ${colors.primary}20 0%, transparent 100%)`
                }}
            />

            {/* Quality and Rating Badges */}
            <div className="absolute top-6 left-6 flex items-center gap-3 z-20">
                <div className="px-3 py-1 bg-black/80 backdrop-blur-sm rounded-lg border border-white/20">
                    <span className="text-white text-sm font-bold">4K</span>
                </div>
                {currentMedia.rating && currentMedia.rating > 0 && (
                    <div 
                        className="flex items-center gap-2 px-3 py-1 rounded-full backdrop-blur-md border"
                        style={{
                            backgroundColor: `${colors.primary}30`,
                            borderColor: `${colors.primary}50`
                        }}
                    >
                        <Star className="w-4 h-4 text-yellow-400 fill-current" />
                        <span className="text-white text-sm font-semibold">
                            {currentMedia.rating.toFixed(1)}
                        </span>
                    </div>
                )}
            </div>

            {/* Audio Controls */}
            <div className="absolute top-6 right-6 flex items-center gap-3 z-20">
                <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsMuted(!isMuted)}
                    className="p-3 bg-black/50 backdrop-blur-md rounded-full border border-white/20 hover:bg-black/70 transition-all"
                >
                    {isMuted ? 
                        <VolumeX className="w-5 h-5 text-white" /> : 
                        <Volume2 className="w-5 h-5 text-white" />
                    }
                </motion.button>
                <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowTrailer(!showTrailer)}
                    className="p-3 bg-black/50 backdrop-blur-md rounded-full border border-white/20 hover:bg-black/70 transition-all"
                >
                    <Maximize2 className="w-5 h-5 text-white" />
                </motion.button>
            </div>

            {/* Enhanced Content */}
            <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12 lg:p-16 z-10">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentIndex}
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -30 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="max-w-3xl"
                    >
                        {/* Enhanced Logo/Title Section - Prioritize Logo over Title */}
                        <div className="mb-6">
                            {showLogo && getLogoUrl(currentMedia) ? (
                                <img
                                    src={getLogoUrl(currentMedia)!}
                                    alt={`${currentMedia.title} logo`}
                                    className="max-h-20 md:max-h-24 lg:max-h-32 w-auto mb-4 drop-shadow-2xl"
                                    style={{ filter: 'drop-shadow(0 0 30px rgba(0,0,0,0.8))' }}
                                    onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.style.display = 'none';
                                        const fallback = target.nextElementSibling as HTMLElement;
                                        if (fallback && fallback.tagName === 'H2') {
                                            fallback.style.display = 'block';
                                        }
                                    }}
                                />
                            ) : null}
                            
                            <h2 
                                className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4" 
                                style={{ 
                                    display: showLogo && getLogoUrl(currentMedia) ? 'none' : 'block',
                                    textShadow: `0 0 40px ${colors.primary}60, 0 4px 20px rgba(0,0,0,0.8)`,
                                    background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.accent} 100%)`,
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    backgroundClip: 'text'
                                }}
                            >
                                {currentMedia.title}
                            </h2>
                        </div>

                        {showInfo && (
                            <>
                                {/* Enhanced Meta Information */}
                                <div className="flex flex-wrap items-center gap-4 mb-4 text-sm md:text-base">
                                    {(currentMedia.year || currentMedia.release_date) && (
                                        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
                                            <Calendar className="w-4 h-4 text-white/80" />
                                            <span className="text-white font-medium">
                                                {currentMedia.year || new Date(currentMedia.release_date!).getFullYear()}
                                            </span>
                                        </div>
                                    )}
                                    
                                    {(currentMedia.duration || currentMedia.runtime) && (
                                        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
                                            <Clock className="w-4 h-4 text-white/80" />
                                            <span className="text-white font-medium">
                                                {Math.floor((currentMedia.duration || currentMedia.runtime!) / 3600)}h {Math.floor(((currentMedia.duration || currentMedia.runtime!) % 3600) / 60)}m
                                            </span>
                                        </div>
                                    )}

                                    {currentMedia.certification && (
                                        <div className="px-3 py-1 rounded border border-white/30 bg-white/10 backdrop-blur-sm">
                                            <span className="text-white text-sm font-bold">{currentMedia.certification}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Enhanced Genres */}
                                {(currentMedia.genre_names || currentMedia.genres) && (
                                    <div className="flex flex-wrap gap-2 mb-6">
                                        {(currentMedia.genre_names || currentMedia.genres?.map(g => g.name) || []).slice(0, 4).map((genre, idx) => (
                                            <span
                                                key={idx}
                                                className="px-3 py-1 rounded-full text-sm font-medium backdrop-blur-sm border"
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

                                {/* Enhanced Description */}
                                {(currentMedia.description || currentMedia.long_desc || currentMedia.short_desc) && (
                                    <p className="text-lg text-white/90 mb-8 line-clamp-3 max-w-2xl leading-relaxed">
                                        {currentMedia.description || currentMedia.long_desc || currentMedia.short_desc}
                                    </p>
                                )}

                                {/* Enhanced Action Buttons */}
                                <div className="flex items-center gap-4">
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => handleCardClick(currentMedia)}
                                        className="flex items-center gap-3 px-8 py-4 bg-white text-black font-bold rounded-lg hover:bg-white/90 transition-all shadow-2xl"
                                    >
                                        <Play className="w-5 h-5 fill-current" />
                                        {currentMedia.tmdb_id ? 'View Details' : 'Play'}
                                    </motion.button>
                                    
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => handleCardClick(currentMedia)}
                                        className="flex items-center gap-3 px-6 py-4 backdrop-blur-md border font-semibold rounded-lg transition-all"
                                        style={{ 
                                            backgroundColor: `${colors.primary}20`,
                                            borderColor: `${colors.primary}50`,
                                            color: 'white'
                                        }}
                                    >
                                        <Info className="w-5 h-5" />
                                        More Info
                                    </motion.button>
                                    
                                    <motion.button
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => toggleMyList(currentMedia.id)}
                                        className="p-4 backdrop-blur-md rounded-full border transition-all"
                                        style={{ 
                                            backgroundColor: isInMyList[currentMedia.id] ? `${colors.primary}40` : `${colors.primary}20`,
                                            borderColor: `${colors.primary}50`
                                        }}
                                    >
                                        {isInMyList[currentMedia.id] ? 
                                            <Check className="w-5 h-5" style={{ color: colors.primary }} /> : 
                                            <Plus className="w-5 h-5 text-white" />
                                        }
                                    </motion.button>
                                </div>
                            </>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Enhanced Navigation */}
            {media.length > 1 && (
                <>
                    <motion.button
                        onClick={handlePrevious}
                        className="absolute left-6 top-1/2 -translate-y-1/2 p-4 backdrop-blur-md rounded-full border transition-all z-20"
                        style={{ 
                            backgroundColor: `${colors.primary}20`,
                            borderColor: `${colors.primary}40`,
                            opacity: isHovering ? 1 : 0
                        }}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <ChevronLeft className="w-6 h-6 text-white" />
                    </motion.button>
                    <motion.button
                        onClick={handleNext}
                        className="absolute right-6 top-1/2 -translate-y-1/2 p-4 backdrop-blur-md rounded-full border transition-all z-20"
                        style={{ 
                            backgroundColor: `${colors.primary}20`,
                            borderColor: `${colors.primary}40`,
                            opacity: isHovering ? 1 : 0
                        }}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <ChevronRight className="w-6 h-6 text-white" />
                    </motion.button>
                </>
            )}

            {/* Enhanced Progress Indicators */}
            {media.length > 1 && (
                <div className="absolute bottom-8 right-8 flex items-center gap-3 z-20">
                    {media.slice(0, 8).map((item, idx) => (
                        <motion.button
                            key={idx}
                            onClick={() => {
                                setCurrentIndex(idx);
                                setImageLoaded(false);
                            }}
                            className="relative group"
                            whileHover={{ scale: 1.2 }}
                            whileTap={{ scale: 0.9 }}
                        >
                            <div
                                className={`h-1 rounded-full transition-all duration-300 ${
                                    idx === currentIndex ? 'w-12' : 'w-3'
                                }`}
                                style={{
                                    backgroundColor: idx === currentIndex ? colors.primary : 'rgba(255,255,255,0.4)',
                                    boxShadow: idx === currentIndex ? `0 0 15px ${colors.primary}80` : 'none'
                                }}
                            />
                            {/* Tooltip */}
                            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/90 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                {item.title}
                            </div>
                        </motion.button>
                    ))}
                    {media.length > 8 && (
                        <span className="text-xs text-white/50 ml-2 font-medium">
                            +{media.length - 8} more
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}