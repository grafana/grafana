package http

import (
	"crypto/md5"
	"encoding/base64"
	"fmt"
	"io"
)

// computeMD5Checksum computes base64 md5 checksum of an io.Reader's contents.
// Returns the byte slice of md5 checksum and an error.
func computeMD5Checksum(r io.Reader) ([]byte, error) {
	h := md5.New()
	// copy errors may be assumed to be from the body.
	_, err := io.Copy(h, r)
	if err != nil {
		return nil, fmt.Errorf("failed to read body: %w", err)
	}

	// encode the md5 checksum in base64.
	sum := h.Sum(nil)
	sum64 := make([]byte, base64.StdEncoding.EncodedLen(len(sum)))
	base64.StdEncoding.Encode(sum64, sum)
	return sum64, nil
}
