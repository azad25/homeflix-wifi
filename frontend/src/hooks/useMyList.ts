import { useState, useEffect, useCallback } from 'react';
import { getApiUrl } from '@/lib/api';
import { Media } from '@/types/media';

interface MyListItem {
  id: number;
  user_id: number;
  media_id: number;
  media_type: string;
  notes: string;
  priority: number;
  added_at: string;
  media: Media;
}

interface Collection {
  id: number;
  name: string;
  description: string;
  user_id: number;
  is_public: boolean;
  cover_image: string;
  tags: string;
  item_count: number;
  created_at: string;
  updated_at: string;
}

export function useMyList() {
  const [myList, setMyList] = useState<Set<number>>(new Set());
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = getApiUrl();

  // Fetch my list from backend
  const fetchMyList = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${apiUrl}/api/mylist`, {
        headers: {
          'X-User-ID': '1' // Default user for now
        }
      });

      if (response.ok) {
        const data: MyListItem[] = await response.json();
        const mediaIds = new Set(data.map(item => item.media_id));
        setMyList(mediaIds);
      } else if (response.status === 404) {
        // My list endpoint doesn't exist, use empty set
        setMyList(new Set());
      } else {
        throw new Error('Failed to fetch My List');
      }
    } catch (error) {
      console.error('Error fetching My List:', error);
      setError('Failed to load My List');
      // Don't throw, just set empty list
      setMyList(new Set());
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  // Fetch collections from backend
  const fetchCollections = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/api/collections`, {
        headers: {
          'X-User-ID': '1'
        }
      });

      if (response.ok) {
        const data: Collection[] = await response.json();
        setCollections(data || []);
      } else if (response.status === 404) {
        // Collections endpoint doesn't exist, use empty array
        setCollections([]);
      }
    } catch (error) {
      console.error('Error fetching collections:', error);
      setCollections([]);
    }
  }, [apiUrl]);

  // Check if media is in my list
  const isInMyList = useCallback((mediaId: number): boolean => {
    return myList.has(mediaId);
  }, [myList]);

  // Add to my list
  const addToMyList = useCallback(async (mediaId: number): Promise<boolean> => {
    try {
      const response = await fetch(`${apiUrl}/api/mylist/${mediaId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': '1'
        }
      });

      if (response.ok) {
        setMyList(prev => new Set([...prev, mediaId]));
        return true;
      } else if (response.status === 404) {
        // Endpoint doesn't exist, use local storage fallback
        const wishlist = JSON.parse(localStorage.getItem('homeflix-wishlist') || '[]');
        if (!wishlist.includes(mediaId)) {
          wishlist.push(mediaId);
          localStorage.setItem('homeflix-wishlist', JSON.stringify(wishlist));
          setMyList(prev => new Set([...prev, mediaId]));
        }
        return true;
      } else {
        throw new Error('Failed to add to My List');
      }
    } catch (error) {
      console.error('Error adding to My List:', error);
      // Fallback to local storage
      try {
        const wishlist = JSON.parse(localStorage.getItem('homeflix-wishlist') || '[]');
        if (!wishlist.includes(mediaId)) {
          wishlist.push(mediaId);
          localStorage.setItem('homeflix-wishlist', JSON.stringify(wishlist));
          setMyList(prev => new Set([...prev, mediaId]));
        }
        return true;
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
        return false;
      }
    }
  }, [apiUrl]);

  // Remove from my list
  const removeFromMyList = useCallback(async (mediaId: number): Promise<boolean> => {
    try {
      const response = await fetch(`${apiUrl}/api/mylist/${mediaId}`, {
        method: 'DELETE',
        headers: {
          'X-User-ID': '1'
        }
      });

      if (response.ok) {
        setMyList(prev => {
          const newSet = new Set(prev);
          newSet.delete(mediaId);
          return newSet;
        });
        return true;
      } else if (response.status === 404) {
        // Endpoint doesn't exist, use local storage fallback
        const wishlist = JSON.parse(localStorage.getItem('homeflix-wishlist') || '[]');
        const updatedWishlist = wishlist.filter((id: number) => id !== mediaId);
        localStorage.setItem('homeflix-wishlist', JSON.stringify(updatedWishlist));
        setMyList(prev => {
          const newSet = new Set(prev);
          newSet.delete(mediaId);
          return newSet;
        });
        return true;
      } else {
        throw new Error('Failed to remove from My List');
      }
    } catch (error) {
      console.error('Error removing from My List:', error);
      // Fallback to local storage
      try {
        const wishlist = JSON.parse(localStorage.getItem('homeflix-wishlist') || '[]');
        const updatedWishlist = wishlist.filter((id: number) => id !== mediaId);
        localStorage.setItem('homeflix-wishlist', JSON.stringify(updatedWishlist));
        setMyList(prev => {
          const newSet = new Set(prev);
          newSet.delete(mediaId);
          return newSet;
        });
        return true;
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
        return false;
      }
    }
  }, [apiUrl]);

  // Toggle my list status
  const toggleMyList = useCallback(async (mediaId: number): Promise<boolean> => {
    const isCurrentlyInList = isInMyList(mediaId);
    
    if (isCurrentlyInList) {
      return await removeFromMyList(mediaId);
    } else {
      return await addToMyList(mediaId);
    }
  }, [isInMyList, addToMyList, removeFromMyList]);

  // Add to collection
  const addToCollection = useCallback(async (collectionId: number, mediaId: number): Promise<boolean> => {
    try {
      const response = await fetch(`${apiUrl}/api/collections/${collectionId}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': '1'
        },
        body: JSON.stringify({
          media_id: mediaId
        })
      });

      if (response.ok) {
        // Refresh collections to update counts
        fetchCollections();
        return true;
      } else {
        throw new Error('Failed to add to collection');
      }
    } catch (error) {
      console.error('Error adding to collection:', error);
      return false;
    }
  }, [apiUrl, fetchCollections]);

  // Initialize data on mount
  useEffect(() => {
    fetchMyList();
    fetchCollections();
  }, [fetchMyList, fetchCollections]);

  // Load from localStorage as fallback if backend fails
  useEffect(() => {
    if (myList.size === 0 && !loading) {
      try {
        const wishlist = JSON.parse(localStorage.getItem('homeflix-wishlist') || '[]');
        if (wishlist.length > 0) {
          setMyList(new Set(wishlist));
        }
      } catch (error) {
        console.error('Error loading wishlist from localStorage:', error);
      }
    }
  }, [myList.size, loading]);

  return {
    myList,
    collections,
    loading,
    error,
    isInMyList,
    addToMyList,
    removeFromMyList,
    toggleMyList,
    addToCollection,
    fetchMyList,
    fetchCollections
  };
}