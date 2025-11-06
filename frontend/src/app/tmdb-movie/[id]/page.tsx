"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
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
  Share2} from 'lucide-react';
import { getApiUrl } from '@/lib/api';
import { addToWishlist, removeFromWishlist, isInWishlist } from '@/lib/wishlist';
import Navbar from '@/components/Navbar';
import RedLoader from '@/components/RedLoader';
import UpcomingMovies from '@/components/UpcomingMovies';

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

  const movieId = params.id as string;

  useEffect(() => {
    if (movieId) {
      fetchMovieDetails();
      checkMyList();
    }
  }, [movieId]);

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
      const mediaType = searchParams.get('type');
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
    } catch (err) {
      console.error("Error fetching media details:", err);
      setError("Failed to load media details");
    } finally {
      setLoading(false);
    }
  };

  const convertToUnifiedFormat = (response: TMDBMediaResponse): UnifiedMediaDetails => {
    const { media_type, data } = response;

    if (media_type === 'movie') {
      const movieData = data as TMDBMovieDetails;
      return {
        ...movieData,
        media_type: 'movie',
        title: movieData.title,
        original_title: movieData.original_title,
        release_date: movieData.release_date,
      };
    } else {
      const tvData = data as TMDBTVDetails;
      return {
        ...tvData,
        media_type: 'tv',
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

  const getProfileUrl = (profilePath: string, size: string = 'w185') => {
    if (!profilePath) return '/placeholder-avatar.jpg';
    return `https://image.tmdb.org/t/p/${size}${profilePath}`;
  };

  const formatRuntime = (minutes: number) => {
    if (!minutes) return 'N/A';
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
        {/* Background Backdrop Image - Always Show */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(${getBackdropUrl(mediaDetails?.backdrop_path || '', 'original')})`,
          }}
        >
          {/* Enhanced gradient overlay for better text readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-black/60" />
          <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/90 to-transparent" />
        </div>

        {/* HD Trailer Video - Only show when playing */}
        {trailerKey && isPlaying && (
          <div className="absolute inset-0">
            <iframe
              ref={videoRef}
              src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=0&controls=0&showinfo=0&rel=0&iv_load_policy=3&modestbranding=1&enablejsapi=1&loop=1&playlist=${trailerKey}&origin=${typeof window !== 'undefined' ? window.location.origin : ''}&vq=hd1080&hd=1&quality=hd1080`}
              className="w-full h-full"
              allow="autoplay; encrypted-media"
              allowFullScreen
              style={{
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





        {/* Navigation and Controls */}
        <AnimatePresence>
          {showControls && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 pointer-events-none"
            >
              {/* Back Button */}
              <button
                onClick={() => router.back()}
                className="absolute top-24 left-8 z-50 flex items-center gap-2 px-4 py-2 bg-black/70 backdrop-blur-sm rounded-full text-white hover:bg-black/90 transition-all duration-300 pointer-events-auto"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back</span>
              </button>

              {/* Video Controls */}
              {trailerKey && (
                <div className="absolute top-24 right-8 z-50 flex gap-3 pointer-events-auto">
                  <button
                    onClick={togglePlayPause}
                    className="p-3 bg-black/70 backdrop-blur-sm rounded-full text-white hover:bg-black/90 transition-all duration-300 hover:scale-110"
                  >
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={toggleMute}
                    className="p-3 bg-black/70 backdrop-blur-sm rounded-full text-white hover:bg-black/90 transition-all duration-300 hover:scale-110"
                  >
                    {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Movie Info Overlay - Bottom Left (Similar to local movie page) */}
        <div className="absolute bottom-0 left-0 z-[20] p-8 pointer-events-auto w-2/3">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="flex gap-6 items-end"
          >
            {/* Movie Poster */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex-shrink-0"
            >
              <div className="relative w-48 h-72 rounded-lg overflow-hidden shadow-2xl border border-white/10">
                <img
                  src={getPosterUrl(mediaDetails?.poster_path || '', 'w500')}
                  alt={mediaDetails?.title || ''}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQ1MCIgdmlld0JveD0iMCAwIDMwMCA0NTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iNDUwIiBmaWxsPSIjMzc0MTUxIi8+CjxwYXRoIGQ9Ik0xNTAgMjAwQzE4Ny4yNzkgMjAwIDIxOCAxNjkuMjc5IDIxOCAxMzJDMjE4IDk0LjcyMDggMTg3LjI3OSA2NCAxNTAgNjRDMTEyLjcyMSA2NCA4MiA5NC43MjA4IDgyIDEzMkM4MiAxNjkuMjc5IDExMi43MjEgMjAwIDE1MCAyMDBaIiBmaWxsPSIjNkI3Mjg4Ii8+CjxwYXRoIGQ9Ik04MiAyNzZDODIgMjM4LjY4IDExMi42OCAyMDggMTUwIDIwOEgxNTBDMTg3LjMyIDIwOCAyMTggMjM4LjY4IDIxOCAyNzZWMzUwSDgyVjI3NloiIGZpbGw9IiM2QjcyODgiLz4KPHN2Zz4K';
                  }}
                />
              </div>
            </motion.div>

            {/* Movie Details */}
            <div className="flex-1 space-y-4 pb-4">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold mb-2 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                  {mediaDetails?.title}
                </h1>

                {mediaDetails?.tagline && (
                  <p className="text-lg text-red-400 mb-3 italic font-medium">
                    "{mediaDetails.tagline}"
                  </p>
                )}
              </div>

              {/* Stats Row - Compact */}
              <div className="flex flex-wrap items-center gap-3 text-sm">
                {(mediaDetails?.vote_average || 0) > 0 && (
                  <div className="flex items-center gap-1 bg-yellow-500/20 px-2 py-1 rounded-full">
                    <Star className="w-4 h-4 text-yellow-400 fill-current" />
                    <span className="font-semibold">{mediaDetails.vote_average.toFixed(1)}</span>
                  </div>
                )}

                <div className="flex items-center gap-1 bg-blue-500/20 px-2 py-1 rounded-full">
                  <Calendar className="w-4 h-4 text-blue-400" />
                  <span>{new Date(mediaDetails?.release_date || '').getFullYear()}</span>
                </div>

                {mediaDetails?.media_type === 'movie' && mediaDetails?.runtime && mediaDetails.runtime > 0 && (
                  <div className="flex items-center gap-1 bg-green-500/20 px-2 py-1 rounded-full">
                    <Clock className="w-4 h-4 text-green-400" />
                    <span>{formatRuntime(mediaDetails.runtime)}</span>
                  </div>
                )}

                {mediaDetails?.media_type === 'tv' && (
                  <div className="flex items-center gap-1 bg-purple-500/20 px-2 py-1 rounded-full">
                    <Film className="w-4 h-4 text-purple-400" />
                    <span>{mediaDetails.number_of_seasons} Season{(mediaDetails.number_of_seasons || 0) > 1 ? 's' : ''}</span>
                  </div>
                )}
              </div>

              {/* Genres - Compact */}
              <div className="flex flex-wrap gap-1">
                {mediaDetails?.genres?.slice(0, 3).map((genre) => (
                  <span
                    key={genre.id}
                    className="px-2 py-1 bg-red-600/30 border border-red-500/50 rounded-full text-xs font-medium"
                  >
                    {genre.name}
                  </span>
                ))}
              </div>

              {/* Overview - Truncated */}
              <p className="text-sm text-gray-300 leading-relaxed line-clamp-3">
                {mediaDetails?.overview || `Experience this amazing ${mediaDetails?.media_type === 'tv' ? 'TV series' : 'movie'} with stunning visuals and compelling storytelling.`}
              </p>

              {/* Action Buttons - Compact */}
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  onClick={toggleMyList}
                  className="flex items-center gap-1 px-4 py-2 bg-gray-800/80 hover:bg-gray-700 rounded-lg text-sm font-semibold transition-all duration-300 hover:scale-105"
                >
                  {isInMyList ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  My List
                </button>
                <button className="flex items-center gap-1 px-4 py-2 bg-gray-800/80 hover:bg-gray-700 rounded-lg text-sm font-semibold transition-all duration-300 hover:scale-105">
                  <Share2 className="w-4 h-4" />
                  Share
                </button>
                {mediaDetails?.homepage && (
                  <a
                    href={mediaDetails.homepage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-4 py-2 bg-gray-800/80 hover:bg-gray-700 rounded-lg text-sm font-semibold transition-all duration-300 hover:scale-105"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Official Site
                  </a>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Detailed Information Section */}
      <div className="px-8 py-16 bg-gradient-to-b from-black to-gray-900">
        <div className="max-w-7xl mx-auto space-y-16">

          {/* Cast Section - Enhanced Design */}
          {mediaDetails?.credits?.cast && mediaDetails.credits.cast.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-3xl font-bold flex items-center gap-3">
                  <Users className="w-8 h-8 text-red-500" />
                  Cast
                </h2>
                {(mediaDetails?.credits?.cast?.length || 0) > 8 && (
                  <button
                    onClick={() => setShowFullCast(!showFullCast)}
                    className="px-4 py-2 bg-red-600/20 border border-red-500/50 rounded-lg hover:bg-red-600/30 transition-colors"
                  >
                    {showFullCast ? 'Show Less' : `Show All ${mediaDetails.credits.cast.length}`}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
                {mainCast.map((actor) => (
                  <motion.div
                    key={actor.id}
                    className="group bg-gray-800/50 rounded-xl overflow-hidden hover:bg-gray-700/50 transition-all duration-300 hover:scale-105"
                    whileHover={{ y: -5 }}
                  >
                    <div className="aspect-[3/4] relative overflow-hidden">
                      <img
                        src={getProfileUrl(actor.profile_path, 'w300')}
                        alt={actor.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = '/placeholder-avatar.jpg';
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-white mb-1 group-hover:text-red-400 transition-colors">
                        {actor.name}
                      </h3>
                      <p className="text-sm text-gray-400 line-clamp-2">
                        {actor.character}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.section>
          )}

          {/* Crew Section */}
          <motion.section
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-12"
          >
            {/* Directors */}
            {directors.length > 0 && (
              <div>
                <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
                  <Film className="w-6 h-6 text-red-500" />
                  Director{directors.length > 1 ? 's' : ''}
                </h3>
                <div className="space-y-4">
                  {directors.map((director) => (
                    <div key={director.id} className="flex items-center gap-4 bg-gray-800/30 rounded-lg p-4 hover:bg-gray-700/30 transition-colors">
                      <img
                        src={getProfileUrl(director.profile_path)}
                        alt={director.name}
                        className="w-16 h-16 rounded-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = '/placeholder-avatar.jpg';
                        }}
                      />
                      <div>
                        <p className="font-semibold text-lg">{director.name}</p>
                        <p className="text-gray-400">{director.job}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Writers */}
            {writers.length > 0 && (
              <div>
                <h3 className="text-2xl font-bold mb-6">Writers</h3>
                <div className="space-y-4">
                  {writers.slice(0, 4).map((writer) => (
                    <div key={`${writer.id}-${writer.job}`} className="flex items-center gap-4 bg-gray-800/30 rounded-lg p-4 hover:bg-gray-700/30 transition-colors">
                      <img
                        src={getProfileUrl(writer.profile_path)}
                        alt={writer.name}
                        className="w-16 h-16 rounded-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = '/placeholder-avatar.jpg';
                        }}
                      />
                      <div>
                        <p className="font-semibold text-lg">{writer.name}</p>
                        <p className="text-gray-400">{writer.job}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.section>

          {/* Movie Details Grid */}
          <motion.section
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            <div className="bg-gray-800/30 rounded-xl p-6">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Calendar className="w-6 h-6 text-blue-400" />
                Release Info
              </h3>
              <div className="space-y-3">
                <div>
                  <span className="text-gray-400">Status:</span>
                  <span className="ml-2 font-semibold">{mediaDetails?.status}</span>
                </div>
                <div>
                  <span className="text-gray-400">Release Date:</span>
                  <span className="ml-2 font-semibold">{formatDate(mediaDetails?.release_date || '')}</span>
                </div>
                {mediaDetails?.media_type === 'movie' && mediaDetails?.runtime && (
                  <div>
                    <span className="text-gray-400">Runtime:</span>
                    <span className="ml-2 font-semibold">{formatRuntime(mediaDetails.runtime)}</span>
                  </div>
                )}
                {mediaDetails?.media_type === 'tv' && (
                  <>
                    <div>
                      <span className="text-gray-400">Seasons:</span>
                      <span className="ml-2 font-semibold">{mediaDetails.number_of_seasons}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Episodes:</span>
                      <span className="ml-2 font-semibold">{mediaDetails.number_of_episodes}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {mediaDetails?.media_type === 'movie' && ((mediaDetails?.budget || 0) > 0 || (mediaDetails?.revenue || 0) > 0) && (
              <div className="bg-gray-800/30 rounded-xl p-6">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <DollarSign className="w-6 h-6 text-green-400" />
                  Box Office
                </h3>
                <div className="space-y-3">
                  {(mediaDetails?.budget || 0) > 0 && (
                    <div>
                      <span className="text-gray-400">Budget:</span>
                      <span className="ml-2 font-semibold">{formatCurrency(mediaDetails.budget!)}</span>
                    </div>
                  )}
                  {(mediaDetails?.revenue || 0) > 0 && (
                    <div>
                      <span className="text-gray-400">Revenue:</span>
                      <span className="ml-2 font-semibold">{formatCurrency(mediaDetails.revenue!)}</span>
                    </div>
                  )}
                  {(mediaDetails?.budget || 0) > 0 && (mediaDetails?.revenue || 0) > 0 && (
                    <div>
                      <span className="text-gray-400">Profit:</span>
                      <span className="ml-2 font-semibold text-green-400">
                        {formatCurrency(mediaDetails.revenue! - mediaDetails.budget!)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {mediaDetails?.media_type === 'tv' && mediaDetails?.networks && mediaDetails.networks.length > 0 && (
              <div className="bg-gray-800/30 rounded-xl p-6">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Film className="w-6 h-6 text-blue-400" />
                  Networks
                </h3>
                <div className="space-y-3">
                  {mediaDetails.networks.slice(0, 3).map((network) => (
                    <div key={network.id} className="flex items-center gap-3">
                      {network.logo_path && (
                        <img
                          src={`https://image.tmdb.org/t/p/w92${network.logo_path}`}
                          alt={network.name}
                          className="h-8 object-contain"
                        />
                      )}
                      <span className="text-gray-300">{network.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-gray-800/30 rounded-xl p-6">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Globe className="w-6 h-6 text-purple-400" />
                Languages
              </h3>
              <div className="space-y-2">
                {mediaDetails?.spoken_languages?.slice(0, 3).map((lang) => (
                  <div key={lang.iso_639_1} className="text-gray-300">
                    {lang.name}
                  </div>
                ))}
              </div>
            </div>
          </motion.section>
        </div>
      </div>

      {/* Related Movies Section */}
      <div className="bg-gray-900 py-16">
        <div className="px-8">
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
          />
        </div>
      </div>
    </div>
  );
};

export default TMDBMoviePage;