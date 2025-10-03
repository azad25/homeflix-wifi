interface CacheEntry {
  data: any;
  timestamp: number;
  expiry: number;
}

class RecommendationCache {
  private cache: Map<string, CacheEntry> = new Map();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes

  set(key: string, data: any, ttl?: number): void {
    const expiry = ttl || this.defaultTTL;
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      expiry: Date.now() + expiry
    };
    this.cache.set(key, entry);
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  clear(): void {
    this.cache.clear();
  }

  clearExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
      }
    }
  }

  generateKey(endpoint: string, params: Record<string, any> = {}): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');
    return `${endpoint}?${sortedParams}`;
  }
}

export const recommendationCache = new RecommendationCache();

// Helper function for cached fetch
export async function cachedFetch(url: string, options?: RequestInit): Promise<any> {
  const cacheKey = recommendationCache.generateKey(url);
  
  // Check cache first
  const cached = recommendationCache.get(cacheKey);
  if (cached) {
    console.log(`Cache hit for: ${url}`);
    return cached;
  }

  // Fetch from API
  console.log(`Cache miss, fetching: ${url}`);
  const response = await fetch(url, options);
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const data = await response.json();
  
  // Cache the result
  recommendationCache.set(cacheKey, data);
  
  return data;
}
