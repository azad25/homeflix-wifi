package handlers

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"homeflix-backend/internal/services"

	"github.com/gin-gonic/gin"
)

// Asset Management Handlers

func GetMediaAssets(mediaService *services.MediaService) gin.HandlerFunc {
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

		assets := gin.H{
			"id":             media.ID,
			"title":          media.Title,
			"banner_path":    media.BannerPath,
			"backdrop_path":  media.BackdropPath,
			"poster_path":    media.PosterPath,
			"thumbnail_path": media.ThumbnailPath,
			"trailer_path":   media.TrailerPath,
		}

		c.JSON(http.StatusOK, assets)
	}
}

func UploadMediaAsset(mediaService *services.MediaService) gin.HandlerFunc {
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

		assetType := c.PostForm("type")
		if assetType == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Asset type is required"})
			return
		}

		file, header, err := c.Request.FormFile("file")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "File is required"})
			return
		}
		defer file.Close()

		// Create assets directory if it doesn't exist
		assetsDir := "assets"
		if err := os.MkdirAll(assetsDir, 0755); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create assets directory"})
			return
		}

		// Generate filename
		ext := filepath.Ext(header.Filename)
		filename := fmt.Sprintf("%d_%s%s", media.ID, assetType, ext)
		filePath := filepath.Join(assetsDir, filename)

		// Save file
		dst, err := os.Create(filePath)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create file"})
			return
		}
		defer dst.Close()

		if _, err := io.Copy(dst, file); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
			return
		}

		// Update media record
		switch assetType {
		case "banner", "backdrop":
			// Both banner and backdrop types store to BannerPath (used by movie page for backdrop)
			media.BannerPath = filePath
		case "poster":
			media.PosterPath = filePath
		case "thumbnail":
			media.ThumbnailPath = filePath
		case "trailer":
			media.TrailerPath = filePath
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid asset type"})
			return
		}

		if err := mediaService.UpdateMedia(media); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update media record"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message":  "Asset uploaded successfully",
			"filename": filename,
			"path":     filePath,
		})
	}
}

func DeleteMediaAsset(mediaService *services.MediaService) gin.HandlerFunc {
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

		assetType := c.Query("type")
		if assetType == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Asset type is required"})
			return
		}

		var filePath string
		switch assetType {
		case "banner", "backdrop":
			// Both banner and backdrop types use BannerPath
			filePath = media.BannerPath
			media.BannerPath = ""
		case "poster":
			filePath = media.PosterPath
			media.PosterPath = ""
		case "thumbnail":
			filePath = media.ThumbnailPath
			media.ThumbnailPath = ""
		case "trailer":
			filePath = media.TrailerPath
			media.TrailerPath = ""
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid asset type"})
			return
		}

		// Delete the file if it exists
		if filePath != "" {
			os.Remove(filePath)
		}

		// Update media record
		if err := mediaService.UpdateMedia(media); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update media record"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Asset deleted successfully"})
	}
}

func ServeAsset() gin.HandlerFunc {
	return func(c *gin.Context) {
		filename := c.Param("filename")

		// Sanitize filename to prevent directory traversal
		filename = strings.ReplaceAll(filename, "..", "")
		filename = strings.ReplaceAll(filename, "/", "")
		filename = strings.ReplaceAll(filename, "\\", "")

		searchPaths := []string{
			filepath.Join("assets", filename),
			filepath.Join("logos", filename),
			filepath.Join("posters", filename),
			filepath.Join("backdrops", filename),
		}

		filePath := ""
		for _, candidate := range searchPaths {
			if _, err := os.Stat(candidate); err == nil {
				filePath = candidate
				break
			}
		}

		if filePath == "" {
			c.JSON(http.StatusNotFound, gin.H{"error": "Asset not found"})
			return
		}

		c.File(filePath)
	}
}
