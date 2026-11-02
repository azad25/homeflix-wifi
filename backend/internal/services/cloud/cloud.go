// Package cloud adds cloud drives (Google Drive, OneDrive, Dropbox, S3, B2,
// WebDAV, SFTP, ...) as HomeFlix storage through rclone: remotes are mounted
// as folders, registered as library paths, and finished downloads can be
// moved there when the local drives run low.
package cloud

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"gorm.io/gorm"

	"homeflix-backend/internal/models"
	"homeflix-backend/internal/storage"
)

// Mount is a remote mounted as a folder.
type Mount struct {
	Remote     string `json:"remote"`      // rclone remote name
	Folder     string `json:"folder"`      // folder on the remote ("" = root)
	MountPoint string `json:"mount_point"` // local folder
	CacheGB    int    `json:"cache_gb"`    // local read cache
	Enabled    bool   `json:"enabled"`

	Status string `json:"status"` // mounted | starting | error | stopped
	Error  string `json:"error,omitempty"`
}

// Settings persisted in <dir>/cloud.json.
type Settings struct {
	Mounts []Mount `json:"mounts"`
	// Move titles from a nearly full local drive to this remote's mount.
	OffloadWhenLow bool   `json:"offload_when_low"`
	OffloadTarget  string `json:"offload_target"`
	// Only move titles nobody watched for this many days.
	OffloadIdleDays int `json:"offload_idle_days"`
}

// Remote is an rclone remote.
type Remote struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

// Types offered in the UI. OAuth types take a token from `rclone authorize`.
var Types = map[string]struct {
	Label  string   `json:"label"`
	OAuth  bool     `json:"oauth"`
	Fields []string `json:"fields"`
}{
	"drive":    {"Google Drive", true, []string{"token"}},
	"onedrive": {"OneDrive", true, []string{"token", "drive_id", "drive_type"}},
	"dropbox":  {"Dropbox", true, []string{"token"}},
	"box":      {"Box", true, []string{"token"}},
	"pcloud":   {"pCloud", true, []string{"token"}},
	"s3":       {"S3 compatible (AWS, Wasabi, R2, MinIO…)", false, []string{"provider", "access_key_id", "secret_access_key", "region", "endpoint"}},
	"b2":       {"Backblaze B2", false, []string{"account", "key"}},
	"webdav":   {"WebDAV (Nextcloud, ownCloud…)", false, []string{"url", "vendor", "user", "pass"}},
	"sftp":     {"SFTP", false, []string{"host", "user", "pass", "port"}},
	"mega":     {"MEGA", false, []string{"user", "pass"}},
}

var (
	nameRe  = regexp.MustCompile(`^[A-Za-z0-9_-]{1,40}$`)
	paramRe = regexp.MustCompile(`^[a-z_]{1,40}$`)
)

type Service struct {
	db  *gorm.DB
	dir string
	bin string // rclone binary ("" = not installed)
	// MountRoot is where remotes are mounted (default <dir>/mounts).
	MountRoot string
	// Notify reports offloads (optional).
	Notify func(title, message string)

	mu       sync.Mutex
	settings Settings
	procs    map[string]*exec.Cmd
	stopping map[string]bool
}

// NewService: HOMEFLIX_CLOUD_DIR (default ./data/cloud), HOMEFLIX_RCLONE
// (default: rclone on PATH).
func NewService(db *gorm.DB) *Service {
	dir := strings.TrimSpace(os.Getenv("HOMEFLIX_CLOUD_DIR"))
	if dir == "" {
		dir = "data/cloud"
	}
	abs, err := filepath.Abs(dir)
	if err == nil {
		dir = abs
	}
	bin := strings.TrimSpace(os.Getenv("HOMEFLIX_RCLONE"))
	if bin == "" {
		bin, _ = exec.LookPath("rclone")
	}
	s := &Service{db: db, dir: dir, bin: bin, MountRoot: filepath.Join(dir, "mounts"), procs: map[string]*exec.Cmd{}, stopping: map[string]bool{}}
	s.settings.OffloadIdleDays = 30
	if b, err := os.ReadFile(filepath.Join(dir, "cloud.json")); err == nil {
		_ = json.Unmarshal(b, &s.settings)
	}
	return s
}

