"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Media } from '@/types/media';
import { ScoredMedia, RecommendationSectionProps, RecommendationCategory, RecommendationResponse } from '@/types/recommendation';
import { Button } from '@/components/ui/button';
import { ScrollXCarousel } from './scrollx';
import * as recommendationsApi from '@/lib/api/recommendations';
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
      
      // Define a default user ID
      const userId = 'current-user';

      // Fetch Netflix-style recommendation categories in parallel
      const [continueWatching, becauseYouWatched, topPicks, trending, newReleases, forYou] = await Promise.all([
        // Continue watching
        (async (): Promise<ScoredMedia[]> => {
          try {
            const response = await recommendationsApi.fetchRecommendations(userId, 'continue_watching', 10);
            return response?.items || [];
          } catch (error) {
            console.error('Error fetching continue watching:', error);
            return [];
          }
        })(),
        
        // Because you watched
        (async (): Promise<ScoredMedia[]> => {
          try {
            const response = await recommendationsApi.fetchRecommendations(userId, 'because_you_watched', 12);
            return response?.items || [];
          } catch (error) {
            console.error('Error fetching because you watched:', error);
            return [];
          }
        })(),
        
        // Top picks for your genres
        (async (): Promise<ScoredMedia[]> => {
          try {
            const response = await recommendationsApi.fetchRecommendations(userId, 'top_picks', 15);
            return response?.items || [];
          } catch (error) {
            console.error('Error fetching top picks:', error);
            return [];
          }
        })(),
        
        // Trending now
        (async (): Promise<ScoredMedia[]> => {
          try {
            const response = await recommendationsApi.fetchRecommendations(userId, 'trending', 12);
            return response?.items || [];
          } catch (error) {
            console.error('Error fetching trending:', error);
            return [];
          }
        })(),
        
        // New releases
        (async (): Promise<ScoredMedia[]> => {
          try {
            const response = await recommendationsApi.fetchRecommendations(userId, 'new_releases', 10);
            return response?.items || [];
          } catch (error) {
            console.error('Error fetching new releases:', error);
            return [];
          }
        })(),
        
        // General recommendations
        (async (): Promise<ScoredMedia[]> => {
          try {
            const response = await recommendationsApi.fetchRecommendations(userId, 'for_you', 15);
            return response?.items || [];
          } catch (error) {
            console.error('Error fetching for you:', error);
            return [];
          }
        })()
      ]);
      
      // Update state with Netflix-style categories
      setRecentlyWatched(continueWatching);
      setSimilarByGenre(becauseYouWatched);
      setRecommendations([
        ...topPicks,
        ...trending, 
        ...newReleases,
        ...forYou
      ]);
      
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
    recommendationsApi.trackRecommendationClick('current-user', media.id, 'interaction');
    onPlay(media);
  }, [onPlay]);

  // Handle info button click
  const handleInfo = useCallback((media: Media) => {
    recommendationsApi.trackRecommendationClick('current-user', media.id, 'info_click');
    onInfo(media);
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

  // Separate recommendations by category for Netflix-style display
  const categorizeRecommendations = () => {
    const categories = {
      trending: [] as ScoredMedia[],
      topPicks: [] as ScoredMedia[],
      newReleases: [] as ScoredMedia[],
      forYou: [] as ScoredMedia[]
    };
    
    recommendations.forEach(item => {
      switch (item._category) {
        case 'trending':
          categories.trending.push(item);
          break;
        case 'top_picks':
          categories.topPicks.push(item);
          break;
        case 'new_releases':
          categories.newReleases.push(item);
          break;
        default:
          categories.forYou.push(item);
      }
    });
    
    return categories;
  };
  
  const categories = categorizeRecommendations();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-white/70">Loading recommendations...</div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {/* Continue Watching - Highest Priority */}
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
      
      {/* Because You Watched - Netflix's signature feature */}
      {similarByGenre.length > 0 && (
        <ScrollXCarousel
          title="Because You Watched"
          media={similarByGenre as unknown as Media[]}
          onPlay={handlePlay}
          onInfo={handleInfo}
          variant="glass"
        />
      )}
      
      {/* Trending Now */}
      {categories.trending.length > 0 && (
        <ScrollXCarousel
          title="Trending Now"
          media={categories.trending as unknown as Media[]}
          onPlay={handlePlay}
          onInfo={handleInfo}
          variant="gradient"
        />
      )}
      
      {/* Top Picks for You */}
      {categories.topPicks.length > 0 && (
        <ScrollXCarousel
          title="Top Picks for You"
          media={categories.topPicks as unknown as Media[]}
          onPlay={handlePlay}
          onInfo={handleInfo}
          variant="solid"
        />
      )}
      
      {/* New Releases */}
      {categories.newReleases.length > 0 && (
        <ScrollXCarousel
          title="New Releases"
          media={categories.newReleases as unknown as Media[]}
          onPlay={handlePlay}
          onInfo={handleInfo}
          variant="glass"
        />
      )}
      
      {/* Recommended For You */}
      {categories.forYou.length > 0 && (
        <ScrollXCarousel
          title="Recommended For You"
          media={categories.forYou as unknown as Media[]}
          onPlay={handlePlay}
          onInfo={handleInfo}
          variant="solid"
        />
      )}
    </div>
  );
};

export default RecommendationSection;
