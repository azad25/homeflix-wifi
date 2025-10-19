package handlers

import (
	"fmt"
	"net/http"
	"strconv"

	"homeflix-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type NewsHandlers struct {
	newsService *services.NewsService
}

func NewNewsHandlers(newsService *services.NewsService) *NewsHandlers {
	return &NewsHandlers{
		newsService: newsService,
	}
}

// GetLatestNews returns the latest news articles
func (nh *NewsHandlers) GetLatestNews() gin.HandlerFunc {
	return func(c *gin.Context) {
		limitStr := c.DefaultQuery("limit", "20")
		limit, err := strconv.Atoi(limitStr)
		if err != nil || limit < 1 {
			limit = 20
		}

		articles := nh.newsService.GetLatestNews(limit)

		c.JSON(http.StatusOK, gin.H{
			"articles": articles,
			"total":    len(articles),
			"limit":    limit,
		})
	}
}

// GetBreakingNews returns breaking news for the ticker
func (nh *NewsHandlers) GetBreakingNews() gin.HandlerFunc {
	return func(c *gin.Context) {
		articles := nh.newsService.GetBreakingNews()

		c.JSON(http.StatusOK, gin.H{
			"articles": articles,
			"total":    len(articles),
		})
	}
}

// GetNewsForTicker returns news formatted for the TV ticker
func (nh *NewsHandlers) GetNewsForTicker() gin.HandlerFunc {
	return func(c *gin.Context) {
		articles := nh.newsService.GetNewsForTicker()
		
		// Debug logging
		fmt.Printf("News ticker request: found %d articles\n", len(articles))

		// Format for ticker display
		var tickerItems []gin.H
		for _, article := range articles {
			tickerItems = append(tickerItems, gin.H{
				"id":     article.ID,
				"text":   article.Title,
				"source": article.Source,
				"time":   article.PublishedAt.Format("15:04"),
			})
		}

		fmt.Printf("Returning %d ticker items\n", len(tickerItems))

		c.JSON(http.StatusOK, gin.H{
			"items": tickerItems,
			"total": len(tickerItems),
		})
	}
}

// GetNewsHealth returns the health status of the news service
func (nh *NewsHandlers) GetNewsHealth() gin.HandlerFunc {
	return func(c *gin.Context) {
		isHealthy := nh.newsService.IsHealthy()

		c.JSON(http.StatusOK, gin.H{
			"healthy": isHealthy,
			"status":  map[string]interface{}{
				"service_running": isHealthy,
				"last_update":     "recent",
			},
		})
	}
}