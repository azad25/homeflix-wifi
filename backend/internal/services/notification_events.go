package services

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/go-redis/redis/v8"
)

// Server and download events shown in Notifications (pinned above the
// content suggestions).
const (
	NotificationTypeAutoDownload NotificationType = "auto_download"
	NotificationTypeSystem       NotificationType = "system"
)

func isEventNotification(t NotificationType) bool {
	return t == NotificationTypeAutoDownload || t == NotificationTypeSystem
}

// NotificationPrefs: which notifications the household wants
// (Settings > Notifications).
type NotificationPrefs struct {
	DownloadStarted   bool `json:"download_started"`
	DownloadCompleted bool `json:"download_completed"`
	DownloadProblems  bool `json:"download_problems"`
	ServerUpdates     bool `json:"server_updates"`
	TVAppUpdates      bool `json:"tv_app_updates"`
	LowStorage        bool `json:"low_storage"`
	NewContent        bool `json:"new_content"`
	Recommendations   bool `json:"recommendations"`
}

func DefaultNotificationPrefs() NotificationPrefs {
	return NotificationPrefs{true, true, true, true, true, true, true, true}
}

var (
	prefsMu    sync.RWMutex
	prefsCache *NotificationPrefs
)

func prefsPath() string {
	dir := strings.TrimSpace(os.Getenv("HOMEFLIX_NOTIFICATIONS_DIR"))
	if dir == "" {
		dir = "data/notifications"
	}
	return filepath.Join(dir, "prefs.json")
}

// GetNotificationPrefs returns the saved preferences (defaults: all on).
func GetNotificationPrefs() NotificationPrefs {
	prefsMu.RLock()
	if prefsCache != nil {
		p := *prefsCache
		prefsMu.RUnlock()
		return p
	}
	prefsMu.RUnlock()
	p := DefaultNotificationPrefs()
	if b, err := os.ReadFile(prefsPath()); err == nil {
		_ = json.Unmarshal(b, &p)
	}
	prefsMu.Lock()
	prefsCache = &p
	prefsMu.Unlock()
	return p
}

func SaveNotificationPrefs(p NotificationPrefs) error {
	path := prefsPath()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	b, _ := json.MarshalIndent(p, "", "  ")
	if err := os.WriteFile(path, b, 0o644); err != nil {
		return err
	}
	prefsMu.Lock()
	prefsCache = &p
	prefsMu.Unlock()
	return nil
}

func (p NotificationPrefs) allowsEvent(event string) bool {
	switch {
	case event == "download_started":
		return p.DownloadStarted
	case event == "download_completed":
		return p.DownloadCompleted
	case strings.HasPrefix(event, "download_"):
		return p.DownloadProblems
	case strings.HasPrefix(event, "update_"):
		return p.ServerUpdates
	case strings.HasPrefix(event, "tvapp_"):
		return p.TVAppUpdates
	case event == "low_storage":
		return p.LowStorage
	}
	return true
}

func (p NotificationPrefs) allowsContent(t NotificationType) bool {
	switch t {
	case NotificationTypeNewMovies, NotificationTypeNewEpisodes, NotificationTypeRecentlyAdded, NotificationTypeDownload:
		return p.NewContent
	default:
		return p.Recommendations
	}
}

// EventNotification describes a server/download event.
type EventNotification struct {
	Event     string // download_started | download_completed | download_failed | download_space | update_available | update_installed | tvapp_available | tvapp_published | low_storage
	Title     string
	Message   string
	Link      string
	PosterURL string
	TMDBID    int
	MediaType string
}

// AddEvent records an event notification if the preferences allow it.
// Safe to call on a nil service (Redis not configured).
func (ns *NotificationService) AddEvent(e EventNotification) {
	if ns == nil || !GetNotificationPrefs().allowsEvent(e.Event) {
		return
	}
	typ := NotificationTypeSystem
	if strings.HasPrefix(e.Event, "download_") {
		typ = NotificationTypeAutoDownload
	}
	key := ns.keyPrefix + "global"
	// Same event + title in the last 10 minutes: skip (e.g. repeated checks).
	if recent, err := ns.client.ZRevRangeByScore(ns.ctx, key, &redis.ZRangeBy{
		Min: fmt.Sprintf("%d", time.Now().Unix()-600), Max: "+inf",
	}).Result(); err == nil {
		for _, r := range recent {
			var n Notification
			if json.Unmarshal([]byte(r), &n) == nil && n.Event == e.Event && n.Title == e.Title {
				return
			}
		}
	}
	n := Notification{
		ID: fmt.Sprintf("notif_%d", time.Now().UnixNano()), Type: typ, Event: e.Event,
		Title: e.Title, Message: e.Message, Link: e.Link, PosterURL: e.PosterURL,
		Timestamp: time.Now().Unix(), Category: "system", Priority: "high",
	}
	if e.TMDBID > 0 {
		n.TMDBIDs = []int{e.TMDBID}
	}
	data, err := json.Marshal(n)
	if err != nil {
		return
	}
	if err := ns.client.ZAdd(ns.ctx, key, &redis.Z{Score: float64(n.Timestamp), Member: string(data)}).Err(); err != nil {
		log.Printf("⚠️ Notification event not stored: %v", err)
		return
	}
	ns.client.Expire(ns.ctx, key, ns.ttl)
	ns.client.ZRemRangeByRank(ns.ctx, key, 0, -int64(ns.maxNotifications+1))
}
