package utils

import (
	"path/filepath"
	"strings"
)

// GetVideoContentType returns the appropriate MIME type for video files
func GetVideoContentType(filePath string) string {
	ext := strings.ToLower(filepath.Ext(filePath))
	
	switch ext {
	case ".mp4", ".m4v":
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
	case ".ogv":
		return "video/ogg"
	case ".3gp":
		return "video/3gpp"
	case ".ts":
		return "video/mp2t"
	case ".m3u8":
		return "application/vnd.apple.mpegurl"
	case ".mpd":
		return "application/dash+xml"
	default:
		return "video/mp4" // Default to MP4 for unknown video files
	}
}

// GetAudioContentType returns the appropriate MIME type for audio files
func GetAudioContentType(filePath string) string {
	ext := strings.ToLower(filepath.Ext(filePath))
	
	switch ext {
	case ".mp3":
		return "audio/mpeg"
	case ".m4a", ".aac":
		return "audio/mp4"
	case ".ogg":
		return "audio/ogg"
	case ".wav":
		return "audio/wav"
	case ".flac":
		return "audio/flac"
	case ".opus":
		return "audio/opus"
	case ".wma":
		return "audio/x-ms-wma"
	default:
		return "audio/mpeg" // Default to MP3 for unknown audio files
	}
}