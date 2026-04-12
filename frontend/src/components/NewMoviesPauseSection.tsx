"use client";

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Media } from '@/types/media';
import { getApiUrl } from '@/lib/api';
import { useNavigate } from '@/hooks/useNavigate';
import { updatePlaybackProgress } from '@/lib/playback';
import AutoSlidingBanner from './AutoSlidingBanner';

interface NewMoviesPauseSectionProps {
    currentMediaId: number;
    currentTime: number;
    duration: number;
    onClose: () => void;
}

const NewMoviesPauseSection: React.FC<NewMoviesPauseSectionProps> = ({
    currentMediaId,
    currentTime,
    duration,
    onClose,
}) => {
    const navigate = useNavigate();
    const [newMovies, setNewMovies] = useState<Media[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const apiUrl = getApiUrl();

    useEffect(() => {
        const fetchNewMovies = async () => {
            try {
                setIsLoading(true);
                const response = await fetch(`${apiUrl}/api/media/movies`);

                if (!response.ok) {
                    throw new Error('Failed to fetch movies');
                }

                const allMovies: Media[] = await response.json();

                // Backend already returns movies sorted by created_at DESC, just filter current movie
                const latestMovies = allMovies
                    .filter(movie => movie.id !== currentMediaId)
                    .slice(0, 6);

                setNewMovies(latestMovies);
            } catch (error) {
                console.error('Failed to fetch new movies:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchNewMovies();
    }, [apiUrl, currentMediaId]);

    const handleMovieClick = async (movie: Media) => {
        // Save current playback progress before navigating
        if (currentMediaId && duration > 0) {
            await updatePlaybackProgress(currentMediaId, currentTime, duration);
        }

        // Close the video player and navigate
        onClose();
        navigate.push(`/movie/${movie.id}`);
    };

    const getBackdropUrl = (movie: Media) => {
        if (movie.tmdb_backdrop_url) return movie.tmdb_backdrop_url;
        if (movie.banner_path) return `${apiUrl}/api/admin/assets/${movie.banner_path.split('/').pop()}`;
        return `${apiUrl}/api/thumbnails/${movie.id}`;
    };

    const getLogoUrl = (movie: Media) => {
        if (!movie.logo_path) return null;
        if (movie.logo_path.startsWith('http')) return movie.logo_path;
        if (movie.logo_path.startsWith('/api/')) return `${apiUrl}${movie.logo_path}`;
        const filename = movie.logo_path.includes('/') ? movie.logo_path.split('/').pop() : movie.logo_path;
        return `${apiUrl}/api/logos/${filename}`;
    };

    if (isLoading || newMovies.length === 0) {
        return null;
    }

    const sliderMovies = newMovies.slice(0, 3);
    const sideBackdropMovies = newMovies.slice(3, 5);

    return (
        <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ delay: 0.4, duration: 0.3 }}
            className="absolute top-[70%] left-1/2 -translate-x-1/2 w-full max-w-[44rem] px-3 md:px-4"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="w-full">
                <h3 className="text-white/80 text-xs font-medium mb-3 uppercase tracking-wider px-1">
                    New in Library
                </h3>

                <div className="grid grid-cols-12 gap-3 md:gap-4 items-stretch">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.45, duration: 0.3 }}
                        className="col-span-12 md:col-span-7 relative aspect-[16/7] rounded-xl overflow-hidden shadow-2xl border border-white/15"
                    >
                        <AutoSlidingBanner
                            movies={sliderMovies}
                            getBackdropUrl={getBackdropUrl}
                            getLogoUrl={getLogoUrl}
                            onClick={handleMovieClick}
                            isLarge={true}
                            showNewTag={true}
                            newTagText="New"
                            logoMinWidthClass="min-w-[120px]"
                            logoMaxWidthClass="max-w-[50%]"
                            requireCurrentYearForNewTag={true}
                            recentMovieIds={sliderMovies.map(movie => movie.id)}
                        />
                    </motion.div>

                    <div className="col-span-12 md:col-span-5 flex gap-3 md:gap-4">
                        {sideBackdropMovies.map((movie, index) => {
                            const logoUrl = getLogoUrl(movie);
                            return (
                                <motion.button
                                    key={movie.id}
                                    initial={{ opacity: 0, x: 12 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.52 + index * 0.08, duration: 0.28 }}
                                    onClick={() => handleMovieClick(movie)}
                                    className="group relative aspect-square rounded-xl overflow-hidden border border-white/10 shadow-xl flex-1"
                                    title={movie.title}
                                >
                                    <img
                                        src={getBackdropUrl(movie)}
                                        alt={movie.title}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                        loading="lazy"
                                        onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            target.src = `${apiUrl}/api/thumbnails/${movie.id}`;
                                        }}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent" />
                                    <div className="absolute bottom-3 left-3 right-3">
                                        {logoUrl ? (
                                            <img
                                                src={logoUrl}
                                                alt={movie.title}
                                                className="w-2/3 max-h-[50%] object-contain object-left drop-shadow-2xl"
                                                onError={(e) => {
                                                    e.currentTarget.style.display = 'none';
                                                    const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                                    if (fallback) fallback.style.display = 'block';
                                                }}
                                            />
                                        ) : null}
                                        <h4
                                            className="text-white text-sm font-bold drop-shadow-lg line-clamp-1"
                                            style={{ display: logoUrl ? 'none' : 'block' }}
                                        >
                                            {movie.title}
                                        </h4>
                                    </div>
                                </motion.button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default NewMoviesPauseSection;
