package mediafiles

import (
	"bytes"
	"io"
	"testing"
)

const big = 2 << 30

func opener(content []byte) func(string) (io.ReadCloser, error) {
	return func(string) (io.ReadCloser, error) { return io.NopCloser(bytes.NewReader(content)), nil }
}

func tsPackets() []byte {
	b := make([]byte, 188*4)
	for i := 0; i < 4; i++ {
		b[i*188] = 0x47
	}
	return b
}

func TestReason(t *testing.T) {
	roots := []string{"/mnt/media", "/home/me/.hidden-lib"}
	keep := []string{
		"/mnt/media/Movies/Heat (1995)/Heat.1995.1080p.BluRay.mkv",
		"/mnt/media/TV/Dark/Season 1/Dark.S01E01.mkv",
		"/home/me/.hidden-lib/Arrival.2016.mp4", // hidden root itself is fine
		"/mnt/media/Movies/Sampled Lives (2019).mkv",  // "sample" inside a word
		"/mnt/media/Movies/The.Trailer.Park.Boys.2006.mkv", // "Trailer" not a suffix tag? kept below via size
	}
	for _, p := range keep[:4] {
		if r := Reason(roots, p, big, nil); r != "" {
			t.Errorf("kept file rejected: %s (%s)", p, r)
		}
	}
	reject := []string{
		"/mnt/media/Projects/web/node_modules/lib/index.ts",
		"/mnt/media/code/app/src/main.ts",   // TypeScript, checked by content
		"/mnt/media/Movies/Heat/Featurettes/Making of.mkv",
		"/mnt/media/Movies/Heat/heat-sample.mkv",
		"/mnt/media/Movies/Heat/Heat Trailer.mp4",
		"/mnt/media/Movies/.git/objects/x.mp4",
		"/mnt/media/DVD/VIDEO_TS/VTS_01_1.VOB",
		"/mnt/media/Movies/notes.txt",
		"/mnt/media/previews/preview_12_Heat.mp4",
		"/mnt/media/$RECYCLE.BIN/x.mkv",
	}
	src := opener([]byte("export const answer = 42;\n" + string(make([]byte, 400))))
	for _, p := range reject {
		if r := Reason(roots, p, big, src); r == "" {
			t.Errorf("junk accepted: %s", p)
		}
	}
	if Reason(roots, "/mnt/media/Movies/clip.mp4", 5<<20, nil) == "" {
		t.Error("5 MB clip accepted")
	}
	if r := Reason(roots, "/mnt/media/TV/Show/S01/ep.ts", big, opener(tsPackets())); r != "" {
		t.Errorf("real MPEG-TS rejected: %s", r)
	}
	// Unreadable (drive unplugged): keep rather than guess.
	unreadable := func(string) (io.ReadCloser, error) { return nil, io.ErrUnexpectedEOF }
	if r := Reason(roots, "/mnt/media/TV/Show/S01/ep.ts", big, unreadable); r != "" {
		t.Errorf("unreadable .ts rejected: %s", r)
	}
	// A folder named like a skip folder ABOVE the library root doesn't count.
	if r := Reason([]string{"/srv/previews/library"}, "/srv/previews/library/Heat.mkv", big, nil); r != "" {
		t.Errorf("root above library judged: %s", r)
	}
}
