"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { 
  Monitor, 
  Volume2, 
  Zap, 
  Film, 
  Disc, 
  Settings, 
  Star, 
  Award,
  Eye,
  Sparkles,
  Crown,
  Shield,
  Headphones,
  Radio,
  Camera,
  Video
} from 'lucide-react';

interface QualityTagsProps {
  tags: string[];
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'compact' | 'hero';
}

// Get the appropriate icon for a quality tag
const getQualityTagIcon = (tag: string) => {
  const upperTag = tag.toUpperCase();
  
  switch (upperTag) {
    case '4K':
    case 'UHD':
      return <Monitor className="w-3 h-3" />;
    
    case 'HDR':
    case 'HDR10':
    case 'HDR10+':
      return <Sparkles className="w-3 h-3" />;
    
    case 'DOLBY VISION':
      return <Eye className="w-3 h-3" />;
    
    case 'DOLBY ATMOS':
    case 'DOLBY':
      return <Volume2 className="w-3 h-3" />;
    
    case 'DTS:X':
    case 'DTS-HD':
    case 'DTS':
      return <Headphones className="w-3 h-3" />;
    
    case 'TRUEHD':
    case 'DD+':
    case 'AAC':
      return <Radio className="w-3 h-3" />;
    
    case 'IMAX':
      return <Crown className="w-3 h-3" />;
    
    case 'REMUX':
      return <Shield className="w-3 h-3" />;
    
    case 'BLU-RAY':
    case 'BLURAY':
      return <Disc className="w-3 h-3" />;
    
    case 'HEVC':
    case 'H.264':
    case 'AV1':
    case 'VP9':
      return <Settings className="w-3 h-3" />;
    
    case 'WEB-DL':
    case 'WEB':
    case 'WEBRIP':
      return <Zap className="w-3 h-3" />;
    
    case 'HD':
      return <Video className="w-3 h-3" />;
    
    case 'EXTENDED':
    case 'UNCUT':
    case 'REMASTERED':
    case 'CRITERION':
      return <Award className="w-3 h-3" />;
    
    default:
      return <Film className="w-3 h-3" />;
  }
};
// Get the appropriate color class for a quality tag (Transparent Netflix-style)
const getQualityTagColor = (tag: string): string => {
  const upperTag = tag.toUpperCase();
  
  switch (upperTag) {
    case '4K':
    case 'UHD':
      return 'bg-purple-500/20 text-purple-300 border-purple-400/30 hover:bg-purple-500/30 hover:border-purple-400/50';
    
    case 'HDR':
    case 'HDR10':
    case 'HDR10+':
    case 'DOLBY VISION':
      return 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30 hover:bg-yellow-500/30 hover:border-yellow-400/50';
    
    case 'DOLBY ATMOS':
    case 'DTS:X':
    case 'TRUEHD':
    case 'DOLBY':
      return 'bg-blue-500/20 text-blue-300 border-blue-400/30 hover:bg-blue-500/30 hover:border-blue-400/50';
    
    case 'IMAX':
      return 'bg-red-500/20 text-red-300 border-red-400/30 hover:bg-red-500/30 hover:border-red-400/50';
    
    case 'REMUX':
    case 'BLU-RAY':
    case 'BLURAY':
      return 'bg-green-500/20 text-green-300 border-green-400/30 hover:bg-green-500/30 hover:border-green-400/50';
    
    case 'HEVC':
    case 'AV1':
    case 'H.264':
    case 'VP9':
      return 'bg-indigo-500/20 text-indigo-300 border-indigo-400/30 hover:bg-indigo-500/30 hover:border-indigo-400/50';
    
    case 'WEB-DL':
    case 'WEB':
    case 'WEBRIP':
      return 'bg-cyan-500/20 text-cyan-300 border-cyan-400/30 hover:bg-cyan-500/30 hover:border-cyan-400/50';
    
    case 'HD':
      return 'bg-gray-500/20 text-gray-300 border-gray-400/30 hover:bg-gray-500/30 hover:border-gray-400/50';
    
    case 'EXTENDED':
    case 'UNCUT':
    case 'REMASTERED':
    case 'CRITERION':
      return 'bg-amber-500/20 text-amber-300 border-amber-400/30 hover:bg-amber-500/30 hover:border-amber-400/50';
    
    case 'DTS-HD':
    case 'DTS':
      return 'bg-teal-500/20 text-teal-300 border-teal-400/30 hover:bg-teal-500/30 hover:border-teal-400/50';
    
    case 'DD+':
    case 'AAC':
      return 'bg-orange-500/20 text-orange-300 border-orange-400/30 hover:bg-orange-500/30 hover:border-orange-400/50';
    
    default:
      return 'bg-white/10 text-white/80 border-white/20 hover:bg-white/20 hover:border-white/30';
  }
};

