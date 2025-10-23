"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Media } from '@/types/media';
import { EnhancedHorizontalRow } from '@/components/scrollx';
import { Flame, Star, Calendar, Trophy } from 'lucide-react';

interface TrendingSectionProps {
  media: Media[];
  onMediaClick: (media: Media) => void;
}

export const TrendingSection: React.FC<TrendingSectionProps> = ({
  media,
  onMediaClick,
}) => {
  const getRankBadge = (index: number) => {
    if (index < 3) {
      const colors = ['text-yellow-400', 'text-gray-300', 'text-amber-600'];
      return (
        <div className={`flex items-center gap-1 ${colors[index]}`}>
          <Trophy className="w-3 h-3" />
          <span className="font-bold">#{index + 1}</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1 text-gray-400">
        <span className="font-bold">#{index + 1}</span>
      </div>
    );
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
          <Flame className="w-6 h-6 text-orange-500" />
          <h2 className="text-2xl md:text-3xl font-bold text-white">
            Trending Now
          </h2>
        </div>
        <p className="text-gray-400 text-sm md:text-base">
          Top-rated content everyone&apos;s talking about
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
