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

// ScanMovieBackdrops scans all movies and downloads their backdrops from TMDB
// For movies without TMDB IDs, it searches TMDB by title first
func ScanMovieBackdrops(mediaService *services.MediaService, tmdbService *services.TMDBService) gin.HandlerFunc {
	return func(c *gin.Context) {
		log.Printf("🖼️ Starting backdrop scan for all movies...")

		// Get all movies
		movies, err := mediaService.GetMovies()
		if err != nil {
			log.Printf("❌ Failed to get movies: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to get movies",
				"details": err.Error(),
			})
			return
		}

		backdropDir := "./backdrops"
		successCount := 0
		skipCount := 0
		tmdbFoundCount := 0
		errorCount := 0
		var errors []string

		for i, movie := range movies {
			// Rate limiting: 50ms delay between requests (~20 req/sec)
			if i > 0 {
				time.Sleep(50 * time.Millisecond)
			}

			// Skip if backdrop already exists
			if movie.BackdropPath != "" {
				log.Printf("⏭️ Skipping %s (ID: %d) - Backdrop already exists", movie.Title, movie.ID)
				skipCount++
				continue
			}

			// If no TMDB ID, search TMDB by title first
			if movie.TMDBID == 0 {
				log.Printf("🔍 [%d/%d] Searching TMDB for: %s (Year: %d)",
					i+1, len(movies), movie.Title, movie.Year)

				// Clean title and search TMDB
				cleanTitle := tmdbService.RemoveYearFromTitle(movie.Title)
				tmdbMovie, searchErr := tmdbService.SearchMovie(cleanTitle, movie.Year)
				
				if searchErr != nil {
					log.Printf("⚠️ TMDB search failed for %s: %v", movie.Title, searchErr)
					errors = append(errors, fmt.Sprintf("%s: TMDB search failed: %v", movie.Title, searchErr))
					errorCount++
					continue
				}

				// Found TMDB match - save the ID
				movie.TMDBID = tmdbMovie.ID
				log.Printf("✅ Found TMDB match for %s: ID %d", movie.Title, tmdbMovie.ID)
				tmdbFoundCount++

				// Update movie with TMDB ID
				if err := mediaService.UpdateMedia(&movie); err != nil {
					log.Printf("⚠️ Failed to save TMDB ID for %s: %v", movie.Title, err)
				}
			}

			log.Printf("🖼️ [%d/%d] Downloading backdrop for: %s (TMDB: %d)",
				i+1, len(movies), movie.Title, movie.TMDBID)

			// Download backdrop
			backdropPath, err := tmdbService.DownloadMovieBackdrop(movie.TMDBID, movie.ID, backdropDir)
			if err != nil {
				log.Printf("⚠️ Failed to download backdrop for %s: %v", movie.Title, err)
				errors = append(errors, fmt.Sprintf("%s: %v", movie.Title, err))
				errorCount++
				continue
			}

			// Update media with backdrop path and smart tmdb_backdrop_url
			movie.BackdropPath = backdropPath
			// Set tmdb_backdrop_url to local API endpoint since we have local backdrop
			movie.TMDBBackdropURL = fmt.Sprintf("/api/backdrops/%d", movie.ID)
			if err := mediaService.UpdateMedia(&movie); err != nil {
				log.Printf("⚠️ Failed to update media %s with backdrop path: %v", movie.Title, err)
				errors = append(errors, fmt.Sprintf("%s: failed to update DB: %v", movie.Title, err))
				errorCount++
				continue
			}

			log.Printf("✅ Backdrop saved for %s: %s, tmdb_backdrop_url set to local endpoint", movie.Title, backdropPath)
			successCount++
		}

		log.Printf("🏁 Backdrop scan complete: %d success, %d skipped, %d TMDB IDs found, %d errors",
			successCount, skipCount, tmdbFoundCount, errorCount)

		c.JSON(http.StatusOK, gin.H{
			"status":           "completed",
			"total_movies":     len(movies),
			"success_count":    successCount,
			"skip_count":       skipCount,
			"tmdb_found_count": tmdbFoundCount,
			"error_count":      errorCount,
			"errors":           errors,
		})
	}
}

// GetBackdrop serves backdrop images for media items
func GetBackdrop(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
			return
		}

		// Get media from database
		media, err := mediaService.GetMediaByID(uint(id))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		// Check if backdrop path exists
		if media.BackdropPath == "" {
			c.JSON(http.StatusNotFound, gin.H{"error": "No backdrop available"})
			return
		}

		// Ensure the path is absolute or relative to current directory
		backdropPath := media.BackdropPath
		if !strings.HasPrefix(backdropPath, "/") && !strings.HasPrefix(backdropPath, "./") {
			backdropPath = "./" + backdropPath
		}

		// Serve the backdrop file
		c.File(backdropPath)
	}
}

