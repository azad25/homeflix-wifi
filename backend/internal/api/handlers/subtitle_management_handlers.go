package handlers

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"homeflix-backend/internal/services"

	"github.com/gin-gonic/gin"
)

// GetSubtitleStats returns statistics about subtitle tracks
func GetSubtitleStats(cleanupService *services.SubtitleCleanupService) gin.HandlerFunc {
	return func(c *gin.Context) {
		stats, err := cleanupService.GetSubtitleStats()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		
		c.JSON(http.StatusOK, gin.H{
			"status": "success",
			"stats":  stats,
		})
	}
}

// CleanupAllSubtitles removes unnecessary subtitle entries from all media
func CleanupAllSubtitles(cleanupService *services.SubtitleCleanupService) gin.HandlerFunc {
	return func(c *gin.Context) {
		log.Printf("🧹 Starting subtitle cleanup via API request...")
		
		result, err := cleanupService.CleanupAllSubtitles()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status": "error",
				"error":  err.Error(),
			})
			return
		}
		
		c.JSON(http.StatusOK, gin.H{
			"status":                "success",
			"total_media":           result.TotalMedia,
			"media_processed":       result.MediaProcessed,
			"subtitles_removed":     result.SubtitlesRemoved,
			"subtitles_kept":        result.SubtitlesKept,
			"external_subs_removed": result.ExternalSubsRemoved,
			"internal_subs_removed": result.InternalSubsRemoved,
			"errors":                result.Errors,
			"error_count":           len(result.Errors),
		})
	}
}

// CleanupMediaSubtitles cleans up subtitles for a specific media item
func CleanupMediaSubtitles(cleanupService *services.SubtitleCleanupService, mediaService *services.MediaService) gin.HandlerFunc {
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
		
		result := cleanupService.CleanupMediaSubtitles(media)
		
		c.JSON(http.StatusOK, gin.H{
			"status":                "success",
			"media_id":              media.ID,
			"media_title":           media.Title,
			"subtitles_removed":     result.SubtitlesRemoved,
			"subtitles_kept":        result.SubtitlesKept,
			"external_subs_removed": result.ExternalSubsRemoved,
			"internal_subs_removed": result.InternalSubsRemoved,
			"errors":                result.Errors,
		})
	}
}

// DownloadSubtitleForMedia downloads the best matching subtitle for a media item
func DownloadSubtitleForMedia(matcherService *services.SubtitleMatcherService, mediaService *services.MediaService) gin.HandlerFunc {
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
		
		log.Printf("📥 API request to download subtitle for: %s (ID: %d)", media.Title, media.ID)
		
		if err := matcherService.SearchAndDownloadSubtitle(media); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  "error",
				"error":   err.Error(),
				"media_id": media.ID,
				"title":   media.Title,
			})
			return
		}
		
		c.JSON(http.StatusOK, gin.H{
			"status":   "success",
			"message":  "Subtitle downloaded successfully",
			"media_id": media.ID,
			"title":    media.Title,
		})
	}
}

// DownloadSubtitlesForAll downloads subtitles for all media without subtitles
func DownloadSubtitlesForAll(matcherService *services.SubtitleMatcherService, mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		log.Printf("📥 Starting bulk subtitle download for all media...")
		
		// Get all media
		allMedia, err := mediaService.GetAllMedia()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		
		var processed, successful, failed int
		var errors []string
		
		for i, media := range allMedia {
			// Check if media already has English subtitles
			tracks, err := mediaService.GetSubtitleTracks(media.ID)
			if err != nil {
				errors = append(errors, fmt.Sprintf("Media %d: failed to get tracks: %v", media.ID, err))
				continue
			}
			
			hasEnglishSub := false
			for _, track := range tracks {
				if track.Language == "en" || track.Language == "eng" || track.Language == "english" {
					hasEnglishSub = true
					break
				}
			}
			
			if hasEnglishSub {
				log.Printf("⏭️ Skipping %s - already has English subtitle", media.Title)
				continue
			}
			
			processed++
			log.Printf("📥 [%d/%d] Downloading subtitle for: %s", processed, len(allMedia), media.Title)
			
			if err := matcherService.SearchAndDownloadSubtitle(&media); err != nil {
				failed++
				errors = append(errors, fmt.Sprintf("%s: %v", media.Title, err))
				log.Printf("❌ Failed: %v", err)
			} else {
				successful++
				log.Printf("✅ Success!")
			}
			
			// Rate limiting: Wait 2 seconds between requests to respect OpenSubtitles 1 req/sec limit
			if i < len(allMedia)-1 {
				time.Sleep(2 * time.Second)
			}
			
			// Progress update every 10 items
			if (i+1)%10 == 0 {
				log.Printf("📊 Progress: %d processed, %d successful, %d failed", processed, successful, failed)
			}
		}
		
		c.JSON(http.StatusOK, gin.H{
			"status":     "completed",
			"total_media": len(allMedia),
			"processed":  processed,
			"successful": successful,
			"failed":     failed,
			"errors":     errors,
			"error_count": len(errors),
		})
	}
}

