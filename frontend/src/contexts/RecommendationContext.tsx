"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Media } from '@/types/media';
import { 
  RecommendationEngine, 
  UserPreferences, 
  RecommendationScore,
  getRecommendationCategories 
} from '@/lib/recommendationEngine';

interface RecommendationContextType {
  engine: RecommendationEngine | null;
  recommendations: RecommendationScore[];
  recentlyPlayed: Media[];
  continueWatching: Media[];
  trackView: (mediaId: number, duration: number, completionPercentage: number) => void;
  trackClick: (mediaId: number, action: 'play' | 'info' | 'add_to_list' | 'rate', context: string) => void;
  updateProgress: (mediaId: number, currentTime: number, duration: number) => void;
  getRelatedContent: (mediaId: number, allMedia: Media[]) => Media[];
  refreshRecommendations: (allMedia: Media[]) => void;
  getRecommendationsByCategory: () => {
    continue_watching: RecommendationScore[];
    trending: RecommendationScore[];
    for_you: RecommendationScore[];
    because_you_watched: RecommendationScore[];
    new_releases: RecommendationScore[];
  };
}

const RecommendationContext = createContext<RecommendationContextType | undefined>(undefined);

interface RecommendationProviderProps {
  children: ReactNode;
}

export const RecommendationProvider: React.FC<RecommendationProviderProps> = ({ children }) => {
  const [engine, setEngine] = useState<RecommendationEngine | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationScore[]>([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState<Media[]>([]);
  const [continueWatching, setContinueWatching] = useState<Media[]>([]);

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

  const getRelatedContent = (mediaId: number, allMedia: Media[]): Media[] => {
    if (!engine) return [];
    return engine.getRelatedContent(mediaId, allMedia);
  };

  const refreshRecommendations = (allMedia: Media[]) => {
    if (!engine) return;

    // Build media relationships
    engine.buildMediaRelationships(allMedia);

    // Generate recommendations
    const newRecommendations = engine.generateRecommendations(allMedia, 50);
    setRecommendations(newRecommendations);

    // Update recently played and continue watching
    const recentlyPlayedMedia = engine.getRecentlyPlayed(allMedia);
    const continueWatchingMedia = engine.getContinueWatching(allMedia);
    
    setRecentlyPlayed(recentlyPlayedMedia);
    setContinueWatching(continueWatchingMedia);
  };

  const getRecommendationsByCategory = () => {
    return getRecommendationCategories(recommendations);
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
