"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Info, Volume2, VolumeX, ExternalLink, ChevronLeft, ChevronRight, Star, Calendar, Plus, Check, Flame, Zap, Crown, Heart, Sparkles, Award, TrendingUp, Clock, Eye, ThumbsUp, Gift, Rocket, Target, Shield, Diamond } from 'lucide-react';
import { Media } from '@/types/media';
import { getApiUrl } from '@/lib/api';
import { navigateToMedia } from '@/lib/mediaNavigation';
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
    config?: any; // Add config prop for tags and headings
}

interface TrailerData {
    id: string;
    title: string;
    description: string;
    thumbnail: string;
    videoId: string | null; // Allow null for items without valid video IDs
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
    config = {},
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
    const endPollRef = useRef<NodeJS.Timeout | null>(null);
    const advancedRef = useRef<boolean>(false);
    const playerInitTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const apiUrl = getApiUrl();
    const currentTrailer = trailers[currentIndex];
    const showNavigationButtons = false;

    // Convert media prop to trailers (backend must provide tmdb_trailer_url)
    const convertMediaToTrailers = useCallback(() => {
        try {
            setLoading(true);
      
            const trailerResults = media.slice(0, maxItems).map((item) => {
                // Use TMDB trailer URL from backend
                const videoId = item.tmdb_trailer_url ? extractYouTubeKey(item.tmdb_trailer_url) : null;
                
                return {
                    id: `trailer-${item.id}`,
                    title: `${item.title} - Official Trailer`,
                    description: item.description || `Watch the official trailer for ${item.title}`,
                    thumbnail: item.tmdb_backdrop_url || `${apiUrl}/api/thumbnails/${item.id}`,
                    videoId: videoId || null,
                    publishedAt: new Date().toISOString(),
                    channelTitle: 'Official Movie Trailers',
                    viewCount: Math.floor(Math.random() * 1000000),
                    duration: '2:30',
                    media: item,
                };
            });
            
            // Filter to only include trailers with actual YouTube video IDs
            const validTrailers = trailerResults.filter(trailer => 
                trailer.videoId && trailer.media.tmdb_trailer_url
            );
            
            console.log(`TrailerWidget: Found ${validTrailers.length} valid trailers out of ${trailerResults.length} media items`);
            
            if (validTrailers.length > 0) {
                setTrailers(validTrailers);
                setCurrentIndex(0);
                // Fetch logos for all valid trailers
                validTrailers.forEach(trailer => {
                    if (trailer.media.tmdb_id) {
                        fetchLogo(trailer.media.tmdb_id, trailer.media.type === 'tv' ? 'tv' : 'movie');
                    }
                });
            } else {
                console.log('TrailerWidget: No valid trailers found - checking data...');
                setTrailers([]);
            }
        } catch (error) {
            console.error('Failed to convert media to trailers:', error);
            setTrailers([]);
        } finally {
            setLoading(false);
        }
    }, [media, maxItems, apiUrl]);

