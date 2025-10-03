"use client";

import React, { useState, useEffect } from "react";
import { Play, Info, Film } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Navbar from "@/components/Navbar";
import { Media } from '../../types/media';
import VideoPlayer from "@/components/VideoPlayer";
import { getApiUrl } from '@/lib/api';
import { ScrollXHero, NetflixHorizontalRow, ParallaxSection, GradientBackground, ScrollReveal } from '@/components/scrollx';
import RecentlyWatched from '@/components/RecentlyWatched';
import ContinueWatching from '@/components/ContinueWatching';
import RecommendedContent from '@/components/RecommendedContent';
import { useRecommendations } from '@/contexts/RecommendationContext';

export default function MoviesPage() {
  const router = useRouter();
  const { refreshRecommendations, trackClick } = useRecommendations();
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
  const [allMovies, setAllMovies] = useState<Media[]>([]);

  useEffect(() => {
    fetchMoviesData();
    
    // Set up recommendation refresh timer (every 5 minutes)
    const refreshInterval = setInterval(() => {
      console.log('Refreshing movie recommendations...');
      fetchMoviesData();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(refreshInterval);
  }, []);

  const fetchMoviesData = async () => {
    try {
      const apiUrl = getApiUrl();
      const defaultUserId = '1';
      
      // Fetch movie recommendations from backend
      const [
        featuredResponse,
        popularResponse,
        recentResponse,
        actionResponse,
        comedyResponse,
        dramaResponse,
        horrorResponse,
        sciFiResponse,
        allMoviesResponse
      ] = await Promise.all([
        fetch(`${apiUrl}/api/recommendations?user_id=${defaultUserId}&category=top_picks&limit=5`),
        fetch(`${apiUrl}/api/recommendations?user_id=${defaultUserId}&category=trending&limit=20`),
        fetch(`${apiUrl}/api/recommendations?user_id=${defaultUserId}&category=new_releases&limit=20`),
        fetch(`${apiUrl}/api/recommendations?user_id=${defaultUserId}&category=for_you&limit=50`),
        fetch(`${apiUrl}/api/recommendations?user_id=${defaultUserId}&category=for_you&limit=50`),
        fetch(`${apiUrl}/api/recommendations?user_id=${defaultUserId}&category=for_you&limit=50`),
        fetch(`${apiUrl}/api/recommendations?user_id=${defaultUserId}&category=for_you&limit=50`),
        fetch(`${apiUrl}/api/recommendations?user_id=${defaultUserId}&category=for_you&limit=50`),
        fetch(`${apiUrl}/api/media/movies`)
      ]);

      // Process responses
      const featuredData = featuredResponse.ok ? await featuredResponse.json() : { items: [] };
      const popularData = popularResponse.ok ? await popularResponse.json() : { items: [] };
      const recentData = recentResponse.ok ? await recentResponse.json() : { items: [] };
      const actionData = actionResponse.ok ? await actionResponse.json() : { items: [] };
      const comedyData = comedyResponse.ok ? await comedyResponse.json() : { items: [] };
      const dramaData = dramaResponse.ok ? await dramaResponse.json() : { items: [] };
      const horrorData = horrorResponse.ok ? await horrorResponse.json() : { items: [] };
      const sciFiData = sciFiResponse.ok ? await sciFiResponse.json() : { items: [] };
      const allMoviesData = allMoviesResponse.ok ? await allMoviesResponse.json() : [];

      // Filter movies by type and set state
      const movieItems = (items: any[]) => items.filter((item: any) => item.type === "movie");

      setFeaturedMovies(movieItems(featuredData.items || []));
      setPopularMovies(movieItems(popularData.items || []));
      setRecentMovies(movieItems(recentData.items || []));
      
      // Filter by genres from recommendations
      setActionMovies(movieItems(actionData.items || []).filter((m: any) => 
        m.genres?.some((g: any) => g.name.toLowerCase().includes('action'))
      ).slice(0, 20));
      
      setComedyMovies(movieItems(comedyData.items || []).filter((m: any) => 
        m.genres?.some((g: any) => g.name.toLowerCase().includes('comedy'))
      ).slice(0, 20));
      
      setDramaMovies(movieItems(dramaData.items || []).filter((m: any) => 
        m.genres?.some((g: any) => g.name.toLowerCase().includes('drama'))
      ).slice(0, 20));
      
      setHorrorMovies(movieItems(horrorData.items || []).filter((m: any) => 
        m.genres?.some((g: any) => g.name.toLowerCase().includes('horror'))
      ).slice(0, 20));
      
      setSciFiMovies(movieItems(sciFiData.items || []).filter((m: any) => 
        m.genres?.some((g: any) => g.name.toLowerCase().includes('sci-fi') || g.name.toLowerCase().includes('science'))
      ).slice(0, 20));

      // Set all movies for context
      const movies = allMoviesData.filter((item: Media) => item.type === "movie");
      setAllMovies(movies);
      
      // Initialize recommendations with all movie data
      const allRecommendations = [
        ...(featuredData.items || []),
        ...(popularData.items || []),
        ...(recentData.items || []),
        ...movies
      ];
      refreshRecommendations(allRecommendations);
      
      setLoading(false);
    } catch (error) {
      console.error("Error fetching movie recommendations:", error);
      
      // Fallback to basic movie fetch if recommendations fail
      try {
        const apiUrl = getApiUrl();
        const fallbackResponse = await fetch(`${apiUrl}/api/media/movies`);
        if (fallbackResponse.ok) {
          const movies = await fallbackResponse.json();
          
          // Set fallback data with basic filtering
          setFeaturedMovies(movies.slice(0, 5));
          setPopularMovies(movies.slice(0, 20));
          setRecentMovies(movies.slice(0, 20));
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
          setSciFiMovies(movies.filter((m: Media) => 
            m.genres?.some(g => g.name.toLowerCase().includes('sci-fi'))
          ).slice(0, 20));
          
          setAllMovies(movies);
          refreshRecommendations(movies);
        }
      } catch (fallbackError) {
        console.error("Fallback movie fetch also failed:", fallbackError);
      }
      
      setLoading(false);
    }
  };

  const handlePlay = (media: Media, startTime?: number) => {
    trackClick(media.id, 'play', 'movies');
    setSelectedMedia(media);
    setIsPlayerOpen(true);
  };

  const handleInfo = (media: Media) => {
    trackClick(media.id, 'info', 'movies');
    router.push(`/movie/${media.uuid}`);
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
          pageType="movies"
        />
      )}

      {/* Main Content with Parallax Background */}
      <GradientBackground variant="netflix" className="min-h-screen">
        <div className="relative z-10 py-20">
          {/* Continue Watching Movies */}
          <ParallaxSection speed={0.2}>
            <ScrollReveal direction="up" delay={0.1}>
              <ContinueWatching
                onPlay={handlePlay}
                onInfo={handleInfo}
              />
            </ScrollReveal>
          </ParallaxSection>
          
          {/* Recommended Movies */}
          <ParallaxSection speed={0.25}>
            <ScrollReveal direction="up" delay={0.15}>
              <RecommendedContent
                allMedia={allMovies}
                onPlay={handlePlay}
                onInfo={handleInfo}
              />
            </ScrollReveal>
          </ParallaxSection>

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
      </GradientBackground>

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
