package services

import (
	"fmt"
	"log"
	"os"
	"strings"

	"homeflix-backend/internal/interfaces"
	"homeflix-backend/internal/models"
)

// SubtitleCleanupService handles cleanup of unnecessary subtitle entries
type SubtitleCleanupService struct {
	mediaService interfaces.MediaServiceInterface
}

// NewSubtitleCleanupService creates a new subtitle cleanup service
func NewSubtitleCleanupService(mediaService interfaces.MediaServiceInterface) *SubtitleCleanupService {
	return &SubtitleCleanupService{
		mediaService: mediaService,
	}
}

// CleanupResult holds the results of subtitle cleanup
type CleanupResult struct {
	TotalMedia           int
	MediaProcessed       int
	SubtitlesRemoved     int
	SubtitlesKept        int
	ExternalSubsRemoved  int
	InternalSubsRemoved  int
	Errors               []string
}

// CleanupAllSubtitles removes unnecessary subtitle entries from all media
func (s *SubtitleCleanupService) CleanupAllSubtitles() (*CleanupResult, error) {
	log.Printf("🧹 Starting comprehensive subtitle cleanup...")
	
	result := &CleanupResult{
		Errors: []string{},
	}
	
	// Get all media from database
	allMedia, err := s.mediaService.GetAllMedia()
	if err != nil {
		return result, fmt.Errorf("failed to get media from database: %v", err)
	}
	
	result.TotalMedia = len(allMedia)
	log.Printf("📊 Found %d media items to process", result.TotalMedia)
	
	// Process each media item
	for i, media := range allMedia {
		if (i+1)%100 == 0 {
			log.Printf("📊 Progress: %d/%d media processed", i+1, result.TotalMedia)
		}
		
		mediaResult := s.CleanupMediaSubtitles(&media)
		result.MediaProcessed++
		result.SubtitlesRemoved += mediaResult.SubtitlesRemoved
		result.SubtitlesKept += mediaResult.SubtitlesKept
		result.ExternalSubsRemoved += mediaResult.ExternalSubsRemoved
		result.InternalSubsRemoved += mediaResult.InternalSubsRemoved
		
		if len(mediaResult.Errors) > 0 {
			result.Errors = append(result.Errors, mediaResult.Errors...)
		}
	}
	
	log.Printf("✅ Subtitle cleanup completed!")
	log.Printf("📊 Results:")
	log.Printf("   Total media: %d", result.TotalMedia)
	log.Printf("   Media processed: %d", result.MediaProcessed)
	log.Printf("   Subtitles removed: %d", result.SubtitlesRemoved)
	log.Printf("   Subtitles kept: %d", result.SubtitlesKept)
	log.Printf("   External subs removed: %d", result.ExternalSubsRemoved)
	log.Printf("   Internal subs removed: %d", result.InternalSubsRemoved)
	log.Printf("   Errors: %d", len(result.Errors))
	
	return result, nil
}

// MediaCleanupResult holds cleanup results for a single media item
type MediaCleanupResult struct {
	SubtitlesRemoved    int
	SubtitlesKept       int
	ExternalSubsRemoved int
	InternalSubsRemoved int
	Errors              []string
}

