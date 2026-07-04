package services

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"homeflix-backend/internal/models"
	"homeflix-backend/internal/utils"
)

// SubtitleMatcherService handles intelligent subtitle matching and downloading
type SubtitleMatcherService struct {
	openSubtitlesService *OpenSubtitlesService
	mediaService         *MediaService
}

// NewSubtitleMatcherService creates a new subtitle matcher service
func NewSubtitleMatcherService(openSubtitlesService *OpenSubtitlesService, mediaService *MediaService) *SubtitleMatcherService {
	return &SubtitleMatcherService{
		openSubtitlesService: openSubtitlesService,
		mediaService:         mediaService,
	}
}

// MediaQualityInfo holds extracted quality information from media
type MediaQualityInfo struct {
	Resolution   string   // 1080p, 720p, 4K, etc.
	Source       string   // BluRay, WEB-DL, HDTV, etc.
	Codec        string   // x264, x265, HEVC, etc.
	AudioCodec   string   // AAC, AC3, DTS, etc.
	ReleaseGroup string   // YIFY, RARBG, etc.
	Tags         []string // HDR, 10bit, etc.
	FileName     string   // Original filename
}

// ExtractMediaQuality extracts quality information from media file
func (s *SubtitleMatcherService) ExtractMediaQuality(media *models.Media) *MediaQualityInfo {
	fileName := filepath.Base(media.FilePath)
	fileNameLower := strings.ToLower(fileName)
	
	info := &MediaQualityInfo{
		FileName: fileName,
		Tags:     media.QualityTags,
	}
	
	// Extract resolution
	resolutionPatterns := map[string]string{
		"2160p": "2160p", "4K": "2160p", "UHD": "2160p",
		"1080p": "1080p", "FHD": "1080p",
		"720p": "720p", "HD": "720p",
		"480p": "480p", "SD": "480p",
	}
	
	for pattern, resolution := range resolutionPatterns {
		if strings.Contains(fileNameLower, strings.ToLower(pattern)) {
			info.Resolution = resolution
			break
		}
	}
	
	// Extract source
	sourcePatterns := []string{
		"BluRay", "BRRip", "BDRip", "Blu-Ray",
		"WEB-DL", "WEBRip", "WEB",
		"HDTV", "HDRip",
		"DVDRip", "DVD",
	}
	
	for _, source := range sourcePatterns {
		if strings.Contains(fileNameLower, strings.ToLower(source)) {
			info.Source = source
			break
		}
	}
	
	// Extract codec
	codecPatterns := []string{
		"x265", "H.265", "HEVC",
		"x264", "H.264", "AVC",
		"XviD", "DivX",
	}
	
	for _, codec := range codecPatterns {
		if strings.Contains(fileNameLower, strings.ToLower(codec)) {
			info.Codec = codec
			break
		}
	}
	
	// Extract audio codec
	audioPatterns := []string{
		"DTS", "DTS-HD", "TrueHD", "Atmos",
		"AC3", "EAC3", "DD", "DD+",
		"AAC", "MP3", "FLAC",
	}
	
	for _, audio := range audioPatterns {
		if strings.Contains(fileNameLower, strings.ToLower(audio)) {
			info.AudioCodec = audio
			break
		}
	}
	
	// Extract release group (usually at the end before extension)
	releaseGroupPattern := regexp.MustCompile(`-([A-Z0-9]+)(?:\.[a-z0-9]+)?$`)
	if matches := releaseGroupPattern.FindStringSubmatch(fileName); len(matches) > 1 {
		info.ReleaseGroup = matches[1]
	}
	
	log.Printf("📊 Extracted quality info for %s:", media.Title)
	log.Printf("   Resolution: %s", info.Resolution)
	log.Printf("   Source: %s", info.Source)
	log.Printf("   Codec: %s", info.Codec)
	log.Printf("   Audio: %s", info.AudioCodec)
	log.Printf("   Release Group: %s", info.ReleaseGroup)
	log.Printf("   Tags: %v", info.Tags)
	
	return info
}

