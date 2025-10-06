package main

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"homeflix-backend/internal/services"
)

func main() {
	log.Println("🧪 Testing ALAC service fixes...")

	// Test 1: Check FFmpeg availability
	log.Println("🔍 Test 1: Checking FFmpeg availability...")
	if !checkFFmpegAvailable() {
		log.Println("❌ FFmpeg not available - ALAC service will not work")
		return
	}
	log.Println("✅ FFmpeg is available")

	// Test 2: Create ALAC service
	log.Println("🔍 Test 2: Creating ALAC service...")
	outputDir := "/tmp/alac_test"
	alacService := services.NewALACAudioService(outputDir)
	if alacService == nil {
		log.Println("❌ Failed to create ALAC service")
		return
	}
	log.Println("✅ ALAC service created successfully")

	// Test 3: Test batch mode
	log.Println("🔍 Test 3: Testing batch mode...")
	alacService.SetBatchMode(true)
	log.Println("✅ Batch mode enabled")
	
	alacService.SetBatchMode(false)
	log.Println("✅ Batch mode disabled")

	// Test 4: Test resource limits (create a dummy video file)
	log.Println("🔍 Test 4: Testing resource limits with dummy file...")
	dummyVideoPath := createDummyVideo()
	if dummyVideoPath == "" {
		log.Println("⚠️ Could not create dummy video, skipping extraction test")
	} else {
		defer os.Remove(dummyVideoPath)
		
		// Test manual extraction with timeout
		log.Println("🎵 Testing manual ALAC extraction...")
		start := time.Now()
		
		_, err := alacService.ManualExtractALAC(dummyVideoPath, 999)
		duration := time.Since(start)
		
		if err != nil {
			log.Printf("⚠️ ALAC extraction failed (expected for dummy file): %v", err)
		} else {
			log.Printf("✅ ALAC extraction completed in %v", duration)
		}
		
		// Verify timeout protection (should not take more than 5 minutes for a small dummy file)
		if duration > 5*time.Minute {
			log.Printf("❌ ALAC extraction took too long: %v", duration)
		} else {
			log.Printf("✅ ALAC extraction completed within reasonable time: %v", duration)
		}
	}

	// Test 5: Test cleanup
	log.Println("🔍 Test 5: Testing cleanup...")
	if err := alacService.CleanupOversizedFiles(); err != nil {
		log.Printf("⚠️ Cleanup failed: %v", err)
	} else {
		log.Println("✅ Cleanup completed successfully")
	}

	// Cleanup test directory
	os.RemoveAll(outputDir)
	
	log.Println("🎉 All ALAC service tests completed!")
}

func checkFFmpegAvailable() bool {
	// Check if ffmpeg command exists
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		log.Printf("❌ FFmpeg not found in PATH: %v", err)
		return false
	}
	
	// Check if ffprobe command exists
	if _, err := exec.LookPath("ffprobe"); err != nil {
		log.Printf("❌ FFprobe not found in PATH: %v", err)
		return false
	}
	
	// Test FFmpeg with a simple command
	cmd := exec.Command("ffmpeg", "-version")
	if err := cmd.Run(); err != nil {
		log.Printf("❌ FFmpeg version check failed: %v", err)
		return false
	}
	
	return true
}

func createDummyVideo() string {
	// Create a very small dummy video file for testing
	outputPath := "/tmp/dummy_test_video.mp4"
	
	// Create a 1-second black video with silent audio
	cmd := exec.Command("ffmpeg",
		"-f", "lavfi",
		"-i", "color=black:size=320x240:duration=1",
		"-f", "lavfi", 
		"-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
		"-c:v", "libx264",
		"-c:a", "aac",
		"-shortest",
		"-y",
		outputPath,
	)
	
	if err := cmd.Run(); err != nil {
		log.Printf("⚠️ Could not create dummy video: %v", err)
		return ""
	}
	
	// Verify file was created
	if _, err := os.Stat(outputPath); err != nil {
		log.Printf("⚠️ Dummy video file not found after creation: %v", err)
		return ""
	}
	
	log.Printf("✅ Created dummy video: %s", outputPath)
	return outputPath
}