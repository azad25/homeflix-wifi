package api

import (
	"net/http"

	"homeflix-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type WatcherHandler struct {
	watcherService *services.WatcherService
}

func NewWatcherHandler(watcherService *services.WatcherService) *WatcherHandler {
	return &WatcherHandler{
		watcherService: watcherService,
	}
}

// StartWatcher starts the file watcher
func (h *WatcherHandler) StartWatcher(c *gin.Context) {
	if err := h.watcherService.Start(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to start file watcher",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "File watcher started successfully",
		"status": "running",
	})
}

// StopWatcher stops the file watcher
func (h *WatcherHandler) StopWatcher(c *gin.Context) {
	h.watcherService.Stop()

	c.JSON(http.StatusOK, gin.H{
		"message": "File watcher stopped successfully",
		"status": "stopped",
	})
}

// GetWatcherStatus returns the current status of the file watcher
func (h *WatcherHandler) GetWatcherStatus(c *gin.Context) {
	isRunning := h.watcherService.IsRunning()
	
	status := "stopped"
	if isRunning {
		status = "running"
	}

	c.JSON(http.StatusOK, gin.H{
		"status": status,
		"is_running": isRunning,
	})
}

// TriggerManualScan triggers a manual full scan
func (h *WatcherHandler) TriggerManualScan(c *gin.Context) {
	if err := h.watcherService.TriggerManualScan(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to trigger manual scan",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Manual scan triggered successfully",
	})
}

// TriggerIncrementalScan triggers an incremental scan
func (h *WatcherHandler) TriggerIncrementalScan(c *gin.Context) {
	if err := h.watcherService.TriggerIncrementalScan(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to trigger incremental scan",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Incremental scan triggered successfully",
	})
}
