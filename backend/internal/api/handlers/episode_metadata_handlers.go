package handlers

import (
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"homeflix-backend/internal/models"
	"homeflix-backend/internal/services"

	"github.com/gin-gonic/gin"
)

// UpdateEpisodeWithTMDB fetches and updates episode metadata from TMDB
func UpdateEpisodeWithTMDB(mediaService *services.MediaService, tmdbService *services.TMDBService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
			return
		}

		// Get the episode
		media, err := mediaService.GetMediaByID(uint(id))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Episode not found"})
			return
		}

		// Verify it's an episode
		if media.Type != "episode" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Media is not an episode"})
			return
		}

		// Check if it has series info
		if media.SeriesID == nil || *media.SeriesID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Episode has no series association"})
			return
		}

		if media.SeasonNumber == nil || media.EpisodeNumber == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Episode missing season/episode numbers"})
			return
		}

		// Get the series to get TMDB ID
		series, err := mediaService.GetSeriesByID(*media.SeriesID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Series not found"})
			return
		}

		if series.TMDBID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Series has no TMDB ID"})
			return
		}

		log.Printf("📺 Fetching TMDB metadata for episode %d: %s S%02dE%02d", 
			id, series.Title, *media.SeasonNumber, *media.EpisodeNumber)

		// Fetch episode details from TMDB
		episode, err := tmdbService.GetEpisodeDetails(series.TMDBID, *media.SeasonNumber, *media.EpisodeNumber)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to fetch TMDB data: %v", err)})
			return
		}

		// Update media with episode metadata
		if episode.Name != "" {
			media.EpisodeTitle = episode.Name
		}

		if episode.Overview != "" {
			media.Description = episode.Overview
			media.LongDesc = episode.Overview
			media.ShortDesc = truncateText(episode.Overview, 150)
		}

		if episode.Runtime > 0 {
			media.Runtime = episode.Runtime
			media.Duration = episode.Runtime * 60 // Convert to seconds
		}

		if episode.VoteAverage > 0 {
			media.Rating = episode.VoteAverage
			media.VoteCount = episode.VoteCount
		}

		if episode.AirDate != "" {
			if airDate, err := time.Parse("2006-01-02", episode.AirDate); err == nil {
				media.ReleaseDate = airDate
				media.Year = airDate.Year()
			}
		}

		// Extract crew information
		var directors []string
		var writers []string
		for _, crew := range episode.Crew {
			switch crew.Job {
			case "Director":
				directors = append(directors, crew.Name)
			case "Writer", "Screenplay", "Story":
				writers = append(writers, crew.Name)
			}
		}

		if len(directors) > 0 {
			media.Director = directors
		}

		if len(writers) > 0 {
			media.Writers = writers
		}

		// Extract guest stars
		if len(episode.GuestStars) > 0 {
			var guestStars []string
			for i, guest := range episode.GuestStars {
				if i >= 10 { // Limit to top 10
					break
				}
				guestStars = append(guestStars, guest.Name)
			}
			media.GuestStars = guestStars
		}

		// Download episode still if available
		if episode.StillPath != "" {
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
			} else if stillPath != "" {
				media.EpisodeStillPath = stillPath
			}
		}

		// Save updated media
		if err := mediaService.UpdateMedia(media); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to update episode: %v", err)})
			return
		}

		log.Printf("✅ Episode metadata updated: %s S%02dE%02d - %s", 
			series.Title, *media.SeasonNumber, *media.EpisodeNumber, episode.Name)

		c.JSON(http.StatusOK, gin.H{
			"message": "Episode metadata updated successfully",
			"episode": media,
		})
	}
}

