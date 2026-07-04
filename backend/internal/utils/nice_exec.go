package utils

import (
	"os/exec"
)

// NiceCommand builds an exec.Cmd that runs at idle CPU and I/O priority.
// Used for all background media work (scanning, thumbnails, previews) so it
// never steals HDD throughput or CPU from active playback. ionice/nice exec
// the target binary in-place, so the returned Cmd's PID is ffmpeg itself and
// Kill/Wait behave normally.
func NiceCommand(name string, args ...string) *exec.Cmd {
	full := append([]string{"-c", "3", "nice", "-n", "19", name}, args...)
	return exec.Command("ionice", full...)
}
