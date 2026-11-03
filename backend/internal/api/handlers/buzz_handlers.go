package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"homeflix-backend/internal/services"
	"homeflix-backend/internal/services/buzz"
)

func buzzInterests(taste *services.TasteService, userID string) []buzz.Interest {
	if taste == nil {
		return nil
	}
	top, err := taste.TopInterests(userID, 30)
	if err != nil {
		return nil
	}
	out := make([]buzz.Interest, 0, len(top))
	for _, t := range top {
		out = append(out, buzz.Interest{Kind: t.Kind, Name: t.Name, Weight: t.Weight})
	}
	return out
}

// GetBuzz — GET /api/buzz?region=in&person=Tom%20Hardy
// Entertainment news + videos ranked for the viewer.
func GetBuzz(b *buzz.Service, taste *services.TasteService) gin.HandlerFunc {
	return func(c *gin.Context) {
		feed := b.BuildFeed(buzzInterests(taste, tasteUserID(c)), c.Query("region"), c.Query("person"))
		c.Header("Cache-Control", "private, max-age=60")
		c.JSON(http.StatusOK, feed)
	}
}

// BuzzStream — GET /api/buzz/stream (SSE): "items" events with new stories/videos.
func BuzzStream(b *buzz.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Content-Type", "text/event-stream")
		c.Header("Cache-Control", "no-cache")
		c.Header("Connection", "keep-alive")
		c.Header("X-Accel-Buffering", "no")
		ch, cancel := b.Subscribe()
		defer cancel()
		flusher, _ := c.Writer.(http.Flusher)
		fmt.Fprint(c.Writer, ": connected\n\n")
		if flusher != nil {
			flusher.Flush()
		}
		ping := time.NewTicker(25 * time.Second)
		defer ping.Stop()
		for {
			select {
			case <-c.Request.Context().Done():
				return
			case <-ping.C:
				fmt.Fprint(c.Writer, ": ping\n\n")
			case items := <-ch:
				data, _ := json.Marshal(items)
				fmt.Fprintf(c.Writer, "event: items\ndata: %s\n\n", data)
			}
			if flusher != nil {
				flusher.Flush()
			}
		}
	}
}

// BuzzHealth — GET /api/admin/buzz/health
func BuzzHealth(b *buzz.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		h, at := b.Health()
		c.JSON(http.StatusOK, gin.H{"sources": b.Sources, "errors": h, "updated": at})
	}
}

// RefreshBuzz — POST /api/admin/buzz/refresh
func RefreshBuzz(b *buzz.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		b.Kick()
		c.JSON(http.StatusAccepted, gin.H{"ok": true})
	}
}

// GetBuzzSettings — GET /api/buzz/settings
func GetBuzzSettings(b *buzz.Service) gin.HandlerFunc {
	return func(c *gin.Context) { c.JSON(http.StatusOK, b.Settings()) }
}

// UpdateBuzzSettings — PUT /api/buzz/settings {"letterboxd_users": ["name"]}
func UpdateBuzzSettings(b *buzz.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		var in buzz.Settings
		if err := c.ShouldBindJSON(&in); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		out, err := b.UpdateSettings(in)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, out)
	}
}
