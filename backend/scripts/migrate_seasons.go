package main

import (
	"fmt"
	"log"
	"homeflix-backend/internal/config"
	"homeflix-backend/internal/database"
	"homeflix-backend/internal/models"
	"homeflix-backend/internal/services"
)

func main() {
	// Load configuration
	cfg := config.Load()
	
	// Initialize database
	db, err := database.Initialize(cfg.DatabaseURL)
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}
	
	// Auto-migrate to ensure Season table exists
	err = db.AutoMigrate(&models.Season{})
	if err != nil {
		log.Fatal("Failed to migrate Season model:", err)
	}
	
	// Initialize MediaService
	mediaService := services.NewMediaService(db)
	
	// Get all episodes that have series_id and season_number but no season_id
	var episodes []models.Media
	err = db.Where("type = ? AND series_id IS NOT NULL AND season_number IS NOT NULL AND season_id IS NULL", "episode").Find(&episodes).Error
	if err != nil {
		log.Fatal("Failed to fetch episodes:", err)
	}
	
	fmt.Printf("Found %d episodes to migrate\n", len(episodes))
	
	// Group episodes by series and season
	seasonMap := make(map[string][]models.Media)
	for _, episode := range episodes {
		seasonMap[fmt.Sprintf("%d-%d", *episode.SeriesID, *episode.SeasonNumber)] = append(seasonMap[fmt.Sprintf("%d-%d", *episode.SeriesID, *episode.SeasonNumber)], episode)
	}
	
	fmt.Printf("Found %d unique series-season combinations\n", len(seasonMap))
	
	// Create seasons and link episodes
	for _, episodeList := range seasonMap {
		if len(episodeList) == 0 {
			continue
		}
		
		firstEpisode := episodeList[0]
		seriesID := *firstEpisode.SeriesID
		seasonNumber := *firstEpisode.SeasonNumber
		
		fmt.Printf("Processing Series ID %d, Season %d (%d episodes)\n", seriesID, seasonNumber, len(episodeList))
		
		// Find or create season
		season, err := mediaService.FindOrCreateSeason(seriesID, seasonNumber)
		if err != nil {
			log.Printf("Failed to create season for series %d, season %d: %v", seriesID, seasonNumber, err)
			continue
		}
		
		// Update all episodes in this season to link to the season
		for _, episode := range episodeList {
			episode.SeasonID = &season.ID
			err = db.Save(&episode).Error
			if err != nil {
				log.Printf("Failed to update episode %d: %v", episode.ID, err)
			}
		}
		
		// Update season episode count
		season.EpisodeCount = len(episodeList)
		err = db.Save(season).Error
		if err != nil {
			log.Printf("Failed to update season episode count: %v", err)
		}
		
		fmt.Printf("✓ Created season %d for series %d with %d episodes\n", seasonNumber, seriesID, len(episodeList))
	}
	
	// Update series total seasons and episodes
	var allSeries []models.Series
	err = db.Find(&allSeries).Error
	if err != nil {
		log.Fatal("Failed to fetch series:", err)
	}
	
	for _, series := range allSeries {
		var seasonCount int64
		var episodeCount int64
		
		db.Model(&models.Season{}).Where("series_id = ?", series.ID).Count(&seasonCount)
		db.Model(&models.Media{}).Where("series_id = ? AND type = ?", series.ID, "episode").Count(&episodeCount)
		
		series.TotalSeasons = int(seasonCount)
		series.TotalEpisodes = int(episodeCount)
		
		err = db.Save(&series).Error
		if err != nil {
			log.Printf("Failed to update series %d totals: %v", series.ID, err)
		} else {
			fmt.Printf("✓ Updated series '%s': %d seasons, %d episodes\n", series.Title, series.TotalSeasons, series.TotalEpisodes)
		}
	}
	
	fmt.Println("Migration completed successfully!")
}
