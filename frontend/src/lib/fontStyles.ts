import { Media } from '@/types/media';

export interface FontStyle {
  fontFamily: string;
  fontWeight: string;
  fontSize: {
    mobile: string;
    tablet: string;
    desktop: string;
    xl: string;
  };
  color: string;
  textShadow: string;
  letterSpacing: string;
  lineHeight: string;
  textTransform?: string;
  fontVariant?: string;
}

export interface PageFontConfig {
  heroTitle: FontStyle;
  sectionTitle: FontStyle;
  description: FontStyle;
}

// Movie logo-style fonts for different genres
export const GENRE_FONTS = {
  action: {
    fontFamily: '"Orbitron", "Exo 2", "Rajdhani", sans-serif',
    fontWeight: '900',
    fontSize: {
      mobile: 'text-4xl md:text-6xl',
      tablet: 'text-6xl md:text-8xl',
      desktop: 'text-8xl md:text-9xl',
      xl: 'text-9xl md:text-10xl'
    },
    color: 'bg-gradient-to-r from-red-500 via-orange-400 to-yellow-300',
    textShadow: '0 0 30px rgba(239,68,68,0.8), 0 4px 8px rgba(0,0,0,0.8)',
    letterSpacing: 'tracking-wider',
    lineHeight: 'leading-none',
    textTransform: 'uppercase',
    fontVariant: 'small-caps'
  },
  horror: {
    fontFamily: '"Creepster", "Nosifer", "Butcherman", cursive',
    fontWeight: '400',
    fontSize: {
      mobile: 'text-4xl md:text-6xl',
      tablet: 'text-6xl md:text-8xl',
      desktop: 'text-8xl md:text-9xl',
      xl: 'text-9xl md:text-10xl'
    },
    color: 'bg-gradient-to-r from-red-900 via-red-700 to-black',
    textShadow: '0 0 40px rgba(127,29,29,0.9), 0 0 20px rgba(0,0,0,1), 2px 2px 4px rgba(0,0,0,0.8)',
    letterSpacing: 'tracking-wide',
    lineHeight: 'leading-tight',
    textTransform: 'uppercase'
  },
  'sci-fi': {
    fontFamily: '"Orbitron", "Exo", "Space Mono", monospace',
    fontWeight: '700',
    fontSize: {
      mobile: 'text-4xl md:text-6xl',
      tablet: 'text-6xl md:text-8xl',
      desktop: 'text-8xl md:text-9xl',
      xl: 'text-9xl md:text-10xl'
    },
    color: 'bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600',
    textShadow: '0 0 30px rgba(34,211,238,0.8), 0 0 60px rgba(34,211,238,0.4)',
    letterSpacing: 'tracking-widest',
    lineHeight: 'leading-none',
    textTransform: 'uppercase',
    fontVariant: 'small-caps'
  },
  fantasy: {
    fontFamily: '"Cinzel", "Uncial Antiqua", "MedievalSharp", serif',
    fontWeight: '600',
    fontSize: {
      mobile: 'text-4xl md:text-6xl',
      tablet: 'text-6xl md:text-8xl',
      desktop: 'text-8xl md:text-9xl',
      xl: 'text-9xl md:text-10xl'
    },
    color: 'bg-gradient-to-r from-purple-600 via-pink-500 to-rose-400',
    textShadow: '0 0 25px rgba(147,51,234,0.8), 0 2px 4px rgba(0,0,0,0.6)',
    letterSpacing: 'tracking-wide',
    lineHeight: 'leading-relaxed',
    textTransform: 'capitalize'
  },
  comedy: {
    fontFamily: '"Fredoka One", "Bungee", "Comfortaa", cursive',
    fontWeight: '400',
    fontSize: {
      mobile: 'text-4xl md:text-6xl',
      tablet: 'text-6xl md:text-8xl',
      desktop: 'text-8xl md:text-9xl',
      xl: 'text-9xl md:text-10xl'
    },
    color: 'bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400',
    textShadow: '0 0 20px rgba(251,191,36,0.8), 0 4px 8px rgba(0,0,0,0.4)',
    letterSpacing: 'tracking-normal',
    lineHeight: 'leading-relaxed',
    textTransform: 'none'
  },
  thriller: {
    fontFamily: '"Bebas Neue", "Oswald", "Anton", sans-serif',
    fontWeight: '700',
    fontSize: {
      mobile: 'text-4xl md:text-6xl',
      tablet: 'text-6xl md:text-8xl',
      desktop: 'text-8xl md:text-9xl',
      xl: 'text-9xl md:text-10xl'
    },
    color: 'bg-gradient-to-r from-gray-800 via-red-800 to-black',
    textShadow: '0 0 30px rgba(55,65,81,0.9), 0 6px 12px rgba(0,0,0,0.8)',
    letterSpacing: 'tracking-wider',
    lineHeight: 'leading-none',
    textTransform: 'uppercase'
  },
  romance: {
    fontFamily: '"Dancing Script", "Great Vibes", "Satisfy", cursive',
    fontWeight: '600',
    fontSize: {
      mobile: 'text-4xl md:text-6xl',
      tablet: 'text-6xl md:text-7xl',
      desktop: 'text-7xl md:text-8xl',
      xl: 'text-8xl md:text-9xl'
    },
    color: 'bg-gradient-to-r from-pink-500 via-rose-400 to-red-400',
    textShadow: '0 0 25px rgba(236,72,153,0.8), 0 2px 4px rgba(0,0,0,0.4)',
    letterSpacing: 'tracking-normal',
    lineHeight: 'leading-relaxed',
    textTransform: 'capitalize'
  },
  documentary: {
    fontFamily: '"Source Sans Pro", "Open Sans", "Lato", sans-serif',
    fontWeight: '600',
    fontSize: {
      mobile: 'text-4xl md:text-5xl',
      tablet: 'text-5xl md:text-7xl',
      desktop: 'text-7xl md:text-8xl',
      xl: 'text-8xl md:text-9xl'
    },
    color: 'bg-gradient-to-r from-green-600 via-teal-500 to-blue-500',
    textShadow: '0 0 20px rgba(34,197,94,0.6), 0 2px 4px rgba(0,0,0,0.4)',
    letterSpacing: 'tracking-normal',
    lineHeight: 'leading-normal',
    textTransform: 'none'
  },
  animation: {
    fontFamily: '"Fredoka One", "Nunito", "Quicksand", sans-serif',
    fontWeight: '700',
    fontSize: {
      mobile: 'text-4xl md:text-6xl',
      tablet: 'text-6xl md:text-8xl',
      desktop: 'text-8xl md:text-9xl',
      xl: 'text-9xl md:text-10xl'
    },
    color: 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500',
    textShadow: '0 0 25px rgba(99,102,241,0.8), 0 4px 8px rgba(0,0,0,0.4)',
    letterSpacing: 'tracking-normal',
    lineHeight: 'leading-relaxed',
    textTransform: 'none'
  },
  crime: {
    fontFamily: '"Bebas Neue", "Oswald", "Fjalla One", sans-serif',
    fontWeight: '800',
    fontSize: {
      mobile: 'text-4xl md:text-6xl',
      tablet: 'text-6xl md:text-8xl',
      desktop: 'text-8xl md:text-9xl',
      xl: 'text-9xl md:text-10xl'
    },
    color: 'bg-gradient-to-r from-gray-900 via-red-900 to-yellow-600',
    textShadow: '0 0 30px rgba(17,24,39,0.9), 0 6px 12px rgba(0,0,0,0.8)',
    letterSpacing: 'tracking-wider',
    lineHeight: 'leading-none',
    textTransform: 'uppercase'
  },
  mystery: {
    fontFamily: '"Crimson Text", "Playfair Display", "EB Garamond", serif',
    fontWeight: '700',
    fontSize: {
      mobile: 'text-4xl md:text-6xl',
      tablet: 'text-6xl md:text-8xl',
      desktop: 'text-8xl md:text-9xl',
      xl: 'text-9xl md:text-10xl'
    },
    color: 'bg-gradient-to-r from-indigo-900 via-purple-800 to-gray-800',
    textShadow: '0 0 25px rgba(55,48,163,0.8), 0 4px 8px rgba(0,0,0,0.6)',
    letterSpacing: 'tracking-wide',
    lineHeight: 'leading-tight',
    textTransform: 'capitalize'
  },
  drama: {
    fontFamily: '"Playfair Display", "Crimson Text", "Lora", serif',
    fontWeight: '600',
    fontSize: {
      mobile: 'text-4xl md:text-6xl',
      tablet: 'text-6xl md:text-8xl',
      desktop: 'text-8xl md:text-9xl',
      xl: 'text-9xl md:text-10xl'
    },
    color: 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600',
    textShadow: '0 0 25px rgba(37,99,235,0.8), 0 2px 4px rgba(0,0,0,0.4)',
    letterSpacing: 'tracking-normal',
    lineHeight: 'leading-normal',
    textTransform: 'none'
  }
};

