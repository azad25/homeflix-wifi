"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Layout, 
  Monitor, 
  Film, 
  Tv, 
  Compass, 
  Sparkles, 
  Settings, 
  BarChart3,
  Plus,
  Eye,
  Search,
  Filter,
  ArrowLeft,
  Layers
} from 'lucide-react';
import { PageType } from '@/types/widgets';
import EnhancedWidgetConfigPanel from '@/components/widgets/EnhancedWidgetConfigPanel';

interface EnhancedWidgetManagerProps {
  className?: string;
}

const pages: { id: PageType; name: string; icon: React.ReactNode; description: string }[] = [
  { 
    id: 'home', 
    name: 'Home Page', 
    icon: <Monitor className="w-5 h-5" />, 
    description: 'Main landing page widgets' 
  },
  { 
    id: 'movies', 
    name: 'Movies Page', 
    icon: <Film className="w-5 h-5" />, 
    description: 'Movie-specific widgets' 
  },
  { 
    id: 'tv-shows', 
    name: 'TV Shows Page', 
    icon: <Tv className="w-5 h-5" />, 
    description: 'TV series widgets' 
  },
  { 
    id: 'browse', 
    name: 'Browse Page', 
    icon: <Compass className="w-5 h-5" />, 
    description: 'Discovery and browsing widgets' 
  },
  { 
    id: 'new-popular', 
    name: 'New & Popular', 
    icon: <Sparkles className="w-5 h-5" />, 
    description: 'Trending and popular content' 
  }
];

type ViewMode = 'overview' | 'edit' | 'performance';

