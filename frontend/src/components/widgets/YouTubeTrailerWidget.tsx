"use client";
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Volume2, VolumeX, SkipForward } from 'lucide-react';
import { Media } from '@/types/media';

// Declare global YouTube types
declare global {
    interface Window {
        YT: any;
        onYouTubeIframeAPIReady: () => void;
    }
}

interface YouTubeTrailerWidgetProps {
    media: Media[];
    title?: string;
    autoPlay?: boolean;
    muted?: boolean;
    showControls?: boolean;
    layout?: 'banner' | 'slideshow';
    className?: string;
    onPlay?: (media: Media) => void;
    onInfo?: (media: Media) => void;
}

export default function YouTubeTrailerWidget({
    media = [],
    title = 'Trailers',
    autoPlay = true,
    muted = true,
    showControls = false,
    layout = 'slideshow',
    className = '',
    onPlay,
    onInfo
}: YouTubeTrailerWidgetProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(muted);
    const [ytReady, setYtReady] = useState(false);
    const [showControlsOverlay, setShowControlsOverlay] = useState(showControls);
    const [controlsTimeout, setControlsTimeout] = useState<NodeJS.Timeout | null>(null);
    const playerRef = useRef<any>(null);

    // Filter media with YouTube trailers
    const trailersMedia = media.filter(item => 
        item.tmdb_trailer_url && extractYouTubeKey(item.tmdb_trailer_url)
    );

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

    // Initialize YouTube player
    useEffect(() => {
        if (!ytReady || trailersMedia.length === 0) return;

        const currentMedia = trailersMedia[currentIndex];
        const videoKey = extractYouTubeKey(currentMedia?.tmdb_trailer_url || '');
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
            const containerId = `yt-trailer-widget-${currentMedia.id}`;
            const container = document.getElementById(containerId);
            if (!container) return;

            playerRef.current = new window.YT.Player(containerId, {
                videoId: videoKey,
                playerVars: {
                    autoplay: autoPlay ? 1 : 0,
                    mute: isMuted ? 1 : 0,
                    controls: 0,
                    showinfo: 0,
                    rel: 0,
                    iv_load_policy: 3,
                    modestbranding: 1,
                    playsinline: 1,
                    disablekb: 1,
                    fs: 0,
                    cc_load_policy: 0,
                    enablejsapi: 1,
                    start: 10, // Start 10 seconds in
                    origin: window.location.origin,
                },
                events: {
                    onStateChange: (event: any) => {
                        const playerState = event.data;
                        const isVideoPlaying = playerState === 1;
                        const isVideoEnded = playerState === 0;
                        setIsPlaying(isVideoPlaying);

                        if (isVideoEnded) {
                            // Auto-advance to next trailer
                            goToNext();
                        }

                        // Auto-hide controls when playing
                        if (isVideoPlaying && showControlsOverlay) {
                            hideControlsAfterDelay();
                        }
                    },
                    onReady: (event: any) => {
                        if (autoPlay) {
                            if (isMuted) {
                                event.target.mute();
                            } else {
                                event.target.unMute();
                            }
                            event.target.seekTo(10, true);
                            event.target.playVideo();
                        }
                    },
                    onError: () => {
                        // Skip to next trailer on error
                        goToNext();
                    },
                },
            });
        }, 100);

        return () => {
            clearTimeout(timer);
        };
    }, [ytReady, currentIndex, trailersMedia, autoPlay, isMuted]);

    // Auto-hide controls
    const hideControlsAfterDelay = () => {
        if (controlsTimeout) {
            clearTimeout(controlsTimeout);
        }
        const timeout = setTimeout(() => {
            setShowControlsOverlay(false);
        }, 3000);
        setControlsTimeout(timeout);
    };

    // Navigation functions
    const goToNext = () => {
        setCurrentIndex(prev => (prev + 1) % trailersMedia.length);
    };

    // Control functions
    const togglePlayPause = () => {
        if (!playerRef.current) return;
        if (isPlaying) {
            playerRef.current.pauseVideo();
        } else {
            playerRef.current.playVideo();
        }
    };

    const toggleMute = () => {
        if (!playerRef.current) return;
        if (isMuted) {
            playerRef.current.unMute();
            setIsMuted(false);
        } else {
            playerRef.current.mute();
            setIsMuted(true);
        }
    };

    // Handle mouse movement to show controls
    const handleMouseMove = () => {
        setShowControlsOverlay(true);
        if (isPlaying) {
            hideControlsAfterDelay();
        }
    };

    if (trailersMedia.length === 0) {
        return null;
    }

    const currentMedia = trailersMedia[currentIndex];

    if (layout === 'banner') {
        return (
            <div className={`relative w-full h-[60vh] min-h-[400px] overflow-hidden ${className}`}>
                {/* YouTube Player */}
                <div className="absolute inset-0">
                    <div
                        id={`yt-trailer-widget-${currentMedia.id}`}
                        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
                        style={{
                            width: '120vw',
                            height: '120vh',
                            minWidth: '200vh',
                            minHeight: '70vw',
                        }}
                    />
                </div>

                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                {/* Content Overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-8">
                    <div className="max-w-2xl">
                        <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">{title}</h2>
                        <h3 className="text-xl md:text-2xl font-semibold text-white mb-4">
                            {currentMedia.title}
                        </h3>
                        <div className="flex items-center gap-4 mb-4">
                            <button
                                onClick={() => onPlay?.(currentMedia)}
                                className="flex items-center gap-2 px-6 py-3 bg-white text-black font-bold rounded-md hover:bg-white/90 transition-all transform hover:scale-105"
                            >
                                <Play className="w-5 h-5 fill-current" />
                                Watch Now
                            </button>
                            <button
                                onClick={() => onInfo?.(currentMedia)}
                                className="flex items-center gap-2 px-6 py-3 bg-gray-600/80 text-white font-bold rounded-md hover:bg-gray-600 transition-all"
                            >
                                More Info
                            </button>
                        </div>
                        {/* Progress Indicators */}
                        <div className="flex gap-2">
                            {trailersMedia.map((_, index) => (
                                <button
                                    key={index}
                                    onClick={() => setCurrentIndex(index)}
                                    className={`h-1 rounded-full transition-all ${
                                        index === currentIndex ? 'bg-white w-8' : 'bg-white/50 w-4'
                                    }`}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Controls Overlay */}
                <AnimatePresence>
                    {showControlsOverlay && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 pointer-events-none"
                            onMouseMove={handleMouseMove}
                        >
                            <div className="absolute top-4 right-4 flex gap-2 pointer-events-auto">
                                <button
                                    onClick={togglePlayPause}
                                    className="p-3 bg-black/70 backdrop-blur-sm rounded-full text-white hover:bg-black/90 transition-colors"
                                >
                                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                </button>
                                <button
                                    onClick={toggleMute}
                                    className="p-3 bg-black/70 backdrop-blur-sm rounded-full text-white hover:bg-black/90 transition-colors"
                                >
                                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                                </button>
                                <button
                                    onClick={goToNext}
                                    className="p-3 bg-black/70 backdrop-blur-sm rounded-full text-white hover:bg-black/90 transition-colors"
                                >
                                    <SkipForward className="w-4 h-4" />
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    }

    // Slideshow layout
    return (
        <div className={`py-6 ${className}`}>
            <div className="flex items-center justify-between mb-4 px-4 md:px-12">
                <h2 className="text-xl md:text-2xl font-bold text-white">{title}</h2>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">
                        {currentIndex + 1} of {trailersMedia.length}
                    </span>
                </div>
            </div>
            <div className="relative" onMouseMove={handleMouseMove}>
                <div className="aspect-video max-w-4xl mx-auto rounded-xl overflow-hidden bg-black">
                    <div
                        id={`yt-trailer-widget-${currentMedia.id}`}
                        className="w-full h-full"
                    />
                </div>

                {/* Controls Overlay */}
                <AnimatePresence>
                    {showControlsOverlay && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 pointer-events-none"
                        >
                            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between pointer-events-auto">
                                <div className="flex items-center gap-4">
                                    <h3 className="text-white font-semibold">{currentMedia.title}</h3>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={togglePlayPause}
                                        className="p-2 bg-black/70 backdrop-blur-sm rounded-full text-white hover:bg-black/90 transition-colors"
                                    >
                                        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                    </button>
                                    <button
                                        onClick={toggleMute}
                                        className="p-2 bg-black/70 backdrop-blur-sm rounded-full text-white hover:bg-black/90 transition-colors"
                                    >
                                        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                                    </button>
                                    <button
                                        onClick={goToNext}
                                        className="p-2 bg-black/70 backdrop-blur-sm rounded-full text-white hover:bg-black/90 transition-colors"
                                    >
                                        <SkipForward className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Thumbnail Navigation */}
            <div className="flex gap-2 mt-4 px-4 md:px-12 overflow-x-auto">
                {trailersMedia.map((item, index) => (
                    <button
                        key={item.id}
                        onClick={() => setCurrentIndex(index)}
                        className={`flex-shrink-0 w-20 h-12 rounded overflow-hidden transition-all ${
                            index === currentIndex ? 'ring-2 ring-red-500' : 'opacity-60 hover:opacity-100'
                        }`}
                    >
                        <img
                            src={item.tmdb_backdrop_url || `/api/thumbnails/${item.id}`}
                            alt={item.title}
                            className="w-full h-full object-cover"
                        />
                    </button>
                ))}
            </div>
        </div>
    );
}