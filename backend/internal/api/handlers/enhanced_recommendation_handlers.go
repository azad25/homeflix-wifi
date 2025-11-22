package handlers

import (
	"crypto/md5"
	"fmt"
	"hash/fnv"
	"log"
	"math/rand"
	"net/http"
	"sort"
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
			sessionID = generateEnhancedSessionID(c)
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

		// Use the enhanced trending recommendations from recommendation service (excludes episodes)
		trending, err := recommendationService.GetEnhancedTrendingRecommendations(limit, sessionID)
		if err != nil {
			// Fallback to dynamic trending recommendations
			trending, err = recommendationService.GetDynamicRecommendations("trending", limit, sessionID)
			if err != nil {
				// Final fallback to default recommendations
				trending, err = recommendationService.GetDefaultRecommendations(limit)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch trending recommendations"})
					return
				}
			}
		}

		// Ensure no episodes are included (double-check)
		trending = filterOutEpisodes(trending)

		c.Header("X-Session-ID", sessionID)
		c.JSON(http.StatusOK, trending)
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

		// Use enhanced popular recommendations as the base for mixed content (excludes episodes)
		recommendations, err := recommendationService.GetEnhancedPopularRecommendations(limit, sessionID)
		if err != nil {
			// Fallback to dynamic mixed recommendations
			recommendations, err = recommendationService.GetDynamicRecommendations("mixed", limit, sessionID)
			if err != nil {
				// Final fallback to default recommendations
				recommendations, err = recommendationService.GetDefaultRecommendations(limit)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch mixed recommendations"})
					return
				}
			}
		}

		// Ensure no episodes are included (double-check)
		recommendations = filterOutEpisodes(recommendations)

		c.Header("X-Session-ID", sessionID)
		c.JSON(http.StatusOK, recommendations)
	}
}

// Helper functions

func generateEnhancedSessionID(c *gin.Context) string {
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
		// Try to get from cookie
		if cookie, err := c.Cookie("homeflix_session"); err == nil {
			sessionID = cookie
		}
	}
	if sessionID == "" {
		// Generate new session ID
		sessionID = generateEnhancedSessionID(c)
		// Set cookie for future requests
		c.SetCookie("homeflix_session", sessionID, 86400*30, "/", "", false, true) // 30 days
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
	// Get all available media (excluding episodes)
	allMedia, err := mediaService.GetAllMedia()
	if err != nil {
		return nil, err
	}
	
	// CRITICAL: Filter out episodes from all media
	allMedia = filterOutEpisodes(allMedia)

	var recommendations []models.Media

	switch recType {
	case "trending":
		trending, err := recommendationService.GetEnhancedTrendingRecommendations(limit, sessionID)
		if err == nil {
			recommendations = trending
		}
	case "popular":
		popular, err := recommendationService.GetEnhancedPopularRecommendations(limit, sessionID)
		if err == nil {
			recommendations = popular
		}
	case "recent":
		recent, err := recommendationService.GetDynamicRecommendations("recent", limit, sessionID)
		if err == nil {
			recommendations = recent
		}
	default: // mixed
		recommendations = generateMixedWithSession(allMedia, sessionID, limit)
	}

	// Fallback to all media if specific type fails
	if len(recommendations) == 0 {
		recommendations = applySessionBasedShuffle(allMedia, sessionID, limit)
	}
	
	// Ensure at least one latest media item is included
	recommendations = ensureLatestMediaIncluded(recommendations, allMedia, limit)

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
	if len(allMedia) == 0 {
		return allMedia
	}
	
	// CRITICAL: Filter out episodes before processing
	allMedia = filterOutEpisodes(allMedia)

	// Create deterministic but varied selection based on session
	hash := fnv.New64a()
	hash.Write([]byte(sessionID))
	seed := int64(hash.Sum64())
	
	// Create a new random generator with the session-based seed
	rng := rand.New(rand.NewSource(seed))
	
	// Create a copy to avoid modifying the original slice
	mediaCopy := make([]models.Media, len(allMedia))
	copy(mediaCopy, allMedia)
	
	// Shuffle using session-based randomness
	rng.Shuffle(len(mediaCopy), func(i, j int) {
		mediaCopy[i], mediaCopy[j] = mediaCopy[j], mediaCopy[i]
	})
	
	// Apply some intelligent weighting while maintaining session consistency
	sort.SliceStable(mediaCopy, func(i, j int) bool {
		// Use session hash to create consistent but varied ordering
		hashI := fnv.New64a()
		hashI.Write([]byte(fmt.Sprintf("%s-%d", sessionID, mediaCopy[i].ID)))
		hashJ := fnv.New64a()
		hashJ.Write([]byte(fmt.Sprintf("%s-%d", sessionID, mediaCopy[j].ID)))
		
		scoreI := float64(mediaCopy[i].ViewCount)*0.3 + mediaCopy[i].Rating*10 + float64(hashI.Sum64()%100)
		scoreJ := float64(mediaCopy[j].ViewCount)*0.3 + mediaCopy[j].Rating*10 + float64(hashJ.Sum64()%100)
		
		return scoreI > scoreJ
	})
	
	if len(mediaCopy) > limit {
		mediaCopy = mediaCopy[:limit]
	}
	
	return mediaCopy
}

