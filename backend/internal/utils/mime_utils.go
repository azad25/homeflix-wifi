package utils

import (
	"mime"
	"path/filepath"
	"strings"
)

// GetMimeType returns the MIME type for any file extension using Go's built-in mime package
func GetMimeType(filePath string) string {
	ext := strings.ToLower(filepath.Ext(filePath))
	
	// Try to detect MIME type from file extension
	if mimeType := mime.TypeByExtension(ext); mimeType != "" {
		return mimeType
	}
	
	// Fallback to application/octet-stream for unknown files
	return "application/octet-stream"
}
