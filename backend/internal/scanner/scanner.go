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

	"homeflix-backend/internal/models"
	"homeflix-backend/internal/services"

	"github.com/h2non/filetype"
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
	log.Printf("Scanning media library at: %s", s.mediaPath)

	// Check if media path exists
	if _, err := os.Stat(s.mediaPath); os.IsNotExist(err) {
		log.Printf("Media path does not exist: %s", s.mediaPath)
		return fmt.Errorf("media path does not exist: %s", s.mediaPath)
	}

	videoCount := 0
	subtitleCount := 0

	err := filepath.Walk(s.mediaPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			log.Printf("Error accessing path %s: %v", path, err)
			return nil // Continue scanning
		}

		if info.IsDir() {
			return nil
		}

		// Check if file is a video
		if s.isVideoFile(path) {
			videoCount++
			log.Printf("Found video file [%d]: %s", videoCount, path)
			if err := s.processVideoFile(path, info); err != nil {
				log.Printf("Error processing video file %s: %v", path, err)
			}
		}

		// Check if file is a subtitle
		if s.isSubtitleFile(path) {
			subtitleCount++
			log.Printf("Found subtitle file [%d]: %s", subtitleCount, path)
			if err := s.processSubtitleFile(path); err != nil {
				log.Printf("Error processing subtitle file %s: %v", path, err)
			}
		}

		return nil
	})

	log.Printf("Scan completed: %d videos, %d subtitles processed", videoCount, subtitleCount)
	return err
}

func (s *MediaScanner) isVideoFile(path string) bool {
	// First check by extension for common video formats
	ext := strings.ToLower(filepath.Ext(path))
	videoExts := []string{".mp4", ".mkv", ".avi", ".mov", ".wmv", ".flv", ".webm", ".m4v", ".mpg", ".mpeg", ".3gp", ".ogv"}
	
	for _, videoExt := range videoExts {
		if ext == videoExt {
			return true
		}
	}

	// Fallback to MIME type detection for unknown extensions
	file, err := os.Open(path)
	if err != nil {
		return false
	}
	defer file.Close()

	// Read first 512 bytes to determine file type
	buffer := make([]byte, 512)
	_, err = file.Read(buffer)
	if err != nil {
		return false
	}

	kind, err := filetype.Match(buffer)
	if err != nil {
		return false
	}

	// Check if it's a video MIME type
	return strings.HasPrefix(kind.MIME.Value, "video/")
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
		log.Printf("Error checking if media exists for %s: %v", path, err)
		return err
	}
	if exists {
		log.Printf("Media already exists, skipping: %s", path)
		return nil // Skip if already processed
	}

	// Extract metadata from filename and path
	metadata := s.extractMetadata(path)
	log.Printf("Extracted metadata for %s: Title=%s, Type=%s", path, metadata.Title, metadata.Type)

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

	// If it's an episode, find or create the series
	if metadata.Type == "episode" && metadata.SeriesTitle != "" {
		log.Printf("Processing episode for series: %s", metadata.SeriesTitle)
		series, err := s.mediaService.FindOrCreateSeries(metadata.SeriesTitle)
		if err != nil {
			log.Printf("Error finding/creating series %s: %v", metadata.SeriesTitle, err)
			return err
		}
		media.SeriesID = &series.ID
	}

	// Save media to database
	if err := s.mediaService.CreateMedia(media); err != nil {
		log.Printf("Error creating media %s: %v", media.Title, err)
		return err
	}

	// Assign genres based on filename/path analysis
	genres := s.extractGenresFromPath(path, metadata.Title)
	if len(genres) > 0 {
		if err := s.mediaService.AssignGenresToMedia(media.ID, genres); err != nil {
			log.Printf("Warning: Failed to assign genres to media %s: %v", media.Title, err)
		} else {
			log.Printf("Assigned %d genres to media: %s", len(genres), media.Title)
		}
	}

	// Extract additional metadata using FFprobe
	log.Printf("Extracting metadata for: %s", media.Title)
	if err := s.extractVideoMetadata(media, path); err != nil {
		log.Printf("Warning: Failed to extract metadata for %s: %v", media.Title, err)
	}

	// Generate thumbnail for the media
	log.Printf("Generating thumbnail for: %s", media.Title)
	thumbnailPath, err := s.thumbnailService.GenerateThumbnail(path, media.ID)
	if err != nil {
		log.Printf("Warning: Failed to generate thumbnail for %s: %v", media.Title, err)
	} else {
		media.ThumbnailPath = thumbnailPath
		log.Printf("Thumbnail generated successfully: %s", thumbnailPath)
	}

	// Generate preview clip for Netflix-style hover playback
	log.Printf("Generating preview clip for: %s", media.Title)
	previewClipPath, err := s.thumbnailService.GeneratePreviewClip(path, media.ID)
	if err != nil {
		log.Printf("Warning: Failed to generate preview clip for %s: %v", media.Title, err)
	} else {
		media.PreviewClipPath = previewClipPath
		log.Printf("Preview clip generated successfully: %s", previewClipPath)
	}

	// Download poster after preview clip generation
	if s.posterService != nil {
		err := s.posterService.DownloadPoster(media.Title, media.ID)
		if err != nil {
			log.Printf("Failed to download poster for %s: %v", media.Title, err)
		} else {
			// Get the poster path and update media
			posterPath := s.posterService.GetPosterPath(media.ID)
			if posterPath != "" {
				media.PosterPath = posterPath
				if err := s.mediaService.UpdateMedia(media); err != nil {
					log.Printf("Failed to update media with poster path: %v", err)
				} else {
					log.Printf("Updated media %s with poster: %s", media.Title, posterPath)
				}
			}
		}
	}

	// Queue AI metadata generation using Celery
	if s.geminiService != nil {
		log.Printf("Queueing AI metadata generation for: %s", media.Title)
		go s.queueCeleryTasks(media, path)
	}

	log.Printf("Successfully added media: %s (Type: %s, Size: %d bytes)", media.Title, media.Type, media.FileSize)
	return nil
}