// CalculateSubtitleMatchScore calculates how well a subtitle matches the media
func (s *SubtitleMatcherService) CalculateSubtitleMatchScore(subtitle *OpenSubtitleItem, mediaQuality *MediaQualityInfo) float64 {
	score := 0.0
	release := strings.ToLower(subtitle.Attributes.Release)
	comments := strings.ToLower(subtitle.Attributes.Comments)
	fileName := strings.ToLower(subtitle.Attributes.Files[0].FileName)
	
	// Combined text for matching
	combinedText := release + " " + comments + " " + fileName
	
	// Resolution match (highest priority) - 30 points
	if mediaQuality.Resolution != "" {
		resolutionLower := strings.ToLower(mediaQuality.Resolution)
		if strings.Contains(combinedText, resolutionLower) {
			score += 30.0
			log.Printf("   ✅ Resolution match: %s (+30)", mediaQuality.Resolution)
		}
	}
	
	// Source match - 20 points
	if mediaQuality.Source != "" {
		sourceLower := strings.ToLower(mediaQuality.Source)
		if strings.Contains(combinedText, sourceLower) {
			score += 20.0
			log.Printf("   ✅ Source match: %s (+20)", mediaQuality.Source)
		}
	}
	
	// Codec match - 15 points
	if mediaQuality.Codec != "" {
		codecLower := strings.ToLower(mediaQuality.Codec)
		if strings.Contains(combinedText, codecLower) {
			score += 15.0
			log.Printf("   ✅ Codec match: %s (+15)", mediaQuality.Codec)
		}
	}
	
	// Release group match (very important) - 25 points
	if mediaQuality.ReleaseGroup != "" {
		releaseGroupLower := strings.ToLower(mediaQuality.ReleaseGroup)
		if strings.Contains(combinedText, releaseGroupLower) {
			score += 25.0
			log.Printf("   ✅ Release group match: %s (+25)", mediaQuality.ReleaseGroup)
		}
	}
	
	// Audio codec match - 10 points
	if mediaQuality.AudioCodec != "" {
		audioLower := strings.ToLower(mediaQuality.AudioCodec)
		if strings.Contains(combinedText, audioLower) {
			score += 10.0
			log.Printf("   ✅ Audio codec match: %s (+10)", mediaQuality.AudioCodec)
		}
	}
	
	// Quality tags match - 5 points each
	for _, tag := range mediaQuality.Tags {
		tagLower := strings.ToLower(tag)
		if strings.Contains(combinedText, tagLower) {
			score += 5.0
			log.Printf("   ✅ Tag match: %s (+5)", tag)
		}
	}
	
	// Bonus for HD subtitles - 10 points
	if subtitle.Attributes.HD {
		score += 10.0
		log.Printf("   ✅ HD subtitle (+10)")
	}
	
	// Bonus for trusted uploaders - 15 points
	if subtitle.Attributes.FromTrusted {
		score += 15.0
		log.Printf("   ✅ Trusted uploader (+15)")
	}
	
	// Bonus for high ratings - up to 10 points
	if subtitle.Attributes.Ratings > 0 {
		ratingBonus := (subtitle.Attributes.Ratings / 10.0) * 10.0
		score += ratingBonus
		log.Printf("   ✅ Rating bonus: %.1f (+%.1f)", subtitle.Attributes.Ratings, ratingBonus)
	}
	
	// Bonus for download count (popularity) - up to 10 points
	downloadBonus := float64(subtitle.Attributes.DownloadCount) / 1000.0
	if downloadBonus > 10.0 {
		downloadBonus = 10.0
	}
	score += downloadBonus
	log.Printf("   ✅ Download count bonus: %d (+%.1f)", subtitle.Attributes.DownloadCount, downloadBonus)
	
	// Penalty for hearing impaired if not needed - 5 points
	if subtitle.Attributes.HearingImpaired {
		score -= 5.0
		log.Printf("   ⚠️ Hearing impaired (-5)")
	}
	
	// Penalty for machine translated - 20 points
	if subtitle.Attributes.MachineTranslated {
		score -= 20.0
		log.Printf("   ⚠️ Machine translated (-20)")
	}
	
	// Penalty for auto translation - 15 points
	if subtitle.Attributes.AutoTranslation {
		score -= 15.0
		log.Printf("   ⚠️ Auto translation (-15)")
	}
	
	return score
}

