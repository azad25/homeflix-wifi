// API configuration for network access
export const getApiUrl = () => {
  // Check if we're in Docker environment
  const dockerApiUrl = process.env.NEXT_PUBLIC_API_URL;
  
  if (typeof window === 'undefined') {
    // Server-side: use Docker internal URL or localhost
    return dockerApiUrl || 'http://backend:8251';
  }

  // Client-side: use relative paths to go through Next.js proxy
  return '';
};

// Enhanced API URL generation with fallback support
export const getStreamUrl = (uuid: string, quality?: string) => {
  if (!uuid) return '';
  const baseUrl = getApiUrl();
  const endpoint = quality ? `/api/stream/${uuid}?quality=${quality}` : `/api/stream/${uuid}`;
  return `${baseUrl}${endpoint}`;
};

export const getThumbnailUrl = (uuid: string) => {
  if (!uuid) return '';
  const baseUrl = getApiUrl();
  return `${baseUrl}/api/thumbnails/${uuid}`;
};

export const getPosterUrl = (uuid: string) => {
  if (!uuid) return '';
  const baseUrl = getApiUrl();
  return `${baseUrl}/api/posters/${uuid}`;
};

export const getPreviewUrl = (uuid: string) => {
  if (!uuid) return '';
  const baseUrl = getApiUrl();
  return `${baseUrl}/api/preview-clips/${uuid}`;
};

export const getSubtitleUrl = (uuid: string) => {
  if (!uuid) return '';
  const baseUrl = getApiUrl();
  return `${baseUrl}/api/subtitles/${uuid}`;
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
  tvShows: '/api/media/tv-shows',
  movies: '/api/media/movies',
  stream: (uuid: string) => `/api/stream/${uuid}`,
  thumbnails: (uuid: string) => `/api/thumbnails/${uuid}`,
  posters: (uuid: string) => `/api/posters/${uuid}`,
  previewClips: (uuid: string) => `/api/preview-clips/${uuid}`,
  subtitles: (uuid: string) => `/api/subtitles/${uuid}`,
  search: '/api/media/search',
  popular: '/api/popular',
  recent: '/api/recent',
  recommendations: (userId: number) => `/api/recommendations/${userId}`,
  watchlist: '/api/user/watchlist',
  ratings: '/api/user/ratings',
  progress: (uuid: string) => `/api/user/progress/${uuid}`,
  admin: {
    updateGenres: '/api/admin/update-genres',
    scan: '/api/admin/scan',
  }
};

// Helper function to make API calls with retry logic
export const apiCall = async (endpoint: string, options?: RequestInit, retries = 3) => {
  const baseUrl = getApiUrl();
  const url = `${baseUrl}${endpoint}`;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status >= 500 && attempt < retries) {
          console.warn(`API call failed (attempt ${attempt}/${retries}): ${response.status} ${response.statusText}`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
          continue;
        }
        throw new Error(`API call failed: ${response.status} ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      if (attempt === retries) {
        console.error(`API call failed after ${retries} attempts:`, error);
        throw error;
      }
      console.warn(`API call attempt ${attempt} failed, retrying...`, error);
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
};

// Check API connectivity
export const checkApiHealth = async () => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${getApiUrl()}/api/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
};
