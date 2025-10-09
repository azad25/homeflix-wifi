package database

import (
	"database/sql"
	"log"
	"time"

	"gorm.io/gorm"
)

// PerformanceMonitor provides database performance monitoring utilities
type PerformanceMonitor struct {
	db *gorm.DB
}

// NewPerformanceMonitor creates a new performance monitor
func NewPerformanceMonitor(db *gorm.DB) *PerformanceMonitor {
	return &PerformanceMonitor{db: db}
}

// DatabaseStats represents database performance statistics
type DatabaseStats struct {
	WALMode          bool          `json:"wal_mode"`
	CacheSize        int64         `json:"cache_size"`
	PageSize         int64         `json:"page_size"`
	BusyTimeout      int64         `json:"busy_timeout"`
	ConnectionsOpen  int           `json:"connections_open"`
	ConnectionsIdle  int           `json:"connections_idle"`
	ConnectionsInUse int           `json:"connections_in_use"`
	QueryTime        time.Duration `json:"query_time"`
	DatabaseSize     int64         `json:"database_size_bytes"`
	WALSize          int64         `json:"wal_size_bytes"`
	TotalQueries     int64         `json:"total_queries"`
	SlowQueries      int64         `json:"slow_queries"`
	LockWaitTime     time.Duration `json:"lock_wait_time"`
}

// GetDatabaseStats retrieves comprehensive database performance statistics
func (pm *PerformanceMonitor) GetDatabaseStats() (*DatabaseStats, error) {
	stats := &DatabaseStats{}

	sqlDB, err := pm.db.DB()
	if err != nil {
		return nil, err
	}

	// Get connection pool stats
	dbStats := sqlDB.Stats()
	stats.ConnectionsOpen = dbStats.OpenConnections
	stats.ConnectionsIdle = dbStats.Idle
	stats.ConnectionsInUse = dbStats.InUse

	// Get SQLite-specific stats
	err = pm.getSQLiteStats(sqlDB, stats)
	if err != nil {
		log.Printf("Warning: Failed to get SQLite stats: %v", err)
	}

	// Measure query performance
	stats.QueryTime = pm.measureQueryTime()

	return stats, nil
}

// getSQLiteStats retrieves SQLite-specific performance statistics
func (pm *PerformanceMonitor) getSQLiteStats(sqlDB *sql.DB, stats *DatabaseStats) error {
	// Check WAL mode
	var journalMode string
	err := sqlDB.QueryRow("PRAGMA journal_mode").Scan(&journalMode)
	if err == nil {
		stats.WALMode = journalMode == "wal"
	}

	// Get cache size
	err = sqlDB.QueryRow("PRAGMA cache_size").Scan(&stats.CacheSize)
	if err != nil {
		return err
	}

	// Get page size
	err = sqlDB.QueryRow("PRAGMA page_size").Scan(&stats.PageSize)
	if err != nil {
		return err
	}

	// Get busy timeout
	err = sqlDB.QueryRow("PRAGMA busy_timeout").Scan(&stats.BusyTimeout)
	if err != nil {
		return err
	}

	// Get database size
	err = sqlDB.QueryRow("PRAGMA page_count").Scan(&stats.DatabaseSize)
	if err == nil {
		stats.DatabaseSize *= stats.PageSize
	}

	// Get WAL size if in WAL mode
	if stats.WALMode {
		var walPages int64
		err = sqlDB.QueryRow("PRAGMA wal_checkpoint(PASSIVE)").Scan(&walPages)
		if err == nil {
			stats.WALSize = walPages * stats.PageSize
		}
	}

	return nil
}

// measureQueryTime measures average query execution time
func (pm *PerformanceMonitor) measureQueryTime() time.Duration {
	start := time.Now()

	// Execute a representative query
	var count int64
	pm.db.Model(&struct{}{}).Table("media").Count(&count)

	return time.Since(start)
}

