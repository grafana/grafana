package file

import (
	"bytes"
	"io"
	"os"
	"strings"
)

type Reader struct {
	offset    int64
	reader    io.Reader
	headBytes *bytes.Reader
	headLen   int64
}

func NewReader(r io.Reader, headLen int) (*Reader, error) {
	fileHead := make([]byte, headLen)
	n, err := r.Read(fileHead)
	if err != nil && err != io.EOF {
		return nil, err
	}

	headBytes := bytes.NewReader(fileHead[:n])

	return &Reader{
		offset:    0,
		reader:    r,
		headBytes: headBytes,
		headLen:   int64(n),
	}, nil
}

func (r *Reader) Read(p []byte) (n int, err error) {
	if r.headLen <= r.offset {
		n, err = r.reader.Read(p)
		if err == nil || err == io.EOF {
			r.offset = r.offset + int64(n)
		}
		return
	}

	readLen := len(p)
	_, err = r.headBytes.Seek(r.offset, io.SeekStart)
	if err != nil {
		return
	}

	n, err = r.headBytes.Read(p)
	if err != nil {
		return
	}

	delta := readLen - n
	if delta == 0 {
		r.offset = r.offset + int64(n)
		return
	}

	b := make([]byte, delta)
	n2, err := r.reader.Read(b)
	if err == nil || err == io.EOF {
		for i := 0; i < n2; i++ {
			p[n+i] = b[i]
		}
	}
	n = n + n2
	r.offset = r.offset + int64(n)
	return
}

func (r *Reader) HeadBytes() (io.ReadSeeker, error) {
	_, err := r.headBytes.Seek(0, io.SeekStart)
	if err != nil {
		return nil, err
	}

	fileHead := make([]byte, r.headLen)
	_, err = r.headBytes.Read(fileHead)
	if err != nil && err != io.EOF {
		return nil, err
	}

	return bytes.NewReader(fileHead), nil
}

func (r *Reader) Size() int64 {
	switch s := r.reader.(type) {
	case *os.File:
		if fi, err := s.Stat(); err == nil {
			return fi.Size()
		}
	case *strings.Reader:
		return s.Size()
	case *bytes.Reader:
		return s.Size()
	}
	return 0
}
