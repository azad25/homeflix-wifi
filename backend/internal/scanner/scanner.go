package scanner

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"homeflix-backend/internal/models"
	"homeflix-backend/internal/services"
)

type MediaScanner struct {
	mediaService     *services.MediaService
	thumbnailService *services.ThumbnailService
	posterService    *services.PosterService
	geminiService    *services.GeminiService
	celeryService    *services.CeleryService
	mediaPath        string
}

func NewMediaScanner(mediaService *services.MediaService, thumbnailService *services.ThumbnailService, posterService *services.PosterService, geminiService *services.GeminiService, celeryService *services.CeleryService, mediaPath string) *MediaScanner {
	return &MediaScanner{
		mediaService:     mediaService,
		thumbnailService: thumbnailService,
		posterService:    posterService,
		geminiService:    geminiService,
		celeryService:    celeryService,
		mediaPath:        mediaPath,
	}
}

func (s *MediaScanner) ScanMediaLibrary() error {
	log.Printf("🔍 Starting comprehensive media library scan at: %s", s.mediaPath)

	// Check if media path exists
	if _, err := os.Stat(s.mediaPath); os.IsNotExist(err) {
		return fmt.Errorf("media path does not exist: %s", s.mediaPath)
	}

	log.Printf("✅ Media path verified, beginning file walk...")
	log.Printf("🚀 Celery task queuing enabled - all media will be processed automatically")
	videoCount := 0
	subtitleCount := 0
	fileCount := 0
	queuedTasksCount := 0

	err := filepath.Walk(s.mediaPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			log.Printf("Error accessing path %s: %v", path, err)
			return nil // Continue scanning
		}

		// Skip system directories and problematic paths
		if info.IsDir() {
			dirName := strings.ToLower(info.Name())
			if s.shouldSkipDirectory(dirName, path) {
				log.Printf("Skipping system directory: %s", path)
				return filepath.SkipDir
			}
			return nil
		}

		// Skip system files and problematic files
		if s.shouldSkipFile(path, info) {
			return nil
		}

		fileCount++
		
		// Log progress every 500 files to reduce log spam
		if fileCount%500 == 0 && fileCount > 0 {
			log.Printf("Processed %d files so far... (videos: %d, subtitles: %d)", fileCount, videoCount, subtitleCount)
		}
		
		// Log current file being processed for debugging
		if fileCount <= 10 {
			log.Printf("Processing file #%d: %s", fileCount, path)
		}

		// Check if file is a video
		if s.isVideoFile(path) {
			videoCount++
			queuedTasksCount += 6 // Each video gets 6 Celery tasks queued
			// Only log every 10th video file to reduce log spam
		if videoCount%10 == 1 {
			log.Printf("Processing video file: %s", filepath.Base(path))
		}
			if err := s.processVideoFile(path, info); err != nil {
				log.Printf("Error processing video file %s: %v", path, err)
			}
		}

		// Check if file is a subtitle
		if s.isSubtitleFile(path) {
			subtitleCount++
			if err := s.processSubtitleFile(path); err != nil {
				log.Printf("Error processing subtitle file %s: %v", path, err)
			}
		}

		return nil
	})

	log.Printf("📊 Media scan completed: %d videos, %d subtitles", videoCount, subtitleCount)
	log.Printf("🚀 Total Celery tasks queued: %d (6 tasks per video)", queuedTasksCount)
	
	// Log queue status after scanning
	if s.celeryService != nil {
		queueLengths, err := s.celeryService.GetAllQueueLengths()
		if err == nil {
			log.Printf("📋 Current queue lengths after scan:")
			for queue, length := range queueLengths {
				log.Printf("   %s: %d tasks", queue, length)
			}
		}
	}
	
	return err
}

func (s *MediaScanner) shouldSkipDirectory(dirName, path string) bool {
	// Skip system directories and problematic paths
	skipDirs := []string{
		"system volume information",
		"$recycle.bin",
		"recycler",
		"found.000",
		"found.001",
		"found.002",
		"msdownld.tmp",
		".git",
		".svn",
		"node_modules",
		"__pycache__",
	}
	
	for _, skipDir := range skipDirs {
		if strings.Contains(dirName, skipDir) {
			return true
		}
	}
	
	// Skip directories starting with $
	if strings.HasPrefix(dirName, "$") {
		return true
	}
	
	return false
}

