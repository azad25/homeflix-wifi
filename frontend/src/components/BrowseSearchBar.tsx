"use client";

import React, { useState, useEffect } from 'react';
import { Search, X, Filter } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface BrowseSearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  initialValue?: string;
}

export const BrowseSearchBar: React.FC<BrowseSearchBarProps> = ({
  onSearch,
  placeholder = "Search movies, TV shows, genres...",
  initialValue = ""
}) => {
  const [searchQuery, setSearchQuery] = useState(initialValue);
  const [isFocused, setIsFocused] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      onSearch(searchQuery);
    }, 300);

    return () => clearTimeout(delayedSearch);
  }, [searchQuery, onSearch]);

  const handleClear = () => {
    setSearchQuery("");
    onSearch("");
  };

  const handleAdvancedSearch = () => {
    router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className={`relative transition-all duration-300 ${
        isFocused ? 'transform scale-105' : ''
      }`}>
        <div className={`relative bg-black/30 backdrop-blur-md border rounded-xl overflow-hidden transition-all duration-300 ${
          isFocused 
            ? 'border-red-500/50 shadow-lg shadow-red-500/20' 
            : 'border-white/20 hover:border-white/30'
        }`}>
          {/* Search Icon */}
          <div className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10">
            <Search className={`w-5 h-5 transition-colors duration-300 ${
              isFocused ? 'text-red-400' : 'text-gray-400'
            }`} />
          </div>

          {/* Search Input */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            className="w-full pl-12 pr-20 py-4 bg-transparent text-white placeholder-gray-400 focus:outline-none text-lg"
          />

          {/* Right Side Controls */}
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
            {/* Clear Button */}
            {searchQuery && (
              <button
                onClick={handleClear}
                className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/10"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* Advanced Search Button */}
            <button
              onClick={handleAdvancedSearch}
              className="p-2 text-gray-400 hover:text-red-400 transition-colors rounded-lg hover:bg-white/10"
              title="Advanced search"
            >
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search Suggestions/Quick Actions */}
        {isFocused && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-black/90 backdrop-blur-md border border-white/20 rounded-xl overflow-hidden z-50">
            <div className="p-4">
              <div className="text-sm text-gray-400 mb-3">Quick searches:</div>
              <div className="flex flex-wrap gap-2">
                {['Action', 'Comedy', 'Drama', 'Horror', 'Sci-Fi', 'Romance'].map((genre) => (
                  <button
                    key={genre}
                    onClick={() => setSearchQuery(genre)}
                    className="px-3 py-1 bg-white/10 hover:bg-red-600/20 text-gray-300 hover:text-white rounded-full text-sm transition-colors"
                  >
                    {genre}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Search Stats */}
      {searchQuery && (
        <div className="mt-3 text-center">
          <p className="text-sm text-gray-400">
            Searching for "{searchQuery}"...
          </p>
        </div>
      )}
    </div>
  );
};

export default BrowseSearchBar;
