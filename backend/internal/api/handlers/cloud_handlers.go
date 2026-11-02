package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"homeflix-backend/internal/services/cloud"
)

func cloudErr(c *gin.Context, err error) bool {
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return true
	}
	return false
}

// GetCloud — GET /api/admin/cloud
func GetCloud(s *cloud.Service) gin.HandlerFunc {
	return func(c *gin.Context) { c.JSON(http.StatusOK, s.Info(c.Request.Context())) }
}

// CreateCloudRemote — POST /api/admin/cloud/remotes {name, type, params}
func CreateCloudRemote(s *cloud.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Name   string            `json:"name"`
			Type   string            `json:"type"`
			Params map[string]string `json:"params"`
		}
		if cloudErr(c, c.ShouldBindJSON(&req)) || cloudErr(c, s.CreateRemote(c.Request.Context(), req.Name, req.Type, req.Params)) {
			return
		}
		c.JSON(http.StatusOK, s.Info(c.Request.Context()))
	}
}

// DeleteCloudRemote — DELETE /api/admin/cloud/remotes/:name
func DeleteCloudRemote(s *cloud.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		if cloudErr(c, s.DeleteRemote(c.Request.Context(), c.Param("name"))) {
			return
		}
		c.JSON(http.StatusOK, s.Info(c.Request.Context()))
	}
}

// AddCloudMount — POST /api/admin/cloud/mounts {remote, folder, cache_gb}
func AddCloudMount(s *cloud.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Remote  string `json:"remote"`
			Folder  string `json:"folder"`
			CacheGB int    `json:"cache_gb"`
		}
		if cloudErr(c, c.ShouldBindJSON(&req)) {
			return
		}
		if _, err := s.AddMount(req.Remote, req.Folder, req.CacheGB); cloudErr(c, err) {
			return
		}
		c.JSON(http.StatusOK, s.Info(c.Request.Context()))
	}
}

// UpdateCloudMount — PATCH /api/admin/cloud/mounts/:remote {enabled}
func UpdateCloudMount(s *cloud.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Enabled bool `json:"enabled"`
		}
		if cloudErr(c, c.ShouldBindJSON(&req)) || cloudErr(c, s.SetMountEnabled(c.Param("remote"), req.Enabled)) {
			return
		}
		c.JSON(http.StatusOK, s.Info(c.Request.Context()))
	}
}

// DeleteCloudMount — DELETE /api/admin/cloud/mounts/:remote
func DeleteCloudMount(s *cloud.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		if cloudErr(c, s.RemoveMount(c.Param("remote"))) {
			return
		}
		c.JSON(http.StatusOK, s.Info(c.Request.Context()))
	}
}

// UpdateCloudSettings — PUT /api/admin/cloud/settings {offload_when_low, offload_target, offload_idle_days}
func UpdateCloudSettings(s *cloud.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Offload  bool   `json:"offload_when_low"`
			Target   string `json:"offload_target"`
			IdleDays int    `json:"offload_idle_days"`
		}
		if cloudErr(c, c.ShouldBindJSON(&req)) {
			return
		}
		if _, err := s.UpdateSettings(req.Offload, req.Target, req.IdleDays); cloudErr(c, err) {
			return
		}
		c.JSON(http.StatusOK, s.Info(c.Request.Context()))
	}
}

// RunCloudOffload — POST /api/admin/cloud/offload (run the low-space offload now)
func RunCloudOffload(s *cloud.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		n := s.Offload(c.Request.Context())
		c.JSON(http.StatusOK, gin.H{"moved": n})
	}
}
