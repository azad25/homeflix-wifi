package handlers

import (
	"io"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
)

// sendfileWriter restores the io.ReaderFrom that gin's ResponseWriter hides.
// net/http's response implements ReadFrom with sendfile(2), but
// http.ServeContent and c.File only use it if the writer they get exposes
// it - through gin they fall back to copying every byte through a 32KB
// userspace buffer. With this wrapper file bytes go disk -> socket in the
// kernel, which is what keeps a 4K remux from costing CPU.
type sendfileWriter struct {
	gin.ResponseWriter
}

func (w sendfileWriter) ReadFrom(r io.Reader) (int64, error) {
	// Commit the status gin is holding before bypassing it
	w.ResponseWriter.WriteHeaderNow()
	if u, ok := w.ResponseWriter.(interface{ Unwrap() http.ResponseWriter }); ok {
		if rf, ok := u.Unwrap().(io.ReaderFrom); ok {
			return rf.ReadFrom(r)
		}
	}
	return io.Copy(w.ResponseWriter, r)
}

// prepareLongStream removes the server-wide write deadline for this one
// response. A browser plays a progressive file over a single long GET it
// reads at playback speed, so any fixed WriteTimeout cuts the movie off
// mid-play. Dead peers are still reaped by TCP keepalive.
func prepareLongStream(c *gin.Context) {
	_ = http.NewResponseController(c.Writer).SetWriteDeadline(time.Time{})
}

// serveMediaFile serves a file with Range/HEAD/conditional support via
// sendfile.
func serveMediaFile(c *gin.Context, path string) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()
	st, err := f.Stat()
	if err != nil {
		return err
	}
	http.ServeContent(sendfileWriter{c.Writer}, c.Request, st.Name(), st.ModTime(), f)
	return nil
}
