// Get the base API URL from environment variables or use a default
const getApiUrl = (): string => {
  // In browser, use relative URL
  if (typeof window !== 'undefined') {
    return ''; // Relative to the current host
  }
  
  // In server-side rendering, use environment variable or default to localhost
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
};

export { getApiUrl };
