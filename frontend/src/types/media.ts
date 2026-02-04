export interface Media {
  id: number;
  title: string;
  name?: string;
  original_title?: string;
  type: string; // "movie" or "episode"
  media_type?: string; // For TMDB content: "movie" or "tv"
  file_path?: string;
  file_size?: number;
  duration?: number;

  // Enhanced metadata fields matching media.json
  tagline?: string;
  short_desc?: string;
  long_desc?: string;
  description?: string;
  overview?: string;
  trailer_url?: string;
  year?: number;
  release_date?: string;
  first_air_date?: string;
  rating?: number;
  vote_average?: number;
  country?: string;
  language?: string;
  quality?: string; // HD, 4K, SD, HDR
  quality_tags?: string[]; // Netflix-style quality tags like [HDR], [Dolby], [UHD]

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
  tmdb_id?: number; // For TMDB movies
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
  backdrop_path?: string;
  trailer_path?: string;
  poster_path?: string;
  poster_url?: string | null; // For TMDB movies

  // TMDB Integration fields for local media
  tmdb_backdrop_url?: string; // TMDB backdrop image URL
  tmdb_poster_url?: string;   // TMDB poster image URL (stored when downloading from TMDB)
  tmdb_trailer_url?: string;  // TMDB trailer video URL
  tmdb_logo_url?: string;     // TMDB logo image URL
  logo_path?: string;         // Local path to movie logo image
  network?: string;           // Original network/channel (for TV series)

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
  created_at?: string;
  updated_at?: string;
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
  year?: number;
  first_air_date?: string;
  rating?: number;
  total_seasons: number;
  total_episodes: number;
  genres?: Genre[];
  poster_path?: string;
  backdrop_path?: string;
  thumbnail_path?: string;
  banner_path?: string;
  tmdb_backdrop_url?: string;
  tmdb_poster_url?: string;
  tmdb_logo_url?: string;
  logo_path?: string;
  network?: string;
  status?: string;
  duration?: number;
}
