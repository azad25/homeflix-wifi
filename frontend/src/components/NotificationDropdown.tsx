"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Film, Clock } from "lucide-react";
import { Notification } from "@/types/notifications";
import { useNavigate } from "@/hooks/useNavigate";
import { getApiUrl } from "@/lib/api";

interface NotificationDropdownProps {
    isOpen: boolean;
    onClose: () => void;
    notifications: Notification[];
    onNotificationClick: (movieId: number) => void;
}

const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
    isOpen,
    onClose,
    notifications,
    onNotificationClick,
}) => {
    const navigate = useNavigate();
    const [moviePosters, setMoviePosters] = useState<Record<number, string | null>>({});

    // Fetch movie poster URLs
    useEffect(() => {
        const fetchMoviePosters = async () => {
            const apiUrl = getApiUrl();
            const postersToFetch: number[] = [];

            notifications.forEach((notification) => {
                if (notification.movie_ids && notification.movie_ids.length > 0) {
                    notification.movie_ids.forEach((id) => {
                        if (!moviePosters[id]) {
                            postersToFetch.push(id);
                        }
                    });
                }
            });

            // Fetch posters for movies we don't have yet
            for (const movieId of postersToFetch) {
                try {
                    const response = await fetch(`${apiUrl}/api/media/${movieId}`);
                    if (response.ok) {
                        const movie = await response.json();
                        setMoviePosters((prev) => ({
                            ...prev,
                            [movieId]: movie.poster_path
                                ? `${apiUrl}/api/posters/${movieId}`
                                : null,
                        }));
                    }
                } catch (error) {
                    console.error(`Failed to fetch movie ${movieId}:`, error);
                }
            }
        };

        if (notifications.length > 0) {
            fetchMoviePosters();
        }
    }, [notifications]);

    const formatTimestamp = (timestamp: number) => {
        const now = Date.now() / 1000;
        const diff = now - timestamp;

        if (diff < 60) return "Just now";
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
        return new Date(timestamp * 1000).toLocaleDateString();
    };

    const handleNotificationClick = (notification: Notification, index?: number) => {
        // Navigate based on notification type
        if (notification.type === 'tmdb_upcoming' || notification.type === 'tmdb_now_playing') {
            // TMDB movie - navigate to TMDB movie page
            if (notification.tmdb_ids && notification.tmdb_ids.length > 0) {
                const tmdbId = index !== undefined ? notification.tmdb_ids[index] : notification.tmdb_ids[0];
                navigate.push(`/tmdb-movie/${tmdbId}`);
            }
        } else if (notification.type === 'new_episodes' && notification.series_id) {
            // TV series - navigate to series page
            navigate.push(`/tv-series/${notification.series_id}`);
        } else if (notification.movie_ids && notification.movie_ids.length > 0) {
            // Local movie - navigate to local movie page
            const movieId = index !== undefined ? notification.movie_ids[index] : notification.movie_ids[0];
            // Don't navigate if movieId is 0 (media not scanned yet)
            if (movieId && movieId > 0) {
                onNotificationClick(movieId);
                navigate.push(`/movie/${movieId}`);
            }
        }
        onClose();
    };

    const getPosterUrl = (movieId: number) => {
        // Return black placeholder if poster not found
        return (
            moviePosters[movieId] ||
            "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA0OCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDgiIGhlaWdodD0iNjQiIGZpbGw9IiMwMDAwMDAiLz48L3N2Zz4="
        );
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full right-0 mt-2 w-96 bg-black/95 backdrop-blur-sm border border-white/20 rounded-lg shadow-2xl z-50 max-h-[32rem] overflow-hidden flex flex-col"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-white/10">
                        <h3 className="text-white font-semibold text-lg">Notifications</h3>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => {
                                    navigate.push('/notifications');
                                    onClose();
                                }}
                                className="text-red-400 hover:text-red-300 transition-colors text-sm font-medium"
                            >
                                View All
                            </button>
                            <button
                                onClick={onClose}
                                className="text-white/60 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Notifications List */}
                    <div className="flex-1 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-8 text-center">
                                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Film className="w-8 h-8 text-white/40" />
                                </div>
                                <p className="text-white/60">No notifications yet</p>
                                <p className="text-white/40 text-sm mt-1 mb-4">
                                    Check back later for movie recommendations
                                </p>
                                <button
                                    onClick={() => {
                                        navigate.push('/notifications');
                                        onClose();
                                    }}
                                    className="text-red-400 hover:text-red-300 transition-colors text-sm font-medium"
                                >
                                    View Live Activity →
                                </button>
                            </div>
                        ) : (
                            <div className="py-2">
                                {notifications.map((notification) => (
                                    <div
                                        key={notification.id}
                                        className="px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="flex-shrink-0">
                                                <div className="w-10 h-10 bg-red-600/20 rounded-full flex items-center justify-center">
                                                    <Film className="w-5 h-5 text-red-500" />
                                                </div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-white font-medium text-sm mb-1">
                                                    {notification.title}
                                                </h4>
                                                <p className="text-white/70 text-sm mb-2">
                                                    {notification.message}
                                                </p>

                                                {/* Movie suggestions - filter out invalid IDs (0) */}
                                                {notification.movie_ids &&
                                                    notification.movie_ids.filter(id => id > 0).length > 0 && (
                                                        <div className="flex gap-2 flex-wrap pb-2">
                                                            {notification.movie_ids.filter(id => id > 0).slice(0, 4).map((movieId, idx) => (
                                                                <button
                                                                    key={movieId}
                                                                    onClick={() => handleNotificationClick(notification, idx)}
                                                                    className="flex-shrink-0 group relative"
                                                                >
                                                                    <img
                                                                        src={getPosterUrl(movieId)}
                                                                        alt="Movie"
                                                                        className="w-16 h-24 object-cover rounded bg-gray-800 group-hover:ring-2 group-hover:ring-red-500 transition-all"
                                                                    />
                                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors rounded flex items-center justify-center">
                                                                        <Film className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                    </div>
                                                                </button>
                                                            ))}

                                                        </div>
                                                    )}

                                                {/* TMDB Movie suggestions */}
                                                {notification.tmdb_ids &&
                                                    notification.tmdb_ids.length > 0 &&
                                                    notification.tmdb_titles &&
                                                    notification.tmdb_titles.length > 0 && (
                                                        <div className="flex flex-col gap-2">
                                                            <button
                                                                onClick={() => handleNotificationClick(notification)}
                                                                className="flex items-center gap-2 p-2 hover:bg-white/10 rounded transition-colors"
                                                            >
                                                                <div className="w-10 h-10 bg-red-600/20 rounded flex items-center justify-center flex-shrink-0">
                                                                    <Film className="w-5 h-5 text-red-500" />
                                                                </div>
                                                                <div className="flex-1 text-left">
                                                                    <p className="text-white font-medium text-sm">
                                                                        {notification.tmdb_titles[0]}
                                                                    </p>
                                                                    <p className="text-white/60 text-xs">
                                                                        Click to view on TMDB
                                                                    </p>
                                                                </div>
                                                            </button>
                                                        </div>
                                                    )}

                                                {/* Series notification */}
                                                {notification.series_id && notification.series_name && (
                                                    <button
                                                        onClick={() => handleNotificationClick(notification)}
                                                        className="flex items-center gap-2 p-2 hover:bg-white/10 rounded transition-colors"
                                                    >
                                                        <div className="w-10 h-10 bg-blue-600/20 rounded flex items-center justify-center flex-shrink-0">
                                                            <Film className="w-5 h-5 text-blue-500" />
                                                        </div>
                                                        <div className="flex-1 text-left">
                                                            <p className="text-white font-medium text-sm">
                                                                {notification.series_name}
                                                            </p>
                                                            <p className="text-white/60 text-xs">
                                                                {notification.episode_ids?.length || 0} new episodes
                                                            </p>
                                                        </div>
                                                    </button>
                                                )}

                                                {/* Timestamp */}
                                                <div className="flex items-center gap-1 text-white/40 text-xs mt-2">
                                                    <Clock className="w-3 h-3" />
                                                    <span>{formatTimestamp(notification.timestamp)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                
                                {/* Footer with View All link */}
                                {notifications.length > 0 && (
                                    <div className="border-t border-white/10 p-4">
                                        <button
                                            onClick={() => {
                                                navigate.push('/notifications');
                                                onClose();
                                            }}
                                            className="w-full text-center text-red-400 hover:text-red-300 transition-colors text-sm font-medium py-2 hover:bg-white/5 rounded"
                                        >
                                            View All Notifications in Live Activity →
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default NotificationDropdown;
