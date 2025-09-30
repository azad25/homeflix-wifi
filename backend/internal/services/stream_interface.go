package services

import (
	"net/http"
)

type StreamServiceInterface interface {
	StreamVideo(w http.ResponseWriter, r *http.Request, filePath string) error
	GetVideoInfo(filePath string) (map[string]interface{}, error)
}

// Ensure both services implement the interface
var _ StreamServiceInterface = (*StreamService)(nil)
var _ StreamServiceInterface = (*OptimizedStreamService)(nil)
