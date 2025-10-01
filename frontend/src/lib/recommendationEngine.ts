import { Media } from '@/types/media';
import { ScoredMedia } from '@/types/recommendation';

export interface UserPreferences {
  favoriteGenres: string[];
  viewHistory: ViewRecord[];
  playbackProgress: PlaybackProgress[];
  clickHistory: ClickRecord[];
  ratings: UserRating[];
}

export interface ViewRecord {
  mediaId: number;
  timestamp: number;
  duration: number;
  completionPercentage: number;
  sessionId: string;
}

export interface PlaybackProgress {
  mediaId: number;
  currentTime: number;
  duration: number;
  lastUpdated: number;
  completed: boolean;
}

export interface ClickRecord {
  mediaId: number;
  action: 'play' | 'info' | 'add_to_list' | 'rate';
  timestamp: number;
  context: string; // 'hero', 'carousel', 'search', 'related'
}

export interface UserRating {
  mediaId: number;
  rating: number; // 1-5 stars
  timestamp: number;
}

export interface MediaRelationship {
  mediaId: number;
  relatedMediaIds: number[];
  relationshipType: 'sequel' | 'prequel' | 'series' | 'similar_genre' | 'same_director' | 'same_actor';
  strength: number; // 0-1, how strong the relationship is
}

// Re-export ScoredMedia from recommendation types
export { ScoredMedia } from '@/types/recommendation';

export interface RecommendationScore extends Omit<ScoredMedia, 'mediaId'> {
  mediaId: number;
  reasons: string[];
  _category?: 'trending' | 'continue_watching' | 'for_you' | 'new_releases' | 'similar' | 'popular' | 'recent';
}

export class RecommendationEngine {
  userPreferences: UserPreferences;
  private mediaRelationships: Map<number, MediaRelationship[]> = new Map();
  
  constructor(preferences: UserPreferences) {
    this.userPreferences = preferences;
  }

  // Track user interactions
  trackView(mediaId: number, duration: number, completionPercentage: number) {
    const viewRecord: ViewRecord = {
      mediaId,
      timestamp: Date.now(),
      duration,
      completionPercentage,
      sessionId: this.generateSessionId()
    };
    
    this.userPreferences.viewHistory.push(viewRecord);
    this.saveToLocalStorage();
  }

  trackClick(mediaId: number, action: ClickRecord['action'], context: string) {
    const clickRecord: ClickRecord = {
      mediaId,
      action,
      timestamp: Date.now(),
      context
    };
    
    this.userPreferences.clickHistory.push(clickRecord);
    this.saveToLocalStorage();
  }

  updatePlaybackProgress(mediaId: number, currentTime: number, duration: number) {
    const existingIndex = this.userPreferences.playbackProgress.findIndex(p => p.mediaId === mediaId);
    const progress: PlaybackProgress = {
      mediaId,
      currentTime,
      duration,
      lastUpdated: Date.now(),
      completed: currentTime / duration > 0.9
    };

    if (existingIndex >= 0) {
      this.userPreferences.playbackProgress[existingIndex] = progress;
    } else {
      this.userPreferences.playbackProgress.push(progress);
    }
    
    this.saveToLocalStorage();
  }

  // Build media relationship tree
  buildMediaRelationships(allMedia: Media[]) {
    this.mediaRelationships.clear();
    
    allMedia.forEach(media => {
      const relationships: MediaRelationship[] = [];
      
      // Find similar content by genre
      const genreMatches = allMedia.filter(other => 
        other.id !== media.id && 
        media.genres?.some(genre => 
          other.genres?.some(otherGenre => 
            otherGenre.name.toLowerCase() === genre.name.toLowerCase()
          )
        )
      );
      
      genreMatches.forEach(match => {
        const commonGenres = media.genres?.filter(genre =>
          match.genres?.some(otherGenre => 
            otherGenre.name.toLowerCase() === genre.name.toLowerCase()
          )
        ) || [];
        
        relationships.push({
          mediaId: match.id,
          relatedMediaIds: [match.id],
          relationshipType: 'similar_genre',
          strength: Math.min(commonGenres.length / (media.genres?.length || 1), 1)
        });
      });

      // Find series relationships (episodes)
      if (media.type === 'episode') {
        const seriesMatches = allMedia.filter(other => 
          other.type === 'episode' && 
          other.id !== media.id &&
          this.extractSeriesName(media.title) === this.extractSeriesName(other.title)
        );
        
        seriesMatches.forEach(match => {
          relationships.push({
            mediaId: match.id,
            relatedMediaIds: [match.id],
            relationshipType: 'series',
            strength: 0.9
          });
        });
      }

      // Find by year proximity
      const yearMatches = allMedia.filter(other =>
        other.id !== media.id &&
        media.year && other.year &&
        Math.abs(media.year - other.year) <= 2
      );
      
      yearMatches.slice(0, 5).forEach(match => {
        relationships.push({
          mediaId: match.id,
          relatedMediaIds: [match.id],
          relationshipType: 'similar_genre',
          strength: 0.3
        });
      });

      this.mediaRelationships.set(media.id, relationships);
    });
  }

