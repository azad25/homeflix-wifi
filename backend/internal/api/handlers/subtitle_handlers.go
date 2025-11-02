package handlers

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"homeflix-backend/internal/models"
	"homeflix-backend/internal/services"

	"github.com/gin-gonic/gin"
)

// UploadSubtitle handles subtitle file uploads for a specific media item
func UploadSubtitle(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		mediaIDStr := c.Param("id")
		mediaID, err := strconv.Atoi(mediaIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
			return
		}

		// Get media to ensure it exists
		media, err := mediaService.GetMediaByID(uint(mediaID))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		// Get uploaded file
		file, header, err := c.Request.FormFile("subtitle")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No subtitle file provided"})
			return
		}
		defer file.Close()

		// Validate file extension
		ext := strings.ToLower(filepath.Ext(header.Filename))
		validExts := map[string]bool{
			".srt": true, ".vtt": true, ".ass": true, 
			".ssa": true, ".sub": true, ".sbv": true,
		}
		if !validExts[ext] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid subtitle format. Supported: .srt, .vtt, .ass, .ssa, .sub, .sbv"})
			return
		}

		// Get language from form or extract from filename
		language := c.PostForm("language")
		if language == "" {
			language = extractLanguageFromFilename(header.Filename)
		}

		// Create subtitles directory if it doesn't exist
		subtitlesDir := "subtitles"
		if err := os.MkdirAll(subtitlesDir, 0755); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create subtitles directory"})
			return
		}

		// Generate filename: media_id_language.ext
		filename := fmt.Sprintf("%d_%s%s", mediaID, strings.ToLower(language), ext)
		filePath := filepath.Join(subtitlesDir, filename)

		// Save file to disk
		dst, err := os.Create(filePath)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create subtitle file"})
			return
		}
		defer dst.Close()

		if _, err := io.Copy(dst, file); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save subtitle file"})
			return
		}

		// Create subtitle track entry
		subtitleTrack := &models.SubtitleTrack{
			MediaID:     media.ID,
			StreamIndex: -1, // External subtitles don't have stream index
			Language:    language,
			Title:       fmt.Sprintf("%s (Uploaded)", language),
			CodecName:   strings.TrimPrefix(ext, "."),
			FilePath:    filePath,
			Format:      strings.TrimPrefix(ext, "."),
			TrackType:   "external",
			IsDefault:   false,
			IsForced:    false,
			IsHearing:   strings.Contains(strings.ToLower(header.Filename), "cc") || 
						strings.Contains(strings.ToLower(header.Filename), "sdh"),
		}

		err = mediaService.CreateSubtitleTrack(subtitleTrack)
		if err != nil {
			// Clean up file if database operation fails
			os.Remove(filePath)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create subtitle track"})
			return
		}

		// Also create legacy subtitle entry for backward compatibility
		subtitle := &models.Subtitle{
			MediaID:  media.ID,
			Language: language,
			FilePath: filePath,
			Format:   strings.TrimPrefix(ext, "."),
		}

		err = mediaService.CreateSubtitle(subtitle)
		if err != nil {
			// Log warning but don't fail the request
			fmt.Printf("Warning: Failed to create legacy subtitle entry: %v\n", err)
		}

		c.JSON(http.StatusOK, gin.H{
			"message":  "Subtitle uploaded successfully",
			"language": language,
			"format":   strings.TrimPrefix(ext, "."),
			"path":     filePath,
			"trackId":  subtitleTrack.ID,
		})
	}
}

// DeleteSubtitle removes a subtitle track and its associated file
func DeleteSubtitle(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		mediaIDStr := c.Param("id")
		trackIDStr := c.Param("trackId")
		
		mediaID, err := strconv.Atoi(mediaIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
			return
		}

		trackID, err := strconv.Atoi(trackIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid track ID"})
			return
		}

		// Get subtitle track
		tracks, err := mediaService.GetSubtitleTracks(uint(mediaID))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get subtitle tracks"})
			return
		}

		var targetTrack *models.SubtitleTrack
		for _, track := range tracks {
			if track.ID == uint(trackID) {
				targetTrack = &track
				break
			}
		}

		if targetTrack == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Subtitle track not found"})
			return
		}

		// Delete file if it's an external subtitle
		if targetTrack.TrackType == "external" && targetTrack.FilePath != "" {
			if err := os.Remove(targetTrack.FilePath); err != nil {
				fmt.Printf("Warning: Failed to delete subtitle file %s: %v\n", targetTrack.FilePath, err)
			}
		}

		// Delete from database
		err = mediaService.DeleteSubtitleTrack(uint(trackID))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete subtitle track"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Subtitle deleted successfully"})
	}
}



