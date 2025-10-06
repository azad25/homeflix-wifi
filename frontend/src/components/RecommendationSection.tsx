"use client";

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Media } from '@/types/media';
import { getApiUrl } from '@/lib/api';
import { Play, Plus, ThumbsUp, ChevronDown, Star, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

// Add Netflix-style scrollbar hiding and overflow handling
const netflixScrollStyles = `
  .netflix-scroll::-webkit-scrollbar {
    display: none;
  }
  .netflix-scroll {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .netflix-row {
    overflow: visible !important;
  }
  .netflix-card-container {
    position: relative;
    z-index: 1;
  }
  .netflix-card-container:hover {
    z-index: 100 !important;
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = netflixScrollStyles;
  document.head.appendChild(styleElement);
}

interface RecommendationSectionProps {
  currentMedia: Media;
  onPlay: (media: Media) => void;
  onInfo: (media: Media) => void;
}

const RecommendationSection: React.FC<RecommendationSectionProps> = ({
  currentMedia,
  onPlay,
  onInfo,
}) => {
  const [personalizedRecommendations, setPersonalizedRecommendations] = useState<Media[]>([]);
  const [similarRecommendations, setSimilarRecommendations] = useState<Media[]>([]);
  const [trendingRecommendations, setTrendingRecommendations] = useState<Media[]>([]);
  const [continueWatching, setContinueWatching] = useState<Media[]>([]);
  const [genreRecommendations, setGenreRecommendations] = useState<Media[]>([]);
  const [mixedRecommendations, setMixedRecommendations] = useState<Media[]>([]);
  const [topRatedRecommendations, setTopRatedRecommendations] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecommendations();

    // Set up auto-refresh every 10 minutes
    const interval = setInterval(() => {
      fetchRecommendations();
    }, 10 * 60 * 1000); // 10 minutes in milliseconds

    return () => clearInterval(interval);
  }, [currentMedia.id]);

  const fetchRecommendations = async () => {
    try {
      const apiUrl = getApiUrl();

      // Fetch multiple recommendation categories in parallel
      const fetchPromises = [
        // Personalized recommendations
        fetch(`${apiUrl}/api/recommendations/personalized?limit=20`).then(res => res.json()),

        // Similar content based on current media
        fetch(`${apiUrl}/api/recommendations/similar?limit=20`).then(res => res.json()),

        // Trending content
        fetch(`${apiUrl}/api/recommendations/trending?limit=20`).then(res => res.json()),

        // Continue watching
        fetch(`${apiUrl}/api/recommendations/continue-watching`).then(res => res.json()),

        // Genre-based recommendations
        currentMedia.genres && currentMedia.genres.length > 0
          ? fetch(`${apiUrl}/api/recommendations/genre?genre=${encodeURIComponent(currentMedia.genres[0].name)}&limit=20`).then(res => res.json())
          : Promise.resolve([]),

        // Mixed recommendations
        fetch(`${apiUrl}/api/recommendations/mixed?limit=20`).then(res => res.json()),

        // Top rated content
        fetch(`${apiUrl}/api/recommendations/top-rated?limit=20`).then(res => res.json())
      ];

      const [
        personalizedData,
        similarData,
        trendingData,
        continueWatchingData,
        genreData,
        mixedData,
        topRatedData
      ] = await Promise.all(fetchPromises);

      // Filter out current media from all recommendations
      const filterCurrentMedia = (media: Media[]) =>
        media.filter(m => m.id !== currentMedia.id);

      setPersonalizedRecommendations(filterCurrentMedia(personalizedData || []));
      setSimilarRecommendations(filterCurrentMedia(similarData || []));
      setTrendingRecommendations(filterCurrentMedia(trendingData || []));
      setContinueWatching(filterCurrentMedia(continueWatchingData || []));
      setGenreRecommendations(filterCurrentMedia(genreData || []));
      setMixedRecommendations(filterCurrentMedia(mixedData || []));
      setTopRatedRecommendations(filterCurrentMedia(topRatedData || []));

      setLoading(false);
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      setLoading(false);
    }
  };

  const handleRecommendationClick = async (media: Media) => {
    try {
      const apiUrl = getApiUrl();
      // Track recommendation click for analytics
      await fetch(`${apiUrl}/api/recommendations/track-click/${media.id}`, {
        method: 'POST'
      });
    } catch (error) {
      console.error('Error tracking recommendation click:', error);
    }
    onInfo(media);
  };

  // Netflix-style Card Component
  const NetflixCard: React.FC<{ media: Media; index: number }> = ({ media, index }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [videoLoaded, setVideoLoaded] = useState(false);
    const [showVideo, setShowVideo] = useState(false);
    const [cardPosition, setCardPosition] = useState({ top: 0, left: 0, width: 0 });
    const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const videoTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const cardRef = useRef<HTMLDivElement>(null);

    const handleMouseEnter = () => {
      // Calculate card position for portal
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        setCardPosition({
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width
        });
      }

      hoverTimeoutRef.current = setTimeout(() => {
        setIsHovered(true);
        // Start video preview after additional delay
        videoTimeoutRef.current = setTimeout(() => {
          setShowVideo(true);
          if (videoRef.current) {
            videoRef.current.play().catch(() => {
              console.log('Video autoplay failed for preview');
            });
          }
        }, 800); // Additional delay for video preview
      }, 300); // Delay hover effect like Netflix
    };

    const handleMouseLeave = () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      if (videoTimeoutRef.current) {
        clearTimeout(videoTimeoutRef.current);
      }
      setIsHovered(false);
      setShowVideo(false);
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
    };

    const getImageUrl = (media: Media) => {
      const apiUrl = getApiUrl();
      // Try poster first, then thumbnail as fallback
      if (media.poster_path) {
        return `${apiUrl}/api/posters/${media.id}`;
      }
      return `${apiUrl}/api/thumbnails/${media.id}`;
    };

    const getPreviewVideoUrl = (media: Media) => {
      const apiUrl = getApiUrl();
      // Try preview clips first (optimized for previews)
      if (media.preview_clip_path) {
        return `${apiUrl}/api/admin/assets/${media.preview_clip_path.split('/').pop()}`;
      }
      // Fallback to preview clips endpoint
      return `${apiUrl}/api/preview-clips/${media.id}`;
    };

    // Cleanup timeouts on unmount
    useEffect(() => {
      return () => {
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
        }
        if (videoTimeoutRef.current) {
          clearTimeout(videoTimeoutRef.current);
        }
      };
    }, []);

    const formatRuntime = (minutes: number) => {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      if (hours > 0) {
        return `${hours}h ${mins}m`;
      }
      return `${mins}m`;
    };

    return (
      <>
        <motion.div
          ref={cardRef}
          className="relative group cursor-pointer"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={() => onInfo(media)}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: index * 0.1 }}
        >
          {/* Main Card */}
          <div className="relative w-full aspect-video bg-gray-900 rounded-lg overflow-hidden shadow-lg">
            {/* Thumbnail Image */}
            <div className="relative w-full h-full">
              <Image
                src={getImageUrl(media)}
                alt={media.title}
                fill
                className={`object-cover transition-opacity duration-300 ${imageLoaded ? (showVideo && videoLoaded ? 'opacity-0' : 'opacity-100') : 'opacity-0'
                  }`}
                onLoad={() => setImageLoaded(true)}
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />

              {/* Preview Video */}
              {showVideo && (
                <video
                  ref={videoRef}
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${videoLoaded ? 'opacity-100' : 'opacity-0'
                    }`}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  onLoadedData={() => setVideoLoaded(true)}
                  onError={() => {
                    console.log('Preview video failed to load');
                    setShowVideo(false);
                  }}
                >
                  <source src={`${getPreviewVideoUrl(media)}?quality=preview`} type="video/mp4" />
                  <source src={getPreviewVideoUrl(media)} type="video/mp4" />
                </video>
              )}

              {/* Loading placeholder */}
              {!imageLoaded && (
                <div className="absolute inset-0 bg-gray-800 animate-pulse flex items-center justify-center">
                  <div className="w-12 h-12 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

              {/* Play button overlay */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <motion.button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlay(media);
                  }}
                  className="bg-white/20 backdrop-blur-sm rounded-full p-4 hover:bg-white/30 transition-colors"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Play className="w-8 h-8 text-white fill-white" />
                </motion.button>
              </div>

              {/* Title overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <h3 className="text-white font-semibold text-sm line-clamp-2 mb-1">
                  {media.title}
                </h3>
                <div className="flex items-center gap-2 text-xs text-white/80">
                  {media.rating && (
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                      <span>{media.rating}</span>
                    </div>
                  )}
                  {media.duration && (
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{formatRuntime(Math.floor(media.duration / 60))}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

        </motion.div>

        {/* Netflix-style Expanded Card - Rendered as Portal */}
        {isHovered && typeof document !== 'undefined' && createPortal(
          <AnimatePresence>
            <motion.div
              className="fixed bg-gray-900 rounded-lg shadow-2xl border border-gray-700 pointer-events-auto"
              style={{
                zIndex: 9999,
                top: cardPosition.top - 20,
                left: Math.max(20, Math.min(cardPosition.left - 40, window.innerWidth - 400)),
                width: Math.max(cardPosition.width * 1.3, 350),
                maxWidth: '400px'
              }}
              initial={{ opacity: 0, scale: 0.8, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              {/* Expanded thumbnail with video */}
              <div className="relative w-full aspect-video rounded-t-lg overflow-hidden">
                {/* Background Image */}
                <Image
                  src={getImageUrl(media)}
                  alt={media.title}
                  fill
                  className={`object-cover transition-opacity duration-300 ${showVideo && videoLoaded ? 'opacity-0' : 'opacity-100'
                    }`}
                  sizes="400px"
                />

                {/* Preview Video in expanded view */}
                {showVideo && videoRef.current && (
                  <video
                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${videoLoaded ? 'opacity-100' : 'opacity-0'
                      }`}
                    autoPlay
                    muted
                    loop
                    playsInline
                  >
                    <source src={`${getPreviewVideoUrl(media)}?quality=preview`} type="video/mp4" />
                    <source src={getPreviewVideoUrl(media)} type="video/mp4" />
                  </video>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent" />
              </div>

              {/* Expanded content */}
              <div className="p-4">
                {/* Action buttons */}
                <div className="flex items-center gap-2 mb-3">
                  <motion.button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlay(media);
                    }}
                    className="bg-white text-black rounded-full p-2 hover:bg-gray-200 transition-colors"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Play className="w-4 h-4 fill-black" />
                  </motion.button>

                  <motion.button
                    className="bg-gray-700 text-white rounded-full p-2 hover:bg-gray-600 transition-colors"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Plus className="w-4 h-4" />
                  </motion.button>

                  <motion.button
                    className="bg-gray-700 text-white rounded-full p-2 hover:bg-gray-600 transition-colors"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <ThumbsUp className="w-4 h-4" />
                  </motion.button>

                  <motion.button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRecommendationClick(media);
                    }}
                    className="bg-gray-700 text-white rounded-full p-2 hover:bg-gray-600 transition-colors ml-auto"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </motion.button>
                </div>

                {/* Metadata */}
                <div className="flex items-center gap-2 text-xs text-green-400 mb-2">
                  <span className="font-semibold">
                    {Math.round((media.rating || 0) * 10)}% Match
                  </span>
                  <span className="text-white/60">
                    {new Date().getFullYear()}
                  </span>
                  {media.duration && (
                    <span className="text-white/60">
                      {formatRuntime(Math.floor(media.duration / 60))}
                    </span>
                  )}
                </div>

                {/* Genres */}
                {media.genres && media.genres.length > 0 && (
                  <div className="flex flex-wrap gap-1 text-xs text-white/80">
                    {media.genres.slice(0, 3).map((genre, idx) => (
                      <span key={genre.id}>
                        {genre.name}
                        {idx < Math.min(media.genres!.length - 1, 2) && ' • '}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>,
          document.body
        )}
      </>
    );
  };

  // Netflix-style Row Component
  const NetflixRow: React.FC<{ title: string; media: Media[] }> = ({ title, media }) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(true);

    const checkScrollButtons = () => {
      if (scrollRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
        setCanScrollLeft(scrollLeft > 0);
        setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
      }
    };

    const scroll = (direction: 'left' | 'right') => {
      if (scrollRef.current) {
        const scrollAmount = scrollRef.current.clientWidth * 0.8;
        const newScrollLeft = direction === 'left'
          ? scrollRef.current.scrollLeft - scrollAmount
          : scrollRef.current.scrollLeft + scrollAmount;

        scrollRef.current.scrollTo({
          left: newScrollLeft,
          behavior: 'smooth'
        });
      }
    };

    useEffect(() => {
      checkScrollButtons();
      const scrollElement = scrollRef.current;
      if (scrollElement) {
        scrollElement.addEventListener('scroll', checkScrollButtons);
        return () => scrollElement.removeEventListener('scroll', checkScrollButtons);
      }
    }, [media]);

    if (media.length === 0) return null;

    return (
      <div className="relative group mb-12">
        <h2 className="text-white text-xl font-semibold mb-4 px-4 md:px-0">
          {title}
        </h2>

        <div className="relative">
          {/* Left scroll button */}
          {canScrollLeft && (
            <motion.button
              onClick={() => scroll('left')}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-black/80 text-white p-2 rounded-r-md opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <ChevronDown className="w-6 h-6 rotate-90" />
            </motion.button>
          )}

          {/* Right scroll button */}
          {canScrollRight && (
            <motion.button
              onClick={() => scroll('right')}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-black/80 text-white p-2 rounded-l-md opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <ChevronDown className="w-6 h-6 -rotate-90" />
            </motion.button>
          )}

          {/* Scrollable container */}
          <div
            ref={scrollRef}
            className="flex gap-2 overflow-x-auto pb-4 px-4 md:px-0 netflix-scroll"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none'
            }}
          >
            {media.map((item, index) => (
              <div key={item.id} className="flex-none w-64 md:w-80">
                <NetflixCard media={item} index={index} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="py-8 text-center text-white/60">
        <div className="flex items-center justify-center gap-2">
          <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
          Loading personalized recommendations...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Personalized Recommendations */}
      {personalizedRecommendations.length > 0 && (
        <NetflixRow title="Recommended For You" media={personalizedRecommendations} />
      )}

      {/* Similar Content */}
      {similarRecommendations.length > 0 && (
        <NetflixRow title="More Like This" media={similarRecommendations} />
      )}

      {/* Genre-based Recommendations */}
      {genreRecommendations.length > 0 && currentMedia.genres && currentMedia.genres.length > 0 && (
        <NetflixRow
          title={`More ${currentMedia.genres[0].name} ${currentMedia.type === 'movie' ? 'Movies' : 'Shows'}`}
          media={genreRecommendations}
        />
      )}

      {/* Trending Now */}
      {trendingRecommendations.length > 0 && (
        <NetflixRow title="Trending Now" media={trendingRecommendations} />
      )}

      {/* Top Rated Content */}
      {topRatedRecommendations.length > 0 && (
        <NetflixRow title="Top Rated" media={topRatedRecommendations} />
      )}

      {/* Mixed Recommendations - Fallback section */}
      {mixedRecommendations.length > 0 && (
        <NetflixRow title="You Might Also Like" media={mixedRecommendations} />
      )}
    </div>
  );
};

export default RecommendationSection;
