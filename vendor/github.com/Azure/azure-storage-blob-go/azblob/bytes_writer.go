package azblob

import (
	"errors"
)

type bytesWriter []byte

func newBytesWriter(b []byte) bytesWriter {
	return b
}

func (c bytesWriter) WriteAt(b []byte, off int64) (int, error) {
	if off >= int64(len(c)) || off < 0 {
		return 0, errors.New("Offset value is out of range")
	}

	n := copy(c[int(off):], b)
	if n < len(b) {
		return n, errors.New("Not enough space for all bytes")
	}

	return n, nil
}
