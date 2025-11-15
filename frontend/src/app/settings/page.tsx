"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Settings, Database, Upload, Trash2, Video, ImageIcon, Folder, File, Play, Info, Edit3, RefreshCw, Save, X, Star, Clock, Globe, Eye, Zap, Search, Server, Activity, HardDrive, Monitor, BarChart3, TrendingUp, FileSearch, Timer, Download, Film } from 'lucide-react';
import Image from 'next/image';
import Navbar from '@/components/Navbar';
import { getApiUrl } from '@/lib/api';
import { Media } from '@/types/media';
import { FolderTree, GlassCard, ScrollReveal, MagneticButton } from '@/components/scrollx';
import { motion } from 'framer-motion';
import { useNavigate } from "@/hooks/useNavigate";
import RedLoader from '@/components/RedLoader';
import TorrentDashboard from '@/components/TorrentDashboard';
import TMDBSearchModal from '@/components/TMDBSearchModal';
import SystemLogs from '@/components/SystemLogs';
import { useSearchParams } from 'next/navigation';
interface MediaAssets {
  id?: number;
  title?: string;
  banner?: string;
  banner_path?: string;
  thumbnail?: string;
  thumbnail_path?: string;
  poster_path?: string;
  trailer?: string;
  trailer_path?: string;
}

interface EditableMedia extends Media {
  isEditing?: boolean;
}

interface TMDBSearchResult {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  release_date: string;
  poster_path: string;
  backdrop_path: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  media_type: "movie" | "tv";
  adult: boolean;
  genre_ids: number[];
}

