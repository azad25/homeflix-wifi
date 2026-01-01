"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
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
  Filter
} from 'lucide-react';
import { PageType } from '@/types/widgets';
import EnhancedWidgetConfigPanel from '@/components/widgets/EnhancedWidgetConfigPanel';
import WidgetPerformanceDashboard from '@/components/widgets/WidgetPerformanceDashboard';

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

export default function EnhancedWidgetManager({ className = '' }: EnhancedWidgetManagerProps) {
  const [selectedPage, setSelectedPage] = useState<PageType>('home');
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [showPerformance, setShowPerformance] = useState(false);

  return (
    <div className={`space-y-8 ${className}`}>
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
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowPerformance(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 backdrop-blur-sm border border-red-400/20 text-red-200 rounded-xl transition-all duration-200 hover:scale-105"
          >
            <BarChart3 className="w-4 h-4" />
            Performance
          </button>
        </div>
      </div>

      {/* Page Selection Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {pages.map((page) => (
          <motion.button
            key={page.id}
            onClick={() => {
              setSelectedPage(page.id);
              setShowConfigPanel(true);
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="group relative p-6 bg-white/5 hover:bg-white/10 backdrop-blur-sm border border-white/10 hover:border-red-400/30 rounded-2xl transition-all duration-200 text-left"
          >
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-red-600/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            <div className="relative">
              {/* Icon */}
              <div className="w-12 h-12 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/10 group-hover:border-red-400/30 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-all duration-200">
                <div className="text-white group-hover:text-red-200 transition-colors">
                  {page.icon}
                </div>
              </div>
              
              {/* Content */}
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-white group-hover:text-red-200 transition-colors">
                  {page.name}
                </h3>
                <p className="text-sm text-white/60 group-hover:text-white/80 transition-colors">
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

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.button
          onClick={() => {
            setSelectedPage('home');
            setShowConfigPanel(true);
          }}
          whileHover={{ scale: 1.02 }}
          className="p-4 bg-gradient-to-r from-red-500/20 to-red-600/20 hover:from-red-500/30 hover:to-red-600/30 backdrop-blur-sm border border-red-400/30 rounded-xl transition-all duration-200"
        >
          <div className="flex items-center gap-3">
            <Plus className="w-5 h-5 text-red-200" />
            <div className="text-left">
              <div className="font-medium text-white">Quick Add Widget</div>
              <div className="text-sm text-red-200/80">Add to home page</div>
            </div>
          </div>
        </motion.button>

        <motion.button
          onClick={() => setShowPerformance(true)}
          whileHover={{ scale: 1.02 }}
          className="p-4 bg-gradient-to-r from-red-600/20 to-red-700/20 hover:from-red-600/30 hover:to-red-700/30 backdrop-blur-sm border border-red-500/30 rounded-xl transition-all duration-200"
        >
          <div className="flex items-center gap-3">
            <BarChart3 className="w-5 h-5 text-red-200" />
            <div className="text-left">
              <div className="font-medium text-white">Performance Monitor</div>
              <div className="text-sm text-red-200/80">View widget metrics</div>
            </div>
          </div>
        </motion.button>

        <motion.button
          onClick={() => {
            // Open all pages overview
            setSelectedPage('home');
            setShowConfigPanel(true);
          }}
          whileHover={{ scale: 1.02 }}
          className="p-4 bg-gradient-to-r from-red-700/20 to-red-800/20 hover:from-red-700/30 hover:to-red-800/30 backdrop-blur-sm border border-red-600/30 rounded-xl transition-all duration-200"
        >
          <div className="flex items-center gap-3">
            <Eye className="w-5 h-5 text-red-200" />
            <div className="text-left">
              <div className="font-medium text-white">Preview Widgets</div>
              <div className="text-sm text-red-200/80">See live preview</div>
            </div>
          </div>
        </motion.button>
      </div>

      {/* Features Overview */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Enhanced Widget System Features</h3>
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
              <div className="w-10 h-10 bg-white/10 hover:bg-red-500/20 backdrop-blur-sm border border-white/10 hover:border-red-400/30 rounded-xl flex items-center justify-center mx-auto mb-3 transition-all duration-200">
                <div className="text-white group-hover:text-red-200 transition-colors">
                  {feature.icon}
                </div>
              </div>
              <h4 className="font-medium text-white mb-1">{feature.title}</h4>
              <p className="text-xs text-white/60">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Enhanced Widget Configuration Panel */}
      <EnhancedWidgetConfigPanel
        page={selectedPage}
        isOpen={showConfigPanel}
        onClose={() => setShowConfigPanel(false)}
        onWidgetsChange={() => {
          // Refresh or handle widget changes
          console.log('Widgets updated for page:', selectedPage);
        }}
      />

      {/* Performance Dashboard */}
      <WidgetPerformanceDashboard
        isOpen={showPerformance}
        onClose={() => setShowPerformance(false)}
      />
    </div>
  );
}