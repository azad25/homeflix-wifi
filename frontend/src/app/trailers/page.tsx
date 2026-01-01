"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Splide, SplideSlide } from "@splidejs/react-splide";
import "@splidejs/react-splide/css";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Volume2, VolumeX, Info, Plus, Check } from "lucide-react";
import Navbar from "@/components/Navbar";
import { getApiUrl } from "@/lib/api";
import { useRouter } from "next/navigation";

// Declare global YouTube types
declare global {
    interface Window {
        YT: any;
        onYouTubeIframeAPIReady: () => void;
    }
}

// TMDB Genre IDs mapping
const TMDB_GENRES: { [key: number]: string } = {
    28: "Action",
    12: "Adventure",
    16: "Animation",
    35: "Comedy",
    80: "Crime",
    99: "Documentary",
    18: "Drama",
    10751: "Family",
    14: "Fantasy",
    36: "History",
    27: "Horror",
    10402: "Music",
    9648: "Mystery",
    10749: "Romance",
    878: "Sci-Fi",
    10770: "TV Movie",
    53: "Thriller",
    10752: "War",
    37: "Western"
};

interface Movie {
    id: number;
    title: string;
    overview: string;
    backdrop_path: string;
    poster_path: string;
    release_date: string;
    vote_average: number;
    genre_ids: number[];
}

interface Video {
    key: string;
    site: string;
    type: string;
    official: boolean;
}

interface MovieWithVideo extends Movie {
    videoKey?: string;
    logoUrl?: string;
}

