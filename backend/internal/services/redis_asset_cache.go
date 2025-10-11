package services

import (
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/go-redis/redis/v8"
)

// RedisAssetCache provides high-performance Redis-based asset caching
type RedisAssetCache struct {
	client    *redis.Client
	ctx       context.Context
	keyPrefix string
	ttl       time.Duration
}

// AssetMetadata contains metadata about cached assets
type AssetMetadata struct {
	ContentType string    `json:"content_type"`
	Size        int64     `json:"size"`
	ModTime     time.Time `json:"mod_time"`
	Path        string    `json:"path"`
}

// NewRedisAssetCache creates a new Redis asset cache instance
func NewRedisAssetCache(redisURL string) (*RedisAssetCache, error) {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse Redis URL: %w", err)
	}

	client := redis.NewClient(opts)
	ctx := context.Background()

	// Test connection
	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	log.Printf("✅ Redis Asset Cache connected successfully")

	return &RedisAssetCache{
		client:    client,
		ctx:       ctx,
		keyPrefix: "homeflix:assets:",
		ttl:       4 * time.Hour, // 4 hour TTL for assets
	}, nil
}

// GetAsset retrieves an asset from Redis cache
func (r *RedisAssetCache) GetAsset(mediaID uint, assetType string) ([]byte, *AssetMetadata, error) {
	key := r.getAssetKey(mediaID, assetType)
	metaKey := r.getMetadataKey(mediaID, assetType)

	// Get asset data and metadata in pipeline for efficiency
	pipe := r.client.Pipeline()
	assetCmd := pipe.Get(r.ctx, key)
	metaCmd := pipe.HGetAll(r.ctx, metaKey)
	
	_, err := pipe.Exec(r.ctx)
	if err != nil {
		return nil, nil, err
	}

	// Decode base64 asset data
	encodedData, err := assetCmd.Result()
	if err != nil {
		return nil, nil, err
	}

	assetData, err := base64.StdEncoding.DecodeString(encodedData)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to decode asset data: %w", err)
	}

	// Parse metadata
	metaData, err := metaCmd.Result()
	if err != nil {
		return assetData, nil, nil // Return data even if metadata fails
	}

	metadata := &AssetMetadata{
		ContentType: metaData["content_type"],
		Path:        metaData["path"],
	}

	if size, err := strconv.ParseInt(metaData["size"], 10, 64); err == nil {
		metadata.Size = size
	}

	if modTime, err := time.Parse(time.RFC3339, metaData["mod_time"]); err == nil {
		metadata.ModTime = modTime
	}

	return assetData, metadata, nil
}

// SetAsset stores an asset in Redis cache
func (r *RedisAssetCache) SetAsset(mediaID uint, assetType string, filePath string) error {
	// Read file data
	data, err := os.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("failed to read asset file: %w", err)
	}

	// Get file info
	fileInfo, err := os.Stat(filePath)
	if err != nil {
		return fmt.Errorf("failed to get file info: %w", err)
	}

	// Determine content type
	contentType := r.getContentType(assetType, filepath.Ext(filePath))

	// Encode data as base64 for Redis storage
	encodedData := base64.StdEncoding.EncodeToString(data)

	// Prepare keys
	key := r.getAssetKey(mediaID, assetType)
	metaKey := r.getMetadataKey(mediaID, assetType)

	// Store in pipeline for efficiency
	pipe := r.client.Pipeline()
	
	// Store asset data
	pipe.Set(r.ctx, key, encodedData, r.ttl)
	
	// Store metadata
	pipe.HMSet(r.ctx, metaKey, map[string]interface{}{
		"content_type": contentType,
		"size":         fileInfo.Size(),
		"mod_time":     fileInfo.ModTime().Format(time.RFC3339),
		"path":         filePath,
	})
	pipe.Expire(r.ctx, metaKey, r.ttl)

	_, err = pipe.Exec(r.ctx)
	if err != nil {
		return fmt.Errorf("failed to store asset in Redis: %w", err)
	}

	log.Printf("📦 Cached asset: media_id=%d, type=%s, size=%d bytes", mediaID, assetType, len(data))
	return nil
}

// GetAssetPath retrieves just the file path from cache (lightweight)
func (r *RedisAssetCache) GetAssetPath(mediaID uint, assetType string) (string, error) {
	metaKey := r.getMetadataKey(mediaID, assetType)
	
	path, err := r.client.HGet(r.ctx, metaKey, "path").Result()
	if err != nil {
		return "", err
	}

	return path, nil
}

