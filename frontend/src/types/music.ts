export interface Track {
  id: number;
  youtube_id: string;
  title: string;
  artist: string;
  duration: number; // in seconds
  thumbnail_url: string;
  view_count: number;
  like_count: number;
  description: string;
  published_at: string;
  created_at: string;
  updated_at: string;
}

export interface Playlist {
  id: number;
  name: string;
  description: string;
  cover_url: string;
  is_public: boolean;
  user_id: string;
  tracks: Track[];
  created_at: string;
  updated_at: string;
}

export interface RecentlyPlayed {
  id: number;
  user_id: string;
  track_id: number;
  track: Track;
  played_at: string;
}

export interface MusicPlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  queue: Track[];
  currentIndex: number;
  shuffle: boolean;
  repeat: 'none' | 'one' | 'all';
}