"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Tv } from "lucide-react";
import { getApiUrl } from "@/lib/api";
import { useNavigate } from "@/hooks/useNavigate";

interface PreviewVideo {
    id: string;
    media_id: number;
    title: string;
    url: string;
    type: string;
    year: number;
    rating: number;
    navigate_path: string;
}

interface NowPlayingResponse {
    videos: PreviewVideo[];
    total: number;
    page: number;
    limit: number;
}

interface NewsItem {
    id: string;
    text: string;
    source: string;
    time: string;
}

interface NewsResponse {
    items: NewsItem[];
    total: number;
}

const SimpleTVChannel: React.FC = () => {
    const navigate = useNavigate();
    const [videos, setVideos] = useState<PreviewVideo[]>([]);
    const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(true);
    const [isMuted, setIsMuted] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showControls, setShowControls] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const [currentTime, setCurrentTime] = useState<string>("");

    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const newsIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const clockIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const videoTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const mountedRef = useRef(true);

    const VIDEOS_PER_BATCH = 10;

    // Initialize with loading message to show ticker immediately
    const [newsItems, setNewsItems] = useState<NewsItem[]>([
        { id: "loading", text: "Loading latest news...", source: "system", time: new Date().toISOString() }
    ]);

    // Fetch news from API
    const fetchNews = useCallback(async () => {
        if (!mountedRef.current) return;

        try {
            const apiUrl = getApiUrl();
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(`${apiUrl}/api/news/ticker`, {
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.ok && mountedRef.current) {
                const data: NewsResponse = await response.json();
                console.log("News API response:", data);
                if (data.items && data.items.length > 0) {
                    console.log("Setting news items:", data.items.length);
                    setNewsItems(data.items);
                } else {
                    console.log("No news items in response, keeping current news");
                    // Don't clear existing news if API returns empty
                }
            } else {
                console.log("News API response not ok:", response.status);
                // Keep existing news on API failure
            }
        } catch (err) {
            console.error("News fetch failed:", err);
            // Keep existing news on error - don't clear the ticker
        }
    }, []);

    // Update current time
    const updateClock = useCallback(() => {
        if (!mountedRef.current) return;

        const now = new Date();
        setCurrentTime(now.toLocaleTimeString('en-US', {
            hour12: true,
            hour: '2-digit',
            minute: '2-digit'
        }));
    }, []);

    // Fetch videos from API
    const fetchVideos = useCallback(async () => {
        if (!mountedRef.current) return;

        try {
            setIsLoading(true);
            const apiUrl = getApiUrl();
            const randomPage = Math.floor(Math.random() * 20) + 1;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            const response = await fetch(
                `${apiUrl}/api/now-playing/previews?page=${randomPage}&limit=${VIDEOS_PER_BATCH}&random=true&t=${Date.now()}`,
                { signal: controller.signal }
            );

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data: NowPlayingResponse = await response.json();

            if (data.videos && data.videos.length > 0 && mountedRef.current) {
                const videosWithFullUrls = data.videos.map(video => ({
                    ...video,
                    url: `${apiUrl}${video.url}`
                }));

                // Shuffle for randomization
                const shuffledVideos = videosWithFullUrls.sort(() => Math.random() - 0.5);

                setVideos(shuffledVideos);
                setCurrentVideoIndex(0);
                setError(null);
            } else {
                setError("No preview videos available");
            }
        } catch (err) {
            console.error("Error fetching videos:", err);
            setError("Failed to load preview videos");

            // Retry after delay
            setTimeout(() => {
                if (mountedRef.current) {
                    fetchVideos();
                }
            }, 5000);
        } finally {
            if (mountedRef.current) {
                setIsLoading(false);
            }
        }
    }, []);

    // Skip to next video
    const skipToNextVideo = useCallback(() => {
        if (!mountedRef.current || videos.length === 0) return;

        if (currentVideoIndex < videos.length - 1) {
            setCurrentVideoIndex(prev => prev + 1);
        } else {
            // Load new batch
            fetchVideos();
        }
    }, [currentVideoIndex, videos.length, fetchVideos]);

    // Handle video end
    const handleVideoEnd = useCallback(() => {
        skipToNextVideo();
    }, [skipToNextVideo]);

    // Auto-hide controls
    const resetControlsTimeout = useCallback(() => {
        if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current);
        }
        setShowControls(true);
        controlsTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current) {
                setShowControls(false);
            }
        }, 3000);
    }, []);

    // Toggle play/pause
    const togglePlayPause = useCallback(() => {
        if (!videoRef.current) return;

        if (isPlaying) {
            videoRef.current.pause();
        } else {
            videoRef.current.play().catch(() => {
                console.warn("Play failed");
            });
        }
        setIsPlaying(!isPlaying);
        resetControlsTimeout();
    }, [isPlaying, resetControlsTimeout]);

    // Toggle mute
    const toggleMute = useCallback(() => {
        if (!videoRef.current) return;

        videoRef.current.muted = !isMuted;
        setIsMuted(!isMuted);
        resetControlsTimeout();
    }, [isMuted, resetControlsTimeout]);

    // Toggle fullscreen
    const toggleFullscreen = useCallback(async () => {
        if (!containerRef.current) return;

        try {
            if (!isFullscreen) {
                if (containerRef.current.requestFullscreen) {
                    await containerRef.current.requestFullscreen();
                } else if ((containerRef.current as any).webkitRequestFullscreen) {
                    await (containerRef.current as any).webkitRequestFullscreen();
                } else if ((containerRef.current as any).msRequestFullscreen) {
                    await (containerRef.current as any).msRequestFullscreen();
                }
            } else {
                if (document.exitFullscreen) {
                    await document.exitFullscreen();
                } else if ((document as any).webkitExitFullscreen) {
                    await (document as any).webkitExitFullscreen();
                } else if ((document as any).msExitFullscreen) {
                    await (document as any).msExitFullscreen();
                }
            }
        } catch (error) {
            console.error("Fullscreen toggle failed:", error);
        }
        resetControlsTimeout();
    }, [isFullscreen, resetControlsTimeout]);

    // Handle fullscreen change
    const handleFullscreenChange = useCallback(() => {
        const isCurrentlyFullscreen = !!(
            document.fullscreenElement ||
            (document as any).webkitFullscreenElement ||
            (document as any).msFullscreenElement
        );
        setIsFullscreen(isCurrentlyFullscreen);
    }, []);

    // Handle keyboard events
    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        switch (event.key.toLowerCase()) {
            case 'f':
                event.preventDefault();
                toggleFullscreen();
                break;
            case 'escape':
                if (isFullscreen) {
                    event.preventDefault();
                    toggleFullscreen();
                }
                break;
            case ' ':
            case 'spacebar':
                event.preventDefault();
                togglePlayPause();
                break;
            case 'm':
                event.preventDefault();
                toggleMute();
                break;
            case 'arrowleft':
                event.preventDefault();
                skipToNextVideo();
                break;
            default:
                break;
        }
    }, [isFullscreen, toggleFullscreen, togglePlayPause, toggleMute, skipToNextVideo]);

    // Get current video
    const currentVideo = videos[currentVideoIndex] || null;
    const currentVideoMeta = currentVideo
        ? [
            currentVideo.year > 0 ? String(currentVideo.year) : null,
            currentVideo.rating > 0 ? `★ ${currentVideo.rating.toFixed(1)}` : null
        ].filter(Boolean).join("  •  ")
        : "";

    // Initialize
    useEffect(() => {
        fetchVideos();
        return () => {
            mountedRef.current = false;
        };
    }, [fetchVideos]);

    // Setup video event listeners
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !currentVideo) return;

        const handleLoadedData = () => {
            if (!mountedRef.current) return;
            video.play().catch(() => {
                console.warn("Auto-play failed");
                setTimeout(skipToNextVideo, 2000);
            });
        };

        const handleError = () => {
            console.warn("Video error, skipping");
            setTimeout(skipToNextVideo, 1000);
        };

        const handleStalled = () => {
            console.warn("Video stalled");
            if (videoTimeoutRef.current) {
                clearTimeout(videoTimeoutRef.current);
            }
            videoTimeoutRef.current = setTimeout(() => {
                if (mountedRef.current) {
                    skipToNextVideo();
                }
            }, 10000);
        };

        video.addEventListener("loadeddata", handleLoadedData);
        video.addEventListener("ended", handleVideoEnd);
        video.addEventListener("error", handleError);
        video.addEventListener("stalled", handleStalled);

        return () => {
            video.removeEventListener("loadeddata", handleLoadedData);
            video.removeEventListener("ended", handleVideoEnd);
            video.removeEventListener("error", handleError);
            video.removeEventListener("stalled", handleStalled);

            if (videoTimeoutRef.current) {
                clearTimeout(videoTimeoutRef.current);
            }
        };
    }, [currentVideo, handleVideoEnd, skipToNextVideo]);

    // Setup news fetching
    useEffect(() => {
        // Fetch news immediately
        fetchNews();

        // Set up interval to fetch news every 2 minutes
        newsIntervalRef.current = setInterval(() => {
            if (mountedRef.current) {
                fetchNews();
            }
        }, 2 * 60 * 1000); // Every 2 minutes

        return () => {
            if (newsIntervalRef.current) {
                clearInterval(newsIntervalRef.current);
            }
        };
    }, [fetchNews]);

    // Setup clock updates
    useEffect(() => {
        updateClock();
        clockIntervalRef.current = setInterval(() => {
            if (mountedRef.current) {
                updateClock();
            }
        }, 1000);

        return () => {
            if (clockIntervalRef.current) {
                clearInterval(clockIntervalRef.current);
            }
        };
    }, [updateClock]);

    // Mouse move handler
    const handleMouseMove = useCallback(() => {
        resetControlsTimeout();
    }, [resetControlsTimeout]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            mountedRef.current = false;
            if (controlsTimeoutRef.current) {
                clearTimeout(controlsTimeoutRef.current);
            }
            if (newsIntervalRef.current) {
                clearInterval(newsIntervalRef.current);
            }
            if (clockIntervalRef.current) {
                clearInterval(clockIntervalRef.current);
            }
            if (videoTimeoutRef.current) {
                clearTimeout(videoTimeoutRef.current);
            }
        };
    }, []);

    // Setup fullscreen event listeners
    useEffect(() => {
        document.addEventListener("fullscreenchange", handleFullscreenChange);
        document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
        document.addEventListener("msfullscreenchange", handleFullscreenChange);

        return () => {
            document.removeEventListener("fullscreenchange", handleFullscreenChange);
            document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
            document.removeEventListener("msfullscreenchange", handleFullscreenChange);
        };
    }, [handleFullscreenChange]);

    // Setup keyboard event listeners
    useEffect(() => {
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [handleKeyDown]);

    // Auto-reload after 1 hour for stability
    useEffect(() => {
        const reloadTimer = setTimeout(() => {
            window.location.reload();
        }, 60 * 60 * 1000); // 1 hour

        return () => clearTimeout(reloadTimer);
    }, []);

    if (isLoading && videos.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-black">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
                    <p className="text-white text-lg">Loading HomeFlix TV...</p>
                </div>
            </div>
        );
    }

    if (error && videos.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-black">
                <div className="text-center">
                    <div className="text-red-500 text-6xl mb-4">
                        <Tv />
                    </div>
                    <p className="text-white text-xl mb-4">{error}</p>
                    <button
                        onClick={fetchVideos}
                        className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className="relative w-full h-screen bg-black overflow-hidden"
            onMouseMove={handleMouseMove}
            onClick={togglePlayPause}
        >
            {/* Video Player */}
            <div className="relative bg-black h-full">
                {currentVideo && (
                    <video
                        ref={videoRef}
                        src={currentVideo.url}
                        className="w-full h-full object-cover"
                        autoPlay
                        muted={isMuted}
                        playsInline
                        preload="auto"
                        controls={false}
                        key={currentVideo.id}
                    />
                )}

                {/* HomeFlix TV Watermark */}
                <div className="absolute top-6 right-6 z-50">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            navigate.push("/");
                        }}
                        className="text-white hover:text-red-400 text-xl font-bold tracking-wider drop-shadow-lg transition-colors duration-200"
                    >
                        HOMEFLIX
                    </button>
                </div>
                {currentVideo && (
                    <div className="absolute bottom-10 left-6 z-50 text-left max-w-[70vw]">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                navigate.push(currentVideo.navigate_path || "/");
                            }}
                            className="text-white hover:text-red-400 text-2xl font-semibold leading-tight drop-shadow-lg transition-colors duration-200 line-clamp-2"
                        >
                            {currentVideo.title}
                        </button>
                        {currentVideoMeta && (
                            <div className="text-white/90 text-sm mt-1 drop-shadow-lg">
                                {currentVideoMeta}
                            </div>
                        )}
                    </div>
                )}

                {/* Controls Overlay */}
                {showControls && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 pointer-events-none"
                    >
                        {/* Center Play Button */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    togglePlayPause();
                                }}
                                className="bg-black bg-opacity-60 hover:bg-opacity-80 text-white p-6 rounded-full transition-all duration-200 transform hover:scale-110"
                            >
                                {isPlaying ? (
                                    <Pause className="w-12 h-12" />
                                ) : (
                                    <Play className="w-12 h-12 ml-1" />
                                )}
                            </button>
                        </div>

                        {/* Bottom Controls */}
                        <div className="absolute bottom-6 left-6 right-6 pointer-events-auto">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            togglePlayPause();
                                        }}
                                        className="bg-black bg-opacity-60 hover:bg-opacity-80 text-white p-3 rounded-full transition-colors"
                                        title="Play/Pause (Space)"
                                    >
                                        {isPlaying ? (
                                            <Pause className="w-6 h-6" />
                                        ) : (
                                            <Play className="w-6 h-6" />
                                        )}
                                    </button>

                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleMute();
                                        }}
                                        className="bg-black bg-opacity-60 hover:bg-opacity-80 text-white p-3 rounded-full transition-colors"
                                        title="Mute/Unmute (M)"
                                    >
                                        {isMuted ? (
                                            <VolumeX className="w-6 h-6" />
                                        ) : (
                                            <Volume2 className="w-6 h-6" />
                                        )}
                                    </button>

                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            skipToNextVideo();
                                        }}
                                        className="bg-black bg-opacity-60 hover:bg-opacity-80 text-white px-4 py-2 rounded-full transition-colors"
                                        title="Next Video (←)"
                                    >
                                        <span className="text-sm font-bold">NEXT</span>
                                    </button>

                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleFullscreen();
                                        }}
                                        className="bg-black bg-opacity-60 hover:bg-opacity-80 text-white p-3 rounded-full transition-colors"
                                        title="Fullscreen (F)"
                                    >
                                        {isFullscreen ? (
                                            <Minimize className="w-6 h-6" />
                                        ) : (
                                            <Maximize className="w-6 h-6" />
                                        )}
                                    </button>
                                </div>

                                <div className="bg-black bg-opacity-60 rounded-full px-4 py-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                                        <span className="text-white text-sm font-light">LIVE</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* News Ticker */}
                <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
                    <div className="flex items-stretch h-6 px-1" style={{ backgroundColor: '#1B1B1B' }}>
                        {/* Live Indicator */}
                        {/* <div
                            className="flex items-center justify-center px-4 text-white text-sm font-bold flex-shrink-0"
                            style={{ backgroundColor: '#DC2626' }}
                        >
                            LIVE
                        </div> */}

                        {/* Scrolling News Text */}
                        <div className="flex-1 overflow-hidden relative flex items-center">
                            {newsItems.length > 0 && (
                                <motion.div
                                    className="whitespace-nowrap text-white text-sm font-medium px-4"
                                    animate={{
                                        x: ["100%", "-100%"],
                                    }}
                                    transition={{
                                        duration: newsItems.length > 1 ? Math.max(120, newsItems.length * 8) : 120,
                                        repeat: Infinity,
                                        ease: "linear",
                                    }}
                                    key={newsItems.map(item => item.id).join(',')} // Re-animate when news changes
                                >
                                    {newsItems.map(item => item.text).join("    •    ")}
                                    {newsItems.length > 1 && "    •    " + newsItems.map(item => item.text).join("    •    ")}
                                </motion.div>
                            )}
                        </div>

                        {/* Digital Clock */}
                        <div
                            className="flex items-center justify-center px-4 font-mono text-white text-sm font-bold flex-shrink-0 min-w-[80px]"
                            style={{ backgroundColor: '#DC2626' }}
                        >
                            {currentTime || "00:00"}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SimpleTVChannel;
