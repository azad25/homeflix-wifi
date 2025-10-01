import { Media } from '@/types/media';
import { ScoredMedia } from '@/types/recommendation';

/**
 * Finds similar movies based on title similarity
 */
export function findSimilarMovies(
  title: string, 
  allMedia: Media[], 
  maxResults: number = 5
): Media[] {
  if (!title || !allMedia?.length) return [];
  
  const cleanTitle = title.toLowerCase().trim();
  
  // Simple title similarity scoring
  const scored = allMedia
    .filter(media => media && media.title && media.id)
    .map(media => ({
      media,
      score: calculateTitleSimilarity(cleanTitle, media.title.toLowerCase().trim())
    }))
    .filter(item => item.score > 0.3) // Filter out very dissimilar titles
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(item => item.media);
    
  return scored;
}

/**
 * Calculates similarity between two strings using Levenshtein distance
 */
function calculateTitleSimilarity(str1: string, str2: string): number {
  // Simple implementation - can be enhanced with more sophisticated algorithms
  if (str1 === str2) return 1;
  
  const len1 = str1.length;
  const len2 = str2.length;
  
  if (len1 === 0 || len2 === 0) return 0;
  
  // Check for common prefixes
  let i = 0;
  while (i < Math.min(len1, len2) && str1[i] === str2[i]) i++;
  
  // If one string is a prefix of the other, return a high score
  if (i > 0 && (i === len1 || i === len2)) {
    return 0.8;
  }
  
  // Simple substring matching
  if (str1.includes(str2) || str2.includes(str1)) {
    return 0.7;
  }
  
  // Common word matching
  const words1 = new Set(str1.split(/\s+/));
  const words2 = new Set(str2.split(/\s+/));
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Sorts media by freshness (newest first)
 */
export function sortByFreshness<T extends { release_date?: string }>(
  mediaList: T[]
): T[] {
  return [...mediaList].sort((a, b) => {
    const dateA = a.release_date ? new Date(a.release_date).getTime() : 0;
    const dateB = b.release_date ? new Date(b.release_date).getTime() : 0;
    return dateB - dateA;
  });
}

export * from './recommendationUtils';
