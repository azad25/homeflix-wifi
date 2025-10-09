package database

import (
	"fmt"
	"homeflix-backend/internal/models"
	"log"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// InitializePostgreSQL initializes a PostgreSQL database connection with optimizations
func InitializePostgreSQL(host, user, password, dbname string, port int, sslmode string) (*gorm.DB, error) {
	// Build PostgreSQL DSN
	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%d sslmode=%s TimeZone=UTC",
		host, user, password, dbname, port, sslmode)

	// Configure GORM with optimized settings
	config := &gorm.Config{
		Logger:                 logger.Default.LogMode(logger.Silent),
		PrepareStmt:           true,  // Enable prepared statement caching
		DisableForeignKeyConstraintWhenMigrating: false, // PostgreSQL handles FK constraints well
	}

	// Open PostgreSQL connection
	db, err := gorm.Open(postgres.Open(dsn), config)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to PostgreSQL: %w", err)
	}

	// Get underlying SQL DB for connection pool configuration
	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}

	// Configure connection pool for high performance
	sqlDB.SetMaxIdleConns(25)                  // Keep 25 idle connections
	sqlDB.SetMaxOpenConns(200)                 // Allow up to 200 concurrent connections
	sqlDB.SetConnMaxLifetime(5 * time.Minute) // Recycle connections every 5 minutes
	sqlDB.SetConnMaxIdleTime(time.Minute)     // Close idle connections after 1 minute

	// Test connection
	if err := sqlDB.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping PostgreSQL: %w", err)
	}

	// Auto-migrate the schema
	err = db.AutoMigrate(
		&models.Media{},
		&models.Series{},
		&models.Season{},
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
		return nil, fmt.Errorf("failed to migrate PostgreSQL schema: %w", err)
	}

	// Create PostgreSQL-specific indexes and optimizations
	err = createPostgreSQLOptimizations(db)
	if err != nil {
		log.Printf("Warning: Failed to create PostgreSQL optimizations: %v", err)
	}

	// Create default genres
	createDefaultGenres(db)

	log.Println("PostgreSQL database initialized with performance optimizations")
	return db, nil
}

// createPostgreSQLOptimizations creates PostgreSQL-specific indexes and optimizations
func createPostgreSQLOptimizations(db *gorm.DB) error {
	optimizations := []string{
		// Indexes for Media table
		`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_uuid_hash ON media USING hash(uuid)`,
		`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_type_btree ON media(type)`,
		`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_series_id ON media(series_id) WHERE series_id IS NOT NULL`,
		`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_season_id ON media(season_id) WHERE season_id IS NOT NULL`,
		`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_genre_gin ON media USING gin(to_tsvector('english', genre))`,
		`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_year ON media(year) WHERE year IS NOT NULL`,
		`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_rating ON media(rating) WHERE rating > 0`,
		`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_created_at ON media(created_at)`,
		`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_title_gin ON media USING gin(to_tsvector('english', title))`,
		
		// Indexes for Series table
		`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_series_uuid_hash ON series USING hash(uuid)`,
		`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_series_title_gin ON series USING gin(to_tsvector('english', title))`,
		
		// Indexes for Season table
		`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_seasons_series_id ON seasons(series_id)`,
		`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_seasons_season_number ON seasons(series_id, season_number)`,
		
		// Indexes for user activity tables
		`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_playback_progress_media_id ON playback_progress(media_id)`,
		`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_my_list_media_id ON my_list(media_id)`,
		`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_watch_history_media_id ON watch_history(media_id)`,
		`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_watch_history_user_id ON watch_history(user_id)`,
		
		// Composite indexes for common queries
		`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_type_year ON media(type, year) WHERE year IS NOT NULL`,
		`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_type_rating ON media(type, rating) WHERE rating > 0`,
		`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_episodes_series_season ON media(series_id, season_number, episode_number) WHERE type = 'episode'`,
	}

	for _, opt := range optimizations {
		if err := db.Exec(opt).Error; err != nil {
			// Log but don't fail on index creation errors (they might already exist)
			log.Printf("Warning: Failed to execute optimization: %s - %v", opt, err)
		}
	}

	// PostgreSQL-specific performance settings
	performanceSettings := []string{
		`SET shared_preload_libraries = 'pg_stat_statements'`,
		`SET track_activity_query_size = 2048`,
		`SET log_min_duration_statement = 1000`, // Log queries taking > 1 second
	}

	for _, setting := range performanceSettings {
		if err := db.Exec(setting).Error; err != nil {
			log.Printf("Warning: Failed to apply performance setting: %s - %v", setting, err)
		}
	}

	return nil
}

