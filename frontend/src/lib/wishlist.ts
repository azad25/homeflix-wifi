"use client";

import { Media } from '@/types/media';

const WISHLIST_COOKIE_NAME = 'homeflix_wishlist';
const WISHLIST_DATA_COOKIE_NAME = 'homeflix_wishlist_data';
const COOKIE_EXPIRY_DAYS = 365; // 1 year

// Extended wishlist item interface for TMDB movies
interface WishlistItem {
  id: number;
  title: string;
  year?: number;
  rating?: number;
  genres?: Array<{ name: string }>;
  tmdb_id?: number;
  poster_path?: string;
  poster_url?: string | null;
  overview?: string;
}

// Cookie utility functions
export const setCookie = (name: string, value: string, days: number) => {
  if (typeof document === 'undefined') return;
  
  const expires = new Date();
  expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
};

export const getCookie = (name: string): string | null => {
  if (typeof document === 'undefined') return null;
  
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
};

export const deleteCookie = (name: string) => {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
};

// Get wishlist data (for TMDB movies with full data)
export const getWishlistData = (): WishlistItem[] => {
  try {
    const wishlistData = getCookie(WISHLIST_DATA_COOKIE_NAME);
    if (wishlistData) {
      return JSON.parse(wishlistData);
    }
    return [];
  } catch (error) {
    console.error('Error parsing wishlist data cookie:', error);
    return [];
  }
};

// Set wishlist data
const setWishlistData = (data: WishlistItem[]): void => {
  try {
    setCookie(WISHLIST_DATA_COOKIE_NAME, JSON.stringify(data), COOKIE_EXPIRY_DAYS);
  } catch (error) {
    console.error('Error setting wishlist data:', error);
  }
};

// Wishlist management functions
export const getWishlist = (): number[] => {
  try {
    const wishlistData = getCookie(WISHLIST_COOKIE_NAME);
    if (wishlistData) {
      return JSON.parse(wishlistData);
    }
    return [];
  } catch (error) {
    console.error('Error parsing wishlist cookie:', error);
    return [];
  }
};

export const addToWishlist = (mediaId: number, movieData?: WishlistItem): boolean => {
  try {
    const currentWishlist = getWishlist();
    if (!currentWishlist.includes(mediaId)) {
      const updatedWishlist = [...currentWishlist, mediaId];
      setCookie(WISHLIST_COOKIE_NAME, JSON.stringify(updatedWishlist), COOKIE_EXPIRY_DAYS);
      
      // If movie data is provided (for TMDB movies), store it separately
      if (movieData) {
        const currentWishlistData = getWishlistData();
        const updatedWishlistData = [...currentWishlistData, movieData];
        setWishlistData(updatedWishlistData);
      }
      
      return true;
    }
    return false; // Already in wishlist
  } catch (error) {
    console.error('Error adding to wishlist:', error);
    return false;
  }
};

export const removeFromWishlist = (mediaId: number): boolean => {
  try {
    const currentWishlist = getWishlist();
    const updatedWishlist = currentWishlist.filter(id => id !== mediaId);
    setCookie(WISHLIST_COOKIE_NAME, JSON.stringify(updatedWishlist), COOKIE_EXPIRY_DAYS);
    
    // Also remove from wishlist data if it exists
    const currentWishlistData = getWishlistData();
    const updatedWishlistData = currentWishlistData.filter(item => item.id !== mediaId);
    setWishlistData(updatedWishlistData);
    
    return true;
  } catch (error) {
    console.error('Error removing from wishlist:', error);
    return false;
  }
};

export const isInWishlist = (mediaId: number): boolean => {
  try {
    const currentWishlist = getWishlist();
    return currentWishlist.includes(mediaId);
  } catch (error) {
    console.error('Error checking wishlist:', error);
    return false;
  }
};

export const clearWishlist = (): boolean => {
  try {
    deleteCookie(WISHLIST_COOKIE_NAME);
    deleteCookie(WISHLIST_DATA_COOKIE_NAME);
    return true;
  } catch (error) {
    console.error('Error clearing wishlist:', error);
    return false;
  }
};

export const getWishlistCount = (): number => {
  try {
    return getWishlist().length;
  } catch (error) {
    console.error('Error getting wishlist count:', error);
    return 0;
  }
};

// Fetch media details for wishlist items
export const fetchWishlistMedia = async (apiUrl: string): Promise<Media[]> => {
  try {
    const wishlistIds = getWishlist();
    if (wishlistIds.length === 0) return [];

    // Get TMDB movie data from stored wishlist data
    const wishlistData = getWishlistData();
    const tmdbMovies: Media[] = wishlistData.map(item => ({
      id: item.id,
      title: item.title,
      year: item.year || new Date().getFullYear(),
      rating: item.rating || 0,
      genres: item.genres || [],
      tmdb_id: item.tmdb_id,
      poster_path: item.poster_path,
      poster_url: item.poster_url,
      description: item.overview || '',
      type: 'movie', // TMDB items are movies
      // Default values for required Media fields
      duration: 0,
      file_path: '',
      thumbnail_path: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    // Fetch local media and filter by wishlist IDs (excluding TMDB IDs that start with 9)
    const localWishlistIds = wishlistIds.filter(id => !id.toString().startsWith('9'));
    let localMedia: Media[] = [];
    
    if (localWishlistIds.length > 0) {
      const response = await fetch(`${apiUrl}/api/media`);
      if (response.ok) {
        const allMedia: Media[] = await response.json();
        localMedia = allMedia.filter(media => localWishlistIds.includes(media.id));
      }
    }

    // Combine local media and TMDB movies
    return [...localMedia, ...tmdbMovies];
  } catch (error) {
    console.error('Error fetching wishlist media:', error);
    return [];
  }
};