import { Track, Playlist, RecentlyPlayed } from '@/types/music';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8252';

// Mock data for fallback when API is unavailable
const mockTracks: Track[] = [
  {
    id: 1,
    title: "Blinding Lights",
    artist: "The Weeknd",
    youtube_id: "4NRXx6U8ABQ",
    thumbnail_url: "https://i.ytimg.com/vi/4NRXx6U8ABQ/maxresdefault.jpg",
    duration: 200,
    view_count: 1500000000,
    like_count: 15000000,
    description: "Official music video for Blinding Lights by The Weeknd",
    published_at: "2019-11-29T00:00:00Z",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 2,
    title: "Shape of You",
    artist: "Ed Sheeran",
    youtube_id: "JGwWNGJdvx8",
    thumbnail_url: "https://i.ytimg.com/vi/JGwWNGJdvx8/maxresdefault.jpg",
    duration: 233,
    view_count: 5800000000,
    like_count: 58000000,
    description: "Official music video for Shape of You by Ed Sheeran",
    published_at: "2017-01-30T00:00:00Z",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 3,
    title: "Bad Guy",
    artist: "Billie Eilish",
    youtube_id: "DyDfgMOUjCI",
    thumbnail_url: "https://i.ytimg.com/vi/DyDfgMOUjCI/maxresdefault.jpg",
    duration: 194,
    view_count: 1200000000,
    like_count: 12000000,
    description: "Official music video for Bad Guy by Billie Eilish",
    published_at: "2019-03-29T00:00:00Z",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 4,
    title: "Watermelon Sugar",
    artist: "Harry Styles",
    youtube_id: "E07s5ZYygMg",
    thumbnail_url: "https://i.ytimg.com/vi/E07s5ZYygMg/maxresdefault.jpg",
    duration: 174,
    view_count: 800000000,
    like_count: 8000000,
    description: "Official music video for Watermelon Sugar by Harry Styles",
    published_at: "2020-05-18T00:00:00Z",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 5,
    title: "Levitating",
    artist: "Dua Lipa",
    youtube_id: "TUVcZfQe-Kw",
    thumbnail_url: "https://i.ytimg.com/vi/TUVcZfQe-Kw/maxresdefault.jpg",
    duration: 203,
    view_count: 900000000,
    like_count: 9000000,
    description: "Official music video for Levitating by Dua Lipa",
    published_at: "2020-10-01T00:00:00Z",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

export class MusicAPI {
  private static async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    try {
      const response = await fetch(`${API_BASE}/api/music${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'default-user',
          ...options?.headers,
        },
        ...options,
      });

      if (!response.ok) {
        console.warn(`Music API error: ${response.status} - falling back to mock data`);
        throw new Error(`API Error: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.warn('Music API request failed, using mock data:', error);
      // Return mock data structure
      return { tracks: mockTracks.slice(0, 5) } as T;
    }
  }

  static async searchTracks(query: string, limit = 25): Promise<Track[]> {
    try {
      const response = await this.request<{ tracks: Track[] }>(`/search?q=${encodeURIComponent(query)}&limit=${limit}`);
      return response.tracks;
    } catch (error) {
      // Return filtered mock data for search
      const filtered = mockTracks.filter(track => 
        track.title.toLowerCase().includes(query.toLowerCase()) ||
        track.artist.toLowerCase().includes(query.toLowerCase())
      );
      return filtered.length > 0 ? filtered : mockTracks.slice(0, Math.min(limit, 3));
    }
  }

  static async getTrendingTracks(limit = 50): Promise<Track[]> {
    try {
      const response = await this.request<{ tracks: Track[] }>(`/trending?limit=${limit}`);
      return response.tracks;
    } catch (error) {
      return mockTracks.slice(0, Math.min(limit, mockTracks.length));
    }
  }

  static async createPlaylist(name: string, description = ''): Promise<Playlist> {
    return this.request<Playlist>('/playlists', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    });
  }

  static async getPlaylists(): Promise<Playlist[]> {
    const response = await this.request<{ playlists: Playlist[] }>('/playlists');
    return response.playlists;
  }

  static async getPlaylist(id: number): Promise<Playlist> {
    return this.request<Playlist>(`/playlists/${id}`);
  }

  static async addTrackToPlaylist(playlistId: number, trackId: number): Promise<void> {
    await this.request(`/playlists/${playlistId}/tracks`, {
      method: 'POST',
      body: JSON.stringify({ track_id: trackId }),
    });
  }

  static async likeTrack(trackId: number): Promise<void> {
    await this.request(`/tracks/${trackId}/like`, {
      method: 'POST',
    });
  }

  static async getLikedTracks(): Promise<Track[]> {
    const response = await this.request<{ tracks: Track[] }>('/tracks/liked');
    return response.tracks;
  }

  static async playTrack(trackId: number): Promise<void> {
    await this.request(`/tracks/${trackId}/play`, {
      method: 'POST',
    });
  }

  static async getRecentlyPlayed(limit = 50): Promise<RecentlyPlayed[]> {
    const response = await this.request<{ tracks: RecentlyPlayed[] }>(`/tracks/recent?limit=${limit}`);
    return response.tracks;
  }

  static async getTrackStream(youtubeId: string): Promise<{ stream_url: string; youtube_id: string }> {
    return this.request<{ stream_url: string; youtube_id: string }>(`/tracks/${youtubeId}/stream`);
  }

  static formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  static formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  static async getTopCharts(limit = 50): Promise<Track[]> {
    try {
      const response = await this.request<{ tracks: Track[] }>(`/charts?limit=${limit}`);
      return response.tracks;
    } catch (error) {
      return mockTracks.slice(0, Math.min(limit, mockTracks.length));
    }
  }

  static async getNewReleases(limit = 30): Promise<Track[]> {
    try {
      const response = await this.request<{ tracks: Track[] }>(`/new-releases?limit=${limit}`);
      return response.tracks;
    } catch (error) {
      return mockTracks.slice(0, Math.min(limit, mockTracks.length));
    }
  }

  static async getGenreMusic(genre: string, limit = 25): Promise<Track[]> {
    try {
      const response = await this.request<{ tracks: Track[] }>(`/genre/${encodeURIComponent(genre)}?limit=${limit}`);
      return response.tracks;
    } catch (error) {
      return mockTracks.slice(0, Math.min(limit, mockTracks.length));
    }
  }

  static async getMoodMusic(mood: string, limit = 25): Promise<Track[]> {
    try {
      const response = await this.request<{ tracks: Track[] }>(`/mood/${encodeURIComponent(mood)}?limit=${limit}`);
      return response.tracks;
    } catch (error) {
      return mockTracks.slice(0, Math.min(limit, mockTracks.length));
    }
  }
}