"use client";

import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Play, Info, Plus, Star, Clock, ThumbsUp, ChevronDown } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Media } from '@/types/media';
import { getApiUrl } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import NetflixCard from './NetflixCard';
import FastLoadingImage from './FastLoadingImage';
import LazyImage from './LazyImage';
import Image from 'next/image';
import { useGlobalCache, useBatchCache } from '@/hooks/useGlobalCache';
import { globalCachedFetch } from '@/lib/globalApiCache';

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

  // Use global cache for recommendations with batch fetching
  const { data: recommendationData, loading: recommendationsLoading } = useBatchCache<Media[]>([
    { url: `${getApiUrl()}/api/recommendations/mixed?limit=25` },
    { url: `${getApiUrl()}/api/recommendations/trending?limit=20` },
    { url: `${getApiUrl()}/api/recommendations/continue-watching` }
  ], {
    customTTL: 5 * 60 * 1000, // 5 minutes cache for recommendations
    staleWhileRevalidate: true
  });

  useEffect(() => {
    if (recommendationData) {
      fetchRecommendations();
    }

    // Set up auto-refresh every 10 minutes for optimized performance
    const interval = setInterval(() => {
      setRefreshCount(prev => prev + 1);
      if (recommendationData) {
        fetchRecommendations();
      }
    }, 10 * 60 * 1000); // 10 minutes in milliseconds

    return () => clearInterval(interval);
  }, [currentMedia.id, recommendationData]);

  // Additional effect to trigger frontend shuffling every 2 minutes
  useEffect(() => {
    if (refreshCount > 0 && allAvailableMedia.length > 0) {
      // Every few refreshes, force frontend recommendations for variety
      if (refreshCount % 3 === 0) {
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

  // Use global cache for media initialization
  const { data: mediaData } = useGlobalCache<Media[]>(
    `${getApiUrl()}/api/media?limit=100`,
    {},
    { customTTL: 15 * 60 * 1000 } // 15 minutes cache
  );

  // Update available media when cache data changes
  useEffect(() => {
    if (mediaData && Array.isArray(mediaData)) {
      setAllAvailableMedia(mediaData);
      console.log(`✅ Cached ${mediaData.length} media items for recommendation fallback`);
    }
  }, [mediaData]);

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

  const fetchRecommendations = async () => {
    try {
      // Use cached data if available
      const [mixedData, trendingData, continueWatchingData] = recommendationData || [[], [], []];

      // Filter out current media from all recommendations
      const filterCurrentMedia = (media: Media[]) =>
        media.filter(m => m.id !== currentMedia.id);

      // Process optimized recommendations - distribute mixed data across categories
      const filteredMixed = filterCurrentMedia(mixedData || []);
      const filteredTrending = filterCurrentMedia(trendingData || []);
      const filteredContinueWatching = filterCurrentMedia(continueWatchingData || []);

      // Distribute mixed recommendations across multiple categories for UI variety
      const mixedChunks = [
        filteredMixed.slice(0, 7),  // Personalized
        filteredMixed.slice(7, 14), // Similar
        filteredMixed.slice(14, 21) // Genre-based
      ];

      setPersonalizedRecommendations(mixedChunks[0]);
      setSimilarRecommendations(mixedChunks[1]);
      setTrendingRecommendations(filteredTrending);
      setContinueWatching(filteredContinueWatching);
      setGenreRecommendations(mixedChunks[2]);

      console.log('✅ Recommendations fetched successfully:', {
        personalized: mixedChunks[0].length,
        similar: mixedChunks[1].length,
        trending: filteredTrending.length,
        continueWatching: filteredContinueWatching.length,
        genre: mixedChunks[2].length
      });

      setLoading(false);
    } catch (error) {
      console.error('❌ Failed to fetch recommendations:', error);
      
      // Enhanced fallback: Use frontend-generated recommendations
      if (allAvailableMedia.length > 0) {
        console.log('🔄 Falling back to frontend-generated recommendations...');
        const fallbackPersonalized = generateFrontendRecommendations(allAvailableMedia, currentMedia, 'top-rated', 15);
        const fallbackSimilar = generateFrontendRecommendations(allAvailableMedia, currentMedia, 'you-might-like', 15);
        const fallbackTrending = generateLatestMoviesRecommendations(allAvailableMedia, 15);
        
        setPersonalizedRecommendations(fallbackPersonalized);
        setSimilarRecommendations(fallbackSimilar);
        setTrendingRecommendations(fallbackTrending);
        setContinueWatching([]);
        setGenreRecommendations(fallbackPersonalized.slice(0, 10));
        
        console.log('✅ Frontend fallback recommendations generated');
      }
      
      setLoading(false);
    }  
  };

  const trackRecommendationClick = async (media: Media) => {
    try {
      // Use global cache for analytics tracking (no cache needed)
      await globalCachedFetch(`${getApiUrl()}/api/recommendations/track-click/${media.id}`, {
        method: 'POST'
      }, {
        bypassCache: true // Don't cache POST requests
      });
    } catch (error) {
      // Silently fail - analytics shouldn't block user interaction
    }
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

    const getPosterUrl = (media: Media) => {
      const apiUrl = getApiUrl();
      return `${apiUrl}/api/posters/${media.id}`;
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
            {/* Thumbnail Image with Fallback */}
            <div className="relative w-full h-full">
              <Image
                src={media.poster_path ? getPosterUrl(media) : getImageUrl(media)}
                alt={media.title}
                fill
                className={`object-cover transition-opacity duration-300 ${imageLoaded ? (showVideo && videoLoaded ? 'opacity-0' : 'opacity-100') : 'opacity-0'
                  }`}
                onLoad={() => setImageLoaded(true)}
                onError={() => {
                  // Try thumbnail fallback if poster fails
                  const img = document.querySelector(`img[alt="${media.title}"]`) as HTMLImageElement;
                  if (img && media.poster_path && img.src.includes('/posters/')) {
                    img.src = getImageUrl(media);
                    return;
                  }
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
                  src={media.poster_path ? getPosterUrl(media) : getImageUrl(media)}
                  alt={media.title}
                  fill
                  className={`object-cover transition-opacity duration-300 ${showVideo && videoLoaded ? 'opacity-0' : 'opacity-100'
                    }`}
                  onError={() => {
                    // Try thumbnail fallback if poster fails
                    const img = document.querySelector(`img[alt="${media.title}"]`) as HTMLImageElement;
                    if (img && media.poster_path && img.src.includes('/posters/')) {
                      img.src = getImageUrl(media);
                    }
                  }}
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
                      trackRecommendationClick(media);
                      onInfo(media);
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
