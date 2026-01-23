"use client";

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getApiUrl } from '@/lib/api';
import { Notification } from '@/types/notifications';
import NotificationTile from '@/components/notifications/NotificationTile';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import '@/styles/notifications.css';

// Enhanced notification interface with backend data
interface EnhancedNotification extends Notification {
  backdrop_url?: string;
  poster_url?: string;
  logo_url?: string;
  trailer_key?: string;
  rating?: number;
  release_date?: string;
  runtime?: number;
  genres?: string[];
  overview?: string;
  tagline?: string;
  language?: string;
  popularity?: number;
  companies?: string[];
  priority?: 'high' | 'medium' | 'low';
  category?: 'trending' | 'new' | 'recommended' | 'watchlist';
  progress?: number;
  remaining_min?: number;
  days_until?: number;
  genre_highlight?: string;
  media_details?: Array<{
    id: number;
    title: string;
    poster_url: string;
    backdrop_url: string;
    rating: number;
    year: number;
    runtime: number;
    genres: string[];
    overview: string;
    source_type: string;
    source_id: string;
  }>;
}

interface GridPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TileConfig {
  id: string;
  notification: EnhancedNotification;
  position: GridPosition;
  size: 'small' | 'medium' | 'large' | 'banner' | 'hero';
  priority: number;
  duration: number;
  createdAt: number;
  hasTrailer: boolean;
  trailerDuration?: number;
  isPlayingTrailer?: boolean;
  trailerStartTime?: number;
}

