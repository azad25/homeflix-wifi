"use client";

import { TVPageHeader, TVPageShell, TVSegmented, TVGridSkeleton } from '@/components/tv/TVPage';
import React, { useState, useEffect } from "react";
import { usePageTitle } from '@/hooks/usePageTitle';
import { Play, Info, Trash2, Heart, Film, Tv, Download, CheckCircle, Pause, AlertCircle, FolderOpen, Plus, Grid3X3, Edit, X, RotateCcw } from 'lucide-react';
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
import { useMyList } from '@/hooks/useMyList';
import MyListTooltip from '@/components/ui/MyListTooltip';

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

interface Collection {
  id: number;
  name: string;
  description: string;
  user_id: number;
  is_public: boolean;
  cover_image: string;
  tags: string;
  item_count: number;
  created_at: string;
  updated_at: string;
}

interface CollectionItem {
  id: number;
  collection_id: number;
  media_id: number;
  position: number;
  notes: string;
  added_at: string;
  media: Media;
}

type TabType = 'watchlist' | 'downloads' | 'collections';

// TMDB detail lookups, shared and cached for the session. The list loaders
// below used to await one fetch per item in sequence (N round-trips); now
// every lookup is started up front and the loops just collect results.
type CachedJson = { ok: boolean; status: number; json: () => Promise<any> };
const tmdbDetailCache = new Map<string, Promise<CachedJson>>();
const tmdbFetch = (url: string): Promise<CachedJson> => {
  let p = tmdbDetailCache.get(url);
  if (!p) {
    p = fetch(url)
      .then(async (r) => {
        const data = r.ok ? await r.json().catch(() => null) : null;
        return { ok: r.ok && data !== null, status: r.status, json: async () => data };
      })
      .catch((e) => {
        tmdbDetailCache.delete(url); // allow retry later
        throw e;
      });
    tmdbDetailCache.set(url, p);
  }
  return p;
};
const tmdbDetailUrl = (apiUrl: string, tmdbId: string | number, mediaType?: string) =>
  `${apiUrl}/api/tmdb-movie/${tmdbId}${mediaType ? `?type=${mediaType}` : ''}`;

