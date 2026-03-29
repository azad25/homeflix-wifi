"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { usePageTitle } from '@/hooks/usePageTitle';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Star,
  Calendar,
  Clock,
  Users,
  Award,
  Globe,
  DollarSign,
  Film,
  Maximize,
  ExternalLink,
  Plus,
  Check,
  Share2,
  Download,
  X,
  Info,
  Search,
  Bell,
  Menu,
  Maximize2,
  Minimize2,
  Monitor,
  ListVideo,
  Layers,
  Type,
  SkipForward,
  AlignLeft,
  GripHorizontal,
  ChevronRight,
  MessageSquare,
  Flame,
  Sparkles,
  Target,
  Tv2,
  Image as ImageIcon,
  MapPin,
  SearchSlash,
  AlertCircle
} from 'lucide-react';
import { getApiUrl } from '@/lib/api';
import { addToWishlist, removeFromWishlist, isInWishlist } from '@/lib/wishlist';
import Navbar from '@/components/Navbar';
import RedLoader from '@/components/RedLoader';
import UpcomingMovies from '@/components/UpcomingMovies';
import UpcomingTVSeries from '@/components/UpcomingTVSeries';
import { useMyList } from '@/hooks/useMyList';
import MyListTooltip from '@/components/ui/MyListTooltip';
import { GradientBackground } from '@/components/scrollx';
import AutoSlidingBanner from '@/components/AutoSlidingBanner';

// Genre-based text styling utility
const getGenreTextStyle = (genres: string[] = []) => {
  const primaryGenre = genres[0]?.toLowerCase() || '';

  // Font family based on genre
  let fontFamily = 'font-sans'; // default
  if (primaryGenre.includes('horror') || primaryGenre.includes('thriller')) {
    fontFamily = 'font-mono'; // monospace for tension
  } else if (primaryGenre.includes('romance') || primaryGenre.includes('drama')) {
    fontFamily = 'font-serif'; // serif for elegance
  } else if (primaryGenre.includes('sci') || primaryGenre.includes('science')) {
    fontFamily = 'font-mono'; // monospace for tech feel
  } else if (primaryGenre.includes('comedy')) {
    fontFamily = 'font-sans'; // clean sans for readability
  }

  // Text size and styling
  const textSize = 'text-sm md:text-base'; // Reduced from lg
  const maxWidth = 'max-w-lg'; // Reduced from xl to lg
  const lineHeight = 'leading-relaxed';

  return {
    fontFamily,
    textSize,
    maxWidth,
    lineHeight,
    className: `${fontFamily} ${textSize} ${maxWidth} ${lineHeight}`
  };
};

// Related Media Component
interface RelatedMediaProps {
  mediaId: number;
  mediaType: 'movie' | 'tv';
  releaseYear?: number;
  className?: string;
}

interface RelatedMediaItem {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview: string;
  release_date: string;
  poster_path: string;
  backdrop_path: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  media_type: 'movie' | 'tv';
  adult: boolean;
  genre_ids: number[];
}