export default function EnhancedWidgetManager({ className = '' }: EnhancedWidgetManagerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [selectedPage, setSelectedPage] = useState<PageType>('home');

  const handlePageSelect = (pageId: PageType) => {
    setSelectedPage(pageId);
    setViewMode('edit');
  };

  const handleBackToOverview = () => {
    setViewMode('overview');
  };

  return (
    <div className={`min-h-screen ${className}`}>
      <AnimatePresence mode="wait">
        {viewMode === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-8"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-red-500/20 to-red-600/20 backdrop-blur-sm border border-red-400/20 rounded-xl flex items-center justify-center">
                    <Layout className="w-5 h-5 text-red-200" />
                  </div>
                  Widget Management
                </h2>
                <p className="text-white/60">
                  Configure and manage widgets across all pages with drag-and-drop functionality
                </p>
              </div>
              
              <button
                onClick={() => setViewMode('performance')}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 backdrop-blur-sm border border-red-400/20 text-red-200 rounded-xl transition-all duration-200 hover:scale-105"
              >
                <BarChart3 className="w-4 h-4" />
                Performance
              </button>
            </div>

            {/* Page Selection Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pages.map((page) => (
                <motion.button
                  key={page.id}
                  onClick={() => handlePageSelect(page.id)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="group relative p-6 bg-white/10 hover:bg-white/15 backdrop-blur-sm border border-white/20 hover:border-red-400/40 rounded-2xl transition-all duration-200 text-left"
                >
                  {/* Background gradient */}
                  <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-red-600/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  
                  <div className="relative">
                    {/* Icon */}
                    <div className="w-12 h-12 bg-gradient-to-br from-white/15 to-white/10 backdrop-blur-sm border border-white/20 group-hover:border-red-400/40 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-all duration-200">
                      <div className="text-white/90 group-hover:text-red-200 transition-colors">
                        {page.icon}
                      </div>
                    </div>
                    
                    {/* Content */}
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold text-white/95 group-hover:text-red-200 transition-colors">
                        {page.name}
                      </h3>
                      <p className="text-sm text-white/75 group-hover:text-white/90 transition-colors">
                        {page.description}
                      </p>
                    </div>
                    
                    {/* Action indicator */}
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <div className="w-8 h-8 bg-red-500/20 backdrop-blur-sm border border-red-400/30 rounded-lg flex items-center justify-center">
                        <Settings className="w-4 h-4 text-red-200" />
                      </div>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>

            {/* Features Overview */}
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white/95 mb-4">Enhanced Widget System Features</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {
                    icon: <Settings className="w-4 h-4" />,
                    title: 'Drag & Drop',
                    description: 'Reorder widgets with intuitive drag and drop'
                  },
                  {
                    icon: <Search className="w-4 h-4" />,
                    title: 'TMDB Integration',
                    description: 'Search and select specific content from TMDB'
                  },
                  {
                    icon: <Filter className="w-4 h-4" />,
                    title: 'Genre Filtering',
                    description: 'Filter content by local and TMDB genres'
                  },
                  {
                    icon: <BarChart3 className="w-4 h-4" />,
                    title: 'Performance Monitoring',
                    description: 'Real-time widget performance analytics'
                  }
                ].map((feature, index) => (
                  <div key={index} className="text-center group">
                    <div className="w-10 h-10 bg-white/15 hover:bg-red-500/20 backdrop-blur-sm border border-white/20 hover:border-red-400/30 rounded-xl flex items-center justify-center mx-auto mb-3 transition-all duration-200">
                      <div className="text-white/90 group-hover:text-red-200 transition-colors">
                        {feature.icon}
                      </div>
                    </div>
                    <h4 className="font-medium text-white/95 mb-1">{feature.title}</h4>
                    <p className="text-xs text-white/75">{feature.description}</p>
                  </div>
                ))}
              </div>
              
              {/* New Notification Widget Feature */}
              <div className="mt-6 p-4 bg-gradient-to-r from-red-500/10 to-red-600/10 border border-red-400/20 rounded-xl">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-red-500/20 backdrop-blur-sm border border-red-400/30 rounded-lg flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-red-200" />
                  </div>
                  <h4 className="font-semibold text-red-200">New: Smart Notification Widget</h4>
                </div>
                <p className="text-sm text-red-200/80 mb-3">
                  Display real-time notifications for new content, TMDB updates, trending movies, and personalized recommendations with beautiful cinematic presentation.
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    'TMDB Integration',
                    'Auto-scroll',
                    'Trailer Playback',
                    'Smart Curation',
                    'Multiple Types'
                  ].map((tag) => (
                    <span key={tag} className="px-2 py-1 bg-red-500/20 border border-red-400/30 rounded text-xs text-red-200">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {viewMode === 'edit' && (
          <motion.div
            key="edit"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {/* Header with Back Button */}
            <div className="flex items-center gap-4">
              <button
                onClick={handleBackToOverview}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/15 backdrop-blur-sm border border-white/20 text-white rounded-xl transition-all duration-200"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-red-500/20 to-red-600/20 backdrop-blur-sm border border-red-400/20 rounded-xl flex items-center justify-center">
                    {pages.find(p => p.id === selectedPage)?.icon}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">
                      {pages.find(p => p.id === selectedPage)?.name}
                    </h2>
                    <p className="text-sm text-white/60">
                      {pages.find(p => p.id === selectedPage)?.description}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Full-width Widget Configuration */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
              <EnhancedWidgetConfigPanel
                page={selectedPage}
                isOpen={true}
                onClose={handleBackToOverview}
                onWidgetsChange={() => {
                  console.log('Widgets updated for page:', selectedPage);
                }}
                embedded={true}
              />
            </div>
          </motion.div>
        )}

        {viewMode === 'performance' && (
          <motion.div
            key="performance"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {/* Header with Back Button */}
            <div className="flex items-center gap-4">
              <button
                onClick={handleBackToOverview}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/15 backdrop-blur-sm border border-white/20 text-white rounded-xl transition-all duration-200"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-red-500/20 to-red-600/20 backdrop-blur-sm border border-red-400/20 rounded-xl flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-red-200" />
                  </div>
                  Performance Dashboard
                </h2>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}