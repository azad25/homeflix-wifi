"use client";

import React, { useState, useEffect } from "react";
import { Play, Info, Film } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Navbar from "@/components/Navbar";
import { Media } from '../../types/media';
import VideoPlayer from "@/components/VideoPlayer";
import { getApiUrl } from '@/lib/api';
import { useGlobalCache, useRecommendations } from '@/hooks/useGlobalCache';
import { fetchMedia } from '@/lib/globalApiCache';
import { ScrollXHero, NetflixHorizontalRow, ParallaxSection, GradientBackground, ScrollReveal } from '@/components/scrollx';
import RecentlyWatched from '@/components/RecentlyWatched';

export default function MoviesPage() {
  const router = useRouter();
  const [featuredMovies, setFeaturedMovies] = useState<Media[]>([]);
  const [actionMovies, setActionMovies] = useState<Media[]>([]);
  const [comedyMovies, setComedyMovies] = useState<Media[]>([]);
  const [dramaMovies, setDramaMovies] = useState<Media[]>([]);
  const [horrorMovies, setHorrorMovies] = useState<Media[]>([]);
  const [sciFiMovies, setSciFiMovies] = useState<Media[]>([]);
  const [recentMovies, setRecentMovies] = useState<Media[]>([]);
  const [popularMovies, setPopularMovies] = useState<Media[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  
  // Use global cache for movies data
  const { data: allMediaData, loading } = useGlobalCache<Media[]>(
    `${getApiUrl()}/api/media`,
    {},
    { customTTL: 10 * 60 * 1000 } // 10 minutes cache
  );
  
  // Use global cache for movie recommendations
  const { data: movieRecommendations } = useRecommendations('movies', 20);

  useEffect(() => {
    // Process cached data when available
    if (allMediaData && allMediaData.length > 0) {
      const movies = allMediaData.filter((item: Media) => item.type === "movie");
      processMoviesData(movies);
    }
    
    if (movieRecommendations && movieRecommendations.length > 0) {
      setFeaturedMovies(movieRecommendations.slice(0, 8));
    }
  }, [allMediaData, movieRecommendations]);


  const processMoviesData = (movies: Media[]) => {
    // Categorize movies by genre
    const actionMovies = movies.filter((movie: Media) => 
      movie.genres && movie.genres.some(genre => 
        (typeof genre === 'string' ? genre : genre.name).toLowerCase().includes('action')
      )
    ).slice(0, 20);
    
    const comedyMovies = movies.filter((movie: Media) => 
      movie.genres && movie.genres.some(genre => 
        (typeof genre === 'string' ? genre : genre.name).toLowerCase().includes('comedy')
      )
    ).slice(0, 20);
    
    const dramaMovies = movies.filter((movie: Media) => 
      movie.genres && movie.genres.some(genre => 
        (typeof genre === 'string' ? genre : genre.name).toLowerCase().includes('drama')
      )
    ).slice(0, 20);
    
    const horrorMovies = movies.filter((movie: Media) => 
      movie.genres && movie.genres.some(genre => {
        const genreName = (typeof genre === 'string' ? genre : genre.name).toLowerCase();
        return genreName.includes('horror') || genreName.includes('thriller');
      })
    ).slice(0, 20);
    
    const sciFiMovies = movies.filter((movie: Media) => 
      movie.genres && movie.genres.some(genre => {
        const genreName = (typeof genre === 'string' ? genre : genre.name).toLowerCase();
        return genreName.includes('sci-fi') || genreName.includes('science fiction') || genreName.includes('fantasy');
      })
    ).slice(0, 20);
    
    // Get recent movies (sorted by year)
    const recentMovies = movies
      .filter((movie: Media) => movie.year && movie.year >= 2020)
      .sort((a: Media, b: Media) => (b.year || 0) - (a.year || 0))
      .slice(0, 20);
    
    // Get popular movies (sorted by rating)
    const popularMovies = movies
      .filter((movie: Media) => movie.rating && movie.rating > 7.0)
      .sort((a: Media, b: Media) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 20);
    
    setActionMovies(actionMovies);
    setComedyMovies(comedyMovies);
    setDramaMovies(dramaMovies);
    setHorrorMovies(horrorMovies);
    setSciFiMovies(sciFiMovies);
    setRecentMovies(recentMovies);
    setPopularMovies(popularMovies);
  };

  const handlePlay = (media: Media, startTime?: number) => {
    setSelectedMedia(media);
    setIsPlayerOpen(true);
  };

  const handleInfo = (media: Media) => {
    router.push(`/movie/${media.id}`);
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const parallaxCards = [
    {
      id: 1,
      title: "Blockbuster Collection",
      description: "Experience the biggest hits and most acclaimed films",
      icon: <Film />,
      variant: "default" as const,
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    },
    {
      id: 2,
      title: "Award Winners",
      description: "Critically acclaimed movies that defined cinema",
      icon: <Play />,
      variant: "outline" as const,
      background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    },
    {
      id: 3,
      title: "Hidden Gems",
      description: "Discover underrated masterpieces in your collection",
      icon: <Info />,
      variant: "secondary" as const,
      background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading Movies...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar onSearch={() => {}} />

      {/* Hero Section */}
      {featuredMovies.length > 0 && (
        <ScrollXHero
          featuredMedia={featuredMovies}
          onPlay={handlePlay}
          onInfo={handleInfo}
          enableRecommendations={true}
          refreshInterval={300000}
        />
      )}

      {/* Main Content with Parallax Background */}
      <div className="relative bg-gradient-to-b from-red-900/20 via-black to-black">
        <div className="relative z-10 py-20">
          {/* Recently Watched Movies */}
          <ParallaxSection speed={0.3}>
            <ScrollReveal direction="up" delay={0.2}>
              <RecentlyWatched
                onPlay={handlePlay}
                onInfo={handleInfo}
              />
            </ScrollReveal>
          </ParallaxSection>

          {/* Popular Movies */}
          <ParallaxSection speed={0.4}>
            <ScrollReveal direction="up" delay={0.4}>
              <NetflixHorizontalRow
                title="Popular Movies"
                media={popularMovies}
                onPlay={handlePlay}
                onInfo={handleInfo}
                variant="portrait"
                size="medium"
              />
            </ScrollReveal>
          </ParallaxSection>

          {/* Recent Movies */}
          <ParallaxSection speed={0.5}>
            <ScrollReveal direction="up" delay={0.6}>
              <NetflixHorizontalRow
                title="Recently Added"
                media={recentMovies}
                onPlay={handlePlay}
                onInfo={handleInfo}
                variant="portrait"
                size="medium"
              />
            </ScrollReveal>
          </ParallaxSection>

          {/* Action Movies */}
          {actionMovies.length > 0 && (
            <ParallaxSection speed={0.6}>
              <ScrollReveal direction="up" delay={0.8}>
                <NetflixHorizontalRow
                  title="Action & Adventure"
                  media={actionMovies}
                  onPlay={handlePlay}
                  onInfo={handleInfo}
                  variant="portrait"
                  size="medium"
                />
              </ScrollReveal>
            </ParallaxSection>
          )}

          {/* Comedy Movies */}
          {comedyMovies.length > 0 && (
            <ParallaxSection speed={0.7}>
              <ScrollReveal direction="up" delay={1.0}>
                <NetflixHorizontalRow
                  title="Comedy Movies"
                  media={comedyMovies}
                  onPlay={handlePlay}
                  onInfo={handleInfo}
                  variant="portrait"
                  size="medium"
                />
              </ScrollReveal>
            </ParallaxSection>
          )}

          {/* Drama Movies */}
          {dramaMovies.length > 0 && (
            <ParallaxSection speed={0.8}>
              <ScrollReveal direction="up" delay={1.2}>
                <NetflixHorizontalRow
                  title="Drama Movies"
                  media={dramaMovies}
                  onPlay={handlePlay}
                  onInfo={handleInfo}
                  variant="portrait"
                  size="medium"
                />
              </ScrollReveal>
            </ParallaxSection>
          )}

          {/* Sci-Fi Movies */}
          {sciFiMovies.length > 0 && (
            <ParallaxSection speed={0.9}>
              <ScrollReveal direction="up" delay={1.4}>
                <NetflixHorizontalRow
                  title="Sci-Fi & Fantasy"
                  media={sciFiMovies}
                  onPlay={handlePlay}
                  onInfo={handleInfo}
                  variant="portrait"
                  size="medium"
                />
              </ScrollReveal>
            </ParallaxSection>
          )}

          {/* Horror Movies */}
          {horrorMovies.length > 0 && (
            <ParallaxSection speed={1.0}>
              <ScrollReveal direction="up" delay={1.6}>
                <NetflixHorizontalRow
                  title="Horror & Thriller"
                  media={horrorMovies}
                  onPlay={handlePlay}
                  onInfo={handleInfo}
                  variant="portrait"
                  size="medium"
                />
              </ScrollReveal>
            </ParallaxSection>
          )}
        </div>
      </div>

      {/* Video Player Modal */}
      {selectedMedia && (
        <VideoPlayer
          media={selectedMedia}
          isOpen={isPlayerOpen}
          onClose={() => setIsPlayerOpen(false)}
          startTime={0}
        />
      )}
    </div>
  );
}
