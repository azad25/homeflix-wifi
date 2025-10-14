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
  stream: (id: number) => `/api/stream/${id}`,
  thumbnails: (id: number) => `/api/thumbnails/${id}`,
  previewClips: (id: number) => `/api/preview-clips/${id}`,
  subtitles: (id: number) => `/api/subtitles/${id}`,
  search: '/api/media/search',
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

// Enhanced asset URL builders with fallback support (thumbnails and previews only)
export const getAssetUrl = (type: 'thumbnail' | 'preview', id: number, fallback = true) => {
  const baseUrl = getApiUrl();
  const primaryUrl = `${baseUrl}/api/${type === 'preview' ? 'preview-clips' : `${type}s`}/${id}`;
  
  if (!fallback) {
    return primaryUrl;
  }
  
  // Return array of URLs to try in order with cache busting
  const timestamp = Date.now();
  return [
    primaryUrl,
    `${baseUrl}/api/assets/${type}s/${id}`,
    `${baseUrl}/api/${type === 'preview' ? 'previews' : `${type}s`}/${id}`,
    `${baseUrl}/api/${type}s/${id}?t=${timestamp}`, // Cache busting
  ];
};

// Netflix-like asset loading with preloading and caching (thumbnails and previews only)
export const loadAssetWithFallback = async (type: 'thumbnail' | 'preview', id: number): Promise<string> => {
  const urls = getAssetUrl(type, id, true) as string[];
  
  for (const url of urls) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok) {
        return url;
      }
    } catch (error) {
      continue;
    }
  }
  
  // Return first URL as fallback even if it fails
  return urls[0];
};

// Preload assets for Netflix-like performance (thumbnails and previews only)
export const preloadAssets = (mediaList: any[], types: ('thumbnail' | 'preview')[] = ['thumbnail']) => {
  const preloadPromises: Promise<void>[] = [];
  
  mediaList.slice(0, 20).forEach(media => { // Preload first 20 items
    types.forEach(type => {
      const promise = loadAssetWithFallback(type, media.id)
        .then(url => {
          // Preload the image/video
          if (type === 'preview') {
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.src = url;
          } else {
            const img = new Image();
            img.src = url;
          }
        })
        .catch(() => {}); // Ignore preload errors
      
      preloadPromises.push(promise);
    });
  });
  
  return Promise.allSettled(preloadPromises);
};

// Enhanced API call with retry logic for assets
export const apiCallWithRetry = async (urls: string | string[], options?: RequestInit, maxRetries = 3) => {
  const urlsToTry = Array.isArray(urls) ? urls : [urls];
  
  for (let i = 0; i < urlsToTry.length; i++) {
    const url = urlsToTry[i];
    
    for (let retry = 0; retry < maxRetries; retry++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
          },
        });

        if (response.ok) {
          return response;
        }
        
        // If this is the last URL and last retry, throw the error
        if (i === urlsToTry.length - 1 && retry === maxRetries - 1) {
          throw new Error(`API call failed: ${response.status} ${response.statusText}`);
        }
        
        // If not the last retry for this URL, wait a bit before retrying
        if (retry < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (retry + 1)));
        }
        
      } catch (error) {
        // If this is the last URL and last retry, throw the error
        if (i === urlsToTry.length - 1 && retry === maxRetries - 1) {
          throw error;
        }
        
        // If not the last retry for this URL, wait a bit before retrying
        if (retry < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (retry + 1)));
        }
      }
    }
  }
  
  throw new Error('All API endpoints failed');
};

// Helper function to make API calls
export const apiCall = async (endpoint: string, options?: RequestInit) => {
  const baseUrl = getApiUrl();
  const url = `${baseUrl}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API call failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
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
    return await apiCall(`/api/media/search?q=${encodeURIComponent(query.trim())}`);
  } catch (error) {
    console.error('Smart search failed:', error);
    throw error;
  }
};

// Fetch media by genre
export const fetchMediaByGenre = async (genre: string, page: number = 1, limit: number = 50) => {
  try {
    return await apiCall(`/api/media/genre/${encodeURIComponent(genre)}?page=${page}&limit=${limit}`);
  } catch (error) {
    console.error(`Failed to fetch media for genre ${genre}:`, error);
    throw error;
  }
};