func (s *MediaScanner) shouldSkipFile(path string, info os.FileInfo) bool {
	fileName := strings.ToLower(info.Name())
	
	// Skip files starting with $ (system files)
	if strings.HasPrefix(fileName, "$") {
		log.Printf("Skipping system file: %s", path)
		return true
	}
	
	// Skip files containing $RECYCLE.BIN in path
	if strings.Contains(strings.ToUpper(path), "$RECYCLE.BIN") {
		log.Printf("Skipping recycle bin file: %s", path)
		return true
	}
	
	// Skip very large files that might be problematic (over 15GB)
	if info.Size() > 15*1024*1024*1024 {
		log.Printf("Skipping very large file: %s (%.2f GB)", path, float64(info.Size())/(1024*1024*1024))
		return true
	}
	
	// Skip very small files that are unlikely to be valid videos (under 10MB)
	if info.Size() < 10*1024*1024 {
		return true
	}
	
	// Skip non-media file extensions
	ext := strings.ToLower(filepath.Ext(fileName))
	skipExts := []string{
		".exe", ".msi", ".zip", ".rar", ".7z", ".tar", ".gz",
		".appimage", ".deb", ".rpm", ".dmg", ".iso",
		".txt", ".doc", ".docx", ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".bmp",
		".tmp", ".temp", ".log", ".cache", ".db", ".sqlite",
	}
	
	for _, skipExt := range skipExts {
		if ext == skipExt {
			return true
		}
	}
	
	return false
}

func (s *MediaScanner) isVideoFile(path string) bool {
	// First check by extension for common video formats - this is fast and reliable
	ext := strings.ToLower(filepath.Ext(path))
	videoExts := []string{".mp4", ".mkv", ".avi", ".mov", ".wmv", ".flv", ".webm", ".m4v", ".mpg", ".mpeg", ".3gp", ".ogv"}
	
	for _, videoExt := range videoExts {
		if ext == videoExt {
			return true
		}
	}

	// Skip MIME type detection to prevent hanging on problematic files
	// Extension-based detection is sufficient for most use cases
	return false
}

func (s *MediaScanner) isSubtitleFile(path string) bool {
	ext := strings.ToLower(filepath.Ext(path))
	subtitleExts := []string{".srt", ".vtt", ".ass", ".ssa", ".sub", ".idx"}
	
	for _, subExt := range subtitleExts {
		if ext == subExt {
			return true
		}
	}
	return false
}

func (s *MediaScanner) processVideoFile(path string, info os.FileInfo) error {
	// Check if media already exists
	exists, err := s.mediaService.MediaExists(path)
	if err != nil {
		return err
	}
	
	if exists {
		// Media exists - get it from database and queue tasks for processing
		existingMedia, err := s.mediaService.GetMediaByPath(path)
		if err != nil {
			log.Printf("Failed to get existing media for %s: %v", path, err)
			return nil
		}
		
		// Queue Celery tasks for existing media that might need processing
		go s.queueIndividualTasks(existingMedia, path)
		return nil
	}

	// Extract metadata from filename and path
	metadata := s.extractMetadata(path)

	media := &models.Media{
		Title:    metadata.Title,
		Type:     metadata.Type,
		FilePath: path,
		FileSize: info.Size(),
		
		// Series info (if applicable)
		SeasonNumber:  metadata.SeasonNumber,
		EpisodeNumber: metadata.EpisodeNumber,
		
		// Default values
		ViewCount: 0,
	}

	// If it's an episode, find or create the series and season
	if metadata.Type == "episode" && metadata.SeriesTitle != "" {
		series, err := s.mediaService.FindOrCreateSeries(metadata.SeriesTitle)
		if err != nil {
			return err
		}
		media.SeriesID = &series.ID
		
		// Create season if season number is available
		if metadata.SeasonNumber != nil && *metadata.SeasonNumber > 0 {
			season, err := s.mediaService.FindOrCreateSeason(series.ID, *metadata.SeasonNumber)
			if err != nil {
				return err
			}
			media.SeasonID = &season.ID
		}
	}

	// Save media to database
	if err := s.mediaService.CreateMedia(media); err != nil {
		return err
	}

	// Assign genres based on filename/path analysis
	genres := s.extractGenresFromPath(path, metadata.Title)
	if len(genres) > 0 {
		if err := s.mediaService.AssignGenresToMedia(media.ID, genres); err != nil {
			log.Printf("Warning: Failed to assign genres to media %s: %v", media.Title, err)
		}
	}

	// Extract additional metadata using FFprobe (with timeout)
	go func() {
		if err := s.extractVideoMetadata(media, path); err != nil {
			log.Printf("Warning: Failed to extract metadata for %s: %v", media.Title, err)
		} else {
			// Update media with extracted metadata
			s.mediaService.UpdateMedia(media)
		}
	}()

	// Skip synchronous thumbnail and poster generation during scanning for speed
	// These will be handled by Celery tasks asynchronously

	// Always queue Celery tasks for media processing (thumbnails, previews, metadata)
	go s.queueCeleryTasks(media, path)

	log.Printf("Added media: %s", media.Title)
	return nil
}

