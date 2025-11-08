package handlers

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"homeflix-backend/internal/models"
	"homeflix-backend/internal/torrent"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type TorrentHandler struct {
	db     *gorm.DB
	client *torrent.TorrentClient
	searcher *torrent.TorrentSearcher
}

// MediaScannerInterface defines the interface for triggering media scans
type MediaScannerInterface interface {
	ScanMediaLibrary() error
	SetMediaPaths(paths []string)
}

func NewTorrentHandler(db *gorm.DB, mediaScanner MediaScannerInterface) *TorrentHandler {
	// Get or create default config
	var config models.TorrentConfig
	if err := db.First(&config).Error; err != nil {
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
			// High-performance defaults for fast downloads
			MaxPeerConnections: 500,
			MaxPeerAccepts:     200,
			PortRangeStart:     50000,
			PortRangeEnd:       50100,
			MaxOpenFiles:       1024,
		}
		db.Create(&config)
	}

	// Initialize torrent client with performance configuration
	performanceConfig := map[string]int{
		"max_peer_connections": config.MaxPeerConnections,
		"max_peer_accepts":     config.MaxPeerAccepts,
		"port_range_start":     config.PortRangeStart,
		"port_range_end":       config.PortRangeEnd,
		"max_open_files":       config.MaxOpenFiles,
	}
	
	client, err := torrent.NewTorrentClient(config.DownloadPath, mediaScanner, performanceConfig)
	if err != nil {
		panic(fmt.Sprintf("Failed to initialize torrent client: %v", err))
	}

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

	return &TorrentHandler{
		db:       db,
		client:   client,
		searcher: searcher,
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
	var req struct {
		MagnetURI string `json:"magnet_uri" binding:"required"`
		TMDBId    int    `json:"tmdb_id"`
		MediaType string `json:"media_type"`
		Title     string `json:"title"`
		Quality   string `json:"quality"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Start download
	downloadInfo, err := h.client.AddMagnet(req.MagnetURI)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save download info"})
		return
	}

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
		query = query.Where("name ILIKE ? OR quality ILIKE ? OR media_type ILIKE ?", 
			"%"+searchQuery+"%", "%"+searchQuery+"%", "%"+searchQuery+"%")
	}
	
	if statusFilter != "" {
		query = query.Where("status = ?", statusFilter)
	}

	// Get total count with filters
	var totalCount int64
	if err := query.Count(&totalCount).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count downloads"})
		return
	}

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

	// Remove files if save path exists
	if savePath != "" {
		if err := os.RemoveAll(savePath); err != nil {
			log.Printf("⚠️ Failed to remove torrent files at %s: %v", savePath, err)
			// Don't fail the request if file deletion fails, just log it
		} else {
			log.Printf("🗑️ Successfully removed torrent files: %s", savePath)
		}
	}

	// Always remove from database (this is the most important cleanup)
	if err := h.db.Where("torrent_id = ?", id).Delete(&models.TorrentDownload{}).Error; err != nil {
		log.Printf("⚠️ Failed to remove torrent from database: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove from database"})
		return
	}

	log.Printf("✅ Successfully cleaned up torrent: %s", torrentDownload.Name)

	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Download and files removed successfully"),
		"removed_path": savePath,
	})
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

	// Update config
	config.JackettURL = req.JackettURL
	config.JackettAPIKey = req.JackettAPIKey
	config.DownloadPath = req.DownloadPath
	config.MinSeeders = req.MinSeeders
	config.MaxDownloads = req.MaxDownloads
	config.AutoDownload = req.AutoDownload
	config.PreferredQuality = req.PreferredQuality

	if err := h.db.Save(&config).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update config"})
		return
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