"use client";

import React, { useEffect } from 'react';

// Dynamic font loading and styling based on genre - Refined and subtle
const getGenreFont = (genre: string = "") => {
  const g = genre.toLowerCase();
  
  if (g.includes("horror") || g.includes("thriller")) {
    return {
      fontFamily: "'Inter', sans-serif",
      fontUrl: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap",
      style: "font-medium",
      letterSpacing: "tracking-normal",
      textShadow: "0 2px 8px rgba(220, 38, 38, 0.2), 0 0 1px rgba(0, 0, 0, 0.6)",
      color: "rgba(255, 255, 255, 0.75)", // Lighter transparent white
      animation: "subtle-pulse 4s ease-in-out infinite"
    };
  }
  
  if (g.includes("sci") || g.includes("science")) {
    return {
      fontFamily: "'Space Grotesk', sans-serif",
      fontUrl: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500&display=swap",
      style: "font-medium",
      letterSpacing: "tracking-wide",
      textShadow: "0 0 20px rgba(59, 130, 246, 0.2), 0 2px 4px rgba(0, 0, 0, 0.4)",
      color: "rgba(255, 255, 255, 0.75)", // Lighter transparent white
      animation: "subtle-glow 3s ease-in-out infinite"
    };
  }
  
  if (g.includes("romance")) {
    return {
      fontFamily: "'Lora', serif",
      fontUrl: "https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;1,400&display=swap",
      style: "font-normal italic",
      letterSpacing: "tracking-normal",
      textShadow: "0 2px 8px rgba(236, 72, 153, 0.15), 0 0 1px rgba(0, 0, 0, 0.4)",
      color: "rgba(255, 255, 255, 0.75)", // Lighter transparent white
    };
  }
  
  if (g.includes("action")) {
    return {
      fontFamily: "'Rajdhani', sans-serif",
      fontUrl: "https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600&display=swap",
      style: "font-semibold",
      letterSpacing: "tracking-wide",
      textShadow: "0 2px 8px rgba(239, 68, 68, 0.2), 0 0 1px rgba(0, 0, 0, 0.6)",
      color: "rgba(255, 255, 255, 0.75)", // Lighter transparent white
    };
  }
  
  if (g.includes("comedy")) {
    return {
      fontFamily: "'Inter', sans-serif",
      fontUrl: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap",
      style: "font-medium",
      letterSpacing: "tracking-normal",
      textShadow: "0 2px 6px rgba(251, 191, 36, 0.15), 0 0 1px rgba(0, 0, 0, 0.4)",
      color: "rgba(255, 255, 255, 0.75)", // Lighter transparent white
    };
  }
  
  if (g.includes("drama")) {
    return {
      fontFamily: "'Crimson Pro', serif",
      fontUrl: "https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,500;1,400&display=swap",
      style: "font-normal",
      letterSpacing: "tracking-normal",
      textShadow: "0 2px 6px rgba(0, 0, 0, 0.3)",
      color: "rgba(255, 255, 255, 0.7)", // Lighter transparent white
    };
  }
  
  if (g.includes("fantasy") || g.includes("adventure")) {
    return {
      fontFamily: "'Merriweather', serif",
      fontUrl: "https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&display=swap",
      style: "font-normal",
      letterSpacing: "tracking-normal",
      textShadow: "0 2px 8px rgba(168, 85, 247, 0.2), 0 0 1px rgba(0, 0, 0, 0.5)",
      color: "rgba(255, 255, 255, 0.75)", // Lighter transparent white
      animation: "subtle-shimmer 5s ease-in-out infinite"
    };
  }
  
  if (g.includes("animation") || g.includes("family")) {
    return {
      fontFamily: "'Nunito', sans-serif",
      fontUrl: "https://fonts.googleapis.com/css2?family=Nunito:wght@400;600&display=swap",
      style: "font-semibold",
      letterSpacing: "tracking-normal",
      textShadow: "0 2px 6px rgba(34, 197, 94, 0.15), 0 0 1px rgba(0, 0, 0, 0.4)",
      color: "rgba(255, 255, 255, 0.75)", // Lighter transparent white
    };
  }
  
  if (g.includes("documentary") || g.includes("history")) {
    return {
      fontFamily: "'Source Serif Pro', serif",
      fontUrl: "https://fonts.googleapis.com/css2?family=Source+Serif+Pro:wght@400;600&display=swap",
      style: "font-normal",
      letterSpacing: "tracking-normal",
      textShadow: "0 2px 4px rgba(0, 0, 0, 0.3)",
      color: "rgba(255, 255, 255, 0.7)", // Lighter transparent white
    };
  }
  
  if (g.includes("mystery") || g.includes("crime")) {
    return {
      fontFamily: "'IBM Plex Mono', monospace",
      fontUrl: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&display=swap",
      style: "font-medium",
      letterSpacing: "tracking-wide",
      textShadow: "0 2px 8px rgba(100, 116, 139, 0.3), 0 0 1px rgba(0, 0, 0, 0.5)",
      color: "rgba(255, 255, 255, 0.7)", // Lighter transparent white
    };
  }
  
  // Default - Clean and readable
  return {
    fontFamily: "'Inter', sans-serif",
    fontUrl: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap",
    style: "font-normal",
    letterSpacing: "tracking-normal",
    textShadow: "0 2px 4px rgba(0, 0, 0, 0.4)",
    color: "rgba(255, 255, 255, 0.7)", // Lighter transparent white
  };
};

