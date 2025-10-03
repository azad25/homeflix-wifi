import { useState, useEffect, useCallback } from 'react';
import { Media } from '@/types/media';
import { getApiUrl } from '@/lib/api';

export interface ContinueWatchingItem {
  id: number;
  media_id: number;
  user_id: number;
  progress_time: number;
  total_duration: number;
  last_watched: string;
  media: Media;
}

export const useContinueWatching = () => {
  const [continueWatching, setContinueWatching] = useState<ContinueWatchingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = getApiUrl();

  // Fetch continue watching items
  const fetchContinueWatching = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${apiUrl}/api/playback/continue`);
      if (!response.ok) {
        // Silent fail - just return empty array
        console.log('Continue watching API not available, falling back to empty state');
        setContinueWatching([]);
        return;
      }
      const data = await response.json();
      setContinueWatching(data || []);
    } catch (err) {
      // Silent error handling - log but don't show to user
      console.log('Continue watching fetch failed:', err);
      setContinueWatching([]);
      setError(null); // Don't expose errors to UI
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  // Get progress percentage for a media item
  const getProgressPercentage = useCallback((item: ContinueWatchingItem): number => {
    if (!item.total_duration || item.total_duration === 0) return 0;
    return Math.min((item.progress_time / item.total_duration) * 100, 100);
  }, []);

  // Format time for display
  const formatTime = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Load continue watching on mount
  useEffect(() => {
    fetchContinueWatching();
  }, [fetchContinueWatching]);

  return {
    continueWatching,
    loading,
    error,
    fetchContinueWatching,
    getProgressPercentage,
    formatTime,
  };
};