// PostgreSQLPerformanceMonitor extends PerformanceMonitor for PostgreSQL-specific metrics
type PostgreSQLPerformanceMonitor struct {
	*PerformanceMonitor
}

// NewPostgreSQLPerformanceMonitor creates a PostgreSQL-specific performance monitor
func NewPostgreSQLPerformanceMonitor(db *gorm.DB) *PostgreSQLPerformanceMonitor {
	return &PostgreSQLPerformanceMonitor{
		PerformanceMonitor: NewPerformanceMonitor(db),
	}
}

// GetPostgreSQLStats retrieves PostgreSQL-specific performance statistics
func (pm *PostgreSQLPerformanceMonitor) GetPostgreSQLStats() (map[string]interface{}, error) {
	stats := make(map[string]interface{})

	// Get database size
	var dbSize int64
	err := pm.db.Raw("SELECT pg_database_size(current_database())").Scan(&dbSize).Error
	if err == nil {
		stats["database_size_bytes"] = dbSize
	}

	// Get connection stats
	var connections []map[string]interface{}
	err = pm.db.Raw(`
		SELECT state, count(*) as count 
		FROM pg_stat_activity 
		WHERE datname = current_database() 
		GROUP BY state
	`).Scan(&connections).Error
	if err == nil {
		stats["connections"] = connections
	}

	// Get table sizes
	var tableSizes []map[string]interface{}
	err = pm.db.Raw(`
		SELECT 
			schemaname,
			tablename,
			pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
			pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
		FROM pg_tables 
		WHERE schemaname = 'public'
		ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
	`).Scan(&tableSizes).Error
	if err == nil {
		stats["table_sizes"] = tableSizes
	}

	// Get slow queries (if pg_stat_statements is available)
	var slowQueries []map[string]interface{}
	err = pm.db.Raw(`
		SELECT 
			query,
			calls,
			total_time,
			mean_time,
			rows
		FROM pg_stat_statements 
		WHERE mean_time > 100
		ORDER BY mean_time DESC 
		LIMIT 10
	`).Scan(&slowQueries).Error
	if err == nil {
		stats["slow_queries"] = slowQueries
	}

	// Get index usage
	var indexUsage []map[string]interface{}
	err = pm.db.Raw(`
		SELECT 
			schemaname,
			tablename,
			indexname,
			idx_scan,
			idx_tup_read,
			idx_tup_fetch
		FROM pg_stat_user_indexes 
		WHERE schemaname = 'public'
		ORDER BY idx_scan DESC
	`).Scan(&indexUsage).Error
	if err == nil {
		stats["index_usage"] = indexUsage
	}

	return stats, nil
}

// LogPostgreSQLPerformanceReport logs a comprehensive PostgreSQL performance report
func (pm *PostgreSQLPerformanceMonitor) LogPostgreSQLPerformanceReport() {
	log.Println("=== PostgreSQL Performance Report ===")
	
	stats, err := pm.GetPostgreSQLStats()
	if err != nil {
		log.Printf("Error getting PostgreSQL stats: %v", err)
		return
	}

	// Log database size
	if dbSize, ok := stats["database_size_bytes"].(int64); ok {
		log.Printf("Database Size: %.2f MB", float64(dbSize)/(1024*1024))
	}

	// Log connection stats
	if connections, ok := stats["connections"].([]map[string]interface{}); ok {
		log.Println("Connection States:")
		for _, conn := range connections {
			log.Printf("  %s: %v", conn["state"], conn["count"])
		}
	}

	// Log table sizes
	if tableSizes, ok := stats["table_sizes"].([]map[string]interface{}); ok {
		log.Println("Table Sizes:")
		for _, table := range tableSizes {
			log.Printf("  %s: %s", table["tablename"], table["size"])
		}
	}

	// Run base performance report
	pm.PerformanceMonitor.LogPerformanceReport()
}
