import { getApiUrl } from './api';

export interface PlaybackProgress {
  media_id: number;
  position: number;
  duration: number;
  progress: number;
  completed: boolean;
  last_watched: string;
}

export const updatePlaybackProgress = async (
  mediaId: number,
  position: number,
  duration: number,
  userID: string = '1'
): Promise<void> => {
  try {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/api/playback/progress`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': userID,
      },
      body: JSON.stringify({
        media_id: mediaId,
        position,
        duration,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to update playback progress');
    }
  } catch (error) {
    console.error('Error updating playback progress:', error);
  }
};

export const getPlaybackProgress = async (
  mediaId: number,
  userID: string = '1'
): Promise<PlaybackProgress | null> => {
  try {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/api/playback/progress/${mediaId}`, {
      headers: {
        'X-User-ID': userID,
      },
    });

    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.error('Error getting playback progress:', error);
    return null;
  }
};

export const trackView = async (
  mediaId: number,
  userID: string = '1'
): Promise<void> => {
  try {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/api/track-view/${mediaId}`, {
      method: 'POST',
      headers: {
        'X-User-ID': userID,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to track view');
    }
  } catch (error) {
    console.error('Error tracking view:', error);
  }
};

export const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

export const getContinueWatching = async (
  userID: string = '1',
  limit: number = 10
): Promise<PlaybackProgress[]> => {
  try {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/api/playback/continue?limit=${limit}`, {
      headers: {
        'X-User-ID': userID,
      },
    });

    if (response.ok) {
      return await response.json();
    }
    return [];
  } catch (error) {
    console.error('Error getting continue watching:', error);
    return [];
  }
};

export const getRecentlyWatched = async (
  userID: string = '1',
  limit: number = 20
): Promise<any[]> => {
  try {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/api/playback/recently-watched?limit=${limit}`, {
      headers: {
        'X-User-ID': userID,
      },
    });

    if (response.ok) {
      return await response.json();
    }
    return [];
  } catch (error) {
    console.error('Error getting recently watched:', error);
    return [];
  }
};

export const formatProgress = (progressSeconds: number, durationSeconds: number): number => {
  const progressPercent = (progressSeconds / durationSeconds) * 100;
  return Math.min(Math.max(progressPercent, 0), 100);
};