// Page-specific font configurations
export const PAGE_FONT_CONFIGS = {
  home: {
    heroTitle: {
      fontFamily: '"Montserrat", "Inter", sans-serif',
      fontWeight: '800',
      fontSize: {
        mobile: 'text-6xl md:text-8xl',
        tablet: 'text-8xl md:text-10xl',
        desktop: 'text-10xl md:text-12xl',
        xl: 'text-12xl md:text-14xl'
      },
      color: 'bg-gradient-to-r from-white via-gray-100 to-red-400',
      textShadow: '0 0 30px rgba(255,255,255,0.5), 0 4px 8px rgba(0,0,0,0.8)',
      letterSpacing: 'tracking-tight',
      lineHeight: 'leading-none',
      textTransform: 'none'
    },
    sectionTitle: {
      fontFamily: '"Inter", "Roboto", sans-serif',
      fontWeight: '700',
      fontSize: {
        mobile: 'text-xl md:text-2xl',
        tablet: 'text-2xl md:text-3xl',
        desktop: 'text-3xl md:text-4xl',
        xl: 'text-4xl md:text-5xl'
      },
      color: 'text-white',
      textShadow: '0 2px 4px rgba(0,0,0,0.6)',
      letterSpacing: 'tracking-normal',
      lineHeight: 'leading-tight',
      textTransform: 'none'
    },
    description: {
      fontFamily: '"Inter", "Roboto", sans-serif',
      fontWeight: '400',
      fontSize: {
        mobile: 'text-sm md:text-base',
        tablet: 'text-base md:text-lg',
        desktop: 'text-lg md:text-xl',
        xl: 'text-xl md:text-2xl'
      },
      color: 'text-gray-300',
      textShadow: '0 1px 2px rgba(0,0,0,0.4)',
      letterSpacing: 'tracking-normal',
      lineHeight: 'leading-relaxed',
      textTransform: 'none'
    }
  },
  movies: {
    heroTitle: {
      fontFamily: '"Bebas Neue", "Oswald", sans-serif',
      fontWeight: '700',
      fontSize: {
        mobile: 'text-6xl md:text-8xl',
        tablet: 'text-8xl md:text-10xl',
        desktop: 'text-10xl md:text-12xl',
        xl: 'text-12xl md:text-14xl'
      },
      color: 'bg-gradient-to-r from-red-600 via-orange-500 to-yellow-400',
      textShadow: '0 0 40px rgba(239,68,68,0.8), 0 6px 12px rgba(0,0,0,0.8)',
      letterSpacing: 'tracking-wider',
      lineHeight: 'leading-none',
      textTransform: 'uppercase'
    },
    sectionTitle: {
      fontFamily: '"Roboto Condensed", "Oswald", sans-serif',
      fontWeight: '600',
      fontSize: {
        mobile: 'text-xl md:text-2xl',
        tablet: 'text-2xl md:text-3xl',
        desktop: 'text-3xl md:text-4xl',
        xl: 'text-4xl md:text-5xl'
      },
      color: 'text-red-400',
      textShadow: '0 2px 4px rgba(0,0,0,0.6)',
      letterSpacing: 'tracking-wide',
      lineHeight: 'leading-tight',
      textTransform: 'uppercase'
    },
    description: {
      fontFamily: '"Roboto", "Open Sans", sans-serif',
      fontWeight: '400',
      fontSize: {
        mobile: 'text-sm md:text-base',
        tablet: 'text-base md:text-lg',
        desktop: 'text-lg md:text-xl',
        xl: 'text-xl md:text-2xl'
      },
      color: 'text-gray-300',
      textShadow: '0 1px 2px rgba(0,0,0,0.4)',
      letterSpacing: 'tracking-normal',
      lineHeight: 'leading-relaxed',
      textTransform: 'none'
    }
  },
  'tv-series': {
    heroTitle: {
      fontFamily: '"Exo 2", "Rajdhani", sans-serif',
      fontWeight: '600',
      fontSize: {
        mobile: 'text-6xl md:text-8xl',
        tablet: 'text-8xl md:text-10xl',
        desktop: 'text-10xl md:text-12xl',
        xl: 'text-12xl md:text-14xl'
      },
      color: 'bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500',
      textShadow: '0 0 35px rgba(59,130,246,0.8), 0 4px 8px rgba(0,0,0,0.8)',
      letterSpacing: 'tracking-wide',
      lineHeight: 'leading-none',
      textTransform: 'none'
    },
    sectionTitle: {
      fontFamily: '"Exo 2", "Roboto", sans-serif',
      fontWeight: '500',
      fontSize: {
        mobile: 'text-xl md:text-2xl',
        tablet: 'text-2xl md:text-3xl',
        desktop: 'text-3xl md:text-4xl',
        xl: 'text-4xl md:text-5xl'
      },
      color: 'text-blue-400',
      textShadow: '0 2px 4px rgba(0,0,0,0.6)',
      letterSpacing: 'tracking-normal',
      lineHeight: 'leading-tight',
      textTransform: 'none'
    },
    description: {
      fontFamily: '"Inter", "Roboto", sans-serif',
      fontWeight: '400',
      fontSize: {
        mobile: 'text-sm md:text-base',
        tablet: 'text-base md:text-lg',
        desktop: 'text-lg md:text-xl',
        xl: 'text-xl md:text-2xl'
      },
      color: 'text-gray-300',
      textShadow: '0 1px 2px rgba(0,0,0,0.4)',
      letterSpacing: 'tracking-normal',
      lineHeight: 'leading-relaxed',
      textTransform: 'none'
    }
  }
};

