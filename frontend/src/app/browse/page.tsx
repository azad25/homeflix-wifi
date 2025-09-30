"use client";

import React, { useState, useEffect } from "react";
import { Play, Info, Plus, Grid, List, Film } from "lucide-react";
import { Media } from "../../types/media";
import VideoPlayer from "../../components/VideoPlayer";
import Navbar from "../../components/Navbar";
import MediaCarousel from "../../components/MediaCarousel";
import { getApiUrl } from "../../lib/api";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Genre {
  id: number;
  name: string;
  description: string;
}

export default function BrowsePage() {
  const [allMedia, setAllMedia] = useState<Media[]>([]);
  const [filteredMedia, setFilteredMedia] = useState<Media[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("recent");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    filterAndSortMedia();
  }, [allMedia, selectedGenre, sortBy]);

  const fetchData = async () => {
    try {
      const apiUrl = getApiUrl();
      
      // Fetch all media
      const mediaResponse = await fetch(`${apiUrl}/api/media`);
      const mediaData = await mediaResponse.json();
      
      // Fetch genres
      const genresResponse = await fetch(`${apiUrl}/api/genres`);
      const genresData = await genresResponse.json();
      
      setAllMedia(mediaData);
      setGenres(genresData);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      setLoading(false);
    }
  };

  const filterAndSortMedia = () => {
    let filtered = [...allMedia];

    // Filter by genre
    if (selectedGenre !== "all") {
      filtered = filtered.filter(media => 
        (media.genres || []).some(genre => genre.name === selectedGenre)
      );
    }

    // Sort media
    switch (sortBy) {
      case "recent":
        filtered.sort((a, b) => b.id - a.id);
        break;
      case "popular":
        filtered.sort((a, b) => (b.view_count || 0) - (a.view_count || 0));
        break;
      case "rating":
        filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case "title":
        filtered.sort((a, b) => a.title.localeCompare(b.title));
        break;
    }

    setFilteredMedia(filtered);
  };

  const handlePlay = (media: Media) => {
    setSelectedMedia(media);
    setIsPlayerOpen(true);
  };

  const handleInfo = (media: Media) => {
    console.log("Show info for:", media.title);
  };

  const groupedByGenre = () => {
    const grouped: { [key: string]: Media[] } = {};
    
    filteredMedia.forEach(media => {
      if (media.genres && media.genres.length > 0) {
        // Media has genres assigned
        media.genres.forEach(genre => {
          if (!grouped[genre.name]) {
            grouped[genre.name] = [];
          }
          grouped[genre.name].push(media);
        });
      } else {
        // Media has no genres, put in "Uncategorized"
        if (!grouped["Uncategorized"]) {
          grouped["Uncategorized"] = [];
        }
        grouped["Uncategorized"].push(media);
      }
    });
    
    return grouped;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading Browse...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      
      {/* Header Section */}
      <div className="pt-20 px-4 md:px-8 lg:px-16">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Browse Movies & TV Shows</h1>
            <p className="text-gray-400">Discover your next favorite from your personal collection</p>
          </div>
          
          {/* Controls */}
          <div className="flex flex-wrap gap-4">
            {/* Genre Filter */}
            <Select value={selectedGenre} onValueChange={setSelectedGenre}>
              <SelectTrigger className="w-48 bg-gray-800 border-gray-700 text-white">
                <SelectValue placeholder="All Genres" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="all" className="text-white hover:bg-gray-700">All Genres</SelectItem>
                {genres.map(genre => (
                  <SelectItem key={genre.id} value={genre.name} className="text-white hover:bg-gray-700">
                    {genre.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Sort Filter */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-48 bg-gray-800 border-gray-700 text-white">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="recent" className="text-white hover:bg-gray-700">Recently Added</SelectItem>
                <SelectItem value="popular" className="text-white hover:bg-gray-700">Most Popular</SelectItem>
                <SelectItem value="rating" className="text-white hover:bg-gray-700">Highest Rated</SelectItem>
                <SelectItem value="title" className="text-white hover:bg-gray-700">A-Z</SelectItem>
              </SelectContent>
            </Select>

            {/* View Mode Toggle */}
            <div className="flex bg-gray-800 rounded-lg p-1">
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("grid")}
                className="text-white"
              >
                <Grid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
                className="text-white"
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-6">
          <p className="text-gray-400">
            Showing {filteredMedia.length} {filteredMedia.length === 1 ? 'title' : 'titles'}
            {selectedGenre !== "all" && ` in ${selectedGenre}`}
          </p>
        </div>

        {/* Content Display */}
        {viewMode === "grid" ? (
          // Grid View - Grouped by Genre
          <div className="space-y-8">
            {Object.entries(groupedByGenre()).map(([genreName, genreMedia]) => (
              <MediaCarousel
                key={genreName}
                title={genreName}
                media={genreMedia as any}
                onPlay={handlePlay as any}
                onInfo={handleInfo as any}
              />
            ))}
          </div>
        ) : (
          // List View - All Media in Grid
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
            {filteredMedia.map((media) => (
              <div
                key={media.id}
                className="group relative bg-gray-900 rounded-lg overflow-hidden hover:scale-105 transition-transform duration-300 cursor-pointer"
                onClick={() => handlePlay(media)}
              >
                <div className="aspect-[2/3] bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                  <img
                    src={`${getApiUrl()}/api/thumbnails/${media.id}`}
                    alt={media.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/placeholder-thumbnail.jpg';
                    }}
                  />
                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlay(media);
                      }}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      Play
                    </Button>
                  </div>
                </div>
                
                <div className="p-3">
                  <h3 className="text-white font-semibold text-sm mb-1 line-clamp-2">{media.title}</h3>
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>{media.type === "movie" ? "Movie" : "TV Show"}</span>
                    {(media.rating || 0) > 0 && <span>★ {(media.rating || 0).toFixed(1)}</span>}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(media.genres || []).slice(0, 2).map((genre, index) => (
                      <span
                        key={index}
                        className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded"
                      >
                        {genre.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {filteredMedia.length === 0 && (
          <div className="text-center py-16">
            <Film className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl text-white mb-2">No content found</h3>
            <p className="text-gray-400">Try adjusting your filters or search terms</p>
          </div>
        )}
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
