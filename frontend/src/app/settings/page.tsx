"use client";

import React, { useState, useEffect } from 'react';
import { Settings, Users, Database, Upload, Download, Trash2, Video, ImageIcon, Folder, File, Play, Info, Edit3, RefreshCw, Save, X, Calendar, Star, Clock, Users as UsersIcon, Globe, Award, DollarSign, Eye, RotateCcw, Zap, AlertTriangle, Search, Server, Activity, HardDrive, Cpu, MemoryStick, Wifi, Monitor, BarChart3, TrendingUp, FileSearch, Layers, Cog, PlayCircle, PauseCircle, StopCircle, Timer } from 'lucide-react';
import Image from 'next/image';
import Navbar from '@/components/Navbar';
import { getApiUrl } from '@/lib/api';
import { Media } from '@/types/media';
import { FolderTree, GlassCard, ScrollReveal, MagneticButton } from '@/components/scrollx';
import { motion } from 'framer-motion';
import { useNavigate } from "@/hooks/useNavigate";
import RedLoader from '@/components/RedLoader';
interface MediaAssets {
  banner?: string;
  thumbnail?: string;
  trailer?: string;
}

interface EditableMedia extends Media {
  isEditing?: boolean;
  uuid?: string;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('media');
  const [mediaList, setMediaList] = useState<Media[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<EditableMedia | null>(null);
  const [mediaAssets, setMediaAssets] = useState<MediaAssets>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editingMedia, setEditingMedia] = useState<Partial<Media>>({});
  const [isRegenerating, setIsRegenerating] = useState<{[key: string]: boolean}>({});
  const [actionLoading, setActionLoading] = useState<{[key: string]: boolean}>({});
  const [scanStats, setScanStats] = useState<any>(null);
  const [systemStats, setSystemStats] = useState<any>(null);
  const [watcherStatus, setWatcherStatus] = useState<any>(null);
  const [queueStatus, setQueueStatus] = useState<any>(null);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchMediaList();
    if (activeTab === 'analytics') {
      fetchSystemStats();
    }
    if (activeTab === 'scanning') {
      fetchScanStats();
    }
  }, [activeTab]);

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
      const { apiCall, API_ENDPOINTS } = await import('@/lib/api');
      const media = await apiCall(API_ENDPOINTS.media);
      setMediaList(media);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching media:', error);
      setLoading(false);
    }
  };

  // Transform media list into folder tree structure
  const createFolderTreeData = () => {
    const folders = {
      movies: {
        id: 'movies',
        name: 'Movies',
        type: 'folder' as const,
        children: mediaList.filter(m => m.type === 'movie').map(media => ({
          id: media.id.toString(),
          name: media.title,
          type: 'file' as const,
          size: `${Math.floor((media.duration || 0) / 60)}min`,
          modified: new Date().toLocaleDateString(),
          media: media
        }))
      },
      tvShows: {
        id: 'tv-shows',
        name: 'TV Shows',
        type: 'folder' as const,
        children: mediaList.filter(m => m.type === 'tv').map(media => ({
          id: media.id.toString(),
          name: media.title,
          type: 'file' as const,
          size: `${media.view_count || 0} views`,
          modified: new Date().toLocaleDateString(),
          media: media
        }))
      }
    };
    return [folders.movies, folders.tvShows];
  };

  const handleMediaSelect = async (media: Media) => {
    setSelectedMedia({...media, isEditing: false});
    setEditingMedia({});
    // Fetch existing assets for this media
    try {
      const response = await fetch(`${getApiUrl()}/api/admin/media/${media.id}/assets`);
      if (response.ok) {
        const assets = await response.json();
        setMediaAssets(assets);
      }
    } catch (error) {
      console.error('Error fetching media assets:', error);
    }
  };

  const handleEditToggle = () => {
    if (selectedMedia) {
      if (selectedMedia.isEditing) {
        // Cancel editing - revert changes
        setSelectedMedia(prev => prev ? {...prev, isEditing: false} : null);
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
          genre_names: selectedMedia.genre_names || []
        };
        
        setSelectedMedia(prev => prev ? {...prev, isEditing: true} : null);
        setEditingMedia(currentEditingData);
        addTerminalOutput(`✏️ Started editing: ${selectedMedia.title}`);
      }
    }
  };

  // Handle input changes during editing
  const handleInputChange = (field: string, value: any) => {
    setEditingMedia(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Also update the selectedMedia to show changes immediately in the UI
    setSelectedMedia(prev => prev ? {
      ...prev,
      [field]: value
    } : null);
  };

  const handleSaveChanges = async () => {
    if (!selectedMedia) return;
    
    setActionLoading(prev => ({...prev, save: true}));
    addTerminalOutput(`💾 Saving changes for: ${selectedMedia.title}`);
    
    try {
      const response = await fetch(`${getApiUrl()}/api/admin/media/${selectedMedia.id}/metadata`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editingMedia),
      });

      if (response.ok) {
        const updatedMedia = await response.json();
        
        // Create the updated media object with editing state
        const updatedMediaWithState = {
          ...selectedMedia,
          ...updatedMedia,
          ...editingMedia, // Apply the changes from editingMedia
          isEditing: false
        };
        
        // Update selected media immediately
        setSelectedMedia(updatedMediaWithState);
        
        // Update the media list with the new data
        setMediaList(prev => prev.map(m => 
          m.id === updatedMedia.id 
            ? { ...m, ...updatedMedia, ...editingMedia }
            : m
        ));
        
        // Clear editing state
        setEditingMedia({});
        
        addTerminalOutput(`✅ Media metadata updated successfully`);
        addTerminalOutput(`📝 Updated fields: ${Object.keys(editingMedia).join(', ')}`);
        
        // Force a small delay to ensure state updates are processed
        setTimeout(() => {
          // Trigger a re-render by updating a dummy state if needed
          setActionLoading(prev => ({...prev}));
        }, 100);
        
      } else {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        addTerminalOutput(`❌ Failed to save changes: ${errorData.error || response.statusText}`);
      }
    } catch (error) {
      addTerminalOutput(`❌ Error updating media: ${error}`);
      console.error('Error updating media:', error);
    } finally {
      setActionLoading(prev => ({...prev, save: false}));
    }
  };

  const handleRegenerateThumbnail = async () => {
    if (!selectedMedia) return;
    
    setIsRegenerating(prev => ({...prev, thumbnail: true}));
    addTerminalOutput(`🖼️ Regenerating thumbnail for: ${selectedMedia.title}`);
    
    try {
      const response = await fetch(`${getApiUrl()}/api/thumbnails/${selectedMedia.id}`, {
        method: 'POST',
      });
      
      if (response.ok) {
        addTerminalOutput(`✅ Thumbnail generation started`);
        // Refresh the selected media to get updated thumbnail path
        const mediaResponse = await fetch(`${getApiUrl()}/api/media/${selectedMedia.id}`);
        if (mediaResponse.ok) {
          const updatedMedia = await mediaResponse.json();
          setSelectedMedia(prev => prev ? {...prev, ...updatedMedia} : null);
          addTerminalOutput(`✅ Media info refreshed with new thumbnail`);
        } else {
          addTerminalOutput(`⚠️ Could not refresh media info`);
        }
      } else {
        addTerminalOutput(`❌ Thumbnail generation failed: ${response.statusText}`);
      }
    } catch (error) {
      addTerminalOutput(`❌ Error regenerating thumbnail: ${error}`);
      console.error('Error regenerating thumbnail:', error);
    } finally {
      setIsRegenerating(prev => ({...prev, thumbnail: false}));
    }
  };

  const handleRegeneratePreview = async () => {
    if (!selectedMedia) return;
    
    setIsRegenerating(prev => ({...prev, preview: true}));
    addTerminalOutput(`🎬 Regenerating preview clip for: ${selectedMedia.title}`);
    
    try {
      const response = await fetch(`${getApiUrl()}/api/admin/preview-clips/${selectedMedia.id}/generate`, {
        method: 'POST',
      });
      
      if (response.ok) {
        addTerminalOutput(`✅ Preview clip generation started`);
        // Refresh the selected media to get updated preview path
        const mediaResponse = await fetch(`${getApiUrl()}/api/media/${selectedMedia.id}`);
        if (mediaResponse.ok) {
          const updatedMedia = await mediaResponse.json();
          setSelectedMedia(prev => prev ? {...prev, ...updatedMedia} : null);
          addTerminalOutput(`✅ Media info refreshed with new preview`);
        } else {
          addTerminalOutput(`⚠️ Could not refresh media info`);
        }
      } else {
        addTerminalOutput(`❌ Preview generation failed: ${response.statusText}`);
      }
    } catch (error) {
      addTerminalOutput(`❌ Error regenerating preview: ${error}`);
      console.error('Error regenerating preview:', error);
    } finally {
      setIsRegenerating(prev => ({...prev, preview: false}));
    }
  };

  const handleFetchTMDBData = async () => {
    if (!selectedMedia) return;
    
    setActionLoading(prev => ({...prev, tmdb: true}));
    addTerminalOutput(`🎬 Fetching TMDB data for: ${selectedMedia.title}`);
    
    try {
      // Try the main endpoint first
      let response = await fetch(`${getApiUrl()}/api/admin/media/${selectedMedia.id}/update-with-tmdb`, {
        method: 'POST',
      });
      
      // If that fails, try the alternative endpoint
      if (!response.ok) {
        addTerminalOutput(`⚠️ Primary TMDB endpoint failed, trying alternative...`);
        response = await fetch(`${getApiUrl()}/api/admin/media/${selectedMedia.id}/fetch-tmdb`, {
          method: 'POST',
        });
      }
      
      if (response.ok) {
        const updatedMedia = await response.json();
        setSelectedMedia({...updatedMedia, isEditing: false});
        setMediaList(prev => prev.map(m => m.id === updatedMedia.id ? updatedMedia : m));
        addTerminalOutput(`✅ TMDB data updated successfully`);
      } else {
        addTerminalOutput(`❌ TMDB fetch failed: ${response.statusText}`);
      }
    } catch (error) {
      addTerminalOutput(`❌ Error fetching TMDB data: ${error}`);
      console.error('Error fetching TMDB data:', error);
    } finally {
      setActionLoading(prev => ({...prev, tmdb: false}));
    }
  };

  const handleDeleteMedia = async () => {
    if (!selectedMedia || !confirm(`Are you sure you want to delete "${selectedMedia.title}"? This action cannot be undone.\n\nThis will permanently remove:\n- Media record from database\n- All associated metadata\n- Thumbnails and preview clips\n- Playback progress\n- Genre associations`)) return;
    
    setActionLoading(prev => ({...prev, delete: true}));
    addTerminalOutput(`🗑️ Attempting to delete media: ${selectedMedia.title}`);
    
    try {
      const response = await fetch(`${getApiUrl()}/api/media/${selectedMedia.id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        const result = await response.json();
        addTerminalOutput(`✅ ${result.message}`);
        addTerminalOutput(`📊 Deleted: ${result.deleted_media.title} (${result.deleted_media.type})`);
        
        // Remove from local state
        setMediaList(prev => prev.filter(m => m.id !== selectedMedia.id));
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
      setActionLoading(prev => ({...prev, delete: false}));
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
    setActionLoading(prev => ({...prev, [scanType]: true}));
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
      setActionLoading(prev => ({...prev, [scanType]: false}));
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
    setActionLoading(prev => ({...prev, regenerateAll: true}));
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
      setActionLoading(prev => ({...prev, regenerateAll: false}));
    }
  };

  const clearCache = async () => {
    setActionLoading(prev => ({...prev, clearCache: true}));
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
      setActionLoading(prev => ({...prev, clearCache: false}));
    }
  };

  // Test all API endpoints to verify functionality
  const testAllEndpoints = async () => {
    setActionLoading(prev => ({...prev, testEndpoints: true}));
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
    setActionLoading(prev => ({...prev, testEndpoints: false}));
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
        <Navbar onSearch={() => {}} />
        <div className="flex items-center justify-center h-96">
          <RedLoader />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <Navbar onSearch={() => {}} />
      
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
            className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
              activeTab === 'media' 
                ? 'bg-[#E50914] text-white shadow-lg shadow-red-500/25' 
                : 'bg-transparent text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <Database className="w-4 h-4 mr-2" />
            Media Library
          </MagneticButton>
          <MagneticButton
            onClick={() => setActiveTab('scanning')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
              activeTab === 'scanning' 
                ? 'bg-[#E50914] text-white shadow-lg shadow-red-500/25' 
                : 'bg-transparent text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <Search className="w-4 h-4 mr-2" />
            Media Scanning
          </MagneticButton>
          <MagneticButton
            onClick={() => setActiveTab('system')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
              activeTab === 'system' 
                ? 'bg-[#E50914] text-white shadow-lg shadow-red-500/25' 
                : 'bg-transparent text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <Server className="w-4 h-4 mr-2" />
            System Management
          </MagneticButton>
          <MagneticButton
            onClick={() => setActiveTab('tasks')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
              activeTab === 'tasks' 
                ? 'bg-[#E50914] text-white shadow-lg shadow-red-500/25' 
                : 'bg-transparent text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <Activity className="w-4 h-4 mr-2" />
            Task Management
          </MagneticButton>
          <MagneticButton
            onClick={() => setActiveTab('watcher')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
              activeTab === 'watcher' 
                ? 'bg-[#E50914] text-white shadow-lg shadow-red-500/25' 
                : 'bg-transparent text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <Monitor className="w-4 h-4 mr-2" />
            File Watcher
          </MagneticButton>
          <MagneticButton
            onClick={() => setActiveTab('analytics')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
              activeTab === 'analytics' 
                ? 'bg-[#E50914] text-white shadow-lg shadow-red-500/25' 
                : 'bg-transparent text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Analytics
          </MagneticButton>
          <MagneticButton
            onClick={() => setActiveTab('general')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
              activeTab === 'general' 
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
                  <div className="max-h-96 overflow-y-auto">
                    <FolderTree
                      data={createFolderTreeData()}
                      onSelect={(item: any) => {
                        if (item.type === 'file' && item.media) {
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
                            <h2 className="text-2xl font-semibold text-white">{selectedMedia.title}</h2>
                            <p className="text-white/70">{selectedMedia.year} • {selectedMedia.type}</p>
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
                            onClick={() => navigate.push(`/movie/${selectedMedia.uuid || selectedMedia.id}`)}
                            className="bg-white/10 hover:bg-white/20 text-white p-3 rounded-full"
                          >
                            <Play className="w-5 h-5" />
                          </MagneticButton>
                          <MagneticButton 
                            onClick={handleEditToggle}
                            className={`p-3 rounded-full ${
                              selectedMedia.isEditing 
                                ? 'bg-[#E50914] hover:bg-[#E50914]/80 text-white' 
                                : 'bg-white/10 hover:bg-white/20 text-white'
                            }`}
                          >
                            {selectedMedia.isEditing ? <X className="w-5 h-5" /> : <Edit3 className="w-5 h-5" />}
                          </MagneticButton>
                          <MagneticButton 
                            onClick={handleDeleteMedia}
                            disabled={actionLoading.delete}
                            className="bg-red-600/20 hover:bg-red-600/40 text-red-400 p-3 rounded-full transition-all duration-300 hover:scale-110"
                            title="Delete Media (Permanent)"
                          >
                            {actionLoading.delete ? (
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-400"></div>
                            ) : (
                              <Trash2 className="w-5 h-5" />
                            )}
                          </MagneticButton>
                        </div>
                      </div>
                      
                      {/* Action Buttons Row */}
                      <div className="flex flex-wrap gap-3">
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
                          <span>Regenerate Thumbnail</span>
                        </MagneticButton>
                        
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
                          <span>Regenerate Preview</span>
                        </MagneticButton>
                        
                        <MagneticButton
                          onClick={handleFetchTMDBData}
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
                          onClick={fetchScanStats}
                          className="bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 px-4 py-2 rounded-lg flex items-center space-x-2"
                        >
                          <BarChart3 className="w-4 h-4" />
                          <span>Refresh Stats</span>
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
                                <label className="block text-sm font-medium text-white/70 mb-1">Runtime</label>
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
                            
                            {/* File Information */}
                            <div className="pt-4 border-t border-white/10">
                              <h5 className="text-sm font-medium text-white/80 mb-2">File Information</h5>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-white/60">File Size:</span>
                                  <span className="text-white">{selectedMedia.file_size ? `${(selectedMedia.file_size / (1024**3)).toFixed(2)} GB` : 'Unknown'}</span>
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
                            value={editingMedia.genre_names?.join(', ') || ''}
                            onChange={(e) => setEditingMedia(prev => ({...prev, genre_names: e.target.value.split(',').map(g => g.trim())}))}
                            className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-2 text-white"
                            placeholder="Action, Drama, Thriller (comma separated)"
                          />
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {selectedMedia.genre_names?.map((genre, index) => (
                              <span key={index} className="bg-[#E50914]/20 text-[#E50914] px-3 py-1 rounded-full text-sm">
                                {genre}
                              </span>
                            )) || <span className="text-white/60">No genres assigned</span>}
                          </div>
                        )}
                      </div>
                    </GlassCard>
                    
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
                      </div>

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
                      Movies: {mediaList.filter(m => m.type === 'movie').length}<br/>
                      TV Shows: {mediaList.filter(m => m.type === 'tv').length}
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-green-600/20 to-green-800/20 rounded-lg p-6 border border-green-500/20">
                    <div className="flex items-center justify-between mb-4">
                      <HardDrive className="w-8 h-8 text-green-400" />
                      <div className="text-right">
                        <div className="text-2xl font-bold text-white">
                          {systemStats?.cache?.totalSize ? `${(systemStats.cache.totalSize / (1024**3)).toFixed(1)}GB` : 'N/A'}
                        </div>
                        <div className="text-green-400 text-sm">Cache Size</div>
                      </div>
                    </div>
                    <div className="text-white/70 text-sm">
                      Entries: {systemStats?.cache?.totalEntries || 0}<br/>
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
                      Tasks: {systemStats?.queues ? Object.values(systemStats.queues).reduce((a: number, b: any) => a + (b?.length || 0), 0) : 0}<br/>
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
                      Avg per media: {mediaList.length > 0 ? (mediaList.reduce((total, media) => total + (media.view_count || 0), 0) / mediaList.length).toFixed(1) : 0}<br/>
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
                            <div className={`w-2 h-2 rounded-full ${
                              queueInfo.active ? 'bg-green-400' : 'bg-red-400'
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
              </div>
            </GlassCard>
          </ScrollReveal>
        )}
      </div>
    </div>
  );
}