// DownloadSubtitlesForMissing downloads subtitles only for media without any subtitles
func DownloadSubtitlesForMissing(matcherService *services.SubtitleMatcherService, mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		log.Printf("📥 Starting subtitle download for media without subtitles...")
		
		// Get all media
		allMedia, err := mediaService.GetAllMedia()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		
		var mediaWithoutSubs []uint
		var processed, successful, failed int
		var errors []string
		
		// Find media without any subtitles
		for _, media := range allMedia {
			tracks, err := mediaService.GetSubtitleTracks(media.ID)
			if err != nil || len(tracks) == 0 {
				mediaWithoutSubs = append(mediaWithoutSubs, media.ID)
			}
		}
		
		log.Printf("📊 Found %d media items without subtitles", len(mediaWithoutSubs))
		
		// Download subtitles for media without any (with rate limiting)
		for i, mediaID := range mediaWithoutSubs {
			media, err := mediaService.GetMediaByID(mediaID)
			if err != nil {
				errors = append(errors, fmt.Sprintf("Media %d: not found", mediaID))
				continue
			}
			
			processed++
			log.Printf("📥 [%d/%d] Downloading subtitle for: %s", i+1, len(mediaWithoutSubs), media.Title)
			
			if err := matcherService.SearchAndDownloadSubtitle(media); err != nil {
				failed++
				errors = append(errors, fmt.Sprintf("%s: %v", media.Title, err))
				log.Printf("❌ Failed: %v", err)
			} else {
				successful++
				log.Printf("✅ Success!")
			}
			
			// Rate limiting: Wait 2 seconds between requests to respect OpenSubtitles 1 req/sec limit
			if i < len(mediaWithoutSubs)-1 {
				time.Sleep(2 * time.Second)
			}
		}
		
		c.JSON(http.StatusOK, gin.H{
			"status":              "completed",
			"media_without_subs":  len(mediaWithoutSubs),
			"processed":           processed,
			"successful":          successful,
			"failed":              failed,
			"errors":              errors,
			"error_count":         len(errors),
		})
	}
}

// GetMediaWithoutSubtitles returns a list of media that don't have valid English subtitles
func GetMediaWithoutSubtitles(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		log.Printf("🔍 Finding media without valid English subtitles...")
		
		// Get all media
		allMedia, err := mediaService.GetAllMedia()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		
		type MediaInfo struct {
			ID    uint   `json:"id"`
			Title string `json:"title"`
			Type  string `json:"type"`
			Year  int    `json:"year"`
		}
		
		var mediaWithoutSubs []MediaInfo
		
		// Check each media for valid English subtitles
		for _, media := range allMedia {
			tracks, err := mediaService.GetSubtitleTracks(media.ID)
			if err != nil {
				continue
			}
			
			hasValidEnglishSub := false
			for _, track := range tracks {
				// Check if it's English
				languageLower := strings.ToLower(track.Language)
				englishCodes := []string{"en", "eng", "english", "en-us", "en-gb"}
				isEnglish := false
				for _, code := range englishCodes {
					if languageLower == code {
						isEnglish = true
						break
					}
				}
				
				if !isEnglish {
					continue
				}
				
				// For external subtitles, verify file exists
				if track.TrackType == "external" {
					if track.FilePath != "" {
						if _, err := os.Stat(track.FilePath); err == nil {
							hasValidEnglishSub = true
							break
						}
					}
				} else {
					// Internal subtitle
					hasValidEnglishSub = true
					break
				}
			}
			
			if !hasValidEnglishSub {
				mediaWithoutSubs = append(mediaWithoutSubs, MediaInfo{
					ID:    media.ID,
					Title: media.Title,
					Type:  media.Type,
					Year:  media.Year,
				})
			}
		}
		
		log.Printf("📊 Found %d media items without valid English subtitles", len(mediaWithoutSubs))
		
		c.JSON(http.StatusOK, gin.H{
			"status":       "success",
			"total_media":  len(allMedia),
			"without_subs": len(mediaWithoutSubs),
			"media":        mediaWithoutSubs,
		})
	}
}

