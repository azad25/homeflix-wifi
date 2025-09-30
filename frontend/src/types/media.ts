export interface Media {
  id: number;
  title: string;
  type: string; // Allow any string to match API response
  file_path?: string;
  file_size?: number;
  duration?: number;
  description?: string;
  release_date?: string;
  rating?: number;
  genres?: Genre[];
  resolution?: string;
  codec?: string;
  bitrate?: number;
  thumbnail_path?: string;
  preview_path?: string;
  preview_clip_path?: string;
  poster_path?: string;
  series_id?: number;
  series?: Series;
  season_number?: number;
  episode_number?: number;
  view_count?: number;
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
