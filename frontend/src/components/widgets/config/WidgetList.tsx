"use client";

import React, { useState } from 'react';
import { motion, Reorder, AnimatePresence } from 'framer-motion';
import { 
  GripVertical, 
  Eye, 
  EyeOff, 
  Edit3, 
  Trash2, 
  Copy, 
  Play,
  Settings
} from 'lucide-react';
import { Widget } from '@/types/widgets';

interface WidgetListProps {
  widgets: Widget[];
  onEdit: (widget: Widget) => void;
  onDelete: (widgetId: number) => void;
  onReorder: (widgets: Widget[]) => void;
  onToggle: (widget: Widget, enabled: boolean) => void;
  onDuplicate: (widget: Widget) => void;
}

export default function WidgetList({
  widgets,
  onEdit,
  onDelete,
  onReorder,
  onToggle,
  onDuplicate
}: WidgetListProps) {
  const [draggedItem, setDraggedItem] = useState<number | null>(null);

  const getWidgetIcon = (type: string) => {
    switch (type) {
      case 'featured-banner':
        return '🎬';
      case 'trending-slideshow':
        return '🔥';
      case 'movie-grid':
        return '📱';
      case 'backdrop-slideshow':
        return '🖼️';
      case 'coming-soon':
        return '⏰';
      case 'recently-watched':
        return '👁️';
      case 'genre-based':
        return '🎭';
      case 'trailer':
        return '▶️';
      default:
        return '📺';
    }
  };

  const getDataSourceColor = (dataSource: string) => {
    switch (dataSource) {
      case 'tmdb':
        return 'from-red-500/20 to-red-600/20 border-red-400/30 text-red-200';
      case 'local':
        return 'from-red-600/20 to-red-700/20 border-red-500/30 text-red-200';
      case 'trending':
        return 'from-red-700/20 to-red-800/20 border-red-600/30 text-red-200';
      case 'popular':
        return 'from-red-800/20 to-red-900/20 border-red-700/30 text-red-200';
      default:
        return 'from-gray-500/20 to-gray-600/20 border-gray-400/30 text-gray-200';
    }
  };

  const getLayoutIcon = (layout: string) => {
    switch (layout) {
      case 'full':
        return '━━━';
      case 'half':
        return '━━';
      case 'third':
        return '━';
      default:
        return '━━━';
    }
  };

  if (widgets.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-16"
      >
        <div className="w-24 h-24 bg-gradient-to-br from-gray-500/20 to-gray-600/20 backdrop-blur-sm border border-white/10 rounded-2xl mx-auto mb-6 flex items-center justify-center">
          <Settings className="w-12 h-12 text-white/40" />
        </div>
        <h3 className="text-xl font-semibold text-white/80 mb-2">No widgets configured</h3>
        <p className="text-white/50 mb-6">Add your first widget to get started</p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white/90">
          Widgets ({widgets.length})
        </h3>
        <div className="text-sm text-white/50">
          Drag to reorder • Click to edit
        </div>
      </div>

      <Reorder.Group
        axis="y"
        values={widgets}
        onReorder={onReorder}
        className="space-y-3"
      >
        <AnimatePresence>
          {widgets.map((widget) => (
            <Reorder.Item
              key={widget.id}
              value={widget}
              onDragStart={() => setDraggedItem(widget.id)}
              onDragEnd={() => setDraggedItem(null)}
              className="cursor-grab active:cursor-grabbing"
            >
              <motion.div
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ 
                  opacity: 1, 
                  y: 0,
                  scale: draggedItem === widget.id ? 1.02 : 1,
                  rotateZ: draggedItem === widget.id ? 1 : 0
                }}
                exit={{ opacity: 0, y: -20 }}
                whileHover={{ scale: 1.01 }}
                className={`group relative overflow-hidden rounded-xl transition-all duration-200 ${
                  widget.enabled 
                    ? 'bg-white/5 backdrop-blur-sm border border-white/10 hover:border-white/20' 
                    : 'bg-white/2 backdrop-blur-sm border border-white/5 opacity-60'
                }`}
              >
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/2 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                <div className="relative p-4">
                  <div className="flex items-center gap-4">
                    {/* Drag handle */}
                    <div className="flex-shrink-0 p-2 text-white/40 hover:text-white/60 transition-colors">
                      <GripVertical className="w-5 h-5" />
                    </div>

                    {/* Widget icon and info */}
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-12 h-12 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/10 rounded-xl flex items-center justify-center text-2xl">
                        {getWidgetIcon(widget.type)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold text-white truncate">
                            {widget.name}
                          </h4>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-white/60 font-mono">
                              #{widget.position}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Widget type */}
                          <span className="px-2 py-1 bg-white/10 backdrop-blur-sm border border-white/10 rounded-lg text-xs text-white/80">
                            {widget.type.replace('-', ' ')}
                          </span>
                          
                          {/* Data source */}
                          <span className={`px-2 py-1 bg-gradient-to-r backdrop-blur-sm border rounded-lg text-xs ${getDataSourceColor(widget.dataSource)}`}>
                            {widget.dataSource}
                          </span>
                          
                          {/* Content type */}
                          <span className="px-2 py-1 bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg text-xs text-white/60">
                            {widget.contentType}
                          </span>
                          
                          {/* Layout */}
                          <span className="px-2 py-1 bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg text-xs text-white/60 font-mono">
                            {getLayoutIcon(widget.layout)} {widget.layout}
                          </span>
                          
                          {/* Max items */}
                          <span className="px-2 py-1 bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg text-xs text-white/60">
                            {widget.maxItems} items
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <button
                        onClick={() => onToggle(widget, !widget.enabled)}
                        className={`p-2 rounded-lg backdrop-blur-sm border transition-all duration-200 hover:scale-110 ${
                          widget.enabled
                            ? 'bg-red-500/20 border-red-400/30 text-red-200 hover:bg-red-500/30'
                            : 'bg-gray-500/20 border-gray-400/30 text-gray-400 hover:bg-gray-500/30'
                        }`}
                        title={widget.enabled ? 'Disable widget' : 'Enable widget'}
                      >
                        {widget.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                      
                      <button
                        onClick={() => onEdit(widget)}
                        className="p-2 bg-red-500/20 hover:bg-red-500/30 backdrop-blur-sm border border-red-400/30 text-red-200 rounded-lg transition-all duration-200 hover:scale-110"
                        title="Edit widget"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      
                      <button
                        onClick={() => onDuplicate(widget)}
                        className="p-2 bg-red-600/20 hover:bg-red-600/30 backdrop-blur-sm border border-red-500/30 text-red-200 rounded-lg transition-all duration-200 hover:scale-110"
                        title="Duplicate widget"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      
                      <button
                        onClick={() => onDelete(widget.id)}
                        className="p-2 bg-red-700/20 hover:bg-red-700/30 backdrop-blur-sm border border-red-600/30 text-red-200 rounded-lg transition-all duration-200 hover:scale-110"
                        title="Delete widget"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </Reorder.Item>
          ))}
        </AnimatePresence>
      </Reorder.Group>
    </div>
  );
}