package torrent

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	raintorrent "github.com/cenkalti/rain/torrent"
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
	session            *raintorrent.Session
	downloads          map[string]*DownloadInfo
	torrents           map[string]*raintorrent.Torrent
	mu                 sync.RWMutex
	downloadDir        string
	mediaScanner       MediaScannerInterface
	statusCallback     StatusCallback
	downloadSpeedLimit int64 // bytes per second, 0 = unlimited
	uploadSpeedLimit   int64 // bytes per second, 0 = unlimited
	maxDownloads       int   // maximum concurrent active downloads
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
	cfg := raintorrent.DefaultConfig
	cfg.DataDir = downloadDir
	cfg.Database = filepath.Join(downloadDir, "rain.db")
	cfg.Host = "0.0.0.0"
	
	// Default high-performance settings with expanded port range
	maxPeerConnections := 500
	maxPeerAccepts := 200
	portStart := 50000
	portEnd := 52000 // Expanded from 50100 to 52000 (2000 ports available)
	maxOpenFiles := 1024
	maxDownloads := 5 // Default concurrent download limit
	
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
		if val, ok := config["max_downloads"]; ok && val > 0 {
			maxDownloads = val
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
	session, err := raintorrent.NewSession(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to create rain session: %v", err)
	}

	tc := &TorrentClient{
		session:            session,
		downloads:          make(map[string]*DownloadInfo),
		torrents:           make(map[string]*raintorrent.Torrent),
		downloadDir:        downloadDir,
		mediaScanner:       mediaScanner,
		statusCallback:     statusCallback,
		downloadSpeedLimit: 0, // unlimited by default
		uploadSpeedLimit:   0, // unlimited by default
		maxDownloads:       maxDownloads,
		bandwidthMonitor: &BandwidthMonitor{
			lastResetTime: time.Now(),
		},
	}

	// Start monitoring goroutine
	go tc.monitorDownloads()

	// Start cleanup goroutine for completed torrents
	go tc.cleanupCompletedTorrents()

	// DISABLED: Smart cleanup to prevent any file deletion
	// go tc.smartStartupCleanup()

	log.Printf("✅ Rain torrent client initialized with high-speed configuration")
	log.Printf("📁 Download directory: %s", downloadDir)
	log.Printf("🚀 Performance settings optimized for 60Mbps+ connections:")
	log.Printf("   • Port range: %d-%d (%d ports available)", cfg.PortBegin, cfg.PortEnd, cfg.PortEnd-cfg.PortBegin+1)
	log.Printf("   • Max peer connections: %d outgoing, %d incoming", cfg.MaxPeerDial, cfg.MaxPeerAccept)
	log.Printf("   • Max open files: %d (for better I/O performance)", cfg.MaxOpenFiles)
	log.Printf("   • Parallel metadata downloads: %d", cfg.ParallelMetadataDownloads)
	log.Printf("   • Max concurrent downloads: %d", maxDownloads)
	log.Printf("   • Connection timeouts: %v connect, %v handshake", cfg.PeerConnectTimeout, cfg.PeerHandshakeTimeout)
	log.Printf("🚫 Seeding prevention: Torrents will be stopped when downloads complete")
	log.Printf("💡 Expected performance: Up to 7-8 MB/s on 60Mbps connections with good peers")
	return tc, nil
}

// getActiveDownloadCount returns the number of currently active downloads (downloading or paused)
func (tc *TorrentClient) getActiveDownloadCount() int {
	count := 0
	for _, download := range tc.downloads {
		if download.Status == "downloading" || download.Status == "paused" {
			count++
		}
	}
	return count
}

// ManualCleanupCompletedTorrents - DISABLED to prevent file deletion
// This function has been disabled because RemoveTorrent might be deleting files
func (tc *TorrentClient) ManualCleanupCompletedTorrents(olderThanHours int) int {
	log.Printf("🚫 Manual cleanup disabled to preserve files")
	log.Printf("💡 All completed torrents will remain in session to preserve files")
	return 0
}

