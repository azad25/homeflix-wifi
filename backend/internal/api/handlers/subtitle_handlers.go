package handlers

import (
	"archive/zip"
	"bytes"
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
			fmt.Printf("❌ Failed to create subtitles directory: %v\n", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create subtitles directory"})
			return
		}
		fmt.Printf("📁 Subtitles directory ready: %s\n", subtitlesDir)

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

// SearchOpenSubtitles searches for subtitles using OpenSubtitles API
func SearchOpenSubtitles(openSubService *services.OpenSubtitlesService) gin.HandlerFunc {
	return func(c *gin.Context) {
		query := c.Query("query")
		if query == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Query parameter is required"})
			return
		}

		language := c.Query("language")
		if language == "" {
			language = "en" // Default to English
		}

		year := c.Query("year")
		imdbID := c.Query("imdb_id")
		tmdbID := c.Query("tmdb_id")

		fmt.Printf("🔍 OpenSubtitles Search Request: query=%s, language=%s, year=%s\n", query, language, year)

		searchReq := services.SubtitleSearchRequest{
			Query:    query,
			Language: language,
			Year:     year,
			ImdbID:   imdbID,
			TmdbID:   tmdbID,
		}

		result, err := openSubService.SearchSubtitles(searchReq)
		if err != nil {
			fmt.Printf("❌ OpenSubtitles search error: %v\n", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		fmt.Printf("✅ OpenSubtitles search completed: %d results\n", len(result.Data))
		c.JSON(http.StatusOK, result)
	}
}

// DownloadOpenSubtitle downloads a subtitle from OpenSubtitles and saves it to the media
func DownloadOpenSubtitle(mediaService *services.MediaService, openSubService *services.OpenSubtitlesService) gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if r := recover(); r != nil {
				fmt.Printf("❌ PANIC in DownloadOpenSubtitle: %v\n", r)
				c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Internal server error: %v", r)})
			}
		}()

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

		// Get file_id from request body
		var requestBody struct {
			FileID   int    `json:"file_id" binding:"required"`
			Language string `json:"language"`
			FileName string `json:"file_name"`
		}

		if err := c.ShouldBindJSON(&requestBody); err != nil {
			fmt.Printf("❌ JSON binding error: %v\n", err)
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": err.Error()})
			return
		}

		fmt.Printf("📥 Downloading subtitle: fileID=%d, language=%s, mediaID=%d\n", requestBody.FileID, requestBody.Language, mediaID)

		// Download subtitle from OpenSubtitles
		downloadResp, subtitleData, err := openSubService.DownloadSubtitle(requestBody.FileID)
		if err != nil {
			fmt.Printf("❌ Download error: %v\n", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Download failed: %v", err)})
			return
		}

		if subtitleData == nil || len(subtitleData) == 0 {
			fmt.Printf("❌ Downloaded subtitle data is empty\n")
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Downloaded subtitle data is empty"})
			return
		}

		fmt.Printf("✅ Downloaded %d bytes of subtitle data\n", len(subtitleData))

		// Check if the downloaded file is a ZIP and extract if needed
		var finalSubtitleData []byte
		var finalFilename string
		
		// Try to detect if it's a ZIP file
		if len(subtitleData) > 4 && subtitleData[0] == 0x50 && subtitleData[1] == 0x4b && 
		   subtitleData[2] == 0x03 && subtitleData[3] == 0x04 {
			fmt.Println("📦 Detected ZIP file, extracting...")
			
			// Extract from ZIP
			reader, err := zip.NewReader(bytes.NewReader(subtitleData), int64(len(subtitleData)))
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to read ZIP file: %v", err)})
				return
			}
			
			// Find the first .srt file
			found := false
			for _, file := range reader.File {
				if strings.HasSuffix(strings.ToLower(file.Name), ".srt") {
					f, err := file.Open()
					if err != nil {
						continue
					}
					defer f.Close()
					
					extractedData, err := io.ReadAll(f)
					if err != nil {
						continue
					}
					
					finalSubtitleData = extractedData
					finalFilename = file.Name
					found = true
					fmt.Printf("📦 Extracted SRT from ZIP: %s (%d bytes)\n", file.Name, len(extractedData))
					break
				}
			}
			
			if !found {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "No .srt file found in ZIP archive"})
				return
			}
		} else {
			finalSubtitleData = subtitleData
			if downloadResp.FileName != "" {
				finalFilename = downloadResp.FileName
			} else {
				finalFilename = fmt.Sprintf("subtitle_%d.srt", mediaID)
			}
		}

		// Determine language
		language := requestBody.Language
		if language == "" {
			if finalFilename != "" {
				language = openSubService.ExtractLanguageFromFilename(finalFilename)
			} else if downloadResp.FileName != "" {
				language = openSubService.ExtractLanguageFromFilename(downloadResp.FileName)
			} else {
				language = "English"
			}
		}
		
		// Clean language for filename
		cleanLanguage := strings.ToLower(strings.ReplaceAll(strings.ReplaceAll(language, " ", "_"), "/", "_"))

		// Create subtitles directory if it doesn't exist
		subtitlesDir := "subtitles"
		if err := os.MkdirAll(subtitlesDir, 0755); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create subtitles directory"})
			return
		}

		// Generate filename: media_id_language.srt
		filename := fmt.Sprintf("%d_%s.srt", mediaID, cleanLanguage)
		filePath := filepath.Join(subtitlesDir, filename)

		// Ensure the subtitles directory exists with proper permissions
		if err := os.MkdirAll(subtitlesDir, 0755); err != nil {
			fmt.Printf("❌ Failed to ensure subtitles directory: %v\n", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create subtitles directory"})
			return
		}

		// Save subtitle file to disk
		if err := os.WriteFile(filePath, finalSubtitleData, 0644); err != nil {
			fmt.Printf("❌ Failed to save subtitle file: %v\n", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save subtitle file"})
			return
		}
		
		fmt.Printf("💾 Saved subtitle file to: %s (%d bytes)\n", filePath, len(finalSubtitleData))
		
		// Verify the file was actually written
		if stat, err := os.Stat(filePath); err != nil {
			fmt.Printf("❌ Failed to verify saved subtitle file: %v\n", err)
		} else {
			fmt.Printf("✅ Verified subtitle file: %s (size: %d bytes)\n", filePath, stat.Size())
		}

		// Create subtitle track entry
		subtitleTrack := &models.SubtitleTrack{
			MediaID:     media.ID,
			StreamIndex: -1, // External subtitles don't have stream index
			Language:    language,
			Title:       fmt.Sprintf("%s (OpenSubtitles)", language),
			CodecName:   "srt",
			FilePath:    filePath,
			Format:      "srt",
			TrackType:   "external",
			IsDefault:   false,
			IsForced:    false,
			IsHearing:   false,
		}

		fmt.Printf("💾 Creating subtitle track in database: MediaID=%d, Language=%s, FilePath=%s\n", 
			subtitleTrack.MediaID, subtitleTrack.Language, subtitleTrack.FilePath)
		
		err = mediaService.CreateSubtitleTrack(subtitleTrack)
		if err != nil {
			// Clean up file if database operation fails
			fmt.Printf("❌ Failed to create subtitle track in database: %v\n", err)
			os.Remove(filePath)
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to create subtitle track: %v", err)})
			return
		}
		
		fmt.Printf("✅ Subtitle track created successfully with ID: %d\n", subtitleTrack.ID)

		// Also create legacy subtitle entry for backward compatibility
		subtitle := &models.Subtitle{
			MediaID:  media.ID,
			Language: language,
			FilePath: filePath,
			Format:   "srt",
		}

		err = mediaService.CreateSubtitle(subtitle)
		if err != nil {
			// Log warning but don't fail the request
			fmt.Printf("⚠️  Failed to create legacy subtitle entry: %v\n", err)
		} else {
			fmt.Printf("✅ Legacy subtitle entry created successfully\n")
		}

		c.JSON(http.StatusOK, gin.H{
			"message":     "Subtitle downloaded and added successfully",
			"language":    language,
			"format":      "srt",
			"path":        filePath,
			"trackId":     subtitleTrack.ID,
			"file_name":   downloadResp.FileName,
			"remaining":   downloadResp.Remaining,
		})
	}
}

