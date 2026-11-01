package services

// CastHub relays "cast" commands from web/phone clients to HomeFlix TV apps.
//
// TV apps keep a WebSocket open to the server (GET /api/cast/tv/ws). Web
// clients list online TVs and send commands over HTTP; the hub forwards each
// command to the TV and waits for its acknowledgement, so the sender knows
// whether playback actually started. TVs report playback status, which the
// hub keeps and fans out to web clients (SSE) so they can act as a remote.
//
// This works in any browser on the LAN over plain HTTP - no Google Cast
// registration or HTTPS needed - the same model YouTube uses for "Link with
// TV". See docs/TV_CAST_PROTOCOL.md for the wire protocol.

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"sort"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	castPingInterval   = 25 * time.Second
	castReadTimeout    = 70 * time.Second // > 2 pings
	castWriteTimeout   = 10 * time.Second
	castOfflineRetain  = 24 * time.Hour // keep offline TVs listed (greyed out)
	castSendBuffer     = 32
	castMaxMessageSize = 64 * 1024
)

var (
	ErrCastDeviceOffline = errors.New("TV is offline")
	ErrCastAckTimeout    = errors.New("TV did not respond")
	ErrCastBusy          = errors.New("TV command queue is full")
)

// CastMedia identifies what to play. The TV app resolves details itself via
// the regular API (/api/media/:id, streaming endpoints).
type CastMedia struct {
	ID       uint   `json:"id"`
	Type     string `json:"type"` // movie | episode
	Title    string `json:"title,omitempty"`
	SeriesID *uint  `json:"series_id,omitempty"`
	Season   *int   `json:"season,omitempty"`
	Episode  *int   `json:"episode,omitempty"`
	Poster   string `json:"poster,omitempty"`
	Backdrop string `json:"backdrop,omitempty"`
}

// CastCommand is sent to a TV.
type CastCommand struct {
	Type      string     `json:"type"` // always "command"
	CommandID string     `json:"command_id"`
	Action    string     `json:"action"` // play | pause | resume | seek | stop | volume
	Media     *CastMedia `json:"media,omitempty"`
	Position  *float64   `json:"position,omitempty"` // seconds
	Volume    *float64   `json:"volume,omitempty"`   // 0..1
	Muted     *bool      `json:"muted,omitempty"`
	Subtitle  *string    `json:"subtitle,omitempty"` // subtitle track id, "" = off
	From      string     `json:"from,omitempty"`     // sender label, e.g. "Chrome on MacBook"
	SentAt    time.Time  `json:"sent_at"`
}

// CastStatus is reported by a TV.
type CastStatus struct {
	State     string    `json:"state"` // idle | loading | playing | paused | buffering | ended | error
	MediaID   uint      `json:"media_id,omitempty"`
	MediaType string    `json:"media_type,omitempty"`
	Title     string    `json:"title,omitempty"`
	Position  float64   `json:"position"`
	Duration  float64   `json:"duration"`
	Volume    float64   `json:"volume"`
	Muted     bool      `json:"muted"`
	Error     string    `json:"error,omitempty"`
	UpdatedAt time.Time `json:"updated_at"`
}

// CastAck is a TV's response to a command.
type CastAck struct {
	CommandID string `json:"command_id"`
	OK        bool   `json:"ok"`
	Error     string `json:"error,omitempty"`
}

// CastDeviceInfo is what web clients see.
type CastDeviceInfo struct {
	ID          string      `json:"id"`
	Name        string      `json:"name"`
	Platform    string      `json:"platform,omitempty"`
	AppVersion  string      `json:"app_version,omitempty"`
	Online      bool        `json:"online"`
	ConnectedAt time.Time   `json:"connected_at"`
	LastSeen    time.Time   `json:"last_seen"`
	Status      *CastStatus `json:"status,omitempty"`
}

type castDevice struct {
	info    CastDeviceInfo
	conn    *websocket.Conn
	send    chan []byte
	done    chan struct{}
	status  *CastStatus
	pending map[string]chan CastAck
	subs    map[chan CastStatus]struct{}
}

type CastHub struct {
	mu      sync.Mutex
	devices map[string]*castDevice
	seq     uint64
	// AckTimeout is how long SendCommand waits for the TV (tests shorten it).
	AckTimeout time.Duration
}