// CleanupMediaSubtitles cleans up subtitles for a single media item
func (s *SubtitleCleanupService) CleanupMediaSubtitles(media *models.Media) *MediaCleanupResult {
	result := &MediaCleanupResult{
		Errors: []string{},
	}
	
	// Get all subtitle tracks for this media
	tracks, err := s.mediaService.GetSubtitleTracks(media.ID)
	if err != nil {
		result.Errors = append(result.Errors, fmt.Sprintf("Media %d: failed to get subtitle tracks: %v", media.ID, err))
		return result
	}
	
	if len(tracks) == 0 {
		log.Printf("⚠️ No subtitle tracks found for: %s (ID: %d)", media.Title, media.ID)
		return result // No subtitles to clean
	}
	
	log.Printf("🔍 Processing %d subtitle tracks for: %s (ID: %d)", len(tracks), media.Title, media.ID)
	
	// Separate tracks by type
	var internalTracks []models.SubtitleTrack
	var externalTracks []models.SubtitleTrack
	
	for _, track := range tracks {
		if track.TrackType == "internal" {
			internalTracks = append(internalTracks, track)
		} else {
			externalTracks = append(externalTracks, track)
		}
	}
	
	// Track if we have any valid English subtitles
	hasValidEnglishSubtitle := false
	
	// Process internal tracks - keep only the LAST (most recent) valid English subtitle
	validInternalEnglish := []models.SubtitleTrack{}
	invalidInternal := []models.SubtitleTrack{}
	
	for _, track := range internalTracks {
		if s.shouldKeepInternalTrack(&track) {
			validInternalEnglish = append(validInternalEnglish, track)
		} else {
			invalidInternal = append(invalidInternal, track)
		}
	}
	
	// Sort valid English internal tracks by ID (newer tracks have higher IDs)
	// Keep only the LAST one (highest ID = most recent)
	if len(validInternalEnglish) > 0 {
		// Sort by ID descending (newest first)
		for i := 0; i < len(validInternalEnglish)-1; i++ {
			for j := i + 1; j < len(validInternalEnglish); j++ {
				if validInternalEnglish[i].ID < validInternalEnglish[j].ID {
					validInternalEnglish[i], validInternalEnglish[j] = validInternalEnglish[j], validInternalEnglish[i]
				}
			}
		}
		
		// Keep the first one (newest/highest ID)
		keepTrack := validInternalEnglish[0]
		result.SubtitlesKept++
		hasValidEnglishSubtitle = true
		log.Printf("✅ Keeping NEWEST internal subtitle: %s (%s) - codec: %s (ID: %d)", keepTrack.Language, keepTrack.Title, keepTrack.CodecName, keepTrack.ID)
		
		// Delete all older duplicates
		for i := 1; i < len(validInternalEnglish); i++ {
			track := validInternalEnglish[i]
			if err := s.mediaService.DeleteSubtitleTrack(track.ID); err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("Failed to delete duplicate internal track %d: %v", track.ID, err))
			} else {
				result.SubtitlesRemoved++
				result.InternalSubsRemoved++
				log.Printf("🗑️ Removed OLDER duplicate internal subtitle: %s (%s) - ID: %d", track.Language, track.Title, track.ID)
			}
		}
	}
	
	// Delete all invalid internal tracks
	for _, track := range invalidInternal {
		if err := s.mediaService.DeleteSubtitleTrack(track.ID); err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("Failed to delete internal track %d: %v", track.ID, err))
		} else {
			result.SubtitlesRemoved++
			result.InternalSubsRemoved++
			log.Printf("🗑️ Removed internal subtitle: %s (%s) - reason: %s", track.Language, track.Title, s.getRemovalReason(&track))
		}
	}
	
	// Process external tracks - keep only the LAST (most recent) valid English subtitle
	validExternalEnglish := []models.SubtitleTrack{}
	invalidExternal := []models.SubtitleTrack{}
	
	for _, track := range externalTracks {
		if s.shouldKeepExternalTrack(&track) {
			validExternalEnglish = append(validExternalEnglish, track)
		} else {
			invalidExternal = append(invalidExternal, track)
		}
	}
	
	// Sort valid English external tracks by ID (newer tracks have higher IDs)
	// Keep only the LAST one (highest ID = most recent)
	if len(validExternalEnglish) > 0 {
		// Sort by ID descending (newest first)
		for i := 0; i < len(validExternalEnglish)-1; i++ {
			for j := i + 1; j < len(validExternalEnglish); j++ {
				if validExternalEnglish[i].ID < validExternalEnglish[j].ID {
					validExternalEnglish[i], validExternalEnglish[j] = validExternalEnglish[j], validExternalEnglish[i]
				}
			}
		}
		
		// Keep the first one (newest/highest ID)
		keepTrack := validExternalEnglish[0]
		result.SubtitlesKept++
		hasValidEnglishSubtitle = true
		log.Printf("✅ Keeping NEWEST external subtitle: %s (%s) - ID: %d", keepTrack.Language, keepTrack.FilePath, keepTrack.ID)
		
		// Delete all older duplicates
		for i := 1; i < len(validExternalEnglish); i++ {
			track := validExternalEnglish[i]
			if err := s.mediaService.DeleteSubtitleTrack(track.ID); err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("Failed to delete duplicate external track %d: %v", track.ID, err))
			} else {
				result.SubtitlesRemoved++
				result.ExternalSubsRemoved++
				log.Printf("🗑️ Removed OLDER duplicate external subtitle: %s (%s) - ID: %d", track.Language, track.FilePath, track.ID)
			}
		}
	}
	
	// Delete all invalid external tracks
	for _, track := range invalidExternal {
		if err := s.mediaService.DeleteSubtitleTrack(track.ID); err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("Failed to delete external track %d: %v", track.ID, err))
		} else {
			result.SubtitlesRemoved++
			result.ExternalSubsRemoved++
			log.Printf("🗑️ Removed external subtitle: %s (%s)", track.Language, track.FilePath)
		}
	}
	
	// Also clean up legacy subtitle entries
	legacySubtitles, err := s.mediaService.GetSubtitles(media.ID)
	if err == nil && len(legacySubtitles) > 0 {
		log.Printf("🧹 Cleaning up %d legacy subtitle entries for: %s", len(legacySubtitles), media.Title)
		for _, sub := range legacySubtitles {
			if err := s.mediaService.DeleteSubtitle(sub.ID); err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("Failed to delete legacy subtitle %d: %v", sub.ID, err))
			}
		}
	}
	
	// CRITICAL: Check if media has at least one valid English subtitle
	if !hasValidEnglishSubtitle {
		log.Printf("⚠️ WARNING: Media '%s' (ID: %d) has NO valid English subtitles after cleanup!", media.Title, media.ID)
		log.Printf("   This media will need subtitle download via /api/subtitles/download/%d", media.ID)
	}
	
	return result
}

