import { useState, useCallback } from 'react';
import { getApiUrl } from '@/lib/api';

export interface PlaybackProgress {
  id: number;
  media_id: number;
  user_id: number;
  progress_time: number;
  total_duration: number;
  progress_percentage: number;
  last_updated: string;
  completed: boolean;
}

export const usePlaybackProgress = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = getApiUrl();

  // Update playback progress
  const updateProgress = useCallback(async (
    mediaId: number,
    currentTime: number,
    totalDuration: number,
    userId: number = 1
  ): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const progressPercentage = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;
      const completed = progressPercentage >= 90; // Mark as completed if 90% watched

      const response = await fetch(`${apiUrl}/api/playback/progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          media_id: mediaId,
          user_id: userId,
          progress_time: currentTime,
          total_duration: totalDuration,
          progress_percentage: progressPercentage,
          completed,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update playback progress');
      }

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  // Get playback progress for a specific media
  const getProgress = useCallback(async (
    mediaId: number,
    userId: number = 1
  ): Promise<PlaybackProgress | null> => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${apiUrl}/api/playback/progress/${mediaId}?user_id=${userId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          return null; // No progress found
        }
        throw new Error('Failed to get playback progress');
      }

      const data = await response.json();
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  // Track view (when user starts watching)
  const trackView = useCallback(async (
    mediaId: number,
    duration: number = 0,
    startTime: number = 0,
    userId: number = 1
  ): Promise<boolean> => {
    try {
      const response = await fetch(`${apiUrl}/api/track-view/${mediaId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          duration,
          start_time: startTime,
          timestamp: new Date().toISOString(),
        }),
      });

      return response.ok;
    } catch (err) {
      console.error('Failed to track view:', err);
      return false;
    }
  }, [apiUrl]);

  // Get watch history
  const getWatchHistory = useCallback(async (
    userId: number = 1,
    limit: number = 50
  ): Promise<PlaybackProgress[]> => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${apiUrl}/api/playback/history?user_id=${userId}&limit=${limit}`);
      
      if (!response.ok) {
        throw new Error('Failed to get watch history');
      }

      const data = await response.json();
      return data || [];
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return [];
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  // Get watch statistics
  const getWatchStats = useCallback(async (
    userId: number = 1
  ): Promise<any> => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${apiUrl}/api/playback/stats?user_id=${userId}`);
      
      if (!response.ok) {
        throw new Error('Failed to get watch statistics');
      }

      const data = await response.json();
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  return {
    loading,
    error,
    updateProgress,
    getProgress,
    trackView,
    getWatchHistory,
    getWatchStats,
  };
};
