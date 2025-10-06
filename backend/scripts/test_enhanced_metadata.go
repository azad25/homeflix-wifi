package main

import (
	"fmt"
	"log"
	"os"

	"homeflix-backend/internal/services"
)

func main() {
	// Test TMDB service with enhanced metadata
	tmdbService := services.NewTMDBService()
	
	// Test with a popular movie
	testTitle := "The Dark Knight (2008)"
	testPath := "/test/movies/The.Dark.Knight.2008.1080p.BluRay.x264.mp4"
	
	fmt.Printf("Testing enhanced metadata for: %s\n", testTitle)
	fmt.Printf("File path: %s\n", testPath)
	fmt.Println("=" + fmt.Sprintf("%*s", 60, ""))
	
	metadata, err := tmdbService.GenerateMediaMetadata(testPath, testTitle)
	if err != nil {
		log.Fatalf("Failed to generate metadata: %v", err)
	}
	
	// Display enhanced metadata
	fmt.Printf("Title: %s\n", metadata.Title)
	fmt.Printf("Year: %d\n", metadata.Year)
	fmt.Printf("Rating: %.1f/10\n", metadata.Rating)
	fmt.Printf("Runtime: %d minutes\n", metadata.Runtime)
	fmt.Printf("Status: %s\n", metadata.Status)
	fmt.Printf("Tagline: %s\n", metadata.Tagline)
	fmt.Printf("Description: %s\n", metadata.Description[:100] + "...")
	
	fmt.Println("\n📊 Box Office Information:")
	fmt.Printf("Budget: $%d\n", metadata.Budget)
	fmt.Printf("Revenue: $%d\n", metadata.Revenue)
	fmt.Printf("Box Office: %s\n", metadata.BoxOffice)
	
	fmt.Println("\n🎭 Cast & Crew:")
	fmt.Printf("Directors: %v\n", metadata.Directors)
	fmt.Printf("Stars: %v\n", metadata.Stars)
	fmt.Printf("Writers: %v\n", metadata.Writers)
	fmt.Printf("Producers: %v\n", metadata.Producers)
	
	fmt.Println("\n🏷️ Additional Info:")
	fmt.Printf("Genres: %v\n", metadata.Genres)
	fmt.Printf("Country: %s\n", metadata.Country)
	fmt.Printf("Language: %s\n", metadata.Language)
	fmt.Printf("IMDB ID: %s\n", metadata.IMDBID)
	fmt.Printf("Homepage: %s\n", metadata.Homepage)
	fmt.Printf("Collection: %s\n", metadata.Collection)
	fmt.Printf("Popularity: %.1f\n", metadata.Popularity)
	fmt.Printf("Vote Count: %d\n", metadata.VoteCount)
	
	fmt.Println("\n✅ Enhanced metadata test completed successfully!")
}