    // Load YouTube IFrame API and enable auto-play
    useEffect(() => {
        // Check if YouTube API is already loaded by another component
        if (window.YT && window.YT.Player) {
            setYtReady(true);
            console.log('YouTube IFrame API already loaded by another component');
            return;
        }

        // Check if API is already being loaded
        const existingScript = document.querySelector('script[src*="youtube.com/iframe_api"]');
        if (existingScript) {
            console.log('YouTube IFrame API script already exists, waiting for load...');
            // Wait for existing script to load
            const checkReady = setInterval(() => {
                if (window.YT && window.YT.Player) {
                    setYtReady(true);
                    clearInterval(checkReady);
                    console.log('YouTube IFrame API ready (from existing script)');
                }
            }, 100);
            
            // Timeout after 10 seconds
            setTimeout(() => {
                clearInterval(checkReady);
                if (!window.YT || !window.YT.Player) {
                    console.warn('YouTube API failed to load within timeout');
                }
            }, 10000);
            return;
        }

        // Load the API script
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

        // Store original callback if it exists
        const originalCallback = window.onYouTubeIframeAPIReady;
        
        window.onYouTubeIframeAPIReady = () => {
            // Call original callback first if it exists
            if (originalCallback && typeof originalCallback === 'function') {
                try {
                    originalCallback();
                } catch (e) {
                    console.warn('Error calling original YouTube API callback:', e);
                }
            }
            
            setYtReady(true);
            console.log('YouTube IFrame API ready (TrailerWidget)');
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
    useEffect(() => {
        console.log('TrailerWidget: Media changed, converting to trailers');
        convertMediaToTrailers();
    }, [convertMediaToTrailers]);
    const goToNextSlide = useCallback(() => {
        if (trailers.length === 0) return;
        advancedRef.current = false;
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

    // Auto-scroll functionality disabled to let trailers play fully
    useEffect(() => {
        // Disable auto-scroll to let users watch full trailers
        // Auto-scroll will only happen when video ends naturally
        return () => {
            if (autoScrollRef.current) clearInterval(autoScrollRef.current);
        };
    }, []);

    // Initialize YouTube player when slide changes
    useEffect(() => {
        if (!ytReady || trailers.length === 0) return;

        const currentTrailer = trailers[currentIndex];
        const videoKey = currentTrailer?.videoId;

        if (!videoKey) {
            console.log('No video key found for trailer:', currentTrailer?.media.title);
            return;
        }

        console.log('Initializing YouTube player for:', currentTrailer.media.title, 'with video key:', videoKey);

        // Destroy previous player with better cleanup
        if (playerRef.current) {
            try {
                playerRef.current.destroy();
            } catch (e) {
                console.log('Error destroying previous player:', e);
            }
            playerRef.current = null;
        }

        // Reset end detection for new slide
        advancedRef.current = false;
        if (endPollRef.current) {
            clearInterval(endPollRef.current);
            endPollRef.current = null;
        }
        if (playerInitTimeoutRef.current) {
            clearTimeout(playerInitTimeoutRef.current);
            playerInitTimeoutRef.current = null;
        }

        const containerId = `yt-player-trailer-${currentTrailer.media.id}`;

        const waitForContainer = (attempt: number = 0) => {
            const container = document.getElementById(containerId);
            if (!container) {
                if (attempt < 20) {
                    playerInitTimeoutRef.current = setTimeout(() => waitForContainer(attempt + 1), 100);
                } else {
                    console.warn('TrailerWidget: Container not found after retries:', containerId);
                }
                return;
            }

            console.log('Creating YouTube player in container:', containerId);

            // Ensure container has proper dimensions and responsive scaling
            container.style.width = '100%';
            container.style.height = '100%';
            container.style.position = 'absolute';
            container.style.top = '0';
            container.style.left = '0';

            try {
                playerRef.current = new window.YT.Player(containerId, {
                    videoId: videoKey,
                    width: '100%',
                    height: '100%',
                    playerVars: {
                        autoplay: 1,
                        mute: 1, // Always start muted for auto-play compliance
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
                        start: 10, // Start 10 seconds in to skip intro
                        origin: window.location.origin,
                        loop: 0,
                        wmode: 'opaque',
                        // Add unique widget identifier to avoid conflicts
                        widget_referrer: 'trailer-widget',
                    },
                    events: {
                        onStateChange: (event: any) => {
                            console.log('YouTube player state changed:', event.data);
                            // 1 = playing, 0 = ended, 2 = paused
                            if (event.data === 1) {
                                advancedRef.current = false;
                                setVideoReady(true);
                                setIsPlaying(true);
                                console.log('Video is now playing');

                                // Start/end fallback poll to detect end reliably
                                if (endPollRef.current) {
                                    clearInterval(endPollRef.current);
                                    endPollRef.current = null;
                                }
                                endPollRef.current = setInterval(() => {
                                    try {
                                        const player = playerRef.current || event.target;
                                        if (!player || typeof player.getCurrentTime !== 'function') return;
                                        const duration = typeof player.getDuration === 'function' ? player.getDuration() : 0;
                                        const current = player.getCurrentTime();
                                        if (duration && current && (duration - current) <= 1 && !advancedRef.current) {
                                            advancedRef.current = true;
                                            if (endPollRef.current) {
                                                clearInterval(endPollRef.current);
                                                endPollRef.current = null;
                                            }
                                            setTimeout(() => {
                                                goToNextSlide();
                                            }, 500);
                                        }
                                    } catch (e) {
                                        // ignore polling errors
                                    }
                                }, 500);
                            } else if (event.data === 0) {
                                if (advancedRef.current) {
                                    return;
                                }
                                setVideoReady(false);
                                setIsPlaying(false);
                                if (endPollRef.current) {
                                    clearInterval(endPollRef.current);
                                    endPollRef.current = null;
                                }
                                console.log('Video ended, advancing to next');
                                advancedRef.current = true;
                                setTimeout(() => {
                                    goToNextSlide();
                                }, 500);
                            } else if (event.data === 2) {
                                setIsPlaying(false);
                            }
                        },
                        onReady: (event: any) => {
                            console.log('YouTube player ready');
                            
                            // Force play immediately with retry mechanism
                            const attemptPlay = (retries = 3) => {
                                try {
                                    event.target.mute(); // Ensure muted for autoplay
                                    event.target.seekTo(10, true); // Seek to 10 seconds
                                    event.target.playVideo(); // Force play
                                    console.log(`Attempting to play video (${4 - retries}/3)...`);
                                    
                                    // Check if playing after a short delay
                                    setTimeout(() => {
                                        try {
                                            const state = event.target.getPlayerState();
                                            if (state !== 1 && retries > 0) { // Not playing, retry
                                                console.log('Play attempt failed, retrying...');
                                                attemptPlay(retries - 1);
                                            } else if (state === 1) {
                                                console.log('Video playing successfully');
                                            }
                                        } catch (e) {
                                            console.error('Error checking player state:', e);
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
                            
                            // No need for interval - YouTube API will fire onStateChange when video ends
                            // This prevents premature slide changes during playback
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
                            } else {
                                // For other errors, advance to next slide
                                setTimeout(() => goToNextSlide(), 2000);
                            }
                        }
                    },
                });
            } catch (error) {
                console.error('Error creating YouTube player:', error);
                // If player creation fails, advance to next slide
                setTimeout(() => goToNextSlide(), 1000);
            }
        };

        waitForContainer();

        return () => {
            if (playerInitTimeoutRef.current) {
                clearTimeout(playerInitTimeoutRef.current);
                playerInitTimeoutRef.current = null;
            }
            if (endPollRef.current) {
                clearInterval(endPollRef.current);
                endPollRef.current = null;
            }
        };
    }, [ytReady, currentIndex, trailers, isMuted, goToNextSlide]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (endPollRef.current) {
                clearInterval(endPollRef.current);
                endPollRef.current = null;
            }
            if (autoScrollRef.current) {
                clearInterval(autoScrollRef.current);
                autoScrollRef.current = null;
            }
            if (playerRef.current) {
                try { playerRef.current.destroy(); } catch (e) {}
                playerRef.current = null;
            }
            if (playerInitTimeoutRef.current) {
                clearTimeout(playerInitTimeoutRef.current);
                playerInitTimeoutRef.current = null;
            }
        };
    }, []);

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
            const media = currentTrailer.media;
            navigateToMedia(navigate, media);
        }
    };

    const handleMoreInfo = () => {
        if (currentTrailer) {
            const media = currentTrailer.media;
            navigateToMedia(navigate, media);
        }
    };

    const toggleMute = () => {
        setIsMuted(!isMuted);
    };

    const openInYouTube = () => {
        if (currentTrailer?.videoId) {
            window.open(`https://youtube.com/watch?v=${currentTrailer.videoId}`, '_blank');
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
            <div className={`relative w-full h-[400px] md:h-[500px] lg:h-[600px] xl:h-[700px] overflow-hidden rounded-xl ${className}`}>
                <div className="absolute inset-0 bg-gradient-to-r from-gray-900 to-gray-800 animate-pulse">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full px-4 md:px-8 lg:px-12 xl:px-16">
                            <div className="max-w-2xl space-y-4">
                                <div className="h-6 md:h-8 bg-white/10 rounded w-3/4"></div>
                                <div className="h-16 md:h-20 bg-white/10 rounded w-1/2"></div>
                                <div className="h-3 md:h-4 bg-white/10 rounded w-full"></div>
                                <div className="h-3 md:h-4 bg-white/10 rounded w-2/3"></div>
                                <div className="flex gap-3 mt-6">
                                    <div className="h-10 md:h-12 bg-white/10 rounded w-24 md:w-32"></div>
                                    <div className="h-10 md:h-12 bg-white/10 rounded w-24 md:w-32"></div>
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
            video_key: extractYouTubeKey(m.tmdb_trailer_url || ''),
            tmdb_id: m.tmdb_id
        })));
        
        return (
            <div className={`relative w-full h-[200px] overflow-hidden rounded-xl ${className} bg-gray-800/50 flex items-center justify-center`}>
                <div className="text-center text-white/60">
                    <p className="text-lg mb-2">No trailers available</p>
                    <p className="text-sm">Media items: {media.length}</p>
                    <p className="text-sm">Items with trailer URLs: {media.filter(m => m.tmdb_trailer_url).length}</p>
                    <p className="text-sm">Valid YouTube URLs: {media.filter(m => m.tmdb_trailer_url && extractYouTubeKey(m.tmdb_trailer_url)).length}</p>
                    {media.length > 0 && (
                        <div className="mt-2 text-xs text-white/40">
                            <p>Sample data source: {media[0].tmdb_id ? 'TMDB' : 'Local'}</p>
                            <p>First item: {media[0].title}</p>
                            {media[0].tmdb_trailer_url && (
                                <p>Has trailer URL: {extractYouTubeKey(media[0].tmdb_trailer_url) ? 'Valid' : 'Invalid'}</p>
                            )}
                            <p className="text-red-400 mt-2">Backend needs restart to provide trailer URLs</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Icon mapping for tags
    const getTagIcon = (iconName: string) => {
        const iconMap: { [key: string]: React.ComponentType<any> } = {
            'Star': Star,
            'Fire': Flame,
            'Lightning': Zap,
            'Crown': Crown,
            'Heart': Heart,
            'Sparkles': Sparkles,
            'Award': Award,
            'Trending': TrendingUp,
            'Clock': Clock,
            'Calendar': Calendar,
            'Play': Play,
            'Eye': Eye,
            'Thumbs Up': ThumbsUp,
            'Gift': Gift,
            'Rocket': Rocket,
            'Target': Target,
            'Shield': Shield,
            'Diamond': Diamond
        };
        return iconMap[iconName] || Sparkles; // Default to Sparkles if icon not found
    };

    const TagIcon = getTagIcon(config.tagIcon || 'Sparkles');

    return (
        <div
            className={`relative w-full h-[400px] md:h-[500px] lg:h-[600px] xl:h-[700px] overflow-hidden rounded-xl ${className}`}
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
                {currentTrailer?.videoId && (
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
                                className="absolute inset-0 w-full h-full"
                                style={{
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

            {/* Custom Tag/Heading */}
            {config.showTag && config.tagText && (
                <div className="absolute top-6 left-6 z-30">
                    <div 
                        className="flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-md border font-semibold text-sm shadow-lg"
                        style={{
                            backgroundColor: config.tagColor || '#ef444430',
                            borderColor: config.tagColor ? `${config.tagColor}60` : '#ef444450',
                            color: 'white',
                            boxShadow: `0 0 20px ${config.tagColor || '#ef4444'}40, 0 4px 12px rgba(0,0,0,0.3)`,
                            textShadow: '0 1px 2px rgba(0,0,0,0.8)'
                        }}
                    >
                        <TagIcon className="w-4 h-4 drop-shadow-sm" />
                        <span className="uppercase tracking-wider font-bold text-xs">
                            {config.tagText}
                        </span>
                    </div>
                </div>
            )}

            {config.showHeading && config.headingText && (
                <div className="absolute top-6 left-6 z-30" style={{ marginTop: config.showTag && config.tagText ? '60px' : '0' }}>
                    <h3 
                        className="text-2xl md:text-3xl font-bold text-white"
                        style={{
                            textShadow: '0 0 20px rgba(239, 68, 68, 0.6), 0 2px 10px rgba(0,0,0,0.8)'
                        }}
                    >
                        {config.headingText}
                    </h3>
                </div>
            )}

            {/* Navigation arrows */}
            {showNavigationButtons && trailers.length > 1 && (
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
                <div className="w-full px-4 md:px-8 lg:px-12 xl:px-16">
                    <div className="max-w-xl lg:max-w-2xl">
                        {/* Logo as Title with Title as Fallback */}
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentIndex}
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.6, delay: 0.2 }}
                            >
                                <button
                                    type="button"
                                    onClick={handlePlay}
                                    className="group bg-transparent border-0 p-0 m-0 text-left focus:outline-none cursor-pointer"
                                    style={{ display: 'block' }}
                                >
                                    {getLogoUrl(currentTrailer) ? (
                                        <img
                                            src={getLogoUrl(currentTrailer)!}
                                            alt={currentTrailer.media.title}
                                            className="max-h-12 md:max-h-16 lg:max-h-20 xl:max-h-24 w-auto mb-3 md:mb-4 drop-shadow-2xl transition-transform duration-300 group-hover:scale-[1.02]"
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                                const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                                if (fallback) fallback.style.display = 'block';
                                            }}
                                        />
                                    ) : null}
                                    <h1
                                        className="text-xl md:text-2xl lg:text-3xl xl:text-4xl font-bold mb-2 md:mb-3 leading-tight text-white drop-shadow-lg transition-colors duration-300 group-hover:text-white"
                                        style={{
                                            display: getLogoUrl(currentTrailer) ? 'none' : 'block',
                                            textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                                        }}
                                    >
                                        {currentTrailer.media.title}
                                    </h1>
                                </button>
                            </motion.div>
                        </AnimatePresence>

                        {/* Trailer Badge */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            className="flex items-center gap-2 mb-3 md:mb-4"
                        >
                            <div className="bg-red-600 text-white px-2 md:px-3 py-1 rounded-full text-xs md:text-sm font-bold">
                                TRAILER
                            </div>
                            <span className="text-white/70 text-xs md:text-sm">{currentTrailer.duration}</span>
                        </motion.div>

                        {/* Meta info */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            className="flex items-center gap-2 md:gap-4 mb-3 md:mb-4 text-xs md:text-sm lg:text-base text-white"
                        >
                            {currentTrailer.media.rating && currentTrailer.media.rating > 0 && (
                                <div className="flex items-center gap-1">
                                    <Star className="w-4 h-4 md:w-5 md:h-5 fill-yellow-400 text-yellow-400" />
                                    <span className="font-semibold">{currentTrailer.media.rating.toFixed(1)}</span>
                                </div>
                            )}
                            {currentTrailer.media.year && (
                                <div className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3 md:w-4 md:h-4" />
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
                                className="flex flex-wrap gap-1 md:gap-2 mb-3 md:mb-4"
                            >
                                {currentTrailer.media.genre_names.slice(0, 3).map((genre, idx) => (
                                    <span
                                        key={idx}
                                        className="px-2 md:px-3 py-1 rounded-full text-xs font-medium bg-white/20 border border-white/30 text-white"
                                    >
                                        {genre}
                                    </span>
                                ))}
                            </motion.div>
                        )}

                        {/* Description - Hide on smaller widgets */}
                        {showInfo && currentTrailer.description && (
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.6 }}
                                className="hidden md:block text-sm md:text-base lg:text-lg text-white/80 mb-4 md:mb-6 line-clamp-2 md:line-clamp-3 max-w-xl lg:max-w-2xl"
                            >
                                {currentTrailer.description}
                            </motion.p>
                        )}

                        {/* Action buttons */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.7 }}
                            className="flex items-center gap-2 md:gap-3"
                        >
                            <button
                                onClick={() => toggleMyList(currentTrailer.media.id)}
                                className="bg-white/20 text-white p-2 md:p-3 rounded-full hover:bg-white/30 transition-all duration-300 border border-white/30"
                            >
                                {isInMyList(currentTrailer.media.id) ? (
                                    <Check className="w-4 h-4 md:w-6 md:h-6" />
                                ) : (
                                    <Plus className="w-4 h-4 md:w-6 md:h-6" />
                                )}
                            </button>

                            <button
                                onClick={toggleMute}
                                className="bg-white/20 text-white p-2 md:p-3 rounded-full hover:bg-white/30 transition-all duration-300 border border-white/30"
                            >
                                {isMuted ? <VolumeX className="w-4 h-4 md:w-6 md:h-6" /> : <Volume2 className="w-4 h-4 md:w-6 md:h-6" />}
                            </button>

                            <button
                                onClick={openInYouTube}
                                className="hidden md:flex bg-white/20 text-white p-2 md:p-3 rounded-full hover:bg-white/30 transition-all duration-300 border border-white/30"
                                title="Open in YouTube"
                            >
                                <ExternalLink className="w-4 h-4 md:w-6 md:h-6" />
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