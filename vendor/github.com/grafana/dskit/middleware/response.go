// Provenance-includes-location: https://github.com/weaveworks/common/blob/main/middleware/response.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: Weaveworks Ltd.

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

type badResponseLoggingWriter interface {
	http.ResponseWriter
	getStatusCode() int
	getWriteError() error
}

// nonFlushingBadResponseLoggingWriter writes the body of "bad" responses (i.e. 5xx
// responses) to a buffer.
type nonFlushingBadResponseLoggingWriter struct {
	rw            http.ResponseWriter
	buffer        io.Writer
	logBody       bool
	bodyBytesLeft int
	statusCode    int
	writeError    error // The error returned when downstream Write() fails.
}

// flushingBadResponseLoggingWriter is a badResponseLoggingWriter that
// implements http.Flusher.
type flushingBadResponseLoggingWriter struct {
	nonFlushingBadResponseLoggingWriter
	f http.Flusher
}

func newBadResponseLoggingWriter(rw http.ResponseWriter, buffer io.Writer) badResponseLoggingWriter {
	b := nonFlushingBadResponseLoggingWriter{
		rw:            rw,
		buffer:        buffer,
		logBody:       false,
		bodyBytesLeft: maxResponseBodyInLogs,
		statusCode:    http.StatusOK,
	}

	if f, ok := rw.(http.Flusher); ok {
		return &flushingBadResponseLoggingWriter{b, f}
	}

	return &b
}

// Unwrap method is used by http.ResponseController to get access to original http.ResponseWriter.
func (b *nonFlushingBadResponseLoggingWriter) Unwrap() http.ResponseWriter {
	return b.rw
}

// Header returns the header map that will be sent by WriteHeader.
// Implements ResponseWriter.
func (b *nonFlushingBadResponseLoggingWriter) Header() http.Header {
	return b.rw.Header()
}

// Write writes HTTP response data.
func (b *nonFlushingBadResponseLoggingWriter) Write(data []byte) (int, error) {
	if b.statusCode == 0 {
		// WriteHeader has (probably) not been called, so we need to call it with StatusOK to fulfill the interface contract.
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
func (b *nonFlushingBadResponseLoggingWriter) WriteHeader(statusCode int) {
	b.statusCode = statusCode
	if statusCode >= 500 {
		b.logBody = true
	}
	b.rw.WriteHeader(statusCode)
}

// Hijack hijacks the first response writer that is a Hijacker.
func (b *nonFlushingBadResponseLoggingWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	hj, ok := b.rw.(http.Hijacker)
	if ok {
		return hj.Hijack()
	}
	return nil, nil, fmt.Errorf("badResponseLoggingWriter: can't cast underlying response writer to Hijacker")
}

func (b *nonFlushingBadResponseLoggingWriter) getStatusCode() int {
	return b.statusCode
}

func (b *nonFlushingBadResponseLoggingWriter) getWriteError() error {
	return b.writeError
}

func (b *nonFlushingBadResponseLoggingWriter) captureResponseBody(data []byte) {
	if len(data) > b.bodyBytesLeft {
		_, _ = b.buffer.Write(data[:b.bodyBytesLeft])
		_, _ = io.WriteString(b.buffer, "...")
		b.bodyBytesLeft = 0
		b.logBody = false
	} else {
		_, _ = b.buffer.Write(data)
		b.bodyBytesLeft -= len(data)
	}
}

func (b *flushingBadResponseLoggingWriter) Flush() {
	b.f.Flush()
}
