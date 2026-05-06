package azblob

import (
	"errors"
	"io"
)

type sectionWriter struct {
	count    int64
	offset   int64
	position int64
	writerAt io.WriterAt
}

func newSectionWriter(c io.WriterAt, off int64, count int64) *sectionWriter {
	return &sectionWriter{
		count:    count,
		offset:   off,
		writerAt: c,
	}
}

func (c *sectionWriter) Write(p []byte) (int, error) {
	remaining := c.count - c.position

	if remaining <= 0 {
		return 0, errors.New("End of section reached")
	}

	slice := p

	if int64(len(slice)) > remaining {
		slice = slice[:remaining]
	}

	n, err := c.writerAt.WriteAt(slice, c.offset+c.position)
	c.position += int64(n)
	if err != nil {
		return n, err
	}

	if len(p) > n {
		return n, errors.New("Not enough space for all bytes")
	}

	return n, nil
}
