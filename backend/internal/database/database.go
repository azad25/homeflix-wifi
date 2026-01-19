package database

import (
	"database/sql"
	"os"
	"path/filepath"
	"homeflix-backend/internal/models"
	"log"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func Initialize(databaseURL string) (*gorm.DB, error) {
	// Configure GORM with optimized settings
	config := &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent), // Reduce logging overhead
		PrepareStmt: true, // Enable prepared statement caching
		DisableForeignKeyConstraintWhenMigrating: true, // Speed up migrations
	}

	// Open database with optimized SQLite configuration
	db, err := gorm.Open(sqlite.Open(databaseURL+"?_journal_mode=WAL&_synchronous=NORMAL&_cache_size=1000000&_temp_store=memory&_mmap_size=268435456"), config)
	if err != nil {
		return nil, err
	}

	// Get underlying SQL DB for connection pool configuration
	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}

	// Configure connection pool for optimal performance
	sqlDB.SetMaxIdleConns(10)           // Keep 10 idle connections
	sqlDB.SetMaxOpenConns(20)           // Reduce to 20 for SQLite (single writer)
	sqlDB.SetConnMaxLifetime(time.Hour) // Recycle connections every hour

	// Apply critical SQLite performance pragmas
	err = applySQLiteOptimizations(sqlDB)
	if err != nil {
		log.Printf("Warning: Failed to apply SQLite optimizations: %v", err)
	}

	// Auto-migrate the schema
	err = db.AutoMigrate(
		&models.Media{},
		&models.Series{},
		&models.Season{}, // Added missing Season model
		&models.Genre{},
		&models.Subtitle{},
		&models.SubtitleTrack{}, // New enhanced subtitle tracks
		&models.AudioTrack{},    // New audio tracks
		&models.User{},
		&models.WatchlistItem{},
		&models.ViewHistory{},
		&models.UserRating{},
		&models.Recommendation{},
		&models.PlaybackProgress{},
		&models.WatchHistory{},
		&models.RecentlyWatched{},
		&models.MyList{},
		&models.TorrentDownload{}, // Torrent downloads
		&models.TorrentConfig{},   // Torrent configuration
		&models.MediaPath{},       // Media paths configuration
	)
	if err != nil {
		return nil, err
	}

	// Populate UUIDs for existing records without UUIDs
	err = populateUUIDs(db)
	if err != nil {
		log.Printf("Warning: Failed to populate UUIDs: %v", err)
	}

	// Create database indexes for performance
	err = createOptimizedIndexes(db)
	if err != nil {
		log.Printf("Warning: Failed to create optimized indexes: %v", err)
	}

	// Create default genres
	createDefaultGenres(db)

	// Initialize default media paths
	initializeDefaultMediaPaths(db)

	log.Println("Database initialized with SQLite performance optimizations")
	return db, nil
}

// applySQLiteOptimizations applies critical SQLite PRAGMA settings for performance
func applySQLiteOptimizations(sqlDB *sql.DB) error {
	pragmas := []string{
		"PRAGMA journal_mode = WAL",           // Write-Ahead Logging for better concurrency
		"PRAGMA synchronous = NORMAL",         // Balance between safety and speed
		"PRAGMA cache_size = 1000000",         // 1GB cache size
		"PRAGMA temp_store = memory",          // Store temp tables in memory
		"PRAGMA mmap_size = 268435456",        // 256MB memory-mapped I/O
		"PRAGMA page_size = 4096",             // Optimal page size
		"PRAGMA auto_vacuum = INCREMENTAL",    // Incremental vacuum for better performance
		"PRAGMA busy_timeout = 5000",          // 5 second timeout for locked database
		"PRAGMA wal_autocheckpoint = 1000",    // Checkpoint WAL every 1000 pages
		"PRAGMA optimize",                     // Analyze and optimize query planner
	}

	for _, pragma := range pragmas {
		if _, err := sqlDB.Exec(pragma); err != nil {
			return err
		}
	}

	return nil
}

