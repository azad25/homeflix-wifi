package api

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"homeflix-backend/internal/api/handlers"
	"homeflix-backend/internal/services"
	"homeflix-backend/internal/storage"
)

// startEventWatchers turns server events into notifications (each respects
// Settings > Notifications): updates, new TV app builds, low storage.
func startEventWatchers(ctx context.Context, db *gorm.DB, ns *services.NotificationService, tvSrc *services.TVAppSource, tvUpdates *services.TVAppUpdates) {
	if ns == nil {
		return
	}
	go func() {
		// An update that finished with this restart.
		time.Sleep(10 * time.Second)
		if msg, ok := handlers.TakeFinalizedUpdate(); ok {
			ns.AddEvent(services.EventNotification{Event: "update_installed", Title: "HomeFlix was updated", Message: msg, Link: "/settings?tab=updates"})
		}

		lastUpdateKey, lastTVVersion := "", int64(0)
		lowNow := map[string]bool{}
		checkUpdates := func() {
			r := handlers.ComputeUpdateCheck()
			if ok, _ := r["ok"].(bool); !ok {
				return
			}
			key, title, msg := "", "", ""
			if up, ok := r["upgrade"].(gin.H); ok && len(up) > 0 {
				key = fmt.Sprint(up["branch"])
				title, msg = fmt.Sprintf("HomeFlix %v is available", up["version"]), "A new release is ready to install."
			} else if avail, _ := r["update_available"].(bool); avail {
				if remote, ok := r["remote"].(map[string]string); ok {
					key = remote["short"]
				}
				title, msg = "HomeFlix update available", fmt.Sprintf("%v new change(s) are ready to install.", r["behind"])
			}
			if key != "" && key != lastUpdateKey {
				lastUpdateKey = key
				ns.AddEvent(services.EventNotification{Event: "update_available", Title: title, Message: msg, Link: "/settings?tab=updates"})
			}
		}
		checkTVApp := func() {
			if tvSrc == nil || tvUpdates == nil {
				return
			}
			remote, err := tvSrc.Check(ctx, false)
			if err != nil || remote.VersionCode <= 0 || remote.VersionCode == lastTVVersion {
				return
			}
			if cur := tvUpdates.Latest(); cur == nil || remote.VersionCode > cur.VersionCode {
				lastTVVersion = remote.VersionCode
				ns.AddEvent(services.EventNotification{Event: "tvapp_available", Title: "TV app " + remote.VersionName + " is available",
					Message: "Download it to the server so your TVs can update.", Link: "/settings?tab=updates"})
			}
		}
		checkStorage := func() {
			for _, si := range storage.GetActiveStorageInfos(db) {
				if si.IsLow && !lowNow[si.Path] {
					name := si.Name
					if name == "" {
						name = si.Path
					}
					ns.AddEvent(services.EventNotification{Event: "low_storage", Title: "Storage is running low",
						Message: fmt.Sprintf("%s has %.1f GB free. New downloads go to the folder with the most space.", name, float64(si.Free)/(1<<30)),
						Link:    "/settings?tab=storage"})
				}
				lowNow[si.Path] = si.IsLow
			}
		}

		checkStorage()
		time.Sleep(2 * time.Minute)
		checkUpdates()
		checkTVApp()
		slow := time.NewTicker(6 * time.Hour)
		fast := time.NewTicker(30 * time.Minute)
		defer slow.Stop()
		defer fast.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-fast.C:
				checkStorage()
			case <-slow.C:
				checkUpdates()
				checkTVApp()
			}
		}
	}()
	log.Printf("🔔 Notification event watchers started")
}
