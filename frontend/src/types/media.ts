export interface Media {
  id: number;
  title: string;
  original_title?: string;
  type: string; // "movie" or "episode"
  file_path?: string;
  file_size?: number;
  duration?: number;
  
  // Enhanced metadata fields matching media.json
  tagline?: string;
  short_desc?: string;
  long_desc?: string;
  description?: string;
  year?: number;
  release_date?: string;
  rating?: number;
  country?: string;
  language?: string;
  quality?: string; // HD, 4K, SD, HDR
  
  // Cast and crew
  stars?: string[];
  director?: string[];
  cast?: string[];
  writers?: string[];
  producers?: string[];
  
  // Box office and financial data
  budget?: number;
  revenue?: number;
  box_office?: string;
  
  // Additional metadata
  status?: string;
  imdb_id?: string;
  homepage?: string;
  collection?: string;
  awards?: string[];
  certification?: string;
  runtime?: number;
  popularity?: number;
  vote_count?: number;
  adult?: boolean;
  
  // Genres
  genres?: Genre[];
  genre_names?: string[];
  
  // Technical info
  resolution?: string;
  codec?: string;
  bitrate?: number;
  
  // Media assets
  thumbnail_path?: string;
  preview_path?: string;
  preview_clip_path?: string;
  banner_path?: string;
  trailer_path?: string;
  
  // Series info
  series_id?: number;
  series?: Series;
  season?: number;
  episode?: number;
  season_number?: number;
  episode_number?: number;
  
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
