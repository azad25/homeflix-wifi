package handlers

import (
	"fmt"
	"log"
	"net/http"
	"time"

	"homeflix-backend/internal/services"

	"github.com/gin-gonic/gin"
)

// ScanMovieLogos scans all movies and downloads their logos from TMDB
// For movies without TMDB IDs, it searches TMDB by title first
func ScanMovieLogos(mediaService *services.MediaService, tmdbService *services.TMDBService) gin.HandlerFunc {
	return func(c *gin.Context) {
		log.Printf("🎬 Starting logo scan for all movies...")

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

		logoDir := "./logos"
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

			// Skip if logo already exists
			if movie.LogoPath != "" {
				log.Printf("⏭️ Skipping %s (ID: %d) - Logo already exists", movie.Title, movie.ID)
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

			log.Printf("🎨 [%d/%d] Downloading logo for: %s (TMDB: %d)",
				i+1, len(movies), movie.Title, movie.TMDBID)

			// Download logo
			logoPath, err := tmdbService.DownloadMovieLogo(movie.TMDBID, movie.ID, logoDir)
			if err != nil {
				log.Printf("⚠️ Failed to download logo for %s: %v", movie.Title, err)
				errors = append(errors, fmt.Sprintf("%s: %v", movie.Title, err))
				errorCount++
				continue
			}

			// Update media with logo path
			movie.LogoPath = logoPath
			if err := mediaService.UpdateMedia(&movie); err != nil {
				log.Printf("⚠️ Failed to update media %s with logo path: %v", movie.Title, err)
				errors = append(errors, fmt.Sprintf("%s: failed to update DB: %v", movie.Title, err))
				errorCount++
				continue
			}

			log.Printf("✅ Logo saved for %s: %s", movie.Title, logoPath)
			successCount++
		}

		log.Printf("🏁 Logo scan complete: %d success, %d skipped, %d TMDB IDs found, %d errors",
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