  /**
   * Generate recommendations based on user preferences and viewing history
   * @param allMedia - Array of all available media
   * @param count - Number of recommendations to return
   * @returns Array of scored media recommendations
   */
  generateRecommendations(allMedia: Media[], count: number = 20): ScoredMedia[] {
    // First pass: score all media
    const scoredMedia = allMedia.map(media => this.scoreMedia(media));
    
    // Filter out low-scoring items
    const filteredScores = scoredMedia.filter(item => item._score > 0);
    
    // Sort by score in descending order
    const sortedScores = filteredScores.sort((a, b) => b._score - a._score);
    
    // Take top N items
    return sortedScores.slice(0, count);
  }
  
  /**
   * Score a single media item based on user preferences and history
   * @private
   */
  private scoreMedia(media: Media): ScoredMedia {
    let score = 0;
    const reasons: string[] = [];
    let category: RecommendationScore['category'] = 'for_you';
    
    // 1. Check for in-progress content (highest priority)
    const progress = this.userPreferences.playbackProgress.find(p => p.mediaId === media.id);
    if (progress && !progress.completed && progress.currentTime > 60) {
      score += 100;
      reasons.push('Continue watching');
      category = 'continue_watching';
    }
    
    // 2. Genre-based scoring (high weight)
    const genreScore = this.calculateGenreScore(media);
    if (genreScore > 0) {
      score += genreScore * 20;
      reasons.push('Matches your genre preferences');
    }
    
    // 3. History-based scoring (medium weight)
    const historyScore = this.calculateHistoryScore(media);
    score += historyScore * 10;
    
    // 4. Rating-based scoring (high weight if rated)
    const rating = this.userPreferences.ratings.find(r => r.mediaId === media.id);
    if (rating) {
      score += rating.rating * 5;
      reasons.push(`You rated this ${rating.rating} stars`);
    }
    
    // 5. Relationship-based scoring (medium weight)
    const relationships = this.mediaRelationships.get(media.id) || [];
    relationships.forEach(rel => {
      if (this.userPreferences.viewHistory.some(v => rel.relatedMediaIds.includes(v.mediaId))) {
        score += 15 * rel.strength;
        reasons.push('Related to content you\'ve watched');
      }
    });
    
    // 6. Recency boost (small weight)
    const recentViews = this.userPreferences.viewHistory
      .filter(v => v.timestamp > Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
      .length;
    score += Math.min(recentViews, 5); // Cap at 5 points
    
    // 7. Penalize already watched content
    const hasWatched = this.userPreferences.viewHistory.some(v => 
      v.mediaId === media.id && v.completionPercentage > 0.8
    );
    if (hasWatched) {
      score *= 0.3;
      reasons.push('You already watched this');
    }
    
    // 8. Popularity boost (small weight)
    if (media.popularity) {
      score += media.popularity * 0.1;
    }
    
    // 9. Recency boost for new releases
    const isNewRelease = media.release_date && 
      new Date(media.release_date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    if (isNewRelease) {
      score += 10;
      reasons.push('New release');
      category = 'new_releases';
    }
    
    // Ensure score is non-negative
    score = Math.max(0, Math.round(score));
    
    // Return as ScoredMedia
    return {
      ...media,
      _score: score,
      _source: 'recommendation_engine',
      mediaId: media.id,
      // Add any additional fields needed for display
      title: media.title,
      type: media.type,
      // Add reasons and category as non-enumerable properties
      get _reasons() { return reasons; },
      get _category() { return category; }
    } as ScoredMedia;
  }

  /**
   * Get related content for a specific media item
   * @param mediaId - ID of the source media
   * @param allMedia - Array of all available media
   * @param count - Maximum number of related items to return
   * @returns Array of related media with scores
   */
  getRelatedContent(mediaId: number, allMedia: Media[], count: number = 12): ScoredMedia[] {
    const sourceMedia = allMedia.find(m => m.id === mediaId);
    if (!sourceMedia) return [];
    
    // Score each media item based on relationship to source
    const relatedScores = allMedia
      .filter(m => m.id !== mediaId) // Exclude self
      .map(media => {
        let score = 0;
        const reasons: string[] = [];
        
        // 1. Direct relationships (highest weight)
        const relationships = this.mediaRelationships.get(mediaId) || [];
        const directRel = relationships.find(r => r.relatedMediaIds.includes(media.id));
        if (directRel) {
          score += 100 * directRel.strength;
          reasons.push(`Related: ${directRel.relationshipType.replace('_', ' ')}`);
        }
        
        // 2. Genre similarity (high weight)
        const sharedGenres = sourceMedia.genres?.filter(g1 => 
          media.genres?.some(g2 => g1.id === g2.id)
        ) || [];
        
        if (sharedGenres.length > 0) {
          const genreNames = sharedGenres.map(g => g.name).join(', ');
          score += 50 * (sharedGenres.length / (sourceMedia.genres?.length || 1));
          reasons.push(`Shared genres: ${genreNames}`);
        }
        
        // 3. Same director/creator (medium weight)
        if (sourceMedia.director && media.director && 
            sourceMedia.director === media.director) {
          score += 30;
          reasons.push(`Same director: ${sourceMedia.director}`);
        }
        
        // 4. Same cast members (low weight)
        const sharedCast = (sourceMedia.cast || []).filter(actor1 => 
          (media.cast || []).some(actor2 => actor1.id === actor2.id)
        );
        
        if (sharedCast.length > 0) {
          score += 10 * Math.min(sharedCast.length, 3); // Cap at 3 cast members
          reasons.push(`Shared cast: ${sharedCast[0].name}${sharedCast.length > 1 ? ` +${sharedCast.length - 1} more` : ''}`);
        }
        
        // 5. Release year proximity (small weight)
        if (sourceMedia.year && media.year) {
          const yearDiff = Math.abs(sourceMedia.year - media.year);
          if (yearDiff <= 5) {
            score += 5 * (1 - (yearDiff / 5)); // Full points for same year, decreasing to 0 over 5 years
          }
        }
        
        // 6. User-specific factors (medium weight)
        const userRating = this.userPreferences.ratings.find(r => r.mediaId === media.id);
        if (userRating) {
          score += userRating.rating * 5; // 5-25 points based on 1-5 star rating
          reasons.push(`You rated this ${userRating.rating} stars`);
        }
        
        // 7. Popularity boost (small weight)
        if (media.popularity) {
          score += media.popularity * 0.1;
        }
        
        // Create scored media object
        return {
          ...media,
          _score: Math.round(score),
          _source: 'related_content',
          mediaId: media.id,
          get _reasons() { return reasons; },
          get _category() { return 'similar' as const; }
        } as ScoredMedia;
      });
    
    // Sort by score and return top N
    return relatedScores
      .sort((a, b) => b._score - a._score)
      .slice(0, count);
  }

  // Get continue watching list
  getContinueWatching(allMedia: Media[]): Media[] {
    const unfinished = this.userPreferences.playbackProgress
      .filter(p => !p.completed && p.currentTime > 60)
      .sort((a, b) => b.lastUpdated - a.lastUpdated);
    
    const mediaIds = unfinished.map(p => p.mediaId);
    return allMedia.filter(media => mediaIds.includes(media.id));
  }

  // Private helper methods
  private calculateGenreScore(media: Media): number {
    if (!media.genres) return 0;
    
    const favoriteGenres = this.userPreferences.favoriteGenres.map(g => g.toLowerCase());
    const mediaGenres = media.genres.map(g => g.name.toLowerCase());
    
    const matches = mediaGenres.filter(genre => favoriteGenres.includes(genre));
    return matches.length * 15; // 15 points per favorite genre match
  }

  private calculateHistoryScore(media: Media): number {
    const recentViews = this.userPreferences.viewHistory
      .filter(v => Date.now() - v.timestamp < 30 * 24 * 60 * 60 * 1000) // Last 30 days
      .slice(0, 10); // Last 10 items
    
    let score = 0;
    
    recentViews.forEach(view => {
      const relationships = this.mediaRelationships.get(view.mediaId) || [];
      const isRelated = relationships.some(r => r.mediaId === media.id);
      
      if (isRelated) {
        score += view.completionPercentage * 10;
      }
    });
    
    return score;
  }

  private getRecentViewCount(mediaId: number): number {
    const recentViews = this.userPreferences.viewHistory.filter(v => 
      v.mediaId === mediaId && 
      Date.now() - v.timestamp < 7 * 24 * 60 * 60 * 1000 // Last 7 days
    );
    return recentViews.length;
  }

  private extractSeriesName(title: string): string {
    // Remove episode numbers, season indicators, etc.
    return title
      .replace(/S\d+E\d+/gi, '')
      .replace(/Season \d+/gi, '')
      .replace(/Episode \d+/gi, '')
      .replace(/\(\d+\)/g, '')
      .trim();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private saveToLocalStorage() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('userPreferences', JSON.stringify(this.userPreferences));
    }
  }

  static loadFromLocalStorage(): UserPreferences {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('userPreferences');
      if (stored) {
        return JSON.parse(stored);
      }
    }
    
    return {
      favoriteGenres: ['action', 'fantasy', 'horror', 'war'],
      viewHistory: [],
      playbackProgress: [],
      clickHistory: [],
      ratings: []
    };
  }
}

// Utility functions for recommendation categories
export const getRecommendationCategories = (recommendations: RecommendationScore[]) => {
  const categories = {
    continue_watching: recommendations.filter(r => r.category === 'continue_watching'),
    trending: recommendations.filter(r => r.category === 'trending'),
    for_you: recommendations.filter(r => r.category === 'for_you'),
    because_you_watched: recommendations.filter(r => r.category === 'because_you_watched'),
    new_releases: recommendations.filter(r => r.category === 'new_releases')
  };
  
  return categories;
};

export const formatRecommendationReason = (reasons: string[]): string => {
  if (reasons.length === 0) return 'Recommended for you';
  if (reasons.length === 1) return reasons[0];
  return `${reasons[0]} and ${reasons.length - 1} more reason${reasons.length > 2 ? 's' : ''}`;
};