func (s *Service) save() error {
	if err := os.MkdirAll(s.dir, 0o755); err != nil {
		return err
	}
	st := s.settings
	st.Mounts = append([]Mount(nil), st.Mounts...)
	for i := range st.Mounts { // runtime state isn't persisted
		st.Mounts[i].Status, st.Mounts[i].Error = "", ""
	}
	b, _ := json.MarshalIndent(st, "", "  ")
	return os.WriteFile(filepath.Join(s.dir, "cloud.json"), b, 0o600)
}

func (s *Service) rclone(ctx context.Context, args ...string) (string, error) {
	if s.bin == "" {
		return "", errors.New("rclone is not installed on the server")
	}
	ctx, cancel := context.WithTimeout(ctx, 60*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, s.bin, args...)
	var out, errb bytes.Buffer
	cmd.Stdout, cmd.Stderr = &out, &errb
	if err := cmd.Run(); err != nil {
		msg := strings.TrimSpace(errb.String())
		if msg == "" {
			msg = err.Error()
		}
		return "", errors.New(lastLine(msg))
	}
	return out.String(), nil
}

func lastLine(s string) string {
	lines := strings.Split(strings.TrimSpace(s), "\n")
	return strings.TrimSpace(lines[len(lines)-1])
}

// Info for the settings page.
type Info struct {
	Installed bool     `json:"installed"`
	Version   string   `json:"version,omitempty"`
	Fuse      bool     `json:"fuse"`
	Remotes   []Remote `json:"remotes"`
	Settings  Settings `json:"settings"`
	Types     any      `json:"types"`
	Error     string   `json:"error,omitempty"`
}

func fuseAvailable() bool {
	if _, err := os.Stat("/dev/fuse"); err != nil {
		return false
	}
	for _, b := range []string{"fusermount3", "fusermount"} {
		if _, err := exec.LookPath(b); err == nil {
			return true
		}
	}
	return false
}

func (s *Service) Info(ctx context.Context) Info {
	in := Info{Installed: s.bin != "", Fuse: fuseAvailable(), Types: Types, Remotes: []Remote{}}
	if in.Installed {
		if v, err := s.rclone(ctx, "version"); err == nil {
			in.Version = strings.TrimSpace(strings.SplitN(v, "\n", 2)[0])
		}
		r, err := s.Remotes(ctx)
		if err != nil {
			in.Error = err.Error()
		}
		in.Remotes = r
	}
	s.mu.Lock()
	in.Settings = s.settings
	in.Settings.Mounts = append([]Mount(nil), s.settings.Mounts...)
	s.mu.Unlock()
	return in
}

// Remotes lists configured rclone remotes.
func (s *Service) Remotes(ctx context.Context) ([]Remote, error) {
	out, err := s.rclone(ctx, "listremotes", "--long")
	if err != nil {
		return []Remote{}, err
	}
	var rs []Remote
	sc := bufio.NewScanner(strings.NewReader(out))
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" {
			continue
		}
		name, typ, _ := strings.Cut(line, ":")
		rs = append(rs, Remote{Name: strings.TrimSpace(name), Type: strings.TrimSpace(typ)})
	}
	sort.Slice(rs, func(i, j int) bool { return rs[i].Name < rs[j].Name })
	return rs, nil
}

// CreateRemote adds a remote (secrets are obscured by rclone).
func (s *Service) CreateRemote(ctx context.Context, name, typ string, params map[string]string) error {
	if !nameRe.MatchString(name) {
		return errors.New("use letters, numbers, - and _ for the name")
	}
	t, ok := Types[typ]
	if !ok {
		return fmt.Errorf("unsupported type %q", typ)
	}
	args := []string{"config", "create", name, typ}
	for _, f := range t.Fields {
		v := strings.TrimSpace(params[f])
		if v == "" || !paramRe.MatchString(f) {
			continue
		}
		args = append(args, f+"="+v)
	}
	if t.OAuth && strings.TrimSpace(params["token"]) == "" {
		return errors.New("paste the token from `rclone authorize`")
	}
	args = append(args, "--obscure", "--non-interactive")
	_, err := s.rclone(ctx, args...)
	return err
}

func (s *Service) DeleteRemote(ctx context.Context, name string) error {
	if !nameRe.MatchString(name) {
		return errors.New("invalid name")
	}
	_ = s.RemoveMount(name)
	_, err := s.rclone(ctx, "config", "delete", name)
	return err
}

func (s *Service) findMount(remote string) int {
	for i, m := range s.settings.Mounts {
		if m.Remote == remote {
			return i
		}
	}
	return -1
}

