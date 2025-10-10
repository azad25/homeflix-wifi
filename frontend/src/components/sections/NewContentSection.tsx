"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Media } from '@/types/media';
import EnhancedScrollXCarousel from '@/components/scrollx/EnhancedScrollXCarousel';
import { Calendar, Clock, Star } from 'lucide-react';

interface NewContentSectionProps {
  media: Media[];
  onMediaClick: (media: Media) => void;
}

export const NewContentSection: React.FC<NewContentSectionProps> = ({
  media,
  onMediaClick,
}) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays} days ago`;
    if (diffDays <= 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
    return `${Math.ceil(diffDays / 30)} months ago`;
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
          <Calendar className="w-6 h-6 text-red-500" />
          <h2 className="text-2xl md:text-3xl font-bold text-white">
            New Releases
          </h2>
        </div>
        <p className="text-gray-400 text-sm md:text-base">
          Fresh content added to your library
        </p>
      </motion.div>

      <EnhancedScrollXCarousel
        media={media}
        onMediaClick={onMediaClick}
        variant="glass"
        showMetadata={true}
        customMetadata={(media) => (
          <div className="flex items-center gap-2 text-xs text-gray-300">
            <Clock className="w-3 h-3" />
            <span>{formatDate(media.created_at || '')}</span>
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
          background: 'linear-gradient(135deg, rgba(0,0,0,0.8) 0%, rgba(20,20,20,0.9) 100%)',
          border: '1px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(10px)',
        }}
        hoverStyle={{
          transform: 'scale(1.05) translateY(-8px)',
          background: 'linear-gradient(135deg, rgba(139,0,0,0.9) 0%, rgba(0,0,0,0.95) 100%)',
          border: '1px solid rgba(220,38,38,0.5)',
          boxShadow: '0 20px 40px rgba(220,38,38,0.3)',
        }}
      />
    </section>
  );
};