const TrailersPage = () => {
    const [movies, setMovies] = useState<MovieWithVideo[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeSlideIndex, setActiveSlideIndex] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [isPlaying, setIsPlaying] = useState(true);
    const [ytReady, setYtReady] = useState(false);
    const [videoReady, setVideoReady] = useState(false); // Track when video is actually playing
    const mainSliderRef = useRef<Splide>(null);
    const thumbsSliderRef = useRef<Splide>(null);
    const playerRef = useRef<any>(null);
    const activeVideoRef = useRef<HTMLIFrameElement>(null);
    const router = useRouter();

    // Load YouTube IFrame API
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

    // Handle going to next slide (with loop to first)
    const goToNextSlide = useCallback(() => {
        if (mainSliderRef.current?.splide) {
            const splide = mainSliderRef.current.splide;
            const currentIndex = splide.index;
            const lastIndex = movies.length - 1;

            if (currentIndex >= lastIndex) {
                // At last slide, loop to first
                splide.go(0);
            } else {
                splide.go('>');
            }
        }
    }, [movies.length]);

    // Initialize or update YouTube player when slide changes
    useEffect(() => {
        if (!ytReady || movies.length === 0) return;

        const currentMovie = movies[activeSlideIndex];
        if (!currentMovie?.videoKey) return;

        // Destroy previous player if exists
        if (playerRef.current) {
            try {
                playerRef.current.destroy();
            } catch (e) {
                // Ignore destroy errors
            }
            playerRef.current = null;
        }

        // Small delay to ensure the DOM element exists
        const timer = setTimeout(() => {
            const containerId = `yt-player-${currentMovie.id}`;
            const container = document.getElementById(containerId);
            if (!container) return;

            playerRef.current = new window.YT.Player(containerId, {
                videoId: currentMovie.videoKey,
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
                            setVideoReady(true); // Video is now actually playing
                        } else if (event.data === 0) {
                            console.log('Video ended, advancing to next slide');
                            setVideoReady(false);
                            goToNextSlide();
                        }
                    },
                    onReady: (event: any) => {
                        console.log('YouTube player ready for:', currentMovie.title);
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

                                // End 15 seconds before actual end
                                if (duration > 0 && currentTime >= duration - 15) {
                                    clearInterval(checkEndTime);
                                    console.log('Video ending early, advancing to next slide');
                                    goToNextSlide();
                                }
                            } catch (e) {
                                // Player might be destroyed
                                clearInterval(checkEndTime);
                            }
                        }, 500);

                        // Store interval ref for cleanup
                        (event.target as any)._endCheckInterval = checkEndTime;
                    },
                },
            });
        }, 100);

        return () => {
            clearTimeout(timer);
        };
    }, [ytReady, activeSlideIndex, movies, isMuted, goToNextSlide]);

    // Handle mute toggle
    useEffect(() => {
        if (playerRef.current && playerRef.current.isMuted) {
            try {
                if (isMuted) {
                    playerRef.current.mute();
                } else {
                    playerRef.current.unMute();
                }
            } catch (e) {
                // Player might not be ready
            }
        }
    }, [isMuted]);

    useEffect(() => {
        fetchUpcomingMovies();
    }, []);

    // Sync thumbnail slider with main slider when activeSlideIndex changes
    useEffect(() => {
        if (thumbsSliderRef.current?.splide && movies.length > 0) {
            thumbsSliderRef.current.splide.go(activeSlideIndex);
        }
    }, [activeSlideIndex, movies.length]);

    const fetchUpcomingMovies = async () => {
        try {
            const apiUrl = getApiUrl();
            const response = await fetch(`${apiUrl}/api/tmdb/movie/upcoming?page=1`);
            if (response.ok) {
                const data = await response.json();
                const results = data.results.slice(0, 10);
                console.log('First 3 movies:', results.slice(0, 3).map((m: Movie) => ({ title: m.title, id: m.id })));

                const moviesWithVideos = await Promise.all(
                    results.map(async (movie: Movie) => {
                        try {
                            const videoResponse = await fetch(
                                `${apiUrl}/api/tmdb-movie/${movie.id}?append_to_response=videos`
                            );
                            let videoKey: string | undefined;
                            let logoUrl: string | undefined;

                            if (videoResponse.ok) {
                                const videoData = await videoResponse.json();
                                // API wraps response in data object: { data: { videos: { results: [...] } } }
                                const videos = videoData.data?.videos?.results || [];
                                const trailer = videos.find(
                                    (v: Video) =>
                                        v.site === "YouTube" &&
                                        (v.type === "Trailer" || v.type === "Teaser")
                                );
                                videoKey = trailer?.key;
                            }

                            // Fetch logo from TMDB images API
                            try {
                                const imagesResponse = await fetch(
                                    `${apiUrl}/api/tmdb/movie/${movie.id}/images`
                                );
                                if (imagesResponse.ok) {
                                    const imagesData = await imagesResponse.json();
                                    const logos = imagesData.logos || [];
                                    // Find best English logo
                                    let bestLogo = logos.find((l: any) => l.iso_639_1 === 'en');
                                    if (!bestLogo && logos.length > 0) {
                                        bestLogo = logos[0];
                                    }
                                    if (bestLogo?.file_path) {
                                        logoUrl = `https://image.tmdb.org/t/p/w500${bestLogo.file_path}`;
                                    }
                                }
                            } catch (e) {
                                // Ignore logo fetch errors
                            }

                            return { ...movie, videoKey, logoUrl };
                        } catch (error) {
                            console.error(`Error fetching data for movie ${movie.id}:`, error);
                        }
                        return movie;
                    })
                );

                setMovies(moviesWithVideos);
                console.log('Fetched movies with videos and logos:', moviesWithVideos.map(m => ({
                    title: m.title,
                    hasVideo: !!m.videoKey,
                    hasLogo: !!m.logoUrl,
                    logoUrl: m.logoUrl
                })));
            }
        } catch (error) {
            console.error("Failed to fetch now-playing movies:", error);
        } finally {
            setLoading(false);
        }
    };

    const getImageUrl = (path: string, size: string = "original") => {
        if (!path) return "";
        return `https://image.tmdb.org/t/p/${size}${path}`;
    };

    const handleSlideChange = (splide: any) => {
        setActiveSlideIndex(splide.index);
        setIsPlaying(true); // Reset to playing when slide changes
        setVideoReady(false); // Reset video ready state to show backdrop while loading
        // Keep mute state as is (user preference)
    };

    const toggleMute = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsMuted(!isMuted);
    };

    const togglePlay = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsPlaying(!isPlaying);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="animate-spin w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white overflow-hidden">
            <Navbar />

            <div className="h-screen relative">
                <Splide
                    ref={mainSliderRef}
                    options={{
                        type: "fade", // Fade transition is smoother for full screen
                        rewind: true,
                        pagination: false,
                        arrows: false,
                        height: "100vh",
                        direction: "ltr",
                        cover: true,
                        autoplay: false, // We handle video autoplay manually
                        interval: 0,
                        drag: false, // Disable drag to prevent interfering with video interaction if we enable it later
                    }}
                    onMoved={handleSlideChange}
                    className="h-full"
                >
                    {movies.map((movie, index) => (
                        <SplideSlide key={movie.id} className="relative h-full w-full">
                            {/* Background Image (Backdrop) - Always visible as fallback */}
                            <div className="absolute inset-0 z-0">
                                <img
                                    src={getImageUrl(movie.backdrop_path)}
                                    alt={movie.title}
                                    className="w-full h-full object-cover opacity-50"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                                <div className="absolute inset-0 bg-gradient-to-r from-black via-black/30 to-transparent" />
                            </div>

                            {/* Video Player (YouTube) - With fade transition, only show when video is playing */}
                            <AnimatePresence mode="wait">
                                {movie.videoKey && index === activeSlideIndex && (
                                    <motion.div
                                        key={`video-${movie.id}`}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: videoReady ? 1 : 0 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.5 }}
                                        className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden pointer-events-none"
                                        style={{
                                            clipPath: 'inset(0)',
                                        }}
                                    >
                                        <div className="relative w-full h-full overflow-hidden">
                                            <div
                                                id={`yt-player-${movie.id}`}
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
                            <div className="absolute bottom-48 left-0 right-0 z-20 px-4 md:px-16 pointer-events-none">
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.5 }}
                                    className="max-w-2xl"
                                >
                                    {/* Movie Title - Logo or Text */}
                                    {movie.logoUrl ? (
                                        <img
                                            src={movie.logoUrl}
                                            alt={movie.title}
                                            className="max-h-16 md:max-h-24 w-auto mb-2 drop-shadow-2xl"
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                                const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                                if (fallback) fallback.style.display = 'block';
                                            }}
                                        />
                                    ) : null}
                                    <h1
                                        className="text-2xl md:text-4xl font-bold mb-2 text-shadow-lg"
                                        style={{ display: movie.logoUrl ? 'none' : 'block' }}
                                    >
                                        {movie.title}
                                    </h1>
                                    {/* Genres */}
                                    {movie.genre_ids && movie.genre_ids.length > 0 && (
                                        <p className="text-sm md:text-base text-red-400 font-medium mb-2">
                                            {movie.genre_ids.slice(0, 3).map(id => TMDB_GENRES[id]).filter(Boolean).join(" • ")}
                                        </p>
                                    )}
                                    <p className="text-sm md:text-base text-gray-200 mb-4 line-clamp-2 text-shadow-md max-w-xl">
                                        {movie.overview}
                                    </p>

                                    {movie.release_date && (
                                        <p className="text-sm text-red-400 font-semibold mb-6">
                                            Release Date: {new Date(movie.release_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                                        </p>
                                    )}

                                    <div className="flex items-center gap-3 pointer-events-auto">
                                        <button
                                            onClick={toggleMute}
                                            className="p-3 rounded-full border border-white/30 bg-black/30 backdrop-blur-sm hover:bg-white/10 transition-colors"
                                        >
                                            {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                                        </button>
                                        <button
                                            onClick={togglePlay}
                                            className="p-3 rounded-full border border-white/30 bg-black/30 backdrop-blur-sm hover:bg-white/10 transition-colors"
                                        >
                                            {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                                        </button>
                                    </div>
                                </motion.div>
                            </div>
                        </SplideSlide>
                    ))}
                </Splide>
            </div>

            {/* Thumbnail Navigation */}
            <div className="fixed bottom-8 left-0 right-0 z-30 px-4 md:px-16">
                <Splide
                    ref={thumbsSliderRef}
                    options={{
                        fixedWidth: 240,
                        fixedHeight: 135,
                        isNavigation: true,
                        gap: 10,
                        focus: 'center',
                        pagination: false,
                        cover: true,
                        arrows: true,
                        rewind: true,
                        breakpoints: {
                            600: {
                                fixedWidth: 150,
                                fixedHeight: 84,
                            },
                        },
                    }}
                    onMoved={(splide: any) => {
                        // When thumbnail slider moves (via arrows or click), sync main slider
                        if (mainSliderRef.current?.splide) {
                            mainSliderRef.current.splide.go(splide.index);
                        }
                    }}
                    onClick={(_splide: any, slide: any) => {
                        // When a thumbnail is clicked, go to that slide
                        const index = slide.index;
                        if (mainSliderRef.current?.splide) {
                            mainSliderRef.current.splide.go(index);
                        }
                    }}
                    className="thumbnail-slider"
                >
                    {movies.map((movie) => (
                        <SplideSlide key={movie.id} className="cursor-pointer opacity-50 hover:opacity-100 transition-opacity [&.is-active]:opacity-100 [&.is-active]:border-2 [&.is-active]:border-red-600 rounded overflow-hidden">
                            <style>{`
                                .thumbnail-slider,
                                .thumbnail-slider .splide__track,
                                .thumbnail-slider .splide__list,
                                .thumbnail-slider .splide__slide {
                                    overflow: visible !important;
                                }
                                .thumbnail-slider .splide__slide.is-active {
                                    border: 2px solid #f71616ff !important;
                                    border-radius: 0.25rem !important;
                                }
                            `}</style>
                            <img
                                src={getImageUrl(movie.backdrop_path || movie.poster_path, "w300")}
                                alt={movie.title}
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/20" />
                        </SplideSlide>
                    ))}
                </Splide>
            </div>
        </div >
    );
};

export default TrailersPage;
