package storage

import (
	"log"
	"os"
	"path/filepath"
	"syscall"

	"gorm.io/gorm"
	"homeflix-backend/internal/models"
)

const (
	LowStoragePercentThreshold = 85.0
	LowStorageFreeThreshold    = 5 * 1024 * 1024 * 1024 // 5GB
)

// StorageInfo represents disk usage for a single storage path
type StorageInfo struct {
	Path        string  `json:"path"`
	Name        string  `json:"name,omitempty"`
	PathType    string  `json:"path_type,omitempty"`
	Total       uint64  `json:"total"`
	Free        uint64  `json:"free"`
	Used        uint64  `json:"used"`
	UsedPercent float64 `json:"used_percent"`
	Available   bool    `json:"available"`
	Error       string  `json:"error,omitempty"`
	IsLow       bool    `json:"is_low"`
}

// GetDiskUsage returns disk usage for a given path using Statfs
func GetDiskUsage(path string) (StorageInfo, error) {
	info := StorageInfo{Path: path}

	// Check if path exists, create if needed for measurement
	if _, err := os.Stat(path); os.IsNotExist(err) {
		if err := os.MkdirAll(path, 0755); err != nil {
			info.Available = false
			info.Error = err.Error()
			return info, err
		}
	}

	var stat syscall.Statfs_t
	if err := syscall.Statfs(path, &stat); err != nil {
		info.Available = false
		info.Error = err.Error()
		return info, err
	}

	info.Total = stat.Blocks * uint64(stat.Bsize)
	info.Free = stat.Bavail * uint64(stat.Bsize)
	if info.Total >= info.Free {
		info.Used = info.Total - info.Free
	}
	if info.Total > 0 {
		info.UsedPercent = float64(info.Used) / float64(info.Total) * 100
	}
	info.Available = true
	info.IsLow = IsLowStorage(info)
	return info, nil
}

// IsLowStorage returns true if storage is low ( >85% used or <5GB free )
func IsLowStorage(info StorageInfo) bool {
	if !info.Available {
		return false
	}
	if info.UsedPercent >= LowStoragePercentThreshold {
		return true
	}
	if info.Free < LowStorageFreeThreshold {
		return true
	}
	return false
}

// GetStorageInfos returns disk usage for all given paths
func GetStorageInfos(paths []string) []StorageInfo {
	var infos []StorageInfo
	for _, p := range paths {
		info, err := GetDiskUsage(p)
		if err != nil {
			log.Printf("⚠️ Failed to get disk usage for %s: %v", p, err)
			// Still append with error
			infos = append(infos, info)
			continue
		}
		infos = append(infos, info)
	}
	return infos
}

// GetActiveStoragePaths fetches active media paths from DB ordered by priority
func GetActiveStoragePaths(db *gorm.DB) []string {
	var mediaPaths []models.MediaPath
	if err := db.Where("is_active = ?", true).Order("priority DESC, created_at ASC").Find(&mediaPaths).Error; err != nil {
		log.Printf("⚠️ Failed to fetch active storage paths: %v", err)
		return nil
	}
	var paths []string
	for _, mp := range mediaPaths {
		paths = append(paths, mp.Path)
	}
	return paths
}

// GetActiveStorageInfos fetches active paths with their disk usage
func GetActiveStorageInfos(db *gorm.DB) []StorageInfo {
	var mediaPaths []models.MediaPath
	if err := db.Where("is_active = ?", true).Order("priority DESC, created_at ASC").Find(&mediaPaths).Error; err != nil {
		log.Printf("⚠️ Failed to fetch active storage paths: %v", err)
		return nil
	}
	var infos []StorageInfo
	for _, mp := range mediaPaths {
		info, err := GetDiskUsage(mp.Path)
		info.Name = mp.Name
		info.PathType = mp.PathType
		if err != nil {
			infos = append(infos, info)
			continue
		}
		infos = append(infos, info)
	}
	return infos
}

// SelectBestStoragePath picks the path with most free space that can fit requiredBytes.
// If requiredBytes == 0, picks path with most free space.
// Returns empty string if no available paths.
func SelectBestStoragePath(db *gorm.DB, requiredBytes int64) string {
	paths := GetActiveStoragePaths(db)
	return SelectBestStoragePathFromList(paths, requiredBytes)
}

// SelectBestStoragePathFromList picks best path from explicit list
func SelectBestStoragePathFromList(paths []string, requiredBytes int64) string {
	if len(paths) == 0 {
		return ""
	}

	var bestPath string
	var bestFree uint64
	var fallbackPath string
	var fallbackFree uint64

	for _, p := range paths {
		info, err := GetDiskUsage(p)
		if err != nil || !info.Available {
			continue
		}
		// Track fallback = most free overall
		if info.Free > fallbackFree {
			fallbackFree = info.Free
			fallbackPath = p
		}
		// If requiredBytes specified, only consider paths that can fit it
		if requiredBytes > 0 && int64(info.Free) < requiredBytes {
			continue
		}
		if info.Free > bestFree {
			bestFree = info.Free
			bestPath = p
		}
	}

	if bestPath != "" {
		return bestPath
	}
	// If none can fit requiredBytes, return the one with most free space as overflow attempt
	if fallbackPath != "" {
		log.Printf("⚠️ No storage path can fit %d bytes, using largest available: %s (free: %s)", requiredBytes, fallbackPath, formatBytes(fallbackFree))
		return fallbackPath
	}
	return ""
}

// SelectBestStoragePathForSize is a convenience wrapper that estimates size from source path
func SelectBestStoragePathForSize(db *gorm.DB, sourcePath string) string {
	var required int64
	if info, err := os.Stat(sourcePath); err == nil {
		if info.IsDir() {
			required = getDirSize(sourcePath)
		} else {
			required = info.Size()
		}
		// Add 10% buffer
		required = required + required/10
	}
	return SelectBestStoragePath(db, required)
}

func getDirSize(path string) int64 {
	var size int64
	filepath.Walk(path, func(_ string, info os.FileInfo, err error) error {
		if err == nil && !info.IsDir() {
			size += info.Size()
		}
		return nil
	})
	return size
}

func formatBytes(b uint64) string {
	const unit = 1024
	if b < unit {
		return string(rune(b))
	}
	div, exp := int64(unit), 0
	for n := b / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return logFormat(b, div, exp)
}

func logFormat(bytes uint64, div int64, exp int) string {
	units := "KMGTPE"
	return string(units[exp]) + "B"
}