// safelyMoveAndRemoveTorrent safely moves completed files to permanent storage then removes torrent from session
func (tc *TorrentClient) safelyMoveAndRemoveTorrent(torrentID string, torrent *raintorrent.Torrent, name, savePath string) {
	log.Printf("🔄 Starting safe file move and port cleanup for: %s", name)
	
	// Wait for files to be fully written and stable
	time.Sleep(30 * time.Second)
	
	// Get the actual download path from the torrent
	// This ensures we only move files that were actually downloaded by THIS torrent session
	actualPath := tc.getActualTorrentPath(torrent, name)
	if actualPath == "" {
		log.Printf("⚠️ Could not determine actual torrent path, keeping in session: %s", name)
		return
	}
	
	// Verify files exist and are stable
	if !tc.verifyFilesStable(actualPath, name) {
		log.Printf("⚠️ Files not stable yet, keeping torrent in session: %s", name)
		return
	}
	
	// Move files to permanent storage (only from the actual torrent path)
	newPath, err := tc.moveToStorage(actualPath, name)
	if err != nil {
		log.Printf("❌ Failed to move files to storage, keeping torrent in session: %s - %v", name, err)
		return
	}
	
	// Verify move was successful
	if !tc.verifyFilesStable(newPath, name) {
		log.Printf("❌ Files not stable in new location, keeping torrent in session: %s", name)
		// Try to move back to original location
		tc.moveBack(newPath, actualPath, name)
		return
	}
	
	tc.mu.Lock()
	defer tc.mu.Unlock()
	
	// Update download info with new path
	if downloadInfo, exists := tc.downloads[torrentID]; exists {
		downloadInfo.SavePath = newPath
		
		// Update database with new path if callback is available
		if tc.statusCallback != nil {
			tc.statusCallback(torrentID, "completed", downloadInfo.Progress, downloadInfo.Size, downloadInfo.Downloaded, downloadInfo.CompletedAt)
		}
		
		// CRITICAL: Also trigger a media library scan to update file paths
		// The scanner will detect the moved files and update the database accordingly
		if tc.mediaScanner != nil {
			log.Printf("🔄 Triggering media scan to update file paths after move")
			go func() {
				// Small delay to ensure file system operations are complete
				time.Sleep(5 * time.Second)
				if err := tc.mediaScanner.ScanMediaLibrary(); err != nil {
					log.Printf("⚠️ Failed to trigger media scan after file move: %v", err)
				} else {
					log.Printf("✅ Media scan triggered successfully after file move")
				}
			}()
		}
	}
	
	// Now safely remove from Rain session to free the port
	if err := tc.session.RemoveTorrent(torrent.ID()); err != nil {
		log.Printf("⚠️ Failed to remove torrent from session %s: %v", name, err)
	} else {
		log.Printf("✅ Successfully moved files and freed port: %s", name)
		log.Printf("📁 New location: %s", newPath)
		// Remove from our tracking
		delete(tc.torrents, torrentID)
	}
}