// createOptimizedIndexes creates database indexes for frequently queried columns
func createOptimizedIndexes(db *gorm.DB) error {
	indexes := []string{
		"CREATE INDEX IF NOT EXISTS idx_media_uuid ON media(uuid)",
		"CREATE INDEX IF NOT EXISTS idx_media_type ON media(type)",
		"CREATE INDEX IF NOT EXISTS idx_media_series_id ON media(series_id)",
		"CREATE INDEX IF NOT EXISTS idx_media_season_id ON media(season_id)",
		"CREATE INDEX IF NOT EXISTS idx_media_genre_names ON media(genre_names)",
		"CREATE INDEX IF NOT EXISTS idx_media_year ON media(year)",
		"CREATE INDEX IF NOT EXISTS idx_media_rating ON media(rating)",
		"CREATE INDEX IF NOT EXISTS idx_media_created_at ON media(created_at)",
		"CREATE INDEX IF NOT EXISTS idx_series_uuid ON series(uuid)",
		"CREATE INDEX IF NOT EXISTS idx_seasons_series_id ON seasons(series_id)",
		"CREATE INDEX IF NOT EXISTS idx_seasons_season_number ON seasons(season_number)",
		"CREATE INDEX IF NOT EXISTS idx_playback_progresses_media_id ON playback_progresses(media_id)",
		"CREATE INDEX IF NOT EXISTS idx_my_lists_media_id ON my_lists(media_id)",
		"CREATE INDEX IF NOT EXISTS idx_watch_histories_media_id ON watch_histories(media_id)",
		"CREATE INDEX IF NOT EXISTS idx_subtitle_tracks_media_id ON subtitle_tracks(media_id)",
		"CREATE INDEX IF NOT EXISTS idx_subtitle_tracks_language ON subtitle_tracks(language)",
		"CREATE INDEX IF NOT EXISTS idx_audio_tracks_media_id ON audio_tracks(media_id)",
		"CREATE INDEX IF NOT EXISTS idx_audio_tracks_language ON audio_tracks(language)",
		"CREATE INDEX IF NOT EXISTS idx_media_paths_path ON media_paths(path)",
		"CREATE INDEX IF NOT EXISTS idx_media_paths_type ON media_paths(path_type)",
		"CREATE INDEX IF NOT EXISTS idx_media_paths_active ON media_paths(is_active)",
	}

	for _, index := range indexes {
		if err := db.Exec(index).Error; err != nil {
			return err
		}
	}

	return nil
}

// populateUUIDs generates UUIDs for existing records that don't have them
func populateUUIDs(db *gorm.DB) error {
	// Update Media records without UUIDs
	err := db.Exec(`
		UPDATE media 
		SET uuid = lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))
		WHERE uuid IS NULL OR uuid = ''
	`).Error
	if err != nil {
		return err
	}

	// Update Series records without UUIDs
	err = db.Exec(`
		UPDATE series 
		SET uuid = lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))
		WHERE uuid IS NULL OR uuid = ''
	`).Error
	if err != nil {
		return err
	}

	return nil
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

// initializeDefaultMediaPaths creates default media paths if none exist
func initializeDefaultMediaPaths(db *gorm.DB) {
	var count int64
	db.Model(&models.MediaPath{}).Count(&count)
	
	// Only create default paths if none exist
	if count == 0 {
		// Get home directory for torrent downloads
		homeDir, _ := os.UserHomeDir()
		torrentPath := filepath.Join(homeDir, "Downloads", "homeflix")
		
		defaultPaths := []models.MediaPath{
			{
				Path:        "/media/azad/Movies1",
				Name:        "Primary Movies Directory",
				Description: "Main HomeFlix media collection",
				PathType:    "primary",
				IsActive:    true,
				Priority:    100,
			},
			{
				Path:        torrentPath,
				Name:        "Torrent Downloads",
				Description: "Directory for torrent downloads - automatically scanned",
				PathType:    "torrent",
				IsActive:    true,
				Priority:    50,
			},
		}

		for _, mediaPath := range defaultPaths {
			db.FirstOrCreate(&mediaPath, models.MediaPath{Path: mediaPath.Path})
		}
		
		log.Println("✅ Default media paths initialized")
		log.Printf("📁 Primary media path: /media/azad/Movies1")
		log.Printf("📁 Torrent download path: %s", torrentPath)
	}
}
