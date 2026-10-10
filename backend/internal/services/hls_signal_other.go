//go:build !unix

package services

import (
	"errors"
	"os"
)

var errNoThrottle = errors.New("encoder throttling not supported on this OS")

func pauseProcess(*os.Process) error  { return errNoThrottle }
func resumeProcess(*os.Process) error { return errNoThrottle }
