"use client";

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Media } from '../types/media';

interface DynamicTitleProps {
  media: Media;
  className?: string;
}

const DynamicTitle: React.FC<DynamicTitleProps> = ({ media, className = "" }) => {
  const titleStyle = useMemo(() => {
    const genres = media.genre_names || media.genres?.map(g => g.name) || [];
    const primaryGenre = genres[0]?.toLowerCase() || 'default';
    const title = media.title || '';
    const titleLength = title.length;
    
    // Define style configurations based on genre and title characteristics
    const styleConfigs = {
      action: {
        gradient: 'from-red-500 via-orange-500 to-yellow-500',
        shadow: 'drop-shadow-[0_0_20px_rgba(255,69,0,0.8)]',
        animation: 'pulse',
        letterSpacing: 'tracking-wider',
        transform: 'skew-x-[-5deg]',
        border: 'border-2 border-red-500/50',
        glow: 'shadow-[0_0_30px_rgba(255,69,0,0.6)]'
      },
      horror: {
        gradient: 'from-red-900 via-black to-red-900',
        shadow: 'drop-shadow-[0_0_25px_rgba(139,0,0,1)]',
        animation: 'flicker',
        letterSpacing: 'tracking-widest',
        transform: '',
        border: 'border border-red-900',
        glow: 'shadow-[0_0_40px_rgba(139,0,0,0.8)]'
      },
      'sci-fi': {
        gradient: 'from-cyan-400 via-blue-500 to-purple-600',
        shadow: 'drop-shadow-[0_0_20px_rgba(0,255,255,0.8)]',
        animation: 'neon-flicker',
        letterSpacing: 'tracking-wide',
        transform: '',
        border: 'border border-cyan-400/70',
        glow: 'shadow-[0_0_35px_rgba(0,255,255,0.7)]'
      },
      fantasy: {
        gradient: 'from-purple-500 via-pink-500 to-gold-400',
        shadow: 'drop-shadow-[0_0_25px_rgba(147,51,234,0.8)]',
        animation: 'magical-glow',
        letterSpacing: 'tracking-wide',
        transform: '',
        border: 'border border-purple-500/60',
        glow: 'shadow-[0_0_30px_rgba(147,51,234,0.6)]'
      },
      comedy: {
        gradient: 'from-yellow-400 via-orange-400 to-pink-500',
        shadow: 'drop-shadow-[0_0_15px_rgba(255,193,7,0.8)]',
        animation: 'bounce',
        letterSpacing: 'tracking-normal',
        transform: 'rotate-1',
        border: 'border border-yellow-400/50',
        glow: 'shadow-[0_0_25px_rgba(255,193,7,0.5)]'
      },
      drama: {
        gradient: 'from-slate-300 via-white to-slate-300',
        shadow: 'drop-shadow-[0_0_20px_rgba(255,255,255,0.6)]',
        animation: 'subtle-glow',
        letterSpacing: 'tracking-wide',
        transform: '',
        border: 'border border-white/40',
        glow: 'shadow-[0_0_20px_rgba(255,255,255,0.4)]'
      },
      thriller: {
        gradient: 'from-gray-800 via-red-800 to-black',
        shadow: 'drop-shadow-[0_0_20px_rgba(220,38,127,0.8)]',
        animation: 'thriller-pulse',
        letterSpacing: 'tracking-wider',
        transform: '',
        border: 'border border-red-800/60',
        glow: 'shadow-[0_0_30px_rgba(220,38,127,0.6)]'
      },
      romance: {
        gradient: 'from-pink-400 via-rose-400 to-red-400',
        shadow: 'drop-shadow-[0_0_20px_rgba(244,114,182,0.8)]',
        animation: 'heart-beat',
        letterSpacing: 'tracking-wide',
        transform: '',
        border: 'border border-pink-400/50',
        glow: 'shadow-[0_0_25px_rgba(244,114,182,0.5)]'
      },
      animation: {
        gradient: 'from-blue-400 via-purple-500 to-pink-500',
        shadow: 'drop-shadow-[0_0_20px_rgba(168,85,247,0.8)]',
        animation: 'rainbow-shift',
        letterSpacing: 'tracking-normal',
        transform: '',
        border: 'border border-purple-500/50',
        glow: 'shadow-[0_0_30px_rgba(168,85,247,0.6)]'
      },
      default: {
        gradient: 'from-white via-gray-100 to-white',
        shadow: 'drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]',
        animation: 'default-glow',
        letterSpacing: 'tracking-wide',
        transform: '',
        border: 'border border-white/30',
        glow: 'shadow-[0_0_20px_rgba(255,255,255,0.3)]'
      }
    };

    // Select style based on primary genre
    const selectedStyle = styleConfigs[primaryGenre as keyof typeof styleConfigs] || styleConfigs.default;

    // Adjust font size based on title length
    let fontSize = 'text-5xl md:text-7xl';
    if (titleLength > 20) fontSize = 'text-4xl md:text-6xl';
    if (titleLength > 30) fontSize = 'text-3xl md:text-5xl';
    if (titleLength > 40) fontSize = 'text-2xl md:text-4xl';

    return {
      ...selectedStyle,
      fontSize,
      primaryGenre
    };
  }, [media]);

  const getAnimationProps = () => {
    return {
      initial: { opacity: 0, y: 50, scale: 0.9 },
      animate: { opacity: 1, y: 0, scale: 1 },
      exit: { opacity: 0, y: -30, scale: 0.95 },
      transition: { duration: 0.8 }
    };
  };

  const getAnimationStyle = () => {
    switch (titleStyle.animation) {
      case 'pulse':
        return {
          animation: 'pulse 2s ease-in-out infinite'
        };
      case 'flicker':
        return {
          animation: 'flicker 3s ease-in-out infinite'
        };
      case 'bounce':
        return {
          animation: 'bounce 2s ease-in-out infinite'
        };
      default:
        return {};
    }
  };

  const renderStyledTitle = () => {
    const words = media.title.split(' ');
    
    // For action movies, create a more dramatic split effect
    if (titleStyle.primaryGenre === 'action' && words.length > 1) {
      return (
        <div className="flex flex-col items-start">
          {words.map((word, index) => (
            <motion.span
              key={index}
              initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1, duration: 0.8 }}
              className={`block ${index === 0 ? 'text-6xl md:text-8xl' : 'text-4xl md:text-6xl'} ${titleStyle.transform}`}
            >
              {word}
            </motion.span>
          ))}
        </div>
      );
    }

    // For horror movies, create a creepy letter-by-letter effect
    if (titleStyle.primaryGenre === 'horror') {
      return (
        <div className="flex flex-wrap">
          {media.title.split('').map((char, index) => (
            <motion.span
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.3 }}
              className={char === ' ' ? 'w-4' : ''}
            >
              {char}
            </motion.span>
          ))}
        </div>
      );
    }

    // Default single title rendering
    return <span>{media.title}</span>;
  };

  return (
    <>
      {/* CSS Animations */}
      <style jsx>{`
        @keyframes flicker {
          0%, 100% { opacity: 1; }
          25% { opacity: 0.8; }
          50% { opacity: 1; }
          75% { opacity: 0.9; }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
      `}</style>
      
      <div className={`relative ${className}`}>
        {/* Background glow effect */}
        <div 
          className={`absolute inset-0 bg-gradient-to-r ${titleStyle.gradient} opacity-20 blur-xl rounded-lg ${titleStyle.glow}`}
        />
      
      {/* Main title */}
      <motion.h1
        {...getAnimationProps()}
        className={`
          relative z-10 font-bold bg-gradient-to-r ${titleStyle.gradient} bg-clip-text text-transparent
          ${titleStyle.fontSize} ${titleStyle.letterSpacing} ${titleStyle.shadow}
          ${titleStyle.transform} ${titleStyle.border} p-4 rounded-lg backdrop-blur-sm
        `}
        style={{
          fontFamily: titleStyle.primaryGenre === 'horror' ? 'serif' : 
                     titleStyle.primaryGenre === 'sci-fi' ? 'monospace' :
                     titleStyle.primaryGenre === 'fantasy' ? 'serif' : 'sans-serif',
          ...getAnimationStyle()
        }}
      >
        {renderStyledTitle()}
      </motion.h1>

      {/* Genre indicator */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5 }}
        className="absolute -top-2 -right-2 z-20"
      >
        <span className={`
          px-2 py-1 text-xs font-bold rounded-full bg-gradient-to-r ${titleStyle.gradient}
          text-black shadow-lg
        `}>
          {titleStyle.primaryGenre.toUpperCase()}
        </span>
      </motion.div>

      {/* Decorative elements based on genre */}
      {titleStyle.primaryGenre === 'action' && (
        <motion.div
          className="absolute -inset-4 border-2 border-red-500/30 rounded-lg"
          animate={{
            borderColor: ['rgba(239,68,68,0.3)', 'rgba(239,68,68,0.6)', 'rgba(239,68,68,0.3)']
          }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}

      {titleStyle.primaryGenre === 'sci-fi' && (
        <>
          <motion.div
            className="absolute -top-1 -left-1 w-4 h-4 bg-cyan-400 rounded-full"
            animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <motion.div
            className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 rounded-full"
            animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
            transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
          />
        </>
      )}

      {titleStyle.primaryGenre === 'fantasy' && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          animate={{
            background: [
              'radial-gradient(circle at 20% 20%, rgba(147,51,234,0.1) 0%, transparent 50%)',
              'radial-gradient(circle at 80% 80%, rgba(236,72,153,0.1) 0%, transparent 50%)',
              'radial-gradient(circle at 20% 20%, rgba(147,51,234,0.1) 0%, transparent 50%)'
            ]
          }}
          transition={{ duration: 4, repeat: Infinity }}
        />
      )}
      </div>
    </>
  );
};

export default DynamicTitle;
