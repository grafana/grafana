//go:build !linux
// +build !linux

package vsock

import (
	"fmt"
	"net"
	"os"
	"runtime"
	"syscall"
	"time"
)

// errUnimplemented is returned by all functions on platforms that
// cannot make use of VM sockets.
var errUnimplemented = fmt.Errorf("vsock: not implemented on %s", runtime.GOOS)

func fileListener(_ *os.File) (*Listener, error)       { return nil, errUnimplemented }
func listen(_, _ uint32, _ *Config) (*Listener, error) { return nil, errUnimplemented }

type listener struct{}

func (*listener) Accept() (net.Conn, error)     { return nil, errUnimplemented }
func (*listener) Addr() net.Addr                { return nil }
func (*listener) Close() error                  { return errUnimplemented }
func (*listener) SetDeadline(_ time.Time) error { return errUnimplemented }

func dial(_, _ uint32, _ *Config) (*Conn, error) { return nil, errUnimplemented }

type conn struct{}

func (*conn) Close() error                          { return errUnimplemented }
func (*conn) CloseRead() error                      { return errUnimplemented }
func (*conn) CloseWrite() error                     { return errUnimplemented }
func (*conn) Read(_ []byte) (int, error)            { return 0, errUnimplemented }
func (*conn) Write(_ []byte) (int, error)           { return 0, errUnimplemented }
func (*conn) SetDeadline(_ time.Time) error         { return errUnimplemented }
func (*conn) SetReadDeadline(_ time.Time) error     { return errUnimplemented }
func (*conn) SetWriteDeadline(_ time.Time) error    { return errUnimplemented }
func (*conn) SyscallConn() (syscall.RawConn, error) { return nil, errUnimplemented }

func contextID() (uint32, error) { return 0, errUnimplemented }

func isErrno(_ error, _ int) bool { return false }
