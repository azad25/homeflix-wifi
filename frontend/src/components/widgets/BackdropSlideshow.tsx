"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, Star, ChevronLeft, ChevronRight, Plus, Check, Calendar, Clock, Volume2, VolumeX, Maximize2, Flame, Zap, Crown, Heart, Sparkles, Award, TrendingUp, Eye, ThumbsUp, Gift, Rocket, Target, Shield, Diamond } from 'lucide-react';
import { Media } from '@/types/media';
import { getApiUrl, preloadAssets } from '@/lib/api';
import { getColorPaletteByGenre, DominantColors } from '@/types/widgets';
import { useNavigate } from '@/hooks/useNavigate';
import { navigateToMedia } from '@/lib/mediaNavigation';
import { useMyList } from '@/hooks/useMyList';
import MyListTooltip from '@/components/ui/MyListTooltip';
import GenreStyledText from '@/components/GenreStyledText';

interface BackdropSlideshowProps {
    media: Media[];
    autoScroll?: boolean;
    scrollInterval?: number;
    showLogo?: boolean;
    showInfo?: boolean;
    height?: 'full' | 'large' | 'medium';
    className?: string;
    config?: any; // Add config prop for tags and headings
}

const heightClasses = {
    full: 'h-screen',
    large: 'h-[70vh] min-h-[500px]',
    medium: 'h-[50vh] min-h-[400px]',
};

