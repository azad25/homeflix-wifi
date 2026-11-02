package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"homeflix-backend/internal/services/previews"
)

// ServePreviewClip serves a title's hover/hero preview. When there is none
// yet it is queued at interactive priority (ahead of scans) and the reply
// is 202; ?wait=N (max 20) holds the request up to N seconds for it.
func ServePreviewClip(e *previews.Engine) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil || id == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
			return
		}
		if p, ok := e.Lookup(uint(id)); ok {
			previews.Touch(p)
			c.Header("Cache-Control", "public, max-age=3600")
			c.Header("Accept-Ranges", "bytes")
			c.File(p)
			return
		}
		job := e.Request(previews.Source{ID: uint(id)}, true, false)
		if w, _ := strconv.Atoi(c.Query("wait")); w > 0 {
			if w > 20 {
				w = 20
			}
			if p, done, err := job.Wait(time.Duration(w) * time.Second); done && err == nil {
				c.Header("Cache-Control", "public, max-age=3600")
				c.File(p)
				return
			}
		}
		c.Header("Retry-After", "5")
		c.Header("Cache-Control", "no-store")
		c.JSON(http.StatusAccepted, gin.H{"status": "generating", "media_id": id})
	}
}

// GetAssetStorage: preview/cache usage, settings and queue for Settings > Storage.
func GetAssetStorage(e *previews.Engine) gin.HandlerFunc {
	return func(c *gin.Context) { c.JSON(http.StatusOK, e.Usage()) }
}

func UpdateAssetStorageSettings(e *previews.Engine) gin.HandlerFunc {
	return func(c *gin.Context) {
		var s previews.Settings
		if err := c.ShouldBindJSON(&s); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		saved, err := e.UpdateSettings(s)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"settings": saved, "message": "Preview storage settings saved"})
	}
}

func CleanupAssetStorage(e *previews.Engine) gin.HandlerFunc {
	return func(c *gin.Context) {
		r := e.Cleanup()
		c.JSON(http.StatusOK, gin.H{"report": r, "freed": r.Freed()})
	}
}

func GenerateMissingPreviews(e *previews.Engine) gin.HandlerFunc {
	return func(c *gin.Context) {
		n := e.QueueMissing()
		c.JSON(http.StatusOK, gin.H{"queued": n, "message": strconv.Itoa(n) + " previews queued"})
	}
}
