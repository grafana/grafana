package websocket

import (
	"io"
	"net"
	"net/http"
	"time"
)

var (
	_ net.Conn = (*http2Stream)(nil)
)

// http2Stream is a wrapper for HTTP/2 extended CONNECT tunnel.
type http2Stream struct {
	io.ReadCloser
	io.Writer
	rc *http.ResponseController
}

func (s *http2Stream) Read(p []byte) (int, error) {
	return s.ReadCloser.Read(p)
}

func (s *http2Stream) Write(p []byte) (int, error) {
	n, err := s.Writer.Write(p)
	if err != nil {
		return n, err
	}
	err = s.rc.Flush()
	return n, err
}

func (s *http2Stream) Flush() error {
	return s.rc.Flush()
}

func (s *http2Stream) Close() error {
	return s.ReadCloser.Close()
}

// LocalAddr is not implemented for HTTP/2 streams.
// May be taken from request if needed.
func (s *http2Stream) LocalAddr() net.Addr {
	return &net.TCPAddr{}
}

// RemoteAddr is not implemented for HTTP/2 streams.
// May be taken from request if needed.
func (s *http2Stream) RemoteAddr() net.Addr {
	return &net.TCPAddr{}
}

// SetDeadline ...
func (s *http2Stream) SetDeadline(t time.Time) error {
	if err := s.rc.SetWriteDeadline(t); err != nil {
		return err
	}
	return s.rc.SetReadDeadline(t)
}

// SetReadDeadline ...
func (s *http2Stream) SetReadDeadline(t time.Time) error {
	return s.rc.SetReadDeadline(t)
}

// SetWriteDeadline ...
func (s *http2Stream) SetWriteDeadline(t time.Time) error {
	return s.rc.SetWriteDeadline(t)
}