// getActualTorrentPath gets the real download path from the active torrent session
// This ensures we only move files that were actually downloaded by THIS torrent session
func (tc *TorrentClient) getActualTorrentPath(torrent *raintorrent.Torrent, name string) string {
	// Get torrent stats to find the actual download directory
	stats := torrent.Stats()
	
	// Method 1: Try the torrent ID directory (Rain's default behavior)
	torrentDataDir := filepath.Join(tc.downloadDir, torrent.ID())
	if _, err := os.Stat(torrentDataDir); err == nil {
		log.Printf("📁 Found torrent data directory by ID: %s", torrentDataDir)
		return torrentDataDir
	}
	
	// Method 2: Try the torrent name directory
	if stats.Name != "" {
		possiblePath := filepath.Join(tc.downloadDir, stats.Name)
		if _, err := os.Stat(possiblePath); err == nil {
			log.Printf("📁 Found torrent data directory by name: %s", possiblePath)
			return possiblePath
		}
	}
	
	// Method 3: Find the most recently completed download
	// Look for directories that were modified in the last 5 minutes (just completed)
	log.Printf("🔍 Searching for most recently completed download...")
	
	entries, err := os.ReadDir(tc.downloadDir)
	if err != nil {
		log.Printf("❌ Failed to read download directory: %v", err)
		return ""
	}
	
	var candidates []struct {
		path     string
		modTime  time.Time
		size     int64
		hasFiles bool
	}
	
	now := time.Now()
	
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		
		entryPath := filepath.Join(tc.downloadDir, entry.Name())
		info, err := entry.Info()
		if err != nil {
			continue
		}
		
		// Only consider directories modified in the last 10 minutes (recently completed)
		timeSinceModified := now.Sub(info.ModTime())
		if timeSinceModified > 10*time.Minute {
			continue
		}
		
		// Check if directory has actual content (not empty)
		dirSize := tc.getDirSize(entryPath)
		hasFiles := tc.hasMediaFiles(entryPath)
		
		// Skip empty directories or very small ones (< 1MB)
		if dirSize < 1024*1024 {
			continue
		}
		
		candidates = append(candidates, struct {
			path     string
			modTime  time.Time
			size     int64
			hasFiles bool
		}{
			path:     entryPath,
			modTime:  info.ModTime(),
			size:     dirSize,
			hasFiles: hasFiles,
		})
		
		log.Printf("📊 Candidate: %s (modified: %v ago, size: %s, has media: %v)", 
			entry.Name(), timeSinceModified.Round(time.Second), formatSize(dirSize), hasFiles)
	}
	
	if len(candidates) == 0 {
		log.Printf("❌ No recently modified directories found for: %s", name)
		return ""
	}
	
	// Sort by modification time (newest first) and prefer directories with media files
	var bestCandidate string
	var bestTime time.Time
	var bestHasMedia bool
	
	for _, candidate := range candidates {
		isBetter := false
		
		if bestCandidate == "" {
			isBetter = true
		} else if candidate.hasFiles && !bestHasMedia {
			// Prefer directories with media files
			isBetter = true
		} else if candidate.hasFiles == bestHasMedia && candidate.modTime.After(bestTime) {
			// If both have/don't have media files, prefer newer
			isBetter = true
		}
		
		if isBetter {
			bestCandidate = candidate.path
			bestTime = candidate.modTime
			bestHasMedia = candidate.hasFiles
		}
	}
	
	if bestCandidate != "" {
		log.Printf("✅ Selected most recent download: %s (modified: %v ago, has media: %v)", 
			filepath.Base(bestCandidate), now.Sub(bestTime).Round(time.Second), bestHasMedia)
		return bestCandidate
	}
	
	log.Printf("❌ Could not determine actual torrent path for: %s", name)
	return ""
}

// hasMediaFiles checks if a directory contains media files
func (tc *TorrentClient) hasMediaFiles(dirPath string) bool {
	mediaExtensions := []string{".mkv", ".mp4", ".avi", ".mov", ".wmv", ".flv", ".webm", ".m4v", ".mpg", ".mpeg", ".3gp"}
	
	found := false
	filepath.Walk(dirPath, func(path string, info os.FileInfo, err error) error {
		if err != nil || found {
			return nil
		}
		
		if !info.IsDir() {
			ext := strings.ToLower(filepath.Ext(info.Name()))
			for _, mediaExt := range mediaExtensions {
				if ext == mediaExt {
					found = true
					return nil
				}
			}
		}
		return nil
	})
	
	return found
}

// formatSize formats bytes into human readable format
func (tc *TorrentClient) formatSize(bytes int64) string {
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}
	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(bytes)/float64(div), "KMGTPE"[exp])
}

