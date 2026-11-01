package handlers

import (
	"bufio"
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"

	"homeflix-backend/internal/services"
)

func castServer(t *testing.T) (*httptest.Server, *services.CastHub) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	hub := services.NewCastHub()
	hub.AckTimeout = 600 * time.Millisecond
	r := gin.New()
	api := r.Group("/api")
	api.GET("/cast/tv/ws", CastTVSocket(hub))
	api.GET("/cast/devices", ListCastDevices(hub))
	api.GET("/cast/devices/:id/status", GetCastDeviceStatus(hub))
	api.GET("/cast/devices/:id/events", CastDeviceEvents(hub))
	api.POST("/cast/devices/:id/command", SendCastCommand(hub))
	srv := httptest.NewServer(r)
	t.Cleanup(srv.Close)
	return srv, hub
}

type fakeTV struct {
	conn *websocket.Conn
	t    *testing.T
}

func connectTV(t *testing.T, srv *httptest.Server, id, name string) *fakeTV {
	t.Helper()
	url := "ws" + strings.TrimPrefix(srv.URL, "http") + "/api/cast/tv/ws?device_id=" + id + "&name=" + strings.ReplaceAll(name, " ", "%20") + "&platform=androidtv"
	conn, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { conn.Close() })
	tv := &fakeTV{conn: conn, t: t}
	if m := tv.next(); m["type"] != "hello" {
		t.Fatalf("expected hello, got %v", m)
	}
	return tv
}

func (tv *fakeTV) next() map[string]interface{} {
	tv.t.Helper()
	for {
		_ = tv.conn.SetReadDeadline(time.Now().Add(3 * time.Second))
		_, data, err := tv.conn.ReadMessage()
		if err != nil {
			tv.t.Fatalf("tv read: %v", err)
		}
		var m map[string]interface{}
		_ = json.Unmarshal(data, &m)
		if m["type"] == "ping" {
			continue
		}
		return m
	}
}

func (tv *fakeTV) send(v interface{}) {
	if err := tv.conn.WriteJSON(v); err != nil {
		tv.t.Fatal(err)
	}
}

func postCommand(t *testing.T, srv *httptest.Server, id, body string) (int, map[string]interface{}) {
	t.Helper()
	res, err := http.Post(srv.URL+"/api/cast/devices/"+id+"/command", "application/json", bytes.NewBufferString(body))
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	var m map[string]interface{}
	_ = json.NewDecoder(res.Body).Decode(&m)
	return res.StatusCode, m
}

func TestCastPlayRoundTrip(t *testing.T) {
	srv, _ := castServer(t)
	tv := connectTV(t, srv, "tv-1", "Living Room TV")

	// Device is listed online.
	res, _ := http.Get(srv.URL + "/api/cast/devices")
	var list struct{ Devices []services.CastDeviceInfo }
	_ = json.NewDecoder(res.Body).Decode(&list)
	res.Body.Close()
	if len(list.Devices) != 1 || !list.Devices[0].Online || list.Devices[0].Name != "Living Room TV" {
		t.Fatalf("unexpected devices: %+v", list.Devices)
	}

	// Web sends play; TV receives it and acks.
	done := make(chan struct{})
	go func() {
		defer close(done)
		cmd := tv.next()
		if cmd["type"] != "command" || cmd["action"] != "play" {
			t.Errorf("unexpected command %v", cmd)
		}
		media := cmd["media"].(map[string]interface{})
		if media["id"].(float64) != 42 || cmd["position"].(float64) != 125.5 {
			t.Errorf("bad payload %v", cmd)
		}
		tv.send(map[string]interface{}{"type": "ack", "command_id": cmd["command_id"], "ok": true})
		tv.send(map[string]interface{}{"type": "status", "state": "playing", "media_id": 42, "position": 126, "duration": 7200, "error": ""})
	}()
	code, body := postCommand(t, srv, "tv-1", `{"action":"play","media":{"id":42,"type":"movie","title":"Inception"},"position":125.5}`)
	if code != 200 || body["ok"] != true {
		t.Fatalf("play failed: %d %v", code, body)
	}
	<-done

	// Status reaches web clients.
	deadline := time.Now().Add(2 * time.Second)
	for {
		res, _ := http.Get(srv.URL + "/api/cast/devices/tv-1/status")
		var d services.CastDeviceInfo
		_ = json.NewDecoder(res.Body).Decode(&d)
		res.Body.Close()
		if d.Status != nil && d.Status.State == "playing" && d.Status.MediaID == 42 {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("status never arrived: %+v", d.Status)
		}
		time.Sleep(20 * time.Millisecond)
	}
}