func NewCastHub() *CastHub {
	return &CastHub{devices: map[string]*castDevice{}, AckTimeout: 8 * time.Second}
}

// Devices lists TVs, online first, then most recently seen.
func (h *CastHub) Devices() []CastDeviceInfo {
	h.mu.Lock()
	defer h.mu.Unlock()
	now := time.Now()
	out := make([]CastDeviceInfo, 0, len(h.devices))
	for id, d := range h.devices {
		if !d.info.Online && now.Sub(d.info.LastSeen) > castOfflineRetain {
			delete(h.devices, id)
			continue
		}
		info := d.info
		if d.status != nil {
			st := *d.status
			info.Status = &st
		}
		out = append(out, info)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Online != out[j].Online {
			return out[i].Online
		}
		return out[i].LastSeen.After(out[j].LastSeen)
	})
	return out
}

// Status returns the last status a TV reported.
func (h *CastHub) Status(deviceID string) (*CastDeviceInfo, bool) {
	for _, d := range h.Devices() {
		if d.ID == deviceID {
			return &d, true
		}
	}
	return nil, false
}

// Subscribe streams status updates for a device until unsubscribe is called.
func (h *CastHub) Subscribe(deviceID string) (<-chan CastStatus, func(), bool) {
	h.mu.Lock()
	defer h.mu.Unlock()
	d, ok := h.devices[deviceID]
	if !ok {
		return nil, func() {}, false
	}
	ch := make(chan CastStatus, 8)
	d.subs[ch] = struct{}{}
	return ch, func() {
		h.mu.Lock()
		defer h.mu.Unlock()
		if dd, ok := h.devices[deviceID]; ok {
			if _, ok := dd.subs[ch]; ok {
				delete(dd.subs, ch)
				close(ch)
			}
		}
	}, true
}

// SendCommand forwards a command and waits for the TV's acknowledgement.
func (h *CastHub) SendCommand(deviceID string, cmd CastCommand) (CastAck, error) {
	h.mu.Lock()
	d, ok := h.devices[deviceID]
	if !ok || !d.info.Online {
		h.mu.Unlock()
		return CastAck{}, ErrCastDeviceOffline
	}
	h.seq++
	cmd.Type = "command"
	cmd.CommandID = fmt.Sprintf("c%d-%d", time.Now().UnixMilli(), h.seq)
	cmd.SentAt = time.Now()
	payload, err := json.Marshal(cmd)
	if err != nil {
		h.mu.Unlock()
		return CastAck{}, err
	}
	ackCh := make(chan CastAck, 1)
	d.pending[cmd.CommandID] = ackCh
	select {
	case d.send <- payload:
	default:
		delete(d.pending, cmd.CommandID)
		h.mu.Unlock()
		return CastAck{}, ErrCastBusy
	}
	done := d.done
	timeout := h.AckTimeout
	h.mu.Unlock()

	cleanup := func() {
		h.mu.Lock()
		if dd, ok := h.devices[deviceID]; ok {
			delete(dd.pending, cmd.CommandID)
		}
		h.mu.Unlock()
	}
	select {
	case ack, ok := <-ackCh:
		if !ok { // channel closed: TV disconnected before answering
			return CastAck{CommandID: cmd.CommandID}, ErrCastDeviceOffline
		}
		ack.CommandID = cmd.CommandID
		return ack, nil
	case <-done:
		cleanup()
		return CastAck{CommandID: cmd.CommandID}, ErrCastDeviceOffline
	case <-time.After(timeout):
		cleanup()
		return CastAck{CommandID: cmd.CommandID}, ErrCastAckTimeout
	}
}