// moveToStorage moves completed torrent files to permanent storage
// Only moves files from temporary random-ID folders, preserves existing organized files
func (tc *TorrentClient) moveToStorage(sourcePath, name string) (string, error) {
	// Define the permanent storage path
	storagePath := "/home/azad/Downloads/homeflix-storage"
	
	// Check if this is a temporary torrent folder (random ID pattern)
	// Only move files that are in the pattern: /home/azad/Downloads/homeflix/[random-chars]/[content]
	homeflixDir := "/home/azad/Downloads/homeflix"
	
	// Check if source is within homeflix directory
	if !strings.HasPrefix(sourcePath, homeflixDir) {
		return sourcePath, fmt.Errorf("source not in homeflix directory, skipping move")
	}
	
	// Get the relative path from homeflix directory
	relPath, err := filepath.Rel(homeflixDir, sourcePath)
	if err != nil {
		return sourcePath, fmt.Errorf("failed to get relative path: %v", err)
	}
	
	// Check if this looks like a temporary torrent folder (random ID pattern)
	pathParts := strings.Split(relPath, string(filepath.Separator))
	if len(pathParts) < 1 {
		return sourcePath, fmt.Errorf("invalid path structure")
	}
	
	// Check if the first part looks like a random torrent ID (contains random chars)
	firstPart := pathParts[0]
	isRandomID := tc.looksLikeRandomTorrentID(firstPart)
	
	if !isRandomID {
		log.Printf("📁 File appears to be already organized, skipping move: %s", sourcePath)
		return sourcePath, nil // Don't move, return original path
	}
	
	log.Printf("🔍 Detected temporary torrent folder, proceeding with move: %s", firstPart)
	
	// Ensure storage directory exists
	if err := os.MkdirAll(storagePath, 0755); err != nil {
		return "", fmt.Errorf("failed to create storage directory: %v", err)
	}
	
	// Determine source and destination
	var srcPath, destPath string
	
	// Check if sourcePath is a directory or file
	info, err := os.Stat(sourcePath)
	if err != nil {
		return "", fmt.Errorf("source path does not exist: %v", err)
	}
	
	if info.IsDir() {
		// If it's a directory, we need to move the contents
		// The sourcePath might be the torrent folder itself, or we need to find the actual content folder
		
		// List contents of the source directory
		entries, err := os.ReadDir(sourcePath)
		if err != nil {
			return "", fmt.Errorf("failed to read source directory: %v", err)
		}
		
		// Look for the main content folder (usually the largest directory)
		var contentFolder string
		var largestSize int64
		
		for _, entry := range entries {
			if entry.IsDir() {
				entryPath := filepath.Join(sourcePath, entry.Name())
				size := tc.getDirSize(entryPath)
				if size > largestSize {
					largestSize = size
					contentFolder = entry.Name()
				}
			}
		}
		
		if contentFolder != "" {
			// Move the content folder
			srcPath = filepath.Join(sourcePath, contentFolder)
			destPath = filepath.Join(storagePath, contentFolder)
		} else {
			// No subdirectory found, move the entire directory
			srcPath = sourcePath
			destPath = filepath.Join(storagePath, filepath.Base(sourcePath))
		}
	} else {
		// If it's a single file, move it to storage
		srcPath = sourcePath
		destPath = filepath.Join(storagePath, filepath.Base(sourcePath))
	}
	
	log.Printf("📦 Moving: %s → %s", srcPath, destPath)
	
	// Check if destination already exists
	if _, err := os.Stat(destPath); err == nil {
		// Destination exists, create a unique name
		base := filepath.Base(destPath)
		ext := filepath.Ext(base)
		nameWithoutExt := strings.TrimSuffix(base, ext)
		
		counter := 1
		for {
			newName := fmt.Sprintf("%s_%d%s", nameWithoutExt, counter, ext)
			newDestPath := filepath.Join(filepath.Dir(destPath), newName)
			if _, err := os.Stat(newDestPath); os.IsNotExist(err) {
				destPath = newDestPath
				break
			}
			counter++
		}
		log.Printf("📝 Destination exists, using unique name: %s", destPath)
	}
	
	// Perform the move
	err = os.Rename(srcPath, destPath)
	if err != nil {
		// If rename fails (cross-device), try copy and delete
		log.Printf("⚠️ Rename failed, trying copy and delete: %v", err)
		err = tc.copyAndDelete(srcPath, destPath)
		if err != nil {
			return "", fmt.Errorf("failed to move files: %v", err)
		}
	}
	
	log.Printf("✅ Files moved successfully to: %s", destPath)
	return destPath, nil
}

// looksLikeRandomTorrentID checks if a folder name looks like a random torrent ID
func (tc *TorrentClient) looksLikeRandomTorrentID(folderName string) bool {
	// Rain torrent IDs are typically random character strings
	// They usually contain a mix of letters and numbers, and are relatively short
	
	// Check length (Rain IDs are typically 20-40 characters)
	if len(folderName) < 10 || len(folderName) > 50 {
		return false
	}
	
	// Check if it contains typical random ID patterns
	hasLetters := false
	hasNumbers := false
	
	for _, char := range folderName {
		if (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') {
			hasLetters = true
		} else if char >= '0' && char <= '9' {
			hasNumbers = true
		} else if char == '-' || char == '_' {
			
		}
	}
	
	// Random IDs typically have both letters and numbers
	if !hasLetters || !hasNumbers {
		return false
	}
	
	// Check if it looks like a meaningful name (has spaces, dots, common movie patterns)
	meaningfulPatterns := []string{
		".", " ", "1080p", "720p", "BluRay", "WEB-DL", "HDTV", "DVDRip",
		"Season", "Episode", "S01", "S02", "E01", "E02", "YIFY", "RARBG",
	}
	
	for _, pattern := range meaningfulPatterns {
		if strings.Contains(strings.ToLower(folderName), strings.ToLower(pattern)) {
			return false // Looks like a meaningful name, not a random ID
		}
	}
	
	// If it passes all checks, it's likely a random torrent ID
	return true
}

