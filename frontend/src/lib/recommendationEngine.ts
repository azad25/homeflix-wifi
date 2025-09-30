import { Media } from '@/types/media';

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

export interface RecommendationScore {
  mediaId: number;
  score: number;
  reasons: string[];
  category: 'trending' | 'for_you' | 'because_you_watched' | 'continue_watching' | 'new_releases';
}

export class RecommendationEngine {
  private userPreferences: UserPreferences;
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

  // Generate recommendations based on user preferences and viewing history
  generateRecommendations(allMedia: Media[], count: number = 20): RecommendationScore[] {
    const scores: RecommendationScore[] = [];
    
    allMedia.forEach(media => {
      let score = 0;
      const reasons: string[] = [];
      let category: RecommendationScore['category'] = 'for_you';

      // Check if user has unfinished content
      const progress = this.userPreferences.playbackProgress.find(p => p.mediaId === media.id);
      if (progress && !progress.completed && progress.currentTime > 60) {
        score += 100;
        reasons.push('Continue watching');
        category = 'continue_watching';
      }

      // Favorite genres boost
      const genreBoost = this.calculateGenreScore(media);
      score += genreBoost;
      if (genreBoost > 0) {
        reasons.push(`Matches your favorite genres`);
      }

      // View history similarity
      const historyScore = this.calculateHistoryScore(media);
      score += historyScore;
      if (historyScore > 0) {
        reasons.push('Based on your viewing history');
      }

      // Rating boost
      if (media.rating && media.rating >= 7.0) {
        score += media.rating * 2;
        reasons.push('Highly rated');
      }

      // Trending boost (recent views)
      const recentViews = this.getRecentViewCount(media.id);
      if (recentViews > 0) {
        score += recentViews * 5;
        reasons.push('Trending now');
        category = 'trending';
      }

      // New releases boost
      if (media.year && media.year >= new Date().getFullYear() - 1) {
        score += 10;
        reasons.push('New release');
        category = 'new_releases';
      }

      // Penalize already watched content
      const hasWatched = this.userPreferences.viewHistory.some(v => 
        v.mediaId === media.id && v.completionPercentage > 0.8
      );
      if (hasWatched) {
        score *= 0.3;
      }

      if (score > 0) {
        scores.push({
          mediaId: media.id,
          score,
          reasons,
          category
        });
      }
    });

    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, count);
  }

  // Get related content for a specific media item
  getRelatedContent(mediaId: number, allMedia: Media[], count: number = 12): Media[] {
    const relationships = this.mediaRelationships.get(mediaId) || [];
    const relatedIds = relationships
      .sort((a, b) => b.strength - a.strength)
      .slice(0, count)
      .map(r => r.mediaId);
    
    return allMedia.filter(media => relatedIds.includes(media.id));
  }

  // Get recently played content
  getRecentlyPlayed(allMedia: Media[], count: number = 10): Media[] {
    const recentProgress = this.userPreferences.playbackProgress
      .filter(p => p.currentTime > 60) // At least 1 minute watched
      .sort((a, b) => b.lastUpdated - a.lastUpdated)
      .slice(0, count);
    
    const mediaIds = recentProgress.map(p => p.mediaId);
    return allMedia.filter(media => mediaIds.includes(media.id));
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
