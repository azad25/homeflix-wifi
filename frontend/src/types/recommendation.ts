import { Media } from './media';

export type RecommendationCategory = 
  | 'continue_watching' 
  | 'for_you' 
  | 'new_releases' 
  | 'similar' 
  | 'popular' 
  | 'recent'
  | 'interaction'
  | 'info_click'
  | 'unknown'
  | 'trending'
  | 'because_you_watched';

export interface RecommendationBase {
  _score: number;
  _source: string;
  mediaId: number;
  _reasons: string[];
  _category: RecommendationCategory;
  timestamp?: number;
}

export interface ScoredMedia extends Omit<Media, 'id'>, RecommendationBase {
  // Combines Media fields with recommendation metadata
  // mediaId is used instead of id to avoid conflicts with Media's id
}

export interface RecommendationResponse {
  items: ScoredMedia[];
  category: RecommendationCategory;
  total: number;
}

export interface RecommendationSectionProps {
  currentMedia: Media;
  onPlay: (media: Media) => void;
  onInfo: (media: Media) => void;
  variant?: 'default' | 'compact' | 'detailed';
}
