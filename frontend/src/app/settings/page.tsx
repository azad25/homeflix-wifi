"use client";

import React, { useState, useEffect } from 'react';
import { Settings, Users, Database, Upload, Download, Trash2, Video, ImageIcon, Folder, File, Play, Info } from 'lucide-react';
import Image from 'next/image';
import Navbar from '@/components/Navbar';
import { getApiUrl } from '@/lib/api';
import { Media } from '@/types/media';
import { FolderTree, GlassCard, ScrollReveal, MagneticButton } from '@/components/scrollx';
import { motion } from 'framer-motion';

interface MediaAssets {
  banner?: string;
  thumbnail?: string;
  trailer?: string;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('media');
  const [mediaList, setMediaList] = useState<Media[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [mediaAssets, setMediaAssets] = useState<MediaAssets>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchMediaList();
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
    setSelectedMedia(media);
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
          <div className="text-white text-xl">Loading settings...</div>
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
        <div className="flex space-x-2 mb-12 bg-black/50 backdrop-blur-sm rounded-lg p-2">
          <MagneticButton
            onClick={() => setActiveTab('media')}
            className={`px-8 py-4 rounded-lg font-semibold transition-all duration-300 ${
              activeTab === 'media' 
                ? 'bg-[#E50914] text-white shadow-lg shadow-red-500/25' 
                : 'bg-transparent text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <Database className="w-5 h-5 mr-2" />
            Media Library
          </MagneticButton>
          <MagneticButton
            onClick={() => setActiveTab('general')}
            className={`px-8 py-4 rounded-lg font-semibold transition-all duration-300 ${
              activeTab === 'general' 
                ? 'bg-[#E50914] text-white shadow-lg shadow-red-500/25' 
                : 'bg-transparent text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <Settings className="w-5 h-5 mr-2" />
            General Settings
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

            {/* Netflix-style Asset Management */}
            <div className="lg:col-span-2">
              {selectedMedia ? (
                <ScrollReveal delay={0.2}>
                  <GlassCard className="p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-2xl font-semibold text-white flex items-center">
                        <Video className="w-6 h-6 mr-3 text-[#E50914]" />
                        {selectedMedia.title}
                      </h2>
                      <div className="flex space-x-2">
                        <MagneticButton className="bg-white/10 hover:bg-white/20 text-white p-3 rounded-full">
                          <Play className="w-5 h-5" />
                        </MagneticButton>
                        <MagneticButton className="bg-white/10 hover:bg-white/20 text-white p-3 rounded-full">
                          <Info className="w-5 h-5" />
                        </MagneticButton>
                      </div>
                    </div>
                    
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
                </ScrollReveal>
              ) : (
                <GlassCard className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <File className="w-16 h-16 text-white/30 mx-auto mb-4" />
                    <p className="text-white/70 text-lg">Select a media item to manage its assets</p>
                    <p className="text-white/50 text-sm mt-2">Choose from the file tree to get started</p>
                  </div>
                </GlassCard>
              )}
            </div>
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
