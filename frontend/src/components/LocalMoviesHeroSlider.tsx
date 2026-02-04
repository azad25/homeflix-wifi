"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Splide, SplideSlide } from "@splidejs/react-splide";
import "@splidejs/react-splide/css";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Volume2, VolumeX, Info, Plus, Check } from "lucide-react";
import { getApiUrl } from "@/lib/api";
import { Media } from "@/types/media";
import { addToWishlist, removeFromWishlist, isInWishlist, getWishlist } from '@/lib/wishlist';
import QualityTags from '@/components/QualityTags';
import { useMyList } from '@/hooks/useMyList';
import MyListTooltip from '@/components/ui/MyListTooltip';

// Genre-based text styling utility
const getGenreTextStyle = (genres: string[] = []) => {
    const primaryGenre = genres[0]?.toLowerCase() || '';

    // Font family based on genre
    let fontFamily = 'font-sans'; // default
    if (primaryGenre.includes('horror') || primaryGenre.includes('thriller')) {
        fontFamily = 'font-mono'; // monospace for tension
    } else if (primaryGenre.includes('romance') || primaryGenre.includes('drama')) {
        fontFamily = 'font-serif'; // serif for elegance
    } else if (primaryGenre.includes('sci') || primaryGenre.includes('science')) {
        fontFamily = 'font-mono'; // monospace for tech feel
    } else if (primaryGenre.includes('comedy')) {
        fontFamily = 'font-sans'; // clean sans for readability
    }

    // Text size and styling
    const textSize = 'text-sm md:text-base'; // Reduced from lg
    const maxWidth = 'max-w-lg'; // Reduced from xl to lg
    const lineHeight = 'leading-relaxed';

    return {
        fontFamily,
        textSize,
        maxWidth,
        lineHeight,
        className: `${fontFamily} ${textSize} ${maxWidth} ${lineHeight}`
    };
};

// Declare global YouTube types
declare global {
    interface Window {
        YT: any;
        onYouTubeIframeAPIReady: () => void;
    }
}

interface LocalMoviesHeroSliderProps {
    onPlay: (media: Media) => void;
    onInfo: (media: Media) => void;
    maxMovies?: number;
}

