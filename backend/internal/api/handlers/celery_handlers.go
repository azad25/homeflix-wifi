package handlers

import (
	"net/http"
	"strconv"

	"homeflix-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type CeleryHandlers struct {
	celeryService *services.CeleryService
}

func NewCeleryHandlers(celeryService *services.CeleryService) *CeleryHandlers {
	return &CeleryHandlers{
		celeryService: celeryService,
	}
}

// QueueMediaProcessing queues comprehensive media processing
func (h *CeleryHandlers) QueueMediaProcessing(c *gin.Context) {
	var request struct {
		MediaID   uint   `json:"media_id" binding:"required"`
		FilePath  string `json:"file_path" binding:"required"`
		Title     string `json:"title" binding:"required"`
		MediaType string `json:"media_type"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if request.MediaType == "" {
		request.MediaType = "movie"
	}

	err := h.celeryService.QueueMediaProcessing(request.MediaID, request.FilePath, request.Title, request.MediaType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":     "queued",
		"media_id":   request.MediaID,
		"title":      request.Title,
		"media_type": request.MediaType,
	})
}

// QueueMetadataGeneration queues AI metadata generation
func (h *CeleryHandlers) QueueMetadataGeneration(c *gin.Context) {
	var request struct {
		MediaID  uint   `json:"media_id" binding:"required"`
		FilePath string `json:"file_path" binding:"required"`
		Title    string `json:"title" binding:"required"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := h.celeryService.QueueMetadataGeneration(request.MediaID, request.FilePath, request.Title)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":   "queued",
		"media_id": request.MediaID,
		"queue":    "metadata",
	})
}

// QueueThumbnailGeneration queues thumbnail generation
func (h *CeleryHandlers) QueueThumbnailGeneration(c *gin.Context) {
	var request struct {
		MediaID  uint   `json:"media_id" binding:"required"`
		FilePath string `json:"file_path" binding:"required"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := h.celeryService.QueueThumbnailGeneration(request.MediaID, request.FilePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":   "queued",
		"media_id": request.MediaID,
		"queue":    "thumbnails",
	})
}

// QueuePosterDownload queues poster download
func (h *CeleryHandlers) QueuePosterDownload(c *gin.Context) {
	var request struct {
		MediaID   uint   `json:"media_id" binding:"required"`
		Title     string `json:"title" binding:"required"`
		Year      int    `json:"year"`
		MediaType string `json:"media_type"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if request.MediaType == "" {
		request.MediaType = "movie"
	}

	err := h.celeryService.QueuePosterDownload(request.MediaID, request.Title, request.Year, request.MediaType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":   "queued",
		"media_id": request.MediaID,
		"queue":    "posters",
	})
}

// QueueBatchProcessing queues batch media processing
func (h *CeleryHandlers) QueueBatchProcessing(c *gin.Context) {
	var request struct {
		MediaList []map[string]interface{} `json:"media_list" binding:"required"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := h.celeryService.QueueBatchProcessing(request.MediaList)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":     "queued",
		"item_count": len(request.MediaList),
		"queue":      "scanning",
	})
}

// GetQueueStatus returns status of all queues
func (h *CeleryHandlers) GetQueueStatus(c *gin.Context) {
	lengths, err := h.celeryService.GetAllQueueLengths()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"queue_lengths": lengths,
		"queues": map[string]string{
			"metadata":         "AI metadata generation (High Priority)",
			"thumbnails":       "Thumbnail & preview generation (High Priority)",
			"posters":          "Poster downloads (Medium Priority)",
			"video_processing": "Video analysis & optimization (Medium Priority)",
			"subtitles":        "Subtitle extraction (Low Priority)",
			"scanning":         "Media scanning & orchestration (Low Priority)",
		},
	})
}

// GetQueueLength returns length of specific queue
func (h *CeleryHandlers) GetQueueLength(c *gin.Context) {
	queue := c.Param("queue")
	if queue == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "queue parameter required"})
		return
	}

	length, err := h.celeryService.GetQueueLength(queue)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"queue":  queue,
		"length": length,
	})
}

// PurgeQueue purges specific queue
func (h *CeleryHandlers) PurgeQueue(c *gin.Context) {
	queue := c.Param("queue")
	if queue == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "queue parameter required"})
		return
	}

	err := h.celeryService.PurgeQueue(queue)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "purged",
		"queue":  queue,
	})
}

// ReprocessMedia triggers reprocessing of specific media
func (h *CeleryHandlers) ReprocessMedia(c *gin.Context) {
	mediaIDStr := c.Param("id")
	mediaID, err := strconv.ParseUint(mediaIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid media ID"})
		return
	}

	var request struct {
		FilePath         string   `json:"file_path" binding:"required"`
		Title            string   `json:"title" binding:"required"`
		MediaType        string   `json:"media_type"`
		Tasks            []string `json:"tasks"` // Optional: specific tasks to run
		ForceRegenerate  bool     `json:"force_regenerate"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if request.MediaType == "" {
		request.MediaType = "movie"
	}

	// If no specific tasks requested, queue comprehensive processing
	if len(request.Tasks) == 0 || request.ForceRegenerate {
		err := h.celeryService.QueueMediaProcessing(uint(mediaID), request.FilePath, request.Title, request.MediaType)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"status":           "queued",
			"media_id":         mediaID,
			"processing_type":  "comprehensive",
			"force_regenerate": request.ForceRegenerate,
		})
		return
	}

	// Queue specific tasks
	queuedTasks := []string{}
	for _, task := range request.Tasks {
		var err error
		switch task {
		case "metadata":
			err = h.celeryService.QueueMetadataGeneration(uint(mediaID), request.FilePath, request.Title)
		case "thumbnails":
			err = h.celeryService.QueueThumbnailGeneration(uint(mediaID), request.FilePath)
		case "previews":
			err = h.celeryService.QueuePreviewGeneration(uint(mediaID), request.FilePath)
		case "posters":
			err = h.celeryService.QueuePosterDownload(uint(mediaID), request.Title, 0, request.MediaType)
		case "video_analysis":
			err = h.celeryService.QueueVideoAnalysis(uint(mediaID), request.FilePath)
		case "subtitles":
			err = h.celeryService.QueueSubtitleExtraction(uint(mediaID), request.FilePath)
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported task: " + task})
			return
		}

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "failed to queue task " + task + ": " + err.Error(),
			})
			return
		}

		queuedTasks = append(queuedTasks, task)
	}

	c.JSON(http.StatusOK, gin.H{
		"status":       "queued",
		"media_id":     mediaID,
		"queued_tasks": queuedTasks,
	})
}
