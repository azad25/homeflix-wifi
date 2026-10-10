package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"homeflix-backend/internal/storage"
)

// GetStorageStats returns per-path disk usage and low-storage alerts
func GetStorageStats(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		infos := storage.GetActiveStorageInfos(db)
		if infos == nil {
			infos = []storage.StorageInfo{}
		}

		var lowPaths []storage.StorageInfo
		for _, info := range infos {
			if info.IsLow {
				lowPaths = append(lowPaths, info)
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"storages":   infos,
			"low_alerts": lowPaths,
			"has_low":    len(lowPaths) > 0,
		})
	}
}
