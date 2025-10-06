"use client";

import React, { useState, useEffect } from "react";
import { Play, Info, Trash2, Heart, Film, Tv } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Navbar from "@/components/Navbar";
import { Media } from '../../types/media';
import VideoPlayer from "@/components/VideoPlayer";
import { getApiUrl } from '@/lib/api';
import { MagneticButton } from '@/components/scrollx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { removeFromWishlist, fetchWishlistMedia } from '@/lib/wishlist';

export default function MyListPage() {
  const router = useRouter();
  const [watchlist, setWatchlist] = useState<Media[]>([]);
  const [filteredList, setFilteredList] = useState<Media[]>([]);
  const [filterType, setFilterType] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("added");
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWatchlist();
  }, []);

  useEffect(() => {
    filterAndSortList();
  }, [watchlist, filterType, sortBy]);

  const fetchWatchlist = async () => {
    try {
      const apiUrl = getApiUrl();
      const wishlistMedia = await fetchWishlistMedia(apiUrl);
      setWatchlist(wishlistMedia);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching wishlist:", error);
      setWatchlist([]);
      setLoading(false);
    }
  };

  const filterAndSortList = () => {
    let filtered = [...watchlist];

    // Filter by type
    if (filterType !== "all") {
      filtered = filtered.filter(media => media.type === filterType);
    }

    // Sort
    switch (sortBy) {
      case "added":
        filtered.sort((a, b) => b.id - a.id);
        break;
      case "title":
        filtered.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "rating":
        filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case "year":
        filtered.sort((a, b) => b.id - a.id); // Assuming newer IDs = newer content
        break;
    }

    setFilteredList(filtered);
  };

  const handlePlay = (media: Media) => {
    setSelectedMedia(media);
    setIsPlayerOpen(true);
  };

  const handleInfo = (media: Media) => {
    router.push(`/movie/${media.id}`);
  };

  const handleRemoveFromList = async (mediaId: number) => {
    try {
      const success = removeFromWishlist(mediaId);
      if (success) {
        setWatchlist(prev => prev.filter(item => item.id !== mediaId));
      }
    } catch (error) {
      console.error("Error removing from wishlist:", error);
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading My List...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-900/20 via-black to-black">
      <Navbar />

      {/* Header Section */}
      <div className="pt-20 px-4 md:px-8 lg:px-16">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3 tracking-wider">
              <Heart className="w-10 h-10 text-red-500" />
              M Y   L I S T
            </h1>
            <p className="text-gray-400">Your personal collection of favorites</p>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap gap-4">
            {/* Type Filter */}
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-48 bg-gray-800 border-gray-700 text-white">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="all" className="text-white hover:bg-gray-700">All Types</SelectItem>
                <SelectItem value="movie" className="text-white hover:bg-gray-700">Movies</SelectItem>
                <SelectItem value="episode" className="text-white hover:bg-gray-700">TV Shows</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort Filter */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-48 bg-gray-800 border-gray-700 text-white">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="added" className="text-white hover:bg-gray-700">Recently Added</SelectItem>
                <SelectItem value="title" className="text-white hover:bg-gray-700">Title A-Z</SelectItem>
                <SelectItem value="rating" className="text-white hover:bg-gray-700">Highest Rated</SelectItem>
                <SelectItem value="year" className="text-white hover:bg-gray-700">Release Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-6">
          <p className="text-gray-400">
            {filteredList.length} {filteredList.length === 1 ? 'title' : 'titles'} in your list
          </p>
        </div>

        {/* Watchlist Grid */}
        {filteredList.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
            {filteredList.map((media) => (
              <div
                key={media.id}
                className="group relative bg-gray-900 rounded-lg overflow-hidden hover:scale-105 transition-all duration-300"
              >
                {/* Thumbnail */}
                <div className="aspect-[2/3] bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center relative">
                  {media.poster_path || media.thumbnail_path ? (
                    <Image
                      src={`http://${window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname}:8252/api/posters/${media.id}`}
                      alt={media.title}
                      fill
                      className="object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        // First try to fallback to thumbnail
                        if (target.src.includes('/api/posters/')) {
                          target.src = `http://${window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname}:8252/api/thumbnails/${media.id}`;
                        } else {
                          // If thumbnail also fails, hide the image and show fallback
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextElementSibling?.classList.remove('hidden');
                        }
                      }}
                    />
                  ) : null}
                  <div className={`flex items-center justify-center w-full h-full ${media.thumbnail_path ? 'hidden' : ''}`}>
                    {media.type === "movie" ? (
                      <Film className="w-12 h-12 text-gray-600" />
                    ) : (
                      <Tv className="w-12 h-12 text-gray-600" />
                    )}
                  </div>

                  {/* Type Badge */}
                  <div className="absolute top-2 left-2">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${media.type === "movie" ? "bg-red-600" : "bg-blue-600"
                      } text-white`}>
                      {media.type === "movie" ? "MOVIE" : "TV"}
                    </span>
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={() => handleRemoveFromList(media.id)}
                    className="absolute top-2 right-2 bg-black bg-opacity-70 hover:bg-opacity-90 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handlePlay(media)}
                        size="sm"
                        className="bg-white text-black hover:bg-gray-200"
                      >
                        <Play className="w-4 h-4 mr-1 fill-current" />
                        Play
                      </Button>
                      <Button
                        onClick={() => handleInfo(media)}
                        size="sm"
                        variant="outline"
                        className="border-white text-white hover:bg-white hover:text-black"
                      >
                        <Info className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Content Info */}
                <div className="p-4">
                  <h3 className="text-white font-semibold text-sm mb-2 line-clamp-2 leading-tight">
                    {media.title}
                  </h3>

                  <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                    <span>{media.type === "movie" ? "Movie" : "TV Show"}</span>
                    {(media.rating || 0) > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="text-yellow-400">★</span>
                        {(media.rating || 0).toFixed(1)}
                      </span>
                    )}
                  </div>

                  {(media.duration || 0) > 0 && (
                    <div className="text-xs text-gray-400 mb-2">
                      {formatDuration(media.duration || 0)}
                    </div>
                  )}

                  {/* Genres */}
                  <div className="flex flex-wrap gap-1">
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
        ) : (
          <div className="text-center py-16">
            <Heart className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl text-white mb-2">Your list is empty</h3>
            <p className="text-gray-400 mb-6">
              {filterType !== "all"
                ? `No ${filterType === "movie" ? "movies" : "TV shows"} in your list`
                : "Add movies and TV shows to your list to see them here"
              }
            </p>
            <MagneticButton
              onClick={() => router.push('/browse')}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold"
            >
              Browse Content
            </MagneticButton>
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
