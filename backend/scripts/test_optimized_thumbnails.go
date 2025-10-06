package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"homeflix-backend/internal/services"
)

func main() {
	// Initialize optimized thumbnail service
	thumbnailService := services.NewThumbnailService()
	defer thumbnailService.Shutdown()

	// Test video path (replace with actual video file)
	testVideoPath := "/path/to/test/video.mp4"
	if len(os.Args) > 1 {
		testVideoPath = os.Args[1]
	}

	// Check if test video exists
	if _, err := os.Stat(testVideoPath); os.IsNotExist(err) {
		log.Printf("Test video not found: %s", testVideoPath)
		log.Printf("Usage: go run test_optimized_thumbnails.go /path/to/video.mp4")
		return
	}

	fmt.Printf("🚀 Testing Optimized Thumbnail Generation\n")
	fmt.Printf("==========================================\n")
	fmt.Printf("Test video: %s\n", testVideoPath)
	fmt.Printf("Hardware acceleration: %s\n", thumbnailService.GetWorkerPoolStats()["hardware_accel"])
	fmt.Printf("Workers: %v\n", thumbnailService.GetWorkerPoolStats()["workers"])
	fmt.Printf("\n")

	// Test 1: Single thumbnail generation
	fmt.Printf("📸 Test 1: Single Thumbnail Generation\n")
	start := time.Now()
	thumbnailPath, err := thumbnailService.GenerateThumbnail(testVideoPath, 1, "Test Movie")
	duration := time.Since(start)
	
	if err != nil {
		log.Printf("❌ Thumbnail generation failed: %v", err)
	} else {
		fmt.Printf("✅ Thumbnail generated in %v\n", duration)
		fmt.Printf("   Path: %s\n", thumbnailPath)
		
		// Check file size
		if info, err := os.Stat(thumbnailPath); err == nil {
			fmt.Printf("   Size: %d bytes\n", info.Size())
		}
	}
	fmt.Printf("\n")

	// Test 2: Single preview generation
	fmt.Printf("🎬 Test 2: Single Preview Generation\n")
	start = time.Now()
	previewPath, err := thumbnailService.GeneratePreviewClip(testVideoPath, 1, "Test Movie")
	duration = time.Since(start)
	
	if err != nil {
		log.Printf("❌ Preview generation failed: %v", err)
	} else {
		fmt.Printf("✅ Preview generated in %v\n", duration)
		fmt.Printf("   Path: %s\n", previewPath)
		
		// Check file size
		if info, err := os.Stat(previewPath); err == nil {
			fmt.Printf("   Size: %d bytes\n", info.Size())
		}
	}
	fmt.Printf("\n")

	// Test 3: Batch thumbnail generation
	fmt.Printf("📸 Test 3: Batch Thumbnail Generation (5 thumbnails)\n")
	batchRequests := make([]struct {
		VideoPath string
		MediaID   uint
		Title     string
	}, 5)

	for i := 0; i < 5; i++ {
		batchRequests[i] = struct {
			VideoPath string
			MediaID   uint
			Title     string
		}{
			VideoPath: testVideoPath,
			MediaID:   uint(i + 10),
			Title:     fmt.Sprintf("Test Movie %d", i+1),
		}
	}

	start = time.Now()
	results := thumbnailService.GenerateThumbnailBatch(batchRequests)
	duration = time.Since(start)

	successful := 0
	for i, result := range results {
		if result.Error != nil {
			fmt.Printf("❌ Thumbnail %d failed: %v\n", i+1, result.Error)
		} else {
			successful++
			fmt.Printf("✅ Thumbnail %d: %s\n", i+1, filepath.Base(result.Path))
		}
	}
	
	fmt.Printf("📊 Batch Results: %d/%d successful in %v\n", successful, len(results), duration)
	fmt.Printf("   Average per thumbnail: %v\n", duration/time.Duration(len(results)))
	fmt.Printf("\n")

	// Test 4: Service statistics
	fmt.Printf("📊 Service Statistics\n")
	stats := thumbnailService.GetWorkerPoolStats()
	for key, value := range stats {
		fmt.Printf("   %s: %v\n", key, value)
	}

	activeJobs := thumbnailService.GetActiveJobs()
	fmt.Printf("   active_jobs_detail: %d\n", len(activeJobs))
	for jobID, job := range activeJobs {
		fmt.Printf("     %s: %s (%s)\n", jobID, job.Type, job.Status)
	}

	fmt.Printf("\n🎉 Performance test completed!\n")
}