const RelatedMedia: React.FC<RelatedMediaProps> = ({ mediaId, mediaType, releaseYear, className = '' }) => {
  const [relatedMedia, setRelatedMedia] = useState<RelatedMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (mediaId && mediaType) {
      fetchRelatedMedia();
    }
  }, [mediaId, mediaType, releaseYear]);

  const fetchRelatedMedia = async () => {
    try {
      setLoading(true);
      const apiUrl = getApiUrl();
      // Include year parameter if provided for year-based filtering
      const yearParam = releaseYear ? `&year=${releaseYear}` : '';
      const response = await fetch(`${apiUrl}/api/tmdb/${mediaId}/related?type=${mediaType}&limit=16${yearParam}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setRelatedMedia(data.results || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching related media:', err);
      setError('Failed to load related content');
      setRelatedMedia([]);
    } finally {
      setLoading(false);
    }
  };

  const getPosterUrl = (posterPath: string, size: string = 'w300') => {
    if (!posterPath) return '/placeholder-poster.jpg';
    return `https://image.tmdb.org/t/p/${size}${posterPath}`;
  };

  const getBackdropUrl = (backdropPath: string, size: string = 'w780') => {
    if (!backdropPath) return '/placeholder-backdrop.jpg';
    return `https://image.tmdb.org/t/p/${size}${backdropPath}`;
  };

  const formatRuntime = (minutes: number) => {
    if (!minutes || typeof minutes !== 'number' || minutes <= 0) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const handleMediaClick = (media: RelatedMediaItem) => {
    router.push(`/tmdb-movie/${media.id}?type=${media.media_type}`);
  };

  if (loading) {
    return (
      <div className={`${className}`}>
        <div className="w-full px-4 md:px-8 xl:px-12">
          <h2 className="text-2xl font-bold text-white mb-6">
            Related {mediaType === 'movie' ? 'Movies' : 'TV Shows'}
          </h2>
          <div className="flex items-center justify-center py-12">
            <RedLoader />
          </div>
        </div>
      </div>
    );
  }

  if (error || relatedMedia.length === 0) {
    return null; // Don't show section if no related content
  }

  return (
    <div className={`${className}`}>
      <div className="w-full px-4 md:px-8 xl:px-12">
        <h2 className="text-2xl font-black tracking-tight text-white mb-6 flex items-center gap-2">
          <Film className="w-6 h-6 text-red-500" />
          More Like This
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4 lg:gap-5 auto-rows-[140px] md:auto-rows-[180px] lg:auto-rows-[200px] grid-flow-row-dense">
          {relatedMedia.map((media, index) => {
            if (!media?.id) return null;

            // Pattern repeating every 7 items for beautiful masonry layout
            const pattern = index % 7;
            let spanClass = "col-span-1 row-span-2 aspect-[2/3]"; // Default fallback poster
            let imageSrc = getPosterUrl(media.poster_path);
            let isBackdrop = false;

            if (pattern === 0) {
              // Large Featured Backdrop
              spanClass = "col-span-2 md:col-span-4 lg:col-span-4 row-span-2";
              imageSrc = getBackdropUrl((media as any).backdrop_path || media.poster_path);
              isBackdrop = true;
            } else if (pattern === 1 || pattern === 2) {
              // Standard Posters (row 1 right side)
              spanClass = "col-span-1 md:col-span-2 lg:col-span-1 row-span-2";
              imageSrc = getPosterUrl(media.poster_path);
            } else if (pattern === 3 || pattern === 4) {
              // Small Backdrops
              spanClass = "col-span-2 md:col-span-2 lg:col-span-2 row-span-1";
              imageSrc = getBackdropUrl((media as any).backdrop_path || media.poster_path);
              isBackdrop = true;
            } else if (pattern === 5 || pattern === 6) {
              // Small regular posters
              spanClass = "col-span-1 md:col-span-1 lg:col-span-1 row-span-1";
              imageSrc = getPosterUrl(media.poster_path);
            }

            const isLarge = pattern === 0;
            const bannerMovies = isBackdrop ? [
              media,
              relatedMedia[(index + 3) % relatedMedia.length],
              relatedMedia[(index + 7) % relatedMedia.length]
            ].filter(Boolean) : [];

            return (
              <motion.div
                key={media.id}
                className={`group cursor-pointer relative rounded-xl overflow-hidden shadow-2xl border border-white/5 hover:border-white/20 transition-all ${spanClass}`}
                whileHover={{ scale: 1.02, zIndex: 10 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                onClick={() => handleMediaClick(media)}
              >
                {isBackdrop ? (
                  <AutoSlidingBanner
                    movies={bannerMovies}
                    getBackdropUrl={(m: any) => getBackdropUrl(m.backdrop_path || m.poster_path)}
                    onClick={handleMediaClick}
                    isLarge={isLarge}
                  />
                ) : (
                  <>
                    <img
                      src={imageSrc}
                      alt={media.title || media.name || 'Media image'}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                      loading="lazy"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQ1MCIgdmlld0JveD0iMCAwIDMwMCA0NTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iNDUwIiBmaWxsPSIjMzc0MTUxIi8+CjxwYXRoIGQ9Ik0xNTAgMjAwQzE4Ny4yNzkgMjAwIDIxOCAxNjkuMjc5IDIxOCAxMzJDMjE4IDk0LjcyMDggMTg3LjI3OSA2NCAxNTAgNjRDMTEyLjcyMSA2NCA4MiA5NC43MjA4IDgyIDEzMkM4MiAxNjkuMjc5IDExMi43MjEgMjAwIDE1MCAyMDBaIiBmaWxsPSIjNkI3Mjg4Ii8+CjxwYXRoIGQ9Ik04MiAyNzZDODIgMjM4LjY4IDExMi42OCAyMDggMTUwIDIwOEgxNTBDMTg3LjMyIDIwOCAyMTggMjM4LjY4IDIxOCAyNzZWMzUwSDgyVjI3NloiIGZpbGw9IiM2QjcyODgiLz4KPHN2Zz4K';
                      }}
                    />

                    {/* Dark Vignette Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-80 group-hover:opacity-90 transition-opacity duration-300" />

                    {/* Top Quick Info */}
                    <div className="absolute top-3 right-3 flex items-center gap-2">
                      {media.vote_average && media.vote_average > 0 && (
                        <div className="bg-black/60 backdrop-blur-md rounded-full px-2.5 py-1 flex items-center gap-1.5 shadow-lg">
                          <Star className="w-3.5 h-3.5 text-yellow-400 fill-current" />
                          <span className="text-xs font-bold text-white">
                            {media.vote_average.toFixed(1)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Content Info Container (Bottom Aligned) */}
                    <div className="absolute bottom-0 left-0 right-0 p-4 lg:p-5 flex flex-col justify-end translate-y-3 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-400">
                      <h3 className="text-white font-bold leading-tight drop-shadow-lg text-sm mb-1 line-clamp-1">
                        {media.title || media.name}
                      </h3>

                      <div className="flex items-center gap-2 md:gap-3 text-white/80 text-xs md:text-sm font-medium">
                        {media.release_date && (
                          <span>{new Date(media.release_date).getFullYear()}</span>
                        )}
                      </div>
                    </div>

                    {/* Center Play Icon on purely poster cards */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="bg-red-600/90 backdrop-blur-md rounded-full p-4 transform scale-75 group-hover:scale-100 transition-transform duration-300 shadow-[0_0_20px_rgba(220,38,38,0.5)]">
                        <Play className="w-6 h-6 text-white fill-current translate-x-0.5" />
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Movie Images Gallery Component
interface MovieImagesProps {
  movieId: number;
  mediaType?: 'movie' | 'tv';
  className?: string;
}

interface TMDBImage {
  aspect_ratio: number;
  file_path: string;
  height: number;
  width: number;
  vote_average: number;
  vote_count: number;
}

const MovieImages: React.FC<MovieImagesProps> = ({ movieId, mediaType = 'movie', className = '' }) => {
  const [images, setImages] = useState<{ backdrops: TMDBImage[]; posters: TMDBImage[]; logos: TMDBImage[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'backdrops' | 'posters' | 'logos'>('backdrops');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    if (movieId) {
      fetchImages();
    }
  }, [movieId, mediaType]);

  const fetchImages = async () => {
    try {
      setLoading(true);
      const apiUrl = getApiUrl();
      const endpoint = mediaType === 'tv'
        ? `${apiUrl}/api/tmdb/tv/${movieId}/images`
        : `${apiUrl}/api/tmdb/movie/${movieId}/images`;
      const response = await fetch(endpoint);

      if (!response.ok) {
        // Gracefully handle errors - just don't show images
        setImages(null);
        setError('Images not available');
        return;
      }

      const data = await response.json();
      setImages(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching movie images:', err);
      setError('Failed to load images');
      setImages(null);
    } finally {
      setLoading(false);
    }
  };

  const getImageUrl = (path: string, size: string = 'w500') => {
    return `https://image.tmdb.org/t/p/${size}${path}`;
  };

  if (loading) {
    return (
      <div className={`${className}`}>
        <div className="w-full px-4 md:px-8 xl:px-12">
          <h2 className="text-2xl font-bold text-white mb-6">Movie Images</h2>
          <div className="flex items-center justify-center py-12">
            <RedLoader />
          </div>
        </div>
      </div>
    );
  }

  if (error || !images || (images.backdrops.length === 0 && images.posters.length === 0 && images.logos.length === 0)) {
    return null; // Don't show section if no images
  }

  const currentImages = images[activeTab] || [];

  return (
    <>
      <div className={`${className}`}>
        <div className="w-full px-4 md:px-8 xl:px-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <Film className="w-6 h-6 text-red-500" />
            Images
          </h2>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-white/10">
            <button
              onClick={() => setActiveTab('backdrops')}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'backdrops'
                ? 'border-red-500 text-white'
                : 'border-transparent text-gray-400 hover:text-white'
                }`}
            >
              Backdrops ({images.backdrops.length})
            </button>
            <button
              onClick={() => setActiveTab('posters')}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'posters'
                ? 'border-red-500 text-white'
                : 'border-transparent text-gray-400 hover:text-white'
                }`}
            >
              Posters ({images.posters.length})
            </button>
            {images.logos.length > 0 && (
              <button
                onClick={() => setActiveTab('logos')}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'logos'
                  ? 'border-red-500 text-white'
                  : 'border-transparent text-gray-400 hover:text-white'
                  }`}
              >
                Logos ({images.logos.length})
              </button>
            )}
          </div>

          {/* Image Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {currentImages.slice(0, 10).map((image, index) => (
              <motion.div
                key={index}
                className="group cursor-pointer relative aspect-video bg-gray-800 rounded-lg overflow-hidden"
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.2 }}
                onClick={() => setSelectedImage(getImageUrl(image.file_path, 'original'))}
              >
                <img
                  src={getImageUrl(image.file_path, 'w500')}
                  alt={`${activeTab} ${index + 1}`}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="absolute bottom-2 left-2 flex items-center gap-2 text-xs text-white">
                    <Star className="w-3 h-3 text-yellow-400 fill-current" />
                    <span>{image.vote_average.toFixed(1)}</span>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-400">{image.width}×{image.height}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {currentImages.length > 10 && (
            <div className="text-center mt-4">
              <p className="text-gray-400 text-sm">
                Showing 10 of {currentImages.length} {activeTab}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-red-500 transition-colors"
            onClick={() => setSelectedImage(null)}
          >
            <X className="w-8 h-8" />
          </button>
          <img
            src={selectedImage}
            alt="Full size"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};

// TMDB Movie List Component - Uses individual endpoints
interface TMDBMovieListProps {
  endpoint: 'popular' | 'now-playing' | 'upcoming';
  title: string;
  maxItems?: number;
  asCarousel?: boolean;
  className?: string;
}

interface TMDBMovieItem {
  id: number;
  title: string;
  release_date: string;
  poster_path: string;
  vote_average: number;
}

const TMDBMovieList: React.FC<TMDBMovieListProps> = ({ endpoint, title, maxItems = 12, asCarousel = false, className = '' }) => {
  const [movies, setMovies] = useState<TMDBMovieItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchMovies();
  }, [endpoint]);

  useEffect(() => {
    if (asCarousel && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const updateScrollButtons = () => {
        setCanScrollLeft(container.scrollLeft > 0);
        setCanScrollRight(container.scrollLeft < container.scrollWidth - container.clientWidth - 10);
      };
      updateScrollButtons();
      container.addEventListener('scroll', updateScrollButtons);
      return () => container.removeEventListener('scroll', updateScrollButtons);
    }
  }, [movies, asCarousel]);

  const fetchMovies = async () => {
    try {
      setLoading(true);
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/tmdb/movie/${endpoint}?page=1`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setMovies((data.results || []).slice(0, maxItems));
      setError(null);
    } catch (err) {
      console.error(`Error fetching ${endpoint} movies:`, err);
      setError('Failed to load movies');
      setMovies([]);
    } finally {
      setLoading(false);
    }
  };

  const getPosterUrl = (posterPath: string) => {
    if (!posterPath) return '/placeholder-poster.jpg';
    return `https://image.tmdb.org/t/p/w500${posterPath}`;
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = direction === 'left' ? -400 : 400;
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const handleMovieClick = (movieId: number) => {
    router.push(`/tmdb-movie/${movieId}`);
  };

  if (loading) {
    return (
      <div className={`${className}`}>
        <div className="w-full px-4 md:px-8 xl:px-12">
          <h2 className="text-2xl font-bold text-white mb-6">{title}</h2>
          <div className="flex items-center justify-center py-12">
            <RedLoader />
          </div>
        </div>
      </div>
    );
  }

  if (error || movies.length === 0) {
    return null;
  }

  if (asCarousel) {
    return (
      <div className={`${className}`}>
        <div className="w-full px-4 md:px-8 xl:px-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <Film className="w-6 h-6 text-red-500" />
            {title}
          </h2>

          <div className="relative group">
            {canScrollLeft && (
              <button
                onClick={() => scroll('left')}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-black/70 hover:bg-black/90 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
            )}

            <div
              ref={scrollContainerRef}
              className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth pb-4"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {movies.map((movie) => (
                <motion.div
                  key={movie.id}
                  className="flex-shrink-0 w-48 group cursor-pointer"
                  whileHover={{ scale: 1.05 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => handleMovieClick(movie.id)}
                >
                  <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-gray-800 shadow-lg">
                    <img
                      src={getPosterUrl(movie.poster_path)}
                      alt={movie.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      loading="lazy"
                    />

                    {movie.vote_average > 0 && (
                      <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1">
                        <Star className="w-3 h-3 text-yellow-400 fill-current" />
                        <span className="text-xs text-white font-medium">
                          {movie.vote_average.toFixed(1)}
                        </span>
                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="absolute bottom-2 left-2 right-2">
                        <h3 className="text-white text-sm font-semibold line-clamp-2 mb-1">
                          {movie.title}
                        </h3>
                        {movie.release_date && (
                          <p className="text-gray-300 text-xs">
                            {new Date(movie.release_date).getFullYear()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {canScrollRight && (
              <button
                onClick={() => scroll('right')}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-black/70 hover:bg-black/90 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ArrowLeft className="w-6 h-6 rotate-180" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      <div className="max-w-7xl mx-auto">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
          <Film className="w-6 h-6 text-red-500" />
          {title}
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {movies.map((movie) => (
            <motion.div
              key={movie.id}
              className="group cursor-pointer"
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.2 }}
              onClick={() => handleMovieClick(movie.id)}
            >
              <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-gray-800 shadow-lg">
                <img
                  src={getPosterUrl(movie.poster_path)}
                  alt={movie.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  loading="lazy"
                />

                {/* Rating Badge */}
                {movie.vote_average > 0 && (
                  <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1">
                    <Star className="w-3 h-3 text-yellow-400 fill-current" />
                    <span className="text-xs text-white font-medium">
                      {movie.vote_average.toFixed(1)}
                    </span>
                  </div>
                )}

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="absolute bottom-2 left-2 right-2">
                    <h3 className="text-white text-sm font-semibold line-clamp-2 mb-1">
                      {movie.title}
                    </h3>
                    {movie.release_date && (
                      <p className="text-gray-300 text-xs">
                        {new Date(movie.release_date).getFullYear()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

interface TMDBMovieDetails {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  release_date: string;
  poster_path: string;
  backdrop_path: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  runtime: number;
  genres: Array<{ id: number; name: string }>;
  production_companies: Array<{ id: number; name: string; logo_path: string }>;
  production_countries: Array<{ iso_3166_1: string; name: string }>;
  spoken_languages: Array<{ iso_639_1: string; name: string }>;
  tagline: string;
  budget: number;
  revenue: number;
  status: string;
  adult: boolean;
  homepage: string;
  imdb_id: string;
  videos: {
    results: Array<{
      id: string;
      key: string;
      name: string;
      site: string;
      type: string;
      official: boolean;
      published_at: string;
    }>;
  };
  credits: {
    cast: Array<{
      id: number;
      name: string;
      character: string;
      profile_path: string;
      order: number;
    }>;
    crew: Array<{
      id: number;
      name: string;
      job: string;
      department: string;
      profile_path: string;
    }>;
  };
}

interface TMDBTVDetails {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  first_air_date: string;
  last_air_date?: string;
  poster_path: string;
  backdrop_path: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  number_of_episodes: number;
  number_of_seasons: number;
  episode_run_time: number[];
  genres: Array<{ id: number; name: string }>;
  production_companies: Array<{ id: number; name: string; logo_path: string }>;
  production_countries: Array<{ iso_3166_1: string; name: string }>;
  spoken_languages: Array<{ iso_639_1: string; name: string }>;
  tagline: string;
  status: string;
  adult: boolean;
  homepage: string;
  in_production: boolean;
  type: string;
  networks: Array<{ id: number; name: string; logo_path: string }>;
  seasons: Array<{
    id: number;
    name: string;
    overview: string;
    poster_path: string;
    season_number: number;
    episode_count: number;
    air_date: string;
  }>;
  videos: {
    results: Array<{
      id: string;
      key: string;
      name: string;
      site: string;
      type: string;
      official: boolean;
      published_at: string;
    }>;
  };
  credits: {
    cast: Array<{
      id: number;
      name: string;
      character: string;
      profile_path: string;
      order: number;
    }>;
    crew: Array<{
      id: number;
      name: string;
      job: string;
      department: string;
      profile_path: string;
    }>;
  };
}

interface TMDBMediaResponse {
  media_type: 'movie' | 'tv';
  data: TMDBMovieDetails | TMDBTVDetails;
}

// Unified interface for display
interface UnifiedMediaDetails {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  release_date: string;
  poster_path: string;
  backdrop_path: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genres: Array<{ id: number; name: string }>;
  production_companies: Array<{ id: number; name: string; logo_path: string }>;
  production_countries: Array<{ iso_3166_1: string; name: string }>;
  spoken_languages: Array<{ iso_639_1: string; name: string }>;
  tagline: string;
  status: string;
  adult: boolean;
  homepage: string;
  videos: {
    results: Array<{
      id: string;
      key: string;
      name: string;
      site: string;
      type: string;
      official: boolean;
      published_at: string;
    }>;
  };
  credits: {
    cast: Array<{
      id: number;
      name: string;
      character: string;
      profile_path: string;
      order: number;
    }>;
    crew: Array<{
      id: number;
      name: string;
      job: string;
      department: string;
      profile_path: string;
    }>;
  };
  // Media type specific fields
  media_type: 'movie' | 'tv';
  type: string; // Required by Media interface - maps to media_type
  runtime?: number; // Movies only
  budget?: number; // Movies only
  revenue?: number; // Movies only
  imdb_id?: string; // Movies only
  number_of_episodes?: number; // TV only
  number_of_seasons?: number; // TV only
  episode_run_time?: number[]; // TV only
  in_production?: boolean; // TV only
  networks?: Array<{ id: number; name: string; logo_path: string }>; // TV only
  seasons?: Array<{
    id: number;
    name: string;
    overview: string;
    poster_path: string;
    season_number: number;
    episode_count: number;
    air_date: string;
  }>; // TV only
}

const TMDBMoviePage: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const videoRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [mediaDetails, setMediaDetails] = useState<UnifiedMediaDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [showFullCast, setShowFullCast] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isInMyList, setIsInMyList] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<{
    isDownloading: boolean;
    progress: number;
    downloadId?: string;
    status?: string;
  }>({ isDownloading: false, progress: 0 });
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Use the new backend-connected My List hook
  const { myList, collections, isInMyList: isInMyListHook, toggleMyList: toggleMyListHook, addToCollection, fetchCollections } = useMyList();

  const movieId = params?.id as string;

  // Create prefixed ID for TMDB content to distinguish from local media
  const tmdbPrefixedId = movieId ? parseInt(`9${movieId}`) : 0;

  useEffect(() => {
    if (movieId) {
      fetchMovieDetails();
      checkMyList();
      checkDownloadStatus();
    }
  }, [movieId]);

  // Poll for download status updates
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (downloadStatus.isDownloading) {
      interval = setInterval(() => {
        checkDownloadStatus();
      }, 2000); // Check every 2 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [downloadStatus.isDownloading, movieId]);

  // Auto-hide controls after 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowControls(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, [showControls]);

  // Handle video loading and sound initialization
  useEffect(() => {
    if (isPlaying && videoRef.current && !isMuted) {
      // Ensure video plays with sound after a short delay
      const timer = setTimeout(() => {
        videoRef.current?.contentWindow?.postMessage('{"event":"command","func":"unMute","args":""}', '*');
        videoRef.current?.contentWindow?.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [isPlaying, isMuted]);

  // Auto-start trailer when trailer key becomes available
  useEffect(() => {
    if (trailerKey && !isPlaying) {
      setIsPlaying(true);
    }
  }, [trailerKey]);

  const fetchMovieDetails = async () => {
    try {
      setLoading(true);
      const apiUrl = getApiUrl();
      const mediaType = searchParams?.get('type');
      const url = mediaType
        ? `${apiUrl}/api/tmdb-movie/${movieId}?type=${mediaType}`
        : `${apiUrl}/api/tmdb-movie/${movieId}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseData = await response.json();

      // Check if it's the new wrapped format or old direct format
      let unifiedData: UnifiedMediaDetails;
      if (responseData.media_type && responseData.data) {
        // New wrapped format
        unifiedData = convertToUnifiedFormat(responseData as TMDBMediaResponse);
      } else {
        // Old direct format - convert to unified format
        unifiedData = {
          ...responseData,
          media_type: 'movie' as const,
          type: 'movie', // Add required type property
          title: responseData.title,
          original_title: responseData.original_title,
          release_date: responseData.release_date,
        };
      }
      setMediaDetails(unifiedData);

      // Find the best trailer and auto-play it
      const trailer = findBestTrailer(unifiedData.videos?.results || []);
      setTrailerKey(trailer?.key || null);

      // Auto-play trailer if available
      if (trailer?.key) {
        setIsPlaying(true);
      }

      setError(null);

      // Fetch logo from TMDB images API
      fetchLogo(unifiedData.id, unifiedData.media_type);
    } catch (err) {
      console.error("Error fetching media details:", err);
      setError("Failed to load media details");
    } finally {
      setLoading(false);
    }
  };

  const fetchLogo = async (tmdbId: number, mediaType: 'movie' | 'tv') => {
    try {
      const apiUrl = getApiUrl();
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
        setLogoUrl(`https://image.tmdb.org/t/p/w500${bestLogo.file_path}`);
      }
    } catch (err) {
      console.error('Error fetching logo:', err);
    }
  };

  const convertToUnifiedFormat = (response: TMDBMediaResponse): UnifiedMediaDetails => {
    const { media_type, data } = response;

    if (media_type === 'movie') {
      const movieData = data as TMDBMovieDetails;
      return {
        ...movieData,
        media_type: 'movie',
        type: 'movie', // Add required type property
        title: movieData.title,
        original_title: movieData.original_title,
        release_date: movieData.release_date,
      };
    } else {
      const tvData = data as TMDBTVDetails;
      return {
        ...tvData,
        media_type: 'tv',
        type: 'episode', // Add required type property (TV shows are treated as episodes)
        title: tvData.name, // Map name to title
        original_title: tvData.original_name, // Map original_name to original_title
        release_date: tvData.first_air_date, // Map first_air_date to release_date
      };
    }
  };

  const findBestTrailer = (videos: any[]) => {
    const trailers = videos.filter(v => v.site === 'YouTube');

    // Priority: Official trailers > Trailers > Teasers > Clips
    let trailer = trailers.find(v => v.official && v.type === 'Trailer');
    if (trailer) return trailer;

    trailer = trailers.find(v => v.type === 'Trailer');
    if (trailer) return trailer;

    trailer = trailers.find(v => v.type === 'Teaser');
    if (trailer) return trailer;

    return trailers[0] || null;
  };

  const getPosterUrl = (posterPath: string, size: string = 'w500') => {
    if (!posterPath) return '/placeholder-poster.jpg';
    return `https://image.tmdb.org/t/p/${size}${posterPath}`;
  };

  const getBackdropUrl = (backdropPath: string, size: string = 'original') => {
    if (!backdropPath) return '/placeholder-backdrop.jpg';
    return `https://image.tmdb.org/t/p/${size}${backdropPath}`;
  };

  const getProfileUrl = (profilePath: string | null | undefined, size: string = 'w185') => {
    if (!profilePath || profilePath.trim() === '' || profilePath === 'null') {
      return getPlaceholderAvatar();
    }
    return `https://image.tmdb.org/t/p/${size}${profilePath}`;
  };

  const getPlaceholderAvatar = () => {
    // Try SVG data URL first, fallback to a simple colored div approach
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
      <svg width="200" height="200" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="#374151" rx="100"/>
        <circle cx="100" cy="80" r="30" fill="#6B7280"/>
        <path d="M50 160C50 135.147 70.147 115 95 115H105C129.853 115 150 135.147 150 160V180H50V160Z" fill="#6B7280"/>
      </svg>
    `)}`;
  };

  // Alternative placeholder component for when SVG fails
  const PlaceholderDiv: React.FC<{ className: string; alt: string }> = ({ className, alt }) => (
    <div
      className={`${className} bg-gray-700 flex items-center justify-center`}
      title={alt}
      role="img"
      aria-label={alt}
    >
      <div className="text-gray-400 text-center">
        <div className="w-8 h-8 mx-auto mb-1 rounded-full bg-gray-600"></div>
        <div className="text-xs">No Image</div>
      </div>
    </div>
  );

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.target as HTMLImageElement;
    const placeholderSrc = getPlaceholderAvatar();

    // Prevent infinite loops and only set placeholder if not already set
    if (target.src !== placeholderSrc && !target.src.includes('data:image/svg+xml')) {
      console.log('Image failed to load, using placeholder:', target.src);
      target.src = placeholderSrc;
    }
  };

  // Custom ProfileImage component for better error handling
  const ProfileImage: React.FC<{
    profilePath: string | null | undefined;
    alt: string;
    className: string;
    size?: string;
  }> = ({ profilePath, alt, className, size = 'w300' }) => {
    const [imgSrc, setImgSrc] = useState<string>(() => {
      const url = getProfileUrl(profilePath, size);
      console.log('ProfileImage initial URL:', url, 'for profile:', profilePath);
      return url;
    });
    const [hasError, setHasError] = useState(false);
    const [usePlaceholderDiv, setUsePlaceholderDiv] = useState(false);

    const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
      console.log('ProfileImage error for:', profilePath, 'current src:', imgSrc);
      if (!hasError) {
        setHasError(true);
        const placeholder = getPlaceholderAvatar();
        console.log('Setting placeholder:', placeholder);
        setImgSrc(placeholder);
      } else if (imgSrc.includes('data:image/svg+xml')) {
        // If even the SVG placeholder fails, use div fallback
        console.log('SVG placeholder also failed, using div fallback');
        setUsePlaceholderDiv(true);
      }
    };

    // If no profile path, start with placeholder
    useEffect(() => {
      if (!profilePath || profilePath.trim() === '' || profilePath === 'null') {
        setImgSrc(getPlaceholderAvatar());
        setHasError(true);
      }
    }, [profilePath]);

    // Use div fallback if both image and SVG failed
    if (usePlaceholderDiv) {
      return <PlaceholderDiv className={className} alt={alt} />;
    }

    return (
      <img
        src={imgSrc}
        alt={alt}
        className={className}
        onError={handleError}
        onLoad={() => console.log('ProfileImage loaded successfully:', imgSrc)}
      />
    );
  };

  const formatRuntime = (minutes: number) => {
    if (!minutes || minutes <= 0) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'TBA';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const togglePlayPause = () => {
    if (isPlaying && videoRef.current) {
      const iframe = videoRef.current;
      iframe.contentWindow?.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
    }
    setIsPlaying(!isPlaying);
    setShowControls(true);

    // When starting to play, ensure sound is enabled after iframe loads
    if (!isPlaying) {
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.contentWindow?.postMessage('{"event":"command","func":"unMute","args":""}', '*');
          videoRef.current.contentWindow?.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
        }
      }, 1500);
    }
  };

  const toggleMute = () => {
    if (videoRef.current && isPlaying) {
      const iframe = videoRef.current;
      if (isMuted) {
        iframe.contentWindow?.postMessage('{"event":"command","func":"unMute","args":""}', '*');
      } else {
        iframe.contentWindow?.postMessage('{"event":"command","func":"mute","args":""}', '*');
      }
    }
    setIsMuted(!isMuted);
    setShowControls(true);
  };

  const handleMouseMove = () => {
    setShowControls(true);
  };

  const checkMyList = async () => {
    if (movieId) {
      // For TMDB media, we use the TMDB ID with a prefix to distinguish from local media
      const tmdbWishlistId = parseInt(`9${movieId}`); // Prefix with 9 to avoid conflicts
      const inList = isInWishlist(tmdbWishlistId);
      setIsInMyList(inList);
    }
  };

  const toggleMyList = async () => {
    try {
      if (!movieId || !mediaDetails) return;

      // For TMDB media, we use the TMDB ID with a prefix to distinguish from local media
      const tmdbWishlistId = parseInt(`9${movieId}`); // Prefix with 9 to avoid conflicts
      let success = false;

      if (isInMyList) {
        success = removeFromWishlist(tmdbWishlistId);
      } else {
        // Create a wishlist entry with TMDB media data
        success = addToWishlist(tmdbWishlistId, {
          id: tmdbWishlistId,
          title: mediaDetails.title,
          year: new Date(mediaDetails.release_date).getFullYear(),
          rating: mediaDetails.vote_average,
          genres: mediaDetails.genres?.map(g => ({ name: g.name })) || [],
          tmdb_id: mediaDetails.id,
          poster_path: mediaDetails.poster_path,
          poster_url: mediaDetails.poster_path ? `https://image.tmdb.org/t/p/w500${mediaDetails.poster_path}` : null,
          overview: mediaDetails.overview
        });
      }

      if (success) {
        setIsInMyList(!isInMyList);
      }
    } catch (error) {
      console.error('Error toggling wishlist:', error);
    }
  };

  const checkDownloadStatus = async () => {
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/torrents/downloads`);
      if (response.ok) {
        const data = await response.json();
        const downloads = data.downloads || [];

        // Check if this movie is being downloaded
        const movieDownload = downloads.find((download: any) =>
          download.tmdb_id === parseInt(movieId) &&
          download.media_type === (mediaDetails?.media_type || 'movie')
        );

        if (movieDownload) {
          const isActivelyDownloading = movieDownload.status === 'downloading';
          setDownloadStatus({
            isDownloading: isActivelyDownloading,
            progress: movieDownload.progress || 0,
            downloadId: movieDownload.torrent_id || movieDownload.id,
            status: movieDownload.status
          });
        } else {
          setDownloadStatus({ isDownloading: false, progress: 0 });
        }
      }
    } catch (error) {
      console.error('Error checking download status:', error);
      setDownloadStatus({ isDownloading: false, progress: 0 });
    }
  };

  const handleDownload = async () => {
    if (downloadStatus.isDownloading) {
      // If already downloading, navigate to torrent dashboard to show progress
      const params = new URLSearchParams({
        tab: 'torrent'
      });
      router.push(`/settings?${params.toString()}`);
      return;
    }

    // Always navigate to torrent dashboard for manual torrent selection
    const mediaInfo = {
      tmdb_id: mediaDetails?.id,
      title: mediaDetails?.title,
      // Remove year from search to improve TV series results
      media_type: mediaDetails?.media_type || 'movie'
    };

    const params = new URLSearchParams({
      tab: 'torrent',
      media: JSON.stringify(mediaInfo)
    });

    router.push(`/settings?${params.toString()}`);

    // Commented out auto-download functionality - user should manually select torrents
    /*
    try {
      // Search for torrents using the correct API endpoint
      const apiUrl = getApiUrl();
      const searchParams = new URLSearchParams({
        title: mediaDetails?.title || '',
        year: new Date(mediaDetails?.release_date || '').getFullYear().toString(),
        type: mediaDetails?.media_type || 'movie'
      });
      
      const response = await fetch(`${apiUrl}/api/torrents/search?${searchParams.toString()}`);
      
      if (response.ok) {
        const data = await response.json();
        const torrents = data.results || [];
        
        if (torrents.length > 0) {
          // Auto-select the best torrent (first one, as they're sorted by quality/seeders)
          const bestTorrent = torrents[0];
          
          const downloadResponse = await fetch(`${apiUrl}/api/torrents/download`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              magnet_uri: bestTorrent.magnet_uri,
              title: mediaDetails?.title,
              tmdb_id: parseInt(movieId),
              media_type: mediaDetails?.media_type || 'movie',
              quality: bestTorrent.quality || '1080p'
            }),
          });

          if (downloadResponse.ok) {
            // Start polling for progress
            setDownloadStatus({ isDownloading: true, progress: 0 });
            checkDownloadStatus();
          } else {
            throw new Error('Failed to start download');
          }
        }
      }
    } catch (error) {
      console.error('Error with auto-download:', error);
    }
    */
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <RedLoader size="large" />
      </div>
    );
  }

  if (error || !mediaDetails) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Movie Not Found</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => router.back()}
            className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const directors = mediaDetails?.credits?.crew?.filter(person => person.job === 'Director') || [];
  const writers = mediaDetails?.credits?.crew?.filter(person =>
    person.job === 'Writer' || person.job === 'Screenplay' || person.job === 'Story'
  ) || [];
  const mainCast = mediaDetails?.credits?.cast?.slice(0, showFullCast ? undefined : 8) || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Navbar />
        <RedLoader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Navbar />
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Error Loading Media</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => window.history.back()}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-semibold transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!mediaDetails) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Navbar />
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Media Not Found</h1>
          <p className="text-gray-400 mb-6">The requested movie or TV series could not be found.</p>
          <button
            onClick={() => window.history.back()}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-semibold transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />

      {/* Hero Section with HD Trailer */}
      <div
        className="relative h-screen overflow-hidden"
        onMouseMove={handleMouseMove}
        ref={containerRef}
      >
        {/* Backdrop Background Image - Shows when video not playing */}
        <div
          className={`absolute inset-0 pointer-events-none transition-opacity duration-1000 ${trailerKey && isPlaying ? 'opacity-0' : 'opacity-100'
            }`}
          style={{ zIndex: 1 }}
        >
          <img
            src={getBackdropUrl(mediaDetails?.backdrop_path || '', 'original')}
            alt={mediaDetails?.title || ''}
            className="w-full h-full object-cover"
            loading="eager"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              // Fallback to a solid color background
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                parent.style.background = 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)';
              }
            }}
          />
          {/* Gradient overlay for better text readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-black/20" />
        </div>

        {/* HD Trailer Video - Only show when playing */}
        {trailerKey && isPlaying && (
          <div className="absolute inset-0 overflow-hidden" style={{ zIndex: 2 }}>
            <iframe
              ref={videoRef}
              src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=0&controls=0&showinfo=0&rel=0&iv_load_policy=3&modestbranding=1&enablejsapi=1&loop=1&playlist=${trailerKey}&disablekb=1&fs=0&cc_load_policy=0&start=5&origin=${typeof window !== 'undefined' ? window.location.origin : ''}&vq=hd1080&hd=1&quality=hd1080`}
              className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
              allow="autoplay; encrypted-media"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              style={{
                width: '120vw',
                height: '120vh',
                minWidth: '200vh',
                minHeight: '70vw',
                pointerEvents: 'none',
                border: 'none',
                outline: 'none'
              }}
              onLoad={() => setIsVideoLoaded(true)}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent pointer-events-none" />
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
          </div>
        )}





        {/* Navigation and Controls removed logic per request */}

        {/* Gradient overlay for text readability */}
        <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black via-black/80 to-transparent z-[10] pointer-events-none" />

        {/* Hero Content - Left Aligned */}
        <div className="absolute inset-0 z-[20] flex items-end justify-start pb-20 p-6 md:pl-12 lg:pl-16 pointer-events-auto w-full lg:w-[75%] xl:w-[60%]">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="flex flex-row items-end gap-6 md:gap-8 w-full"
          >
            {/* Poster thumbnail in Info Section */}
            {mediaDetails?.poster_path && (
              <div className="hidden sm:block w-28 md:w-40 lg:w-56 flex-shrink-0 rounded-xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.8)] border border-white/10 relative aspect-[2/3]">
                <img
                  src={getPosterUrl(mediaDetails.poster_path, 'w500')}
                  alt={mediaDetails.title}
                  className="w-full h-full object-cover opacity-90 hover:opacity-100 transition-opacity absolute inset-0"
                />
              </div>
            )}

            {/* Main Info Column */}
            <div className="flex flex-col items-start gap-4 flex-1 min-w-0">

              {/* Movie Title - Logo or Text */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                className="w-full"
              >
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={mediaDetails?.title}
                    className="max-h-24 md:max-h-32 lg:max-h-40 w-auto mb-2 drop-shadow-[0_4px_24px_rgba(0,0,0,0.8)]"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                      if (fallback) fallback.style.display = 'block';
                    }}
                  />
                ) : null}
                <h1
                  className="text-4xl md:text-5xl lg:text-6xl font-extrabold mb-1 text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.8)]"
                  style={{ display: logoUrl ? 'none' : 'block' }}
                >
                  {mediaDetails?.title}
                </h1>
              </motion.div>

              {/* Genres */}
              {mediaDetails?.genres && mediaDetails.genres.length > 0 && (
                <motion.div
                  className="flex flex-wrap items-center gap-1.5 min-w-0 -mt-2 mb-1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.65, duration: 0.4 }}
                >
                  {mediaDetails.genres.slice(0, 4).map((genre: any, index: number, arr: any[]) => (
                    <React.Fragment key={index}>
                      <span className="text-sm md:text-base font-semibold text-white drop-shadow-md">
                        {genre.name}
                      </span>
                      {index < arr.length - 1 && <span className="w-1.5 h-1.5 rounded-full bg-white/60 mx-1 shadow-sm" />}
                    </React.Fragment>
                  ))}
                </motion.div>
              )}

              {/* Overview */}
              <motion.p
                className={`text-white/80 max-w-2xl line-clamp-3 md:line-clamp-4 drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] mb-2 text-sm md:text-base leading-snug ${getGenreTextStyle(mediaDetails?.genres?.map(g => g.name) || []).className}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7, duration: 0.4 }}
              >
                {mediaDetails?.overview || `Experience this amazing ${mediaDetails?.media_type === 'tv' ? 'TV series' : 'movie'} with stunning visuals and compelling storytelling.`}
              </motion.p>

              {/* Stats Row */}
              <motion.div
                className="flex flex-wrap items-center gap-3 text-sm md:text-base font-medium text-white/90 drop-shadow-md mb-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.4 }}
              >
                <span>{new Date(mediaDetails?.release_date || '').getFullYear() || new Date().getFullYear()}</span>
                {mediaDetails?.media_type === 'movie' && mediaDetails?.runtime && mediaDetails.runtime > 0 && (
                  <>
                    <span className="text-white/40">|</span>
                    <span>{formatRuntime(mediaDetails.runtime)}</span>
                  </>
                )}
                {mediaDetails?.media_type === 'tv' && mediaDetails.number_of_seasons && mediaDetails.number_of_seasons > 0 && (
                  <>
                    <span className="text-white/40">|</span>
                    <span>{mediaDetails.number_of_seasons} Season{(mediaDetails.number_of_seasons || 0) > 1 ? 's' : ''}</span>
                  </>
                )}
                {(mediaDetails?.vote_average || 0) > 0 && (
                  <>
                    <span className="text-white/40">|</span>
                    <span className="flex items-center gap-1">
                      {mediaDetails!.vote_average.toFixed(1)} <span className="bg-yellow-500 text-black text-[10px] font-bold px-1 rounded-sm ml-0.5 mt-0.5" style={{ lineHeight: '1.2' }}>IMDb</span>
                    </span>
                  </>
                )}
              </motion.div>
              {/* Action Buttons */}
              <motion.div
                className="flex items-center gap-2 mt-1"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.4 }}
              >
                <button
                  onClick={handleDownload}
                  className={`flex items-center gap-2 px-4 py-2 md:px-5 md:py-2.5 font-bold rounded shadow-lg transition-all duration-200 hover:scale-105 text-sm md:text-base ${downloadStatus.isDownloading
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : downloadStatus.status === 'completed'
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-white text-black hover:bg-white/80'
                    }`}
                  disabled={downloadStatus.status === 'completed'}
                >
                  {downloadStatus.status === 'completed' ? (
                    <>
                      <Check className="w-4 h-4 md:w-5 md:h-5 fill-current ml-1" />
                      <span>Downloaded</span>
                    </>
                  ) : downloadStatus.isDownloading ? (
                    <>
                      <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-current border-t-transparent rounded-full animate-spin ml-1" />
                      <span>Downloading...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 md:w-5 md:h-5 fill-current ml-1" />
                      <span>Download</span>
                    </>
                  )}
                </button>

                <MyListTooltip
                  media={mediaDetails}
                  isInMyList={isInMyListHook(tmdbPrefixedId)}
                  collections={collections}
                  onToggleMyList={() => toggleMyListHook(tmdbPrefixedId)}
                  onAddToCollection={(collectionId) => addToCollection(collectionId, tmdbPrefixedId)}
                  onCollectionCreated={fetchCollections}
                >
                  <button className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 bg-gray-500/40 hover:bg-gray-500/60 text-white font-bold rounded backdrop-blur-md shadow-lg transition-all duration-200 hover:scale-105 text-xs md:text-sm">
                    {isInMyListHook(tmdbPrefixedId) ? (
                      <>
                        <Check className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        <span className="hidden sm:inline">In List</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        <span className="hidden sm:inline">Watch List</span>
                      </>
                    )}
                  </button>
                </MyListTooltip>

                {mediaDetails?.homepage && (
                  <a
                    href={mediaDetails.homepage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center p-2 md:p-2.5 bg-gray-500/40 hover:bg-gray-500/60 text-white rounded backdrop-blur-md shadow-lg transition-all duration-200 hover:scale-105"
                    title="Official Site"
                  >
                    <ExternalLink className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  </a>
                )}

                {trailerKey && (
                  <>
                    <button
                      onClick={togglePlayPause}
                      className="flex items-center justify-center w-9 h-9 md:w-10 md:h-10 ml-2 md:ml-4 border border-white/30 bg-black/40 hover:bg-black/60 text-white rounded-full backdrop-blur-md shadow-lg transition-all duration-200 hover:scale-110"
                      title={isPlaying ? "Pause Video" : "Play Video"}
                    >
                      {isPlaying ? <Pause className="w-3.5 h-3.5 md:w-4 md:h-4" /> : <Play className="w-3.5 h-3.5 md:w-4 md:h-4" />}
                    </button>
                    <button
                      onClick={toggleMute}
                      className="flex items-center justify-center w-9 h-9 md:w-10 md:h-10 border border-white/30 bg-black/40 hover:bg-black/60 text-white rounded-full backdrop-blur-md shadow-lg transition-all duration-200 hover:scale-110"
                      title={isMuted ? "Unmute" : "Mute"}
                    >
                      {isMuted ? <VolumeX className="w-3.5 h-3.5 md:w-4 md:h-4" /> : <Volume2 className="w-3.5 h-3.5 md:w-4 md:h-4" />}
                    </button>
                  </>
                )}
              </motion.div>

              {/* Download Progress Bar */}
              {downloadStatus.isDownloading && downloadStatus.progress > 0 && (
                <motion.div
                  initial={{ opacity: 0, scaleX: 0 }}
                  animate={{ opacity: 1, scaleX: 1 }}
                  className="w-full max-w-xs mt-3 bg-gray-500/50 rounded-full h-1 overflow-hidden"
                >
                  <div
                    className="bg-green-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${downloadStatus.progress}%` }}
                  />
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Details Section - Bottom Left */}
      <div className="relative z-[10] bg-black pt-16 pb-24">
        <div className="container mx-auto px-6 md:px-12 lg:px-16">
          <div className="flex justify-start">
            <div className="w-full">
              {/* Media Info */}
              <div className="bg-gradient-to-r from-black/80 via-black/60 to-transparent p-8 rounded-2xl backdrop-blur-sm border border-white/10 shadow-2xl">
                <h2 className="text-2xl font-bold text-white mb-8">About {mediaDetails?.title}</h2>
                {/* About Section with Poster Layout */}
                <div className="flex flex-col lg:flex-row gap-8">
                  {/* Left side - Text content */}
                  <div className="flex-1">
                    <div className="space-y-8">

                      <div className="grid grid-cols-1 gap-8">
                        <div>
                          <div className="flex items-center gap-3 mb-6">
                            <Info className="w-6 h-6 text-red-500" />
                            <h3 className="text-xl font-semibold text-white">Details</h3>
                          </div>
                          <div className="space-y-4 pl-9">
                            {mediaDetails?.genres && mediaDetails.genres.length > 0 && (
                              <div className="flex flex-col gap-3">
                                <span className="text-white/60 font-medium">Genres</span>
                                <div className="flex flex-wrap gap-2">
                                  {mediaDetails.genres.map((genre) => (
                                    <span
                                      key={genre.id}
                                      className="px-3 py-1.5 bg-gradient-to-r from-red-600/20 to-red-500/20 text-red-300 text-sm font-medium rounded-full border border-red-500/30 hover:from-red-600/30 hover:to-red-500/30 transition-all duration-200"
                                    >
                                      {genre.name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {mediaDetails?.media_type === 'movie' && mediaDetails?.runtime && mediaDetails.runtime > 0 && (
                              <div className="flex">
                                <span className="w-32 text-white/60 font-medium">Duration</span>
                                <span className="text-white">{formatRuntime(mediaDetails.runtime)}</span>
                              </div>
                            )}
                            {mediaDetails?.media_type === 'tv' && (
                              <>
                                <div className="flex">
                                  <span className="w-32 text-white/60 font-medium">Seasons</span>
                                  <span className="text-white">{mediaDetails.number_of_seasons}</span>
                                </div>
                                <div className="flex">
                                  <span className="w-32 text-white/60 font-medium">Episodes</span>
                                  <span className="text-white">{mediaDetails.number_of_episodes}</span>
                                </div>
                              </>
                            )}
                            {mediaDetails?.credits?.crew && directors.length > 0 && (
                              <div className="flex flex-col gap-3">
                                <span className="text-white/60 font-medium">Director{directors.length > 1 ? 's' : ''}</span>
                                <div className="flex flex-wrap gap-2">
                                  {directors.slice(0, 3).map((director) => (
                                    <span
                                      key={director.id}
                                      className="px-3 py-1.5 bg-gradient-to-r from-blue-600/20 to-blue-500/20 text-blue-300 text-sm font-medium rounded-full border border-blue-500/30 hover:from-blue-600/30 hover:to-blue-500/30 transition-all duration-200"
                                    >
                                      {director.name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {mediaDetails?.credits?.cast && mediaDetails.credits.cast.length > 0 && (
                              <div className="flex flex-col gap-3">
                                <span className="text-white/60 font-medium">Cast</span>
                                <div className="flex flex-wrap gap-2">
                                  {mediaDetails.credits.cast.slice(0, 6).map((actor) => (
                                    <span
                                      key={actor.id}
                                      className="px-3 py-1.5 bg-gradient-to-r from-purple-600/20 to-purple-500/20 text-purple-300 text-sm font-medium rounded-full border border-purple-500/30 hover:from-purple-600/30 hover:to-purple-500/30 transition-all duration-200"
                                    >
                                      {actor.name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div className="flex">
                              <span className="w-32 text-white/60 font-medium">Release</span>
                              <span className="text-white">{formatDate(mediaDetails?.release_date || '')}</span>
                            </div>
                            {mediaDetails?.production_countries && mediaDetails.production_countries.length > 0 && (
                              <div className="flex">
                                <span className="w-32 text-white/60 font-medium">Country</span>
                                <span className="text-white">{mediaDetails.production_countries[0].name}</span>
                              </div>
                            )}
                            {mediaDetails?.spoken_languages && mediaDetails.spoken_languages.length > 0 && (
                              <div className="flex">
                                <span className="w-32 text-white/60 font-medium">Language</span>
                                <span className="text-white">{mediaDetails.spoken_languages[0].name}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Box Office & Financial Information */}
                      {mediaDetails?.media_type === 'movie' && ((mediaDetails?.budget || 0) > 0 || (mediaDetails?.revenue || 0) > 0) && (
                        <div className="mt-8">
                          <div className="flex items-center gap-2 mb-4">
                            <Award className="w-5 h-5 text-green-500" />
                            <h3 className="text-lg font-semibold text-white">Box Office & Financial</h3>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {(mediaDetails?.budget || 0) > 0 && (
                              <div className="bg-gradient-to-r from-blue-500/10 to-blue-600/10 p-4 rounded-lg border border-blue-500/20">
                                <div className="text-blue-400 text-sm font-medium mb-1">Budget</div>
                                <div className="text-white text-xl font-bold">
                                  {formatCurrency(mediaDetails.budget!)}
                                </div>
                              </div>
                            )}
                            {(mediaDetails?.revenue || 0) > 0 && (
                              <div className="bg-gradient-to-r from-green-500/10 to-green-600/10 p-4 rounded-lg border border-green-500/20">
                                <div className="text-green-400 text-sm font-medium mb-1">Revenue</div>
                                <div className="text-white text-xl font-bold">
                                  {formatCurrency(mediaDetails.revenue!)}
                                </div>
                              </div>
                            )}
                            {(mediaDetails?.budget || 0) > 0 && (mediaDetails?.revenue || 0) > 0 && (
                              <div className="bg-gradient-to-r from-yellow-500/10 to-yellow-600/10 p-4 rounded-lg border border-yellow-500/20">
                                <div className="text-yellow-400 text-sm font-medium mb-1">Profit</div>
                                <div className="text-white text-xl font-bold">
                                  {formatCurrency(mediaDetails.revenue! - mediaDetails.budget!)}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      {/* Cast Section - Enhanced Design */}
                      {mediaDetails?.credits?.cast && mediaDetails.credits.cast.length > 0 && (
                        <div className="mt-8">
                          <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2">
                              <Users className="w-5 h-5 text-red-500" />
                              <h3 className="text-lg font-semibold text-white">Cast</h3>
                            </div>
                            {(mediaDetails?.credits?.cast?.length || 0) > 6 && (
                              <button
                                onClick={() => setShowFullCast(!showFullCast)}
                                className="px-3 py-1 bg-red-600/20 border border-red-500/50 rounded-lg hover:bg-red-600/30 transition-colors text-sm"
                              >
                                {showFullCast ? 'Show Less' : `Show All ${mediaDetails.credits.cast.length}`}
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                            {mainCast.map((actor) => (
                              <motion.div
                                key={actor.id}
                                className="group bg-gray-800/50 rounded-xl overflow-hidden hover:bg-gray-700/50 transition-all duration-300 hover:scale-105"
                                whileHover={{ y: -5 }}
                              >
                                <div className="aspect-[3/4] relative overflow-hidden">
                                  <ProfileImage
                                    profilePath={actor.profile_path}
                                    alt={actor.name}
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                    size="w300"
                                  />
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                </div>
                                <div className="p-3">
                                  <h4 className="font-semibold text-white mb-1 group-hover:text-red-400 transition-colors text-sm">
                                    {actor.name}
                                  </h4>
                                  <p className="text-xs text-gray-400 line-clamp-2">
                                    {actor.character}
                                  </p>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Right side - Movie Poster */}
                  <div className="lg:w-64 flex-shrink-0">
                    <div className="sticky top-8">
                      <div className="relative w-full h-80 lg:h-96 rounded-xl overflow-hidden shadow-2xl border border-white/10">
                        <img
                          src={getPosterUrl(mediaDetails?.poster_path || '', 'w500')}
                          alt={mediaDetails?.title || ''}
                          className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                          loading="eager"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQ1MCIgdmlld0JveD0iMCAwIDMwMCA0NTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iNDUwIiBmaWxsPSIjMzc0MTUxIi8+CjxwYXRoIGQ9Ik0xNTAgMjAwQzE4Ny4yNzkgMjAwIDIxOCAxNjkuMjc5IDIxOCAxMzJDMjE4IDk0LjcyMDggMTg3LjI3OSA2NCAxNTAgNjRDMTEyLjcyMSA2NCA4MiA5NC43MjA4IDgyIDEzMkM4MiAxNjkuMjc5IDExMi43MjEgMjAwIDE1MCAyMDBaIiBmaWxsPSIjNkI3Mjg4Ii8+CjxwYXRoIGQ9Ik04MiAyNzZDODIgMjM4LjY4IDExMi42OCAyMDggMTUwIDIwOEgxNTBDMTg3LjMyIDIwOCAyMTggMjM4LjY4IDIxOCAyNzZWMzUwSDgyVjI3NloiIGZpbGw9IiM2QjcyODgiLz4KPHN2Zz4K';
                          }}
                        />
                        {/* Overlay with movie info */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300">
                          <div className="absolute bottom-0 left-0 right-0 p-4">
                            <h3 className="text-white font-bold text-sm mb-1">{mediaDetails?.title}</h3>
                            <p className="text-white/80 text-xs mb-1">{new Date(mediaDetails?.release_date || '').getFullYear()}</p>
                            {(mediaDetails?.vote_average || 0) > 0 && (
                              <div className="flex items-center gap-1">
                                <Star className="w-3 h-3 text-yellow-400 fill-current" />
                                <span className="text-white text-xs font-medium">{mediaDetails.vote_average.toFixed(1)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Related Movies Section */}
      <div className="bg-black py-16">
        <div className="px-8">
          <RelatedMedia
            mediaId={parseInt(movieId)}
            mediaType={mediaDetails?.media_type || 'movie'}
            releaseYear={mediaDetails?.release_date ? new Date(mediaDetails.release_date).getFullYear() : undefined}
            className="mb-8"
          />

          <MovieImages
            movieId={parseInt(movieId)}
            mediaType={mediaDetails?.media_type}
            className="mb-8"
          />

          <TMDBMovieList
            endpoint="popular"
            title="Popular Movies"
            maxItems={20}
            asCarousel={true}
            className="mb-8"
          />
          <UpcomingMovies
            showSection="trending_daily"
            maxItems={12}
            title="More Movies You Might Like"
            className="mb-8"
          />
          <UpcomingMovies
            showSection="now_playing"
            maxItems={12}
            title="Now Playing in Theaters"
            className="mb-8"
          />
          <UpcomingTVSeries
            showSection="airing_today"
            maxItems={12}
            title="TV Shows Airing Today"
            className="mb-8"
          />
          <UpcomingTVSeries
            showSection="trending_daily"
            maxItems={12}
            title="Trending TV Shows"
          />
        </div>
      </div>
    </div>
  );
};

export default TMDBMoviePage;