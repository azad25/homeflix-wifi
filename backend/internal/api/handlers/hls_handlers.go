package handlers

import (
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"

	"homeflix-backend/internal/services"

	"github.com/gin-gonic/gin"
)

// resolveClientProfile picks the capability profile for this request.
// Priority: explicit ?profile= param, then TV-app User-Agent detection,
// then web (the conservative default).
func resolveClientProfile(c *gin.Context) services.ClientProfile {
	switch strings.ToLower(c.Query("profile")) {
	case "tv":
		return services.TVClientProfile()
	case "web":
		return services.WebClientProfile()
	}
	if isTVAppClient(c) {
		return services.TVClientProfile()
	}
	return services.WebClientProfile()
}

// GetStreamInfo is the playback decision endpoint. It reads the stored
// stream profile (probing once if missing), matches it against the client's
// capabilities, and tells the player exactly how to play this file.
// This replaces per-request ffprobe + User-Agent sniffing.
func GetStreamInfo(profileService *services.StreamProfileService, hlsService *services.HLSService, mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
			return
		}

		media, err := mediaService.GetMediaByID(uint(id))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}
		if media.FilePath == "" {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media file path not available"})
			return
		}
		if _, err := os.Stat(media.FilePath); os.IsNotExist(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media file not found on disk"})
			return
		}

		if err := profileService.EnsureProfile(media); err != nil {
			// Probe failed - let the player fall back to the legacy direct URL
			c.JSON(http.StatusOK, gin.H{
				"strategy": "direct",
				"url":      fmt.Sprintf("/api/stream/%d", media.ID),
				"warning":  "stream profile unavailable: " + err.Error(),
			})
			return
		}

		client := resolveClientProfile(c)
		decision := services.Decide(media, client)

		resp := gin.H{
			"strategy":       decision.Strategy,
			"reason":         decision.Reason,
			"client_profile": client.Name,
			"video_codec":    media.VideoCodec,
			"audio_codec":    media.AudioCodec,
			"container":      media.Container,
			"width":          media.VideoWidth,
			"height":         media.VideoHeight,
			"bit_depth":      media.VideoBitDepth,
			"duration":       media.Duration,
		}
		if decision.Strategy == "hls" {
			resp["url"] = fmt.Sprintf("/api/stream/%d/hls/index.m3u8?profile=%s", media.ID, client.Name)
			resp["video_mode"] = decision.VideoMode
			resp["audio_mode"] = decision.AudioMode
		} else {
			resp["url"] = fmt.Sprintf("/api/stream/%d", media.ID)
		}

		c.Header("Cache-Control", "no-store") // decision depends on live session state
		c.JSON(http.StatusOK, resp)
	}
}

// GetHLSPlaylist serves the VOD playlist for a media item.
func GetHLSPlaylist(profileService *services.StreamProfileService, hlsService *services.HLSService, mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
			return
		}

		media, err := mediaService.GetMediaByID(uint(id))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}
		if err := profileService.EnsureProfile(media); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to probe media: " + err.Error()})
			return
		}

		decision := services.Decide(media, resolveClientProfile(c))
		if decision.Strategy == "direct" {
			// Client asked for HLS anyway (e.g. wants guaranteed seeking) -
			// serve it as a pure remux
			decision.Strategy = "hls"
			decision.VideoMode = "copy"
			if media.AudioCodec == "aac" {
				decision.AudioMode = "copy"
			} else {
				decision.AudioMode = "transcode"
			}
		}

		playlist, err := hlsService.Playlist(media, decision)
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": err.Error()})
			return
		}

		c.Header("Content-Type", "application/vnd.apple.mpegurl")
		c.Header("Cache-Control", "no-cache")
		c.Header("Access-Control-Allow-Origin", "*")
		c.String(http.StatusOK, playlist)
	}
}

// GetHLSSegment serves one transport-stream segment, blocking briefly while
// the encoder produces it and restarting the encoder on out-of-range seeks.
func GetHLSSegment(profileService *services.StreamProfileService, hlsService *services.HLSService, mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
			return
		}

		segName := c.Param("segment") // "seg12.ts"
		if !strings.HasPrefix(segName, "seg") || !strings.HasSuffix(segName, ".ts") {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid segment name"})
			return
		}
		index, err := strconv.Atoi(strings.TrimSuffix(strings.TrimPrefix(segName, "seg"), ".ts"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid segment index"})
			return
		}

		media, err := mediaService.GetMediaByID(uint(id))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}
		if err := profileService.EnsureProfile(media); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to probe media: " + err.Error()})
			return
		}

		decision := services.Decide(media, resolveClientProfile(c))
		if decision.Strategy == "direct" {
			decision.Strategy = "hls"
			decision.VideoMode = "copy"
			if media.AudioCodec == "aac" {
				decision.AudioMode = "copy"
			} else {
				decision.AudioMode = "transcode"
			}
		}

		segPath, err := hlsService.Segment(media, decision, index)
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": err.Error()})
			return
		}

		c.Header("Content-Type", "video/mp2t")
		c.Header("Cache-Control", "public, max-age=3600")
		c.Header("Access-Control-Allow-Origin", "*")
		c.File(segPath)
	}
}

// BackfillStreamProfiles kicks off a background probe of every media row
// that has no stored stream profile yet (one-time migration for the
// existing library; new files are probed by the scanner).
func BackfillStreamProfiles(profileService *services.StreamProfileService) gin.HandlerFunc {
	return func(c *gin.Context) {
		go profileService.BackfillProfiles()
		c.JSON(http.StatusAccepted, gin.H{"message": "Stream profile backfill started in background"})
	}
}
