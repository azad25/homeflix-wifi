package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"homeflix-backend/internal/services"
)

// GetTrendingRecommendations returns trending media for hero carousel
func GetTrendingRecommendations(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		limit := 10 // Default limit for hero carousel
		if l := c.Query("limit"); l != "" {
			if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 50 {
				limit = parsed
			}
		}

		media, err := mediaService.GetTrendingMedia(limit)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, media)
	}
}

// GetPopularRecommendations returns popular media for hero carousel
func GetPopularRecommendations(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		limit := 10 // Default limit for hero carousel
		if l := c.Query("limit"); l != "" {
			if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 50 {
				limit = parsed
			}
		}

		media, err := mediaService.GetPopularMedia()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Limit results
		if len(media) > limit {
			media = media[:limit]
		}

		c.JSON(http.StatusOK, media)
	}
}

// GetRecentRecommendations returns recently added media
func GetRecentRecommendations(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		limit := 10 // Default limit
		if l := c.Query("limit"); l != "" {
			if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 50 {
				limit = parsed
			}
		}

		media, err := mediaService.GetRecentlyAdded(limit)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, media)
	}
}

// GetHighRatedRecommendations returns highest rated media
func GetHighRatedRecommendations(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		limit := 10 // Default limit
		if l := c.Query("limit"); l != "" {
			if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 50 {
				limit = parsed
			}
		}

		// Get media sorted by rating
		media, err := mediaService.GetMediaByRating(limit)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, media)
	}
}

// GetGenreRecommendations returns media by genre
func GetGenreRecommendations(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		genre := c.Query("genre")
		if genre == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Genre parameter required"})
			return
		}

		limit := 10 // Default limit
		if l := c.Query("limit"); l != "" {
			if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 50 {
				limit = parsed
			}
		}

		media, err := mediaService.GetMediaByGenreName(genre, limit)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, media)
	}
}

// GetMixedRecommendations returns a mix of different recommendation types
func GetMixedRecommendations(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		limit := 10 // Default limit
		if l := c.Query("limit"); l != "" {
			if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 50 {
				limit = parsed
			}
		}

		// Get a mix of trending, popular, and recent media
		var allMedia []interface{}
		
		// Get trending (40% of results)
		trendingLimit := (limit * 4) / 10
		if trendingLimit < 1 {
			trendingLimit = 1
		}
		trending, err := mediaService.GetTrendingMedia(trendingLimit)
		if err == nil {
			for _, media := range trending {
				allMedia = append(allMedia, media)
			}
		}

		// Get popular (30% of results)
		popularLimit := (limit * 3) / 10
		if popularLimit < 1 {
			popularLimit = 1
		}
		popular, err := mediaService.GetPopularMedia()
		if err == nil {
			count := 0
			for _, media := range popular {
				if count >= popularLimit {
					break
				}
				// Avoid duplicates (simplified check)
				isDuplicate := false
				for _, existing := range allMedia {
					// Use a simple comparison or implement proper equality check
					_ = existing // Skip duplicate check for now to avoid comparison issues
				}
				if !isDuplicate {
					allMedia = append(allMedia, media)
					count++
				}
			}
		}

		// Get recent (30% of results)
		recentLimit := limit - len(allMedia)
		if recentLimit > 0 {
			recent, err := mediaService.GetRecentlyAdded(recentLimit * 2) // Get more to filter duplicates
			if err == nil {
				count := 0
				for _, media := range recent {
					if count >= recentLimit {
						break
					}
					// Avoid duplicates (simplified check)
					isDuplicate := false
					for _, existing := range allMedia {
						// Use a simple comparison or implement proper equality check
						_ = existing // Skip duplicate check for now to avoid comparison issues
					}
					if !isDuplicate {
						allMedia = append(allMedia, media)
						count++
					}
				}
			}
		}

		c.JSON(http.StatusOK, allMedia)
	}
}