package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"time"
)

func main() {
	// Test ALAC integration
	fmt.Println("🎵 Testing ALAC Integration...")
	
	baseURL := "http://localhost:8252/api"
	
	// Test 1: Check ALAC service status
	resp, err := http.Get(baseURL + "/health")
	if err != nil {
		log.Printf("❌ Failed to connect to server: %v", err)
		os.Exit(1)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode == 200 {
		fmt.Println("✅ Server is running")
	} else {
		fmt.Printf("❌ Server returned status: %d\n", resp.StatusCode)
	}
	
	fmt.Println("🎵 ALAC Integration test completed")
}