// AddMount mounts a remote (one mount per remote).
func (s *Service) AddMount(remote, folder string, cacheGB int) (Mount, error) {
	if !nameRe.MatchString(remote) {
		return Mount{}, errors.New("invalid remote")
	}
	folder = strings.Trim(strings.TrimSpace(folder), "/")
	if strings.Contains(folder, "..") {
		return Mount{}, errors.New("invalid folder")
	}
	if cacheGB <= 0 {
		cacheGB = 20
	}
	s.mu.Lock()
	if s.findMount(remote) >= 0 {
		s.mu.Unlock()
		return Mount{}, errors.New("this remote is already mounted")
	}
	m := Mount{Remote: remote, Folder: folder, MountPoint: filepath.Join(s.MountRoot, remote), CacheGB: cacheGB, Enabled: true, Status: "starting"}
	s.settings.Mounts = append(s.settings.Mounts, m)
	err := s.save()
	s.mu.Unlock()
	if err != nil {
		return m, err
	}
	go s.ensure(remote)
	return m, nil
}

func (s *Service) SetMountEnabled(remote string, on bool) error {
	s.mu.Lock()
	i := s.findMount(remote)
	if i < 0 {
		s.mu.Unlock()
		return errors.New("no such mount")
	}
	s.settings.Mounts[i].Enabled = on
	err := s.save()
	s.mu.Unlock()
	if on {
		go s.ensure(remote)
	} else {
		s.stop(remote)
	}
	return err
}

func (s *Service) RemoveMount(remote string) error {
	s.stop(remote)
	s.mu.Lock()
	defer s.mu.Unlock()
	i := s.findMount(remote)
	if i < 0 {
		return nil
	}
	mp := s.settings.Mounts[i].MountPoint
	s.settings.Mounts = append(s.settings.Mounts[:i], s.settings.Mounts[i+1:]...)
	if s.settings.OffloadTarget == remote {
		s.settings.OffloadTarget, s.settings.OffloadWhenLow = "", false
	}
	// The library keeps what it scanned, but the folder is no longer scanned.
	s.db.Model(&models.MediaPath{}).Where("path = ?", mp).Update("is_active", false)
	return s.save()
}

func (s *Service) UpdateSettings(offload bool, target string, idleDays int) (Settings, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if offload && s.findMount(target) < 0 {
		return s.settings, errors.New("choose a mounted cloud drive to move titles to")
	}
	if idleDays < 1 {
		idleDays = 30
	}
	s.settings.OffloadWhenLow, s.settings.OffloadTarget, s.settings.OffloadIdleDays = offload, target, idleDays
	return s.settings, s.save()
}

// isMountedFn is swapped in tests.
var isMountedFn = isMountedProc

func isMountedProc(mountPoint string) bool {
	b, err := os.ReadFile("/proc/mounts")
	if err != nil {
		return false
	}
	for _, line := range strings.Split(string(b), "\n") {
		f := strings.Fields(line)
		if len(f) > 1 && strings.ReplaceAll(f[1], `\040`, " ") == mountPoint {
			return true
		}
	}
	return false
}

func (s *Service) setStatus(remote, status, msg string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if i := s.findMount(remote); i >= 0 {
		s.settings.Mounts[i].Status, s.settings.Mounts[i].Error = status, msg
	}
}

