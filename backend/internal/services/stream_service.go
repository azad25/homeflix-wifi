package services

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	
	"homeflix-backend/internal/utils"
)

type StreamService struct{}

func NewStreamService() *StreamService {
	return &StreamService{}
}


func (s *StreamService) StreamVideo(w http.ResponseWriter, r *http.Request, filePath string) error {
	file, err := os.Open(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	fileInfo, err := file.Stat()
	if err != nil {
		return err
	}

	fileSize := fileInfo.Size()
	
	// Handle range requests for video streaming
	rangeHeader := r.Header.Get("Range")
	if rangeHeader == "" {
		// No range request, serve the entire file
		w.Header().Set("Content-Type", utils.GetVideoContentType(filePath))
		w.Header().Set("Content-Length", strconv.FormatInt(fileSize, 10))
		w.Header().Set("Accept-Ranges", "bytes")
		
		_, err = io.Copy(w, file)
		return err
	}

	// Parse range header
	ranges := strings.Split(strings.TrimPrefix(rangeHeader, "bytes="), "-")
	if len(ranges) != 2 {
		http.Error(w, "Invalid range", http.StatusRequestedRangeNotSatisfiable)
		return fmt.Errorf("invalid range header")
	}

	var start, end int64
	
	if ranges[0] != "" {
		start, err = strconv.ParseInt(ranges[0], 10, 64)
		if err != nil {
			http.Error(w, "Invalid range start", http.StatusRequestedRangeNotSatisfiable)
			return err
		}
	}

	if ranges[1] != "" {
		end, err = strconv.ParseInt(ranges[1], 10, 64)
		if err != nil {
			http.Error(w, "Invalid range end", http.StatusRequestedRangeNotSatisfiable)
			return err
		}
	} else {
		end = fileSize - 1
	}

	if start > end || start < 0 || end >= fileSize {
		http.Error(w, "Range not satisfiable", http.StatusRequestedRangeNotSatisfiable)
		return fmt.Errorf("range not satisfiable")
	}

	contentLength := end - start + 1

	// Set headers for partial content
	w.Header().Set("Content-Type", utils.GetVideoContentType(filePath))
	w.Header().Set("Content-Range", fmt.Sprintf("bytes %d-%d/%d", start, end, fileSize))
	w.Header().Set("Content-Length", strconv.FormatInt(contentLength, 10))
	w.Header().Set("Accept-Ranges", "bytes")
	w.WriteHeader(http.StatusPartialContent)

	// Seek to start position
	_, err = file.Seek(start, 0)
	if err != nil {
		return err
	}

	// Copy the requested range
	_, err = io.CopyN(w, file, contentLength)
	return err
}

func (s *StreamService) GetVideoInfo(filePath string) (map[string]interface{}, error) {
	fileInfo, err := os.Stat(filePath)
	if err != nil {
		return nil, err
	}

	info := map[string]interface{}{
		"size":     fileInfo.Size(),
		"modified": fileInfo.ModTime(),
		"name":     fileInfo.Name(),
	}

	return info, nil
}
