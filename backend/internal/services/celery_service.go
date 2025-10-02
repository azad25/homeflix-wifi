package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/go-redis/redis/v8"
)

type CeleryService struct {
	redisClient *redis.Client
	ctx         context.Context
}

type CeleryTask struct {
	ID      string                 `json:"id"`
	Task    string                 `json:"task"`
	Args    []interface{}          `json:"args"`
	Kwargs  map[string]interface{} `json:"kwargs"`
	Retries int                    `json:"retries"`
	ETA     *time.Time             `json:"eta,omitempty"`
}

type CeleryMessage struct {
	Body            string                 `json:"body"`
	ContentType     string                 `json:"content-type"`
	ContentEncoding string                 `json:"content-encoding"`
	Headers         map[string]interface{} `json:"headers"`
	Properties      CeleryProperties       `json:"properties"`
}

type CeleryProperties struct {
	CorrelationID string `json:"correlation_id"`
	ReplyTo       string `json:"reply_to"`
	DeliveryMode  int    `json:"delivery_mode"`
	DeliveryTag   string `json:"delivery_tag"`
	DeliveryInfo  string `json:"delivery_info"`
}

func NewCeleryService() *CeleryService {
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis://redis:6379/0"
	}

	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		log.Printf("Failed to parse Redis URL: %v", err)
		// Fallback to default configuration using Docker service name
		opt = &redis.Options{
			Addr: "redis:6379",
			DB:   0,
		}
	}

	client := redis.NewClient(opt)
	ctx := context.Background()

	// Test connection
	_, err = client.Ping(ctx).Result()
	if err != nil {
		log.Printf("Failed to connect to Redis: %v", err)
	} else {
		log.Printf("✅ Connected to Redis for Celery tasks")
	}

	return &CeleryService{
		redisClient: client,
		ctx:         ctx,
	}
}

func (c *CeleryService) QueueTask(taskName string, args []interface{}, kwargs map[string]interface{}, queue string) error {
	// Generate unique task ID using UUID format
	taskID := fmt.Sprintf("%s-%d", taskName, time.Now().UnixNano())

	// Ensure kwargs is never nil - Celery requires it to be an empty object if no kwargs
	if kwargs == nil {
		kwargs = make(map[string]interface{})
	}

	// Create Celery task in the format expected by Python Celery
	task := map[string]interface{}{
		"id":      taskID,
		"task":    taskName,
		"args":    args,
		"kwargs":  kwargs,
		"retries": 0,
		"eta":     nil,
		"expires": nil,
		"utc":     true,
	}

	// Serialize task to JSON
	taskBody, err := json.Marshal(task)
	if err != nil {
		return fmt.Errorf("failed to marshal task: %v", err)
	}

	// Create message in Celery protocol format
	message := map[string]interface{}{
		"body":             string(taskBody),
		"content-type":     "application/json",
		"content-encoding": "utf-8",
		"headers": map[string]interface{}{
			"lang":      "go",
			"task":      taskName,
			"id":        taskID,
			"retries":   0,
			"timelimit": []interface{}{nil, nil},
		},
		"properties": map[string]interface{}{
			"correlation_id": taskID,
			"reply_to":       "",
			"delivery_mode":  2,
			"delivery_tag":   taskID,
			"delivery_info": map[string]interface{}{
				"exchange":    "",
				"routing_key": queue,
			},
		},
	}

	// Serialize message
	messageBody, err := json.Marshal(message)
	if err != nil {
		return fmt.Errorf("failed to marshal message: %v", err)
	}

	// Push to Redis queue
	queueKey := queue
	err = c.redisClient.LPush(c.ctx, queueKey, messageBody).Err()
	if err != nil {
		return fmt.Errorf("failed to push task to queue %s: %v", queue, err)
	}

	log.Printf("🚀 Queued Celery task: %s -> %s (ID: %s)", taskName, queue, taskID)
	return nil
}

func (c *CeleryService) QueueMediaProcessing(mediaID uint, filePath, title, mediaType string) error {
	args := []interface{}{
		map[string]interface{}{
			"media_id":  mediaID,
			"file_path": filePath,
			"title":     title,
			"type":      mediaType,
		},
	}

	return c.QueueTask("tasks.scanning_tasks.process_new_media", args, nil, "scanning")
}

func (c *CeleryService) QueueMetadataGeneration(mediaID uint, filePath, title string) error {
	args := []interface{}{mediaID, filePath, title}
	return c.QueueTask("tasks.metadata_tasks.generate_metadata", args, nil, "metadata")
}

func (c *CeleryService) QueueThumbnailGeneration(mediaID uint, filePath string) error {
	args := []interface{}{mediaID, filePath}
	return c.QueueTask("tasks.thumbnail_tasks.generate_thumbnail", args, nil, "thumbnails")
}

func (c *CeleryService) QueuePreviewGeneration(mediaID uint, filePath string) error {
	args := []interface{}{mediaID, filePath}
	return c.QueueTask("tasks.thumbnail_tasks.generate_preview_clip", args, nil, "thumbnails")
}

func (c *CeleryService) QueuePosterDownload(mediaID uint, title string, year int, mediaType string) error {
	args := []interface{}{mediaID, title, year, mediaType}
	return c.QueueTask("tasks.poster_tasks.download_poster", args, nil, "posters")
}

func (c *CeleryService) QueueVideoAnalysis(mediaID uint, filePath string) error {
	args := []interface{}{mediaID, filePath}
	return c.QueueTask("tasks.video_tasks.analyze_video_metadata", args, nil, "video_processing")
}

func (c *CeleryService) QueueSubtitleExtraction(mediaID uint, filePath string) error {
	args := []interface{}{mediaID, filePath}
	return c.QueueTask("tasks.subtitle_tasks.extract_embedded_subtitles", args, nil, "subtitles")
}

func (c *CeleryService) QueueBatchProcessing(mediaList []map[string]interface{}) error {
	args := []interface{}{mediaList}
	return c.QueueTask("tasks.scanning_tasks.batch_process_media_library", args, nil, "scanning")
}

func (c *CeleryService) GetQueueLength(queue string) (int64, error) {
	return c.redisClient.LLen(c.ctx, queue).Result()
}

func (c *CeleryService) GetAllQueueLengths() (map[string]int64, error) {
	queues := []string{"metadata", "thumbnails", "posters", "video_processing", "subtitles", "scanning"}
	lengths := make(map[string]int64)

	for _, queue := range queues {
		length, err := c.GetQueueLength(queue)
		if err != nil {
			log.Printf("Failed to get length for queue %s: %v", queue, err)
			lengths[queue] = -1
		} else {
			lengths[queue] = length
		}
	}

	return lengths, nil
}

func (c *CeleryService) PurgeQueue(queue string) error {
	return c.redisClient.Del(c.ctx, queue).Err()
}

func (c *CeleryService) Close() error {
	return c.redisClient.Close()
}
