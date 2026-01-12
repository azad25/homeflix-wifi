/**
 * Navigation cache utilities for instant menu loading
 */

export const NAV_CACHE_KEY = 'homeflix-nav-data';
export const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export interface NavCacheData {
  dynamicPages: Array<{ slug: string; title: string }>;
  homePageSlug: string | null;
  timestamp: number;
}

/**
 * Clear the navigation cache (call this when pages are updated)
 */
export const clearNavCache = () => {
  localStorage.removeItem(NAV_CACHE_KEY);
};

/**
 * Get cached navigation data if valid
 */
export const getCachedNavData = (): NavCacheData | null => {
  try {
    const cached = localStorage.getItem(NAV_CACHE_KEY);
    if (!cached) return null;

    const data = JSON.parse(cached) as NavCacheData;
    
    // Check if cache is still valid
    if (Date.now() - data.timestamp < CACHE_DURATION) {
      return data;
    }
    
    // Cache expired, remove it
    clearNavCache();
    return null;
  } catch (error) {
    // Invalid cache data, clear it
    clearNavCache();
    return null;
  }
};

/**
 * Cache navigation data
 */
export const cacheNavData = (dynamicPages: Array<{ slug: string; title: string }>, homePageSlug: string | null) => {
  const data: NavCacheData = {
    dynamicPages,
    homePageSlug,
    timestamp: Date.now()
  };
  
  localStorage.setItem(NAV_CACHE_KEY, JSON.stringify(data));
};