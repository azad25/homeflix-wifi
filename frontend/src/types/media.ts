export interface CastMember {
  id: number;
  name: string;
  character?: string;
  profile_path?: string;
  order?: number;
}

export interface Media {
  id: number;
  title: string;
  original_title?: string;
  type: 'movie' | 'tv' | 'episode';
  file_path?: string;
  file_size?: number;
  duration?: number;
  
  // Enhanced metadata fields matching media.json
  tagline?: string;
  short_desc?: string;
  long_desc?: string;
  description?: string;
  year?: number;
  release_year?: number;
  release_date?: string;
  rating?: number;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  country?: string;
  language?: string;
  quality?: string; // HD, 4K, SD, HDR
  
  // Cast and crew
  cast?: CastMember[];
  stars?: string[];
  director?: string | string[];
  
  // Genres
  genres?: Genre[];
  genre_names?: string[];
  genre_ids?: number[];
  
  // Technical info
  resolution?: string;
  codec?: string;
  bitrate?: number;
  
  // Media assets
  thumbnail_path?: string;
  preview_path?: string;
  preview_clip_path?: string;
  poster_path?: string;
  backdrop_path?: string;
  banner_path?: string;
  trailer_path?: string;
  
  // Series info
  series_id?: number;
  series?: Series;
  season?: number;
  episode?: number;
  season_number?: number;
  episode_number?: number;
  
  // Additional metadata
  imdb_id?: string;
  tmdb_id?: number;
  adult?: boolean;
  original_language?: string;
  
  // For recommendations
  recommendations?: Media[];
  similar?: Media[];
  
  // Tracking
  view_count?: number;
  last_viewed?: string;
  last_updated?: string;
  subtitles?: Subtitle[];
}

export interface Subtitle {
  id?: number;
  language: string;
  file_path: string;
}

export interface Genre {
  id?: number;
  name: string;
}

export interface Series {
  id: number;
  title: string;
  description?: string;
  total_seasons: number;
  total_episodes: number;
}
