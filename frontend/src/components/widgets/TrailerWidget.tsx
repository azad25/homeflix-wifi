"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Info, Volume2, VolumeX, ExternalLink, ChevronLeft, ChevronRight, Star, Calendar, Plus, Check } from 'lucide-react';
import { Media } from '@/types/media';
import { getApiUrl } from '@/lib/api';
import { useNavigate } from '@/hooks/useNavigate';
import { useMyList } from '@/hooks/useMyList';

// Declare global YouTube types
declare global {
    interface Window {
        YT: any;
        onYouTubeIframeAPIReady: () => void;
    }
}

interface TrailerWidgetProps {
    media: Media[];
    title?: string;
    maxItems?: number;
    autoPlay?: boolean;
    showInfo?: boolean;
    className?: string;
    autoScroll?: boolean;
    scrollInterval?: number;
}

interface TrailerData {
    id: string;
    title: string;
    description: string;
    thumbnail: string;
    videoId: string;
    publishedAt: string;
    channelTitle: string;
    viewCount?: number;
    duration?: string;
    media: Media;
}

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

export default function TrailerWidget({
    media,
    title = 'Latest Trailers',
    maxItems = 6,
    autoPlay = true,
    showInfo = true,
    className = '',
    autoScroll = true,
    scrollInterval = 8,
}: TrailerWidgetProps) {
    const navigate = useNavigate();
    const { isInMyList, toggleMyList } = useMyList();
    const [trailers, setTrailers] = useState<TrailerData[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(true); // Start muted for auto-play compliance
    const [loading, setLoading] = useState(true);
    const [isHovering, setIsHovering] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [ytReady, setYtReady] = useState(false);
    const [videoReady, setVideoReady] = useState(false);
    const [logoUrls, setLogoUrls] = useState<{ [key: number]: string }>({});
    const autoScrollRef = useRef<NodeJS.Timeout | null>(null);
    const playerRef = useRef<any>(null);

    const apiUrl = getApiUrl();
    const currentTrailer = trailers[currentIndex];

    // Load YouTube IFrame API and enable auto-play
    useEffect(() => {
        if (window.YT && window.YT.Player) {
            setYtReady(true);
            return;
        }

        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.onerror = () => {
            console.error('Failed to load YouTube IFrame API');
            // Fallback: try again after a delay
            setTimeout(() => {
                const retryTag = document.createElement('script');
                retryTag.src = 'https://www.youtube.com/iframe_api';
                document.head.appendChild(retryTag);
            }, 2000);
        };
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

        window.onYouTubeIframeAPIReady = () => {
            setYtReady(true);
            console.log('YouTube IFrame API ready');
        };

        // Timeout fallback
        setTimeout(() => {
            if (!window.YT || !window.YT.Player) {
                console.warn('YouTube API failed to load within timeout');
            }
        }, 10000);

        // Try to enable auto-play by creating a silent audio context
        try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            audioContext.resume().then(() => {
                console.log('Audio context resumed for auto-play');
            }).catch(() => {
                console.log('Could not resume audio context');
            });
        } catch (e) {
            console.log('Audio context not available');
        }
    }, []);

    // Convert media prop to trailers
    const convertMediaToTrailers = useCallback(() => {
        try {
            setLoading(true);
            
            const trailerResults = media.slice(0, maxItems).map((item) => {
                // Use actual TMDB trailer URL if available
                const videoId = item.tmdb_trailer_url ? extractYouTubeKey(item.tmdb_trailer_url) : null;
                
                return {
                    id: `trailer-${item.id}`,
                    title: `${item.title} - Official Trailer`,
                    description: item.description || `Watch the official trailer for ${item.title}`,
                    thumbnail: item.tmdb_backdrop_url || `${apiUrl}/api/thumbnails/${item.id}`,
                    videoId: videoId || `mock-video-${item.id}`, // Use actual YouTube video ID or fallback
                    publishedAt: new Date().toISOString(),
                    channelTitle: 'Official Movie Trailers',
                    viewCount: Math.floor(Math.random() * 1000000),
                    duration: '2:30',
                    media: item,
                };
            });
            
            // Filter to only include trailers with actual YouTube video IDs
            const validTrailers = trailerResults.filter(trailer => 
                trailer.media.tmdb_trailer_url && extractYouTubeKey(trailer.media.tmdb_trailer_url)
            );
            
            // If no valid trailers, show first few media items anyway (without video playback)
            if (validTrailers.length === 0 && trailerResults.length > 0) {
                setTrailers(trailerResults.slice(0, 3)); // Show first 3 without video
                setCurrentIndex(0);
            } else {
                setTrailers(validTrailers);
                if (validTrailers.length > 0) {
                    setCurrentIndex(0);
                    // Fetch logos for all valid trailers
                    validTrailers.forEach(trailer => {
                        if (trailer.media.tmdb_id) {
                            fetchLogo(trailer.media.tmdb_id, trailer.media.type === 'tv' ? 'tv' : 'movie');
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Failed to convert media to trailers:', error);
        } finally {
            setLoading(false);
        }
    }, [media, maxItems, apiUrl]);

    // Handle going to next slide
    const goToNextSlide = useCallback(() => {
        setCurrentIndex((prev) => (prev + 1) % trailers.length);
        setImageLoaded(false);
        setIsPlaying(false);
        setVideoReady(false);
    }, [trailers.length]);

    // Fetch logo from TMDB images API
    const fetchLogo = async (tmdbId: number, mediaType: 'movie' | 'tv') => {
        try {
            const endpoint = mediaType === 'movie'
                ? `${apiUrl}/api/tmdb/movie/${tmdbId}/images`
                : `${apiUrl}/api/tmdb/tv/${tmdbId}/images`;
            const response = await fetch(endpoint);

            if (!response.ok) return;

            const data = await response.json();
            const logos = data.logos || [];

            // Find best English logo (highest vote_average)
            let bestLogo = logos.find((l: any) => l.iso_639_1 === 'en');

            // Fallback to any logo if no English
            if (!bestLogo && logos.length > 0) {
                bestLogo = logos[0];
            }

            if (bestLogo?.file_path) {
                const logoUrl = `https://image.tmdb.org/t/p/w500${bestLogo.file_path}`;
                setLogoUrls(prev => ({ ...prev, [tmdbId]: logoUrl }));
            }
        } catch (err) {
            console.error('Error fetching logo for TMDB ID', tmdbId, ':', err);
        }
    };

    // Convert media prop to trailers
    useEffect(() => {
        console.log('TrailerWidget: Media changed, converting to trailers');
        convertMediaToTrailers();
    }, [convertMediaToTrailers]);

    // Auto-scroll functionality with preloading
    useEffect(() => {
        if (autoScroll && !isHovering && trailers.length > 1) {
            autoScrollRef.current = setInterval(() => {
                setCurrentIndex((prev) => {
                    const nextIndex = (prev + 1) % trailers.length;
                    // Preload next video
                    const nextTrailer = trailers[nextIndex];
                    if (nextTrailer?.media.tmdb_trailer_url) {
                        const videoKey = extractYouTubeKey(nextTrailer.media.tmdb_trailer_url);
                        if (videoKey) {
                            console.log('Preloading next video:', nextTrailer.media.title);
                        }
                    }
                    return nextIndex;
                });
                setImageLoaded(false);
                setIsPlaying(false);
                setVideoReady(false);
            }, scrollInterval * 1000);
        }
        return () => {
            if (autoScrollRef.current) clearInterval(autoScrollRef.current);
        };
    }, [autoScroll, isHovering, trailers, scrollInterval]);

    // Initialize YouTube player when slide changes
    useEffect(() => {
        if (!ytReady || trailers.length === 0) return;

        const currentTrailer = trailers[currentIndex];
        const videoKey = currentTrailer?.media.tmdb_trailer_url
            ? extractYouTubeKey(currentTrailer.media.tmdb_trailer_url)
            : null;

        if (!videoKey) {
            console.log('No video key found for trailer:', currentTrailer?.media.title);
            return;
        }

        console.log('Initializing YouTube player for:', currentTrailer.media.title, 'with video key:', videoKey);

        // Destroy previous player
        if (playerRef.current) {
            try {
                playerRef.current.destroy();
            } catch (e) {
                console.log('Error destroying previous player:', e);
            }
            playerRef.current = null;
        }

        const timer = setTimeout(() => {
            const containerId = `yt-player-trailer-${currentTrailer.media.id}`;
            const container = document.getElementById(containerId);
            if (!container) {
                console.log('Container not found:', containerId);
                return;
            }

            console.log('Creating YouTube player in container:', containerId);

            // Ensure container has proper dimensions
            container.style.width = '100%';
            container.style.height = '100%';
            container.style.position = 'absolute';
            container.style.top = '0';
            container.style.left = '0';

            playerRef.current = new window.YT.Player(containerId, {
                videoId: videoKey,
                width: '100%',
                height: '100%',
                playerVars: {
                    autoplay: 1,
                    mute: 1, // Always muted for auto-play compliance
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
                    start: 5, // Start 5 seconds in (reduced from 10)
                    origin: window.location.origin,
                    loop: 0,
                    wmode: 'opaque',
                },
                events: {
                    onStateChange: (event: any) => {
                        console.log('YouTube player state changed:', event.data);
                        // 1 = playing, 0 = ended
                        if (event.data === 1) {
                            setVideoReady(true);
                            setIsPlaying(true);
                            console.log('Video is now playing');
                        } else if (event.data === 0) {
                            setVideoReady(false);
                            setIsPlaying(false);
                            console.log('Video ended, advancing to next');
                            goToNextSlide();
                        }
                    },
                    onReady: (event: any) => {
                        console.log('YouTube player ready');
                        
                        // Force play immediately with retry mechanism
                        const attemptPlay = (retries = 3) => {
                            try {
                                event.target.mute(); // Ensure muted
                                event.target.seekTo(5, true); // Seek to 5 seconds
                                event.target.playVideo(); // Force play
                                console.log(`Attempting to play video (${4 - retries}/3)...`);
                                
                                // Check if playing after a short delay
                                setTimeout(() => {
                                    const state = event.target.getPlayerState();
                                    if (state !== 1 && retries > 0) { // Not playing, retry
                                        console.log('Play attempt failed, retrying...');
                                        attemptPlay(retries - 1);
                                    } else if (state === 1) {
                                        console.log('Video playing successfully');
                                    }
                                }, 1000);
                            } catch (error) {
                                console.error('Error starting video playback:', error);
                                if (retries > 0) {
                                    setTimeout(() => attemptPlay(retries - 1), 1000);
                                }
                            }
                        };
                        
                        attemptPlay();
                        
                        // Set up interval to end video early
                        const checkEndTime = setInterval(() => {
                            try {
                                const player = event.target;
                                const duration = player.getDuration();
                                const currentTime = player.getCurrentTime();

                                // End 10 seconds before actual end
                                if (duration > 0 && currentTime >= duration - 10) {
                                    clearInterval(checkEndTime);
                                    console.log('Video near end, advancing to next');
                                    goToNextSlide();
                                }
                            } catch (e) {
                                clearInterval(checkEndTime);
                            }
                        }, 1000);

                        // Store interval ref for cleanup
                        (event.target as any)._endCheckInterval = checkEndTime;
                    },
                    onError: (event: any) => {
                        console.error('YouTube player error:', event.data);
                        console.error('Error details:', {
                            videoId: videoKey,
                            containerId,
                            errorCode: event.data
                        });
                        setVideoReady(false);
                        setIsPlaying(false);
                        
                        // Try to recover from certain errors
                        if (event.data === 2) { // Invalid video ID
                            console.log('Invalid video ID, skipping to next trailer');
                            setTimeout(() => goToNextSlide(), 1000);
                        } else if (event.data === 5) { // HTML5 player error
                            console.log('HTML5 player error, attempting retry');
                            setTimeout(() => {
                                if (playerRef.current) {
                                    try {
                                        playerRef.current.playVideo();
                                    } catch (e) {
                                        console.error('Retry failed:', e);
                                    }
                                }
                            }, 2000);
                        }
                    }
                },
            });
        }, 50); // Reduced timeout for faster initialization

        return () => {
            clearTimeout(timer);
        };
    }, [ytReady, currentIndex, trailers, isMuted, goToNextSlide]);

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

    const handlePrevious = useCallback(() => {
        setCurrentIndex((prev) => (prev - 1 + trailers.length) % trailers.length);
        setImageLoaded(false);
        setIsPlaying(false);
        setVideoReady(false);
    }, [trailers.length]);

    const handleNext = useCallback(() => {
        setCurrentIndex((prev) => (prev + 1) % trailers.length);
        setImageLoaded(false);
        setIsPlaying(false);
        setVideoReady(false);
    }, [trailers.length]);

    const handlePlay = () => {
        if (currentTrailer) {
            // Navigate to the actual media page
            const media = currentTrailer.media;
            if (media.tmdb_id) {
                const mediaType = media.type === 'tv' || media.type === 'series' || media.type === 'episode' ? 'tv' : 'movie';
                navigate.push(`/tmdb-movie/${media.tmdb_id}?type=${mediaType}`);
            } else {
                if (media.type === 'episode' || media.type === 'tv' || media.type === 'series') {
                    const seriesId = media.series_id || media.id;
                    navigate.push(`/tv-series/${seriesId}`);
                } else {
                    navigate.push(`/movie/${media.id}`);
                }
            }
        }
    };

    const handleMoreInfo = () => {
        if (currentTrailer) {
            const media = currentTrailer.media;
            if (media.tmdb_id) {
                const mediaType = media.type === 'tv' || media.type === 'series' || media.type === 'episode' ? 'tv' : 'movie';
                navigate.push(`/tmdb-movie/${media.tmdb_id}?type=${mediaType}`);
            } else {
                if (media.type === 'episode' || media.type === 'tv' || media.type === 'series') {
                    const seriesId = media.series_id || media.id;
                    navigate.push(`/tv-series/${seriesId}`);
                } else {
                    navigate.push(`/movie/${media.id}`);
                }
            }
        }
    };

    const toggleMute = () => {
        setIsMuted(!isMuted);
    };

    const openInYouTube = () => {
        if (currentTrailer && currentTrailer.media.tmdb_trailer_url) {
            const videoKey = extractYouTubeKey(currentTrailer.media.tmdb_trailer_url);
            if (videoKey) {
                window.open(`https://youtube.com/watch?v=${videoKey}`, '_blank');
            }
        }
    };

    const getBackdropUrl = (trailer: TrailerData) => {
        const media = trailer.media;
        if (media.tmdb_backdrop_url) return media.tmdb_backdrop_url;
        if (media.banner_path) return `${apiUrl}/api/admin/assets/${media.banner_path.split('/').pop()}`;
        return `${apiUrl}/api/thumbnails/${media.id}`;
    };

    const getLogoUrl = (trailer: TrailerData) => {
        const media = trailer.media;
        
        // First check if we have a TMDB logo
        if (media.tmdb_id && logoUrls[media.tmdb_id]) {
            return logoUrls[media.tmdb_id];
        }
        
        // Fallback to local logo
        if (media.logo_path) {
            if (media.logo_path.startsWith('http')) {
                return media.logo_path;
            }
            if (media.logo_path.startsWith('/api/')) {
                return `${apiUrl}${media.logo_path}`;
            }
            const filename = media.logo_path.includes('/') ? media.logo_path.split('/').pop() : media.logo_path;
            return `${apiUrl}/api/logos/${filename}`;
        }
        return null;
    };

    if (loading) {
        return (
            <div className={`relative w-full h-[500px] md:h-[600px] lg:h-[700px] overflow-hidden rounded-xl ${className}`}>
                <div className="absolute inset-0 bg-gradient-to-r from-gray-900 to-gray-800 animate-pulse">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full px-4 md:px-12 lg:px-16">
                            <div className="max-w-2xl space-y-4">
                                <div className="h-8 bg-white/10 rounded w-3/4"></div>
                                <div className="h-20 bg-white/10 rounded w-1/2"></div>
                                <div className="h-4 bg-white/10 rounded w-full"></div>
                                <div className="h-4 bg-white/10 rounded w-2/3"></div>
                                <div className="flex gap-3 mt-6">
                                    <div className="h-12 bg-white/10 rounded w-32"></div>
                                    <div className="h-12 bg-white/10 rounded w-32"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!trailers.length) {
        console.log('TrailerWidget: No trailers to display. Media count:', media.length);
        console.log('Media with trailer URLs:', media.filter(m => m.tmdb_trailer_url).map(m => ({
            title: m.title,
            trailer_url: m.tmdb_trailer_url,
            video_key: extractYouTubeKey(m.tmdb_trailer_url || '')
        })));
        return (
            <div className={`relative w-full h-[200px] overflow-hidden rounded-xl ${className} bg-gray-800/50 flex items-center justify-center`}>
                <div className="text-center text-white/60">
                    <p className="text-lg mb-2">No trailers available</p>
                    <p className="text-sm">Media items: {media.length}</p>
                    <p className="text-sm">Items with trailer URLs: {media.filter(m => m.tmdb_trailer_url).length}</p>
                    <p className="text-sm">Valid YouTube URLs: {media.filter(m => m.tmdb_trailer_url && extractYouTubeKey(m.tmdb_trailer_url)).length}</p>
                </div>
            </div>
        );
    }

    return (
        <div
            className={`relative w-full h-[500px] md:h-[600px] lg:h-[700px] overflow-hidden rounded-xl ${className}`}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
        >
            {/* Background Image */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentIndex}
                    initial={{ opacity: 0, scale: 1.1 }}
                    animate={{ opacity: imageLoaded ? 1 : 0, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.8 }}
                    className="absolute inset-0"
                >
                    <img
                        src={getBackdropUrl(currentTrailer)}
                        alt={currentTrailer.title}
                        className="w-full h-full object-cover"
                        onLoad={() => setImageLoaded(true)}
                        onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = `${apiUrl}/api/thumbnails/${currentTrailer.media.id}`;
                        }}
                    />
                </motion.div>
            </AnimatePresence>

            {/* YouTube Player */}
            <AnimatePresence mode="wait">
                {currentTrailer?.media.tmdb_trailer_url && extractYouTubeKey(currentTrailer.media.tmdb_trailer_url) && (
                    <motion.div
                        key={`video-${currentTrailer.media.id}`}
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
                                id={`yt-player-trailer-${currentTrailer.media.id}`}
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

            {/* Gradient overlays */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />

            {/* Navigation arrows */}
            {trailers.length > 1 && (
                <>
                    <motion.button
                        onClick={handlePrevious}
                        className="absolute left-4 top-1/2 transform -translate-y-1/2 z-20 bg-black/50 backdrop-blur-sm text-white p-3 rounded-full hover:bg-black/70 transition-all duration-300 border border-white/20"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: isHovering ? 1 : 0, x: isHovering ? 0 : -20 }}
                        transition={{ duration: 0.3 }}
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </motion.button>

                    <motion.button
                        onClick={handleNext}
                        className="absolute right-4 top-1/2 transform -translate-y-1/2 z-20 bg-black/50 backdrop-blur-sm text-white p-3 rounded-full hover:bg-black/70 transition-all duration-300 border border-white/20"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: isHovering ? 1 : 0, x: isHovering ? 0 : 20 }}
                        transition={{ duration: 0.3 }}
                    >
                        <ChevronRight className="w-6 h-6" />
                    </motion.button>
                </>
            )}

            {/* Content */}
            <div className="absolute inset-0 flex items-center z-20">
                <div className="w-full px-4 md:px-12 lg:px-16">
                    <div className="max-w-2xl">
                        {/* Logo as Title with Title as Fallback */}
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentIndex}
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.6, delay: 0.2 }}
                            >
                                {getLogoUrl(currentTrailer) ? (
                                    <img
                                        src={getLogoUrl(currentTrailer)!}
                                        alt={currentTrailer.media.title}
                                        className="max-h-16 md:max-h-20 lg:max-h-24 w-auto mb-4 drop-shadow-2xl"
                                        onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                            const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                            if (fallback) fallback.style.display = 'block';
                                        }}
                                    />
                                ) : null}
                                <h1
                                    className="text-2xl md:text-3xl lg:text-4xl font-bold mb-3 leading-tight text-white drop-shadow-lg"
                                    style={{
                                        display: getLogoUrl(currentTrailer) ? 'none' : 'block',
                                        textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                                    }}
                                >
                                    {currentTrailer.media.title}
                                </h1>
                            </motion.div>
                        </AnimatePresence>

                        {/* Trailer Badge */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            className="flex items-center gap-2 mb-4"
                        >
                            <div className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                                TRAILER
                            </div>
                            <span className="text-white/70 text-sm">{currentTrailer.duration}</span>
                        </motion.div>

                        {/* Meta info */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            className="flex items-center gap-4 mb-4 text-sm md:text-base text-white"
                        >
                            {currentTrailer.media.rating && currentTrailer.media.rating > 0 && (
                                <div className="flex items-center gap-1">
                                    <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                                    <span className="font-semibold">{currentTrailer.media.rating.toFixed(1)}</span>
                                </div>
                            )}
                            {currentTrailer.media.year && (
                                <div className="flex items-center gap-1">
                                    <Calendar className="w-4 h-4" />
                                    <span>{currentTrailer.media.year}</span>
                                </div>
                            )}
                            {currentTrailer.media.runtime && (
                                <span className="text-white/70">
                                    {Math.floor(currentTrailer.media.runtime / 60)}h {currentTrailer.media.runtime % 60}m
                                </span>
                            )}
                        </motion.div>

                        {/* Genres */}
                        {currentTrailer.media.genre_names && currentTrailer.media.genre_names.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.5 }}
                                className="flex flex-wrap gap-2 mb-4"
                            >
                                {currentTrailer.media.genre_names.slice(0, 4).map((genre, idx) => (
                                    <span
                                        key={idx}
                                        className="px-3 py-1 rounded-full text-xs font-medium bg-white/20 border border-white/30 text-white"
                                    >
                                        {genre}
                                    </span>
                                ))}
                            </motion.div>
                        )}

                        {/* Description */}
                        {showInfo && currentTrailer.description && (
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.6 }}
                                className="text-base md:text-lg text-white/80 mb-6 line-clamp-3 max-w-2xl"
                            >
                                {currentTrailer.description}
                            </motion.p>
                        )}

                        {/* Action buttons */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.7 }}
                            className="flex items-center gap-3"
                        >
                            <button
                                onClick={handlePlay}
                                className="bg-white text-black px-8 py-3 rounded-md font-bold text-lg hover:bg-white/90 transition-all duration-300 flex items-center gap-2"
                            >
                                <Play className="w-6 h-6 fill-current" />
                                Play
                            </button>

                            <button
                                onClick={handleMoreInfo}
                                className="bg-white/20 text-white px-8 py-3 rounded-md font-bold text-lg hover:bg-white/30 transition-all duration-300 flex items-center gap-2 border border-white/30"
                            >
                                <Info className="w-6 h-6" />
                                More Info
                            </button>

                            <button
                                onClick={() => toggleMyList(currentTrailer.media.id)}
                                className="bg-white/20 text-white p-3 rounded-full hover:bg-white/30 transition-all duration-300 border border-white/30"
                            >
                                {isInMyList(currentTrailer.media.id) ? (
                                    <Check className="w-6 h-6" />
                                ) : (
                                    <Plus className="w-6 h-6" />
                                )}
                            </button>

                            <button
                                onClick={toggleMute}
                                className="bg-white/20 text-white p-3 rounded-full hover:bg-white/30 transition-all duration-300 border border-white/30"
                            >
                                {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                            </button>

                            <button
                                onClick={openInYouTube}
                                className="bg-white/20 text-white p-3 rounded-full hover:bg-white/30 transition-all duration-300 border border-white/30"
                                title="Open in YouTube"
                            >
                                <ExternalLink className="w-6 h-6" />
                            </button>
                        </motion.div>
                    </div>
                </div>
            </div>

            {/* Slide indicators */}
            {trailers.length > 1 && (
                <motion.div
                    className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: isHovering ? 1 : 0, y: isHovering ? 0 : 20 }}
                    transition={{ duration: 0.3 }}
                >
                    <div className="flex items-center gap-2 bg-black/30 backdrop-blur-sm px-4 py-2 rounded-full border border-white/20">
                        {trailers.map((_, index) => (
                            <button
                                key={index}
                                onClick={() => {
                                    setCurrentIndex(index);
                                    setImageLoaded(false);
                                    setIsPlaying(false);
                                    setVideoReady(false);
                                }}
                                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                                    index === currentIndex
                                        ? 'bg-white w-8'
                                        : 'bg-white/50 hover:bg-white/70'
                                }`}
                            />
                        ))}
                    </div>
                </motion.div>
            )}

            {/* Trailer thumbnails at bottom */}
            <motion.div
                className="absolute bottom-4 right-4 z-20"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: isHovering ? 1 : 0, x: isHovering ? 0 : 20 }}
                transition={{ duration: 0.3 }}
            >
                <div className="flex gap-2">
                    {trailers.slice(0, 4).map((trailer, index) => (
                        <motion.button
                            key={trailer.id}
                            onClick={() => {
                                setCurrentIndex(index);
                                setImageLoaded(false);
                                setIsPlaying(false);
                                setVideoReady(false);
                            }}
                            className={`relative w-16 h-10 rounded overflow-hidden transition-all ${
                                currentIndex === index
                                    ? 'ring-2 ring-white scale-110'
                                    : 'hover:scale-105 opacity-70 hover:opacity-100'
                            }`}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <img
                                src={getBackdropUrl(trailer)}
                                alt={trailer.title}
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                                <Play className="w-3 h-3 text-white fill-current" />
                            </div>
                        </motion.button>
                    ))}
                </div>
            </motion.div>
        </div>
    );
}

export { extractYouTubeKey };