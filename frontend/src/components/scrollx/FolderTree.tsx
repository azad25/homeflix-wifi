"use client";

import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, File, Film, Tv } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface TreeNode {
  id: string;
  name: string;
  type: 'folder' | 'file' | 'media';
  children?: TreeNode[];
  metadata?: {
    mediaType?: 'movie' | 'episode';
    size?: number;
    duration?: number;
  };
}

interface FolderTreeProps {
  data: TreeNode[];
  onSelect?: (node: TreeNode) => void;
  selectedId?: string;
  className?: string;
}

const FolderTree: React.FC<FolderTreeProps> = ({ 
  data, 
  onSelect, 
  selectedId,
  className = '' 
}) => {
  return (
    <div className={`folder-tree ${className}`}>
      {data.map((node) => (
        <TreeNodeComponent
          key={node.id}
          node={node}
          level={0}
          onSelect={onSelect}
          selectedId={selectedId}
        />
      ))}
    </div>
  );
};

interface TreeNodeComponentProps {
  node: TreeNode;
  level: number;
  onSelect?: (node: TreeNode) => void;
  selectedId?: string;
}

const TreeNodeComponent: React.FC<TreeNodeComponentProps> = ({
  node,
  level,
  onSelect,
  selectedId,
}) => {
  const [isOpen, setIsOpen] = useState(level === 0);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedId === node.id;

  const handleClick = () => {
    if (hasChildren) {
      setIsOpen(!isOpen);
    }
    if (onSelect) {
      onSelect(node);
    }
  };

  const getIcon = () => {
    if (node.type === 'folder') {
      return isOpen ? (
        <FolderOpen className="w-4 h-4 text-yellow-500" />
      ) : (
        <Folder className="w-4 h-4 text-yellow-600" />
      );
    }
    if (node.type === 'media') {
      return node.metadata?.mediaType === 'movie' ? (
        <Film className="w-4 h-4 text-blue-500" />
      ) : (
        <Tv className="w-4 h-4 text-purple-500" />
      );
    }
    return <File className="w-4 h-4 text-gray-400" />;
  };

  return (
    <div className="select-none">
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
        className={`flex items-center gap-2 py-2 px-3 rounded-lg cursor-pointer transition-all ${
          isSelected
            ? 'bg-blue-600/20 border border-blue-500/50'
            : 'hover:bg-white/5 border border-transparent'
        }`}
        style={{ paddingLeft: `${level * 20 + 12}px` }}
        onClick={handleClick}
      >
        {hasChildren && (
          <motion.div
            animate={{ rotate: isOpen ? 90 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </motion.div>
        )}
        {!hasChildren && <div className="w-4" />}
        
        {getIcon()}
        
        <span className={`text-sm flex-1 ${isSelected ? 'text-white font-medium' : 'text-gray-300'}`}>
          {node.name}
        </span>

        {node.metadata?.duration && (
          <span className="text-xs text-gray-500">
            {Math.floor(node.metadata.duration / 60)}m
          </span>
        )}
      </motion.div>

      <AnimatePresence>
        {isOpen && hasChildren && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            {node.children!.map((child) => (
              <TreeNodeComponent
                key={child.id}
                node={child}
                level={level + 1}
                onSelect={onSelect}
                selectedId={selectedId}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FolderTree;
