package config

import (
	"os"
	"strconv"
)

type Config struct {
	Port         string
	DatabaseURL  string
	MediaPath    string
	ThumbnailPath string
	LogLevel     string
	ChunkSize    int
	CacheEnabled bool
	CacheSize    int
	ScanInterval int // Scan interval in minutes
}

func Load() *Config {
	return &Config{
		Port:         getEnv("PORT", "8080"),
		DatabaseURL:  getEnv("DATABASE_URL", "./homeflix.db"),
		MediaPath:    getEnv("MEDIA_PATH", "/media/azad/Movies"),
		ThumbnailPath: getEnv("THUMBNAIL_PATH", "./thumbnails"),
		LogLevel:     getEnv("LOG_LEVEL", "info"),
		ChunkSize:    getEnvInt("CHUNK_SIZE", 1048576), // 1MB chunks
		CacheEnabled: getEnvBool("CACHE_ENABLED", true),
		CacheSize:    getEnvInt("CACHE_SIZE", 100),
		ScanInterval: getEnvInt("SCAN_INTERVAL_MINUTES", 30), // Default 30 minutes
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if boolValue, err := strconv.ParseBool(value); err == nil {
			return boolValue
		}
	}
	return defaultValue
}
