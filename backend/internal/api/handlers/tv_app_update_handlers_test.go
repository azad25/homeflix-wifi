package handlers

import (
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"

	"homeflix-backend/internal/services"
)

func updateServer(t *testing.T) (*httptest.Server, *services.TVAppUpdates, *services.CastHub) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	t.Setenv("HOMEFLIX_TV_UPDATES_DIR", t.TempDir())
	hub := services.NewCastHub()
	u := services.NewTVAppUpdates()
	u.OnNewRelease = func(rel *services.TVAppRelease) {
		hub.Broadcast(map[string]interface{}{"type": "update_available", "version_code": rel.VersionCode})
	}
	r := gin.New()
	api := r.Group("/api")
	api.GET("/cast/tv/ws", CastTVSocket(hub))
	api.GET("/app/tv/latest", GetTVAppLatest(u))
	api.GET("/app/tv/download/:code", DownloadTVApp(u))
	api.POST("/admin/app/tv/upload", UploadTVApp(u))
	srv := httptest.NewServer(r)
	t.Cleanup(srv.Close)
	return srv, u, hub
}

func upload(t *testing.T, base, file, notes string) *http.Response {
	t.Helper()
	var body bytes.Buffer
	w := multipart.NewWriter(&body)
	fw, _ := w.CreateFormFile("apk", "app.apk")
	b, err := os.ReadFile(file)
	if err != nil {
		b = []byte(file) // raw content for junk uploads
	}
	fw.Write(b)
	w.WriteField("notes", notes)
	w.Close()
	resp, err := http.Post(base+"/api/admin/app/tv/upload", w.FormDataContentType(), &body)
	if err != nil {
		t.Fatal(err)
	}
	return resp
}

func TestTVAppUpdates_EndToEnd(t *testing.T) {
	srv, _, _ := updateServer(t)

	// Nothing published yet.
	resp, _ := http.Get(srv.URL + "/api/app/tv/latest")
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("want 404 before publishing, got %d", resp.StatusCode)
	}

	// A TV is connected over the cast socket.
	ws, _, err := websocket.DefaultDialer.Dial(strings.Replace(srv.URL, "http", "ws", 1)+"/api/cast/tv/ws?device_id=tv1&name=Living", nil)
	if err != nil {
		t.Fatal(err)
	}
	defer ws.Close()
	var hello map[string]interface{}
	ws.ReadJSON(&hello)

	// Junk upload is refused.
	if r := upload(t, srv.URL, "definitely not an apk", ""); r.StatusCode != http.StatusUnprocessableEntity {
		t.Fatalf("junk upload: want 422, got %d", r.StatusCode)
	}

	// Real build is published and announced.
	r := upload(t, srv.URL, "../../services/testdata/homeflix-tv-7.apk", "New player")
	if r.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(r.Body)
		t.Fatalf("upload: %d %s", r.StatusCode, b)
	}
	ws.SetReadDeadline(time.Now().Add(3 * time.Second))
	var push map[string]interface{}
	for {
		if err := ws.ReadJSON(&push); err != nil {
			t.Fatalf("TV never got update_available: %v", err)
		}
		if push["type"] == "update_available" {
			break
		}
	}
	if push["version_code"].(float64) != 7 {
		t.Fatalf("bad push: %v", push)
	}

	// /latest describes it.
	resp, _ = http.Get(srv.URL + "/api/app/tv/latest")
	var rel services.TVAppRelease
	json.NewDecoder(resp.Body).Decode(&rel)
	if rel.VersionCode != 7 || rel.VersionName != "5.2" || rel.Notes != "New player" || rel.URL != "/api/app/tv/download/7" {
		t.Fatalf("latest: %+v", rel)
	}

	// Download matches size/hash headers; Range works.
	resp, _ = http.Get(srv.URL + rel.URL)
	b, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 || int64(len(b)) != rel.Size ||
		resp.Header.Get("Content-Type") != "application/vnd.android.package-archive" ||
		resp.Header.Get("X-Content-SHA256") != rel.SHA256 {
		t.Fatalf("download: %d len=%d headers=%v", resp.StatusCode, len(b), resp.Header)
	}
	req, _ := http.NewRequest("GET", srv.URL+rel.URL, nil)
	req.Header.Set("Range", "bytes=0-9")
	resp, _ = http.DefaultClient.Do(req)
	if resp.StatusCode != http.StatusPartialContent {
		t.Fatalf("range: want 206, got %d", resp.StatusCode)
	}

	// Unknown version.
	resp, _ = http.Get(srv.URL + "/api/app/tv/download/99")
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("want 404 for unknown version, got %d", resp.StatusCode)
	}
}
