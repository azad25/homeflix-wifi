"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Media } from '@/types/media';
import { ScoredMedia, RecommendationCategory } from '@/types/recommendation';
import { 
  RecommendationEngine, 
  UserPreferences,
  getRecommendationCategories 
} from '@/lib/recommendationEngine';

// Utility function to convert Media to ScoredMedia
const toScoredMedia = (media: Media, score: number, source: string, category: RecommendationCategory, reasons: string[] = []): ScoredMedia => ({
  ...media,
  _score: score,
  _source: source,
  mediaId: media.id,
  _reasons: reasons,
  _category: category
});

// Utility function to convert ScoredMedia back to Media (loses scoring info)
const toMedia = (scored: ScoredMedia): Media => {
  const { _score, _source, mediaId, _reasons, _category, ...media } = scored;
  return media as Media;
};

interface RecommendationContextType {
  engine: RecommendationEngine | null;
  recommendations: ScoredMedia[];
  recentlyPlayed: ScoredMedia[];
  continueWatching: ScoredMedia[];
  trackView: (mediaId: number, duration: number, completionPercentage: number) => void;
  trackClick: (mediaId: number, action: 'play' | 'info' | 'add_to_list' | 'rate', context: string) => void;
  updateProgress: (mediaId: number, currentTime: number, duration: number) => void;
  getRelatedContent: (mediaId: number, allMedia: Media[]) => ScoredMedia[];
  refreshRecommendations: (allMedia: Media[]) => void;
  getRecommendationsByCategory: () => {
    continue_watching: ScoredMedia[];
    trending: ScoredMedia[];
    for_you: ScoredMedia[];
    similar: ScoredMedia[];
    new_releases: ScoredMedia[];
    popular: ScoredMedia[];
    recent: ScoredMedia[];
  };
}

const RecommendationContext = createContext<RecommendationContextType | undefined>(undefined);

interface RecommendationProviderProps {
  children: ReactNode;
}

export const RecommendationProvider: React.FC<RecommendationProviderProps> = ({ children }) => {
  const [engine, setEngine] = useState<RecommendationEngine | null>(null);
  const [recommendations, setRecommendations] = useState<ScoredMedia[]>([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState<ScoredMedia[]>([]);
  const [continueWatching, setContinueWatching] = useState<ScoredMedia[]>([]);

  useEffect(() => {
    // Initialize recommendation engine with user preferences
    const preferences = RecommendationEngine.loadFromLocalStorage();
    const recommendationEngine = new RecommendationEngine(preferences);
    setEngine(recommendationEngine);
  }, []);

  const trackView = (mediaId: number, duration: number, completionPercentage: number) => {
    if (engine) {
      engine.trackView(mediaId, duration, completionPercentage);
    }
  };

  const trackClick = (mediaId: number, action: 'play' | 'info' | 'add_to_list' | 'rate', context: string) => {
    if (engine) {
      engine.trackClick(mediaId, action, context);
    }
  };

  const updateProgress = (mediaId: number, currentTime: number, duration: number) => {
    if (engine) {
      engine.updatePlaybackProgress(mediaId, currentTime, duration);
    }
  };

  const getRelatedContent = (mediaId: number, allMedia: Media[]): ScoredMedia[] => {
    if (!engine) return [];
    return engine.getRelatedContent(mediaId, allMedia);
  };

  const refreshRecommendations = (allMedia: Media[]) => {
    if (!engine) return;

    // Build media relationships
    engine.buildMediaRelationships(allMedia);

    // Generate recommendations
    const recs = engine.generateRecommendations(allMedia, 50);
    setRecommendations(recs);

      // Get recently played from view history
    const recentFromHistory = engine.userPreferences.viewHistory
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10)
      .map(view => {
        const media = allMedia.find(m => m.id === view.mediaId);
        return media ? toScoredMedia(media, 100, 'recently_played', 'recent', ['Recently played']) : null;
      })
      .filter((m): m is ScoredMedia => m !== null);
    
    setRecentlyPlayed(recentFromHistory);
    
    // Get continue watching from playback progress
    const continueWatchingScored = engine.userPreferences.playbackProgress
      .filter(p => !p.completed && p.currentTime > 60)
      .sort((a, b) => b.lastUpdated - a.lastUpdated)
      .map(progress => {
        const media = allMedia.find(m => m.id === progress.mediaId);
        return media ? toScoredMedia(media, 100, 'continue_watching', 'continue_watching', ['Continue watching']) : null;
      })
      .filter((m): m is ScoredMedia => m !== null);
    
    setContinueWatching(continueWatchingScored);
  };

  const getRecommendationsByCategory = () => {
    // Start with empty categories
    const result = {
      continue_watching: [...continueWatching],
      trending: [] as ScoredMedia[],
      for_you: [] as ScoredMedia[],
      similar: [] as ScoredMedia[],
      new_releases: [] as ScoredMedia[],
      popular: [] as ScoredMedia[],
      recent: [] as ScoredMedia[]
    };

    // If no recommendations, return empty categories
    if (!recommendations.length) {
      return result;
    }
    
    // Categorize recommendations based on their _category property
    recommendations.forEach(item => {
      const category = item._category || 'for_you';
      if (category in result) {
        result[category as keyof typeof result].push(item);
      }
    });
    
    // If no 'for_you' recommendations, use the first 10
    if (result.for_you.length === 0) {
      result.for_you = recommendations.slice(0, 10);
    }
    
    return result;
  };

  return (
    <RecommendationContext.Provider
      value={{
        engine,
        recommendations,
        recentlyPlayed,
        continueWatching,
        trackView,
        trackClick,
        updateProgress,
        getRelatedContent,
        refreshRecommendations,
        getRecommendationsByCategory
      }}
    >
      {children}
    </RecommendationContext.Provider>
  );
};

export const useRecommendations = (): RecommendationContextType => {
  const context = useContext(RecommendationContext);
  if (context === undefined) {
    throw new Error('useRecommendations must be used within a RecommendationProvider');
  }
  return context;
};