// SetAssetPath stores just the file path (for path-only caching)
func (r *RedisAssetCache) SetAssetPath(mediaID uint, assetType string, filePath string) error {
	metaKey := r.getMetadataKey(mediaID, assetType)
	
	// Get file info for metadata
	fileInfo, err := os.Stat(filePath)
	if err != nil {
		return fmt.Errorf("failed to get file info: %w", err)
	}

	contentType := r.getContentType(assetType, filepath.Ext(filePath))

	err = r.client.HMSet(r.ctx, metaKey, map[string]interface{}{
		"content_type": contentType,
		"size":         fileInfo.Size(),
		"mod_time":     fileInfo.ModTime().Format(time.RFC3339),
		"path":         filePath,
	}).Err()

	if err != nil {
		return fmt.Errorf("failed to store asset path in Redis: %w", err)
	}

	// Set expiration
	r.client.Expire(r.ctx, metaKey, r.ttl)

	return nil
}

// InvalidateAsset removes an asset from cache
func (r *RedisAssetCache) InvalidateAsset(mediaID uint, assetType string) error {
	key := r.getAssetKey(mediaID, assetType)
	metaKey := r.getMetadataKey(mediaID, assetType)

	pipe := r.client.Pipeline()
	pipe.Del(r.ctx, key)
	pipe.Del(r.ctx, metaKey)
	
	_, err := pipe.Exec(r.ctx)
	return err
}

// WarmCache pre-loads assets for a media item
func (r *RedisAssetCache) WarmCache(mediaID uint, thumbnailPath, previewPath, posterPath string) error {
	var errors []string

	// Cache thumbnail
	if thumbnailPath != "" {
		if err := r.SetAsset(mediaID, "thumbnail", thumbnailPath); err != nil {
			errors = append(errors, fmt.Sprintf("thumbnail: %v", err))
		}
	}

	// Cache preview (path only due to size)
	if previewPath != "" {
		if err := r.SetAssetPath(mediaID, "preview", previewPath); err != nil {
			errors = append(errors, fmt.Sprintf("preview: %v", err))
		}
	}

	// Cache poster
	if posterPath != "" {
		if err := r.SetAsset(mediaID, "poster", posterPath); err != nil {
			errors = append(errors, fmt.Sprintf("poster: %v", err))
		}
	}

	if len(errors) > 0 {
		return fmt.Errorf("cache warming errors: %s", strings.Join(errors, ", "))
	}

	return nil
}

// GetCacheStats returns cache statistics
func (r *RedisAssetCache) GetCacheStats() (map[string]interface{}, error) {
	// Count keys by pattern
	thumbnailPattern := r.keyPrefix + "*:thumbnail"
	previewPattern := r.keyPrefix + "*:preview"
	posterPattern := r.keyPrefix + "*:poster"

	thumbnailKeys, err := r.client.Keys(r.ctx, thumbnailPattern).Result()
	if err != nil {
		return nil, err
	}

	previewKeys, err := r.client.Keys(r.ctx, previewPattern).Result()
	if err != nil {
		return nil, err
	}

	posterKeys, err := r.client.Keys(r.ctx, posterPattern).Result()
	if err != nil {
		return nil, err
	}

	// Get Redis info
	info, err := r.client.Info(r.ctx, "memory").Result()
	if err != nil {
		return nil, err
	}

	stats := map[string]interface{}{
		"cached_thumbnails": len(thumbnailKeys),
		"cached_previews":   len(previewKeys),
		"cached_posters":    len(posterKeys),
		"total_cached":      len(thumbnailKeys) + len(previewKeys) + len(posterKeys),
		"ttl_hours":         r.ttl.Hours(),
		"redis_info":        info,
	}

	return stats, nil
}

// ClearCache removes all cached assets
func (r *RedisAssetCache) ClearCache() error {
	pattern := r.keyPrefix + "*"
	keys, err := r.client.Keys(r.ctx, pattern).Result()
	if err != nil {
		return err
	}

	if len(keys) == 0 {
		return nil
	}

	return r.client.Del(r.ctx, keys...).Err()
}

// StreamAsset streams an asset directly from cache to writer
func (r *RedisAssetCache) StreamAsset(mediaID uint, assetType string, writer io.Writer) (*AssetMetadata, error) {
	data, metadata, err := r.GetAsset(mediaID, assetType)
	if err != nil {
		return nil, err
	}

	_, err = writer.Write(data)
	return metadata, err
}

// Helper methods

func (r *RedisAssetCache) getAssetKey(mediaID uint, assetType string) string {
	return fmt.Sprintf("%s%d:%s", r.keyPrefix, mediaID, assetType)
}

func (r *RedisAssetCache) getMetadataKey(mediaID uint, assetType string) string {
	return fmt.Sprintf("%s%d:%s:meta", r.keyPrefix, mediaID, assetType)
}

func (r *RedisAssetCache) getContentType(assetType, ext string) string {
	switch assetType {
	case "thumbnail", "poster":
		switch strings.ToLower(ext) {
		case ".jpg", ".jpeg":
			return "image/jpeg"
		case ".png":
			return "image/png"
		case ".webp":
			return "image/webp"
		default:
			return "image/jpeg"
		}
	case "preview":
		return "video/mp4"
	default:
		return "application/octet-stream"
	}
}

// Close closes the Redis connection
func (r *RedisAssetCache) Close() error {
	return r.client.Close()
}