func (s *MediaScanner) extractVideoMetadata(media *models.Media, path string) error {
	// Use FFprobe to extract video metadata with timeout
	cmd := exec.Command("ffprobe", 
		"-v", "quiet",
		"-print_format", "json",
		"-show_format",
		"-show_streams",
		"-select_streams", "v:0", // Only first video stream for speed
		path)
	
	// Set timeout to prevent hanging
	cmd.WaitDelay = 30 * time.Second
	output, err := cmd.Output()
	if err != nil {
		return fmt.Errorf("failed to run ffprobe: %v", err)
	}

	var probeData struct {
		Format struct {
			Duration string `json:"duration"`
			Size     string `json:"size"`
			BitRate  string `json:"bit_rate"`
		} `json:"format"`
		Streams []struct {
			CodecType string `json:"codec_type"`
			CodecName string `json:"codec_name"`
			Width     int    `json:"width"`
			Height    int    `json:"height"`
			BitRate   string `json:"bit_rate"`
		} `json:"streams"`
	}

	if err := json.Unmarshal(output, &probeData); err != nil {
		return fmt.Errorf("failed to parse ffprobe output: %v", err)
	}

	// Extract duration and convert to seconds
	if duration, err := strconv.ParseFloat(probeData.Format.Duration, 64); err == nil {
		media.Duration = int(duration)
	}

	// Extract video stream information
	for _, stream := range probeData.Streams {
		if stream.CodecType == "video" {
			media.Codec = stream.CodecName
			if stream.Width > 0 && stream.Height > 0 {
				media.Resolution = fmt.Sprintf("%dx%d", stream.Width, stream.Height)
			}
			if bitrate, err := strconv.Atoi(stream.BitRate); err == nil {
				media.Bitrate = bitrate
			}
			break
		}
	}

	return nil
}

func (s *MediaScanner) processSubtitleFile(path string) error {
	// Find corresponding video file
	videoPath := s.findCorrespondingVideo(path)
	if videoPath == "" {
		return nil // No corresponding video found
	}

	// Find media in database
	media, err := s.mediaService.GetMediaByPath(videoPath)
	if err != nil {
		return err
	}

	// Extract language from filename
	language := s.extractLanguageFromSubtitle(path)

	subtitle := &models.Subtitle{
		MediaID:  media.ID,
		Language: language,
		FilePath: path,
		Format:   strings.TrimPrefix(filepath.Ext(path), "."),
	}

	return s.mediaService.CreateSubtitle(subtitle)
}

func (s *MediaScanner) findCorrespondingVideo(subtitlePath string) string {
	dir := filepath.Dir(subtitlePath)
	baseName := strings.TrimSuffix(filepath.Base(subtitlePath), filepath.Ext(subtitlePath))
	
	// Remove language suffix if present (e.g., "movie.en.srt" -> "movie")
	baseName = regexp.MustCompile(`\.(en|es|fr|de|it|pt|ru|ja|ko|zh|ar)$`).ReplaceAllString(baseName, "")

	videoExts := []string{".mp4", ".mkv", ".avi", ".mov", ".wmv", ".flv", ".webm", ".m4v"}
	
	for _, ext := range videoExts {
		videoPath := filepath.Join(dir, baseName+ext)
		if _, err := os.Stat(videoPath); err == nil {
			return videoPath
		}
	}
	
	return ""
}

