"use client";

import React from 'react';

export interface TextureEffect {
  name: string;
  className: string;
  style: React.CSSProperties;
  backgroundImage?: string;
  filter?: string;
  textShadow?: string;
  animation?: string;
}

export const getTextureEffect = (genre: string, effectType: '3d' | 'texture' | 'both' = 'both'): TextureEffect => {
  const normalizedGenre = genre.toLowerCase().replace(/\s+/g, '-');
  
  const effects: Record<string, TextureEffect> = {
    action: {
      name: 'hollywood-fire-steel',
      className: 'text-transparent bg-clip-text',
      style: {
        background: `
          linear-gradient(135deg, #ff1a1a 0%, #ff6600 15%, #ffaa00 30%, #ffffff 45%, #e6e6e6 60%, #cccccc 75%, #999999 90%, #666666 100%),
          repeating-linear-gradient(45deg, transparent, transparent 1px, rgba(255,255,255,0.15) 1px, rgba(255,255,255,0.15) 2px),
          radial-gradient(ellipse at 30% 20%, rgba(255,68,68,0.4) 0%, transparent 50%),
          radial-gradient(ellipse at 70% 80%, rgba(255,136,0,0.3) 0%, transparent 40%)
        `,
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        filter: 'drop-shadow(0 0 15px #ff4444) drop-shadow(3px 3px 8px rgba(0,0,0,0.9)) contrast(1.3) saturate(1.2)',
        textShadow: '0 0 25px #ff4444, 0 0 50px #ff8800, 3px 3px 8px rgba(0,0,0,0.9), -1px -1px 3px rgba(255,255,255,0.2)',
        transform: 'perspective(800px) rotateX(12deg) rotateY(-3deg) rotateZ(1deg) scale(1.02)'
      }
    },
    
    horror: {
      name: 'hollywood-blood-rust',
      className: 'text-transparent bg-clip-text',
      style: {
        background: `
          linear-gradient(160deg, #cc0000 0%, #8b0000 20%, #660000 40%, #440000 60%, #220000 80%, #000000 100%),
          radial-gradient(ellipse at 25% 15%, rgba(204,0,0,0.6) 0%, transparent 40%),
          radial-gradient(ellipse at 75% 85%, rgba(139,0,0,0.4) 0%, transparent 30%),
          repeating-linear-gradient(30deg, transparent, transparent 0.5px, rgba(0,0,0,0.4) 0.5px, rgba(0,0,0,0.4) 1px),
          linear-gradient(90deg, rgba(255,255,255,0.1) 0%, transparent 20%, transparent 80%, rgba(255,255,255,0.05) 100%)
        `,
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        filter: 'drop-shadow(0 0 20px #8b0000) drop-shadow(4px 4px 12px rgba(0,0,0,0.95)) contrast(1.4) saturate(1.5)',
        textShadow: '0 0 30px #8b0000, 0 0 60px #660000, 4px 4px 12px rgba(0,0,0,0.95), -2px -2px 4px rgba(255,255,255,0.1)',
        transform: 'perspective(900px) rotateX(8deg) rotateY(-2deg) skewX(-1deg) scale(1.01)'
      }
    },
    
    'sci-fi': {
      name: 'hollywood-neon-hologram',
      className: 'text-transparent bg-clip-text',
      style: {
        background: `
          linear-gradient(120deg, #00ffff 0%, #0099ff 12%, #0088ff 25%, #4400ff 40%, #6600cc 55%, #8800ff 70%, #aa00cc 85%, #00ffff 100%),
          repeating-linear-gradient(0deg, transparent, transparent 0.8px, rgba(0,255,255,0.3) 0.8px, rgba(0,255,255,0.3) 1.6px),
          repeating-linear-gradient(90deg, transparent, transparent 6px, rgba(0,136,255,0.15) 6px, rgba(0,136,255,0.15) 12px),
          radial-gradient(ellipse at 20% 30%, rgba(0,255,255,0.4) 0%, transparent 35%),
          radial-gradient(ellipse at 80% 70%, rgba(68,0,255,0.3) 0%, transparent 40%)
        `,
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        filter: 'drop-shadow(0 0 25px #00ffff) drop-shadow(0 0 50px #0088ff) drop-shadow(2px 2px 8px rgba(0,0,0,0.8)) brightness(1.3) contrast(1.2)',
        textShadow: '0 0 15px #00ffff, 0 0 30px #0088ff, 0 0 45px #4400ff, 2px 2px 8px rgba(0,0,0,0.8), -1px -1px 3px rgba(255,255,255,0.2)',
        transform: 'perspective(1000px) rotateX(4deg) rotateY(1deg) rotateZ(0.5deg) translateZ(25px) scale(1.01)'
      }
    },
    
    fantasy: {
      name: 'magical-crystal',
      className: 'text-transparent bg-clip-text',
      style: {
        background: `
          linear-gradient(135deg, #9933ff 0%, #ff33aa 25%, #33ffaa 50%, #ffaa33 75%, #9933ff 100%),
          radial-gradient(circle at 20% 30%, rgba(153,51,255,0.4) 0%, transparent 40%),
          radial-gradient(circle at 80% 70%, rgba(255,51,170,0.4) 0%, transparent 40%),
          repeating-conic-gradient(from 0deg at 50% 50%, transparent 0deg, rgba(255,255,255,0.1) 30deg, transparent 60deg)
        `,
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        filter: 'drop-shadow(0 0 15px #9933ff) drop-shadow(0 0 30px #ff33aa) hue-rotate(10deg)',
        textShadow: '0 0 15px #9933ff, 0 0 30px #ff33aa, 0 0 45px #33ffaa',
        transform: 'perspective(700px) rotateX(12deg) rotateY(-3deg) rotateZ(1deg)'
      },
      backgroundImage: 'linear-gradient(135deg, #9933ff, #ff33aa, #33ffaa, #ffaa33, #9933ff)',
      filter: 'drop-shadow(0 0 15px #9933ff)'
    },
    
    comedy: {
      name: 'rainbow-bounce',
      className: 'text-transparent bg-clip-text',
      style: {
        background: `
          linear-gradient(45deg, #ffff00 0%, #ff8800 20%, #ff4488 40%, #88ff44 60%, #44aaff 80%, #ffff00 100%),
          repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(255,255,255,0.2) 3px, rgba(255,255,255,0.2) 6px)
        `,
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        filter: 'drop-shadow(0 0 10px #ffff00) drop-shadow(2px 2px 4px rgba(0,0,0,0.3)) brightness(1.1)',
        textShadow: '0 0 15px #ffff00, 0 0 25px #ff8800, 1px 1px 3px rgba(0,0,0,0.3)',
        transform: 'perspective(500px) rotateX(8deg) rotateZ(2deg) scale(1.02)'
      },
      backgroundImage: 'linear-gradient(45deg, #ffff00, #ff8800, #ff4488, #88ff44, #44aaff, #ffff00)',
      filter: 'drop-shadow(0 0 10px #ffff00)'
    },
    
    thriller: {
      name: 'steel-shadow',
      className: 'text-transparent bg-clip-text',
      style: {
        background: `
          linear-gradient(180deg, #cccccc 0%, #888888 30%, #444444 70%, #222222 100%),
          repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px),
          linear-gradient(90deg, rgba(0,0,0,0.3) 0%, transparent 50%, rgba(0,0,0,0.3) 100%)
        `,
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        filter: 'drop-shadow(0 0 8px #666666) drop-shadow(3px 3px 6px rgba(0,0,0,0.8)) contrast(1.1)',
        textShadow: '0 0 10px #666666, 3px 3px 6px rgba(0,0,0,0.8), -1px -1px 2px rgba(255,255,255,0.1)',
        transform: 'perspective(600px) rotateX(5deg) skewX(-1deg)'
      },
      backgroundImage: 'linear-gradient(180deg, #cccccc, #888888, #444444, #222222)',
      filter: 'drop-shadow(0 0 8px #666666)'
    },
    
    romance: {
      name: 'silk-pearl',
      className: 'text-transparent bg-clip-text',
      style: {
        background: `
          linear-gradient(135deg, #ff6699 0%, #ff99cc 30%, #ffccdd 60%, #ffffff 90%, #ffe6f0 100%),
          radial-gradient(circle at 30% 30%, rgba(255,255,255,0.6) 0%, transparent 30%),
          radial-gradient(circle at 70% 70%, rgba(255,102,153,0.3) 0%, transparent 40%)
        `,
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        filter: 'drop-shadow(0 0 12px #ff6699) drop-shadow(0 0 24px rgba(255,153,204,0.5)) brightness(1.1)',
        textShadow: '0 0 15px #ff6699, 0 0 30px rgba(255,153,204,0.8), 1px 1px 3px rgba(0,0,0,0.2)',
        transform: 'perspective(500px) rotateX(3deg) rotateY(1deg)'
      },
      backgroundImage: 'linear-gradient(135deg, #ff6699, #ff99cc, #ffccdd, #ffffff, #ffe6f0)',
      filter: 'drop-shadow(0 0 12px #ff6699)'
    },
    
    documentary: {
      name: 'earth-stone',
      className: 'text-transparent bg-clip-text',
      style: {
        background: `
          linear-gradient(180deg, #88cc88 0%, #66aa66 40%, #448844 80%, #226622 100%),
          repeating-linear-gradient(30deg, transparent, transparent 3px, rgba(0,0,0,0.1) 3px, rgba(0,0,0,0.1) 6px),
          radial-gradient(circle at 40% 60%, rgba(255,255,255,0.2) 0%, transparent 30%)
        `,
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        filter: 'drop-shadow(0 0 8px #44aa44) drop-shadow(2px 2px 4px rgba(0,0,0,0.4))',
        textShadow: '0 0 10px #44aa44, 2px 2px 4px rgba(0,0,0,0.4), -1px -1px 2px rgba(255,255,255,0.1)',
        transform: 'perspective(400px) rotateX(2deg)'
      },
      backgroundImage: 'linear-gradient(180deg, #88cc88, #66aa66, #448844, #226622)',
      filter: 'drop-shadow(0 0 8px #44aa44)'
    },
    
    animation: {
      name: 'cartoon-pop',
      className: 'text-transparent bg-clip-text',
      style: {
        background: `
          linear-gradient(45deg, #ff0088 0%, #8800ff 25%, #0088ff 50%, #88ff00 75%, #ff0088 100%),
          repeating-linear-gradient(90deg, transparent, transparent 4px, rgba(255,255,255,0.3) 4px, rgba(255,255,255,0.3) 8px),
          radial-gradient(circle at 25% 25%, rgba(255,255,255,0.4) 0%, transparent 25%)
        `,
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        filter: 'drop-shadow(0 0 15px #ff0088) drop-shadow(0 0 30px #8800ff) saturate(1.3) brightness(1.2)',
        textShadow: '0 0 20px #ff0088, 0 0 40px #8800ff, 2px 2px 4px rgba(0,0,0,0.3)',
        transform: 'perspective(600px) rotateX(10deg) rotateY(-2deg) scale(1.05)'
      },
      backgroundImage: 'linear-gradient(45deg, #ff0088, #8800ff, #0088ff, #88ff00, #ff0088)',
      filter: 'drop-shadow(0 0 15px #ff0088)'
    },
    
    crime: {
      name: 'concrete-shadow',
      className: 'text-transparent bg-clip-text',
      style: {
        background: `
          linear-gradient(180deg, #777777 0%, #555555 40%, #333333 80%, #111111 100%),
          repeating-linear-gradient(135deg, transparent, transparent 2px, rgba(0,0,0,0.2) 2px, rgba(0,0,0,0.2) 4px),
          linear-gradient(45deg, rgba(255,255,255,0.05) 0%, transparent 50%)
        `,
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        filter: 'drop-shadow(0 0 6px #333333) drop-shadow(4px 4px 8px rgba(0,0,0,0.9)) contrast(1.2)',
        textShadow: '0 0 8px #333333, 4px 4px 8px rgba(0,0,0,0.9), -1px -1px 2px rgba(255,255,255,0.05)',
        transform: 'perspective(500px) rotateX(3deg) skewX(-0.5deg)'
      },
      backgroundImage: 'linear-gradient(180deg, #777777, #555555, #333333, #111111)',
      filter: 'drop-shadow(0 0 6px #333333)'
    },
    
    mystery: {
      name: 'mist-glow',
      className: 'text-transparent bg-clip-text',
      style: {
        background: `
          linear-gradient(135deg, #6666cc 0%, #4444aa 30%, #333388 60%, #222266 90%, #111144 100%),
          radial-gradient(circle at 20% 80%, rgba(102,102,204,0.3) 0%, transparent 50%),
          radial-gradient(circle at 80% 20%, rgba(68,68,170,0.2) 0%, transparent 40%),
          repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.05) 3px, rgba(255,255,255,0.05) 6px)
        `,
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        filter: 'drop-shadow(0 0 12px #4444aa) drop-shadow(0 0 24px rgba(68,68,170,0.6)) blur(0.5px)',
        textShadow: '0 0 15px #4444aa, 0 0 30px rgba(68,68,170,0.8), 0 0 45px rgba(34,34,136,0.4)',
        transform: 'perspective(700px) rotateX(8deg) rotateY(2deg)'
      },
      backgroundImage: 'linear-gradient(135deg, #6666cc, #4444aa, #333388, #222266, #111144)',
      filter: 'drop-shadow(0 0 12px #4444aa)'
    },
    
    drama: {
      name: 'classic-gold',
      className: 'text-transparent bg-clip-text',
      style: {
        background: `
          linear-gradient(180deg, #ffffff 0%, #e6e6ff 20%, #ccddff 50%, #99bbee 80%, #6699dd 100%),
          repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px),
          radial-gradient(circle at 50% 30%, rgba(255,255,255,0.3) 0%, transparent 40%)
        `,
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        filter: 'drop-shadow(0 0 10px #6699dd) drop-shadow(1px 1px 3px rgba(0,0,0,0.3))',
        textShadow: '0 0 12px #6699dd, 1px 1px 3px rgba(0,0,0,0.3), -1px -1px 2px rgba(255,255,255,0.2)',
        transform: 'perspective(400px) rotateX(2deg)'
      },
      backgroundImage: 'linear-gradient(180deg, #ffffff, #e6e6ff, #ccddff, #99bbee, #6699dd)',
      filter: 'drop-shadow(0 0 10px #6699dd)'
    }
  };

  return effects[normalizedGenre] || effects.drama;
};

