package handlers

import (
	"net/http"
	"strconv"

	"homeflix-backend/internal/services"

	"github.com/gin-gonic/gin"
)

// NotificationHandlers contains handlers for notification endpoints
type NotificationHandlers struct {
	notificationService *services.NotificationService
}

// NewNotificationHandlers creates a new notification handlers instance
func NewNotificationHandlers(notificationService *services.NotificationService) *NotificationHandlers {
	return &NotificationHandlers{
		notificationService: notificationService,
	}
}

// GetNotifications retrieves the latest notifications
func (h *NotificationHandlers) GetNotifications(c *gin.Context) {
	// Get limit from query parameter (default 50)
	limitStr := c.DefaultQuery("limit", "50")
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		limit = 50
	}

	notifications, err := h.notificationService.GetNotifications(limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to fetch notifications",
		})
		return
	}

	// Add aggressive caching headers for fast page loads
	// Cache for 30 seconds on client, revalidate after
	c.Header("Cache-Control", "public, max-age=30, stale-while-revalidate=60")
	c.Header("ETag", strconv.FormatInt(int64(len(notifications)), 10))

	c.JSON(http.StatusOK, gin.H{
		"notifications": notifications,
		"count":         len(notifications),
	})
}

// GetNotificationCount returns the total count of notifications
func (h *NotificationHandlers) GetNotificationCount(c *gin.Context) {
	count, err := h.notificationService.GetNotificationCount()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get notification count",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"count": count,
	})
}

// MarkNotificationAsRead marks a notification as read
func (h *NotificationHandlers) MarkNotificationAsRead(c *gin.Context) {
	notificationID := c.Param("id")

	if err := h.notificationService.MarkAsRead(notificationID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to mark notification as read",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Notification marked as read",
	})
}

// Standalone handler functions for backward compatibility

// GetNotifications returns a handler function for getting notifications
func GetNotifications(notificationService *services.NotificationService) gin.HandlerFunc {
	h := NewNotificationHandlers(notificationService)
	return h.GetNotifications
}

// GetNotificationCount returns a handler function for getting notification count
func GetNotificationCount(notificationService *services.NotificationService) gin.HandlerFunc {
	h := NewNotificationHandlers(notificationService)
	return h.GetNotificationCount
}

// MarkNotificationAsRead returns a handler function for marking notification as read
func MarkNotificationAsRead(notificationService *services.NotificationService) gin.HandlerFunc {
	h := NewNotificationHandlers(notificationService)
	return h.MarkNotificationAsRead
}