func (s *MediaScanner) extractLanguageFromSubtitle(path string) string {
	filename := filepath.Base(path)
	
	// Common language patterns
	langPatterns := map[string]string{
		`\.en\.`:    "English",
		`\.eng\.`:   "English",
		`\.es\.`:    "Spanish",
		`\.spa\.`:   "Spanish",
		`\.fr\.`:    "French",
		`\.fre\.`:   "French",
		`\.de\.`:    "German",
		`\.ger\.`:   "German",
		`\.it\.`:    "Italian",
		`\.ita\.`:   "Italian",
		`\.pt\.`:    "Portuguese",
		`\.por\.`:   "Portuguese",
		`\.ru\.`:    "Russian",
		`\.rus\.`:   "Russian",
		`\.ja\.`:    "Japanese",
		`\.jpn\.`:   "Japanese",
		`\.ko\.`:    "Korean",
		`\.kor\.`:   "Korean",
		`\.zh\.`:    "Chinese",
		`\.chi\.`:   "Chinese",
		`\.ar\.`:    "Arabic",
		`\.ara\.`:   "Arabic",
	}

	for pattern, language := range langPatterns {
		if matched, _ := regexp.MatchString(pattern, filename); matched {
			return language
		}
	}

	return "Unknown"
}

func (s *MediaScanner) extractGenresFromPath(path, title string) []string {
	var genres []string
	pathLower := strings.ToLower(path)
	titleLower := strings.ToLower(title)
	
	// Genre keywords to look for in path and title
	genreKeywords := map[string][]string{
		"Action": {"action", "fight", "martial", "combat", "war", "battle"},
		"Comedy": {"comedy", "funny", "humor", "laugh", "comic"},
		"Drama": {"drama", "dramatic", "emotional"},
		"Horror": {"horror", "scary", "terror", "nightmare", "zombie", "ghost"},
		"Romance": {"romance", "romantic", "love", "wedding"},
		"Sci-Fi": {"sci-fi", "science", "fiction", "space", "alien", "future", "robot"},
		"Fantasy": {"fantasy", "magic", "wizard", "dragon", "fairy", "mythical"},
		"Thriller": {"thriller", "suspense", "mystery", "detective"},
		"Crime": {"crime", "criminal", "police", "detective", "murder", "heist"},
		"Adventure": {"adventure", "quest", "journey", "expedition"},
		"Animation": {"animation", "animated", "cartoon", "anime"},
		"Documentary": {"documentary", "docu", "real", "true", "biography"},
		"Family": {"family", "kids", "children", "disney"},
		"Music": {"music", "musical", "concert", "band", "singer"},
		"Western": {"western", "cowboy", "wild west", "frontier"},
		"Sport": {"sport", "football", "basketball", "soccer", "boxing", "racing"},
	}
	
	// Check for genre keywords in path and title
	for genre, keywords := range genreKeywords {
		for _, keyword := range keywords {
			if strings.Contains(pathLower, keyword) || strings.Contains(titleLower, keyword) {
				genres = append(genres, genre)
				break // Only add each genre once
			}
		}
	}
	
	// If no genres found, assign a default based on file location or type
	if len(genres) == 0 {
		if strings.Contains(pathLower, "movie") {
			genres = append(genres, "Drama") // Default for movies
		} else if strings.Contains(pathLower, "tv") || strings.Contains(pathLower, "series") {
			genres = append(genres, "Drama") // Default for TV shows
		} else {
			genres = append(genres, "Drama") // Fallback default
		}
	}
	
	return genres
}

type MediaMetadata struct {
	Title         string
	Type          string // "movie" or "episode"
	SeriesTitle   string
	SeasonNumber  *int
	EpisodeNumber *int
}

