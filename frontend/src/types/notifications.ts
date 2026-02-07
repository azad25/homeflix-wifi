export type NotificationType =
    | 'new_movies'
    | 'new_episodes'
    | 'movie_suggestion'
    | 'single_movie_suggestion'
    | 'watch_again'
    | 'download_complete'
    | 'tmdb_upcoming'
    | 'tmdb_now_playing'
    | 'tmdb_trending'
    | 'tmdb_upcoming_tv'
    | 'tmdb_now_airing_tv'
    | 'continue_watching'
    | 'recently_added'
    | 'coming_soon'
    | 'genre_based'
    | 'tmdb_coming_soon'
    | 'local_trending';

export interface Notification {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    movie_ids?: number[];
    series_id?: number;
    series_name?: string;
    episode_ids?: number[];
    tmdb_ids?: number[];
    tmdb_titles?: string[];
    timestamp: number;
    read: boolean;
    
    // Enhanced data fields from backend
    backdrop_url?: string;
    poster_url?: string;
    logo_url?: string;
    trailer_key?: string;
    rating?: number;
    release_date?: string;
    year?: number;
    runtime?: number;
    genres?: string[];
    overview?: string;
    tagline?: string;
    language?: string;
    popularity?: number;
    companies?: string[];
    priority?: 'high' | 'medium' | 'low';
    category?: 'trending' | 'new' | 'recommended' | 'watchlist';
    progress?: number;
    remaining_min?: number;
    days_until?: number;
    genre_highlight?: string;
    media_details?: Array<{
        id: number;
        title: string;
        poster_url: string;
        backdrop_url: string;
        rating: number;
        year: number;
        runtime: number;
        genres: string[];
        overview: string;
        source_type: string;
        source_id: string;
    }>;
}

export interface NotificationResponse {
    notifications: Notification[];
}

export interface NotificationCountResponse {
    count: number;
}