export default function MyListPage() {
  usePageTitle('My List');
  const router = useRouter();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState<TabType>('watchlist');
  const [watchlist, setWatchlist] = useState<Media[]>([]);
  const [filteredList, setFilteredList] = useState<Media[]>([]);
  const [filterType, setFilterType] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("added");
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [downloadingMedia, setDownloadingMedia] = useState<DownloadingMedia[]>([]);
  const [userCollections, setUserCollections] = useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [collectionItems, setCollectionItems] = useState<CollectionItem[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [collectionForm, setCollectionForm] = useState({
    name: '',
    description: '',
    is_public: false,
    tags: ''
  });

  // Use the My List hook for both collections and my list
  const { myList, collections, fetchCollections, isInMyList, toggleMyList, addToCollection, removeFromMyList: removeFromMyListHook, removeFromCollection } = useMyList();

  // Refresh function to be called after tooltip operations
  const refreshData = async () => {
    console.log('Refreshing my-list data...');
    try {
      await Promise.all([
        fetchWatchlist(),
        fetchUserCollections(),
        fetchCollections()
      ]);
      console.log('My-list data refreshed successfully');
    } catch (error) {
      console.error('Error refreshing my-list data:', error);
    }
  };

  // Manual refresh function for the refresh button
  const handleManualRefresh = async () => {
    setLoading(true);
    await refreshData();
    setLoading(false);
  };

  useEffect(() => {
    fetchWatchlist();
    fetchUserCollections();
  }, []);

  // Fetch downloads when watchlist changes
  useEffect(() => {
    if (watchlist.length >= 0) {
      fetchDownloads();
    }
  }, [watchlist]);

  // Set up polling for download updates
  useEffect(() => {
    const interval = setInterval(() => {
      fetchDownloads();
    }, 3000);
    return () => clearInterval(interval);
  }, [watchlist]);

  useEffect(() => {
    filterAndSortList();
  }, [watchlist, filterType, sortBy]);

  const fetchWatchlist = async () => {
    try {
      const apiUrl = getApiUrl();
      console.log('Fetching watchlist from API:', apiUrl);
      
      // Try to fetch from backend My List first
      try {
        const response = await fetch(`${apiUrl}/api/mylist`, {
          headers: {
            'X-User-ID': '1'
          }
        });
        
        console.log('My List API response status:', response.status);
        
        if (response.ok) {
          const myListItems = await response.json();
          console.log('My List items from backend:', myListItems.length, 'items');
          
          const mediaList = [];
          // Start every TMDB lookup in parallel before the ordered loop.
          for (const item of myListItems) {
            if (!(item.media && item.media.id && item.media.title) && item.media_id && item.media_id.toString().startsWith('9')) {
              tmdbFetch(tmdbDetailUrl(apiUrl, item.media_id.toString().substring(1), item.media_type || 'movie')).catch(() => undefined);
            }
          }
          for (const item of myListItems) {
            if (item.media && item.media.id && item.media.title) {
              // Local media - use as is
              console.log('Processing local media:', item.media.title);
              mediaList.push(item.media);
            } else if (item.media_id && item.media_id.toString().startsWith('9')) {
              // TMDB content - reconstruct media object
              const tmdbId = item.media_id.toString().substring(1); // Remove the '9' prefix
              console.log('Processing TMDB content with ID:', item.media_id, 'TMDB ID:', tmdbId);
              try {
                // Fetch TMDB data to reconstruct media object
                const tmdbResponse = await tmdbFetch(tmdbDetailUrl(apiUrl, tmdbId, item.media_type || 'movie'));
                if (tmdbResponse.ok) {
                  const tmdbData = await tmdbResponse.json();
                  const mediaData = tmdbData.data || tmdbData;
                  const mediaType = tmdbData.media_type || item.media_type || 'movie';
                  
                  const reconstructedMedia = {
                    id: item.media_id, // Use the prefixed ID
                    title: mediaData.title || mediaData.name,
                    type: mediaType === 'tv' ? 'episode' : 'movie',
                    year: mediaData.release_date || mediaData.first_air_date 
                      ? new Date(mediaData.release_date || mediaData.first_air_date).getFullYear() 
                      : new Date().getFullYear(),
                    rating: mediaData.vote_average || 0,
                    genres: mediaData.genres?.map((g: any) => ({ name: g.name })) || [],
                    tmdb_id: parseInt(tmdbId),
                    poster_url: mediaData.poster_path ? `https://image.tmdb.org/t/p/w500${mediaData.poster_path}` : null,
                    poster_path: mediaData.poster_path,
                    description: mediaData.overview,
                    media_type: mediaType
                  };
                  console.log('Successfully reconstructed TMDB media:', reconstructedMedia.title);
                  mediaList.push(reconstructedMedia);
                } else {
                  console.error('Failed to fetch TMDB data for ID:', tmdbId, 'Status:', tmdbResponse.status);
                }
              } catch (tmdbError) {
                console.error('Error fetching TMDB data for media_id:', item.media_id, tmdbError);
                // Create a minimal media object as fallback
                mediaList.push({
                  id: item.media_id,
                  title: `TMDB Content ${tmdbId}`,
                  type: item.media_type === 'tv' ? 'episode' : 'movie',
                  year: new Date().getFullYear(),
                  rating: 0,
                  genres: [],
                  tmdb_id: parseInt(tmdbId),
                  poster_url: null
                });
              }
            } else {
              console.log('Skipping item with no valid media data:', item);
            }
          }
          
          console.log('Processed media list:', mediaList.length, 'items');
          setWatchlist(mediaList);
          if (mediaList.length > 0) {
            preloadAssets(mediaList, ['poster', 'thumbnail']);
          }
          setLoading(false);
          return;
        }
      } catch (backendError) {
        console.log('Backend My List error:', backendError);
        console.log('Backend My List not available, falling back to cookies');
      }
      
      // Fallback to cookie-based wishlist
      console.log('Using cookie-based wishlist fallback');
      const wishlistMedia = await fetchWishlistMedia(apiUrl);
      console.log('Cookie-based wishlist media:', wishlistMedia.length, 'items');
      setWatchlist(wishlistMedia);
      if (wishlistMedia.length > 0) {
        preloadAssets(wishlistMedia, ['poster', 'thumbnail']);
      }
      setLoading(false);
    } catch (error) {
      console.error("Error fetching watchlist:", error);
      setWatchlist([]);
      setLoading(false);
    }
  };

  const fetchUserCollections = async () => {
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/collections`, {
        headers: {
          'X-User-ID': '1'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setUserCollections(data || []);
      } else {
        console.error("Failed to fetch collections");
        setUserCollections([]);
      }
    } catch (error) {
      console.error("Error fetching collections:", error);
      setUserCollections([]);
    }
  };

  const handleCreateCollection = async () => {
    if (!collectionForm.name.trim()) return;

    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/collections`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': '1'
        },
        body: JSON.stringify({
          name: collectionForm.name,
          description: collectionForm.description,
          is_public: collectionForm.is_public,
          tags: collectionForm.tags
        })
      });

      if (response.ok) {
        await fetchUserCollections();
        setCollectionForm({ name: '', description: '', is_public: false, tags: '' });
        setShowCollectionModal(false);
        setEditingCollection(null);
      } else {
        console.error("Failed to create collection");
      }
    } catch (error) {
      console.error("Error creating collection:", error);
    }
  };

  const handleUpdateCollection = async () => {
    if (!collectionForm.name.trim() || !editingCollection) return;

    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/collections/${editingCollection.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': '1'
        },
        body: JSON.stringify({
          name: collectionForm.name,
          description: collectionForm.description,
          is_public: collectionForm.is_public,
          tags: collectionForm.tags
        })
      });

      if (response.ok) {
        await fetchUserCollections();
        setCollectionForm({ name: '', description: '', is_public: false, tags: '' });
        setShowCollectionModal(false);
        setEditingCollection(null);
        // If we're viewing the edited collection, refresh it
        if (selectedCollection && selectedCollection.id === editingCollection.id) {
          setSelectedCollection(null);
        }
      } else {
        console.error("Failed to update collection");
      }
    } catch (error) {
      console.error("Error updating collection:", error);
    }
  };

  const handleDeleteCollection = async (collectionId: number) => {
    if (!confirm('Are you sure you want to delete this collection? This action cannot be undone.')) {
      return;
    }

    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/collections/${collectionId}`, {
        method: 'DELETE',
        headers: {
          'X-User-ID': '1'
        }
      });

      if (response.ok) {
        await fetchUserCollections();
        // If we're viewing the deleted collection, close it
        if (selectedCollection && selectedCollection.id === collectionId) {
          setSelectedCollection(null);
          setCollectionItems([]);
        }
      } else {
        console.error("Failed to delete collection");
      }
    } catch (error) {
      console.error("Error deleting collection:", error);
    }
  };

  const openEditModal = (collection: Collection) => {
    setEditingCollection(collection);
    setCollectionForm({
      name: collection.name,
      description: collection.description || '',
      is_public: collection.is_public,
      tags: collection.tags || ''
    });
    setShowCollectionModal(true);
  };

  const openCreateModal = () => {
    setEditingCollection(null);
    setCollectionForm({ name: '', description: '', is_public: false, tags: '' });
    setShowCollectionModal(true);
  };

  const closeCollectionModal = () => {
    setShowCollectionModal(false);
    setEditingCollection(null);
    setCollectionForm({ name: '', description: '', is_public: false, tags: '' });
  };

  const fetchCollectionItems = async (collectionId: number) => {
    try {
      setCollectionsLoading(true);
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/collections/${collectionId}/items`, {
        headers: {
          'X-User-ID': '1'
        }
      });
      
      if (response.ok) {
        const items = await response.json();
        
        // Process items to handle TMDB content
        const processedItems = [];
        for (const item of items) {
          if (!(item.media && item.media.id && item.media.title) && item.media_id && item.media_id.toString().startsWith('9')) {
            tmdbFetch(tmdbDetailUrl(apiUrl, item.media_id.toString().substring(1), item.media_type)).catch(() => undefined);
          }
        }
        for (const item of items) {
          if (item.media && item.media.id && item.media.title) {
            // Local media - use as is
            processedItems.push(item);
          } else if (item.media_id && item.media_id.toString().startsWith('9')) {
            // TMDB content - reconstruct media object
            const tmdbId = item.media_id.toString().substring(1); // Remove the '9' prefix
            try {
              // Fetch TMDB data to reconstruct media object
              // Pass the type when known: without it the backend tries the id as
              // a movie first, so TV entries could resolve to an unrelated movie.
              const tmdbResponse = await tmdbFetch(tmdbDetailUrl(apiUrl, tmdbId, item.media_type));
              if (tmdbResponse.ok) {
                const tmdbData = await tmdbResponse.json();
                const mediaData = tmdbData.data || tmdbData;
                const mediaType = tmdbData.media_type || item.media_type || 'movie';
                
                const reconstructedMedia = {
                  id: item.media_id, // Use the prefixed ID
                  title: mediaData.title || mediaData.name,
                  type: mediaType === 'tv' ? 'episode' : 'movie',
                  year: mediaData.release_date || mediaData.first_air_date 
                    ? new Date(mediaData.release_date || mediaData.first_air_date).getFullYear() 
                    : new Date().getFullYear(),
                  rating: mediaData.vote_average || 0,
                  genres: mediaData.genres?.map((g: any) => ({ name: g.name })) || [],
                  tmdb_id: parseInt(tmdbId),
                  poster_url: mediaData.poster_path ? `https://image.tmdb.org/t/p/w500${mediaData.poster_path}` : null,
                  poster_path: mediaData.poster_path,
                  description: mediaData.overview,
                  media_type: mediaType
                };
                
                processedItems.push({
                  ...item,
                  media: reconstructedMedia
                });
              }
            } catch (tmdbError) {
              console.error('Error fetching TMDB data for collection item:', item.media_id, tmdbError);
              // Create a minimal media object as fallback
              processedItems.push({
                ...item,
                media: {
                  id: item.media_id,
                  title: `TMDB Content ${tmdbId}`,
                  type: 'movie',
                  year: new Date().getFullYear(),
                  rating: 0,
                  genres: [],
                  tmdb_id: parseInt(tmdbId),
                  poster_url: null
                }
              });
            }
          }
        }
        
        setCollectionItems(processedItems);
      } else {
        console.error("Failed to fetch collection items");
        setCollectionItems([]);
      }
    } catch (error) {
      console.error("Error fetching collection items:", error);
      setCollectionItems([]);
    } finally {
      setCollectionsLoading(false);
    }
  };

  const fetchDownloads = async () => {
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/torrents/downloads?limit=100`);
      if (response.ok) {
        const data = await response.json();
        const downloads = data.downloads || [];
        const downloadingItems: DownloadingMedia[] = [];
        for (const download of downloads) {
          if (download.tmdb_id && (download.status === 'downloading' || download.status === 'paused')) {
            tmdbFetch(tmdbDetailUrl(apiUrl, download.tmdb_id, download.media_type || 'movie')).catch(() => undefined);
          }
        }
        
        for (const download of downloads) {
          // Show both downloading and paused downloads in the downloads tab
          if (download.tmdb_id && (download.status === 'downloading' || download.status === 'paused')) {
            const tmdbWishlistId = parseInt(`9${download.tmdb_id}`);
            const wishlistItem = watchlist.find(item => item.id === tmdbWishlistId);
            
            if (wishlistItem) {
              downloadingItems.push({
                ...wishlistItem,
                downloadInfo: download
              });
            } else {
              try {
                const tmdbResponse = await tmdbFetch(tmdbDetailUrl(apiUrl, download.tmdb_id, download.media_type || 'movie'));
                if (tmdbResponse.ok) {
                  const tmdbData = await tmdbResponse.json();
                  const mediaData = tmdbData.data || tmdbData;
                  const mediaType = tmdbData.media_type || download.media_type || 'movie';
                  const posterUrl = mediaData.poster_path 
                    ? `https://image.tmdb.org/t/p/w500${mediaData.poster_path}` 
                    : null;
                  
                  downloadingItems.push({
                    id: tmdbWishlistId,
                    title: mediaData.title || mediaData.name || download.name,
                    type: mediaType === 'tv' ? 'episode' : 'movie',
                    year: mediaData.release_date || mediaData.first_air_date 
                      ? new Date(mediaData.release_date || mediaData.first_air_date).getFullYear() 
                      : new Date().getFullYear(),
                    rating: mediaData.vote_average || 0,
                    genres: mediaData.genres?.map((g: any) => ({ name: g.name })) || [],
                    tmdb_id: download.tmdb_id,
                    poster_url: posterUrl,
                    poster_path: mediaData.poster_path,
                    description: mediaData.overview,
                    media_type: mediaType,
                    downloadInfo: download
                  });
                } else {
                  downloadingItems.push({
                    id: tmdbWishlistId,
                    title: download.name,
                    type: download.media_type === 'tv' ? 'episode' : 'movie',
                    year: new Date().getFullYear(),
                    rating: 0,
                    genres: [],
                    tmdb_id: download.tmdb_id,
                    poster_url: null,
                    media_type: download.media_type || 'movie',
                    downloadInfo: download
                  });
                }
              } catch (tmdbError) {
                console.error('Error fetching TMDB data for download:', tmdbError);
                downloadingItems.push({
                  id: tmdbWishlistId,
                  title: download.name,
                  type: download.media_type === 'tv' ? 'episode' : 'movie',
                  year: new Date().getFullYear(),
                  rating: 0,
                  genres: [],
                  tmdb_id: download.tmdb_id,
                  poster_url: null,
                  media_type: download.media_type || 'movie',
                  downloadInfo: download
                });
              }
            }
          }
        }
        setDownloadingMedia(downloadingItems);
      }
    } catch (error) {
      console.error("Error fetching downloads:", error);
      setDownloadingMedia([]);
    }
  };

  const filterAndSortList = () => {
    let filtered = [...watchlist];
    if (filterType !== "all") {
      filtered = filtered.filter(media => media.type === filterType);
    }
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
        filtered.sort((a, b) => b.id - a.id);
        break;
    }
    setFilteredList(filtered);
  };

  const handlePlay = (media: Media) => {
    if (media.tmdb_id && media.id.toString().startsWith('9')) {
      // TMDB content - navigate to info page since we can't play directly
      handleInfo(media);
    } else {
      // Local content - open video player
      setSelectedMedia(media);
      setIsPlayerOpen(true);
    }
  };

  const handleInfo = (media: Media) => {
    if (media.tmdb_id && media.id.toString().startsWith('9')) {
      // TMDB content - route to TMDB movie page
      const mediaType = media.media_type || (media.type === 'episode' ? 'tv' : 'movie');
      navigate.push(`/tmdb-movie/${media.tmdb_id}?type=${mediaType}`);
    } else {
      // Local content - route to local movie page
      navigate.push(`/movie/${media.id}`);
    }
  };

  const handleRemoveFromList = async (mediaId: number) => {
    try {
      // Try backend My List first
      const success = await removeFromMyListHook(mediaId);
      if (success) {
        setWatchlist(prev => prev.filter(item => item.id !== mediaId));
        return;
      }
      
      // Fallback to cookie-based wishlist
      const success2 = removeFromWishlist(mediaId);
      if (success2) {
        setWatchlist(prev => prev.filter(item => item.id !== mediaId));
      }
    } catch (error) {
      console.error("Error removing from wishlist:", error);
    }
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
      if (media.tmdb_id && media.id.toString().startsWith('9')) {
        // TMDB content - route to TMDB movie page
        const mediaType = downloadInfo.media_type || (media.type === 'episode' ? 'tv' : 'movie');
        navigate.push(`/tmdb-movie/${media.tmdb_id}?type=${mediaType}`);
      } else {
        // Local content - route to local movie page
        navigate.push(`/movie/${media.id}`);
      }
    };

    const getPosterUrl = () => {
      if (media.poster_url) return media.poster_url;
      if (media.poster_path) return `https://image.tmdb.org/t/p/w300${media.poster_path}`;
      return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg width="300" height="450" viewBox="0 0 300 450" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="300" height="450" fill="#374151"/><rect x="50" y="150" width="200" height="150" rx="10" fill="#6B7280"/><text x="150" y="240" text-anchor="middle" fill="#D1D5DB" font-family="Arial, sans-serif" font-size="14" font-weight="bold">${media.title.length > 20 ? media.title.substring(0, 20) + '...' : media.title}</text><text x="150" y="260" text-anchor="middle" fill="#9CA3AF" font-family="Arial, sans-serif" font-size="12">${media.type === 'episode' ? 'TV Series' : 'Movie'}</text></svg>`)}`;
    };

    return (
      <div
        className="relative group cursor-pointer bg-gray-800 rounded-lg overflow-hidden hover:bg-gray-700 transition-all duration-300 hover:scale-105"
        onClick={handleClick}
      >
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
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <div className="relative w-16 h-16">
              <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="28" stroke="rgba(255,255,255,0.2)" strokeWidth="4" fill="none" />
                <circle
                  cx="32" cy="32" r="28"
                  stroke="#ef4444"
                  strokeWidth="4"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 28}`}
                  strokeDashoffset={`${2 * Math.PI * 28 * (1 - progress / 100)}`}
                  className="transition-all duration-300"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-white text-xs font-bold">{progress.toFixed(0)}%</span>
              </div>
            </div>
          </div>
          <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm rounded-full p-2">
            {getStatusIcon(downloadInfo.status)}
          </div>
        </div>
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
      <div className="min-h-screen text-white">
        <Navbar />
        <TVPageShell>
          <TVPageHeader title="My List" subtitle="Everything you've saved, downloading and collected" className="mb-8" />
          <TVGridSkeleton />
        </TVPageShell>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white">
      <Navbar />
      
      <div className="tv-gutter pb-24 pt-24 md:pt-28">
        <TVPageHeader
          title="My List"
          subtitle="Everything you've saved, downloading and collected"
          className="mb-6"
          actions={
            <button
              onClick={handleManualRefresh}
              disabled={loading}
              className="tv-btn tv-btn-secondary"
              title="Refresh lists and collections"
            >
              <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          }
        />

        {/* Tabs */}
        <TVSegmented
          className="mb-8"
          ariaLabel="My List sections"
          value={activeTab}
          onChange={(k) => setActiveTab(k)}
          segments={[
            { key: 'watchlist', label: 'Watchlist', icon: <Heart className="w-4 h-4" />, badge: filteredList.length },
            { key: 'downloads', label: 'Downloads', icon: <Download className="w-4 h-4" />, badge: downloadingMedia.length || null },
            { key: 'collections', label: 'Collections', icon: <FolderOpen className="w-4 h-4" />, badge: userCollections.length },
          ]}
        />

        {/* Tab Content */}
        {activeTab === 'watchlist' && (
          <>
            {/* Controls */}
            <div className="flex flex-wrap gap-4 mb-6">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-48 rounded-full border-white/10 bg-white/[0.08] text-white backdrop-blur-xl">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-white/10 bg-zinc-900/95 backdrop-blur-2xl">
                  <SelectItem value="all" className="text-white hover:bg-gray-700">All Types</SelectItem>
                  <SelectItem value="movie" className="text-white hover:bg-gray-700">Movies</SelectItem>
                  <SelectItem value="episode" className="text-white hover:bg-gray-700">TV Shows</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-48 rounded-full border-white/10 bg-white/[0.08] text-white backdrop-blur-xl">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-white/10 bg-zinc-900/95 backdrop-blur-2xl">
                  <SelectItem value="added" className="text-white hover:bg-gray-700">Recently Added</SelectItem>
                  <SelectItem value="title" className="text-white hover:bg-gray-700">Title A-Z</SelectItem>
                  <SelectItem value="rating" className="text-white hover:bg-gray-700">Highest Rated</SelectItem>
                  <SelectItem value="year" className="text-white hover:bg-gray-700">Release Year</SelectItem>
                </SelectContent>
              </Select>
            </div>



            {filteredList.length > 0 ? (
              <>
                {/* Separate Local and TMDB Content */}
                {(() => {
                  const localContent = filteredList.filter(m => !m.tmdb_id || !m.id.toString().startsWith('9'));
                  const tmdbContent = filteredList.filter(m => m.tmdb_id && m.id.toString().startsWith('9'));
                  
                  return (
                    <>
                      {/* Local Content Section */}
                      {localContent.length > 0 && (
                        <div className="mb-8">
                          <div className="flex items-center gap-3 mb-4">
                            <Film className="w-5 h-5 text-green-400" />
                            <h3 className="text-xl font-bold text-white">Library</h3>
                            <span className="text-sm text-gray-400">({localContent.length} items)</span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-x-5 gap-y-8">
                            {localContent.map((media, index) => (
                              <div key={media.id} className="relative">
                                <MyListTooltip
                                  media={media}
                                  isInMyList={true}
                                  collections={collections}
                                  onToggleMyList={() => {
                                    handleRemoveFromList(media.id);
                                    setTimeout(() => refreshData(), 500);
                                  }}
                                  onAddToCollection={(collectionId) => {
                                    addToCollection(collectionId, media.id);
                                    setTimeout(() => refreshData(), 500);
                                  }}
                                  onCollectionCreated={() => {
                                    fetchUserCollections();
                                    setTimeout(() => refreshData(), 500);
                                  }}
                                  onDataRefresh={refreshData}
                                >
                                  <NetflixMediaCard
                                    media={media}
                                    onPlay={handlePlay}
                                    onInfo={handleInfo}
                                    onAddToList={() => handleRemoveFromList(media.id)}
                                    isInList={true}
                                    priority={index < 12 ? 'high' : 'normal'}
                                    showPreviewOnHover={true}
                                  />
                                </MyListTooltip>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* TMDB Content Section */}
                      {tmdbContent.length > 0 && (
                        <div>
                          <div className="flex items-center gap-3 mb-4">
                            <Tv className="w-5 h-5 text-blue-400" />
                            <h3 className="text-xl font-bold text-white">TMDB</h3>
                            <span className="text-sm text-gray-400">({tmdbContent.length} items)</span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-x-5 gap-y-8">
                            {tmdbContent.map((media, index) => (
                              <div key={media.id} className="relative">
                                <MyListTooltip
                                  media={media}
                                  isInMyList={true}
                                  collections={collections}
                                  onToggleMyList={() => {
                                    handleRemoveFromList(media.id);
                                    setTimeout(() => refreshData(), 500);
                                  }}
                                  onAddToCollection={(collectionId) => {
                                    addToCollection(collectionId, media.id);
                                    setTimeout(() => refreshData(), 500);
                                  }}
                                  onCollectionCreated={() => {
                                    fetchUserCollections();
                                    setTimeout(() => refreshData(), 500);
                                  }}
                                  onDataRefresh={refreshData}
                                >
                                  <NetflixMediaCard
                                    media={media}
                                    onPlay={handlePlay}
                                    onInfo={handleInfo}
                                    onAddToList={() => handleRemoveFromList(media.id)}
                                    isInList={true}
                                    priority={index < 12 ? 'high' : 'normal'}
                                    showPreviewOnHover={true}
                                  />
                                </MyListTooltip>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </>
            ) : (
              <div className="text-center py-16">
                <Heart className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl text-white mb-2">Your list is empty</h3>
                <p className="text-gray-400 mb-6">
                  {filterType !== "all"
                    ? `No ${filterType === "movie" ? "movies" : "TV shows"} in your list`
                    : "Add movies and TV shows to your list to see them here"}
                </p>
                <MagneticButton
                  onClick={() => router.push('/browse')}
                  className="bg-[#f5f5f7] hover:bg-white text-black px-6 py-3 rounded-lg font-semibold"
                >
                  Browse Content
                </MagneticButton>
              </div>
            )}
          </>
        )}

        {activeTab === 'downloads' && (
          <>
            {downloadingMedia.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4">
                {downloadingMedia.map((media) => (
                  <DownloadingMediaCard key={`download-${media.id}`} media={media} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <Download className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl text-white mb-2">No active downloads</h3>
                <p className="text-gray-400 mb-6">
                  Your downloads will appear here when you start downloading content
                </p>
                <MagneticButton
                  onClick={() => router.push('/browse')}
                  className="bg-[#f5f5f7] hover:bg-white text-black px-6 py-3 rounded-lg font-semibold"
                >
                  Browse Content
                </MagneticButton>
              </div>
            )}
          </>
        )}

        {activeTab === 'collections' && (
          <>
            {/* Header with Create Button */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Your Collections</h2>
              <MagneticButton
                onClick={openCreateModal}
                className="bg-[#f5f5f7] hover:bg-white text-black px-4 py-2 rounded-lg font-semibold flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create Collection
              </MagneticButton>
            </div>

            {userCollections.length > 0 ? (
              <div className="space-y-6">
                {/* Collections Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {userCollections.map((collection) => (
                    <div
                      key={collection.id}
                      className="bg-gray-800 rounded-lg p-6 hover:bg-gray-700 transition-all duration-300 group relative"
                    >
                      <div
                        className="cursor-pointer"
                        onClick={() => {
                          setSelectedCollection(collection);
                          fetchCollectionItems(collection.id);
                        }}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <h3 className="text-white font-semibold text-lg mb-2 group-hover:text-red-400 transition-colors">
                              {collection.name}
                            </h3>
                            {collection.description && (
                              <p className="text-gray-400 text-sm line-clamp-2 mb-3">
                                {collection.description}
                              </p>
                            )}
                          </div>
                          <FolderOpen className="w-6 h-6 text-gray-400 group-hover:text-red-400 transition-colors" />
                        </div>
                        
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-400">
                            {collection.item_count} {collection.item_count === 1 ? 'item' : 'items'}
                          </span>
                          <span className="text-gray-500">
                            {collection.is_public ? 'Public' : 'Private'}
                          </span>
                        </div>
                        
                        {collection.tags && (
                          <div className="mt-3 flex flex-wrap gap-1">
                            {collection.tags.split(',').slice(0, 3).map((tag, index) => (
                              <span
                                key={index}
                                className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded-full"
                              >
                                {tag.trim()}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(collection);
                          }}
                          className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                          title="Edit collection"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCollection(collection.id);
                          }}
                          className="p-2 bg-[#f5f5f7] hover:bg-white text-black rounded transition-colors"
                          title="Delete collection"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Selected Collection Items */}
                {selectedCollection && (
                  <div className="mt-8">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h2 className="text-2xl font-bold text-white mb-2">
                          {selectedCollection.name}
                        </h2>
                        {selectedCollection.description && (
                          <p className="text-gray-400">{selectedCollection.description}</p>
                        )}
                      </div>
                      <Button
                        onClick={() => setSelectedCollection(null)}
                        className="bg-gray-700 hover:bg-gray-600 text-white"
                      >
                        Close
                      </Button>
                    </div>

                    {collectionsLoading ? (
                      <div className="flex items-center justify-center py-16">
                        <RedLoader size="medium" />
                      </div>
                    ) : collectionItems.length > 0 ? (
                      <>
                        {/* Separate Local and TMDB Content in Collections */}
                        {(() => {
                          const localItems = collectionItems.filter(item => !item.media.tmdb_id || !item.media.id.toString().startsWith('9'));
                          const tmdbItems = collectionItems.filter(item => item.media.tmdb_id && item.media.id.toString().startsWith('9'));
                          
                          return (
                            <>
                              {/* Local Content Section */}
                              {localItems.length > 0 && (
                                <div className="mb-8">
                                  <div className="flex items-center gap-3 mb-4">
                                    <Film className="w-5 h-5 text-green-400" />
                                    <h3 className="text-xl font-bold text-white">Library</h3>
                                    <span className="text-sm text-gray-400">({localItems.length} items)</span>
                                  </div>
                                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-x-5 gap-y-8">
                                    {localItems.map((item, index) => (
                                      <div key={item.id} className="relative">
                                        <MyListTooltip
                                          media={item.media}
                                          isInMyList={isInMyList(item.media.id)}
                                          collections={collections.filter(c => c.id !== selectedCollection?.id)}
                                          onToggleMyList={() => {
                                            toggleMyList(item.media.id);
                                            setTimeout(() => refreshData(), 500);
                                          }}
                                          onAddToCollection={(collectionId) => {
                                            addToCollection(collectionId, item.media.id);
                                            setTimeout(() => refreshData(), 500);
                                          }}
                                          onRemoveFromCollection={(collectionId) => {
                                            removeFromCollection(collectionId, item.media.id).then(() => {
                                              if (selectedCollection) {
                                                fetchCollectionItems(selectedCollection.id);
                                              }
                                              setTimeout(() => refreshData(), 500);
                                            });
                                          }}
                                          currentCollectionId={selectedCollection?.id}
                                          onCollectionCreated={() => {
                                            fetchUserCollections();
                                            setTimeout(() => refreshData(), 500);
                                          }}
                                          onDataRefresh={refreshData}
                                        >
                                          <NetflixMediaCard
                                            media={item.media}
                                            onPlay={handlePlay}
                                            onInfo={handleInfo}
                                            onAddToList={() => toggleMyList(item.media.id)}
                                            isInList={isInMyList(item.media.id)}
                                            priority={index < 12 ? 'high' : 'normal'}
                                            showPreviewOnHover={true}
                                          />
                                        </MyListTooltip>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* TMDB Content Section */}
                              {tmdbItems.length > 0 && (
                                <div>
                                  <div className="flex items-center gap-3 mb-4">
                                    <Tv className="w-5 h-5 text-blue-400" />
                                    <h3 className="text-xl font-bold text-white">TMDB</h3>
                                    <span className="text-sm text-gray-400">({tmdbItems.length} items)</span>
                                  </div>
                                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-x-5 gap-y-8">
                                    {tmdbItems.map((item, index) => (
                                      <div key={item.id} className="relative">
                                        <MyListTooltip
                                          media={item.media}
                                          isInMyList={isInMyList(item.media.id)}
                                          collections={collections.filter(c => c.id !== selectedCollection?.id)}
                                          onToggleMyList={() => {
                                            toggleMyList(item.media.id);
                                            setTimeout(() => refreshData(), 500);
                                          }}
                                          onAddToCollection={(collectionId) => {
                                            addToCollection(collectionId, item.media.id);
                                            setTimeout(() => refreshData(), 500);
                                          }}
                                          onRemoveFromCollection={(collectionId) => {
                                            removeFromCollection(collectionId, item.media.id).then(() => {
                                              if (selectedCollection) {
                                                fetchCollectionItems(selectedCollection.id);
                                              }
                                              setTimeout(() => refreshData(), 500);
                                            });
                                          }}
                                          currentCollectionId={selectedCollection?.id}
                                          onCollectionCreated={() => {
                                            fetchUserCollections();
                                            setTimeout(() => refreshData(), 500);
                                          }}
                                          onDataRefresh={refreshData}
                                        >
                                          <NetflixMediaCard
                                            media={item.media}
                                            onPlay={handlePlay}
                                            onInfo={handleInfo}
                                            onAddToList={() => toggleMyList(item.media.id)}
                                            isInList={isInMyList(item.media.id)}
                                            priority={index < 12 ? 'high' : 'normal'}
                                            showPreviewOnHover={true}
                                          />
                                        </MyListTooltip>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </>
                    ) : (
                      <div className="text-center py-16">
                        <Grid3X3 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                        <h3 className="text-xl text-white mb-2">Collection is empty</h3>
                        <p className="text-gray-400">
                          This collection doesn't have any items yet
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-16">
                <FolderOpen className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl text-white mb-2">No collections yet</h3>
                <p className="text-gray-400 mb-6">
                  Create collections to organize your favorite movies and TV shows
                </p>
                <MagneticButton
                  onClick={openCreateModal}
                  className="bg-[#f5f5f7] hover:bg-white text-black px-6 py-3 rounded-lg font-semibold"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Collection
                </MagneticButton>
              </div>
            )}
          </>
        )}
      </div>

      {selectedMedia && (
        <VideoPlayer
          media={selectedMedia}
          isOpen={isPlayerOpen}
          onClose={() => setIsPlayerOpen(false)}
          startTime={0}
          onPlayNext={(nextMedia) => {
            setSelectedMedia(nextMedia);
          }}
        />
      )}

      {/* Collection Create/Edit Modal */}
      {showCollectionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={closeCollectionModal}>
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">
                {editingCollection ? 'Edit Collection' : 'Create Collection'}
              </h3>
              <button
                onClick={closeCollectionModal}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-white text-sm font-medium mb-2">
                  Collection Name *
                </label>
                <input
                  type="text"
                  value={collectionForm.name}
                  onChange={(e) => setCollectionForm({ ...collectionForm, name: e.target.value })}
                  placeholder="My Awesome Collection"
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-red-500 focus:outline-none"
                />
              </div>
              
              <div>
                <label className="block text-white text-sm font-medium mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={collectionForm.description}
                  onChange={(e) => setCollectionForm({ ...collectionForm, description: e.target.value })}
                  placeholder="Describe your collection..."
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-red-500 focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-white text-sm font-medium mb-2">
                  Tags (Optional)
                </label>
                <input
                  type="text"
                  value={collectionForm.tags}
                  onChange={(e) => setCollectionForm({ ...collectionForm, tags: e.target.value })}
                  placeholder="action, thriller, comedy (comma-separated)"
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-red-500 focus:outline-none"
                />
                <p className="text-gray-400 text-xs mt-1">Separate tags with commas</p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_public"
                  checked={collectionForm.is_public}
                  onChange={(e) => setCollectionForm({ ...collectionForm, is_public: e.target.checked })}
                  className="w-4 h-4 text-red-600 bg-gray-700 border-gray-600 rounded focus:ring-red-500"
                />
                <label htmlFor="is_public" className="text-white text-sm">
                  Make this collection public
                </label>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={closeCollectionModal}
                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={editingCollection ? handleUpdateCollection : handleCreateCollection}
                disabled={!collectionForm.name.trim()}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded transition-colors"
              >
                {editingCollection ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
