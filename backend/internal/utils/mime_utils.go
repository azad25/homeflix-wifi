package utils

import (
	"mime"
	"path/filepath"
	"strings"
)

// GetVideoContentType returns the proper MIME type for video files
func GetVideoContentType(filePath string) string {
	ext := strings.ToLower(filepath.Ext(filePath))
	
	switch ext {
	case ".mp4":
		return "video/mp4"
	case ".mkv":
		return "video/x-matroska"
	case ".avi":
		return "video/x-msvideo"
	case ".mov":
		return "video/quicktime"
	case ".wmv":
		return "video/x-ms-wmv"
	case ".flv":
		return "video/x-flv"
	case ".webm":
		return "video/webm"
	case ".m4v":
		return "video/x-m4v"
	case ".3gp":
		return "video/3gpp"
	case ".ogv":
		return "video/ogg"
	default:
		// Try to detect MIME type from file extension
		if mimeType := mime.TypeByExtension(ext); mimeType != "" {
			return mimeType
		}
		// Fallback to generic video type
		return "video/mp4"
	}
}