// Get size classes based on variant
const getSizeClasses = (size: 'sm' | 'md' | 'lg', variant: 'default' | 'compact' | 'hero') => {
  if (variant === 'compact') {
    return {
      container: 'gap-1',
      tag: 'px-1.5 py-0.5 text-xs font-semibold flex items-center gap-1',
      border: 'border',
      icon: 'w-2.5 h-2.5'
    };
  }
  
  if (variant === 'hero') {
    return {
      container: 'gap-2',
      tag: 'px-3 py-1.5 text-sm font-bold flex items-center gap-1.5',
      border: 'border-2',
      icon: 'w-4 h-4'
    };
  }
  
  // Default variant
  switch (size) {
    case 'sm':
      return {
        container: 'gap-1',
        tag: 'px-2 py-1 text-xs font-semibold flex items-center gap-1',
        border: 'border',
        icon: 'w-3 h-3'
      };
    case 'lg':
      return {
        container: 'gap-2',
        tag: 'px-3 py-1.5 text-sm font-bold flex items-center gap-1.5',
        border: 'border-2',
        icon: 'w-4 h-4'
      };
    default: // md
      return {
        container: 'gap-1.5',
        tag: 'px-2.5 py-1 text-xs font-semibold flex items-center gap-1',
        border: 'border',
        icon: 'w-3 h-3'
      };
  }
};

const QualityTags: React.FC<QualityTagsProps> = ({ 
  tags, 
  className = '', 
  size = 'md',
  variant = 'default'
}) => {
  if (!tags || tags.length === 0) {
    return null;
  }

  const sizeClasses = getSizeClasses(size, variant);
  
  // Limit tags to prevent UI clutter (Netflix shows max 4-5 tags)
  const displayTags = tags.slice(0, variant === 'hero' ? 6 : 4);

  return (
    <div className={`flex flex-wrap items-center ${sizeClasses.container} ${className}`}>
      {displayTags.map((tag, index) => {
        const colorClasses = getQualityTagColor(tag);
        const icon = getQualityTagIcon(tag);
        
        return (
          <motion.div
            key={`${tag}-${index}`}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ 
              duration: 0.3, 
              delay: index * 0.1,
              type: "spring",
              stiffness: 300,
              damping: 20
            }}
            whileHover={{ 
              scale: 1.05,
              transition: { duration: 0.2 }
            }}
            whileTap={{ 
              scale: 0.95,
              transition: { duration: 0.1 }
            }}
            className={`
              ${sizeClasses.tag} 
              ${sizeClasses.border}
              ${colorClasses}
              rounded-full
              backdrop-blur-md
              transition-all duration-300
              hover:scale-105
              select-none
              cursor-default
              shadow-sm
              hover:shadow-md
            `}
            title={`${tag} quality/format`}
          >
            <span className={sizeClasses.icon}>
              {icon}
            </span>
            <span>{tag}</span>
          </motion.div>
        );
      })}
      
      {/* Show "+X more" indicator if there are more tags */}
      {tags.length > displayTags.length && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ 
            duration: 0.3, 
            delay: displayTags.length * 0.1,
            type: "spring",
            stiffness: 300,
            damping: 20
          }}
          className={`
            ${sizeClasses.tag}
            ${sizeClasses.border}
            bg-black/20 text-white/70 border-white/20 hover:bg-black/30 hover:border-white/30
            rounded-full
            backdrop-blur-md
            transition-all duration-300
            hover:scale-105
            select-none
            cursor-default
            shadow-sm
            hover:shadow-md
          `}
          title={`${tags.length - displayTags.length} more quality tags: ${tags.slice(displayTags.length).join(', ')}`}
        >
          +{tags.length - displayTags.length}
        </motion.div>
      )}
    </div>
  );
};

export default QualityTags;