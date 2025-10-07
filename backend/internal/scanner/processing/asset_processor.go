package processing

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	"homeflix-backend/internal/models"
	"homeflix-backend/internal/scanner/core"
)

// AssetProcessor handles asset generation without timeouts
type AssetProcessor struct {
	scanner *core.MediaScanner
}

func NewAssetProcessor(scanner *core.MediaScanner) *AssetProcessor {
	return &AssetProcessor{
		scanner: scanner,
	}
}

// GenerateAssetsWithoutTimeout generates assets without FFmpeg timeouts
func (ap *AssetProcessor) GenerateAssetsWithoutTimeout(media *models.Media) error {
	log.Printf("🎨 Starting unlimited asset generation for: %s", media.Title)
	
	// Generate thumbnail without timeout
	if err := ap.generateThumbnailUnlimited(media); err != nil {
		log.Printf("⚠️ Thumbnail generation failed for %s: %v", media.Title, err)
	}
	
	// Generate preview clip without timeout
	if err := ap.generatePreviewClipUnlimited(media); err != nil {
		log.Printf("⚠️ Preview clip generation failed for %s: %v", media.Title, err)
	}
	
	// Generate poster if needed
	if media.PosterPath == "" {
		if err := ap.generatePosterUnlimited(media); err != nil {
			log.Printf("⚠️ Poster generation failed for %s: %v", media.Title, err)
		}
	}
	
	return nil
}

// generateThumbnailUnlimited generates thumbnail without timeout constraints
func (ap *AssetProcessor) generateThumbnailUnlimited(media *models.Media) error {
	// Check if thumbnail already exists
	cleanTitle := cleanTitleForFilename(media.Title)
	filename := fmt.Sprintf("thumb_%s.jpg", cleanTitle)
	
	thumbnailPaths := []string{
		filepath.Join("./thumbnails", filename),
		filepath.Join("./backend/thumbnails", filename),
	}
	
	// Check existing thumbnails
	for _, path := range thumbnailPaths {
		if _, err := os.Stat(path); err == nil {
			media.ThumbnailPath = path
			return nil
		}
	}
	
	log.Printf("🖼️ Generating thumbnail without timeout for: %s", media.Title)
	
	// Generate using thumbnail service
	thumbnailPath, err := ap.scanner.GetThumbnailService().GenerateThumbnail(media.FilePath, media.ID, media.Title)
	if err != nil {
		return fmt.Errorf("thumbnail generation failed: %v", err)
	}
	
	media.ThumbnailPath = thumbnailPath
	log.Printf("✅ Thumbnail generated successfully: %s", thumbnailPath)
	return nil
}

// generatePreviewClipUnlimited generates preview clip without timeout constraints
func (ap *AssetProcessor) generatePreviewClipUnlimited(media *models.Media) error {
	// Check if preview already exists
	cleanTitle := cleanTitleForFilename(media.Title)
	filename := fmt.Sprintf("preview_%s.mp4", cleanTitle)
	
	previewPaths := []string{
		filepath.Join("./previews", filename),
		filepath.Join("./backend/previews", filename),
	}
	
	// Check existing previews
	for _, path := range previewPaths {
		if _, err := os.Stat(path); err == nil {
			media.PreviewPath = path
			media.PreviewClipPath = path
			return nil
		}
	}
	
	log.Printf("🎬 Generating preview clip without timeout for: %s", media.Title)
	
	// Generate using thumbnail service
	previewPath, err := ap.scanner.GetThumbnailService().GeneratePreviewClip(media.FilePath, media.ID, media.Title)
	if err != nil {
		return fmt.Errorf("preview clip generation failed: %v", err)
	}
	
	media.PreviewPath = previewPath
	media.PreviewClipPath = previewPath
	log.Printf("✅ Preview clip generated successfully: %s", previewPath)
	return nil
}

// generatePosterUnlimited generates poster without timeout constraints
func (ap *AssetProcessor) generatePosterUnlimited(media *models.Media) error {
	log.Printf("🎭 Generating poster without timeout for: %s", media.Title)
	
	// Generate using poster service
	err := ap.scanner.GetPosterService().DownloadPoster(media.Title, media.ID)
	if err != nil {
		return fmt.Errorf("poster generation failed: %v", err)
	}
	
	posterPath := ap.scanner.GetPosterService().GetPosterPath(media.ID, media.Title)
	media.PosterPath = posterPath
	log.Printf("✅ Poster generated successfully: %s", posterPath)
	return nil
}

