package handlers

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"homeflix-backend/internal/models"
	"homeflix-backend/internal/torrent"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type TorrentHandler struct {
	db                  *gorm.DB
	client              *torrent.TorrentClient
	searcher            *torrent.TorrentSearcher
	notificationService NotificationServiceInterface
}

// MediaScannerInterface defines the interface for triggering media scans
type MediaScannerInterface interface {
	ScanMediaLibrary() error
	SetMediaPaths(paths []string)
}

// NotificationServiceInterface defines the interface for sending notifications
type NotificationServiceInterface interface {
	CreateDownloadCompleteNotification(title string, mediaID uint) error
}

func NewTorrentHandler(db *gorm.DB, mediaScanner MediaScannerInterface, notificationService NotificationServiceInterface) *TorrentHandler {
	log.Printf("🔧 Initializing TorrentHandler...")
	
	// Get or create default config
	var config models.TorrentConfig
	if err := db.First(&config).Error; err != nil {
		log.Printf("⚠️ No torrent config found, creating default: %v", err)
		// Create default config with proper torrent download path
		homeDir, _ := os.UserHomeDir()
		config = models.TorrentConfig{
			DownloadPath:       filepath.Join(homeDir, "Downloads", "homeflix"),
			MinSeeders:         10,
			MaxDownloads:       5,
			AutoDownload:       false,
			PreferredQuality:   "1080p",
			EnabledSources:     "1337x,YTS,TPB,RARBG",
			UseProxy:           false,
			ProxyURL:           "",
			// High-performance defaults for fast downloads with expanded port range
			MaxPeerConnections: 500,
			MaxPeerAccepts:     200,
			PortRangeStart:     50000,
			PortRangeEnd:       51000, // Expanded from 50100 to 51000 (1000 ports)
			MaxOpenFiles:       1024,
		}
		db.Create(&config)
	} else {
		// Update existing config to expand port range if needed
		if config.PortRangeEnd <= 50100 {
			log.Printf("🔧 Expanding port range from %d-%d to 50000-51000", config.PortRangeStart, config.PortRangeEnd)
			config.PortRangeStart = 50000
			config.PortRangeEnd = 51000
			db.Save(&config)
		}
	}

	// Initialize torrent client with performance configuration
	performanceConfig := map[string]int{
		"max_peer_connections": config.MaxPeerConnections,
		"max_peer_accepts":     config.MaxPeerAccepts,
		"port_range_start":     config.PortRangeStart,
		"port_range_end":       config.PortRangeEnd,
		"max_open_files":       config.MaxOpenFiles,
		"max_downloads":        config.MaxDownloads,
	}
	
	// Create a pointer to hold the notification service that will be set after handler creation
	var notificationServicePtr *NotificationServiceInterface
	
	// Create status callback to immediately persist status changes to database
	// This is CRITICAL to prevent re-downloading completed torrents on server restart
	statusCallback := func(torrentID string, status string, progress float64, size int64, downloaded int64, completedAt *time.Time) {
		// First, check the previous status before updating
		var prevRecord models.TorrentDownload
		wasCompleted := false
		if err := db.Where("torrent_id = ?", torrentID).First(&prevRecord).Error; err == nil {
			wasCompleted = prevRecord.Status == "completed"
		}
		
		updates := map[string]interface{}{
			"status":     status,
			"progress":   progress,
			"size":       size,
			"downloaded": downloaded,
		}
		if completedAt != nil {
			updates["completed_at"] = completedAt
		}
		
		if err := db.Model(&models.TorrentDownload{}).
			Where("torrent_id = ?", torrentID).
			Updates(updates).Error; err != nil {
			log.Printf("⚠️ Failed to persist torrent status to database: %v", err)
		} else {
			log.Printf("💾 Status persisted to DB: %s -> %s (%.1f%%)", torrentID[:8], status, progress)
		}
		
		// If status just changed to completed, send notification
		if status == "completed" && !wasCompleted && notificationServicePtr != nil && *notificationServicePtr != nil {
			go func(id string, name string) {
				defer func() {
					if r := recover(); r != nil {
						log.Printf("🚨 Recovered from panic sending download complete notification: %v", r)
					}
				}()
				
				// Try to find the media ID from database
				var media struct {
					ID uint
				}
				
				// Search for media file by name
				if err := db.Raw(`
					SELECT id 
					FROM media 
					WHERE file_path LIKE ? 
					ORDER BY created_at DESC 
					LIMIT 1
				`, "%"+name+"%").Scan(&media).Error; err == nil && media.ID != 0 {
					if err := (*notificationServicePtr).CreateDownloadCompleteNotification(name, media.ID); err != nil {
						log.Printf("⚠️ Failed to send download complete notification: %v", err)
					} else {
						log.Printf("📥 Sent download complete notification for: %s (ID: %d)", name, media.ID)
					}
				} else {
					// Send notification without media ID (media not scanned yet)
					if err := (*notificationServicePtr).CreateDownloadCompleteNotification(name, 0); err != nil {
						log.Printf("⚠️ Failed to send download complete notification: %v", err)
					} else {
						log.Printf("📥 Sent download complete notification for: %s (no media ID yet)", name)
					}
				}
			}(torrentID, prevRecord.Name)
		}
	}
	
	client, err := torrent.NewTorrentClient(config.DownloadPath, mediaScanner, statusCallback, performanceConfig)
	if err != nil {
		log.Printf("❌ CRITICAL: Failed to initialize torrent client: %v", err)
		panic(fmt.Sprintf("Failed to initialize torrent client: %v", err))
	}
	log.Printf("✅ Torrent client initialized successfully")

	// Restore incomplete downloads from database
	var incompleteDownloads []models.TorrentDownload
	db.Where("status IN ?", []string{"downloading", "paused"}).Find(&incompleteDownloads)
	
	for _, dbDownload := range incompleteDownloads {
		log.Printf("🔄 Restoring download: %s (Status: %s, Progress: %.1f%%)", 
			dbDownload.Name, dbDownload.Status, dbDownload.Progress)
		
		// Restore the download to the client
		if err := client.RestoreDownload(
			dbDownload.TorrentID,
			dbDownload.Name,
			dbDownload.MagnetURI,
			dbDownload.Status,
			dbDownload.SavePath,
			dbDownload.Progress,
			dbDownload.Size,
			dbDownload.Downloaded,
			dbDownload.AddedAt,
			dbDownload.CompletedAt,
		); err != nil {
			log.Printf("⚠️ Failed to restore download %s: %v", dbDownload.Name, err)
			// Mark as error in database
			db.Model(&dbDownload).Update("status", "error")
		}
	}

	// Initialize searcher
	searcher := torrent.NewTorrentSearcher("", "", config.MinSeeders)

	// Set the notification service pointer so the status callback can use it
	notificationServicePtr = &notificationService
	
	log.Printf("✅ TorrentHandler initialized successfully")
	return &TorrentHandler{
		db:                  db,
		client:              client,
		searcher:            searcher,
		notificationService: notificationService,
	}
}

