"use client";

import React, { useState, useEffect } from "react";
import { Tv, Play, Info, Plus, Check, Clock } from "lucide-react";
import Navbar from "@/components/Navbar";
import MediaCarousel from "@/components/MediaCarousel";
import VideoPlayer from "@/components/VideoPlayer";
import { Button } from "@/components/ui/button";
import ParallaxCards from "@/components/ui/parallaxcards";

interface Media {
  id: number;
  title: string;
  description: string;
  type: string;
  rating: number;
  duration: number;
  genres: Array<{ name: string }>;
  thumbnail_path?: string;
  view_count: number;
  series_id?: number;
  season_number?: number;
  episode_number?: number;
  subtitles?: Array<{ language: string; file_path: string }>;
}

interface Series {
  id: number;
  title: string;
  description: string;
  rating: number;
  total_seasons: number;
  total_episodes: number;
  genres: Array<{ name: string }>;
  episodes: Media[];
}

export default function TVShowsPage() {
  const [featuredSeries, setFeaturedSeries] = useState<Series | null>(null);
  const [continueWatching, setContinueWatching] = useState<Media[]>([]);
  const [recentEpisodes, setRecentEpisodes] = useState<Media[]>([]);
  const [popularSeries, setPopularSeries] = useState<Media[]>([]);
  const [actionSeries, setActionSeries] = useState<Media[]>([]);
  const [dramaSeries, setDramaSeries] = useState<Media[]>([]);
  const [comedySeries, setComedySeries] = useState<Media[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTVShowsData();
  }, []);

  const fetchTVShowsData = async () => {
    try {
      const host = window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname;
      const apiUrl = `http://${host}:8251`;
      
      // Fetch all media and series
      const [mediaResponse, seriesResponse, continueResponse] = await Promise.all([
        fetch(`${apiUrl}/api/media`),
        fetch(`${apiUrl}/api/series`),
        fetch(`${apiUrl}/api/recommendations/continue`)
      ]);
      
      const allMedia = await mediaResponse.json();
      const allSeries = await seriesResponse.json();
      const continueData = await continueResponse.json();
      
      const episodes = allMedia.filter((item: Media) => item.type === "episode");
      
      // Set featured series (highest rated with most episodes)
      const featured = allSeries.sort((a: Series, b: Series) => 
        (b.rating * b.total_episodes) - (a.rating * a.total_episodes)
      )[0];
      setFeaturedSeries(featured);

      // Continue watching
      setContinueWatching(continueData ? continueData.slice(0, 20) : []);

      // Recent episodes
      setRecentEpisodes(episodes.sort((a: Media, b: Media) => b.id - a.id).slice(0, 20));
      
      // Popular series (represented by their episodes)
      setPopularSeries(episodes.sort((a: Media, b: Media) => b.view_count - a.view_count).slice(0, 20));

      // Categorize by genre
      setActionSeries(episodes.filter((e: Media) => 
        e.genres.some(g => g.name.toLowerCase().includes('action'))
      ).slice(0, 20));
      
      setDramaSeries(episodes.filter((e: Media) => 
        e.genres.some(g => g.name.toLowerCase().includes('drama'))
      ).slice(0, 20));
      
      setComedySeries(episodes.filter((e: Media) => 
        e.genres.some(g => g.name.toLowerCase().includes('comedy'))
      ).slice(0, 20));
      
      setLoading(false);
    } catch (error) {
      console.error("Error fetching TV shows:", error);
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
    if (!featuredSeries) return;
    
    try {
      const host = window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname;
      const apiUrl = `http://${host}:8251`;
      
      if (isInWatchlist) {
        await fetch(`${apiUrl}/api/user/watchlist/${featuredSeries.id}`, { method: 'DELETE' });
        setIsInWatchlist(false);
      } else {
        await fetch(`${apiUrl}/api/user/watchlist/${featuredSeries.id}`, { method: 'POST' });
        setIsInWatchlist(true);
      }
    } catch (error) {
      console.error("Error updating watchlist:", error);
    }
  };

  const formatEpisodeTitle = (media: Media) => {
    if (media.season_number && media.episode_number) {
      return `S${media.season_number}:E${media.episode_number} - ${media.title}`;
    }
    return media.title;
  };

  const parallaxCards = [
    {
      id: 1,
      title: "Binge-Worthy Series",
      description: "Complete seasons ready for your next marathon session",
      icon: <Tv />,
      variant: "default" as const,
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    },
    {
      id: 2,
      title: "Episode Tracking",
      description: "Never lose your place with automatic progress tracking",
      icon: <Clock />,
      variant: "outline" as const,
      background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    },
    {
      id: 3,
      title: "Series Discovery",
      description: "Find your next favorite show from your collection",
      icon: <Play />,
      variant: "secondary" as const,
      background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading TV Shows...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      
      {/* Featured Series Hero Section */}
      {featuredSeries && (
        <div className="relative h-[80vh] overflow-hidden">
          {/* Background Image */}
          <div className="absolute inset-0">
            <div className="w-full h-full bg-gradient-to-r from-black via-black/50 to-transparent">
              {featuredSeries.episodes && featuredSeries.episodes.length > 0 && (
                <img
                  src={`http://${window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname}:8251/api/thumbnails/${featuredSeries.episodes[0].id}`}
                  alt={featuredSeries.title}
                  className="w-full h-full object-cover opacity-40"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              )}
            </div>
          </div>

          {/* Content */}
          <div className="relative z-10 flex items-center h-full px-4 md:px-8 lg:px-16">
            <div className="max-w-2xl">
              <h1 className="text-5xl md:text-7xl font-bold text-white mb-4 leading-tight">
                {featuredSeries.title}
              </h1>
              
              <div className="flex items-center gap-4 mb-6 text-white">
                <span className="bg-blue-600 px-3 py-1 rounded text-sm font-bold">TV SERIES</span>
                {featuredSeries.rating > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="text-yellow-400">★</span>
                    {featuredSeries.rating.toFixed(1)}
                  </span>
                )}
                <span>{featuredSeries.total_seasons} Season{featuredSeries.total_seasons !== 1 ? 's' : ''}</span>
                <span>{featuredSeries.total_episodes} Episodes</span>
                <span>{new Date().getFullYear()}</span>
              </div>

              <p className="text-lg text-gray-300 mb-8 leading-relaxed max-w-xl">
                {featuredSeries.description || "Dive into this captivating series from your personal collection."}
              </p>

              <div className="flex items-center gap-4">
                <Button
                  onClick={() => featuredSeries.episodes && featuredSeries.episodes.length > 0 && handlePlay(featuredSeries.episodes[0])}
                  className="bg-white text-black hover:bg-gray-200 font-bold px-8 py-3 text-lg"
                >
                  <Play className="w-6 h-6 mr-2 fill-current" />
                  Play S1:E1
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
                  onClick={() => featuredSeries.episodes && featuredSeries.episodes.length > 0 && handleInfo(featuredSeries.episodes[0])}
                  variant="outline"
                  className="border-gray-400 text-white hover:bg-gray-800 font-bold px-8 py-3 text-lg"
                >
                  <Info className="w-6 h-6 mr-2" />
                  More Info
                </Button>
              </div>

              {/* Genres */}
              <div className="flex flex-wrap gap-2 mt-6">
                {featuredSeries?.genres?.map((genre, index) => (
                  <span
                    key={index}
                    className="bg-gray-800 text-gray-300 px-3 py-1 rounded-full text-sm"
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

      {/* TV Show Categories */}
      <div className="relative z-10 -mt-32 space-y-8 px-4 md:px-8 lg:px-16">
        {continueWatching.length > 0 && (
          <MediaCarousel
            title="Continue Watching"
            media={continueWatching as any}
            onPlay={handlePlay as any}
            onInfo={handleInfo as any}
          />
        )}

        {recentEpisodes.length > 0 && (
          <MediaCarousel
            title="Recently Added Episodes"
            media={recentEpisodes as any}
            onPlay={handlePlay as any}
            onInfo={handleInfo as any}
          />
        )}

        {popularSeries.length > 0 && (
          <MediaCarousel
            title="Popular TV Shows"
            media={popularSeries as any}
            onPlay={handlePlay as any}
            onInfo={handleInfo as any}
          />
        )}

        {actionSeries.length > 0 && (
          <MediaCarousel
            title="Action & Adventure Series"
            media={actionSeries as any}
            onPlay={handlePlay as any}
            onInfo={handleInfo as any}
          />
        )}

        {dramaSeries.length > 0 && (
          <MediaCarousel
            title="Drama Series"
            media={dramaSeries as any}
            onPlay={handlePlay as any}
            onInfo={handleInfo as any}
          />
        )}

        {comedySeries.length > 0 && (
          <MediaCarousel
            title="Comedy Series"
            media={comedySeries as any}
            onPlay={handlePlay as any}
            onInfo={handleInfo as any}
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
