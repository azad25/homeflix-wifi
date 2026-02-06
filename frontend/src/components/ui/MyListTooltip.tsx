"use client";

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Folder, Heart, X, Check } from 'lucide-react';
import { Media } from '@/types/media';
import { getApiUrl } from '@/lib/api';

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

interface MyListTooltipProps {
  media: Media;
  isInMyList: boolean;
  collections: Collection[];
  onToggleMyList: () => void;
  onAddToCollection: (collectionId: number) => void;
  onRemoveFromCollection?: (collectionId: number) => void;
  currentCollectionId?: number;
  onCollectionCreated?: () => void;
  onDataRefresh?: () => void; // New prop for refreshing data
  children: React.ReactNode;
}

export default function MyListTooltip({
  media,
  isInMyList,
  collections,
  onToggleMyList,
  onAddToCollection,
  onRemoveFromCollection,
  currentCollectionId,
  onCollectionCreated,
  onDataRefresh,
  children
}: MyListTooltipProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [collectionName, setCollectionName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<'top' | 'bottom'>('top');
  const [addedToCollections, setAddedToCollections] = useState<Set<number>>(new Set());
  const tooltipRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate optimal tooltip position
  useEffect(() => {
    if (showTooltip && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceAbove = rect.top;
      const spaceBelow = viewportHeight - rect.bottom;
      
      if (spaceBelow > spaceAbove || spaceAbove < 200) {
        setTooltipPosition('bottom');
      } else {
        setTooltipPosition('top');
      }
    }
  }, [showTooltip]);

  const handleToggleMyList = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsAnimating(true);
    
    try {
      // For TMDB content, we need to ensure the ID is properly formatted
      const mediaId = media.id;
      console.log('MyListTooltip: Toggling my list for media:', {
        id: mediaId,
        title: media.title,
        type: media.type,
        tmdb_id: media.tmdb_id
      });
      
      onToggleMyList();
      // Refresh data after toggling my list
      onDataRefresh?.();
    } catch (error) {
      console.error('Error toggling my list:', error);
    }
    
    setTimeout(() => {
      setShowTooltip(false);
      setIsAnimating(false);
    }, 200);
  };

  const handleAddToCollection = async (collectionId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      const apiUrl = getApiUrl();
      let mediaType = 'movie';
      
      if (media.type === 'episode') {
        mediaType = 'tv';
      }

      console.log('MyListTooltip: Adding to collection:', {
        collectionId,
        media_id: media.id,
        media_type: mediaType,
        title: media.title,
        tmdb_id: media.tmdb_id
      });

      const response = await fetch(`${apiUrl}/api/collections/${collectionId}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': '1'
        },
        body: JSON.stringify({
          media_id: media.id,
          media_type: mediaType,
          notes: ''
        })
      });

      if (response.ok) {
        console.log('MyListTooltip: Successfully added to collection');
        setAddedToCollections(prev => new Set([...prev, collectionId]));
        // Call the parent's callback to refresh data
        onAddToCollection(collectionId);
        // Also trigger collection refresh
        onCollectionCreated?.();
        // Refresh all data
        onDataRefresh?.();
        setTimeout(() => {
          setAddedToCollections(prev => {
            const newSet = new Set(prev);
            newSet.delete(collectionId);
            return newSet;
          });
        }, 1500);
      } else {
        console.error('MyListTooltip: Failed to add to collection, response:', response.status);
      }
    } catch (error) {
      console.error('Error adding to collection:', error);
    }
  };

  const handleRemoveFromCollection = (collectionId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    onRemoveFromCollection?.(collectionId);
    setShowTooltip(false);
  };

  const handleCreateCollection = async () => {
    if (!collectionName.trim() || isCreating) return;

    try {
      setIsCreating(true);
      const apiUrl = getApiUrl();
      
      let mediaType = 'movie';
      if (media.type === 'episode') {
        mediaType = 'tv';
      }

      const response = await fetch(`${apiUrl}/api/collections`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': '1'
        },
        body: JSON.stringify({
          name: collectionName,
          description: '',
          is_public: false,
          tags: ''
        })
      });

      if (response.ok) {
        const newCollection = await response.json();
        if (newCollection.id) {
          await handleAddToCollection(newCollection.id, { stopPropagation: () => {} } as React.MouseEvent);
        }
        setCollectionName('');
        setShowCreateForm(false);
        setShowTooltip(false);
        onCollectionCreated?.();
        // Refresh all data
        onDataRefresh?.();
      }
    } catch (error) {
      console.error("Error creating collection:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const maxCollections = 3;
  const visibleCollections = collections.slice(0, maxCollections);

  return (
    <div 
      ref={containerRef}
      className="relative group"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {children}
      
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            ref={tooltipRef}
            initial={{ opacity: 0, y: tooltipPosition === 'top' ? 10 : -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: tooltipPosition === 'top' ? 10 : -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={`absolute left-1/2 transform -translate-x-1/2 z-50 ${
              tooltipPosition === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'
            }`}
            style={{ width: '200px' }}
          >
            <div className="bg-black/95 backdrop-blur-sm border border-gray-800/50 rounded-lg shadow-xl overflow-hidden">
              <div className="p-2">
                {/* My List Toggle */}
                <button
                  onClick={handleToggleMyList}
                  disabled={isAnimating}
                  className={`w-full flex items-center gap-2 p-2 rounded text-xs transition-all ${
                    isInMyList 
                      ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300' 
                      : 'bg-green-500/20 hover:bg-green-500/30 text-green-300'
                  }`}
                >
                  {isAnimating ? (
                    <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Heart className={`w-3 h-3 ${isInMyList ? 'fill-current' : ''}`} />
                  )}
                  <span className="font-medium">
                    {isInMyList ? 'Remove from List' : 'Add to List'}
                  </span>
                </button>

                {/* Collections */}
                {visibleCollections.length > 0 && (
                  <div className="mt-1 space-y-1">
                    {visibleCollections.map((collection) => (
                      <button
                        key={collection.id}
                        onClick={(e) => handleAddToCollection(collection.id, e)}
                        className="w-full flex items-center gap-2 p-2 rounded text-xs hover:bg-black/50 text-gray-300 hover:text-white transition-all group/item"
                      >
                        <Folder className="w-3 h-3 text-blue-400" />
                        <span className="flex-1 truncate text-left">{collection.name}</span>
                        {addedToCollections.has(collection.id) ? (
                          <Check className="w-3 h-3 text-green-400" />
                        ) : (
                          <Plus className="w-3 h-3 opacity-0 group-hover/item:opacity-100 transition-opacity" />
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* Create Collection */}
                {!showCreateForm ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCreateForm(true);
                    }}
                    className="w-full flex items-center gap-2 p-2 rounded text-xs hover:bg-black/50 text-gray-400 hover:text-white transition-all mt-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>New Collection</span>
                  </button>
                ) : (
                  <div className="mt-1 space-y-1">
                    <input
                      type="text"
                      value={collectionName}
                      onChange={(e) => setCollectionName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateCollection();
                        if (e.key === 'Escape') {
                          setShowCreateForm(false);
                          setCollectionName('');
                        }
                      }}
                      placeholder="Collection name"
                      className="w-full px-2 py-1 bg-black text-white rounded text-xs border border-gray-800 focus:border-blue-400 focus:outline-none"
                      autoFocus
                    />
                    <div className="flex gap-1">
                      <button
                        onClick={handleCreateCollection}
                        disabled={!collectionName.trim() || isCreating}
                        className="flex-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-black text-white rounded text-xs transition-colors"
                      >
                        {isCreating ? '...' : 'Create'}
                      </button>
                      <button
                        onClick={() => {
                          setShowCreateForm(false);
                          setCollectionName('');
                        }}
                        className="px-2 py-1 bg-black hover:bg-gray-800 text-white rounded text-xs transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Remove from current collection */}
                {currentCollectionId && onRemoveFromCollection && (
                  <button
                    onClick={(e) => handleRemoveFromCollection(currentCollectionId, e)}
                    className="w-full flex items-center gap-2 p-2 rounded text-xs bg-red-500/20 hover:bg-red-500/30 text-red-300 transition-all mt-1"
                  >
                    <X className="w-3 h-3" />
                    <span>Remove from Collection</span>
                  </button>
                )}
              </div>

              {/* Arrow */}
              <div className={`absolute left-1/2 transform -translate-x-1/2 ${
                tooltipPosition === 'top' ? 'top-full -mt-px' : 'bottom-full -mb-px'
              }`}>
                <div className={`w-2 h-2 bg-black/95 border-gray-800/50 rotate-45 ${
                  tooltipPosition === 'top' ? 'border-r border-b' : 'border-l border-t'
                }`} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}