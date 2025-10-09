// API configuration for network access
export const getApiUrl = () => {
  // Check if we're in Docker environment
  const dockerApiUrl = process.env.NEXT_PUBLIC_API_URL;
  
  if (typeof window === 'undefined') {
    // Server-side: use Docker internal URL or localhost
    return dockerApiUrl || 'http://localhost:8252';
  }

  // Client-side: use external hostname with backend port
  const hostname = window.location.hostname;
  return `http://${hostname}:8252`;
};

export const getApiHost = () => {
  if (typeof window === 'undefined') {
    return 'localhost';
  }
  return window.location.hostname;
};

export const API_ENDPOINTS = {
  media: '/api/media',
  genres: '/api/genres',
  series: '/api/series',
  seriesById: (id: number) => `/api/series/${id}`,
  seriesSeasons: (id: number) => `/api/series/${id}/seasons`,
  seriesSeasonEpisodes: (id: number, season: number) => `/api/series/${id}/seasons/${season}/episodes`,
  stream: (id: number) => `/api/stream/${id}`,
  thumbnails: (id: number) => `/api/thumbnails/${id}`,
  previewClips: (id: number) => `/api/preview-clips/${id}`,
  subtitles: (id: number) => `/api/subtitles/${id}`,
  search: '/api/search',
  popular: '/api/popular',
  recent: '/api/recent',
  recommendations: (userId: number) => `/api/recommendations/${userId}`,
  watchlist: '/api/user/watchlist',
  ratings: '/api/user/ratings',
  progress: (id: number) => `/api/user/progress/${id}`,
  admin: {
    updateGenres: '/api/admin/update-genres',
    scan: '/api/admin/scan',
  }
};

// DISABLED: Asset URL builders - return placeholder to prevent server crashes
export const getAssetUrl = (type: 'thumbnail' | 'preview' | 'poster', id: number, fallback = true) => {
  // DISABLED: Return placeholder to prevent CORS and server crashes
  const placeholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDMwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iNDAwIiBmaWxsPSJncmFkaWVudChsaW5lYXIsIDQ1ZGVnLCAjMTExLCAjMzMzKSIvPgo8dGV4dCB4PSIxNTAiIHk9IjIwMCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjI0IiBmaWxsPSIjZTUwOTE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5Ib21lRmxpeDwvdGV4dD4KPHN2Zz4=';
  return fallback ? [placeholder, placeholder] : placeholder;
};

// DISABLED: Asset loading - return placeholder to prevent server crashes
export const loadAssetWithFallback = async (type: 'thumbnail' | 'preview' | 'poster', id: number): Promise<string> => {
  // DISABLED: Return placeholder to prevent CORS and server crashes
  const placeholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDMwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iNDAwIiBmaWxsPSJncmFkaWVudChsaW5lYXIsIDQ1ZGVnLCAjMTExLCAjMzMzKSIvPgo8dGV4dCB4PSIxNTAiIHk9IjIwMCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjI0IiBmaWxsPSIjZTUwOTE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5Ib21lRmxpeDwvdGV4dD4KPHN2Zz4=';
  return Promise.resolve(placeholder);
};

// DISABLED: Asset preloading - no-op to prevent server crashes
export const preloadAssets = (mediaList: any[], types: ('thumbnail' | 'poster' | 'preview')[] = ['poster', 'thumbnail']) => {
  // DISABLED: Return resolved promise to prevent server crashes from asset preloading
  return Promise.resolve([]);
};

// Request deduplication map to prevent concurrent identical requests
const pendingRequests = new Map<string, Promise<any>>();

// Request debouncing map
const debouncedRequests = new Map<string, NodeJS.Timeout>();

// Generate unique request key for deduplication
const getRequestKey = (url: string, options?: RequestInit): string => {
  const method = options?.method || 'GET';
  const body = options?.body || '';
  return `${method}:${url}:${body}`;
};

