"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Media } from '@/types/media';
import { ScoredMedia, RecommendationSectionProps, RecommendationCategory, RecommendationResponse } from '@/types/recommendation';
import { Button } from '@/components/ui/button';
import { NetflixHorizontalRow } from './scrollx';
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

  // Generate fallback recommendations using internal logic
  const generateFallbackRecommendations = useCallback((): ScoredMedia[] => {
    // Create basic fallback recommendations when no data is available
    const mockMedia: Media[] = [
      {
        id: 1,
        uuid: 'fallback-1',
        title: 'Popular Movie',
        description: 'A highly rated movie',
        type: 'movie',
        rating: 8.5,
        duration: 7200,
        file_path: '',
        poster_path: '',
        banner_path: '',
        trailer_path: '',
        release_date: '2023-01-01',
        genres: [],
        series: undefined,
        view_count: 1000,
        last_viewed: undefined,
      }
    ];
    
    return mockMedia.map((media: Media, index: number) => ({
      id: media.id,
      uuid: media.uuid,
      title: media.title,
      type: media.type,
      mediaId: media.id,
      media: media,
      _score: 90 - index * 2,
      _source: 'internal_fallback',
      _category: 'for_you' as RecommendationCategory,
      _reasons: ['Recommended for you']
    }));
  }, []);

  // Fetch all recommendations with comprehensive fallback system
  const fetchAllRecommendations = useCallback(async () => {
    if (loading) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Try backend recommendations first
      const response = await fetch(`/api/recommendations?category=for_you&limit=20&user_id=1`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.items && Array.isArray(data.items) && data.items.length > 0) {
        const scoredItems = data.items.map((item: any, index: number) => ({
          id: item.id || 0,
          uuid: item.uuid || '',
          title: item.title || 'Unknown Title',
          type: item.type || 'movie',
          mediaId: item.id || 0,
          media: {
            id: item.id || 0,
            uuid: item.uuid || '',
            title: item.title || 'Unknown Title',
            description: item.description || '',
            type: item.type || 'movie',
            rating: item.rating || 0,
            duration: item.duration || 0,
            file_path: item.file_path || '',
            poster_path: item.poster_path || '',
            banner_path: item.banner_path || '',
            trailer_path: item.trailer_path || '',
            release_date: item.release_date || '',
            genres: item.genres || [],
            series: item.series || undefined,
            view_count: item.view_count || 0,
            last_viewed: item.last_viewed || undefined,
          },
          _score: item._score || (100 - index * 2),
          _source: item._source || 'backend_recommendations',
          _category: (item._category || 'for_you') as RecommendationCategory,
          _reasons: item._reasons || ['Recommended for you']
        }));
        
        setRecommendations(scoredItems);
        return;
      }
      
      // If backend returns empty or invalid data, try fallback API call
      const fallbackResponse = await fetch(`/api/recommendations?category=trending&limit=20&user_id=1`);
      if (fallbackResponse.ok) {
        const fallbackData = await fallbackResponse.json();
        if (fallbackData.items && Array.isArray(fallbackData.items) && fallbackData.items.length > 0) {
          const fallbackItems = fallbackData.items.map((item: any, index: number) => ({
            id: item.id || 0,
            uuid: item.uuid || '',
            title: item.title || 'Unknown Title',
            type: item.type || 'movie',
            mediaId: item.id || 0,
            media: {
              id: item.id || 0,
              uuid: item.uuid || '',
              title: item.title || 'Unknown Title',
              description: item.description || '',
              type: item.type || 'movie',
              rating: item.rating || 0,
              duration: item.duration || 0,
              file_path: item.file_path || '',
              poster_path: item.poster_path || '',
              banner_path: item.banner_path || '',
              trailer_path: item.trailer_path || '',
              release_date: item.release_date || '',
              genres: item.genres || [],
              series: item.series || undefined,
              view_count: item.view_count || 0,
              last_viewed: item.last_viewed || undefined,
            },
            _score: item._score || (90 - index * 2),
            _source: 'trending_fallback',
            _category: 'trending' as RecommendationCategory,
            _reasons: ['Trending now']
          }));
          
          setRecommendations(fallbackItems);
          return;
        }
      }
      
      // Final fallback to generated recommendations
      setRecommendations(generateFallbackRecommendations());
      
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      setError('Failed to load recommendations');
      // Use fallback recommendations
      setRecommendations(generateFallbackRecommendations());
    } finally {
      setLoading(false);
    }
  }, [loading, generateFallbackRecommendations]);
  
  // Refresh recommendations when media changes or periodically
  useEffect(() => {
    fetchAllRecommendations();
  }, [fetchAllRecommendations]);

  // Auto-refresh every 5 minutes for dynamic content
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAllRecommendations();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [fetchAllRecommendations]);

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

  const processRecommendations = useCallback((allMedia: Media[], recentData: any[]) => {
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

    // Get random seed based on current time for dynamic shuffling
    const seed = Math.floor(Date.now() / (1000 * 60 * 30)); // Changes every 30 minutes
    const shuffleArray = function<T>(array: T[]): T[] {
      const shuffled = [...array];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(((seed + i) * 9301 + 49297) % 233280 / 233280) * (i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    };

    // Process recently watched with dynamic rotation
    const recentIds = Array.isArray(recentData) 
      ? recentData.map((item: any) => item.media_id).filter(Boolean)
      : [];
      
    const recentlyWatched = shuffleArray(
      allMedia.filter(m => m && m.id && recentIds.includes(m.id) && m.id !== currentMedia?.id)
    )
      .slice(0, 10)
      .map(m => createScoredMedia(m, 100, 'recently_played', 'recent'));

    // Process similar by genre with dynamic selection
    const genreMatches = currentMedia?.genres?.length
      ? allMedia.filter(m => 
          m && 
          m.id && 
          m.id !== currentMedia.id && 
          m.genres?.some(g => 
            currentMedia.genres?.some(cg => cg.id === g.id)
          ) &&
          !recentlyWatched.some(r => r.mediaId === m.id)
        )
      : [];
    
    const similarByGenre = shuffleArray(genreMatches)
      .slice(0, 12)
      .map(m => createScoredMedia(m, 80, 'similar_genre', 'similar'));

    // Generate trending content (dynamic based on view counts and recency)
    const trending = shuffleArray(
      allMedia
        .filter(m => m && m.id !== currentMedia?.id)
        .sort((a, b) => {
          const scoreA = (a.view_count || 0) * 0.7 + (a.popularity || 0) * 0.3;
          const scoreB = (b.view_count || 0) * 0.7 + (b.popularity || 0) * 0.3;
          return scoreB - scoreA;
        })
    )
      .slice(0, 15)
      .map(m => createScoredMedia(m, 90, 'trending', 'trending'));

    // New releases with dynamic rotation
    const newReleases = shuffleArray(
      allMedia.filter(m => {
        if (!m?.release_date) return false;
        const date = new Date(m.release_date);
        return !isNaN(date.getTime()) && date > new Date(Date.now() - 1000 * 60 * 60 * 24 * 90); // Last 90 days
      })
    )
      .slice(0, 12)
      .map(m => createScoredMedia(m, 70, 'new_releases', 'new_releases'));

    // Top picks with intelligent scoring
    const topPicks = shuffleArray(
      allMedia
        .filter(m => m && m.id !== currentMedia?.id)
        .sort((a, b) => {
          const scoreA = (a.rating || 0) * 0.4 + (a.popularity || 0) * 0.3 + (a.view_count || 0) * 0.3;
          const scoreB = (b.rating || 0) * 0.4 + (b.popularity || 0) * 0.3 + (b.view_count || 0) * 0.3;
          return scoreB - scoreA;
        })
    )
      .slice(0, 15)
      .map(m => createScoredMedia(m, 85, 'top_picks', 'top_picks'));

    // Popular content with rotation
    const popular = shuffleArray(
      allMedia
        .filter(m => m && m.popularity && m.id !== currentMedia?.id)
        .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
    )
      .slice(0, 20)
      .map(m => createScoredMedia(m, 60, 'popular', 'popular'));

    // Combine all recommendations with deduplication
    const allRecommendations = [
      ...trending,
      ...topPicks,
      ...newReleases,
      ...popular
    ];

    // Deduplicate and ensure diversity
    const seen = new Set<number>();
    const uniqueRecommendations = allRecommendations.filter(item => {
      if (seen.has(item.mediaId)) return false;
      seen.add(item.mediaId);
      return true;
    });

    return {
      recommendations: uniqueRecommendations.slice(0, 25),
      recentlyWatched,
      similarByGenre
    };
  }, [currentMedia?.id]);

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
  const categorizeRecommendations = useCallback(() => {
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
  }, [recommendations]);
  
  const categories = categorizeRecommendations();
  
  // Add refresh button for manual updates
  const handleRefresh = useCallback(() => {
    setLastUpdated(0); // Force refresh
    fetchAllRecommendations();
  }, [fetchAllRecommendations]);
  
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
    <div className="space-y-8">
      {/* Continue Watching - Highest Priority */}
      {recentlyWatched.length > 0 && (
        <NetflixHorizontalRow
          title="Continue Watching"
          media={recentlyWatched as unknown as Media[]}
          onPlay={handlePlay}
          onInfo={handleInfo}
          priority={true}
          variant="landscape"
          size="large"
        />
      )}
      
      {/* Because You Watched - Netflix's signature feature */}
      {similarByGenre.length > 0 && (
        <NetflixHorizontalRow
          title={`Because You Watched "${currentMedia?.title}"`}
          media={similarByGenre as unknown as Media[]}
          onPlay={handlePlay}
          onInfo={handleInfo}
          variant="portrait"
          size="medium"
        />
      )}
      
      {/* Trending Now */}
      {categories.trending.length > 0 && (
        <NetflixHorizontalRow
          title="Trending Now"
          media={categories.trending as unknown as Media[]}
          onPlay={handlePlay}
          onInfo={handleInfo}
          variant="landscape"
          size="medium"
        />
      )}
      
      {/* Top Picks for You */}
      {categories.topPicks.length > 0 && (
        <NetflixHorizontalRow
          title="Top Picks for You"
          media={categories.topPicks as unknown as Media[]}
          onPlay={handlePlay}
          onInfo={handleInfo}
          variant="portrait"
          size="medium"
        />
      )}
      
      {/* New Releases */}
      {categories.newReleases.length > 0 && (
        <NetflixHorizontalRow
          title="New Releases"
          media={categories.newReleases as unknown as Media[]}
          onPlay={handlePlay}
          onInfo={handleInfo}
          variant="landscape"
          size="medium"
        />
      )}
      
      {/* Recommended For You */}
      {categories.forYou.length > 0 && (
        <NetflixHorizontalRow
          title="Recommended For You"
          media={categories.forYou as unknown as Media[]}
          onPlay={handlePlay}
          onInfo={handleInfo}
          variant="portrait"
          size="medium"
        />
      )}
    </div>
  );
};

export default RecommendationSection;
