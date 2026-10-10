package handlers

import (
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"homeflix-backend/internal/models"
	"homeflix-backend/internal/services"

	"github.com/gin-gonic/gin"
)

// resolveClientProfile picks the capability profile for this request.
// Priority: explicit ?profile= param, then TV-player User-Agent detection,
// then web (the conservative default). Codec lists the client measured
// itself (?vcodecs=&acodecs=&containers=&hbd=) refine the base profile.
func resolveClientProfile(c *gin.Context) services.ClientProfile {
	var base services.ClientProfile
	switch strings.ToLower(c.Query("profile")) {
	case "tv":
		base = services.TVClientProfile()
	case "web":
		base = services.WebClientProfile()
	case "cast":
		base = services.CastClientProfile()
	default:
		if isTVPlayerClient(c) {
			base = services.TVClientProfile()
		} else {
			base = services.WebClientProfile()
		}
	}
	return services.ClientProfileFromCaps(base, c.Query("vcodecs"), c.Query("acodecs"), c.Query("containers"), c.Query("hbd"))
}

// isTVPlayerClient recognises the native TV player. Unlike isTVAppClient
// it does not treat every "android" User-Agent as the TV app: phone and
// tablet browsers also say Android but can't direct-play MKV/HEVC/AC3.
func isTVPlayerClient(c *gin.Context) bool {
	ua := strings.ToLower(c.GetHeader("User-Agent"))
	if strings.Contains(ua, "homeflix-tv") || strings.Contains(ua, "exoplayer") || strings.Contains(ua, "okhttp") {
		return true
	}
	return strings.Contains(ua, "android") && !strings.Contains(ua, "mozilla")
}

// hlsDecision is Decide for a request that is going to be served as HLS,
// including files that could have been direct-played (client asked for HLS).
func hlsDecision(media *models.Media, client services.ClientProfile) services.StreamDecision {
	d := services.Decide(media, client)
	if d.Strategy == "direct" {
		d.Strategy = "hls"
		d.VideoMode, d.AudioMode, d.Segments = services.HLSModes(media, client, true, true)
	}
	return d
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
			// Carry the client's capability params and viewer id so the
			// playlist and its segments resolve the exact same session
			q := c.Request.URL.Query()
			q.Set("profile", client.Name)
			q.Del("start")
			resp["url"] = fmt.Sprintf("/api/stream/%d/hls/index.m3u8?%s", media.ID, q.Encode())
			resp["video_mode"] = decision.VideoMode
			resp["audio_mode"] = decision.AudioMode
			resp["segments"] = decision.Segments

			// Start encoding at the resume position now: by the time the
			// player has loaded hls.js and the playlist, the first segment
			// is already being produced
			start, _ := strconv.ParseFloat(c.Query("start"), 64)
			if err := hlsService.Prewarm(media, decision, viewerSessionID(c), start); err != nil {
				log.Printf("⚠️ HLS prewarm failed for media %d: %v", media.ID, err)
			}
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

		decision := hlsDecision(media, resolveClientProfile(c))

		playlist, err := hlsService.Playlist(media, decision, viewerSessionID(c), c.Request.URL.RawQuery)
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

// viewerSessionID is the per-player id the client attaches (?sid=), so each
// viewer gets their own encoder. Restricted to a short alphanumeric token
// because it becomes part of a directory name.
func viewerSessionID(c *gin.Context) string {
	sid := c.Query("sid")
	if len(sid) > 32 {
		return ""
	}
	for _, r := range sid {
		if !(r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9') {
			return ""
		}
	}
	return sid
}

// GetHLSSegment serves one media segment (seg12.ts / seg12.m4s) or the fMP4
// init segment (init.mp4), blocking briefly while the encoder produces it
// and restarting the encoder on out-of-range seeks.
func GetHLSSegment(profileService *services.StreamProfileService, hlsService *services.HLSService, mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
			return
		}

		segName := c.Param("segment") // "seg12.ts", "seg12.m4s" or "init.mp4"
		isInit := segName == "init.mp4"
		index, contentType := -1, "video/mp2t"
		if !isInit {
			ext := filepath.Ext(segName)
			if !strings.HasPrefix(segName, "seg") || (ext != ".ts" && ext != ".m4s") {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid segment name"})
				return
			}
			index, err = strconv.Atoi(strings.TrimSuffix(strings.TrimPrefix(segName, "seg"), ext))
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid segment index"})
				return
			}
			if ext == ".m4s" {
				contentType = "video/iso.segment"
			}
		} else {
			contentType = "video/mp4"
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

		decision := hlsDecision(media, resolveClientProfile(c))

		var segPath string
		if isInit {
			segPath, err = hlsService.Init(c.Request.Context(), media, decision, viewerSessionID(c))
		} else {
			segPath, err = hlsService.Segment(c.Request.Context(), media, decision, viewerSessionID(c), index)
		}
		if err != nil {
			if errors.Is(err, services.ErrSegmentWaitCanceled) {
				return // client is gone
			}
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": err.Error()})
			return
		}

		c.Header("Content-Type", contentType)
		c.Header("Cache-Control", "public, max-age=3600")
		c.Header("Access-Control-Allow-Origin", "*")
		if err := serveMediaFile(c, segPath); err != nil && !c.Writer.Written() {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": err.Error()})
		}
	}
}

// ReleaseHLSSession frees a viewer's encoder when their player closes.
// Accepts DELETE (fetch) and POST (navigator.sendBeacon on page unload).
func ReleaseHLSSession(hlsService *services.HLSService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
			return
		}
		n := hlsService.Release(uint(id), viewerSessionID(c))
		c.JSON(http.StatusOK, gin.H{"released": n})
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
