package api

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// HealthResponse represents the health check response
type HealthResponse struct {
	Status    string            `json:"status"`
	Timestamp time.Time         `json:"timestamp"`
	Version   string            `json:"version"`
	Services  map[string]string `json:"services"`
	Uptime    string            `json:"uptime"`
}

var startTime = time.Now()

// HealthCheckHandler returns the health status of the application
func (h *Handler) HealthCheckHandler(c *gin.Context) {
	uptime := time.Since(startTime)
	
	// Check database connection
	dbStatus := "healthy"
	if h.db != nil {
		sqlDB, err := h.db.DB()
		if err != nil || sqlDB.Ping() != nil {
			dbStatus = "unhealthy"
		}
	} else {
		dbStatus = "not_configured"
	}
	
	// Check other services
	services := map[string]string{
		"database": dbStatus,
		"scanner":  "healthy", // You can add actual scanner status check
		"tmdb":     "healthy", // You can add TMDB API status check
	}
	
	// Determine overall status
	status := "healthy"
	for _, serviceStatus := range services {
		if serviceStatus == "unhealthy" {
			status = "degraded"
			break
		}
	}
	
	response := HealthResponse{
		Status:    status,
		Timestamp: time.Now(),
		Version:   "3.0.0",
		Services:  services,
		Uptime:    uptime.String(),
	}
	
	// Return appropriate HTTP status code
	httpStatus := http.StatusOK
	if status == "degraded" {
		httpStatus = http.StatusServiceUnavailable
	}
	
	c.JSON(httpStatus, response)
}