// BenchmarkQueries runs performance benchmarks on common queries
func (pm *PerformanceMonitor) BenchmarkQueries() map[string]time.Duration {
	benchmarks := make(map[string]time.Duration)

	// Benchmark: Count all media
	start := time.Now()
	var count int64
	pm.db.Model(&struct{}{}).Table("media").Count(&count)
	benchmarks["count_all_media"] = time.Since(start)

	// Benchmark: Find media by UUID
	start = time.Now()
	pm.db.Where("uuid = ?", "test-uuid").First(&struct{}{})
	benchmarks["find_by_uuid"] = time.Since(start)

	// Benchmark: Find media by type
	start = time.Now()
	pm.db.Where("type = ?", "movie").Limit(10).Find(&[]struct{}{})
	benchmarks["find_by_type"] = time.Since(start)

	// Benchmark: Find media by genre
	start = time.Now()
	pm.db.Where("genre LIKE ?", "%Action%").Limit(10).Find(&[]struct{}{})
	benchmarks["find_by_genre"] = time.Since(start)

	// Benchmark: Complex join query
	start = time.Now()
	pm.db.Table("media").
		Select("media.*, series.title as series_title").
		Joins("LEFT JOIN series ON media.series_id = series.id").
		Where("media.type = ?", "episode").
		Limit(10).
		Find(&[]struct{}{})
	benchmarks["complex_join"] = time.Since(start)

	return benchmarks
}

// OptimizeDatabase runs database optimization commands
func (pm *PerformanceMonitor) OptimizeDatabase() error {
	sqlDB, err := pm.db.DB()
	if err != nil {
		return err
	}

	optimizations := []string{
		"PRAGMA optimize",
		"PRAGMA wal_checkpoint(TRUNCATE)",
		"ANALYZE",
	}

	for _, opt := range optimizations {
		if _, err := sqlDB.Exec(opt); err != nil {
			log.Printf("Warning: Failed to execute %s: %v", opt, err)
		}
	}

	return nil
}

// CheckDatabaseHealth performs health checks on the database
func (pm *PerformanceMonitor) CheckDatabaseHealth() map[string]interface{} {
	health := make(map[string]interface{})

	sqlDB, err := pm.db.DB()
	if err != nil {
		health["error"] = err.Error()
		return health
	}

	// Check if database is accessible
	err = sqlDB.Ping()
	health["accessible"] = err == nil
	if err != nil {
		health["ping_error"] = err.Error()
	}

	// Check integrity
	var integrityCheck string
	err = sqlDB.QueryRow("PRAGMA integrity_check").Scan(&integrityCheck)
	health["integrity"] = integrityCheck == "ok"
	if integrityCheck != "ok" {
		health["integrity_error"] = integrityCheck
	}

	// Check for locked database
	start := time.Now()
	_, err = sqlDB.Exec("BEGIN IMMEDIATE; ROLLBACK;")
	lockTime := time.Since(start)
	health["lock_time_ms"] = lockTime.Milliseconds()
	health["locked"] = err != nil

	// Get stats
	stats, err := pm.GetDatabaseStats()
	if err == nil {
		health["stats"] = stats
	}

	return health
}

// LogPerformanceReport logs a comprehensive performance report
func (pm *PerformanceMonitor) LogPerformanceReport() {
	log.Println("=== Database Performance Report ===")

	stats, err := pm.GetDatabaseStats()
	if err != nil {
		log.Printf("Error getting stats: %v", err)
		return
	}

	log.Printf("WAL Mode: %v", stats.WALMode)
	log.Printf("Cache Size: %d pages (%.2f MB)", stats.CacheSize, float64(stats.CacheSize*stats.PageSize)/(1024*1024))
	log.Printf("Page Size: %d bytes", stats.PageSize)
	log.Printf("Busy Timeout: %d ms", stats.BusyTimeout)
	log.Printf("Database Size: %.2f MB", float64(stats.DatabaseSize)/(1024*1024))
	if stats.WALSize > 0 {
		log.Printf("WAL Size: %.2f MB", float64(stats.WALSize)/(1024*1024))
	}
	log.Printf("Connections - Open: %d, Idle: %d, In Use: %d",
		stats.ConnectionsOpen, stats.ConnectionsIdle, stats.ConnectionsInUse)
	log.Printf("Average Query Time: %v", stats.QueryTime)

	// Run benchmarks
	log.Println("\n=== Query Benchmarks ===")
	benchmarks := pm.BenchmarkQueries()
	for query, duration := range benchmarks {
		log.Printf("%s: %v", query, duration)
	}

	// Health check
	log.Println("\n=== Health Check ===")
	health := pm.CheckDatabaseHealth()
	for key, value := range health {
		if key != "stats" {
			log.Printf("%s: %v", key, value)
		}
	}
}
