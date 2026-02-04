"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Info, Plus, Check, ChevronLeft, ChevronRight, Star, Calendar, Clock, Flame, Zap, Crown, Heart, Sparkles, Award, TrendingUp, Eye, ThumbsUp, Gift, Rocket, Target, Shield, Diamond } from 'lucide-react';
import { Media } from '@/types/media';
import { getApiUrl, preloadAssets } from '@/lib/api';
import { getColorPaletteByGenre, DominantColors } from '@/types/widgets';
import { useNavigate } from '@/hooks/useNavigate';
import { navigateToMedia } from '@/lib/mediaNavigation';
import { useMyList } from '@/hooks/useMyList';
import MyListTooltip from '@/components/ui/MyListTooltip';

interface FeaturedBannerProps {
    media: Media[];
    autoScroll?: boolean;
    scrollInterval?: number;
    showLogo?: boolean;
    showDescription?: boolean;
    showRating?: boolean;
    className?: string;
    config?: any; // Add config prop for tags and headings
}

export default function FeaturedBanner({
    media,
    autoScroll = true,
    scrollInterval = 8,
    showLogo = true,
    showDescription = true,
    showRating = true,
    className = '',
    config = {},
}: FeaturedBannerProps) {
    const navigate = useNavigate();
    const { isInMyList, toggleMyList, collections, addToCollection, fetchCollections } = useMyList();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isHovering, setIsHovering] = useState(false);
    const [colors, setColors] = useState<DominantColors>(getColorPaletteByGenre());
    const [imageLoaded, setImageLoaded] = useState(false);
    const autoScrollRef = useRef<NodeJS.Timeout | null>(null);

    const [tmdbLogos, setTmdbLogos] = useState<Record<number, string>>({});

    const currentMedia = media[currentIndex];
    const apiUrl = getApiUrl();

    // Fetch TMDB logo if needed
    useEffect(() => {
        const fetchTMDBLogo = async (tmdbId: number) => {
            if (tmdbLogos[tmdbId]) return; // Already fetched
            
            try {
                const response = await fetch(`${apiUrl}/api/tmdb/movie/${tmdbId}/images`);
                if (response.ok) {
                    const imagesData = await response.json();
                    const logo = imagesData.logos?.find((logo: any) => 
                        logo.iso_639_1 === 'en' || logo.iso_639_1 === null
                    );
                    if (logo) {
                        setTmdbLogos(prev => ({
                            ...prev,
                            [tmdbId]: `https://image.tmdb.org/t/p/w500${logo.file_path}`
                        }));
                    }
                }
            } catch (error) {
                console.log('Failed to fetch TMDB logo for', tmdbId);
            }
        };

        // Fetch logos for TMDB content that doesn't have logo_path
        media.forEach(m => {
            if (m.tmdb_id && !m.logo_path) {
                fetchTMDBLogo(m.tmdb_id);
            }
        });
    }, [media, apiUrl, tmdbLogos]);

    // Update colors based on current media's genre
    useEffect(() => {
        if (currentMedia?.genre_names || currentMedia?.genres) {
            const genres = currentMedia.genre_names || currentMedia.genres?.map((g: { name: string }) => g.name) || [];
            setColors(getColorPaletteByGenre(genres));
        }
    }, [currentMedia]);

    // Auto-scroll functionality - only when multiple items
    useEffect(() => {
        if (autoScroll && !isHovering && media.length > 1) {
            autoScrollRef.current = setInterval(() => {
                setCurrentIndex((prev) => (prev + 1) % media.length);
                setImageLoaded(false);
            }, scrollInterval * 1000);
        }
        return () => {
            if (autoScrollRef.current) clearInterval(autoScrollRef.current);
        };
    }, [autoScroll, isHovering, media.length, scrollInterval]);

    // Preload next slide
    useEffect(() => {
        const nextIndex = (currentIndex + 1) % media.length;
        if (media[nextIndex]) {
            preloadAssets([media[nextIndex]], ['thumbnail', 'poster']);
        }
    }, [currentIndex, media]);

    const handlePrevious = useCallback(() => {
        setCurrentIndex((prev) => (prev - 1 + media.length) % media.length);
        setImageLoaded(false);
    }, [media.length]);

    const handleNext = useCallback(() => {
        setCurrentIndex((prev) => (prev + 1) % media.length);
        setImageLoaded(false);
    }, [media.length]);

    const handlePlay = () => {
        if (currentMedia) {
            navigateToMedia(navigate, currentMedia);
        }
    };

    const handleMoreInfo = () => {
        if (currentMedia) {
            navigateToMedia(navigate, currentMedia);
        }
    };



    const getBackdropUrl = (m: Media) => {
        if (m.tmdb_backdrop_url) return m.tmdb_backdrop_url;
        if (m.banner_path) return `${apiUrl}/api/admin/assets/${m.banner_path.split('/').pop()}`;
        return `${apiUrl}/api/thumbnails/${m.id}`;
    };

    const getLogoUrl = (m: Media) => {
        // For TMDB content, check if we have TMDB logo data
        if (m.tmdb_id) {
            // First check if we fetched a logo from TMDB images API
            if (tmdbLogos[m.tmdb_id]) {
                return tmdbLogos[m.tmdb_id];
            }
            // If logo_path exists and starts with '/', it's a TMDB logo path
            if (m.logo_path && m.logo_path.startsWith('/')) {
                return `https://image.tmdb.org/t/p/w500${m.logo_path}`;
            }
        }
        
        // Handle local logo paths
        if (m.logo_path) {
            // Check if logo_path is already a full URL (TMDB logo)
            if (m.logo_path.startsWith('http')) {
                return m.logo_path;
            }
            // Handle local logo paths - could be relative or absolute
            if (m.logo_path.startsWith('/api/')) {
                return `${apiUrl}${m.logo_path}`;
            }
            // For simple filenames or relative paths
            const filename = m.logo_path.includes('/') ? m.logo_path.split('/').pop() : m.logo_path;
            return `${apiUrl}/api/logos/${filename}`;
        }
        return null;
    };

    if (!currentMedia || media.length === 0) {
        return (
            <div className={`relative w-full h-full overflow-hidden rounded-xl ${className}`}>
                <div className="h-full bg-gradient-to-br from-gray-900 via-gray-800 to-black relative">
                    <div className="absolute inset-0 flex items-center justify-center text-center p-8">
                        <div className="space-y-4">
                            <div className="w-16 h-16 bg-gradient-to-br from-red-500/20 to-red-600/20 rounded-full flex items-center justify-center mx-auto backdrop-blur-sm border border-red-400/30">
                                <Play className="w-8 h-8 text-red-300" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-xl font-semibold text-white">Loading Featured Content...</h3>
                                <p className="text-gray-400 max-w-sm">
                                    Preparing your personalized recommendations.
                                </p>
                            </div>
                        </div>
                    </div>
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
            className={`relative w-full h-full overflow-hidden rounded-xl ${className}`}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
        >
            {/* Custom Tag/Heading */}
            {config.showTag && config.tagText && (
                <div className="absolute top-6 left-6 z-30">
                    <div 
                        className="flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-md border font-semibold text-sm shadow-lg"
                        style={{
                            backgroundColor: config.tagColor || `${colors.primary}30`,
                            borderColor: config.tagColor ? `${config.tagColor}60` : `${colors.primary}50`,
                            color: 'white',
                            boxShadow: `0 0 20px ${config.tagColor || colors.primary}40, 0 4px 12px rgba(0,0,0,0.3)`,
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
                            textShadow: `0 0 20px ${colors.primary}60, 0 2px 10px rgba(0,0,0,0.8)`
                        }}
                    >
                        {config.headingText}
                    </h3>
                </div>
            )}

            {/* Dynamic gradient background based on genre colors */}
            <div
                className="absolute inset-0 transition-all duration-1000"
                style={{ background: colors.background }}
            />

            {/* Backdrop image - positioned on the right 70% */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentIndex}
                    initial={{ opacity: 0, scale: 1.1 }}
                    animate={{ opacity: imageLoaded ? 1 : 0, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.8 }}
                    className="absolute top-0 right-0 w-[70%] h-full"
                >
                    <img
                        src={getBackdropUrl(currentMedia)}
                        alt={currentMedia.title}
                        className="w-full h-full object-cover"
                        onLoad={() => setImageLoaded(true)}
                        onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = `${apiUrl}/api/thumbnails/${currentMedia.id}`;
                        }}
                    />
                </motion.div>
            </AnimatePresence>

            {/* Black overlay that fades into the image */}
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <div
                className="absolute bottom-0 left-0 right-0 h-48"
                style={{
                    background: `linear-gradient(to top, ${colors.primary}20 0%, transparent 100%)`
                }}
            />

            {/* Content - positioned on the left side */}
            <div className="absolute inset-0 flex items-center z-10">
                <div className="w-[50%] px-4 md:px-12 lg:px-16">
                    <div className="max-w-full">
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
                                    {showLogo && getLogoUrl(currentMedia) ? (
                                        <img
                                            src={getLogoUrl(currentMedia)!}
                                            alt={currentMedia.title}
                                            className="max-h-20 md:max-h-28 lg:max-h-36 w-auto mb-6 drop-shadow-2xl transition-transform duration-300 group-hover:scale-[1.02]"
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                                const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                                if (fallback) fallback.style.display = 'block';
                                            }}
                                        />
                                    ) : null}
                                    <h1
                                        className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 leading-tight transition-colors duration-300 group-hover:text-white"
                                        style={{
                                            display: showLogo && getLogoUrl(currentMedia) ? 'none' : 'block',
                                            textShadow: `0 0 40px ${colors.primary}40`,
                                        }}
                                    >
                                        {currentMedia.title}
                                    </h1>
                                </button>
                            </motion.div>
                        </AnimatePresence>

                    {/* Meta info */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        className="flex items-center gap-4 mb-4 text-sm md:text-base"
                    >
                        {showRating && currentMedia.rating && currentMedia.rating > 0 && (
                            <div className="flex items-center gap-1">
                                <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                                <span className="font-semibold">
                                    {currentMedia.rating.toFixed(1)}
                                </span>
                            </div>
                        )}
                        {currentMedia.year && currentMedia.year > 1900 && (
                            <div className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                <span>{currentMedia.year}</span>
                            </div>
                        )}
                        {currentMedia.runtime && currentMedia.runtime > 0 && (
                            <span className="text-white/70">
                                {Math.floor(currentMedia.runtime / 60)}h {currentMedia.runtime % 60}m
                            </span>
                        )}
                        {currentMedia.certification && currentMedia.certification.trim() && (
                            <span className="px-2 py-0.5 border border-white/30 rounded text-xs font-medium">
                                {currentMedia.certification}
                            </span>
                        )}
                    </motion.div>

                    {/* Genres */}
                    {currentMedia.genre_names && currentMedia.genre_names.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5 }}
                            className="flex flex-wrap gap-2 mb-4"
                        >
                            {currentMedia.genre_names.slice(0, 4).map((genre, idx) => (
                                <span
                                    key={idx}
                                    className="px-3 py-1 rounded-full text-xs font-medium"
                                    style={{
                                        backgroundColor: `${colors.primary}30`,
                                        border: `1px solid ${colors.primary}50`,
                                    }}
                                >
                                    {genre}
                                </span>
                            ))}
                        </motion.div>
                    )}

                    {/* Description */}
                    {showDescription && currentMedia.description && (
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.6 }}
                            className="text-base md:text-lg text-white/80 mb-6 line-clamp-2 max-w-xl"
                        >
                            {currentMedia.description}
                        </motion.p>
                    )}

                    {/* Action buttons */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7 }}
                        className="flex items-center gap-3"
                    >
                        <MyListTooltip
                            media={{
                                ...currentMedia,
                                id: currentMedia.tmdb_id ? parseInt(`9${currentMedia.tmdb_id}`) : currentMedia.id
                            }}
                            isInMyList={isInMyList(currentMedia.tmdb_id ? parseInt(`9${currentMedia.tmdb_id}`) : currentMedia.id)}
                            collections={collections}
                            onToggleMyList={() => toggleMyList(currentMedia.tmdb_id ? parseInt(`9${currentMedia.tmdb_id}`) : currentMedia.id)}
                            onAddToCollection={(collectionId) => addToCollection(collectionId, currentMedia.tmdb_id ? parseInt(`9${currentMedia.tmdb_id}`) : currentMedia.id)}
                            onCollectionCreated={fetchCollections}
                        >
                            <button
                                className="p-3 bg-white/10 backdrop-blur-sm rounded-full hover:bg-white/20 transition-all border border-white/20"
                                style={{ borderColor: isInMyList(currentMedia.tmdb_id ? parseInt(`9${currentMedia.tmdb_id}`) : currentMedia.id) ? colors.primary : undefined }}
                            >
                                {isInMyList(currentMedia.tmdb_id ? parseInt(`9${currentMedia.tmdb_id}`) : currentMedia.id) ? <Check className="w-5 h-5" style={{ color: colors.primary }} /> : <Plus className="w-5 h-5" />}
                            </button>
                        </MyListTooltip>
                    </motion.div>
                </div>
            </div>
            </div>

            {/* Navigation arrows - only show if multiple items */}
            {media.length > 1 && (
                <>
                    <button
                        onClick={handlePrevious}
                        className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 backdrop-blur-sm rounded-full hover:bg-black/70 transition-all opacity-0 hover:opacity-100 group-hover:opacity-100 z-20"
                        style={{ opacity: isHovering ? 1 : 0 }}
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <button
                        onClick={handleNext}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 backdrop-blur-sm rounded-full hover:bg-black/70 transition-all opacity-0 hover:opacity-100 group-hover:opacity-100 z-20"
                        style={{ opacity: isHovering ? 1 : 0 }}
                    >
                        <ChevronRight className="w-6 h-6" />
                    </button>
                </>
            )}

            {/* Slide indicators - only show if multiple items */}
            {media.length > 1 && (
                <div className="absolute bottom-6 right-8 flex items-center gap-2 z-20">
                    {media.slice(0, 8).map((_, idx) => (
                        <button
                            key={idx}
                            onClick={() => {
                                setCurrentIndex(idx);
                                setImageLoaded(false);
                            }}
                            className={`h-1 rounded-full transition-all ${idx === currentIndex ? 'w-8' : 'w-2'
                                }`}
                            style={{
                                backgroundColor: idx === currentIndex ? colors.primary : 'rgba(255,255,255,0.3)',
                            }}
                        />
                    ))}
                    {media.length > 8 && (
                        <span className="text-xs text-white/50 ml-2">+{media.length - 8}</span>
                    )}
                </div>
            )}
        </div>
    );
}
