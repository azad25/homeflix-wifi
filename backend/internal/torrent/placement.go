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

// guardFreeSpace runs from the monitor: a download whose drive is almost
// full is moved to another drive with room and resumed.
func (tc *TorrentClient) guardFreeSpace() {
	tc.mu.Lock()
	var full []string
	for id, info := range tc.downloads {
		if info.Status != "downloading" || tc.relocating[id] {
			continue
		}
		free, _, err := tc.getDiskFree(tc.dataDirOf(id))
		if err == nil && free < MinFreeBytes {
			full = append(full, id)
		}
	}
	tc.mu.Unlock()
	for _, id := range full {
		go tc.relocate(id)
	}
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
	info.ETA = "Drive full - moving to another drive"
	tc.mu.Unlock()
	defer func() {
		tc.mu.Lock()
		delete(tc.relocating, id)
		tc.mu.Unlock()
	}()

	src := tc.dataDirOf(id)
	used := dirSize(src)
	storage := tc.selectBestStoragePath(used + remaining + MinFreeBytes)
	if storage == "" || sameFilesystem(storage, src) {
		log.Printf("⚠️ %s: drive full and no other drive has room - pausing", info.Name)
		_ = t.Stop()
		tc.mu.Lock()
		info.Status, info.ETA = "paused", "Paused: all drives are full"
		tc.mu.Unlock()
		return
	}
	if free, _, err := tc.getDiskFree(storage); err != nil || int64(free) < used+remaining+MinFreeBytes {
		_ = t.Stop()
		tc.mu.Lock()
		info.Status, info.ETA = "paused", "Paused: all drives are full"
		tc.mu.Unlock()
		return
	}

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
	info.ETA = "Moved to " + storage
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
