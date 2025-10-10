"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Media } from '@/types/media';
import EnhancedScrollXCarousel from '@/components/scrollx/EnhancedScrollXCarousel';
import { TrendingUp, Eye, Star, Play } from 'lucide-react';

interface PopularContentSectionProps {
  media: Media[];
  onMediaClick: (media: Media) => void;
}

export const PopularContentSection: React.FC<PopularContentSectionProps> = ({
  media,
  onMediaClick,
}) => {
  const formatViews = (views: number) => {
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
    return views.toString();
  };

  return (
    <section className="px-4 md:px-8 lg:px-16 overflow-visible">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-2">
          <TrendingUp className="w-6 h-6 text-red-500" />
          <h2 className="text-2xl md:text-3xl font-bold text-white">
            Popular on HomeFlix
          </h2>
        </div>
        <p className="text-gray-400 text-sm md:text-base">
          Most watched content by our community
        </p>
      </motion.div>

      <EnhancedScrollXCarousel
        media={media}
        onMediaClick={onMediaClick}
        variant="gradient"
        showMetadata={true}
        customMetadata={(media) => (
          <div className="flex items-center gap-2 text-xs text-gray-300">
            <Eye className="w-3 h-3" />
            <span>{formatViews(media.view_count || 0)} views</span>
            {media.rating && (
              <>
                <span className="text-gray-500">•</span>
                <Star className="w-3 h-3 text-yellow-500" />
                <span>{media.rating.toFixed(1)}</span>
              </>
            )}
          </div>
        )}
        cardStyle={{
          background: 'linear-gradient(135deg, rgba(139,0,0,0.2) 0%, rgba(0,0,0,0.8) 100%)',
          border: '1px solid rgba(220,38,38,0.3)',
          backdropFilter: 'blur(8px)',
        }}
        hoverStyle={{
          transform: 'scale(1.08) translateY(-12px)',
          background: 'linear-gradient(135deg, rgba(220,38,38,0.8) 0%, rgba(139,0,0,0.9) 100%)',
          border: '1px solid rgba(220,38,38,0.8)',
          boxShadow: '0 25px 50px rgba(220,38,38,0.4)',
        }}
        showPlayButton={true}
        playButtonIcon={<Play className="w-4 h-4" />}
      />
    </section>
  );
};
