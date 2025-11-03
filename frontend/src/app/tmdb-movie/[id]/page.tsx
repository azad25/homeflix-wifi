"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Play, Pause, Volume2, VolumeX, Star, Calendar, Clock, Users } from 'lucide-react';
import { getApiUrl } from '@/lib/api';
import Navbar from '@/components/Navbar';
import RedLoader from '@/components/RedLoader';

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

const TMDBMoviePage: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const videoRef = useRef<HTMLIFrameElement>(null);
  
  const [movieDetails, setMovieDetails] = useState<TMDBMovieDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);

  const movieId = params.id as string;

  useEffect(() => {
    if (movieId) {
      fetchMovieDetails();
    }
  }, [movieId]);

  const fetchMovieDetails = async () => {
    try {
      setLoading(true);
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/tmdb-movie/${movieId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setMovieDetails(data);
      
      // Find the best trailer
      const trailer = findBestTrailer(data.videos?.results || []);
      setTrailerKey(trailer?.key || null);
      
      setError(null);
    } catch (err) {
      console.error("Error fetching movie details:", err);
      setError("Failed to load movie details");
    } finally {
      setLoading(false);
    }
  };

  const findBestTrailer = (videos: any[]) => {
    // Priority: Official trailers > Trailers > Teasers > Clips
    const trailers = videos.filter(v => v.site === 'YouTube');
    
    // First try official trailers
    let trailer = trailers.find(v => v.official && v.type === 'Trailer');
    if (trailer) return trailer;
    
    // Then any trailer
    trailer = trailers.find(v => v.type === 'Trailer');
    if (trailer) return trailer;
    
    // Then teaser
    trailer = trailers.find(v => v.type === 'Teaser');
    if (trailer) return trailer;
    
    // Finally any video
    return trailers[0] || null;
  };

  const getPosterUrl = (posterPath: string, size: string = 'w500') => {
    if (!posterPath) return '/placeholder-poster.jpg';
    return `https://image.tmdb.org/t/p/${size}${posterPath}`;
  };

  const getBackdropUrl = (backdropPath: string, size: string = 'w1280') => {
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
    if (videoRef.current) {
      const iframe = videoRef.current;
      if (isPlaying) {
        // Pause video by sending postMessage to YouTube iframe
        iframe.contentWindow?.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
      } else {
        // Play video
        iframe.contentWindow?.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const iframe = videoRef.current;
      if (isMuted) {
        iframe.contentWindow?.postMessage('{"event":"command","func":"unMute","args":""}', '*');
      } else {
        iframe.contentWindow?.postMessage('{"event":"command","func":"mute","args":""}', '*');
      }
      setIsMuted(!isMuted);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <RedLoader size="large" />
      </div>
    );
  }

  if (error || !movieDetails) {
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

  const directors = movieDetails.credits?.crew?.filter(person => person.job === 'Director') || [];
  const writers = movieDetails.credits?.crew?.filter(person => 
    person.job === 'Writer' || person.job === 'Screenplay' || person.job === 'Story'
  ) || [];

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      
      {/* Hero Section with Trailer */}
      <div className="relative h-screen overflow-hidden">
        {/* Background Image Fallback */}
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${getBackdropUrl(movieDetails.backdrop_path, 'w1920')})`,
          }}
        >
          <div className="absolute inset-0 bg-black/40" />
        </div>

        {/* Trailer Video */}
        {trailerKey && (
          <div className="absolute inset-0">
            <iframe
              ref={videoRef}
              src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=0&controls=0&showinfo=0&rel=0&iv_load_policy=3&modestbranding=1&enablejsapi=1&origin=${window.location.origin}`}
              className="w-full h-full object-cover"
              allow="autoplay; encrypted-media"
              allowFullScreen
              style={{ pointerEvents: 'none' }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
          </div>
        )}

        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="absolute top-24 left-8 z-50 flex items-center gap-2 px-4 py-2 bg-black/50 backdrop-blur-sm rounded-full text-white hover:bg-black/70 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>

        {/* Video Controls */}
        {trailerKey && (
          <div className="absolute top-24 right-8 z-50 flex gap-2">
            <button
              onClick={togglePlayPause}
              className="p-3 bg-black/50 backdrop-blur-sm rounded-full text-white hover:bg-black/70 transition-colors"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            <button
              onClick={toggleMute}
              className="p-3 bg-black/50 backdrop-blur-sm rounded-full text-white hover:bg-black/70 transition-colors"
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
          </div>
        )}

        {/* Movie Info Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black via-black/80 to-transparent">
          <div className="max-w-4xl">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h1 className="text-5xl md:text-6xl font-bold mb-4">
                {movieDetails.title}
              </h1>
              
              {movieDetails.tagline && (
                <p className="text-xl text-gray-300 mb-4 italic">
                  "{movieDetails.tagline}"
                </p>
              )}

              <div className="flex flex-wrap items-center gap-6 mb-6 text-lg">
                <div className="flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-400 fill-current" />
                  <span>{movieDetails.vote_average.toFixed(1)}</span>
                  <span className="text-gray-400">({movieDetails.vote_count.toLocaleString()} votes)</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-400" />
                  <span>{new Date(movieDetails.release_date).getFullYear()}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-green-400" />
                  <span>{formatRuntime(movieDetails.runtime)}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-6">
                {movieDetails.genres?.map((genre) => (
                  <span
                    key={genre.id}
                    className="px-3 py-1 bg-red-600/20 border border-red-600/30 rounded-full text-sm"
                  >
                    {genre.name}
                  </span>
                ))}
              </div>

              <p className="text-lg text-gray-300 max-w-3xl leading-relaxed">
                {movieDetails.overview}
              </p>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Detailed Information */}
      <div className="px-8 py-12 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Poster and Basic Info */}
          <div className="lg:col-span-1">
            <div className="sticky top-8">
              <img
                src={getPosterUrl(movieDetails.poster_path, 'w500')}
                alt={movieDetails.title}
                className="w-full rounded-lg shadow-2xl mb-6"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = '/placeholder-poster.jpg';
                }}
              />
              
              <div className="space-y-4 text-sm">
                <div>
                  <h3 className="font-semibold text-gray-300 mb-1">Status</h3>
                  <p>{movieDetails.status}</p>
                </div>
                
                <div>
                  <h3 className="font-semibold text-gray-300 mb-1">Release Date</h3>
                  <p>{formatDate(movieDetails.release_date)}</p>
                </div>
                
                <div>
                  <h3 className="font-semibold text-gray-300 mb-1">Runtime</h3>
                  <p>{formatRuntime(movieDetails.runtime)}</p>
                </div>
                
                {movieDetails.budget > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-300 mb-1">Budget</h3>
                    <p>{formatCurrency(movieDetails.budget)}</p>
                  </div>
                )}
                
                {movieDetails.revenue > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-300 mb-1">Revenue</h3>
                    <p>{formatCurrency(movieDetails.revenue)}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Cast and Crew */}
          <div className="lg:col-span-2 space-y-8">
            {/* Directors */}
            {directors.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <Users className="w-6 h-6 text-red-500" />
                  Director{directors.length > 1 ? 's' : ''}
                </h2>
                <div className="flex flex-wrap gap-4">
                  {directors.map((director) => (
                    <div key={director.id} className="flex items-center gap-3 bg-gray-800/50 rounded-lg p-3">
                      <img
                        src={getProfileUrl(director.profile_path)}
                        alt={director.name}
                        className="w-12 h-12 rounded-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = '/placeholder-avatar.jpg';
                        }}
                      />
                      <div>
                        <p className="font-semibold">{director.name}</p>
                        <p className="text-sm text-gray-400">{director.job}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Writers */}
            {writers.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold mb-4">Writers</h2>
                <div className="flex flex-wrap gap-4">
                  {writers.slice(0, 6).map((writer) => (
                    <div key={`${writer.id}-${writer.job}`} className="flex items-center gap-3 bg-gray-800/50 rounded-lg p-3">
                      <img
                        src={getProfileUrl(writer.profile_path)}
                        alt={writer.name}
                        className="w-12 h-12 rounded-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = '/placeholder-avatar.jpg';
                        }}
                      />
                      <div>
                        <p className="font-semibold">{writer.name}</p>
                        <p className="text-sm text-gray-400">{writer.job}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cast */}
            {movieDetails.credits?.cast && movieDetails.credits.cast.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold mb-4">Cast</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {movieDetails.credits.cast.slice(0, 12).map((actor) => (
                    <div key={actor.id} className="bg-gray-800/50 rounded-lg p-4 text-center">
                      <img
                        src={getProfileUrl(actor.profile_path)}
                        alt={actor.name}
                        className="w-20 h-20 rounded-full object-cover mx-auto mb-3"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = '/placeholder-avatar.jpg';
                        }}
                      />
                      <p className="font-semibold text-sm mb-1">{actor.name}</p>
                      <p className="text-xs text-gray-400">{actor.character}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TMDBMoviePage;