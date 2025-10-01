import { Media } from '@/types/media';
import { ScoredMedia } from '@/types/recommendation';

// Cache for storing recommendation timestamps
const recommendationCache = new Map<number, number>();

/**
 * Ensures recommendations are diverse across genres
 */
// Helper type that includes both Media and ScoredMedia properties
type MediaWithId = { mediaId: number; id?: number } & Record<string, any>;

// Helper function to safely get media ID
const getMediaId = (item: Media | ScoredMedia): number => {
  return 'id' in item ? item.id : item.mediaId;
};

export function ensureDiversity<T extends MediaWithId>(
  recommendations: T[], 
  allMedia: (Media | ScoredMedia)[],
  maxPerGenre: number = 3
): T[] {
  const genreCounts = new Map<string, number>();
  const diverseRecommendations: T[] = [];
  
  for (const rec of recommendations) {
    // Find the media item by ID
    const media = allMedia.find(m => getMediaId(m) === rec.mediaId);
    if (!media) continue;
    
    // Get genres from either Media or ScoredMedia
    const genres = 'genres' in media ? media.genres : [];
    const primaryGenre = genres?.[0]?.name || 'other';
    const count = genreCounts.get(primaryGenre) || 0;
    
    if (count < maxPerGenre) {
      diverseRecommendations.push(rec);
      genreCounts.set(primaryGenre, count + 1);
    }
    
    // Stop if we have enough recommendations
    if (diverseRecommendations.length >= 20) break;
  }
  
  return diverseRecommendations;
}

/**
 * Shuffles an array using Fisher-Yates algorithm
 * @template T - The type of elements in the array
 * @param {T[]} array - The array to shuffle
 * @returns {T[]} A new shuffled array
 */
export function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]] as [T, T];
  }
  return newArray;
}

/**
 * Removes duplicate media items by ID
 * @template T - The type of media items (either Media or ScoredMedia)
 * @param {T[]} mediaList - The array of media items to deduplicate
 * @returns {T[]} A new array with duplicates removed
 */
export function deduplicateMedia<T extends { mediaId: number } | { id: number }>(
  mediaList: T[]
): T[] {
  const seen = new Set<number>();
  return mediaList.filter(item => {
    const id = 'mediaId' in item ? item.mediaId : item.id;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

/**
 * Tracks when recommendations were last shown
 * @param {number} mediaId - The ID of the media that was shown
 */
export function trackRecommendationShown(mediaId: number): void {
  recommendationCache.set(mediaId, Date.now());
}

/**
 * Gets the last time a recommendation was shown
 * @param {number} mediaId - The ID of the media to check
 * @returns {number | undefined} The timestamp when the media was last shown, or undefined if never shown
 */
export function getLastShownTime(mediaId: number): number | undefined {
  return recommendationCache.get(mediaId);
}

/**
 * Sorts recommendations by freshness (least recently shown first)
 * @template T - The type of items to sort (either Media or ScoredMedia)
 * @param {T[]} items - The array of items to sort
 * @returns {T[]} A new array sorted by freshness
 */
export function sortByFreshness<T extends { mediaId: number } | { id: number }>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => {
    const aId = 'mediaId' in a ? a.mediaId : a.id;
    const bId = 'mediaId' in b ? b.mediaId : b.id;
    const aTime = getLastShownTime(aId) || 0;
    const bTime = getLastShownTime(bId) || 0;
    return aTime - bTime;
  });
}
