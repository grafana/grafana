package bytes

import (
	"bytes"
)

// ---------------------------------------------------

func ReplaceAt(b []byte, off, nsrc int, dest []byte) []byte {

	ndelta := len(dest) - nsrc
	if ndelta < 0 {
		left := b[off+nsrc:]
		off += copy(b[off:], dest)
		off += copy(b[off:], left)
		return b[:off]
	}

	if ndelta > 0 {
		b = append(b, dest[:ndelta]...)
		copy(b[off+len(dest):], b[off+nsrc:])
		copy(b[off:], dest)
	} else {
		copy(b[off:], dest)
	}
	return b
}

func ReplaceOne(b []byte, from int, src, dest []byte) ([]byte, int) {

	pos := bytes.Index(b[from:], src)
	if pos < 0 {
		return b, -1
	}

	from += pos
	return ReplaceAt(b, from, len(src), dest), from + len(dest)
}

func Replace(b []byte, src, dest []byte, n int) []byte {

	from := 0
	for n != 0 {
		b, from = ReplaceOne(b, from, src, dest)
		if from < 0 {
			break
		}
		n--
	}
	return b
}

// ---------------------------------------------------

