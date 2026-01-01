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
    | 'tmdb_now_airing_tv';

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
}

export interface NotificationResponse {
    notifications: Notification[];
}

export interface NotificationCountResponse {
    count: number;
}
