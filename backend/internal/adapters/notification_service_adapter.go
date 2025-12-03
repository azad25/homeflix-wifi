package adapters

import (
	"homeflix-backend/internal/services"
)

// NotificationServiceAdapter adapts the NotificationService to the scanner's NotificationServiceInterface
type NotificationServiceAdapter struct {
	notificationService *services.NotificationService
}

// NewNotificationServiceAdapter creates a new notification service adapter
func NewNotificationServiceAdapter(notificationService *services.NotificationService) *NotificationServiceAdapter {
	if notificationService == nil {
		return &NotificationServiceAdapter{
			notificationService: nil,
		}
	}
	
	return &NotificationServiceAdapter{
		notificationService: notificationService,
	}
}

// CreateNewMoviesNotification sends a notification about newly added movies
func (a *NotificationServiceAdapter) CreateNewMoviesNotification(movieIDs []uint, count int) error {
	if a.notificationService == nil {
		// Silently skip if notification service is not available
		return nil
	}
	
	return a.notificationService.CreateNewMoviesNotification(movieIDs, count)
}

// CreateNewEpisodesNotification sends a notification about newly added TV episodes
func (a *NotificationServiceAdapter) CreateNewEpisodesNotification(seriesID uint, seriesName string, episodeIDs []uint, episodeCount int) error {
	if a.notificationService == nil {
		// Silently skip if notification service is not available
		return nil
	}
	
	return a.notificationService.CreateNewEpisodesNotification(seriesID, seriesName, episodeIDs, episodeCount)
}

// CreateDownloadCompleteNotification sends a notification when a download completes
func (a *NotificationServiceAdapter) CreateDownloadCompleteNotification(title string, mediaID uint) error {
	if a.notificationService == nil {
		// Silently skip if notification service is not available
		return nil
	}
	
	return a.notificationService.CreateDownloadCompleteNotification(title, mediaID)
}
