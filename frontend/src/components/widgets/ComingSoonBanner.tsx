"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Clock, Play, Star, Bell, Plus, Check, Info, Sparkles, Timer } from 'lucide-react';
import { Media } from '@/types/media';
import { getApiUrl } from '@/lib/api';
import { getColorPaletteByGenre, DominantColors } from '@/types/widgets';
import { useNavigate } from '@/hooks/useNavigate';

interface ComingSoonBannerProps {
    movies: Media[];
    autoScroll?: boolean;
    scrollInterval?: number;
    className?: string;
}

// Calculate days until release
function getDaysUntilRelease(releaseDate: string): number {
    const now = new Date();
    const release = new Date(releaseDate);
    const diff = release.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// Format date
function formatReleaseDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });
}

export default function ComingSoonBanner({
    movies,
    autoScroll = true,
    scrollInterval = 10,
    className = '',
}: ComingSoonBannerProps) {
    const navigate = useNavigate();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isHovering, setIsHovering] = useState(false);
    const [notifyEnabled, setNotifyEnabled] = useState<Set<number>>(new Set());
    const [isInMyList, setIsInMyList] = useState<Set<number>>(new Set());
    const [imageLoaded, setImageLoaded] = useState(false);

    const apiUrl = getApiUrl();
    const currentMovie = movies[currentIndex];

    // Auto-scroll
    useEffect(() => {
        if (autoScroll && !isHovering && movies.length > 1) {
            const timer = setInterval(() => {
                setCurrentIndex((prev) => (prev + 1) % movies.length);
                setImageLoaded(false);
            }, scrollInterval * 1000);
            return () => clearInterval(timer);
        }
    }, [autoScroll, isHovering, movies.length, scrollInterval]);

    const toggleNotify = (movieId: number) => {
        setNotifyEnabled(prev => {
            const newSet = new Set(prev);
            if (newSet.has(movieId)) {
                newSet.delete(movieId);
            } else {
                newSet.add(movieId);
            }
            return newSet;
        });
    };

    const toggleMyList = (movieId: number) => {
        setIsInMyList(prev => {
            const newSet = new Set(prev);
            if (newSet.has(movieId)) {
                newSet.delete(movieId);
            } else {
                newSet.add(movieId);
            }
            return newSet;
        });
    };

    if (!currentMovie) return null;

    const releaseDate = currentMovie.release_date || '';
    const daysUntil = releaseDate ? getDaysUntilRelease(releaseDate) : 0;
    const colors = getColorPaletteByGenre(currentMovie.genre_names || []);
    const posterUrl = currentMovie.tmdb_poster_url || (currentMovie.poster_path ? 
        `https://image.tmdb.org/t/p/w500${currentMovie.poster_path}` : '');
    const backdropUrl = currentMovie.tmdb_backdrop_url || (currentMovie.banner_path ? 
        currentMovie.banner_path : '');
    const overview = currentMovie.description || currentMovie.long_desc || currentMovie.short_desc || '';
    const rating = currentMovie.rating || 0;

    return (
        <div
            className={`relative w-full h-[400px] md:h-[500px] lg:h-[600px] overflow-hidden rounded-2xl ${className}`}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
        >
            {/* Enhanced Backdrop */}
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
                        src={backdropUrl}
                        alt={currentMovie.title}
                        className="w-full h-full object-cover"
                        onLoad={() => setImageLoaded(true)}
                        onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = posterUrl;
                        }}
                    />
                </motion.div>
            </AnimatePresence>

            {/* Enhanced Overlays */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
            <div 
                className="absolute bottom-0 left-0 right-0 h-40"
                style={{
                    background: `linear-gradient(to top, ${colors.primary}20 0%, transparent 100%)`
                }}
            />

            {/* Enhanced Coming Soon Badge */}
            <div className="absolute top-4 left-4 md:left-6 z-20">
                <motion.div
                    className="flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-md border"
                    style={{
                        background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.accent} 100%)`,
                        borderColor: `${colors.primary}60`,
                        boxShadow: `0 0 30px ${colors.primary}40`
                    }}
                    animate={{ 
                        scale: [1, 1.05, 1],
                        boxShadow: [
                            `0 0 30px ${colors.primary}40`,
                            `0 0 40px ${colors.primary}60`,
                            `0 0 30px ${colors.primary}40`
                        ]
                    }}
                    transition={{ duration: 3, repeat: Infinity }}
                >
                    <Sparkles className="w-4 h-4 text-white" />
                    <span className="font-bold text-xs text-white uppercase tracking-wider">Coming Soon</span>
                </motion.div>
            </div>

            {/* Countdown Timer */}
            {daysUntil > 0 && (
                <div className="absolute top-4 right-4 z-20">
                    <div 
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md border"
                        style={{
                            backgroundColor: `${colors.primary}20`,
                            borderColor: `${colors.primary}40`
                        }}
                    >
                        <Timer className="w-3.5 h-3.5 text-white" />
                        <span className="text-white font-semibold text-xs">
                            {daysUntil} {daysUntil === 1 ? 'day' : 'days'}
                        </span>
                    </div>
                </div>
            )}

            {/* Enhanced Content */}
            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 lg:p-12 z-10">
                <div className="flex flex-col lg:flex-row gap-6 items-end">
                    {/* Enhanced Poster */}
                    <motion.div
                        initial={{ opacity: 0, y: 50, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        className="hidden md:block flex-shrink-0"
                    >
                        <div className="relative w-32 lg:w-40 rounded-xl overflow-hidden shadow-2xl border-2 border-white/20 group">
                            <img
                                src={posterUrl}
                                alt={currentMovie.title}
                                className="w-full h-auto transition-transform duration-300 group-hover:scale-105"
                            />
                            {/* Poster Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            <div className="absolute bottom-3 left-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <div className="text-center">
                                    <button 
                                        className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
                                        onClick={() => navigate.push(`/tmdb-movie/${currentMovie.id}`)}
                                    >
                                        <Play className="w-4 h-4 text-white fill-current ml-0.5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Enhanced Info */}
                    <div className="flex-1 max-w-2xl">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentIndex}
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.8, ease: "easeOut" }}
                            >
                                {/* Enhanced Title - Logo or Text */}
                                {currentMovie.logo_path ? (
                                    <img
                                        src={currentMovie.logo_path.startsWith('http') ? 
                                            currentMovie.logo_path : 
                                            `${apiUrl}/api/logos/${currentMovie.logo_path.includes('/') ? 
                                                currentMovie.logo_path.split('/').pop() : currentMovie.logo_path}`}
                                        alt={currentMovie.title}
                                        className="max-h-16 md:max-h-20 lg:max-h-24 w-auto mb-4 drop-shadow-2xl"
                                        onError={(e) => {
                                            // Fallback to text if logo fails to load
                                            e.currentTarget.style.display = 'none';
                                            const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                            if (fallback) fallback.style.display = 'block';
                                        }}
                                    />
                                ) : null}
                                <h2 
                                    className="text-2xl md:text-3xl lg:text-4xl font-bold mb-4 leading-tight"
                                    style={{
                                        display: currentMovie.logo_path ? 'none' : 'block',
                                        textShadow: `0 0 40px ${colors.primary}60, 0 4px 20px rgba(0,0,0,0.8)`,
                                        background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.accent} 100%)`,
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                        backgroundClip: 'text'
                                    }}
                                >
                                    {currentMovie.title}
                                </h2>

                                {/* Enhanced Release Info */}
                                <div className="flex flex-wrap items-center gap-3 mb-4">
                                    <div 
                                        className="flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md border"
                                        style={{
                                            backgroundColor: `${colors.primary}20`,
                                            borderColor: `${colors.primary}40`
                                        }}
                                    >
                                        <Calendar className="w-4 h-4 text-white" />
                                        <span className="text-white font-medium text-sm">
                                            {releaseDate ? formatReleaseDate(releaseDate) : 'Release date TBA'}
                                        </span>
                                    </div>
                                    
                                    {daysUntil > 0 && (
                                        <div 
                                            className="px-3 py-1.5 rounded-full backdrop-blur-md border animate-pulse"
                                            style={{
                                                backgroundColor: `${colors.accent}30`,
                                                borderColor: `${colors.accent}50`
                                            }}
                                        >
                                            <span className="font-bold text-white text-sm">
                                                {daysUntil} {daysUntil === 1 ? 'day' : 'days'} to go!
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Enhanced Rating & Genres */}
                                <div className="flex flex-wrap items-center gap-3 mb-4">
                                    {rating > 0 && (
                                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-500/20 border border-yellow-400/30">
                                            <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                                            <span className="font-semibold text-yellow-300 text-sm">{rating.toFixed(1)}</span>
                                            <span className="text-yellow-200/80 text-xs">Expected</span>
                                        </div>
                                    )}
                                    
                                    {currentMovie.genre_names && currentMovie.genre_names.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5">
                                            {currentMovie.genre_names.slice(0, 3).map((genre, idx) => (
                                                <span
                                                    key={idx}
                                                    className="px-2.5 py-1 rounded-full text-xs font-medium backdrop-blur-sm border"
                                                    style={{
                                                        backgroundColor: `${colors.primary}15`,
                                                        borderColor: `${colors.primary}30`,
                                                        color: colors.accent
                                                    }}
                                                >
                                                    {genre}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Enhanced Overview */}
                                {overview && (
                                    <p className="text-base md:text-lg text-white/90 line-clamp-3 mb-6 max-w-2xl leading-relaxed">
                                        {overview}
                                    </p>
                                )}

                                {/* Enhanced Actions */}
                                <div className="flex flex-wrap items-center gap-3">
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        className="flex items-center gap-2 px-6 py-3 bg-white text-black font-bold rounded-lg hover:bg-white/90 transition-all shadow-2xl text-sm"
                                        onClick={() => navigate.push(`/tmdb-movie/${currentMovie.id}`)}
                                    >
                                        <Play className="w-4 h-4 fill-current" />
                                        Watch Trailer
                                    </motion.button>
                                    
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => toggleNotify(currentMovie.id)}
                                        className="flex items-center gap-2 px-4 py-3 backdrop-blur-md border font-semibold rounded-lg transition-all text-sm"
                                        style={{
                                            backgroundColor: notifyEnabled.has(currentMovie.id) 
                                                ? `${colors.primary}40` 
                                                : `${colors.primary}20`,
                                            borderColor: `${colors.primary}50`,
                                            color: 'white'
                                        }}
                                    >
                                        <Bell className={`w-4 h-4 ${notifyEnabled.has(currentMovie.id) ? 'fill-current' : ''}`} />
                                        {notifyEnabled.has(currentMovie.id) ? 'Notified' : 'Remind Me'}
                                    </motion.button>
                                    
                                    <motion.button
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => toggleMyList(currentMovie.id)}
                                        className="p-3 backdrop-blur-md rounded-full border transition-all"
                                        style={{ 
                                            backgroundColor: isInMyList.has(currentMovie.id) ? `${colors.primary}40` : `${colors.primary}20`,
                                            borderColor: `${colors.primary}50`
                                        }}
                                    >
                                        {isInMyList.has(currentMovie.id) ? 
                                            <Check className="w-4 h-4" style={{ color: colors.primary }} /> : 
                                            <Plus className="w-4 h-4 text-white" />
                                        }
                                    </motion.button>
                                    
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => navigate.push(`/tmdb-movie/${currentMovie.id}`)}
                                        className="flex items-center gap-2 px-4 py-3 backdrop-blur-md border font-semibold rounded-lg transition-all text-sm"
                                        style={{ 
                                            backgroundColor: `${colors.secondary}20`,
                                            borderColor: `${colors.secondary}40`,
                                            color: 'white'
                                        }}
                                    >
                                        <Info className="w-4 h-4" />
                                        More Info
                                    </motion.button>
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* Enhanced Navigation Dots */}
            {movies.length > 1 && (
                <div className="absolute bottom-6 right-6 flex items-center gap-2 z-20">
                    {movies.slice(0, 6).map((movie, idx) => (
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
                                    idx === currentIndex ? 'w-8' : 'w-2'
                                }`}
                                style={{
                                    backgroundColor: idx === currentIndex ? colors.primary : 'rgba(255,255,255,0.4)',
                                    boxShadow: idx === currentIndex ? `0 0 15px ${colors.primary}80` : 'none'
                                }}
                            />
                            {/* Tooltip */}
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/90 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                {movie.title}
                            </div>
                        </motion.button>
                    ))}
                    {movies.length > 6 && (
                        <span className="text-xs text-white/50 ml-1 font-medium">
                            +{movies.length - 6} more
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}