// Enhanced API call with retry logic and request deduplication
export const apiCallWithRetry = async (urls: string | string[], options?: RequestInit, maxRetries = 3) => {
  const urlsToTry = Array.isArray(urls) ? urls : [urls];
  const requestKey = getRequestKey(urlsToTry[0], options);
  
  // Check if identical request is already pending
  if (pendingRequests.has(requestKey)) {
    console.log(`🔄 Deduplicating request: ${requestKey}`);
    return pendingRequests.get(requestKey)!;
  }
  
  const requestPromise = (async () => {
    try {
      for (let i = 0; i < urlsToTry.length; i++) {
        const url = urlsToTry[i];
        
        for (let retry = 0; retry < maxRetries; retry++) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

            const response = await fetch(url, {
              ...options,
              signal: controller.signal,
              headers: {
                'Content-Type': 'application/json',
                ...options?.headers,
              },
            });

            clearTimeout(timeoutId);

            if (response.ok) {
              return response;
            }
            
            // If this is the last URL and last retry, throw the error
            if (i === urlsToTry.length - 1 && retry === maxRetries - 1) {
              throw new Error(`Server disconnected: ${response.status} ${response.statusText}`);
            }
            
            // If not the last retry for this URL, wait a bit before retrying
            if (retry < maxRetries - 1) {
              await new Promise(resolve => setTimeout(resolve, 2000 * (retry + 1)));
            }
            
          } catch (error) {
            // If this is the last URL and last retry, throw the error
            if (i === urlsToTry.length - 1 && retry === maxRetries - 1) {
              if (error instanceof Error && error.name === 'AbortError') {
                throw new Error('Server connection timeout - server may be disconnected');
              }
              throw new Error(`Server connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
            
            // If not the last retry for this URL, wait a bit before retrying
            if (retry < maxRetries - 1) {
              await new Promise(resolve => setTimeout(resolve, 2000 * (retry + 1)));
            }
          }
        }
      }
      
      throw new Error('All API endpoints failed - server may be disconnected');
    } finally {
      // Remove from pending requests when done
      pendingRequests.delete(requestKey);
    }
  })();
  
  // Store the promise to deduplicate concurrent requests
  pendingRequests.set(requestKey, requestPromise);
  
  return requestPromise;
};

// Debounced API call function
export const debouncedApiCall = async (endpoint: string, options?: RequestInit, debounceMs: number = 100): Promise<any> => {
  const requestKey = getRequestKey(endpoint, options);
  
  return new Promise((resolve, reject) => {
    // Clear existing debounce timer
    if (debouncedRequests.has(requestKey)) {
      clearTimeout(debouncedRequests.get(requestKey)!);
    }
    
    // Set new debounce timer
    const timer = setTimeout(async () => {
      try {
        const result = await apiCall(endpoint, options);
        resolve(result);
      } catch (error) {
        reject(error);
      } finally {
        debouncedRequests.delete(requestKey);
      }
    }, debounceMs);
    
    debouncedRequests.set(requestKey, timer);
  });
};

// Helper function to make API calls with deduplication
export const apiCall = async (endpoint: string, options?: RequestInit) => {
  const baseUrl = getApiUrl();
  const url = `${baseUrl}${endpoint}`;
  const requestKey = getRequestKey(url, options);
  
  // Check if identical request is already pending
  if (pendingRequests.has(requestKey)) {
    console.log(`🔄 Deduplicating API call: ${endpoint}`);
    const response = await pendingRequests.get(requestKey)!;
    return response.clone().json();
  }
  
  const requestPromise = fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  
  // Store the promise for deduplication
  pendingRequests.set(requestKey, requestPromise);
  
  try {
    const response = await requestPromise;
    
    if (!response.ok) {
      throw new Error(`API call failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  } finally {
    // Remove from pending requests when done
    pendingRequests.delete(requestKey);
  }
};
// Session management for unique recommendations
let sessionId: string | null = null;

export const getSessionId = (): string => {
  if (!sessionId) {
    // Generate session ID based on browser fingerprint and timestamp
    const fingerprint = navigator.userAgent + screen.width + screen.height + new Date().getTimezoneOffset();
    const timestamp = Date.now();
    sessionId = btoa(fingerprint + timestamp).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
  }
  return sessionId;
};

// Enhanced API call with session awareness for recommendations
export const apiCallWithSession = async (endpoint: string, options?: RequestInit) => {
  const baseUrl = getApiUrl();
  const url = `${baseUrl}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Session-ID': getSessionId(),
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API call failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
};

// Netflix-like recommendation fetching with session awareness
export const fetchUniqueRecommendations = async (type: string = 'mixed', limit: number = 20) => {
  try {
    return await apiCallWithSession(`/api/recommendations/unique?type=${type}&limit=${limit}`);
  } catch (error) {
    console.warn('Unique recommendations failed, falling back to regular recommendations');
    return await apiCall(`/api/recommendations/${type}?limit=${limit}`);
  }
};

// Smart search with enhanced backend
export const smartSearch = async (query: string) => {
  if (!query.trim()) {
    return [];
  }
  
  try {
    return await apiCall(`/api/search?q=${encodeURIComponent(query.trim())}`);
  } catch (error) {
    console.error('Smart search failed:', error);
    throw error;
  }
};

// Hierarchical TV Series API calls
export const fetchAllSeries = async () => {
  try {
    return await apiCall(API_ENDPOINTS.series);
  } catch (error) {
    console.error('Failed to fetch all series:', error);
    throw error;
  }
};

export const fetchSeriesById = async (id: number) => {
  try {
    return await apiCall(API_ENDPOINTS.seriesById(id));
  } catch (error) {
    console.error(`Failed to fetch series ${id}:`, error);
    throw error;
  }
};

export const fetchSeriesSeasons = async (id: number) => {
  try {
    return await apiCall(API_ENDPOINTS.seriesSeasons(id));
  } catch (error) {
    console.error(`Failed to fetch seasons for series ${id}:`, error);
    throw error;
  }
};

export const fetchSeasonEpisodes = async (seriesId: number, seasonNumber: number) => {
  try {
    return await apiCall(API_ENDPOINTS.seriesSeasonEpisodes(seriesId, seasonNumber));
  } catch (error) {
    console.error(`Failed to fetch episodes for series ${seriesId} season ${seasonNumber}:`, error);
    throw error;
  }
};

// Enhanced series data fetching with fallback to old API
export const fetchSeriesWithFallback = async (id: number) => {
  try {
    // Try new hierarchical API first
    const series = await fetchSeriesById(id);
    const seasons = await fetchSeriesSeasons(id);
    
    return {
      ...series,
      seasons: seasons || []
    };
  } catch (error) {
    console.warn('Hierarchical series API failed, falling back to old API:', error);
    
    // Fallback to old media API
    try {
      return await apiCall(`/api/media/${id}`);
    } catch (fallbackError) {
      console.error('Both series APIs failed:', fallbackError);
      throw fallbackError;
    }
  }
};