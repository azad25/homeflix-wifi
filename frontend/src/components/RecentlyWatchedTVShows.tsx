"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Play, Clock, Info, Star, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Media } from '@/types/media';
import { getApiUrl } from '@/lib/api';
import { cleanMovieTitle } from '@/lib/titleUtils';
import { useNavigate } from '@/hooks/useNavigate';
import ImageWithFallback from '@/components/ImageWithFallback';
import { useAudio } from '@/contexts/EnhancedAudioContext';

interface RecentlyWatchedItem {
    id: number;
    media_id: number;
    user_id: number;
    last_watched_at: string;
    progress_seconds: number;
    duration_seconds: number;
    media: Media;
}

interface RecentlyWatchedTVShowsProps {
    onPlay: (media: Media, startTime?: number) => void;
    onInfo: (media: Media) => void;
}

interface RecentlyWatchedTVCardProps {
    item: RecentlyWatchedItem;
    onPlay: (media: Media, startTime?: number) => void;
    onInfo: (media: Media) => void;
    index: number;
    mutePageAudio?: () => void;
}

const RecentlyWatchedTVCard: React.FC<RecentlyWatchedTVCardProps> = ({
    item,
    onPlay,
    onInfo,
    index,
    mutePageAudio
}) => {
    const navigate = useNavigate();
    const [isHovered, setIsHovered] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handlePlayClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsLoading(true);

        // Mute all page audio before playback
        if (mutePageAudio) {
            mutePageAudio();
        }

        setTimeout(() => {
            onPlay(item.media, item.progress_seconds);
            setIsLoading(false);
        }, 300);
    };

    const handleInfoClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        const seriesId = item.media.series_id || item.media.id;
        navigate.push(`/tv-series/${seriesId}`);
    };

    const handleCardClick = () => {
        const seriesId = item.media.series_id || item.media.id;
        navigate.push(`/tv-series/${seriesId}`);
    };

    const formatProgress = (progressSeconds: number, durationSeconds: number) => {
        const progressPercent = (progressSeconds / durationSeconds) * 100;
        return Math.min(Math.max(progressPercent, 0), 100);
    };

    const formatTime = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    };

    const formatLastWatched = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);

        if (diffHours < 1) return 'Just now';
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    const getSeriesTitle = () => {
        // Extract series title from episode title
        const title = item.media.title;
        // Remove episode information (e.g., "Series Name - S01E01" => "Series Name")
        return title.replace(/\s*-\s*S\d+E\d+.*$/i, '').trim();
    };

    const getEpisodeInfo = () => {
        // Extract episode info (e.g., "S01E01")
        const match = item.media.title.match(/S(\d+)E(\d+)/i);
        if (match) {
            return `S${match[1]} E${match[2]}`;
        }
        return null;
    };

    const getSeriesPosterUrl = () => {
        const seriesId = item.media.series_id || item.media.id;
        return `${getApiUrl()}/api/series/${seriesId}/poster`;
    };

    const progressPercent = formatProgress(item.progress_seconds, item.duration_seconds);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className="relative group cursor-pointer flex-none w-[280px]"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={handleCardClick}
        >
            <motion.div
                className="relative bg-zinc-900 rounded-md overflow-hidden shadow-lg"
                animate={{
                    scale: isHovered ? 1.05 : 1,
                    y: isHovered ? -8 : 0,
                }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                style={{
                    transformOrigin: 'center center',
                    zIndex: isHovered ? 50 : 1,
                }}
            >
                {/* Poster Container - Netflix style vertical poster */}
                <div className="relative w-full aspect-[2/3] overflow-hidden bg-zinc-800">
                    <img
                        src={getSeriesPosterUrl()}
                        alt={getSeriesTitle()}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading={index < 3 ? "eager" : "lazy"}
                        onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            // Fallback to episode thumbnail
                            if (!target.src.includes('/api/thumbnails/')) {
                                target.src = `${getApiUrl()}/api/thumbnails/${item.media.id}`;
                            } else {
                                // Final fallback: Show gradient with series initial
                                const parent = target.parentElement!;
                                parent.innerHTML = `
                  <div class="w-full h-full bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center">
                    <span class="text-6xl font-bold text-white">${getSeriesTitle().charAt(0)}</span>
                  </div>
                `;
                            }
                        }}
                    />

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

                    {/* Episode Badge */}
                    {getEpisodeInfo() && (
                        <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-1 text-xs font-bold rounded shadow-lg">
                            {getEpisodeInfo()}
                        </div>
                    )}

                    {/* Time Remaining Badge */}
                    <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-sm text-white text-xs px-2 py-1 rounded shadow-lg">
                        {formatTime(item.duration_seconds - item.progress_seconds)} left
                    </div>

                    {/* Play Button Overlay */}
                    <AnimatePresence>
                        {isHovered && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                className="absolute inset-0 flex items-center justify-center z-20 bg-black/40"
                            >
                                <button
                                    onClick={handlePlayClick}
                                    disabled={isLoading}
                                    className="bg-white/95 backdrop-blur-sm rounded-full p-4 hover:bg-white transition-all duration-200 shadow-xl hover:scale-110"
                                >
                                    {isLoading ? (
                                        <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <Play className="w-6 h-6 text-black fill-black" />
                                    )}
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Progress Bar */}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-700">
                        <motion.div
                            className="bg-red-600 h-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${progressPercent}%` }}
                            transition={{ duration: 0.8, delay: index * 0.1 }}
                        />
                    </div>

                    {/* Info at bottom - Netflix style */}
                    <div className="absolute bottom-0 left-0 right-0 p-3 z-10">
                        {/* Series Title */}
                        <h3 className="text-white font-bold text-base line-clamp-1 mb-1 drop-shadow-lg">
                            {getSeriesTitle()}
                        </h3>

                        {/* Episode Title if different */}
                        {item.media.title !== getSeriesTitle() && (
                            <p className="text-gray-300 text-xs line-clamp-1 mb-2">
                                {cleanMovieTitle(item.media.title)}
                            </p>
                        )}

                        {/* Progress Info */}
                        <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1 text-gray-400">
                                <Clock className="w-3 h-3" />
                                <span>{formatLastWatched(item.last_watched_at)}</span>
                            </div>
                            <span className="text-green-400 font-medium">
                                {Math.round(progressPercent)}%
                            </span>
                        </div>
                    </div>
                </div>

                {/* Action Buttons - Show on Hover */}
                <AnimatePresence>
                    {isHovered && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute bottom-3 right-3 flex gap-2 z-30"
                        >
                            <button
                                onClick={handleInfoClick}
                                className="bg-zinc-800/95 backdrop-blur-sm text-white p-2 rounded-full hover:bg-zinc-700/95 transition-colors shadow-lg"
                                title="More Info"
                            >
                                <Info className="w-4 h-4" />
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </motion.div>
    );
};

