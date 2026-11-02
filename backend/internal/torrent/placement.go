package torrent

import (
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"time"
)

// Storage placement for downloads.
//
// Rain writes every torrent to <downloadDir>/<torrent id>. To use all drives
// intelligently that folder is a symlink to "<storage>/.homeflix-incoming/<id>"
// on the drive with the most free space that fits the torrent, so data is
// written where it will finally live (the move after completion is a cheap
// rename) and one full drive doesn't stop downloads while others have room.
// If a drive fills up during a download, the partial data is relocated to
// another drive and the download resumes.

const incomingDirName = ".homeflix-incoming"

// MinFreeBytes: below this a drive counts as full for downloads.
const MinFreeBytes = 2 << 30

func deviceOf(path string) (uint64, bool) {
	fi, err := os.Stat(path)
	if err != nil {
		return 0, false
	}
	st, ok := fi.Sys().(*syscall.Stat_t)
	if !ok {
		return 0, false
	}
	return uint64(st.Dev), true
}

func sameFilesystem(a, b string) bool {
	da, ok1 := deviceOf(a)
	db, ok2 := deviceOf(b)
	return ok1 && ok2 && da == db
}

// placeIncoming points <downloadDir>/<id> at the best drive for sizeHint
// bytes (0 = unknown: the drive with the most free space). Returns the data
// directory used.
func (tc *TorrentClient) placeIncoming(id string, sizeHint int64) string {
	link := filepath.Join(tc.downloadDir, id)
	storage := tc.selectBestStoragePath(sizeHint + sizeHint/10)
	if storage == "" {
		return link
	}
	if sameFilesystem(storage, tc.downloadDir) {
		return link // already writing to that drive
	}
	if free, _, err := tc.getDiskFree(tc.downloadDir); err == nil && sizeHint > 0 && int64(free) > sizeHint*2 && int64(free) > 4*MinFreeBytes {
		// The download folder's own drive has plenty of room: keep it simple.
		if sfree, _, err := tc.getDiskFree(storage); err == nil && sfree <= free {
			return link
		}
	}
	target := filepath.Join(storage, incomingDirName, id)
	if err := os.MkdirAll(target, 0o755); err != nil {
		log.Printf("⚠️ Can't use %s for downloads: %v", storage, err)
		return link
	}
	if fi, err := os.Lstat(link); err == nil {
		if fi.Mode()&os.ModeSymlink != 0 {
			return link // already placed (restored torrent)
		}
		if err := os.Remove(link); err != nil { // an empty dir created by Rain
			return link
		}
	}
	if err := os.Symlink(target, link); err != nil {
		log.Printf("⚠️ Can't place download on %s: %v", storage, err)
		return link
	}
	log.Printf("📁 Download %s will be written to %s", id, target)
	return target
}

// incomingStorageRoot: the storage root a download's data lives on ("" if
// it's in the plain download folder).
func (tc *TorrentClient) incomingStorageRoot(id string) string {
	target, err := os.Readlink(filepath.Join(tc.downloadDir, id))
	if err != nil {
		return ""
	}
	i := strings.Index(target, string(filepath.Separator)+incomingDirName+string(filepath.Separator))
	if i < 0 {
		return ""
	}
	return target[:i]
}

// cleanupIncoming removes the (now empty) data folder and link of a moved download.
func (tc *TorrentClient) cleanupIncoming(id string) {
	link := filepath.Join(tc.downloadDir, id)
	target, err := os.Readlink(link)
	if err != nil {
		return
	}
	_ = os.Remove(link)
	removeEmptyDirs(target)
}

func removeEmptyDirs(dir string) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	for _, e := range entries {
		if e.IsDir() {
			removeEmptyDirs(filepath.Join(dir, e.Name()))
		}
	}
	_ = os.Remove(dir) // only succeeds when empty
}

// dataDirOf returns where a download's bytes really are.
func (tc *TorrentClient) dataDirOf(id string) string {
	p := filepath.Join(tc.downloadDir, id)
	if real, err := filepath.EvalSymlinks(p); err == nil {
		return real
	}
	return p
}

// driveAvailable: the folder exists and isn't an unplugged drive's empty
// mount point (which would silently be the system disk).
func driveAvailable(p string) bool {
	fi, err := os.Stat(p)
	if err != nil || !fi.IsDir() {
		return false
	}
	clean := filepath.Clean(p)
	if !strings.HasPrefix(clean, "/media/") && !strings.HasPrefix(clean, "/mnt/") && !strings.HasPrefix(clean, "/run/media/") {
		return true
	}
	if !sameFilesystem(clean, "/") {
		return true // a real mount
	}
	entries, err := os.ReadDir(clean)
	return err == nil && len(entries) > 0 // a plain folder with content is fine
}