func (s *MediaScanner) extractMetadata(path string) *MediaMetadata {
	filename := filepath.Base(path)
	filenameWithoutExt := strings.TrimSuffix(filename, filepath.Ext(filename))
	
	metadata := &MediaMetadata{
		Title: filenameWithoutExt,
		Type:  "movie", // Default to movie
	}

	// Check for TV series patterns
	// Pattern 1: Series.Name.S01E01.Title
	seriesPattern1 := regexp.MustCompile(`^(.+?)\.S(\d+)E(\d+)`)
	if matches := seriesPattern1.FindStringSubmatch(filenameWithoutExt); len(matches) == 4 {
		metadata.Type = "episode"
		metadata.SeriesTitle = strings.ReplaceAll(matches[1], ".", " ")
		if season, err := strconv.Atoi(matches[2]); err == nil {
			metadata.SeasonNumber = &season
		}
		if episode, err := strconv.Atoi(matches[3]); err == nil {
			metadata.EpisodeNumber = &episode
		}
		metadata.Title = fmt.Sprintf("%s S%sE%s", metadata.SeriesTitle, matches[2], matches[3])
		return metadata
	}

	// Pattern 2: Series Name - S01E01 - Episode Title
	seriesPattern2 := regexp.MustCompile(`^(.+?)\s*-\s*S(\d+)E(\d+)`)
	if matches := seriesPattern2.FindStringSubmatch(filenameWithoutExt); len(matches) == 4 {
		metadata.Type = "episode"
		metadata.SeriesTitle = strings.TrimSpace(matches[1])
		if season, err := strconv.Atoi(matches[2]); err == nil {
			metadata.SeasonNumber = &season
		}
		if episode, err := strconv.Atoi(matches[3]); err == nil {
			metadata.EpisodeNumber = &episode
		}
		metadata.Title = fmt.Sprintf("%s S%sE%s", metadata.SeriesTitle, matches[2], matches[3])
		return metadata
	}

	// Pattern 3: Series/Season/Episode structure in path
	pathParts := strings.Split(filepath.Dir(path), string(os.PathSeparator))
	if len(pathParts) >= 2 {
		seasonPattern := regexp.MustCompile(`(?i)season\s*(\d+)`)
		for i := len(pathParts) - 1; i >= 0; i-- {
			if matches := seasonPattern.FindStringSubmatch(pathParts[i]); len(matches) == 2 {
				if i > 0 {
					metadata.Type = "episode"
					metadata.SeriesTitle = pathParts[i-1]
					if season, err := strconv.Atoi(matches[1]); err == nil {
						metadata.SeasonNumber = &season
					}
					
					// Try to extract episode number from filename
					episodePattern := regexp.MustCompile(`(?i)e(\d+)|episode\s*(\d+)|(\d+)`)
					if epMatches := episodePattern.FindStringSubmatch(filenameWithoutExt); len(epMatches) > 1 {
						for j := 1; j < len(epMatches); j++ {
							if epMatches[j] != "" {
								if episode, err := strconv.Atoi(epMatches[j]); err == nil {
									metadata.EpisodeNumber = &episode
									break
								}
							}
						}
					}
					
					if metadata.EpisodeNumber != nil {
						metadata.Title = fmt.Sprintf("%s S%dE%d", metadata.SeriesTitle, *metadata.SeasonNumber, *metadata.EpisodeNumber)
					} else {
						metadata.Title = fmt.Sprintf("%s S%d - %s", metadata.SeriesTitle, *metadata.SeasonNumber, filenameWithoutExt)
					}
					return metadata
				}
			}
		}
	}

	// Clean up movie title
	metadata.Title = s.cleanTitle(filenameWithoutExt)
	return metadata
}

