"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Splide, SplideSlide } from "@splidejs/react-splide";
import "@splidejs/react-splide/css";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Volume2, VolumeX, Plus, Check } from "lucide-react";
import { getApiUrl } from "@/lib/api";
import { Media } from "@/types/media";
import { cleanMovieTitle } from "@/lib/titleUtils";

interface HomeflixHeroProps {
    onPlay: (media: Media) => void;
    onInfo: (media: Media) => void;
    maxMovies?: number;
    contentFilter?: 'movies-hd' | 'tv-series' | 'all';
    playCountPerSlide?: number; // How many times to play video before advancing
    sortMode?: 'latest' | 'mixed'; // 'latest' = newest first, 'mixed' = random selection of old and new
}

const HomeflixHero: React.FC<HomeflixHeroProps> = ({
    onPlay,
    onInfo,
    maxMovies = 10,
    contentFilter = 'movies-hd',
    playCountPerSlide = 1, // Default: play each video 1 time
    sortMode = 'latest', // Default: show latest movies first
}) => {
    const [movies, setMovies] = useState<Media[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeSlideIndex, setActiveSlideIndex] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [videoLoaded, setVideoLoaded] = useState(false);
    const [myList, setMyList] = useState<Set<number>>(new Set());
    const [cycleCount, setCycleCount] = useState(0);
    const [isLoadingNewContent, setIsLoadingNewContent] = useState(false);
    const [previousMediaIds, setPreviousMediaIds] = useState<Set<number>>(new Set());
    const [currentPlayCount, setCurrentPlayCount] = useState(0); // Track how many times current video has played

    const mainSliderRef = useRef<Splide>(null);
    const thumbsSliderRef = useRef<Splide>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const preloadedVideos = useRef<Map<number, HTMLVideoElement>>(new Map());
    const preloadedUrls = useRef<Map<number, string>>(new Map());
    const prefetchedMovies = useRef<Media[] | null>(null); // Store prefetched next batch
    const isPrefetching = useRef(false);
    const apiUrl = getApiUrl();

    // Audio preference management
    const audioPreferences = useMemo(() => ({
        getGlobalAudioPreference: (): boolean => {
            if (typeof window === 'undefined') return false;
            const saved = localStorage.getItem('homeflix-hero-audio-muted');
            return saved !== null ? JSON.parse(saved) : false;
        },
        setGlobalAudioPreference: (muted: boolean) => {
            if (typeof window === 'undefined') return;
            localStorage.setItem('homeflix-hero-audio-muted', JSON.stringify(muted));
        },
        hasUserEverUnmuted: (): boolean => {
            if (typeof window === 'undefined') return true;
            return localStorage.getItem('homeflix-hero-user-unmuted') !== 'false';
        },
        setUserHasUnmuted: () => {
            if (typeof window === 'undefined') return;
            localStorage.setItem('homeflix-hero-user-unmuted', 'true');
        }
    }), []);

    // Initialize audio preference on mount
    useEffect(() => {
        const savedMutedState = audioPreferences.getGlobalAudioPreference();
        setIsMuted(savedMutedState);
    }, [audioPreferences]);

    // Get preview clip URL with cache headers
    const getPreviewClipUrl = useCallback((movie: Media): string => {
        return `${apiUrl}/api/preview-clips/${movie.id}?quality=high&format=mp4&cache=true`;
    }, [apiUrl]);

    // Preload a single video
    const preloadVideo = useCallback((movie: Media) => {
        if (preloadedVideos.current.has(movie.id)) return;

        const url = getPreviewClipUrl(movie);
        preloadedUrls.current.set(movie.id, url);

        const video = document.createElement('video');
        video.preload = 'auto';
        video.muted = true;
        video.playsInline = true;
        video.crossOrigin = 'anonymous';
        video.src = url;

        // Start loading
        video.load();

        preloadedVideos.current.set(movie.id, video);
        console.log(`🎬 Preloading video for: ${movie.title} (ID: ${movie.id})`);
    }, [getPreviewClipUrl]);

    // Preload all videos for faster playback
    const preloadAllVideos = useCallback((mediaList: Media[]) => {
        // Clear old preloaded videos
        preloadedVideos.current.forEach((video) => {
            video.pause();
            video.src = '';
            video.load();
        });
        preloadedVideos.current.clear();
        preloadedUrls.current.clear();

        // Preload new videos
        mediaList.forEach((movie) => {
            preloadVideo(movie);
        });

        console.log(`✅ Preloading ${mediaList.length} videos`);
    }, [preloadVideo]);

    // Fetch movies with preview clips - simplified for speed
    const fetchMoviesWithPreviews = useCallback(async (cycle: number = 0) => {
        setIsLoadingNewContent(true);
        try {
            // Fetch directly from library for fastest response
            const response = await fetch(`${apiUrl}/api/media/movies`);
            if (!response.ok) throw new Error('Failed to fetch movies');

            const allMovies: Media[] = await response.json();

            // Apply content filtering
            let filteredMedia = allMovies;
            if (contentFilter === 'movies-hd') {
                filteredMedia = allMovies.filter((media: Media) => {
                    const isMovie = media.type === 'movie';
                    const hasHDQuality = media.quality && (
                        media.quality.toLowerCase().includes('hd') ||
                        media.quality.toLowerCase().includes('4k') ||
                        media.quality.toLowerCase().includes('1080p') ||
                        media.quality.toLowerCase().includes('2160p')
                    );
                    // Must have file_path for preview clips
                    const hasFilePath = !!media.file_path;
                    // Must have poster (poster_path or tmdb_poster_url)
                    const hasPoster = !!(media.poster_path || media.tmdb_poster_url);
                    // Must have backdrop (tmdb_backdrop_url, banner_path, or thumbnail_path)
                    const hasBackdrop = !!(media.tmdb_backdrop_url || media.banner_path || media.thumbnail_path);
                    // Must have minimum 1 hour (60 minutes) duration
                    const hasMinDuration = media.duration && media.duration >= 60;
                    return isMovie && (hasHDQuality || !media.quality) && hasFilePath && hasPoster && hasBackdrop && hasMinDuration;
                });
            } else if (contentFilter === 'tv-series') {
                filteredMedia = allMovies.filter((media: Media) => {
                    return media.type === 'episode' ||
                        media.type === 'tv' ||
                        media.type === 'series';
                });
            }

            // Sort based on sortMode
            let sortedMovies: Media[];
            if (sortMode === 'mixed') {
                // Mixed mode: shuffle to get a random mix of old and new movies
                sortedMovies = filteredMedia
                    .sort(() => Math.random() - 0.5); // Random shuffle
            } else {
                // Latest mode: sort by ID (newest/latest first)
                sortedMovies = filteredMedia
                    .sort((a, b) => (b.id || 0) - (a.id || 0));
            }

            // For cycles > 0, skip already shown movies
            const startIndex = cycle * maxMovies;
            const selectedMovies = sortedMovies.slice(startIndex, startIndex + maxMovies);

            // If we've gone through all movies, loop back (with reshuffle for mixed mode)
            let finalMovies: Media[];
            if (selectedMovies.length > 0) {
                finalMovies = selectedMovies;
            } else {
                // Loop back with fresh shuffle for mixed mode
                if (sortMode === 'mixed') {
                    finalMovies = filteredMedia.sort(() => Math.random() - 0.5).slice(0, maxMovies);
                } else {
                    finalMovies = sortedMovies.slice(0, maxMovies);
                }
            }

            setMovies(finalMovies);

            // Preload all videos for instant playback
            preloadAllVideos(finalMovies);

            console.log(`✅ Loaded ${finalMovies.length} movies (cycle ${cycle}, mode: ${sortMode})`);
        } catch (error) {
            console.error("Error fetching movies:", error);
        } finally {
            setLoading(false);
            setIsLoadingNewContent(false);
        }
    }, [apiUrl, contentFilter, maxMovies, preloadAllVideos]);

    // Initial fetch
    useEffect(() => {
        fetchMoviesWithPreviews(0);
        loadMyList();
    }, []);

    const loadMyList = async () => {
        try {
            const response = await fetch(`${apiUrl}/api/mylist`);
            if (response.ok) {
                const data = await response.json();
                const mediaIds = new Set<number>(data.map((item: Media) => item.id));
                setMyList(mediaIds);
            }
        } catch (error) {
            console.error("Error loading my list:", error);
        }
    };

    const toggleMyList = async (movie: Media) => {
        const isInList = myList.has(movie.id);
        try {
            if (isInList) {
                await fetch(`${apiUrl}/api/mylist/${movie.id}`, { method: "DELETE" });
                setMyList((prev) => {
                    const newSet = new Set(prev);
                    newSet.delete(movie.id);
                    return newSet;
                });
            } else {
                await fetch(`${apiUrl}/api/mylist`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ media_id: movie.id }),
                });
                setMyList((prev) => new Set(prev).add(movie.id));
            }
        } catch (error) {
            console.error("Error toggling my list:", error);
        }
    };

    const getBackdropUrl = (movie: Media): string => {
        if (movie.tmdb_backdrop_url) return movie.tmdb_backdrop_url;
        if (movie.banner_path) return `${apiUrl}${movie.banner_path}`;
        if (movie.thumbnail_path) return `${apiUrl}${movie.thumbnail_path}`;
        if (movie.poster_path) return `${apiUrl}${movie.poster_path}`;
        return "";
    };

    const getPosterUrl = (movie: Media): string => {
        if (movie.poster_path) return `${apiUrl}/api/posters/${movie.id}`;
        if (movie.tmdb_poster_url) return movie.tmdb_poster_url;
        if (movie.thumbnail_path) return `${apiUrl}${movie.thumbnail_path}`;
        return "";
    };

    const getGenreNames = (movie: Media): string => {
        if (movie.genres && movie.genres.length > 0) {
            return movie.genres.map(g => g.name).slice(0, 3).join(" • ");
        }
        if (movie.genre_names && movie.genre_names.length > 0) {
            return movie.genre_names.slice(0, 3).join(" • ");
        }
        return "";
    };

    // Handle going to next slide - fetch new content on last slide
    const goToNextSlide = useCallback(() => {
        if (mainSliderRef.current?.splide) {
            const splide = mainSliderRef.current.splide;
            const currentIndex = splide.index;
            const lastIndex = movies.length - 1;

            if (currentIndex >= lastIndex) {
                // At last slide - use prefetched content if available
                console.log('🔄 Last slide reached, using prefetched content...');
                const newCycle = cycleCount + 1;
                setCycleCount(newCycle);
                setCurrentPlayCount(0);
                setVideoLoaded(false);
                setActiveSlideIndex(0);

                if (prefetchedMovies.current && prefetchedMovies.current.length > 0) {
                    // Use prefetched content immediately
                    console.log('⚡ Using prefetched content - instant switch!');
                    setMovies(prefetchedMovies.current);
                    preloadAllVideos(prefetchedMovies.current);
                    prefetchedMovies.current = null;
                    isPrefetching.current = false;

                    // Reset slider
                    setTimeout(() => {
                        if (mainSliderRef.current?.splide) {
                            mainSliderRef.current.splide.go(0);
                        }
                    }, 50);
                } else {
                    // Fallback: fetch new content if prefetch failed
                    fetchMoviesWithPreviews(newCycle).then(() => {
                        if (mainSliderRef.current?.splide) {
                            mainSliderRef.current.splide.go(0);
                            setActiveSlideIndex(0);
                        }
                    });
                }
            } else {
                setCurrentPlayCount(0);
                setVideoLoaded(false);
                splide.go('>');
            }
        }
    }, [movies.length, cycleCount, fetchMoviesWithPreviews, preloadAllVideos]);

    // Prefetch next batch when approaching last slides (start 2 slides before end)
    useEffect(() => {
        const lastIndex = movies.length - 1;
        const prefetchThreshold = Math.max(0, lastIndex - 1); // Start prefetching 2 slides before end

        if (activeSlideIndex >= prefetchThreshold && movies.length > 0 && !isPrefetching.current) {
            console.log('🔮 Prefetching next batch of content...');
            isPrefetching.current = true;

            const prefetchContent = async () => {
                try {
                    const response = await fetch(`${apiUrl}/api/media/movies`);
                    if (response.ok) {
                        const allMovies: Media[] = await response.json();

                        // Apply same filtering
                        let filteredMedia = allMovies;
                        if (contentFilter === 'movies-hd') {
                            filteredMedia = allMovies.filter((media: Media) => {
                                const isMovie = media.type === 'movie';
                                const hasHDQuality = media.quality && (
                                    media.quality.toLowerCase().includes('hd') ||
                                    media.quality.toLowerCase().includes('4k') ||
                                    media.quality.toLowerCase().includes('1080p') ||
                                    media.quality.toLowerCase().includes('2160p')
                                );
                                const hasFilePath = !!media.file_path;
                                // Must have poster (poster_path or tmdb_poster_url)
                                const hasPoster = !!(media.poster_path || media.tmdb_poster_url);
                                // Must have backdrop (tmdb_backdrop_url, banner_path, or thumbnail_path)
                                const hasBackdrop = !!(media.tmdb_backdrop_url || media.banner_path || media.thumbnail_path);
                                // Must have minimum 1 hour (60 minutes) duration
                                const hasMinDuration = media.duration && media.duration >= 60;
                                return isMovie && (hasHDQuality || !media.quality) && hasFilePath && hasPoster && hasBackdrop && hasMinDuration;
                            });
                        }

                        // Sort based on sortMode
                        let sortedMovies: Media[];
                        if (sortMode === 'mixed') {
                            sortedMovies = filteredMedia.sort(() => Math.random() - 0.5);
                        } else {
                            sortedMovies = filteredMedia.sort((a, b) => (b.id || 0) - (a.id || 0));
                        }

                        const nextCycle = cycleCount + 1;
                        const startIndex = nextCycle * maxMovies;
                        const selectedMovies = sortedMovies.slice(startIndex, startIndex + maxMovies);

                        let finalMovies: Media[];
                        if (selectedMovies.length > 0) {
                            finalMovies = selectedMovies;
                        } else {
                            if (sortMode === 'mixed') {
                                finalMovies = filteredMedia.sort(() => Math.random() - 0.5).slice(0, maxMovies);
                            } else {
                                finalMovies = sortedMovies.slice(0, maxMovies);
                            }
                        }

                        prefetchedMovies.current = finalMovies;

                        // Preload videos for prefetched content
                        finalMovies.forEach(movie => {
                            const url = getPreviewClipUrl(movie);
                            preloadedUrls.current.set(movie.id, url);
                            const video = document.createElement('video');
                            video.preload = 'auto';
                            video.muted = true;
                            video.src = url;
                            video.load();
                            preloadedVideos.current.set(movie.id, video);
                        });

                        console.log(`✅ Prefetched ${finalMovies.length} movies ready for instant switch`);
                    }
                } catch (error) {
                    console.warn('Prefetch failed:', error);
                }
            };

            prefetchContent();
        }
    }, [activeSlideIndex, movies.length, cycleCount, apiUrl, contentFilter, maxMovies, getPreviewClipUrl]);

    // Handle video ended - check play count before advancing
    const handleVideoEnded = useCallback(() => {
        const newPlayCount = currentPlayCount + 1;
        console.log(`🎬 Video ended. Play count: ${newPlayCount}/${playCountPerSlide}`);

        if (newPlayCount >= playCountPerSlide) {
            // Played enough times, advance to next slide
            console.log('✅ Play count reached, advancing to next slide');
            goToNextSlide();
        } else {
            // Replay the video
            setCurrentPlayCount(newPlayCount);
            if (videoRef.current) {
                videoRef.current.currentTime = 0;
                videoRef.current.play().catch(console.warn);
            }
        }
    }, [currentPlayCount, playCountPerSlide, goToNextSlide]);

    // Handle video loaded - use preloaded video if available
    const handleVideoLoaded = useCallback((index: number) => {
        // Ignore events from non-active slides to prevent race conditions
        if (index !== activeSlideIndex) return;

        setVideoLoaded(true);
        if (videoRef.current) {
            const video = videoRef.current;
            video.muted = isMuted;
            video.volume = isMuted ? 0 : 0.5;
            video.play().then(() => {
                setIsPlaying(true);
            }).catch((error) => {
                console.warn('Video autoplay failed:', error);
                // Try muted playback
                video.muted = true;
                video.play().then(() => {
                    setIsPlaying(true);
                }).catch(() => {
                    console.error('Video playback failed completely');
                });
            });
        }
    }, [activeSlideIndex, isMuted]);

    // Load and play video for current slide - use preloaded video
    useEffect(() => {
        if (movies.length === 0 || !videoRef.current) return;

        const currentMovie = movies[activeSlideIndex];
        if (!currentMovie?.file_path) return;

        const video = videoRef.current;

        // Check if video is already ready (race condition protection)
        if (video.readyState >= 3) {
            setVideoLoaded(true);
            setIsPlaying(!video.paused);
        } else {
            setVideoLoaded(false);
            setIsPlaying(false);
        }

        setCurrentPlayCount(0); // Reset play count on slide change

        console.log(`🎥 Loading video for slide ${activeSlideIndex}: ${currentMovie.title}`);
    }, [activeSlideIndex, movies]);

    // Handle mute toggle
    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.muted = isMuted;
            videoRef.current.volume = isMuted ? 0 : 0.5;
        }
    }, [isMuted]);

    // Sync thumbnail slider with main slider
    useEffect(() => {
        if (thumbsSliderRef.current?.splide && movies.length > 0) {
            thumbsSliderRef.current.splide.go(activeSlideIndex);
        }
    }, [activeSlideIndex, movies.length]);

    const handleSlideChange = (splide: any) => {
        setActiveSlideIndex(splide.index);
        setCurrentPlayCount(0); // Reset play count when manually changing slides
    };

    const toggleMute = (e: React.MouseEvent) => {
        e.stopPropagation();
        const newMuted = !isMuted;
        setIsMuted(newMuted);
        audioPreferences.setGlobalAudioPreference(newMuted);
        if (!newMuted) {
            audioPreferences.setUserHasUnmuted();
        }
    };

    // Cleanup preloaded videos on unmount
    useEffect(() => {
        return () => {
            preloadedVideos.current.forEach((video) => {
                video.pause();
                video.src = '';
                video.load();
            });
            preloadedVideos.current.clear();
            preloadedUrls.current.clear();
        };
    }, []);

    if (loading) {
        return (
            <div className="h-screen bg-black flex items-center justify-center">
                <div className="animate-spin w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    if (movies.length === 0) {
        return null;
    }

    const currentMovie = movies[activeSlideIndex];

    return (
        <div className="h-screen relative overflow-hidden">
            {/* Preload hints for upcoming videos */}
            {movies.slice(0, 5).map((movie) => (
                <link
                    key={`preload-${movie.id}`}
                    rel="preload"
                    as="video"
                    href={getPreviewClipUrl(movie)}
                    crossOrigin="anonymous"
                />
            ))}

            <Splide
                ref={mainSliderRef}
                options={{
                    type: "fade",
                    rewind: false, // Don't rewind - we fetch new content instead
                    pagination: false,
                    arrows: false,
                    height: "100vh",
                    direction: "ltr",
                    cover: true,
                    autoplay: false,
                    interval: 0,
                    drag: false,
                }}
                onMoved={handleSlideChange}
                className="h-full"
            >
                {movies.map((movie, index) => (
                    <SplideSlide key={movie.id} className="relative h-full w-full">
                        {/* Background Image */}
                        <div className="absolute inset-0 z-0">
                            <img
                                src={getBackdropUrl(movie)}
                                alt={movie.title}
                                className="w-full h-full object-cover opacity-50"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/30 to-transparent" />
                        </div>

                        {/* Video Overlay - shows preview clip */}
                        <AnimatePresence mode="wait">
                            {index === activeSlideIndex && (
                                <motion.div
                                    key={`video-overlay-${movie.id}`}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: videoLoaded ? 1 : 0 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.3 }}
                                    className="absolute inset-0 z-10 overflow-hidden"
                                >
                                    <video
                                        ref={index === activeSlideIndex ? videoRef : undefined}
                                        src={preloadedUrls.current.get(movie.id) || getPreviewClipUrl(movie)}
                                        className="absolute inset-0 w-full h-full object-cover"
                                        muted={isMuted}
                                        playsInline
                                        autoPlay
                                        crossOrigin="anonymous"
                                        onLoadedData={() => handleVideoLoaded(index)}
                                        onEnded={handleVideoEnded}
                                        onError={(e) => {
                                            console.warn('Preview clip failed to load', e);
                                            setVideoLoaded(false);
                                        }}
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>



                        {/* Content Overlay */}
                        <div className="absolute bottom-64 left-0 right-0 z-20 px-4 md:px-16 pointer-events-none">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="max-w-2xl"
                            >
                                <h1 className="text-2xl md:text-4xl font-bold mb-1 text-shadow-lg">
                                    {cleanMovieTitle ? cleanMovieTitle(movie.title) : movie.title}
                                </h1>

                                {getGenreNames(movie) && (
                                    <p className="text-sm md:text-base text-red-400 font-medium mb-2">
                                        {getGenreNames(movie)}
                                    </p>
                                )}

                                <div className="flex items-center gap-3 text-sm text-gray-300 mb-3">
                                    {movie.year && <span>{movie.year}</span>}
                                    {movie.quality && (
                                        <span className="px-2 py-0.5 border border-gray-400 rounded text-xs font-bold">
                                            {movie.quality.toLowerCase().includes('4k') || movie.quality.toLowerCase().includes('2160p') ? '4K' : 'HD'}
                                        </span>
                                    )}
                                    {movie.rating && (
                                        <span className="flex items-center gap-1">
                                            <span className="text-yellow-400">★</span>
                                            {movie.rating.toFixed(1)}
                                        </span>
                                    )}
                                </div>

                                <p className="text-sm md:text-base text-gray-200 mb-4 line-clamp-2 text-shadow-md max-w-xl">
                                    {movie.description || movie.short_desc || movie.long_desc}
                                </p>

                                <div className="flex items-center gap-3 pointer-events-auto">
                                    <button
                                        onClick={() => onInfo(movie)}
                                        className="flex items-center gap-2 bg-white text-black px-6 py-3 rounded-md font-bold hover:bg-gray-200 transition-colors"
                                    >
                                        <Play className="w-5 h-5 fill-black" />
                                        Play
                                    </button>
                                    <button
                                        onClick={() => toggleMyList(movie)}
                                        className="p-3 rounded-full border border-white/30 bg-black/30 backdrop-blur-sm hover:bg-white/10 transition-colors"
                                    >
                                        {myList.has(movie.id) ? (
                                            <Check className="w-5 h-5" />
                                        ) : (
                                            <Plus className="w-5 h-5" />
                                        )}
                                    </button>
                                    <button
                                        onClick={toggleMute}
                                        className="p-3 rounded-full border border-white/30 bg-black/30 backdrop-blur-sm hover:bg-white/10 transition-colors"
                                    >
                                        {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    </SplideSlide>
                ))}
            </Splide>

            {/* Loading indicator for new content */}
            {isLoadingNewContent && (
                <div className="absolute top-4 right-4 z-40 flex items-center gap-2 bg-black/70 px-4 py-2 rounded-full">
                    <div className="animate-spin w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full"></div>
                    <span className="text-sm text-white">Loading new content...</span>
                </div>
            )}

            {/* Thumbnail Navigation */}
            <div className="absolute bottom-8 left-0 right-0 z-30 px-4 md:px-16 overflow-visible py-12 pointer-events-none">
                <style>{`
                    .thumbnail-slider,
                    .thumbnail-slider .splide__track,
                    .thumbnail-slider .splide__list,
                    .thumbnail-slider .splide__slide {
                        overflow: visible !important;
                    }
                    .thumbnail-slider .splide__slide.is-active {
                        border: 2px solid #ef4444 !important;
                        border-radius: 0.25rem !important;
                    }
                `}</style>
                <Splide
                    ref={thumbsSliderRef}
                    options={{
                        fixedWidth: 90,
                        fixedHeight: 135,
                        isNavigation: true,
                        gap: 10,
                        focus: 'center',
                        pagination: false,
                        cover: false,
                        arrows: true,
                        rewind: false,
                        drag: false,
                        breakpoints: {
                            600: {
                                fixedWidth: 56,
                                fixedHeight: 84,
                            },
                        },
                    }}
                    onMoved={(splide: any) => {
                        if (mainSliderRef.current?.splide) {
                            mainSliderRef.current.splide.go(splide.index);
                        }
                    }}
                    onClick={(_splide: any, slide: any) => {
                        const index = slide.index;
                        if (mainSliderRef.current?.splide) {
                            mainSliderRef.current.splide.go(index);
                        }
                    }}
                    className="thumbnail-slider pointer-events-auto"
                >

                    {movies.map((movie) => (
                        <SplideSlide
                            key={movie.id}
                            className="cursor-pointer opacity-50 hover:opacity-100 transition-all duration-300 [&.is-active]:opacity-100 [&.is-active]:scale-[1.4] [&.is-active]:z-10 rounded"
                        >
                            <img
                                src={getPosterUrl(movie)}
                                alt={movie.title}
                                className="w-full h-full object-cover rounded"
                                onError={(e) => {
                                    // Replace broken image with black background
                                    e.currentTarget.style.display = 'none';
                                    e.currentTarget.parentElement!.style.backgroundColor = '#000';
                                }}
                            />
                            <div className="absolute inset-0 bg-black/20 rounded" />
                        </SplideSlide>
                    ))}
                </Splide>
            </div>
        </div>
    );
};

export default HomeflixHero;
