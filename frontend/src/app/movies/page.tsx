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
      
      // Set featured movies for hero section
      const sortedMovies = movies.sort((a: Media, b: Media) => (b.rating || 0) - (a.rating || 0));
      setFeaturedMovies(sortedMovies.slice(0, 5));

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
      
      setSciFiMovies(movies.filter((m: Media) => 
        m.genres?.some(g => g.name.toLowerCase().includes('sci-fi') || g.name.toLowerCase().includes('science'))
      ).slice(0, 20));

      // Recent and popular
      setRecentMovies(movies.sort((a: Media, b: Media) => b.id - a.id).slice(0, 20));
      setPopularMovies(movies.sort((a: Media, b: Media) => (b.view_count ?? 0) - (a.view_count ?? 0)).slice(0, 20));
      
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