// Utility functions
export const getGenreFontStyle = (genre: string): FontStyle => {
  const normalizedGenre = genre.toLowerCase().replace(/\s+/g, '-');
  return GENRE_FONTS[normalizedGenre as keyof typeof GENRE_FONTS] || GENRE_FONTS.drama;
};

export const getPageFontConfig = (pageType: string): PageFontConfig => {
  return PAGE_FONT_CONFIGS[pageType as keyof typeof PAGE_FONT_CONFIGS] || PAGE_FONT_CONFIGS.home;
};

export const getFontStyleForMedia = (media: Media, pageType: string = 'home'): FontStyle => {
  if (media.genres && media.genres.length > 0) {
    const primaryGenre = media.genres[0].name;
    return getGenreFontStyle(primaryGenre);
  }
  
  // Fallback to page-specific default
  const pageConfig = getPageFontConfig(pageType);
  return pageConfig.heroTitle;
};

export const getTitleSizeByLength = (title: string, fontStyle: any) => {
  // Dynamic sizing based on text length to prevent overflow
  // Ensures text fits properly without being hidden
  const wordCount = title.split(' ').length;
  const charCount = title.length;
  
  // Very long titles or many words - significantly increased sizes
  if (charCount > 60 || wordCount > 8) return 'text-lg md:text-xl lg:text-2xl xl:text-3xl leading-tight';
  if (charCount > 45 || wordCount > 6) return 'text-xl md:text-2xl lg:text-3xl xl:text-4xl leading-tight';
  if (charCount > 30 || wordCount > 4) return 'text-2xl md:text-3xl lg:text-4xl xl:text-5xl leading-tight';
  if (charCount > 20 || wordCount > 3) return 'text-3xl md:text-4xl lg:text-5xl xl:text-6xl leading-tight';
  if (charCount > 15) return 'text-4xl md:text-5xl lg:text-6xl xl:text-7xl leading-tight';
  
  // Short titles can be even larger
  return 'text-5xl md:text-6xl lg:text-7xl xl:text-8xl leading-tight';
};