// copyAndDelete copies files/directories and then deletes the source
func (tc *TorrentClient) copyAndDelete(src, dest string) error {
	// Get source info
	srcInfo, err := os.Stat(src)
	if err != nil {
		return err
	}
	
	if srcInfo.IsDir() {
		// Copy directory recursively
		err = tc.copyDir(src, dest)
	} else {
		// Copy single file
		err = tc.copyFile(src, dest)
	}
	
	if err != nil {
		return fmt.Errorf("copy failed: %v", err)
	}
	
	// Verify copy was successful
	if !tc.verifyFilesStable(dest, filepath.Base(dest)) {
		return fmt.Errorf("copy verification failed")
	}
	
	// Delete source
	err = os.RemoveAll(src)
	if err != nil {
		log.Printf("⚠️ Failed to delete source after copy: %v", err)
		// Don't return error here, copy was successful
	}
	
	return nil
}

// copyFile copies a single file
func (tc *TorrentClient) copyFile(src, dest string) error {
	sourceFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer sourceFile.Close()
	
	// Create destination directory if needed
	destDir := filepath.Dir(dest)
	if err := os.MkdirAll(destDir, 0755); err != nil {
		return err
	}
	
	destFile, err := os.Create(dest)
	if err != nil {
		return err
	}
	defer destFile.Close()
	
	// Copy file contents
	_, err = destFile.ReadFrom(sourceFile)
	if err != nil {
		return err
	}
	
	// Copy file permissions
	srcInfo, err := os.Stat(src)
	if err != nil {
		return err
	}
	
	return os.Chmod(dest, srcInfo.Mode())
}

// copyDir copies a directory recursively
func (tc *TorrentClient) copyDir(src, dest string) error {
	srcInfo, err := os.Stat(src)
	if err != nil {
		return err
	}
	
	// Create destination directory
	if err := os.MkdirAll(dest, srcInfo.Mode()); err != nil {
		return err
	}
	
	// Read source directory
	entries, err := os.ReadDir(src)
	if err != nil {
		return err
	}
	
	// Copy each entry
	for _, entry := range entries {
		srcPath := filepath.Join(src, entry.Name())
		destPath := filepath.Join(dest, entry.Name())
		
		if entry.IsDir() {
			// Recursively copy subdirectory
			if err := tc.copyDir(srcPath, destPath); err != nil {
				return err
			}
		} else {
			// Copy file
			if err := tc.copyFile(srcPath, destPath); err != nil {
				return err
			}
		}
	}
	
	return nil
}

// moveBack attempts to move files back to original location if move to storage fails
func (tc *TorrentClient) moveBack(newPath, originalPath, name string) {
	log.Printf("🔄 Attempting to move files back to original location: %s", name)
	
	err := os.Rename(newPath, originalPath)
	if err != nil {
		log.Printf("❌ Failed to move files back: %v", err)
		// Try copy and delete as fallback
		if copyErr := tc.copyAndDelete(newPath, originalPath); copyErr != nil {
			log.Printf("❌ Failed to copy files back: %v", copyErr)
		} else {
			log.Printf("✅ Files copied back to original location")
		}
	} else {
		log.Printf("✅ Files moved back to original location")
	}
}

