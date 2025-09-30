import { Media } from '@/types/media';
import { UserPreferences, RecommendationScore } from './recommendationEngine';

interface GeminiRecommendationRequest {
  userPreferences: UserPreferences;
  mediaLibrary: Media[];
  currentMedia?: Media;
  requestType: 'recommendations' | 'related' | 'trending';
}

interface GeminiRecommendationResponse {
  recommendations: {
    mediaId: number;
    score: number;
    reasons: string[];
    category: 'trending' | 'for_you' | 'because_you_watched' | 'continue_watching' | 'new_releases';
  }[];
  insights: string[];
}

export class GeminiAIRecommendationEngine {
  private apiKey: string;
  private baseUrl: string = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
  }

  async generateRecommendations(request: GeminiRecommendationRequest): Promise<GeminiRecommendationResponse> {
    if (!this.apiKey) {
      console.warn('Gemini API key not configured, falling back to local recommendations');
      return this.generateLocalRecommendations(request);
    }

    try {
      const prompt = this.buildRecommendationPrompt(request);
      
      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!generatedText) {
        throw new Error('No response from Gemini API');
      }

      return this.parseGeminiResponse(generatedText, request.mediaLibrary);
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      return this.generateLocalRecommendations(request);
    }
  }

  private buildRecommendationPrompt(request: GeminiRecommendationRequest): string {
    const { userPreferences, mediaLibrary, currentMedia, requestType } = request;

    const favoriteGenres = userPreferences.favoriteGenres.join(', ');
    const recentlyWatched = userPreferences.viewHistory
      .slice(-10)
      .map(v => {
        const media = mediaLibrary.find(m => m.id === v.mediaId);
        return media ? `${media.title} (${media.genres?.map(g => g.name).join(', ')})` : '';
      })
      .filter(Boolean)
      .join(', ');

    const mediaList = mediaLibrary.slice(0, 100).map(media => ({
      id: media.id,
      title: media.title,
      genres: media.genres?.map(g => g.name).join(', ') || '',
      year: media.year,
      rating: media.rating,
      type: media.type,
      description: media.description?.substring(0, 200) || ''
    }));

    let prompt = `You are an AI recommendation engine for a Netflix-style streaming platform called HomeFlix. 

USER PROFILE:
- Favorite genres: ${favoriteGenres}
- Recently watched: ${recentlyWatched}
- Total viewing history: ${userPreferences.viewHistory.length} items

MEDIA LIBRARY (first 100 items):
${JSON.stringify(mediaList, null, 2)}

TASK: Generate ${requestType} recommendations based on the user's preferences and viewing history.

REQUIREMENTS:
1. Analyze the user's favorite genres (action, fantasy, horror, war) and prioritize content in these genres
2. Consider recently watched content for similarity matching
3. Factor in ratings, release years, and content quality
4. Provide diverse recommendations across different sub-genres
5. Include both popular and hidden gem recommendations

OUTPUT FORMAT (JSON):
{
  "recommendations": [
    {
      "mediaId": number,
      "score": number (0-100),
      "reasons": ["reason1", "reason2"],
      "category": "trending" | "for_you" | "because_you_watched" | "new_releases"
    }
  ],
  "insights": ["insight1", "insight2"]
}

Generate 20 recommendations with detailed reasoning for each choice. Focus on the user's stated preferences for action, fantasy, horror, and war content.`;

    if (currentMedia) {
      prompt += `\n\nCURRENT CONTEXT: User is viewing "${currentMedia.title}" (${currentMedia.genres?.map(g => g.name).join(', ')}). Provide related content recommendations.`;
    }

    return prompt;
  }

  private parseGeminiResponse(response: string, mediaLibrary: Media[]): GeminiRecommendationResponse {
    try {
      // Extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate and filter recommendations
      const validRecommendations = parsed.recommendations
        ?.filter((rec: any) => {
          const media = mediaLibrary.find(m => m.id === rec.mediaId);
          return media && rec.score && rec.reasons && rec.category;
        })
        ?.map((rec: any) => ({
          mediaId: rec.mediaId,
          score: Math.min(Math.max(rec.score, 0), 100),
          reasons: Array.isArray(rec.reasons) ? rec.reasons : [rec.reasons],
          category: rec.category
        })) || [];

      return {
        recommendations: validRecommendations,
        insights: Array.isArray(parsed.insights) ? parsed.insights : []
      };
    } catch (error) {
      console.error('Error parsing Gemini response:', error);
      return { recommendations: [], insights: [] };
    }
  }

  private generateLocalRecommendations(request: GeminiRecommendationRequest): GeminiRecommendationResponse {
    const { userPreferences, mediaLibrary } = request;
    const recommendations: any[] = [];

    // Simple local recommendation logic as fallback
    const favoriteGenres = userPreferences.favoriteGenres.map(g => g.toLowerCase());
    
    mediaLibrary.forEach(media => {
      let score = 0;
      const reasons: string[] = [];
      let category: string = 'for_you';

      // Genre matching
      const mediaGenres = media.genres?.map(g => g.name.toLowerCase()) || [];
      const genreMatches = mediaGenres.filter(genre => favoriteGenres.includes(genre));
      
      if (genreMatches.length > 0) {
        score += genreMatches.length * 20;
        reasons.push(`Matches your favorite genres: ${genreMatches.join(', ')}`);
      }

      // Rating boost
      if (media.rating && media.rating >= 7.0) {
        score += media.rating * 5;
        reasons.push('Highly rated');
      }

      // New releases
      if (media.year && media.year >= new Date().getFullYear() - 2) {
        score += 15;
        reasons.push('Recent release');
        category = 'new_releases';
      }

      // Trending (simulate based on ID - higher IDs are "newer")
      if (media.id > mediaLibrary.length * 0.8) {
        score += 10;
        reasons.push('Trending now');
        category = 'trending';
      }

      if (score > 0) {
        recommendations.push({
          mediaId: media.id,
          score,
          reasons,
          category
        });
      }
    });

    return {
      recommendations: recommendations
        .sort((a, b) => b.score - a.score)
        .slice(0, 20),
      insights: [
        'Recommendations based on your favorite genres: action, fantasy, horror, war',
        'Consider exploring highly-rated content in your preferred genres'
      ]
    };
  }

  // Generate content similarity analysis
  async analyzeContentSimilarity(media1: Media, media2: Media): Promise<number> {
    if (!this.apiKey) {
      return this.calculateBasicSimilarity(media1, media2);
    }

    try {
      const prompt = `Analyze the similarity between these two pieces of content on a scale of 0-100:

Content 1:
Title: ${media1.title}
Genres: ${media1.genres?.map(g => g.name).join(', ') || 'Unknown'}
Year: ${media1.year || 'Unknown'}
Description: ${media1.description?.substring(0, 300) || 'No description'}

Content 2:
Title: ${media2.title}
Genres: ${media2.genres?.map(g => g.name).join(', ') || 'Unknown'}
Year: ${media2.year || 'Unknown'}
Description: ${media2.description?.substring(0, 300) || 'No description'}

Consider factors like:
- Genre overlap
- Thematic similarity
- Target audience
- Tone and style
- Time period relevance

Return only a number between 0-100 representing similarity percentage.`;

      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 50,
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      const similarity = parseInt(generatedText?.match(/\d+/)?.[0] || '0');
      
      return Math.min(Math.max(similarity, 0), 100);
    } catch (error) {
      console.error('Error analyzing similarity with Gemini:', error);
      return this.calculateBasicSimilarity(media1, media2);
    }
  }

  private calculateBasicSimilarity(media1: Media, media2: Media): number {
    let similarity = 0;

    // Genre similarity
    const genres1 = media1.genres?.map(g => g.name.toLowerCase()) || [];
    const genres2 = media2.genres?.map(g => g.name.toLowerCase()) || [];
    const commonGenres = genres1.filter(g => genres2.includes(g));
    const totalGenres = new Set([...genres1, ...genres2]).size;
    
    if (totalGenres > 0) {
      similarity += (commonGenres.length / totalGenres) * 60;
    }

    // Year proximity
    if (media1.year && media2.year) {
      const yearDiff = Math.abs(media1.year - media2.year);
      similarity += Math.max(0, (10 - yearDiff)) * 2;
    }

    // Rating similarity
    if (media1.rating && media2.rating) {
      const ratingDiff = Math.abs(media1.rating - media2.rating);
      similarity += Math.max(0, (3 - ratingDiff)) * 5;
    }

    return Math.min(similarity, 100);
  }
}

// Utility function to initialize Gemini AI recommendations
export const initializeGeminiRecommendations = (apiKey?: string) => {
  return new GeminiAIRecommendationEngine(apiKey);
};

// Export types for use in other files
export type { GeminiRecommendationRequest, GeminiRecommendationResponse };