interface GenreStyledTextProps {
  genres?: string[] | Array<{ name: string }>;
  children: React.ReactNode;
  className?: string;
}

const GenreStyledText: React.FC<GenreStyledTextProps> = ({ genres = [], children, className = '' }) => {
  // Extract genre names from either string array or object array
  const genreNames = genres.map(g => typeof g === 'string' ? g : g?.name).filter(Boolean);
  const primaryGenre = genreNames[0] || '';
  
  const genreFont = getGenreFont(primaryGenre);

  // Load Google Font dynamically
  useEffect(() => {
    // Check if font is already loaded
    const existingLink = document.querySelector(`link[href="${genreFont.fontUrl}"]`);
    if (existingLink) return;
    
    // Load font
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = genreFont.fontUrl;
    document.head.appendChild(link);
    
    // Add subtle animations
    const styleId = 'genre-animations';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes subtle-pulse {
          0%, 100% { opacity: 1; text-shadow: 0 2px 8px rgba(220, 38, 38, 0.2), 0 0 1px rgba(0, 0, 0, 0.6); }
          50% { opacity: 0.97; text-shadow: 0 2px 10px rgba(220, 38, 38, 0.25), 0 0 1px rgba(0, 0, 0, 0.7); }
        }
        
        @keyframes subtle-glow {
          0%, 100% { text-shadow: 0 0 20px rgba(59, 130, 246, 0.2), 0 2px 4px rgba(0, 0, 0, 0.4); }
          50% { text-shadow: 0 0 24px rgba(59, 130, 246, 0.25), 0 2px 5px rgba(0, 0, 0, 0.5); }
        }
        
        @keyframes subtle-shimmer {
          0%, 100% { text-shadow: 0 2px 8px rgba(168, 85, 247, 0.2), 0 0 1px rgba(0, 0, 0, 0.5); }
          50% { text-shadow: 0 2px 10px rgba(168, 85, 247, 0.25), 0 0 1px rgba(0, 0, 0, 0.6); }
        }
      `;
      document.head.appendChild(style);
    }
    
    return () => {
      // Optional: cleanup if needed
    };
  }, [genreFont.fontUrl]);

  return (
    <span
      className={`${genreFont.style} ${genreFont.letterSpacing} ${className}`}
      style={{ 
        fontFamily: genreFont.fontFamily,
        textShadow: genreFont.textShadow,
        animation: genreFont.animation,
        color: genreFont.color,
        transition: 'all 0.3s ease-in-out'
      }}
    >
      {children}
    </span>
  );
};

export default GenreStyledText;