// CSS class generator
export const generateFontClasses = (style: FontStyle, titleLength?: number): string => {
  const sizeClass = titleLength ? getTitleSizeByLength('x'.repeat(titleLength), style) : style.fontSize.desktop;
  
  return [
    sizeClass,
    style.fontWeight,
    style.letterSpacing,
    style.lineHeight,
    style.textTransform,
    style.fontVariant,
    'font-black text-transparent bg-clip-text',
    style.color
  ].filter(Boolean).join(' ');
};

// Google Fonts import URL generator
export const getGoogleFontsUrl = (): string => {
  const fonts = [
    'Montserrat:wght@400;600;700;800;900',
    'Inter:wght@400;500;600;700;800',
    'Bebas+Neue:wght@400',
    'Oswald:wght@400;500;600;700',
    'Orbitron:wght@400;700;900',
    'Exo+2:wght@400;500;600;700;800',
    'Rajdhani:wght@400;500;600;700',
    'Cinzel:wght@400;500;600;700',
    'Dancing+Script:wght@400;500;600;700',
    'Fredoka+One:wght@400',
    'Playfair+Display:wght@400;500;600;700;800',
    'Crimson+Text:wght@400;600;700',
    'Source+Sans+Pro:wght@400;600;700',
    'Roboto+Condensed:wght@400;500;600;700',
    'Space+Mono:wght@400;700'
  ];
  
  return `https://fonts.googleapis.com/css2?${fonts.map(font => `family=${font}`).join('&')}&display=swap`;
};