func (s *MediaScanner) cleanTitle(title string) string {
	// Remove garbage characters and system file prefixes
	cleaned := title
	
	// Remove system file prefixes like $I6IU2JN, $RXH7R5L, etc.
	cleaned = regexp.MustCompile(`^\$[A-Z0-9]+\s*`).ReplaceAllString(cleaned, "")
	
	// Remove common patterns from movie titles
	patterns := []string{
		// Years
		`\(\d{4}\)`,           // Year in parentheses
		`\[\d{4}\]`,           // Year in brackets
		`\b\d{4}\b`,           // Standalone year (word boundary)
		
		// Quality indicators
		`(?i)\b(bluray|blu-ray|brrip|webrip|hdtv|dvdrip|camrip|ts|tc|r5|r6)\b`,
		`(?i)\b(1080p|720p|480p|360p|2160p|4k|uhd|fhd|hd)\b`,
		`(?i)\b(hdr|hdr10|dolby\s*vision|atmos)\b`,
		
		// Codecs and formats
		`(?i)\b(x264|x265|h264|h265|hevc|avc|xvid|divx)\b`,
		`(?i)\b(ac3|dts|aac|mp3|flac|truehd|dd5\.1|dd7\.1)\b`,
		
		// Release groups and sources
		`(?i)\b(yify|rarbg|ettv|eztv|torrent|kickass|1337x)\b`,
		`(?i)\b(web-dl|webdl|web\.dl|bdrip|dvd|netflix|amazon|hulu)\b`,
		`(?i)\b(proper|repack|extended|unrated|directors\.cut|dc)\b`,
		
		// File extensions and containers
		`(?i)\.(mkv|mp4|avi|mov|wmv|flv|webm|m4v|mpg|mpeg)$`,
		
		// Brackets and parentheses with technical info
		`\[[^\]]*\]`,          // Remove anything in square brackets
		`\([^)]*(?:rip|web|hd|p|x26|h26|ac3|dts|aac)[^)]*\)`, // Remove technical parentheses
		
		// Common garbage patterns
		`(?i)\b(sample|trailer|preview|teaser)\b`,
		`(?i)\b(multi|dual|audio|subs|subtitles)\b`,
		`(?i)\b(eng|english|hindi|spanish|french|german)\b`,
		
		// Size indicators
		`(?i)\b\d+(\.\d+)?\s*(gb|mb|kb)\b`,
		
		// Random technical strings
		`\b[A-Z0-9]{8,}\b`,    // Long alphanumeric strings (likely hashes)
		`(?i)\b(www\.[a-z0-9.-]+\.[a-z]{2,})\b`, // Website URLs
	}

	for _, pattern := range patterns {
		re := regexp.MustCompile(pattern)
		cleaned = re.ReplaceAllString(cleaned, " ")
	}

	// Clean up separators and spacing
	cleaned = regexp.MustCompile(`[._\-]+`).ReplaceAllString(cleaned, " ")
	cleaned = regexp.MustCompile(`\s+`).ReplaceAllString(cleaned, " ")
	cleaned = strings.TrimSpace(cleaned)
	
	// Remove leading/trailing punctuation
	cleaned = regexp.MustCompile(`^[^\w]+|[^\w]+$`).ReplaceAllString(cleaned, "")
	
	// If title becomes too short or empty, try to extract meaningful part
	if len(cleaned) < 3 {
		// Try to extract the first meaningful word sequence
		words := strings.Fields(title)
		var meaningfulWords []string
		for _, word := range words {
			// Skip technical terms and short words
			if len(word) > 2 && !regexp.MustCompile(`(?i)^(x264|x265|h264|h265|1080p|720p|480p|bluray|webrip|hdtv)$`).MatchString(word) {
				meaningfulWords = append(meaningfulWords, word)
				if len(meaningfulWords) >= 3 { // Take first 3 meaningful words
					break
				}
			}
		}
		if len(meaningfulWords) > 0 {
			cleaned = strings.Join(meaningfulWords, " ")
		}
	}
	
	// Capitalize first letter of each word for better presentation
	words := strings.Fields(cleaned)
	for i, word := range words {
		if len(word) > 0 {
			words[i] = strings.ToUpper(string(word[0])) + strings.ToLower(word[1:])
		}
	}
	cleaned = strings.Join(words, " ")

	return cleaned
}

// queueCeleryTasks queues distributed tasks for media processing
func (s *MediaScanner) queueCeleryTasks(media *models.Media, path string) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("Panic in queueCeleryTasks for %s: %v", media.Title, r)
		}
	}()

	// Queue comprehensive media processing via Celery
	if err := s.queueMediaProcessing(media, path); err != nil {
		log.Printf("Failed to queue Celery tasks for %s: %v", media.Title, err)
		// Fallback to direct processing
		s.generateMetadataAsync(media, path)
	}
	
	// Queue individual tasks for immediate processing
	s.queueIndividualTasks(media, path)
}

