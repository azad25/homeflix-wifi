"use client";

import React, { useState, useEffect } from 'react';
import { Sparkles, Save, RefreshCw, Upload, Trash2, Film, Tv, Calendar, Star, Users, MapPin, Tag } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { getApiUrl } from '@/lib/api';
import { Media } from '@/types/media';
import FolderTree, { TreeNode } from '@/components/scrollx/FolderTree';
import { MagneticButton, GradientBackground, ScrollReveal } from '@/components/scrollx';
import { motion } from 'framer-motion';

interface MediaMetadata {
  title: string;
  tagline: string;
  description: string;
  year: number;
  stars: string[];
  directors: string[];
  country: string;
  genres: string[];
  rating: number;
}

export default function EnhancedSettingsPage() {
  const [allMedia, setAllMedia] = useState<Media[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingMetadata, setGeneratingMetadata] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'assets' | 'subtitles'>('info');
  
  // Metadata fields
  const [metadata, setMetadata] = useState<MediaMetadata>({
    title: '',
    tagline: '',
    description: '',
    year: new Date().getFullYear(),
    stars: [],
    directors: [],
    country: '',
    genres: [],
    rating: 0,
  });

  const [newStar, setNewStar] = useState('');
  const [newDirector, setNewDirector] = useState('');
  const [newGenre, setNewGenre] = useState('');

  useEffect(() => {
    fetchMedia();
  }, []);

  useEffect(() => {
    if (selectedMedia) {
      loadMediaMetadata(selectedMedia);
    }
  }, [selectedMedia]);

  const fetchMedia = async () => {
    try {
      const response = await fetch(`${getApiUrl()}/api/media`);
      const data = await response.json();
      setAllMedia(data);
      buildTreeData(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching media:', error);
      setLoading(false);
    }
  };

  const buildTreeData = (media: Media[]) => {
    const tree: TreeNode[] = [];
    const movieFolder: TreeNode = {
      id: 'movies',
      name: 'Movies',
      type: 'folder',
      children: [],
    };
    const tvFolder: TreeNode = {
      id: 'tv-shows',
      name: 'TV Shows',
      type: 'folder',
      children: [],
    };

    media.forEach((item) => {
      const node: TreeNode = {
        id: item.id.toString(),
        name: item.title,
        type: 'media',
        metadata: {
          mediaType: item.type === 'movie' ? 'movie' : 'episode',
          size: item.file_size,
          duration: item.duration,
        },
      };

      if (item.type === 'movie') {
        movieFolder.children!.push(node);
      } else {
        // Group by series
        if (item.series_id) {
          let seriesFolder = tvFolder.children!.find(
            (n) => n.id === `series-${item.series_id}`
          );
          if (!seriesFolder) {
            seriesFolder = {
              id: `series-${item.series_id}`,
              name: item.series?.title || `Series ${item.series_id}`,
              type: 'folder',
              children: [],
            };
            tvFolder.children!.push(seriesFolder);
          }
          seriesFolder.children!.push(node);
        } else {
          tvFolder.children!.push(node);
        }
      }
    });

    tree.push(movieFolder, tvFolder);
    setTreeData(tree);
  };

  const loadMediaMetadata = (media: Media) => {
    setMetadata({
      title: media.title || '',
      tagline: '',
      description: media.description || '',
      year: media.release_date ? new Date(media.release_date).getFullYear() : new Date().getFullYear(),
      stars: [],
      directors: [],
      country: '',
      genres: media.genres?.map(g => g.name) || [],
      rating: media.rating || 0,
    });
  };

  const handleTreeSelect = (node: TreeNode) => {
    if (node.type === 'media') {
      const media = allMedia.find((m) => m.id.toString() === node.id);
      if (media) {
        setSelectedMedia(media);
      }
    }
  };

  const generateMetadata = async () => {
    if (!selectedMedia) return;

    setGeneratingMetadata(true);
    try {
      const response = await fetch(`${getApiUrl()}/api/ai/generate-metadata/${selectedMedia.id}`, {
        method: 'POST',
      });
      const data = await response.json();
      
      setMetadata({
        title: data.title || metadata.title,
        tagline: data.tagline || '',
        description: data.description || metadata.description,
        year: data.year || metadata.year,
        stars: data.stars || [],
        directors: data.directors || [],
        country: data.country || '',
        genres: data.genres || metadata.genres,
        rating: data.rating || metadata.rating,
      });
    } catch (error) {
      console.error('Error generating metadata:', error);
      alert('Failed to generate metadata. Please try again.');
    } finally {
      setGeneratingMetadata(false);
    }
  };

  const saveMetadata = async () => {
    if (!selectedMedia) return;

    try {
      await fetch(`${getApiUrl()}/api/admin/media/${selectedMedia.id}/metadata`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metadata),
      });
      alert('Metadata saved successfully!');
      fetchMedia();
    } catch (error) {
      console.error('Error saving metadata:', error);
      alert('Failed to save metadata.');
    }
  };

  const addItem = (type: 'star' | 'director' | 'genre', value: string) => {
    if (!value.trim()) return;
    
    setMetadata(prev => ({
      ...prev,
      [type === 'star' ? 'stars' : type === 'director' ? 'directors' : 'genres']: [
        ...prev[type === 'star' ? 'stars' : type === 'director' ? 'directors' : 'genres'],
        value.trim()
      ]
    }));

    if (type === 'star') setNewStar('');
    if (type === 'director') setNewDirector('');
    if (type === 'genre') setNewGenre('');
  };

  const removeItem = (type: 'stars' | 'directors' | 'genres', index: number) => {
    setMetadata(prev => ({
      ...prev,
      [type]: prev[type].filter((_, i) => i !== index)
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <Navbar onSearch={() => {}} />
      
      <GradientBackground variant="cosmic" animate={true}>
        <div className="container mx-auto px-4 py-8">
          <ScrollReveal direction="up">
            <div className="mb-8">
              <h1 className="text-4xl font-bold text-white mb-2">Media Settings</h1>
              <p className="text-gray-400">Manage your media library with AI-powered metadata generation</p>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Folder Tree */}
            <ScrollReveal direction="left" delay={0.2}>
              <div className="bg-zinc-900/50 backdrop-blur-xl rounded-xl border border-white/10 p-6">
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <Film className="w-5 h-5" />
                  Media Library
                </h2>
                <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
                  <FolderTree
                    data={treeData}
                    onSelect={handleTreeSelect}
                    selectedId={selectedMedia?.id.toString()}
                  />
                </div>
              </div>
            </ScrollReveal>

            {/* Metadata Editor */}
            <div className="lg:col-span-2">
              {selectedMedia ? (
                <ScrollReveal direction="right" delay={0.3}>
                  <div className="bg-zinc-900/50 backdrop-blur-xl rounded-xl border border-white/10 p-6">
                    {/* Header with AI Generate Button */}
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-2xl font-bold text-white">{selectedMedia.title}</h2>
                      <MagneticButton
                        onClick={generateMetadata}
                        disabled={generatingMetadata}
                        className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition-all disabled:opacity-50"
                      >
                        {generatingMetadata ? (
                          <>
                            <RefreshCw className="w-5 h-5 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-5 h-5" />
                            AI Generate
                          </>
                        )}
                      </MagneticButton>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-2 mb-6 border-b border-white/10">
                      {(['info', 'assets', 'subtitles'] as const).map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setActiveTab(tab)}
                          className={`px-6 py-3 font-medium transition-all ${
                            activeTab === tab
                              ? 'text-white border-b-2 border-blue-500'
                              : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                      ))}
                    </div>

                    {/* Info Tab */}
                    {activeTab === 'info' && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6"
                      >
                        {/* Title */}
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Title
                          </label>
                          <input
                            type="text"
                            value={metadata.title}
                            onChange={(e) => setMetadata({ ...metadata, title: e.target.value })}
                            className="w-full bg-zinc-800/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                          />
                        </div>

                        {/* Tagline */}
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Tagline
                          </label>
                          <input
                            type="text"
                            value={metadata.tagline}
                            onChange={(e) => setMetadata({ ...metadata, tagline: e.target.value })}
                            placeholder="A catchy one-liner..."
                            className="w-full bg-zinc-800/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                          />
                        </div>

                        {/* Description */}
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Description
                          </label>
                          <textarea
                            value={metadata.description}
                            onChange={(e) => setMetadata({ ...metadata, description: e.target.value })}
                            rows={4}
                            className="w-full bg-zinc-800/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 resize-none"
                          />
                        </div>

                        {/* Year, Rating, Country */}
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                              <Calendar className="w-4 h-4" />
                              Year
                            </label>
                            <input
                              type="number"
                              value={metadata.year}
                              onChange={(e) => setMetadata({ ...metadata, year: parseInt(e.target.value) })}
                              className="w-full bg-zinc-800/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                              <Star className="w-4 h-4" />
                              Rating
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="10"
                              value={metadata.rating}
                              onChange={(e) => setMetadata({ ...metadata, rating: parseFloat(e.target.value) })}
                              className="w-full bg-zinc-800/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                              <MapPin className="w-4 h-4" />
                              Country
                            </label>
                            <input
                              type="text"
                              value={metadata.country}
                              onChange={(e) => setMetadata({ ...metadata, country: e.target.value })}
                              className="w-full bg-zinc-800/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                            />
                          </div>
                        </div>

                        {/* Stars */}
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            Stars
                          </label>
                          <div className="flex gap-2 mb-2">
                            <input
                              type="text"
                              value={newStar}
                              onChange={(e) => setNewStar(e.target.value)}
                              onKeyPress={(e) => e.key === 'Enter' && addItem('star', newStar)}
                              placeholder="Add actor/actress..."
                              className="flex-1 bg-zinc-800/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                            />
                            <button
                              onClick={() => addItem('star', newStar)}
                              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              Add
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {metadata.stars.map((star, index) => (
                              <span
                                key={index}
                                className="bg-blue-600/20 border border-blue-500/50 text-blue-300 px-3 py-1 rounded-full text-sm flex items-center gap-2"
                              >
                                {star}
                                <button
                                  onClick={() => removeItem('stars', index)}
                                  className="hover:text-red-400 transition-colors"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Directors */}
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Directors
                          </label>
                          <div className="flex gap-2 mb-2">
                            <input
                              type="text"
                              value={newDirector}
                              onChange={(e) => setNewDirector(e.target.value)}
                              onKeyPress={(e) => e.key === 'Enter' && addItem('director', newDirector)}
                              placeholder="Add director..."
                              className="flex-1 bg-zinc-800/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                            />
                            <button
                              onClick={() => addItem('director', newDirector)}
                              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              Add
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {metadata.directors.map((director, index) => (
                              <span
                                key={index}
                                className="bg-purple-600/20 border border-purple-500/50 text-purple-300 px-3 py-1 rounded-full text-sm flex items-center gap-2"
                              >
                                {director}
                                <button
                                  onClick={() => removeItem('directors', index)}
                                  className="hover:text-red-400 transition-colors"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Genres */}
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                            <Tag className="w-4 h-4" />
                            Genres
                          </label>
                          <div className="flex gap-2 mb-2">
                            <input
                              type="text"
                              value={newGenre}
                              onChange={(e) => setNewGenre(e.target.value)}
                              onKeyPress={(e) => e.key === 'Enter' && addItem('genre', newGenre)}
                              placeholder="Add genre..."
                              className="flex-1 bg-zinc-800/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                            />
                            <button
                              onClick={() => addItem('genre', newGenre)}
                              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              Add
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {metadata.genres.map((genre, index) => (
                              <span
                                key={index}
                                className="bg-green-600/20 border border-green-500/50 text-green-300 px-3 py-1 rounded-full text-sm flex items-center gap-2"
                              >
                                {genre}
                                <button
                                  onClick={() => removeItem('genres', index)}
                                  className="hover:text-red-400 transition-colors"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Save Button */}
                        <div className="flex justify-end pt-4">
                          <MagneticButton
                            onClick={saveMetadata}
                            className="flex items-center gap-2 bg-green-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-green-700 transition-all"
                          >
                            <Save className="w-5 h-5" />
                            Save Metadata
                          </MagneticButton>
                        </div>
                      </motion.div>
                    )}

                    {/* Assets Tab */}
                    {activeTab === 'assets' && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-white"
                      >
                        <p className="text-gray-400">Asset management coming from previous implementation...</p>
                      </motion.div>
                    )}

                    {/* Subtitles Tab */}
                    {activeTab === 'subtitles' && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-white"
                      >
                        <p className="text-gray-400">Subtitle management interface...</p>
                      </motion.div>
                    )}
                  </div>
                </ScrollReveal>
              ) : (
                <div className="bg-zinc-900/50 backdrop-blur-xl rounded-xl border border-white/10 p-12 text-center">
                  <Film className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-xl text-white mb-2">No Media Selected</h3>
                  <p className="text-gray-400">Select a media item from the library to edit its metadata</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </GradientBackground>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      `}</style>
    </div>
  );
}