// GetUnmatchedSubtitles returns subtitle files that couldn't be matched to media
func GetUnmatchedSubtitles(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		// This would require implementing a way to track unmatched subtitles
		// For now, return empty array
		c.JSON(http.StatusOK, gin.H{
			"unmatchedSubtitles": []string{},
			"message": "Unmatched subtitle tracking not yet implemented",
		})
	}
}

// TestSubtitles tests subtitle functionality for a media item
func TestSubtitles(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		mediaIDStr := c.Param("id")
		mediaID, err := strconv.Atoi(mediaIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
			return
		}

		// Get media
		media, err := mediaService.GetMediaByID(uint(mediaID))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		// Get subtitle tracks
		tracks, err := mediaService.GetSubtitleTracks(uint(mediaID))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to get subtitle tracks",
				"details": err.Error(),
			})
			return
		}

		// Test each track
		trackTests := make([]map[string]interface{}, 0)
		for _, track := range tracks {
			trackTest := map[string]interface{}{
				"id": track.ID,
				"language": track.Language,
				"track_type": track.TrackType,
				"file_path": track.FilePath,
				"exists": false,
				"readable": false,
				"size": 0,
			}

			if track.TrackType == "external" && track.FilePath != "" {
				if stat, err := os.Stat(track.FilePath); err == nil {
					trackTest["exists"] = true
					trackTest["size"] = stat.Size()
					
					// Test if file is readable
					if file, err := os.Open(track.FilePath); err == nil {
						trackTest["readable"] = true
						file.Close()
					}
				}
			} else if track.TrackType == "internal" {
				trackTest["exists"] = true // Internal tracks exist if the video exists
				trackTest["readable"] = true
			}

			trackTests = append(trackTests, trackTest)
		}

		c.JSON(http.StatusOK, gin.H{
			"media_id": mediaID,
			"media_title": media.Title,
			"media_path": media.FilePath,
			"track_count": len(tracks),
			"tracks": trackTests,
		})
	}
}

// extractLanguageFromFilename extracts language from subtitle filename
func extractLanguageFromFilename(filename string) string {
	langPatterns := map[string]string{
		"en": "English", "eng": "English", "english": "English",
		"es": "Spanish", "spa": "Spanish", "spanish": "Spanish",
		"fr": "French", "fre": "French", "french": "French",
		"de": "German", "ger": "German", "german": "German",
		"it": "Italian", "ita": "Italian", "italian": "Italian",
		"pt": "Portuguese", "por": "Portuguese", "portuguese": "Portuguese",
		"ru": "Russian", "rus": "Russian", "russian": "Russian",
		"ja": "Japanese", "jpn": "Japanese", "japanese": "Japanese",
		"ko": "Korean", "kor": "Korean", "korean": "Korean",
		"zh": "Chinese", "chi": "Chinese", "chinese": "Chinese",
		"ar": "Arabic", "ara": "Arabic", "arabic": "Arabic",
		"nl": "Dutch", "dut": "Dutch", "dutch": "Dutch",
		"sv": "Swedish", "swe": "Swedish", "swedish": "Swedish",
		"no": "Norwegian", "nor": "Norwegian", "norwegian": "Norwegian",
		"da": "Danish", "dan": "Danish", "danish": "Danish",
		"fi": "Finnish", "fin": "Finnish", "finnish": "Finnish",
		"pl": "Polish", "pol": "Polish", "polish": "Polish",
		"tr": "Turkish", "tur": "Turkish", "turkish": "Turkish",
		"he": "Hebrew", "heb": "Hebrew", "hebrew": "Hebrew",
		"th": "Thai", "tha": "Thai", "thai": "Thai",
		"vi": "Vietnamese", "vie": "Vietnamese", "vietnamese": "Vietnamese",
	}

	lowerFilename := strings.ToLower(filename)
	
	// Try to find language patterns in filename
	for code, language := range langPatterns {
		patterns := []string{
			fmt.Sprintf(`\.%s\.`, code),
			fmt.Sprintf(`_%s_`, code),
			fmt.Sprintf(`-%s-`, code),
			fmt.Sprintf(`\.%s$`, code),
			fmt.Sprintf(`_%s$`, code),
			fmt.Sprintf(`-%s$`, code),
		}
		
		for _, pattern := range patterns {
			matched, _ := regexp.MatchString(pattern, lowerFilename)
			if matched {
				return language
			}
		}
	}
	
	return "Unknown"
}