package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"homeflix-backend/internal/models"
	"homeflix-backend/internal/services"
)

// GetTMDBShelf — GET /api/tmdb/shelf/:name?page=1
// A ready-made TMDB row; titles already in the library carry local_id.
func GetTMDBShelf(tmdb *services.TMDBService, db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
		items, title, err := tmdb.Shelf(c.Param("name"), page)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error(), "items": []services.ShelfItem{}})
			return
		}
		out := make([]services.ShelfItem, len(items))
		copy(out, items) // cached slice: don't write into it
		var movieIDs, tvIDs []int
		for _, it := range out {
			if it.MediaType == "movie" {
				movieIDs = append(movieIDs, it.ID)
			} else {
				tvIDs = append(tvIDs, it.ID)
			}
		}
		local := map[string]int{}
		if len(movieIDs) > 0 {
			var rows []models.Media
			db.Select("id", "tmdb_id").Where("type = ? AND tmdb_id IN ?", "movie", movieIDs).Find(&rows)
			for _, r := range rows {
				local["movie:"+strconv.Itoa(r.TMDBID)] = int(r.ID)
			}
		}
		if len(tvIDs) > 0 {
			var rows []models.Series
			db.Select("id", "tmdb_id").Where("tmdb_id IN ?", tvIDs).Find(&rows)
			for _, r := range rows {
				local["tv:"+strconv.Itoa(r.TMDBID)] = int(r.ID)
			}
		}
		for i := range out {
			out[i].LocalID = local[out[i].MediaType+":"+strconv.Itoa(out[i].ID)]
		}
		c.Header("Cache-Control", "public, max-age=600")
		c.JSON(http.StatusOK, gin.H{"name": c.Param("name"), "title": title, "items": out})
	}
}

// GetTMDBTrailer — GET /api/tmdb/trailer/:type/:id -> {"youtube_id": "..."}
func GetTMDBTrailer(tmdb *services.TMDBService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil || id <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
			return
		}
		key, err := tmdb.Trailer(c.Param("type"), id)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		c.Header("Cache-Control", "public, max-age=86400")
		c.JSON(http.StatusOK, gin.H{"youtube_id": key})
	}
}
