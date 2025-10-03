"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Filter, X } from 'lucide-react';

interface Genre {
  id: number;
  name: string;
  description?: string;
}

interface GenreSidebarProps {
  genres: Genre[];
  selectedGenre: string;
  onGenreSelect: (genre: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
}

const GenreSidebar: React.FC<GenreSidebarProps> = ({
  genres,
  selectedGenre,
  onGenreSelect,
  isOpen,
  onToggle,
  className = ""
}) => {
  const genreItems = [
    { id: 0, name: 'All Genres' },
    ...genres
  ];

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        onClick={onToggle}
        className="lg:hidden fixed top-20 left-4 z-50 bg-black/80 backdrop-blur-md text-white p-3 rounded-full border border-white/20 hover:bg-white/10 transition-colors"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Filter className="w-5 h-5" />}
      </button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <motion.div
        initial={{ x: -300 }}
        animate={{ x: isOpen ? 0 : -300 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className={`fixed left-0 top-0 h-full w-80 bg-black/90 backdrop-blur-xl border-r border-white/10 z-40 lg:relative lg:translate-x-0 lg:w-64 lg:bg-transparent lg:border-none ${className}`}
      >
        <div className="p-6 pt-24 lg:pt-6 h-full overflow-y-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <Filter className="w-5 h-5 text-red-500" />
            <h3 className="text-lg font-bold text-white">Browse by Genre</h3>
          </div>

          {/* Genre List */}
          <div className="space-y-2">
            {genreItems.map((genre) => {
              const isSelected = selectedGenre === (genre.name === 'All Genres' ? 'all' : genre.name);
              
              return (
                <motion.button
                  key={genre.id}
                  onClick={() => {
                    onGenreSelect(genre.name === 'All Genres' ? 'all' : genre.name);
                    // Close sidebar on mobile after selection
                    if (window.innerWidth < 1024) {
                      onToggle();
                    }
                  }}
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 ${
                    isSelected
                      ? 'bg-red-600 text-white font-semibold'
                      : 'text-gray-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate">{genre.name}</span>
                    {isSelected && (
                      <div className="w-2 h-2 bg-white rounded-full ml-2 flex-shrink-0" />
                    )}
                  </div>
                </motion.button>
              );
            })}
          </div>

          {/* Additional Filters */}
          <div className="mt-8 pt-6 border-t border-white/10">
            <h4 className="text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wider">
              Quick Filters
            </h4>
            <div className="space-y-2">
              <button className="w-full text-left px-4 py-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors text-sm">
                Recently Added
              </button>
              <button className="w-full text-left px-4 py-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors text-sm">
                Most Popular
              </button>
              <button className="w-full text-left px-4 py-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors text-sm">
                Highest Rated
              </button>
              <button className="w-full text-left px-4 py-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors text-sm">
                My List
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
};

export default GenreSidebar;
