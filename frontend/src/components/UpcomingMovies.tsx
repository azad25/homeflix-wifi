"use client";

import React, { useState, useEffect } from "react";
import { Star, Calendar, TrendingUp, Clock } from "lucide-react";
import { useRouter } from 'next/navigation';
import { getApiUrl } from '@/lib/api';

interface TMDBMovie {
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
  adult: boolean;
  video: boolean;
  original_language: string;
}

interface UpcomingMoviesData {
  trending_daily: TMDBMovie[];
  trending_weekly: TMDBMovie[];
  now_playing: TMDBMovie[];
  upcoming: TMDBMovie[];
  cached_at: string;
}

interface UpcomingMoviesProps {
  className?: string;
  showSection?: 'trending_daily' | 'trending_weekly' | 'now_playing' | 'upcoming' | 'all';
  maxItems?: number;
  title?: string;
}

const UpcomingMovies: React.FC<UpcomingMoviesProps> = ({ 
  className = "", 
  showSection = 'all',
  maxItems = 20,
  title
}) => {
  const router = useRouter();
  const [upcomingData, setUpcomingData] = useState<UpcomingMoviesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUpcomingMovies();
  }, []);

  const fetchUpcomingMovies = async () => {
    try {
      setLoading(true);
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/upcoming-movies`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setUpcomingData(data);
      setError(null);
    } catch (err) {
      console.error("Error fetching upcoming movies:", err);
      setError("Failed to load upcoming movies");
    } finally {
      setLoading(false);
    }
  };

  const getPosterUrl = (posterPath: string, size: string = 'w500') => {
    if (!posterPath) return '/placeholder-poster.jpg';
    return `https://image.tmdb.org/t/p/${size}${posterPath}`;
  };

  const formatRating = (rating: number) => {
    return rating ? rating.toFixed(1) : 'N/A';
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'TBA';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const truncateText = (text: string, maxLength: number = 150) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  };

  const handleMovieClick = (movie: TMDBMovie) => {
    router.push(`/tmdb-movie/${movie.id}`);
  };

  const getMoviesToShow = (): { movies: TMDBMovie[], sectionTitle: string, icon: React.ReactNode } => {
    if (!upcomingData) return { movies: [], sectionTitle: '', icon: null };

    switch (showSection) {
      case 'trending_daily':
        return {
          movies: upcomingData.trending_daily.slice(0, maxItems),
          sectionTitle: title || 'Trending Today',
          icon: <TrendingUp className="w-5 h-5" />
        };
      case 'trending_weekly':
        return {
          movies: upcomingData.trending_weekly.slice(0, maxItems),
          sectionTitle: title || 'Trending This Week',
          icon: <TrendingUp className="w-5 h-5" />
        };
      case 'now_playing':
        return {
          movies: upcomingData.now_playing.slice(0, maxItems),
          sectionTitle: title || 'Now Playing in Theaters',
          icon: <Clock className="w-5 h-5" />
        };
      case 'upcoming':
        return {
          movies: upcomingData.upcoming.slice(0, maxItems),
          sectionTitle: title || 'Coming Soon',
          icon: <Calendar className="w-5 h-5" />
        };
      default:
        // Show all sections
        const allMovies = [
          ...upcomingData.trending_daily.slice(0, 5),
          ...upcomingData.now_playing.slice(0, 5),
          ...upcomingData.upcoming.slice(0, 5),
          ...upcomingData.trending_weekly.slice(0, 5)
        ].slice(0, maxItems);
        return {
          movies: allMovies,
          sectionTitle: title || 'What\'s Hot in Cinema',
          icon: <Star className="w-5 h-5" />
        };
    }
  };

  if (loading) {
    return (
      <div className={`py-8 ${className}`}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-5 h-5 bg-gray-600 rounded animate-pulse"></div>
          <div className="w-48 h-6 bg-gray-600 rounded animate-pulse"></div>
        </div>
        <div className="flex gap-4 overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex-shrink-0 w-48">
              <div className="w-full h-72 bg-gray-700 rounded-lg animate-pulse mb-3"></div>
              <div className="w-3/4 h-4 bg-gray-600 rounded animate-pulse mb-2"></div>
              <div className="w-1/2 h-3 bg-gray-600 rounded animate-pulse"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`py-8 ${className}`}>
        <div className="text-center text-gray-400">
          <p>{error}</p>
          <button 
            onClick={fetchUpcomingMovies}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { movies, sectionTitle, icon } = getMoviesToShow();

  if (movies.length === 0) {
    return null;
  }

  return (
    <div className={`py-8 ${className}`}>
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="text-red-500">
          {icon}
        </div>
        <h2 className="text-2xl font-bold text-white">
          {sectionTitle}
        </h2>
        <div className="text-sm text-gray-400 ml-auto">
          From TMDB
        </div>
      </div>

      {/* Movies Carousel */}
      <div className="relative">
        <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-4" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {movies.map((movie) => (
            <div
              key={movie.id}
              className="flex-shrink-0 w-48 group cursor-pointer"
              onClick={() => handleMovieClick(movie)}
            >
              {/* Poster */}
              <div className="relative mb-3 overflow-hidden rounded-lg bg-gray-800">
                <img
                  src={getPosterUrl(movie.poster_path)}
                  alt={movie.title}
                  className="w-full h-72 object-cover transition-transform duration-300 group-hover:scale-105"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = '/placeholder-poster.jpg';
                  }}
                />
                
                {/* Rating Badge */}
                {movie.vote_average > 0 && (
                  <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1">
                    <Star className="w-3 h-3 text-yellow-400 fill-current" />
                    <span className="text-xs text-white font-medium">
                      {formatRating(movie.vote_average)}
                    </span>
                  </div>
                )}

                {/* Hover Overlay with Description */}
                <div className="absolute inset-0 bg-black/90 opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-4 flex flex-col justify-end">
                  <div className="text-white">
                    <h3 className="font-semibold text-sm mb-2 line-clamp-2">
                      {movie.title}
                    </h3>
                    <p className="text-xs text-gray-300 mb-3 line-clamp-4">
                      {truncateText(movie.overview, 120)}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Calendar className="w-3 h-3" />
                      <span>{formatDate(movie.release_date)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Movie Info */}
              <div className="px-1">
                <h3 className="text-white font-medium text-sm mb-1 line-clamp-2 group-hover:text-red-400 transition-colors">
                  {movie.title}
                </h3>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>{formatDate(movie.release_date)}</span>
                  {movie.vote_average > 0 && (
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-yellow-400 fill-current" />
                      <span>{formatRating(movie.vote_average)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Custom scrollbar styles */}
      <style jsx>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .line-clamp-4 {
          display: -webkit-box;
          -webkit-line-clamp: 4;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
};

export default UpcomingMovies;