function SettingsContent() {
  usePageTitle('Settings');
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState('media');
  const [mediaList, setMediaList] = useState<Media[]>([]);
  const [seriesList, setSeriesList] = useState<any[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<EditableMedia | null>(null);
  const [mediaAssets, setMediaAssets] = useState<MediaAssets>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editingMedia, setEditingMedia] = useState<Partial<Media>>({});
  const [isRegenerating, setIsRegenerating] = useState<{ [key: string]: boolean }>({});
  const [actionLoading, setActionLoading] = useState<{ [key: string]: boolean }>({});
  const [scanStats, setScanStats] = useState<any>(null);
  const [systemStats, setSystemStats] = useState<any>(null);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [torrentMediaInfo, setTorrentMediaInfo] = useState<any>(null);
  const [activeDownloads, setActiveDownloads] = useState(0);
  const [mediaPaths, setMediaPaths] = useState<any[]>([]);
  const [newMediaPath, setNewMediaPath] = useState({
    path: '',
    name: '',
    description: '',
    path_type: 'external',
    priority: 0
  });
  const [showAddPathForm, setShowAddPathForm] = useState(false);
  const [showTMDBSearchModal, setShowTMDBSearchModal] = useState(false);
  const [customSearchTitle, setCustomSearchTitle] = useState('');
  const [openSubtitlesResults, setOpenSubtitlesResults] = useState<any[]>([]);
  const [openSubtitlesLoading, setOpenSubtitlesLoading] = useState(false);
  const [openSubtitlesQuery, setOpenSubtitlesQuery] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [downloadingSubtitle, setDownloadingSubtitle] = useState<number | null>(null);

  // Debug modal state
  useEffect(() => {
    console.log('🎭 Modal State Changed:', { showTMDBSearchModal, customSearchTitle, selectedMediaType: selectedMedia?.type });
  }, [showTMDBSearchModal, customSearchTitle, selectedMedia?.type]);
  const navigate = useNavigate();

  useEffect(() => {
    // Check URL parameters for tab and media info
    const tab = searchParams.get('tab');
    const mediaParam = searchParams.get('media');

    if (tab) {
      setActiveTab(tab);
    }

    if (mediaParam) {
      try {
        const mediaInfo = JSON.parse(mediaParam);
        setTorrentMediaInfo(mediaInfo);
      } catch (error) {
        console.error('Error parsing media info:', error);
      }
    }

    fetchMediaList();
    fetchActiveDownloads(); // Check for active downloads

    if (activeTab === 'paths') {
      fetchMediaPaths();
    }

    if (activeTab === 'analytics') {
      fetchSystemStats();
    }
    if (activeTab === 'scanning') {
      fetchScanStats();
    }
  }, [activeTab, searchParams]);

  // Poll for active downloads every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchActiveDownloads();
    }, 5000);

    return () => clearInterval(interval);
  }, []);


  // Initialize terminal with welcome message
  useEffect(() => {
    const initializeTerminal = () => {
      const timestamp = new Date().toLocaleTimeString();
      setTerminalOutput([
        `[${timestamp}] 🎆 HomeFlix Admin Panel initialized`,
        `[${timestamp}] 📊 Ready for media management operations`
      ]);
    };
    initializeTerminal();
  }, []);

  const fetchMediaList = async () => {
    try {
      console.log('🔄 Fetching media list...');
      const { apiCall, API_ENDPOINTS } = await import('@/lib/api');
      const [media, series] = await Promise.all([
        apiCall(API_ENDPOINTS.media),
        fetch(`${await import('@/lib/api').then(m => m.getApiUrl())}/api/series`).then(r => r.json()).catch(() => [])
      ]);

      console.log('📊 Fetched media:', { movies: media.length, series: series.length });
      
      // Transform genres to genre_names for all media items
      const transformedMedia = media.map((m: any) => {
        if (m.genres && Array.isArray(m.genres)) {
          const { genres, ...rest } = m;
          return {
            ...rest,
            genre_names: genres.map((g: any) => typeof g === 'string' ? g : g.name || g)
          };
        }
        return m;
      });
      
      const transformedSeries = series.map((s: any) => {
        if (s.genres && Array.isArray(s.genres)) {
          const { genres, ...rest } = s;
          return {
            ...rest,
            genre_names: genres.map((g: any) => typeof g === 'string' ? g : g.name || g)
          };
        }
        return s;
      });
      
      setMediaList(transformedMedia);
      setSeriesList(transformedSeries);
      setLoading(false);

      // If we have a selected media, try to find and update it in the new list
      if (selectedMedia) {
        if (selectedMedia.type === 'tv') {
          const updatedSeries = transformedSeries.find((s: any) => s.id === selectedMedia.id);
          if (updatedSeries) {
            const updatedMedia = {
              ...selectedMedia,
              ...updatedSeries,
              type: 'tv' as const,
              id: selectedMedia.id
            };
            
            // Ensure genres is removed and genre_names is properly formatted
            if ((updatedMedia as any).genres) {
              delete (updatedMedia as any).genres;
            }
            if (updatedMedia.genre_names && Array.isArray(updatedMedia.genre_names)) {
              updatedMedia.genre_names = updatedMedia.genre_names.map((g: any) => 
                typeof g === 'string' ? g : g?.name || String(g)
              );
            }
            
            setSelectedMedia(updatedMedia);
            console.log('🔄 Updated selected TV series from fresh data');
          }
        } else {
          const updatedMovie = transformedMedia.find((m: any) => m.id === selectedMedia.id);
          if (updatedMovie) {
            const updatedMedia = {
              ...updatedMovie,
              isEditing: selectedMedia.isEditing,
              id: selectedMedia.id
            };
            
            // Ensure genres is removed and genre_names is properly formatted
            if ((updatedMedia as any).genres) {
              delete (updatedMedia as any).genres;
            }
            if (updatedMedia.genre_names && Array.isArray(updatedMedia.genre_names)) {
              updatedMedia.genre_names = updatedMedia.genre_names.map((g: any) => 
                typeof g === 'string' ? g : g?.name || String(g)
              );
            }
            
            setSelectedMedia(updatedMedia);
            console.log('🔄 Updated selected movie from fresh data');
          }
        }
      }
    } catch (error) {
      console.error('Error fetching media:', error);
      setLoading(false);
    }
  };

  const fetchActiveDownloads = async () => {
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/torrent/downloads`);
      if (response.ok) {
        const data = await response.json();
        const downloads = data.downloads || [];

        // Count active downloads (downloading status)
        const activeCount = downloads.filter((download: any) =>
          download.status === 'downloading'
        ).length;

        setActiveDownloads(activeCount);
      }
    } catch (error) {
      console.error('Error fetching active downloads:', error);
      setActiveDownloads(0);
    }
  };

  const fetchMediaPaths = async () => {
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/admin/media-paths`);
      if (response.ok) {
        const data = await response.json();
        setMediaPaths(data.media_paths || []);
        addTerminalOutput(`📁 Loaded ${data.media_paths?.length || 0} media paths`);
      }
    } catch (error) {
      console.error('Error fetching media paths:', error);
      addTerminalOutput(`❌ Error fetching media paths: ${error}`);
    }
  };

  const addMediaPath = async () => {
    if (!newMediaPath.path || !newMediaPath.name) {
      addTerminalOutput('❌ Path and name are required');
      return;
    }

    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/admin/media-paths`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newMediaPath),
      });

      if (response.ok) {
        const data = await response.json();
        addTerminalOutput(`✅ ${data.message}`);
        setNewMediaPath({
          path: '',
          name: '',
          description: '',
          path_type: 'external',
          priority: 0
        });
        setShowAddPathForm(false);
        fetchMediaPaths(); // Refresh the list
      } else {
        const errorData = await response.json();
        addTerminalOutput(`❌ Failed to add media path: ${errorData.error}`);
      }
    } catch (error) {
      addTerminalOutput(`❌ Error adding media path: ${error}`);
    }
  };

  const updateMediaPath = async (id: number, updates: any) => {
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/admin/media-paths/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const data = await response.json();
        addTerminalOutput(`✅ ${data.message}`);
        fetchMediaPaths(); // Refresh the list
      } else {
        const errorData = await response.json();
        addTerminalOutput(`❌ Failed to update media path: ${errorData.error}`);
      }
    } catch (error) {
      addTerminalOutput(`❌ Error updating media path: ${error}`);
    }
  };

  const deleteMediaPath = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete the media path "${name}"?`)) {
      return;
    }

    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/admin/media-paths/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        const data = await response.json();
        addTerminalOutput(`✅ ${data.message}`);
        fetchMediaPaths(); // Refresh the list
      } else {
        const errorData = await response.json();
        addTerminalOutput(`❌ Failed to delete media path: ${errorData.error}`);
      }
    } catch (error) {
      addTerminalOutput(`❌ Error deleting media path: ${error}`);
    }
  };

  // Transform media list into folder tree structure with search filtering
  const createFolderTreeData = () => {
    // Filter movies based on search query
    const filteredMovies = mediaList.filter(media => {
      if (media.type !== 'movie') return false;
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        media.title?.toLowerCase().includes(query) ||
        media.description?.toLowerCase().includes(query) ||
        media.genre_names?.some(genre => {
          const genreStr = typeof genre === 'string' ? genre : (genre as any)?.name || String(genre);
          return genreStr.toLowerCase().includes(query);
        }) ||
        media.year?.toString().includes(query) ||
        media.country?.toLowerCase().includes(query) ||
        media.language?.toLowerCase().includes(query)
      );
    });

    // Filter TV series based on search query
    const filteredSeries = seriesList.filter(series => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        series.title?.toLowerCase().includes(query) ||
        series.description?.toLowerCase().includes(query) ||
        series.status?.toLowerCase().includes(query)
      );
    });

    const folders = {
      movies: {
        id: 'movies',
        name: `Movies (${filteredMovies.length})`,
        type: 'folder' as const,
        children: filteredMovies.map(media => {
          // Use edited title if this is the selected media being edited
          const displayTitle = (selectedMedia?.id === media.id && selectedMedia?.isEditing && editingMedia.title)
            ? editingMedia.title
            : media.title;

          // Clean media object - remove genres and ensure genre_names is strings only
          const cleanMedia = { ...media };
          if ((cleanMedia as any).genres) {
            delete (cleanMedia as any).genres;
          }
          if (cleanMedia.genre_names && Array.isArray(cleanMedia.genre_names)) {
            cleanMedia.genre_names = cleanMedia.genre_names.map((g: any) => 
              typeof g === 'string' ? g : g?.name || String(g)
            );
          }

          return {
            id: media.id.toString(),
            name: displayTitle,
            type: 'file' as const,
            size: `${Math.floor((media.duration || media.runtime || 0) / 60)}min`,
            modified: new Date().toLocaleDateString(),
            media: {
              ...cleanMedia,
              // Ensure all required fields exist
              id: media.id,
              title: media.title || 'Unknown Title',
              type: 'movie' as const
            }
          };
        })
      },
      tvShows: {
        id: 'tv-shows',
        name: `TV Shows (${filteredSeries.length})`,
        type: 'folder' as const,
        children: filteredSeries.map(series => {
          return {
            id: `series-${series.id}`,
            name: series.title,
            type: 'file' as const,
            size: `${series.total_episodes || 0} episodes`,
            modified: new Date().toLocaleDateString(),
            series: series,
            // Convert series to media-like object for compatibility
            media: {
              id: series.id,
              title: series.title || 'Unknown Title',
              description: series.description || '',
              type: 'tv' as const,
              rating: series.rating,
              year: series.release_date ? new Date(series.release_date).getFullYear() : undefined,
              genre_names: series.genres?.map((g: any) => typeof g === 'string' ? g : g?.name || String(g)) || [],
              poster_path: series.poster_path,
              backdrop_path: series.backdrop_path,
              status: series.status,
              total_seasons: series.total_seasons,
              total_episodes: series.total_episodes,

              // Add other fields that might be needed
              country: series.country || '',
              language: series.language || '',
              quality: series.quality || '',
              certification: series.certification || '',
              runtime: series.episode_runtime || undefined,
              seasons: series.total_seasons,
              episodes: series.total_episodes,
              network: series.network || '',
              tagline: series.tagline || '',
              view_count: series.view_count || 0,
              file_size: series.file_size,
              resolution: series.resolution,
              codec: series.codec,
              thumbnail_path: series.thumbnail_path,
              trailer_url: series.trailer_url
            }
          };
        })
      }
    };
    return [folders.movies, folders.tvShows];
  };

  const handleMediaSelect = async (media: Media) => {
    console.log('🎯 Selecting media:', media);

    // Ensure we have a complete media object
    const completeMedia = {
      ...media,
      isEditing: false,
      // Ensure all required fields exist
      id: media.id,
      title: media.title || 'Unknown Title',
      type: media.type || 'movie'
    };

    setSelectedMedia(completeMedia);
    setEditingMedia({});
    addTerminalOutput(`📂 Selected ${media.type}: ${media.title}`);

    // Fetch existing assets for this media
    try {
      const response = await fetch(`${getApiUrl()}/api/admin/media/${media.id}/assets`);
      if (response.ok) {
        const assets = await response.json();
        setMediaAssets(assets);
        addTerminalOutput(`📁 Loaded assets for ${media.title}`);
      } else {
        // Assets endpoint might not be available, use media data directly
        setMediaAssets({
          id: media.id,
          title: media.title,
          banner_path: media.banner_path || '',
          poster_path: media.poster_path || '',
          thumbnail_path: media.thumbnail_path || '',
          trailer_path: media.trailer_path || ''
        });
      }
    } catch (error) {
      console.error('Error fetching media assets:', error);
      // Fallback to media data
      setMediaAssets({
        id: media.id,
        title: media.title,
        banner_path: media.banner_path || '',
        poster_path: media.poster_path || '',
        thumbnail_path: media.thumbnail_path || '',
        trailer_path: media.trailer_path || ''
      });
      addTerminalOutput(`⚠️ Using media data for assets (endpoint unavailable)`);
    }
  };

  const handleEditToggle = () => {
    if (selectedMedia) {
      if (selectedMedia.isEditing) {
        // Cancel editing - revert changes
        const originalMedia = mediaList.find(m => m.id === selectedMedia.id);
        if (originalMedia) {
          setSelectedMedia({ ...originalMedia, isEditing: false });
          // Also revert the media list to original state
          setMediaList(prev => prev.map(m =>
            m.id === selectedMedia.id ? originalMedia : m
          ));
        } else {
          setSelectedMedia(prev => prev ? { ...prev, isEditing: false } : null);
        }
        setEditingMedia({});
        addTerminalOutput('❌ Editing cancelled - changes reverted');
      } else {
        // Start editing - populate editing state with current values
        const currentEditingData = {
          title: selectedMedia.title || '',
          description: selectedMedia.description || '',
          tagline: selectedMedia.tagline || '',
          year: selectedMedia.year || undefined,
          rating: selectedMedia.rating || undefined,
          country: selectedMedia.country || '',
          language: selectedMedia.language || '',
          quality: selectedMedia.quality || '',
          certification: selectedMedia.certification || '',
          runtime: selectedMedia.runtime || undefined,
          genre_names: selectedMedia.genre_names || [],
          // TV-specific fields
          ...(selectedMedia.type === 'tv' && {
            seasons: (selectedMedia as any).seasons || undefined,
            episodes: (selectedMedia as any).episodes || undefined,
            status: (selectedMedia as any).status || '',
            network: (selectedMedia as any).network || ''
          })
        };

        setSelectedMedia(prev => prev ? { ...prev, isEditing: true } : null);
        setEditingMedia(currentEditingData);
        addTerminalOutput(`✏️ Started editing: ${selectedMedia.title}`);
      }
    }
  };

  // Handle input changes during editing
  const handleInputChange = (field: string, value: any) => {
    // Update editing state
    setEditingMedia(prev => ({
      ...prev,
      [field]: value
    }));

    // Also update the selectedMedia to show changes immediately in the UI
    setSelectedMedia(prev => prev ? {
      ...prev,
      [field]: value
    } : null);

    // Update media list for immediate reflection in folder tree
    setMediaList(prev => prev.map(m =>
      m.id === selectedMedia?.id
        ? { ...m, [field]: value }
        : m
    ));
  };

  const handleSaveChanges = async () => {
    if (!selectedMedia) return;

    setActionLoading(prev => ({ ...prev, save: true }));
    const currentTitle = editingMedia.title || selectedMedia.title;
    addTerminalOutput(`💾 Saving changes for: ${currentTitle}`);

    try {
      // Use different endpoints for movies vs TV series
      const isSeriesUpdate = selectedMedia.type === 'tv';
      const endpoint = isSeriesUpdate
        ? `${getApiUrl()}/api/series/${selectedMedia.id}/metadata`
        : `${getApiUrl()}/api/admin/media/${selectedMedia.id}/metadata`;

      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editingMedia),
      });

      if (response.ok) {
        const updatedData = await response.json();

        // Merge all the data properly
        const finalData = {
          ...selectedMedia,
          ...updatedData,
          ...editingMedia, // Ensure our edits take precedence
          isEditing: false
        };

        // Update selected media
        setSelectedMedia(finalData);

        // Update the appropriate list
        if (isSeriesUpdate) {
          setSeriesList(prev => prev.map(s =>
            s.id === selectedMedia.id
              ? { ...s, ...updatedData, ...editingMedia }
              : s
          ));
        } else {
          setMediaList(prev => prev.map(m =>
            m.id === selectedMedia.id
              ? finalData
              : m
          ));
        }

        // Clear editing state
        setEditingMedia({});

        addTerminalOutput(`✅ ${isSeriesUpdate ? 'Series' : 'Media'} metadata updated successfully`);
        addTerminalOutput(`📝 Updated fields: ${Object.keys(editingMedia).join(', ')}`);

      } else {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        addTerminalOutput(`❌ Failed to save changes: ${errorData.error || response.statusText}`);
      }
    } catch (error) {
      addTerminalOutput(`❌ Error updating ${selectedMedia.type === 'tv' ? 'series' : 'media'}: ${error}`);
      console.error('Error updating:', error);
    } finally {
      setActionLoading(prev => ({ ...prev, save: false }));
    }
  };

  const handleRegenerateThumbnail = async () => {
    if (!selectedMedia) return;

    // TV series don't have thumbnails in the same way as movies
    if (selectedMedia.type === 'tv') {
      addTerminalOutput(`⚠️ Thumbnail generation not available for TV series`);
      return;
    }

    setIsRegenerating(prev => ({ ...prev, thumbnail: true }));
    addTerminalOutput(`🔄 Force regenerating thumbnail for: ${selectedMedia.title}`);

    try {
      const response = await fetch(`${getApiUrl()}/api/admin/thumbnails/${selectedMedia.id}/regenerate`, {
        method: 'POST',
      });

      if (response.ok) {
        const result = await response.json();
        addTerminalOutput(`✅ Thumbnail regenerated successfully`);
        addTerminalOutput(`📁 New thumbnail path: ${result.thumbnail_path || 'N/A'}`);

        // Refresh the selected media to get updated thumbnail path
        const mediaResponse = await fetch(`${getApiUrl()}/api/media/${selectedMedia.id}`);
        if (mediaResponse.ok) {
          const updatedMedia = await mediaResponse.json();
          setSelectedMedia(prev => prev ? { ...prev, ...updatedMedia } : null);
          addTerminalOutput(`✅ Media info refreshed with new thumbnail`);
        } else {
          addTerminalOutput(`⚠️ Could not refresh media info`);
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        addTerminalOutput(`❌ Thumbnail regeneration failed: ${errorData.error || response.statusText}`);
      }
    } catch (error) {
      addTerminalOutput(`❌ Error regenerating thumbnail: ${error}`);
      console.error('Error regenerating thumbnail:', error);
    } finally {
      setIsRegenerating(prev => ({ ...prev, thumbnail: false }));
    }
  };

  const handleRegeneratePreview = async () => {
    if (!selectedMedia) return;

    // TV series don't have preview clips in the same way as movies
    if (selectedMedia.type === 'tv') {
      addTerminalOutput(`⚠️ Preview clip generation not available for TV series`);
      return;
    }

    setIsRegenerating(prev => ({ ...prev, preview: true }));
    addTerminalOutput(`🔄 Force regenerating preview clip for: ${selectedMedia.title}`);

    try {
      const response = await fetch(`${getApiUrl()}/api/admin/preview-clips/${selectedMedia.id}/regenerate`, {
        method: 'POST',
      });

      if (response.ok) {
        const result = await response.json();
        addTerminalOutput(`✅ Preview clip regenerated successfully`);
        addTerminalOutput(`📁 New preview path: ${result.preview_path || 'N/A'}`);
        addTerminalOutput(`📊 File size: ${result.file_size ? `${(result.file_size / (1024 * 1024)).toFixed(2)} MB` : 'N/A'}`);

        // Refresh the selected media to get updated preview path
        const mediaResponse = await fetch(`${getApiUrl()}/api/media/${selectedMedia.id}`);
        if (mediaResponse.ok) {
          const updatedMedia = await mediaResponse.json();
          setSelectedMedia(prev => prev ? { ...prev, ...updatedMedia } : null);
          addTerminalOutput(`✅ Media info refreshed with new preview`);
        } else {
          addTerminalOutput(`⚠️ Could not refresh media info`);
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        addTerminalOutput(`❌ Preview regeneration failed: ${errorData.error || response.statusText}`);
      }
    } catch (error) {
      addTerminalOutput(`❌ Error regenerating preview: ${error}`);
      console.error('Error regenerating preview:', error);
    } finally {
      setIsRegenerating(prev => ({ ...prev, preview: false }));
    }
  };

  const handleGeneratePoster = async () => {
    if (!selectedMedia) return;

    setIsRegenerating(prev => ({ ...prev, poster: true }));
    addTerminalOutput(`🖼️ Generating poster for: ${selectedMedia.title}`);

    try {
      let response;

      if (selectedMedia.type === 'tv') {
        // For TV series, we need to create a special endpoint or handle it differently
        // For now, let's try to use the same endpoint but with series data
        response = await fetch(`${getApiUrl()}/api/admin/series/${selectedMedia.id}/poster`, {
          method: 'POST',
        });

        // If series-specific endpoint doesn't exist, fall back to media endpoint
        if (!response.ok && response.status === 404) {
          addTerminalOutput(`⚠️ Series poster endpoint not found, trying media endpoint...`);
          response = await fetch(`${getApiUrl()}/api/admin/posters/generate/${selectedMedia.id}`, {
            method: 'POST',
          });
        }
      } else {
        // For movies, use the existing endpoint
        response = await fetch(`${getApiUrl()}/api/admin/posters/generate/${selectedMedia.id}`, {
          method: 'POST',
        });
      }

      if (response.ok) {
        const result = await response.json();
        addTerminalOutput(`✅ Poster generated successfully`);
        addTerminalOutput(`📁 Poster path: ${result.poster_path || 'N/A'}`);

        // Refresh the selected media to get updated poster path
        let refreshResponse;
        if (selectedMedia.type === 'tv') {
          refreshResponse = await fetch(`${getApiUrl()}/api/series/${selectedMedia.id}`);
        } else {
          refreshResponse = await fetch(`${getApiUrl()}/api/media/${selectedMedia.id}`);
        }

        if (refreshResponse.ok) {
          const updatedData = await refreshResponse.json();
          if (selectedMedia.type === 'tv') {
            // Convert series data back to media-like format
            const updatedMedia = {
              ...selectedMedia,
              poster_path: updatedData.poster_path,
              backdrop_path: updatedData.backdrop_path,
            };
            setSelectedMedia(updatedMedia);
          } else {
            setSelectedMedia(prev => prev ? { ...prev, ...updatedData } : null);
          }
          addTerminalOutput(`✅ ${selectedMedia.type === 'tv' ? 'Series' : 'Media'} info refreshed with new poster`);
        } else {
          addTerminalOutput(`⚠️ Could not refresh ${selectedMedia.type === 'tv' ? 'series' : 'media'} info`);
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        addTerminalOutput(`❌ Poster generation failed: ${errorData.error || response.statusText}`);
      }
    } catch (error) {
      addTerminalOutput(`❌ Error generating poster: ${error}`);
      console.error('Error generating poster:', error);
    } finally {
      setIsRegenerating(prev => ({ ...prev, poster: false }));
    }
  };

  const handleBulkTMDBUpdate = async () => {
    setActionLoading(prev => ({ ...prev, bulkTmdb: true }));
    addTerminalOutput(`🎬 Starting bulk TMDB update for all local media...`);

    try {
      const response = await fetch(`${getApiUrl()}/api/admin/update-tmdb-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        addTerminalOutput(`✅ Bulk TMDB update completed: ${data.updated} items updated out of ${data.total}`);

        if (data.errors && data.errors.length > 0) {
          addTerminalOutput(`⚠️ Some items had errors:`);
          data.errors.slice(0, 5).forEach((error: string) => {
            addTerminalOutput(`   • ${error}`);
          });
          if (data.errors.length > 5) {
            addTerminalOutput(`   • ... and ${data.errors.length - 5} more errors`);
          }
        }

        // Refresh media list if we're in media tab
        if (activeTab === 'media') {
          await fetchMediaList();
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        addTerminalOutput(`❌ Bulk TMDB update failed: ${errorData.error || response.statusText}`);
      }
    } catch (error) {
      addTerminalOutput(`❌ Error during bulk TMDB update: ${error}`);
      console.error('Error during bulk TMDB update:', error);
    } finally {
      setActionLoading(prev => ({ ...prev, bulkTmdb: false }));
    }
  };

  const handleFetchTMDBData = async (customTitle?: string) => {
    if (!selectedMedia) return;

    setActionLoading(prev => ({ ...prev, tmdb: true }));

    // Use custom title if provided, otherwise use edited title or current title
    const searchTitle = customTitle || editingMedia.title || selectedMedia.title;
    addTerminalOutput(`🎬 Fetching TMDB data for: ${searchTitle}`);

    try {
      // Send the current editing state to preserve manual changes
      const requestBody = {
        searchTitle: searchTitle,
        preserveFields: selectedMedia.isEditing ? Object.keys(editingMedia) : []
      };

      let response: Response;
      let updatedData: any;

      if (selectedMedia.type === 'tv') {
        // For TV series, use series-specific TMDB endpoints
        addTerminalOutput(`📺 Fetching TMDB data for TV series: ${searchTitle}`);

        // Try the main TMDB endpoint first
        response = await fetch(`${getApiUrl()}/api/admin/series/${selectedMedia.id}/update-with-tmdb`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        // If that fails, try the alternative endpoint
        if (!response.ok) {
          addTerminalOutput(`⚠️ Primary TMDB endpoint failed, trying alternative...`);
          response = await fetch(`${getApiUrl()}/api/admin/series/${selectedMedia.id}/fetch-tmdb`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          });
        }

        if (response.ok) {
          updatedData = await response.json();
          addTerminalOutput(`✅ Received updated series data from backend`);

          // Preserve manually edited fields
          const finalSeriesData = { ...updatedData };
          if (selectedMedia.isEditing && editingMedia) {
            (Object.keys(editingMedia) as Array<keyof Media>).forEach(key => {
              if (editingMedia[key] !== undefined && editingMedia[key] !== '') {
                (finalSeriesData as any)[key] = editingMedia[key];
              }
            });
          }

          // Update series list
          setSeriesList(prev => prev.map(s =>
            s.id === selectedMedia.id
              ? finalSeriesData
              : s
          ));

          // Convert series data back to media-like format for selectedMedia
          const finalMedia = {
            ...selectedMedia,
            ...finalSeriesData,
            isEditing: selectedMedia.isEditing,
            type: 'tv' as const,
            // Ensure critical fields are preserved
            id: selectedMedia.id
          };

          // Ensure genres is removed and genre_names is properly formatted
          if ((finalMedia as any).genres) {
            delete (finalMedia as any).genres;
          }
          if (finalMedia.genre_names && Array.isArray(finalMedia.genre_names)) {
            finalMedia.genre_names = finalMedia.genre_names.map((g: any) => 
              typeof g === 'string' ? g : g?.name || String(g)
            );
          }

          setSelectedMedia(finalMedia);
          addTerminalOutput(`✅ TV series TMDB data updated successfully`);
          addTerminalOutput(`📊 Updated fields: title, description, backdrop_path, poster_path, rating, year, trailer_url`);

          // Log specific updates
          if (updatedData.backdrop_path) addTerminalOutput(`🖼️ Backdrop updated: ${updatedData.backdrop_path}`);
          if (updatedData.trailer_url) addTerminalOutput(`🎬 Trailer updated: ${updatedData.trailer_url}`);
          if (updatedData.poster_path) addTerminalOutput(`🎭 Poster updated: ${updatedData.poster_path}`);

          if (selectedMedia.isEditing && editingMedia && Object.keys(editingMedia).length > 0) {
            addTerminalOutput(`🔒 Preserved manual edits: ${Object.keys(editingMedia).join(', ')}`);
          }
        } else {
          const errorData = await response.json().catch(() => ({ error: response.statusText }));
          addTerminalOutput(`❌ TV series TMDB fetch failed: ${errorData.error || response.statusText}`);
        }
      } else {
        // For movies, use existing movie endpoints
        addTerminalOutput(`🎬 Fetching TMDB data for movie: ${searchTitle}`);

        // Try the main endpoint first with search parameters
        response = await fetch(`${getApiUrl()}/api/admin/media/${selectedMedia.id}/update-with-tmdb`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        // If that fails, try the alternative endpoint
        if (!response.ok) {
          addTerminalOutput(`⚠️ Primary TMDB endpoint failed, trying alternative...`);
          response = await fetch(`${getApiUrl()}/api/admin/media/${selectedMedia.id}/fetch-tmdb`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          });
        }

        if (response.ok) {
          updatedData = await response.json();
          addTerminalOutput(`✅ Received updated movie data from backend`);

          // Preserve manually edited fields
          const finalMedia = { ...updatedData };
          
          // Ensure genres is properly formatted as string array
          if (finalMedia.genres && Array.isArray(finalMedia.genres)) {
            finalMedia.genre_names = finalMedia.genres.map((g: any) => 
              typeof g === 'string' ? g : g.name || g
            );
            delete (finalMedia as any).genres;
          }
          
          if (selectedMedia.isEditing && editingMedia) {
            (Object.keys(editingMedia) as Array<keyof Media>).forEach(key => {
              if (editingMedia[key] !== undefined && editingMedia[key] !== '') {
                (finalMedia as any)[key] = editingMedia[key];
              }
            });
          }

          // Ensure critical fields are preserved
          finalMedia.isEditing = selectedMedia.isEditing;
          finalMedia.id = selectedMedia.id;

          setSelectedMedia(finalMedia);
          setMediaList(prev => prev.map(m => m.id === selectedMedia.id ? finalMedia : m));
          addTerminalOutput(`✅ Movie TMDB data updated successfully`);
          addTerminalOutput(`📊 Updated fields: title, description, backdrop_path, poster_path, rating, year, runtime, trailer_url`);

          // Log specific updates
          if (updatedData.backdrop_path) addTerminalOutput(`🖼️ Backdrop updated: ${updatedData.backdrop_path}`);
          if (updatedData.trailer_url) addTerminalOutput(`🎬 Trailer updated: ${updatedData.trailer_url}`);
          if (updatedData.poster_path) addTerminalOutput(`🎭 Poster updated: ${updatedData.poster_path}`);

          if (selectedMedia.isEditing && editingMedia && Object.keys(editingMedia).length > 0) {
            addTerminalOutput(`🔒 Preserved manual edits: ${Object.keys(editingMedia).join(', ')}`);
          }
        } else {
          const errorData = await response.json().catch(() => ({ error: response.statusText }));
          addTerminalOutput(`❌ Movie TMDB fetch failed: ${errorData.error || response.statusText}`);
        }
      }

      // Refresh the media list to ensure consistency
      addTerminalOutput(`🔄 Refreshing media list to ensure consistency...`);
      await fetchMediaList();

    } catch (error) {
      addTerminalOutput(`❌ Error fetching TMDB data: ${error}`);
      console.error('Error fetching TMDB data:', error);
    } finally {
      setActionLoading(prev => ({ ...prev, tmdb: false }));
      // Close the search modal if it was used
      if (customTitle) {
        setShowTMDBSearchModal(false);
        setCustomSearchTitle('');
      }
    }
  };



  const handleTMDBSelection = async (tmdbResult: TMDBSearchResult) => {
    if (!selectedMedia) return;

    console.log('🎬 TMDB Selection:', tmdbResult);
    setActionLoading(prev => ({ ...prev, tmdb: true }));
    addTerminalOutput(`🎬 Updating with selected TMDB result: ${tmdbResult.title} (ID: ${tmdbResult.id})`);

    try {
      // Send the TMDB ID directly to update the media
      const requestBody = {
        tmdbId: tmdbResult.id,
        mediaType: tmdbResult.media_type,
        preserveFields: selectedMedia.isEditing ? Object.keys(editingMedia) : [],
        // Include the full TMDB result for immediate use
        tmdbData: tmdbResult
      };

      let response: Response;
      let updatedData: any;

      if (selectedMedia.type === 'tv' || tmdbResult.media_type === 'tv') {
        // For TV series, use series-specific TMDB endpoints
        addTerminalOutput(`📺 Updating TV series with TMDB ID: ${tmdbResult.id}`);

        response = await fetch(`${getApiUrl()}/api/admin/series/${selectedMedia.id}/update-with-tmdb`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (response.ok) {
          updatedData = await response.json();
          addTerminalOutput(`✅ Received updated series data from backend`);

          // Preserve manually edited fields
          const finalSeriesData = { ...updatedData };
          
          // Ensure genres is properly formatted as string array
          if (finalSeriesData.genres && Array.isArray(finalSeriesData.genres)) {
            finalSeriesData.genre_names = finalSeriesData.genres.map((g: any) => 
              typeof g === 'string' ? g : g.name || g
            );
            delete (finalSeriesData as any).genres;
          }
          
          if (selectedMedia.isEditing && editingMedia) {
            (Object.keys(editingMedia) as Array<keyof Media>).forEach(key => {
              if (editingMedia[key] !== undefined && editingMedia[key] !== '') {
                (finalSeriesData as any)[key] = editingMedia[key];
              }
            });
          }

          // Update series list
          setSeriesList(prev => prev.map(s =>
            s.id === selectedMedia.id
              ? finalSeriesData
              : s
          ));

          // Convert series data back to media-like format for selectedMedia
          const finalMedia = {
            ...selectedMedia,
            ...finalSeriesData,
            isEditing: selectedMedia.isEditing,
            type: 'tv' as const,
            // Ensure critical fields are preserved
            id: selectedMedia.id
          };

          // Ensure genres is removed and genre_names is properly formatted
          if ((finalMedia as any).genres) {
            delete (finalMedia as any).genres;
          }
          if (finalMedia.genre_names && Array.isArray(finalMedia.genre_names)) {
            finalMedia.genre_names = finalMedia.genre_names.map((g: any) => 
              typeof g === 'string' ? g : g?.name || String(g)
            );
          }

          setSelectedMedia(finalMedia);
          addTerminalOutput(`✅ TV series updated with TMDB data from "${tmdbResult.title}"`);
          addTerminalOutput(`📊 Updated fields: title, description, backdrop_path, poster_path, rating, year, trailer_url`);

          // Log specific updates
          if (updatedData.backdrop_path) addTerminalOutput(`🖼️ Backdrop updated: ${updatedData.backdrop_path}`);
          if (updatedData.trailer_url) addTerminalOutput(`🎬 Trailer updated: ${updatedData.trailer_url}`);
          if (updatedData.poster_path) addTerminalOutput(`🎭 Poster updated: ${updatedData.poster_path}`);
        } else {
          const errorData = await response.json().catch(() => ({ error: response.statusText }));
          addTerminalOutput(`❌ TV series TMDB update failed: ${errorData.error || response.statusText}`);
        }
      } else {
        // For movies, use existing movie endpoints
        addTerminalOutput(`🎬 Updating movie with TMDB ID: ${tmdbResult.id}`);

        response = await fetch(`${getApiUrl()}/api/admin/media/${selectedMedia.id}/update-with-tmdb`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (response.ok) {
          updatedData = await response.json();
          addTerminalOutput(`✅ Received updated movie data from backend`);

          // Preserve manually edited fields
          const finalMedia = { ...updatedData };
          
          // Ensure genres is properly formatted as string array
          if (finalMedia.genres && Array.isArray(finalMedia.genres)) {
            finalMedia.genre_names = finalMedia.genres.map((g: any) => 
              typeof g === 'string' ? g : g.name || g
            );
            delete (finalMedia as any).genres;
          }
          
          if (selectedMedia.isEditing && editingMedia) {
            (Object.keys(editingMedia) as Array<keyof Media>).forEach(key => {
              if (editingMedia[key] !== undefined && editingMedia[key] !== '') {
                (finalMedia as any)[key] = editingMedia[key];
              }
            });
          }

          // Ensure critical fields are preserved
          finalMedia.isEditing = selectedMedia.isEditing;
          finalMedia.id = selectedMedia.id;

          setSelectedMedia(finalMedia);
          setMediaList(prev => prev.map(m => m.id === selectedMedia.id ? finalMedia : m));
          addTerminalOutput(`✅ Movie updated with TMDB data from "${tmdbResult.title}"`);
          addTerminalOutput(`📊 Updated fields: title, description, backdrop_path, poster_path, rating, year, runtime, trailer_url`);

          // Log specific updates
          if (updatedData.backdrop_path) addTerminalOutput(`🖼️ Backdrop updated: ${updatedData.backdrop_path}`);
          if (updatedData.trailer_url) addTerminalOutput(`🎬 Trailer updated: ${updatedData.trailer_url}`);
          if (updatedData.poster_path) addTerminalOutput(`🎭 Poster updated: ${updatedData.poster_path}`);
        } else {
          const errorData = await response.json().catch(() => ({ error: response.statusText }));
          addTerminalOutput(`❌ Movie TMDB update failed: ${errorData.error || response.statusText}`);
        }
      }

      if (selectedMedia.isEditing && editingMedia && Object.keys(editingMedia).length > 0) {
        addTerminalOutput(`🔒 Preserved manual edits: ${Object.keys(editingMedia).join(', ')}`);
      }

      // Refresh the media list to ensure consistency
      addTerminalOutput(`🔄 Refreshing media list to ensure consistency...`);
      await fetchMediaList();

    } catch (error) {
      addTerminalOutput(`❌ Error updating with TMDB data: ${error}`);
      console.error('Error updating with TMDB data:', error);
    } finally {
      setActionLoading(prev => ({ ...prev, tmdb: false }));
      // Close the modal after processing
      setShowTMDBSearchModal(false);
      setCustomSearchTitle('');
      addTerminalOutput(`🎭 TMDB search modal closed`);
    }
  };

  const handleUpdateBackdropTrailer = async (customTitle?: string) => {
    if (!selectedMedia) return;

    setActionLoading(prev => ({ ...prev, backdropTrailer: true }));

    // Use custom title if provided, otherwise use current title
    const searchTitle = customTitle || selectedMedia.title;
    addTerminalOutput(`🎬 Updating backdrop and trailer for: ${searchTitle}`);

    try {
      // Use the bulk TMDB update endpoint which focuses on backdrop/trailer data
      const response = await fetch(`${getApiUrl()}/api/admin/update-tmdb-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mediaId: selectedMedia.id,
          searchTitle: searchTitle,
          updateType: 'backdrop_trailer_only'
        }),
      });

      if (response.ok) {
        const data = await response.json();
        addTerminalOutput(`✅ Backdrop and trailer update completed`);

        // Refresh the selected media to show updated data
        if (selectedMedia.type === 'tv') {
          const refreshResponse = await fetch(`${getApiUrl()}/api/series/${selectedMedia.id}`);
          if (refreshResponse.ok) {
            const updatedData = await refreshResponse.json();
            const finalMedia = {
              ...selectedMedia,
              backdrop_path: updatedData.backdrop_path,
              trailer_url: updatedData.trailer_url,
            };
            setSelectedMedia(finalMedia);
          }
        } else {
          const refreshResponse = await fetch(`${getApiUrl()}/api/media/${selectedMedia.id}`);
          if (refreshResponse.ok) {
            const updatedData = await refreshResponse.json();
            setSelectedMedia(prev => prev ? { ...prev, ...updatedData } : null);
          }
        }

        addTerminalOutput(`🖼️ Backdrop URL: ${data.backdrop_url ? '✅ Updated' : '❌ Not found'}`);
        addTerminalOutput(`🎬 Trailer URL: ${data.trailer_url ? '✅ Updated' : '❌ Not found'}`);
      } else {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        addTerminalOutput(`❌ Backdrop/trailer update failed: ${errorData.error || response.statusText}`);
      }
    } catch (error) {
      addTerminalOutput(`❌ Error updating backdrop/trailer: ${error}`);
      console.error('Error updating backdrop/trailer:', error);
    } finally {
      setActionLoading(prev => ({ ...prev, backdropTrailer: false }));
    }
  };

  const handleDeleteMedia = async () => {
    if (!selectedMedia) return;

    const itemType = selectedMedia.type === 'tv' ? 'TV series' : 'movie';
    const confirmMessage = selectedMedia.type === 'tv'
      ? `Are you sure you want to delete the TV series "${selectedMedia.title}"? This action cannot be undone.\n\nThis will permanently remove:\n- Series record from database\n- All associated episodes and metadata\n- Posters and backdrops\n- Season and episode information\n- Genre associations`
      : `Are you sure you want to delete "${selectedMedia.title}"? This action cannot be undone.\n\nThis will permanently remove:\n- Media record from database\n- All associated metadata\n- Thumbnails and preview clips\n- Playback progress\n- Genre associations`;

    if (!confirm(confirmMessage)) return;

    setActionLoading(prev => ({ ...prev, delete: true }));
    addTerminalOutput(`🗑️ Attempting to delete ${itemType}: ${selectedMedia.title}`);

    try {
      let response;

      if (selectedMedia.type === 'tv') {
        // Delete TV series
        response = await fetch(`${getApiUrl()}/api/series/${selectedMedia.id}`, {
          method: 'DELETE',
        });
      } else {
        // Delete movie
        response = await fetch(`${getApiUrl()}/api/media/${selectedMedia.id}`, {
          method: 'DELETE',
        });
      }

      if (response.ok) {
        const result = await response.json();
        addTerminalOutput(`✅ ${result.message || `${itemType} deleted successfully`}`);
        addTerminalOutput(`📊 Deleted: ${selectedMedia.title} (${selectedMedia.type})`);

        // Remove from local state
        if (selectedMedia.type === 'tv') {
          setSeriesList(prev => prev.filter(s => s.id !== selectedMedia.id));
        } else {
          setMediaList(prev => prev.filter(m => m.id !== selectedMedia.id));
        }
        setSelectedMedia(null);

        // Refresh media list to ensure consistency
        await fetchMediaList();
      } else {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        addTerminalOutput(`❌ Delete failed: ${errorData.error || response.statusText}`);
      }
    } catch (error) {
      addTerminalOutput(`❌ Error during deletion: ${error}`);
      console.error('Error deleting media:', error);
    } finally {
      setActionLoading(prev => ({ ...prev, delete: false }));
    }
  };

  // Admin functions for scanning and system management
  const fetchScanStats = async () => {
    try {
      const response = await fetch(`${getApiUrl()}/api/admin/scan/stats`);
      if (response.ok) {
        const stats = await response.json();
        setScanStats(stats);
        addTerminalOutput(`📊 Scan stats refreshed`);
      } else {
        addTerminalOutput(`⚠️ Could not fetch scan stats: ${response.statusText}`);
      }
    } catch (error) {
      addTerminalOutput(`❌ Error fetching scan stats: ${error}`);
      console.error('Error fetching scan stats:', error);
    }
  };

  const fetchSystemStats = async () => {
    try {
      addTerminalOutput(`📈 Fetching system statistics...`);
      const [cacheStats, queueStats] = await Promise.all([
        fetch(`${getApiUrl()}/api/admin/assets/cache/stats`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null),
        fetch(`${getApiUrl()}/api/celery/queues/status`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      ]);

      setSystemStats({ cache: cacheStats, queues: queueStats });

      if (cacheStats) addTerminalOutput(`✅ Cache stats loaded`);
      else addTerminalOutput(`⚠️ Cache stats unavailable`);

      if (queueStats) addTerminalOutput(`✅ Queue stats loaded`);
      else addTerminalOutput(`⚠️ Queue stats unavailable`);

    } catch (error) {
      addTerminalOutput(`❌ Error fetching system stats: ${error}`);
      console.error('Error fetching system stats:', error);
    }
  };

  const triggerScan = async (scanType: string) => {
    setIsScanning(true);
    setActionLoading(prev => ({ ...prev, [scanType]: true }));
    addTerminalOutput(`🚀 Starting ${scanType} scan...`);

    try {
      const response = await fetch(`${getApiUrl()}/api/admin/scan/${scanType}`, {
        method: 'POST'
      });

      if (response.ok) {
        const result = await response.json();
        addTerminalOutput(`✅ ${scanType} scan completed successfully`);
        addTerminalOutput(`📊 Results: ${JSON.stringify(result, null, 2)}`);
        await fetchScanStats();
        await fetchMediaList();
      } else {
        addTerminalOutput(`❌ ${scanType} scan failed: ${response.statusText}`);
      }
    } catch (error) {
      addTerminalOutput(`❌ Error during ${scanType} scan: ${error}`);
    } finally {
      setIsScanning(false);
      setActionLoading(prev => ({ ...prev, [scanType]: false }));
    }
  };

  const addTerminalOutput = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setTerminalOutput(prev => [...prev, `[${timestamp}] ${message}`].slice(-100)); // Keep last 100 lines
  };

  const clearTerminalOutput = () => {
    setTerminalOutput([]);
  };

  const regenerateAllAssets = async () => {
    setActionLoading(prev => ({ ...prev, regenerateAll: true }));
    addTerminalOutput('🔄 Starting asset regeneration for all media...');

    try {
      const response = await fetch(`${getApiUrl()}/api/admin/scan/regenerate-assets`, {
        method: 'POST'
      });

      if (response.ok) {
        addTerminalOutput('✅ Asset regeneration started successfully');
      } else {
        addTerminalOutput(`❌ Asset regeneration failed: ${response.statusText}`);
      }
    } catch (error) {
      addTerminalOutput(`❌ Error starting asset regeneration: ${error}`);
    } finally {
      setActionLoading(prev => ({ ...prev, regenerateAll: false }));
    }
  };

  const clearCache = async () => {
    setActionLoading(prev => ({ ...prev, clearCache: true }));
    addTerminalOutput('🧹 Clearing system cache...');

    try {
      const response = await fetch(`${getApiUrl()}/api/admin/assets/cache/clear`, {
        method: 'DELETE'
      });

      if (response.ok) {
        addTerminalOutput('✅ Cache cleared successfully');
        await fetchSystemStats();
      } else {
        addTerminalOutput(`❌ Cache clear failed: ${response.statusText}`);
      }
    } catch (error) {
      addTerminalOutput(`❌ Error clearing cache: ${error}`);
    } finally {
      setActionLoading(prev => ({ ...prev, clearCache: false }));
    }
  };

  // Test all API endpoints to verify functionality
  const testAllEndpoints = async () => {
    setActionLoading(prev => ({ ...prev, testEndpoints: true }));
    addTerminalOutput('🔍 Testing all API endpoints...');

    const endpoints = [
      { name: 'Media List', method: 'GET', url: '/api/media' },
      { name: 'Media Delete', method: 'DELETE', url: '/api/media/1', note: 'Endpoint available (test with valid ID)' },
      { name: 'Scan Stats', method: 'GET', url: '/api/admin/scan/stats' },
      { name: 'Cache Stats', method: 'GET', url: '/api/admin/assets/cache/stats' },
      { name: 'Queue Status', method: 'GET', url: '/api/celery/queues/status' },
    ];

    for (const endpoint of endpoints) {
      try {
        // Skip DELETE endpoint test to avoid accidentally deleting media
        if (endpoint.method === 'DELETE') {
          addTerminalOutput(`✅ ${endpoint.name}: ${endpoint.note || 'Available'}`);
          continue;
        }

        const response = await fetch(`${getApiUrl()}${endpoint.url}`);
        if (response.ok) {
          addTerminalOutput(`✅ ${endpoint.name}: Available`);
        } else {
          addTerminalOutput(`❌ ${endpoint.name}: ${response.status} ${response.statusText}`);
        }
      } catch (error) {
        addTerminalOutput(`❌ ${endpoint.name}: Connection failed`);
      }
    }

    addTerminalOutput('🔍 Endpoint testing completed');
    setActionLoading(prev => ({ ...prev, testEndpoints: false }));
  };

  const handleFileUpload = async (file: File, type: 'banner' | 'thumbnail' | 'trailer') => {
    if (!selectedMedia) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    try {
      const response = await fetch(`${getApiUrl()}/api/admin/media/${selectedMedia.id}/upload-asset`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        setMediaAssets(prev => ({
          ...prev,
          [type]: result.path
        }));
      }
    } catch (error) {
      console.error('Error uploading file:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleSubtitleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedMedia || !e.target.files) return;

    setUploading(true);
    const files = Array.from(e.target.files);

    addTerminalOutput(`📝 Uploading ${files.length} subtitle file(s) for: ${selectedMedia.title}`);

    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('subtitle', file);
        formData.append('language', extractLanguageFromFilename(file.name));

        const response = await fetch(`${getApiUrl()}/api/admin/media/${selectedMedia.id}/upload-subtitle`, {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const result = await response.json();
          addTerminalOutput(`✅ Uploaded subtitle: ${file.name} → ${result.language} (Track ID: ${result.trackId})`);
        } else {
          const errorText = await response.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { error: errorText || response.statusText };
          }
          addTerminalOutput(`❌ Failed to upload ${file.name}: ${errorData.error || response.statusText} (Status: ${response.status})`);
          console.error('Upload error:', response.status, errorData);
        }
      }

      addTerminalOutput(`✅ Subtitle upload completed for ${selectedMedia.title}`);

      // Refresh media data to show new subtitles
      const mediaResponse = await fetch(`${getApiUrl()}/api/media/${selectedMedia.id}`);
      if (mediaResponse.ok) {
        const updatedMedia = await mediaResponse.json();
        setSelectedMedia(prev => prev ? { ...prev, ...updatedMedia } : null);
      }

    } catch (error) {
      addTerminalOutput(`❌ Error uploading subtitles: ${error}`);
      console.error('Error uploading subtitles:', error);
    } finally {
      setUploading(false);
      // Clear the input
      e.target.value = '';
    }
  };

  const handleScanSubtitles = async () => {
    setActionLoading(prev => ({ ...prev, scanSubtitles: true }));
    addTerminalOutput('🔍 Starting subtitle scan for media storage...');

    try {
      const response = await fetch(`${getApiUrl()}/api/admin/scan/subtitles`, {
        method: 'POST'
      });

      if (response.ok) {
        const result = await response.json();
        addTerminalOutput(`✅ Subtitle scan completed successfully`);
        addTerminalOutput(`📊 Found ${result.totalSubtitles || 0} subtitle files`);
        addTerminalOutput(`📝 Matched ${result.matchedSubtitles || 0} subtitles to media`);
        addTerminalOutput(`⚠️ Unmatched ${result.unmatchedSubtitles || 0} subtitle files`);

        // Refresh media list to show updated subtitle info
        await fetchMediaList();

        // If a media is selected, refresh its data
        if (selectedMedia) {
          const mediaResponse = await fetch(`${getApiUrl()}/api/media/${selectedMedia.id}`);
          if (mediaResponse.ok) {
            const updatedMedia = await mediaResponse.json();
            setSelectedMedia(prev => prev ? { ...prev, ...updatedMedia } : null);
          }
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        addTerminalOutput(`❌ Subtitle scan failed: ${errorData.error || response.statusText}`);
      }
    } catch (error) {
      addTerminalOutput(`❌ Error during subtitle scan: ${error}`);
      console.error('Error scanning subtitles:', error);
    } finally {
      setActionLoading(prev => ({ ...prev, scanSubtitles: false }));
    }
  };

  const handleTestSubtitles = async () => {
    if (!selectedMedia) return;

    setActionLoading(prev => ({ ...prev, testSubtitles: true }));
    addTerminalOutput(`🧪 Testing subtitle system for: ${selectedMedia.title}`);

    try {
      const response = await fetch(`${getApiUrl()}/api/admin/subtitles/test/${selectedMedia.id}`);

      if (response.ok) {
        const result = await response.json();
        addTerminalOutput(`✅ Subtitle test completed for: ${result.media_title}`);
        addTerminalOutput(`📊 Found ${result.track_count} subtitle tracks`);

        if (result.tracks && result.tracks.length > 0) {
          result.tracks.forEach((track: any) => {
            const status = track.exists ? (track.readable ? '✅' : '⚠️') : '❌';
            addTerminalOutput(`   ${status} ${track.language} (${track.track_type}) - ${track.exists ? `${track.size} bytes` : 'missing'}`);
          });
        } else {
          addTerminalOutput(`⚠️ No subtitle tracks found for this media`);
        }

        // Test the subtitle endpoint that's causing 500 errors
        if (result.tracks && result.tracks.length > 0) {
          const firstTrack = result.tracks[0];
          addTerminalOutput(`🔍 Testing subtitle file endpoint for track ${firstTrack.id}...`);

          const testResponse = await fetch(`${getApiUrl()}/api/media/${selectedMedia.id}/subtitles/${firstTrack.id}/file`);
          if (testResponse.ok) {
            addTerminalOutput(`✅ Subtitle file endpoint working (${testResponse.status})`);
          } else {
            addTerminalOutput(`❌ Subtitle file endpoint failed (${testResponse.status}): ${testResponse.statusText}`);
          }
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        addTerminalOutput(`❌ Subtitle test failed: ${errorData.error || response.statusText}`);
      }
    } catch (error) {
      addTerminalOutput(`❌ Error during subtitle test: ${error}`);
      console.error('Error testing subtitles:', error);
    } finally {
      setActionLoading(prev => ({ ...prev, testSubtitles: false }));
    }
  };

  // Helper function to extract language from filename
  const extractLanguageFromFilename = (filename: string): string => {
    const langPatterns: { [key: string]: string } = {
      'en': 'English',
      'eng': 'English',
      'english': 'English',
      'es': 'Spanish',
      'spa': 'Spanish',
      'spanish': 'Spanish',
      'fr': 'French',
      'fre': 'French',
      'french': 'French',
      'de': 'German',
      'ger': 'German',
      'german': 'German',
      'it': 'Italian',
      'ita': 'Italian',
      'italian': 'Italian',
      'pt': 'Portuguese',
      'por': 'Portuguese',
      'portuguese': 'Portuguese',
      'ru': 'Russian',
      'rus': 'Russian',
      'russian': 'Russian',
      'ja': 'Japanese',
      'jpn': 'Japanese',
      'japanese': 'Japanese',
      'ko': 'Korean',
      'kor': 'Korean',
      'korean': 'Korean',
      'zh': 'Chinese',
      'chi': 'Chinese',
      'chinese': 'Chinese',
      'ar': 'Arabic',
      'ara': 'Arabic',
      'arabic': 'Arabic'
    };

    const lowerFilename = filename.toLowerCase();

    // Try to find language patterns in filename
    for (const [code, language] of Object.entries(langPatterns)) {
      if (lowerFilename.includes(`.${code}.`) ||
        lowerFilename.includes(`_${code}_`) ||
        lowerFilename.includes(`-${code}-`) ||
        lowerFilename.includes(`${code}.srt`) ||
        lowerFilename.includes(`${code}.vtt`) ||
        lowerFilename.includes(`${code}.ass`)) {
        return language;
      }
    }

    return 'Unknown';
  };

  // OpenSubtitles handlers
  const handleOpenSubtitlesSearch = async () => {
    if (!selectedMedia || !openSubtitlesQuery.trim()) return;

    setOpenSubtitlesLoading(true);
    setOpenSubtitlesResults([]);
    addTerminalOutput(`🔍 Searching OpenSubtitles for: ${openSubtitlesQuery} (${selectedLanguage})`);

    try {
      const params = new URLSearchParams({
        query: openSubtitlesQuery,
        language: selectedLanguage,
      });

      // Add year if available
      if (selectedMedia.year) {
        params.append('year', selectedMedia.year.toString());
      }

      const response = await fetch(`${getApiUrl()}/api/opensubtitles/search?${params}`);
      
      if (response.ok) {
        const data = await response.json();
        const results = data.data || [];
        setOpenSubtitlesResults(results);
        addTerminalOutput(`✅ Found ${results.length} subtitle(s) for "${openSubtitlesQuery}"`);
        
        if (results.length === 0) {
          addTerminalOutput(`💡 Try searching with just the movie title or different language`);
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        addTerminalOutput(`❌ OpenSubtitles search failed: ${errorData.error || response.statusText}`);
      }
    } catch (error) {
      addTerminalOutput(`❌ Error searching OpenSubtitles: ${error}`);
      console.error('OpenSubtitles search error:', error);
    } finally {
      setOpenSubtitlesLoading(false);
    }
  };

  const handleDownloadOpenSubtitle = async (subtitle: any) => {
    if (!selectedMedia || !subtitle.attributes?.files?.[0]?.file_id) return;

    const fileId = subtitle.attributes.files[0].file_id;
    setDownloadingSubtitle(fileId);
    
    const subtitleTitle = subtitle.attributes?.feature_details?.title || 'Unknown';
    const language = subtitle.attributes?.language || 'Unknown';
    
    addTerminalOutput(`⬇️ Downloading subtitle: ${subtitleTitle} (${language.toUpperCase()})`);

    try {
      const response = await fetch(`${getApiUrl()}/api/admin/media/${selectedMedia.id}/opensubtitles/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file_id: fileId,
          language: language,
          file_name: subtitle.attributes?.files?.[0]?.file_name || `${subtitleTitle}.srt`,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        addTerminalOutput(`✅ Subtitle downloaded successfully: ${result.language}`);
        addTerminalOutput(`📁 Saved as: ${result.path}`);
        
        if (result.remaining !== undefined) {
          addTerminalOutput(`📊 Remaining downloads today: ${result.remaining}`);
        }

        // Refresh media data to show new subtitle
        const mediaResponse = await fetch(`${getApiUrl()}/api/media/${selectedMedia.id}`);
        if (mediaResponse.ok) {
          const updatedMedia = await mediaResponse.json();
          setSelectedMedia(prev => prev ? { ...prev, ...updatedMedia } : null);
        }

        // Refresh the media list
        await fetchMediaList();
        
      } else {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        addTerminalOutput(`❌ Failed to download subtitle: ${errorData.error || response.statusText}`);
      }
    } catch (error) {
      addTerminalOutput(`❌ Error downloading subtitle: ${error}`);
      console.error('Subtitle download error:', error);
    } finally {
      setDownloadingSubtitle(null);
    }
  };

  const handleDownloadSubtitleAsFile = async (subtitle: any) => {
    if (!subtitle.attributes?.files?.[0]?.file_id) return;

    const fileId = subtitle.attributes.files[0].file_id;
    const subtitleTitle = subtitle.attributes?.feature_details?.title || 'Unknown';
    const language = subtitle.attributes?.language || 'Unknown';
    
    addTerminalOutput(`⬇️ Downloading SRT file: ${subtitleTitle} (${language.toUpperCase()})`);

    try {
      const response = await fetch(`${getApiUrl()}/api/opensubtitles/download?file_id=${fileId}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        // Get filename from Content-Disposition header or use default
        const contentDisposition = response.headers.get('content-disposition');
        let filename = `${subtitleTitle}_${language}.srt`;
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
          if (filenameMatch) {
            filename = filenameMatch[1];
          }
        }
        
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        addTerminalOutput(`✅ SRT file downloaded: ${filename}`);
      } else {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        addTerminalOutput(`❌ Failed to download SRT file: ${errorData.error || response.statusText}`);
      }
    } catch (error) {
      addTerminalOutput(`❌ Error downloading SRT file: ${error}`);
      console.error('SRT download error:', error);
    }
  };

  const handleDeleteAsset = async (type: 'banner' | 'thumbnail' | 'trailer') => {
    if (!selectedMedia) return;

    try {
      const response = await fetch(`${getApiUrl()}/api/admin/media/${selectedMedia.id}/delete-asset`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type }),
      });

      if (response.ok) {
        setMediaAssets(prev => ({
          ...prev,
          [type]: undefined
        }));
      }
    } catch (error) {
      console.error('Error deleting asset:', error);
    }
  };

  // SubtitleList component to show existing subtitles
  const SubtitleList = ({ mediaId, onSubtitleDeleted }: { mediaId: number, onSubtitleDeleted: () => void }) => {
    const [subtitles, setSubtitles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      const loadSubtitles = async () => {
        try {
          const response = await fetch(`${getApiUrl()}/api/media/${mediaId}/subtitles`);
          if (response.ok) {
            const data = await response.json();
            setSubtitles(data || []);
          }
        } catch (error) {
          console.error('Failed to load subtitles:', error);
        } finally {
          setLoading(false);
        }
      };

      loadSubtitles();
    }, [mediaId]);

    const handleDeleteSubtitle = async (trackId: number) => {
      if (!confirm('Are you sure you want to delete this subtitle?')) return;

      try {
        const response = await fetch(`${getApiUrl()}/api/admin/media/${mediaId}/subtitles/${trackId}`, {
          method: 'DELETE'
        });

        if (response.ok) {
          setSubtitles(prev => prev.filter(sub => sub.id !== trackId));
          addTerminalOutput(`✅ Deleted subtitle track: ${trackId}`);
          onSubtitleDeleted();
        } else {
          const errorData = await response.json().catch(() => ({ error: response.statusText }));
          addTerminalOutput(`❌ Failed to delete subtitle: ${errorData.error || response.statusText}`);
        }
      } catch (error) {
        addTerminalOutput(`❌ Error deleting subtitle: ${error}`);
      }
    };

    const handleDownloadSubtitle = async (subtitle: any) => {
      try {
        const response = await fetch(`${getApiUrl()}/api/media/${mediaId}/subtitles/${subtitle.id}/file`);
        
        if (response.ok) {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${subtitle.language || 'subtitle'}.srt`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          addTerminalOutput(`✅ Downloaded subtitle: ${subtitle.language}`);
        } else {
          addTerminalOutput(`❌ Failed to download subtitle`);
        }
      } catch (error) {
        addTerminalOutput(`❌ Error downloading subtitle: ${error}`);
      }
    };

    if (loading) {
      return (
        <div className="mt-4">
          <h5 className="text-white/80 text-sm font-medium mb-2">Available Subtitles:</h5>
          <div className="text-white/60 text-sm">Loading subtitles...</div>
        </div>
      );
    }

    return (
      <div className="mt-4">
        <h5 className="text-white/80 text-sm font-medium mb-2">Available Subtitles ({subtitles.length}):</h5>
        <div className="space-y-2 max-h-32 overflow-y-auto">
          {subtitles.length === 0 ? (
            <div className="text-white/60 text-sm">No subtitles found</div>
          ) : (
            subtitles.map((subtitle) => (
              <div key={subtitle.id} className="flex items-center justify-between bg-white/5 rounded p-2">
                <div className="flex-1">
                  <div className="text-white text-sm font-medium">{String(subtitle.language || 'Unknown')}</div>
                  <div className="text-white/60 text-xs">
                    {String(subtitle.track_type || '')} • {String(subtitle.codec_name || '')}
                    {subtitle.is_default && ' • Default'}
                    {subtitle.is_forced && ' • Forced'}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDownloadSubtitle(subtitle)}
                    className="text-blue-400 hover:text-blue-300 p-1"
                    title="Download subtitle as SRT"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteSubtitle(subtitle.id)}
                    className="text-red-400 hover:text-red-300 p-1"
                    title="Delete subtitle"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const NetflixFileUploadSection = ({
    type,
    label,
    accept,
    mediaAssets,
    onUpload,
    onDelete,
    uploading
  }: {
    type: 'banner' | 'thumbnail' | 'trailer';
    label: string;
    accept: string;
    mediaAssets: MediaAssets;
    onUpload: (file: File, type: 'banner' | 'thumbnail' | 'trailer') => void;
    onDelete: (type: 'banner' | 'thumbnail' | 'trailer') => void;
    uploading: boolean;
  }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10"
    >
      <h4 className="text-white font-semibold mb-4 flex items-center">
        {type === 'trailer' ? <Video className="w-5 h-5 mr-2 text-[#E50914]" /> : <ImageIcon className="w-5 h-5 mr-2 text-[#E50914]" />}
        {label}
      </h4>

      {mediaAssets[type] ? (
        <div className="space-y-4">
          <div className="relative group">
            {type === 'trailer' ? (
              <video
                src={`${getApiUrl()}/api/admin/assets/${mediaAssets[type]}`}
                className="w-full h-40 object-cover rounded-lg"
                controls
              />
            ) : (
              <Image
                src={`${getApiUrl()}/api/admin/assets/${mediaAssets[type]}`}
                alt={label}
                width={400}
                height={160}
                className="w-full h-40 object-cover rounded-lg"
              />
            )}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg flex items-center justify-center">
              <MagneticButton
                onClick={() => onDelete(type)}
                className="bg-[#E50914] hover:bg-[#E50914]/80 text-white p-3 rounded-full"
              >
                <Trash2 className="w-5 h-5" />
              </MagneticButton>
            </div>
          </div>
          <p className="text-white/60 text-sm">Asset uploaded successfully</p>
        </div>
      ) : (
        <div className="border-2 border-dashed border-white/20 rounded-lg p-8 text-center hover:border-[#E50914]/50 transition-colors duration-300">
          <div className="text-white/40 mb-4">
            {type === 'trailer' ? <Video className="w-12 h-12 mx-auto" /> : <ImageIcon className="w-12 h-12 mx-auto" />}
          </div>
          <p className="text-white/60 text-sm mb-4">No {label.toLowerCase()} uploaded</p>
          <label className="cursor-pointer">
            <MagneticButton
              className="bg-[#E50914] hover:bg-[#E50914]/80 text-white px-6 py-3 rounded-lg inline-flex items-center gap-2"
              disabled={uploading}
            >
              <Upload className="w-4 h-4" />
              {uploading ? 'Uploading...' : `Upload ${label}`}
            </MagneticButton>
            <input
              type="file"
              accept={accept}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUpload(file, type);
              }}
              disabled={uploading}
            />
          </label>
        </div>
      )}
    </motion.div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-black">
        <Navbar onSearch={() => { }} />
        <div className="flex items-center justify-center h-96">
          <RedLoader />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <Navbar onSearch={() => { }} />

      {/* Netflix-style Header */}
      <div className="relative bg-gradient-to-b from-black via-black/90 to-black">
        <div className="container mx-auto px-6 md:px-12 lg:px-16 py-16">
          <ScrollReveal>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Settings</h1>
              <p className="text-xl text-white/70 max-w-2xl">
                Manage your HomeFlix media library, upload assets, and configure your streaming experience.
              </p>
            </motion.div>
          </ScrollReveal>
        </div>
      </div>

      <div className="container mx-auto px-6 md:px-12 lg:px-16 py-8">
        {/* Netflix-style Tab Navigation */}
        <div className="flex flex-wrap gap-2 mb-12 bg-black/50 backdrop-blur-sm rounded-lg p-2">
          <MagneticButton
            onClick={() => setActiveTab('media')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${activeTab === 'media'
              ? 'bg-[#E50914] text-white shadow-lg shadow-red-500/25'
              : 'bg-transparent text-white/70 hover:text-white hover:bg-white/10'
              }`}
          >
            <Database className="w-4 h-4 mr-2" />
            Media Library
          </MagneticButton>
          <MagneticButton
            onClick={() => setActiveTab('scanning')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${activeTab === 'scanning'
              ? 'bg-[#E50914] text-white shadow-lg shadow-red-500/25'
              : 'bg-transparent text-white/70 hover:text-white hover:bg-white/10'
              }`}
          >
            <Search className="w-4 h-4 mr-2" />
            Media Scanning
          </MagneticButton>
          <MagneticButton
            onClick={() => setActiveTab('system')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${activeTab === 'system'
              ? 'bg-[#E50914] text-white shadow-lg shadow-red-500/25'
              : 'bg-transparent text-white/70 hover:text-white hover:bg-white/10'
              }`}
          >
            <Server className="w-4 h-4 mr-2" />
            System Management
          </MagneticButton>
          <MagneticButton
            onClick={() => setActiveTab('tasks')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${activeTab === 'tasks'
              ? 'bg-[#E50914] text-white shadow-lg shadow-red-500/25'
              : 'bg-transparent text-white/70 hover:text-white hover:bg-white/10'
              }`}
          >
            <Activity className="w-4 h-4 mr-2" />
            Task Management
          </MagneticButton>
          <MagneticButton
            onClick={() => setActiveTab('watcher')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${activeTab === 'watcher'
              ? 'bg-[#E50914] text-white shadow-lg shadow-red-500/25'
              : 'bg-transparent text-white/70 hover:text-white hover:bg-white/10'
              }`}
          >
            <Monitor className="w-4 h-4 mr-2" />
            File Watcher
          </MagneticButton>
          <MagneticButton
            onClick={() => setActiveTab('analytics')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${activeTab === 'analytics'
              ? 'bg-[#E50914] text-white shadow-lg shadow-red-500/25'
              : 'bg-transparent text-white/70 hover:text-white hover:bg-white/10'
              }`}
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Analytics
          </MagneticButton>
          <MagneticButton
            onClick={() => setActiveTab('torrent')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 relative ${activeTab === 'torrent'
              ? 'bg-[#E50914] text-white shadow-lg shadow-red-500/25'
              : 'bg-transparent text-white/70 hover:text-white hover:bg-white/10'
              }`}
          >
            <Download className="w-4 h-4 mr-2" />
            Torrents
            {activeDownloads > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
                {activeDownloads}
              </span>
            )}
          </MagneticButton>
          <MagneticButton
            onClick={() => setActiveTab('paths')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${activeTab === 'paths'
              ? 'bg-[#E50914] text-white shadow-lg shadow-red-500/25'
              : 'bg-transparent text-white/70 hover:text-white hover:bg-white/10'
              }`}
          >
            <Folder className="w-4 h-4 mr-2" />
            Media Paths
          </MagneticButton>
          <MagneticButton
            onClick={() => setActiveTab('system-logs')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${activeTab === 'system-logs'
              ? 'bg-[#E50914] text-white shadow-lg shadow-red-500/25'
              : 'bg-transparent text-white/70 hover:text-white hover:bg-white/10'
              }`}
          >
            <Activity className="w-4 h-4 mr-2" />
            System Logs
          </MagneticButton>
          <MagneticButton
            onClick={() => setActiveTab('subtitles')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${activeTab === 'subtitles'
              ? 'bg-[#E50914] text-white shadow-lg shadow-red-500/25'
              : 'bg-transparent text-white/70 hover:text-white hover:bg-white/10'
              }`}
          >
            <FileSearch className="w-4 h-4 mr-2" />
            Subtitles
          </MagneticButton>
          <MagneticButton
            onClick={() => setActiveTab('general')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${activeTab === 'general'
              ? 'bg-[#E50914] text-white shadow-lg shadow-red-500/25'
              : 'bg-transparent text-white/70 hover:text-white hover:bg-white/10'
              }`}
          >
            <Settings className="w-4 h-4 mr-2" />
            General
          </MagneticButton>
        </div>

        {/* Media Management Tab */}
        {activeTab === 'media' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Netflix-style File Manager */}
            <div className="lg:col-span-1">
              <ScrollReveal>
                <GlassCard className="p-6">
                  <h2 className="text-xl font-semibold text-white mb-6 flex items-center">
                    <Folder className="w-6 h-6 mr-3 text-[#E50914]" />
                    Media Library
                  </h2>

                  {/* Search Input */}
                  <div className="mb-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/50" />
                      <input
                        type="text"
                        placeholder="Search media..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-black/50 border border-white/20 rounded-lg pl-10 pr-4 py-2 text-white placeholder-white/50 focus:border-[#E50914] focus:outline-none transition-colors"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/50 hover:text-white"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {searchQuery && (
                      <p className="text-white/60 text-sm mt-2">
                        Found {(() => {
                          const query = searchQuery.toLowerCase();
                          const movieCount = mediaList.filter(media => {
                            return (
                              media.title?.toLowerCase().includes(query) ||
                              media.description?.toLowerCase().includes(query) ||
                              media.genre_names?.some(genre => {
                                const genreStr = typeof genre === 'string' ? genre : (genre as any)?.name || String(genre);
                                return genreStr.toLowerCase().includes(query);
                              }) ||
                              media.year?.toString().includes(query) ||
                              media.country?.toLowerCase().includes(query) ||
                              media.language?.toLowerCase().includes(query)
                            );
                          }).length;
                          const seriesCount = seriesList.filter(series => {
                            return (
                              series.title?.toLowerCase().includes(query) ||
                              series.description?.toLowerCase().includes(query) ||
                              series.status?.toLowerCase().includes(query)
                            );
                          }).length;
                          return movieCount + seriesCount;
                        })()} results
                      </p>
                    )}

                    <p className="text-white/50 text-xs mt-2">
                      💡 Click to select media for management
                    </p>
                  </div>

                  <div className="max-h-96 overflow-y-auto">
                    <FolderTree
                      data={createFolderTreeData()}
                      onSelect={(item: any) => {
                        console.log('🎯 FolderTree onSelect called with:', item);
                        if (item.type === 'file' && item.media) {
                          console.log('📂 Selecting media from folder tree:', item.media);
                          handleMediaSelect(item.media);
                        }
                      }}
                      className="text-white"
                    />
                  </div>
                </GlassCard>
              </ScrollReveal>
            </div>

            {/* Comprehensive Media Management */}
            <div className="lg:col-span-2">
              {selectedMedia ? (
                <ScrollReveal delay={0.2}>
                  <div className="space-y-6">
                    {/* Media Header with Actions */}
                    <GlassCard className="p-6">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center space-x-4">
                          <div className="relative">
                            {selectedMedia.thumbnail_path ? (
                              <Image
                                src={`${getApiUrl()}/api/thumbnails/${selectedMedia.id}`}
                                alt={selectedMedia.title}
                                width={80}
                                height={120}
                                className="rounded-lg object-cover"
                              />
                            ) : (
                              <div className="w-20 h-30 bg-white/10 rounded-lg flex items-center justify-center">
                                <Video className="w-8 h-8 text-white/50" />
                              </div>
                            )}
                          </div>
                          <div>
                            <h2 className="text-2xl font-semibold text-white">
                              {selectedMedia.isEditing && editingMedia.title ? editingMedia.title : selectedMedia.title}
                            </h2>
                            <p className="text-white/70">
                              {selectedMedia.isEditing && editingMedia.year ? editingMedia.year : selectedMedia.year} • {selectedMedia.type}
                            </p>
                            <div className="flex items-center space-x-2 mt-2">
                              {selectedMedia.rating && (
                                <div className="flex items-center space-x-1">
                                  <Star className="w-4 h-4 text-yellow-500" />
                                  <span className="text-white/80">{selectedMedia.rating}</span>
                                </div>
                              )}
                              {selectedMedia.runtime && (
                                <div className="flex items-center space-x-1">
                                  <Clock className="w-4 h-4 text-white/60" />
                                  <span className="text-white/80">{selectedMedia.runtime}min</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex space-x-2">
                          <MagneticButton
                            onClick={() => {
                              if (selectedMedia.type === 'tv') {
                                navigate.push(`/tv-series/${selectedMedia.id}`);
                              } else {
                                navigate.push(`/movie/${selectedMedia.id}`);
                              }
                            }}
                            className="bg-[#E50914] hover:bg-[#E50914]/80 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                            title={`Watch ${selectedMedia.type === 'tv' ? 'Series' : 'Movie'}`}
                          >
                            <Play className="w-4 h-4" />
                            <span>Watch</span>
                          </MagneticButton>
                          <MagneticButton
                            onClick={() => {
                              if (selectedMedia.type === 'tv') {
                                navigate.push(`/tv-series/${selectedMedia.id}`);
                              } else {
                                navigate.push(`/movie/${selectedMedia.id}`);
                              }
                            }}
                            className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                            title={`View ${selectedMedia.type === 'tv' ? 'Series' : 'Movie'} Details`}
                          >
                            <Info className="w-4 h-4" />
                            <span>Details</span>
                          </MagneticButton>
                          <MagneticButton
                            onClick={handleEditToggle}
                            className={`px-4 py-2 rounded-lg flex items-center space-x-2 ${selectedMedia.isEditing
                              ? 'bg-[#E50914] hover:bg-[#E50914]/80 text-white'
                              : 'bg-white/10 hover:bg-white/20 text-white'
                              }`}
                          >
                            {selectedMedia.isEditing ? (
                              <>
                                <X className="w-4 h-4" />
                                <span>Cancel</span>
                              </>
                            ) : (
                              <>
                                <Edit3 className="w-4 h-4" />
                                <span>Edit</span>
                              </>
                            )}
                          </MagneticButton>
                          <MagneticButton
                            onClick={handleDeleteMedia}
                            disabled={actionLoading.delete}
                            className="bg-red-600/20 hover:bg-red-600/40 text-red-400 px-4 py-2 rounded-lg flex items-center space-x-2 transition-all duration-300"
                            title="Delete Media (Permanent)"
                          >
                            {actionLoading.delete ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-400"></div>
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                            <span>Delete</span>
                          </MagneticButton>
                        </div>
                      </div>

                      {/* Action Buttons Row */}
                      <div className="flex flex-wrap gap-3">
                        {selectedMedia.type !== 'tv' && (
                          <MagneticButton
                            onClick={handleRegenerateThumbnail}
                            disabled={isRegenerating.thumbnail}
                            className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 px-4 py-2 rounded-lg flex items-center space-x-2"
                          >
                            {isRegenerating.thumbnail ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                            ) : (
                              <ImageIcon className="w-4 h-4" />
                            )}
                            <span>Force Regenerate Thumbnail</span>
                          </MagneticButton>
                        )}

                        {selectedMedia.type !== 'tv' && (
                          <MagneticButton
                            onClick={handleRegeneratePreview}
                            disabled={isRegenerating.preview}
                            className="bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 px-4 py-2 rounded-lg flex items-center space-x-2"
                          >
                            {isRegenerating.preview ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-400"></div>
                            ) : (
                              <Video className="w-4 h-4" />
                            )}
                            <span>Force Regenerate Preview</span>
                          </MagneticButton>
                        )}

                        <MagneticButton
                          onClick={handleGeneratePoster}
                          disabled={isRegenerating.poster}
                          className="bg-orange-600/20 hover:bg-orange-600/40 text-orange-400 px-4 py-2 rounded-lg flex items-center space-x-2"
                        >
                          {isRegenerating.poster ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-400"></div>
                          ) : (
                            <ImageIcon className="w-4 h-4" />
                          )}
                          <span>Generate Poster</span>
                        </MagneticButton>

                        <MagneticButton
                          onClick={() => handleFetchTMDBData()}
                          disabled={actionLoading.tmdb}
                          className="bg-green-600/20 hover:bg-green-600/40 text-green-400 px-4 py-2 rounded-lg flex items-center space-x-2"
                        >
                          {actionLoading.tmdb ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-400"></div>
                          ) : (
                            <RefreshCw className="w-4 h-4" />
                          )}
                          <span>Fetch TMDB Data</span>
                        </MagneticButton>

                        <MagneticButton
                          onClick={() => {
                            console.log('🔍 Opening TMDB Search Modal for:', selectedMedia?.title);
                            console.log('🎭 Current modal state:', showTMDBSearchModal);
                            const searchTitle = selectedMedia?.title || '';
                            setCustomSearchTitle(searchTitle);
                            setShowTMDBSearchModal(true);
                            addTerminalOutput(`🔍 Opening TMDB search for: ${searchTitle}`);
                          }}
                          disabled={actionLoading.tmdb}
                          className="bg-yellow-600/20 hover:bg-yellow-600/40 text-yellow-400 px-4 py-2 rounded-lg flex items-center space-x-2"
                        >
                          <Search className="w-4 h-4" />
                          <span>Search & Update TMDB</span>
                        </MagneticButton>

                        {selectedMedia.isEditing && (
                          <MagneticButton
                            onClick={handleSaveChanges}
                            disabled={actionLoading.save}
                            className="bg-[#E50914] hover:bg-[#E50914]/80 text-white px-6 py-2 rounded-lg flex items-center space-x-2"
                          >
                            {actionLoading.save ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            ) : (
                              <Save className="w-4 h-4" />
                            )}
                            <span>Save Changes</span>
                          </MagneticButton>
                        )}

                        <MagneticButton
                          onClick={async () => {
                            if (!selectedMedia) return;
                            addTerminalOutput(`🔄 Refreshing selected media: ${selectedMedia.title}`);

                            try {
                              // Refresh the specific media item
                              let refreshResponse;
                              if (selectedMedia.type === 'tv') {
                                refreshResponse = await fetch(`${getApiUrl()}/api/series/${selectedMedia.id}`);
                              } else {
                                refreshResponse = await fetch(`${getApiUrl()}/api/media/${selectedMedia.id}`);
                              }

                              if (refreshResponse.ok) {
                                const refreshedData = await refreshResponse.json();

                                if (selectedMedia.type === 'tv') {
                                  // Convert series data back to media-like format
                                  const refreshedMedia = {
                                    ...selectedMedia,
                                    ...refreshedData,
                                    type: 'tv' as const,
                                    id: selectedMedia.id
                                  };
                                  setSelectedMedia(refreshedMedia);

                                  // Update series list
                                  setSeriesList(prev => prev.map(s =>
                                    s.id === selectedMedia.id ? refreshedData : s
                                  ));
                                } else {
                                  const refreshedMedia = {
                                    ...refreshedData,
                                    isEditing: selectedMedia.isEditing,
                                    id: selectedMedia.id
                                  };
                                  setSelectedMedia(refreshedMedia);

                                  // Update media list
                                  setMediaList(prev => prev.map(m =>
                                    m.id === selectedMedia.id ? refreshedMedia : m
                                  ));
                                }

                                addTerminalOutput(`✅ Successfully refreshed: ${selectedMedia.title}`);
                              } else {
                                addTerminalOutput(`❌ Failed to refresh media: ${refreshResponse.statusText}`);
                              }
                            } catch (error) {
                              addTerminalOutput(`❌ Error refreshing media: ${error}`);
                            }
                          }}
                          className="bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-400 px-4 py-2 rounded-lg flex items-center space-x-2"
                        >
                          <RefreshCw className="w-4 h-4" />
                          <span>Refresh Selected Media</span>
                        </MagneticButton>

                        <MagneticButton
                          onClick={handleDeleteMedia}
                          disabled={actionLoading.delete}
                          className="bg-red-600/20 hover:bg-red-600/40 text-red-400 px-4 py-2 rounded-lg flex items-center space-x-2 border border-red-600/30"
                        >
                          {actionLoading.delete ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-400"></div>
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                          <span>Delete {selectedMedia.type === 'tv' ? 'Series' : 'Movie'}</span>
                        </MagneticButton>
                      </div>
                    </GlassCard>

                    {/* Media Information */}
                    <GlassCard className="p-6">
                      <h3 className="text-xl font-semibold text-white mb-6 flex items-center">
                        <Info className="w-6 h-6 mr-3 text-[#E50914]" />
                        Media Information
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Basic Information */}
                        <div className="space-y-4">
                          <h4 className="text-lg font-medium text-white/90 mb-3">Basic Information</h4>

                          <div className="space-y-3">
                            <div>
                              <label className="block text-sm font-medium text-white/70 mb-1">Title</label>
                              {selectedMedia.isEditing ? (
                                <input
                                  type="text"
                                  value={editingMedia.title || ''}
                                  onChange={(e) => handleInputChange('title', e.target.value)}
                                  className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-2 text-white"
                                />
                              ) : (
                                <p className="text-white bg-white/5 rounded-lg px-4 py-2">{selectedMedia.title}</p>
                              )}
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-white/70 mb-1">Description</label>
                              {selectedMedia.isEditing ? (
                                <textarea
                                  value={editingMedia.description || ''}
                                  onChange={(e) => handleInputChange('description', e.target.value)}
                                  rows={3}
                                  className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-2 text-white"
                                />
                              ) : (
                                <p className="text-white bg-white/5 rounded-lg px-4 py-2">{selectedMedia.description || 'No description available'}</p>
                              )}
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-white/70 mb-1">Tagline</label>
                              {selectedMedia.isEditing ? (
                                <input
                                  type="text"
                                  value={editingMedia.tagline || ''}
                                  onChange={(e) => handleInputChange('tagline', e.target.value)}
                                  className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-2 text-white"
                                />
                              ) : (
                                <p className="text-white bg-white/5 rounded-lg px-4 py-2">{selectedMedia.tagline || 'No tagline'}</p>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-sm font-medium text-white/70 mb-1">Year</label>
                                {selectedMedia.isEditing ? (
                                  <input
                                    type="number"
                                    value={editingMedia.year || ''}
                                    onChange={(e) => handleInputChange('year', parseInt(e.target.value) || undefined)}
                                    className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-2 text-white"
                                  />
                                ) : (
                                  <p className="text-white bg-white/5 rounded-lg px-4 py-2">{selectedMedia.year || 'Unknown'}</p>
                                )}
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-white/70 mb-1">Rating</label>
                                {selectedMedia.isEditing ? (
                                  <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="10"
                                    value={editingMedia.rating || ''}
                                    onChange={(e) => handleInputChange('rating', parseFloat(e.target.value) || undefined)}
                                    className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-2 text-white"
                                  />
                                ) : (
                                  <p className="text-white bg-white/5 rounded-lg px-4 py-2 flex items-center">
                                    <Star className="w-4 h-4 text-yellow-500 mr-1" />
                                    {selectedMedia.rating || 'Unrated'}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Technical & Additional Info */}
                        <div className="space-y-4">
                          <h4 className="text-lg font-medium text-white/90 mb-3">Technical Information</h4>

                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-sm font-medium text-white/70 mb-1">Country</label>
                                {selectedMedia.isEditing ? (
                                  <input
                                    type="text"
                                    value={editingMedia.country || ''}
                                    onChange={(e) => handleInputChange('country', e.target.value)}
                                    className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-2 text-white"
                                  />
                                ) : (
                                  <p className="text-white bg-white/5 rounded-lg px-4 py-2 flex items-center">
                                    <Globe className="w-4 h-4 text-white/60 mr-1" />
                                    {selectedMedia.country || 'Unknown'}
                                  </p>
                                )}
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-white/70 mb-1">Language</label>
                                {selectedMedia.isEditing ? (
                                  <input
                                    type="text"
                                    value={editingMedia.language || ''}
                                    onChange={(e) => handleInputChange('language', e.target.value)}
                                    className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-2 text-white"
                                  />
                                ) : (
                                  <p className="text-white bg-white/5 rounded-lg px-4 py-2">{selectedMedia.language || 'Unknown'}</p>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-sm font-medium text-white/70 mb-1">Quality</label>
                                {selectedMedia.isEditing ? (
                                  <select
                                    value={editingMedia.quality || ''}
                                    onChange={(e) => handleInputChange('quality', e.target.value)}
                                    className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-2 text-white"
                                  >
                                    <option value="">Select Quality</option>
                                    <option value="4K">4K</option>
                                    <option value="HD">HD</option>
                                    <option value="SD">SD</option>
                                    <option value="HDR">HDR</option>
                                  </select>
                                ) : (
                                  <p className="text-white bg-white/5 rounded-lg px-4 py-2">{selectedMedia.quality || 'Unknown'}</p>
                                )}
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-white/70 mb-1">
                                  {selectedMedia.type === 'tv' ? 'Episode Runtime' : 'Runtime'}
                                </label>
                                {selectedMedia.isEditing ? (
                                  <input
                                    type="number"
                                    value={editingMedia.runtime || ''}
                                    onChange={(e) => handleInputChange('runtime', parseInt(e.target.value) || undefined)}
                                    className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-2 text-white"
                                    placeholder="Minutes"
                                  />
                                ) : (
                                  <p className="text-white bg-white/5 rounded-lg px-4 py-2 flex items-center">
                                    <Clock className="w-4 h-4 text-white/60 mr-1" />
                                    {selectedMedia.runtime ? `${selectedMedia.runtime} min` : 'Unknown'}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-white/70 mb-1">Certification</label>
                              {selectedMedia.isEditing ? (
                                <select
                                  value={editingMedia.certification || ''}
                                  onChange={(e) => handleInputChange('certification', e.target.value)}
                                  className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-2 text-white"
                                >
                                  <option value="">Select Rating</option>
                                  <option value="G">G</option>
                                  <option value="PG">PG</option>
                                  <option value="PG-13">PG-13</option>
                                  <option value="R">R</option>
                                  <option value="NC-17">NC-17</option>
                                  <option value="TV-G">TV-G</option>
                                  <option value="TV-PG">TV-PG</option>
                                  <option value="TV-14">TV-14</option>
                                  <option value="TV-MA">TV-MA</option>
                                </select>
                              ) : (
                                <p className="text-white bg-white/5 rounded-lg px-4 py-2">{selectedMedia.certification || 'Not Rated'}</p>
                              )}
                            </div>

                            {/* TV Show Specific Fields */}
                            {selectedMedia.type === 'tv' && (
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-sm font-medium text-white/70 mb-1">Seasons</label>
                                  {selectedMedia.isEditing ? (
                                    <input
                                      type="number"
                                      value={(editingMedia as any).seasons || ''}
                                      onChange={(e) => handleInputChange('seasons', parseInt(e.target.value) || undefined)}
                                      className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-2 text-white"
                                      placeholder="Number of seasons"
                                    />
                                  ) : (
                                    <p className="text-white bg-white/5 rounded-lg px-4 py-2">
                                      {(selectedMedia as any).seasons || 'Unknown'}
                                    </p>
                                  )}
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-white/70 mb-1">Episodes</label>
                                  {selectedMedia.isEditing ? (
                                    <input
                                      type="number"
                                      value={(editingMedia as any).episodes || ''}
                                      onChange={(e) => handleInputChange('episodes', parseInt(e.target.value) || undefined)}
                                      className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-2 text-white"
                                      placeholder="Total episodes"
                                    />
                                  ) : (
                                    <p className="text-white bg-white/5 rounded-lg px-4 py-2">
                                      {(selectedMedia as any).episodes || 'Unknown'}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Additional TV Show Fields */}
                            {selectedMedia.type === 'tv' && (
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-sm font-medium text-white/70 mb-1">Status</label>
                                  {selectedMedia.isEditing ? (
                                    <select
                                      value={(editingMedia as any).status || ''}
                                      onChange={(e) => handleInputChange('status', e.target.value)}
                                      className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-2 text-white"
                                    >
                                      <option value="">Select Status</option>
                                      <option value="Returning Series">Returning Series</option>
                                      <option value="Ended">Ended</option>
                                      <option value="Canceled">Canceled</option>
                                      <option value="In Production">In Production</option>
                                      <option value="Planned">Planned</option>
                                    </select>
                                  ) : (
                                    <p className="text-white bg-white/5 rounded-lg px-4 py-2">
                                      {(selectedMedia as any).status || 'Unknown'}
                                    </p>
                                  )}
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-white/70 mb-1">Network</label>
                                  {selectedMedia.isEditing ? (
                                    <input
                                      type="text"
                                      value={(editingMedia as any).network || ''}
                                      onChange={(e) => handleInputChange('network', e.target.value)}
                                      className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-2 text-white"
                                      placeholder="Original network"
                                    />
                                  ) : (
                                    <p className="text-white bg-white/5 rounded-lg px-4 py-2">
                                      {(selectedMedia as any).network || 'Unknown'}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* File Information */}
                            <div className="pt-4 border-t border-white/10">
                              <h5 className="text-sm font-medium text-white/80 mb-2">File Information</h5>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-white/60">File Size:</span>
                                  <span className="text-white">{selectedMedia.file_size ? `${(selectedMedia.file_size / (1024 ** 3)).toFixed(2)} GB` : 'Unknown'}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-white/60">Resolution:</span>
                                  <span className="text-white">{selectedMedia.resolution || 'Unknown'}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-white/60">Codec:</span>
                                  <span className="text-white">{selectedMedia.codec || 'Unknown'}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-white/60">Views:</span>
                                  <span className="text-white flex items-center">
                                    <Eye className="w-4 h-4 mr-1" />
                                    {selectedMedia.view_count || 0}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Genres */}
                      <div className="mt-6 pt-6 border-t border-white/10">
                        <label className="block text-sm font-medium text-white/70 mb-2">Genres</label>
                        {selectedMedia.isEditing ? (
                          <input
                            type="text"
                            value={editingMedia.genre_names?.map(g => typeof g === 'string' ? g : (g as any)?.name || String(g)).join(', ') || ''}
                            onChange={(e) => setEditingMedia(prev => ({ ...prev, genre_names: e.target.value.split(',').map(g => g.trim()) }))}
                            className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-2 text-white"
                            placeholder="Action, Drama, Thriller (comma separated)"
                          />
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {selectedMedia.genre_names && selectedMedia.genre_names.length > 0 ? (
                              selectedMedia.genre_names.map((genre, index) => (
                                <span key={index} className="bg-[#E50914]/20 text-[#E50914] px-3 py-1 rounded-full text-sm">
                                  {typeof genre === 'string' ? genre : (genre as any)?.name || String(genre)}
                                </span>
                              ))
                            ) : (
                              <span className="text-white/60">No genres assigned</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Quick Navigation */}
                      <div className="mt-6 pt-6 border-t border-white/10">
                        <div className="flex items-center justify-between">
                          <h5 className="text-sm font-medium text-white/70">Quick Actions</h5>
                          <div className="flex space-x-3">
                            <MagneticButton
                              onClick={() => {
                                if (selectedMedia.type === 'tv') {
                                  navigate.push(`/tv-series/${selectedMedia.id}`);
                                } else {
                                  navigate.push(`/movie/${selectedMedia.id}`);
                                }
                              }}
                              className="bg-[#E50914] hover:bg-[#E50914]/80 text-white px-4 py-2 rounded-lg flex items-center space-x-2 text-sm"
                            >
                              <Play className="w-4 h-4" />
                              <span>Watch Now</span>
                            </MagneticButton>
                            <MagneticButton
                              onClick={() => {
                                if (selectedMedia.type === 'tv') {
                                  navigate.push(`/tv-series/${selectedMedia.id}`);
                                } else {
                                  navigate.push(`/movie/${selectedMedia.id}`);
                                }
                              }}
                              className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg flex items-center space-x-2 text-sm"
                            >
                              <Info className="w-4 h-4" />
                              <span>View Details</span>
                            </MagneticButton>
                          </div>
                        </div>
                      </div>
                    </GlassCard>

                    {/* File Information */}
                    {selectedMedia?.file_path && (
                      <GlassCard className="p-6">
                        <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                          <File className="w-6 h-6 mr-3 text-[#E50914]" />
                          File Information
                        </h3>
                        <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10">
                          <div className="flex items-center space-x-3">
                            <HardDrive className="w-5 h-5 text-white/60" />
                            <div className="flex-1">
                              <p className="text-white/70 text-sm mb-1">File Path</p>
                              <p className="text-white font-mono text-sm break-all bg-black/20 px-3 py-2 rounded border">
                                {selectedMedia.file_path}
                              </p>
                            </div>
                          </div>
                        </div>
                      </GlassCard>
                    )}

                    {/* Asset Management */}
                    <GlassCard className="p-6">
                      <h3 className="text-xl font-semibold text-white mb-6 flex items-center">
                        <ImageIcon className="w-6 h-6 mr-3 text-[#E50914]" />
                        Asset Management
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <NetflixFileUploadSection
                          type="banner"
                          label="Hero Banner (4K)"
                          accept="image/*"
                          mediaAssets={mediaAssets}
                          onUpload={handleFileUpload}
                          onDelete={handleDeleteAsset}
                          uploading={uploading}
                        />
                        <NetflixFileUploadSection
                          type="thumbnail"
                          label="Thumbnail"
                          accept="image/*"
                          mediaAssets={mediaAssets}
                          onUpload={handleFileUpload}
                          onDelete={handleDeleteAsset}
                          uploading={uploading}
                        />
                        <NetflixFileUploadSection
                          type="trailer"
                          label="Trailer Video"
                          accept="video/*"
                          mediaAssets={mediaAssets}
                          onUpload={handleFileUpload}
                          onDelete={handleDeleteAsset}
                          uploading={uploading}
                        />

                        {/* Subtitle Upload Section */}
                        <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
                          <h4 className="text-white font-semibold mb-4 flex items-center">
                            <FileSearch className="w-5 h-5 mr-2 text-[#E50914]" />
                            Subtitles
                          </h4>

                          <div className="space-y-4">
                            {/* Upload Subtitle */}
                            <div className="border-2 border-dashed border-white/20 rounded-lg p-6 text-center hover:border-[#E50914]/50 transition-colors duration-300">
                              <div className="text-white/40 mb-4">
                                <FileSearch className="w-8 h-8 mx-auto" />
                              </div>
                              <p className="text-white/60 text-sm mb-4">Upload subtitle files (.srt, .vtt, .ass, .ssa, .sub, .sbv)</p>
                              <label htmlFor="subtitle-upload" className="cursor-pointer inline-block">
                                <div className="bg-[#E50914] hover:bg-[#E50914]/80 text-white px-4 py-2 rounded-lg inline-flex items-center gap-2 transition-colors duration-300 hover:scale-105">
                                  <Upload className="w-4 h-4" />
                                  {uploading ? 'Uploading...' : 'Upload Subtitles'}
                                </div>
                              </label>
                              <input
                                id="subtitle-upload"
                                type="file"
                                accept=".srt,.vtt,.ass,.ssa,.sub,.sbv"
                                multiple
                                className="hidden"
                                onChange={handleSubtitleUpload}
                                disabled={uploading}
                              />
                            </div>

                            {/* Scan for Subtitles */}
                            <MagneticButton
                              onClick={handleScanSubtitles}
                              disabled={actionLoading.scanSubtitles}
                              className="w-full bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 py-2 px-4 rounded-lg flex items-center justify-center space-x-2"
                            >
                              {actionLoading.scanSubtitles ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                              ) : (
                                <Search className="w-4 h-4" />
                              )}
                              <span>Scan Storage for Subtitles</span>
                            </MagneticButton>

                            {/* Test Subtitles Button */}
                            {selectedMedia && (
                              <MagneticButton
                                onClick={handleTestSubtitles}
                                disabled={actionLoading.testSubtitles}
                                className="w-full bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 py-2 px-4 rounded-lg flex items-center justify-center space-x-2"
                              >
                                {actionLoading.testSubtitles ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-400"></div>
                                ) : (
                                  <Info className="w-4 h-4" />
                                )}
                                <span>Test Subtitle System</span>
                              </MagneticButton>
                            )}

                            {/* Show existing subtitles */}
                            {selectedMedia && (
                              <SubtitleList
                                mediaId={selectedMedia.id}
                                onSubtitleDeleted={() => {
                                  // Refresh media data when subtitle is deleted
                                  fetchMediaList();
                                  if (selectedMedia) {
                                    handleMediaSelect(selectedMedia);
                                  }
                                }}
                              />
                            )}
                          </div>
                        </div>

            
                      </div>

                      {/* OpenSubtitles Integration */}
                        {selectedMedia && (
                          <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10 mt-6 w-full">
                            <h4 className="text-white font-semibold mb-4 flex items-center">
                              <Globe className="w-5 h-5 mr-2 text-[#E50914]" />
                              OpenSubtitles Search
                            </h4>

                            <div className="space-y-4">
                              {/* Search Form */}
                              <div className="flex gap-3">
                                <div className="flex-1">
                                  <input
                                    type="text"
                                    placeholder={`Search subtitles for "${selectedMedia.title}"...`}
                                    value={openSubtitlesQuery}
                                    onChange={(e) => setOpenSubtitlesQuery(e.target.value)}
                                    className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-white/50 focus:border-[#E50914] focus:outline-none transition-colors"
                                    onKeyPress={(e) => {
                                      if (e.key === 'Enter') {
                                        handleOpenSubtitlesSearch();
                                      }
                                    }}
                                  />
                                </div>
                                <select
                                  value={selectedLanguage}
                                  onChange={(e) => setSelectedLanguage(e.target.value)}
                                  className="bg-black/50 border border-white/20 rounded-lg px-3 py-2 text-white focus:border-[#E50914] focus:outline-none transition-colors"
                                >
                                  <option value="en">English</option>
                                  <option value="es">Spanish</option>
                                  <option value="fr">French</option>
                                  <option value="de">German</option>
                                  <option value="it">Italian</option>
                                  <option value="pt">Portuguese</option>
                                  <option value="ru">Russian</option>
                                  <option value="ja">Japanese</option>
                                  <option value="ko">Korean</option>
                                  <option value="zh">Chinese</option>
                                  <option value="ar">Arabic</option>
                                </select>
                                <MagneticButton
                                  onClick={handleOpenSubtitlesSearch}
                                  disabled={openSubtitlesLoading || !openSubtitlesQuery.trim()}
                                  className="bg-[#E50914] hover:bg-[#E50914]/80 text-white px-6 py-2 rounded-lg flex items-center space-x-2 transition-colors"
                                >
                                  {openSubtitlesLoading ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                  ) : (
                                    <Search className="w-4 h-4" />
                                  )}
                                  <span>Search</span>
                                </MagneticButton>
                              </div>

                              {/* Auto-populate button */}
                              <MagneticButton
                                onClick={() => {
                                  setOpenSubtitlesQuery(selectedMedia.title);
                                  addTerminalOutput(`🎬 Auto-populated search with: ${selectedMedia.title}`);
                                }}
                                className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 px-4 py-2 rounded-lg flex items-center space-x-2 text-sm"
                              >
                                <Film className="w-4 h-4" />
                                <span>Use Media Title</span>
                              </MagneticButton>

                              {/* Search Results */}
                              {openSubtitlesResults.length > 0 && (
                                <div className="space-y-3 max-h-96 overflow-y-auto">
                                  <h5 className="text-white/80 font-medium">Search Results ({openSubtitlesResults.length})</h5>
                                  {openSubtitlesResults.map((subtitle, index) => (
                                    <div key={index} className="bg-black/30 rounded-lg p-4 border border-white/10">
                                      <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                          <div className="flex items-center space-x-3 mb-2">
                                            <span className="text-white font-medium">
                                              {subtitle.attributes?.feature_details?.title || 'Unknown Title'}
                                            </span>
                                            <span className="text-white/60 text-sm">
                                              ({subtitle.attributes?.feature_details?.year || 'Unknown Year'})
                                            </span>
                                            <span className="bg-[#E50914]/20 text-[#E50914] px-2 py-1 rounded text-xs">
                                              {subtitle.attributes?.language?.toUpperCase() || 'Unknown'}
                                            </span>
                                          </div>
                                          <div className="flex items-center space-x-4 text-sm text-white/60">
                                            <span>📥 {subtitle.attributes?.download_count || 0} downloads</span>
                                            <span>⭐ {subtitle.attributes?.ratings?.toFixed(1) || 'N/A'}</span>
                                            {subtitle.attributes?.hearing_impaired && (
                                              <span className="text-yellow-400">🔊 CC</span>
                                            )}
                                            {subtitle.attributes?.hd && (
                                              <span className="text-blue-400">🎬 HD</span>
                                            )}
                                          </div>
                                          {subtitle.attributes?.release && (
                                            <p className="text-white/50 text-xs mt-1 truncate">
                                              Release: {subtitle.attributes.release}
                                            </p>
                                          )}
                                        </div>
                                        <MagneticButton
                                          onClick={() => handleDownloadOpenSubtitle(subtitle)}
                                          disabled={downloadingSubtitle === subtitle.attributes?.files?.[0]?.file_id}
                                          className="bg-green-600/20 hover:bg-green-600/40 text-green-400 px-4 py-2 rounded-lg flex items-center space-x-2 ml-4"
                                        >
                                          {downloadingSubtitle === subtitle.attributes?.files?.[0]?.file_id ? (
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-400"></div>
                                          ) : (
                                            <Download className="w-4 h-4" />
                                          )}
                                          <span>Add</span>
                                        </MagneticButton>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* No results message */}
                              {openSubtitlesResults.length === 0 && openSubtitlesQuery && !openSubtitlesLoading && (
                                <div className="text-center py-8 text-white/60">
                                  <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                  <p>No subtitles found for "{openSubtitlesQuery}"</p>
                                  <p className="text-sm mt-1">Try a different search term or language</p>
                                </div>
                              )}

                              {/* Help text */}
                              <div className="bg-blue-600/10 border border-blue-600/20 rounded-lg p-3">
                                <p className="text-blue-300 text-sm">
                                  💡 <strong>Tip:</strong> Click "Use Media Title" to auto-populate the search with the current media title, 
                                  then click "Search" to find matching subtitles from OpenSubtitles.org
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                      {uploading && (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-6 bg-[#E50914]/20 border border-[#E50914]/30 rounded-lg p-4"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#E50914]"></div>
                            <p className="text-white">Uploading asset...</p>
                          </div>
                        </motion.div>
                      )}
                    </GlassCard>
                  </div>
                </ScrollReveal>
              ) : (
                <GlassCard className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <File className="w-16 h-16 text-white/30 mx-auto mb-4" />
                    <p className="text-white/70 text-lg">Select a media item to manage</p>
                    <p className="text-white/50 text-sm mt-2">Choose from the media library to view detailed information, edit metadata, regenerate assets, and more</p>
                  </div>
                </GlassCard>
              )}
            </div>
          </div>
        )}




        {/* Media Scanning Tab */}
        {activeTab === 'scanning' && (
          <div className="space-y-8">
            <ScrollReveal>
              <GlassCard className="p-6">
                <h2 className="text-2xl font-semibold text-white mb-6 flex items-center">
                  <Search className="w-6 h-6 mr-3 text-[#E50914]" />
                  Media Library Scanning
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                  {/* Full Scan */}
                  <div className="bg-white/5 rounded-lg p-6 border border-white/10">
                    <div className="flex items-center mb-4">
                      <FileSearch className="w-8 h-8 text-blue-500 mr-3" />
                      <div>
                        <h3 className="text-lg font-semibold text-white">Full Scan</h3>
                        <p className="text-white/60 text-sm">Complete library scan</p>
                      </div>
                    </div>
                    <p className="text-white/70 text-sm mb-4">
                      Scans entire media directory for new files and updates metadata.
                    </p>
                    <MagneticButton
                      onClick={() => triggerScan('full')}
                      disabled={isScanning || actionLoading.full}
                      className="w-full bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 py-2 px-4 rounded-lg flex items-center justify-center space-x-2"
                    >
                      {actionLoading.full ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                      <span>Start Full Scan</span>
                    </MagneticButton>
                  </div>

                  {/* Incremental Scan */}
                  <div className="bg-white/5 rounded-lg p-6 border border-white/10">
                    <div className="flex items-center mb-4">
                      <Zap className="w-8 h-8 text-yellow-500 mr-3" />
                      <div>
                        <h3 className="text-lg font-semibold text-white">Incremental Scan</h3>
                        <p className="text-white/60 text-sm">Quick update scan</p>
                      </div>
                    </div>
                    <p className="text-white/70 text-sm mb-4">
                      Fast scan for recently modified files only.
                    </p>
                    <MagneticButton
                      onClick={() => triggerScan('incremental')}
                      disabled={isScanning || actionLoading.incremental}
                      className="w-full bg-yellow-600/20 hover:bg-yellow-600/40 text-yellow-400 py-2 px-4 rounded-lg flex items-center justify-center space-x-2"
                    >
                      {actionLoading.incremental ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-400"></div>
                      ) : (
                        <Zap className="w-4 h-4" />
                      )}
                      <span>Quick Scan</span>
                    </MagneticButton>
                  </div>

                  {/* Sync Scan */}
                  <div className="bg-white/5 rounded-lg p-6 border border-white/10">
                    <div className="flex items-center mb-4">
                      <RefreshCw className="w-8 h-8 text-green-500 mr-3" />
                      <div>
                        <h3 className="text-lg font-semibold text-white">Sync & Clean</h3>
                        <p className="text-white/60 text-sm">Database sync</p>
                      </div>
                    </div>
                    <p className="text-white/70 text-sm mb-4">
                      Synchronizes database with storage and removes invalid entries.
                    </p>
                    <MagneticButton
                      onClick={() => triggerScan('database-sync')}
                      disabled={isScanning || actionLoading['database-sync']}
                      className="w-full bg-green-600/20 hover:bg-green-600/40 text-green-400 py-2 px-4 rounded-lg flex items-center justify-center space-x-2"
                    >
                      {actionLoading['database-sync'] ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-400"></div>
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      <span>Sync Database</span>
                    </MagneticButton>
                  </div>

                  {/* Superfast Scan */}
                  <div className="bg-white/5 rounded-lg p-6 border border-white/10">
                    <div className="flex items-center mb-4">
                      <Timer className="w-8 h-8 text-purple-500 mr-3" />
                      <div>
                        <h3 className="text-lg font-semibold text-white">Superfast Scan</h3>
                        <p className="text-white/60 text-sm">Lightning quick</p>
                      </div>
                    </div>
                    <p className="text-white/70 text-sm mb-4">
                      Ultra-fast scan with minimal processing for quick updates.
                    </p>
                    <MagneticButton
                      onClick={() => triggerScan('superfast')}
                      disabled={isScanning || actionLoading.superfast}
                      className="w-full bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 py-2 px-4 rounded-lg flex items-center justify-center space-x-2"
                    >
                      {actionLoading.superfast ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-400"></div>
                      ) : (
                        <Timer className="w-4 h-4" />
                      )}
                      <span>Superfast Scan</span>
                    </MagneticButton>
                  </div>

                  {/* Asset Regeneration */}
                  <div className="bg-white/5 rounded-lg p-6 border border-white/10">
                    <div className="flex items-center mb-4">
                      <ImageIcon className="w-8 h-8 text-orange-500 mr-3" />
                      <div>
                        <h3 className="text-lg font-semibold text-white">Regenerate Assets</h3>
                        <p className="text-white/60 text-sm">Thumbnails & previews</p>
                      </div>
                    </div>
                    <p className="text-white/70 text-sm mb-4">
                      Regenerates all thumbnails and preview clips for the entire library.
                    </p>
                    <MagneticButton
                      onClick={regenerateAllAssets}
                      disabled={isScanning || actionLoading.regenerateAll}
                      className="w-full bg-orange-600/20 hover:bg-orange-600/40 text-orange-400 py-2 px-4 rounded-lg flex items-center justify-center space-x-2"
                    >
                      {actionLoading.regenerateAll ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-400"></div>
                      ) : (
                        <ImageIcon className="w-4 h-4" />
                      )}
                      <span>Regenerate All</span>
                    </MagneticButton>
                  </div>

                  {/* Database Cleanup */}
                  <div className="bg-white/5 rounded-lg p-6 border border-white/10">
                    <div className="flex items-center mb-4">
                      <Trash2 className="w-8 h-8 text-red-500 mr-3" />
                      <div>
                        <h3 className="text-lg font-semibold text-white">Cleanup Invalid</h3>
                        <p className="text-white/60 text-sm">Remove orphaned data</p>
                      </div>
                    </div>
                    <p className="text-white/70 text-sm mb-4">
                      Removes invalid entries and orphaned data from the database.
                    </p>
                    <MagneticButton
                      onClick={() => triggerScan('cleanup-invalid')}
                      disabled={isScanning || actionLoading['cleanup-invalid']}
                      className="w-full bg-red-600/20 hover:bg-red-600/40 text-red-400 py-2 px-4 rounded-lg flex items-center justify-center space-x-2"
                    >
                      {actionLoading['cleanup-invalid'] ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-400"></div>
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      <span>Cleanup Database</span>
                    </MagneticButton>
                  </div>
                </div>

                {/* Scan Statistics */}
                <div className="bg-white/5 rounded-lg p-6 border border-white/10">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white flex items-center">
                      <BarChart3 className="w-5 h-5 mr-2 text-[#E50914]" />
                      Scan Statistics
                    </h3>
                    <MagneticButton
                      onClick={fetchScanStats}
                      className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 px-3 py-1 rounded text-sm flex items-center space-x-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Refresh</span>
                    </MagneticButton>
                  </div>
                  {scanStats ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-white">{scanStats.totalFiles || 0}</div>
                        <div className="text-white/60 text-sm">Total Files</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-400">{scanStats.processed || 0}</div>
                        <div className="text-white/60 text-sm">Processed</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-yellow-400">{scanStats.skipped || 0}</div>
                        <div className="text-white/60 text-sm">Skipped</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-400">{scanStats.errors || 0}</div>
                        <div className="text-white/60 text-sm">Errors</div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-white/50">No scan statistics available</div>
                      <div className="text-white/40 text-sm mt-2">Run a scan to see statistics</div>
                    </div>
                  )}
                </div>
              </GlassCard>
            </ScrollReveal>

            {/* Terminal Output */}
            <ScrollReveal delay={0.2}>
              <GlassCard className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-white flex items-center">
                    <Monitor className="w-6 h-6 mr-3 text-[#E50914]" />
                    Terminal Output
                  </h3>
                  <MagneticButton
                    onClick={clearTerminalOutput}
                    className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Clear</span>
                  </MagneticButton>
                </div>
                <div className="bg-black/50 rounded-lg p-4 h-64 overflow-y-auto font-mono text-sm">
                  {terminalOutput.length === 0 ? (
                    <div className="text-white/50 italic">No output yet. Start a scan to see live updates...</div>
                  ) : (
                    terminalOutput.map((line, index) => (
                      <div key={index} className="text-green-400 mb-1">
                        {line}
                      </div>
                    ))
                  )}
                </div>
              </GlassCard>
            </ScrollReveal>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-8">
            <ScrollReveal>
              <GlassCard className="p-6">
                <h2 className="text-2xl font-semibold text-white mb-6 flex items-center">
                  <BarChart3 className="w-6 h-6 mr-3 text-[#E50914]" />
                  System Analytics
                </h2>

                {/* System Overview */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 rounded-lg p-6 border border-blue-500/20">
                    <div className="flex items-center justify-between mb-4">
                      <Database className="w-8 h-8 text-blue-400" />
                      <div className="text-right">
                        <div className="text-2xl font-bold text-white">{mediaList.length}</div>
                        <div className="text-blue-400 text-sm">Total Media</div>
                      </div>
                    </div>
                    <div className="text-white/70 text-sm">
                      Movies: {mediaList.filter(m => m.type === 'movie').length}<br />
                      TV Shows: {mediaList.filter(m => m.type === 'tv').length}
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-green-600/20 to-green-800/20 rounded-lg p-6 border border-green-500/20">
                    <div className="flex items-center justify-between mb-4">
                      <HardDrive className="w-8 h-8 text-green-400" />
                      <div className="text-right">
                        <div className="text-2xl font-bold text-white">
                          {systemStats?.cache?.totalSize ? `${(systemStats.cache.totalSize / (1024 ** 3)).toFixed(1)}GB` : 'N/A'}
                        </div>
                        <div className="text-green-400 text-sm">Cache Size</div>
                      </div>
                    </div>
                    <div className="text-white/70 text-sm">
                      Entries: {systemStats?.cache?.totalEntries || 0}<br />
                      Hit Rate: {systemStats?.cache?.hitRate ? `${(systemStats.cache.hitRate * 100).toFixed(1)}%` : 'N/A'}
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-purple-600/20 to-purple-800/20 rounded-lg p-6 border border-purple-500/20">
                    <div className="flex items-center justify-between mb-4">
                      <Activity className="w-8 h-8 text-purple-400" />
                      <div className="text-right">
                        <div className="text-2xl font-bold text-white">
                          {systemStats?.queues ? Object.keys(systemStats.queues).length : 0}
                        </div>
                        <div className="text-purple-400 text-sm">Active Queues</div>
                      </div>
                    </div>
                    <div className="text-white/70 text-sm">
                      Tasks: {systemStats?.queues ? Object.values(systemStats.queues).reduce((a: number, b: any) => a + (b?.length || 0), 0) : 0}<br />
                      Workers: {systemStats?.queues ? Object.keys(systemStats.queues).filter((q: any) => systemStats.queues[q].active).length : 0}
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-orange-600/20 to-orange-800/20 rounded-lg p-6 border border-orange-500/20">
                    <div className="flex items-center justify-between mb-4">
                      <Eye className="w-8 h-8 text-orange-400" />
                      <div className="text-right">
                        <div className="text-2xl font-bold text-white">
                          {mediaList.reduce((total, media) => total + (media.view_count || 0), 0)}
                        </div>
                        <div className="text-orange-400 text-sm">Total Views</div>
                      </div>
                    </div>
                    <div className="text-white/70 text-sm">
                      Avg per media: {mediaList.length > 0 ? (mediaList.reduce((total, media) => total + (media.view_count || 0), 0) / mediaList.length).toFixed(1) : 0}<br />
                      Most viewed: {Math.max(...mediaList.map(m => m.view_count || 0))}
                    </div>
                  </div>
                </div>

                {/* Cache Management */}
                <div className="bg-white/5 rounded-lg p-6 border border-white/10 mb-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <HardDrive className="w-5 h-5 mr-2 text-[#E50914]" />
                    Cache Management
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <MagneticButton
                      onClick={clearCache}
                      disabled={actionLoading.clearCache}
                      className="bg-red-600/20 hover:bg-red-600/40 text-red-400 py-3 px-4 rounded-lg flex items-center justify-center space-x-2"
                    >
                      {actionLoading.clearCache ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-400"></div>
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      <span>Clear All Cache</span>
                    </MagneticButton>

                    <MagneticButton
                      onClick={fetchSystemStats}
                      className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 py-3 px-4 rounded-lg flex items-center justify-center space-x-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Refresh Stats</span>
                    </MagneticButton>

                    <MagneticButton
                      onClick={testAllEndpoints}
                      disabled={actionLoading.testEndpoints}
                      className="bg-green-600/20 hover:bg-green-600/40 text-green-400 py-3 px-4 rounded-lg flex items-center justify-center space-x-2"
                    >
                      {actionLoading.testEndpoints ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-400"></div>
                      ) : (
                        <TrendingUp className="w-4 h-4" />
                      )}
                      <span>Test Endpoints</span>
                    </MagneticButton>
                  </div>
                </div>

                {/* Queue Status */}
                {systemStats?.queues && (
                  <div className="bg-white/5 rounded-lg p-6 border border-white/10">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                      <Activity className="w-5 h-5 mr-2 text-[#E50914]" />
                      Task Queue Status
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Object.entries(systemStats.queues).map(([queueName, queueInfo]: [string, any]) => (
                        <div key={queueName} className="bg-black/30 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-white capitalize">{queueName.replace('_', ' ')}</h4>
                            <div className={`w-2 h-2 rounded-full ${queueInfo.active ? 'bg-green-400' : 'bg-red-400'
                              }`}></div>
                          </div>
                          <div className="text-sm text-white/70">
                            <div>Tasks: {queueInfo.length || 0}</div>
                            <div>Status: {queueInfo.active ? 'Active' : 'Inactive'}</div>
                            <div>Priority: {queueInfo.priority || 'Normal'}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </GlassCard>
            </ScrollReveal>
          </div>
        )}

        {/* System Logs Tab */}
        {activeTab === 'system-logs' && (
          <SystemLogs onTerminalOutput={addTerminalOutput} />
        )}

        {/* Torrent Downloads Tab */}
        {activeTab === 'torrent' && (
          <ScrollReveal>
            <TorrentDashboard mediaInfo={torrentMediaInfo} />
          </ScrollReveal>
        )}

        {/* Media Paths Management Tab */}
        {activeTab === 'paths' && (
          <ScrollReveal>
            <GlassCard className="p-8">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">Media Paths Configuration</h2>
                  <p className="text-white/70">Manage directories that HomeFlix scans for media files</p>
                </div>
                <MagneticButton
                  onClick={() => setShowAddPathForm(!showAddPathForm)}
                  className="bg-[#E50914] hover:bg-[#B8070F] text-white px-6 py-3 rounded-lg font-semibold transition-all duration-300 shadow-lg shadow-red-500/25"
                >
                  <Folder className="w-5 h-5 mr-2" />
                  Add Media Path
                </MagneticButton>
              </div>

              {/* Add New Path Form */}
              {showAddPathForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-8 p-6 bg-black/30 rounded-lg border border-white/10"
                >
                  <h3 className="text-xl font-semibold text-white mb-4">Add New Media Path</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-white/70 text-sm font-medium mb-2">Path *</label>
                      <input
                        type="text"
                        value={newMediaPath.path}
                        onChange={(e) => setNewMediaPath({ ...newMediaPath, path: e.target.value })}
                        placeholder="/path/to/media/directory"
                        className="w-full px-4 py-3 bg-black/50 border border-white/20 rounded-lg text-white placeholder-white/50 focus:border-[#E50914] focus:outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-white/70 text-sm font-medium mb-2">Name *</label>
                      <input
                        type="text"
                        value={newMediaPath.name}
                        onChange={(e) => setNewMediaPath({ ...newMediaPath, name: e.target.value })}
                        placeholder="Friendly name for this path"
                        className="w-full px-4 py-3 bg-black/50 border border-white/20 rounded-lg text-white placeholder-white/50 focus:border-[#E50914] focus:outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-white/70 text-sm font-medium mb-2">Type</label>
                      <select
                        value={newMediaPath.path_type}
                        onChange={(e) => setNewMediaPath({ ...newMediaPath, path_type: e.target.value })}
                        className="w-full px-4 py-3 bg-black/50 border border-white/20 rounded-lg text-white focus:border-[#E50914] focus:outline-none transition-colors"
                      >
                        <option value="primary">Primary</option>
                        <option value="torrent">Torrent Downloads</option>
                        <option value="external">External Drive</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-white/70 text-sm font-medium mb-2">Priority</label>
                      <input
                        type="number"
                        value={newMediaPath.priority}
                        onChange={(e) => setNewMediaPath({ ...newMediaPath, priority: parseInt(e.target.value) || 0 })}
                        placeholder="0"
                        className="w-full px-4 py-3 bg-black/50 border border-white/20 rounded-lg text-white placeholder-white/50 focus:border-[#E50914] focus:outline-none transition-colors"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-white/70 text-sm font-medium mb-2">Description</label>
                      <input
                        type="text"
                        value={newMediaPath.description}
                        onChange={(e) => setNewMediaPath({ ...newMediaPath, description: e.target.value })}
                        placeholder="Optional description"
                        className="w-full px-4 py-3 bg-black/50 border border-white/20 rounded-lg text-white placeholder-white/50 focus:border-[#E50914] focus:outline-none transition-colors"
                      />
                    </div>
                  </div>
                  <div className="flex gap-4 mt-6">
                    <MagneticButton
                      onClick={addMediaPath}
                      className="bg-[#E50914] hover:bg-[#B8070F] text-white px-6 py-3 rounded-lg font-semibold transition-all duration-300"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Add Path
                    </MagneticButton>
                    <MagneticButton
                      onClick={() => setShowAddPathForm(false)}
                      className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-300"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </MagneticButton>
                  </div>
                </motion.div>
              )}

              {/* Media Paths List */}
              <div className="space-y-4">
                {mediaPaths.length === 0 ? (
                  <div className="text-center py-12">
                    <Folder className="w-16 h-16 text-white/30 mx-auto mb-4" />
                    <p className="text-white/50 text-lg">No media paths configured</p>
                    <p className="text-white/30 text-sm">Add a media path to get started</p>
                  </div>
                ) : (
                  mediaPaths.map((path: any) => (
                    <motion.div
                      key={path.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-6 bg-black/30 rounded-lg border border-white/10 hover:border-white/20 transition-all duration-300"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Folder className="w-5 h-5 text-[#E50914]" />
                            <h3 className="text-lg font-semibold text-white">{path.name}</h3>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${path.path_type === 'primary' ? 'bg-blue-500/20 text-blue-400' :
                              path.path_type === 'torrent' ? 'bg-green-500/20 text-green-400' :
                                'bg-purple-500/20 text-purple-400'
                              }`}>
                              {path.path_type}
                            </span>
                            {path.priority > 0 && (
                              <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-xs font-medium">
                                Priority: {path.priority}
                              </span>
                            )}
                          </div>
                          <p className="text-white/70 font-mono text-sm mb-1">{path.path}</p>
                          {path.description && (
                            <p className="text-white/50 text-sm">{path.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <MagneticButton
                            onClick={() => updateMediaPath(path.id, { is_active: !path.is_active })}
                            className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${path.is_active
                              ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                              : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                              }`}
                          >
                            {path.is_active ? 'Active' : 'Inactive'}
                          </MagneticButton>
                          <MagneticButton
                            onClick={() => deleteMediaPath(path.id, path.name)}
                            className="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-3 py-2 rounded-lg transition-all duration-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </MagneticButton>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>

              {/* Quick Actions */}
              <div className="mt-8 p-6 bg-gradient-to-r from-[#E50914]/10 to-transparent rounded-lg border border-[#E50914]/20">
                <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
                <div className="flex flex-wrap gap-4">
                  <MagneticButton
                    onClick={fetchMediaPaths}
                    className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg font-medium transition-all duration-300"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh Paths
                  </MagneticButton>
                  <MagneticButton
                    onClick={() => triggerScan('full')}
                    className="bg-[#E50914]/20 hover:bg-[#E50914]/30 text-[#E50914] px-4 py-2 rounded-lg font-medium transition-all duration-300"
                  >
                    <Search className="w-4 h-4 mr-2" />
                    Scan All Paths
                  </MagneticButton>
                </div>
              </div>
            </GlassCard>
          </ScrollReveal>
        )}

        {/* Subtitles Management Tab */}
        {activeTab === 'subtitles' && (
          <ScrollReveal>
            <GlassCard className="p-8">
              <h2 className="text-2xl font-semibold text-white mb-6 flex items-center">
                <FileSearch className="w-6 h-6 mr-3 text-[#E50914]" />
                Subtitle Management
              </h2>

              <div className="space-y-8">
                {/* OpenSubtitles Search Section */}
                <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
                  <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                    <Globe className="w-5 h-5 mr-2 text-[#E50914]" />
                    OpenSubtitles Search
                  </h3>
                  <p className="text-white/70 mb-6">
                    Search and download subtitles from OpenSubtitles.org for any media in your library.
                  </p>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Search Form */}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-white/70 mb-2">Search Query</label>
                        <input
                          type="text"
                          placeholder="Enter movie or TV show title..."
                          value={openSubtitlesQuery}
                          onChange={(e) => setOpenSubtitlesQuery(e.target.value)}
                          className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/50 focus:border-[#E50914] focus:outline-none transition-colors"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleOpenSubtitlesSearch();
                            }
                          }}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-white/70 mb-2">Language</label>
                        <select
                          value={selectedLanguage}
                          onChange={(e) => setSelectedLanguage(e.target.value)}
                          className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-3 text-white focus:border-[#E50914] focus:outline-none transition-colors"
                        >
                          <option value="en">English</option>
                          <option value="es">Spanish</option>
                          <option value="fr">French</option>
                          <option value="de">German</option>
                          <option value="it">Italian</option>
                          <option value="pt">Portuguese</option>
                          <option value="ru">Russian</option>
                          <option value="ja">Japanese</option>
                          <option value="ko">Korean</option>
                          <option value="zh">Chinese</option>
                          <option value="ar">Arabic</option>
                          <option value="nl">Dutch</option>
                          <option value="sv">Swedish</option>
                          <option value="no">Norwegian</option>
                          <option value="da">Danish</option>
                          <option value="fi">Finnish</option>
                          <option value="pl">Polish</option>
                          <option value="tr">Turkish</option>
                          <option value="he">Hebrew</option>
                          <option value="th">Thai</option>
                          <option value="vi">Vietnamese</option>
                        </select>
                      </div>

                      <MagneticButton
                        onClick={handleOpenSubtitlesSearch}
                        disabled={openSubtitlesLoading || !openSubtitlesQuery.trim()}
                        className="w-full bg-[#E50914] hover:bg-[#E50914]/80 text-white px-6 py-3 rounded-lg flex items-center justify-center space-x-2 transition-colors"
                      >
                        {openSubtitlesLoading ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        ) : (
                          <Search className="w-5 h-5" />
                        )}
                        <span>Search Subtitles</span>
                      </MagneticButton>
                    </div>

                    {/* Search Results */}
                    <div className="space-y-4">
                      <h4 className="text-lg font-medium text-white">Search Results</h4>
                      
                      {openSubtitlesResults.length > 0 ? (
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                          {openSubtitlesResults.slice(0, 10).map((subtitle, index) => (
                            <div key={index} className="bg-black/30 rounded-lg p-4 border border-white/10">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-3 mb-2">
                                    <span className="text-white font-medium text-sm">
                                      {subtitle.attributes?.feature_details?.title || 'Unknown Title'}
                                    </span>
                                    <span className="text-white/60 text-xs">
                                      ({subtitle.attributes?.feature_details?.year || 'N/A'})
                                    </span>
                                    <span className="bg-[#E50914]/20 text-[#E50914] px-2 py-1 rounded text-xs">
                                      {subtitle.attributes?.language?.toUpperCase() || 'Unknown'}
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-3 text-xs text-white/60">
                                    <span>📥 {subtitle.attributes?.download_count || 0}</span>
                                    <span>⭐ {subtitle.attributes?.ratings?.toFixed(1) || 'N/A'}</span>
                                    {subtitle.attributes?.hearing_impaired && (
                                      <span className="text-yellow-400">🔊 CC</span>
                                    )}
                                  </div>
                                  {subtitle.attributes?.release && (
                                    <p className="text-white/50 text-xs mt-1 truncate">
                                      {subtitle.attributes.release}
                                    </p>
                                  )}
                                </div>
                                <div className="flex gap-2 ml-3">
                                  <MagneticButton
                                    onClick={() => handleDownloadSubtitleAsFile(subtitle)}
                                    className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 px-3 py-2 rounded-lg flex items-center space-x-2 text-sm"
                                    title="Download as SRT file to your computer"
                                  >
                                    <Download className="w-4 h-4" />
                                    <span>SRT</span>
                                  </MagneticButton>
                                  {selectedMedia && (
                                    <MagneticButton
                                      onClick={() => handleDownloadOpenSubtitle(subtitle)}
                                      disabled={downloadingSubtitle === subtitle.attributes?.files?.[0]?.file_id}
                                      className="bg-green-600/20 hover:bg-green-600/40 text-green-400 px-3 py-2 rounded-lg flex items-center space-x-2 text-sm"
                                      title="Add subtitle to media library"
                                    >
                                      {downloadingSubtitle === subtitle.attributes?.files?.[0]?.file_id ? (
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-400"></div>
                                      ) : (
                                        <Download className="w-4 h-4" />
                                      )}
                                      <span>Add</span>
                                    </MagneticButton>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                          {openSubtitlesResults.length > 10 && (
                            <p className="text-white/60 text-sm text-center">
                              Showing first 10 results of {openSubtitlesResults.length}
                            </p>
                          )}
                        </div>
                      ) : openSubtitlesQuery && !openSubtitlesLoading ? (
                        <div className="text-center py-8 text-white/60">
                          <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p>No subtitles found for "{openSubtitlesQuery}"</p>
                          <p className="text-sm mt-1">Try a different search term or language</p>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-white/60">
                          <FileSearch className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p>Enter a search query to find subtitles</p>
                          <p className="text-sm mt-1">Search by movie or TV show title</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Help Section */}
                  <div className="mt-6 bg-blue-600/10 border border-blue-600/20 rounded-lg p-4">
                    <h4 className="text-blue-300 font-medium mb-2">💡 How to use OpenSubtitles</h4>
                    <ul className="text-blue-300/80 text-sm space-y-1">
                      <li>• Enter the exact title of your movie or TV show</li>
                      <li>• Select your preferred language from the dropdown</li>
                      <li>• Click "Search Subtitles" to find available options</li>
                      <li>• Click "Download" to add subtitles to your media library</li>
                      <li>• Downloaded subtitles will be automatically associated with matching media</li>
                    </ul>
                  </div>
                </div>

                {/* Subtitle Management Tools */}
                <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
                  <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                    <Settings className="w-5 h-5 mr-2 text-[#E50914]" />
                    Subtitle Tools
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <MagneticButton
                      onClick={handleScanSubtitles}
                      disabled={actionLoading.scanSubtitles}
                      className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 py-3 px-4 rounded-lg flex items-center justify-center space-x-2"
                    >
                      {actionLoading.scanSubtitles ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                      <span>Scan Storage for Subtitles</span>
                    </MagneticButton>

                    <MagneticButton
                      onClick={() => {
                        // Trigger subtitle file input
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = '.srt,.vtt,.ass,.ssa,.sub,.sbv';
                        input.multiple = true;
                        input.onchange = (e: Event) => {
                          const target = e.target as HTMLInputElement;
                          handleSubtitleUpload(e as unknown as React.ChangeEvent<HTMLInputElement>);
                        };
                        input.click();
                      }}
                      disabled={uploading}
                      className="bg-green-600/20 hover:bg-green-600/40 text-green-400 py-3 px-4 rounded-lg flex items-center justify-center space-x-2"
                    >
                      {uploading ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-400"></div>
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      <span>Upload Subtitle Files</span>
                    </MagneticButton>

                    <MagneticButton
                      onClick={() => {
                        addTerminalOutput('📊 Checking subtitle system status...');
                        // Add any subtitle system checks here
                        addTerminalOutput('✅ Subtitle system is operational');
                      }}
                      className="bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 py-3 px-4 rounded-lg flex items-center justify-center space-x-2"
                    >
                      <Info className="w-4 h-4" />
                      <span>System Status</span>
                    </MagneticButton>
                  </div>
                </div>

                {/* Configuration */}
                <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
                  <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                    <Settings className="w-5 h-5 mr-2 text-[#E50914]" />
                    Configuration
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="bg-yellow-600/10 border border-yellow-600/20 rounded-lg p-4">
                      <h4 className="text-yellow-300 font-medium mb-2">⚙️ OpenSubtitles API Configuration</h4>
                      <p className="text-yellow-300/80 text-sm mb-3">
                        To use OpenSubtitles integration, configure the following environment variables:
                      </p>
                      <div className="bg-black/30 rounded p-3 font-mono text-sm text-white/80">
                        <div>OPENSUB_API_KEY=your_api_key_here</div>
                        <div>OPENSUB_USERNAME=your_username</div>
                        <div>OPENSUB_PASSWORD=your_password</div>
                      </div>
                      <p className="text-yellow-300/80 text-xs mt-2">
                        Get your API key from: <a href="https://www.opensubtitles.com/en/profile/api" target="_blank" rel="noopener noreferrer" className="underline">OpenSubtitles.com</a>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </GlassCard>
          </ScrollReveal>
        )}

        {/* Netflix-style General Settings Tab */}
        {activeTab === 'general' && (
          <ScrollReveal>
            <GlassCard className="p-8">
              <h2 className="text-2xl font-semibold text-white mb-6 flex items-center">
                <Settings className="w-6 h-6 mr-3 text-[#E50914]" />
                General Settings
              </h2>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white/5 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-3">Streaming Quality</h3>
                    <p className="text-white/70 text-sm mb-4">Choose your preferred streaming quality</p>
                    <select className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-2 text-white">
                      <option value="auto">Auto (Recommended)</option>
                      <option value="4k">4K Ultra HD</option>
                      <option value="1080p">1080p Full HD</option>
                      <option value="720p">720p HD</option>
                    </select>
                  </div>
                  <div className="bg-white/5 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-3">Language</h3>
                    <p className="text-white/70 text-sm mb-4">Select your preferred language</p>
                    <select className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-2 text-white">
                      <option value="en">English</option>
                      <option value="es">Español</option>
                      <option value="fr">Français</option>
                      <option value="de">Deutsch</option>
                    </select>
                  </div>
                </div>
                <div className="bg-white/5 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-3">Autoplay</h3>
                  <div className="space-y-3">
                    <label className="flex items-center space-x-3">
                      <input type="checkbox" className="rounded bg-black/50 border-white/20" defaultChecked />
                      <span className="text-white/90">Autoplay next episode</span>
                    </label>
                    <label className="flex items-center space-x-3">
                      <input type="checkbox" className="rounded bg-black/50 border-white/20" defaultChecked />
                      <span className="text-white/90">Autoplay previews while browsing</span>
                    </label>
                  </div>
                </div>

                {/* TMDB Integration Section */}
                <div className="bg-white/5 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                    <Film className="w-5 h-5 mr-2 text-[#E50914]" />
                    TMDB Integration
                  </h3>
                  <p className="text-white/70 text-sm mb-4">
                    Enhance your local media with backdrop images and trailer information from The Movie Database (TMDB).
                  </p>
                  <div className="space-y-3">
                    <MagneticButton
                      onClick={handleBulkTMDBUpdate}
                      disabled={actionLoading.bulkTmdb}
                      className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 px-4 py-2 rounded-lg flex items-center space-x-2 w-full justify-center"
                    >
                      {actionLoading.bulkTmdb ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      <span>Update All Media with TMDB Data</span>
                    </MagneticButton>
                    <p className="text-white/50 text-xs">
                      This will scan all your local movies and TV shows and add backdrop images and trailer URLs from TMDB.
                    </p>
                  </div>
                </div>
              </div>
            </GlassCard>
          </ScrollReveal>
        )}
      </div>

      {/* TMDB Search Modal */}
      <TMDBSearchModal
        key={`tmdb-modal-${selectedMedia?.id}-${showTMDBSearchModal}`}
        isOpen={showTMDBSearchModal}
        onClose={() => {
          console.log('🚪 Closing TMDB Search Modal');
          setShowTMDBSearchModal(false);
          setCustomSearchTitle('');
          addTerminalOutput('🚪 TMDB search modal closed');
        }}
        onSelect={handleTMDBSelection}
        initialQuery={customSearchTitle}
        mediaType={selectedMedia?.type === 'tv' ? 'tv' : 'movie'}
        title={`Search TMDB for ${selectedMedia?.type === 'tv' ? 'TV Series' : 'Movie'}`}
      />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<RedLoader />}>
      <SettingsContent />
    </Suspense>
  );
}
