"use client";

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Media } from '@/types/media';
import { getApiUrl } from '@/lib/api';
import { useNavigate } from '@/hooks/useNavigate';
import { updatePlaybackProgress } from '@/lib/playback';

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

                // Sort by ID descending to get latest movies first, exclude current movie
                const sortedByRecent = [...allMovies]
                    .filter(movie => movie.id !== currentMediaId)
                    .sort((a, b) => b.id - a.id)
                    .slice(0, 6);

                setNewMovies(sortedByRecent);
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

    if (isLoading || newMovies.length === 0) {
        return null;
    }

    return (
        <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ delay: 0.4, duration: 0.3 }}
            className="absolute bottom-24 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="bg-black/40 backdrop-blur-sm rounded-lg p-3 border border-white/10">
                <h3 className="text-white/80 text-xs font-medium mb-2 uppercase tracking-wider">
                    New in Library
                </h3>

                <div className="flex gap-3 justify-center">
                    {newMovies.map((movie, index) => (
                        <motion.button
                            key={movie.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.45 + index * 0.05, duration: 0.2 }}
                            onClick={() => handleMovieClick(movie)}
                            className="group flex-shrink-0 relative"
                            title={movie.title}
                        >
                            <div className="relative w-20 h-30 rounded overflow-hidden bg-gray-800">
                                <img
                                    src={movie.poster_path ? `${apiUrl}/api/posters/${movie.id}` : '/placeholder-poster.jpg'}
                                    alt={movie.title}
                                    className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-110"
                                    loading="lazy"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-200" />
                                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                                    <div className="w-7 h-7 bg-white rounded-full flex items-center justify-center">
                                        <svg className="w-4 h-4 text-black ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M8 5v14l11-7z" />
                                        </svg>
                                    </div>
                                </div>
                            </div>

                            {/* Movie title - shown below poster */}
                            <p className="text-white/70 text-xs mt-1.5 truncate w-20 text-center group-hover:text-white transition-colors">
                                {movie.title}
                            </p>
                        </motion.button>
                    ))}
                </div>
            </div>
        </motion.div>
    );
};

export default NewMoviesPauseSection;
