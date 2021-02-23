package middleware

import (
	"bufio"
	"fmt"
	"io"
	"net"
	"net/http"
)

const (
	maxResponseBodyInLogs = 4096 // At most 4k bytes from response bodies in our logs.
)

// badResponseLoggingWriter writes the body of "bad" responses (i.e. 5xx
// responses) to a buffer.
type badResponseLoggingWriter struct {
	rw            http.ResponseWriter
	buffer        io.Writer
	logBody       bool
	bodyBytesLeft int
	statusCode    int
	writeError    error // The error returned when downstream Write() fails.
}

// newBadResponseLoggingWriter makes a new badResponseLoggingWriter.
func newBadResponseLoggingWriter(rw http.ResponseWriter, buffer io.Writer) *badResponseLoggingWriter {
	return &badResponseLoggingWriter{
		rw:            rw,
		buffer:        buffer,
		logBody:       false,
		bodyBytesLeft: maxResponseBodyInLogs,
		statusCode:    http.StatusOK,
	}
}

// Header returns the header map that will be sent by WriteHeader.
// Implements ResponseWriter.
func (b *badResponseLoggingWriter) Header() http.Header {
	return b.rw.Header()
}

// Write writes HTTP response data.
func (b *badResponseLoggingWriter) Write(data []byte) (int, error) {
	if b.statusCode == 0 {
		// WriteHeader has (probably) not been called, so we need to call it with StatusOK to fuflil the interface contract.
		// https://godoc.org/net/http#ResponseWriter
		b.WriteHeader(http.StatusOK)
	}
	n, err := b.rw.Write(data)
	if b.logBody {
		b.captureResponseBody(data)
	}
	if err != nil {
		b.writeError = err
	}
	return n, err
}

// WriteHeader writes the HTTP response header.
func (b *badResponseLoggingWriter) WriteHeader(statusCode int) {
	b.statusCode = statusCode
	if statusCode >= 500 {
		b.logBody = true
	}
	b.rw.WriteHeader(statusCode)
}

// Hijack hijacks the first response writer that is a Hijacker.
func (b *badResponseLoggingWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	hj, ok := b.rw.(http.Hijacker)
	if ok {
		return hj.Hijack()
	}
	return nil, nil, fmt.Errorf("badResponseLoggingWriter: can't cast underlying response writer to Hijacker")
}

func (b *badResponseLoggingWriter) captureResponseBody(data []byte) {
	if len(data) > b.bodyBytesLeft {
		b.buffer.Write(data[:b.bodyBytesLeft])
		io.WriteString(b.buffer, "...")
		b.bodyBytesLeft = 0
		b.logBody = false
	} else {
		b.buffer.Write(data)
		b.bodyBytesLeft -= len(data)
	}
}
