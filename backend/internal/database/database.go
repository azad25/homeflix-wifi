package database

import (
	"homeflix-backend/internal/models"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func Initialize(databaseURL string) (*gorm.DB, error) {
	db, err := gorm.Open(sqlite.Open(databaseURL), &gorm.Config{})
	if err != nil {
		return nil, err
	}

	// Auto-migrate the schema
	err = db.AutoMigrate(
		&models.Media{},
		&models.Series{},
		&models.Genre{},
		&models.Subtitle{},
		&models.User{},
		&models.WatchlistItem{},
		&models.ViewHistory{},
		&models.UserRating{},
		&models.Recommendation{},
		&models.PlaybackProgress{},
		&models.WatchHistory{},
		&models.RecentlyWatched{},
		&models.MyList{},
	)
	if err != nil {
		return nil, err
	}

	// Create default genres
	createDefaultGenres(db)

	return db, nil
}

func createDefaultGenres(db *gorm.DB) {
	genres := []models.Genre{
		{Name: "Action", Description: "Action and adventure movies"},
		{Name: "Comedy", Description: "Comedy and humor"},
		{Name: "Drama", Description: "Dramatic stories"},
		{Name: "Horror", Description: "Horror and thriller"},
		{Name: "Romance", Description: "Romantic stories"},
		{Name: "Sci-Fi", Description: "Science fiction"},
		{Name: "Fantasy", Description: "Fantasy and magical"},
		{Name: "Documentary", Description: "Documentary films"},
		{Name: "Animation", Description: "Animated content"},
		{Name: "Crime", Description: "Crime and mystery"},
		{Name: "Thriller", Description: "Suspense and thriller"},
		{Name: "Adventure", Description: "Adventure stories"},
		{Name: "Family", Description: "Family-friendly content"},
		{Name: "Music", Description: "Music and musical"},
		{Name: "War", Description: "War and military"},
		{Name: "Western", Description: "Western genre"},
		{Name: "Biography", Description: "Biographical content"},
		{Name: "History", Description: "Historical content"},
		{Name: "Sport", Description: "Sports content"},
		{Name: "Mystery", Description: "Mystery and detective"},
	}

	for _, genre := range genres {
		db.FirstOrCreate(&genre, models.Genre{Name: genre.Name})
	}
}