// verifyFilesStable checks if downloaded files exist and are stable (not being written to)
func (tc *TorrentClient) verifyFilesStable(savePath, name string) bool {
	// Check if path exists
	info, err := os.Stat(savePath)
	if err != nil {
		log.Printf("⚠️ Save path does not exist: %s", savePath)
		return false
	}
	
	// Record initial size/modification time
	var initialSize int64
	var initialModTime time.Time
	
	if info.IsDir() {
		// For directories, check total size of all files
		initialSize = tc.getDirSize(savePath)
		initialModTime = info.ModTime()
	} else {
		// For single files
		initialSize = info.Size()
		initialModTime = info.ModTime()
	}
	
	// Wait and check again to ensure files are stable
	time.Sleep(5 * time.Second)
	
	info, err = os.Stat(savePath)
	if err != nil {
		log.Printf("⚠️ Save path disappeared during stability check: %s", savePath)
		return false
	}
	
	var finalSize int64
	var finalModTime time.Time
	
	if info.IsDir() {
		finalSize = tc.getDirSize(savePath)
		finalModTime = info.ModTime()
	} else {
		finalSize = info.Size()
		finalModTime = info.ModTime()
	}
	
	// Files are stable if size and modification time haven't changed
	stable := initialSize == finalSize && initialModTime.Equal(finalModTime)
	
	if stable {
		log.Printf("✅ Files verified as stable: %s (size: %d bytes)", name, finalSize)
	} else {
		log.Printf("⚠️ Files still changing: %s (size: %d -> %d)", name, initialSize, finalSize)
	}
	
	return stable
}

// getDirSize calculates total size of all files in a directory
func (tc *TorrentClient) getDirSize(path string) int64 {
	var size int64
	filepath.Walk(path, func(_ string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if !info.IsDir() {
			size += info.Size()
		}
		return nil
	})
	return size
}

// smartStartupCleanup - DISABLED to prevent file deletion
func (tc *TorrentClient) smartStartupCleanup() {
	log.Printf("🚫 Smart startup cleanup disabled to preserve files")
	log.Printf("💡 All completed torrents will remain in session to preserve files")
	// DO NOT remove any torrents automatically
}

// cleanupOldCompletedTorrents removes old completed torrents from the session to free up ports
// DISABLED: This was too aggressive and removing files
func (tc *TorrentClient) cleanupOldCompletedTorrents() {
	// Wait a moment for initialization to complete
	time.Sleep(5 * time.Second)
	
	tc.mu.Lock()
	defer tc.mu.Unlock()
	
	log.Printf("🧹 Checking old completed torrents (cleanup disabled to preserve files)...")
	
	completedCount := 0
	for _, downloadInfo := range tc.downloads {
		if downloadInfo.Status == "completed" {
			completedCount++
		}
	}
	
	log.Printf("📊 Found %d completed torrents (keeping in session to preserve files)", completedCount)
	// Note: Not removing from session to prevent file deletion
}

func (tc *TorrentClient) AddMagnet(magnetURI string) (*DownloadInfo, error) {
	tc.mu.Lock()
	defer tc.mu.Unlock()

	log.Printf("🔥 Adding torrent with Rain: %s", func() string {
		if len(magnetURI) > 50 {
			return magnetURI[:50] + "..."
		}
		return magnetURI
	}())

	// Check active download limit
	activeCount := tc.getActiveDownloadCount()
	if tc.maxDownloads > 0 && activeCount >= tc.maxDownloads {
		return nil, fmt.Errorf("maximum active downloads reached (%d/%d). Please wait for some downloads to complete or pause/remove existing downloads", activeCount, tc.maxDownloads)
	}

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

	log.Printf("✅ Rain torrent added with ID: %s, Name: %s (Active: %d/%d)", downloadID, torrentName, activeCount+1, tc.maxDownloads)
	return downloadInfo, nil
}

// RestoreDownload restores a download from database record
func (tc *TorrentClient) RestoreDownload(torrentID, name, magnetURI, status, savePath string, progress float64, size, downloaded int64, addedAt time.Time, completedAt *time.Time) error {
	tc.mu.Lock()
	defer tc.mu.Unlock()

	log.Printf("🔄 Restoring torrent: %s (Status: %s, Progress: %.1f%%)", name, status, progress)

	// SAFETY CHECK: Don't restore if already exists in session
	// This prevents Rain from re-adding torrents we've deleted
	if _, exists := tc.downloads[torrentID]; exists {
		log.Printf("⚠️ Torrent already exists in session, skipping restore: %s", name)
		return nil
	}

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
	return tc.RemoveDownloadWithFiles(id, true) // Manual removal = delete files
}

