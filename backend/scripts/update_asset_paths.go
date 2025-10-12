package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"strings"

	_ "github.com/mattn/go-sqlite3"
)

// sanitizeFilename cleans filename for asset matching
func sanitizeFilename(filename string) string {
	invalidChars := []string{"/", "\\", ":", "*", "?", "\"", "<", ">", "|", " "}
	result := filename
	for _, char := range invalidChars {
		result = strings.ReplaceAll(result, char, "_")
	}
	return result
}

// findThumbnailPath finds existing thumbnail for media
func findThumbnailPath(mediaID uint, title string) string {
	sanitizedTitle := sanitizeFilename(title)
	
	// Check all possible thumbnail patterns
	patterns := []string{
		// Most common existing patterns
		fmt.Sprintf("./backend/thumbnails/thumb_%s.jpg", sanitizedTitle),
		fmt.Sprintf("./thumbnails/thumb_%s.jpg", sanitizedTitle),
		
		// ID + Title patterns
		fmt.Sprintf("./backend/thumbnails/thumb_%d_%s.jpg", mediaID, sanitizedTitle),
		fmt.Sprintf("./thumbnails/thumb_%d_%s.jpg", mediaID, sanitizedTitle),
		
		// THUMB_TITLE_(YEAR) patterns
		fmt.Sprintf("./backend/thumbnails/THUMB_%s.jpg", sanitizedTitle),
		fmt.Sprintf("./thumbnails/THUMB_%s.jpg", sanitizedTitle),
		
		// Additional variations
		fmt.Sprintf("./backend/thumbnails/Thumb_%s.jpg", sanitizedTitle),
		fmt.Sprintf("./thumbnails/Thumb_%s.jpg", sanitizedTitle),
		fmt.Sprintf("./backend/thumbnails/%s_thumb.jpg", sanitizedTitle),
		fmt.Sprintf("./thumbnails/%s_thumb.jpg", sanitizedTitle),
		
		// Simple ID-based patterns
		fmt.Sprintf("./backend/thumbnails/thumb_%d.jpg", mediaID),
		fmt.Sprintf("./thumbnails/thumb_%d.jpg", mediaID),
	}
	
	for _, pattern := range patterns {
		if _, err := os.Stat(pattern); err == nil {
			// Convert to relative path for database storage
			if strings.HasPrefix(pattern, "./backend/") {
				return strings.TrimPrefix(pattern, "./backend/")
			}
			if strings.HasPrefix(pattern, "./") {
				return strings.TrimPrefix(pattern, "./")
			}
			return pattern
		}
	}
	
	return ""
}

// findPreviewPath finds existing preview for media
func findPreviewPath(mediaID uint, title string) string {
	sanitizedTitle := sanitizeFilename(title)
	
	// Check all possible preview patterns
	patterns := []string{
		// Current actual pattern with _audio_fallback suffix (most common)
		fmt.Sprintf("./backend/previews/preview_%d_%s_audio_fallback.mp4", mediaID, sanitizedTitle),
		fmt.Sprintf("./previews/preview_%d_%s_audio_fallback.mp4", mediaID, sanitizedTitle),
		
		// Legacy patterns without suffix
		fmt.Sprintf("./backend/previews/preview_%d_%s.mp4", mediaID, sanitizedTitle),
		fmt.Sprintf("./previews/preview_%d_%s.mp4", mediaID, sanitizedTitle),
		
		// Title-only patterns
		fmt.Sprintf("./backend/previews/preview_%s.mp4", sanitizedTitle),
		fmt.Sprintf("./previews/preview_%s.mp4", sanitizedTitle),
		
		// PREVIEW_TITLE_(YEAR) patterns
		fmt.Sprintf("./backend/previews/PREVIEW_%s.mp4", sanitizedTitle),
		fmt.Sprintf("./previews/PREVIEW_%s.mp4", sanitizedTitle),
		
		// Additional variations
		fmt.Sprintf("./backend/previews/Preview_%s.mp4", sanitizedTitle),
		fmt.Sprintf("./previews/Preview_%s.mp4", sanitizedTitle),
		fmt.Sprintf("./backend/previews/%s_preview.mp4", sanitizedTitle),
		fmt.Sprintf("./previews/%s_preview.mp4", sanitizedTitle),
		
		// Simple ID-based patterns
		fmt.Sprintf("./backend/previews/preview_%d.mp4", mediaID),
		fmt.Sprintf("./previews/preview_%d.mp4", mediaID),
	}
	
	for _, pattern := range patterns {
		if _, err := os.Stat(pattern); err == nil {
			// Convert to relative path for database storage
			if strings.HasPrefix(pattern, "./backend/") {
				return strings.TrimPrefix(pattern, "./backend/")
			}
			if strings.HasPrefix(pattern, "./") {
				return strings.TrimPrefix(pattern, "./")
			}
			return pattern
		}
	}
	
	return ""
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
	
	// Get all media records
	rows, err := db.Query("SELECT id, title, thumbnail_path, preview_clip_path FROM media")
	if err != nil {
		log.Fatal("Failed to query media:", err)
	}
	defer rows.Close()
	
	updated := 0
	thumbnailsFound := 0
	previewsFound := 0
	
	fmt.Println("🔍 Scanning for existing asset files...")
	
	for rows.Next() {
		var id uint
		var title string
		var thumbnailPath sql.NullString
		var previewPath sql.NullString
		
		if err := rows.Scan(&id, &title, &thumbnailPath, &previewPath); err != nil {
			log.Printf("Error scanning row: %v", err)
			continue
		}
		
		needsUpdate := false
		newThumbnailPath := ""
		newPreviewPath := ""
		
		// Check thumbnail
		if !thumbnailPath.Valid || thumbnailPath.String == "" {
			if foundPath := findThumbnailPath(id, title); foundPath != "" {
				newThumbnailPath = foundPath
				needsUpdate = true
				thumbnailsFound++
				fmt.Printf("📸 Found thumbnail for ID %d (%s): %s\n", id, title, foundPath)
			}
		} else {
			newThumbnailPath = thumbnailPath.String
		}
		
		// Check preview
		if !previewPath.Valid || previewPath.String == "" {
			if foundPath := findPreviewPath(id, title); foundPath != "" {
				newPreviewPath = foundPath
				needsUpdate = true
				previewsFound++
				fmt.Printf("🎬 Found preview for ID %d (%s): %s\n", id, title, foundPath)
			}
		} else {
			newPreviewPath = previewPath.String
		}
		
		// Update database if needed
		if needsUpdate {
			query := "UPDATE media SET "
			args := []interface{}{}
			setParts := []string{}
			
			if newThumbnailPath != "" {
				setParts = append(setParts, "thumbnail_path = ?")
				args = append(args, newThumbnailPath)
			}
			
			if newPreviewPath != "" {
				setParts = append(setParts, "preview_clip_path = ?")
				args = append(args, newPreviewPath)
			}
			
			if len(setParts) > 0 {
				query += strings.Join(setParts, ", ") + " WHERE id = ?"
				args = append(args, id)
				
				if _, err := db.Exec(query, args...); err != nil {
					log.Printf("Failed to update media ID %d: %v", id, err)
				} else {
					updated++
				}
			}
		}
	}
	
	fmt.Printf("\n✅ Asset path update completed!\n")
	fmt.Printf("📊 Results:\n")
	fmt.Printf("   - Media records updated: %d\n", updated)
	fmt.Printf("   - Thumbnails found: %d\n", thumbnailsFound)
	fmt.Printf("   - Previews found: %d\n", previewsFound)
	fmt.Printf("\n🚀 Database is now ready for instant Redis-cached asset serving!\n")
}