// usableStoragePaths: storage paths in priority order, unplugged drives left out.
func (tc *TorrentClient) usableStoragePaths() []string {
	var out []string
	for _, p := range tc.getEffectiveStoragePaths() {
		if driveAvailable(p) {
			out = append(out, p)
		} else {
			log.Printf("⚠️ Storage %s is not available (drive unplugged?) - skipping it", p)
		}
	}
	return out
}

func gb(b int64) string { return fmt.Sprintf("%.1f GB", float64(b)/(1<<30)) }

// checkSpaceFor fails when no drive can take size bytes and keep its reserve.
func (tc *TorrentClient) checkSpaceFor(size int64) error {
	var most int64
	for _, p := range append(tc.usableStoragePaths(), tc.downloadDir) {
		if free, _, err := tc.getDiskFree(p); err == nil && int64(free) > most {
			most = int64(free)
		}
	}
	if most < size+MinFreeBytes {
		return fmt.Errorf("not enough free space: this download needs %s, the drive with the most room has %s free (HomeFlix keeps %s free on every drive). Free up space or add a drive in Settings > Storage", gb(size), gb(most), gb(MinFreeBytes))
	}
	return nil
}

// pauseForSpace stops a download until a drive has room; the monitor
// resumes it automatically.
func (tc *TorrentClient) pauseForSpace(id, why string) {
	tc.mu.Lock()
	t, ok := tc.torrents[id]
	info := tc.downloads[id]
	tc.mu.Unlock()
	if !ok || info == nil {
		return
	}
	_ = t.Stop()
	tc.mu.Lock()
	info.Status, info.ETA = "paused", why
	tc.spaceWait[id] = why
	tc.mu.Unlock()
	log.Printf("⏸️ %s: %s", info.Name, why)
}

// guardFreeSpace runs from the monitor (every 30 s):
//   - a download whose drive is almost full moves to another drive with
//     room, or pauses when there is none (never fills a drive to zero);
//   - a download that won't fit on its drive moves early, while there's
//     little to copy;
//   - downloads paused for space resume by themselves once there's room.
func (tc *TorrentClient) guardFreeSpace() {
	type item struct {
		id        string
		remaining int64
		waiting   bool
	}
	tc.mu.Lock()
	var items []item
	for id, info := range tc.downloads {
		if tc.relocating[id] {
			continue
		}
		var remaining int64
		if info.Size > 0 {
			remaining = info.Size - info.Downloaded
		}
		switch {
		case info.Status == "downloading":
			items = append(items, item{id, remaining, false})
		case info.Status == "paused" && tc.spaceWait[id] != "":
			items = append(items, item{id, remaining, true})
		}
	}
	tc.mu.Unlock()

	for _, it := range items {
		dir := tc.dataDirOf(it.id)
		f, _, err := tc.getDiskFree(dir)
		if err != nil {
			continue
		}
		free := int64(f)
		fitsHere := it.remaining > 0 && free >= it.remaining+MinFreeBytes
		if it.waiting {
			if fitsHere {
				tc.resumeAfterSpace(it.id)
			} else if it.remaining > 0 && tc.otherDriveFits(dir, dirSize(dir)+it.remaining) {
				go tc.relocate(it.id)
			}
			continue
		}
		switch {
		case free < MinFreeBytes:
			go tc.relocate(it.id) // moves, or pauses when no drive has room
		case it.remaining > 0 && !fitsHere && tc.otherDriveFits(dir, dirSize(dir)+it.remaining):
			log.Printf("📦 %s won't fit on its drive (%s left, %s free) - moving it now", it.id, gb(it.remaining), gb(free))
			go tc.relocate(it.id)
		}
	}
}

func (tc *TorrentClient) otherDriveFits(current string, need int64) bool {
	for _, p := range tc.usableStoragePaths() {
		if sameFilesystem(p, current) {
			continue
		}
		if free, _, err := tc.getDiskFree(p); err == nil && int64(free) >= need+MinFreeBytes {
			return true
		}
	}
	return false
}

func (tc *TorrentClient) resumeAfterSpace(id string) {
	tc.mu.Lock()
	t, ok := tc.torrents[id]
	info := tc.downloads[id]
	tc.mu.Unlock()
	if !ok || info == nil {
		return
	}
	if err := t.Start(); err != nil {
		log.Printf("⚠️ resume after space freed: %v", err)
		return
	}
	tc.mu.Lock()
	delete(tc.spaceWait, id)
	info.Status, info.ETA = "downloading", "Resumed - space available"
	tc.mu.Unlock()
	log.Printf("▶️ %s: space available again, resumed", info.Name)
}