// Search torrents for a movie/TV show
func (h *TorrentHandler) SearchTorrents(c *gin.Context) {
	mediaType := c.Query("type") // movie or tv
	title := c.Query("title")
	season := c.Query("season")
	episode := c.Query("episode")
	quality := c.Query("quality")

	if title == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Title is required"})
		return
	}

	// Get current config to use latest Jackett settings
	var config models.TorrentConfig
	if err := h.db.First(&config).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get config"})
		return
	}

	// Create searcher with current config
	searcher := torrent.NewTorrentSearcher(config.JackettURL, config.JackettAPIKey, config.MinSeeders)

	var results []torrent.SearchResult
	var err error

	if mediaType == "tv" {
		seasonNum, _ := strconv.Atoi(season)
		episodeNum, _ := strconv.Atoi(episode)
		results, err = searcher.SearchTVShow(title, seasonNum, episodeNum, quality)
	} else {
		// For movies, don't use year to improve search results
		// Many torrent sites have inconsistent year handling
		results, err = searcher.SearchMovie(title, 0, quality)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"results": results,
		"count":   len(results),
	})
}

// Start downloading a torrent
func (h *TorrentHandler) StartDownload(c *gin.Context) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("❌ PANIC in StartDownload: %v", r)
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Internal server error: %v", r)})
		}
	}()
	
	log.Printf("🔥 StartDownload called")
	
	if h == nil {
		log.Printf("❌ TorrentHandler is nil!")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Torrent handler not initialized"})
		return
	}
	
	if h.client == nil {
		log.Printf("❌ Torrent client is nil!")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Torrent client not initialized"})
		return
	}
	
	if h.db == nil {
		log.Printf("❌ Database is nil!")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database not initialized"})
		return
	}
	
	var req struct {
		MagnetURI string `json:"magnet_uri" binding:"required"`
		TMDBId    int    `json:"tmdb_id"`
		MediaType string `json:"media_type"`
		Title     string `json:"title"`
		Quality   string `json:"quality"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("❌ JSON binding error: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	log.Printf("📥 Download request: Title=%s, Type=%s, Quality=%s", req.Title, req.MediaType, req.Quality)

	// Start download
	downloadInfo, err := h.client.AddMagnet(req.MagnetURI)
	if err != nil {
		log.Printf("❌ Failed to add magnet: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	log.Printf("✅ Magnet added successfully: %s", downloadInfo.ID)

	// Save to database
	torrentDownload := models.TorrentDownload{
		TorrentID: downloadInfo.ID,
		Name:      req.Title,
		MagnetURI: req.MagnetURI,
		Status:    downloadInfo.Status,
		Progress:  downloadInfo.Progress,
		Size:      downloadInfo.Size,
		Downloaded: downloadInfo.Downloaded,
		SavePath:  downloadInfo.SavePath,
		MediaType: req.MediaType,
		TMDBId:    req.TMDBId,
		Quality:   req.Quality,
	}

	if err := h.db.Create(&torrentDownload).Error; err != nil {
		log.Printf("❌ Failed to save to database: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save download info"})
		return
	}
	
	log.Printf("✅ Download saved to database successfully")
	c.JSON(http.StatusOK, downloadInfo)
}

// Get all downloads with pagination and search
func (h *TorrentHandler) GetDownloads(c *gin.Context) {
	// Parse pagination parameters
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	
	// Parse search parameters
	searchQuery := c.Query("search")
	statusFilter := c.Query("status")
	
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 10
	}
	
	offset := (page - 1) * limit

	// Get current stats from client first
	clientDownloads := h.client.GetDownloads()
	
	// Update database with latest client stats
	for _, clientDownload := range clientDownloads {
		var completedAt *time.Time
		if clientDownload.CompletedAt != nil {
			completedAt = clientDownload.CompletedAt
		}
		
		// Get current database record to check if status changed
		var dbRecord models.TorrentDownload
		if err := h.db.Where("torrent_id = ?", clientDownload.ID).First(&dbRecord).Error; err == nil {
			// Check if download just completed
			if dbRecord.Status != "completed" && clientDownload.Status == "completed" {
				// Download just completed! Send notification
				if h.notificationService != nil {
					go func(name string, savePath string) {
						defer func() {
							if r := recover(); r != nil {
								log.Printf("🚨 Recovered from panic sending download complete notification: %v", r)
							}
						}()
						
						// Try to find the media ID from database
						// The scanner should have already scanned it
						var media struct {
							ID uint
						}
						
						// Search for media file by path
						if err := h.db.Raw(`
							SELECT id 
							FROM media 
							WHERE file_path LIKE ? 
							ORDER BY created_at DESC 
							LIMIT 1
						`, "%"+name+"%").Scan(&media).Error; err == nil && media.ID != 0 {
							// Send notification with media ID
							if err := h.notificationService.CreateDownloadCompleteNotification(name, media.ID); err != nil {
								log.Printf("⚠️ Failed to send download complete notification: %v", err)
							} else {
								log.Printf("📥 Sent download complete notification for: %s (ID: %d)", name, media.ID)
							}
						} else {
							// Send notification without media ID (media not scanned yet)
							if err := h.notificationService.CreateDownloadCompleteNotification(name, 0); err != nil {
								log.Printf("⚠️ Failed to send download complete notification: %v", err)
							} else {
								log.Printf("📥 Sent download complete notification for: %s (no media ID yet)", name)
							}
						}
					}(clientDownload.Name, clientDownload.SavePath)
				}
				log.Printf("✅ Download completed: %s", clientDownload.Name)
			}
		}
		
		h.db.Model(&models.TorrentDownload{}).
			Where("torrent_id = ?", clientDownload.ID).
			Updates(map[string]interface{}{
				"status":       clientDownload.Status,
				"progress":     clientDownload.Progress,
				"downloaded":   clientDownload.Downloaded,
				"size":         clientDownload.Size,
				"save_path":    clientDownload.SavePath,
				"completed_at": completedAt,
			})
	}

	// Build query with search conditions
	query := h.db.Model(&models.TorrentDownload{})
	
	// Apply search filters
	if searchQuery != "" {
		log.Printf("🔍 Applying search filter: '%s'", searchQuery)
		query = query.Where("name ILIKE ? OR quality ILIKE ? OR media_type ILIKE ?", 
			"%"+searchQuery+"%", "%"+searchQuery+"%", "%"+searchQuery+"%")
	}
	
	if statusFilter != "" {
		log.Printf("🔍 Applying status filter: '%s'", statusFilter)
		query = query.Where("status = ?", statusFilter)
	}

	// Get total count with filters
	var totalCount int64
	if err := query.Count(&totalCount).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count downloads"})
		return
	}
	
	log.Printf("📊 Total downloads after filters: %d (page %d, limit %d)", totalCount, page, limit)

	// Get paginated downloads from database (ordered by most recent first)
	var dbDownloads []models.TorrentDownload
	if err := query.Order("added_at DESC").Limit(limit).Offset(offset).Find(&dbDownloads).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch downloads"})
		return
	}

	// Convert database records to API format with real-time client data
	var apiDownloads []map[string]interface{}
	for _, dbDownload := range dbDownloads {
		// Get real-time stats from client
		clientDownload, exists := h.client.GetDownload(dbDownload.TorrentID)
		
		// Use client data if available, otherwise use database data
		var status string
		var progress float64
		var downloaded int64
		var size int64
		var savePath string
		var completedAt *time.Time
		
		if exists {
			status = clientDownload.Status
			progress = clientDownload.Progress
			downloaded = clientDownload.Downloaded
			size = clientDownload.Size
			savePath = clientDownload.SavePath
			completedAt = clientDownload.CompletedAt
		} else {
			status = dbDownload.Status
			progress = dbDownload.Progress
			downloaded = dbDownload.Downloaded
			size = dbDownload.Size
			savePath = dbDownload.SavePath
			completedAt = dbDownload.CompletedAt
		}
		
		apiDownload := map[string]interface{}{
			"id":           dbDownload.TorrentID,
			"torrent_id":   dbDownload.TorrentID, // Add this for compatibility
			"name":         dbDownload.Name,
			"magnet_uri":   dbDownload.MagnetURI,
			"status":       status,
			"progress":     progress,
			"size":         size,
			"downloaded":   downloaded,
			"save_path":    savePath,
			"media_type":   dbDownload.MediaType,
			"tmdb_id":      dbDownload.TMDBId,
			"quality":      dbDownload.Quality,
			"added_at":     dbDownload.AddedAt,
			"completed_at": completedAt,
		}

		// Add real-time stats from client if available
		if exists {
			apiDownload["download_rate"] = clientDownload.DownloadRate
			apiDownload["upload_rate"] = clientDownload.UploadRate
			apiDownload["seeders"] = clientDownload.Seeders
			apiDownload["peers"] = clientDownload.Peers
			apiDownload["eta"] = clientDownload.ETA
		} else {
			// Default values if client doesn't have the download
			apiDownload["download_rate"] = 0
			apiDownload["upload_rate"] = 0
			apiDownload["seeders"] = 0
			apiDownload["peers"] = 0
			apiDownload["eta"] = "Unknown"
		}

		apiDownloads = append(apiDownloads, apiDownload)
	}

	// Calculate pagination info
	totalPages := int((totalCount + int64(limit) - 1) / int64(limit))
	
	c.JSON(http.StatusOK, gin.H{
		"downloads": apiDownloads,
		"pagination": gin.H{
			"current_page": page,
			"total_pages":  totalPages,
			"total_count":  totalCount,
			"limit":        limit,
			"has_next":     page < totalPages,
			"has_prev":     page > 1,
		},
	})
}

// Get specific download
func (h *TorrentHandler) GetDownload(c *gin.Context) {
	id := c.Param("id")
	
	download, exists := h.client.GetDownload(id)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Download not found"})
		return
	}

	c.JSON(http.StatusOK, download)
}

// Pause download
func (h *TorrentHandler) PauseDownload(c *gin.Context) {
	id := c.Param("id")
	
	if err := h.client.PauseDownload(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Get updated download info to save current progress
	if download, exists := h.client.GetDownload(id); exists {
		// Update database with current progress and paused status
		h.db.Model(&models.TorrentDownload{}).
			Where("torrent_id = ?", id).
			Updates(map[string]interface{}{
				"status":     "paused",
				"progress":   download.Progress,
				"downloaded": download.Downloaded,
				"size":       download.Size,
			})
	} else {
		// Fallback to just updating status
		h.db.Model(&models.TorrentDownload{}).
			Where("torrent_id = ?", id).
			Update("status", "paused")
	}

	c.JSON(http.StatusOK, gin.H{"message": "Download paused"})
}

// Resume download
func (h *TorrentHandler) ResumeDownload(c *gin.Context) {
	id := c.Param("id")
	
	if err := h.client.ResumeDownload(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Get updated download info after resuming
	if download, exists := h.client.GetDownload(id); exists {
		// Update database with resumed status and current progress
		h.db.Model(&models.TorrentDownload{}).
			Where("torrent_id = ?", id).
			Updates(map[string]interface{}{
				"status":     "downloading",
				"progress":   download.Progress,
				"downloaded": download.Downloaded,
				"size":       download.Size,
			})
	} else {
		// Fallback to just updating status
		h.db.Model(&models.TorrentDownload{}).
			Where("torrent_id = ?", id).
			Update("status", "downloading")
	}

	c.JSON(http.StatusOK, gin.H{"message": "Download resumed"})
}

// Remove download
func (h *TorrentHandler) RemoveDownload(c *gin.Context) {
	id := c.Param("id")
	
	// Get download info from database first to get file paths
	var torrentDownload models.TorrentDownload
	if err := h.db.Where("torrent_id = ?", id).First(&torrentDownload).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Download not found in database"})
		return
	}

	// Get download info from client to get current save path
	clientDownload, exists := h.client.GetDownload(id)
	var savePath string
	if exists && clientDownload.SavePath != "" {
		savePath = clientDownload.SavePath
	} else {
		savePath = torrentDownload.SavePath
	}

	// Try to remove from torrent client (don't fail if this doesn't work)
	if err := h.client.RemoveDownload(id); err != nil {
		log.Printf("⚠️ Failed to remove torrent from client (may already be removed): %v", err)
		// Continue with cleanup even if client removal fails
	} else {
		log.Printf("✅ Successfully removed torrent from client: %s", id)
	}

	// Safely remove only the specific torrent files, not the entire directory
	var removedFiles []string
	if savePath != "" {
		removedFiles = h.removeSpecificTorrentFiles(savePath, torrentDownload.Name)
	}

	// Always remove from database (this is the most important cleanup)
	if err := h.db.Where("torrent_id = ?", id).Delete(&models.TorrentDownload{}).Error; err != nil {
		log.Printf("⚠️ Failed to remove torrent from database: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove from database"})
		return
	}

	log.Printf("✅ Successfully cleaned up torrent: %s", torrentDownload.Name)

	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Download removed successfully"),
		"removed_files": removedFiles,
		"torrent_name": torrentDownload.Name,
	})
}

// removeSpecificTorrentFiles safely removes only the files belonging to this specific torrent
// ULTRA-SAFE: This function will NEVER delete other torrents' files
func (h *TorrentHandler) removeSpecificTorrentFiles(savePath, torrentName string) []string {
	var removedFiles []string
	
	// Check if the save path exists
	if _, err := os.Stat(savePath); os.IsNotExist(err) {
		log.Printf("📁 Save path does not exist: %s", savePath)
		return removedFiles
	}

	// Get all other active torrents to ensure we don't delete their files
	otherTorrents := h.getAllOtherTorrentPaths(torrentName)
	log.Printf("🛡️ Found %d other active torrents to protect", len(otherTorrents))

	// Get the parent directory and the torrent folder name
	parentDir := filepath.Dir(savePath)
	torrentFolder := filepath.Base(savePath)
	
	log.Printf("🔍 Analyzing torrent files - Parent: %s, Folder: %s, Torrent: %s", parentDir, torrentFolder, torrentName)

	// Strategy 1: If savePath is a specific folder for this torrent, check if it's safe to remove entirely
	if h.isSpecificTorrentFolder(savePath, torrentName) {
		// Triple-check this is safe and doesn't contain other torrents
		if h.isSafeToDelete(savePath) && !h.containsOtherTorrents(savePath, otherTorrents) {
			if err := os.RemoveAll(savePath); err != nil {
				log.Printf("⚠️ Failed to remove torrent folder %s: %v", savePath, err)
			} else {
				log.Printf("🗑️ Successfully removed torrent folder: %s", savePath)
				removedFiles = append(removedFiles, savePath)
			}
		} else {
			log.Printf("🛡️ Refusing to delete folder - contains other torrents or unsafe: %s", savePath)
			// Fall back to individual file deletion
			removedFiles = h.removeIndividualTorrentFiles(savePath, torrentName, otherTorrents)
		}
		return removedFiles
	}

	// Strategy 2: Individual file removal with strict safety checks
	removedFiles = h.removeIndividualTorrentFiles(savePath, torrentName, otherTorrents)
	return removedFiles
}

// getAllOtherTorrentPaths gets paths of all other active torrents to protect them
func (h *TorrentHandler) getAllOtherTorrentPaths(excludeTorrentName string) []string {
	var otherPaths []string
	
	// Get all torrents from database except the one being deleted
	var otherTorrents []models.TorrentDownload
	h.db.Where("name != ?", excludeTorrentName).Find(&otherTorrents)
	
	for _, torrent := range otherTorrents {
		if torrent.SavePath != "" {
			otherPaths = append(otherPaths, torrent.SavePath)
		}
	}
	
	// Also get paths from active client downloads
	clientDownloads := h.client.GetDownloads()
	for _, download := range clientDownloads {
		if download.Name != excludeTorrentName && download.SavePath != "" {
			otherPaths = append(otherPaths, download.SavePath)
		}
	}
	
	return otherPaths
}

// isSpecificTorrentFolder checks if the path is a dedicated folder for this torrent
func (h *TorrentHandler) isSpecificTorrentFolder(savePath, torrentName string) bool {
	torrentFolder := filepath.Base(savePath)
	
	// Clean names for comparison
	cleanFolder := h.cleanNameForComparison(torrentFolder)
	cleanTorrent := h.cleanNameForComparison(torrentName)
	
	// Check if folder name strongly matches torrent name
	similarity := h.calculateNameSimilarity(cleanFolder, cleanTorrent)
	
	log.Printf("🔍 Folder similarity check: '%s' vs '%s' = %.2f", cleanFolder, cleanTorrent, similarity)
	
	// Require high similarity (80%+) to consider it a dedicated folder
	return similarity >= 0.8
}

// containsOtherTorrents checks if the path contains files from other torrents
func (h *TorrentHandler) containsOtherTorrents(targetPath string, otherTorrentPaths []string) bool {
	for _, otherPath := range otherTorrentPaths {
		// Check if other torrent path is inside or same as target path
		if strings.HasPrefix(otherPath, targetPath) || otherPath == targetPath {
			log.Printf("🛡️ Found other torrent in path: %s contains %s", targetPath, otherPath)
			return true
		}
		
		// Check if target path is inside other torrent path
		if strings.HasPrefix(targetPath, otherPath) {
			log.Printf("🛡️ Target path is inside other torrent: %s inside %s", targetPath, otherPath)
			return true
		}
	}
	return false
}

// removeIndividualTorrentFiles removes only files that specifically belong to this torrent
func (h *TorrentHandler) removeIndividualTorrentFiles(savePath, torrentName string, otherTorrentPaths []string) []string {
	var removedFiles []string
	
	log.Printf("🔍 Scanning for individual files belonging to: %s", torrentName)
	
	err := filepath.Walk(savePath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // Continue on errors
		}

		// Skip directories
		if info.IsDir() {
			return nil
		}

		// Skip if this file might belong to another torrent
		if h.isFileProtectedByOtherTorrent(path, otherTorrentPaths) {
			log.Printf("🛡️ Skipping protected file: %s", path)
			return nil
		}

		// Check if this file belongs to our torrent with strict matching
		fileName := filepath.Base(path)
		if h.isFileFromTorrentStrict(fileName, torrentName) {
			// Double-check file is not critical or system file
			if h.isSafeFileToDelete(path) {
				if err := os.Remove(path); err != nil {
					log.Printf("⚠️ Failed to remove file %s: %v", path, err)
				} else {
					log.Printf("🗑️ Removed torrent file: %s", path)
					removedFiles = append(removedFiles, path)
				}
			} else {
				log.Printf("🛡️ Skipping unsafe file: %s", path)
			}
		} else {
			log.Printf("🔍 File doesn't match torrent, skipping: %s", fileName)
		}

		return nil
	})

	if err != nil {
		log.Printf("⚠️ Error walking directory %s: %v", savePath, err)
	}

	return removedFiles
}

// isFileProtectedByOtherTorrent checks if a file might belong to another active torrent
func (h *TorrentHandler) isFileProtectedByOtherTorrent(filePath string, otherTorrentPaths []string) bool {
	for _, otherPath := range otherTorrentPaths {
		// If file is in another torrent's directory, protect it
		if strings.HasPrefix(filePath, otherPath) {
			return true
		}
	}
	return false
}

// isFileFromTorrentStrict uses stricter matching to ensure file belongs to specific torrent
func (h *TorrentHandler) isFileFromTorrentStrict(fileName, torrentName string) bool {
	// Clean names for comparison
	cleanFileName := h.cleanNameForComparison(fileName)
	cleanTorrentName := h.cleanNameForComparison(torrentName)
	
	// Calculate similarity
	similarity := h.calculateNameSimilarity(cleanFileName, cleanTorrentName)
	
	log.Printf("🔍 File similarity check: '%s' vs '%s' = %.2f", cleanFileName, cleanTorrentName, similarity)
	
	// Require very high similarity (90%+) for strict matching
	return similarity >= 0.9
}

// cleanNameForComparison cleans a name for accurate comparison
func (h *TorrentHandler) cleanNameForComparison(name string) string {
	// Convert to lowercase
	clean := strings.ToLower(name)
	
	// Replace common separators with spaces
	clean = strings.ReplaceAll(clean, ".", " ")
	clean = strings.ReplaceAll(clean, "_", " ")
	clean = strings.ReplaceAll(clean, "-", " ")
	clean = strings.ReplaceAll(clean, "[", " ")
	clean = strings.ReplaceAll(clean, "]", " ")
	clean = strings.ReplaceAll(clean, "(", " ")
	clean = strings.ReplaceAll(clean, ")", " ")
	
	// Remove common video/torrent suffixes
	suffixes := []string{
		"1080p", "720p", "480p", "4k", "2160p", "uhd",
		"bluray", "bdrip", "webrip", "web-dl", "hdtv", "dvdrip",
		"x264", "x265", "h264", "h265", "hevc", "xvid",
		"aac", "ac3", "dts", "mp3", "flac",
		"mkv", "mp4", "avi", "mov", "wmv", "m4v",
		"yify", "rarbg", "eztv", "ettv", "yts",
		"proper", "repack", "extended", "unrated", "directors", "cut",
	}
	
	for _, suffix := range suffixes {
		clean = strings.ReplaceAll(clean, " "+suffix+" ", " ")
		clean = strings.ReplaceAll(clean, " "+suffix, "")
	}
	
	// Remove extra spaces and trim
	clean = strings.Join(strings.Fields(clean), " ")
	clean = strings.TrimSpace(clean)
	
	return clean
}

// calculateNameSimilarity calculates similarity between two cleaned names
func (h *TorrentHandler) calculateNameSimilarity(name1, name2 string) float64 {
	if name1 == name2 {
		return 1.0
	}
	
	if name1 == "" || name2 == "" {
		return 0.0
	}
	
	// Split into words
	words1 := strings.Fields(name1)
	words2 := strings.Fields(name2)
	
	if len(words1) == 0 || len(words2) == 0 {
		return 0.0
	}
	
	// Count matching words
	matchingWords := 0
	totalWords := len(words1)
	
	for _, word1 := range words1 {
		if len(word1) < 3 { // Skip very short words
			continue
		}
		
		for _, word2 := range words2 {
			if len(word2) < 3 {
				continue
			}
			
			// Check for exact match or substring match for longer words
			if word1 == word2 || 
			   (len(word1) > 4 && strings.Contains(word1, word2)) || 
			   (len(word2) > 4 && strings.Contains(word2, word1)) {
				matchingWords++
				break
			}
		}
	}
	
	if totalWords == 0 {
		return 0.0
	}
	
	return float64(matchingWords) / float64(totalWords)
}

// isSafeFileToDelete checks if an individual file is safe to delete
func (h *TorrentHandler) isSafeFileToDelete(filePath string) bool {
	fileName := strings.ToLower(filepath.Base(filePath))
	
	// Never delete system or important files
	dangerousFiles := []string{
		"desktop.ini", "thumbs.db", ".ds_store",
		"autorun.inf", "boot.ini", "config.sys",
		"system.ini", "win.ini", "msdos.sys",
		"io.sys", "pagefile.sys", "hiberfil.sys",
	}
	
	for _, dangerous := range dangerousFiles {
		if fileName == dangerous {
			log.Printf("🛡️ Refusing to delete system file: %s", fileName)
			return false
		}
	}
	
	// Only delete media files and related files
	safeExtensions := []string{
		".mkv", ".mp4", ".avi", ".mov", ".wmv", ".m4v", ".flv", ".webm",
		".srt", ".vtt", ".ass", ".ssa", ".sub", ".idx",
		".nfo", ".txt", ".jpg", ".jpeg", ".png", ".bmp",
	}
	
	ext := strings.ToLower(filepath.Ext(fileName))
	for _, safeExt := range safeExtensions {
		if ext == safeExt {
			return true
		}
	}
	
	log.Printf("🛡️ Refusing to delete file with unknown extension: %s", fileName)
	return false
}

// isSafeToDelete checks if a path is safe to delete entirely
func (h *TorrentHandler) isSafeToDelete(path string) bool {
	// Convert to absolute path
	absPath, err := filepath.Abs(path)
	if err != nil {
		log.Printf("⚠️ Could not get absolute path for %s: %v", path, err)
		return false
	}

	// List of paths that should NEVER be deleted
	unsafePaths := []string{
		"/",
		"/home",
		"/usr",
		"/var",
		"/etc",
		"/bin",
		"/sbin",
		"/lib",
		"/opt",
		"/root",
		"/boot",
		"/dev",
		"/proc",
		"/sys",
		"/tmp",
		"/mnt",
		"/media",
		"C:\\",
		"C:\\Windows",
		"C:\\Program Files",
		"C:\\Users",
		"C:\\System32",
	}

	// Check against unsafe paths
	for _, unsafePath := range unsafePaths {
		if absPath == unsafePath || strings.HasPrefix(absPath, unsafePath+string(filepath.Separator)) {
			log.Printf("🛡️ Blocked deletion of system path: %s", absPath)
			return false
		}
	}

	// Must be at least 3 levels deep to be considered safe
	// e.g., /home/user/downloads/movie is safe, but /home/user is not
	pathParts := strings.Split(strings.Trim(absPath, string(filepath.Separator)), string(filepath.Separator))
	if len(pathParts) < 3 {
		log.Printf("🛡️ Path too shallow, refusing to delete: %s (parts: %d)", absPath, len(pathParts))
		return false
	}

	// Check if it's in a downloads or torrents directory (safer)
	pathLower := strings.ToLower(absPath)
	safeKeywords := []string{"download", "torrent", "temp", "tmp"}
	for _, keyword := range safeKeywords {
		if strings.Contains(pathLower, keyword) {
			log.Printf("✅ Path contains safe keyword '%s': %s", keyword, absPath)
			return true
		}
	}

	// If no safe keywords found, be more cautious
	log.Printf("⚠️ Path doesn't contain safe keywords, being cautious: %s", absPath)
	return false
}

// isFileFromTorrent checks if a file likely belongs to the torrent (legacy function - use isFileFromTorrentStrict for new code)
func (h *TorrentHandler) isFileFromTorrent(fileName, torrentName string) bool {
	// Use the new strict matching for better safety
	return h.isFileFromTorrentStrict(fileName, torrentName)
}

// Get torrent configuration
func (h *TorrentHandler) GetConfig(c *gin.Context) {
	var config models.TorrentConfig
	if err := h.db.First(&config).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Config not found"})
		return
	}

	c.JSON(http.StatusOK, config)
}

// Update torrent configuration
func (h *TorrentHandler) UpdateConfig(c *gin.Context) {
	var req models.TorrentConfig
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var config models.TorrentConfig
	if err := h.db.First(&config).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Config not found"})
		return
	}

	// Update all config fields
	config.JackettURL = req.JackettURL
	config.JackettAPIKey = req.JackettAPIKey
	config.DownloadPath = req.DownloadPath
	config.MinSeeders = req.MinSeeders
	config.MaxDownloads = req.MaxDownloads
	config.AutoDownload = req.AutoDownload
	config.PreferredQuality = req.PreferredQuality
	config.EnabledSources = req.EnabledSources
	config.UseProxy = req.UseProxy
	config.ProxyURL = req.ProxyURL
	
	// Update performance settings
	config.MaxPeerConnections = req.MaxPeerConnections
	config.MaxPeerAccepts = req.MaxPeerAccepts
	config.PortRangeStart = req.PortRangeStart
	config.PortRangeEnd = req.PortRangeEnd
	config.MaxOpenFiles = req.MaxOpenFiles
	
	// Update speed limit settings
	config.DownloadSpeedLimit = req.DownloadSpeedLimit
	config.UploadSpeedLimit = req.UploadSpeedLimit

	if err := h.db.Save(&config).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update config"})
		return
	}

	// Apply speed limits to the torrent client
	// Convert KB/s to bytes/s for the client
	downloadLimitBytes := config.DownloadSpeedLimit * 1024
	uploadLimitBytes := config.UploadSpeedLimit * 1024
	
	if h.client != nil {
		h.client.SetSpeedLimits(downloadLimitBytes, uploadLimitBytes)
		h.client.SetDownloadLimits(config.MaxDownloads)
		log.Printf("⚡ Applied speed limits to torrent client - Download: %d KB/s, Upload: %d KB/s", 
			config.DownloadSpeedLimit, config.UploadSpeedLimit)
		log.Printf("📊 Applied download limits - Max concurrent: %d", config.MaxDownloads)
	}

	c.JSON(http.StatusOK, config)
}



// Test Jackett connection
func (h *TorrentHandler) TestConnection(c *gin.Context) {
	// Get current config
	var config models.TorrentConfig
	if err := h.db.First(&config).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Config not found"})
		return
	}

	// Check if Jackett URL and API key are configured
	if config.JackettURL == "" || config.JackettAPIKey == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Jackett URL and API key must be configured",
			"success": false,
		})
		return
	}

	// Test the connection using the searcher
	searcher := torrent.NewTorrentSearcher(config.JackettURL, config.JackettAPIKey, config.MinSeeders)
	
	// Try a simple test search (without year for better compatibility)
	results, err := searcher.SearchMovie("test", 0, "")
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": fmt.Sprintf("Jackett connection failed: %v", err),
			"success": false,
		})
		return
	}

	// Connection successful
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Jackett connection successful",
		"jackett_url": config.JackettURL,
		"indexers_found": len(results), // This might not be accurate but gives an idea
		"test_results": len(results),
	})
}

// Get bandwidth statistics
func (h *TorrentHandler) GetBandwidthStats(c *gin.Context) {
	if h.client == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Torrent client not available"})
		return
	}

	stats := h.client.GetBandwidthStats()
	limits := h.client.GetDownloadLimits()
	
	// Combine bandwidth and download limit stats
	combinedStats := make(map[string]interface{})
	for k, v := range stats {
		combinedStats[k] = v
	}
	for k, v := range limits {
		combinedStats[k] = v
	}
	
	c.JSON(http.StatusOK, combinedStats)
}