"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Star, Calendar, Clock } from 'lucide-react';
import { Media } from '@/types/media';
import { getApiUrl } from '@/lib/api';
import { getColorPaletteByGenre, DominantColors } from '@/types/widgets';
import { useNavigate } from '@/hooks/useNavigate';
import { navigateToMedia } from '@/lib/mediaNavigation';

interface HalfWidthBannerProps {
    media: Media | Media[];
    position?: 'left' | 'right';
    showLogo?: boolean;
    showDescription?: boolean;
    showPoster?: boolean;
    autoScroll?: boolean;
    scrollInterval?: number;
    className?: string;
}

export default function HalfWidthBanner({
    media,
    position = 'left',
    showLogo = true,
    showDescription = true,
    showPoster = false,
    autoScroll = true,
    scrollInterval = 8,
    className = '',
}: HalfWidthBannerProps) {
    const navigate = useNavigate();
    const [colors, setColors] = useState<DominantColors>(getColorPaletteByGenre());
    const [imageLoaded, setImageLoaded] = useState(false);
    const [isHovering, setIsHovering] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [tmdbLogos, setTmdbLogos] = useState<Record<number, string>>({});

    const apiUrl = getApiUrl();

    // Handle both single media and array of media
    const mediaArray = Array.isArray(media) ? media : [media];
    const currentMedia = mediaArray[currentIndex];
    const isMultipleMedia = mediaArray.length > 1;

    // Fetch TMDB logo if needed
    useEffect(() => {
        const fetchTMDBLogo = async (tmdbId: number) => {
            if (tmdbLogos[tmdbId]) return; // Already fetched
            
            try {
                const response = await fetch(`${apiUrl}/api/tmdb/movie/${tmdbId}/images`);
                if (response.ok) {
                    const imagesData = await response.json();
                    const logo = imagesData.logos?.find((logo: any) => 
                        logo.iso_639_1 === 'en' || logo.iso_639_1 === null
                    );
                    if (logo) {
                        setTmdbLogos(prev => ({
                            ...prev,
                            [tmdbId]: `https://image.tmdb.org/t/p/w500${logo.file_path}`
                        }));
                    }
                }
            } catch (error) {
                console.log('Failed to fetch TMDB logo for', tmdbId);
            }
        };

        // Fetch logos for TMDB content that doesn't have logo_path
        mediaArray.forEach(m => {
            if (m.tmdb_id && !m.logo_path) {
                fetchTMDBLogo(m.tmdb_id);
            }
        });
    }, [mediaArray, apiUrl, tmdbLogos]);

    // Auto-scroll for multiple media
    useEffect(() => {
        if (autoScroll && !isHovering && isMultipleMedia) {
            const timer = setInterval(() => {
                setCurrentIndex((prev) => (prev + 1) % mediaArray.length);
                setImageLoaded(false);
            }, scrollInterval * 1000);
            return () => clearInterval(timer);
        }
    }, [autoScroll, isHovering, isMultipleMedia, mediaArray.length, scrollInterval]);

    useEffect(() => {
        if (currentMedia?.genre_names || currentMedia?.genres) {
            const genres = currentMedia.genre_names || currentMedia.genres?.map((g: { name: string }) => g.name) || [];
            setColors(getColorPaletteByGenre(genres));
        }
    }, [currentMedia]);

    const getBackdropUrl = () => {
        if (currentMedia.tmdb_backdrop_url) return currentMedia.tmdb_backdrop_url;
        if (currentMedia.banner_path) return `${apiUrl}/api/admin/assets/${currentMedia.banner_path.split('/').pop()}`;
        return `${apiUrl}/api/thumbnails/${currentMedia.id}`;
    };

    const getLogoUrl = () => {
        // For TMDB content, check if we have TMDB logo data
        if (currentMedia.tmdb_id) {
            // First check if we fetched a logo from TMDB images API
            if (tmdbLogos[currentMedia.tmdb_id]) {
                return tmdbLogos[currentMedia.tmdb_id];
            }
            // If logo_path exists and starts with '/', it's a TMDB logo path
            if (currentMedia.logo_path && currentMedia.logo_path.startsWith('/')) {
                return `https://image.tmdb.org/t/p/w500${currentMedia.logo_path}`;
            }
        }
        
        // Handle local logo paths
        if (currentMedia.logo_path) {
            // Check if logo_path is already a full URL (TMDB logo)
            if (currentMedia.logo_path.startsWith('http')) {
                return currentMedia.logo_path;
            }
            // Handle local logo paths - could be relative or absolute
            if (currentMedia.logo_path.startsWith('/api/')) {
                return `${apiUrl}${currentMedia.logo_path}`;
            }
            // For simple filenames or relative paths
            const filename = currentMedia.logo_path.includes('/') ? currentMedia.logo_path.split('/').pop() : currentMedia.logo_path;
            return `${apiUrl}/api/logos/${filename}`;
        }
        return null;
    };

    const getPosterUrl = () => {
        if (currentMedia.tmdb_poster_url) return currentMedia.tmdb_poster_url;
        if (currentMedia.poster_path) {
            if (currentMedia.poster_path.startsWith('http')) return currentMedia.poster_path;
            return `https://image.tmdb.org/t/p/w500${currentMedia.poster_path}`;
        }
        return `${apiUrl}/api/posters/${currentMedia.id}`;
    };

    const handleClick = () => {
        navigateToMedia(navigate, currentMedia);
    };

    if (!currentMedia) return null;

    return (
        <motion.div
            className={`relative w-full h-full overflow-hidden cursor-pointer group rounded-xl ${className}`}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            onClick={handleClick}
            whileHover={{ scale: 1.02 }}
            transition={{ duration: 0.3 }}
        >
            {/* Background gradient */}
            <div
                className="absolute inset-0 transition-all duration-700"
                style={{ background: colors.background }}
            />

            {/* Backdrop image */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentIndex}
                    className="absolute inset-0"
                    initial={{ opacity: 0, scale: 1.1 }}
                    animate={{ opacity: imageLoaded ? 1 : 0, scale: isHovering ? 1.1 : 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.6 }}
                >
                    <img
                        src={getBackdropUrl()}
                        alt={currentMedia.title}
                        className="w-full h-full object-cover"
                        onLoad={() => setImageLoaded(true)}
                        onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = `${apiUrl}/api/thumbnails/${currentMedia.id}`;
                        }}
                    />
                </motion.div>
            </AnimatePresence>

            {/* Gradient overlays */}
            <div
                className={`absolute inset-0 ${position === 'left'
                        ? 'bg-gradient-to-r from-black/80 via-black/40 to-transparent'
                        : 'bg-gradient-to-l from-black/80 via-black/40 to-transparent'
                    }`}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

            {/* Accent border on hover */}
            <motion.div
                className="absolute inset-0 pointer-events-none"
                animate={{ opacity: isHovering ? 1 : 0 }}
                transition={{ duration: 0.3 }}
                style={{
                    boxShadow: `inset 0 0 0 2px ${colors.primary}`,
                }}
            />

            {/* Content */}
            <div className={`absolute bottom-0 ${position === 'left' ? 'left-0' : 'right-0'} p-6 md:p-8 max-w-md`}>
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentIndex}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.5 }}
                        className="flex items-end gap-4"
                    >
                        {/* Poster - if enabled */}
                        {showPoster && (
                            <div className="flex-shrink-0 hidden md:block">
                                <div className="relative w-20 lg:w-24 rounded-lg overflow-hidden shadow-xl border border-white/20">
                                    <img
                                        src={getPosterUrl()}
                                        alt={`${currentMedia.title} poster`}
                                        className="w-full h-auto"
                                        onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            target.src = `${apiUrl}/api/thumbnails/${currentMedia.id}`;
                                        }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Text Content */}
                        <div className="flex-1">
                            {/* Logo or Title */}
                            {showLogo && getLogoUrl() ? (
                                <img
                                    src={getLogoUrl()!}
                                    alt={currentMedia.title}
                                    className="max-h-16 md:max-h-20 w-auto mb-4 drop-shadow-xl"
                                    onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                        const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                        if (fallback) fallback.style.display = 'block';
                                    }}
                                />
                            ) : null}
                            <h2
                                className="text-2xl md:text-3xl font-bold mb-3 leading-tight"
                                style={{ 
                                    display: showLogo && getLogoUrl() ? 'none' : 'block',
                                    textShadow: `0 0 30px ${colors.primary}30` 
                                }}
                            >
                                {currentMedia.title}
                            </h2>

                            {/* Meta info */}
                            <div className="flex items-center gap-3 mb-3 text-sm">
                                {currentMedia.rating ? (
                                    <div className="flex items-center gap-1">
                                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                                        <span className="font-semibold">
                                            {currentMedia.rating > 0 ? currentMedia.rating.toFixed(1) : ''}
                                        </span>
                                    </div>
                                ) : null}
                                {currentMedia.year && currentMedia.year > 1900 && (
                                    <div className="flex items-center gap-1 text-white/70">
                                        <Calendar className="w-3 h-3" />
                                        <span>{currentMedia.year}</span>
                                    </div>
                                )}
                                {currentMedia.runtime && currentMedia.runtime > 0 && (
                                    <div className="flex items-center gap-1 text-white/70">
                                        <Clock className="w-3 h-3" />
                                        <span>{Math.floor(currentMedia.runtime / 60)}h {currentMedia.runtime % 60}m</span>
                                    </div>
                                )}
                            </div>

                            {/* Genres */}
                            {currentMedia.genre_names && currentMedia.genre_names.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mb-3">
                                    {currentMedia.genre_names.slice(0, 3).map((genre, idx) => (
                                        <span
                                            key={idx}
                                            className="px-2 py-0.5 rounded-full text-xs font-medium bg-white/10"
                                            style={{ borderColor: `${colors.primary}40` }}
                                        >
                                            {genre}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Description */}
                            {showDescription && currentMedia.description && (
                                <p className="text-sm text-white/70 mb-4 line-clamp-2">
                                    {currentMedia.description}
                                </p>
                            )}

                            {/* Play button removed per new design */}
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Corner accent */}
            <div
                className="absolute top-4 right-4 w-16 h-16 opacity-30"
                style={{
                    background: `radial-gradient(circle at top right, ${colors.primary} 0%, transparent 70%)`,
                }}
            />

            {/* Slide indicators - only show if multiple items */}
            {isMultipleMedia && (
                <div className="absolute bottom-4 right-4 flex items-center gap-2 z-20">
                    {mediaArray.slice(0, 6).map((_, idx) => (
                        <button
                            key={idx}
                            onClick={(e) => {
                                e.stopPropagation();
                                setCurrentIndex(idx);
                                setImageLoaded(false);
                            }}
                            className={`h-1 rounded-full transition-all ${idx === currentIndex ? 'w-6' : 'w-2'
                                }`}
                            style={{
                                backgroundColor: idx === currentIndex ? colors.primary : 'rgba(255,255,255,0.3)',
                            }}
                        />
                    ))}
                    {mediaArray.length > 6 && (
                        <span className="text-xs text-white/50 ml-2">+{mediaArray.length - 6}</span>
                    )}
                </div>
            )}
        </motion.div>
    );
}
