package handlers

import (
	"fmt"
	"math/rand"
	"net/http"
	"strconv"
	"strings"
	"time"

	"homeflix-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type PreviewVideo struct {
	ID           string  `json:"id"`
	MediaID      uint    `json:"media_id"`
	Title        string  `json:"title"`
	URL          string  `json:"url"`
	Type         string  `json:"type"`
	Year         int     `json:"year"`
	Rating       float64 `json:"rating"`
	NavigatePath string  `json:"navigate_path"`
}

type NowPlayingResponse struct {
	Videos []PreviewVideo `json:"videos"`
	Total  int            `json:"total"`
	Page   int            `json:"page"`
	Limit  int            `json:"limit"`
}

func GetNowPlayingPreviews(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		pageStr := c.DefaultQuery("page", "1")
		limitStr := c.DefaultQuery("limit", "5")
		randomStr := strings.ToLower(c.DefaultQuery("random", "true"))

		page, err := strconv.Atoi(pageStr)
		if err != nil || page < 1 {
			page = 1
		}

		limit, err := strconv.Atoi(limitStr)
		if err != nil || limit < 1 || limit > 50 {
			limit = 5
		}

		if mediaService == nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Media service is not available",
			})
			return
		}

		allMedia, err := mediaService.GetAllMedia()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to load media library",
			})
			return
		}

		candidates := make([]PreviewVideo, 0, len(allMedia))
		seenPaths := make(map[string]bool)
		for _, media := range allMedia {
			if strings.TrimSpace(media.PreviewClipPath) == "" && strings.TrimSpace(media.PreviewPath) == "" && strings.TrimSpace(media.TrailerPath) == "" {
				continue
			}
			if strings.TrimSpace(media.FilePath) == "" {
				continue
			}

			displayType := "movie"
			navigatePath := fmt.Sprintf("/movie/%d", media.ID)
			if media.Type == "tv" || media.Type == "series" || media.Type == "episode" {
				displayType = "tv"
				seriesID := media.ID
				if media.SeriesID != nil && *media.SeriesID > 0 {
					seriesID = *media.SeriesID
				}
				navigatePath = fmt.Sprintf("/tv-series/%d", seriesID)
			}
			if seenPaths[navigatePath] {
				continue
			}

			title := strings.TrimSpace(media.Title)
			if displayType == "tv" && media.Series != nil && strings.TrimSpace(media.Series.Title) != "" {
				title = strings.TrimSpace(media.Series.Title)
			}
			if title == "" {
				title = "Untitled"
			}

			candidates = append(candidates, PreviewVideo{
				ID:           fmt.Sprintf("%d", media.ID),
				MediaID:      media.ID,
				Title:        title,
				URL:          fmt.Sprintf("/api/preview-clips/%d", media.ID),
				Type:         displayType,
				Year:         media.Year,
				Rating:       media.Rating,
				NavigatePath: navigatePath,
			})
			seenPaths[navigatePath] = true
		}

		rand.Seed(time.Now().UnixNano())
		if randomStr != "false" {
			rand.Shuffle(len(candidates), func(i, j int) {
				candidates[i], candidates[j] = candidates[j], candidates[i]
			})
		}

		total := len(candidates)
		offset := (page - 1) * limit

		if offset >= total {
			c.JSON(http.StatusOK, NowPlayingResponse{
				Videos: []PreviewVideo{},
				Total:  total,
				Page:   page,
				Limit:  limit,
			})
			return
		}

		end := offset + limit
		if end > total {
			end = total
		}

		c.JSON(http.StatusOK, NowPlayingResponse{
			Videos: candidates[offset:end],
			Total:  total,
			Page:   page,
			Limit:  limit,
		})
	}
}