// ensure starts `rclone mount` for a remote and supervises it.
func (s *Service) ensure(remote string) {
	s.mu.Lock()
	i := s.findMount(remote)
	if i < 0 || !s.settings.Mounts[i].Enabled || s.procs[remote] != nil {
		s.mu.Unlock()
		return
	}
	m := s.settings.Mounts[i]
	s.mu.Unlock()

	if s.bin == "" {
		s.setStatus(remote, "error", "rclone is not installed on the server")
		return
	}
	if !fuseAvailable() {
		s.setStatus(remote, "error", "FUSE is not available (install fuse3)")
		return
	}
	if err := os.MkdirAll(m.MountPoint, 0o755); err != nil {
		s.setStatus(remote, "error", err.Error())
		return
	}
	if isMountedFn(m.MountPoint) {
		unmount(m.MountPoint) // stale mount from a previous run
	}
	src := m.Remote + ":" + m.Folder
	cmd := exec.Command(s.bin, "mount", src, m.MountPoint,
		"--vfs-cache-mode", "full", // smooth playback + seeking, safe writes
		"--vfs-cache-max-size", fmt.Sprintf("%dG", m.CacheGB),
		"--vfs-cache-max-age", "72h",
		"--vfs-read-chunk-size", "32M",
		"--buffer-size", "32M",
		"--dir-cache-time", "30m",
		"--poll-interval", "1m",
		"--cache-dir", filepath.Join(s.dir, "cache"),
	)
	var stderr bytes.Buffer
	cmd.Stderr = &tail{buf: &stderr, max: 4096}
	if err := cmd.Start(); err != nil {
		s.setStatus(remote, "error", err.Error())
		return
	}
	s.mu.Lock()
	s.procs[remote] = cmd
	s.mu.Unlock()
	s.setStatus(remote, "starting", "")

	// Wait until the mount shows up, then register it with the library.
	go func() {
		for t := 0; t < 30; t++ {
			if isMountedFn(m.MountPoint) {
				s.setStatus(remote, "mounted", "")
				s.registerPath(m)
				log.Printf("☁️ Mounted %s at %s", src, m.MountPoint)
				return
			}
			time.Sleep(time.Second)
		}
	}()

	err := cmd.Wait()
	s.mu.Lock()
	delete(s.procs, remote)
	stopping := s.stopping[remote]
	delete(s.stopping, remote)
	s.mu.Unlock()
	if stopping {
		s.setStatus(remote, "stopped", "")
		return
	}
	msg := lastLine(stderr.String())
	if msg == "" && err != nil {
		msg = err.Error()
	}
	s.setStatus(remote, "error", msg)
	log.Printf("☁️ Mount %s exited: %s - retrying in 60s", src, msg)
	time.AfterFunc(60*time.Second, func() { s.ensure(remote) })
}

type tail struct {
	buf *bytes.Buffer
	max int
	mu  sync.Mutex
}

func (t *tail) Write(p []byte) (int, error) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.buf.Write(p)
	if t.buf.Len() > t.max {
		b := t.buf.Bytes()[t.buf.Len()-t.max:]
		nb := append([]byte(nil), b...)
		t.buf.Reset()
		t.buf.Write(nb)
	}
	return len(p), nil
}

func unmount(mp string) {
	for _, b := range []string{"fusermount3", "fusermount"} {
		if p, err := exec.LookPath(b); err == nil {
			_ = exec.Command(p, "-uz", mp).Run()
			return
		}
	}
	_ = exec.Command("umount", "-l", mp).Run()
}

func (s *Service) stop(remote string) {
	s.mu.Lock()
	cmd := s.procs[remote]
	i := s.findMount(remote)
	mp := ""
	if i >= 0 {
		mp = s.settings.Mounts[i].MountPoint
	}
	if cmd != nil {
		s.stopping[remote] = true
	}
	s.mu.Unlock()
	if cmd != nil && cmd.Process != nil {
		_ = cmd.Process.Signal(os.Interrupt) // rclone unmounts cleanly on SIGINT
		done := make(chan struct{})
		go func() {
			for t := 0; t < 50; t++ {
				s.mu.Lock()
				gone := s.procs[remote] == nil
				s.mu.Unlock()
				if gone {
					break
				}
				time.Sleep(100 * time.Millisecond)
			}
			close(done)
		}()
		<-done
		_ = cmd.Process.Kill()
	}
	if mp != "" && isMountedFn(mp) {
		unmount(mp)
	}
	if mp != "" {
		s.db.Model(&models.MediaPath{}).Where("path = ?", mp).Update("is_active", false)
	}
	s.setStatus(remote, "stopped", "")
}

// registerPath makes the mount a library folder (type "cloud": scanned and
// shown in Storage, never used as a torrent download target).
func (s *Service) registerPath(m Mount) {
	var mp models.MediaPath
	err := s.db.Unscoped().Where("path = ?", m.MountPoint).First(&mp).Error
	name := m.Remote + " (cloud)"
	if err != nil {
		mp = models.MediaPath{Path: m.MountPoint, Name: name, Description: "Cloud drive via rclone", PathType: "cloud", IsActive: true}
		s.db.Create(&mp)
		return
	}
	s.db.Unscoped().Model(&mp).Updates(map[string]interface{}{"is_active": true, "path_type": "cloud", "deleted_at": nil})
}

// Run mounts enabled remotes and offloads when local drives are low.
func (s *Service) Run(ctx context.Context) {
	s.mu.Lock()
	var remotes []string
	for _, m := range s.settings.Mounts {
		if m.Enabled {
			remotes = append(remotes, m.Remote)
		}
	}
	s.mu.Unlock()
	for _, r := range remotes {
		go s.ensure(r)
	}
	t := time.NewTicker(time.Hour)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			s.StopAll()
			return
		case <-t.C:
			s.Offload(ctx)
		}
	}
}

