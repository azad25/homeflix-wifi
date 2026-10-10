//go:build unix

package services

import (
	"os"
	"syscall"
)

// pauseProcess/resumeProcess throttle an encoder without losing its state.
func pauseProcess(p *os.Process) error  { return p.Signal(syscall.SIGSTOP) }
func resumeProcess(p *os.Process) error { return p.Signal(syscall.SIGCONT) }