// queueIndividualTasks queues specific tasks for media processing
func (s *MediaScanner) queueIndividualTasks(media *models.Media, path string) {
	if s.celeryService == nil {
		log.Printf("⚠️ Celery service not available for individual tasks - skipping task queuing for %s", media.Title)
		return
	}

	log.Printf("📋 Queuing ALL Celery tasks for media: %s (ID: %d)", media.Title, media.ID)

	// Extract year from metadata for poster download
	year := media.Year

	// Queue all 6 types of Celery tasks for comprehensive processing

	// 1. METADATA GENERATION (high priority - metadata queue)
	if s.geminiService != nil {
		if err := s.celeryService.QueueMetadataGeneration(media.ID, path, media.Title); err != nil {
			log.Printf("❌ Failed to queue metadata generation for %s: %v", media.Title, err)
		} else {
			log.Printf("🤖 Queued AI metadata generation for: %s", media.Title)
		}
	} else {
		log.Printf("⚠️ Gemini service not available - skipping metadata generation for %s", media.Title)
	}

	// 2. THUMBNAIL GENERATION (high priority - thumbnails queue)
	if err := s.celeryService.QueueThumbnailGeneration(media.ID, path); err != nil {
		log.Printf("❌ Failed to queue thumbnail generation for %s: %v", media.Title, err)
	} else {
		log.Printf("🖼️ Queued thumbnail generation for: %s", media.Title)
	}

	// 3. PREVIEW CLIP GENERATION (high priority - thumbnails queue)
	if err := s.celeryService.QueuePreviewGeneration(media.ID, path); err != nil {
		log.Printf("❌ Failed to queue preview generation for %s: %v", media.Title, err)
	} else {
		log.Printf("🎬 Queued preview clip generation for: %s", media.Title)
	}

	// 4. POSTER DOWNLOAD (medium priority - posters queue)
	if err := s.celeryService.QueuePosterDownload(media.ID, media.Title, year, media.Type); err != nil {
		log.Printf("❌ Failed to queue poster download for %s: %v", media.Title, err)
	} else {
		log.Printf("🎨 Queued poster download for: %s", media.Title)
	}

	// 5. VIDEO ANALYSIS (medium priority - video_processing queue)
	if err := s.celeryService.QueueVideoAnalysis(media.ID, path); err != nil {
		log.Printf("❌ Failed to queue video analysis for %s: %v", media.Title, err)
	} else {
		log.Printf("📊 Queued video analysis for: %s", media.Title)
	}

	// 6. SUBTITLE EXTRACTION (low priority - subtitles queue)
	if err := s.celeryService.QueueSubtitleExtraction(media.ID, path); err != nil {
		log.Printf("❌ Failed to queue subtitle extraction for %s: %v", media.Title, err)
	} else {
		log.Printf("📝 Queued subtitle extraction for: %s", media.Title)
	}

	log.Printf("✅ Completed queuing ALL 6 task types for: %s", media.Title)
}

// queueMediaProcessing sends media to Celery for distributed processing
func (s *MediaScanner) queueMediaProcessing(media *models.Media, path string) error {
	if s.celeryService == nil {
		return fmt.Errorf("celery service not initialized")
	}

	// Queue comprehensive media processing directly
	return s.celeryService.QueueMediaProcessing(media.ID, path, media.Title, media.Type)
}

// sendToCelery sends task to Celery via Redis
func (s *MediaScanner) sendToCelery(taskName string, payload map[string]interface{}) error {
	if s.celeryService == nil {
		return fmt.Errorf("celery service not initialized")
	}

	// Use the CeleryService to queue the task
	switch taskName {
	case "process_new_media":
		if mediaInfo, ok := payload["media_info"].(map[string]interface{}); ok {
			mediaID := uint(mediaInfo["media_id"].(uint))
			filePath := mediaInfo["file_path"].(string)
			title := mediaInfo["title"].(string)
			mediaType := mediaInfo["type"].(string)
			
			return s.celeryService.QueueMediaProcessing(mediaID, filePath, title, mediaType)
		}
	default:
		log.Printf("⚠️ Unknown Celery task: %s", taskName)
	}
	
	return fmt.Errorf("unsupported task: %s", taskName)
}

