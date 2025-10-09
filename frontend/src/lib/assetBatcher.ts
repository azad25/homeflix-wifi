/**
 * Asset Batching System for HomeFlix
 * Reduces API load by batching asset requests and implementing intelligent preloading
 */

interface AssetRequest {
  id: string;
  type: 'thumbnails' | 'posters' | 'previews';
  priority: 'high' | 'medium' | 'low';
  timestamp: number;
}

interface BatchedAssetResponse {
  [key: string]: string | null; // URL or null if not found
}

class AssetBatcher {
  private pendingRequests = new Map<string, AssetRequest>();
  private batchTimer: NodeJS.Timeout | null = null;
  private readonly BATCH_DELAY = 50; // 50ms batching window
  private readonly MAX_BATCH_SIZE = 20; // Maximum assets per batch
  private readonly CONCURRENT_BATCHES = 3; // Maximum concurrent batch requests
  private activeBatches = 0;
  
  // Cache for asset URLs to prevent duplicate requests
  private assetCache = new Map<string, { url: string | null; timestamp: number }>();
  private readonly ASSET_CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours

  /**
   * Request an asset with batching
   */
  async requestAsset(
    type: 'thumbnails' | 'posters' | 'previews',
    id: string,
    priority: 'high' | 'medium' | 'low' = 'medium'
  ): Promise<string | null> {
    const cacheKey = `${type}:${id}`;
    
    // Check cache first
    const cached = this.assetCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.ASSET_CACHE_TTL) {
      return cached.url;
    }

    // Add to pending requests
    this.pendingRequests.set(cacheKey, {
      id,
      type,
      priority,
      timestamp: Date.now()
    });

    // Schedule batch processing
    this.scheduleBatch();

    // Return promise that resolves when batch completes
    return new Promise((resolve) => {
      const checkResult = () => {
        const result = this.assetCache.get(cacheKey);
        if (result) {
          resolve(result.url);
        } else {
          // Check again in 100ms
          setTimeout(checkResult, 100);
        }
      };
      
      // Start checking after initial delay
      setTimeout(checkResult, this.BATCH_DELAY + 50);
    });
  }

  /**
   * Schedule batch processing
   */
  private scheduleBatch() {
    if (this.batchTimer) return;

    this.batchTimer = setTimeout(() => {
      this.processBatch();
      this.batchTimer = null;
    }, this.BATCH_DELAY);
  }

  /**
   * Process pending requests in batches
   */
  private async processBatch() {
    if (this.pendingRequests.size === 0 || this.activeBatches >= this.CONCURRENT_BATCHES) {
      return;
    }

    // Sort requests by priority and timestamp
    const sortedRequests = Array.from(this.pendingRequests.entries())
      .sort(([, a], [, b]) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return a.timestamp - b.timestamp;
      });

    // Take up to MAX_BATCH_SIZE requests
    const batchRequests = sortedRequests.slice(0, this.MAX_BATCH_SIZE);
    
    // Remove from pending
    batchRequests.forEach(([key]) => {
      this.pendingRequests.delete(key);
    });

    if (batchRequests.length === 0) return;

    this.activeBatches++;

    try {
      // Group by asset type for efficient processing
      const groupedRequests = this.groupRequestsByType(batchRequests);
      
      // Process each type group
      await Promise.all(
        Object.entries(groupedRequests).map(([type, requests]) =>
          this.processBatchGroup(type as any, requests)
        )
      );
    } catch (error) {
      console.error('Batch processing failed:', error);
    } finally {
      this.activeBatches--;
      
      // Schedule next batch if there are pending requests
      if (this.pendingRequests.size > 0) {
        this.scheduleBatch();
      }
    }
  }

  /**
   * Group requests by asset type
   */
  private groupRequestsByType(requests: [string, AssetRequest][]) {
    const grouped: Record<string, AssetRequest[]> = {};
    
    requests.forEach(([, request]) => {
      if (!grouped[request.type]) {
        grouped[request.type] = [];
      }
      grouped[request.type].push(request);
    });
    
    return grouped;
  }

  /**
   * Process a batch group of the same asset type
   */
  private async processBatchGroup(type: 'thumbnails' | 'posters' | 'previews', requests: AssetRequest[]) {
    const promises = requests.map(async (request) => {
      const cacheKey = `${type}:${request.id}`;
      
      try {
        // Make individual request with error handling
        const response = await fetch(`/api/${type}/${request.id}`, {
          method: 'HEAD', // Use HEAD to check existence without downloading
        });
        
        const url = response.ok ? `/api/${type}/${request.id}` : null;
        
        // Cache the result
        this.assetCache.set(cacheKey, {
          url,
          timestamp: Date.now()
        });
        
        return { key: cacheKey, url };
      } catch (error) {
        console.warn(`Failed to fetch ${type} for ${request.id}:`, error);
        
        // Cache null result to prevent retries
        this.assetCache.set(cacheKey, {
          url: null,
          timestamp: Date.now()
        });
        
        return { key: cacheKey, url: null };
      }
    });

    // Process with limited concurrency
    const results = await this.processConcurrently(promises, 5);
    
    console.log(`Processed batch of ${requests.length} ${type} requests`);
  }

  /**
   * Process promises with limited concurrency
   */
  private async processConcurrently<T>(promises: Promise<T>[], concurrency: number): Promise<T[]> {
    const results: T[] = [];
    
    for (let i = 0; i < promises.length; i += concurrency) {
      const batch = promises.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(batch);
      
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        }
      });
    }
    
    return results;
  }

  /**
   * Preload assets for visible media items
   */
  async preloadAssets(mediaItems: Array<{ id: string }>, types: Array<'thumbnails' | 'posters' | 'previews'> = ['thumbnails']) {
    const preloadPromises = mediaItems.flatMap(item =>
      types.map(type => this.requestAsset(type, item.id, 'low'))
    );

    // Don't await - let preloading happen in background
    Promise.allSettled(preloadPromises).then(() => {
      console.log(`Preloaded assets for ${mediaItems.length} media items`);
    });
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache() {
    const now = Date.now();
    const expired: string[] = [];
    
    this.assetCache.forEach((value, key) => {
      if (now - value.timestamp > this.ASSET_CACHE_TTL) {
        expired.push(key);
      }
    });
    
    expired.forEach(key => this.assetCache.delete(key));
    
    if (expired.length > 0) {
      console.log(`Cleared ${expired.length} expired asset cache entries`);
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      cacheSize: this.assetCache.size,
      pendingRequests: this.pendingRequests.size,
      activeBatches: this.activeBatches
    };
  }
}

// Global asset batcher instance
export const assetBatcher = new AssetBatcher();

// Clean up expired cache entries every 10 minutes
setInterval(() => {
  assetBatcher.clearExpiredCache();
}, 10 * 60 * 1000);

import { useState, useEffect } from 'react';

/**
 * Hook for batched asset loading
 */

export function useBatchedAsset(
  type: 'thumbnails' | 'posters' | 'previews',
  id: string,
  priority: 'high' | 'medium' | 'low' = 'medium'
) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    
    assetBatcher.requestAsset(type, id, priority)
      .then(result => {
        setUrl(result);
        setLoading(false);
      })
      .catch(error => {
        console.error(`Failed to load ${type} for ${id}:`, error);
        setUrl(null);
        setLoading(false);
      });
  }, [type, id, priority]);

  return { url, loading };
}

export default assetBatcher;
