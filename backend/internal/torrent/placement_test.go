package torrent

import (
	"os"
	"path/filepath"
	"testing"
)

// /dev/shm is a different filesystem from the temp dir on most Linux hosts,
// which lets us test placing a download on "another drive".
func otherDrive(t *testing.T) string {
	t.Helper()
	dir, err := os.MkdirTemp("/dev/shm", "hfx-drive-")
	if err != nil {
		t.Skip("no /dev/shm")
	}
	t.Cleanup(func() { os.RemoveAll(dir) })
	if sameFilesystem(dir, t.TempDir()) {
		t.Skip("/dev/shm is on the same filesystem here")
	}
	return dir
}

func TestPlaceIncomingOnOtherDrive(t *testing.T) {
	dl := t.TempDir()
	drive := otherDrive(t)
	tc := &TorrentClient{downloadDir: dl, storagePaths: []string{drive}, downloads: map[string]*DownloadInfo{}, relocating: map[string]bool{}}

	data := tc.placeIncoming("kVmRtgx2Q1yqLx3vTq9yBw", 0)
	if data != filepath.Join(drive, incomingDirName, "kVmRtgx2Q1yqLx3vTq9yBw") {
		t.Fatalf("placed at %s", data)
	}
	// Rain writes through <downloadDir>/<id>; bytes land on the other drive.
	if err := os.MkdirAll(filepath.Join(dl, "kVmRtgx2Q1yqLx3vTq9yBw", "Movie"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dl, "kVmRtgx2Q1yqLx3vTq9yBw", "Movie", "movie.mkv"), []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(drive, incomingDirName, "kVmRtgx2Q1yqLx3vTq9yBw", "Movie", "movie.mkv")); err != nil {
		t.Fatal("data not on the chosen drive")
	}
	if root := tc.incomingStorageRoot("kVmRtgx2Q1yqLx3vTq9yBw"); root != drive {
		t.Fatalf("storage root %q", root)
	}
	// Completion moves within the drive and cleans up.
	newPath, err := tc.moveToStorage(filepath.Join(dl, "kVmRtgx2Q1yqLx3vTq9yBw"), "Movie")
	if err != nil || filepath.Dir(newPath) != drive {
		t.Fatalf("moved to %s err=%v", newPath, err)
	}
	tc.cleanupIncoming("kVmRtgx2Q1yqLx3vTq9yBw")
	if _, err := os.Lstat(filepath.Join(dl, "kVmRtgx2Q1yqLx3vTq9yBw")); !os.IsNotExist(err) {
		t.Fatal("link left behind")
	}
	// The download's own folder is gone; the hidden .homeflix-incoming
	// folder (skipped by the library scanner) may stay for reuse.
	if _, err := os.Stat(filepath.Join(drive, incomingDirName, "kVmRtgx2Q1yqLx3vTq9yBw")); !os.IsNotExist(err) {
		t.Fatal("download folder left behind")
	}
}

func TestPlaceIncomingSameDriveKeepsDownloadFolder(t *testing.T) {
	dl := t.TempDir()
	storage := t.TempDir() // same filesystem
	tc := &TorrentClient{downloadDir: dl, storagePaths: []string{storage}, downloads: map[string]*DownloadInfo{}, relocating: map[string]bool{}}
	if data := tc.placeIncoming("id1", 0); data != filepath.Join(dl, "id1") {
		t.Fatalf("expected plain download folder, got %s", data)
	}
	if _, err := os.Lstat(filepath.Join(dl, "id1")); !os.IsNotExist(err) {
		t.Fatal("no link expected on the same drive")
	}
}

func TestCopyTree(t *testing.T) {
	src, dst := t.TempDir(), filepath.Join(t.TempDir(), "out")
	os.MkdirAll(filepath.Join(src, "a", "b"), 0o755)
	os.WriteFile(filepath.Join(src, "a", "b", "f.bin"), make([]byte, 1<<20), 0o644)
	if err := copyTree(src, dst); err != nil {
		t.Fatal(err)
	}
	if dirSize(dst) != 1<<20 {
		t.Fatalf("size %d", dirSize(dst))
	}
}

func TestStorageSelectionHonoursPriorityAndSkipsMissingDrives(t *testing.T) {
	a, b := t.TempDir(), otherDrive(t)
	missing := "/mnt/hfx-unplugged-drive-test"
	tc := &TorrentClient{downloadDir: a, storagePaths: []string{missing, b, a}}
	if _, err := os.Stat(missing); err == nil {
		t.Skip("test mount point exists")
	}
	got := tc.selectBestStoragePath(1 << 20)
	if got == missing {
		t.Fatal("picked an unplugged drive")
	}
	if _, err := os.Stat(missing); err == nil {
		t.Fatal("created a folder for a missing drive")
	}
	// b comes first (higher priority): chosen whenever it has room.
	want := a
	if free, _, _ := tc.getDiskFree(b); int64(free) >= 1<<20+MinFreeBytes {
		want = b
	}
	if got != want {
		t.Fatalf("picked %s, want %s", got, want)
	}
}

func TestCheckSpaceRefusesWhatFitsNowhere(t *testing.T) {
	tc := &TorrentClient{downloadDir: t.TempDir()}
	if err := tc.checkSpaceFor(1 << 50); err == nil {
		t.Fatal("1 PB download accepted")
	}
	if err := tc.checkSpaceFor(1 << 20); err != nil {
		t.Fatalf("1 MB refused: %v", err)
	}
}

func TestDriveAvailable(t *testing.T) {
	if driveAvailable("/mnt/hfx-unplugged-drive-test") {
		t.Fatal("missing drive reported available")
	}
	if !driveAvailable(t.TempDir()) {
		t.Fatal("temp dir reported unavailable")
	}
}
