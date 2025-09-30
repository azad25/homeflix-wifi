"use client";

import React from 'react';
import { motion } from 'framer-motion';

interface QualityBadgeProps {
  quality?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const QualityBadge: React.FC<QualityBadgeProps> = ({ 
  quality, 
  className = "", 
  size = 'md' 
}) => {
  if (!quality) return null;

  const normalizedQuality = quality.toUpperCase();
  
  const getQualityConfig = (qual: string) => {
    switch (qual) {
      case '4K':
      case '2160P':
        return {
          label: '4K',
          gradient: 'from-purple-600 via-blue-600 to-cyan-500',
          shadow: 'shadow-[0_0_20px_rgba(147,51,234,0.6)]',
          border: 'border-purple-500/70',
          glow: 'drop-shadow-[0_0_10px_rgba(147,51,234,0.8)]'
        };
      case 'HDR':
      case 'HDR10':
      case 'DOLBY VISION':
        return {
          label: 'HDR',
          gradient: 'from-yellow-500 via-orange-500 to-red-500',
          shadow: 'shadow-[0_0_20px_rgba(251,191,36,0.6)]',
          border: 'border-yellow-500/70',
          glow: 'drop-shadow-[0_0_10px_rgba(251,191,36,0.8)]'
        };
      case 'HD':
      case '1080P':
      case 'FULL HD':
        return {
          label: 'HD',
          gradient: 'from-green-500 via-emerald-500 to-teal-500',
          shadow: 'shadow-[0_0_15px_rgba(34,197,94,0.6)]',
          border: 'border-green-500/70',
          glow: 'drop-shadow-[0_0_8px_rgba(34,197,94,0.8)]'
        };
      case '720P':
      case 'HD READY':
        return {
          label: '720p',
          gradient: 'from-blue-500 via-indigo-500 to-purple-500',
          shadow: 'shadow-[0_0_15px_rgba(59,130,246,0.6)]',
          border: 'border-blue-500/70',
          glow: 'drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]'
        };
      case 'SD':
      case '480P':
      case 'STANDARD':
        return {
          label: 'SD',
          gradient: 'from-gray-500 via-slate-500 to-zinc-500',
          shadow: 'shadow-[0_0_10px_rgba(107,114,128,0.6)]',
          border: 'border-gray-500/70',
          glow: 'drop-shadow-[0_0_6px_rgba(107,114,128,0.8)]'
        };
      case 'IMAX':
        return {
          label: 'IMAX',
          gradient: 'from-amber-500 via-yellow-500 to-orange-500',
          shadow: 'shadow-[0_0_25px_rgba(245,158,11,0.8)]',
          border: 'border-amber-500/70',
          glow: 'drop-shadow-[0_0_12px_rgba(245,158,11,1)]'
        };
      case 'DOLBY ATMOS':
        return {
          label: 'ATMOS',
          gradient: 'from-indigo-600 via-purple-600 to-pink-600',
          shadow: 'shadow-[0_0_20px_rgba(129,140,248,0.6)]',
          border: 'border-indigo-500/70',
          glow: 'drop-shadow-[0_0_10px_rgba(129,140,248,0.8)]'
        };
      default:
        return {
          label: qual,
          gradient: 'from-slate-600 via-gray-600 to-zinc-600',
          shadow: 'shadow-[0_0_10px_rgba(71,85,105,0.6)]',
          border: 'border-slate-500/70',
          glow: 'drop-shadow-[0_0_6px_rgba(71,85,105,0.8)]'
        };
    }
  };

  const getSizeClasses = (size: string) => {
    switch (size) {
      case 'sm':
        return {
          container: 'px-2 py-1',
          text: 'text-xs',
          border: 'border'
        };
      case 'lg':
        return {
          container: 'px-4 py-2',
          text: 'text-base',
          border: 'border-2'
        };
      default: // md
        return {
          container: 'px-3 py-1.5',
          text: 'text-sm',
          border: 'border'
        };
    }
  };

  const config = getQualityConfig(normalizedQuality);
  const sizeClasses = getSizeClasses(size);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.05 }}
      className={`
        inline-flex items-center justify-center
        ${sizeClasses.container} ${sizeClasses.border} ${config.border}
        bg-gradient-to-r ${config.gradient}
        rounded-lg font-bold text-white
        ${config.shadow} ${config.glow}
        backdrop-blur-sm
        transition-all duration-200
        ${className}
      `}
    >
      <span className={`${sizeClasses.text} font-extrabold tracking-wide`}>
        {config.label}
      </span>
      
      {/* Animated shine effect */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-lg"
        animate={{
          x: ['-100%', '100%']
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          repeatDelay: 3,
          ease: "easeInOut"
        }}
        style={{ clipPath: 'inset(0)' }}
      />
    </motion.div>
  );
};

export default QualityBadge;
