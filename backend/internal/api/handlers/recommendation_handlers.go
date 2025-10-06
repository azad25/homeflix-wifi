package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"homeflix-backend/internal/services"
)

// Netflix-style recommendation handlers

func GetTrendingRecommendations(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		limit := 20
		if limitStr := c.Query("limit"); limitStr != "" {
			if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
				limit = l
			}
		}
		
		// Get trending media based on recent views and high ratings
		media, err := mediaService.GetTrendingMedia(limit)
		if err != nil {
			// Fallback to popular media if trending fails
			media, err = mediaService.GetPopularMedia()
			if err != nil {
				// Final fallback to recent media
				media, err = mediaService.GetRecentMedia()
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch recommendations"})
					return
				}
			}
		}
		
		c.JSON(http.StatusOK, media)
	}
}

func GetPopularRecommendations(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		limit := 20
		if limitStr := c.Query("limit"); limitStr != "" {
			if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
				limit = l
			}
		}
		
		// Get most watched media
		media, err := mediaService.GetMostWatched(limit)
		if err != nil {
			// Fallback to popular media
			media, err = mediaService.GetPopularMedia()
			if err != nil {
				// Final fallback to all media sorted by rating
				allMedia, err := mediaService.GetAllMedia()
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch recommendations"})
					return
				}
				// Return first 'limit' items
				if len(allMedia) > limit {
					media = allMedia[:limit]
				} else {
					media = allMedia
				}
			}
		}
		
		c.JSON(http.StatusOK, media)
	}
}

func GetRecentRecommendations(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		limit := 20
		if limitStr := c.Query("limit"); limitStr != "" {
			if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
				limit = l
			}
		}
		
		// Get recently added media
		media, err := mediaService.GetRecentlyAdded(limit)
		if err != nil {
			// Fallback to recent media
			media, err = mediaService.GetRecentMedia()
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch recommendations"})
				return
			}
		}
		
		c.JSON(http.StatusOK, media)
	}
}

func GetHighRatedRecommendations(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		limit := 20
		if limitStr := c.Query("limit"); limitStr != "" {
			if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
				limit = l
			}
		}
		
		// Get highest rated media
		media, err := mediaService.GetHighestRated(limit)
		if err != nil {
			// Fallback to all media and sort by rating on backend
			allMedia, err := mediaService.GetAllMedia()
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch recommendations"})
				return
			}
			
			// Simple fallback - return first items
			if len(allMedia) > limit {
				media = allMedia[:limit]
			} else {
				media = allMedia
			}
		}
		
		c.JSON(http.StatusOK, media)
	}
}

func GetGenreRecommendations(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		genre := c.Query("genre")
		if genre == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Genre parameter is required"})
			return
		}
		
		limit := 20
		if limitStr := c.Query("limit"); limitStr != "" {
			if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
				limit = l
			}
		}
		
		page := 1
		if pageStr := c.Query("page"); pageStr != "" {
			if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
				page = p
			}
		}
		
		media, err := mediaService.GetMediaByGenre(genre, page, limit)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch genre recommendations"})
			return
		}
		
		c.JSON(http.StatusOK, media)
	}
}

func GetMixedRecommendations(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		limit := 20
		if limitStr := c.Query("limit"); limitStr != "" {
			if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
				limit = l
			}
		}
		
		// Get a mix of different types of recommendations
		var allRecommendations []interface{}
		
		// Get some trending
		if trending, err := mediaService.GetTrendingMedia(limit / 4); err == nil {
			for _, item := range trending {
				allRecommendations = append(allRecommendations, item)
			}
		}
		
		// Get some popular
		if popular, err := mediaService.GetMostWatched(limit / 4); err == nil {
			for _, item := range popular {
				allRecommendations = append(allRecommendations, item)
			}
		}
		
		// Get some recent
		if recent, err := mediaService.GetRecentlyAdded(limit / 4); err == nil {
			for _, item := range recent {
				allRecommendations = append(allRecommendations, item)
			}
		}
		
		// Get some high rated
		if rated, err := mediaService.GetHighestRated(limit / 4); err == nil {
			for _, item := range rated {
				allRecommendations = append(allRecommendations, item)
			}
		}
		
		// If we don't have enough, fill with all media
		if len(allRecommendations) < limit {
			if allMedia, err := mediaService.GetAllMedia(); err == nil {
				remaining := limit - len(allRecommendations)
				for i, item := range allMedia {
					if i >= remaining {
						break
					}
					allRecommendations = append(allRecommendations, item)
				}
			}
		}
		
		// Limit the results
		if len(allRecommendations) > limit {
			allRecommendations = allRecommendations[:limit]
		}
		
		c.JSON(http.StatusOK, allRecommendations)
	}
}