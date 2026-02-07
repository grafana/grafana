package saml

import (
	"compress/flate"
	"fmt"
	"io"
)

const flateUncompressLimit = 10 * 1024 * 1024 // 10MB

func newSaferFlateReader(r io.Reader) io.ReadCloser {
	return &saferFlateReader{r: flate.NewReader(r)}
}

type saferFlateReader struct {
	r     io.ReadCloser
	count int
}

func (r *saferFlateReader) Read(p []byte) (n int, err error) {
	if r.count+len(p) > flateUncompressLimit {
		return 0, fmt.Errorf("flate: uncompress limit exceeded (%d bytes)", flateUncompressLimit)
	}
	n, err = r.r.Read(p)
	r.count += n
	return n, err
}

func (r *saferFlateReader) Close() error {
	return r.r.Close()
}