const LocalMoviesHeroSlider: React.FC<LocalMoviesHeroSliderProps> = ({
    onPlay,
    onInfo,
    maxMovies = 10,
}) => {
    const [movies, setMovies] = useState<Media[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeSlideIndex, setActiveSlideIndex] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [ytReady, setYtReady] = useState(false);
    const [videoReady, setVideoReady] = useState(false); // Track when video is actually playing
    const mainSliderRef = useRef<Splide>(null);
    const thumbsSliderRef = useRef<Splide>(null);
    const playerRef = useRef<any>(null);
    const apiUrl = getApiUrl();

    // Use the new backend-connected My List hook
    const { myList, collections, isInMyList, toggleMyList: toggleMyListHook, addToCollection, fetchCollections } = useMyList();

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

    // Extract YouTube video key from URL
    const extractYouTubeKey = (url: string): string | null => {
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
    };

    // Fetch local movies with trailers
    useEffect(() => {
        fetchLocalMoviesWithTrailers();
    }, []);

    const fetchLocalMoviesWithTrailers = async () => {
        try {
            // Fetch all local movies
            const response = await fetch(`${apiUrl}/api/media/movies`);
            if (response.ok) {
                const data: Media[] = await response.json();

                // Filter movies that have TMDB trailers (YouTube URLs)
                const moviesWithTrailers = data.filter((movie) => {
                    const hasYouTubeTrailer = movie.tmdb_trailer_url &&
                        extractYouTubeKey(movie.tmdb_trailer_url);
                    const hasLocalTrailer = movie.trailer_path;
                    const isHD = movie.quality && (
                        movie.quality.toLowerCase().includes('hd') ||
                        movie.quality.toLowerCase().includes('4k') ||
                        movie.quality.toLowerCase().includes('1080p') ||
                        movie.quality.toLowerCase().includes('2160p')
                    );
                    return (hasYouTubeTrailer || hasLocalTrailer) && (isHD || !movie.quality);
                });

                // Sort by most recent and take top movies
                const sortedMovies = moviesWithTrailers
                    .sort((a, b) => (b.id || 0) - (a.id || 0))
                    .slice(0, maxMovies);

                setMovies(sortedMovies);
                console.log(`✅ Loaded ${sortedMovies.length} local movies with trailers`);
            }
        } catch (error) {
            console.error("Error fetching local movies:", error);
        } finally {
            setLoading(false);
        }
    };

    // Wrapper function to handle the movie parameter
    const toggleMyList = useCallback((movie: Media) => {
        toggleMyListHook(movie.id);
    }, [toggleMyListHook]);

    const getBackdropUrl = (movie: Media): string => {
        if (movie.tmdb_backdrop_url) return movie.tmdb_backdrop_url;
        if (movie.banner_path) return `${apiUrl}${movie.banner_path}`;
        if (movie.thumbnail_path) return `${apiUrl}${movie.thumbnail_path}`;
        if (movie.poster_path) return `${apiUrl}${movie.poster_path}`;
        return "";
    };

    const getPosterUrl = (movie: Media): string => {
        // Use the poster API endpoint for local movies
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

    // Handle going to next slide
    const goToNextSlide = useCallback(() => {
        if (mainSliderRef.current?.splide) {
            const splide = mainSliderRef.current.splide;
            const currentIndex = splide.index;
            const lastIndex = movies.length - 1;

            if (currentIndex >= lastIndex) {
                splide.go(0);
            } else {
                splide.go('>');
            }
        }
    }, [movies.length]);

    // Initialize YouTube player when slide changes
    useEffect(() => {
        if (!ytReady || movies.length === 0) return;

        const currentMovie = movies[activeSlideIndex];
        const videoKey = currentMovie?.tmdb_trailer_url
            ? extractYouTubeKey(currentMovie.tmdb_trailer_url)
            : null;

        if (!videoKey) return;

        // Destroy previous player
        if (playerRef.current) {
            try {
                playerRef.current.destroy();
            } catch (e) {
                // Ignore
            }
            playerRef.current = null;
        }

        const timer = setTimeout(() => {
            const containerId = `yt-player-local-${currentMovie.id}`;
            const container = document.getElementById(containerId);
            if (!container) return;

            playerRef.current = new window.YT.Player(containerId, {
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
                            setVideoReady(true); // Video is now actually playing
                        } else if (event.data === 0) {
                            setVideoReady(false);
                            goToNextSlide();
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

    // Sync thumbnail slider with main slider
    useEffect(() => {
        if (thumbsSliderRef.current?.splide && movies.length > 0) {
            thumbsSliderRef.current.splide.go(activeSlideIndex);
        }
    }, [activeSlideIndex, movies.length]);

    const handleSlideChange = (splide: any) => {
        setActiveSlideIndex(splide.index);
        setVideoReady(false); // Reset video ready state to show backdrop while loading
    };

    const toggleMute = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsMuted(!isMuted);
    };

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

    return (
        <div className="h-screen relative overflow-hidden">
            <Splide

                ref={mainSliderRef}
                options={{
                    type: "fade",
                    rewind: true,
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
                {movies.map((movie, index) => {
                    const videoKey = movie.tmdb_trailer_url
                        ? extractYouTubeKey(movie.tmdb_trailer_url)
                        : null;

                    return (
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

                            {/* YouTube Player */}
                            <AnimatePresence mode="wait">
                                {videoKey && index === activeSlideIndex && (
                                    <motion.div
                                        key={`video-${movie.id}`}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: videoReady ? 1 : 0 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.5 }}
                                        className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden pointer-events-none"
                                        style={{
                                            // Scale up to hide YouTube end screen annotations at edges
                                            clipPath: 'inset(0)',
                                        }}
                                    >
                                        <div className="relative w-full h-full overflow-hidden">
                                            <div
                                                id={`yt-player-local-${movie.id}`}
                                                className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
                                                style={{
                                                    width: '120vw', // Scale up to crop edges
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
                                        {movie.title}
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
                                        {movie.year && movie.year > 0 && <span>{movie.year}</span>}
                                        {movie.rating && movie.rating > 0 && (
                                            <span className="flex items-center gap-1">
                                                <span className="text-yellow-400">★</span>
                                                {movie.rating.toFixed(1)}
                                            </span>
                                        )}
                                        {/* Quality Tags - Netflix-style tags */}
                                        {movie.quality_tags && movie.quality_tags.length > 0 && (
                                            <QualityTags
                                                tags={movie.quality_tags}
                                                size="sm"
                                                variant="compact"
                                                className="flex-wrap"
                                            />
                                        )}
                                    </div>

                                    <p className={`text-gray-200 mb-4 line-clamp-2 text-shadow-md ${getGenreTextStyle(movie.genres?.map(g => g.name) || movie.genre_names || []).className}`}>
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
                                        {/* <button
                                            onClick={() => onInfo(movie)}
                                            className="flex items-center gap-2 bg-gray-500/70 text-white px-6 py-3 rounded-md font-bold hover:bg-gray-500/90 transition-colors"
                                        >
                                            <Info className="w-5 h-5" />
                                            More Info
                                        </button> */}
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
                    );
                })}
            </Splide>

            {/* Thumbnail Navigation */}
            <div className="absolute bottom-8 left-0 right-0 z-30 px-4 md:px-16 overflow-visible py-12">
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

export default LocalMoviesHeroSlider;
