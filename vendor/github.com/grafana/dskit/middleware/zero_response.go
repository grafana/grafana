package middleware

import (
	"errors"
	"net"
	"os"
	"regexp"
	"strconv"
	"sync"

	"github.com/go-kit/log"
	"go.uber.org/atomic"
)

// NewZeroResponseListener returns a Listener that logs all connections that encountered io timeout on reads, and were closed before sending any response.
func NewZeroResponseListener(list net.Listener, log log.Logger) net.Listener {
	return &zeroResponseListener{
		Listener: list,
		log:      log,
		bufPool: sync.Pool{
			New: func() interface{} { return &bufHolder{buf: make([]byte, 0, requestBufSize)} },
		},
	}
}

// Wrap a slice in a struct, so we can store a pointer in sync.Pool
type bufHolder struct {
	buf []byte
}

// Size of buffer for read data. We log this eventually.
const requestBufSize = 512

type zeroResponseListener struct {
	net.Listener
	log     log.Logger
	bufPool sync.Pool // pool of &bufHolder.
}

func (zl *zeroResponseListener) Accept() (net.Conn, error) {
	conn, err := zl.Listener.Accept()
	if err != nil {
		return nil, err
	}
	bh := zl.bufPool.Get().(*bufHolder)
	bh.buf = bh.buf[:0]
	return &zeroResponseConn{Conn: conn, log: zl.log, bufHolder: bh, returnPool: &zl.bufPool}, nil
}

type zeroResponseConn struct {
	net.Conn

	log        log.Logger
	once       sync.Once
	returnPool *sync.Pool

	bufHolderMux sync.Mutex
	bufHolder    *bufHolder // Buffer with first requestBufSize bytes from connection. Set to nil as soon as data is written to the connection.

	lastReadErrIsDeadlineExceeded atomic.Bool
}

func (zc *zeroResponseConn) Read(b []byte) (n int, err error) {
	n, err = zc.Conn.Read(b)
	if err != nil && errors.Is(err, os.ErrDeadlineExceeded) {
		zc.lastReadErrIsDeadlineExceeded.Store(true)
	} else {
		zc.lastReadErrIsDeadlineExceeded.Store(false)
	}

	// Store first requestBufSize read bytes on connection into the buffer for logging.
	if n > 0 {
		zc.bufHolderMux.Lock()
		defer zc.bufHolderMux.Unlock()

		if zc.bufHolder != nil {
			rem := requestBufSize - len(zc.bufHolder.buf) // how much space is in our buffer.
			if rem > n {
				rem = n
			}
			if rem > 0 {
				zc.bufHolder.buf = append(zc.bufHolder.buf, b[:rem]...)
			}
		}
	}
	return
}

func (zc *zeroResponseConn) Write(b []byte) (n int, err error) {
	n, err = zc.Conn.Write(b)
	if n > 0 {
		zc.bufHolderMux.Lock()
		if zc.bufHolder != nil {
			zc.returnPool.Put(zc.bufHolder)
			zc.bufHolder = nil
		}
		zc.bufHolderMux.Unlock()
	}
	return
}

var authRegexp = regexp.MustCompile(`((?i)\r\nauthorization:\s+)(\S+\s+)(\S+)`)

func (zc *zeroResponseConn) Close() error {
	err := zc.Conn.Close()

	zc.once.Do(func() {
		zc.bufHolderMux.Lock()
		defer zc.bufHolderMux.Unlock()

		// If buffer was already returned, it means there was some data written on the connection, nothing to do.
		if zc.bufHolder == nil {
			return
		}

		// If we didn't write anything to this connection, and we've got timeout while reading data, it looks like
		// slow a slow client failing to send a request to us.
		if !zc.lastReadErrIsDeadlineExceeded.Load() {
			return
		}

		b := zc.bufHolder.buf
		b = authRegexp.ReplaceAll(b, []byte("${1}${2}***")) // Replace value in Authorization header with ***.

		_ = zc.log.Log("msg", "read timeout, connection closed with no response", "read", strconv.Quote(string(b)), "remote", zc.RemoteAddr().String())

		zc.returnPool.Put(zc.bufHolder)
		zc.bufHolder = nil
	})

	return err
}
