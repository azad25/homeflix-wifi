import { RecommendationCategory, RecommendationResponse, ScoredMedia } from '@/types/recommendation';

// Simple config since we're having issues with the module
const getApiUrl = (): string => {
  if (typeof window !== 'undefined') {
    return ''; // Relative URL in browser
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
};

// Helper to handle API responses
const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Failed to fetch data');
  }
  return response.json();
};

const RECOMMENDATION_ENDPOINT = `${getApiUrl()}/api/recommendations`;

/**
 * Fetch personalized recommendations for a user
 */
export async function fetchRecommendations(
  userId: string,
  category: RecommendationCategory = 'for_you',
  limit: number = 20
): Promise<RecommendationResponse> {
  try {
    const apiUrl = getApiUrl();
    const response = await fetch(
      `${apiUrl}/api/recommendations?user_id=${userId}&category=${category}&limit=${limit}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // Ensure the response has the expected structure
    return {
      items: data.items || [],
      category: data.category || category,
      total: data.total || 0,
    };
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    // Return empty response on error
    return {
      items: [],
      category: 'continue_watching',
      total: 0,
    };
  }
}

/**
 * Track when a user interacts with a recommendation
 * @param userId - The user ID
 * @param mediaId - The ID of the media that was interacted with
 * @param interactionType - The type of interaction (e.g., 'click', 'play', 'info')
 */
export async function trackRecommendationClick(
  userId: string,
  mediaId: number,
  interactionType: RecommendationCategory
): Promise<void> {
  try {
    await fetch(`${RECOMMENDATION_ENDPOINT}/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Important for cookies if using session auth
      body: JSON.stringify({
        userId,
        mediaId,
        interaction: interactionType,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (error) {
    console.error('Error tracking recommendation click:', error);
  }
}

/**
 * Get continue watching recommendations for a user
 * @param userId - The user ID
 */
export async function getContinueWatching(userId: string): Promise<RecommendationResponse> {
  return fetchRecommendations(userId, 'continue_watching', 10);
}

/**
 * Get media similar to the specified media item
 * @param mediaId - The ID of the media to find similar items for
 * @param userId - Optional user ID for personalized results
 */
export async function getSimilarMedia(
  mediaId: number,
  userId?: string
): Promise<RecommendationResponse> {
  const url = new URL(`${RECOMMENDATION_ENDPOINT}/similar/${mediaId}`);
  if (userId) {
    url.searchParams.append('userId', userId);
  }

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    return handleResponse<RecommendationResponse>(response);
  } catch (error) {
    console.error('Error fetching similar media:', error);
    return {
      items: [],
      category: 'similar',
      total: 0,
    };
  }
}

/**
 * Get trending media
 * @param limit - Maximum number of items to return (default: 10)
 */
export async function getTrending(limit: number = 10): Promise<ScoredMedia[]> {
  try {
    const response = await fetch(`${RECOMMENDATION_ENDPOINT}/trending?limit=${limit}`);
    const data = await handleResponse<{ items: ScoredMedia[] }>(response);
    return data.items;
  } catch (error) {
    console.error('Error fetching trending media:', error);
    return [];
  }
}

/**
 * Get recently added media
 * @param limit - Maximum number of items to return (default: 10)
 */
export async function getRecentlyAdded(limit: number = 10): Promise<ScoredMedia[]> {
  try {
    const response = await fetch(`${RECOMMENDATION_ENDPOINT}/recent?limit=${limit}`);
    const data = await handleResponse<{ items: ScoredMedia[] }>(response);
    return data.items;
  } catch (error) {
    console.error('Error fetching recently added media:', error);
    return [];
  }
}
