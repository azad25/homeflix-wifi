package handlers

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"

	"homeflix-backend/internal/services"
)

var castUpgrader = websocket.Upgrader{
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
	// LAN app with permissive CORS everywhere else; TVs are native clients.
	CheckOrigin: func(r *http.Request) bool { return true },
}

// CastTVSocket: the TV app connects here and stays connected.
// GET /api/cast/tv/ws?device_id=<stable id>&name=<Living Room TV>&platform=androidtv&app_version=1.2.0
func CastTVSocket(hub *services.CastHub) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := strings.TrimSpace(c.Query("device_id"))
		if id == "" || len(id) > 128 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "device_id is required"})
			return
		}
		name := strings.TrimSpace(c.Query("name"))
		if name == "" {
			name = "HomeFlix TV"
		}
		if len(name) > 80 {
			name = name[:80]
		}
		conn, err := castUpgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			return // Upgrade already wrote the error response
		}
		hub.Serve(conn, services.CastDeviceInfo{
			ID: id, Name: name, Platform: c.Query("platform"), AppVersion: c.Query("app_version"),
		})
	}
}

// ListCastDevices: GET /api/cast/devices
func ListCastDevices(hub *services.CastHub) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		c.JSON(http.StatusOK, gin.H{"devices": hub.Devices()})
	}
}

// GetCastDeviceStatus: GET /api/cast/devices/:id/status
func GetCastDeviceStatus(hub *services.CastHub) gin.HandlerFunc {
	return func(c *gin.Context) {
		d, ok := hub.Status(c.Param("id"))
		if !ok {
			c.JSON(http.StatusNotFound, gin.H{"error": "unknown device"})
			return
		}
		c.Header("Cache-Control", "no-store")
		c.JSON(http.StatusOK, d)
	}
}

var castActions = map[string]bool{"play": true, "pause": true, "resume": true, "seek": true, "stop": true, "volume": true, "subtitle": true}

// SendCastCommand: POST /api/cast/devices/:id/command
// {"action":"play","media":{"id":42,"type":"movie"},"position":2230.5}
func SendCastCommand(hub *services.CastHub) gin.HandlerFunc {
	return func(c *gin.Context) {
		var cmd services.CastCommand
		if err := c.ShouldBindJSON(&cmd); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid command: " + err.Error()})
			return
		}
		if !castActions[cmd.Action] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "unknown action " + cmd.Action})
			return
		}
		if cmd.Action == "play" && (cmd.Media == nil || cmd.Media.ID == 0) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "play requires media.id"})
			return
		}
		if cmd.Action == "seek" && cmd.Position == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "seek requires position"})
			return
		}
		if cmd.From == "" {
			cmd.From = c.GetHeader("X-Cast-Sender")
		}
		ack, err := hub.SendCommand(c.Param("id"), cmd)
		switch {
		case errors.Is(err, services.ErrCastDeviceOffline):
			c.JSON(http.StatusNotFound, gin.H{"ok": false, "error": "TV is offline. Open HomeFlix on the TV and try again."})
			return
		case errors.Is(err, services.ErrCastAckTimeout):
			c.JSON(http.StatusGatewayTimeout, gin.H{"ok": false, "command_id": ack.CommandID, "error": "The TV didn't respond. Make sure the HomeFlix app is running on it."})
			return
		case err != nil:
			c.JSON(http.StatusServiceUnavailable, gin.H{"ok": false, "error": err.Error()})
			return
		}
		status := http.StatusOK
		if !ack.OK {
			status = http.StatusUnprocessableEntity
		}
		c.JSON(status, gin.H{"ok": ack.OK, "command_id": ack.CommandID, "error": ack.Error})
	}
}

// CastDeviceEvents: GET /api/cast/devices/:id/events (Server-Sent Events)
// Streams "status" events so the web player can act as a remote.
func CastDeviceEvents(hub *services.CastHub) gin.HandlerFunc {
	return func(c *gin.Context) {
		ch, unsubscribe, ok := hub.Subscribe(c.Param("id"))
		if !ok {
			c.JSON(http.StatusNotFound, gin.H{"error": "unknown device"})
			return
		}
		defer unsubscribe()
		// The server's WriteTimeout (5m) would otherwise cut the stream; the
		// browser would reconnect, but there's no reason to drop it.
		_ = http.NewResponseController(c.Writer).SetWriteDeadline(time.Time{})
		c.Header("Content-Type", "text/event-stream")
		c.Header("Cache-Control", "no-store")
		c.Header("Connection", "keep-alive")
		c.Header("X-Accel-Buffering", "no")

		// Send something immediately: until the first byte is flushed the
		// client doesn't even receive response headers (EventSource would sit
		// "connecting" until the first status or keep-alive, up to 20s).
		c.Status(http.StatusOK)
		_, _ = fmt.Fprint(c.Writer, ": connected\n\n")
		if d, ok := hub.Status(c.Param("id")); ok && d.Status != nil {
			c.SSEvent("status", d.Status)
		}
		c.Writer.Flush()
		keepAlive := time.NewTicker(20 * time.Second)
		defer keepAlive.Stop()
		c.Stream(func(w io.Writer) bool {
			select {
			case st, open := <-ch:
				if !open {
					return false
				}
				c.SSEvent("status", st)
				return true
			case <-keepAlive.C:
				_, _ = fmt.Fprint(w, ": keep-alive\n\n")
				return true
			case <-c.Request.Context().Done():
				return false
			}
		})
	}
}
