"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Media } from '@/types/media';
import { cleanMovieTitle } from '@/lib/titleUtils';

interface GenreTitleProps {
  media: Media;
  className?: string;
}

const GenreTitle: React.FC<GenreTitleProps> = ({ media, className = "" }) => {
  const title = cleanMovieTitle(media.title);
  const primaryGenre = media.genres?.[0]?.name?.toLowerCase() || 'drama';
  
  // Calculate responsive font size based on title length
  const getTitleSize = (titleLength: number) => {
    if (titleLength > 30) return 'text-2xl md:text-4xl lg:text-5xl xl:text-6xl';
    if (titleLength > 20) return 'text-3xl md:text-5xl lg:text-6xl xl:text-7xl';
    if (titleLength > 15) return 'text-4xl md:text-6xl lg:text-7xl xl:text-8xl';
    return 'text-4xl md:text-6xl lg:text-7xl xl:text-8xl';
  };
  
  const titleSizeClass = getTitleSize(title.length);

  const getGenreStyle = (genre: string) => {
    switch (genre) {
      case 'action':
        return {
          gradient: 'from-red-600 via-orange-500 to-yellow-400',
          shadow: 'drop-shadow-[0_0_30px_rgba(239,68,68,0.8)]',
          textShadow: '0 0 20px rgba(239,68,68,0.8), 0 0 40px rgba(239,68,68,0.6)',
          border: 'border-red-500/50',
          glow: 'shadow-[0_0_50px_rgba(239,68,68,0.4)]'
        };
      case 'horror':
        return {
          gradient: 'from-red-900 via-red-700 to-black',
          shadow: 'drop-shadow-[0_0_30px_rgba(127,29,29,0.9)]',
          textShadow: '0 0 20px rgba(127,29,29,0.9), 0 0 40px rgba(127,29,29,0.7)',
          border: 'border-red-900/70',
          glow: 'shadow-[0_0_50px_rgba(127,29,29,0.6)]'
        };
      case 'sci-fi':
      case 'science fiction':
        return {
          gradient: 'from-cyan-400 via-blue-500 to-purple-600',
          shadow: 'drop-shadow-[0_0_30px_rgba(34,211,238,0.8)]',
          textShadow: '0 0 20px rgba(34,211,238,0.8), 0 0 40px rgba(34,211,238,0.6)',
          border: 'border-cyan-400/50',
          glow: 'shadow-[0_0_50px_rgba(34,211,238,0.4)]'
        };
      case 'fantasy':
        return {
          gradient: 'from-purple-600 via-pink-500 to-rose-400',
          shadow: 'drop-shadow-[0_0_30px_rgba(147,51,234,0.8)]',
          textShadow: '0 0 20px rgba(147,51,234,0.8), 0 0 40px rgba(147,51,234,0.6)',
          border: 'border-purple-500/50',
          glow: 'shadow-[0_0_50px_rgba(147,51,234,0.4)]'
        };
      case 'comedy':
        return {
          gradient: 'from-yellow-400 via-orange-400 to-red-400',
          shadow: 'drop-shadow-[0_0_30px_rgba(251,191,36,0.8)]',
          textShadow: '0 0 20px rgba(251,191,36,0.8), 0 0 40px rgba(251,191,36,0.6)',
          border: 'border-yellow-400/50',
          glow: 'shadow-[0_0_50px_rgba(251,191,36,0.4)]'
        };
      case 'thriller':
        return {
          gradient: 'from-gray-800 via-red-800 to-black',
          shadow: 'drop-shadow-[0_0_30px_rgba(55,65,81,0.9)]',
          textShadow: '0 0 20px rgba(55,65,81,0.9), 0 0 40px rgba(55,65,81,0.7)',
          border: 'border-gray-600/70',
          glow: 'shadow-[0_0_50px_rgba(55,65,81,0.6)]'
        };
      case 'romance':
        return {
          gradient: 'from-pink-500 via-rose-400 to-red-400',
          shadow: 'drop-shadow-[0_0_30px_rgba(236,72,153,0.8)]',
          textShadow: '0 0 20px rgba(236,72,153,0.8), 0 0 40px rgba(236,72,153,0.6)',
          border: 'border-pink-400/50',
          glow: 'shadow-[0_0_50px_rgba(236,72,153,0.4)]'
        };
      case 'documentary':
        return {
          gradient: 'from-green-600 via-teal-500 to-blue-500',
          shadow: 'drop-shadow-[0_0_30px_rgba(34,197,94,0.8)]',
          textShadow: '0 0 20px rgba(34,197,94,0.8), 0 0 40px rgba(34,197,94,0.6)',
          border: 'border-green-500/50',
          glow: 'shadow-[0_0_50px_rgba(34,197,94,0.4)]'
        };
      case 'animation':
        return {
          gradient: 'from-indigo-500 via-purple-500 to-pink-500',
          shadow: 'drop-shadow-[0_0_30px_rgba(99,102,241,0.8)]',
          textShadow: '0 0 20px rgba(99,102,241,0.8), 0 0 40px rgba(99,102,241,0.6)',
          border: 'border-indigo-400/50',
          glow: 'shadow-[0_0_50px_rgba(99,102,241,0.4)]'
        };
      case 'crime':
        return {
          gradient: 'from-gray-900 via-red-900 to-yellow-600',
          shadow: 'drop-shadow-[0_0_30px_rgba(17,24,39,0.9)]',
          textShadow: '0 0 20px rgba(17,24,39,0.9), 0 0 40px rgba(17,24,39,0.7)',
          border: 'border-gray-700/70',
          glow: 'shadow-[0_0_50px_rgba(17,24,39,0.6)]'
        };
      case 'mystery':
        return {
          gradient: 'from-indigo-900 via-purple-800 to-gray-800',
          shadow: 'drop-shadow-[0_0_30px_rgba(55,48,163,0.8)]',
          textShadow: '0 0 20px rgba(55,48,163,0.8), 0 0 40px rgba(55,48,163,0.6)',
          border: 'border-indigo-600/50',
          glow: 'shadow-[0_0_50px_rgba(55,48,163,0.4)]'
        };
      default: // drama
        return {
          gradient: 'from-blue-600 via-indigo-600 to-purple-600',
          shadow: 'drop-shadow-[0_0_30px_rgba(37,99,235,0.8)]',
          textShadow: '0 0 20px rgba(37,99,235,0.8), 0 0 40px rgba(37,99,235,0.6)',
          border: 'border-blue-500/50',
          glow: 'shadow-[0_0_50px_rgba(37,99,235,0.4)]'
        };
    }
  };

  const style = getGenreStyle(primaryGenre);

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className={`relative ${className}`}
    >
      {/* Background Glow Effect */}
      <div 
        className={`absolute inset-0 bg-gradient-to-r ${style.gradient} opacity-20 blur-3xl ${style.glow}`}
        style={{ transform: 'scale(1.2)' }}
      />
      
      {/* Main Title */}
      <motion.h1
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
        className={`
          relative ${titleSizeClass}
          font-black text-transparent bg-clip-text 
          bg-gradient-to-r ${style.gradient}
          ${style.shadow}
          tracking-tight leading-none
          ${style.border}
          break-words hyphens-auto
          max-w-full overflow-hidden
        `}
        style={{ 
          textShadow: style.textShadow,
          WebkitTextStroke: '1px rgba(255,255,255,0.1)',
          wordBreak: 'break-word',
          overflowWrap: 'break-word'
        }}
      >
        {title}
      </motion.h1>

      {/* Animated Underline */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 1.2, ease: "easeOut", delay: 0.5 }}
        className={`
          h-1 md:h-2 mt-4 bg-gradient-to-r ${style.gradient} 
          ${style.glow} origin-left
        `}
      />

      {/* Genre Badge - Only show if not unknown */}
      {primaryGenre !== 'unknown' && (
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.8 }}
          className={`
            inline-block mt-4 px-4 py-2 
            bg-gradient-to-r ${style.gradient} 
            text-white text-sm font-bold uppercase tracking-wider
            rounded-full ${style.glow}
            border ${style.border}
          `}
        >
          {primaryGenre}
        </motion.div>
      )}

      {/* Floating Particles Effect */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className={`absolute w-2 h-2 bg-gradient-to-r ${style.gradient} rounded-full opacity-60`}
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -20, 0],
              opacity: [0.6, 1, 0.6],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>
    </motion.div>
  );
};

export default GenreTitle;
