package handlers

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"

	"homeflix-backend/internal/services/governor"

	"github.com/gin-gonic/gin"
)

const governorFile = "./data/governor.json"

// LoadGovernorSettings restores the admin's "pause background work" choice.
func LoadGovernorSettings() {
	var st struct {
		Paused bool `json:"paused"`
	}
	if b, err := os.ReadFile(governorFile); err == nil && json.Unmarshal(b, &st) == nil && st.Paused {
		governor.Default.Pause(true)
	}
}

// GetGovernorStatus — GET /api/admin/system/governor
// Host load, the current mode and every work class's slots.
func GetGovernorStatus() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		c.JSON(http.StatusOK, governor.Default.Status())
	}
}

// UpdateGovernor — PUT /api/admin/system/governor {"paused": true}
// Pauses scanning, preview/thumbnail generation and trailer encodes
// (interactive work and playback are never paused).
func UpdateGovernor() gin.HandlerFunc {
	return func(c *gin.Context) {
		var in struct {
			Paused *bool `json:"paused"`
		}
		if err := c.ShouldBindJSON(&in); err != nil || in.Paused == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "expected {\"paused\": true|false}"})
			return
		}
		governor.Default.Pause(*in.Paused)
		_ = os.MkdirAll(filepath.Dir(governorFile), 0o755)
		b, _ := json.Marshal(map[string]bool{"paused": *in.Paused})
		_ = os.WriteFile(governorFile, b, 0o644)
		c.JSON(http.StatusOK, governor.Default.Status())
	}
}