// generateMetadataAsync generates AI metadata in the background (fallback)
func (s *MediaScanner) generateMetadataAsync(media *models.Media, path string) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("Panic in generateMetadataAsync for %s: %v", media.Title, r)
		}
	}()

	// Generate metadata using Gemini
	metadata, err := s.geminiService.GenerateMediaMetadata(path, media.Title)
	if err != nil {
		log.Printf("Failed to generate AI metadata for %s: %v", media.Title, err)
		return
	}

	// Update media with AI-generated metadata
	if metadata.Title != "" {
		media.Title = metadata.Title
	}
	if metadata.Description != "" {
		media.Description = metadata.Description
	}
	if metadata.Rating > 0 {
		media.Rating = metadata.Rating
	}

	// Update genres if provided
	if len(metadata.Genres) > 0 {
		if err := s.mediaService.AssignGenresToMedia(media.ID, metadata.Genres); err != nil {
			log.Printf("Failed to assign AI-generated genres to %s: %v", media.Title, err)
		} else {
			log.Printf("Assigned %d AI-generated genres to %s", len(metadata.Genres), media.Title)
		}
	}

	// Save updated media
	if err := s.mediaService.UpdateMedia(media); err != nil {
		log.Printf("Failed to update media with AI metadata for %s: %v", media.Title, err)
		return
	}

	log.Printf("✅ Successfully generated AI metadata for: %s", media.Title)
	if metadata.Tagline != "" {
		log.Printf("   📝 Tagline: %s", metadata.Tagline)
	}
	log.Printf("   📅 Year: %d | ⭐ Rating: %.1f", metadata.Year, metadata.Rating)
	if len(metadata.Genres) > 0 {
		log.Printf("   🎭 Genres: %v", metadata.Genres)
	}
	if len(metadata.Stars) > 0 {
		log.Printf("   🎬 Stars: %v", metadata.Stars)
	}
	if len(metadata.Directors) > 0 {
		log.Printf("   🎥 Directors: %v", metadata.Directors)
	}
	if metadata.Country != "" {
		log.Printf("   🌍 Country: %s", metadata.Country)
	}
}

// ProcessExistingMedia queues tasks for all existing media items that need processing
func (s *MediaScanner) ProcessExistingMedia() error {
	if s.celeryService == nil {
		log.Printf("⚠️ Celery service not available - skipping existing media processing")
		return nil
	}

	log.Printf("🔄 Processing existing media items for comprehensive task queuing...")

	// Get all media from database
	allMedia, err := s.mediaService.GetAllMedia()
	if err != nil {
		return fmt.Errorf("failed to get existing media: %v", err)
	}

	if len(allMedia) == 0 {
		log.Printf("📭 No existing media found in database")
		return nil
	}

	log.Printf("📚 Found %d existing media items - queuing comprehensive processing tasks", len(allMedia))

	processedCount := 0
	skippedCount := 0

	for _, media := range allMedia {
		// Check if file still exists
		if _, err := os.Stat(media.FilePath); os.IsNotExist(err) {
			log.Printf("⚠️ Skipping missing file: %s", media.FilePath)
			skippedCount++
			continue
		}

		// Queue all 6 task types for each existing media item
		s.queueIndividualTasks(&media, media.FilePath)
		processedCount++

		// Log progress every 50 items
		if processedCount%50 == 0 {
			log.Printf("📊 Processed %d/%d existing media items...", processedCount, len(allMedia))
		}
	}

	log.Printf("✅ Completed processing %d existing media items (%d skipped)", processedCount, skippedCount)
	log.Printf("🚀 Total tasks queued: %d (6 tasks × %d media items)", processedCount*6, processedCount)

	// Log final queue status
	queueLengths, err := s.celeryService.GetAllQueueLengths()
	if err == nil {
		log.Printf("📋 Final queue lengths after existing media processing:")
		for queue, length := range queueLengths {
			log.Printf("   %s: %d tasks", queue, length)
		}
	}

	return nil
}
