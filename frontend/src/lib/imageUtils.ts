import { getApiUrl } from './api';

export interface ImageUrls {
  poster: string;
  thumbnail: string;
}

/**
 * Get poster and thumbnail URLs for a media item
 * @param mediaId - The media ID
 * @returns Object with poster and thumbnail URLs
 */
export const getMediaImageUrls = (mediaId: number | string): ImageUrls => {
  const apiUrl = getApiUrl();
  
  return {
    poster: `${apiUrl}/api/posters/${mediaId}`,
    thumbnail: `${apiUrl}/api/thumbnails/${mediaId}`
  };
};

/**
 * Get the primary image URL (poster) with fallback URL (thumbnail)
 * @param mediaId - The media ID
 * @returns Object with primary and fallback URLs
 */
export const getPrimaryImageWithFallback = (mediaId: number | string) => {
  const urls = getMediaImageUrls(mediaId);
  
  return {
    primary: urls.poster,
    fallback: urls.thumbnail
  };
};

/**
 * Custom hook for handling image loading with poster-to-thumbnail fallback
 */
export const useImageWithFallback = (mediaId: number | string, posterUrl?: string | null, mediaType?: string) => {
  const apiUrl = getApiUrl();
  const { primary, fallback } = getPrimaryImageWithFallback(mediaId);
  
  // If posterUrl is provided (for TMDB or custom posters), use it as primary
  if (posterUrl) {
    return {
      primarySrc: posterUrl,
      fallbackSrc: primary // Regular poster endpoint as fallback
    };
  }
  
  // For TV series/episodes, try series poster endpoint first
  if (mediaType === 'series' || mediaType === 'tv' || mediaType === 'episode') {
    return {
      primarySrc: `${apiUrl}/api/series/${mediaId}/poster`,
      fallbackSrc: primary // Regular poster endpoint as fallback
    };
  }
  
  // For movies and other media, use regular poster endpoint
  return {
    primarySrc: primary,
    fallbackSrc: fallback
  };
};