// filterOutEpisodes removes episodes from media slice, keeping only movies and main series
func filterOutEpisodes(media []models.Media) []models.Media {
	var filtered []models.Media
	for _, m := range media {
		if m.Type != "episode" {
			filtered = append(filtered, m)
		}
	}
	return filtered
}

// ensureLatestMediaIncluded ensures at least one of the latest media items is included in recommendations
func ensureLatestMediaIncluded(currentMedia []models.Media, allMedia []models.Media, limit int) []models.Media {
	if len(allMedia) == 0 {
		return currentMedia
	}
	
	// Find the latest media item (should already be filtered to exclude episodes)
	var latestMedia *models.Media
	for _, media := range allMedia {
		if latestMedia == nil || media.CreatedAt.After(latestMedia.CreatedAt) {
			latestMedia = &media
		}
	}
	
	if latestMedia == nil {
		return currentMedia
	}
	
	// Check if latest media is already in the recommendations
	for _, media := range currentMedia {
		if media.ID == latestMedia.ID {
			// Latest media already included, return as-is
			return currentMedia
		}
	}
	
	// Latest media not included, add it to the beginning
	result := []models.Media{*latestMedia}
	
	// Add existing recommendations (up to limit-1 to make room for latest)
	maxExisting := limit - 1
	if maxExisting < 0 {
		maxExisting = 0
	}
	
	for i, media := range currentMedia {
		if i >= maxExisting {
			break
		}
		result = append(result, media)
	}
	
	return result
}