const NotificationsPage: React.FC = () => {
  const router = useRouter();
  const [notifications, setNotifications] = useState<EnhancedNotification[]>([]);
  const [activeTiles, setActiveTiles] = useState<TileConfig[]>([]);
  const [playingTrailers, setPlayingTrailers] = useState<Set<string>>(new Set());
  const [isLoadingFresh, setIsLoadingFresh] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const tileCounterRef = useRef(0);
  const mountedRef = useRef(true);
  
  // Video performance optimization - limit concurrent videos
  const MAX_CONCURRENT_VIDEOS = 2; // Maximum number of video tiles at once
  const [activeVideoTiles, setActiveVideoTiles] = useState<Set<string>>(new Set());

  // Debug function to monitor tile states
  const debugTileState = useCallback(() => {
    if (activeTiles.length === 0) return;
    
    const notifIds = activeTiles.map(t => t.notification.id);
    const duplicates = notifIds.filter((id, index) => notifIds.indexOf(id) !== index);
    
    if (duplicates.length > 0) {
      console.error('🚨 DUPLICATE TILES DETECTED:', duplicates);
      console.table(activeTiles.map(t => ({
        id: t.id,
        notificationId: t.notification.id,
        title: t.notification.title?.substring(0, 30) + '...',
        size: t.size,
        position: `${t.position.x},${t.position.y}`,
        isPlaying: t.isPlayingTrailer
      })));
    }
  }, [activeTiles]);

  // Monitor for duplicates every 10 seconds in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const debugInterval = setInterval(debugTileState, 10000);
      return () => clearInterval(debugInterval);
    }
  }, [debugTileState]);

  // 24/7 Optimized grid configuration - maximum tile diversity
  const gridDimensions = useMemo(() => {
    if (typeof window === 'undefined') return { cols: 20, rows: 12 };
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // Denser grids for more tile variety and 24/7 operation
    if (width < 768) return { cols: 8, rows: 10 };   // Mobile: compact but varied
    if (width < 1024) return { cols: 12, rows: 8 };  // Tablet: good variety
    if (width < 1440) return { cols: 16, rows: 10 }; // Desktop: high variety
    if (width < 1920) return { cols: 20, rows: 10 }; // Large: maximum variety
    return { cols: 24, rows: 12 };                   // Ultra-wide: extreme variety
  }, []);

  const viewportSize = useMemo(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1920,
    height: typeof window !== 'undefined' ? window.innerHeight - 64 : 1016
  }), []);

  // Load cached notifications immediately for instant page load
  const loadCachedNotifications = useCallback(() => {
    try {
      const cached = localStorage.getItem('homeflix_notifications_cache');
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        const age = Date.now() - timestamp;
        
        // Use cache if less than 10 minutes old for faster updates
        if (age < 10 * 60 * 1000) {
          console.log('⚡ Loading from cache (age:', Math.round(age / 1000), 'seconds)');
          setNotifications(data as EnhancedNotification[]);
          return true;
        }
      }
    } catch (error) {
      console.error('Failed to load cache:', error);
    }
    return false;
  }, []);

  // Enhance notifications with proper asset URLs and metadata
  const enhanceNotifications = useCallback(async (notifications: Notification[]): Promise<EnhancedNotification[]> => {
    const apiUrl = getApiUrl();
    
    return notifications.map(notification => {
      const enhanced: EnhancedNotification = { ...notification };
      
      // Set priority and category based on type and age
      const hoursSinceCreated = (Date.now() / 1000 - notification.timestamp) / 3600;
      
      switch (notification.type) {
        case 'tmdb_now_playing':
        case 'tmdb_trending':
        case 'tmdb_now_airing_tv':
        case 'local_trending':
          enhanced.priority = hoursSinceCreated < 24 ? 'high' : 'medium';
          enhanced.category = 'trending';
          break;
        case 'tmdb_upcoming':
        case 'tmdb_upcoming_tv':
        case 'tmdb_coming_soon':
          enhanced.priority = 'medium';
          enhanced.category = 'new';
          break;
        case 'movie_suggestion':
        case 'single_movie_suggestion':
        case 'genre_based':
          enhanced.priority = 'medium';
          enhanced.category = 'recommended';
          break;
        case 'watch_again':
        case 'continue_watching':
          enhanced.priority = 'low';
          enhanced.category = 'watchlist';
          break;
        case 'new_episodes':
        case 'new_movies':
        case 'recently_added':
          enhanced.priority = hoursSinceCreated < 12 ? 'high' : 'medium';
          enhanced.category = 'new';
          break;
        default:
          enhanced.priority = 'medium';
          enhanced.category = 'new';
      }

      // Extract enhanced data from notification if available (backend-provided)
      const notifData = notification as any;
      
      // Use backend-provided URLs if available
      if (notifData.backdrop_url) enhanced.backdrop_url = notifData.backdrop_url;
      if (notifData.poster_url) enhanced.poster_url = notifData.poster_url;
      if (notifData.logo_url) enhanced.logo_url = notifData.logo_url;
      if (notifData.trailer_key) enhanced.trailer_key = notifData.trailer_key;
      if (notifData.rating) enhanced.rating = notifData.rating;
      if (notifData.release_date) enhanced.release_date = notifData.release_date;
      if (notifData.runtime) enhanced.runtime = notifData.runtime;
      if (notifData.genres) enhanced.genres = notifData.genres;
      if (notifData.overview) enhanced.overview = notifData.overview;
      if (notifData.tagline) enhanced.tagline = notifData.tagline;
      if (notifData.language) enhanced.language = notifData.language;
      if (notifData.popularity) enhanced.popularity = notifData.popularity;
      if (notifData.companies) enhanced.companies = notifData.companies;
      if (notifData.progress) enhanced.progress = notifData.progress;
      if (notifData.remaining_min) enhanced.remaining_min = notifData.remaining_min;
      if (notifData.days_until) enhanced.days_until = notifData.days_until;
      if (notifData.genre_highlight) enhanced.genre_highlight = notifData.genre_highlight;
      if (notifData.media_details) enhanced.media_details = notifData.media_details;

      // Fallback URL construction for local content if not provided by backend
      if (!enhanced.backdrop_url && notification.movie_ids && notification.movie_ids.length > 0) {
        const movieId = notification.movie_ids[0];
        // Try different backdrop sources
        enhanced.backdrop_url = `${apiUrl}/api/admin/assets/banner_${movieId}.jpg`;
      }

      if (!enhanced.poster_url && notification.movie_ids && notification.movie_ids.length > 0) {
        const movieId = notification.movie_ids[0];
        enhanced.poster_url = `${apiUrl}/api/posters/${movieId}`;
      }

      if (!enhanced.logo_url && notification.movie_ids && notification.movie_ids.length > 0) {
        const movieId = notification.movie_ids[0];
        enhanced.logo_url = `${apiUrl}/api/admin/assets/logo_${movieId}.png`;
      }

      return enhanced;
    });
  }, []);

  // Fetch notifications with aggressive caching - refresh every 30 seconds
  const fetchNotifications = useCallback(async (skipCache = false) => {
    if (!mountedRef.current) return;
    
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/notifications?limit=50`, {
        cache: 'force-cache', // Aggressive caching
        headers: {
          'Accept': 'application/json',
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (mountedRef.current) {
          // Remove duplicates with faster algorithm
          const rawNotifications = data.notifications || [];
          
          console.log('📥 Fetched', rawNotifications.length, 'notifications');
          
          // Enhance notifications with proper asset URLs and metadata
          const enhancedNotifications = await enhanceNotifications(rawNotifications);
          
          // Update state
          setNotifications(enhancedNotifications);
          
          // Cache for next time with longer TTL
          try {
            localStorage.setItem('homeflix_notifications_cache', JSON.stringify({
              data: enhancedNotifications,
              timestamp: Date.now()
            }));
          } catch (e) {
            console.warn('Failed to cache notifications:', e);
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  }, [enhanceNotifications]);

  useEffect(() => {
    // Load cached data immediately for instant page load
    const hasCache = loadCachedNotifications();
    
    // Fetch fresh data in background only if cache is old
    if (!hasCache) {
      fetchNotifications();
    } else {
      // Delay fresh fetch to prioritize cached content display
      setTimeout(() => fetchNotifications(), 2000);
    }
    
    // Refresh notifications every 58.5 seconds for 24/7 operation (increased by 30% from 45s)
    const refreshInterval = setInterval(() => {
      fetchNotifications();
    }, 58500);
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    
    return () => {
      mountedRef.current = false;
      document.body.style.overflow = '';
      clearInterval(refreshInterval);
    };
  }, [fetchNotifications, loadCachedNotifications]);

  // Validate grid positions - prevent overlaps
  const validateGridPositions = useCallback((tiles: TileConfig[]): boolean => {
    for (let i = 0; i < tiles.length; i++) {
      for (let j = i + 1; j < tiles.length; j++) {
        const tile1 = tiles[i];
        const tile2 = tiles[j];
        
        // Check if tiles overlap
        const overlap = !(
          tile1.position.x >= tile2.position.x + tile2.position.width ||
          tile1.position.x + tile1.position.width <= tile2.position.x ||
          tile1.position.y >= tile2.position.y + tile2.position.height ||
          tile1.position.y + tile1.position.height <= tile2.position.y
        );
        
        if (overlap) {
          console.error(`🚨 OVERLAP DETECTED: ${tile1.notification.title} overlaps with ${tile2.notification.title}`);
          console.error(`   Tile 1: (${tile1.position.x},${tile1.position.y}) ${tile1.position.width}x${tile1.position.height}`);
          console.error(`   Tile 2: (${tile2.position.x},${tile2.position.y}) ${tile2.position.width}x${tile2.position.height}`);
          return false;
        }
      }
    }
    return true;
  }, []);

  // Simplified position finding - ensure tiles stay within bounds
  const findAvailablePosition = useCallback((width: number, height: number, existingTiles: TileConfig[]): GridPosition | null => {
    const { cols, rows } = gridDimensions;
    
    // Ensure tile fits within grid
    if (width > cols || height > rows) return null;
    
    // Simple grid scan - top to bottom, left to right
    for (let y = 0; y <= rows - height; y++) {
      for (let x = 0; x <= cols - width; x++) {
        let canPlace = true;
        
        // Check overlap with existing tiles
        for (const tile of existingTiles) {
          const tilePos = tile.position;
          if (!(
            x >= tilePos.x + tilePos.width ||
            x + width <= tilePos.x ||
            y >= tilePos.y + tilePos.height ||
            y + height <= tilePos.y
          )) {
            canPlace = false;
            break;
          }
        }
        
        if (canPlace) {
          return { x, y, width, height };
        }
      }
    }
    
    return null;
  }, [gridDimensions]);

  // 24/7 Optimized tile sizing with extreme diversity
  const getTileSize = useCallback((notification: EnhancedNotification, forceSize?: TileConfig['size']): { size: TileConfig['size'], width: number, height: number, priority: number, duration: number, hasTrailer: boolean, trailerDuration?: number } => {
    const type = notification.type;
    const hasTrailer = !!(notification as any).trailer_key || !!notification.trailer_key;
    const { rows, cols } = gridDimensions;
    
    // If forcing a specific size (for morphing), use it with random variations
    if (forceSize) {
      const sizeVariations = {
        'hero': [
          { width: Math.floor(cols * 0.4), height: Math.floor(rows * 0.5) },
          { width: Math.floor(cols * 0.5), height: Math.floor(rows * 0.4) },
          { width: Math.floor(cols * 0.45), height: Math.floor(rows * 0.45) },
        ],
        'large': [
          { width: Math.floor(cols * 0.3), height: Math.floor(rows * 0.4) },
          { width: Math.floor(cols * 0.35), height: Math.floor(rows * 0.3) },
          { width: Math.floor(cols * 0.25), height: Math.floor(rows * 0.45) },
        ],
        'banner': [
          { width: Math.floor(cols * 0.6), height: Math.floor(rows * 0.2) },
          { width: Math.floor(cols * 0.5), height: Math.floor(rows * 0.25) },
          { width: Math.floor(cols * 0.7), height: Math.floor(rows * 0.15) },
        ],
        'medium': [
          { width: Math.floor(cols * 0.2), height: Math.floor(rows * 0.3) },
          { width: Math.floor(cols * 0.25), height: Math.floor(rows * 0.25) },
          { width: Math.floor(cols * 0.15), height: Math.floor(rows * 0.35) },
        ],
        'small': [
          { width: Math.floor(cols * 0.1), height: Math.floor(rows * 0.15) },
          { width: Math.floor(cols * 0.12), height: Math.floor(rows * 0.12) },
          { width: Math.floor(cols * 0.08), height: Math.floor(rows * 0.18) },
        ]
      };
      
      const variations = sizeVariations[forceSize] || sizeVariations['medium'];
      const variation = variations[Math.floor(Math.random() * variations.length)];
      
      return {
        size: forceSize,
        width: Math.max(1, variation.width),
        height: Math.max(1, variation.height),
        priority: forceSize === 'hero' ? 10 : forceSize === 'large' ? 8 : forceSize === 'banner' ? 7 : forceSize === 'medium' ? 6 : 5,
        duration: forceSize === 'hero' ? 45500 : forceSize === 'large' ? 32500 : 26000, // Increased by 30%
        hasTrailer: forceSize === 'hero' ? hasTrailer : false,
        trailerDuration: hasTrailer ? 60000 : undefined
      };
    }
    
    // Random size assignment with weighted probabilities for extreme diversity
    const sizeWeights = {
      'hero': hasTrailer ? 0.15 : 0.05,    // 15% if trailer, 5% otherwise
      'large': 0.20,                       // 20% large tiles
      'banner': 0.10,                      // 10% banner tiles
      'medium': 0.35,                      // 35% medium tiles
      'small': 0.30                        // 30% small tiles
    };
    
    const random = Math.random();
    let cumulativeWeight = 0;
    let selectedSize: TileConfig['size'] = 'small';
    
    for (const [size, weight] of Object.entries(sizeWeights)) {
      cumulativeWeight += weight;
      if (random <= cumulativeWeight) {
        selectedSize = size as TileConfig['size'];
        break;
      }
    }
    
    // Override based on content type for some variety
    switch (type) {
      case 'tmdb_trending':
      case 'tmdb_now_playing':
        if (Math.random() > 0.3) selectedSize = hasTrailer ? 'hero' : 'large';
        break;
      case 'continue_watching':
        if (Math.random() > 0.4) selectedSize = 'banner';
        break;
      case 'tmdb_upcoming':
      case 'new_episodes':
        if (Math.random() > 0.6) selectedSize = 'medium';
        break;
    }
    
    return getTileSize(notification, selectedSize);
  }, [gridDimensions]);

  // Initialize tiles once - ENHANCED: NO DUPLICATES, FULL COVERAGE, OPTIMIZED PERFORMANCE
  useEffect(() => {
    if (notifications.length === 0) return;
    if (activeTiles.length > 0) return; // NEVER re-initialize
    
    console.log('🎬 Filling viewport with tiles:', notifications.length, 'unique notifications');
    
    const initialTiles: TileConfig[] = [];
    const usedNotificationIds = new Set<string>(); // STRICT duplicate prevention
    
    // Shuffle notifications for variety but ensure uniqueness
    const shuffled = [...notifications]
      .filter(n => n && n.id && n.title) // Ensure valid notifications with required fields
      .sort(() => Math.random() - 0.5);
    
    const totalCells = gridDimensions.cols * gridDimensions.rows;
    let filledCells = 0;
    
    console.log(`📐 Grid: ${gridDimensions.cols}x${gridDimensions.rows} = ${totalCells} cells`);
    console.log(`📊 Available notifications: ${shuffled.length}`);
    
    // FIRST PASS - 24/7 Extreme diversity tile layout
    let sizeCounters = {
      hero: 0,
      large: 0,
      banner: 0,
      medium: 0,
      small: 0
    };
    
    // More aggressive size distribution for 24/7 operation
    const maxSizes = {
      hero: Math.max(1, Math.floor(shuffled.length * 0.08)),   // 8% hero tiles
      large: Math.max(2, Math.floor(shuffled.length * 0.15)),  // 15% large tiles
      banner: Math.max(1, Math.floor(shuffled.length * 0.08)), // 8% banner tiles
      medium: Math.max(3, Math.floor(shuffled.length * 0.25)), // 25% medium tiles
      small: shuffled.length // Rest are small tiles (44%)
    };
    
    console.log('🎭 24/7 extreme tile distribution:', maxSizes);
    
    for (const notification of shuffled) {
      if (filledCells >= totalCells * 0.80) break; // Leave 20% for aggressive morphing
      if (usedNotificationIds.has(notification.id)) continue;
      
      // Completely random size selection with limits
      const availableSizes: TileConfig['size'][] = [];
      
      if (sizeCounters.hero < maxSizes.hero) availableSizes.push('hero');
      if (sizeCounters.large < maxSizes.large) availableSizes.push('large');
      if (sizeCounters.banner < maxSizes.banner) availableSizes.push('banner');
      if (sizeCounters.medium < maxSizes.medium) availableSizes.push('medium');
      availableSizes.push('small'); // Always available
      
      // Random selection from available sizes
      const targetSize = availableSizes[Math.floor(Math.random() * availableSizes.length)];
      
      const { size, width, height, priority, duration, hasTrailer: tileHasTrailer, trailerDuration } = getTileSize(notification, targetSize);
      const position = findAvailablePosition(width, height, initialTiles);
      
      if (position) {
        const tileId = `tile_${Date.now()}_${tileCounterRef.current++}_${notification.id}`;
        initialTiles.push({
          id: tileId,
          notification,
          position,
          size,
          priority,
          duration,
          createdAt: Date.now(),
          hasTrailer: tileHasTrailer,
          trailerDuration,
          isPlayingTrailer: false
        });
        usedNotificationIds.add(notification.id);
        filledCells += width * height;
        sizeCounters[size]++;
        
        console.log(`✅ Added ${size} tile: ${notification.title} (${width}x${height})`);
      }
    }
    
    // SECOND PASS - fill remaining gaps with compact tiles (NO DUPLICATES)
    const gapSizes = [
      { width: 4, height: 3, size: 'medium' as const },  // Medium gaps
      { width: 3, height: 3, size: 'small' as const },   // Square small
      { width: 3, height: 2, size: 'small' as const },   // Wide small
      { width: 2, height: 3, size: 'small' as const },   // Tall small
      { width: 2, height: 2, size: 'small' as const },   // Tiny square
      { width: 1, height: 2, size: 'small' as const },   // Micro tall
      { width: 2, height: 1, size: 'small' as const },   // Micro wide
    ];
    
    for (const notification of shuffled) {
      if (filledCells >= totalCells * 0.95) break; // Fill to 95%
      if (usedNotificationIds.has(notification.id)) continue; // Skip already used
      
      for (const gapSize of gapSizes) {
        const position = findAvailablePosition(gapSize.width, gapSize.height, initialTiles);
        if (position) {
          const tileId = `tile_${Date.now()}_${tileCounterRef.current++}_${notification.id}`;
          initialTiles.push({
            id: tileId,
            notification,
            position,
            size: gapSize.size,
            priority: 5,
            duration: 15000,
            createdAt: Date.now(),
            hasTrailer: false,
            isPlayingTrailer: false
          });
          usedNotificationIds.add(notification.id); // Mark as used
          filledCells += gapSize.width * gapSize.height;
          
          console.log(`🔧 Gap filled: ${notification.title} (${gapSize.width}x${gapSize.height}) - ID: ${notification.id}`);
          break;
        }
      }
    }
    
    const coverage = Math.round((filledCells / totalCells) * 100);
    const uniqueCount = usedNotificationIds.size;
    
    // FINAL VALIDATION - check for overlaps in initial setup
    if (!validateGridPositions(initialTiles)) {
      console.error('🚨 OVERLAPS DETECTED in initial setup, cleaning up...');
      // Remove overlapping tiles
      const cleanTiles: TileConfig[] = [];
      for (const tile of initialTiles) {
        const wouldOverlap = cleanTiles.some(existingTile => {
          return !(
            tile.position.x >= existingTile.position.x + existingTile.position.width ||
            tile.position.x + tile.position.width <= existingTile.position.x ||
            tile.position.y >= existingTile.position.y + existingTile.position.height ||
            tile.position.y + tile.position.height <= existingTile.position.y
          );
        });
        
        if (!wouldOverlap) {
          cleanTiles.push(tile);
        } else {
          console.log(`🧹 Removed overlapping tile: ${tile.notification.title}`);
        }
      }
      setActiveTiles(cleanTiles);
    } else {
      console.log(`✅ Initialized ${initialTiles.length} UNIQUE tiles, coverage: ${coverage}%`);
      console.log(`📊 Used ${uniqueCount}/${notifications.length} unique notifications`);
      console.log(`🎭 Types: ${[...new Set(initialTiles.map(t => t.notification.type))].join(', ')}`);
      setActiveTiles(initialTiles);
    }
  }, [notifications.length, gridDimensions, getTileSize, findAvailablePosition]);

  // Netflix-style dynamic tile morphing system with size transitions and lifecycle management
  useEffect(() => {
    if (activeTiles.length === 0 || notifications.length === 0) return;
    
    console.log('🎬 Netflix-style morphing active:', activeTiles.length, 'tiles,', notifications.length, 'notifications available');
    
    let morphTimer: NodeJS.Timeout;
    let morphCount = 0;
    
    const scheduleMorph = () => {
      // Reduced speed by 30% - 6.5-15.6 seconds (was 5-12 seconds)
      const randomInterval = 6500 + Math.random() * 9100;
      
      morphTimer = setTimeout(() => {
        if (!mountedRef.current) return;
        
        morphCount++;
        console.log(`🎭 24/7 morph cycle #${morphCount}`);
        
        setActiveTiles(currentTiles => {
          const now = Date.now();
          
          // More aggressive morphing for 24/7 operation
          const morphableTiles = currentTiles.filter(tile => {
            const displayTime = now - tile.createdAt;
            
            // ABSOLUTE protection for playing trailers
            if (playingTrailers.has(tile.id)) {
              console.log(`   🔒 TRAILER PROTECTED: ${tile.notification.title}`);
              return false;
            }
            
            // Increased display times by 30% - 10.4s for trailer tiles, 6.5s for others (was 8s/5s)
            const minDisplayTime = tile.hasTrailer ? 10400 : 6500;
            return displayTime >= minDisplayTime;
          });
          
          console.log(`   Morphable: ${morphableTiles.length}/${currentTiles.length}`);
          
          if (morphableTiles.length === 0) {
            console.log('   ⏸️ All tiles protected, waiting...');
            scheduleMorph();
            return currentTiles;
          }
          
          // Get available content for morphing
          const currentNotifIds = new Set(currentTiles.map(t => t.notification.id));
          const availableNotifications = notifications.filter(n => 
            n && n.id && !currentNotifIds.has(n.id)
          );
          
          console.log(`   Available content: ${availableNotifications.length}`);
          
          // Always perform morphing - either content or size
          if (availableNotifications.length === 0) {
            console.log('   🔄 Performing aggressive size morphing...');
            return performAggressiveSizeMorphing(currentTiles, morphableTiles);
          }
          
          // 24/7 optimized content and size morphing
          return performAggressiveContentMorphing(currentTiles, morphableTiles, availableNotifications);
        });
      }, randomInterval);
    };
    
    // 24/7 Aggressive size morphing - extreme variety
    const performAggressiveSizeMorphing = (currentTiles: TileConfig[], morphableTiles: TileConfig[]): TileConfig[] => {
      const newTiles = [...currentTiles];
      const tilesToMorph = Math.min(4, morphableTiles.length); // Morph up to 4 tiles at once
      
      for (let i = 0; i < tilesToMorph; i++) {
        const tileToMorph = morphableTiles[i];
        const tileIndex = currentTiles.findIndex(t => t.id === tileToMorph.id);
        if (tileIndex === -1) continue;
        
        // Random size selection for maximum variety
        const allSizes: TileConfig['size'][] = ['small', 'medium', 'large', 'banner', 'hero'];
        const currentSize = tileToMorph.size;
        
        // Exclude current size to force change
        const otherSizes = allSizes.filter(s => s !== currentSize);
        const newSize = otherSizes[Math.floor(Math.random() * otherSizes.length)];
        
        // Get new dimensions for the target size
        const { width, height, priority, duration } = getTileSize(tileToMorph.notification, newSize);
        
        // Try to find position for new size
        const tempTiles = newTiles.filter((_, idx) => idx !== tileIndex);
        let newPosition = findAvailablePosition(width, height, tempTiles);
        let finalSize = newSize;
        
        if (!newPosition) {
          // Try all other sizes if preferred doesn't fit
          for (const fallbackSize of otherSizes) {
            if (fallbackSize === newSize) continue;
            const fallbackConfig = getTileSize(tileToMorph.notification, fallbackSize);
            newPosition = findAvailablePosition(fallbackConfig.width, fallbackConfig.height, tempTiles);
            if (newPosition) {
              finalSize = fallbackSize;
              break;
            }
          }
        }
        
        if (newPosition) {
          const morphedTile: TileConfig = {
            ...tileToMorph,
            id: `tile_${Date.now()}_${tileCounterRef.current++}_${tileToMorph.notification.id}`,
            position: newPosition,
            size: finalSize,
            priority,
            duration,
            createdAt: Date.now(),
          };
          
          newTiles[tileIndex] = morphedTile;
          console.log(`   📏 AGGRESSIVE SIZE MORPH: ${currentSize} → ${finalSize} | ${tileToMorph.notification.title}`);
        }
      }
      
      scheduleMorph();
      return newTiles;
    };
    
    // 24/7 Aggressive content morphing with extreme size variations
    const performAggressiveContentMorphing = (currentTiles: TileConfig[], morphableTiles: TileConfig[], availableNotifications: EnhancedNotification[]): TileConfig[] => {
      const newTiles = [...currentTiles];
      const tilesToMorph = Math.min(5, morphableTiles.length, availableNotifications.length); // Up to 5 tiles
      const shuffledMorphable = [...morphableTiles].sort(() => Math.random() - 0.5);
      const shuffledAvailable = [...availableNotifications].sort(() => Math.random() - 0.5);
      
      let morphedCount = 0;
      
      for (let i = 0; i < tilesToMorph; i++) {
        const tileToMorph = shuffledMorphable[i];
        const newNotification = shuffledAvailable[i];
        const tileIndex = currentTiles.findIndex(t => t.id === tileToMorph.id);
        
        if (tileIndex === -1) continue;
        
        // Prevent duplicates
        const wouldBeDuplicate = newTiles.some((tile, idx) => 
          idx !== tileIndex && tile.notification.id === newNotification.id
        );
        
        if (wouldBeDuplicate) {
          console.log(`   ⚠️ DUPLICATE PREVENTED: ${newNotification.title}`);
          continue;
        }
        
        // Completely random size selection for extreme variety
        const allSizes: TileConfig['size'][] = ['small', 'medium', 'large', 'banner', 'hero'];
        const targetSize = allSizes[Math.floor(Math.random() * allSizes.length)];
        
        const { width, height, priority, duration, hasTrailer } = getTileSize(newNotification, targetSize);
        
        // Find position with aggressive fallback strategy
        const tempTiles = newTiles.filter((_, idx) => idx !== tileIndex);
        let newPosition = findAvailablePosition(width, height, tempTiles);
        let finalSize = targetSize;
        
        if (!newPosition) {
          // Try all sizes until one fits
          for (const fallbackSize of allSizes) {
            if (fallbackSize === targetSize) continue;
            const fallbackConfig = getTileSize(newNotification, fallbackSize);
            newPosition = findAvailablePosition(fallbackConfig.width, fallbackConfig.height, tempTiles);
            if (newPosition) {
              finalSize = fallbackSize;
              break;
            }
          }
        }
        
        if (!newPosition) {
          console.log(`   ❌ No position available for ${newNotification.title}`);
          continue;
        }
        
        // Create morphed tile
        const morphedTile: TileConfig = {
          id: `tile_${Date.now()}_${tileCounterRef.current++}_${newNotification.id}`,
          notification: newNotification,
          position: newPosition,
          size: finalSize,
          priority,
          duration,
          createdAt: Date.now(),
          hasTrailer,
          trailerDuration: hasTrailer ? 60000 : undefined,
          isPlayingTrailer: false
        };
        
        newTiles[tileIndex] = morphedTile;
        morphedCount++;
        
        console.log(`   🎬 AGGRESSIVE CONTENT MORPH: ${tileToMorph.notification.title} → ${newNotification.title} (${finalSize})`);
      }
      
      // Validation
      if (!validateGridPositions(newTiles)) {
        console.error('   🚨 OVERLAP DETECTED, reverting');
        scheduleMorph();
        return currentTiles;
      }
      
      console.log(`   ✅ 24/7 morph complete: ${morphedCount} tiles transformed`);
      scheduleMorph();
      return newTiles;
    };
    
    scheduleMorph();
    
    return () => {
      if (morphTimer) {
        clearTimeout(morphTimer);
      }
    };
  }, [activeTiles.length, notifications.length, getTileSize, playingTrailers, findAvailablePosition, gridDimensions, validateGridPositions]);

  // Handle tile click
  const handleTileClick = useCallback((notification: EnhancedNotification) => {
    // Handle navigation based on notification type
    if (notification.type === 'tmdb_upcoming' || notification.type === 'tmdb_now_playing' || notification.type === 'tmdb_trending') {
      if ((notification as any).tmdb_ids && (notification as any).tmdb_ids.length > 0) {
        const tmdbId = (notification as any).tmdb_ids[0];
        const isTV = notification.type.includes('tv');
        router.push(`/tmdb-movie/${tmdbId}${isTV ? '?type=tv' : '?type=movie'}`);
      }
    } else if (notification.type === 'new_episodes' && (notification as any).series_id) {
      router.push(`/tv-series/${(notification as any).series_id}`);
    } else if (notification.movie_ids && notification.movie_ids.length > 0) {
      const movieId = notification.movie_ids[0];
      if (movieId && movieId > 0) {
        router.push(`/movie/${movieId}`);
      }
    }
  }, [router]);

  // Handle trailer start - ENHANCED tracking with video limits
  const handleTrailerStart = useCallback((tileId: string) => {
    console.log('▶️ Trailer started:', tileId);
    setPlayingTrailers(prev => new Set(prev).add(tileId));
    setActiveVideoTiles(prev => new Set(prev).add(tileId));
    setActiveTiles(prev => prev.map(tile => 
      tile.id === tileId ? { 
        ...tile, 
        isPlayingTrailer: true, 
        trailerStartTime: Date.now(),
        // Ensure trailer duration is set for protection
        trailerDuration: tile.trailerDuration || 45000 // Default 45s if not set
      } : tile
    ));
  }, []);

  // Handle trailer end - ENHANCED tracking with video limits
  const handleTrailerEnd = useCallback((tileId: string) => {
    console.log('⏹️ Trailer ended:', tileId);
    setPlayingTrailers(prev => {
      const newSet = new Set(prev);
      newSet.delete(tileId);
      return newSet;
    });
    setActiveVideoTiles(prev => {
      const newSet = new Set(prev);
      newSet.delete(tileId);
      return newSet;
    });
    setActiveTiles(prev => prev.map(tile => 
      tile.id === tileId ? { 
        ...tile, 
        isPlayingTrailer: false,
        // Keep trailerStartTime for protection calculation
      } : tile
    ));
  }, []);

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      <Navbar />
      <div className="absolute inset-0 overflow-hidden bg-black" style={{ top: '64px' }}>
        {/* Solid black background */}
        <div className="absolute inset-0 bg-black" />
        
        {/* Notification Tiles - Fill entire viewport */}
        <div className="absolute inset-0 z-20">
          <AnimatePresence mode="popLayout">
            {activeTiles.map((tile, index) => (
              <motion.div
                key={tile.id}
                layout
                initial={{ 
                  opacity: 0, 
                  scale: 0.98
                }}
                animate={{ 
                  opacity: 1, 
                  scale: 1
                }}
                exit={{ 
                  opacity: 0, 
                  scale: 0.98,
                  transition: { duration: 0.2 }
                }}
                transition={{ 
                  duration: 0.78, // Increased by 30% (was 0.6)
                  ease: "easeInOut",
                  delay: index * 0.026, // Increased by 30% (was 0.02)
                  layout: { 
                    duration: 1.04, // Increased by 30% (was 0.8)
                    ease: "easeInOut"
                  }
                }}
                className="absolute overflow-hidden rounded-lg shadow-2xl cursor-pointer"
                style={{
                  left: `calc(${(tile.position.x / gridDimensions.cols) * 100}% + 2px)`,
                  top: `calc(${(tile.position.y / gridDimensions.rows) * 100}% + 2px)`,
                  width: `calc(${(tile.position.width / gridDimensions.cols) * 100}% - 4px)`,
                  height: `calc(${(tile.position.height / gridDimensions.rows) * 100}% - 4px)`,
                  zIndex: tile.priority + 20,
                  boxShadow: `0 8px 32px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.1)`,
                  minWidth: '120px', // Reduced minimum width for more tiles
                  minHeight: '80px', // Reduced minimum height for more tiles
                  // Prevent overlaps with strict positioning
                  position: 'absolute',
                  overflow: 'hidden',
                  isolation: 'isolate', // Create new stacking context
                }}
              >
                <NotificationTile
                  notification={tile.notification}
                  size={tile.size}
                  className="w-full h-full tile-container"
                  onTrailerStart={() => handleTrailerStart(tile.id)}
                  onTrailerEnd={() => handleTrailerEnd(tile.id)}
                  onTileClick={() => handleTileClick(tile.notification)}
                  autoPlayAudio={index === 0} // Only first tile gets audio
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        
        {/* Empty state */}
        {notifications.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center z-30">
            <div className="text-center">
              <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                <div className="w-10 h-10 border-2 border-red-500/30 border-t-red-500 rounded-full" />
                <div className="absolute inset-0 border-2 border-red-500/10 rounded-full animate-ping"></div>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Live Activity Loading</h2>
              <p className="text-white/60">Preparing your personalized content feed...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;