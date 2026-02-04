"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Play, Plus, ThumbsUp, ChevronDown, Volume2, VolumeX, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import LazyImage from '../LazyImage';
import LazyVideo from '../LazyVideo';
import { Media } from '../../types/media';
import { getApiUrl } from '../../lib/api';
import { useImageWithFallback } from '../../lib/imageUtils';
import { addToWishlist, removeFromWishlist, isInWishlist } from '../../lib/wishlist';
import MyListTooltip from '@/components/ui/MyListTooltip';

interface ProviderMediaCardProps {
    media: Media;
    onPlay: (media: Media) => void;
    onInfo: (media: Media) => void;
    priority?: boolean;
    delay?: number;
    accentColor?: string;
    collections?: any[];
    onDataRefresh?: () => void;
}

const ProviderMediaCard: React.FC<ProviderMediaCardProps> = ({
    media,
    onPlay,
    onInfo,
    priority = false,
    delay = 0,
    accentColor = '#ffffff',
    collections = [],
    onDataRefresh
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [isVideoLoaded, setIsVideoLoaded] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const [isPlaying, setIsPlaying] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [inWishlist, setInWishlist] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const apiUrl = getApiUrl();
    
    // Enhanced image source selection - prioritize backdrop for landscape cards
    const getImageSources = () => {
        const sources = [];
        
        // Priority 1: TMDB backdrop (best for landscape cards)
        if (media.backdrop_path) {
            sources.push(`https://image.tmdb.org/t/p/w780${media.backdrop_path}`);
        }
        
        // Priority 2: Local backdrop/banner if available
        if (media.banner_path) {
            sources.push(`${apiUrl}/api/admin/assets/${media.banner_path.split('/').pop()}`);
        }
        
        // Priority 3: TMDB poster as fallback
        if (media.poster_path) {
            sources.push(`https://image.tmdb.org/t/p/w500${media.poster_path}`);
        }
        
        // Priority 4: Local poster
        if (media.id) {
            sources.push(`${apiUrl}/api/posters/${media.id}`);
        }
        
        // Priority 5: Thumbnail fallback
        if (media.id) {
            sources.push(`${apiUrl}/api/thumbnails/${media.id}`);
        }
        
        return sources;
    };
    
    const imageSources = getImageSources();
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const currentImageSrc = imageSources[currentImageIndex] || '';
    
    const handleImageError = () => {
        if (currentImageIndex < imageSources.length - 1) {
            setCurrentImageIndex(currentImageIndex + 1);
        } else {
            setImageError(true);
        }
    };

    const getPreviewUrl = () => {
        if (media.preview_clip_path) {
            return `${apiUrl}/api/admin/assets/${media.preview_clip_path.split('/').pop()}`;
        }
        if (media.trailer_path) {
            return `${apiUrl}/api/admin/assets/${media.trailer_path.split('/').pop()}`;
        }
        return `${apiUrl}/api/preview-clips/${media.id}`;
    };

    useEffect(() => {
        setInWishlist(isInWishlist(media.id));

        return () => {
            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
            if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        };
    }, [media.id]);

    const handleMouseEnter = () => {
        setIsHovered(true);

        if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current);
        }

        hoverTimeoutRef.current = setTimeout(() => {
            setShowPreview(true);

            if (videoRef.current) {
                const video = videoRef.current;
                video.currentTime = 0;
                video.muted = isMuted;
                video.play().then(() => {
                    setIsPlaying(true);
                    setIsVideoLoaded(true);
                }).catch((error) => {
                    // console.log('Video autoplay failed:', error);
                    video.muted = true;
                    video.play().then(() => {
                        setIsPlaying(true);
                        setIsVideoLoaded(true);
                    }).catch(() => {
                        setIsVideoLoaded(false);
                        setShowPreview(false);
                    });
                });
            }
        }, 800);
    };

    const handleMouseLeave = () => {
        setIsHovered(false);

        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
        }

        hideTimeoutRef.current = setTimeout(() => {
            setShowPreview(false);
            setIsVideoLoaded(false);
            setIsPlaying(false);
            if (videoRef.current) {
                videoRef.current.pause();
                videoRef.current.currentTime = 0;
            }
        }, 300);
    };

    const handleVideoLoad = () => {
        setIsVideoLoaded(true);
        if (videoRef.current && showPreview && isHovered) {
            const video = videoRef.current;
            video.currentTime = 0;
            video.muted = isMuted;
            video.play().then(() => {
                setIsPlaying(true);
            }).catch((error) => {
                // console.log('Video play failed on load:', error);
                video.muted = true;
                video.play().then(() => {
                    setIsPlaying(true);
                }).catch(() => {
                    setIsVideoLoaded(false);
                    setShowPreview(false);
                });
            });
        }
    };

    const handleVideoError = () => {
        setIsVideoLoaded(false);
        setShowPreview(false);
        setIsPlaying(false);
    };

    const handlePlayClick = () => {
        setIsLoading(true);
        setTimeout(() => {
            onPlay(media);
            setIsLoading(false);
        }, 500);
    };

    const handleToggleMyList = () => {
        let success = false;
        if (inWishlist) {
            success = removeFromWishlist(media.id);
        } else {
            success = addToWishlist(media.id);
        }

        if (success) {
            setInWishlist(!inWishlist);
            onDataRefresh?.();
        }
    };

    const formatDuration = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    };

    // Calculate rating and year for display
    const rating = media.vote_average ? Math.round(media.vote_average * 10) : (media.rating ? Math.round(media.rating * 10) : 0);
    const getDate = () => media.release_date || media.first_air_date || media.year?.toString();
    const year = getDate() ? new Date(getDate()!).getFullYear() : '';

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: delay / 1000 }}
            className={`relative group cursor-pointer ${isHovered ? 'z-50' : 'z-10'}`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={() => onInfo(media)}
            style={{
                zIndex: isHovered ? 50 : 10,
            }}
        >
            {/* Base Card */}
            <motion.div
                className="relative w-full aspect-video bg-[#141414] rounded-md overflow-hidden"
                animate={{
                    scale: isHovered ? 1.4 : 1,
                    y: isHovered ? -10 : 0,
                }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                style={{
                    transformOrigin: 'center center',
                    zIndex: isHovered ? 50 : 1,
                    position: 'relative',
                    boxShadow: isHovered ? `0 8px 30px ${accentColor}20` : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
            >
                {/* Backdrop/Poster Image with enhanced fallback */}
                {!imageError && currentImageSrc ? (
                    <img
                        src={currentImageSrc}
                        alt={media.title || media.name}
                        className={`w-full h-full object-cover transition-opacity duration-300 ${showPreview && isVideoLoaded ? 'opacity-0' : 'opacity-100'}`}
                        onError={handleImageError}
                        loading={priority ? "eager" : "lazy"}
                        style={{
                            objectPosition: media.backdrop_path ? 'center center' : 'center top' // Better positioning for backdrops vs posters
                        }}
                    />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex flex-col items-center justify-center">
                        <div className="text-6xl mb-2">🎬</div>
                        <div className="text-white/60 text-xs font-medium text-center px-2">
                            {media.title || media.name}
                        </div>
                    </div>
                )}

                {/* Preview Video */}
                {showPreview && (
                    <video
                        ref={videoRef}
                        src={getPreviewUrl()}
                        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${isVideoLoaded ? 'opacity-100' : 'opacity-0'}`}
                        muted={isMuted}
                        loop
                        playsInline
                        preload="metadata"
                        onLoadedData={handleVideoLoad}
                        onError={handleVideoError}
                        crossOrigin="anonymous"
                    />
                )}

                {/* Gradient Overlay - Always visible for text readability */}
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

                {/* Always Visible Title or Logo */}
                <div className={`absolute bottom-0 left-0 right-0 p-3 transition-opacity duration-200 ${isHovered ? 'opacity-0' : 'opacity-100'}`}>
                    {/* Try multiple logo sources */}
                    {(() => {
                        // Priority 1: TMDB logo path
                        if (media.logo_path) {
                            return (
                                <img
                                    src={`${apiUrl}/api/tmdb/image/${media.logo_path}`}
                                    alt={media.title || media.name}
                                    className="max-h-8 w-auto object-contain drop-shadow-md"
                                    onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                        const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                        if (fallback) fallback.style.display = 'block';
                                    }}
                                />
                            );
                        }
                        
                        // Priority 2: Try TMDB logo endpoint for movies/TV
                        if (media.id && (media.media_type === 'movie' || media.media_type === 'tv')) {
                            return (
                                <img
                                    src={`${apiUrl}/api/tmdb/${media.media_type}/${media.id}/logo`}
                                    alt={media.title || media.name}
                                    className="max-h-8 w-auto object-contain drop-shadow-md"
                                    onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                        const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                        if (fallback) fallback.style.display = 'block';
                                    }}
                                />
                            );
                        }
                        
                        return null;
                    })()}
                    
                    {/* Text fallback - always present but hidden when logo loads */}
                    <h3
                        className="text-white font-bold text-sm leading-tight line-clamp-1 drop-shadow-md"
                        style={{ 
                            display: 'block',
                            textShadow: '0 2px 4px rgba(0,0,0,0.8), 0 0 8px rgba(0,0,0,0.6)'
                        }}
                    >
                        {media.title || media.name}
                    </h3>
                </div>

                {/* Quick Play Button (center) */}
                <AnimatePresence>
                    {isHovered && !showPreview && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="absolute inset-0 flex items-center justify-center p-4"
                        >
                            {/* Hidden play button area for cleaner look, click whole card to act */}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Volume Control */}
                {showPreview && isPlaying && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsMuted(!isMuted);
                            if (videoRef.current) {
                                videoRef.current.muted = !isMuted;
                            }
                        }}
                        className="absolute bottom-2 right-2 p-2 rounded-full hover:bg-white/10 transition-colors text-white/80 hover:text-white"
                    >
                        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                )}
            </motion.div>

            {/* Expanded Info Panel - Cleaner Design */}
            <AnimatePresence>
                {isHovered && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="absolute top-full left-0 right-0 bg-[#141414] rounded-b-md shadow-2xl p-4 -mt-2"
                        style={{
                            zIndex: 49,
                            scale: 1.4,
                            transformOrigin: 'top center',
                            boxShadow: `0 20px 40px -10px ${accentColor}15`,
                            borderBottom: `2px solid ${accentColor}40`
                        }}
                    >
                        {/* Action Buttons Row */}
                        <div className="flex items-center gap-3 mb-3">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handlePlayClick();
                                }}
                                className="bg-white text-black p-1.5 rounded-full hover:bg-gray-200 transition-transform active:scale-95"
                            >
                                {isLoading ? (
                                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <Play className="w-4 h-4 fill-black translate-x-0.5" />
                                )}
                            </button>

                            <MyListTooltip
                                media={media}
                                isInMyList={inWishlist}
                                collections={collections}
                                onToggleMyList={handleToggleMyList}
                                onAddToCollection={() => onDataRefresh?.()}
                                onRemoveFromCollection={() => onDataRefresh?.()}
                                onCollectionCreated={() => onDataRefresh?.()}
                            >
                                <button
                                    onClick={(e) => e.stopPropagation()} /* Let Tooltip handle click */
                                    className="border-2 border-gray-500 text-gray-300 p-1.5 rounded-full hover:border-white hover:text-white transition-colors"
                                >
                                    {inWishlist ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                </button>
                            </MyListTooltip>

                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onInfo(media);
                                }}
                                className="border-2 border-gray-500 text-gray-300 p-1.5 rounded-full hover:border-white hover:text-white transition-colors ml-auto"
                            >
                                <ChevronDown className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Additional Info: Title, Year, Rating, etc. */}
                        <div className="mb-2">
                            <h3 className="text-white font-bold text-[11px] leading-tight mb-1 line-clamp-1" style={{ color: accentColor }}>
                                {media.title || media.name}
                            </h3>
                        </div>

                        {/* Metadata */}
                        <div className="flex items-center gap-2 text-[10px] font-medium text-gray-400 mb-2">
                            <span className="text-green-500">
                                {rating > 0 ? `${rating}% Match` : 'New'}
                            </span>
                            <span className="border border-gray-600 px-1 rounded text-[9px]">
                                {media.adult ? '18+' : '13+'}
                            </span>
                            {year && <span>{year}</span>}
                            <span>{media.duration ? formatDuration(media.duration) : (media.media_type === 'tv' ? 'Series' : 'Movie')}</span>
                            <span className="border border-gray-600 px-1 rounded text-[9px]">HD</span>
                        </div>

                        {/* Genres */}
                        <div className="flex flex-wrap gap-1.5">
                            {media.genres && media.genres.slice(0, 3).map((genre, index) => (
                                <span
                                    key={genre.id || index}
                                    className="text-[10px] text-white flex items-center"
                                >
                                    {index > 0 && <span className="w-1 h-1 bg-gray-600 rounded-full mr-1.5" />}
                                    {genre.name}
                                </span>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default ProviderMediaCard;