// GetOpenSubtitlesLanguages returns supported languages for OpenSubtitles
func GetOpenSubtitlesLanguages(openSubService *services.OpenSubtitlesService) gin.HandlerFunc {
	return func(c *gin.Context) {
		languages := openSubService.GetSupportedLanguages()
		c.JSON(http.StatusOK, gin.H{"languages": languages})
	}
}

// SearchOpenSubtitlesStandalone searches for subtitles without requiring a specific media item
func SearchOpenSubtitlesStandalone(openSubService *services.OpenSubtitlesService) gin.HandlerFunc {
	return func(c *gin.Context) {
		query := c.Query("query")
		if query == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Query parameter is required"})
			return
		}

		language := c.Query("language")
		if language == "" {
			language = "en" // Default to English
		}

		year := c.Query("year")
		imdbID := c.Query("imdb_id")
		tmdbID := c.Query("tmdb_id")

		fmt.Printf("🔍 Standalone OpenSubtitles Search: query=%s, language=%s, year=%s\n", query, language, year)

		searchReq := services.SubtitleSearchRequest{
			Query:    query,
			Language: language,
			Year:     year,
			ImdbID:   imdbID,
			TmdbID:   tmdbID,
		}

		result, err := openSubService.SearchSubtitles(searchReq)
		if err != nil {
			fmt.Printf("❌ Standalone OpenSubtitles search error: %v\n", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		fmt.Printf("✅ Standalone OpenSubtitles search completed: %d results\n", len(result.Data))
		
		// Transform the results to include more user-friendly information
		transformedResults := make([]map[string]interface{}, 0, len(result.Data))
		for _, item := range result.Data {
			if len(item.Attributes.Files) > 0 {
				transformedResult := map[string]interface{}{
					"id":           item.ID,
					"file_id":      item.Attributes.Files[0].FileID,
					"file_name":    item.Attributes.Files[0].FileName,
					"language":     item.Attributes.Language,
					"downloads":    item.Attributes.DownloadCount,
					"rating":       item.Attributes.Ratings,
					"votes":        item.Attributes.Votes,
					"hearing_impaired": item.Attributes.HearingImpaired,
					"hd":           item.Attributes.HD,
					"fps":          item.Attributes.FPS,
					"release":      item.Attributes.Release,
					"comments":     item.Attributes.Comments,
					"uploader":     item.Attributes.Uploader.Name,
					"uploader_rank": item.Attributes.Uploader.Rank,
				}

				// Add feature details if available
				if item.Attributes.FeatureDetails.Title != "" {
					transformedResult["movie_title"] = item.Attributes.FeatureDetails.Title
					transformedResult["movie_year"] = item.Attributes.FeatureDetails.Year
					transformedResult["imdb_id"] = item.Attributes.FeatureDetails.ImdbID
					transformedResult["tmdb_id"] = item.Attributes.FeatureDetails.TmdbID
				}

				transformedResults = append(transformedResults, transformedResult)
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"data":        transformedResults,
			"total_count": result.TotalCount,
			"total_pages": result.TotalPages,
			"page":        result.Page,
		})
	}
}

// DownloadOpenSubtitleDirect downloads a subtitle from OpenSubtitles and returns it as a file (without saving to media)
func DownloadOpenSubtitleDirect(openSubService *services.OpenSubtitlesService) gin.HandlerFunc {
	return func(c *gin.Context) {
		fileIDStr := c.Query("file_id")
		if fileIDStr == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "file_id parameter is required"})
			return
		}

		fileID := 0
		_, err := fmt.Sscanf(fileIDStr, "%d", &fileID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid file_id format"})
			return
		}

		fmt.Printf("📥 Direct download requested for fileID: %d\n", fileID)

		// Download subtitle from OpenSubtitles
		downloadResp, subtitleData, err := openSubService.DownloadSubtitle(fileID)
		if err != nil {
			fmt.Printf("❌ Download error: %v\n", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Download failed: %v", err)})
			return
		}

		if subtitleData == nil || len(subtitleData) == 0 {
			fmt.Printf("❌ Downloaded subtitle data is empty\n")
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Downloaded subtitle data is empty"})
			return
		}

		fmt.Printf("✅ Downloaded %d bytes of subtitle data\n", len(subtitleData))

		// Check if the downloaded file is a ZIP and extract if needed
		var finalSubtitleData []byte
		var finalFilename string

		// Try to detect if it's a ZIP file
		if len(subtitleData) > 4 && subtitleData[0] == 0x50 && subtitleData[1] == 0x4b &&
			subtitleData[2] == 0x03 && subtitleData[3] == 0x04 {
			fmt.Println("📦 Detected ZIP file, extracting...")

			// Extract from ZIP
			reader, err := zip.NewReader(bytes.NewReader(subtitleData), int64(len(subtitleData)))
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to read ZIP file: %v", err)})
				return
			}

			// Find the first subtitle file (.srt, .vtt, .ass, etc.)
			found := false
			for _, file := range reader.File {
				ext := strings.ToLower(filepath.Ext(file.Name))
				if ext == ".srt" || ext == ".vtt" || ext == ".ass" || ext == ".ssa" || ext == ".sub" {
					f, err := file.Open()
					if err != nil {
						continue
					}
					defer f.Close()

					extractedData, err := io.ReadAll(f)
					if err != nil {
						continue
					}

					finalSubtitleData = extractedData
					finalFilename = file.Name
					found = true
					fmt.Printf("📦 Extracted subtitle from ZIP: %s (%d bytes)\n", file.Name, len(extractedData))
					break
				}
			}

			if !found {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "No subtitle file found in ZIP archive"})
				return
			}
		} else {
			finalSubtitleData = subtitleData
			if downloadResp.FileName != "" {
				finalFilename = downloadResp.FileName
			} else {
				finalFilename = "subtitle.srt"
			}
		}

		// Ensure filename has proper extension
		if !strings.HasSuffix(strings.ToLower(finalFilename), ".srt") && 
		   !strings.HasSuffix(strings.ToLower(finalFilename), ".vtt") && 
		   !strings.HasSuffix(strings.ToLower(finalFilename), ".ass") {
			// Remove any existing extension and add .srt
			if dotIndex := strings.LastIndex(finalFilename, "."); dotIndex != -1 {
				finalFilename = finalFilename[:dotIndex]
			}
			finalFilename = finalFilename + ".srt"
		}

		fmt.Printf("📥 Serving file: %s (%d bytes)\n", finalFilename, len(finalSubtitleData))

		// Set headers for file download with proper content type
		contentType := "text/plain; charset=utf-8"
		ext := strings.ToLower(filepath.Ext(finalFilename))
		switch ext {
		case ".srt":
			contentType = "text/srt; charset=utf-8"
		case ".vtt":
			contentType = "text/vtt; charset=utf-8"
		case ".ass":
			contentType = "text/ass; charset=utf-8"
		}
		
		c.Header("Content-Type", contentType)
		c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, finalFilename))
		c.Data(http.StatusOK, contentType, finalSubtitleData)
	}
}