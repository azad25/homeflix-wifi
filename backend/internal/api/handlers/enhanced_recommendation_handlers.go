package handlers

import (
	"crypto/md5"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"homeflix-backend/internal/models"
	"homeflix-backend/internal/services"
)

// Enhanced recommendation handlers that ensure unique content for each session

// GetUniqueRecommendations provides session-aware unique recommendations
func GetUniqueRecommendations(recommendationService *services.RecommendationService, mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get session identifier from headers or generate one
		sessionID := c.GetHeader("X-Session-ID")
		if sessionID == "" {
			sessionID = generateSessionID(c)
		}

		// Get limit parameter
		limit := 20
		if limitStr := c.Query("limit"); limitStr != "" {
			if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
				limit = l
			}
		}

		// Get recommendation type
		recType := c.Query("type")
		if recType == "" {
			recType = "mixed"
		}

		log.Printf("🎯 Generating unique recommendations for session %s (type: %s, limit: %d)", sessionID, recType, limit)

		// Generate unique recommendations based on session and timestamp
		recommendations, err := generateSessionAwareRecommendations(recommendationService, mediaService, sessionID, recType, limit)
		if err != nil {
			log.Printf("❌ Failed to generate recommendations: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		log.Printf("✅ Generated %d unique recommendations for session %s", len(recommendations), sessionID)
		c.Header("X-Session-ID", sessionID)
		c.JSON(http.StatusOK, recommendations)
	}
}

// GetSmartTrendingRecommendationsEnhanced provides enhanced trending with uniqueness
func GetSmartTrendingRecommendationsEnhanced(recommendationService *services.RecommendationService, mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		sessionID := getOrCreateSessionID(c)
		limit := getLimit(c, 20)

		log.Printf("🔥 Generating smart trending recommendations for session %s", sessionID)

		// Get trending media with session-based randomization
		trending, err := mediaService.GetTrendingMedia(limit * 3) // Get more to allow filtering
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Apply session-based shuffling and filtering
		recommendations := applySessionBasedShuffle(trending, sessionID, limit)

		c.Header("X-Session-ID", sessionID)
		c.JSON(http.StatusOK, recommendations)
	}
}

// GetPersonalizedRecommendationsEnhanced provides enhanced personalized recommendations
func GetPersonalizedRecommendationsEnhanced(recommendationService *services.RecommendationService, mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		sessionID := getOrCreateSessionID(c)
		limit := getLimit(c, 20)

		log.Printf("👤 Generating personalized recommendations for session %s", sessionID)

		// Get all media for personalization
		allMedia, err := mediaService.GetAllMedia()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Generate personalized recommendations with session awareness
		recommendations := generatePersonalizedWithSession(allMedia, sessionID, limit)

		c.Header("X-Session-ID", sessionID)
		c.JSON(http.StatusOK, recommendations)
	}
}

// GetMixedRecommendationsEnhanced provides enhanced mixed recommendations
func GetMixedRecommendationsEnhanced(recommendationService *services.RecommendationService, mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		sessionID := getOrCreateSessionID(c)
		limit := getLimit(c, 20)

		log.Printf("🎭 Generating mixed recommendations for session %s", sessionID)

		// Get different types of content
		allMedia, err := mediaService.GetAllMedia()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Generate mixed recommendations with session-based variety
		recommendations := generateMixedWithSession(allMedia, sessionID, limit)

		c.Header("X-Session-ID", sessionID)
		c.JSON(http.StatusOK, recommendations)
	}
}

// Helper functions

func generateSessionID(c *gin.Context) string {
	// Generate session ID based on IP, User-Agent, and timestamp
	ip := c.ClientIP()
	userAgent := c.GetHeader("User-Agent")
	timestamp := time.Now().Unix()
	
	data := fmt.Sprintf("%s-%s-%d", ip, userAgent, timestamp)
	hash := md5.Sum([]byte(data))
	return fmt.Sprintf("%x", hash)[:16]
}

func getOrCreateSessionID(c *gin.Context) string {
	sessionID := c.GetHeader("X-Session-ID")
	if sessionID == "" {
		sessionID = generateSessionID(c)
	}
	return sessionID
}

func getLimit(c *gin.Context, defaultLimit int) int {
	limit := defaultLimit
	if limitStr := c.Query("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
			limit = l
		}
	}
	return limit
}

func generateSessionAwareRecommendations(recommendationService *services.RecommendationService, mediaService *services.MediaService, sessionID, recType string, limit int) ([]models.Media, error) {
	// Get all available media
	allMedia, err := mediaService.GetAllMedia()
	if err != nil {
		return nil, err
	}

	var recommendations []models.Media

	switch recType {
	case "trending":
		trending, err := mediaService.GetTrendingMedia(limit * 2)
		if err == nil {
			recommendations = applySessionBasedShuffle(trending, sessionID, limit)
		}
	case "popular":
		popular, err := mediaService.GetPopularMedia()
		if err == nil {
			recommendations = applySessionBasedShuffle(popular, sessionID, limit)
		}
	case "recent":
		recent, err := mediaService.GetRecentMedia()
		if err == nil {
			recommendations = applySessionBasedShuffle(recent, sessionID, limit)
		}
	default: // mixed
		recommendations = generateMixedWithSession(allMedia, sessionID, limit)
	}

	// Fallback to all media if specific type fails
	if len(recommendations) == 0 {
		recommendations = applySessionBasedShuffle(allMedia, sessionID, limit)
	}

	return recommendations, nil
}

