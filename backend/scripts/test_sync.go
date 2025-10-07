package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"

	"homeflix-backend/internal/scanner/sync"
)

func main() {
	// Test storage sync functionality
	syncService := sync.NewStorageSync()
	
	// Test directory
	testDir := "/tmp/test_media"
	os.MkdirAll(testDir, 0755)
	
	// Create test files
	testFiles := []string{
		filepath.Join(testDir, "movie1.mp4"),
		filepath.Join(testDir, "movie2.mkv"),
		filepath.Join(testDir, "series", "episode1.mp4"),
	}
	
	for _, file := range testFiles {
		os.MkdirAll(filepath.Dir(file), 0755)
		f, err := os.Create(file)
		if err != nil {
			log.Printf("Error creating test file %s: %v", file, err)
			continue
		}
		f.Close()
	}
	
	// Test sync
	err := syncService.SyncDirectory(testDir)
	if err != nil {
		log.Printf("Sync error: %v", err)
	} else {
		fmt.Println("Sync completed successfully")
	}
	
	// Cleanup
	os.RemoveAll(testDir)
}