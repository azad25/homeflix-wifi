package main

import (
	"fmt"
	"log"
	"os"

	"homeflix-backend/internal/models"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func main() {
	// Get database path from environment or use default
	dbPath := os.Getenv("DATABASE_URL")
	if dbPath == "" {
		dbPath = "./homeflix.db"
	}

	// Open database connection
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	fmt.Println("🔄 Resetting playback tables...")

	// Drop existing playback tables
	if err := db.Migrator().DropTable(&models.PlaybackProgress{}); err != nil {
		fmt.Printf("Warning: Failed to drop PlaybackProgress table: %v\n", err)
	}
	if err := db.Migrator().DropTable(&models.WatchHistory{}); err != nil {
		fmt.Printf("Warning: Failed to drop WatchHistory table: %v\n", err)
	}
	if err := db.Migrator().DropTable(&models.RecentlyWatched{}); err != nil {
		fmt.Printf("Warning: Failed to drop RecentlyWatched table: %v\n", err)
	}
	if err := db.Migrator().DropTable(&models.MyList{}); err != nil {
		fmt.Printf("Warning: Failed to drop MyList table: %v\n", err)
	}

	// Recreate tables with proper schema
	if err := db.AutoMigrate(
		&models.PlaybackProgress{},
		&models.WatchHistory{},
		&models.RecentlyWatched{},
		&models.MyList{},
	); err != nil {
		log.Fatalf("Failed to migrate playback tables: %v", err)
	}

	fmt.Println("✅ Playback tables reset successfully!")

	// Create some sample data for testing
	fmt.Println("🔄 Creating sample playback data...")

	// Sample playback progress
	sampleProgress := []models.PlaybackProgress{
		{
			UserID:   "1",
			MediaID:  1,
			Position: 1800,  // 30 minutes
			Duration: 7200,  // 2 hours
			Progress: 25.0,  // 25%
			Completed: false,
		},
		{
			UserID:   "1",
			MediaID:  2,
			Position: 3600,  // 1 hour
			Duration: 5400,  // 1.5 hours
			Progress: 66.67, // 66.67%
			Completed: false,
		},
		{
			UserID:   "1",
			MediaID:  3,
			Position: 5100,  // 1 hour 25 minutes
			Duration: 5400,  // 1.5 hours
			Progress: 94.44, // 94.44%
			Completed: false,
		},
	}

	for _, progress := range sampleProgress {
		if err := db.Create(&progress).Error; err != nil {
			fmt.Printf("Warning: Failed to create sample progress: %v\n", err)
		}
	}

	fmt.Println("✅ Sample playback data created!")
	fmt.Println("🎉 Database reset complete!")
}