// relocate stops a download, moves its partial data to the drive with the
// most room and starts it again (Rain resumes from its saved piece state).
func (tc *TorrentClient) relocate(id string) {
	tc.mu.Lock()
	t, ok := tc.torrents[id]
	info := tc.downloads[id]
	if !ok || info == nil || tc.relocating[id] {
		tc.mu.Unlock()
		return
	}
	tc.relocating[id] = true
	remaining := info.Size - info.Downloaded
	if remaining < 0 || info.Size == 0 {
		remaining = 0
	}
	tc.mu.Unlock()
	defer func() {
		tc.mu.Lock()
		delete(tc.relocating, id)
		tc.mu.Unlock()
	}()

	src := tc.dataDirOf(id)
	used := dirSize(src)
	storage := tc.selectBestStoragePath(used + remaining)
	free := int64(0)
	if storage != "" {
		if f, _, err := tc.getDiskFree(storage); err == nil {
			free = int64(f)
		}
	}
	if storage == "" || sameFilesystem(storage, src) || free < used+remaining+MinFreeBytes {
		if free, _, err := tc.getDiskFree(src); err == nil && int64(free) >= MinFreeBytes && (remaining == 0 || int64(free) >= remaining+MinFreeBytes) {
			return // fine where it is after all
		}
		tc.pauseForSpace(id, fmt.Sprintf("Paused: all drives are full (needs %s more) - resumes when space frees up", gb(remaining)))
		return
	}
	tc.mu.Lock()
	info.ETA = "Drive full - moving to another drive"
	tc.mu.Unlock()

	log.Printf("📦 %s: drive full, moving %.1f GB of partial data to %s", info.Name, float64(used)/(1<<30), storage)
	if err := t.Stop(); err != nil {
		log.Printf("⚠️ relocate: stop failed: %v", err)
	}
	time.Sleep(2 * time.Second) // let Rain close its files
	target := filepath.Join(storage, incomingDirName, id)
	if err := copyTree(src, target); err != nil {
		log.Printf("❌ relocate %s failed: %v - resuming in place", info.Name, err)
		_ = os.RemoveAll(target)
		_ = t.Start()
		return
	}
	link := filepath.Join(tc.downloadDir, id)
	tmp := link + ".relink"
	_ = os.Remove(tmp)
	if err := os.Symlink(target, tmp); err == nil {
		err = os.Rename(tmp, link) // atomic swap (replaces a dir only if it's a link)
		if err != nil {
			// link was a real directory: move it aside, then link
			_ = os.Remove(tmp)
			if err := os.Rename(link, link+".old"); err == nil {
				_ = os.Symlink(target, link)
				src = link + ".old"
			}
		}
	}
	_ = os.RemoveAll(src)
	if strings.Contains(src, string(filepath.Separator)+incomingDirName+string(filepath.Separator)) {
		removeEmptyDirs(filepath.Dir(src)) // tidy the old drive's incoming folder
	}
	if err := t.Start(); err != nil {
		log.Printf("⚠️ relocate: restart failed: %v", err)
	}
	tc.mu.Lock()
	delete(tc.spaceWait, id)
	info.Status, info.ETA = "downloading", "Moved to "+storage
	tc.mu.Unlock()
	log.Printf("✅ %s now downloading on %s", info.Name, storage)
}

func dirSize(p string) int64 {
	var n int64
	_ = filepath.Walk(p, func(_ string, fi os.FileInfo, err error) error {
		if err == nil && !fi.IsDir() {
			n += fi.Size()
		}
		return nil
	})
	return n
}

// copyTree copies a directory (files are sparse-unaware but complete).
func copyTree(src, dst string) error {
	return filepath.Walk(src, func(p string, fi os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(src, p)
		if err != nil {
			return err
		}
		out := filepath.Join(dst, rel)
		if fi.IsDir() {
			return os.MkdirAll(out, 0o755)
		}
		if !fi.Mode().IsRegular() {
			return nil
		}
		in, err := os.Open(p)
		if err != nil {
			return err
		}
		defer in.Close()
		f, err := os.OpenFile(out, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, fi.Mode().Perm())
		if err != nil {
			return err
		}
		if _, err := io.Copy(f, in); err != nil {
			f.Close()
			return fmt.Errorf("copy %s: %w", rel, err)
		}
		return f.Close()
	})
}