// FindBestMatchingSubtitle finds the best matching subtitle from search results
func (s *SubtitleMatcherService) FindBestMatchingSubtitle(searchResults *OpenSubtitlesSearchResult, mediaQuality *MediaQualityInfo) (*OpenSubtitleItem, float64) {
	if len(searchResults.Data) == 0 {
		return nil, 0
	}
	
	var bestSubtitle *OpenSubtitleItem
	var bestScore float64 = 0
	
	log.Printf("🔍 Evaluating %d subtitle candidates...", len(searchResults.Data))
	
	for i, subtitle := range searchResults.Data {
		if len(subtitle.Attributes.Files) == 0 {
			continue
		}
		
		log.Printf("\n📝 Candidate %d: %s", i+1, subtitle.Attributes.Release)
		score := s.CalculateSubtitleMatchScore(&subtitle, mediaQuality)
		log.Printf("   📊 Total score: %.1f", score)
		
		if score > bestScore {
			bestScore = score
			bestSubtitle = &searchResults.Data[i]
			log.Printf("   🏆 New best match!")
		}
	}
	
	if bestSubtitle != nil {
		log.Printf("\n✅ Best match found with score %.1f:", bestScore)
		log.Printf("   Release: %s", bestSubtitle.Attributes.Release)
		log.Printf("   Downloads: %d", bestSubtitle.Attributes.DownloadCount)
		log.Printf("   Rating: %.1f", bestSubtitle.Attributes.Ratings)
		log.Printf("   Trusted: %v", bestSubtitle.Attributes.FromTrusted)
	}
	
	return bestSubtitle, bestScore
}

// DownloadAndSaveSubtitle downloads and saves a subtitle for media
func (s *SubtitleMatcherService) DownloadAndSaveSubtitle(media *models.Media, subtitle *OpenSubtitleItem) error {
	if len(subtitle.Attributes.Files) == 0 {
		return fmt.Errorf("no files available for subtitle")
	}
	
	fileID := subtitle.Attributes.Files[0].FileID
	fileName := subtitle.Attributes.Files[0].FileName
	
	log.Printf("📥 Downloading subtitle: %s (file_id: %d)", fileName, fileID)
	
	// Download the subtitle
	downloadResp, subtitleData, err := s.openSubtitlesService.DownloadSubtitle(fileID)
	if err != nil {
		return fmt.Errorf("failed to download subtitle: %v", err)
	}
	
	// Determine save path
	mediaDir := filepath.Dir(media.FilePath)
	mediaBaseName := strings.TrimSuffix(filepath.Base(media.FilePath), filepath.Ext(media.FilePath))
	
	// Use the original filename extension from download response
	ext := filepath.Ext(downloadResp.FileName)
	if ext == "" {
		ext = ".srt" // Default to SRT
	}
	
	subtitlePath := filepath.Join(mediaDir, mediaBaseName+".en"+ext)

	// Never write garbage to disk: rate-limit/auth error bodies are not subtitles
	if err := validateSubtitleContent(subtitleData, ext); err != nil {
		return fmt.Errorf("downloaded subtitle failed validation: %v", err)
	}

	// Save subtitle file
	if err := os.WriteFile(subtitlePath, subtitleData, 0644); err != nil {
		return fmt.Errorf("failed to save subtitle file: %v", err)
	}
	
	log.Printf("✅ Subtitle saved to: %s", subtitlePath)
	
	// Create subtitle track entry in database
	subtitleTrack := &models.SubtitleTrack{
		MediaID:     media.ID,
		StreamIndex: -1,
		Language:    "en",
		Title:       "English (OpenSubtitles)",
		CodecName:   strings.TrimPrefix(ext, "."),
		FilePath:    subtitlePath,
		Format:      strings.TrimPrefix(ext, "."),
		TrackType:   "external",
		IsDefault:   true,
		IsForced:    false,
		IsHearing:   subtitle.Attributes.HearingImpaired,
	}
	
	if err := s.mediaService.CreateSubtitleTrack(subtitleTrack); err != nil {
		return fmt.Errorf("failed to create subtitle track: %v", err)
	}
	
	log.Printf("✅ Subtitle track created in database")
	return nil
}

// pickBestHashMatch returns the most-downloaded subtitle flagged as a
// moviehash match (ripped from the same release), or nil if there is none.
func pickBestHashMatch(results *OpenSubtitlesSearchResult) *OpenSubtitleItem {
	var best *OpenSubtitleItem
	for i := range results.Data {
		item := &results.Data[i]
		if !item.Attributes.MovieHashMatch || item.Attributes.MachineTranslated || len(item.Attributes.Files) == 0 {
			continue
		}
		if best == nil || item.Attributes.DownloadCount > best.Attributes.DownloadCount {
			best = item
		}
	}
	return best
}

