package main

import (
	"fmt"
	"log"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"homeflix-backend/internal/models"
)

func main() {
	// Connect to database
	db, err := gorm.Open(sqlite.Open("homeflix.db"), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	fmt.Println("🎬 Creating sample recommendation data for user ID 1...")

	// Get some media items to create viewing history
	var mediaItems []models.Media
	if err := db.Limit(10).Find(&mediaItems).Error; err != nil {
		log.Fatal("Failed to fetch media items:", err)
	}

	if len(mediaItems) == 0 {
		fmt.Println("❌ No media items found in database. Please scan some media first.")
		return
	}

	userID := uint(1)

	// Create sample viewing history
	fmt.Println("📺 Creating sample viewing history...")
	for i, media := range mediaItems {
		if i >= 5 { // Only create history for first 5 items
			break
		}

		// Create viewing history with different completion rates
		completed := i%2 == 0 // Alternate between completed and incomplete
		progress := int64(300) // 5 minutes minimum
		if completed {
			progress = media.Duration - 60 // Almost complete
		} else {
			progress = media.Duration / 3 // 1/3 watched
		}

		viewHistory := models.ViewHistory{
			UserID:    userID,
			MediaID:   media.ID,
			Progress:  progress,
			Completed: completed,
			WatchedAt: time.Now().Add(-time.Duration(i*24) * time.Hour), // Spread over last few days
		}

		if err := db.Create(&viewHistory).Error; err != nil {
			fmt.Printf("Warning: Failed to create view history for media %d: %v\n", media.ID, err)
		} else {
			fmt.Printf("✅ Created view history for: %s (completed: %v)\n", media.Title, completed)
		}
	}

	// Create sample user ratings
	fmt.Println("⭐ Creating sample user ratings...")
	for i, media := range mediaItems {
		if i >= 3 { // Only create ratings for first 3 items
			break
		}

		// Create ratings between 7-10 for good recommendations
		rating := float32(7 + (i * 1)) // 7, 8, 9
		if rating > 10 {
			rating = 10
		}

		userRating := models.UserRating{
			UserID:  userID,
			MediaID: media.ID,
			Rating:  rating,
		}

		if err := db.Create(&userRating).Error; err != nil {
			fmt.Printf("Warning: Failed to create rating for media %d: %v\n", media.ID, err)
		} else {
			fmt.Printf("✅ Created rating %.1f for: %s\n", rating, media.Title)
		}
	}

	// Update media view counts to simulate popularity
	fmt.Println("📊 Updating media view counts...")
	for i, media := range mediaItems {
		viewCount := 10 + (i * 5) // Varying popularity
		if err := db.Model(&media).Update("view_count", viewCount).Error; err != nil {
			fmt.Printf("Warning: Failed to update view count for media %d: %v\n", media.ID, err)
		}
	}

	fmt.Println("🎉 Sample recommendation data created successfully!")
	fmt.Println("📝 Summary:")
	fmt.Printf("   - Created viewing history for user %d\n", userID)
	fmt.Printf("   - Created ratings for user %d\n", userID)
	fmt.Println("   - Updated media view counts")
	fmt.Println("")
	fmt.Println("🚀 You can now test personalized recommendations!")
	fmt.Println("   Try calling: GET /api/recommendations/personalized")
	fmt.Println("   Or: GET /api/recommendations/popular")
}