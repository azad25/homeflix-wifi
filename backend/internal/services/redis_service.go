package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
	"homeflix-backend/internal/models"
)

type RedisService struct {
	client *redis.Client
	ctx    context.Context
}

func NewRedisService() *RedisService {
	// Connect to Redis container using service name
	rdb := redis.NewClient(&redis.Options{
		Addr:     "redis:6379", // Using Docker service name and default Redis port
		Password: "",          // no password
		DB:       1,           // use DB 1 for caching (DB 0 is for Celery)
	})

	ctx := context.Background()

	// Test connection
	_, err := rdb.Ping(ctx).Result()
	if err != nil {
		log.Printf("Redis connection failed: %v", err)
		return nil
	}

	log.Printf("Redis cache service connected successfully")
	return &RedisService{
		client: rdb,
		ctx:    ctx,
	}
}

// Cache keys
const (
	MediaCachePrefix         = "media:"
	MediaListCachePrefix     = "media_list:"
	RecommendationCachePrefix = "recommendations:"
	ThumbnailCachePrefix     = "thumbnail:"
	CacheTTL                 = 30 * time.Minute
	ListCacheTTL             = 10 * time.Minute
)

// Media caching
func (r *RedisService) CacheMedia(media *models.Media) error {
	if r.client == nil {
		return nil // Skip if Redis not available
	}

	key := fmt.Sprintf("%s%s", MediaCachePrefix, media.UUID)
	data, err := json.Marshal(media)
	if err != nil {
		return err
	}

	return r.client.Set(r.ctx, key, data, CacheTTL).Err()
}

func (r *RedisService) GetCachedMedia(uuid string) (*models.Media, error) {
	if r.client == nil {
		return nil, fmt.Errorf("redis not available")
	}

	key := fmt.Sprintf("%s%s", MediaCachePrefix, uuid)
	data, err := r.client.Get(r.ctx, key).Result()
	if err != nil {
		return nil, err
	}

	var media models.Media
	err = json.Unmarshal([]byte(data), &media)
	if err != nil {
		return nil, err
	}

	return &media, nil
}

// Media list caching
func (r *RedisService) CacheMediaList(key string, mediaList []models.Media) error {
	if r.client == nil {
		return nil
	}

	cacheKey := fmt.Sprintf("%s%s", MediaListCachePrefix, key)
	data, err := json.Marshal(mediaList)
	if err != nil {
		return err
	}

	return r.client.Set(r.ctx, cacheKey, data, ListCacheTTL).Err()
}

func (r *RedisService) GetCachedMediaList(key string) ([]models.Media, error) {
	if r.client == nil {
		return nil, fmt.Errorf("redis not available")
	}

	cacheKey := fmt.Sprintf("%s%s", MediaListCachePrefix, key)
	data, err := r.client.Get(r.ctx, cacheKey).Result()
	if err != nil {
		return nil, err
	}

	var mediaList []models.Media
	err = json.Unmarshal([]byte(data), &mediaList)
	if err != nil {
		return nil, err
	}

	return mediaList, nil
}

// Recommendations caching
func (r *RedisService) CacheRecommendations(userID uint, category string, recommendations []models.Media) error {
	if r.client == nil {
		return nil
	}

	key := fmt.Sprintf("%s%d_%s", RecommendationCachePrefix, userID, category)
	data, err := json.Marshal(recommendations)
	if err != nil {
		return err
	}

	return r.client.Set(r.ctx, key, data, ListCacheTTL).Err()
}

func (r *RedisService) GetCachedRecommendations(userID uint, category string) ([]models.Media, error) {
	if r.client == nil {
		return nil, fmt.Errorf("redis not available")
	}

	key := fmt.Sprintf("%s%d_%s", RecommendationCachePrefix, userID, category)
	data, err := r.client.Get(r.ctx, key).Result()
	if err != nil {
		return nil, err
	}

	var recommendations []models.Media
	err = json.Unmarshal([]byte(data), &recommendations)
	if err != nil {
		return nil, err
	}

	return recommendations, nil
}

// Cache invalidation
func (r *RedisService) InvalidateMediaCache(uuid string) error {
	if r.client == nil {
		return nil
	}

	key := fmt.Sprintf("%s%s", MediaCachePrefix, uuid)
	return r.client.Del(r.ctx, key).Err()
}

func (r *RedisService) InvalidateAllMediaListCache() error {
	if r.client == nil {
		return nil
	}

	pattern := fmt.Sprintf("%s*", MediaListCachePrefix)
	keys, err := r.client.Keys(r.ctx, pattern).Result()
	if err != nil {
		return err
	}

	if len(keys) > 0 {
		return r.client.Del(r.ctx, keys...).Err()
	}

	return nil
}

func (r *RedisService) InvalidateRecommendationCache(userID uint) error {
	if r.client == nil {
		return nil
	}

	pattern := fmt.Sprintf("%s%d_*", RecommendationCachePrefix, userID)
	keys, err := r.client.Keys(r.ctx, pattern).Result()
	if err != nil {
		return err
	}

	if len(keys) > 0 {
		return r.client.Del(r.ctx, keys...).Err()
	}

	return nil
}

// Health check
func (r *RedisService) Ping() error {
	if r.client == nil {
		return fmt.Errorf("redis client not initialized")
	}

	return r.client.Ping(r.ctx).Err()
}
