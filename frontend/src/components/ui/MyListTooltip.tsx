"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Check, Folder } from 'lucide-react';
import { Media } from '@/types/media';

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
  children: React.ReactNode;
}

export default function MyListTooltip({
  media,
  isInMyList,
  collections,
  onToggleMyList,
  onAddToCollection,
  children
}: MyListTooltipProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div 
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {children}
      
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50"
          >
            <div className="bg-gray-900/95 backdrop-blur-sm border border-gray-700/50 rounded-lg p-3 min-w-48 shadow-xl">
              {/* My List Toggle */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleMyList();
                  setShowTooltip(false);
                }}
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800/50 transition-colors text-left"
              >
                {isInMyList ? (
                  <>
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-white">Remove from My List</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 text-white" />
                    <span className="text-white">Add to My List</span>
                  </>
                )}
              </button>

              {/* Collections */}
              {collections.length > 0 && (
                <>
                  <div className="border-t border-gray-700/50 my-2"></div>
                  <div className="text-xs text-gray-400 mb-2 px-2">Add to Collection:</div>
                  <div className="max-h-32 overflow-y-auto">
                    {collections.map((collection) => (
                      <button
                        key={collection.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddToCollection(collection.id);
                          setShowTooltip(false);
                        }}
                        className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800/50 transition-colors text-left"
                      >
                        <Folder className="w-4 h-4 text-blue-400" />
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-sm truncate">{collection.name}</div>
                          <div className="text-gray-400 text-xs">{collection.item_count} items</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Tooltip Arrow */}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2">
                <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900/95"></div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}