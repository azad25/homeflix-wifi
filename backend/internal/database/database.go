package database

import (
	"time"
	"homeflix-backend/internal/models"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func Initialize(databaseURL string) (*gorm.DB, error) {
	// Configure GORM with optimized settings
	config := &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent), // Reduce logging overhead
		PrepareStmt: true, // Enable prepared statement caching
		DisableForeignKeyConstraintWhenMigrating: true, // Faster migrations
	}
	
	db, err := gorm.Open(sqlite.Open(databaseURL), config)
	if err != nil {
		return nil, err
	}

	// Get underlying SQL DB for connection pool configuration
	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}

	// Configure connection pool for better performance
	sqlDB.SetMaxIdleConns(10)           // Maximum idle connections
	sqlDB.SetMaxOpenConns(50)           // Maximum open connections
	sqlDB.SetConnMaxLifetime(time.Hour) // Connection max lifetime

	// Configure SQLite-specific optimizations
	pragmas := []string{
		"PRAGMA journal_mode = WAL",        // Write-Ahead Logging for better concurrency
		"PRAGMA synchronous = NORMAL",      // Balance between safety and performance
		"PRAGMA cache_size = 10000",        // Increase cache size (10MB)
		"PRAGMA foreign_keys = ON",         // Enable foreign key constraints
		"PRAGMA temp_store = MEMORY",       // Store temp tables in memory
		"PRAGMA mmap_size = 268435456",     // 256MB memory-mapped I/O
		"PRAGMA busy_timeout = 30000",      // 30 second busy timeout
	}

	for _, pragma := range pragmas {
		if _, err := sqlDB.Exec(pragma); err != nil {
			// Log warning but don't fail initialization
			continue
		}
	}

	// Auto-migrate the schema
	err = db.AutoMigrate(
		&models.Media{},
		&models.Series{},
		&models.Season{}, // Add missing Season model
		&models.Genre{},
		&models.Subtitle{},
		&models.User{},
		&models.WatchlistItem{},
		&models.ViewHistory{},
		&models.UserRating{},
		&models.Recommendation{},
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
