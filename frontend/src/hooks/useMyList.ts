import { useState, useEffect, useCallback } from 'react';
import { Media } from '@/types/media';
import { getApiUrl } from '@/lib/api';

export interface MyListItem {
  id: number;
  media_id: number;
  user_id: number;
  added_at: string;
  media: Media;
}

export const useMyList = () => {
  const [myList, setMyList] = useState<MyListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = getApiUrl();

  // Fetch user's My List
  const fetchMyList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${apiUrl}/api/mylist`);
      if (!response.ok) {
        throw new Error('Failed to fetch My List');
      }
      const data = await response.json();
      setMyList(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setMyList([]);
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  // Add media to My List
  const addToMyList = useCallback(async (mediaId: number): Promise<boolean> => {
    try {
      const response = await fetch(`${apiUrl}/api/mylist/${mediaId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to add to My List');
      }
      
      // Refresh the list
      await fetchMyList();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [apiUrl, fetchMyList]);

  // Remove media from My List
  const removeFromMyList = useCallback(async (mediaId: number): Promise<boolean> => {
    try {
      const response = await fetch(`${apiUrl}/api/mylist/${mediaId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to remove from My List');
      }
      
      // Refresh the list
      await fetchMyList();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [apiUrl, fetchMyList]);

  // Check if media is in My List
  const checkInMyList = useCallback(async (mediaId: number): Promise<boolean> => {
    try {
      const response = await fetch(`${apiUrl}/api/mylist/check/${mediaId}`);
      if (!response.ok) {
        return false;
      }
      const data = await response.json();
      return data.inList || false;
    } catch (err) {
      return false;
    }
  }, [apiUrl]);

  // Toggle media in/out of My List
  const toggleMyList = useCallback(async (mediaId: number): Promise<boolean> => {
    const isInList = await checkInMyList(mediaId);
    if (isInList) {
      return await removeFromMyList(mediaId);
    } else {
      return await addToMyList(mediaId);
    }
  }, [checkInMyList, addToMyList, removeFromMyList]);

  // Load My List on mount
  useEffect(() => {
    fetchMyList();
  }, [fetchMyList]);

  return {
    myList,
    loading,
    error,
    fetchMyList,
    addToMyList,
    removeFromMyList,
    checkInMyList,
    toggleMyList,
  };
};