// getRemovalReason returns a human-readable reason for subtitle removal
func (s *SubtitleCleanupService) getRemovalReason(track *models.SubtitleTrack) string {
	language := strings.ToLower(track.Language)
	englishCodes := []string{"en", "eng", "english", "en-us", "en-gb"}
	
	isEnglish := false
	for _, code := range englishCodes {
		if language == code {
			isEnglish = true
			break
		}
	}
	
	if !isEnglish {
		return "non-English language"
	}
	
	supportedCodecs := []string{"srt", "ass", "ssa", "subrip", "webvtt", "vtt", "mov_text", "text"}
	codecLower := strings.ToLower(track.CodecName)
	
	for _, codec := range supportedCodecs {
		if strings.Contains(codecLower, codec) {
			return "unknown"
		}
	}
	
	return fmt.Sprintf("unsupported codec (%s)", track.CodecName)
}

// shouldKeepInternalTrack determines if an internal subtitle track should be kept
func (s *SubtitleCleanupService) shouldKeepInternalTrack(track *models.SubtitleTrack) bool {
	// Keep only English internal subtitles
	language := strings.ToLower(track.Language)
	
	// English language codes
	englishCodes := []string{"en", "eng", "english", "en-us", "en-gb"}
	
	isEnglish := false
	for _, code := range englishCodes {
		if language == code {
			isEnglish = true
			break
		}
	}
	
	if !isEnglish {
		return false
	}
	
	// Additional validation: Check if codec is supported
	// Some internal subtitles might be in unsupported formats
	supportedCodecs := []string{"srt", "ass", "ssa", "subrip", "webvtt", "vtt", "mov_text", "text"}
	codecLower := strings.ToLower(track.CodecName)
	
	codecSupported := false
	for _, codec := range supportedCodecs {
		if strings.Contains(codecLower, codec) {
			codecSupported = true
			break
		}
	}
	
	if !codecSupported {
		log.Printf("⚠️ Internal subtitle has unsupported codec: %s (track: %s)", track.CodecName, track.Language)
		return false
	}
	
	return true
}

// shouldKeepExternalTrack determines if an external subtitle track should be kept
func (s *SubtitleCleanupService) shouldKeepExternalTrack(track *models.SubtitleTrack) bool {
	// Check if file path is provided
	if track.FilePath == "" {
		log.Printf("⚠️ External subtitle has empty file path")
		return false
	}
	
	// Check file existence
	fileInfo, err := os.Stat(track.FilePath)
	if os.IsNotExist(err) {
		log.Printf("⚠️ External subtitle file not found: %s", track.FilePath)
		return false
	}
	if err != nil {
		log.Printf("⚠️ Error checking external subtitle file: %s - %v", track.FilePath, err)
		return false
	}
	
	// Check if file is not empty (at least 100 bytes for a valid subtitle)
	if fileInfo.Size() < 100 {
		log.Printf("⚠️ External subtitle file too small (likely empty or corrupted): %s (%d bytes)", track.FilePath, fileInfo.Size())
		return false
	}
	
	// Verify file extension is a subtitle format
	validExtensions := []string{".srt", ".ass", ".ssa", ".vtt", ".sub", ".sbv"}
	hasValidExtension := false
	fileLower := strings.ToLower(track.FilePath)
	for _, ext := range validExtensions {
		if strings.HasSuffix(fileLower, ext) {
			hasValidExtension = true
			break
		}
	}
	
	if !hasValidExtension {
		log.Printf("⚠️ External subtitle has invalid extension: %s", track.FilePath)
		return false
	}
	
	// Keep only English external subtitles
	language := strings.ToLower(track.Language)
	englishCodes := []string{"en", "eng", "english", "en-us", "en-gb"}
	
	isEnglish := false
	for _, code := range englishCodes {
		if language == code {
			isEnglish = true
			break
		}
	}
	
	if !isEnglish {
		return false
	}
	
	// Additional validation: Try to read first few lines to verify it's a valid subtitle file
	if !s.validateSubtitleFileContent(track.FilePath) {
		log.Printf("⚠️ External subtitle file appears to be corrupted or invalid: %s", track.FilePath)
		return false
	}
	
	return true
}

