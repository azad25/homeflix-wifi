package torrent

import (
	"testing"
)

// A speed-limit change restarts rain's session; downloads must stay linked
// to their torrents (same IDs, resumed from rain's database).
func TestSpeedLimitChangeKeepsDownloads(t *testing.T) {
	dir := t.TempDir()
	tc, err := NewTorrentClient(dir, nil, nil, map[string]int{
		"port_range_start": 54100, "port_range_end": 54120, "download_speed_limit_kb": 500,
	})
	if err != nil {
		t.Fatal(err)
	}
	defer tc.Close()
	if got := tc.sess(); got == nil || tc.rainCfg.SpeedLimitDownload != 500 {
		t.Fatalf("startup limit not applied: %d", tc.rainCfg.SpeedLimitDownload)
	}
	tc.SetStoragePaths([]string{dir})
	info, err := tc.AddMagnet("magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567&dn=test")
	if err != nil {
		t.Fatal(err)
	}
	before := tc.sess()

	tc.SetSpeedLimits(2048*1024, 256*1024)
	if tc.sess() == before {
		t.Fatal("session not restarted")
	}
	if tc.rainCfg.SpeedLimitDownload != 2048 || tc.rainCfg.SpeedLimitUpload != 256 {
		t.Fatalf("limits not applied: %+v", tc.rainCfg.SpeedLimitDownload)
	}
	tc.mu.RLock()
	tor := tc.torrents[info.ID]
	tc.mu.RUnlock()
	if tor == nil || tc.sess().GetTorrent(info.ID) != tor {
		t.Fatal("download not re-linked to the new session's torrent")
	}

	// Same limits again: no restart.
	cur := tc.sess()
	tc.SetSpeedLimits(2048*1024, 256*1024)
	if tc.sess() != cur {
		t.Fatal("restarted without a change")
	}
	// Back to unlimited.
	tc.SetSpeedLimits(0, 0)
	if tc.rainCfg.SpeedLimitDownload != 0 || tc.GetBandwidthStats()["download_limit"].(int64) != 0 {
		t.Fatal("unlimited not applied")
	}
}
