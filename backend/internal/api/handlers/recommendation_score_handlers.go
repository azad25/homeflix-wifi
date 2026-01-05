package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"homeflix-backend/internal/services"
)

// GetRecommendationScoreForMedia returns a personalized recommendation score for a specific media item
func GetRecommendationScoreForMedia(recommendationService *services.RecommendationService, db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		mediaID, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
			return
		}

		userID := c.GetHeader("X-User-ID")
		if userID == "" {
			userID = "1" // Default user ID for local content
		}

		// Check if this is a valid local media ID
		if mediaID <= 0 {
			c.JSON(http.StatusOK, gin.H{
				"score":    75,
				"reason":   "Recommended for you",
				"media_id": mediaID,
			})
			return
		}

		// Try recommendation service first
		score, reason, err := recommendationService.GetScoreForMedia(userID, uint(mediaID))
		if err == nil && score > 0 {
			c.JSON(http.StatusOK, gin.H{
				"score":    score,
				"reason":   reason,
				"media_id": mediaID,
			})
			return
		}

		// Fallback: Calculate score from local media attributes
		var media struct {
			ID         uint    `gorm:"column:id"`
			Rating     float64 `gorm:"column:rating"`
			Popularity float64 `gorm:"column:popularity"`
			VoteCount  int     `gorm:"column:vote_count"`
			ViewCount  int     `gorm:"column:view_count"`
			Year       int     `gorm:"column:year"`
			Quality    string  `gorm:"column:quality"`
		}

		if db != nil {
			db.Table("media").Select("id, rating, popularity, vote_count, view_count, year, quality").Where("id = ?", mediaID).First(&media)
		}

		// Calculate score based on media attributes
		calculatedScore := calculateLocalMediaScore(media.Rating, media.Popularity, media.VoteCount, media.ViewCount, media.Year, media.Quality)
		calculatedReason := getScoreReason(calculatedScore, media.Rating, media.Year)

		c.JSON(http.StatusOK, gin.H{
			"score":    calculatedScore,
			"reason":   calculatedReason,
			"media_id": mediaID,
		})
	}
}

// calculateLocalMediaScore calculates a recommendation score for local content
func calculateLocalMediaScore(rating, popularity float64, voteCount, viewCount, year int, quality string) int {
	var score float64 = 0

	// Rating is most important (0-10 scale, contributes up to 80 points)
	if rating > 0 {
		score += rating * 8
	} else {
		score += 56 // Default base if no rating (7 * 8)
	}

	// Popularity bonus (up to 15 points)
	if popularity > 0 {
		popBonus := popularity * 0.15
		if popBonus > 15 {
			popBonus = 15
		}
		score += popBonus
	}

	// Vote count bonus (up to 5 points)
	if voteCount > 0 {
		voteBonus := float64(voteCount) / 40
		if voteBonus > 5 {
			voteBonus = 5
		}
		score += voteBonus
	}

	// Local view count bonus (up to 5 points) - rewards watched content
	if viewCount > 0 {
		viewBonus := float64(viewCount) * 0.5
		if viewBonus > 5 {
			viewBonus = 5
		}
		score += viewBonus
	}

	// Year bonus for newer content (up to 5 points)
	if year > 2015 {
		yearBonus := float64(year-2015) * 0.5
		if yearBonus > 5 {
			yearBonus = 5
		}
		score += yearBonus
	}

	// Quality bonus
	if quality != "" {
		if quality == "4K" || quality == "2160p" || quality == "UHD" {
			score += 3
		} else if quality == "1080p" || quality == "FHD" {
			score += 2
		} else if quality == "720p" || quality == "HD" {
			score += 1
		}
	}

	// Clamp score between 65 and 98
	finalScore := int(score)
	if finalScore < 65 {
		finalScore = 65
	}
	if finalScore > 98 {
		finalScore = 98
	}

	return finalScore
}

// getScoreReason returns a human-readable reason for the score
func getScoreReason(score int, rating float64, year int) string {
	if score >= 90 {
		return "Highly recommended for you"
	}
	if score >= 85 {
		if rating >= 8.0 {
			return "Critically acclaimed"
		}
		return "Great match for your taste"
	}
	if score >= 80 {
		if year >= 2020 {
			return "Popular recent release"
		}
		return "Based on your preferences"
	}
	if score >= 75 {
		return "You might enjoy this"
	}
	return "Recommended for you"
}