export const RecentlyWatchedTVShows: React.FC<RecentlyWatchedTVShowsProps> = ({
    onPlay,
    onInfo
}) => {
    const { muteAll } = useAudio();
    const [recentItems, setRecentItems] = useState<RecentlyWatchedItem[]>([]);
    const [loading, setLoading] = useState(true);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [isHovered, setIsHovered] = useState(false);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchRecentlyWatched();
    }, []);

    const updateScrollButtons = () => {
        if (!scrollContainerRef.current) return;

        const container = scrollContainerRef.current;
        const maxScroll = container.scrollWidth - container.clientWidth;

        setCanScrollLeft(container.scrollLeft > 10);
        setCanScrollRight(container.scrollLeft < maxScroll - 10);
    };

    useEffect(() => {
        // Initial check with slight delay to ensure DOM is ready
        const timeout = setTimeout(() => {
            updateScrollButtons();
        }, 100);

        const container = scrollContainerRef.current;
        if (container) {
            container.addEventListener('scroll', updateScrollButtons);
            // Also check on resize
            window.addEventListener('resize', updateScrollButtons);
            return () => {
                clearTimeout(timeout);
                container.removeEventListener('scroll', updateScrollButtons);
                window.removeEventListener('resize', updateScrollButtons);
            };
        }
    }, [recentItems]);

    const scrollLeft = () => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollBy({ left: -300, behavior: 'smooth' });
        }
    };

    const scrollRight = () => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollBy({ left: 300, behavior: 'smooth' });
        }
    };

    const fetchRecentlyWatched = async () => {
        try {
            setLoading(true);
            setError(null);
            const apiUrl = getApiUrl();
            const response = await fetch(`${apiUrl}/api/playback/recently-watched`, {
                headers: {
                    'X-User-ID': '1' // Default user for now
                }
            });

            if (response.ok) {
                const data = await response.json();
                // Filter only TV show episodes
                const validItems = (data || [])
                    .filter((item: RecentlyWatchedItem) => {
                        // Only include TV episodes and series
                        return item.media &&
                            item.media.id &&
                            item.media.title &&
                            (item.media.type === 'episode' ||
                                item.media.type === 'tv' ||
                                item.media.type === 'series');
                    })
                    .sort((a: RecentlyWatchedItem, b: RecentlyWatchedItem) => {
                        return new Date(b.last_watched_at).getTime() - new Date(a.last_watched_at).getTime();
                    })
                    .slice(0, 10); // Limit to 10 items

                setRecentItems(validItems);
                console.log(`✅ Loaded ${validItems.length} recently watched TV shows`);
            } else if (response.status === 404) {
                setRecentItems([]);
                console.log('📝 No recently watched TV shows found');
            } else {
                throw new Error(`Failed to fetch recently watched items: ${response.status}`);
            }
        } catch (error) {
            console.error('Failed to fetch recently watched TV shows:', error);
            setError('Failed to load recently watched TV shows');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="mb-12">
                <div className="flex items-center justify-between mb-6 px-4 md:px-0">
                    <h2 className="text-white text-2xl font-bold">
                        Continue Watching
                    </h2>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-4 px-4 md:px-0" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    <style jsx>{`
            div::-webkit-scrollbar {
              display: none;
            }
          `}</style>
                    {[...Array(4)].map((_, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: i * 0.1 }}
                            className="flex-none w-[280px] aspect-[2/3] bg-zinc-800/50 rounded-md animate-pulse backdrop-blur-sm border border-zinc-700/30"
                        />
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="mb-12">
                <div className="flex items-center justify-between mb-6 px-4 md:px-0">
                    <h2 className="text-white text-2xl font-bold">
                        Continue Watching
                    </h2>
                </div>
                <div className="px-4 md:px-0">
                    <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6 text-center">
                        <p className="text-red-400 mb-4">{error}</p>
                        <button
                            onClick={fetchRecentlyWatched}
                            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (recentItems.length === 0) {
        return null;
    }

    return (
        <div className="mb-12">
            <div className="flex items-center justify-between mb-6 px-4 md:px-0">
                <h2 className="text-white text-2xl font-bold">
                    Continue Watching
                </h2>
                <button
                    onClick={fetchRecentlyWatched}
                    className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10"
                    title="Refresh"
                >
                    <RotateCcw className="w-5 h-5" />
                </button>
            </div>

            <div
                className="relative"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                {/* Previous Button */}
                <AnimatePresence>
                    {isHovered && canScrollLeft && (
                        <motion.button
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            onClick={scrollLeft}
                            className="absolute left-0 top-1/2 -translate-y-1/2 z-[150] bg-black/95 hover:bg-red-600/90 text-white p-3 rounded-full shadow-2xl backdrop-blur-md transition-all hover:scale-110 border border-red-900/50"
                            style={{ marginLeft: '8px' }}
                        >
                            <ChevronLeft className="w-6 h-6" />
                        </motion.button>
                    )}
                </AnimatePresence>

                {/* Next Button */}
                <AnimatePresence>
                    {isHovered && canScrollRight && (
                        <motion.button
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            onClick={scrollRight}
                            className="absolute right-0 top-1/2 -translate-y-1/2 z-[150] bg-black/95 hover:bg-red-600/90 text-white p-3 rounded-full shadow-2xl backdrop-blur-md transition-all hover:scale-110 border border-red-900/50"
                            style={{ marginRight: '8px' }}
                        >
                            <ChevronRight className="w-6 h-6" />
                        </motion.button>
                    )}
                </AnimatePresence>

                <div
                    ref={scrollContainerRef}
                    className="flex gap-4 overflow-x-auto pb-4 px-4 md:px-0"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                    <style jsx>{`
            div::-webkit-scrollbar {
              display: none;
            }
          `}</style>
                    {recentItems.map((item, index) => (
                        <RecentlyWatchedTVCard
                            key={item.id}
                            item={item}
                            onPlay={onPlay}
                            onInfo={onInfo}
                            index={index}
                            mutePageAudio={muteAll}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default RecentlyWatchedTVShows;
