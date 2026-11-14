// Package mediafiles decides which files on a library drive are movies or
// episodes. Every scan path and the library cleanup use the same rule, so a
// file that would not be added by a scan is also removed from the library.
//
// Rejected:
//   - files without a movie container extension (.mkv, .mp4, .avi, ...);
//   - .ts / .mts / .m2ts that are not MPEG transport streams (TypeScript
//     source files share these extensions);
//   - anything under hidden, system, app, code or extras folders
//     (node_modules, .git, $RECYCLE.BIN, Featurettes, Samples, VIDEO_TS, ...);
//   - samples and trailers ("movie-sample.mkv", "... trailer.mp4");
//   - HomeFlix's own generated files (preview_*.mp4, HLS cache, trailers);
//   - files under MinBytes (clips, not movies or episodes).
package mediafiles

import (
	"bytes"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// MinBytes: smaller files are clips, not movies or episodes.
const MinBytes = 30 << 20 // 30 MB

var containers = map[string]bool{
	".mkv": true, ".mp4": true, ".m4v": true, ".avi": true, ".mov": true,
	".wmv": true, ".mpg": true, ".mpeg": true, ".webm": true, ".flv": true,
	".ts": true, ".m2ts": true, ".mts": true,
}

// transport: extensions also used by source code; checked by content.
var transport = map[string]bool{".ts": true, ".mts": true, ".m2ts": true}

// skipDirs: folder names (lower case) whose contents are never library titles.
var skipDirs = map[string]bool{
	// system / recycle / NAS metadata
	"system volume information": true, "lost+found": true, "@eadir": true, "#recycle": true,
	"#snapshot": true, "recycler": true, "recycle bin": true, "trash": true,
	// code and app folders
	"node_modules": true, "vendor": true, "site-packages": true, "__pycache__": true,
	"hls_cache": true, "thumbnails": true, "previews": true, "comingsoon": true,
	// disc structures: chunks, not titles
	"video_ts": true, "bdmv": true, "certificate": true,
	// extras (Plex / Jellyfin conventions)
	"extras": true, "featurettes": true, "behind the scenes": true, "deleted scenes": true,
	"interviews": true, "trailers": true, "sample": true, "samples": true,
}

var junkName = regexp.MustCompile(`(?i)(^|[\s._\-\[\(])(sample|trailer|teaser)([\s._\-\]\)]|$)`)

// relDir is the file's folder relative to the library root it lives in, so
// only folders inside the library are judged (a library mounted at
// "/home/me/.media" or "/mnt/previews" is fine). Without a matching root
// only the last three folders are looked at.
func relDir(path string, roots []string) string {
	dir := filepath.Clean(filepath.Dir(path))
	best := ""
	for _, r := range roots {
		r = filepath.Clean(r)
		if r != "." && (dir == r || strings.HasPrefix(dir, r+string(filepath.Separator))) && len(r) > len(best) {
			best = r
		}
	}
	if best != "" {
		rel, _ := filepath.Rel(best, dir)
		if rel == "." {
			return ""
		}
		return rel
	}
	parts := strings.FieldsFunc(dir, func(r rune) bool { return r == '/' || r == '\\' })
	if len(parts) > 3 {
		parts = parts[len(parts)-3:]
	}
	return strings.Join(parts, "/")
}

// Reason explains why a file is not a library title ("" = it is one).
// roots are the library folders (see relDir). size is the file size in
// bytes (negative if unknown: the size rule is skipped). open is only used
// for .ts-family files and may be nil (the content check is then skipped).
func Reason(roots []string, path string, size int64, open func(string) (io.ReadCloser, error)) string {
	ext := strings.ToLower(filepath.Ext(path))
	if !containers[ext] {
		return "not a video container"
	}
	dir := relDir(path, roots)
	for _, part := range strings.FieldsFunc(dir, func(r rune) bool { return r == '/' || r == '\\' }) {
		p := strings.ToLower(part)
		if strings.HasPrefix(p, ".") || strings.HasPrefix(p, "$") {
			return "hidden or system folder"
		}
		if skipDirs[p] {
			return "in " + part + " folder"
		}
	}
	name := strings.TrimSuffix(filepath.Base(path), filepath.Ext(path))
	if strings.HasPrefix(strings.ToLower(name), "preview_") {
		return "HomeFlix preview clip"
	}
	if junkName.MatchString(name) {
		return "sample or trailer"
	}
	if size >= 0 && size < MinBytes {
		return "too small for a movie or episode"
	}
	if transport[ext] && open != nil {
		if ok, known := isTransportStream(path, open); known && !ok {
			return "not a video (." + strings.TrimPrefix(ext, ".") + " source file)"
		}
	}
	return ""
}

// IsLibraryVideo reports whether the file at path is a movie or episode.
func IsLibraryVideo(roots []string, path string, size int64) bool {
	return Reason(roots, path, size, openFile) == ""
}

func openFile(p string) (io.ReadCloser, error) { return os.Open(p) }

// OpenFile is the default opener for Reason.
var OpenFile = openFile

// isTransportStream checks for MPEG-TS sync bytes (0x47 every 188 bytes, or
// every 192 bytes after a 4-byte header for M2TS). known is false when the
// file can't be read (e.g. a drive is unplugged): the caller keeps it.
func isTransportStream(path string, open func(string) (io.ReadCloser, error)) (ok, known bool) {
	f, err := open(path)
	if err != nil {
		return false, false
	}
	defer f.Close()
	buf := make([]byte, 600)
	n, _ := io.ReadFull(f, buf)
	buf = buf[:n]
	if n < 200 {
		return false, true
	}
	if bytes.HasPrefix(buf, []byte{0x47}) && buf[188] == 0x47 && (n < 377 || buf[376] == 0x47) {
		return true, true
	}
	if n >= 197 && buf[4] == 0x47 && buf[196] == 0x47 {
		return true, true
	}
	return false, true
}
