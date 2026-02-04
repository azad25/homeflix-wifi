"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Splide, SplideSlide } from '@splidejs/react-splide';
import '@splidejs/react-splide/css';
import { Play, Info, Volume2, VolumeX, Plus, Check, Star } from 'lucide-react';
import { useRouter } from 'next/navigation';
import YouTube from 'react-youtube';
import MyListTooltip from '@/components/ui/MyListTooltip';
import { Media } from '@/types/media';
import { addToWishlist, removeFromWishlist, isInWishlist } from '@/lib/wishlist';
import { getApiUrl } from '@/lib/api';

// Extended interface for items with provider info
interface HeroItem extends Media {
    provider?: {
        name: string;
        logo: string;
        color: string;
    };
}

interface ProviderHeroProps {
    providerName?: string;
    providerLogo?: string;
    brandColor?: string;
    items: HeroItem[];
    collections?: any[];
    onDataRefresh?: () => void;
}

const ProviderHero: React.FC<ProviderHeroProps> = ({
    providerName = "Streaming",
    providerLogo = "",
    brandColor = "#e50914",
    items,
    collections = [],
    onDataRefresh
}) => {
    const router = useRouter();
    const [activeSlideIndex, setActiveSlideIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const [showTrailer, setShowTrailer] = useState(false);
    const [trailerUrl, setTrailerUrl] = useState<string | null>(null);
    const [inWishlist, setInWishlist] = useState(false);
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const playerRef = useRef<any>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const activeItem = items[activeSlideIndex] || items[0];

    // Determine current provider branding based on active item or fallbacks
    const currentProvider = activeItem?.provider || {
        name: providerName,
        logo: providerLogo,
        color: brandColor
    };

    // Helper to get image URLs safely
    const getPosterUrl = (path?: string) => path ? (path.startsWith('http') ? path : `https://image.tmdb.org/t/p/w500${path}`) : '/placeholder-poster.jpg';

    // Explicitly handle "original" size for backdrops to fix visibility issues
    const getBackdropUrl = (path?: string) => {
        if (!path) return '/placeholder-backdrop.jpg';

        // If it's already a full URL
        if (path.startsWith('http')) {
            // Upgrade quality if possible (e.g. w1280 -> original)
            return path.replace(/\/w\d+\//, '/original/');
        }

        // TMDB path usually starts with /
        return `https://image.tmdb.org/t/p/original${path}`;
    };

    const handlePlay = (id: number, type: string) => {
        router.push(`/tmdb-movie/${id}?type=${type || 'movie'}`);
    };

    const handleInfo = (id: number, type: string) => {
        router.push(`/tmdb-movie/${id}?type=${type || 'movie'}`);
    };

    const handleSlideChange = (splide: any) => {
        const newIndex = splide.index;
        if (newIndex === activeSlideIndex) return; // Avoid redundant updates

        setActiveSlideIndex(newIndex);
        setShowTrailer(false);
        setIsPlaying(false);
        setLogoUrl(null); // Reset logo while fetching new one

        // Clear previous timeout
        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        // Start trailer almost immediately (500ms) to allow slide transition
        timeoutRef.current = setTimeout(() => {
            setShowTrailer(true);
        }, 500);
    };

    useEffect(() => {
        // Initial load trailer
        timeoutRef.current = setTimeout(() => {
            setShowTrailer(true);
        }, 500);

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    // Check wishlist status and Fetch Logo
    useEffect(() => {
        setInWishlist(isInWishlist(activeItem.id));
        fetchLogo(activeItem.id, activeItem.media_type || 'movie');
    }, [activeItem.id]); // Only run if ID changes

    const fetchLogo = async (tmdbId: number, mediaType: string) => {
        try {
            const apiUrl = getApiUrl();
            
            // Try multiple logo sources in priority order
            const logoSources = [
                // Priority 1: Direct TMDB logo endpoint
                `${apiUrl}/api/tmdb/${mediaType}/${tmdbId}/logo`,
                
                // Priority 2: TMDB images API for logos
                async () => {
                    const endpoint = mediaType === 'tv'
                        ? `${apiUrl}/api/tmdb/tv/${tmdbId}/images`
                        : `${apiUrl}/api/tmdb/movie/${tmdbId}/images`;

                    const response = await fetch(endpoint);
                    if (!response.ok) return null;

                    const data = await response.json();
                    const logos = data.logos || [];

                    // Find best English logo, prefer higher resolution
                    let bestLogo = logos
                        .filter((l: any) => l.iso_639_1 === 'en')
                        .sort((a: any, b: any) => (b.width || 0) - (a.width || 0))[0];
                    
                    if (!bestLogo && logos.length > 0) {
                        bestLogo = logos.sort((a: any, b: any) => (b.width || 0) - (a.width || 0))[0];
                    }

                    return bestLogo?.file_path ? `https://image.tmdb.org/t/p/w500${bestLogo.file_path}` : null;
                }
            ];

            // Try each source until one works
            for (const source of logoSources) {
                try {
                    if (typeof source === 'string') {
                        // Direct URL - test if it loads
                        const testResponse = await fetch(source, { method: 'HEAD' });
                        if (testResponse.ok) {
                            setLogoUrl(source);
                            return;
                        }
                    } else {
                        // Function that returns URL
                        const logoUrl = await source();
                        if (logoUrl) {
                            setLogoUrl(logoUrl);
                            return;
                        }
                    }
                } catch (e) {
                    // Continue to next source
                    continue;
                }
            }
            
            // No logo found
            setLogoUrl(null);
        } catch (err) {
            console.warn('Error fetching logo:', err);
            setLogoUrl(null);
        }
    };

    const handleToggleMyList = () => {
        if (!activeItem) return;

        let success = false;
        if (inWishlist) {
            success = removeFromWishlist(activeItem.id);
        } else {
            success = addToWishlist(activeItem.id);
        }

        if (success) {
            setInWishlist(!inWishlist);
            onDataRefresh?.();
        }
    };

    // Fetch trailer if missing
    useEffect(() => {
        if (!activeItem || !activeItem.id) return;
        setTrailerUrl(activeItem?.trailer_url || null);

        if (!activeItem.trailer_url) {
            const fetchTrailer = async () => {
                try {
                    const type = activeItem.media_type || 'movie';
                    if (type === 'movie') {
                        const res = await fetch(`/api/tmdb-movie/${activeItem.id}`);
                        if (res.ok) {
                            const data = await res.json();
                            if (data.videos && data.videos.results) {
                                const trailer = data.videos.results.find((v: any) =>
                                    v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')
                                );
                                if (trailer) {
                                    setTrailerUrl(`https://www.youtube.com/watch?v=${trailer.key}`);
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.error('Failed to fetch trailer for hero', err);
                }
            };

            // Check if we need to fetch
            if (activeSlideIndex === items.indexOf(activeItem)) {
                const timer = setTimeout(fetchTrailer, 100);
                return () => clearTimeout(timer);
            }
        }
        return undefined;
    }, [activeItem?.id, activeSlideIndex, items]);

    const getYouTubeId = (url?: string) => {
        if (!url) return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    const youtubeId = getYouTubeId(trailerUrl || activeItem?.trailer_url);

    if (!items || items.length === 0) return null;

    return (
        <div className="relative w-full h-[85vh] bg-black text-white overflow-hidden group">
            <Splide
                options={{
                    type: 'fade',
                    rewind: true,
                    pagination: true,
                    arrows: false,
                    autoplay: !isPlaying,
                    interval: 8000,
                    pauseOnHover: false,
                    speed: 1000,
                }}
                className="h-full w-full"
                onMoved={handleSlideChange}
            >
                {items.map((item, index) => (
                    <SplideSlide key={`${item.id}-${index}`} className="h-full w-full">
                        <div className="relative h-full w-full">
                            {/* Backdrop - Always visible until video is PLAYING (videoReady) */}
                            <div className="absolute inset-0 z-0">
                                {item.backdrop_path ? (
                                    <img
                                        src={getBackdropUrl(item.backdrop_path)}
                                        alt={item.title || item.name}
                                        className="w-full h-full object-cover transition-opacity duration-1000"
                                        loading={index === 0 ? "eager" : "lazy"}
                                        onError={(e) => {
                                            // Fallback to W1280 if original fails, or generic placeholder
                                            const target = e.target as HTMLImageElement;
                                            if (target.src.includes('original')) {
                                                target.src = target.src.replace('original', 'w1280');
                                            } else {
                                                target.src = '/placeholder-backdrop.jpg';
                                            }
                                        }}
                                        style={{ opacity: 1 }}
                                    />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-gray-900 to-black" />
                                )}
                                {/* Gradients must be ON TOP of image but below content */}
                                <div className="absolute inset-0 bg-gradient-to-r from-black via-black/40 to-transparent z-10" />
                                <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-transparent to-transparent z-10" />
                            </div>

                            {/* Trailer Overlay */}
                            {index === activeSlideIndex && showTrailer && youtubeId && (
                                <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0 transition-opacity duration-1000"
                                    style={{ opacity: isPlaying ? 1 : 0 }}>
                                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                                        style={{ width: '120vw', height: '120vh', minWidth: '177.77vh', minHeight: '56.25vw' }}>
                                        <YouTube
                                            videoId={youtubeId}
                                            opts={{
                                                height: '100%',
                                                width: '100%',
                                                playerVars: {
                                                    autoplay: 1,
                                                    controls: 0,
                                                    disablekb: 1,
                                                    fs: 0,
                                                    iv_load_policy: 3,
                                                    modestbranding: 1,
                                                    rel: 0,
                                                    showinfo: 0,
                                                    mute: 1, // Start muted to guarantee autoplay works
                                                    loop: 1,
                                                    playlist: youtubeId,
                                                    start: 10,
                                                    origin: typeof window !== 'undefined' ? window.location.origin : undefined,
                                                },
                                            }}
                                            onReady={(event) => {
                                                playerRef.current = event.target;
                                                event.target.playVideo();

                                                // Attempt to unmute after a short delay
                                                setTimeout(() => {
                                                    try {
                                                        // Only unmute if logic says so (default isMuted=true so this effectively keeps it muted unless we change default)
                                                        // User asked for "with sound", so we try to unmute.
                                                        // We should update state to reflect unmuted status if successful
                                                        if (isMuted) { // logic check based on default state
                                                            event.target.unMute();
                                                            setIsMuted(false);
                                                        }
                                                    } catch (e) { /* ignore */ }
                                                }, 500);
                                            }}
                                            onStateChange={(event) => {
                                                if (event.data === 1) setIsPlaying(true);
                                                if (event.data === 0) setIsPlaying(false);
                                            }}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </SplideSlide>
                ))}
            </Splide>

            {/* Content Overlay */}
            <div className="absolute inset-0 z-20 flex flex-col justify-center px-4 md:px-12 lg:px-24 pointer-events-none">
                <div className="max-w-7xl w-full pointer-events-auto mt-20">
                    <motion.div
                        key={activeItem?.id}
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="flex flex-col md:flex-row items-end md:items-start gap-8"
                    >
                        {/* Poster Card (Hidden on mobile for space) */}
                        <div className="hidden md:block flex-shrink-0 relative group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-gray-700/30 to-gray-500/30 rounded-lg blur-lg opacity-70" style={{ background: `linear-gradient(to right, ${currentProvider.color}40, transparent)` }} />
                            <div className="relative w-48 lg:w-64 aspect-[2/3] rounded-lg overflow-hidden shadow-2xl border border-white/10">
                                <img
                                    src={getPosterUrl(activeItem?.poster_path)}
                                    alt={activeItem?.title || 'Poster'}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        </div>

                        {/* Info Section */}
                        <div className="flex-1 space-y-6">
                            {/* Provider Badge - Dynamic */}
                            {currentProvider.logo && (
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/20 flex items-center gap-2">
                                        <img src={currentProvider.logo} alt={currentProvider.name} className="w-5 h-5 object-contain" />
                                        <span className="text-xs font-bold tracking-wider uppercase text-white/90">
                                            Featured on {currentProvider.name}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Title / Logo */}
                            <div className="min-h-[80px] flex items-end">
                                {logoUrl ? (
                                    <img
                                        src={logoUrl}
                                        alt={activeItem?.title || 'Title Logo'}
                                        className="max-h-24 md:max-h-32 lg:max-h-40 w-auto object-contain drop-shadow-2xl"
                                    />
                                ) : (
                                    <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-tight drop-shadow-lg">
                                        {activeItem?.title || activeItem?.name}
                                    </h1>
                                )}
                            </div>

                            {/* Metadata Row */}
                            <div className="flex items-center flex-wrap gap-4 text-sm md:text-base font-medium text-gray-200">
                                {activeItem?.vote_average && (
                                    <span className="flex items-center gap-1 text-green-400">
                                        <Star className="w-4 h-4 fill-current" />
                                        {Math.round(activeItem.vote_average * 10)}% Match
                                    </span>
                                )}
                                <span className="text-gray-400">•</span>
                                <span>{new Date(activeItem?.release_date || activeItem?.first_air_date || Date.now()).getFullYear()}</span>
                                <span className="text-gray-400">•</span>
                                <span className="border border-white/30 px-1.5 rounded text-xs bg-white/5">HD</span>
                                {(activeItem?.media_type === 'tv' || activeItem?.type === 'tv') && (
                                    <>
                                        <span className="text-gray-400">•</span>
                                        <span>Series</span>
                                    </>
                                )}
                            </div>

                            {/* Overview */}
                            <p className="text-gray-300 text-base md:text-lg line-clamp-3 max-w-2xl drop-shadow-md leading-relaxed">
                                {activeItem?.overview}
                            </p>

                            {/* Action Buttons */}
                            <div className="flex flex-wrap items-center gap-4 pt-2">
                                <button
                                    onClick={() => handlePlay(activeItem.id, activeItem.media_type || 'movie')}
                                    className="flex items-center gap-2 px-8 py-3.5 bg-white text-black rounded-lg font-bold hover:bg-gray-200 transition-all transform hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                                >
                                    <Play className="w-6 h-6 fill-black" />
                                    Play Now
                                </button>

                                <button
                                    onClick={() => handleInfo(activeItem.id, activeItem.media_type || 'movie')}
                                    className="flex items-center gap-2 px-8 py-3.5 bg-white/10 backdrop-blur-md text-white rounded-lg font-bold hover:bg-white/20 border border-white/10 transition-all"
                                >
                                    <Info className="w-6 h-6" />
                                    More Info
                                </button>

                                <MyListTooltip
                                    media={activeItem}
                                    isInMyList={inWishlist}
                                    collections={collections}
                                    onToggleMyList={handleToggleMyList}
                                    onAddToCollection={() => onDataRefresh?.()}
                                    onRemoveFromCollection={() => onDataRefresh?.()}
                                    onCollectionCreated={() => onDataRefresh?.()}
                                >
                                    <button
                                        className="p-3.5 rounded-full border border-white/30 bg-black/40 hover:bg-white/10 hover:border-white transition-all ml-2 backdrop-blur-md"
                                    >
                                        {inWishlist ? <Check className="w-6 h-6 text-green-400" /> : <Plus className="w-6 h-6" />}
                                    </button>
                                </MyListTooltip>

                                {showTrailer && isPlaying && (
                                    <button
                                        onClick={() => {
                                            setIsMuted(!isMuted);
                                            if (playerRef.current) {
                                                if (isMuted) playerRef.current.unMute();
                                                else playerRef.current.mute();
                                            }
                                        }}
                                        className="p-3.5 rounded-full border border-white/30 bg-black/40 hover:bg-white/10 hover:border-white transition-all ml-2 backdrop-blur-md"
                                    >
                                        {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                                    </button>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#141414] via-[#141414]/60 to-transparent z-10" />
        </div>
    );
};

export default ProviderHero;
