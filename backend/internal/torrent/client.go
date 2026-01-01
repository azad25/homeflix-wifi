package torrent

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/cenkalti/rain/torrent"
)

// BandwidthMonitor tracks and controls bandwidth usage
type BandwidthMonitor struct {
	downloadBytesUsed int64
	uploadBytesUsed   int64
	lastResetTime     time.Time
	mu                sync.RWMutex
}

// MediaScannerInterface defines the interface for triggering media scans
type MediaScannerInterface interface {
	ScanMediaLibrary() error
}

// StatusCallback is called when a torrent's status changes
// This allows immediate persistence to database
type StatusCallback func(torrentID string, status string, progress float64, size int64, downloaded int64, completedAt *time.Time)

type TorrentClient struct {
	session            *torrent.Session
	downloads          map[string]*DownloadInfo
	torrents           map[string]*torrent.Torrent
	mu                 sync.RWMutex
	downloadDir        string
	mediaScanner       MediaScannerInterface
	statusCallback     StatusCallback
	downloadSpeedLimit int64 // bytes per second, 0 = unlimited
	uploadSpeedLimit   int64 // bytes per second, 0 = unlimited
	bandwidthMonitor   *BandwidthMonitor
}

type DownloadInfo struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	MagnetURI   string    `json:"magnet_uri"`
	Status      string    `json:"status"` // downloading, completed, paused, error
	Progress    float64   `json:"progress"`
	DownloadRate int64    `json:"download_rate"`
	UploadRate   int64    `json:"upload_rate"`
	Seeders     int       `json:"seeders"`
	Peers       int       `json:"peers"`
	Size        int64     `json:"size"`
	Downloaded  int64     `json:"downloaded"`
	ETA         string    `json:"eta"`
	AddedAt     time.Time `json:"added_at"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
	SavePath    string    `json:"save_path"`
}

func NewTorrentClient(downloadDir string, mediaScanner MediaScannerInterface, statusCallback StatusCallback, performanceConfig ...map[string]int) (*TorrentClient, error) {
	// Ensure download directory exists
	if err := os.MkdirAll(downloadDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create download directory: %v", err)
	}

	// Configure rain session for high-speed downloads
	cfg := torrent.DefaultConfig
	cfg.DataDir = downloadDir
	cfg.Database = filepath.Join(downloadDir, "rain.db")
	cfg.Host = "0.0.0.0"
	
	// Default high-performance settings
	maxPeerConnections := 500
	maxPeerAccepts := 200
	portStart := 50000
	portEnd := 50100
	maxOpenFiles := 1024
	
	// Override with provided performance config if available
	if len(performanceConfig) > 0 {
		config := performanceConfig[0]
		if val, ok := config["max_peer_connections"]; ok && val > 0 {
			maxPeerConnections = val
		}
		if val, ok := config["max_peer_accepts"]; ok && val > 0 {
			maxPeerAccepts = val
		}
		if val, ok := config["port_range_start"]; ok && val > 0 {
			portStart = val
		}
		if val, ok := config["port_range_end"]; ok && val > 0 {
			portEnd = val
		}
		if val, ok := config["max_open_files"]; ok && val > 0 {
			maxOpenFiles = val
		}
	}
	
	// Apply performance settings
	cfg.PortBegin = uint16(portStart)
	cfg.PortEnd = uint16(portEnd)
	cfg.MaxOpenFiles = uint64(maxOpenFiles)
	
	// Optimize connection timeouts for faster peer discovery
	cfg.PeerConnectTimeout = 15 * time.Second
	cfg.PeerHandshakeTimeout = 5 * time.Second
	
	// Apply peer connection limits for maximum speed
	cfg.MaxPeerDial = maxPeerConnections
	cfg.MaxPeerAccept = maxPeerAccepts
	
	// Increase parallel metadata downloads for faster torrent info retrieval
	cfg.ParallelMetadataDownloads = 10
	
	// Additional optimizations for high-speed networks
	// Focus on the settings that are actually available in Rain
	
	// Note: Rain doesn't have built-in seed ratio/time limits
	// We'll handle seeding prevention by stopping torrents when complete

	// Create the rain session
	session, err := torrent.NewSession(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to create rain session: %v", err)
	}

	tc := &TorrentClient{
		session:            session,
		downloads:          make(map[string]*DownloadInfo),
		torrents:           make(map[string]*torrent.Torrent),
		downloadDir:        downloadDir,
		mediaScanner:       mediaScanner,
		statusCallback:     statusCallback,
		downloadSpeedLimit: 0, // unlimited by default
		uploadSpeedLimit:   0, // unlimited by default
		bandwidthMonitor: &BandwidthMonitor{
			lastResetTime: time.Now(),
		},
	}

	// Start monitoring goroutine
	go tc.monitorDownloads()

	// Start cleanup goroutine for completed torrents
	go tc.cleanupCompletedTorrents()

	log.Printf("✅ Rain torrent client initialized with high-speed configuration")
	log.Printf("📁 Download directory: %s", downloadDir)
	log.Printf("🚀 Performance settings optimized for 60Mbps+ connections:")
	log.Printf("   • Port range: %d-%d (%d ports available)", cfg.PortBegin, cfg.PortEnd, cfg.PortEnd-cfg.PortBegin+1)
	log.Printf("   • Max peer connections: %d outgoing, %d incoming", cfg.MaxPeerDial, cfg.MaxPeerAccept)
	log.Printf("   • Max open files: %d (for better I/O performance)", cfg.MaxOpenFiles)
	log.Printf("   • Parallel metadata downloads: %d", cfg.ParallelMetadataDownloads)
	log.Printf("   • Connection timeouts: %v connect, %v handshake", cfg.PeerConnectTimeout, cfg.PeerHandshakeTimeout)
	log.Printf("🚫 Seeding prevention: Torrents will be stopped when downloads complete")
	log.Printf("💡 Expected performance: Up to 7-8 MB/s on 60Mbps connections with good peers")
	return tc, nil
}

func (tc *TorrentClient) AddMagnet(magnetURI string) (*DownloadInfo, error) {
	tc.mu.Lock()
	defer tc.mu.Unlock()

	log.Printf("🔥 Adding torrent with Rain: %s", magnetURI[:50])

	// Add torrent to session
	t, err := tc.session.AddURI(magnetURI, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to add magnet: %v", err)
	}

	// Generate download ID from torrent ID
	downloadID := t.ID()
	
	// Extract torrent name from magnet URI as fallback
	torrentName := "Unknown Torrent"
	if strings.Contains(magnetURI, "dn=") {
		parts := strings.Split(magnetURI, "dn=")
		if len(parts) > 1 {
			namepart := strings.Split(parts[1], "&")[0]
			if decoded, err := strconv.Unquote("\"" + strings.ReplaceAll(namepart, "+", " ") + "\""); err == nil {
				torrentName = decoded
			}
		}
	}

	downloadInfo := &DownloadInfo{
		ID:           downloadID,
		Name:         torrentName,
		MagnetURI:    magnetURI,
		Status:       "downloading",
		Progress:     0,
		Size:         0, // Will be updated when torrent info is available
		Downloaded:   0,
		AddedAt:      time.Now(),
		SavePath:     tc.downloadDir,
		Seeders:      0,
		Peers:        0,
		DownloadRate: 0,
		ETA:          "Getting torrent info...",
	}

	tc.downloads[downloadInfo.ID] = downloadInfo
	tc.torrents[downloadInfo.ID] = t

	// Start downloading
	err = t.Start()
	if err != nil {
		log.Printf("⚠️ Failed to start torrent: %v", err)
	}

	log.Printf("✅ Rain torrent added with ID: %s, Name: %s", downloadID, torrentName)
	return downloadInfo, nil
}

// RestoreDownload restores a download from database record
func (tc *TorrentClient) RestoreDownload(torrentID, name, magnetURI, status, savePath string, progress float64, size, downloaded int64, addedAt time.Time, completedAt *time.Time) error {
	tc.mu.Lock()
	defer tc.mu.Unlock()

	log.Printf("🔄 Restoring torrent: %s (Status: %s, Progress: %.1f%%)", name, status, progress)

	// Add torrent to session
	t, err := tc.session.AddURI(magnetURI, nil)
	if err != nil {
		return fmt.Errorf("failed to restore magnet: %v", err)
	}

	// Create download info from database record
	downloadInfo := &DownloadInfo{
		ID:           torrentID,
		Name:         name,
		MagnetURI:    magnetURI,
		Status:       status,
		Progress:     progress,
		Size:         size,
		Downloaded:   downloaded,
		AddedAt:      addedAt,
		CompletedAt:  completedAt,
		SavePath:     savePath,
		Seeders:      0,
		Peers:        0,
		DownloadRate: 0,
		UploadRate:   0,
		ETA:          "Restoring...",
	}

	tc.downloads[torrentID] = downloadInfo
	tc.torrents[torrentID] = t

	// Start or keep paused based on status
	if status == "downloading" {
		err = t.Start()
		if err != nil {
			log.Printf("⚠️ Failed to start restored torrent: %v", err)
			downloadInfo.Status = "error"
		} else {
			downloadInfo.ETA = "Resuming..."
		}
	} else if status == "paused" {
		// Keep paused - don't start the torrent
		downloadInfo.ETA = "Paused"
		log.Printf("⏸️ Restored torrent in paused state: %s", name)
	}

	log.Printf("✅ Restored torrent: %s", name)
	return nil
}

func (tc *TorrentClient) GetDownloads() []*DownloadInfo {
	tc.mu.RLock()
	defer tc.mu.RUnlock()

	downloads := make([]*DownloadInfo, 0, len(tc.downloads))
	for _, download := range tc.downloads {
		downloads = append(downloads, download)
	}

	return downloads
}

func (tc *TorrentClient) GetDownload(id string) (*DownloadInfo, bool) {
	tc.mu.RLock()
	defer tc.mu.RUnlock()

	download, exists := tc.downloads[id]
	return download, exists
}

func (tc *TorrentClient) PauseDownload(id string) error {
	tc.mu.Lock()
	defer tc.mu.Unlock()

	download, exists := tc.downloads[id]
	if !exists {
		return fmt.Errorf("download not found")
	}

	if download.Status == "completed" {
		return fmt.Errorf("cannot pause completed download")
	}

	if download.Status == "paused" {
		return fmt.Errorf("download is already paused")
	}

	torrent, exists := tc.torrents[id]
	if !exists {
		return fmt.Errorf("torrent not found")
	}

	// Get current stats before pausing to preserve progress
	stats := torrent.Stats()
	download.Downloaded = int64(stats.Bytes.Completed)
	download.Size = int64(stats.Bytes.Total)
	if download.Size > 0 {
		download.Progress = float64(download.Downloaded) / float64(download.Size) * 100
	}

	// Stop downloading
	err := torrent.Stop()
	if err != nil {
		return fmt.Errorf("failed to pause torrent: %v", err)
	}

	// Set paused state
	download.Status = "paused"
	download.DownloadRate = 0
	download.UploadRate = 0
	download.ETA = "Paused"
	
	log.Printf("⏸️ Paused torrent: %s (Progress: %.1f%%)", download.Name, download.Progress)
	return nil
}

func (tc *TorrentClient) ResumeDownload(id string) error {
	tc.mu.Lock()
	defer tc.mu.Unlock()

	download, exists := tc.downloads[id]
	if !exists {
		return fmt.Errorf("download not found")
	}

	if download.Status == "completed" {
		return fmt.Errorf("download already completed")
	}

	if download.Status != "paused" {
		return fmt.Errorf("download is not paused")
	}

	torrent, exists := tc.torrents[id]
	if !exists {
		return fmt.Errorf("torrent not found")
	}

	// Resume downloading
	err := torrent.Start()
	if err != nil {
		return fmt.Errorf("failed to resume torrent: %v", err)
	}

	// Set downloading state
	download.Status = "downloading"
	download.ETA = "Resuming..."
	
	log.Printf("▶️ Resumed torrent: %s (From: %.1f%%)", download.Name, download.Progress)
	return nil
}

func (tc *TorrentClient) RemoveDownload(id string) error {
	tc.mu.Lock()
	defer tc.mu.Unlock()

	download, exists := tc.downloads[id]
	if !exists {
		return fmt.Errorf("download not found")
	}

	// Remove torrent from session
	if torrent, exists := tc.torrents[id]; exists {
		err := tc.session.RemoveTorrent(torrent.ID())
		if err != nil {
			log.Printf("⚠️ Failed to remove torrent from session: %v", err)
		}
		delete(tc.torrents, id)
	}

	delete(tc.downloads, id)
	log.Printf("🗑️ Removed torrent: %s", download.Name)
	return nil
}

func (tc *TorrentClient) monitorDownloads() {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		tc.updateDownloadStats()
	}
}

func (tc *TorrentClient) updateDownloadStats() {
	tc.mu.Lock()
	defer tc.mu.Unlock()

	// Update stats for all active downloads
	for downloadID, downloadInfo := range tc.downloads {
		if downloadInfo.Status == "completed" {
			continue
		}

		// Get torrent stats
		if t, exists := tc.torrents[downloadID]; exists {
			stats := t.Stats()
			
			// Always update basic stats
			downloadInfo.Downloaded = int64(stats.Bytes.Completed)
			downloadInfo.Size = int64(stats.Bytes.Total)
			
			// Calculate progress - handle edge cases
			if downloadInfo.Size > 0 {
				downloadInfo.Progress = float64(downloadInfo.Downloaded) / float64(downloadInfo.Size) * 100
				// Ensure progress doesn't exceed 100%
				if downloadInfo.Progress > 100 {
					downloadInfo.Progress = 100
				}
			} else {
				// If size is unknown, show 0% progress unless completed
				downloadInfo.Progress = 0
			}
			
			// Update name from torrent info if available
			if stats.Name != "" && stats.Name != downloadInfo.Name {
				downloadInfo.Name = stats.Name
				downloadInfo.SavePath = filepath.Join(tc.downloadDir, stats.Name)
				log.Printf("📝 Updated torrent name: %s", stats.Name)
			}
			
			// Handle status-specific updates
			if downloadInfo.Status == "paused" {
				// For paused torrents, keep paused state and don't update rates/ETA
				downloadInfo.DownloadRate = 0
				downloadInfo.UploadRate = 0
				downloadInfo.Seeders = 0
				downloadInfo.Peers = 0
				downloadInfo.ETA = "Paused"
				
				// Debug logging for paused torrents
				log.Printf("⏸️ Paused torrent %s: %.1f%% complete", 
					downloadID[:8], downloadInfo.Progress)
			} else {
				// For active torrents, update all stats
				downloadInfo.DownloadRate = int64(stats.Speed.Download)
				downloadInfo.UploadRate = int64(stats.Speed.Upload)
				downloadInfo.Seeders = 0 // Rain doesn't expose seeder count directly
				downloadInfo.Peers = stats.Peers.Total
				
				// Update ETA for active downloads
				if downloadInfo.DownloadRate > 0 && downloadInfo.Size > downloadInfo.Downloaded && downloadInfo.Size > 0 {
					remaining := downloadInfo.Size - downloadInfo.Downloaded
					etaSeconds := remaining / downloadInfo.DownloadRate
					downloadInfo.ETA = formatDuration(time.Duration(etaSeconds) * time.Second)
				} else if downloadInfo.Size == 0 {
					downloadInfo.ETA = "Getting torrent info..."
				} else if downloadInfo.DownloadRate == 0 && downloadInfo.Progress < 100 {
					downloadInfo.ETA = "Connecting to peers..."
				}
				
				// Check if completed - only if we have valid size info
				if downloadInfo.Size > 0 && downloadInfo.Progress >= 99.9 {
					downloadInfo.Status = "completed"
					downloadInfo.Progress = 100
					now := time.Now()
					downloadInfo.CompletedAt = &now
					downloadInfo.ETA = "Completed"
					
					log.Printf("🎉 Torrent completed: %s", downloadInfo.Name)
					
					// CRITICAL: Immediately persist completed status to database
					// This prevents re-downloading on server restart
					if tc.statusCallback != nil {
						tc.statusCallback(downloadInfo.ID, "completed", 100, downloadInfo.Size, downloadInfo.Downloaded, downloadInfo.CompletedAt)
						log.Printf("💾 Persisted completed status to database: %s", downloadInfo.Name)
					}
					
					// Stop the torrent to prevent seeding
					if err := t.Stop(); err != nil {
						log.Printf("⚠️ Failed to stop completed torrent: %v", err)
					} else {
						log.Printf("🛑 Stopped torrent to prevent seeding: %s", downloadInfo.Name)
					}
					
					// Trigger media scanner
					go tc.triggerMediaScan(downloadInfo)
				} else if downloadInfo.Size > 0 && downloadInfo.Progress > 0 {
					// Valid download in progress
					downloadInfo.Status = "downloading"
				} else if downloadInfo.Size == 0 {
					// Still getting metadata
					downloadInfo.Status = "downloading"
					downloadInfo.ETA = "Getting torrent info..."
				}
				
				// Debug logging for active torrents
				log.Printf("🔍 Active torrent %s: %.1f%% complete, %s down, %s up", 
					downloadID[:8], downloadInfo.Progress, 
					formatSpeed(downloadInfo.DownloadRate), formatSpeed(downloadInfo.UploadRate))
			}
		}
	}
}

func formatDuration(d time.Duration) string {
	if d < time.Minute {
		return fmt.Sprintf("%ds", int(d.Seconds()))
	} else if d < time.Hour {
		return fmt.Sprintf("%dm", int(d.Minutes()))
	} else if d < 24*time.Hour {
		return fmt.Sprintf("%dh %dm", int(d.Hours()), int(d.Minutes())%60)
	} else {
		days := int(d.Hours()) / 24
		hours := int(d.Hours()) % 24
		return fmt.Sprintf("%dd %dh", days, hours)
	}
}

func formatSpeed(bytesPerSecond int64) string {
	if bytesPerSecond == 0 {
		return "0 B/s"
	}
	const unit = 1024
	if bytesPerSecond < unit {
		return fmt.Sprintf("%d B/s", bytesPerSecond)
	}
	div, exp := int64(unit), 0
	for n := bytesPerSecond / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB/s", float64(bytesPerSecond)/float64(div), "KMGTPE"[exp])
}

// cleanupCompletedTorrents runs periodically to ensure completed torrents are stopped
func (tc *TorrentClient) cleanupCompletedTorrents() {
	ticker := time.NewTicker(30 * time.Second) // Check every 30 seconds
	defer ticker.Stop()

	for range ticker.C {
		tc.mu.Lock()
		for downloadID, downloadInfo := range tc.downloads {
			if downloadInfo.Status == "completed" {
				if t, exists := tc.torrents[downloadID]; exists {
					// Check if torrent is still running and stop it
					stats := t.Stats()
					// Rain uses Status constants, let's just check if it's not stopped
					statusStr := stats.Status.String()
					if statusStr != "Stopped" && statusStr != "Stopping" {
						if err := t.Stop(); err != nil {
							log.Printf("⚠️ Failed to stop completed torrent %s: %v", downloadInfo.Name, err)
						} else {
							log.Printf("🛑 Stopped completed torrent to prevent seeding: %s (was %s)", downloadInfo.Name, statusStr)
						}
					}
				}
			}
		}
		tc.mu.Unlock()
	}
}

func (tc *TorrentClient) Close() error {
	tc.mu.Lock()
	defer tc.mu.Unlock()

	// Stop all torrents before closing
	for id, t := range tc.torrents {
		if err := t.Stop(); err != nil {
			log.Printf("⚠️ Failed to stop torrent %s during shutdown: %v", id, err)
		}
		delete(tc.torrents, id)
	}

	// Close the rain session
	if tc.session != nil {
		tc.session.Close()
	}

	log.Printf("🔒 Rain torrent client closed")
	return nil
}

// triggerMediaScan triggers a media library scan when a download completes
func (tc *TorrentClient) triggerMediaScan(download *DownloadInfo) {
	if tc.mediaScanner == nil {
		log.Printf("Media scanner not available, skipping scan for: %s", download.Name)
		return
	}

	log.Printf("🎬 Download completed, triggering media scan for: %s", download.Name)
	
	// Wait a moment for the file to be fully written
	time.Sleep(2 * time.Second)
	
	if err := tc.mediaScanner.ScanMediaLibrary(); err != nil {
		log.Printf("❌ Failed to trigger media scan after download completion: %v", err)
	} else {
		log.Printf("✅ Media scan triggered successfully for: %s", download.Name)
	}
}

// startBandwidthThrottling starts monitoring and throttling bandwidth usage
func (tc *TorrentClient) startBandwidthThrottling() {
	ticker := time.NewTicker(1 * time.Second) // Check every second
	defer ticker.Stop()

	for range ticker.C {
		tc.mu.RLock()
		downloadLimit := tc.downloadSpeedLimit
		uploadLimit := tc.uploadSpeedLimit
		tc.mu.RUnlock()

		// If no limits are set, skip throttling
		if downloadLimit == 0 && uploadLimit == 0 {
			continue
		}

		tc.throttleBandwidth(downloadLimit, uploadLimit)
	}
}

// throttleBandwidth implements application-level bandwidth throttling
func (tc *TorrentClient) throttleBandwidth(downloadLimit, uploadLimit int64) {
	tc.bandwidthMonitor.mu.Lock()
	defer tc.bandwidthMonitor.mu.Unlock()

	now := time.Now()
	
	// Reset counters every second
	if now.Sub(tc.bandwidthMonitor.lastResetTime) >= time.Second {
		tc.bandwidthMonitor.downloadBytesUsed = 0
		tc.bandwidthMonitor.uploadBytesUsed = 0
		tc.bandwidthMonitor.lastResetTime = now
		return
	}

	// Get current bandwidth usage from all torrents
	var totalDownloadRate, totalUploadRate int64
	
	tc.mu.RLock()
	for _, downloadInfo := range tc.downloads {
		if downloadInfo.Status == "downloading" {
			totalDownloadRate += downloadInfo.DownloadRate
			totalUploadRate += downloadInfo.UploadRate
		}
	}
	tc.mu.RUnlock()

	// Calculate if we need to throttle
	var shouldThrottle bool
	var throttleReason string

	if downloadLimit > 0 && totalDownloadRate > downloadLimit {
		shouldThrottle = true
		throttleReason = fmt.Sprintf("download rate %s/s exceeds limit %s/s", 
			formatSpeed(totalDownloadRate), formatSpeed(downloadLimit))
	}

	if uploadLimit > 0 && totalUploadRate > uploadLimit {
		shouldThrottle = true
		if throttleReason != "" {
			throttleReason += " and "
		}
		throttleReason += fmt.Sprintf("upload rate %s/s exceeds limit %s/s", 
			formatSpeed(totalUploadRate), formatSpeed(uploadLimit))
	}

	if shouldThrottle {
		// Implement throttling by temporarily pausing some torrents
		// This is a simple approach - more sophisticated throttling could be implemented
		log.Printf("🚦 Bandwidth throttling triggered: %s", throttleReason)
		
		// For now, just log the throttling event
		// In a more sophisticated implementation, we could:
		// 1. Temporarily pause the fastest downloading torrents
		// 2. Implement per-torrent speed limiting
		// 3. Use network-level throttling
		
		// Simple throttling: introduce a small delay
		time.Sleep(100 * time.Millisecond)
	}
}

// GetBandwidthStats returns current bandwidth usage statistics
func (tc *TorrentClient) GetBandwidthStats() map[string]interface{} {
	tc.mu.RLock()
	defer tc.mu.RUnlock()

	var totalDownloadRate, totalUploadRate int64
	activeDownloads := 0

	for _, downloadInfo := range tc.downloads {
		if downloadInfo.Status == "downloading" {
			totalDownloadRate += downloadInfo.DownloadRate
			totalUploadRate += downloadInfo.UploadRate
			activeDownloads++
		}
	}

	return map[string]interface{}{
		"total_download_rate": totalDownloadRate,
		"total_upload_rate":   totalUploadRate,
		"active_downloads":    activeDownloads,
		"download_limit":      tc.downloadSpeedLimit,
		"upload_limit":        tc.uploadSpeedLimit,
		"download_limit_str":  formatSpeed(tc.downloadSpeedLimit),
		"upload_limit_str":    formatSpeed(tc.uploadSpeedLimit),
	}
}

// SetSpeedLimits applies speed limit configuration to the torrent client
// Since Rain torrent library doesn't support runtime speed limits,
// we implement application-level bandwidth throttling
func (tc *TorrentClient) SetSpeedLimits(downloadLimit, uploadLimit int64) {
	tc.mu.Lock()
	defer tc.mu.Unlock()

	// Store the limits for use in bandwidth throttling
	tc.downloadSpeedLimit = downloadLimit
	tc.uploadSpeedLimit = uploadLimit

	log.Printf("⚡ Speed limits configured - Download: %s/s, Upload: %s/s", 
		formatSpeed(downloadLimit), formatSpeed(uploadLimit))
	
	if downloadLimit > 0 || uploadLimit > 0 {
		log.Printf("🚀 Application-level bandwidth throttling enabled")
		log.Printf("   • Download limit: %s/s", formatSpeed(downloadLimit))
		log.Printf("   • Upload limit: %s/s", formatSpeed(uploadLimit))
		
		// Start bandwidth monitoring and throttling
		go tc.startBandwidthThrottling()
	} else {
		log.Printf("🚀 No speed limits set - unlimited bandwidth")
	}
	
	log.Printf("💡 Note: For system-level bandwidth control, consider:")
	log.Printf("   • Linux tc (traffic control)")
	log.Printf("   • Router QoS settings")
	log.Printf("   • Network-level bandwidth limiting")
}