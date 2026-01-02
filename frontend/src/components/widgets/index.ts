// Widget components index - exports all widget components for easy importing

export { default as FeaturedBanner } from './FeaturedBanner';
export { default as HalfWidthBanner } from './HalfWidthBanner';
export { default as TrendingSlideshow } from './TrendingSlideshow';
export { default as ComingSoonBanner } from './ComingSoonBanner';
export { default as MovieGridWidget } from './MovieGridWidget';
export { default as HomeflixGrid } from './HomeflixGrid';
export { default as GenreBasedWidget } from './GenreBasedWidget';
export { default as BackdropSlideshow } from './BackdropSlideshow';
export { default as TrailerWidget } from './TrailerWidget';
export { default as RecentlyWatchedWidget } from './RecentlyWatchedWidget';
export { default as YouTubeTrailerWidget } from './YouTubeTrailerWidget';
export { default as NotificationWidget } from './NotificationWidget';

// Widget system components
export { default as BackendWidgetRenderer } from './BackendWidgetRenderer';
export { default as ImprovedWidgetRenderer } from './ImprovedWidgetRenderer';
export { default as WidgetRenderer } from './ImprovedWidgetRenderer'; // Alias for backward compatibility
export { default as AsyncWidgetLoader } from './AsyncWidgetLoader';
export { default as EnhancedWidgetConfigPanel } from './EnhancedWidgetConfigPanel';
export { default as WidgetPerformanceDashboard } from './WidgetPerformanceDashboard';
export { default as WidgetManagementButton } from './WidgetManagementButton';

// Re-export types
export * from '@/types/widgets';

// Widget type to component mapping
import FeaturedBanner from './FeaturedBanner';
import HalfWidthBanner from './HalfWidthBanner';
import TrendingSlideshow from './TrendingSlideshow';
import ComingSoonBanner from './ComingSoonBanner';
import MovieGridWidget from './MovieGridWidget';
import HomeflixGrid from './HomeflixGrid';
import GenreBasedWidget from './GenreBasedWidget';
import BackdropSlideshow from './BackdropSlideshow';
import TrailerWidget from './TrailerWidget';
import RecentlyWatchedWidget from './RecentlyWatchedWidget';
import NotificationWidget from './NotificationWidget';

export const widgetComponentMap = {
    'featured-banner': FeaturedBanner,
    'half-banner': HalfWidthBanner,
    'trending-slideshow': TrendingSlideshow,
    'coming-soon': ComingSoonBanner,
    'movie-grid': MovieGridWidget,
    'homeflix-grid': HomeflixGrid,
    'genre-based': GenreBasedWidget,
    'backdrop-slideshow': BackdropSlideshow,
    'trailer': TrailerWidget,
    'recently-watched': RecentlyWatchedWidget,
    'continue-watching': RecentlyWatchedWidget,
    'new-releases': MovieGridWidget,
    'popular': TrendingSlideshow,
    'recently-added': MovieGridWidget,
    'notifications': NotificationWidget,
} as const;

export type WidgetComponentType = keyof typeof widgetComponentMap;