// GetEnhancedRecommendations is the enhanced recommendations handler that routes based on category
func GetEnhancedRecommendations(recommendationService *services.RecommendationService, mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		category := c.Query("category")
		limit := 20
		if limitStr := c.Query("limit"); limitStr != "" {
			if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
				limit = l
			}
		}

		userID := uint(1)
		if userIDStr := c.Query("user_id"); userIDStr != "" {
			if uid, err := strconv.ParseUint(userIDStr, 10, 32); err == nil {
				userID = uint(uid)
			}
		}

		log.Printf("🎯 Main recommendations handler - category: %s, limit: %d, userID: %d", category, limit, userID)

		var media []models.Media
		var err error

		// Route to appropriate handler based on category
		switch category {
		case "trending":
			media, err = recommendationService.GetTrendingRecommendations(limit)
		case "top_picks":
			media, err = recommendationService.GetRecommendationsForUser(userID, limit)
		case "continue_watching":
			media, err = recommendationService.GetContinueWatching(userID)
		case "because_you_watched":
			media, err = recommendationService.GetSimilarMedia(userID, limit)
		case "new_releases":
			media, err = recommendationService.GetTrendingRecommendations(limit)
		case "popular":
			media, err = recommendationService.GetRecommendationsForUser(userID, limit)
		case "mixed":
			// Use the enhanced mixed recommendations
			sessionID := getOrCreateSessionID(c)
			// Get all media for mixed recommendations
			allMedia, err := mediaService.GetAllMedia()
			if err != nil {
				// Fallback to trending if we can't get all media
				media, err = recommendationService.GetTrendingRecommendations(limit)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
					return
				}
			} else {
				// Filter out episodes before generating mixed recommendations
				allMedia = filterOutEpisodes(allMedia)
				media = generateMixedWithSession(allMedia, sessionID, limit)
				// Ensure at least one latest media item is included
				media = ensureLatestMediaIncluded(media, allMedia, limit)
			}
			c.Header("X-Session-ID", sessionID)
			c.JSON(http.StatusOK, media)
			return
		default:
			// Default to trending recommendations
			media, err = recommendationService.GetTrendingRecommendations(limit)
		}

		// Handle errors with fallback
		if err != nil {
			log.Printf("❌ Primary recommendation method failed for category %s: %v", category, err)
			// Fallback to trending recommendations
			media, err = recommendationService.GetTrendingRecommendations(limit)
			if err != nil {
				// Final fallback to default recommendations
				media, err = recommendationService.GetDefaultRecommendations(limit)
				if err != nil {
					log.Printf("❌ All recommendation methods failed: %v", err)
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch recommendations"})
					return
				}
			}
		}

		log.Printf("✅ Successfully fetched %d recommendations for category: %s", len(media), category)
		c.JSON(http.StatusOK, media)
	}
}

// GetSimilarMediaByID gets similar content for a specific media ID
func GetSimilarMediaByID(recommendationService *services.RecommendationService, mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		mediaIDStr := c.Param("id")
		mediaID, err := strconv.ParseUint(mediaIDStr, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
			return
		}

		limit := 10
		if limitStr := c.Query("limit"); limitStr != "" {
			if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 50 {
				limit = l
			}
		}

		log.Printf("🔍 Getting similar media for ID: %d, limit: %d", mediaID, limit)

		// Get the target media first to understand its properties
		targetMedia, err := mediaService.GetMediaByID(uint(mediaID))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		// Get all media to find similar ones (excluding episodes)
		allMedia, err := mediaService.GetAllMedia()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch media"})
			return
		}
		
		// Filter out episodes from all media
		allMedia = filterOutEpisodes(allMedia)

		// Find similar media based on genre, type, and other attributes
		var similarMedia []models.Media
		for _, media := range allMedia {
			if media.ID == uint(mediaID) {
				continue // Skip the target media itself
			}

			// Check similarity based on genre and type
			if media.Type == targetMedia.Type && sharesSimilarGenres(media.GenreNames, targetMedia.GenreNames) {
				similarMedia = append(similarMedia, media)
			}
		}

		// Limit results
		if len(similarMedia) > limit {
			similarMedia = similarMedia[:limit]
		}

		// If we don't have enough similar media, fallback to trending
		if len(similarMedia) < limit {
			trending, err := recommendationService.GetTrendingRecommendations(limit - len(similarMedia))
			if err == nil {
				// Add trending media that aren't already in the list
				existingIDs := make(map[uint]bool)
				existingIDs[uint(mediaID)] = true // Exclude target media
				for _, item := range similarMedia {
					existingIDs[item.ID] = true
				}

				for _, item := range trending {
					if !existingIDs[item.ID] && len(similarMedia) < limit {
						similarMedia = append(similarMedia, item)
						existingIDs[item.ID] = true
					}
				}
			}
		}

		log.Printf("✅ Found %d similar media items for ID: %d", len(similarMedia), mediaID)
		c.JSON(http.StatusOK, similarMedia)
	}
}

// sharesSimilarGenres checks if two genre arrays have overlapping genres
func sharesSimilarGenres(genres1, genres2 []string) bool {
	if len(genres1) == 0 || len(genres2) == 0 {
		return false
	}
	
	// Check for any overlapping genres
	for _, genre1 := range genres1 {
		for _, genre2 := range genres2 {
			if genre1 == genre2 {
				return true
			}
		}
	}
	
	return false
}