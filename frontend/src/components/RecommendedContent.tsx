"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Star, TrendingUp, Sparkles, Clock } from 'lucide-react';
import { Media } from '@/types/media';
import { useRecommendations } from '@/contexts/RecommendationContext';
import { NetflixHorizontalRow } from '@/components/scrollx';
import { formatRecommendationReason } from '@/lib/recommendationEngine';

interface RecommendedContentProps {
  allMedia: Media[];
  onPlay: (media: Media) => void;
  onInfo: (media: Media) => void;
}

const RecommendedContent: React.FC<RecommendedContentProps> = ({ 
  allMedia, 
  onPlay, 
  onInfo 
}) => {
  const { getRecommendationsByCategory } = useRecommendations();
  const categories = getRecommendationsByCategory();

  const getMediaFromRecommendations = (recommendations: any[]) => {
    return recommendations
      .map(rec => allMedia.find(media => media.id === rec.mediaId))
      .filter(Boolean) as Media[];
  };

  const categoryConfigs = [
    {
      key: 'trending',
      title: 'Trending Now',
      icon: <TrendingUp className="w-5 h-5" />,
      color: 'text-red-400',
      variant: 'portrait' as const,
      size: 'large' as const
    },
    {
      key: 'for_you',
      title: 'Recommended for You',
      icon: <Sparkles className="w-5 h-5" />,
      color: 'text-yellow-400',
      variant: 'portrait' as const,
      size: 'medium' as const
    },
    {
      key: 'because_you_watched',
      title: 'Because You Watched',
      icon: <Star className="w-5 h-5" />,
      color: 'text-blue-400',
      variant: 'portrait' as const,
      size: 'medium' as const
    },
    {
      key: 'new_releases',
      title: 'New Releases',
      icon: <Clock className="w-5 h-5" />,
      color: 'text-green-400',
      variant: 'portrait' as const,
      size: 'medium' as const
    }
  ];

  return (
    <div className="space-y-8">
      {categoryConfigs.map((config) => {
        const recommendations = categories[config.key as keyof typeof categories];
        const mediaList = getMediaFromRecommendations(recommendations);
        
        if (mediaList.length === 0) return null;

        return (
          <motion.div
            key={config.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center gap-3 mb-4 px-6">
              <span className={config.color}>{config.icon}</span>
              <h2 className="text-2xl font-bold text-white">{config.title}</h2>
              {recommendations.length > 0 && (
                <span className="text-sm text-gray-400">
                  ({recommendations.length} items)
                </span>
              )}
            </div>
            
            <NetflixHorizontalRow
              title=""
              media={mediaList}
              onPlay={onPlay}
              onInfo={onInfo}
              variant={config.variant}
              size={config.size}
              priority={config.key === 'trending'}
            />
          </motion.div>
        );
      })}
    </div>
  );
};

export default RecommendedContent;
