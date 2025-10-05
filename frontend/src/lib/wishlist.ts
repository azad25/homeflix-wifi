"use client";

import { Media } from '@/types/media';

const WISHLIST_COOKIE_NAME = 'homeflix_wishlist';
const COOKIE_EXPIRY_DAYS = 365; // 1 year

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

export const addToWishlist = (mediaId: number): boolean => {
  try {
    const currentWishlist = getWishlist();
    if (!currentWishlist.includes(mediaId)) {
      const updatedWishlist = [...currentWishlist, mediaId];
      setCookie(WISHLIST_COOKIE_NAME, JSON.stringify(updatedWishlist), COOKIE_EXPIRY_DAYS);
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

    // Fetch all media and filter by wishlist IDs
    const response = await fetch(`${apiUrl}/api/media`);
    if (!response.ok) throw new Error('Failed to fetch media');
    
    const allMedia: Media[] = await response.json();
    return allMedia.filter(media => wishlistIds.includes(media.id));
  } catch (error) {
    console.error('Error fetching wishlist media:', error);
    return [];
  }
};