"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Media } from '@/types/media';
import { ScoredMedia, RecommendationSectionProps, RecommendationCategory, RecommendationResponse } from '@/types/recommendation';
import { Button } from '@/components/ui/button';
import { ScrollXCarousel } from './scrollx';
import {
  fetchRecommendations,
  getSimilarMedia,
  trackRecommendationClick,
  getContinueWatching,
} from '@/lib/api/recommendations';
import { getApiUrl } from '@/lib/api';
import { findSimilarMovies, sortByFreshness, ensureDiversity, deduplicateMedia } from '@/lib/mediaUtils';


const RecommendationSection: React.FC<RecommendationSectionProps> = ({
  currentMedia,
  onPlay,
  onInfo,
}) => {
  // State for recommendations using ScoredMedia type
  const [recommendations, setRecommendations] = useState<ScoredMedia[]>([]);
  const [recentlyWatched, setRecentlyWatched] = useState<ScoredMedia[]>([]);
  const [similarByGenre, setSimilarByGenre] = useState<ScoredMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  // Fetch all recommendations
  const fetchAllRecommendations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Helper function to safely extract items from API response
      const extractItems = (response: unknown): ScoredMedia[] => {
        if (response && typeof response === 'object' && 'items' in response) {
          const items = (response as { items: unknown }).items;
          return Array.isArray(items) ? items : [];
        }
        return [];
      };

      // Define a default user ID
      const userId = 'current-user';

      // Fetch data in parallel with proper typing
      const [continueWatching, similar, recs] = await Promise.all([
        // Get continue watching items
        (async (): Promise<ScoredMedia[]> => {
          try {
            const response = await getContinueWatching(userId);
            // The API returns a RecommendationResponse with an items array
            return response?.items || [];
          } catch (error) {
            console.error('Error fetching continue watching:', error);
            return [];
          }
        })(),
        
        // Get similar media
        (async (): Promise<ScoredMedia[]> => {
          try {
            const response = await getSimilarMedia(currentMedia.id, userId);
            return extractItems(response);
          } catch (error) {
            console.error('Error fetching similar media:', error);
            return [];
          }
        })(),
        
        // Get general recommendations
        (async (): Promise<ScoredMedia[]> => {
          try {
            const response = await fetchRecommendations(userId, 'for_you');
            return extractItems(response);
          } catch (error) {
            console.error('Error fetching recommendations:', error);
            return [];
          }
        })()
      ]);
      
      // Update state with the fetched data
      setRecentlyWatched(continueWatching);
      setSimilarByGenre(similar);
      setRecommendations(recs);
      
      // Track that recommendations were shown - don't await to avoid blocking
      const allItems = [...continueWatching, ...similar, ...recs];
      allItems.forEach(item => {
        if (item?.mediaId) {
          // Don't await to avoid blocking
          trackRecommendationClick('current-user', item.mediaId, item._category || 'unknown')
            .catch(error => console.error('Error tracking click:', error));
        }
      });
      
    } catch (err) {
      console.error('Error in fetchAllRecommendations:', err);
      setError('Failed to load recommendations. Please try again later.');
      
      // Reset state on error
      setRecommendations([]);
      setRecentlyWatched([]);
      setSimilarByGenre([]);
    } finally {
      setLoading(false);
      setLastUpdated(Date.now());
    }
  }, [currentMedia.id]);
  
  // Refresh recommendations every 30 minutes or when media changes
  useEffect(() => {
    const now = Date.now();
    if (now - lastUpdated > 30 * 60 * 1000 || lastUpdated === 0) {
      fetchAllRecommendations();
    }
  }, [fetchAllRecommendations, lastUpdated]);

  // Handle play button click
  const handlePlay = useCallback((media: Media) => {
    onPlay(media);
    trackRecommendationClick('current-user', media.id, 'interaction');
  }, [onPlay]);
  
  // Handle info button click
  const handleInfo = useCallback((media: Media) => {
    onInfo(media);
    trackRecommendationClick('current-user', media.id, 'info_click');
  }, [onInfo]);

  const createScoredMedia = (
    media: Media, 
    score: number, 
    source: string, 
    category: RecommendationCategory = 'for_you', 
    reasons: string[] = []
  ): ScoredMedia => {
    // Create a new object with all Media properties
    const scoredMedia: ScoredMedia = {
      ...media,
      _score: score,
      _source: source,
      mediaId: media.id,
      _reasons: reasons,
      _category: category,
      // Ensure required fields are set
      title: media.title || 'Untitled',
      type: media.type || 'movie'
    };
    
    return scoredMedia;
  };

  const processRecommendations = (allMedia: Media[], recentData: any[]) => {
    if (!allMedia || !Array.isArray(allMedia)) {
      return { recommendations: [], recentlyWatched: [], similarByGenre: [] };
    }

    // Helper function to create ScoredMedia with proper type safety
    const createScoredMedia = (
      media: Media, 
      score: number, 
      source: string, 
      category: RecommendationCategory = 'for_you',
      reasons: string[] = []
    ): ScoredMedia => {
      return {
        ...media,
        _score: score,
        _source: source,
        mediaId: media.id,
        _reasons: reasons,
        _category: category
      };
    };

    // Process recently watched
    const recentIds = Array.isArray(recentData) 
      ? recentData.map((item: any) => item.media_id).filter(Boolean)
      : [];
      
    const recentlyWatched = allMedia
      .filter(m => m && m.id && recentIds.includes(m.id) && m.id !== currentMedia?.id)
      .slice(0, 10)
      .map(m => createScoredMedia(m, 100, 'recently_played', 'recent'));

    // Process similar by genre
    const similarByGenre = currentMedia?.genres?.length
      ? allMedia
          .filter(m => 
            m && 
            m.id && 
            m.id !== currentMedia.id && 
            m.genres?.some(g => 
              currentMedia.genres?.some(cg => cg.id === g.id)
            ) &&
            !recentlyWatched.some(r => r.mediaId === m.id)
          )
          .slice(0, 10)
          .map(m => createScoredMedia(m, 80, 'similar_genre', 'similar'))
      : [];

    // Generate recommendations
    const similarTitles = currentMedia?.title 
      ? findSimilarMovies(currentMedia.title, allMedia, 8)
      : [];
      
    const similarByTitle = similarTitles
      .filter((m): m is Media => m && 'id' in m)
      .map(m => createScoredMedia(m, 100, 'similarity'));

    const popularInGenre = currentMedia?.genres?.length
      ? allMedia
          .filter(m => 
            m && 
            m.id &&
            m.id !== currentMedia.id &&
            m.genres?.some(g => 
              currentMedia.genres?.some(cg => cg.id === g.id)
            )
          )
          .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
          .slice(0, 10)
          .map(m => createScoredMedia(m, 80, 'popular_genre', 'popular'))
      : [];

    const newReleases = allMedia
      .filter(m => {
        if (!m?.release_date) return false;
        const releaseDate = new Date(m.release_date);
        return !isNaN(releaseDate.getTime()) && releaseDate > new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);
      })
      .sort((a, b) => {
        const dateA = a.release_date ? new Date(a.release_date).getTime() : 0;
        const dateB = b.release_date ? new Date(b.release_date).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, 10)
      .map(m => createScoredMedia(m, 60, 'new_releases', 'new_releases'));

    const popular = allMedia
      .filter(m => m && m.popularity)
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
      .slice(0, 20)
      .map(m => createScoredMedia(m, 40, 'popular', 'popular'));

    // Combine all recommendations
    const allRecommendations = [
      ...similarByTitle,
      ...popularInGenre,
      ...newReleases,
      ...popular
    ];

    // Process and deduplicate
    const uniqueRecommendations = deduplicateMedia(allRecommendations);
    const sortedRecommendations = sortByFreshness(uniqueRecommendations)
      .sort((a, b) => (b._score || 0) - (a._score || 0));
    
    // Ensure diversity in recommendations
    const diverseRecommendations = ensureDiversity(
      sortedRecommendations,
      [...allMedia, ...uniqueRecommendations]
    );

    return {
      recommendations: diverseRecommendations.slice(0, 20),
      recentlyWatched,
      similarByGenre
    };
  };

  const fetchRecommendations = async () => {
    try {
      setLoading(true);
      const apiUrl = getApiUrl();
      
      // Fetch all data in parallel
      const [allMediaResponse, recentResponse] = await Promise.all([
        fetch(`${apiUrl}/api/media`),
        fetch(`${apiUrl}/api/playback/recent`)
      ]);

      const [allMedia, recentData] = await Promise.all([
        allMediaResponse.json(),
        recentResponse.json()
      ]) as [Media[], any[]];

      const { recommendations, recentlyWatched, similarByGenre } = 
        processRecommendations(allMedia, recentData);

      setRecommendations(recommendations);
      setRecentlyWatched(recentlyWatched);
      setSimilarByGenre(similarByGenre);
      
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      // Fallback to empty arrays to prevent UI errors
      setRecommendations([]);
      setRecentlyWatched([]);
      setSimilarByGenre([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-12">
      {/* Continue Watching */}
      {recentlyWatched.length > 0 && (
        <ScrollXCarousel
          title="Continue Watching"
          media={recentlyWatched as unknown as Media[]}
          onPlay={handlePlay}
          onInfo={handleInfo}
          variant="gradient"
          priority={true}
        />
      )}
      
      {/* Similar by Genre */}
      {similarByGenre.length > 0 && (
        <ScrollXCarousel
          title={`More Like ${currentMedia.title}`}
          media={similarByGenre as unknown as Media[]}
          onPlay={handlePlay}
          onInfo={handleInfo}
          variant="glass"
        />
      )}
      
      {/* Recommended For You */}
      {recommendations.length > 0 && (
        <ScrollXCarousel
          title="Recommended For You"
          media={recommendations as unknown as Media[]}
          onPlay={handlePlay}
          onInfo={handleInfo}
          variant="solid"
        />
      )}

      {/* Because You Watched */}
      {recentlyWatched.length > 0 && (
        <ScrollXCarousel
          title="Because You Watched"
          media={recentlyWatched as unknown as Media[]}
          onPlay={onPlay}
          onInfo={onInfo}
          variant="solid"
        />
      )}
    </div>
  );
};

export default RecommendationSection;
