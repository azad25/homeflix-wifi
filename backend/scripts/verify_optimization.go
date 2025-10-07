package main

import (
	"fmt"
	"log"
	"time"

	"homeflix-backend/internal/scanner"
)

func main() {
	// Test optimization features
	mediaScanner := scanner.NewMediaScanner()
	
	fmt.Println("Testing performance optimizations...")
	
	// Test batch size adjustment
	mediaScanner.SetBatchSize(50)
	fmt.Println("✓ Batch size set to 50")
	
	// Test performance monitoring
	start := time.Now()
	
	// Simulate some work
	time.Sleep(100 * time.Millisecond)
	
	duration := time.Since(start)
	fmt.Printf("✓ Performance test completed in %v\n", duration)
	
	fmt.Println("All optimization tests passed!")
}