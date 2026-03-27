"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Splide, SplideSlide } from "@splidejs/react-splide";
import "@splidejs/react-splide/css";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Volume2, VolumeX, Plus, Check } from "lucide-react";
import { getApiUrl } from "@/lib/api";
import { Media } from "@/types/media";
import { cleanMovieTitle } from "@/lib/titleUtils";
import { addToWishlist, removeFromWishlist, isInWishlist, getWishlist } from '@/lib/wishlist';
import { useMyList } from '@/hooks/useMyList';
import MyListTooltip from '@/components/ui/MyListTooltip';

// Declare global YouTube types
declare global {
    interface Window {
        YT: any;
        onYouTubeIframeAPIReady: () => void;
    }
}

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
    const [cycleCount, setCycleCount] = useState(0);
    const [isLoadingNewContent, setIsLoadingNewContent] = useState(false);
    const [previousMediaIds, setPreviousMediaIds] = useState<Set<number>>(new Set());
    const [currentPlayCount, setCurrentPlayCount] = useState(0); // Track how many times current video has played
    const [useYouTubeFallback, setUseYouTubeFallback] = useState(false); // Use YouTube trailer as fallback
    const [ytReady, setYtReady] = useState(false); // YouTube API ready state
    const [ytVideoReady, setYtVideoReady] = useState(false); // Track when YouTube video is actually playing

    // Use the new backend-connected My List hook
    const { myList, collections, isInMyList, toggleMyList: toggleMyListHook, addToCollection, fetchCollections } = useMyList();

    // Wrapper function to handle the movie parameter
    const toggleMyList = useCallback((movie: Media) => {
        toggleMyListHook(movie.id);
    }, [toggleMyListHook]);

    const mainSliderRef = useRef<Splide>(null);
    const thumbsSliderRef = useRef<Splide>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const ytPlayerRef = useRef<any>(null); // YouTube player reference
    const videoLoadTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Timeout for video loading
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

    // Video load timeout - if video doesn't load within this time, use YouTube fallback or advance
    // First slide uses shorter timeout for instant playback experience
    const FIRST_SLIDE_TIMEOUT_MS = 1000; // 1 second for first video - instant playback
    const SUBSEQUENT_SLIDE_TIMEOUT_MS = 5000; // 5 seconds for other slides

    // Load YouTube IFrame API for fallback trailers
    useEffect(() => {
        if (window.YT && window.YT.Player) {
            setYtReady(true);
            return;
        }

        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

        window.onYouTubeIframeAPIReady = () => {
            setYtReady(true);
        };
    }, []);

    // Extract YouTube video key from URL
    const extractYouTubeKey = useCallback((url: string): string | null => {
        if (!url) return null;
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?\s]+)/,
            /^([a-zA-Z0-9_-]{11})$/
        ];
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        return null;
    }, []);

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
    }, []);

    // Remove old functions - now using the hook
    // const loadMyList = () => { ... }
    // const toggleMyList = (movie: Media) => { ... }

    const getBackdropUrl = (movie: Media): string => {
        // Local banner_path takes priority (uploaded via settings)
        if (movie.banner_path) {
            const fileName = movie.banner_path.split('/').pop();
            return fileName ? `${apiUrl}/api/admin/assets/${fileName}` : `${apiUrl}${movie.banner_path}`;
        }
        if (movie.tmdb_backdrop_url) return movie.tmdb_backdrop_url;
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

        // Clear the timeout since video loaded successfully
        if (videoLoadTimeoutRef.current) {
            clearTimeout(videoLoadTimeoutRef.current);
            videoLoadTimeoutRef.current = null;
        }
        setUseYouTubeFallback(false); // Video loaded, no need for fallback

        setVideoLoaded(true);
        if (videoRef.current) {
            const video = videoRef.current;
            video.muted = isMuted;
            video.volume = isMuted ? 0 : 1.0;
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
                    // Switch to YouTube fallback or advance
                    const currentMovie = movies[activeSlideIndex];
                    if (currentMovie?.tmdb_trailer_url && extractYouTubeKey(currentMovie.tmdb_trailer_url)) {
                        console.log('⚠️ Video playback failed, switching to YouTube fallback');
                        setUseYouTubeFallback(true);
                    } else {
                        console.log('⚠️ No YouTube fallback available, advancing to next slide');
                        goToNextSlide();
                    }
                });
            });
        }
    }, [activeSlideIndex, isMuted, movies, extractYouTubeKey, goToNextSlide]);

    // Load and play video for current slide - use preloaded video with timeout
    useEffect(() => {
        if (movies.length === 0) return;

        const currentMovie = movies[activeSlideIndex];

        // Clear previous timeout
        if (videoLoadTimeoutRef.current) {
            clearTimeout(videoLoadTimeoutRef.current);
            videoLoadTimeoutRef.current = null;
        }

        // Reset states on slide change - keep video hidden during transition
        setVideoLoaded(false); // Hide video immediately
        setIsPlaying(false);
        setCurrentPlayCount(0);

        // Delay resetting YouTube fallback to prevent flash of preview video
        // This ensures smooth transition from YouTube to next slide
        setTimeout(() => {
            setUseYouTubeFallback(false);
            setYtVideoReady(false); // Reset YouTube video ready state
        }, 100);

        // Destroy previous YouTube player if exists
        if (ytPlayerRef.current) {
            try {
                ytPlayerRef.current.destroy();
            } catch (e) {
                // Ignore
            }
            ytPlayerRef.current = null;
        }

        if (!currentMovie?.file_path) {
            // No local file, use YouTube directly
            const youtubeKey = currentMovie?.tmdb_trailer_url
                ? extractYouTubeKey(currentMovie.tmdb_trailer_url)
                : null;
            if (youtubeKey) {
                console.log(`📺 No local file, using YouTube trailer for: ${currentMovie.title}`);
                setUseYouTubeFallback(true);
            } else {
                console.log(`⚠️ No video source for: ${currentMovie?.title}, advancing...`);
                // Give it a moment then advance
                setTimeout(() => goToNextSlide(), 1000);
            }
            return;
        }

        // Set timeout for video loading - 1 second for first slide, 5 seconds for subsequent
        const timeoutMs = activeSlideIndex === 0 && cycleCount === 0
            ? FIRST_SLIDE_TIMEOUT_MS
            : SUBSEQUENT_SLIDE_TIMEOUT_MS;
        console.log(`⏱️ Setting ${timeoutMs}ms timeout for video load`);

        videoLoadTimeoutRef.current = setTimeout(() => {
            console.log(`⏰ Video load timeout reached for: ${currentMovie.title}`);
            const youtubeKey = currentMovie?.tmdb_trailer_url
                ? extractYouTubeKey(currentMovie.tmdb_trailer_url)
                : null;
            if (youtubeKey) {
                console.log('📺 Switching to YouTube fallback');
                setUseYouTubeFallback(true);
            } else {
                console.log('⏩ No YouTube fallback, advancing to next slide');
                goToNextSlide();
            }
        }, timeoutMs);

        // Check if video is already ready
        if (videoRef.current) {
            const video = videoRef.current;
            if (video.readyState >= 3) {
                setVideoLoaded(true);
                setIsPlaying(!video.paused);
                if (videoLoadTimeoutRef.current) {
                    clearTimeout(videoLoadTimeoutRef.current);
                    videoLoadTimeoutRef.current = null;
                }
            }
        }

        console.log(`🎥 Loading video for slide ${activeSlideIndex}: ${currentMovie.title}`);

        // Cleanup on unmount or slide change
        return () => {
            if (videoLoadTimeoutRef.current) {
                clearTimeout(videoLoadTimeoutRef.current);
                videoLoadTimeoutRef.current = null;
            }
        };
    }, [activeSlideIndex, movies, extractYouTubeKey, goToNextSlide, cycleCount, FIRST_SLIDE_TIMEOUT_MS, SUBSEQUENT_SLIDE_TIMEOUT_MS]);

    // Handle mute toggle - also control YouTube player
    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.muted = isMuted;
            videoRef.current.volume = isMuted ? 0 : 1.0;
        }
        // Also update YouTube player if active
        if (ytPlayerRef.current && ytPlayerRef.current.isMuted) {
            try {
                if (isMuted) {
                    ytPlayerRef.current.mute();
                } else {
                    ytPlayerRef.current.unMute();
                }
            } catch (e) {
                // Player might not be ready
            }
        }
    }, [isMuted]);

    // Initialize YouTube player when fallback is triggered
    useEffect(() => {
        if (!useYouTubeFallback || !ytReady || movies.length === 0) return;

        const currentMovie = movies[activeSlideIndex];
        const videoKey = currentMovie?.tmdb_trailer_url
            ? extractYouTubeKey(currentMovie.tmdb_trailer_url)
            : null;

        if (!videoKey) return;

        // Destroy previous player
        if (ytPlayerRef.current) {
            try {
                ytPlayerRef.current.destroy();
            } catch (e) {
                // Ignore
            }
            ytPlayerRef.current = null;
        }

        const timer = setTimeout(() => {
            const containerId = `yt-player-hero-${currentMovie.id}`;
            const container = document.getElementById(containerId);
            if (!container) return;

            console.log(`📺 Initializing YouTube player for: ${currentMovie.title}`);

            ytPlayerRef.current = new window.YT.Player(containerId, {
                videoId: videoKey,
                playerVars: {
                    autoplay: 1,
                    mute: isMuted ? 1 : 0,
                    controls: 0,
                    showinfo: 0,
                    rel: 0,
                    iv_load_policy: 3, // Hide annotations
                    modestbranding: 1,
                    playsinline: 1,
                    disablekb: 1, // Disable keyboard controls
                    fs: 0, // Disable fullscreen button
                    cc_load_policy: 0, // Don't load captions
                    cc_lang_pref: '', // No caption language preference
                    enablejsapi: 1, // Enable JS API
                    start: 10, // Start 10 seconds in to skip intro
                    origin: window.location.origin,
                },
                events: {
                    onStateChange: (event: any) => {
                        // 1 = playing, 0 = ended
                        if (event.data === 1) {
                            setYtVideoReady(true); // YouTube video is now playing
                        } else if (event.data === 0) {
                            // Video ended
                            setYtVideoReady(false);
                            const newPlayCount = currentPlayCount + 1;
                            console.log(`📺 YouTube video ended. Play count: ${newPlayCount}/${playCountPerSlide}`);
                            if (newPlayCount >= playCountPerSlide) {
                                goToNextSlide();
                            } else {
                                setCurrentPlayCount(newPlayCount);
                                event.target.seekTo(10); // Seek to 10 seconds for replay
                                event.target.playVideo();
                            }
                        }
                    },
                    onReady: (event: any) => {
                        const iframe = event.target.getIframe();
                        if (iframe) {
                            iframe.referrerPolicy = "strict-origin-when-cross-origin";
                        }
                        if (!isMuted) {
                            event.target.unMute();
                        }
                        event.target.seekTo(10, true); // Explicitly seek to 10s with allowSeekAhead
                        event.target.playVideo();

                        // Set up interval to end video 3 seconds early
                        const checkEndTime = setInterval(() => {
                            try {
                                const player = event.target;
                                const duration = player.getDuration();
                                const currentTime = player.getCurrentTime();

                                // End 10 seconds before actual end
                                if (duration > 0 && currentTime >= duration - 15) {
                                    clearInterval(checkEndTime);
                                    const newPlayCount = currentPlayCount + 1;
                                    if (newPlayCount >= playCountPerSlide) {
                                        goToNextSlide();
                                    } else {
                                        setCurrentPlayCount(newPlayCount);
                                        player.seekTo(15);
                                        player.playVideo();
                                    }
                                }
                            } catch (e) {
                                // Player might be destroyed
                                clearInterval(checkEndTime);
                            }
                        }, 500);

                        // Store interval ref for cleanup
                        (event.target as any)._endCheckInterval = checkEndTime;
                    },
                    onError: (event: any) => {
                        console.error('YouTube player error:', event.data);
                        // Advance to next slide on YouTube error
                        goToNextSlide();
                    },
                },
            });
        }, 100);

        return () => {
            clearTimeout(timer);
        };
    }, [useYouTubeFallback, ytReady, activeSlideIndex, movies, isMuted, extractYouTubeKey, currentPlayCount, playCountPerSlide, goToNextSlide]);

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

    // Cleanup preloaded videos, YouTube player, and timeout on unmount
    useEffect(() => {
        return () => {
            preloadedVideos.current.forEach((video) => {
                video.pause();
                video.src = '';
                video.load();
            });
            preloadedVideos.current.clear();
            preloadedUrls.current.clear();

            // Cleanup YouTube player
            if (ytPlayerRef.current) {
                try {
                    ytPlayerRef.current.destroy();
                } catch (e) {
                    // Ignore
                }
                ytPlayerRef.current = null;
            }

            // Clear video load timeout
            if (videoLoadTimeoutRef.current) {
                clearTimeout(videoLoadTimeoutRef.current);
                videoLoadTimeoutRef.current = null;
            }
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

                        {/* Video Overlay - shows preview clip or YouTube fallback */}
                        <AnimatePresence mode="wait">
                            {index === activeSlideIndex && !useYouTubeFallback && (
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
                                            // Switch to YouTube fallback or advance
                                            const youtubeKey = movie.tmdb_trailer_url
                                                ? extractYouTubeKey(movie.tmdb_trailer_url)
                                                : null;
                                            if (youtubeKey) {
                                                console.log('📺 Video error, switching to YouTube fallback');
                                                setUseYouTubeFallback(true);
                                            } else {
                                                console.log('⚠️ No YouTube fallback, advancing to next slide');
                                                goToNextSlide();
                                            }
                                        }}
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* YouTube Fallback Player - Only show when video is playing */}
                        <AnimatePresence mode="wait">
                            {index === activeSlideIndex && useYouTubeFallback && extractYouTubeKey(movie.tmdb_trailer_url || '') && (
                                <motion.div
                                    key={`youtube-fallback-${movie.id}`}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: ytVideoReady ? 1 : 0 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.5 }}
                                    className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden pointer-events-none"
                                    style={{
                                        clipPath: 'inset(0)',
                                    }}
                                >
                                    <div className="relative w-full h-full overflow-hidden">
                                        <div
                                            id={`yt-player-hero-${movie.id}`}
                                            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
                                            style={{
                                                width: '120vw',
                                                height: '120vh',
                                                minWidth: '200vh',
                                                minHeight: '70vw',
                                                pointerEvents: 'none'
                                            }}
                                        />
                                    </div>
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
                                {/* Movie Title - Logo or Text */}
                                {movie.logo_path ? (
                                    <img
                                        src={`${apiUrl}/api/${movie.logo_path}`}
                                        alt={movie.title}
                                        className="max-h-24 md:max-h-32 w-auto mb-2 drop-shadow-2xl"
                                        onError={(e) => {
                                            // Fallback to text if logo fails to load
                                            e.currentTarget.style.display = 'none';
                                            const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                            if (fallback) fallback.style.display = 'block';
                                        }}
                                    />
                                ) : null}
                                <h1
                                    className="text-2xl md:text-4xl font-bold mb-1 text-shadow-lg"
                                    style={{ display: movie.logo_path ? 'none' : 'block' }}
                                >
                                    {cleanMovieTitle ? cleanMovieTitle(movie.title) : movie.title}
                                </h1>

                                {/* Genre Tags */}
                                {movie.genres && movie.genres.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mb-3">
                                        {movie.genres.slice(0, 4).map((genre) => (
                                            <span
                                                key={genre.id}
                                                className="text-white/90 text-xs font-medium bg-black/40 backdrop-blur-sm px-2 py-1 rounded-full border border-white/30"
                                            >
                                                {genre.name}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                <div className="flex items-center gap-3 text-sm text-gray-300 mb-3">
                                    {movie.year && <span>{movie.year}</span>}
                                    {movie.rating && (
                                        <span className="flex items-center gap-1">
                                            <span className="text-yellow-400">★</span>
                                            {movie.rating.toFixed(1)}
                                        </span>
                                    )}
                                    {movie.quality && (
                                        <span className="px-2 py-0.5 border border-gray-400 rounded text-xs font-bold">
                                            {movie.quality.toLowerCase().includes('4k') || movie.quality.toLowerCase().includes('2160p') ? '4K' : 
                                             movie.quality.toLowerCase().includes('1080') || movie.quality.toLowerCase().includes('hd') ? 'HD' :
                                             movie.quality.toLowerCase().includes('720') ? '720p' : movie.quality}
                                        </span>
                                    )}
                                </div>

                                <p className="text-sm md:text-base text-gray-200 mb-4 line-clamp-2 text-shadow-md max-w-lg">
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
                                    <MyListTooltip
                                        media={{
                                            ...movie,
                                            id: movie.tmdb_id ? parseInt(`9${movie.tmdb_id}`) : movie.id
                                        }}
                                        isInMyList={isInMyList(movie.tmdb_id ? parseInt(`9${movie.tmdb_id}`) : movie.id)}
                                        collections={collections}
                                        onToggleMyList={() => toggleMyList(movie)}
                                        onAddToCollection={(collectionId) => addToCollection(collectionId, movie.tmdb_id ? parseInt(`9${movie.tmdb_id}`) : movie.id)}
                                        onCollectionCreated={fetchCollections}
                                        onDataRefresh={fetchCollections}
                                    >
                                        <button className="p-3 rounded-full border border-white/30 bg-black/30 backdrop-blur-sm hover:bg-white/10 transition-colors">
                                            {isInMyList(movie.tmdb_id ? parseInt(`9${movie.tmdb_id}`) : movie.id) ? (
                                                <Check className="w-5 h-5" />
                                            ) : (
                                                <Plus className="w-5 h-5" />
                                            )}
                                        </button>
                                    </MyListTooltip>
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
