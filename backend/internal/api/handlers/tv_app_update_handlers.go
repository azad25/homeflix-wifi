package handlers

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"homeflix-backend/internal/services"
)

// GetTVAppLatest — GET /api/app/tv/latest
// The newest published HomeFlix TV app build, or 404 when none is published.
// The TV app polls this and self-updates (see homeflix-tv-app AppUpdater).
func GetTVAppLatest(u *services.TVAppUpdates) gin.HandlerFunc {
	return func(c *gin.Context) {
		rel := u.Latest()
		c.Header("Cache-Control", "no-store")
		if rel == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "no TV app update published"})
			return
		}
		c.JSON(http.StatusOK, rel)
	}
}

// DownloadTVApp — GET /api/app/tv/download/:code
// Serves the APK (Range, HEAD and If-Modified-Since via http.ServeContent).
func DownloadTVApp(u *services.TVAppUpdates) gin.HandlerFunc {
	return func(c *gin.Context) {
		code, err := strconv.ParseInt(c.Param("code"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid version"})
			return
		}
		rel := u.Release(code)
		if rel == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "version not published"})
			return
		}
		f, err := os.Open(rel.Path())
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "update file missing"})
			return
		}
		defer f.Close()
		fi, err := f.Stat()
		if err != nil {
			c.Status(http.StatusInternalServerError)
			return
		}
		c.Header("Content-Type", "application/vnd.android.package-archive")
		c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="homeflix-tv-%d.apk"`, rel.VersionCode))
		c.Header("Cache-Control", "public, max-age=31536000, immutable") // a version's file never changes
		c.Header("X-Content-SHA256", rel.SHA256)
		http.ServeContent(c.Writer, c.Request, "", fi.ModTime(), f)
	}
}

// UploadTVApp — POST /api/admin/app/tv/upload (multipart: apk=<file>, notes=<text>)
// Publishes a new TV app build and tells connected TVs to update. Only
// com.homeflix.tv APKs are accepted; TVs additionally refuse builds that
// aren't signed with the same key as the installed app.
func UploadTVApp(u *services.TVAppUpdates) gin.HandlerFunc {
	return func(c *gin.Context) {
		fh, err := c.FormFile("apk")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "send the APK as multipart field \"apk\""})
			return
		}
		f, err := fh.Open()
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "can't read upload"})
			return
		}
		defer f.Close()
		rel, err := u.Publish(f, c.PostForm("notes"))
		switch {
		case errors.Is(err, services.ErrNotTVApp):
			c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "not a HomeFlix TV app build (expected package " + services.TVAppPackage + ")"})
		case err != nil:
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusOK, rel)
		}
	}
}

// RescanTVApp — POST /api/admin/app/tv/rescan
// Re-reads the updates folder now (it is also rescanned every minute).
func RescanTVApp(u *services.TVAppUpdates) gin.HandlerFunc {
	return func(c *gin.Context) {
		if err := u.Scan(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if rel := u.Latest(); rel != nil {
			c.JSON(http.StatusOK, rel)
			return
		}
		c.JSON(http.StatusOK, gin.H{"published": false, "dir": u.Dir})
	}
}

// TVAppSourceStatus — GET /api/admin/app/tv/source[?refresh=1]
// Compares the build the server publishes with the newest one in the TV app
// repository.
func TVAppSourceStatus(u *services.TVAppUpdates, src *services.TVAppSource) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 20*time.Second)
		defer cancel()
		local := u.Latest()
		resp := gin.H{"local": local, "dir": u.Dir, "repo": src.Repo}
		remote, err := src.Check(ctx, c.Query("refresh") != "")
		if err != nil {
			resp["error"] = err.Error()
		} else {
			resp["remote"] = remote
			resp["update_available"] = remote.VersionCode > 0 && (local == nil || remote.VersionCode > local.VersionCode)
		}
		c.JSON(http.StatusOK, resp)
	}
}

// FetchTVAppFromSource — POST /api/admin/app/tv/fetch
// Downloads the newest APK from the TV app repository into the updates
// folder and publishes it (connected TVs are told to update).
func FetchTVAppFromSource(u *services.TVAppUpdates, src *services.TVAppSource) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Minute)
		defer cancel()
		res, err := u.FetchLatest(ctx, src)
		switch {
		case errors.Is(err, services.ErrNotTVApp):
			c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "the repository's APK is not a HomeFlix TV app build"})
		case err != nil:
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusOK, res)
		}
	}
}