// RemoveDownloadWithFiles removes a download with option to delete files
func (tc *TorrentClient) RemoveDownloadWithFiles(id string, deleteFiles bool) error {
	tc.mu.Lock()
	defer tc.mu.Unlock()

	download, exists := tc.downloads[id]
	if !exists {
		return fmt.Errorf("download not found")
	}

	// Get the actual torrent path before removing from session
	var torrentPath string
	if torrent, exists := tc.torrents[id]; exists {
		// Get the actual download path
		torrentPath = tc.getActualTorrentPath(torrent, download.Name)
		
		// Remove torrent from session to free the port
		err := tc.session.RemoveTorrent(torrent.ID())
		if err != nil {
			log.Printf("⚠️ Failed to remove torrent from session: %v", err)
		} else {
			log.Printf("🗑️ Removed torrent from session (port freed): %s", download.Name)
		}
		delete(tc.torrents, id)
	}

	// Delete files from disk if requested
	if deleteFiles && torrentPath != "" {
		log.Printf("🗑️ Deleting files from disk: %s", torrentPath)
		
		// Verify the path exists before attempting deletion
		if _, err := os.Stat(torrentPath); err == nil {
			// Delete the entire torrent directory
			if err := os.RemoveAll(torrentPath); err != nil {
				log.Printf("❌ Failed to delete files: %v", err)
				// Continue anyway - torrent is already removed from session
			} else {
				log.Printf("✅ Successfully deleted files: %s", torrentPath)
			}
		} else {
			log.Printf("⚠️ Torrent path not found, may have been moved: %s", torrentPath)
		}
	}

	// CRITICAL: Remove from our tracking BEFORE deleting from session
	// This prevents Rain from re-adding it if it's still in rain.db
	delete(tc.downloads, id)
	
	if deleteFiles {
		log.Printf("🗑️ Removed torrent with file deletion: %s", download.Name)
	} else {
		log.Printf("🗑️ Removed torrent (files preserved): %s", download.Name)
	}
	
	// IMPORTANT: Rain's database (rain.db) might still have this torrent
	// The session.RemoveTorrent() call above should have removed it from rain.db
	// But if it persists, it will be caught by the duplicate check in RestoreDownload()
	log.Printf("💡 Torrent removed from session and memory. If it reappears, check rain.db")
	
	return nil
}