// Broadcast sends a server→TV message (e.g. {"type":"update_available"}) to
// every connected TV. Best effort: a TV with a full send queue is skipped.
// Returns how many TVs it was queued for.
func (h *CastHub) Broadcast(msg interface{}) int {
	payload, err := json.Marshal(msg)
	if err != nil {
		return 0
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	n := 0
	for _, d := range h.devices {
		if !d.info.Online {
			continue
		}
		select {
		case d.send <- payload:
			n++
		default:
		}
	}
	return n
}

// Serve runs a TV connection until it closes. Blocks.
func (h *CastHub) Serve(conn *websocket.Conn, info CastDeviceInfo) {
	now := time.Now()
	info.Online = true
	info.ConnectedAt = now
	info.LastSeen = now
	d := &castDevice{
		info: info, conn: conn, send: make(chan []byte, castSendBuffer), done: make(chan struct{}),
		pending: map[string]chan CastAck{}, subs: map[chan CastStatus]struct{}{},
	}

	h.mu.Lock()
	if old, ok := h.devices[info.ID]; ok {
		// Same TV reconnected (network blip / app restart): replace the old
		// connection but keep web subscribers attached.
		d.subs = old.subs
		d.status = old.status
		if old.info.Online {
			old.info.Online = false
			close(old.done)
			_ = old.conn.Close()
		}
	}
	h.devices[info.ID] = d
	h.mu.Unlock()
	log.Printf("📺 Cast: TV connected %q (%s)", info.Name, info.ID)

	hello, _ := json.Marshal(map[string]interface{}{"type": "hello", "device_id": info.ID, "server_time": now})
	d.send <- hello

	go h.writeLoop(d)
	h.readLoop(d)

	h.mu.Lock()
	if cur, ok := h.devices[info.ID]; ok && cur == d {
		d.info.Online = false
		d.info.LastSeen = time.Now()
		close(d.done)
		for id, ch := range d.pending {
			close(ch)
			delete(d.pending, id)
		}
	}
	h.mu.Unlock()
	_ = conn.Close()
	log.Printf("📺 Cast: TV disconnected %q", info.Name)
}

func (h *CastHub) writeLoop(d *castDevice) {
	ticker := time.NewTicker(castPingInterval)
	defer ticker.Stop()
	for {
		select {
		case msg := <-d.send:
			_ = d.conn.SetWriteDeadline(time.Now().Add(castWriteTimeout))
			if err := d.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				_ = d.conn.Close()
				return
			}
		case <-ticker.C:
			_ = d.conn.SetWriteDeadline(time.Now().Add(castWriteTimeout))
			if err := d.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				_ = d.conn.Close()
				return
			}
			// App-level ping too: some TV WebSocket clients don't surface
			// control frames to keep their own watchdogs alive.
			_ = d.conn.WriteMessage(websocket.TextMessage, []byte(`{"type":"ping"}`))
		case <-d.done:
			return
		}
	}
}

func (h *CastHub) touch(d *castDevice) {
	h.mu.Lock()
	d.info.LastSeen = time.Now()
	h.mu.Unlock()
}

func (h *CastHub) readLoop(d *castDevice) {
	d.conn.SetReadLimit(castMaxMessageSize)
	_ = d.conn.SetReadDeadline(time.Now().Add(castReadTimeout))
	d.conn.SetPongHandler(func(string) error {
		h.touch(d)
		return d.conn.SetReadDeadline(time.Now().Add(castReadTimeout))
	})
	for {
		_, data, err := d.conn.ReadMessage()
		if err != nil {
			return
		}
		_ = d.conn.SetReadDeadline(time.Now().Add(castReadTimeout))
		h.touch(d)

		var head struct {
			Type string `json:"type"`
			Name string `json:"name"`
		}
		if err := json.Unmarshal(data, &head); err != nil {
			continue
		}
		switch head.Type {
		case "status":
			var st CastStatus
			if err := json.Unmarshal(data, &st); err != nil {
				continue
			}
			st.UpdatedAt = time.Now()
			h.mu.Lock()
			d.status = &st
			for ch := range d.subs {
				select {
				case ch <- st:
				default: // slow subscriber: drop, it'll get the next one
				}
			}
			h.mu.Unlock()
		case "ack":
			var ack CastAck
			if err := json.Unmarshal(data, &ack); err != nil {
				continue
			}
			h.mu.Lock()
			if ch, ok := d.pending[ack.CommandID]; ok {
				ch <- ack
				delete(d.pending, ack.CommandID)
			}
			h.mu.Unlock()
		case "rename":
			if head.Name != "" {
				h.mu.Lock()
				d.info.Name = head.Name
				h.mu.Unlock()
			}
		case "pong", "ping":
			// keep-alive, already touched
		}
	}
}