// validateSubtitleFileContent performs basic validation on subtitle file content
func (s *SubtitleCleanupService) validateSubtitleFileContent(filePath string) bool {
	file, err := os.Open(filePath)
	if err != nil {
		return false
	}
	defer file.Close()
	
	// Read first 1KB to check if it looks like a subtitle file
	buffer := make([]byte, 1024)
	n, err := file.Read(buffer)
	if err != nil && n == 0 {
		return false
	}
	
	content := string(buffer[:n])
	contentLower := strings.ToLower(content)
	
	// Check for common subtitle format markers
	// SRT format: starts with "1" followed by timestamp
	if strings.Contains(content, "-->") {
		return true
	}
	
	// ASS/SSA format: contains [Script Info] or [Events]
	if strings.Contains(contentLower, "[script info]") || strings.Contains(contentLower, "[events]") {
		return true
	}
	
	// WebVTT format: starts with "WEBVTT"
	if strings.HasPrefix(contentLower, "webvtt") {
		return true
	}
	
	// Check if file contains reasonable text (not binary garbage)
	// Count printable characters
	printableCount := 0
	for _, b := range buffer[:n] {
		if (b >= 32 && b <= 126) || b == '\n' || b == '\r' || b == '\t' {
			printableCount++
		}
	}
	
	// If more than 80% is printable, consider it valid text
	if float64(printableCount)/float64(n) > 0.8 {
		return true
	}
	
	return false
}

// GetSubtitleStats returns statistics about subtitle tracks
func (s *SubtitleCleanupService) GetSubtitleStats() (map[string]interface{}, error) {
	allMedia, err := s.mediaService.GetAllMedia()
	if err != nil {
		return nil, fmt.Errorf("failed to get media: %v", err)
	}
	
	stats := map[string]interface{}{
		"total_media":           len(allMedia),
		"media_with_subtitles":  0,
		"total_subtitle_tracks": 0,
		"internal_tracks":       0,
		"external_tracks":       0,
		"english_tracks":        0,
		"non_english_tracks":    0,
		"missing_files":         0,
	}
	
	for _, media := range allMedia {
		tracks, err := s.mediaService.GetSubtitleTracks(media.ID)
		if err != nil {
			continue
		}
		
		if len(tracks) > 0 {
			stats["media_with_subtitles"] = stats["media_with_subtitles"].(int) + 1
			stats["total_subtitle_tracks"] = stats["total_subtitle_tracks"].(int) + len(tracks)
		}
		
		for _, track := range tracks {
			if track.TrackType == "internal" {
				stats["internal_tracks"] = stats["internal_tracks"].(int) + 1
			} else {
				stats["external_tracks"] = stats["external_tracks"].(int) + 1
				
				// Check if external file exists
				if track.FilePath != "" {
					if _, err := os.Stat(track.FilePath); os.IsNotExist(err) {
						stats["missing_files"] = stats["missing_files"].(int) + 1
					}
				}
			}
			
			// Check language
			language := strings.ToLower(track.Language)
			englishCodes := []string{"en", "eng", "english", "en-us", "en-gb"}
			isEnglish := false
			for _, code := range englishCodes {
				if language == code {
					isEnglish = true
					break
				}
			}
			
			if isEnglish {
				stats["english_tracks"] = stats["english_tracks"].(int) + 1
			} else {
				stats["non_english_tracks"] = stats["non_english_tracks"].(int) + 1
			}
		}
	}
	
	return stats, nil
}
