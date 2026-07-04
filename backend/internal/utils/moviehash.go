package utils

import (
	"encoding/binary"
	"fmt"
	"os"
)

const movieHashChunkSize = 65536 // 64KB

// ComputeMovieHash implements the OpenSubtitles moviehash: file size plus the
// little-endian uint64 sum of the first and last 64KB. Subtitles found by
// this hash were ripped from the exact same release, so they are in sync by
// construction - no fuzzy title matching needed.
func ComputeMovieHash(filePath string) (string, error) {
	f, err := os.Open(filePath)
	if err != nil {
		return "", err
	}
	defer f.Close()

	fi, err := f.Stat()
	if err != nil {
		return "", err
	}
	size := fi.Size()
	if size < movieHashChunkSize {
		return "", fmt.Errorf("file too small for moviehash: %d bytes", size)
	}

	hash := uint64(size)

	sumChunk := func(offset int64) error {
		buf := make([]byte, movieHashChunkSize)
		if _, err := f.ReadAt(buf, offset); err != nil {
			return err
		}
		for i := 0; i < movieHashChunkSize; i += 8 {
			hash += binary.LittleEndian.Uint64(buf[i : i+8])
		}
		return nil
	}

	if err := sumChunk(0); err != nil {
		return "", err
	}
	if err := sumChunk(size - movieHashChunkSize); err != nil {
		return "", err
	}

	return fmt.Sprintf("%016x", hash), nil
}
