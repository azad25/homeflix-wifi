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
      name: 'cgi-metal-steel',
      className: 'cgi-metal-action-text',
      style: {
        fontWeight: '900',
        letterSpacing: '0.12em',
        textShadow: `
          0 0 2px #ffffff,
          0 0 4px #f0f0f0,
          0 0 8px #d0d0d0,
          1px 1px 0px #c8c8c8,
          2px 2px 0px #b0b0b0,
          3px 3px 0px #989898,
          4px 4px 0px #808080,
          5px 5px 0px #686868,
          6px 6px 0px #505050,
          7px 7px 0px #383838,
          8px 8px 0px #202020,
          9px 9px 0px #101010,
          10px 10px 0px #000000,
          12px 12px 25px rgba(0,0,0,0.9),
          15px 15px 35px rgba(0,0,0,0.8),
          -1px -1px 0px #ffffff,
          -2px -2px 0px #f8f8f8,
          -3px -3px 0px #e0e0e0,
          0 -2px 4px rgba(255,255,255,0.6),
          0 2px 8px rgba(0,0,0,0.8),
          inset 0 1px 0px rgba(255,255,255,0.4),
          inset 0 -1px 0px rgba(0,0,0,0.6)
        `,
        background: `
          linear-gradient(135deg, 
            #f8f8f8 0%, 
            #e0e0e0 8%, 
            #c8c8c8 16%, 
            #a8a8a8 24%, 
            #909090 32%, 
            #787878 40%, 
            #606060 48%, 
            #484848 56%, 
            #303030 64%, 
            #404040 72%, 
            #585858 80%, 
            #707070 88%, 
            #888888 96%, 
            #a0a0a0 100%
          ),
          repeating-linear-gradient(45deg, 
            transparent, 
            transparent 1px, 
            rgba(255,255,255,0.1) 1px, 
            rgba(255,255,255,0.1) 2px
          ),
          repeating-linear-gradient(-45deg, 
            transparent, 
            transparent 0.5px, 
            rgba(0,0,0,0.1) 0.5px, 
            rgba(0,0,0,0.1) 1px
          ),
          radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.3) 0%, transparent 50%),
          radial-gradient(ellipse at 70% 80%, rgba(0,0,0,0.2) 0%, transparent 40%)
        `,
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        color: 'transparent',
        filter: `
          drop-shadow(0 0 15px rgba(200,200,200,0.8)) 
          drop-shadow(0 0 30px rgba(160,160,160,0.6)) 
          drop-shadow(3px 3px 12px rgba(0,0,0,0.9)) 
          contrast(1.5) 
          saturate(0.8) 
          brightness(1.3)
        `,
        transform: 'perspective(1200px) rotateX(18deg) rotateY(-5deg) rotateZ(2deg) scale(1.08) translateZ(40px)',
        transformStyle: 'preserve-3d'
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
      name: 'hollywood-cyber-chrome',
      className: 'hollywood-scifi-text',
      style: {
        color: '#ffffff',
        fontWeight: '900',
        letterSpacing: '0.1em',
        textShadow: `
          0 0 5px #00ffff,
          0 0 10px #0099ff,
          0 0 20px #0066ff,
          0 0 40px #3366ff,
          1px 1px 0px #0088cc,
          2px 2px 0px #006699,
          3px 3px 0px #004466,
          4px 4px 0px #002233,
          5px 5px 0px #001122,
          6px 6px 20px rgba(0,0,0,0.8),
          -1px -1px 0px #66ccff,
          -2px -2px 0px #99ddff
        `,
        filter: 'drop-shadow(0 0 35px #00ffff) drop-shadow(0 0 70px #0099ff) contrast(1.3) saturate(1.4) brightness(1.2)',
        transform: 'perspective(1200px) rotateX(12deg) rotateY(-3deg) rotateZ(1deg) scale(1.04) translateZ(35px)',
        transformStyle: 'preserve-3d'
      }
    },
    
    fantasy: {
      name: 'hollywood-magical-crystal',
      className: 'hollywood-fantasy-text',
      style: {
        color: '#ffffff',
        fontWeight: '850',
        letterSpacing: '0.07em',
        textShadow: `
          0 0 5px #9933ff,
          0 0 10px #cc33ff,
          0 0 20px #ff33cc,
          0 0 40px #33ffcc,
          1px 1px 0px #7722cc,
          2px 2px 0px #5511aa,
          3px 3px 0px #330088,
          4px 4px 0px #220066,
          5px 5px 0px #110044,
          6px 6px 18px rgba(0,0,0,0.7),
          -1px -1px 0px #bb55ff,
          -2px -2px 0px #dd77ff
        `,
        filter: 'drop-shadow(0 0 30px #9933ff) drop-shadow(0 0 60px #ff33aa) hue-rotate(5deg) contrast(1.3) saturate(1.3)',
        transform: 'perspective(1000px) rotateX(14deg) rotateY(-4deg) rotateZ(2deg) scale(1.04) translateZ(28px)',
        transformStyle: 'preserve-3d'
      }
    },
    
    comedy: {
      name: 'hollywood-rainbow-pop',
      className: 'hollywood-comedy-text',
      style: {
        color: '#ffffff',
        fontWeight: '800',
        letterSpacing: '0.04em',
        textShadow: `
          0 0 5px #ffff00,
          0 0 10px #ff8800,
          0 0 20px #ff4488,
          0 0 40px #88ff44,
          1px 1px 0px #ddcc00,
          2px 2px 0px #bb9900,
          3px 3px 0px #996600,
          4px 4px 0px #663300,
          5px 5px 15px rgba(0,0,0,0.6),
          -1px -1px 0px #ffff66,
          -2px -2px 0px #ffcc99
        `,
        filter: 'drop-shadow(0 0 25px #ffff00) drop-shadow(0 0 50px #ff8800) brightness(1.2) saturate(1.4)',
        transform: 'perspective(700px) rotateX(12deg) rotateY(-1deg) rotateZ(3deg) scale(1.06) translateZ(22px)',
        transformStyle: 'preserve-3d'
      }
    },
    
    thriller: {
      name: 'hollywood-steel-shadow',
      className: 'hollywood-thriller-text',
      style: {
        color: '#e6e6e6',
        fontWeight: '900',
        letterSpacing: '0.06em',
        textShadow: `
          0 0 5px #999999,
          0 0 10px #666666,
          0 0 20px #333333,
          2px 2px 0px #555555,
          4px 4px 0px #333333,
          6px 6px 0px #111111,
          8px 8px 0px #000000,
          10px 10px 25px rgba(0,0,0,0.9),
          -1px -1px 0px #cccccc,
          -2px -2px 0px #aaaaaa
        `,
        filter: 'drop-shadow(0 0 20px #666666) drop-shadow(0 0 40px rgba(51,51,51,0.8)) contrast(1.3) brightness(1.1)',
        transform: 'perspective(900px) rotateX(10deg) rotateY(-2deg) skewX(-1deg) scale(1.02) translateZ(25px)',
        transformStyle: 'preserve-3d'
      }
    },
    
    romance: {
      name: 'hollywood-romance',
      className: 'hollywood-romance-text',
      style: {
        color: '#ffffff',
        fontWeight: '800',
        letterSpacing: '0.05em',
        textShadow: `
          0 0 5px #ff69b4,
          0 0 10px #ff1493,
          0 0 20px #ff69b4,
          0 0 40px #ffb6c1,
          1px 1px 0px #e91e63,
          2px 2px 0px #c2185b,
          3px 3px 0px #ad1457,
          4px 4px 0px #880e4f,
          5px 5px 0px #4a148c,
          6px 6px 15px rgba(0,0,0,0.6),
          -1px -1px 0px #ff8a95,
          -2px -2px 0px #ffcdd2
        `,
        filter: 'drop-shadow(0 0 25px #ff69b4) drop-shadow(0 0 50px rgba(255,20,147,0.6)) brightness(1.2) saturate(1.2)',
        transform: 'perspective(800px) rotateX(8deg) rotateY(-2deg) rotateZ(1deg) scale(1.03) translateZ(20px)',
        transformStyle: 'preserve-3d'
      }
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
    /* Hollywood-style 3D text effects */
    .texture-text-container {
      padding: 0;
      margin: 0;
      overflow: visible;
      display: inline-block;
      min-height: 1.5em;
      line-height: 1.2;
      transform-style: preserve-3d;
      perspective: 1000px;
    }
    
    .texture-text-wrapper {
      display: inline-block;
      padding: 0;
      border-radius: 0;
      transform-style: preserve-3d;
    }
    
    .cgi-metal-action-text {
      font-family: 'Impact', 'Arial Black', sans-serif !important;
      text-transform: uppercase;
      transform-style: preserve-3d;
      position: relative;
    }
    
    .cgi-metal-action-text::before {
      content: attr(data-text);
      position: absolute;
      top: 0;
      left: 0;
      z-index: -1;
      background: linear-gradient(135deg, 
        #2a2a2a 0%, 
        #1a1a1a 20%, 
        #0a0a0a 40%, 
        #000000 60%, 
        #1a1a1a 80%, 
        #2a2a2a 100%
      );
      background-clip: text;
      -webkit-background-clip: text;
      color: transparent;
      transform: translateZ(-5px) scale(1.02);
      filter: blur(1px) opacity(0.8);
    }
    
    .cgi-metal-action-text::after {
      content: attr(data-text);
      position: absolute;
      top: 2px;
      left: 2px;
      z-index: -2;
      background: linear-gradient(135deg, 
        #444444 0%, 
        #333333 25%, 
        #222222 50%, 
        #111111 75%, 
        #000000 100%
      );
      background-clip: text;
      -webkit-background-clip: text;
      color: transparent;
      transform: translateZ(-10px) scale(1.04);
      filter: blur(2px) opacity(0.6);
    }
    
    .hollywood-romance-text {
      font-family: 'Georgia', 'Times New Roman', serif !important;
      font-style: italic;
      transform-style: preserve-3d;
    }
    
    .hollywood-scifi-text {
      font-family: 'Orbitron', 'Courier New', monospace !important;
      text-transform: uppercase;
      transform-style: preserve-3d;
    }
    
    .hollywood-thriller-text {
      font-family: 'Arial Narrow', 'Arial', sans-serif !important;
      text-transform: uppercase;
      transform-style: preserve-3d;
    }
    
    .hollywood-fantasy-text {
      font-family: 'Cinzel', 'Times New Roman', serif !important;
      transform-style: preserve-3d;
    }
    
    .hollywood-comedy-text {
      font-family: 'Comic Sans MS', 'Trebuchet MS', sans-serif !important;
      transform-style: preserve-3d;
    }
    
    .single-word-3d {
      transform: perspective(1200px) rotateX(20deg) rotateY(-6deg) rotateZ(3deg) scale(1.15) translateZ(40px);
      font-weight: 900;
      text-shadow: 
        0 0 10px currentColor,
        0 0 20px currentColor,
        0 0 40px currentColor,
        3px 3px 0px rgba(0,0,0,0.9),
        6px 6px 0px rgba(0,0,0,0.8),
        9px 9px 0px rgba(0,0,0,0.7),
        12px 12px 0px rgba(0,0,0,0.6),
        15px 15px 0px rgba(0,0,0,0.5),
        18px 18px 30px rgba(0,0,0,0.9);
      filter: drop-shadow(0 0 50px currentColor) contrast(1.4) saturate(1.5) brightness(1.2);
      letter-spacing: 0.15em;
      transform-style: preserve-3d;
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
  const textContent = typeof children === 'string' ? children : '';
  
  return (
    <>
      <TextureCSS />
      <div className="texture-text-container">
        <span 
          className={`texture-text-wrapper ${effect.className} ${className} ${isSingleWord ? 'single-word-3d' : ''}`}
          data-text={textContent}
          style={{
            ...effect.style,
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
            textRendering: 'optimizeLegibility'
          }}
        >
          {children}
        </span>
      </div>
    </>
  );
};

export default TextureEffects;
