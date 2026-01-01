"use client";

import React, { useState, useEffect } from "react";
import { usePageTitle } from '@/hooks/usePageTitle';
import { Play, Info, Film } from 'lucide-react';
import { useNavigate } from '@/hooks/useNavigate';
import Navbar from "@/components/Navbar";
import { Media } from '../../types/media';
import VideoPlayer from "@/components/VideoPlayer";
import RedLoader from '@/components/RedLoader';
import { getApiUrl, fetchUniqueRecommendations, preloadAssets } from '@/lib/api';
import { ScrollXHero, EnhancedHorizontalRow, ParallaxSection, GradientBackground, ScrollReveal } from '@/components/scrollx';
import RecentlyWatched from '@/components/RecentlyWatched';
import { WidgetRenderer, WidgetManagementButton } from '@/components/widgets';
import BackendWidgetRenderer from '@/components/widgets/BackendWidgetRenderer';

export default function MoviesPage() {
  usePageTitle('Movies');
  const navigate = useNavigate();
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMoviesData();
    
    // Set up auto-refresh every 5 minutes for recommendations
    const interval = setInterval(() => {
      fetchMoviesData();
    }, 5 * 60 * 1000); // 5 minutes in milliseconds
    
    return () => clearInterval(interval);
  }, []);

  const fetchMoviesData = async () => {
    try {
      const apiUrl = getApiUrl();
      
      // Fetch all movies
      const moviesResponse = await fetch(`${apiUrl}/api/media`);
      const allMedia = await moviesResponse.json();
      const movies = allMedia.filter((item: Media) => item.type === "movie");
      
      // Get unique movie recommendations for hero section
      let featuredMoviesList: Media[] = [];
      try {
        console.log('🎬 Fetching unique movie recommendations...');
        const recommendations = await fetchUniqueRecommendations('mixed', 20);
        const movieRecommendations = recommendations.filter((item: Media) => item.type === 'movie');
        
        if (movieRecommendations.length >= 5) {
          featuredMoviesList = movieRecommendations.slice(0, 8);
          console.log(`✅ Using ${featuredMoviesList.length} unique movie recommendations`);
        } else {
          // Fallback to highest rated movies
          featuredMoviesList = movies
            .sort((a: Media, b: Media) => (b.rating || 0) - (a.rating || 0))
            .slice(0, 8);
        }
      } catch (error) {
        console.warn('⚠️ Movie recommendations failed, using fallback');
        featuredMoviesList = movies
          .sort((a: Media, b: Media) => (b.rating || 0) - (a.rating || 0))
          .slice(0, 8);
      }
      
      setFeaturedMovies(featuredMoviesList);

      // Categorize movies by genre
      setActionMovies(movies.filter((m: Media) => 
        m.genres?.some(g => g.name.toLowerCase().includes('action'))
      ).slice(0, 20));
      
      setComedyMovies(movies.filter((m: Media) => 
        m.genres?.some(g => g.name.toLowerCase().includes('comedy'))
      ).slice(0, 20));
      
      setDramaMovies(movies.filter((m: Media) => 
        m.genres?.some(g => g.name.toLowerCase().includes('drama'))
      ).slice(0, 20));
      
      setHorrorMovies(movies.filter((m: Media) => 
        m.genres?.some(g => g.name.toLowerCase().includes('horror'))
      ).slice(0, 20));
      
      // Sci-Fi movies - use enhanced API
      try {
        const scifiResponse = await fetch(`${getApiUrl()}/api/recommendations/scifi?limit=20`);
        if (scifiResponse.ok) {
          const scifiMovies = await scifiResponse.json();
          setSciFiMovies(scifiMovies);
        } else {
          // Fallback to local filtering
          setSciFiMovies(movies.filter((m: Media) => 
            m.genres?.some(g => g.name.toLowerCase().includes('sci-fi') || g.name.toLowerCase().includes('science'))
          ).slice(0, 20));
        }
      } catch (error) {
        setSciFiMovies(movies.filter((m: Media) => 
          m.genres?.some(g => g.name.toLowerCase().includes('sci-fi') || g.name.toLowerCase().includes('science'))
        ).slice(0, 20));
      }

      // Recent movies - use enhanced API
      try {
        const recentResponse = await fetch(`${getApiUrl()}/api/recommendations/recent?limit=20`);
        if (recentResponse.ok) {
          const recentMovies = await recentResponse.json();
          setRecentMovies(recentMovies);
        } else {
          // Fallback to local sorting
          setRecentMovies(movies.sort((a: Media, b: Media) => b.id - a.id).slice(0, 20));
        }
      } catch (error) {
        setRecentMovies(movies.sort((a: Media, b: Media) => b.id - a.id).slice(0, 20));
      }

      // Popular movies - use enhanced API
      try {
        const popularResponse = await fetch(`${getApiUrl()}/api/recommendations/popular?limit=20`);
        if (popularResponse.ok) {
          const popularMovies = await popularResponse.json();
          setPopularMovies(popularMovies);
        } else {
          // Fallback to local sorting
          setPopularMovies(movies.sort((a: Media, b: Media) => (b.view_count ?? 0) - (a.view_count ?? 0)).slice(0, 20));
        }
      } catch (error) {
        setPopularMovies(movies.sort((a: Media, b: Media) => (b.view_count ?? 0) - (a.view_count ?? 0)).slice(0, 20));
      }
      
      // Preload assets for better performance (poster first, then thumbnail, then preview)
      const allMoviesForPreload = [
        ...featuredMoviesList,
        ...movies.slice(0, 20)
      ];
      
      if (allMoviesForPreload.length > 0) {
        preloadAssets(allMoviesForPreload, ['poster', 'thumbnail', 'preview']);
      }
      
      setLoading(false);
    } catch (error) {
      console.error("Error fetching movies:", error);
      setLoading(false);
    }
  };

  const handlePlay = (media: Media, startTime?: number) => {
    setSelectedMedia(media);
    setIsPlayerOpen(true);
  };

  const handleInfo = (media: Media) => {
    navigate.push(`/movie/${media.id}`);
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
        <RedLoader size="large" />
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
          contentFilter="movies-hd"
        />
      )}

      {/* Widget System Integration */}
      <BackendWidgetRenderer 
        page="movies" 
        className="relative z-10 py-8"
      />

      {/* Main Content with Parallax Background */}
      <div className="relative bg-gradient-to-b from-red-900/20 via-black to-black" style={{ overflow: 'visible', zIndex: 10 }}>
        <div className="relative z-10 py-8" style={{ overflow: 'visible', transformStyle: 'preserve-3d' }}>
          {/* Recently Watched Movies */}
          <div className="mb-4">
            <RecentlyWatched
              onPlay={handlePlay}
              onInfo={handleInfo}
            />
          </div>

          {/* Popular Movies */}
          <ParallaxSection speed={0.4}>
            <ScrollReveal direction="up" delay={0.1}>
              <EnhancedHorizontalRow
                title="Popular Movies"
                media={popularMovies}
                onPlay={handlePlay}
                onInfo={handleInfo}
                size="medium"
              />
            </ScrollReveal>
          </ParallaxSection>

          {/* Recent Movies */}
          <ParallaxSection speed={0.5}>
            <ScrollReveal direction="up" delay={0.2}>
              <EnhancedHorizontalRow
                title="Recently Added"
                media={recentMovies}
                onPlay={handlePlay}
                onInfo={handleInfo}
                size="medium"
              />
            </ScrollReveal>
          </ParallaxSection>

          {/* Action Movies */}
          {actionMovies.length > 0 && (
            <ParallaxSection speed={0.6}>
              <ScrollReveal direction="up" delay={0.3}>
                <EnhancedHorizontalRow
                  title="Action & Adventure"
                  media={actionMovies}
                  onPlay={handlePlay}
                  onInfo={handleInfo}
                  size="medium"
                />
              </ScrollReveal>
            </ParallaxSection>
          )}

          {/* Comedy Movies */}
          {comedyMovies.length > 0 && (
            <ParallaxSection speed={0.7}>
              <ScrollReveal direction="up" delay={0.4}>
                <EnhancedHorizontalRow
                  title="Comedy Movies"
                  media={comedyMovies}
                  onPlay={handlePlay}
                  onInfo={handleInfo}
                  size="medium"
                />
              </ScrollReveal>
            </ParallaxSection>
          )}

          {/* Drama Movies */}
          {dramaMovies.length > 0 && (
            <ParallaxSection speed={0.8}>
              <ScrollReveal direction="up" delay={0.5}>
                <EnhancedHorizontalRow
                  title="Drama Movies"
                  media={dramaMovies}
                  onPlay={handlePlay}
                  onInfo={handleInfo}
                  size="medium"
                />
              </ScrollReveal>
            </ParallaxSection>
          )}

          {/* Sci-Fi Movies */}
          {sciFiMovies.length > 0 && (
            <ParallaxSection speed={0.9}>
              <ScrollReveal direction="up" delay={0.6}>
                <EnhancedHorizontalRow
                  title="Sci-Fi & Fantasy"
                  media={sciFiMovies}
                  onPlay={handlePlay}
                  onInfo={handleInfo}
                  size="medium"
                />
              </ScrollReveal>
            </ParallaxSection>
          )}

          {/* Horror Movies */}
          {horrorMovies.length > 0 && (
            <ParallaxSection speed={1.0}>
              <ScrollReveal direction="up" delay={0.7}>
                <EnhancedHorizontalRow
                  title="Horror & Thriller"
                  media={horrorMovies}
                  onPlay={handlePlay}
                  onInfo={handleInfo}
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
          onPlayNext={(nextMedia) => {
            console.log('Playing next episode:', nextMedia.title);
            setSelectedMedia(nextMedia);
            // Keep player open and switch to next episode
          }}
        />
      )}
    </div>
  );
}
