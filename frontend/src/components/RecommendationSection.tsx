"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Media } from '@/types/media';
import { getApiUrl } from '@/lib/api';
import { Play, Plus, ThumbsUp, ChevronDown, Star, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { cachedFetch } from '@/lib/apiCache';
import { requestThrottler, assetLoader } from '@/lib/requestThrottler';

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
  const [latestMoviesRecommendations, setLatestMoviesRecommendations] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [allAvailableMedia, setAllAvailableMedia] = useState<Media[]>([]);
  const [previousApiResponses, setPreviousApiResponses] = useState<Set<string>>(new Set());
  const [refreshCount, setRefreshCount] = useState(0);

  // Throttled API fetching functions
  const throttledFetchRecommendations = useCallback(
    requestThrottler.throttle(async () => {
      try {
        const apiUrl = getApiUrl();
        
        // Use single mixed recommendations endpoint instead of multiple parallel calls
        const mixedData = await cachedFetch(`${apiUrl}/api/recommendations/mixed?limit=60`);
        
        if (mixedData && Array.isArray(mixedData) && mixedData.length > 0) {
          const filteredData = mixedData.filter(m => m.id !== currentMedia.id);
          
          // Distribute mixed data across different categories to reduce API calls
          const shuffled = shuffleArray([...filteredData]);
          
          setPersonalizedRecommendations(shuffled.slice(0, 20));
          setSimilarRecommendations(shuffled.slice(20, 40));
          setTrendingRecommendations(shuffled.slice(40, 60));
          setMixedRecommendations(shuffled.slice(0, 20));
          
          console.log(`✅ Fetched ${filteredData.length} mixed recommendations`);
        }
        
        // Fetch continue watching separately (smaller, more targeted request)
        const continueWatchingData = await cachedFetch(`${apiUrl}/api/recommendations/continue-watching`);
        if (continueWatchingData && Array.isArray(continueWatchingData)) {
          setContinueWatching(continueWatchingData.filter(m => m.id !== currentMedia.id));
        }
        
      } catch (error) {
        console.error('Error fetching recommendations:', error);
        // Fallback to frontend recommendations if API fails
        if (allAvailableMedia.length > 0) {
          const topRatedFallback = generateFrontendRecommendations(allAvailableMedia, currentMedia, 'top-rated', 20);
          const youMightLikeFallback = generateFrontendRecommendations(allAvailableMedia, currentMedia, 'you-might-like', 20);
          
          setTopRatedRecommendations(topRatedFallback);
          setMixedRecommendations(youMightLikeFallback);
        }
      }
    }, 'recommendations', 2000), // 2 second throttle
    [currentMedia.id, allAvailableMedia]
  );

  const throttledInitializeMediaCache = useCallback(
    requestThrottler.throttle(async () => {
      try {
        const apiUrl = getApiUrl();
        const data = await cachedFetch(`${apiUrl}/api/media?limit=100`);
        if (data && Array.isArray(data)) {
          setAllAvailableMedia(data);
          console.log(`✅ Cached ${data.length} media items for recommendation fallback`);
        }
      } catch (error) {
        console.warn('⚠️ Failed to initialize media cache for recommendations:', error);
      }
    }, 'media', 1000),
    []
  );

  useEffect(() => {
    const initializeAndFetch = async () => {
      setLoading(true);
      await throttledInitializeMediaCache();
      await throttledFetchRecommendations();
      setLoading(false);
    };

    initializeAndFetch();

    // Reduced frequency: refresh every 10 minutes instead of 3 minutes
    const interval = setInterval(() => {
      setRefreshCount(prev => prev + 1);
      throttledFetchRecommendations();
    }, 10 * 60 * 1000); // 10 minutes

    return () => clearInterval(interval);
  }, [currentMedia.id, throttledFetchRecommendations, throttledInitializeMediaCache]);

  // Additional effect to trigger frontend shuffling every 6 minutes (reduced frequency)
  useEffect(() => {
    if (refreshCount > 0 && allAvailableMedia.length > 0) {
      // Every 2 refreshes (20 minutes), force frontend recommendations for variety
      if (refreshCount % 2 === 0) {
        console.log('🔄 Periodic frontend shuffle triggered...');
        const newTopRated = generateFrontendRecommendations(allAvailableMedia, currentMedia, 'top-rated', 20);
        const newYouMightLike = generateFrontendRecommendations(allAvailableMedia, currentMedia, 'you-might-like', 20);
        const newLatestMovies = generateLatestMoviesRecommendations(allAvailableMedia, 20);

        setTopRatedRecommendations(newTopRated);
        setMixedRecommendations(newYouMightLike);
        setLatestMoviesRecommendations(newLatestMovies);
      }
    }
  }, [refreshCount, allAvailableMedia, currentMedia]);

  // Shuffle array utility function
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Check if API response is duplicate
  const isApiResponseDuplicate = (media: Media[], category: string): boolean => {
    const responseSignature = `${category}-${media.map(m => m.id).sort().join(',')}`;
    return previousApiResponses.has(responseSignature);
  };

  // Add API response to history
  const addApiResponseToHistory = (media: Media[], category: string) => {
    const responseSignature = `${category}-${media.map(m => m.id).sort().join(',')}`;
    setPreviousApiResponses(prev => new Set([...prev, responseSignature]));
  };

  // Generate intelligent frontend recommendations with enhanced latest and genre prioritization
  const generateFrontendRecommendations = (
    availableMedia: Media[],
    currentMediaItem: Media,
    category: 'top-rated' | 'you-might-like',
    limit: number = 20
  ): Media[] => {
    console.log(`🔄 Generating frontend ${category} recommendations from ${availableMedia.length} available items...`);

    // Filter out current media
    const filteredMedia = availableMedia.filter(m => m.id !== currentMediaItem.id);

    // Priority genres: sci-fi, action, drama, thriller
    const priorityGenres = ['sci-fi', 'science fiction', 'action', 'drama', 'thriller', 'adventure', 'mystery', 'crime'];
    
    // Latest and newly added content (highest IDs = most recent)
    const latestContent = filteredMedia
      .sort((a, b) => b.id - a.id)
      .slice(0, Math.floor(filteredMedia.length * 0.4)); // Top 40% newest

    // Priority genre content with latest preference
    const priorityGenreContent = filteredMedia.filter(m => 
      m.genres?.some(genre => 
        priorityGenres.some(priority => 
          genre.name.toLowerCase().includes(priority.toLowerCase())
        )
      )
    ).sort((a, b) => b.id - a.id); // Sort by latest first

    // Latest movies specifically (for movie recommendations)
    const latestMovies = filteredMedia
      .filter(m => m.type === 'movie')
      .sort((a, b) => b.id - a.id)
      .slice(0, Math.floor(filteredMedia.length * 0.3)); // Top 30% newest movies

    let recommendations: Media[] = [];

    if (category === 'top-rated') {
      // Top Rated: Enhanced with latest priority genre content
      const highRatedPriorityGenres = priorityGenreContent
        .filter(m => (m.rating || 0) >= 7.0)
        .slice(0, Math.floor(limit * 0.4)); // 40% latest priority genres

      const latestHighRated = latestContent
        .filter(m => (m.rating || 0) >= 6.5)
        .slice(0, Math.floor(limit * 0.3)); // 30% latest high-rated

      const generalHighRated = filteredMedia
        .filter(m => (m.rating || 0) >= 7.5 && 
          !highRatedPriorityGenres.some(r => r.id === m.id) &&
          !latestHighRated.some(r => r.id === m.id))
        .sort((a, b) => (b.rating || 0) - (a.rating || 0))
        .slice(0, Math.floor(limit * 0.3)); // 30% general high-rated

      recommendations = [
        ...shuffleArray(highRatedPriorityGenres),
        ...shuffleArray(latestHighRated),
        ...shuffleArray(generalHighRated)
      ];

    } else if (category === 'you-might-like') {
      // You Might Like: Enhanced with latest and priority genre focus

      // 1. Latest priority genre content (35%)
      const latestPriorityGenres = priorityGenreContent
        .slice(0, Math.floor(limit * 0.35));

      // 2. Latest movies if current is movie, or same genre latest (25%)
      let contextualLatest: Media[] = [];
      if (currentMediaItem.type === 'movie') {
        contextualLatest = latestMovies
          .filter(m => !latestPriorityGenres.some(r => r.id === m.id))
          .slice(0, Math.floor(limit * 0.25));
      } else {
        // For TV shows, get latest same genre content
        contextualLatest = currentMediaItem.genres ? 
          latestContent.filter(m =>
            m.genres?.some(g => currentMediaItem.genres!.some(cg => cg.name === g.name)) &&
            !latestPriorityGenres.some(r => r.id === m.id)
          ).slice(0, Math.floor(limit * 0.25)) : [];
      }

      // 3. Popular latest content (20%)
      const popularLatest = latestContent
        .filter(m => 
          !latestPriorityGenres.some(r => r.id === m.id) &&
          !contextualLatest.some(r => r.id === m.id)
        )
        .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
        .slice(0, Math.floor(limit * 0.2));

      // 4. Same type latest content (20%)
      const sameTypeLatest = filteredMedia
        .filter(m => 
          m.type === currentMediaItem.type &&
          !latestPriorityGenres.some(r => r.id === m.id) &&
          !contextualLatest.some(r => r.id === m.id) &&
          !popularLatest.some(r => r.id === m.id)
        )
        .sort((a, b) => b.id - a.id)
        .slice(0, Math.floor(limit * 0.2));

      recommendations = [
        ...shuffleArray(latestPriorityGenres),
        ...shuffleArray(contextualLatest),
        ...shuffleArray(popularLatest),
        ...shuffleArray(sameTypeLatest)
      ];
    }

    // Fill remaining slots with latest content prioritizing priority genres
    const remaining = filteredMedia.filter(m =>
      !recommendations.some(r => r.id === m.id)
    );
    
    // Prioritize remaining priority genre content first
    const remainingPriorityGenres = remaining.filter(m => 
      m.genres?.some(genre => 
        priorityGenres.some(priority => 
          genre.name.toLowerCase().includes(priority.toLowerCase())
        )
      )
    ).sort((a, b) => b.id - a.id); // Latest first

    // Then latest general content
    const remainingLatest = remaining.filter(m =>
      !remainingPriorityGenres.some(r => r.id === m.id)
    ).sort((a, b) => b.id - a.id);

    // Fill remaining slots
    const slotsRemaining = limit - recommendations.length;
    if (slotsRemaining > 0) {
      const fillContent = [
        ...remainingPriorityGenres.slice(0, Math.floor(slotsRemaining * 0.6)),
        ...remainingLatest.slice(0, Math.floor(slotsRemaining * 0.4))
      ];
      recommendations.push(...shuffleArray(fillContent).slice(0, slotsRemaining));
    }

    // Final shuffle and limit
    const finalRecommendations = shuffleArray(recommendations).slice(0, limit);
    console.log(`✅ Generated ${finalRecommendations.length} frontend ${category} recommendations (${priorityGenreContent.length} priority genres, ${latestContent.length} latest items)`);
    return finalRecommendations;
  };

  // Generate latest movies recommendations with priority genre focus
  const generateLatestMoviesRecommendations = (availableMedia: Media[], limit: number = 20): Media[] => {
    console.log(`🔄 Generating latest movies recommendations from ${availableMedia.length} available items...`);

    // Priority genres for movies
    const priorityGenres = ['sci-fi', 'science fiction', 'action', 'drama', 'thriller', 'adventure', 'mystery', 'crime', 'horror', 'fantasy'];
    
    // Filter to movies only and sort by latest (highest ID = most recent)
    const allMovies = availableMedia
      .filter(m => m.type === 'movie')
      .sort((a, b) => b.id - a.id);

    // Latest movies with priority genres
    const latestPriorityMovies = allMovies.filter(m => 
      m.genres?.some(genre => 
        priorityGenres.some(priority => 
          genre.name.toLowerCase().includes(priority.toLowerCase())
        )
      )
    ).slice(0, Math.floor(limit * 0.6)); // 60% priority genre movies

    // Latest movies (all genres)
    const latestAllMovies = allMovies
      .filter(m => !latestPriorityMovies.some(p => p.id === m.id))
      .slice(0, Math.floor(limit * 0.4)); // 40% other latest movies

    const recommendations = [
      ...shuffleArray(latestPriorityMovies),
      ...shuffleArray(latestAllMovies)
    ];

    const finalRecommendations = shuffleArray(recommendations).slice(0, limit);
    console.log(`✅ Generated ${finalRecommendations.length} latest movies recommendations (${latestPriorityMovies.length} priority genres, ${latestAllMovies.length} other movies)`);
    return finalRecommendations;
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
      // Always use thumbnails for better compatibility in recommendations
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

    const handleRecommendationClick = useCallback(
      requestThrottler.throttle(async () => {
        try {
          const apiUrl = getApiUrl();
          await cachedFetch(`${apiUrl}/api/recommendations/track-click/${media.id}`, {
            method: 'POST'
          });
        } catch (error) {
          console.error('Error tracking recommendation click:', error);
        }
        onInfo(media);
      }, 'analytics', 500),
      [onInfo]
    );

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
          whileHover={{ scale: 1.05, y: -5 }}
        >
          {/* Main Card */}
          <div className="relative w-full aspect-[2/3] bg-gray-900 rounded-lg overflow-hidden shadow-lg">
            {/* Thumbnail Image with Fallback */}
            <div className="relative w-full h-full">
              <Image
                src={getImageUrl(media)}
                alt={media.title}
                fill
                className={`object-cover transition-opacity duration-300 ${imageLoaded ? (showVideo && videoLoaded ? 'opacity-0' : 'opacity-100') : 'opacity-0'
                  }`}
                onLoad={() => setImageLoaded(true)}
                onError={() => {
                  // If still fails, show placeholder
                  setImageLoaded(false);
                }}
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />

              {/* Preview Video - Only load when actually showing */}
              {showVideo && (
                <video
                  ref={videoRef}
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${videoLoaded ? 'opacity-100' : 'opacity-0'
                    }`}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="none"
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

              {/* Loading placeholder or fallback */}
              {!imageLoaded && (
                <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                  <div className="text-white text-center">
                    <div className="text-3xl mb-2">🎬</div>
                    <div className="text-sm font-medium line-clamp-2 px-2">{media.title}</div>
                    <div className="text-xs text-gray-400 mt-1">Loading...</div>
                  </div>
                </div>
              )}

              {/* Quality Badge - Top Right */}
              <div className="absolute top-3 right-3 z-10">
                <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-md font-bold shadow-lg">
                  HD
                </span>
              </div>

              {/* Gradient overlay for text */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

              {/* Play button overlay */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <motion.button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlay(media);
                  }}
                  className="bg-white/90 backdrop-blur-sm rounded-full p-4 hover:bg-white transition-colors"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Play className="w-6 h-6 text-black fill-black" />
                </motion.button>
              </div>

              {/* Content Overlay - Bottom */}
              <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
                {/* Title */}
                <h3 className="text-white font-bold text-sm line-clamp-2 mb-2 drop-shadow-lg">
                  {media.title}
                </h3>

                {/* Year and Rating Row */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-gray-300 text-sm font-medium drop-shadow">
                    {new Date().getFullYear()}
                  </span>
                  {media.rating && (
                    <div className="flex items-center gap-1 bg-black/50 px-2 py-1 rounded-md">
                      <Star className="w-3 h-3 text-yellow-400 fill-current" />
                      <span className="text-white text-sm font-medium">{media.rating.toFixed(1)}</span>
                    </div>
                  )}
                </div>

                {/* Genres Row */}
                {media.genres && media.genres.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {media.genres.slice(0, 2).map((genre, index) => (
                      <span
                        key={genre.id || index}
                        className="text-xs text-white bg-red-600/80 px-2 py-1 rounded-md font-medium backdrop-blur-sm"
                      >
                        {genre.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Duration */}
                {media.duration && (
                  <div className="flex items-center gap-1 mt-2 text-gray-300 text-xs">
                    <Clock className="w-3 h-3" />
                    <span>{formatRuntime(Math.floor(media.duration / 60))}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

        </motion.div>


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
      <div className="relative group mb-8">
        <h2 className="text-white text-xl font-semibold mb-3 px-4 md:px-0">
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
            className="flex gap-4 overflow-x-auto pb-4 px-4 md:px-0 netflix-scroll"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none'
            }}
          >
            {media.map((item, index) => (
              <div key={item.id} className="flex-none w-56 md:w-64">
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

      {/* Latest Movies */}
      {latestMoviesRecommendations.length > 0 && (
        <NetflixRow title="Latest Movies" media={latestMoviesRecommendations} />
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
