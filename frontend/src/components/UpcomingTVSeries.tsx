"use client";

import React, { useState, useEffect, useRef } from "react";
import { Star, Calendar, TrendingUp, Clock, Tv, ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from 'next/navigation';
import { getApiUrl } from '@/lib/api';

interface TMDBTVSeries {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  first_air_date: string;
  poster_path: string;
  backdrop_path: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  adult: boolean;
  original_language: string;
}

interface UpcomingTVSeriesData {
  airing_today: TMDBTVSeries[];
  on_the_air: TMDBTVSeries[];
  trending_daily: TMDBTVSeries[];
  trending_weekly: TMDBTVSeries[];
  cached_at: string;
}

interface UpcomingTVSeriesProps {
  className?: string;
  showSection?: 'airing_today' | 'on_the_air' | 'trending_daily' | 'trending_weekly' | 'all';
  maxItems?: number;
  title?: string;
}

const UpcomingTVSeries: React.FC<UpcomingTVSeriesProps> = ({ 
  className = "", 
  showSection = 'all',
  maxItems = 20,
  title
}) => {
  const router = useRouter();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [tvSeriesData, setTVSeriesData] = useState<UpcomingTVSeriesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    fetchTVSeries();
  }, []);

  const fetchTVSeries = async () => {
    try {
      setLoading(true);
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/upcoming-tv-series`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setTVSeriesData(data);
      setError(null);
    } catch (err) {
      console.error("Error fetching TV series:", err);
      setError("Failed to load TV series");
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

  const handleTVSeriesClick = (series: TMDBTVSeries) => {
    router.push(`/tmdb-movie/${series.id}?type=tv`);
  };

  const updateScrollButtons = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
    }
  };

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      const scrollAmount = 200;
      scrollContainerRef.current.scrollBy({
        left: -scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      const scrollAmount = 200;
      scrollContainerRef.current.scrollBy({
        left: scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      updateScrollButtons();
      container.addEventListener('scroll', updateScrollButtons);
      return () => container.removeEventListener('scroll', updateScrollButtons);
    }
  }, [tvSeriesData]);

  const getTVSeriesToShow = (): { series: TMDBTVSeries[], sectionTitle: string, icon: React.ReactNode } => {
    if (!tvSeriesData) return { series: [], sectionTitle: '', icon: null };

    switch (showSection) {
      case 'airing_today':
        return {
          series: tvSeriesData.airing_today.slice(0, maxItems),
          sectionTitle: title || 'Airing Today',
          icon: <Tv className="w-5 h-5" />
        };
      case 'on_the_air':
        return {
          series: tvSeriesData.on_the_air.slice(0, maxItems),
          sectionTitle: title || 'On the Air This Week',
          icon: <Clock className="w-5 h-5" />
        };
      case 'trending_daily':
        return {
          series: tvSeriesData.trending_daily.slice(0, maxItems),
          sectionTitle: title || 'Trending TV Shows Today',
          icon: <TrendingUp className="w-5 h-5" />
        };
      case 'trending_weekly':
        return {
          series: tvSeriesData.trending_weekly.slice(0, maxItems),
          sectionTitle: title || 'Trending TV Shows This Week',
          icon: <TrendingUp className="w-5 h-5" />
        };
      default:
        // Show all sections
        const allSeries = [
          ...tvSeriesData.airing_today.slice(0, 5),
          ...tvSeriesData.on_the_air.slice(0, 5),
          ...tvSeriesData.trending_daily.slice(0, 5),
          ...tvSeriesData.trending_weekly.slice(0, 5)
        ].slice(0, maxItems);
        return {
          series: allSeries,
          sectionTitle: title || 'What\'s Hot on TV',
          icon: <Tv className="w-5 h-5" />
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
            onClick={fetchTVSeries}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { series, sectionTitle, icon } = getTVSeriesToShow();

  if (series.length === 0) {
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

      {/* TV Series Carousel */}
      <div className="relative group">
        {/* Left Arrow */}
        {canScrollLeft && (
          <button
            onClick={scrollLeft}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-black/70 hover:bg-black/90 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        {/* Right Arrow */}
        {canScrollRight && (
          <button
            onClick={scrollRight}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-black/70 hover:bg-black/90 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        <div 
          ref={scrollContainerRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide pb-4" 
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {series.map((show) => (
            <div
              key={show.id}
              className="flex-shrink-0 w-48 group/card cursor-pointer"
              onClick={() => handleTVSeriesClick(show)}
            >
              {/* Poster */}
              <div className="relative mb-3 overflow-hidden rounded-lg bg-gray-800">
                <img
                  src={getPosterUrl(show.poster_path)}
                  alt={show.name}
                  className="w-full h-72 object-cover transition-transform duration-300 group-hover/card:scale-105"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = '/placeholder-poster.jpg';
                  }}
                />
                
                {/* Rating Badge */}
                {show.vote_average > 0 && (
                  <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1">
                    <Star className="w-3 h-3 text-yellow-400 fill-current" />
                    <span className="text-xs text-white font-medium">
                      {formatRating(show.vote_average)}
                    </span>
                  </div>
                )}

                {/* Hover Overlay with Description */}
                <div className="absolute inset-0 bg-black/90 opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 p-4 flex flex-col justify-end">
                  <div className="text-white">
                    <h3 className="font-semibold text-sm mb-2 line-clamp-2">
                      {show.name}
                    </h3>
                    <p className="text-xs text-gray-300 mb-3 line-clamp-4">
                      {truncateText(show.overview, 120)}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Calendar className="w-3 h-3" />
                      <span>{formatDate(show.first_air_date)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* TV Series Info */}
              <div className="px-1">
                <h3 className="text-white font-medium text-sm mb-1 line-clamp-2 group-hover/card:text-red-400 transition-colors">
                  {show.name}
                </h3>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>{formatDate(show.first_air_date)}</span>
                  {show.vote_average > 0 && (
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-yellow-400 fill-current" />
                      <span>{formatRating(show.vote_average)}</span>
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

export default UpcomingTVSeries;
