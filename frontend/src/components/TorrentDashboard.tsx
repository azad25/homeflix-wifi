"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download,
  Play,
  Pause,
  Trash2,
  Settings,
  Search,
  CheckCircle,
  AlertCircle,
  Clock,
  HardDrive,
  Upload,
  Users,
  Star,
  Filter,
  RefreshCw,
  X,
  ExternalLink,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { getApiUrl } from '@/lib/api';

interface TorrentResult {
  title: string;
  magnet_uri: string;
  seeders: number;
  leechers: number;
  size: string;
  quality: string;
  source: string;
  category: string;
  verified: boolean;
}

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
}

interface TorrentConfig {
  jackett_url: string;
  jackett_api_key: string;
  download_path: string;
  min_seeders: number;
  max_downloads: number;
  auto_download: boolean;
  preferred_quality: string;
  enabled_sources: string;
  use_proxy: boolean;
  proxy_url: string;
  // Performance settings
  max_peer_connections: number;
  max_peer_accepts: number;
  port_range_start: number;
  port_range_end: number;
  max_open_files: number;
}

interface MediaInfo {
  tmdb_id: number;
  title: string;
  media_type: 'movie' | 'tv';
}

interface TorrentDashboardProps {
  mediaInfo?: MediaInfo;
}

const TorrentDashboard: React.FC<TorrentDashboardProps> = ({ mediaInfo }) => {
  const [activeTab, setActiveTab] = useState<'search' | 'downloads' | 'config'>('search');
  const [searchResults, setSearchResults] = useState<TorrentResult[]>([]);
  const [allDownloads, setAllDownloads] = useState<DownloadInfo[]>([]); // All downloads from API
  const [downloads, setDownloads] = useState<DownloadInfo[]>([]); // Filtered and paginated downloads
  const [config, setConfig] = useState<TorrentConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [qualityFilter, setQualityFilter] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const itemsPerPage = 10;

  // Track operations in progress
  const [operationsInProgress, setOperationsInProgress] = useState<Set<string>>(new Set());

  // Downloads search state
  const [downloadSearchQuery, setDownloadSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchConfig();
    fetchDownloads();

    // Auto-search if media info is provided
    if (mediaInfo) {
      // Use only title for both movies and TV series to improve search results
      const query = mediaInfo.title;
      setSearchQuery(query);
      searchTorrents(query);
    }
  }, [mediaInfo]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [downloadSearchQuery, statusFilter]);

  // Client-side filtering and pagination
  const filterAndPaginateDownloads = () => {
    let filtered = allDownloads;

    // Apply search filter
    if (downloadSearchQuery.trim()) {
      filtered = filtered.filter(download =>
        download.name.toLowerCase().includes(downloadSearchQuery.toLowerCase())
      );
    }

    // Apply status filter
    if (statusFilter) {
      filtered = filtered.filter(download => download.status === statusFilter);
    }

    // Calculate pagination
    const totalCount = filtered.length;
    const totalPages = Math.ceil(totalCount / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedDownloads = filtered.slice(startIndex, endIndex);

    // Update state
    setDownloads(paginatedDownloads);
    setTotalCount(totalCount);
    setTotalPages(totalPages);
    setHasNext(currentPage < totalPages);
    setHasPrev(currentPage > 1);
  };

  // Effect to filter and paginate when filters or page changes
  useEffect(() => {
    filterAndPaginateDownloads();
  }, [allDownloads, downloadSearchQuery, statusFilter, currentPage]);

  // Separate useEffect for polling to avoid recreating interval on every state change
  useEffect(() => {
    // Only poll if we're on the downloads tab
    if (activeTab !== 'downloads') return;

    const interval = setInterval(() => {
      // Refresh all downloads data
      fetchDownloads();
    }, 3000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const fetchConfig = async () => {
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/torrent/config`);
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
      }
    } catch (err) {
      console.error('Failed to fetch config:', err);
    }
  };

  const fetchDownloads = async () => {
    try {
      const apiUrl = getApiUrl();
      // Fetch all downloads without pagination or filters
      const response = await fetch(`${apiUrl}/api/torrent/downloads?limit=1000`);
      if (response.ok) {
        const data = await response.json();
        setAllDownloads(data.downloads || []);
      }
    } catch (err) {
      console.error('Failed to fetch downloads:', err);
    }
  };

  const searchTorrents = async (query?: string) => {
    const searchTerm = query || searchQuery;
    if (!searchTerm.trim()) return;

    setSearchLoading(true);
    setError(null);

    try {
      const apiUrl = getApiUrl();
      const params = new URLSearchParams({
        title: searchTerm,
        type: mediaInfo?.media_type || 'movie',
        // Remove year parameter to improve TV series search results
        ...(qualityFilter && { quality: qualityFilter })
      });

      const response = await fetch(`${apiUrl}/api/torrent/search?${params}`);

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const data = await response.json();
      setSearchResults(data.results || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const searchDownloads = () => {
    setCurrentPage(1);
    // Filtering happens automatically via useEffect
  };

  const clearDownloadSearch = () => {
    setDownloadSearchQuery('');
    setStatusFilter('');
    setCurrentPage(1);
    // Filtering happens automatically via useEffect
  };

  const startDownload = async (result: TorrentResult) => {
    setLoading(true);
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/torrent/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          magnet_uri: result.magnet_uri,
          tmdb_id: mediaInfo?.tmdb_id,
          media_type: mediaInfo?.media_type || 'movie',
          title: result.title,
          quality: result.quality
        })
      });

      if (response.ok) {
        setActiveTab('downloads');
        setCurrentPage(1);
        fetchDownloads();
      } else {
        throw new Error('Failed to start download');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setLoading(false);
    }
  };

  const pauseDownload = async (id: string) => {
    setOperationsInProgress(prev => new Set(prev).add(id));
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/torrent/downloads/${id}/pause`, { method: 'POST' });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to pause download');
      }
      fetchDownloads();
    } catch (err) {
      console.error('Failed to pause download:', err);
      setError(err instanceof Error ? err.message : 'Failed to pause download');
    } finally {
      setOperationsInProgress(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const resumeDownload = async (id: string) => {
    setOperationsInProgress(prev => new Set(prev).add(id));
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/torrent/downloads/${id}/resume`, { method: 'POST' });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to resume download');
      }
      fetchDownloads();
    } catch (err) {
      console.error('Failed to resume download:', err);
      setError(err instanceof Error ? err.message : 'Failed to resume download');
    } finally {
      setOperationsInProgress(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const removeDownload = async (id: string, name: string) => {
    // Confirm deletion with user
    const confirmDelete = window.confirm(
      `Are you sure you want to remove "${name}" from downloads?\n\n` +
      `ULTRA-SAFE DELETION:\n` +
      `• Remove the torrent from downloads\n` +
      `• Delete ONLY files belonging to this specific torrent\n` +
      `• Protect ALL other torrents and their files\n` +
      `• Never delete system or shared files\n` +
      `• This action cannot be undone`
    );

    if (!confirmDelete) {
      return;
    }

    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/torrent/downloads/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        // Show success message with details
        const removedFiles = result.removed_files || [];
        if (removedFiles.length > 0) {
          alert(`✅ Successfully removed "${name}" from downloads\n\nRemoved ${removedFiles.length} file(s):\n${removedFiles.slice(0, 3).join('\n')}${removedFiles.length > 3 ? '\n... and more' : ''}`);
        } else {
          alert(`✅ Successfully removed "${name}" from downloads\n\nNo files were deleted (torrent may have been incomplete or already cleaned up)`);
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));

        // If it's a "not found" error, it means it was already deleted somehow
        if (response.status === 404 || errorData.error?.includes('not found')) {
          alert(`⚠️ "${name}" was already removed or not found. Cleaning up from list.`);
        } else {
          throw new Error(errorData.error || `Failed to remove download (${response.status})`);
        }
      }

      // Always refresh the downloads list, even if there was an error
      fetchDownloads();

    } catch (err) {
      console.error('Failed to remove download:', err);
      alert(`❌ Failed to remove "${name}": ${err instanceof Error ? err.message : 'Unknown error'}`);

      // Still refresh the list in case the backend partially cleaned up
      fetchDownloads();
    }
  };

  const updateConfig = async (newConfig: TorrentConfig) => {
    setLoading(true);
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/torrent/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig)
      });

      if (response.ok) {
        setConfig(newConfig);
        alert('✅ Configuration saved successfully!');
      } else {
        alert('❌ Failed to save configuration');
      }
    } catch (err) {
      console.error('Failed to update config:', err);
      alert('❌ Error saving configuration');
    } finally {
      setLoading(false);
    }
  };

  const testJackettConnection = async () => {
    if (!config?.jackett_url || !config?.jackett_api_key) {
      alert('Please enter Jackett URL and API key first');
      return;
    }

    setLoading(true);
    try {
      // First save the current config so the backend can test it
      await updateConfig(config);

      // Then test the connection via backend
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/torrent/test-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (response.ok && data.success) {
        alert(`✅ Jackett connection successful!\n` +
          `URL: ${data.jackett_url}\n` +
          `Test results: ${data.test_results} torrents found\n` +
          `Status: ${data.message}`);
      } else {
        alert(`❌ Jackett connection failed:\n${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Jackett test failed:', err);
      alert('❌ Jackett connection failed: Network error');
    } finally {
      setLoading(false);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-400';
      case 'downloading': return 'text-blue-400';
      case 'paused': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'downloading': return <Download className="w-4 h-4" />;
      case 'paused': return <Pause className="w-4 h-4" />;
      case 'error': return <AlertCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusText = (status: string, eta: string) => {
    switch (status) {
      case 'completed': return 'Completed';
      case 'downloading':
        if (eta === 'Resuming...' || eta === 'Connecting to peers...') {
          return eta;
        }
        return 'Downloading';
      case 'paused': return 'Paused';
      case 'error': return 'Error';
      default: return status;
    }
  };

  return (
    <div className="bg-gray-900 rounded-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Download className="w-6 h-6 text-red-500" />
          Torrent Downloads
        </h2>

        {mediaInfo && (
          <div className="text-sm text-gray-400">
            <div>
              Searching for: <span className="text-white font-medium">{mediaInfo.title}</span>
              <span className="ml-2 text-blue-400">({mediaInfo.media_type === 'tv' ? 'TV Series' : 'Movie'})</span>
            </div>
            <div className="text-xs mt-1 text-green-400">
              ✨ {mediaInfo.media_type === 'tv'
                ? 'TV series search includes all seasons automatically for comprehensive results'
                : 'Movie search optimized for better results (year removed)'}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 mb-6 bg-gray-800 rounded-lg p-1">
        {[
          { id: 'search', label: 'Search Torrents', icon: Search },
          { id: 'downloads', label: 'Downloads', icon: Download },
          { id: 'config', label: 'Settings', icon: Settings }
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === id
              ? 'bg-red-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-6 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <span className="text-red-200">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'search' && (
          <motion.div
            key="search"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Search Controls */}
            <div className="flex gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={mediaInfo?.media_type === 'tv'
                    ? "Search for TV series... (will search all seasons automatically)"
                    : "Search for movies or TV shows... (edit to customize search)"}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-red-500"
                  onKeyPress={(e) => e.key === 'Enter' && searchTorrents()}
                />
                <p className="text-xs text-gray-400 mt-1">
                  💡 Tip: {mediaInfo?.media_type === 'tv'
                    ? 'TV series searches now include all seasons automatically for better results'
                    : 'You can manually edit the search term above for better results'}
                </p>
              </div>
              <select
                value={qualityFilter}
                onChange={(e) => setQualityFilter(e.target.value)}
                className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-red-500"
              >
                <option value="">All Qualities</option>
                <option value="2160p">4K (2160p)</option>
                <option value="1080p">1080p</option>
                <option value="720p">720p</option>
                <option value="480p">480p</option>
              </select>
              <button
                onClick={() => searchTorrents()}
                disabled={searchLoading || !searchQuery.trim()}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                {searchLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Search
              </button>

              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                    setError(null);
                  }}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Clear
                </button>
              )}
            </div>

            {/* Search Results */}
            <div className="space-y-3">
              {searchResults.map((result, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-white font-medium line-clamp-1">{result.title}</h3>
                        {result.verified && (
                          <span className="bg-green-600 text-white text-xs px-2 py-1 rounded-full">Verified</span>
                        )}
                        <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">{result.quality}</span>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <span className="flex items-center gap-1">
                          <HardDrive className="w-4 h-4" />
                          {result.size}
                        </span>
                        <span className="flex items-center gap-1">
                          <Upload className="w-4 h-4 text-green-400" />
                          {result.seeders}
                        </span>
                        <span className="flex items-center gap-1">
                          <Download className="w-4 h-4 text-red-400" />
                          {result.leechers}
                        </span>
                        <span className="flex items-center gap-1">
                          <ExternalLink className="w-4 h-4" />
                          {result.source}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => startDownload(result)}
                      disabled={loading}
                      className="px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center"
                      title="Download torrent"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}

              {searchResults.length === 0 && !searchLoading && searchQuery && (
                <div className="text-center py-12 text-gray-400">
                  <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No torrents found for "{searchQuery}"</p>
                  <div className="text-sm mt-4 space-y-2">
                    <p>💡 Try these search tips:</p>
                    <ul className="text-left max-w-md mx-auto space-y-1">
                      {mediaInfo?.media_type === 'tv' ? (
                        <>
                          <li>• Search automatically includes all seasons</li>
                          <li>• Try just the series name without year</li>
                          <li>• Use simpler search terms</li>
                          <li>• Try different quality filters</li>
                          <li>• Check if Jackett is configured in Settings</li>
                        </>
                      ) : (
                        <>
                          <li>• Remove year from movie titles</li>
                          <li>• Use simpler search terms</li>
                          <li>• Try different quality filters</li>
                          <li>• For TV shows, try just the series name</li>
                          <li>• Check if Jackett is configured in Settings</li>
                        </>
                      )}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'downloads' && (
          <motion.div
            key="downloads"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            {/* Downloads Search and Filter Controls */}
            <div className="flex gap-4 mb-6">
              <div className="flex-1">
                <input
                  type="text"
                  value={downloadSearchQuery}
                  onChange={(e) => setDownloadSearchQuery(e.target.value)}
                  placeholder="Search downloads by name..."
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-red-500"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      setCurrentPage(1);
                      // Filtering happens automatically via useEffect
                    }
                  }}
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-red-500"
              >
                <option value="">All Status</option>
                <option value="downloading">Downloading</option>
                <option value="completed">Completed</option>
                <option value="paused">Paused</option>
                <option value="error">Error</option>
              </select>
              <button
                onClick={searchDownloads}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <Search className="w-4 h-4" />
                Filter
              </button>

              {(downloadSearchQuery || statusFilter) && (
                <button
                  onClick={clearDownloadSearch}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Clear
                </button>
              )}
            </div>

            {downloads.map((download) => (
              <div key={download.id} className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={getStatusColor(download.status)}>
                      {getStatusIcon(download.status)}
                    </div>
                    <div>
                      <h3 className="text-white font-medium line-clamp-1">{download.name}</h3>
                      <p className="text-sm text-gray-400">{getStatusText(download.status, download.eta)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {download.status === 'downloading' && (
                      <button
                        onClick={() => pauseDownload(download.id)}
                        disabled={operationsInProgress.has(download.id)}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                        title="Pause download"
                      >
                        {operationsInProgress.has(download.id) ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Pause className="w-4 h-4" />
                        )}
                      </button>
                    )}
                    {download.status === 'paused' && (
                      <button
                        onClick={() => resumeDownload(download.id)}
                        disabled={operationsInProgress.has(download.id)}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                        title="Resume download"
                      >
                        {operationsInProgress.has(download.id) ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => removeDownload(download.id, download.name)}
                      className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded-lg transition-colors"
                      title="Ultra-safe removal (protects other torrents)"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-sm text-gray-400 mb-1">
                    <span>{download.progress.toFixed(1)}%</span>
                    <span>{formatBytes(download.downloaded)} / {formatBytes(download.size)}</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-red-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${download.progress}%` }}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center justify-between text-sm text-gray-400">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <Download className="w-4 h-4 text-green-400" />
                      {formatSpeed(download.download_rate)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Upload className="w-4 h-4 text-blue-400" />
                      {formatSpeed(download.upload_rate)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {download.peers} peers
                    </span>
                  </div>
                  <span>ETA: {download.eta}</span>
                </div>
              </div>
            ))}

            {downloads.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <Download className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No active downloads</p>
                <p className="text-sm mt-2">Search for torrents to start downloading</p>
              </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-700">
                <div className="text-sm text-gray-400">
                  Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} downloads
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={!hasPrev}
                    className="flex items-center gap-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white rounded text-sm transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </button>

                  <div className="flex items-center gap-1 px-3 py-2 bg-gray-800 text-gray-300 rounded text-sm">
                    <span>Page</span>
                    <span className="font-medium text-white">{currentPage}</span>
                    <span>of</span>
                    <span className="font-medium text-white">{totalPages}</span>
                  </div>

                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={!hasNext}
                    className="flex items-center gap-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white rounded text-sm transition-colors"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'config' && config && (
          <motion.div
            key="config"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Jackett Configuration */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Jackett URL
                </label>
                <input
                  type="text"
                  placeholder="http://localhost:9117"
                  value={config.jackett_url || ''}
                  onChange={(e) => setConfig({ ...config, jackett_url: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-red-500"
                />
                <p className="text-xs text-gray-400 mt-1">URL of your Jackett server</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Jackett API Key
                </label>
                <input
                  type="password"
                  placeholder="Enter your Jackett API key"
                  value={config.jackett_api_key || ''}
                  onChange={(e) => setConfig({ ...config, jackett_api_key: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-red-500"
                />
                <p className="text-xs text-gray-400 mt-1">API key from your Jackett dashboard</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Enabled Sources
                </label>
                <div className="space-y-2">
                  {['1337x', 'YTS', 'TPB', 'RARBG'].map((source) => (
                    <label key={source} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={config.enabled_sources.split(',').includes(source)}
                        onChange={(e) => {
                          const sources = config.enabled_sources.split(',');
                          if (e.target.checked) {
                            sources.push(source);
                          } else {
                            const index = sources.indexOf(source);
                            if (index > -1) sources.splice(index, 1);
                          }
                          setConfig({ ...config, enabled_sources: sources.join(',') });
                        }}
                        className="w-4 h-4 text-red-600 bg-gray-800 border-gray-700 rounded focus:ring-red-500"
                      />
                      <span className="text-sm text-gray-300">{source}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Proxy Settings
                </label>
                <div className="space-y-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={config.use_proxy}
                      onChange={(e) => setConfig({ ...config, use_proxy: e.target.checked })}
                      className="w-4 h-4 text-red-600 bg-gray-800 border-gray-700 rounded focus:ring-red-500"
                    />
                    <span className="text-sm text-gray-300">Use Proxy</span>
                  </label>
                  {config.use_proxy && (
                    <input
                      type="text"
                      placeholder="http://proxy:port"
                      value={config.proxy_url}
                      onChange={(e) => setConfig({ ...config, proxy_url: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-red-500"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Download Path
                </label>
                <input
                  type="text"
                  value={config.download_path}
                  onChange={(e) => setConfig({ ...config, download_path: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Minimum Seeders
                </label>
                <input
                  type="number"
                  value={config.min_seeders}
                  onChange={(e) => setConfig({ ...config, min_seeders: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Max Concurrent Downloads
                </label>
                <input
                  type="number"
                  value={config.max_downloads}
                  onChange={(e) => setConfig({ ...config, max_downloads: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Preferred Quality
                </label>
                <select
                  value={config.preferred_quality}
                  onChange={(e) => setConfig({ ...config, preferred_quality: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-red-500"
                >
                  <option value="2160p">4K (2160p)</option>
                  <option value="1080p">1080p</option>
                  <option value="720p">720p</option>
                  <option value="480p">480p</option>
                </select>
              </div>
            </div>

            {/* Performance Settings Section */}
            <div className="col-span-full">
              <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-blue-400" />
                Performance Settings (High-Speed Downloads)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-gray-800 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Max Peer Connections
                  </label>
                  <input
                    type="number"
                    min="50"
                    max="1000"
                    value={config.max_peer_connections}
                    onChange={(e) => setConfig({ ...config, max_peer_connections: parseInt(e.target.value) || 500 })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">Higher = faster downloads (500 recommended)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Max Incoming Connections
                  </label>
                  <input
                    type="number"
                    min="20"
                    max="500"
                    value={config.max_peer_accepts}
                    onChange={(e) => setConfig({ ...config, max_peer_accepts: parseInt(e.target.value) || 200 })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">Incoming peer connections (200 recommended)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Max Open Files
                  </label>
                  <input
                    type="number"
                    min="256"
                    max="4096"
                    value={config.max_open_files}
                    onChange={(e) => setConfig({ ...config, max_open_files: parseInt(e.target.value) || 1024 })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">File handles for I/O performance (1024 recommended)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Port Range Start
                  </label>
                  <input
                    type="number"
                    min="1024"
                    max="65000"
                    value={config.port_range_start}
                    onChange={(e) => setConfig({ ...config, port_range_start: parseInt(e.target.value) || 50000 })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">Starting port for torrent client</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Port Range End
                  </label>
                  <input
                    type="number"
                    min="1025"
                    max="65535"
                    value={config.port_range_end}
                    onChange={(e) => setConfig({ ...config, port_range_end: parseInt(e.target.value) || 50100 })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">Ending port for torrent client</p>
                </div>

                <div className="flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-400">
                      {config.port_range_end - config.port_range_start + 1}
                    </div>
                    <div className="text-xs text-gray-400">Available Ports</div>
                  </div>
                </div>
              </div>

              <div className="mt-3 p-3 bg-blue-900/30 border border-blue-500/30 rounded-lg">
                <p className="text-sm text-blue-200">
                  <strong>💡 Performance Tip:</strong> These settings are optimized for high-speed connections (60Mbps+).
                  Higher peer connections = faster downloads but more CPU/memory usage.
                  Restart required after changing these settings.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="auto_download"
                checked={config.auto_download}
                onChange={(e) => setConfig({ ...config, auto_download: e.target.checked })}
                className="w-4 h-4 text-red-600 bg-gray-800 border-gray-700 rounded focus:ring-red-500"
              />
              <label htmlFor="auto_download" className="text-sm text-gray-300">
                Enable automatic downloads for watchlist items
              </label>
            </div>

            <div className="flex gap-4">
              <button
                onClick={testJackettConnection}
                disabled={loading || !config?.jackett_url || !config?.jackett_api_key}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <ExternalLink className="w-4 h-4" />
                )}
                Test Connection
              </button>

              <button
                onClick={() => updateConfig(config)}
                disabled={loading}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Settings className="w-4 h-4" />
                )}
                Save Configuration
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TorrentDashboard;