// StopAll unmounts everything (server shutdown).
func (s *Service) StopAll() {
	s.mu.Lock()
	var rs []string
	for r := range s.procs {
		rs = append(rs, r)
	}
	s.mu.Unlock()
	for _, r := range rs {
		s.stop(r)
	}
}

// Offload moves titles nobody watched recently from nearly full local drives
// to the cloud drive, until the drive is no longer low (at most 10 a run).
func (s *Service) Offload(ctx context.Context) int {
	s.mu.Lock()
	st := s.settings
	i := s.findMount(st.OffloadTarget)
	var target Mount
	if i >= 0 {
		target = s.settings.Mounts[i]
	}
	s.mu.Unlock()
	if !st.OffloadWhenLow || i < 0 || !isMountedFn(target.MountPoint) {
		return 0
	}
	moved, freed := 0, int64(0)
	cutoff := time.Now().AddDate(0, 0, -st.OffloadIdleDays)
	for _, si := range storage.GetActiveStorageInfos(s.db) {
		if !si.IsLow || si.PathType == "cloud" || ctx.Err() != nil {
			continue
		}
		var media []models.Media
		s.db.Where("file_path LIKE ?", strings.TrimRight(si.Path, "/")+"/%").
			Where("id NOT IN (?)", s.db.Model(&models.PlaybackProgress{}).Select("media_id").Where("last_watched > ?", cutoff)).
			Order("created_at ASC").Limit(10 - moved).Find(&media)
		for _, m := range media {
			n, err := s.moveMedia(m, si.Path, target.MountPoint)
			if err != nil {
				log.Printf("☁️ Offload %s failed: %v", m.Title, err)
				continue
			}
			moved++
			freed += n
		}
		if moved >= 10 {
			break
		}
	}
	if moved > 0 && s.Notify != nil {
		s.Notify(fmt.Sprintf("Moved %d title(s) to %s", moved, target.Remote),
			fmt.Sprintf("Freed %.1f GB on your local drives. They still play from the cloud.", float64(freed)/(1<<30)))
	}
	return moved
}

// moveMedia copies a title (and same-named sidecars like subtitles) to the
// cloud mount, verifies the copy, updates the library and removes the local file.
func (s *Service) moveMedia(m models.Media, root, mountPoint string) (int64, error) {
	rel, err := filepath.Rel(root, m.FilePath)
	if err != nil || strings.HasPrefix(rel, "..") {
		return 0, fmt.Errorf("not under %s", root)
	}
	dst := filepath.Join(mountPoint, rel)
	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return 0, err
	}
	size, err := copyVerified(m.FilePath, dst)
	if err != nil {
		return 0, err
	}
	base := strings.TrimSuffix(m.FilePath, filepath.Ext(m.FilePath))
	sidecars, _ := filepath.Glob(base + ".*")
	for _, sc := range sidecars {
		if sc == m.FilePath {
			continue
		}
		if r, err := filepath.Rel(root, sc); err == nil {
			if _, err := copyVerified(sc, filepath.Join(mountPoint, r)); err == nil {
				_ = os.Remove(sc)
			}
		}
	}
	if err := s.db.Model(&models.Media{}).Where("id = ?", m.ID).Update("file_path", dst).Error; err != nil {
		_ = os.Remove(dst)
		return 0, err
	}
	_ = os.Remove(m.FilePath)
	log.Printf("☁️ Moved %s to %s", m.Title, dst)
	return size, nil
}

func copyVerified(src, dst string) (int64, error) {
	in, err := os.Open(src)
	if err != nil {
		return 0, err
	}
	defer in.Close()
	fi, err := in.Stat()
	if err != nil {
		return 0, err
	}
	tmp := dst + ".partial"
	out, err := os.Create(tmp)
	if err != nil {
		return 0, err
	}
	n, err := io.Copy(out, in)
	if cerr := out.Close(); err == nil {
		err = cerr
	}
	if err == nil && n != fi.Size() {
		err = fmt.Errorf("copied %d of %d bytes", n, fi.Size())
	}
	if err == nil {
		err = os.Rename(tmp, dst)
	}
	if err != nil {
		_ = os.Remove(tmp)
		return 0, err
	}
	if di, err := os.Stat(dst); err != nil || di.Size() != fi.Size() {
		return 0, fmt.Errorf("verification failed for %s", dst)
	}
	return n, nil
}
