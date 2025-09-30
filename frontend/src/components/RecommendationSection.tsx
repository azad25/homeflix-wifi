"use client";

import React, { useState, useEffect } from 'react';
import { Media } from '@/types/media';
import { getApiUrl } from '@/lib/api';
import { ScrollXCarousel } from './scrollx';

interface RecommendationSectionProps {
  currentMedia: Media;
  onPlay: (media: Media) => void;
  onInfo: (media: Media) => void;
}

const RecommendationSection: React.FC<RecommendationSectionProps> = ({
  currentMedia,
  onPlay,
  onInfo,
}) => {
  const [recommendations, setRecommendations] = useState<Media[]>([]);
  const [recentlyWatched, setRecentlyWatched] = useState<Media[]>([]);
  const [similarByGenre, setSimilarByGenre] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecommendations();
  }, [currentMedia.id]);

  const fetchRecommendations = async () => {
    try {
      const apiUrl = getApiUrl();
      
      // Fetch all media
      const allMediaResponse = await fetch(`${apiUrl}/api/media`);
      const allMedia: Media[] = await allMediaResponse.json();

      // Fetch recently watched
      const recentResponse = await fetch(`${apiUrl}/api/playback/recent`);
      const recentData = await recentResponse.json();
      
      // Get recently watched media IDs
      const recentIds = recentData.map((item: any) => item.media_id);
      const recentMedia = allMedia.filter(m => recentIds.includes(m.id) && m.id !== currentMedia.id);
      setRecentlyWatched(recentMedia.slice(0, 20));

      // Get similar by genre
      const currentGenres = currentMedia.genres?.map(g => g.name) || [];
      const similarMedia = allMedia.filter(m => {
        if (m.id === currentMedia.id) return false;
        if (m.type !== currentMedia.type) return false;
        
        const mediaGenres = m.genres?.map(g => g.name) || [];
        return mediaGenres.some(g => currentGenres.includes(g));
      });
      
      // Sort by rating and view count
      similarMedia.sort((a, b) => {
        const scoreA = (a.rating || 0) * 0.6 + (a.view_count || 0) * 0.4;
        const scoreB = (b.rating || 0) * 0.6 + (b.view_count || 0) * 0.4;
        return scoreB - scoreA;
      });
      
      setSimilarByGenre(similarMedia.slice(0, 20));

      // Combine recommendations with weighted scoring
      const recommendationMap = new Map<number, { media: Media; score: number }>();
      
      // Add genre-based recommendations (highest weight)
      similarMedia.slice(0, 15).forEach((media, index) => {
        const score = 100 - index * 5; // Higher score for earlier items
        recommendationMap.set(media.id, { media, score });
      });

      // Add recently watched (medium weight)
      recentMedia.slice(0, 10).forEach((media, index) => {
        const existing = recommendationMap.get(media.id);
        const score = 50 - index * 3;
        if (existing) {
          existing.score += score;
        } else {
          recommendationMap.set(media.id, { media, score });
        }
      });

      // Sort by combined score
      const finalRecommendations = Array.from(recommendationMap.values())
        .sort((a, b) => b.score - a.score)
        .map(item => item.media)
        .slice(0, 20);

      setRecommendations(finalRecommendations);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-8 text-center text-white/60">
        Loading recommendations...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Main Recommendations */}
      {recommendations.length > 0 && (
        <ScrollXCarousel
          title="Recommended For You"
          media={recommendations}
          onPlay={onPlay}
          onInfo={onInfo}
          variant="glass"
        />
      )}

      {/* Similar by Genre */}
      {similarByGenre.length > 0 && (
        <ScrollXCarousel
          title={`More ${currentMedia.genres?.[0]?.name || currentMedia.type} ${currentMedia.type === 'movie' ? 'Movies' : 'Shows'}`}
          media={similarByGenre}
          onPlay={onPlay}
          onInfo={onInfo}
          variant="gradient"
        />
      )}

      {/* Because You Watched */}
      {recentlyWatched.length > 0 && (
        <ScrollXCarousel
          title="Because You Watched"
          media={recentlyWatched}
          onPlay={onPlay}
          onInfo={onInfo}
          variant="solid"
        />
      )}
    </div>
  );
};

export default RecommendationSection;
