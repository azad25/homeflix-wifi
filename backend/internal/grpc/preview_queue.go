package grpc

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"
)

// PreviewGenerationTask represents a preview generation task
type PreviewGenerationTask struct {
	TaskID    string    `json:"task_id"`
	MediaUUID string    `json:"media_uuid"`
	MediaPath string    `json:"media_path"`
	Priority  string    `json:"priority"` // "high", "normal", "low"
	CreatedAt time.Time `json:"created_at"`
	Status    string    `json:"status"` // "queued", "processing", "completed", "failed"
	Error     string    `json:"error,omitempty"`
}

// PreviewQueue manages preview generation tasks
type PreviewQueue struct {
	tasks       []PreviewGenerationTask
	processing  map[string]bool
	mutex       sync.RWMutex
	workers     int
	workersChan chan struct{}
	isRunning   bool
}

// Global preview queue instance
var previewQueue *PreviewQueue
var queueOnce sync.Once

// GetPreviewQueue returns the singleton preview queue
func GetPreviewQueue() *PreviewQueue {
	queueOnce.Do(func() {
		previewQueue = &PreviewQueue{
			tasks:       make([]PreviewGenerationTask, 0),
			processing:  make(map[string]bool),
			workers:     3, // 3 concurrent preview generation workers
			workersChan: make(chan struct{}, 3),
			isRunning:   false,
		}
	})
	return previewQueue
}

// Add methods to StreamingServiceServer for queue management
func (s *StreamingServiceServer) isPreviewInQueue(mediaUUID string) bool {
	queue := GetPreviewQueue()
	queue.mutex.RLock()
	defer queue.mutex.RUnlock()

	// Check if already in queue or processing
	for _, task := range queue.tasks {
		if task.MediaUUID == mediaUUID && (task.Status == "queued" || task.Status == "processing") {
			return true
		}
	}

	return queue.processing[mediaUUID]
}

func (s *StreamingServiceServer) addToPreviewQueue(task PreviewGenerationTask) error {
	queue := GetPreviewQueue()
	queue.mutex.Lock()
	defer queue.mutex.Unlock()

	// Set initial status
	task.Status = "queued"

	// Add to queue with priority ordering
	if task.Priority == "high" {
		// Insert at beginning for high priority
		queue.tasks = append([]PreviewGenerationTask{task}, queue.tasks...)
	} else {
		// Append for normal/low priority
		queue.tasks = append(queue.tasks, task)
	}

	log.Printf("Added preview generation task to queue: %s (priority: %s)", task.TaskID, task.Priority)
	return nil
}

func (s *StreamingServiceServer) processPreviewQueue() {
	queue := GetPreviewQueue()
	
	// Prevent multiple queue processors
	queue.mutex.Lock()
	if queue.isRunning {
		queue.mutex.Unlock()
		return
	}
	queue.isRunning = true
	queue.mutex.Unlock()

	log.Println("Starting preview generation queue processor...")

	// Start worker goroutines
	for i := 0; i < queue.workers; i++ {
		go s.previewWorker(i)
	}

	// Keep the processor running
	for {
		queue.mutex.RLock()
		hasWork := len(queue.tasks) > 0
		queue.mutex.RUnlock()

		if !hasWork {
			time.Sleep(5 * time.Second) // Check every 5 seconds
			continue
		}

		// Get next task
		task := s.getNextTask()
		if task == nil {
			time.Sleep(1 * time.Second)
			continue
		}

		// Send to worker
		select {
		case queue.workersChan <- struct{}{}:
			go s.processPreviewTask(*task)
		default:
			// All workers busy, wait a bit
			time.Sleep(1 * time.Second)
		}
	}
}

func (s *StreamingServiceServer) getNextTask() *PreviewGenerationTask {
	queue := GetPreviewQueue()
	queue.mutex.Lock()
	defer queue.mutex.Unlock()

	for i, task := range queue.tasks {
		if task.Status == "queued" && !queue.processing[task.MediaUUID] {
			// Mark as processing
			queue.tasks[i].Status = "processing"
			queue.processing[task.MediaUUID] = true
			return &queue.tasks[i]
		}
	}

	return nil
}

func (s *StreamingServiceServer) previewWorker(workerID int) {
	log.Printf("Preview worker %d started", workerID)
	
	for range GetPreviewQueue().workersChan {
		// Worker is available, will be assigned task by processPreviewQueue
	}
}

