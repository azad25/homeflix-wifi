// API configuration for network access
export const getApiUrl = () => {
  // Check if we're in Docker environment
  const dockerApiUrl = process.env.NEXT_PUBLIC_API_URL;
  
  if (typeof window === 'undefined') {
    // Server-side: use Docker internal URL or localhost
    return dockerApiUrl || 'http://localhost:8251';
  }

  // Client-side: use external hostname with backend port
  const hostname = window.location.hostname;
  return `http://${hostname}:8251`;
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