// validateSubtitleContent rejects empty or non-subtitle payloads (API error
// bodies used to be written straight to .srt files as "empty subtitles").
func validateSubtitleContent(data []byte, ext string) error {
	if len(data) < 20 {
		return fmt.Errorf("subtitle payload too small (%d bytes)", len(data))
	}
	head := strings.TrimLeft(string(data[:min(len(data), 2048)]), "\xef\xbb\xbf \t\r\n")
	if strings.HasPrefix(head, "{") || strings.HasPrefix(head, "<!DOCTYPE") || strings.HasPrefix(head, "<html") {
		return fmt.Errorf("payload looks like an API error page, not a subtitle")
	}
	switch strings.ToLower(strings.TrimPrefix(ext, ".")) {
	case "srt", "vtt", "sub":
		if !strings.Contains(head, "-->") {
			return fmt.Errorf("no timestamp cues found in subtitle payload")
		}
	case "ass", "ssa":
		if !strings.Contains(head, "[Script Info]") {
			return fmt.Errorf("missing [Script Info] header in ASS subtitle")
		}
	}
	return nil
}

// SearchAndDownloadSubtitle searches for and downloads the best matching subtitle
func (s *SubtitleMatcherService) SearchAndDownloadSubtitle(media *models.Media) error {
	seasonNum := 0
	episodeNum := 0
	if media.SeasonNumber != nil {
		seasonNum = *media.SeasonNumber
	}
	if media.EpisodeNumber != nil {
		episodeNum = *media.EpisodeNumber
	}
	isEpisode := media.Type == "episode" && seasonNum > 0 && episodeNum > 0

	if isEpisode {
		log.Printf("🔍 Searching subtitles for episode: %s S%02dE%02d", media.Title, seasonNum, episodeNum)
	} else {
		log.Printf("🔍 Searching subtitles for: %s", media.Title)
	}

	// Extract quality information
	mediaQuality := s.ExtractMediaQuality(media)

	// Prepare search request
	searchReq := SubtitleSearchRequest{
		Query:    media.Title,
		Language: "en",
	}

	// Moviehash: subtitles found by file hash come from the exact same
	// release, so they're in sync by construction. The API returns hash
	// matches flagged with moviehash_match=true alongside query results.
	if hash, hashErr := utils.ComputeMovieHash(media.FilePath); hashErr == nil {
		searchReq.MovieHash = hash
		log.Printf("🔑 Moviehash for %s: %s", media.Title, hash)
	} else {
		log.Printf("⚠️ Could not compute moviehash for %s: %v", media.Title, hashErr)
	}

	if isEpisode {
		searchReq.Type = "episode"
		searchReq.SeasonNumber = seasonNum
		searchReq.EpisodeNumber = episodeNum
	} else {
		searchReq.Type = "movie"
	}

	// Add IMDB ID if available
	if media.IMDBID != "" {
		searchReq.ImdbID = media.IMDBID
	}

	// Add TMDB ID if available (use series TMDB ID for episodes)
	if media.TMDBID > 0 {
		searchReq.TmdbID = fmt.Sprintf("%d", media.TMDBID)
	}

	// Add year if available
	if media.Year > 0 {
		searchReq.Year = fmt.Sprintf("%d", media.Year)
	}

	// Search for subtitles
	searchResults, err := s.openSubtitlesService.SearchSubtitles(searchReq)
	if err != nil {
		return fmt.Errorf("subtitle search failed: %v", err)
	}

	if len(searchResults.Data) == 0 {
		return fmt.Errorf("no subtitles found for: %s", media.Title)
	}

	log.Printf("✅ Found %d subtitle candidates", len(searchResults.Data))

	// Hash matches win outright: pick the most-downloaded one and skip the
	// fuzzy release-name scoring entirely
	if best := pickBestHashMatch(searchResults); best != nil {
		log.Printf("🎯 Moviehash match found (in-sync guaranteed): %s", best.Attributes.Release)
		if err := s.DownloadAndSaveSubtitle(media, best); err != nil {
			return fmt.Errorf("failed to download hash-matched subtitle: %v", err)
		}
		log.Printf("✅ Successfully downloaded hash-matched subtitle for: %s", media.Title)
		return nil
	}

	// Find best matching subtitle
	bestSubtitle, score := s.FindBestMatchingSubtitle(searchResults, mediaQuality)
	if bestSubtitle == nil {
		return fmt.Errorf("no suitable subtitle found")
	}

	// Lower threshold for episodes since season/episode params already narrow results
	minScore := 30.0
	if isEpisode {
		minScore = 10.0
	}
	if score < minScore {
		log.Printf("⚠️ Best match score (%.1f) below threshold (%.1f), skipping download", score, minScore)
		return fmt.Errorf("best match score too low: %.1f < %.1f", score, minScore)
	}

	// Download and save the subtitle
	if err := s.DownloadAndSaveSubtitle(media, bestSubtitle); err != nil {
		return fmt.Errorf("failed to download and save subtitle: %v", err)
	}

	log.Printf("✅ Successfully downloaded and saved subtitle for: %s", media.Title)
	return nil
}
