package handlers

import (
	"net/http"
	"strconv"

	"homeflix-backend/internal/services"

	"github.com/gin-gonic/gin"
)

// Genre Handlers

func GetAllGenres(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		genres, err := mediaService.GetAllGenres()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch genres"})
			return
		}
		
		c.JSON(http.StatusOK, genres)
	}
}

func GetGenreByID(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid genre ID"})
			return
		}

		genre, err := mediaService.GetGenreByID(uint(id))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Genre not found"})
			return
		}

		c.JSON(http.StatusOK, genre)
	}
}



func CreateGenre(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var request struct {
			Name        string `json:"name" binding:"required"`
			Description string `json:"description"`
		}

		if err := c.ShouldBindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		genre, err := mediaService.CreateGenre(request.Name, request.Description)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create genre"})
			return
		}

		c.JSON(http.StatusCreated, genre)
	}
}

func UpdateGenre(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid genre ID"})
			return
		}

		var request struct {
			Name        string `json:"name"`
			Description string `json:"description"`
		}

		if err := c.ShouldBindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		genre, err := mediaService.UpdateGenre(uint(id), request.Name, request.Description)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update genre"})
			return
		}

		c.JSON(http.StatusOK, genre)
	}
}

func DeleteGenre(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid genre ID"})
			return
		}

		err = mediaService.DeleteGenre(uint(id))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete genre"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Genre deleted successfully"})
	}
}

func GetGenreStats(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		stats, err := mediaService.GetGenreStats()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch genre statistics"})
			return
		}

		c.JSON(http.StatusOK, stats)
	}
}
