"use client";

import React from 'react';
import { motion } from 'framer-motion';

interface TileEffectsProps {
  priority: string;
  themeColors: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

const TileEffects: React.FC<TileEffectsProps> = ({ priority, themeColors }) => {
  if (priority !== 'high') return null;

  return (
    <>
      {/* Particle effects for high priority notifications */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full"
            style={{ backgroundColor: `${themeColors.accent}60` }}
            initial={{ 
              x: Math.random() * 100 + '%',
              y: Math.random() * 100 + '%',
              opacity: 0,
              scale: 0
            }}
            animate={{
              x: [
                Math.random() * 100 + '%',
                Math.random() * 100 + '%',
                Math.random() * 100 + '%'
              ],
              y: [
                Math.random() * 100 + '%',
                Math.random() * 100 + '%',
                Math.random() * 100 + '%'
              ],
              opacity: [0, 0.8, 0],
              scale: [0, 1, 0]
            }}
            transition={{
              duration: 4 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 3,
              ease: "easeInOut"
            }}
          />
        ))}
      </div>

      {/* Glowing border effect */}
      <motion.div
        className="absolute inset-0 rounded-xl pointer-events-none"
        style={{
          background: `linear-gradient(45deg, ${themeColors.primary}40, ${themeColors.accent}40, ${themeColors.primary}40)`,
          backgroundSize: '200% 200%',
        }}
        animate={{
          backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "linear"
        }}
      />

      {/* Corner sparkles */}
      {[
        { top: '10%', left: '10%' },
        { top: '10%', right: '10%' },
        { bottom: '10%', left: '10%' },
        { bottom: '10%', right: '10%' },
      ].map((position, i) => (
        <motion.div
          key={`sparkle-${i}`}
          className="absolute w-2 h-2 pointer-events-none"
          style={{
            ...position,
            background: `radial-gradient(circle, ${themeColors.accent} 0%, transparent 70%)`,
          }}
          animate={{
            scale: [0, 1, 0],
            opacity: [0, 1, 0],
            rotate: [0, 180, 360],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: i * 0.5,
            ease: "easeInOut"
          }}
        />
      ))}
    </>
  );
};

export default TileEffects;