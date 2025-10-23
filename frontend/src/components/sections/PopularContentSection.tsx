"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Media } from '@/types/media';
import { EnhancedHorizontalRow } from '@/components/scrollx';
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

      <EnhancedHorizontalRow
        title=""
        media={media}
        onPlay={onMediaClick}
        onInfo={onMediaClick}
        size="medium"
        variant="portrait"
        priority={true}
      />
    </section>
  );
};