func TestCastStatusSSE(t *testing.T) {
	srv, _ := castServer(t)
	tv := connectTV(t, srv, "tv-2", "Bedroom")
	res, err := http.Get(srv.URL + "/api/cast/devices/tv-2/events")
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	// Drop the connection server-side so the stream's request context is
	// cancelled immediately instead of at the next keep-alive tick.
	defer srv.CloseClientConnections()
	if ct := res.Header.Get("Content-Type"); !strings.HasPrefix(ct, "text/event-stream") {
		t.Fatalf("content type %q", ct)
	}
	time.Sleep(50 * time.Millisecond)
	tv.send(map[string]interface{}{"type": "status", "state": "paused", "media_id": 7, "position": 10, "duration": 100})
	sc := bufio.NewScanner(res.Body)
	got := make(chan string, 1)
	go func() {
		for sc.Scan() {
			if strings.HasPrefix(sc.Text(), "data:") && strings.Contains(sc.Text(), `"paused"`) {
				got <- sc.Text()
				return
			}
		}
	}()
	select {
	case <-got:
	case <-time.After(2 * time.Second):
		t.Fatal("no SSE status event")
	}
}

func TestCastErrors(t *testing.T) {
	srv, hub := castServer(t)

	// Unknown / offline device.
	if code, _ := postCommand(t, srv, "nope", `{"action":"pause"}`); code != http.StatusNotFound {
		t.Fatalf("offline: got %d", code)
	}
	// Validation.
	tv := connectTV(t, srv, "tv-3", "Den")
	if code, _ := postCommand(t, srv, "tv-3", `{"action":"play"}`); code != http.StatusBadRequest {
		t.Fatalf("play without media: got %d", code)
	}
	if code, _ := postCommand(t, srv, "tv-3", `{"action":"explode"}`); code != http.StatusBadRequest {
		t.Fatalf("unknown action: got %d", code)
	}
	// TV refuses.
	go func() {
		cmd := tv.next()
		tv.send(map[string]interface{}{"type": "ack", "command_id": cmd["command_id"], "ok": false, "error": "media not found"})
	}()
	code, body := postCommand(t, srv, "tv-3", `{"action":"play","media":{"id":9}}`)
	if code != http.StatusUnprocessableEntity || body["error"] != "media not found" {
		t.Fatalf("refusal: %d %v", code, body)
	}
	// TV never answers -> 504.
	if code, _ := postCommand(t, srv, "tv-3", `{"action":"pause"}`); code != http.StatusGatewayTimeout {
		t.Fatalf("timeout: got %d", code)
	}
	tv.next() // drain the unanswered pause

	// TV goes away -> listed offline, commands 404.
	tv.conn.Close()
	deadline := time.Now().Add(2 * time.Second)
	for {
		devs := hub.Devices()
		if len(devs) == 1 && !devs[0].Online {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("device still online: %+v", devs)
		}
		time.Sleep(20 * time.Millisecond)
	}
	if code, _ := postCommand(t, srv, "tv-3", `{"action":"pause"}`); code != http.StatusNotFound {
		t.Fatalf("after disconnect: got %d", code)
	}

	// Reconnect with the same id replaces the entry.
	connectTV(t, srv, "tv-3", "Den")
	if devs := hub.Devices(); len(devs) != 1 || !devs[0].Online {
		t.Fatalf("reconnect: %+v", devs)
	}
}
