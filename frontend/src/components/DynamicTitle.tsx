"use client";

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Media } from '../types/media';
import { 
  getFontStyleForMedia, 
  getTitleSizeByLength, 
  generateFontClasses,
  getGenreFontStyle,
  GENRE_FONTS 
} from '../lib/fontStyles';
import { cleanMovieTitle, extractNiceTitle, isSingleWordTitle } from '../lib/titleUtils';
import ParticleSystem from './ParticleSystem';
import { getTextureEffect, TextureCSS, TextureEffects } from './TextureEffects';

interface DynamicTitleProps {
  media: Media;
  className?: string;
  variant?: 'hero' | 'card' | 'info' | 'section';
  pageType?: string;
  showGenreIndicator?: boolean;
  animated?: boolean;
  enable3D?: boolean;
  enableParticles?: boolean;
  particleIntensity?: 'low' | 'medium' | 'high';
}

const DynamicTitle: React.FC<DynamicTitleProps> = ({ 
  media, 
  className = "", 
  variant = 'hero',
  pageType = 'home',
  showGenreIndicator = true,
  animated = false,
  enable3D = true,
  enableParticles = false,
  particleIntensity = 'medium'
}) => {
  const titleStyle = useMemo(() => {
    const genres = media.genre_names || media.genres?.map(g => g.name) || [];
    const primaryGenre = genres[0] || 'drama';
    const cleanTitle = extractNiceTitle(media.title || '');
    const titleLength = cleanTitle.length;
    const isSingleWord = isSingleWordTitle(media.title || '');
    
    // Get font style from the comprehensive font system
    const fontStyle = getFontStyleForMedia(media, pageType);
    const responsiveSize = getTitleSizeByLength(cleanTitle, fontStyle);
    
    // Get 3D texture effect
    const textureEffect = enable3D ? getTextureEffect(primaryGenre, 'both') : null;
    
    // Generate additional effects based on genre
    const genreEffects = {
      action: {
        animation: 'burning-fire',
        transform: 'skew-x-[-2deg]',
        glow: 'drop-shadow-[0_0_30px_rgba(255,165,0,0.9)] drop-shadow-[0_0_60px_rgba(255,69,0,0.7)]',
        border: 'border-2 border-orange-500/40',
        textColor: 'text-orange-100'
      },
      horror: {
        animation: 'flicker',
        transform: '',
        glow: 'drop-shadow-[0_0_40px_rgba(127,29,29,0.9)]',
        border: 'border border-red-900/50'
      },
      'sci-fi': {
        animation: 'neon-pulse',
        transform: '',
        glow: 'drop-shadow-[0_0_35px_rgba(34,211,238,0.8)]',
        border: 'border border-cyan-400/50'
      },
      fantasy: {
        animation: 'magical-glow',
        transform: '',
        glow: 'drop-shadow-[0_0_30px_rgba(147,51,234,0.8)]',
        border: 'border border-purple-500/40'
      },
      comedy: {
        animation: 'bounce-subtle',
        transform: 'rotate-1',
        glow: 'drop-shadow-[0_0_25px_rgba(251,191,36,0.8)]',
        border: 'border border-yellow-400/40'
      },
      thriller: {
        animation: 'thriller-pulse',
        transform: '',
        glow: 'drop-shadow-[0_0_30px_rgba(55,65,81,0.9)]',
        border: 'border border-gray-800/60'
      },
      romance: {
        animation: 'heart-beat',
        transform: '',
        glow: 'drop-shadow-[0_0_25px_rgba(236,72,153,0.8)]',
        border: 'border border-pink-400/40'
      },
      documentary: {
        animation: 'subtle-glow',
        transform: '',
        glow: 'drop-shadow-[0_0_20px_rgba(34,197,94,0.6)]',
        border: 'border border-green-600/40'
      },
      animation: {
        animation: 'rainbow-shift',
        transform: '',
        glow: 'drop-shadow-[0_0_30px_rgba(99,102,241,0.8)]',
        border: 'border border-indigo-500/40'
      },
      crime: {
        animation: 'crime-flicker',
        transform: '',
        glow: 'drop-shadow-[0_0_30px_rgba(17,24,39,0.9)]',
        border: 'border border-gray-900/60'
      },
      mystery: {
        animation: 'mystery-fade',
        transform: '',
        glow: 'drop-shadow-[0_0_25px_rgba(55,48,163,0.8)]',
        border: 'border border-indigo-900/50'
      },
      drama: {
        animation: 'subtle-glow',
        transform: '',
        glow: 'drop-shadow-[0_0_25px_rgba(37,99,235,0.8)]',
        border: 'border border-blue-600/40'
      }
    };

    const normalizedGenre = primaryGenre.toLowerCase().replace(/\s+/g, '-');
    const effects = genreEffects[normalizedGenre as keyof typeof genreEffects] || genreEffects.drama;
    
    // Adjust size based on variant
    let variantSize = responsiveSize;
    switch (variant) {
      case 'card':
        variantSize = titleLength > 30 ? 'text-sm md:text-base' : 
                     titleLength > 20 ? 'text-base md:text-lg' : 'text-lg md:text-xl';
        break;
      case 'info':
        variantSize = titleLength > 30 ? 'text-2xl md:text-3xl' : 
                     titleLength > 20 ? 'text-3xl md:text-4xl' : 'text-4xl md:text-5xl';
        break;
      case 'section':
        variantSize = 'text-xl md:text-2xl lg:text-3xl';
        break;
    }

    return {
      primaryGenre,
      cleanTitle,
      titleLength,
      isSingleWord,
      fontStyle,
      responsiveSize,
      textureEffect,
      effects: genreEffects[primaryGenre.toLowerCase() as keyof typeof genreEffects] || genreEffects.drama
    };
  }, [media, pageType, enable3D]);

  const getAnimationProps = () => {
    // No animations - static display only
    return {};
  };

  const getAnimationStyle = () => {
    // No animations - static display only
    return {};
  };

  const renderStyledTitle = () => {
    const words = titleStyle.cleanTitle.split(' ');
    
    if (!animated) {
      return <span>{titleStyle.cleanTitle}</span>;
    }
    
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
              className={`block ${titleStyle.effects.transform}`}
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
          {titleStyle.cleanTitle.split('').map((char, index) => (
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
    return <span>{titleStyle.cleanTitle}</span>;
  };

  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = React.useState({ width: 800, height: 200 });

  React.useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width || 800, height: rect.height || 200 });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  return (
    <>
      <TextureCSS />
      
      <div ref={containerRef} className={`relative ${className}`}>
      
        {/* Main title with transparent texture effects and deep/light colors for readability */}
        {enable3D ? (
          <TextureEffects 
            genre={titleStyle.primaryGenre} 
            effectType="both"
            isSingleWord={titleStyle.isSingleWord}
            className={`
              relative z-20 font-bold
              ${titleStyle.responsiveSize} ${titleStyle.fontStyle.letterSpacing}
              ${titleStyle.primaryGenre.toLowerCase() === 'action' ? 'text-orange-100' : ''}
              leading-tight max-w-full
              ${variant === 'hero' ? 'line-clamp-2' : 'line-clamp-2'}
              drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]
              filter contrast-125 brightness-110
              ${titleStyle.primaryGenre.toLowerCase() === 'action' ? 'burning-fire-effect' : ''}
            `}
          >
            <span
              style={{
                fontFamily: titleStyle.fontStyle.fontFamily.replace(/"/g, ''),
                fontWeight: titleStyle.fontStyle.fontWeight,
                lineHeight: titleStyle.fontStyle.lineHeight.replace('leading-', ''),
                textTransform: (titleStyle.fontStyle.textTransform as any) || 'none',
                ...getAnimationStyle()
              }}
            >
              {renderStyledTitle()}
            </span>
          </TextureEffects>
        ) : (
          <h1
            className={`
              relative z-20 font-bold
              ${titleStyle.primaryGenre.toLowerCase() === 'action' ? 'text-orange-100' : `bg-gradient-to-r ${titleStyle.fontStyle.color.replace('bg-gradient-to-r ', '')} bg-clip-text text-transparent`}
              ${titleStyle.responsiveSize} ${titleStyle.fontStyle.letterSpacing}
              ${titleStyle.effects.glow}
              ${titleStyle.effects.transform} 
              leading-tight max-w-full
              ${variant === 'hero' ? 'line-clamp-2' : 'line-clamp-2'}
              drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]
              filter contrast-125 brightness-110
              ${titleStyle.primaryGenre.toLowerCase() === 'action' ? 'burning-fire-effect' : ''}
            `}
            style={{
              fontFamily: titleStyle.fontStyle.fontFamily.replace(/"/g, ''),
              fontWeight: titleStyle.fontStyle.fontWeight,
              lineHeight: titleStyle.fontStyle.lineHeight.replace('leading-', ''),
              textTransform: (titleStyle.fontStyle.textTransform as any) || 'none',
              ...getAnimationStyle()
            }}
          >
            {renderStyledTitle()}
          </h1>
        )}

        {/* Removed genre indicator badge */}

        {/* Removed all decorative animations for cleaner static look */}
      </div>
      
      {/* Enhanced CSS Animations with 3D transforms */}
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
        @keyframes burning-fire {
          0%, 100% { 
            transform: scale(1) skew(-2deg);
            filter: hue-rotate(0deg) brightness(1.1) drop-shadow(0 0 20px rgba(255,165,0,0.8));
          }
          25% { 
            transform: scale(1.02) skew(-1deg);
            filter: hue-rotate(10deg) brightness(1.2) drop-shadow(0 0 30px rgba(255,69,0,0.9));
          }
          50% { 
            transform: scale(1.01) skew(-3deg);
            filter: hue-rotate(-5deg) brightness(1.15) drop-shadow(0 0 25px rgba(255,140,0,0.85));
          }
          75% { 
            transform: scale(1.03) skew(-1.5deg);
            filter: hue-rotate(15deg) brightness(1.25) drop-shadow(0 0 35px rgba(255,99,71,0.9));
          }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        @keyframes neon-pulse {
          0%, 100% { filter: brightness(1) drop-shadow(0 0 20px currentColor); }
          50% { filter: brightness(1.2) drop-shadow(0 0 30px currentColor); }
        }
        @keyframes magical-glow {
          0%, 100% { filter: hue-rotate(0deg) brightness(1); }
          33% { filter: hue-rotate(120deg) brightness(1.1); }
          66% { filter: hue-rotate(240deg) brightness(1.1); }
        }
        @keyframes thriller-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.01); }
        }
        @keyframes heart-beat {
          0%, 100% { transform: scale(1); }
          25% { transform: scale(1.05); }
          50% { transform: scale(1); }
          75% { transform: scale(1.02); }
        }
        @keyframes rainbow-shift {
          0% { filter: hue-rotate(0deg); }
          100% { filter: hue-rotate(360deg); }
        }
        @keyframes crime-flicker {
          0%, 100% { opacity: 1; }
          10% { opacity: 0.9; }
          20% { opacity: 1; }
          30% { opacity: 0.8; }
          40% { opacity: 1; }
        }
        @keyframes mystery-fade {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        @keyframes subtle-glow {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.1); }
        }
        
        /* 3D Transform enhancements */
        .text-3d-depth {
          text-shadow: 
            1px 1px 0px rgba(0,0,0,0.8),
            2px 2px 0px rgba(0,0,0,0.7),
            3px 3px 0px rgba(0,0,0,0.6),
            4px 4px 0px rgba(0,0,0,0.5),
            5px 5px 0px rgba(0,0,0,0.4);
        }
        
        .text-3d-extrude {
          transform-style: preserve-3d;
        }
        
        .particle-container {
          transform-style: preserve-3d;
          perspective: 1000px;
        }
        
        .burning-fire-effect {
          animation: burning-fire 3s ease-in-out infinite;
          text-shadow: 
            0 0 5px rgba(255,165,0,0.8),
            0 0 10px rgba(255,69,0,0.6),
            0 0 15px rgba(255,140,0,0.4),
            0 0 20px rgba(255,99,71,0.3),
            2px 2px 4px rgba(0,0,0,0.8);
        }
      `}</style>
    </>
  );
};

export default DynamicTitle;