// UpdateSeasonWithTMDB fetches and updates season metadata from TMDB
func UpdateSeasonWithTMDB(mediaService *services.MediaService, tmdbService *services.TMDBService) gin.HandlerFunc {
	return func(c *gin.Context) {
		seriesID, err := strconv.ParseUint(c.Param("seriesId"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid series ID"})
			return
		}

		seasonNumber, err := strconv.Atoi(c.Param("seasonNumber"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid season number"})
			return
		}

		// Get the series
		series, err := mediaService.GetSeriesByID(uint(seriesID))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Series not found"})
			return
		}

		if series.TMDBID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Series has no TMDB ID"})
			return
		}

		log.Printf("📺 Fetching TMDB season metadata for: %s Season %d", series.Title, seasonNumber)

		// Fetch season details from TMDB
		season, err := tmdbService.GetSeasonDetails(series.TMDBID, seasonNumber)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to fetch TMDB data: %v", err)})
			return
		}

		// Create or update season record in database
		seasonRecord := &models.Season{
			SeriesID:     uint(seriesID),
			SeasonNumber: seasonNumber,
			Title:        season.Name,
			Overview:     season.Overview,
			Description:  season.Overview,
			AirDate:      season.AirDate,
			PosterPath:   season.PosterPath,
			EpisodeCount: len(season.Episodes),
			TMDBID:       season.ID,
		}

		if season.AirDate != "" {
			if airDate, err := time.Parse("2006-01-02", season.AirDate); err == nil {
				seasonRecord.ReleaseDate = airDate
			}
		}

		// Save season record
		if err := mediaService.CreateOrUpdateSeason(seasonRecord); err != nil {
			log.Printf("⚠️ Failed to save season record: %v", err)
		} else {
			log.Printf("✅ Saved season record: %s Season %d", series.Title, seasonNumber)
		}

		// Update all episodes in this season
		updatedCount := 0
		for _, tmdbEpisode := range season.Episodes {
			// Find the episode in database
			episodes, err := mediaService.SearchMedia(fmt.Sprintf("S%02dE%02d", seasonNumber, tmdbEpisode.EpisodeNumber))
			if err != nil || len(episodes) == 0 {
				continue
			}

			// Find the matching episode for this series
			var episode *models.Media
			for i := range episodes {
				if episodes[i].SeriesID != nil && *episodes[i].SeriesID == uint(seriesID) &&
					episodes[i].SeasonNumber != nil && *episodes[i].SeasonNumber == seasonNumber &&
					episodes[i].EpisodeNumber != nil && *episodes[i].EpisodeNumber == tmdbEpisode.EpisodeNumber {
					episode = &episodes[i]
					break
				}
			}

			if episode == nil {
				continue
			}

			// Update episode metadata
			if tmdbEpisode.Name != "" {
				episode.EpisodeTitle = tmdbEpisode.Name
			}

			if tmdbEpisode.Overview != "" {
				episode.Description = tmdbEpisode.Overview
				episode.LongDesc = tmdbEpisode.Overview
				episode.ShortDesc = truncateText(tmdbEpisode.Overview, 150)
			}

			if tmdbEpisode.Runtime > 0 {
				episode.Runtime = tmdbEpisode.Runtime
				episode.Duration = tmdbEpisode.Runtime * 60
			}

			if tmdbEpisode.VoteAverage > 0 {
				episode.Rating = tmdbEpisode.VoteAverage
				episode.VoteCount = tmdbEpisode.VoteCount
			}

			if tmdbEpisode.AirDate != "" {
				if airDate, err := time.Parse("2006-01-02", tmdbEpisode.AirDate); err == nil {
					episode.ReleaseDate = airDate
					episode.Year = airDate.Year()
				}
			}

			// Extract crew
			var directors []string
			var writers []string
			for _, crew := range tmdbEpisode.Crew {
				switch crew.Job {
				case "Director":
					directors = append(directors, crew.Name)
				case "Writer", "Screenplay", "Story":
					writers = append(writers, crew.Name)
				}
			}

			if len(directors) > 0 {
				episode.Director = directors
			}

			if len(writers) > 0 {
				episode.Writers = writers
			}

			// Extract guest stars
			if len(tmdbEpisode.GuestStars) > 0 {
				var guestStars []string
				for i, guest := range tmdbEpisode.GuestStars {
					if i >= 10 {
						break
					}
					guestStars = append(guestStars, guest.Name)
				}
				episode.GuestStars = guestStars
			}

			// Download episode still
			if tmdbEpisode.StillPath != "" {
				stillDir := "./episode_stills"
				stillPath, err := tmdbService.DownloadEpisodeStill(
					tmdbEpisode.StillPath,
					series.TMDBID,
					seasonNumber,
					tmdbEpisode.EpisodeNumber,
					stillDir,
				)
				if err == nil && stillPath != "" {
					episode.EpisodeStillPath = stillPath
				}
			}

			// Save updated episode
			if err := mediaService.UpdateMedia(episode); err != nil {
				log.Printf("⚠️ Failed to update episode S%02dE%02d: %v", seasonNumber, tmdbEpisode.EpisodeNumber, err)
			} else {
				updatedCount++
			}
		}

		log.Printf("✅ Season %d metadata updated: %d episodes", seasonNumber, updatedCount)

		c.JSON(http.StatusOK, gin.H{
			"message":        "Season metadata updated successfully",
			"season_number":  seasonNumber,
			"episodes_updated": updatedCount,
			"season_info": gin.H{
				"name":          season.Name,
				"overview":      season.Overview,
				"episode_count": len(season.Episodes),
				"air_date":      season.AirDate,
			},
		})
	}
}

// truncateText truncates text to a maximum length
func truncateText(text string, maxLength int) string {
	if len(text) <= maxLength {
		return text
	}

	// Find the last space before maxLength
	truncated := text[:maxLength]
	lastSpace := -1
	for i := len(truncated) - 1; i >= 0; i-- {
		if truncated[i] == ' ' {
			lastSpace = i
			break
		}
	}

	if lastSpace > 0 {
		truncated = truncated[:lastSpace]
	}

	return truncated + "..."
}