// CleanupAndDownloadSubtitles performs complete subtitle management workflow
func CleanupAndDownloadSubtitles(cleanupService *services.SubtitleCleanupService, matcherService *services.SubtitleMatcherService, mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		log.Printf("🚀 Starting complete subtitle management workflow...")
		
		// Step 1: Cleanup all subtitles
		log.Printf("📋 Step 1/2: Cleaning up subtitles...")
		cleanupResult, err := cleanupService.CleanupAllSubtitles()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status": "error",
				"error":  err.Error(),
			})
			return
		}
		
		log.Printf("✅ Cleanup completed: %d removed, %d kept", cleanupResult.SubtitlesRemoved, cleanupResult.SubtitlesKept)
		
		// Step 2: Find media without subtitles and download
		log.Printf("📋 Step 2/2: Downloading subtitles for media without valid English subs...")
		
		allMedia, err := mediaService.GetAllMedia()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status": "error",
				"error":  err.Error(),
			})
			return
		}
		
		var mediaWithoutSubs []uint
		var downloadProcessed, downloadSuccessful, downloadFailed int
		var downloadErrors []string
		
		// Find media without valid English subtitles
		for _, media := range allMedia {
			tracks, err := mediaService.GetSubtitleTracks(media.ID)
			if err != nil || len(tracks) == 0 {
				mediaWithoutSubs = append(mediaWithoutSubs, media.ID)
				continue
			}
			
			hasValidEnglishSub := false
			for _, track := range tracks {
				languageLower := strings.ToLower(track.Language)
				englishCodes := []string{"en", "eng", "english", "en-us", "en-gb"}
				isEnglish := false
				for _, code := range englishCodes {
					if languageLower == code {
						isEnglish = true
						break
					}
				}
				
				if isEnglish {
					hasValidEnglishSub = true
					break
				}
			}
			
			if !hasValidEnglishSub {
				mediaWithoutSubs = append(mediaWithoutSubs, media.ID)
			}
		}
		
		log.Printf("📊 Found %d media items needing subtitle download", len(mediaWithoutSubs))
		
		// Download subtitles with rate limiting
		for i, mediaID := range mediaWithoutSubs {
			media, err := mediaService.GetMediaByID(mediaID)
			if err != nil {
				downloadErrors = append(downloadErrors, fmt.Sprintf("Media %d: not found", mediaID))
				continue
			}
			
			downloadProcessed++
			log.Printf("📥 [%d/%d] Downloading subtitle for: %s", i+1, len(mediaWithoutSubs), media.Title)
			
			if err := matcherService.SearchAndDownloadSubtitle(media); err != nil {
				downloadFailed++
				downloadErrors = append(downloadErrors, fmt.Sprintf("%s: %v", media.Title, err))
				log.Printf("❌ Failed: %v", err)
			} else {
				downloadSuccessful++
				log.Printf("✅ Success!")
			}
			
			// Rate limiting: Wait 2 seconds between requests to respect OpenSubtitles 1 req/sec limit
			if i < len(mediaWithoutSubs)-1 {
				time.Sleep(2 * time.Second)
			}
			
			// Progress update every 10 items
			if (i+1)%10 == 0 {
				log.Printf("📊 Download progress: %d/%d processed, %d successful, %d failed", 
					downloadProcessed, len(mediaWithoutSubs), downloadSuccessful, downloadFailed)
			}
		}
		
		log.Printf("🎉 Complete subtitle management workflow finished!")
		
		c.JSON(http.StatusOK, gin.H{
			"status": "completed",
			"cleanup": gin.H{
				"total_media":           cleanupResult.TotalMedia,
				"media_processed":       cleanupResult.MediaProcessed,
				"subtitles_removed":     cleanupResult.SubtitlesRemoved,
				"subtitles_kept":        cleanupResult.SubtitlesKept,
				"external_subs_removed": cleanupResult.ExternalSubsRemoved,
				"internal_subs_removed": cleanupResult.InternalSubsRemoved,
				"errors":                cleanupResult.Errors,
			},
			"download": gin.H{
				"media_needing_subs": len(mediaWithoutSubs),
				"processed":          downloadProcessed,
				"successful":         downloadSuccessful,
				"failed":             downloadFailed,
				"errors":             downloadErrors,
			},
		})
	}
}