export const TextureCSS = () => (
  <style jsx global>{`
    /* Static texture effects - no animations */
    .texture-text-container {
      padding: 8px 12px;
      margin: 4px 0;
      overflow: visible;
      display: inline-block;
      min-height: 1.5em;
      line-height: 1.4;
    }
    
    .texture-text-wrapper {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
    }
    
    .single-word-3d {
      transform: perspective(1000px) rotateX(15deg) rotateY(-5deg) rotateZ(2deg) scale(1.1);
      font-weight: 900;
      text-shadow: 
        0 0 20px currentColor,
        2px 2px 0px rgba(0,0,0,0.8),
        4px 4px 0px rgba(0,0,0,0.6),
        6px 6px 0px rgba(0,0,0,0.4),
        8px 8px 0px rgba(0,0,0,0.2),
        10px 10px 20px rgba(0,0,0,0.8);
      filter: drop-shadow(0 0 30px currentColor) contrast(1.2) saturate(1.3);
      letter-spacing: 0.1em;
    }
  `}</style>
);

// Main TextureEffects component that applies texture effects to text
interface TextureEffectsProps {
  genre: string;
  children: React.ReactNode;
  effectType?: '3d' | 'texture' | 'both';
  className?: string;
  isSingleWord?: boolean;
}

export const TextureEffects: React.FC<TextureEffectsProps> = ({ 
  genre, 
  children, 
  effectType = 'both',
  className = '',
  isSingleWord = false
}) => {
  const effect = getTextureEffect(genre, effectType);
  
  return (
    <>
      <TextureCSS />
      <div className="texture-text-container">
        <span 
          className={`texture-text-wrapper ${effect.className} ${className} ${isSingleWord ? 'single-word-3d' : ''}`}
          style={effect.style}
        >
          {children}
        </span>
      </div>
    </>
  );
};

export default TextureEffects;
