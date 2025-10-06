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
	
	// Test 1: 