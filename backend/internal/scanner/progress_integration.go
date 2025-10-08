package scanner

import (
	"fmt"
	"log"
	"time"
)

// Example integration showing how to use ProgressTracker with the media scanner
// This demonstrates the npm-like build status display

func ExampleScanWithProgress() {
	// Create progress tracker
	progress := NewProgressTracker()
	
	// Start progress display
	progress.Start()
	defer progress.Stop()
	
	// Simulate scanning phases
	simulateDiscoveryPhase(progress)
	simulateProcessingPhase(progress)
	simulateAssetGenerationPhase(progress)
}

func simulateDiscoveryPhase(progress *ProgressTracker) {
	progress.UpdatePhase("🔍 Phase 1: Discovering media files...")
	progress.LogWithProgress("🚀 Starting media library scan...")
	
	// Simulate file discovery
	for i := 0; i < 100; i++ {
		progress.UpdateOperation(fmt.Sprintf("Scanning directory %d/10", (i/10)+1))
		time.Sleep(50 * time.Millisecond)
		
		if i == 50 {
			progress.SetTotalFiles(1000) // Found total files
			progress.LogWithProgress("📁 Discovered 1000 media files")
		}
	}
}

func simulateProcessingPhase(progress *ProgressTracker) {
	progress.UpdatePhase("⚡ Phase 2: Processing media files...")
	
	for i := 0; i < 1000; i++ {
		progress.UpdateOperation(fmt.Sprintf("Processing: movie_%d.mp4", i+1))
		progress.UpdateGoroutines(25 + (i%25)) // Simulate varying goroutine usage
		
		// Simulate processing results
		if i%50 == 0 {
			progress.IncrementError() // Occasional error
		} else if i%20 == 0 {
			progress.IncrementSkipped() // Some skipped
		} else {
			progress.IncrementProcessed() // Most processed successfully
		}
		
		// Log important events
		if i%100 == 0 {
			progress.LogWithProgress(fmt.Sprintf("✅ Processed %d files so far", i))
		}
		
		time.Sleep(10 * time.Millisecond)
	}
}

func simulateAssetGenerationPhase(progress *ProgressTracker) {
	progress.UpdatePhase("🎨 Phase 3: Generating thumbnails and previews...")
	
	for i := 0; i < 200; i++ {
		progress.UpdateOperation(fmt.Sprintf("Generating assets for media %d", i+1))
		progress.UpdateGoroutines(40 + (i%10)) // High resource usage
		
		if i%10 == 0 {
			progress.LogWithProgress(fmt.Sprintf("🖼️ Generated thumbnails for %d media items", i))
		}
		
		time.Sleep(25 * time.Millisecond)
	}
	
	progress.UpdatePhase("✅ Scan completed successfully!")
	progress.LogWithProgress("🎉 All media processing completed!")
}

// Integration helper for existing MediaScanner
func (s *MediaScanner) ScanWithProgressDisplay() error {
	// Create and start progress tracker
	progress := NewProgressTracker()
	progress.Start()
	defer progress.Stop()
	
	// Phase 1: File Discovery
	progress.UpdatePhase("🔍 Phase 1: Discovering media files...")
	progress.LogWithProgress("🚀 Starting comprehensive media library scan...")
	
	// Your existing file discovery logic here
	// files, err := s.discoverFiles()
	// progress.SetTotalFiles(len(files))
	
	// Phase 2: Processing
	progress.UpdatePhase("⚡ Phase 2: Processing media files...")
	
	// Your existing processing logic here with progress updates:
	// for _, file := range files {
	//     progress.UpdateOperation(fmt.Sprintf("Processing: %s", filepath.Base(file.Path)))
	//     progress.UpdateGoroutines(int(s.getActiveGoroutines()))
	//     
	//     // Process file...
	//     if err != nil {
	//         progress.IncrementError()
	//     } else {
	//         progress.IncrementProcessed()
	//     }
	// }
	
	// Phase 3: Asset Generation
	progress.UpdatePhase("🎨 Phase 3: Generating assets...")
	
	// Phase 4: Cleanup
	progress.UpdatePhase("🧹 Phase 4: Finalizing...")
	progress.LogWithProgress("🎉 Media scan completed successfully!")
	
	return nil
}

// Helper function to integrate with existing logging
func LogWithProgress(progress *ProgressTracker, format string, args ...interface{}) {
	message := fmt.Sprintf(format, args...)
	if progress != nil {
		progress.LogWithProgress(message)
	} else {
		log.Printf(message)
	}
}