// ScheduleAssetGenerationWithoutTimeout schedules asset generation without timeout limits
func (ap *AssetProcessor) ScheduleAssetGenerationWithoutTimeout(media *models.Media) {
	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("❌ Asset generation panic for %s: %v", media.Title, r)
			}
		}()
		
		log.Printf("📅 Scheduling unlimited asset generation for: %s", media.Title)
		
		// Generate assets with resource limits but no time limits
		if err := ap.GenerateAssetsWithoutTimeout(media); err != nil {
			log.Printf("❌ Asset generation failed for %s: %v", media.Title, err)
		}
		
		// Update media record with new asset paths
		if err := ap.scanner.GetMediaService().UpdateMedia(media); err != nil {
			log.Printf("❌ Failed to update media record for %s: %v", media.Title, err)
		}
	}()
}

// ValidateAssets validates that generated assets are valid
func (ap *AssetProcessor) ValidateAssets(media *models.Media) error {
	var errors []string
	
	// Validate thumbnail
	if media.ThumbnailPath != "" {
		if _, err := os.Stat(media.ThumbnailPath); err != nil {
			errors = append(errors, fmt.Sprintf("thumbnail not found: %s", media.ThumbnailPath))
		}
	}
	
	// Validate preview clip
	if media.PreviewPath != "" {
		if _, err := os.Stat(media.PreviewPath); err != nil {
			errors = append(errors, fmt.Sprintf("preview clip not found: %s", media.PreviewPath))
		}
	}
	
	// Validate poster
	if media.PosterPath != "" {
		if _, err := os.Stat(media.PosterPath); err != nil {
			errors = append(errors, fmt.Sprintf("poster not found: %s", media.PosterPath))
		}
	}
	
	if len(errors) > 0 {
		return fmt.Errorf("asset validation failed: %s", strings.Join(errors, ", "))
	}
	
	return nil
}

// cleanTitleForFilename cleans title for use in filenames
func cleanTitleForFilename(title string) string {
	// Remove special characters and spaces
	cleaned := strings.ReplaceAll(title, " ", "_")
	cleaned = strings.ReplaceAll(cleaned, "/", "_")
	cleaned = strings.ReplaceAll(cleaned, "\\", "_")
	cleaned = strings.ReplaceAll(cleaned, ":", "_")
	cleaned = strings.ReplaceAll(cleaned, "*", "_")
	cleaned = strings.ReplaceAll(cleaned, "?", "_")
	cleaned = strings.ReplaceAll(cleaned, "\"", "_")
	cleaned = strings.ReplaceAll(cleaned, "<", "_")
	cleaned = strings.ReplaceAll(cleaned, ">", "_")
	cleaned = strings.ReplaceAll(cleaned, "|", "_")
	
	// Limit length
	if len(cleaned) > 100 {
		cleaned = cleaned[:100]
	}
	
	return cleaned
}

// GetAssetPaths returns all possible asset paths for a media item
func (ap *AssetProcessor) GetAssetPaths(media *models.Media) map[string][]string {
	cleanTitle := cleanTitleForFilename(media.Title)
	
	return map[string][]string{
		"thumbnail": {
			filepath.Join("./thumbnails", fmt.Sprintf("thumb_%s.jpg", cleanTitle)),
			filepath.Join("./backend/thumbnails", fmt.Sprintf("thumb_%s.jpg", cleanTitle)),
			filepath.Join("./thumbnails", fmt.Sprintf("thumb_%d.jpg", media.ID)),
		},
		"preview": {
			filepath.Join("./previews", fmt.Sprintf("preview_%s.mp4", cleanTitle)),
			filepath.Join("./backend/previews", fmt.Sprintf("preview_%s.mp4", cleanTitle)),
			filepath.Join("./previews", fmt.Sprintf("preview_%d.mp4", media.ID)),
		},
		"poster": {
			filepath.Join("./posters", fmt.Sprintf("poster_%s.jpg", cleanTitle)),
			filepath.Join("./backend/posters", fmt.Sprintf("poster_%s.jpg", cleanTitle)),
			filepath.Join("./posters", fmt.Sprintf("poster_%d.jpg", media.ID)),
		},
	}
}