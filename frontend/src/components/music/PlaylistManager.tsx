"use client";

import React, { useState, useEffect } from 'react';
import { Plus, Music, Play, MoreHorizontal, Edit, Trash2, X } from 'lucide-react';
import { MusicAPI } from '@/lib/musicApi';
import { Playlist, Track } from '@/types/music';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';

interface PlaylistManagerProps {
  onPlaylistSelect?: (playlist: Playlist) => void;
}

export default function PlaylistManager({ onPlaylistSelect }: PlaylistManagerProps) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistDescription, setNewPlaylistDescription] = useState('');
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const { playTrack } = useMusicPlayer();

  useEffect(() => {
    loadPlaylists();
  }, []);

  const loadPlaylists = async () => {
    try {
      setLoading(true);
      const userPlaylists = await MusicAPI.getPlaylists();
      setPlaylists(userPlaylists);
    } catch (error) {
      console.error('Failed to load playlists:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;

    try {
      const playlist = await MusicAPI.createPlaylist(newPlaylistName, newPlaylistDescription);
      setPlaylists([playlist, ...playlists]);
      setNewPlaylistName('');
      setNewPlaylistDescription('');
      setShowCreateModal(false);
    } catch (error) {
      console.error('Failed to create playlist:', error);
    }
  };

  const handlePlayPlaylist = (playlist: Playlist) => {
    if (playlist.tracks && playlist.tracks.length > 0) {
      playTrack(playlist.tracks[0], playlist.tracks);
    }
  };

  const handlePlaylistClick = async (playlist: Playlist) => {
    try {
      // Fetch full playlist with tracks
      const fullPlaylist = await MusicAPI.getPlaylist(playlist.id);
      setSelectedPlaylist(fullPlaylist);
      if (onPlaylistSelect) {
        onPlaylistSelect(fullPlaylist);
      }
    } catch (error) {
      console.error('Failed to load playlist details:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Your Playlists</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={20} />
          Create Playlist
        </button>
      </div>

      {/* Playlists Grid */}
      {playlists.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {playlists.map((playlist) => (
            <div
              key={playlist.id}
              className="bg-gray-800 rounded-lg p-4 hover:bg-gray-700 transition-colors cursor-pointer group"
              onClick={() => handlePlaylistClick(playlist)}
            >
              <div className="aspect-square bg-gray-700 rounded-lg mb-4 flex items-center justify-center relative overflow-hidden">
                {playlist.tracks && playlist.tracks.length > 0 ? (
                  <img
                    src={playlist.tracks[0].thumbnail_url}
                    alt={playlist.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Music size={48} className="text-gray-500" />
                )}
                
                {/* Play Button Overlay */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlayPlaylist(playlist);
                  }}
                  className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Play size={32} className="text-white" />
                </button>
              </div>
              
              <div className="space-y-1">
                <h3 className="text-white font-medium truncate">{playlist.name}</h3>
                <p className="text-gray-400 text-sm">
                  {playlist.tracks?.length || 0} songs
                </p>
                {playlist.description && (
                  <p className="text-gray-500 text-xs truncate">{playlist.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Music size={64} className="mx-auto text-gray-600 mb-4" />
          <h3 className="text-white text-lg font-medium mb-2">No playlists yet</h3>
          <p className="text-gray-400 mb-6">Create your first playlist to organize your favorite songs</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg transition-colors"
          >
            Create Your First Playlist
          </button>
        </div>
      )}

      {/* Create Playlist Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Create Playlist</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-white text-sm font-medium mb-2">
                  Playlist Name *
                </label>
                <input
                  type="text"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  placeholder="My Awesome Playlist"
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-green-500 focus:outline-none"
                />
              </div>
              
              <div>
                <label className="block text-white text-sm font-medium mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={newPlaylistDescription}
                  onChange={(e) => setNewPlaylistDescription(e.target.value)}
                  placeholder="Describe your playlist..."
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-green-500 focus:outline-none resize-none"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePlaylist}
                disabled={!newPlaylistName.trim()}
                className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Playlist Detail Modal */}
      {selectedPlaylist && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-white">{selectedPlaylist.name}</h3>
                <p className="text-gray-400">{selectedPlaylist.tracks?.length || 0} songs</p>
              </div>
              <button
                onClick={() => setSelectedPlaylist(null)}
                className="text-gray-400 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>
            
            {selectedPlaylist.tracks && selectedPlaylist.tracks.length > 0 ? (
              <div className="space-y-2">
                <div className="flex gap-3 mb-4">
                  <button
                    onClick={() => handlePlayPlaylist(selectedPlaylist)}
                    className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    <Play size={20} />
                    Play All
                  </button>
                </div>
                
                {selectedPlaylist.tracks.map((track, index) => (
                  <div
                    key={track.id}
                    className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-700 transition-colors group"
                  >
                    <div className="text-gray-400 w-8 text-center">
                      <span className="group-hover:hidden">{index + 1}</span>
                      <button
                        onClick={() => playTrack(track, selectedPlaylist.tracks)}
                        className="hidden group-hover:block text-white hover:text-green-500"
                      >
                        <Play size={16} />
                      </button>
                    </div>
                    
                    <img
                      src={track.thumbnail_url}
                      alt={track.title}
                      className="w-12 h-12 rounded object-cover"
                    />
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="text-white font-medium truncate">{track.title}</h4>
                      <p className="text-gray-400 text-sm truncate">{track.artist}</p>
                    </div>
                    
                    <div className="text-gray-400 text-sm">
                      {MusicAPI.formatDuration(track.duration)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Music size={48} className="mx-auto text-gray-600 mb-4" />
                <p className="text-gray-400">This playlist is empty</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}