// GetBackdropWithAutoDownload serves backdrops with automatic TMDB download when missing
func GetBackdropWithAutoDownload(mediaService *services.MediaService, tmdbService *services.TMDBService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
			return
		}

		// Get media from database
		media, err := mediaService.GetMediaByID(uint(id))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		// If backdrop exists, serve it
		if media.BackdropPath != "" {
			c.File(media.BackdropPath)
			return
		}

		// Try to download backdrop from TMDB
		if tmdbService != nil {
			log.Printf("🖼️ Attempting to download backdrop for: %s", media.Title)
			backdropPath, err := tmdbService.DownloadBackdropByTitle(media.Title, media.ID, "./backdrops")
			if err != nil {
				log.Printf("⚠️ Failed to download backdrop for %s: %v", media.Title, err)
				c.JSON(http.StatusNotFound, gin.H{"error": "No backdrop available"})
				return
			}

			// Update media with backdrop path and smart tmdb_backdrop_url
			media.BackdropPath = backdropPath
			// Set tmdb_backdrop_url to local API endpoint since we have local backdrop
			media.TMDBBackdropURL = fmt.Sprintf("/api/backdrops/%d", media.ID)
			if updateErr := mediaService.UpdateMedia(media); updateErr != nil {
				log.Printf("⚠️ Failed to update media with backdrop path: %v", updateErr)
			}

			// Serve the downloaded backdrop
			c.File(backdropPath)
			return
		}

		c.JSON(http.StatusNotFound, gin.H{"error": "No backdrop available"})
	}
}

// MigrateBackdropURLs updates existing media records to use local backdrop URLs when local backdrops exist
// This migration is designed to be safe and non-destructive
func MigrateBackdropURLs(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Check for dry-run parameter
		dryRun := c.Query("dry_run") == "true"
		
		if dryRun {
			log.Printf("🔍 Starting backdrop URL migration (DRY RUN - no changes will be made)...")
		} else {
			log.Printf("🔄 Starting backdrop URL migration...")
		}

		// Get all movies
		movies, err := mediaService.GetMovies()
		if err != nil {
			log.Printf("❌ Failed to get movies: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to get movies",
				"details": err.Error(),
			})
			return
		}

		updatedCount := 0
		skippedCount := 0
		errorCount := 0
		var errors []string
		var updates []map[string]interface{}

		for _, movie := range movies {
			// SAFETY CHECK 1: Only process movies that have local backdrop files
			if movie.BackdropPath == "" {
				skippedCount++
				continue
			}

			// SAFETY CHECK 2: Verify the local backdrop file actually exists
			backdropPath := movie.BackdropPath
			if !strings.HasPrefix(backdropPath, "/") && !strings.HasPrefix(backdropPath, "./") {
				backdropPath = "./" + backdropPath
			}
			
			if _, err := os.Stat(backdropPath); os.IsNotExist(err) {
				log.Printf("⚠️ Skipping %s - backdrop file doesn't exist: %s", movie.Title, backdropPath)
				skippedCount++
				continue
			}

			// SAFETY CHECK 3: Only update if tmdb_backdrop_url currently points to TMDB
			if !strings.HasPrefix(movie.TMDBBackdropURL, "https://image.tmdb.org") {
				// Already using local URL or empty - skip
				skippedCount++
				continue
			}

			// SAFETY CHECK 4: Validate the new URL format
			newBackdropURL := fmt.Sprintf("/api/backdrops/%d", movie.ID)
			
			// Store the planned update
			updateInfo := map[string]interface{}{
				"id":                movie.ID,
				"title":             movie.Title,
				"current_tmdb_url":  movie.TMDBBackdropURL,
				"new_local_url":     newBackdropURL,
				"backdrop_path":     movie.BackdropPath,
				"file_exists":       true,
			}
			updates = append(updates, updateInfo)

			if dryRun {
				log.Printf("🔍 [DRY RUN] Would update %s: %s -> %s", 
					movie.Title, movie.TMDBBackdropURL, newBackdropURL)
				updatedCount++
				continue
			}

			// SAFETY CHECK 5: Create a backup of the original value before updating
			originalTMDBURL := movie.TMDBBackdropURL
			
			// Perform the actual update
			movie.TMDBBackdropURL = newBackdropURL
			
			if err := mediaService.UpdateMedia(&movie); err != nil {
				// SAFETY CHECK 6: If update fails, restore original value
				movie.TMDBBackdropURL = originalTMDBURL
				log.Printf("❌ Failed to update backdrop URL for %s: %v", movie.Title, err)
				errors = append(errors, fmt.Sprintf("%s: %v", movie.Title, err))
				errorCount++
			} else {
				log.Printf("✅ Updated backdrop URL for %s: %s -> %s", 
					movie.Title, originalTMDBURL, newBackdropURL)
				updatedCount++
			}

			// Rate limiting to avoid overwhelming the database
			time.Sleep(10 * time.Millisecond)
		}

		// Prepare response
		response := gin.H{
			"status":        "completed",
			"dry_run":       dryRun,
			"total_movies":  len(movies),
			"updated_count": updatedCount,
			"skipped_count": skippedCount,
			"error_count":   errorCount,
		}

		if dryRun {
			response["message"] = "Dry run completed - no changes were made"
			response["planned_updates"] = updates
		} else {
			response["message"] = "Migration completed"
		}

		if len(errors) > 0 {
			response["errors"] = errors
		}

		if dryRun {
			log.Printf("🔍 Backdrop URL migration DRY RUN complete: %d would be updated, %d skipped, %d errors", 
				updatedCount, skippedCount, errorCount)
		} else {
			log.Printf("🏁 Backdrop URL migration complete: %d updated, %d skipped, %d errors", 
				updatedCount, skippedCount, errorCount)
		}

		c.JSON(http.StatusOK, response)
	}
}