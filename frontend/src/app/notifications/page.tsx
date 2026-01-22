"use client";

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getApiUrl } from '@/lib/api';
import { Notification } from '@/types/notifications';
import NotificationTile from '@/components/notifications/NotificationTile';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import '@/styles/notifications.css';

interface GridPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TileConfig {
  id: string;
  notification: Notification;
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
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeTiles, setActiveTiles] = useState<TileConfig[]>([]);
  const [playingTrailers, setPlayingTrailers] = useState<Set<string>>(new Set());
  const [isLoadingFresh, setIsLoadingFresh] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const tileCounterRef = useRef(0);
  const mountedRef = useRef(true);

  // Static grid configuration - optimized for full viewport usage
  const gridDimensions = useMemo(() => {
    if (typeof window === 'undefined') return { cols: 16, rows: 9 };
    const width = window.innerWidth;
    if (width < 768) return { cols: 8, rows: 10 };
    if (width < 1024) return { cols: 12, rows: 9 };
    if (width < 1440) return { cols: 14, rows: 9 };
    return { cols: 16, rows: 9 };
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
        
        // Use cache if less than 5 minutes old
        if (age < 5 * 60 * 1000) {
          console.log('⚡ Loading from cache (age:', Math.round(age / 1000), 'seconds)');
          setNotifications(data);
          return true;
        }
      }
    } catch (error) {
      console.error('Failed to load cache:', error);
    }
    return false;
  }, []);

  // Fetch notifications with caching - refresh every 10 seconds
  const fetchNotifications = useCallback(async (skipCache = false) => {
    if (!mountedRef.current) return;
    
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/notifications?limit=100`, {
        cache: 'default',
        headers: {
          'Accept': 'application/json',
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (mountedRef.current) {
          // Remove duplicates
          const seenSignatures = new Set<string>();
          const uniqueNotifications = (data.notifications || []).filter((notif: Notification) => {
            const movieIds = notif.movie_ids?.sort().join(',') || '';
            const tmdbIds = notif.tmdb_ids?.sort().join(',') || '';
            const signature = `${notif.type}|${notif.title.toLowerCase().trim()}|${movieIds}|${tmdbIds}`;
            
            if (seenSignatures.has(signature)) {
              return false;
            }
            
            seenSignatures.add(signature);
            return true;
          });
          
          console.log('📥 Fetched', data.notifications?.length || 0, 'notifications, filtered to', uniqueNotifications.length, 'unique');
          
          // Update state
          setNotifications(uniqueNotifications);
          
          // Cache for next time
          try {
            localStorage.setItem('homeflix_notifications_cache', JSON.stringify({
              data: uniqueNotifications,
              timestamp: Date.now()
            }));
            console.log('💾 Cached notifications for instant load');
          } catch (e) {
            console.warn('Failed to cache notifications:', e);
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  }, []);

  useEffect(() => {
    // Load cached data immediately for instant page load
    const hasCache = loadCachedNotifications();
    
    // Fetch fresh data in background
    fetchNotifications();
    
    // Refresh notifications every 10 seconds for new content
    const refreshInterval = setInterval(() => {
      fetchNotifications();
    }, 10000);
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    
    return () => {
      mountedRef.current = false;
      document.body.style.overflow = '';
      clearInterval(refreshInterval);
    };
  }, [fetchNotifications, loadCachedNotifications]);

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

  // Get tile size - TMDB tiles are larger and show more content
  const getTileSize = useCallback((notification: Notification): { size: TileConfig['size'], width: number, height: number, priority: number, duration: number, hasTrailer: boolean, trailerDuration?: number } => {
    const type = notification.type;
    const hasTrailer = !!(notification as any).trailer_key;
    const { rows, cols } = gridDimensions;
    
    // Ensure tiles don't exceed viewport
    const maxHeight = Math.min(rows, 5);
    const maxWidth = Math.min(cols, 10);
    
    // TMDB tiles with trailers get HERO size - wait for trailer to finish
    if (hasTrailer) {
      return { 
        size: 'hero', 
        width: Math.min(10, maxWidth), 
        height: Math.min(5, maxHeight), 
        priority: 10, 
        duration: 60000, // 60 seconds - enough for trailer
        hasTrailer: true, 
        trailerDuration: 45000 // 45 second trailer
      };
    }
    
    // TMDB content gets larger tiles for better visibility
    switch (type) {
      case 'tmdb_trending':
      case 'tmdb_now_playing':
      case 'tmdb_upcoming':
      case 'tmdb_now_airing_tv':
      case 'tmdb_upcoming_tv':
        // Large TMDB tiles - show more content
        return { size: 'large', width: Math.min(6, maxWidth), height: Math.min(4, maxHeight), priority: 9, duration: 20000, hasTrailer: false };
      
      case 'continue_watching':
        // Wide banner style
        return { size: 'banner', width: Math.min(8, maxWidth), height: Math.min(3, maxHeight), priority: 8, duration: 25000, hasTrailer: false };
      
      case 'tmdb_coming_soon':
        // Medium-large tiles
        return { size: 'large', width: Math.min(5, maxWidth), height: Math.min(4, maxHeight), priority: 7, duration: 18000, hasTrailer: false };
      
      case 'movie_suggestion':
      case 'single_movie_suggestion':
        // Medium tiles
        return { size: 'medium', width: Math.min(4, maxWidth), height: Math.min(4, maxHeight), priority: 6, duration: 15000, hasTrailer: false };
      
      case 'local_trending':
      case 'recently_added':
      case 'new_movies':
        // Small-medium tiles
        return { size: 'small', width: Math.min(3, maxWidth), height: Math.min(4, maxHeight), priority: 5, duration: 12000, hasTrailer: false };
      
      case 'genre_based':
      case 'watch_again':
        // Small tiles
        return { size: 'small', width: Math.min(3, maxWidth), height: Math.min(3, maxHeight), priority: 4, duration: 12000, hasTrailer: false };
      
      default:
        return { size: 'small', width: Math.min(3, maxWidth), height: Math.min(3, maxHeight), priority: 5, duration: 12000, hasTrailer: false };
    }
  }, [gridDimensions]);

  // Initialize tiles once - SHOW UNIQUE TILES ONLY, NO DUPLICATES
  useEffect(() => {
    if (notifications.length === 0) return;
    if (activeTiles.length > 0) return; // NEVER re-initialize
    
    console.log('🎬 Filling viewport with tiles:', notifications.length, 'unique notifications');
    
    const initialTiles: TileConfig[] = [];
    const shuffled = [...notifications].sort(() => Math.random() - 0.5);
    const usedNotificationIds = new Set<string>();
    
    const totalCells = gridDimensions.cols * gridDimensions.rows;
    let filledCells = 0;
    
    // FIRST PASS - use all unique notifications with their preferred sizes
    for (const notification of shuffled) {
      if (filledCells >= totalCells) break;
      if (usedNotificationIds.has(notification.id)) continue;
      
      const { size, width, height, priority, duration, hasTrailer, trailerDuration } = getTileSize(notification);
      const position = findAvailablePosition(width, height, initialTiles);
      
      if (position) {
        initialTiles.push({
          id: `tile_${Date.now()}_${tileCounterRef.current++}_${notification.id}`,
          notification,
          position,
          size,
          priority,
          duration,
          createdAt: Date.now(),
          hasTrailer,
          trailerDuration,
          isPlayingTrailer: false
        });
        usedNotificationIds.add(notification.id);
        filledCells += width * height;
      }
    }
    
    // SECOND PASS - try smaller sizes for remaining unique notifications
    const gapSizes = [
      { width: 3, height: 3 },
      { width: 2, height: 3 },
      { width: 3, height: 2 },
      { width: 2, height: 2 },
    ];
    
    for (const notification of shuffled) {
      if (filledCells >= totalCells * 0.95) break;
      if (usedNotificationIds.has(notification.id)) continue; // Skip already used
      
      for (const gapSize of gapSizes) {
        const position = findAvailablePosition(gapSize.width, gapSize.height, initialTiles);
        if (position) {
          initialTiles.push({
            id: `tile_${Date.now()}_${tileCounterRef.current++}_${notification.id}`,
            notification,
            position,
            size: 'small',
            priority: 5,
            duration: 12000,
            createdAt: Date.now(),
            hasTrailer: false,
            isPlayingTrailer: false
          });
          usedNotificationIds.add(notification.id);
          filledCells += gapSize.width * gapSize.height;
          break;
        }
      }
    }
    
    const coverage = Math.round((filledCells / totalCells) * 100);
    console.log('✅ Initialized', initialTiles.length, 'UNIQUE tiles, coverage:', coverage + '%');
    console.log('📊 Notification types:', [...new Set(initialTiles.map(t => t.notification.type))].join(', '));
    
    setActiveTiles(initialTiles);
  }, [notifications.length, gridDimensions, getTileSize, findAvailablePosition]);

  // Smart rotation - rotate tiles every 5 seconds for dynamic experience
  useEffect(() => {
    if (activeTiles.length === 0 || notifications.length === 0) return;
    
    console.log('🔄 Rotation system active:', activeTiles.length, 'tiles,', notifications.length, 'notifications available');
    
    let rotationTimer: NodeJS.Timeout;
    let rotationCount = 0;
    
    const scheduleRotation = () => {
      // Rotate every 5 seconds for dynamic experience
      rotationTimer = setTimeout(() => {
        if (!mountedRef.current) return;
        
        rotationCount++;
        console.log(`🔄 Rotation attempt #${rotationCount}`);
        
        setActiveTiles(currentTiles => {
          // Find tiles that can be rotated (no trailers playing)
          const rotatableTiles = currentTiles.filter(tile => 
            !tile.hasTrailer || !playingTrailers.has(tile.id)
          );
          
          console.log(`   Rotatable tiles: ${rotatableTiles.length}/${currentTiles.length}`);
          
          if (rotatableTiles.length === 0) {
            console.log('   ⏸️ All tiles have trailers, skipping rotation');
            scheduleRotation();
            return currentTiles;
          }
          
          // Get available notifications (not currently displayed)
          const currentNotifIds = new Set(currentTiles.map(t => t.notification.id));
          const availableNotifications = notifications.filter(n => !currentNotifIds.has(n.id));
          
          console.log(`   Available notifications: ${availableNotifications.length}`);
          
          if (availableNotifications.length === 0) {
            console.log('   ⏸️ No new notifications available for rotation');
            scheduleRotation();
            return currentTiles;
          }
          
          // Rotate 2-3 tiles at a time for more dynamic feel
          const tilesToRotate = Math.min(2, rotatableTiles.length, availableNotifications.length);
          const newTiles = [...currentTiles];
          let rotatedCount = 0;
          
          for (let i = 0; i < tilesToRotate; i++) {
            if (rotatableTiles.length === 0 || availableNotifications.length === 0) break;
            
            const randomIndex = Math.floor(Math.random() * rotatableTiles.length);
            const tileToReplace = rotatableTiles[randomIndex];
            const tileIndex = currentTiles.findIndex(t => t.id === tileToReplace.id);
            
            // Pick random new notification
            const notifIndex = Math.floor(Math.random() * availableNotifications.length);
            const newNotification = availableNotifications[notifIndex];
            const { size, width, height, priority, duration, hasTrailer, trailerDuration } = getTileSize(newNotification);
            
            // Only replace if same size (prevents layout shifts)
            if (width === tileToReplace.position.width && height === tileToReplace.position.height) {
              const newTile: TileConfig = {
                id: `tile_${Date.now()}_${tileCounterRef.current++}_${newNotification.id}`,
                notification: newNotification,
                position: tileToReplace.position,
                size,
                priority,
                duration,
                createdAt: Date.now(),
                hasTrailer,
                trailerDuration,
                isPlayingTrailer: false
              };
              
              newTiles[tileIndex] = newTile;
              rotatedCount++;
              console.log(`   ✅ Rotated: ${tileToReplace.notification.title} → ${newNotification.title}`);
              
              // Remove from available lists
              availableNotifications.splice(notifIndex, 1);
            } else {
              console.log(`   ⏭️ Size mismatch: need ${tileToReplace.position.width}x${tileToReplace.position.height}, got ${width}x${height}`);
            }
            
            // Remove from rotatable list
            rotatableTiles.splice(randomIndex, 1);
          }
          
          console.log(`   🎯 Rotated ${rotatedCount} tiles`);
          scheduleRotation();
          return newTiles;
        });
      }, 5000); // 5 seconds between rotations
    };
    
    scheduleRotation();
    
    return () => {
      if (rotationTimer) {
        clearTimeout(rotationTimer);
      }
    };
  }, [activeTiles.length, notifications.length, getTileSize, playingTrailers]);

  // Handle tile click
  const handleTileClick = useCallback((notification: Notification) => {
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

  // Handle trailer start
  const handleTrailerStart = useCallback((tileId: string) => {
    console.log('▶️ Trailer started:', tileId);
    setPlayingTrailers(prev => new Set(prev).add(tileId));
    setActiveTiles(prev => prev.map(tile => 
      tile.id === tileId ? { ...tile, isPlayingTrailer: true, trailerStartTime: Date.now() } : tile
    ));
  }, []);

  // Handle trailer end
  const handleTrailerEnd = useCallback((tileId: string) => {
    console.log('⏹️ Trailer ended:', tileId);
    setPlayingTrailers(prev => {
      const newSet = new Set(prev);
      newSet.delete(tileId);
      return newSet;
    });
    setActiveTiles(prev => prev.map(tile => 
      tile.id === tileId ? { ...tile, isPlayingTrailer: false } : tile
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
                  duration: 0.4,
                  ease: "easeOut",
                  delay: index * 0.015,
                  layout: { duration: 0.4, ease: "easeInOut" }
                }}
                className="absolute overflow-hidden rounded-lg shadow-2xl cursor-pointer"
                style={{
                  left: `calc(${(tile.position.x / gridDimensions.cols) * 100}% + 2px)`,
                  top: `calc(${(tile.position.y / gridDimensions.rows) * 100}% + 2px)`,
                  width: `calc(${(tile.position.width / gridDimensions.cols) * 100}% - 4px)`,
                  height: `calc(${(tile.position.height / gridDimensions.rows) * 100}% - 4px)`,
                  zIndex: tile.priority + 20,
                  boxShadow: `0 8px 32px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.1)`,
                }}
              >
                <NotificationTile
                  notification={tile.notification}
                  size={tile.size}
                  className="w-full h-full tile-container"
                  onTrailerStart={() => handleTrailerStart(tile.id)}
                  onTrailerEnd={() => handleTrailerEnd(tile.id)}
                  onTileClick={() => handleTileClick(tile.notification)}
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