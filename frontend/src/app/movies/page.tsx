"use client";

import React, { useState, useEffect } from "react";
import { Film, Play, Info, Plus, Check } from "lucide-react";
import Navbar from "@/components/Navbar";
import { Media } from '../../types/media';
import MediaCarousel from "@/components/MediaCarousel";
import VideoPlayer from "@/components/VideoPlayer";
import { Button } from "@/components/ui/button";
import ParallaxCards from "@/components/ui/parallaxcards";

export default function MoviesPage() {
  const [featuredMovie, setFeaturedMovie] = useState<Media | null>(null);
  const [actionMovies, setActionMovies] = useState<Media[]>([]);
  const [comedyMovies, setComedyMovies] = useState<Media[]>([]);
  const [dramaMovies, setDramaMovies] = useState<Media[]>([]);
  const [horrorMovies, setHorrorMovies] = useState<Media[]>([]);
  const [sciFiMovies, setSciFiMovies] = useState<Media[]>([]);
  const [recentMovies, setRecentMovies] = useState<Media[]>([]);
  const [popularMovies, setPopularMovies] = useState<Media[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMoviesData();
  }, []);

  const fetchMoviesData = async () => {
    try {
      const host = window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname;
      const apiUrl = `http://${host}:8251`;
      
      // Fetch all movies
      const moviesResponse = await fetch(`${apiUrl}/api/media`);
      const allMedia = await moviesResponse.json();
      const movies = allMedia.filter((item: Media) => item.type === "movie");
      
      // Set featured movie 
      // Sort by rating (highest first)
      const sortedMovies = movies.sort((a: Media, b: Media) => (b.rating || 0) - (a.rating || 0));
      const featured = sortedMovies[0];
      setFeaturedMovie(featured);

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

  const handlePlay = (media: Media) => {
    setSelectedMedia(media);
    setIsPlayerOpen(true);
  };

  const handleInfo = (media: Media) => {
    console.log("Show info for:", media.title);
  };

  const handleWatchlistToggle = async () => {
    if (!featuredMovie) return;
    
    try {
      const host = window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname;
      const apiUrl = `http://${host}:8251`;
      
      if (isInWatchlist) {
        await fetch(`${apiUrl}/api/user/watchlist/${featuredMovie.id}`, { method: 'DELETE' });
        setIsInWatchlist(false);
      } else {
        await fetch(`${apiUrl}/api/user/watchlist/${featuredMovie.id}`, { method: 'POST' });
        setIsInWatchlist(true);
      }
    } catch (error) {
      console.error("Error updating watchlist:", error);
    }
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
    <div className="min-h-screen bg-black">
      <Navbar />
      
      {/* Featured Movie Hero Section */}
      {featuredMovie && (
        <div className="relative h-[80vh] overflow-hidden">
          {/* Background Image */}
          <div className="absolute inset-0">
            <div className="w-full h-full bg-gradient-to-r from-black via-black/50 to-transparent">
              <img
                src={`http://${window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname}:8251/api/thumbnails/${featuredMovie.id}`}
                alt={featuredMovie.title}
                className="w-full h-full object-cover opacity-40"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          </div>

          {/* Content */}
          <div className="relative z-10 flex items-center h-full px-4 md:px-8 lg:px-16">
            <div className="max-w-2xl">
              <h1 className="text-5xl md:text-7xl font-bold text-white mb-4 leading-tight">
                {featuredMovie.title}
              </h1>
              
              <div className="flex items-center gap-4 text-sm text-gray-300">
                <span className="flex items-center gap-1">
                  {featuredMovie.rating || 0}/10
                </span>
                <span className="flex items-center gap-1">
                  {Array.from({ length: 5 }, (_, i) => i < (featuredMovie.rating || 0) / 2 ? '★' : '☆').join('')}
                </span>
                <span className="flex items-center gap-1">
                  {Math.floor((featuredMovie.duration || 0) / 60)}h {(featuredMovie.duration || 0) % 60}m
                </span>
                <span>{new Date().getFullYear()}</span>
              </div>

              <p className="text-lg text-gray-300 mb-8 leading-relaxed max-w-xl">
                {featuredMovie.description || "Experience this amazing movie from your personal collection."}
              </p>

              <div className="flex items-center gap-4">
                <Button
                  onClick={() => handlePlay(featuredMovie)}
                  className="bg-white text-black hover:bg-gray-200 font-bold px-8 py-3 text-lg"
                >
                  <Play className="w-6 h-6 mr-2 fill-current" />
                  Play
                </Button>
                
                <Button
                  onClick={handleWatchlistToggle}
                  variant="outline"
                  className="border-gray-400 text-white hover:bg-gray-800 font-bold px-8 py-3 text-lg"
                >
                  {isInWatchlist ? (
                    <>
                      <Check className="w-6 h-6 mr-2" />
                      In List
                    </>
                  ) : (
                    <>
                      <Plus className="w-6 h-6 mr-2" />
                      My List
                    </>
                  )}
                </Button>
                
                <Button
                  onClick={() => handleInfo(featuredMovie)}
                  variant="outline"
                  className="border-gray-400 text-white hover:bg-gray-800 font-bold px-8 py-3 text-lg"
                >
                  <Info className="w-6 h-6 mr-2" />
                  More Info
                </Button>
              </div>

              {/* Genres */}
              <div className="flex flex-wrap gap-2 mb-6">
                {featuredMovie.genres?.slice(0, 3).map((genre, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-red-600 text-white text-sm rounded-full"
                  >
                    {genre.name}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Gradient Overlay */}
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent"></div>
        </div>
      )}

      {/* Movie Categories */}
      <div className="relative z-10 -mt-32 space-y-8 px-4 md:px-8 lg:px-16">
        {recentMovies.length > 0 && (
          <MediaCarousel
            title="Recently Added Movies"
            media={recentMovies}
            onPlay={handlePlay}
            onInfo={handleInfo}
          />
        )}

        {popularMovies.length > 0 && (
          <MediaCarousel
            title="Popular Movies"
            media={popularMovies}
            onPlay={handlePlay}
            onInfo={handleInfo}
          />
        )}

        {actionMovies.length > 0 && (
          <MediaCarousel
            title="Action & Adventure"
            media={actionMovies}
            onPlay={handlePlay}
            onInfo={handleInfo}
          />
        )}

        {comedyMovies.length > 0 && (
          <MediaCarousel
            title="Comedy Movies"
            media={comedyMovies}
            onPlay={handlePlay}
            onInfo={handleInfo}
          />
        )}

        {dramaMovies.length > 0 && (
          <MediaCarousel
            title="Drama Movies"
            media={dramaMovies}
            onPlay={handlePlay}
            onInfo={handleInfo}
          />
        )}

        {sciFiMovies.length > 0 && (
          <MediaCarousel
            title="Sci-Fi & Fantasy"
            media={sciFiMovies}
            onPlay={handlePlay}
            onInfo={handleInfo}
          />
        )}

        {horrorMovies.length > 0 && (
          <MediaCarousel
            title="Horror & Thriller"
            media={horrorMovies}
            onPlay={handlePlay}
            onInfo={handleInfo}
          />
        )}
      </div>

      {/* ScrollX UI Parallax Cards Section */}
      <div className="mt-16">
        <ParallaxCards cards={parallaxCards} />
      </div>

      {/* Video Player Modal */}
      {selectedMedia && (
        <VideoPlayer
          media={selectedMedia}
          isOpen={isPlayerOpen}
          onClose={() => setIsPlayerOpen(false)}
        />
      )}
    </div>
  );
}