func applySessionBasedShuffle(media []models.Media, sessionID string, limit int) []models.Media {
	if len(media) == 0 {
		return media
	}

	// Create session-based seed for consistent but unique shuffling
	sessionSeed := int64(0)
	for _, char := range sessionID {
		sessionSeed += int64(char)
	}
	
	// Add time-based component for different results over time
	timeSeed := time.Now().Unix() / 3600 // Changes every hour
	finalSeed := sessionSeed + timeSeed

	// Create a new random generator with session seed
	rng := rand.New(rand.NewSource(finalSeed))

	// Create a copy to avoid modifying original
	shuffled := make([]models.Media, len(media))
	copy(shuffled, media)

	// Fisher-Yates shuffle with session-based randomness
	for i := len(shuffled) - 1; i > 0; i-- {
		j := rng.Intn(i + 1)
		shuffled[i], shuffled[j] = shuffled[j], shuffled[i]
	}

	// Return requested number of items
	if limit > len(shuffled) {
		limit = len(shuffled)
	}

	return shuffled[:limit]
}

func generatePersonalizedWithSession(allMedia []models.Media, sessionID string, limit int) []models.Media {
	// Create session-based preferences
	sessionSeed := int64(0)
	for _, char := range sessionID {
		sessionSeed += int64(char)
	}
	
	rng := rand.New(rand.NewSource(sessionSeed))

	// Define preference weights based on session
	genrePreferences := map[string]float64{
		"action":     0.8 + rng.Float64()*0.4,
		"drama":      0.7 + rng.Float64()*0.4,
		"comedy":     0.6 + rng.Float64()*0.4,
		"thriller":   0.8 + rng.Float64()*0.3,
		"sci-fi":     0.9 + rng.Float64()*0.2,
		"horror":     0.5 + rng.Float64()*0.5,
		"romance":    0.4 + rng.Float64()*0.6,
		"adventure":  0.8 + rng.Float64()*0.3,
	}

	// Score media based on session preferences
	type scoredMedia struct {
		media models.Media
		score float64
	}

	var scored []scoredMedia
	for _, media := range allMedia {
		score := 0.0
		
		// Base score from rating
		if media.Rating > 0 {
			score += float64(media.Rating) * 0.3
		}
		
		// Genre preference score
		for _, genre := range media.Genres {
			if pref, exists := genrePreferences[genre.Name]; exists {
				score += pref * 0.4
			}
		}
		
		// Popularity score
		if media.ViewCount > 0 {
			score += float64(media.ViewCount) * 0.0001
		}
		
		// Recency bonus (higher IDs = newer)
		score += float64(media.ID) * 0.0001
		
		// Session-based randomness
		score += rng.Float64() * 0.3

		scored = append(scored, scoredMedia{media: media, score: score})
	}

	// Sort by score
	for i := 0; i < len(scored)-1; i++ {
		for j := i + 1; j < len(scored); j++ {
			if scored[i].score < scored[j].score {
				scored[i], scored[j] = scored[j], scored[i]
			}
		}
	}

	// Extract top recommendations
	var recommendations []models.Media
	for i := 0; i < limit && i < len(scored); i++ {
		recommendations = append(recommendations, scored[i].media)
	}

	return recommendations
}

func generateMixedWithSession(allMedia []models.Media, sessionID string, limit int) []models.Media {
	// Create session-based seed
	sessionSeed := int64(0)
	for _, char := range sessionID {
		sessionSeed += int64(char)
	}
	
	// Separate content by type
	var movies, tvShows []models.Media
	for _, media := range allMedia {
		if media.Type == "movie" {
			movies = append(movies, media)
		} else {
			tvShows = append(tvShows, media)
		}
	}

	// Calculate distribution
	movieCount := int(float64(limit) * 0.7) // 70% movies
	tvCount := limit - movieCount           // 30% TV shows

	var recommendations []models.Media

	// Add shuffled movies
	if len(movies) > 0 {
		shuffledMovies := applySessionBasedShuffle(movies, sessionID, movieCount)
		recommendations = append(recommendations, shuffledMovies...)
	}

	// Add shuffled TV shows
	if len(tvShows) > 0 {
		shuffledTV := applySessionBasedShuffle(tvShows, sessionID, tvCount)
		recommendations = append(recommendations, shuffledTV...)
	}

	// Final shuffle of the mixed content
	finalRecommendations := applySessionBasedShuffle(recommendations, sessionID+"_final", limit)

	return finalRecommendations
}