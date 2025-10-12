package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

// sanitizeFilename cleans filename for asset generation
func sanitizeFilename(filename string) string {
	invalidChars := []string{"/", "\\", ":", "*", "?", "\"", "<", ">", "|", " "}
	result := filename
	for _, char := range invalidChars {
		result = strings.ReplaceAll(result, char, "_")
	}
	return result
}

// generateThumbnail creates a thumbnail from video file
func generateThumbnail(videoPath, outputPath string, mediaID uint, title string) error {
	// Ensure output directory exists
	if err := os.MkdirAll(filepath.Dir(outputPath), 0755); err != nil {
		return fmt.Errorf("failed to create thumbnail directory: %w", err)
	}

	// Generate thumbnail at 30% of video duration for variety
	cmd := exec.Command("ffmpeg",
		"-i", videoPath,
		"-ss", "30%",
		"-vframes", "1",
		"-vf", "scale=320:180:force_original_aspect_ratio=decrease,pad=320:180:(ow-iw)/2:(oh-ih)/2",
		"-q:v", "2",
		"-y", // Overwrite output file
		outputPath,
	)

	// Set timeout for thumbnail generation
	cmd.Env = os.Environ()
	
	log.Printf("📸 Generating thumbnail for ID %d (%s)...", mediaID, title)
	
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("ffmpeg thumbnail generation failed: %w", err)
	}

	log.Printf("✅ Thumbnail generated: %s", outputPath)
	return nil
}

// generatePreview creates a preview clip from video file
func generatePreview(videoPath, outputPath string, mediaID uint, title string) error {
	// Ensure output directory exists
	if err := os.MkdirAll(filepath.Dir(outputPath), 0755); err != nil {
		return fmt.Errorf("failed to create preview directory: %w", err)
	}

	// Generate 10-second preview starting at 20% of video duration
	cmd := exec.Command("ffmpeg",
		"-i", videoPath,
		"-ss", "20%",
		"-t", "10",
		"-vf", "scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2",
		"-c:v", "libx264",
		"-preset", "fast",
		"-crf", "23",
		"-c:a", "aac",
		"-b:a", "128k",
		"-movflags", "+faststart",
		"-y", // Overwrite output file
		outputPath,
	)

	// Set timeout for preview generation
	cmd.Env = os.Environ()
	
	log.Printf("🎬 Generating preview for ID %d (%s)...", mediaID, title)
	
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("ffmpeg preview generation failed: %w", err)
	}

	log.Printf("✅ Preview generated: %s", outputPath)
	return nil
}

// updateDatabasePath updates the database with the new asset path
func updateDatabasePath(db *sql.DB, mediaID uint, assetType, path string) error {
	var query string
	switch assetType {
	case "thumbnail":
		query = "UPDATE media SET thumbnail_path = ? WHERE id = ?"
	case "preview":
		query = "UPDATE media SET preview_clip_path = ? WHERE id = ?"
	default:
		return fmt.Errorf("unknown asset type: %s", assetType)
	}

	_, err := db.Exec(query, path, mediaID)
	return err
}

func main() {
	// Change to backend directory
	if err := os.Chdir("/home/azad/homeflix-local/homeflix-wifi/backend"); err != nil {
		log.Fatal("Failed to change to backend directory:", err)
	}

	// Open database
	db, err := sql.Open("sqlite3", "./homeflix.db")
	if err != nil {
		log.Fatal("Failed to open database:", err)
	}
	defer db.Close()

	fmt.Println("🚀 Starting missing asset generation...")
	fmt.Println("📋 This will generate thumbnails and previews for media without existing assets")

	// Get media without thumbnails
	fmt.Println("\n📸 Finding media without thumbnails...")
	thumbnailRows, err := db.Query(`
		SELECT id, title, file_path 
		FROM media 
		WHERE (thumbnail_path IS NULL OR thumbnail_path = '') 
		AND file_path IS NOT NULL AND file_path != ''
		LIMIT 20
	`)
	if err != nil {
		log.Fatal("Failed to query media without thumbnails:", err)
	}
	defer thumbnailRows.Close()

	thumbnailsGenerated := 0
	for thumbnailRows.Next() {
		var id uint
		var title, filePath string

		if err := thumbnailRows.Scan(&id, &title, &filePath); err != nil {
			log.Printf("Error scanning thumbnail row: %v", err)
			continue
		}

		// Check if video file exists
		if _, err := os.Stat(filePath); os.IsNotExist(err) {
			log.Printf("⚠️  Video file not found for ID %d: %s", id, filePath)
			continue
		}

		// Generate thumbnail path
		sanitizedTitle := sanitizeFilename(title)
		thumbnailPath := fmt.Sprintf("./backend/thumbnails/thumb_%s.jpg", sanitizedTitle)
		relativePath := fmt.Sprintf("thumbnails/thumb_%s.jpg", sanitizedTitle)

		// Generate thumbnail
		if err := generateThumbnail(filePath, thumbnailPath, id, title); err != nil {
			log.Printf("❌ Failed to generate thumbnail for ID %d: %v", id, err)
			continue
		}

		// Update database
		if err := updateDatabasePath(db, id, "thumbnail", relativePath); err != nil {
			log.Printf("❌ Failed to update thumbnail path for ID %d: %v", id, err)
			continue
		}

		thumbnailsGenerated++
		time.Sleep(100 * time.Millisecond) // Small delay to prevent overwhelming system
	}

	// Get media without previews
	fmt.Println("\n🎬 Finding media without previews...")
	previewRows, err := db.Query(`
		SELECT id, title, file_path 
		FROM media 
		WHERE (preview_clip_path IS NULL OR preview_clip_path = '') 
		AND file_path IS NOT NULL AND file_path != ''
		LIMIT 20
	`)
	if err != nil {
		log.Fatal("Failed to query media without previews:", err)
	}
	defer previewRows.Close()

	previewsGenerated := 0
	for previewRows.Next() {
		var id uint
		var title, filePath string

		if err := previewRows.Scan(&id, &title, &filePath); err != nil {
			log.Printf("Error scanning preview row: %v", err)
			continue
		}

		// Check if video file exists
		if _, err := os.Stat(filePath); os.IsNotExist(err) {
			log.Printf("⚠️  Video file not found for ID %d: %s", id, filePath)
			continue
		}

		// Generate preview path
		sanitizedTitle := sanitizeFilename(title)
		previewPath := fmt.Sprintf("./backend/previews/preview_%d_%s_audio_fallback.mp4", id, sanitizedTitle)
		relativePath := fmt.Sprintf("previews/preview_%d_%s_audio_fallback.mp4", id, sanitizedTitle)

		// Generate preview
		if err := generatePreview(filePath, previewPath, id, title); err != nil {
			log.Printf("❌ Failed to generate preview for ID %d: %v", id, err)
			continue
		}

		// Update database
		if err := updateDatabasePath(db, id, "preview", relativePath); err != nil {
			log.Printf("❌ Failed to update preview path for ID %d: %v", id, err)
			continue
		}

		previewsGenerated++
		time.Sleep(200 * time.Millisecond) // Small delay for preview generation
	}

	fmt.Printf("\n✅ Asset generation completed!\n")
	fmt.Printf("📊 Results:\n")
	fmt.Printf("   - Thumbnails generated: %d\n", thumbnailsGenerated)
	fmt.Printf("   - Previews generated: %d\n", previewsGenerated)
	fmt.Printf("\n🚀 Run this script multiple times to generate all missing assets!\n")
	fmt.Printf("💡 Tip: Use 'LIMIT 50' in queries for larger batches\n")
}
