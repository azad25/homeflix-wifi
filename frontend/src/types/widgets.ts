// Widget types and interfaces for Homeflix widget system

export type WidgetType =
    | 'featured-banner'
    | 'half-banner'
    | 'backdrop-slideshow'
    | 'trending-slideshow'
    | 'movie-grid'
    | 'homeflix-grid'
    | 'genre-based'
    | 'coming-soon'
    | 'new-releases'
    | 'popular'
    | 'recently-added'
    | 'recently-watched'
    | 'continue-watching'
    | 'trailer'
    | 'preview-video'
    | 'media-trailer'
    | 'mixed-video'
    | 'notifications';

export type PageType = 'home' | 'movies' | 'tv-shows' | 'browse' | 'new-popular' | 'my-list' | (string & {});

export type LayoutType = 'full' | 'half' | 'third';

export type DataSourceType = 'local' | 'tmdb' | 'trending' | 'popular' | 'recent' | 'recently-played' | 'recommendations' | 'now-playing' | 'upcoming' | 'top-rated';

export type ContentType = 'movies' | 'tv-shows' | 'mixed' | 'tmdb';

export type ColorScheme = 'auto' | 'dark' | 'light' | 'custom';

export interface WidgetConfig {
    title?: string;
    subtitle?: string;
    showLogo?: boolean;
    showDescription?: boolean;
    showRating?: boolean;
    showYear?: boolean;
    showGenres?: boolean;
    autoPlay?: boolean;
    autoScroll?: boolean;
    scrollInterval?: number; // in seconds
    genreFilter?: string[];
    languageFilter?: string[];
    countryFilter?: string[];
    yearFilter?: number;
    ratingFilter?: number;
    customGradient?: string;
    animationStyle?: 'fade' | 'slide' | 'parallax';
    // Hero video widget specific
    heroMode?: 'preview' | 'trailer' | 'mixed';
    slideDuration?: number;
    muteByDefault?: boolean;
    // Notification widget specific
    notificationTypes?: string[];
    showTimestamp?: boolean;
    showNotificationIcon?: boolean;
    highlightStyle?: 'banner' | 'card' | 'minimal';
    // Selected content for widgets
    selectedContent?: any[];
    selectedGenres?: number[];
    selectedLanguages?: string[];
    selectedCountries?: string[];
}

export interface Widget {
    id: number;
    name: string;
    type: WidgetType;
    page: PageType;
    position: number;
    enabled: boolean;
    config: string; // JSON string
    contentType: ContentType;
    dataSource: DataSourceType;
    maxItems: number;
    layout: LayoutType;
    colorScheme: ColorScheme;
    created_at?: string;
    updated_at?: string;
}

export interface WidgetMeta {
    types: { type: string; name: string; description: string }[];
    pages: { page: string; name: string }[];
    layouts: { layout: string; name: string; description: string }[];
}

// Helper to parse widget config
export function parseWidgetConfig(config: string): WidgetConfig {
    try {
        return JSON.parse(config) as WidgetConfig;
    } catch {
        return {};
    }
}

// Helper to stringify widget config
export function stringifyWidgetConfig(config: WidgetConfig): string {
    return JSON.stringify(config);
}

// Widget display props
export interface WidgetDisplayProps {
    widget: Widget;
    className?: string;
}

export interface PageDefinition {
    id: number;
    slug: string;
    title: string;
    description?: string;
    is_default?: boolean;
    is_nav_visible: boolean;
    nav_order: number;
    layout_config?: string;
    widget_layout?: string;
    created_at?: string;
    updated_at?: string;
}

// Extracted dominant color from logo for theming
export interface DominantColors {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
}

// Default color palettes by genre
export const genreColorPalettes: Record<string, DominantColors> = {
    action: {
        primary: '#e50914',
        secondary: '#b8860b',
        accent: '#ff4500',
        background: 'linear-gradient(135deg, #1a0000 0%, #330000 50%, #000000 100%)',
        text: '#ffffff',
    },
    comedy: {
        primary: '#f5c518',
        secondary: '#ff8c00',
        accent: '#ffd700',
        background: 'linear-gradient(135deg, #1a1500 0%, #332a00 50%, #000000 100%)',
        text: '#ffffff',
    },
    drama: {
        primary: '#7b68ee',
        secondary: '#483d8b',
        accent: '#9370db',
        background: 'linear-gradient(135deg, #0d0d1a 0%, #1a1a33 50%, #000000 100%)',
        text: '#ffffff',
    },
    horror: {
        primary: '#8b0000',
        secondary: '#2f0000',
        accent: '#dc143c',
        background: 'linear-gradient(135deg, #0a0000 0%, #1a0000 50%, #000000 100%)',
        text: '#ffffff',
    },
    scifi: {
        primary: '#00bfff',
        secondary: '#1e90ff',
        accent: '#00ced1',
        background: 'linear-gradient(135deg, #000d1a 0%, #001a33 50%, #000000 100%)',
        text: '#ffffff',
    },
    romance: {
        primary: '#ff69b4',
        secondary: '#db7093',
        accent: '#ff1493',
        background: 'linear-gradient(135deg, #1a0d14 0%, #330d1a 50%, #000000 100%)',
        text: '#ffffff',
    },
    thriller: {
        primary: '#4169e1',
        secondary: '#191970',
        accent: '#6495ed',
        background: 'linear-gradient(135deg, #0a0a1a 0%, #14142b 50%, #000000 100%)',
        text: '#ffffff',
    },
    default: {
        primary: '#e50914',
        secondary: '#831010',
        accent: '#ff6b6b',
        background: 'linear-gradient(135deg, #141414 0%, #1a1a1a 50%, #000000 100%)',
        text: '#ffffff',
    },
};

// Get color palette by genre
export function getColorPaletteByGenre(genres?: string[]): DominantColors {
    if (!genres || genres.length === 0) return genreColorPalettes.default;

    const primaryGenre = genres[0].toLowerCase();

    if (primaryGenre.includes('action')) return genreColorPalettes.action;
    if (primaryGenre.includes('comedy')) return genreColorPalettes.comedy;
    if (primaryGenre.includes('drama')) return genreColorPalettes.drama;
    if (primaryGenre.includes('horror')) return genreColorPalettes.horror;
    if (primaryGenre.includes('sci') || primaryGenre.includes('fiction')) return genreColorPalettes.scifi;
    if (primaryGenre.includes('romance')) return genreColorPalettes.romance;
    if (primaryGenre.includes('thriller')) return genreColorPalettes.thriller;

    return genreColorPalettes.default;
}