func (s *MediaScanner) extractVideoMetadata(media *models.Media, path string) error {
	// Use FFprobe to extract video metadata
	cmd := exec.Command("ffprobe", 
		"-v", "quiet",
		"-print_format", "json",
		"-show_format",
		"-show_streams",
		path)
	
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
	// Remove common patterns from movie titles
	patterns := []string{
		`\(\d{4}\)`,           // Year in parentheses
		`\[\d{4}\]`,           // Year in brackets
		`\d{4}`,               // Standalone year
		`(?i)bluray`,          // BluRay
		`(?i)brrip`,           // BRRip
		`(?i)webrip`,          // WebRip
		`(?i)hdtv`,            // HDTV
		`(?i)x264`,            // x264
		`(?i)x265`,            // x265
		`(?i)h264`,            // h264
		`(?i)h265`,            // h265
		`(?i)1080p`,           // 1080p
		`(?i)720p`,            // 720p
		`(?i)480p`,            // 480p
		`(?i)4k`,              // 4K
		`(?i)uhd`,             // UHD
		`(?i)hdr`,             // HDR
		`(?i)ac3`,             // AC3
		`(?i)dts`,             // DTS
		`(?i)aac`,             // AAC
		`(?i)mp3`,             // MP3
	}

	cleaned := title
	for _, pattern := range patterns {
		re := regexp.MustCompile(pattern)
		cleaned = re.ReplaceAllString(cleaned, "")
	}

	// Replace dots, underscores, and multiple spaces with single spaces
	cleaned = regexp.MustCompile(`[._]+`).ReplaceAllString(cleaned, " ")
	cleaned = regexp.MustCompile(`\s+`).ReplaceAllString(cleaned, " ")
	cleaned = strings.TrimSpace(cleaned)

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
