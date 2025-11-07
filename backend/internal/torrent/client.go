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

// MediaScannerInterface defines the interface for triggering media scans
type MediaScannerInterface interface {
	ScanMediaLibrary() error
}

type TorrentClient struct {
	session      *torrent.Session
	downloads    map[string]*DownloadInfo
	torrents     map[string]*torrent.Torrent
	mu           sync.RWMutex
	downloadDir  string
	mediaScanner MediaScannerInterface
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

func NewTorrentClient(downloadDir string, mediaScanner MediaScannerInterface) (*TorrentClient, error) {
	// Ensure download directory exists
	if err := os.MkdirAll(downloadDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create download directory: %v", err)
	}

	// Configure rain session
	cfg := torrent.DefaultConfig
	cfg.DataDir = downloadDir
	cfg.Database = filepath.Join(downloadDir, "rain.db")
	cfg.Host = "0.0.0.0"
	cfg.PortBegin = 50007
	cfg.PortEnd = 50017
	cfg.MaxOpenFiles = 256
	cfg.PeerConnectTimeout = 30 * time.Second
	cfg.PeerHandshakeTimeout = 10 * time.Second
	cfg.MaxPeerDial = 80
	cfg.MaxPeerAccept = 20
	cfg.ParallelMetadataDownloads = 2

	// Create the rain session
	session, err := torrent.NewSession(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to create rain session: %v", err)
	}

	tc := &TorrentClient{
		session:      session,
		downloads:    make(map[string]*DownloadInfo),
		torrents:     make(map[string]*torrent.Torrent),
		downloadDir:  downloadDir,
		mediaScanner: mediaScanner,
	}

	// Start monitoring goroutine
	go tc.monitorDownloads()

	log.Printf("✅ Rain torrent client initialized")
	log.Printf("📁 Download directory: %s", downloadDir)
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

	torrent, exists := tc.torrents[id]
	if !exists {
		return fmt.Errorf("torrent not found")
	}

	// Stop downloading
	err := torrent.Stop()
	if err != nil {
		return fmt.Errorf("failed to pause torrent: %v", err)
	}

	download.Status = "paused"
	log.Printf("⏸️ Paused torrent: %s", download.Name)
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

	torrent, exists := tc.torrents[id]
	if !exists {
		return fmt.Errorf("torrent not found")
	}

	// Resume downloading
	err := torrent.Start()
	if err != nil {
		return fmt.Errorf("failed to resume torrent: %v", err)
	}

	download.Status = "downloading"
	log.Printf("▶️ Resumed torrent: %s", download.Name)
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
			
			// Debug logging to see what Rain is reporting
			log.Printf("🔍 Torrent %s stats: Completed=%d, Total=%d, Name=%s", 
				downloadID[:8], stats.Bytes.Completed, stats.Bytes.Total, stats.Name)
			
			// Update download info with real stats
			downloadInfo.Downloaded = int64(stats.Bytes.Completed)
			downloadInfo.Size = int64(stats.Bytes.Total)
			downloadInfo.DownloadRate = int64(stats.Speed.Download)
			downloadInfo.UploadRate = int64(stats.Speed.Upload)
			downloadInfo.Seeders = 0 // Rain doesn't expose seeder count directly
			downloadInfo.Peers = stats.Peers.Total
			
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
				if stats.Bytes.Completed > 0 && stats.Bytes.Total == 0 {
					// Metadata might not be available yet
					downloadInfo.ETA = "Getting torrent info..."
				}
			}
			
			// Update ETA
			if downloadInfo.DownloadRate > 0 && downloadInfo.Size > downloadInfo.Downloaded && downloadInfo.Size > 0 {
				remaining := downloadInfo.Size - downloadInfo.Downloaded
				etaSeconds := remaining / downloadInfo.DownloadRate
				downloadInfo.ETA = formatDuration(time.Duration(etaSeconds) * time.Second)
			} else if downloadInfo.Size == 0 {
				downloadInfo.ETA = "Getting torrent info..."
			} else if downloadInfo.DownloadRate == 0 && downloadInfo.Progress < 100 {
				downloadInfo.ETA = "Connecting to peers..."
			}
			
			// Update name from torrent info if available
			if stats.Name != "" && stats.Name != downloadInfo.Name {
				downloadInfo.Name = stats.Name
				downloadInfo.SavePath = filepath.Join(tc.downloadDir, stats.Name)
				log.Printf("📝 Updated torrent name: %s", stats.Name)
			}
			
			// Check if completed - only if we have valid size info
			if downloadInfo.Size > 0 && downloadInfo.Progress >= 99.9 {
				downloadInfo.Status = "completed"
				downloadInfo.Progress = 100
				now := time.Now()
				downloadInfo.CompletedAt = &now
				downloadInfo.ETA = "Completed"
				
				log.Printf("🎉 Torrent completed: %s", downloadInfo.Name)
				
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

func (tc *TorrentClient) Close() error {
	tc.mu.Lock()
	defer tc.mu.Unlock()

	// Close all torrents
	for id := range tc.torrents {
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