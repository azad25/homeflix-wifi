"use client";

import React, { useState, useEffect } from "react";
import { usePageTitle } from '@/hooks/usePageTitle';
import { Play, Info, Trash2, Heart, Film, Tv, Download, CheckCircle, Pause, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Navbar from "@/components/Navbar";
import { Media } from '../../types/media';
import VideoPlayer from "@/components/VideoPlayer";
import RedLoader from "@/components/RedLoader";
import { getApiUrl, preloadAssets } from '@/lib/api';
import NetflixMediaCard from '@/components/NetflixMediaCard';
import { MagneticButton } from '@/components/scrollx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { removeFromWishlist, fetchWishlistMedia } from '@/lib/wishlist';
import { useNavigate } from "@/hooks/useNavigate";


interface DownloadInfo {
  id: string;
  name: string;
  magnet_uri: string;
  status: string;
  progress: number;
  download_rate: number;
  upload_rate: number;
  seeders: number;
  peers: number;
  size: number;
  downloaded: number;
  eta: string;
  added_at: string;
  completed_at?: string;
  save_path: string;
  tmdb_id?: number;
  media_type?: string;
}

interface DownloadingMedia extends Media {
  downloadInfo: DownloadInfo;
}

export default function MyListPage() {
  usePageTitle('My List');
  const router = useRouter();
  const navigate = useNavigate()
  const [watchlist, setWatchlist] = useState<Media[]>([]);
  const [filteredList, setFilteredList] = useState<Media[]>([]);
  const [filterType, setFilterType] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("added");
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [downloadingMedia, setDownloadingMedia] = useState<DownloadingMedia[]>([]);

  useEffect(() => {
    fetchWatchlist();
  }, []);

  // Fetch downloads when watchlist changes
  useEffect(() => {
    if (watchlist.length >= 0) { // Allow for empty watchlist too
      fetchDownloads();
    }
  }, [watchlist]);

  // Set up polling for download updates
  useEffect(() => {
    const interval = setInterval(() => {
      fetchDownloads();
    }, 3000);

    return () => clearInterval(interval);
  }, [watchlist]); // Depend on watchlist so it uses updated data

  useEffect(() => {
    filterAndSortList();
  }, [watchlist, filterType, sortBy]);

  const fetchWatchlist = async () => {
    try {
      const apiUrl = getApiUrl();
      const wishlistMedia = await fetchWishlistMedia(apiUrl);
      setWatchlist(wishlistMedia);

      // Preload assets for better performance (poster first, then thumbnail)
      if (wishlistMedia.length > 0) {
        preloadAssets(wishlistMedia, ['poster', 'thumbnail']);
      }

      setLoading(false);
    } catch (error) {
      console.error("Error fetching wishlist:", error);
      setWatchlist([]);
      setLoading(false);
    }
  };

  const fetchDownloads = async () => {
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/torrent/downloads?limit=100`);
      if (response.ok) {
        const data = await response.json();
        const downloads = data.downloads || [];

        // Filter downloads that have TMDB IDs and are actively downloading/paused
        const downloadingItems: DownloadingMedia[] = [];

        for (const download of downloads) {
          if (download.tmdb_id && (download.status === 'downloading' || download.status === 'paused')) {
            // Find corresponding media in watchlist (TMDB items have ID starting with 9)
            const tmdbWishlistId = parseInt(`9${download.tmdb_id}`);
            const wishlistItem = watchlist.find(item => item.id === tmdbWishlistId);

            if (wishlistItem) {
              // Use the wishlist item data (which already has proper poster info)
              console.log('Found wishlist item for download:', wishlistItem.title, 'poster_url:', wishlistItem.poster_url);
              downloadingItems.push({
                ...wishlistItem,
                downloadInfo: download
              });
            } else {
              // Fetch TMDB data for downloads not in wishlist to get poster
              console.log('Fetching TMDB data for download not in wishlist:', download.name);
              try {
                const tmdbResponse = await fetch(`${apiUrl}/api/tmdb-movie/${download.tmdb_id}?type=${download.media_type || 'movie'}`);
                if (tmdbResponse.ok) {
                  const tmdbData = await tmdbResponse.json();

                  // Handle both wrapped and direct response formats
                  const mediaData = tmdbData.data || tmdbData;
                  const mediaType = tmdbData.media_type || download.media_type || 'movie';

                  const posterUrl = mediaData.poster_path ? `https://image.tmdb.org/t/p/w500${mediaData.poster_path}` : null;
                  console.log('TMDB data fetched:', mediaData.title || mediaData.name, 'poster_path:', mediaData.poster_path, 'poster_url:', posterUrl);

                  downloadingItems.push({
                    id: tmdbWishlistId,
                    title: mediaData.title || mediaData.name || download.name,
                    type: mediaType === 'tv' ? 'episode' : 'movie',
                    year: mediaData.release_date || mediaData.first_air_date ?
                      new Date(mediaData.release_date || mediaData.first_air_date).getFullYear() :
                      new Date().getFullYear(),
                    rating: mediaData.vote_average || 0,
                    genres: mediaData.genres?.map((g: any) => ({ name: g.name })) || [],
                    tmdb_id: download.tmdb_id,
                    poster_url: posterUrl,
                    poster_path: mediaData.poster_path,
                    description: mediaData.overview,
                    downloadInfo: download
                  });
                } else {
                  console.log('TMDB fetch failed for:', download.name);
                  // Fallback if TMDB fetch fails
                  downloadingItems.push({
                    id: tmdbWishlistId,
                    title: download.name,
                    type: download.media_type === 'tv' ? 'episode' : 'movie',
                    year: new Date().getFullYear(),
                    rating: 0,
                    genres: [],
                    tmdb_id: download.tmdb_id,
                    poster_url: null,
                    downloadInfo: download
                  });
                }
              } catch (tmdbError) {
                console.error('Error fetching TMDB data for download:', tmdbError);
                // Fallback if TMDB fetch fails
                downloadingItems.push({
                  id: tmdbWishlistId,
                  title: download.name,
                  type: download.media_type === 'tv' ? 'episode' : 'movie',
                  year: new Date().getFullYear(),
                  rating: 0,
                  genres: [],
                  tmdb_id: download.tmdb_id,
                  poster_url: null,
                  downloadInfo: download
                });
              }
            }
          }
        }

        console.log('Final downloading items:', downloadingItems.map(item => ({ title: item.title, poster_url: item.poster_url })));
        setDownloadingMedia(downloadingItems);
      }
    } catch (error) {
      console.error("Error fetching downloads:", error);
      setDownloadingMedia([]);
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
    // Check if this is a TMDB movie (ID starts with 9 and has tmdb_id)
    if (media.tmdb_id && media.id.toString().startsWith('9')) {
      // TMDB movies don't have video files, redirect to info page
      handleInfo(media);
    } else {
      // Local media can be played
      setSelectedMedia(media);
      setIsPlayerOpen(true);
    }
  };

  const handleInfo = (media: Media) => {
    // Check if this is a TMDB movie (ID starts with 9 and has tmdb_id)
    if (media.tmdb_id && media.id.toString().startsWith('9')) {
      navigate.push(`/tmdb-movie/${media.tmdb_id}`);
    } else {
      navigate.push(`/movie/${media.id}`);
    }
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

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatSpeed = (bytesPerSecond: number) => {
    return formatBytes(bytesPerSecond) + '/s';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'downloading': return <Download className="w-4 h-4 text-blue-400" />;
      case 'paused': return <Pause className="w-4 h-4 text-yellow-400" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-400" />;
      default: return <Download className="w-4 h-4 text-gray-400" />;
    }
  };

  const DownloadingMediaCard: React.FC<{ media: DownloadingMedia }> = ({ media }) => {
    const { downloadInfo } = media;
    const progress = downloadInfo.progress || 0;

    const handleClick = () => {
      if (media.tmdb_id) {
        navigate.push(`/tmdb-movie/${media.tmdb_id}?type=${downloadInfo.media_type || 'movie'}`);
      }
    };

    const getPosterUrl = () => {
      console.log('Getting poster URL for:', media.title, {
        poster_url: media.poster_url,
        poster_path: media.poster_path,
        tmdb_id: media.tmdb_id
      });

      if (media.poster_url) {
        console.log('Using poster_url:', media.poster_url);
        return media.poster_url;
      }
      if (media.poster_path) {
        const url = `https://image.tmdb.org/t/p/w300${media.poster_path}`;
        console.log('Using poster_path to create URL:', url);
        return url;
      }

      console.log('No poster found, using placeholder for:', media.title);
      // Generate a placeholder with the movie/show title
      return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
        <svg width="300" height="450" viewBox="0 0 300 450" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="300" height="450" fill="#374151"/>
          <rect x="50" y="150" width="200" height="150" rx="10" fill="#6B7280"/>
          <text x="150" y="240" text-anchor="middle" fill="#D1D5DB" font-family="Arial, sans-serif" font-size="14" font-weight="bold">
            ${media.title.length > 20 ? media.title.substring(0, 20) + '...' : media.title}
          </text>
          <text x="150" y="260" text-anchor="middle" fill="#9CA3AF" font-family="Arial, sans-serif" font-size="12">
            ${media.type === 'episode' ? 'TV Series' : 'Movie'}
          </text>
        </svg>
      `)}`;
    };

    return (
      <div
        className="relative group cursor-pointer bg-gray-800 rounded-lg overflow-hidden hover:bg-gray-700 transition-all duration-300 hover:scale-105"
        onClick={handleClick}
      >
        {/* Poster */}
        <div className="aspect-[2/3] relative overflow-hidden">
          <img
            src={getPosterUrl()}
            alt={media.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = '/placeholder-poster.jpg';
            }}
          />

          {/* Progress Circle Overlay */}
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <div className="relative w-16 h-16">
              {/* Background Circle */}
              <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 64 64">
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth="4"
                  fill="none"
                />
                {/* Progress Circle */}
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="#ef4444"
                  strokeWidth="4"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 28}`}
                  strokeDashoffset={`${2 * Math.PI * 28 * (1 - progress / 100)}`}
                  className="transition-all duration-300"
                />
              </svg>

              {/* Progress Text */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-white text-xs font-bold">
                  {progress.toFixed(0)}%
                </span>
              </div>
            </div>
          </div>

          {/* Status Icon */}
          <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm rounded-full p-2">
            {getStatusIcon(downloadInfo.status)}
          </div>
        </div>

        {/* Info */}
        <div className="p-3">
          <h3 className="text-white font-medium text-sm line-clamp-2 mb-2 group-hover:text-red-400 transition-colors">
            {media.title}
          </h3>

          <div className="space-y-1 text-xs text-gray-400">
            <div className="flex justify-between">
              <span>Status:</span>
              <span className="capitalize text-white">{downloadInfo.status}</span>
            </div>

            <div className="flex justify-between">
              <span>Speed:</span>
              <span className="text-green-400">{formatSpeed(downloadInfo.download_rate)}</span>
            </div>

            <div className="flex justify-between">
              <span>Size:</span>
              <span>{formatBytes(downloadInfo.downloaded)} / {formatBytes(downloadInfo.size)}</span>
            </div>

            <div className="flex justify-between">
              <span>ETA:</span>
              <span>{downloadInfo.eta}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <RedLoader size="large" />
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

        {/* Downloading Section */}
        {downloadingMedia.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <Download className="w-6 h-6 text-red-500" />
              <h2 className="text-2xl font-bold text-white">Currently Downloading</h2>
              <span className="bg-red-600/20 text-red-400 px-2 py-1 rounded-full text-sm">
                {downloadingMedia.length} active
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6 mb-8">
              {downloadingMedia.map((media) => (
                <DownloadingMediaCard key={`download-${media.id}`} media={media} />
              ))}
            </div>
          </div>
        )}

        {/* Watchlist Grid - Netflix Style */}
        {filteredList.length > 0 ? (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <Heart className="w-6 h-6 text-red-500" />
              <h2 className="text-2xl font-bold text-white">My Watchlist</h2>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
              {filteredList.map((media, index) => (
                <div key={media.id} className="relative">
                  <NetflixMediaCard
                    media={media}
                    onPlay={handlePlay}
                    onInfo={handleInfo}
                    onAddToList={() => handleRemoveFromList(media.id)}
                    isInList={true}
                    priority={index < 12 ? 'high' : 'normal'}
                    showPreviewOnHover={true}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : downloadingMedia.length === 0 ? (
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
        ) : null}
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