export default function BackdropSlideshow({
    media,
    autoScroll = true,
    scrollInterval = 6,
    showLogo = true,
    showInfo = true,
    height = 'large',
    className = '',
    config = {},
}: BackdropSlideshowProps) {
    const navigate = useNavigate();
    const { isInMyList, toggleMyList, collections, addToCollection, fetchCollections } = useMyList();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isHovering, setIsHovering] = useState(false);
    const [colors, setColors] = useState<DominantColors>(getColorPaletteByGenre());
    const [imageLoaded, setImageLoaded] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const [showTrailer, setShowTrailer] = useState(false);
    const [tmdbLogos, setTmdbLogos] = useState<Record<number, string>>({});
    const [logoError, setLogoError] = useState(false);
    const autoScrollRef = useRef<NodeJS.Timeout | null>(null);

    const apiUrl = getApiUrl();
    const currentMedia = media[currentIndex];

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

    useEffect(() => {
        if (currentMedia) {
            const genres = currentMedia.genre_names || 
                          currentMedia.genres?.map((g: { name: string }) => g.name) || 
                          [];
            setColors(getColorPaletteByGenre(genres));
            setLogoError(false); // Reset logo error state when media changes
        }
    }, [currentMedia]);

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

    useEffect(() => {
        const nextIndex = (currentIndex + 1) % media.length;
        if (media[nextIndex]) {
            preloadAssets([media[nextIndex]], ['poster', 'thumbnail']);
        }
    }, [currentIndex, media]);

    const handlePrevious = () => {
        setCurrentIndex((prev) => (prev - 1 + media.length) % media.length);
        setImageLoaded(false);
    };

    const handleNext = () => {
        setCurrentIndex((prev) => (prev + 1) % media.length);
        setImageLoaded(false);
    };



    const handleCardClick = (media: Media) => {
        navigateToMedia(navigate, media);
    };

    const getBackdropUrl = (m: Media) => {
        // Priority: TMDB backdrop > local banner > thumbnail fallback
        if (m.tmdb_backdrop_url) return m.tmdb_backdrop_url;
        if (m.banner_path) {
            // Handle both full paths and just filenames
            const filename = m.banner_path.includes('/') ? m.banner_path.split('/').pop() : m.banner_path;
            return `${apiUrl}/api/admin/assets/${filename}`;
        }
        return `${apiUrl}/api/thumbnails/${m.id}`;
    };

    const getPosterUrl = (m: Media) => {
        // Priority: TMDB poster > local poster > thumbnail fallback
        if (m.tmdb_poster_url) return m.tmdb_poster_url;
        if (m.poster_url) return m.poster_url;
        if (m.poster_path) {
            const filename = m.poster_path.includes('/') ? m.poster_path.split('/').pop() : m.poster_path;
            return `${apiUrl}/api/posters/${filename}`;
        }
        return `${apiUrl}/api/posters/${m.id}`;
    };

    const getLogoUrl = (m: Media) => {
        // For TMDB content, check if we have TMDB logo data
        if (m.tmdb_id) {
            // First check if we fetched a logo from TMDB images API
            if (tmdbLogos[m.tmdb_id]) {
                return tmdbLogos[m.tmdb_id];
            }
            // If logo_path exists and starts with '/', it's a TMDB logo path
            if (m.logo_path && m.logo_path.startsWith('/') && !m.logo_path.startsWith('/api/')) {
                return `https://image.tmdb.org/t/p/w500${m.logo_path}`;
            }
        }
        
        // Handle local logo paths - simple approach like RecentlyWatchedWidget
        if (m.logo_path) {
            // Check if logo_path is already a full URL (TMDB logo)
            if (m.logo_path.startsWith('http')) {
                return m.logo_path;
            }
            // Handle API paths
            if (m.logo_path.startsWith('/api/')) {
                return `${apiUrl}${m.logo_path}`;
            }
            // For simple filenames or relative paths
            const filename = m.logo_path.includes('/') ? m.logo_path.split('/').pop() : m.logo_path;
            return `${apiUrl}/api/logos/${filename}`;
        }
        return null;
    };

    if (!currentMedia) return null;

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
            className={`relative w-full ${heightClasses[height]} overflow-hidden rounded-2xl ${className} cursor-pointer group`}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            onClick={() => handleCardClick(currentMedia)}
        >
            {/* Enhanced Backdrop Images */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentIndex}
                    initial={{ opacity: 0, scale: 1.1 }}
                    animate={{ opacity: imageLoaded ? 1 : 0, scale: isHovering ? 1.02 : 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                    className="absolute inset-0"
                >
                    <img
                        src={getBackdropUrl(currentMedia)}
                        alt={currentMedia.title}
                        className="w-full h-full object-cover transition-transform duration-300"
                        onLoad={() => setImageLoaded(true)}
                        onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            const currentSrc = target.src;
                            
                            // Try fallback sequence: backdrop -> banner -> thumbnail
                            if (currentSrc.includes('tmdb') && currentMedia.banner_path) {
                                const filename = currentMedia.banner_path.includes('/') ? 
                                    currentMedia.banner_path.split('/').pop() : currentMedia.banner_path;
                                target.src = `${apiUrl}/api/admin/assets/${filename}`;
                            } else if (!currentSrc.includes('thumbnails')) {
                                target.src = `${apiUrl}/api/thumbnails/${currentMedia.id}`;
                            }
                        }}
                    />
                </motion.div>
            </AnimatePresence>

            {/* Enhanced Gradient Overlays */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
            <div 
                className="absolute bottom-0 left-0 right-0 h-40"
                style={{
                    background: `linear-gradient(to top, ${colors.primary}20 0%, transparent 100%)`
                }}
            />

            {/* Hover overlay for clickable indication */}
            <div 
                className={`absolute inset-0 bg-white/5 transition-opacity duration-300 ${
                    isHovering ? 'opacity-100' : 'opacity-0'
                }`} 
            />

            {/* Custom Tag/Heading */}
            {config.showTag && config.tagText && (
                <div className="absolute top-6 left-6 z-20">
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
                <div className="absolute top-6 left-6 z-20" style={{ marginTop: config.showTag && config.tagText ? '60px' : '0' }}>
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

            {/* Enhanced Content */}
            <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12 lg:p-16 z-10">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentIndex}
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -30 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="max-w-3xl"
                    >
                        {/* Enhanced Logo/Title Section - Reduced Logo Size */}
                        <div className="mb-6">
                            {showLogo && getLogoUrl(currentMedia) && !logoError ? (
                                <img
                                    src={getLogoUrl(currentMedia)!}
                                    alt={`${currentMedia.title} logo`}
                                    className="max-h-12 md:max-h-16 lg:max-h-20 w-auto mb-4 drop-shadow-2xl"
                                    style={{ filter: 'drop-shadow(0 0 30px rgba(0,0,0,0.8))' }}
                                    onError={() => setLogoError(true)}
                                />
                            ) : null}
                            
                            {(!showLogo || !getLogoUrl(currentMedia) || logoError) && (
                                <h2 
                                    className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4" 
                                    style={{ 
                                        textShadow: `0 0 40px ${colors.primary}60, 0 4px 20px rgba(0,0,0,0.8)`,
                                        background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.accent} 100%)`,
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                        backgroundClip: 'text'
                                    }}
                                >
                                    {currentMedia.title}
                                </h2>
                            )}
                        </div>

                        {showInfo && (
                            <>
                                {/* Enhanced Meta Information - Rating beside Year */}
                                <div className="flex flex-wrap items-center gap-4 mb-4 text-sm md:text-base">
                                    {/* Rating Badge */}
                                    {currentMedia.rating && currentMedia.rating > 0 && (
                                        <div className="flex items-center gap-1">
                                            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                                            <span className="font-semibold">
                                                {currentMedia.rating.toFixed(1)}
                                            </span>
                                        </div>
                                    )}

                                    {(() => {
                                        let year = currentMedia.year;
                                        if (!year || year <= 1900) {
                                            if (currentMedia.release_date) {
                                                year = new Date(currentMedia.release_date).getFullYear();
                                            }
                                        }
                                        if (year && year > 1900) {
                                            return (
                                                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
                                                    <Calendar className="w-4 h-4 text-white/80" />
                                                    <span className="text-white font-medium">
                                                        {year}
                                                    </span>
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}
                                    
                                    {(() => {
                                        const duration = currentMedia.duration || currentMedia.runtime;
                                        if (duration && duration > 0) {
                                            const hours = Math.floor(duration / 3600);
                                            const minutes = Math.floor((duration % 3600) / 60);
                                            const timeStr = [
                                                hours > 0 ? `${hours}h` : '',
                                                minutes > 0 ? `${minutes}m` : ''
                                            ].filter(Boolean).join(' ');
                                            
                                            if (timeStr) {
                                                return (
                                                    <div className="flex items-center gap-1">
                                                        <Clock className="w-4 h-4 text-white/80" />
                                                        <span className="text-white/70">
                                                            {timeStr}
                                                        </span>
                                                    </div>
                                                );
                                            }
                                        }
                                        return null;
                                    })()}

                                    {currentMedia.certification && currentMedia.certification.trim() && (
                                        <span className="px-2 py-0.5 border border-white/30 rounded text-xs font-medium">
                                            {currentMedia.certification}
                                        </span>
                                    )}
                                </div>

                                {/* Enhanced Genres */}
                                {(currentMedia.genre_names || currentMedia.genres) && (
                                    <div className="flex flex-wrap gap-2 mb-6">
                                        {(currentMedia.genre_names || currentMedia.genres?.map(g => g.name) || []).slice(0, 4).map((genre, idx) => (
                                            <span
                                                key={idx}
                                                className="px-3 py-1 rounded-full text-sm font-medium"
                                                style={{
                                                    backgroundColor: `${colors.primary}30`,
                                                    border: `1px solid ${colors.primary}50`,
                                                }}
                                            >
                                                {genre}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Enhanced Description */}
                                {(currentMedia.description || currentMedia.long_desc || currentMedia.short_desc) && (
                                    <p className="text-white/90 mb-8 line-clamp-2 leading-relaxed text-sm md:text-base max-w-lg">
                                        <GenreStyledText genres={currentMedia.genre_names || currentMedia.genres?.map(g => typeof g === 'string' ? g : g?.name).filter(Boolean) || []}>
                                            {currentMedia.description || currentMedia.long_desc || currentMedia.short_desc}
                                        </GenreStyledText>
                                    </p>
                                )}

                                {/* Enhanced Action Buttons - Only Add to List */}
                                <div className="flex items-center gap-4">
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
                                        <motion.button
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={(e) => {
                                                e.stopPropagation(); // Prevent triggering the main click
                                            }}
                                            className="p-4 backdrop-blur-md rounded-full border transition-all"
                                            style={{ 
                                                backgroundColor: isInMyList(currentMedia.tmdb_id ? parseInt(`9${currentMedia.tmdb_id}`) : currentMedia.id) ? `${colors.primary}40` : `${colors.primary}20`,
                                                borderColor: `${colors.primary}50`
                                            }}
                                        >
                                            {isInMyList(currentMedia.tmdb_id ? parseInt(`9${currentMedia.tmdb_id}`) : currentMedia.id) ? 
                                                <Check className="w-5 h-5" style={{ color: colors.primary }} /> : 
                                                <Plus className="w-5 h-5 text-white" />
                                            }
                                        </motion.button>
                                    </MyListTooltip>
                                </div>
                            </>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Enhanced Navigation */}
            {media.length > 1 && (
                <>
                    <motion.button
                        onClick={(e) => {
                            e.stopPropagation(); // Prevent triggering the main click
                            handlePrevious();
                        }}
                        className="absolute left-6 top-1/2 -translate-y-1/2 p-4 backdrop-blur-md rounded-full border transition-all z-20"
                        style={{ 
                            backgroundColor: `${colors.primary}20`,
                            borderColor: `${colors.primary}40`,
                            opacity: isHovering ? 1 : 0
                        }}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <ChevronLeft className="w-6 h-6 text-white" />
                    </motion.button>
                    <motion.button
                        onClick={(e) => {
                            e.stopPropagation(); // Prevent triggering the main click
                            handleNext();
                        }}
                        className="absolute right-6 top-1/2 -translate-y-1/2 p-4 backdrop-blur-md rounded-full border transition-all z-20"
                        style={{ 
                            backgroundColor: `${colors.primary}20`,
                            borderColor: `${colors.primary}40`,
                            opacity: isHovering ? 1 : 0
                        }}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <ChevronRight className="w-6 h-6 text-white" />
                    </motion.button>
                </>
            )}

            {/* Enhanced Progress Indicators */}
            {media.length > 1 && (
                <div className="absolute bottom-8 right-8 flex items-center gap-3 z-20">
                    {media.slice(0, 8).map((item, idx) => (
                        <motion.button
                            key={idx}
                            onClick={(e) => {
                                e.stopPropagation(); // Prevent triggering the main click
                                setCurrentIndex(idx);
                                setImageLoaded(false);
                            }}
                            className="relative group"
                            whileHover={{ scale: 1.2 }}
                            whileTap={{ scale: 0.9 }}
                        >
                            <div
                                className={`h-1 rounded-full transition-all duration-300 ${
                                    idx === currentIndex ? 'w-12' : 'w-3'
                                }`}
                                style={{
                                    backgroundColor: idx === currentIndex ? colors.primary : 'rgba(255,255,255,0.4)',
                                    boxShadow: idx === currentIndex ? `0 0 15px ${colors.primary}80` : 'none'
                                }}
                            />
                            {/* Tooltip */}
                            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/90 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                {item.title}
                            </div>
                        </motion.button>
                    ))}
                    {media.length > 8 && (
                        <span className="text-xs text-white/50 ml-2 font-medium">
                            +{media.length - 8} more
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}