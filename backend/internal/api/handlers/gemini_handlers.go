package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"homeflix-backend/internal/services"
)

func GenerateMediaMetadata(mediaService *services.MediaService, geminiService *services.GeminiService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
			return
		}

		media, err := mediaService.GetMediaByID(uint(id))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		// Generate metadata using Gemini
		metadata, err := geminiService.GenerateMediaMetadata(media.FilePath, media.Title)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate metadata", "details": err.Error()})
			return
		}

		c.JSON(http.StatusOK, metadata)
	}
}

func GenerateRecommendations(geminiService *services.GeminiService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var request struct {
			Title        string   `json:"title"`
			Genres       []string `json:"genres"`
			WatchHistory []string `json:"watch_history"`
		}

		if err := c.BindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}

		recommendations, err := geminiService.GenerateRecommendations(
			request.Title,
			request.Genres,
			request.WatchHistory,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate recommendations", "details": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"recommendations": recommendations})
	}
}

func UpdateMediaMetadata(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
			return
		}

		var metadata struct {
			Title       string   `json:"title"`
			Tagline     string   `json:"tagline"`
			Description string   `json:"description"`
			Year        int      `json:"year"`
			Stars       []string `json:"stars"`
			Directors   []string `json:"directors"`
			Country     string   `json:"country"`
			Rating      float64  `json:"rating"`
		}

		if err := c.BindJSON(&metadata); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}

		media, err := mediaService.GetMediaByID(uint(id))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		// Update media fields
		media.Title = metadata.Title
		media.Description = metadata.Description
		media.Rating = metadata.Rating

		if err := mediaService.UpdateMedia(media); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update media"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Metadata updated successfully"})
	}
}