func (s *StreamingServiceServer) processPreviewTask(task PreviewGenerationTask) {
	defer func() {
		// Release worker
		<-GetPreviewQueue().workersChan
		
		// Remove from processing
		queue := GetPreviewQueue()
		queue.mutex.Lock()
		delete(queue.processing, task.MediaUUID)
		queue.mutex.Unlock()
	}()

	log.Printf("Processing preview generation task: %s for media: %s", task.TaskID, task.MediaUUID)

	// Generate preview clip
	err := s.generatePreviewClip(task)
	
	// Update task status
	s.updateTaskStatus(task.TaskID, err)

	if err != nil {
		log.Printf("Preview generation failed for %s: %v", task.MediaUUID, err)
	} else {
		log.Printf("Preview generation completed for %s", task.MediaUUID)
		
		// Update media record with new preview path
		s.updateMediaPreviewPath(task.MediaUUID, s.getPreviewPath(task.MediaUUID))
	}
}

func (s *StreamingServiceServer) generatePreviewClip(task PreviewGenerationTask) error {
	// Check if source media file exists
	if _, err := os.Stat(task.MediaPath); os.IsNotExist(err) {
		return fmt.Errorf("source media file not found: %s", task.MediaPath)
	}

	// Create output directory
	outputDir := filepath.Join("assets", "previews")
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return fmt.Errorf("failed to create output directory: %v", err)
	}

	// Generate output path
	outputPath := s.getPreviewPath(task.MediaUUID)

	// Use FFmpeg to generate preview clip
	// Extract 10-second clip starting from 10% of the video duration
	cmd := exec.Command("ffmpeg",
		"-i", task.MediaPath,
		"-ss", "00:00:30", // Start at 30 seconds (or 10% of duration)
		"-t", "00:00:10",  // 10 second duration
		"-vf", "scale=640:360", // Resize to 640x360 for fast loading
		"-c:v", "libx264",
		"-preset", "fast",
		"-crf", "28", // Good quality/size balance
		"-an", // No audio for preview clips
		"-y", // Overwrite existing file
		outputPath,
	)

	// Set timeout for FFmpeg operation
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	cmd = exec.CommandContext(ctx, cmd.Args[0], cmd.Args[1:]...)

	// Execute FFmpeg command
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("ffmpeg failed: %v, output: %s", err, string(output))
	}

	// Verify output file was created
	if _, err := os.Stat(outputPath); os.IsNotExist(err) {
		return fmt.Errorf("preview clip was not generated: %s", outputPath)
	}

	log.Printf("Preview clip generated successfully: %s", outputPath)
	return nil
}

func (s *StreamingServiceServer) getPreviewPath(mediaUUID string) string {
	return filepath.Join("assets", "previews", fmt.Sprintf("preview_%s.mp4", mediaUUID))
}

func (s *StreamingServiceServer) updateTaskStatus(taskID string, err error) {
	queue := GetPreviewQueue()
	queue.mutex.Lock()
	defer queue.mutex.Unlock()

	for i, task := range queue.tasks {
		if task.TaskID == taskID {
			if err != nil {
				queue.tasks[i].Status = "failed"
				queue.tasks[i].Error = err.Error()
			} else {
				queue.tasks[i].Status = "completed"
			}
			break
		}
	}
}

func (s *StreamingServiceServer) updateMediaPreviewPath(mediaUUID, previewPath string) {
	// Update the media record with the new preview path
	// This would call your media service to update the database
	if s.mediaService != nil {
		err := s.mediaService.UpdatePreviewPath(mediaUUID, previewPath)
		if err != nil {
			log.Printf("Failed to update media preview path for %s: %v", mediaUUID, err)
		}
	}
}

// GetQueueStatus returns the current queue status
func (s *StreamingServiceServer) GetQueueStatus() map[string]interface{} {
	queue := GetPreviewQueue()
	queue.mutex.RLock()
	defer queue.mutex.RUnlock()

	queuedCount := 0
	processingCount := 0
	completedCount := 0
	failedCount := 0

	for _, task := range queue.tasks {
		switch task.Status {
		case "queued":
			queuedCount++
		case "processing":
			processingCount++
		case "completed":
			completedCount++
		case "failed":
			failedCount++
		}
	}

	return map[string]interface{}{
		"total_tasks":      len(queue.tasks),
		"queued":          queuedCount,
		"processing":      processingCount,
		"completed":       completedCount,
		"failed":          failedCount,
		"workers":         queue.workers,
		"is_running":      queue.isRunning,
	}
}

// CleanupCompletedTasks removes old completed/failed tasks
func (s *StreamingServiceServer) CleanupCompletedTasks() {
	queue := GetPreviewQueue()
	queue.mutex.Lock()
	defer queue.mutex.Unlock()

	cutoff := time.Now().Add(-24 * time.Hour) // Keep tasks for 24 hours
	newTasks := make([]PreviewGenerationTask, 0)

	for _, task := range queue.tasks {
		if (task.Status == "completed" || task.Status == "failed") && task.CreatedAt.Before(cutoff) {
			continue // Skip old completed/failed tasks
		}
		newTasks = append(newTasks, task)
	}

	queue.tasks = newTasks
	log.Printf("Cleaned up old preview generation tasks, remaining: %d", len(queue.tasks))
}