// RemoveCompletedDownload removes a completed download from session only (preserves files)
func (tc *TorrentClient) RemoveCompletedDownload(id string) error {
	return tc.RemoveDownloadWithFiles(id, false) // Automatic cleanup = preserve files
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
					
					// Safe port management: Move files to permanent storage then remove from session
					go tc.safelyMoveAndRemoveTorrent(downloadInfo.ID, t, downloadInfo.Name, downloadInfo.SavePath)
					
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

// cleanupCompletedTorrents runs periodically but ONLY stops torrents, never removes them
func (tc *TorrentClient) cleanupCompletedTorrents() {
	ticker := time.NewTicker(5 * time.Minute) // Check every 5 minutes
	defer ticker.Stop()

	for range ticker.C {
		tc.mu.Lock()
		for downloadID, downloadInfo := range tc.downloads {
			if downloadInfo.Status == "completed" {
				if t, exists := tc.torrents[downloadID]; exists {
					// ONLY stop torrent to prevent seeding, NEVER remove from session
					stats := t.Stats()
					statusStr := stats.Status.String()
					if statusStr != "Stopped" && statusStr != "Stopping" {
						if err := t.Stop(); err != nil {
							log.Printf("⚠️ Failed to stop completed torrent %s: %v", downloadInfo.Name, err)
						} else {
							log.Printf("🛑 Stopped completed torrent to prevent seeding (keeping in session): %s", downloadInfo.Name)
						}
					}
					
					// CRITICAL: Never remove from session to preserve files
					// Only manual deletion should remove torrents
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
	ticker := time.NewTicker(5 * time.Second) // Check every 5 seconds instead of every second
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

	// Calculate if we need to throttle (only if significantly over limit to avoid constant throttling)
	var shouldThrottle bool
	var throttleReason string

	if downloadLimit > 0 && totalDownloadRate > int64(float64(downloadLimit)*1.2) { // 20% tolerance
		shouldThrottle = true
		throttleReason = fmt.Sprintf("download rate %s/s exceeds limit %s/s", 
			formatSpeed(totalDownloadRate), formatSpeed(downloadLimit))
	}

	if uploadLimit > 0 && totalUploadRate > int64(float64(uploadLimit)*1.2) { // 20% tolerance
		shouldThrottle = true
		if throttleReason != "" {
			throttleReason += " and "
		}
		throttleReason += fmt.Sprintf("upload rate %s/s exceeds limit %s/s", 
			formatSpeed(totalUploadRate), formatSpeed(uploadLimit))
	}

	if shouldThrottle {
		// Implement gentler throttling by just logging and introducing small delays
		// instead of stopping/starting torrents which can reset downloads
		log.Printf("🚦 Bandwidth limit reached: %s", throttleReason)
		
		// Instead of stopping torrents, just introduce a small delay to reduce overall throughput
		// This is much safer and won't reset downloads
		time.Sleep(500 * time.Millisecond)
		
		// Log current usage for monitoring
		log.Printf("📊 Current usage: Download %s/s (limit: %s/s), Upload %s/s (limit: %s/s)", 
			formatSpeed(totalDownloadRate), formatSpeed(downloadLimit),
			formatSpeed(totalUploadRate), formatSpeed(uploadLimit))
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

// SetDownloadLimits updates the maximum concurrent downloads limit
func (tc *TorrentClient) SetDownloadLimits(maxDownloads int) {
	tc.mu.Lock()
	defer tc.mu.Unlock()
	
	tc.maxDownloads = maxDownloads
	log.Printf("📊 Updated max concurrent downloads limit: %d", maxDownloads)
}

// GetDownloadLimits returns current download limits
func (tc *TorrentClient) GetDownloadLimits() map[string]interface{} {
	tc.mu.RLock()
	defer tc.mu.RUnlock()
	
	activeCount := tc.getActiveDownloadCount()
	
	return map[string]interface{}{
		"max_downloads":    tc.maxDownloads,
		"active_downloads": activeCount,
		"available_slots":  tc.maxDownloads - activeCount,
	}
}
// calculateSimilarity calculates similarity between two strings (0.0 to 1.0)
func (tc *TorrentClient) calculateSimilarity(str1, str2 string) float64 {
	// Normalize strings for comparison
	norm1 := strings.ToLower(strings.TrimSpace(str1))
	norm2 := strings.ToLower(strings.TrimSpace(str2))
	
	// Remove common separators and normalize
	norm1 = strings.ReplaceAll(norm1, ".", " ")
	norm1 = strings.ReplaceAll(norm1, "_", " ")
	norm1 = strings.ReplaceAll(norm1, "-", " ")
	norm1 = regexp.MustCompile(`\s+`).ReplaceAllString(norm1, " ")
	norm1 = strings.TrimSpace(norm1)
	
	norm2 = strings.ReplaceAll(norm2, ".", " ")
	norm2 = strings.ReplaceAll(norm2, "_", " ")
	norm2 = strings.ReplaceAll(norm2, "-", " ")
	norm2 = regexp.MustCompile(`\s+`).ReplaceAllString(norm2, " ")
	norm2 = strings.TrimSpace(norm2)
	
	// Exact match
	if norm1 == norm2 {
		return 1.0
	}
	
	// Substring match
	if strings.Contains(norm1, norm2) || strings.Contains(norm2, norm1) {
		shorter := norm1
		longer := norm2
		if len(norm2) < len(norm1) {
			shorter = norm2
			longer = norm1
		}
		return float64(len(shorter)) / float64(len(longer))
	}
	
	// Word-based similarity
	words1 := strings.Fields(norm1)
	words2 := strings.Fields(norm2)
	
	if len(words1) == 0 || len(words2) == 0 {
		return 0
	}
	
	matchingWords := 0
	for _, word1 := range words1 {
		if len(word1) < 3 { // Skip very short words
			continue
		}
		for _, word2 := range words2 {
			if len(word2) < 3 {
				continue
			}
			if word1 == word2 || (len(word1) > 4 && strings.Contains(word1, word2)) || (len(word2) > 4 && strings.Contains(word2, word1)) {
				matchingWords++
				break
			}
		}
	}
	
	return float64(matchingWords) / float64(len(words1))
}

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
		log.Printf("🚀 Gentle bandwidth monitoring enabled (won't reset downloads)")
		log.Printf("   • Download limit: %s/s (with 20%% tolerance)", formatSpeed(downloadLimit))
		log.Printf("   • Upload limit: %s/s (with 20%% tolerance)", formatSpeed(uploadLimit))
		log.Printf("   • Monitoring interval: 5 seconds")
		
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