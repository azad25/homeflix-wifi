"use client";

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Play, Info, Star } from 'lucide-react';
import { Media } from '@/types/media';
import { getApiUrl } from '@/lib/api';
import { useNavigate } from '@/hooks/useNavigate';
import { navigateToMedia } from '@/lib/mediaNavigation';
import { useHoverVideo } from '@/hooks/useHoverVideo';
import { getRobustGenres } from '@/utils/tmdbGenres';
import { isComingSoon, getYear } from '@/utils/dateUtils';

interface HomeflixGridProps {
  media: Media[];
  title: string;
  subtitle?: string;
  maxItems?: number;
  showRating?: boolean;
  showYear?: boolean;
  autoScroll?: boolean;
  scrollInterval?: number;
  className?: string;
  onPlay?: (media: Media) => void;
  onInfo?: (media: Media) => void;
  showTag?: boolean;
  tagText?: string;
  tagColor?: string;
}

interface HomeflixCardProps {
  media: Media;
  onPlay?: (media: Media) => void;
  onInfo?: (media: Media) => void;
  priority?: boolean;
  delay?: number;
  showRating?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
}

const HomeflixCard: React.FC<HomeflixCardProps> = ({
  media,
  onPlay,
  onInfo,
  priority = false,
  delay = 0,
  showRating = true,
  isFirst = false,
  isLast = false,
}) => {
  const [titlePosition] = useState<'left' | 'center' | 'right'>(() => {
    const positions: Array<'left' | 'center' | 'right'> = ['left', 'center', 'right'];
    return positions[Math.floor(Math.random() * positions.length)];
  });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [tmdbLogoUrl, setTmdbLogoUrl] = useState<string | null>(null);
  const navigate = useNavigate();
  const apiUrl = getApiUrl();

  // Hover video hook
  const {
    isHovered,
    shouldPlay,
    videoReady,
    useYouTube,
    videoRef,
    ytContainerId,
    onMouseEnter,
    onMouseLeave,
    getPreviewClipUrl,
    setVideoReady,
  } = useHoverVideo(media, 700);

  // Get poster image URL - prioritize backdrop, then poster, then thumbnail
  const getPosterUrl = () => {
    if (media.tmdb_backdrop_url) return media.tmdb_backdrop_url;
    if (media.poster_url) return media.poster_url;
    if (media.tmdb_poster_url) return media.tmdb_poster_url;
    if (media.poster_path) return `${getApiUrl()}/api/media/poster/${media.id}`;
    if (media.thumbnail_path) return `${getApiUrl()}/api/media/thumbnail/${media.id}`;
    return null;
  };

  // Get logo URL - try local first, then TMDB
  const getLogoUrl = () => {
    // Use fetched TMDB logo if available
    if (tmdbLogoUrl) return tmdbLogoUrl;
    
    // Handle local content logos - simple approach like RecentlyWatchedWidget
    if (media.logo_path) {
      // If it's a full URL, use it directly
      if (media.logo_path.startsWith('http')) {
        return media.logo_path;
      }
      
      // If it's a TMDB path (starts with /), construct TMDB URL
      if (media.logo_path.startsWith('/') && !media.logo_path.startsWith('/api/')) {
        return `https://image.tmdb.org/t/p/w500${media.logo_path}`;
      }
      
      // Handle API paths
      if (media.logo_path.startsWith('/api/')) {
        return `${apiUrl}${media.logo_path}`;
      }
      
      // For simple filenames or relative paths
      const filename = media.logo_path.includes('/') ? media.logo_path.split('/').pop() : media.logo_path;
      return `${apiUrl}/api/logos/${filename}`;
    }
    
    return null;
  };

  // Fetch TMDB logo if media has tmdb_id but no local logo
  useEffect(() => {
    const actualTmdbId = media.tmdb_id || media.id;
    if (!actualTmdbId || media.logo_path) return;

    const fetchTmdbLogo = async () => {
      try {
        const type = media.type === 'tv' || media.type === 'series' ? 'tv' : 'movie';
        const res = await fetch(`${apiUrl}/api/tmdb/${type}/${actualTmdbId}/images`);
        if (!res.ok) return;
        const data = await res.json();
        const logos = data?.logos || [];
        const preferred = logos.find((l: any) => l.iso_639_1 === 'en') || logos[0];
        if (preferred?.file_path) {
          setTmdbLogoUrl(`https://image.tmdb.org/t/p/w500${preferred.file_path}`);
        }
      } catch { /* ignore */ }
    };

    fetchTmdbLogo();
  }, [media.tmdb_id, media.id, media.logo_path, media.type, apiUrl]);

  const posterUrl = getPosterUrl();
  const logoUrl = getLogoUrl();

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onPlay) {
      onPlay(media);
    } else {
      navigateToMedia(navigate, media);
    }
  };

  const handleInfo = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onInfo) {
      onInfo(media);
    } else {
      navigateToMedia(navigate, media);
    }
  };

  const handleCardClick = () => {
    navigateToMedia(navigate, media);
  };

  const handleNativeVideoLoaded = useCallback(() => {
    setVideoReady(true);
    // Unmute after playback starts (browser allows this after user interaction)
    if (videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.volume = 0.5;
    }
  }, [setVideoReady, videoRef]);

  const titlePositionClass =
    titlePosition === 'center' ? 'items-center text-center' : titlePosition === 'right' ? 'items-end text-right' : 'items-start text-left';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      whileHover={{
          scale: 1.25,
          zIndex: 50,
          transition: { duration: 0.3, delay: 0.25, ease: 'easeOut' },
      }}
      transition={{ duration: 0.5, delay: delay / 1000 }}
      className={`group relative cursor-pointer rounded-md overflow-visible ${isFirst ? 'origin-left' : isLast ? 'origin-right' : 'origin-center'}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={handleCardClick}
    >
      {/* Main Card Container */}
      <div className="relative aspect-video bg-[#141414] rounded-md overflow-hidden shadow-md border border-transparent group-hover:border-white/10 transition-colors">
        {/* Coming Soon Tag */}
        {isComingSoon(media) && (
            <div className="absolute top-2 right-2 bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow z-[60] tracking-wider pointer-events-none">
                COMING SOON
            </div>
        )}
        {/* Background Image */}
        {posterUrl && !imageError && (
          <img
            src={posterUrl || ''}
            alt={media.title}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 bg-[#141414] ${imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            loading={priority ? 'eager' : 'lazy'}
          />
        )}

        {/* Hover Video: YouTube Trailer (priority) */}
        {shouldPlay && useYouTube && (
          <div
            className="absolute inset-0 z-[5] overflow-hidden transition-opacity duration-700 ease-in pointer-events-none"
            style={{ opacity: videoReady ? 1 : 0 }}
          >
            <div
              id={ytContainerId}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ width: '180%', height: '180%', minWidth: '200%', minHeight: '120%' }}
            />
          </div>
        )}

        {/* Hover Video: Native Preview Clip (fallback) */}
        {shouldPlay && !useYouTube && (
          <video
            ref={videoRef}
            src={getPreviewClipUrl()}
            className="absolute inset-0 w-full h-full object-cover z-[5] transition-opacity duration-700 ease-in pointer-events-none"
            style={{ opacity: videoReady ? 1 : 0 }}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            onPlaying={handleNativeVideoLoaded}
            onError={() => {}}
            crossOrigin="anonymous"
          />
        )}

        {/* Default Shadow Overlay at Bottom */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none transition-opacity duration-300"
             style={{ opacity: isHovered ? 0 : 1 }}
        />
        
        {/* Title fallback if not hovered */}
        <div className={`absolute inset-x-0 bottom-0 p-3 pointer-events-none transition-opacity duration-300 flex flex-col ${titlePositionClass}`} style={{ opacity: isHovered ? 0 : 1 }}>
            {(logoUrl && !logoError) ? (
                <img src={logoUrl || ''} className="max-h-6 md:max-h-8 w-auto object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />
            ) : (
                <h4 className="text-[13px] md:text-[15px] font-semibold text-white drop-shadow-md truncate">
                    {media.title}
                </h4>
            )}
        </div>

        {/* Hover Overlay */}
        <AnimatePresence>
          {isHovered && (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 flex flex-col justify-end pointer-events-none"
                style={{ zIndex: 10 }}
            >
                {/* When video is playing: show logo + genres over the video */}
                {shouldPlay && videoReady ? (
                    <div className="p-3 md:p-4 text-left">
                        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
                        <div className="relative z-10 flex flex-col items-start">
                            {(logoUrl && !logoError) ? (
                                <img 
                                    src={logoUrl || ''} 
                                    className="max-h-6 md:max-h-10 w-auto drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] object-contain" 
                                    onError={() => setLogoError(true)}
                                />
                            ) : (
                                <h4 className="text-[13px] md:text-base font-bold text-white drop-shadow-md truncate">
                                    {media.title}
                                </h4>
                            )}
                            <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px] md:text-[11px] text-white/70">
                                {(() => {
                                    const genres = getRobustGenres(media);
                                    if (genres.length === 0) return null;
                                    return genres.slice(0, 3).map((g, i, arr) => (
                                        <React.Fragment key={g}>
                                            <span>{g}</span>
                                            {i < arr.length - 1 && <span className="w-1 h-1 rounded-full bg-white/40 shrink-0" />}
                                        </React.Fragment>
                                    ));
                                })()}
                            </div>
                        </div>
                    </div>
                ) : (
                    /* When hovered but no video: show full metadata */
                    <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/90 to-[#141414]/20 flex flex-col justify-end p-3 md:p-4 text-left items-start">
                        {(logoUrl && !logoError) ? (
                             <div className="mb-2">
                                 <img 
                                    src={logoUrl || ''} 
                                    className="max-h-8 md:max-h-12 w-auto drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] object-contain" 
                                    onError={() => setLogoError(true)}
                                 />
                             </div>
                        ) : (
                            <h4 className="text-sm md:text-lg font-bold text-white leading-tight line-clamp-1 mb-2 drop-shadow-md shadow-black">
                                {media.title}
                            </h4>
                        )}
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-[11px] md:text-sm font-bold text-[#46d369]">
                                {media.rating ? Math.floor(Number(media.rating) * 10) : 85 + Math.floor(Math.random() * 14)}% Match
                            </span>
                            {(() => {
                              const year = getYear(media);
                              if (year && year > 1900) {
                                return <span className="text-[11px] md:text-xs text-white/70">{year}</span>;
                              }
                              return null;
                            })()}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-[10px] md:text-[11px] text-white/60">
                            {(() => {
                                const genres = getRobustGenres(media);
                                if (genres.length === 0) return null;
                                return genres.slice(0, 3).map((g, i, arr) => (
                                    <React.Fragment key={g}>
                                        <span>{g}</span>
                                        {i < arr.length - 1 && <span className="w-1 h-1 rounded-full bg-white/40 shrink-0" />}
                                    </React.Fragment>
                                ));
                            })()}
                        </div>
                    </div>
                )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Fallback for missing images */}
        {(!posterUrl || imageError) && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#141414]">
            <div className="text-center text-gray-400">
              <div className="w-16 h-16 mx-auto mb-2 bg-[#2a2a2a] rounded-lg flex items-center justify-center">
                <Play className="w-8 h-8" />
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default function HomeflixGrid({
  media,
  title,
  subtitle,
  maxItems = 12,
  showRating = true,
  showYear = true,
  autoScroll = false,
  scrollInterval = 5000,
  className = '',
  onPlay,
  onInfo,
  showTag = false,
  tagText,
  tagColor = 'rgba(255,255,255,0.1)',
}: HomeflixGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  const itemWidth = 340; // Width of each card
  const gap = 16; // Gap between cards
  const scrollAmount = itemWidth * 4 + gap * 3; // Scroll 4 items at a time

  // Limit media items
  const displayMedia = media.slice(0, maxItems);

  const updateScrollButtons = () => {
    if (!scrollRef.current) return;

    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  };

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;

    const newScrollLeft = scrollRef.current.scrollLeft +
      (direction === "left" ? -scrollAmount : scrollAmount);

    scrollRef.current.scrollTo({
      left: newScrollLeft,
      behavior: "smooth",
    });

    setTimeout(updateScrollButtons, 300);
  };

  // Auto scroll functionality
  useEffect(() => {
    if (!autoScroll || isHovered) return;

    const interval = setInterval(() => {
      if (scrollRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;

        if (scrollLeft >= scrollWidth - clientWidth - 10) {
          // Reset to beginning
          scrollRef.current.scrollTo({ left: 0, behavior: "smooth" });
        } else {
          scroll("right");
        }
      }
    }, scrollInterval);

    return () => clearInterval(interval);
  }, [autoScroll, scrollInterval, isHovered]);

  useEffect(() => {
    updateScrollButtons();
    const handleResize = () => updateScrollButtons();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [displayMedia]);

  if (!displayMedia || displayMedia.length === 0) return null;

  return (
    <div
      className={`relative mb-12 group ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header */}
      <div className="px-[4%] md:px-[60px] mb-3 flex items-center justify-between z-30 relative">
        <div className="flex flex-col md:flex-row md:items-end gap-2 md:gap-4">
          <h2 className="text-[1.2vw] font-bold text-[#e5e5e5] min-[18px]:text-lg tracking-wide inline-block leading-tight select-none cursor-pointer hover:text-white transition-colors">
            {title}
          </h2>
          {subtitle && (
            <span className="text-[10px] md:text-xs font-semibold text-white/50 px-2 py-0.5 rounded tracking-wide hidden md:inline-block">
              {subtitle}
            </span>
          )}
        </div>
      </div>

      {/* Optional Custom Tag (from widget settings) */}
      {showTag && tagText && (
        <div className="absolute top-3 left-[4%] md:left-[60px] z-40 pointer-events-none">
          <div
            className="px-3 py-1 rounded-full backdrop-blur-md border font-semibold text-xs shadow-lg uppercase tracking-wider"
            style={{
              backgroundColor: tagColor,
              borderColor: `${tagColor}60`,
              color: 'white',
              boxShadow: `0 0 20px ${tagColor}40, 0 4px 12px rgba(0,0,0,0.3)`,
              textShadow: '0 1px 2px rgba(0,0,0,0.8)',
            }}
          >
            {tagText}
          </div>
        </div>
      )}

      <div className={showTag && tagText ? "mt-6" : ""}>
        <div className="relative">
          {/* Left scroll button */}
          {canScrollLeft && (
            <button
              onClick={() => scroll("left")}
              className={`absolute left-0 top-0 bottom-0 z-20 bg-black/80 text-white px-2 flex items-center justify-center transition-all duration-300 cursor-pointer ${isHovered ? 'opacity-100' : 'opacity-0'
                } hover:bg-black/90`}
              style={{ width: '60px' }}
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
          )}

          {/* Right scroll button */}
          {canScrollRight && (
            <button
              onClick={() => scroll("right")}
              className={`absolute right-0 top-0 bottom-0 z-20 bg-black/80 text-white px-2 flex items-center justify-center transition-all duration-300 cursor-pointer ${isHovered ? 'opacity-100' : 'opacity-0'
                } hover:bg-black/90`}
              style={{ width: '60px' }}
            >
              <ChevronRight className="w-8 h-8" />
            </button>
          )}

          {/* Carousel container */}
          <div
            ref={scrollRef}
            onScroll={updateScrollButtons}
            className="flex gap-4 overflow-x-auto scrollbar-hide px-4 md:px-12 py-10"
            style={{
              scrollbarWidth: "none",
              msOverflowStyle: "none",
              scrollSnapType: "x mandatory",
              overflowY: "visible"
            }}
          >
            {displayMedia.map((mediaItem, index) => (
              <div
                key={mediaItem.id}
                className="flex-shrink-0"
                style={{
                  width: `${itemWidth}px`,
                  scrollSnapAlign: "start"
                }}
              >
                <HomeflixCard
                  media={mediaItem}
                  onPlay={onPlay}
                  onInfo={onInfo}
                  priority={index < 6}
                  delay={index * 100}
                  showRating={showRating}
                  isFirst={index === 0}
                  isLast={index === displayMedia.length - 1}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}