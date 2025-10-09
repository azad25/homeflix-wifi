/**
 * Enhanced Error Handling for HomeFlix API Requests
 * Provides intelligent fallbacks and prevents 404 flooding
 */

interface ErrorCache {
  [key: string]: {
    status: number;
    timestamp: number;
    retryAfter?: number;
  };
}

class ApiErrorHandler {
  private errorCache: ErrorCache = {};
  private readonly ERROR_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_404_RETRIES = 1; // Only retry 404s once
  private readonly RETRY_BACKOFF_BASE = 1000; // 1 second base

  /**
   * Check if we should skip a request due to previous errors
   */
  shouldSkipRequest(url: string): boolean {
    const cached = this.errorCache[url];
    if (!cached) return false;

    const now = Date.now();
    
    // If error is still fresh and was a 404, skip the request
    if (cached.status === 404 && now - cached.timestamp < this.ERROR_CACHE_TTL) {
      console.log(`🚫 Skipping 404 request: ${url} (cached ${Math.round((now - cached.timestamp) / 1000)}s ago)`);
      return true;
    }

    // If we have a retry-after time and it hasn't passed, skip
    if (cached.retryAfter && now < cached.retryAfter) {
      console.log(`⏳ Skipping request due to retry-after: ${url}`);
      return true;
    }

    return false;
  }

  /**
   * Handle API response and cache errors
   */
  handleResponse(url: string, response: Response): void {
    if (response.ok) {
      // Clear any cached errors for successful requests
      delete this.errorCache[url];
      return;
    }

    const now = Date.now();
    const retryAfter = this.calculateRetryAfter(response.status);

    this.errorCache[url] = {
      status: response.status,
      timestamp: now,
      retryAfter: retryAfter ? now + retryAfter : undefined
    };

    // Log different error types appropriately
    if (response.status === 404) {
      console.warn(`📁 Asset not found (will cache): ${url}`);
    } else if (response.status >= 500) {
      console.error(`🔥 Server error for: ${url} (status: ${response.status})`);
    } else if (response.status === 429) {
      console.warn(`🚦 Rate limited: ${url} (retry after ${retryAfter}ms)`);
    }
  }

  /**
   * Calculate retry delay based on error type
   */
  private calculateRetryAfter(status: number): number {
    switch (status) {
      case 404:
        return 5 * 60 * 1000; // 5 minutes for 404s
      case 429:
        return 60 * 1000; // 1 minute for rate limits
      case 500:
      case 502:
      case 503:
        return 30 * 1000; // 30 seconds for server errors
      default:
        return 10 * 1000; // 10 seconds for other errors
    }
  }

  /**
   * Get fallback asset URL for missing assets
   */
  getFallbackAssetUrl(type: 'thumbnails' | 'posters' | 'previews', mediaTitle?: string): string {
    const fallbacks = {
      thumbnails: '/placeholder-thumbnail.jpg',
      posters: '/placeholder-poster.jpg',
      previews: null // No fallback for preview clips
    };

    return fallbacks[type] || '';
  }

  /**
   * Clean expired error cache entries
   */
  cleanExpiredErrors(): void {
    const now = Date.now();
    const expired: string[] = [];

    Object.entries(this.errorCache).forEach(([url, error]) => {
      if (now - error.timestamp > this.ERROR_CACHE_TTL) {
        expired.push(url);
      }
    });

    expired.forEach(url => delete this.errorCache[url]);

    if (expired.length > 0) {
      console.log(`🧹 Cleaned ${expired.length} expired error cache entries`);
    }
  }

  /**
   * Get error statistics
   */
  getErrorStats() {
    const stats = {
      total: Object.keys(this.errorCache).length,
      by404: 0,
      by500: 0,
      by429: 0,
      other: 0
    };

    Object.values(this.errorCache).forEach(error => {
      if (error.status === 404) stats.by404++;
      else if (error.status >= 500) stats.by500++;
      else if (error.status === 429) stats.by429++;
      else stats.other++;
    });

    return stats;
  }
}

// Global error handler instance
export const apiErrorHandler = new ApiErrorHandler();

// Clean up expired errors every 2 minutes
setInterval(() => {
  apiErrorHandler.cleanExpiredErrors();
}, 2 * 60 * 1000);

/**
 * Enhanced fetch wrapper with error handling
 */
export async function fetchWithErrorHandling(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // Check if we should skip this request due to previous errors
  if (apiErrorHandler.shouldSkipRequest(url)) {
    throw new Error(`Request skipped due to cached error: ${url}`);
  }

  try {
    const response = await fetch(url, options);
    
    // Handle the response and cache any errors
    apiErrorHandler.handleResponse(url, response);
    
    return response;
  } catch (error) {
    // Handle network errors
    console.error(`🌐 Network error for ${url}:`, error);
    throw error;
  }
}

/**
 * Safe asset URL getter with fallbacks
 */
export function getSafeAssetUrl(
  type: 'thumbnails' | 'posters' | 'previews',
  id: string,
  mediaTitle?: string
): string {
  const url = `/api/${type}/${id}`;
  
  // Check if this asset is known to be missing
  if (apiErrorHandler.shouldSkipRequest(url)) {
    return apiErrorHandler.getFallbackAssetUrl(type, mediaTitle);
  }
  
  return url;
}

/**
 * Batch check asset availability
 */
export async function checkAssetAvailability(
  assets: Array<{ type: 'thumbnails' | 'posters' | 'previews'; id: string }>
): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {};
  
  // Use HEAD requests to check availability without downloading
  const promises = assets.map(async ({ type, id }) => {
    const url = `/api/${type}/${id}`;
    const key = `${type}:${id}`;
    
    try {
      const response = await fetchWithErrorHandling(url, { method: 'HEAD' });
      results[key] = response.ok;
    } catch (error) {
      results[key] = false;
    }
  });
  
  await Promise.allSettled(promises);
  return results;
}

export default apiErrorHandler;
