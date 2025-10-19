package handlers

import (
	"fmt"
	"io/ioutil"
	"math/rand"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type PreviewVideo struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Filename string `json:"filename"`
	URL      string `json:"url"`
}

type NowPlayingResponse struct {
	Videos []PreviewVideo `json:"videos"`
	Total  int            `json:"total"`
	Page   int            `json:"page"`
	Limit  int            `json:"limit"`
}

// GetNowPlayingPreviews returns a paginated list of preview videos for the live TV channel
func GetNowPlayingPreviews() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get pagination parameters
		pageStr := c.DefaultQuery("page", "1")
		limitStr := c.DefaultQuery("limit", "5")
		randomStr := c.DefaultQuery("random", "false")

		page, err := strconv.Atoi(pageStr)
		if err != nil || page < 1 {
			page = 1
		}

		limit, err := strconv.Atoi(limitStr)
		if err != nil || limit < 1 || limit > 50 {
			limit = 5
		}

		// Seed random number generator
		rand.Seed(time.Now().UnixNano())

		// Read preview directory
		previewDir := "./previews"
		files, err := ioutil.ReadDir(previewDir)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to read preview directory",
			})
			return
		}

		// Filter and collect valid video files
		var videoFiles []string
		for _, file := range files {
			if !file.IsDir() && isValidVideoFile(file.Name(), previewDir) {
				videoFiles = append(videoFiles, file.Name())
			}
		}

		// Default behavior is random for TV channel experience
		// Only sort alphabetically if explicitly requested with random=false
		if randomStr == "false" {
			sort.Strings(videoFiles)
		} else {
			// Shuffle the files for random playback (default behavior)
			rand.Shuffle(len(videoFiles), func(i, j int) {
				videoFiles[i], videoFiles[j] = videoFiles[j], videoFiles[i]
			})
		}

		// Calculate pagination
		total := len(videoFiles)
		offset := (page - 1) * limit
		
		if offset >= total {
			c.JSON(http.StatusOK, NowPlayingResponse{
				Videos: []PreviewVideo{},
				Total:  total,
				Page:   page,
				Limit:  limit,
			})
			return
		}

		end := offset + limit
		if end > total {
			end = total
		}

		// Get the slice for current page
		pageFiles := videoFiles[offset:end]

		// Convert to preview videos with sanitized titles
		var videos []PreviewVideo
		for i, filename := range pageFiles {
			id := fmt.Sprintf("%d", offset+i+1)
			title := sanitizeTitle(filename)
			url := fmt.Sprintf("/api/static/previews/%s", filename)

			videos = append(videos, PreviewVideo{
				ID:       id,
				Title:    title,
				Filename: filename,
				URL:      url,
			})
		}

		c.JSON(http.StatusOK, NowPlayingResponse{
			Videos: videos,
			Total:  total,
			Page:   page,
			Limit:  limit,
		})
	}
}

// sanitizeTitle converts preview filenames to readable media titles
func sanitizeTitle(filename string) string {
	// Remove file extension
	title := strings.TrimSuffix(filename, filepath.Ext(filename))
	
	// Remove "preview_" prefix
	title = strings.TrimPrefix(title, "preview_")
	
	// Remove common suffixes
	suffixes := []string{
		"_audio_fallback",
		"_video_only",
		"_HD",
		"_720p",
		"_1080p",
		"_4K",
		"_DDP_5",
		"_MA_5",
		"_Atmos_5",
		"_BD_5",
		"_HDR_5",
	}
	
	for _, suffix := range suffixes {
		title = strings.TrimSuffix(title, suffix)
	}
	
	// Replace underscores with spaces
	title = strings.ReplaceAll(title, "_", " ")
	
	// Remove numeric prefixes (like "1234_")
	re := regexp.MustCompile(`^\d+\s+`)
	title = re.ReplaceAllString(title, "")
	
	// Clean up common patterns
	patterns := map[string]string{
		`\s+\(\d{4}\)`: "",                    // Remove year in parentheses
		`\s+\d{4}$`:    "",                    // Remove year at end
		`\s+S\d{2}E\d{2}`: "",                // Remove season/episode info
		`\s+Chapter\s+\d+`: " - Chapter",     // Simplify chapter info
		`\s+Part\s+\d+`: " - Part",           // Simplify part info
		`\s+Vol\s+\d+`: " - Volume",          // Simplify volume info
	}
	
	for pattern, replacement := range patterns {
		re := regexp.MustCompile(pattern)
		title = re.ReplaceAllString(title, replacement)
	}
	
	// Clean up multiple spaces
	re = regexp.MustCompile(`\s+`)
	title = re.ReplaceAllString(title, " ")
	
	// Trim and capitalize first letter of each word
	title = strings.TrimSpace(title)
	words := strings.Fields(title)
	for i, word := range words {
		if len(word) > 0 {
			// Don't capitalize common articles/prepositions unless they're the first word
			if i > 0 && isCommonWord(strings.ToLower(word)) {
				words[i] = strings.ToLower(word)
			} else {
				words[i] = strings.Title(strings.ToLower(word))
			}
		}
	}
	
	title = strings.Join(words, " ")
	
	// If title is empty or too short, use a default
	if len(title) < 2 {
		title = "Preview Video"
	}
	
	return title
}

// isValidVideoFile checks if a file is a valid video file
func isValidVideoFile(filename, previewDir string) bool {
	// Check file extension
	ext := strings.ToLower(filepath.Ext(filename))
	validExtensions := []string{".mp4", ".webm", ".mov", ".avi", ".mkv"}
	
	isValidExt := false
	for _, validExt := range validExtensions {
		if ext == validExt {
			isValidExt = true
			break
		}
	}
	
	if !isValidExt {
		return false
	}
	
	// Check file size (must be > 1KB to be valid)
	filePath := filepath.Join(previewDir, filename)
	fileInfo, err := os.Stat(filePath)
	if err != nil {
		return false
	}
	
	// File must be at least 1KB and less than 500MB
	fileSize := fileInfo.Size()
	if fileSize < 1024 || fileSize > 500*1024*1024 {
		return false
	}
	
	return true
}

// isCommonWord checks if a word should remain lowercase in titles
func isCommonWord(word string) bool {
	commonWords := map[string]bool{
		"a": true, "an": true, "and": true, "as": true, "at": true,
		"but": true, "by": true, "for": true, "if": true, "in": true,
		"is": true, "it": true, "of": true, "on": true, "or": true,
		"the": true, "to": true, "up": true, "via": true, "with": true,
	}
	return commonWords[word]
}