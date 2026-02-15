package handlers

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"

	"homeflix-backend/internal/services"

	"github.com/gin-gonic/gin"
)

// GetEpisodeStill serves episode still/thumbnail with auto-download from TMDB
func GetEpisodeStill(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		mediaIDStr := c.Param("id")
		mediaID, err := strconv.ParseUint(mediaIDStr, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
			return
		}

		// Get media from database
		media, err := mediaService.GetMediaByID(uint(mediaID))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		// Check if episode still path exists
		if media.EpisodeStillPath != "" {
			// Check if file exists
			if _, err := os.Stat(media.EpisodeStillPath); err == nil {
				c.File(media.EpisodeStillPath)
				return
			}
			log.Printf("⚠️ Episode still file not found: %s", media.EpisodeStillPath)
		}

		// Fallback: Try to find still in episode_stills directory
		stillDir := "./episode_stills"
		if media.SeriesID != nil && media.SeasonNumber != nil && media.EpisodeNumber != nil {
			// Try to find by series ID, season, and episode
			series, err := mediaService.GetSeriesByID(*media.SeriesID)
			if err == nil && series.TMDBID > 0 {
				stillPath := filepath.Join(stillDir, fmt.Sprintf("still_tv%d_s%02de%02d.jpg", 
					series.TMDBID, *media.SeasonNumber, *media.EpisodeNumber))
				
				if _, err := os.Stat(stillPath); err == nil {
					c.File(stillPath)
					return
				}
			}
		}

		// If no still found, return 404 or a placeholder
		c.JSON(http.StatusNotFound, gin.H{"error": "Episode still not found"})
	}
}

// GetEpisodeStillWithAutoDownload serves episode still with automatic TMDB download
func GetEpisodeStillWithAutoDownload(mediaService *services.MediaService, tmdbService *services.TMDBService) gin.HandlerFunc {
	return func(c *gin.Context) {
		mediaIDStr := c.Param("id")
		mediaID, err := strconv.ParseUint(mediaIDStr, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
			return
		}

		// Get media from database
		media, err := mediaService.GetMediaByID(uint(mediaID))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		// Check if episode still path exists
		if media.EpisodeStillPath != "" {
			if _, err := os.Stat(media.EpisodeStillPath); err == nil {
				c.File(media.EpisodeStillPath)
				return
			}
		}

		// Try to download from TMDB if this is an episode
		if media.SeriesID != nil && media.SeasonNumber != nil && media.EpisodeNumber != nil {
			series, err := mediaService.GetSeriesByID(*media.SeriesID)
			if err == nil && series.TMDBID > 0 {
				log.Printf("📺 Attempting to download episode still for: %s S%02dE%02d", 
					series.Title, *media.SeasonNumber, *media.EpisodeNumber)

				// Get episode details from TMDB
				episode, err := tmdbService.GetEpisodeDetails(series.TMDBID, *media.SeasonNumber, *media.EpisodeNumber)
				if err != nil {
					log.Printf("⚠️ Failed to get episode details from TMDB: %v", err)
					c.JSON(http.StatusNotFound, gin.H{"error": "Episode still not available"})
					return
				}

				if episode.StillPath != "" {
					// Download the still
					stillDir := "./episode_stills"
					stillPath, err := tmdbService.DownloadEpisodeStill(
						episode.StillPath,
						series.TMDBID,
						*media.SeasonNumber,
						*media.EpisodeNumber,
						stillDir,
					)

					if err != nil {
						log.Printf("⚠️ Failed to download episode still: %v", err)
						c.JSON(http.StatusNotFound, gin.H{"error": "Failed to download episode still"})
						return
					}

					// Update media with still path
					media.EpisodeStillPath = stillPath
					if err := mediaService.UpdateMedia(media); err != nil {
						log.Printf("⚠️ Failed to update media with still path: %v", err)
					}

					// Serve the downloaded still
					c.File(stillPath)
					return
				}
			}
		}

		c.JSON(http.StatusNotFound, gin.H{"error": "Episode still not available"})
	}
}
