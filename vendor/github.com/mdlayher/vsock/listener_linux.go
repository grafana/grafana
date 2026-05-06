//go:build linux
// +build linux

package vsock

import (
	"context"
	"net"
	"os"
	"time"

	"github.com/mdlayher/socket"
	"golang.org/x/sys/unix"
)

var _ net.Listener = &listener{}

// A listener is the net.Listener implementation for connection-oriented
// VM sockets.
type listener struct {
	c    *socket.Conn
	addr *Addr
}

// Addr and Close implement the net.Listener interface for listener.
func (l *listener) Addr() net.Addr                { return l.addr }
func (l *listener) Close() error                  { return l.c.Close() }
func (l *listener) SetDeadline(t time.Time) error { return l.c.SetDeadline(t) }

// Accept accepts a single connection from the listener, and sets up
// a net.Conn backed by conn.
func (l *listener) Accept() (net.Conn, error) {
	c, rsa, err := l.c.Accept(context.Background(), 0)
	if err != nil {
		return nil, err
	}

	savm := rsa.(*unix.SockaddrVM)
	remote := &Addr{
		ContextID: savm.CID,
		Port:      savm.Port,
	}

	return &Conn{
		c:      c,
		local:  l.addr,
		remote: remote,
	}, nil
}

// name is the socket name passed to package socket.
const name = "vsock"

// listen is the entry point for Listen on Linux.
func listen(cid, port uint32, _ *Config) (*Listener, error) {
	// TODO(mdlayher): Config default nil check and initialize. Pass options to
	// socket.Config where necessary.

	c, err := socket.Socket(unix.AF_VSOCK, unix.SOCK_STREAM, 0, name, nil)
	if err != nil {
		return nil, err
	}

	// Be sure to close the Conn if any of the system calls fail before we
	// return the Conn to the caller.

	if port == 0 {
		port = unix.VMADDR_PORT_ANY
	}

	if err := c.Bind(&unix.SockaddrVM{CID: cid, Port: port}); err != nil {
		_ = c.Close()
		return nil, err
	}

	if err := c.Listen(unix.SOMAXCONN); err != nil {
		_ = c.Close()
		return nil, err
	}

	l, err := newListener(c)
	if err != nil {
		_ = c.Close()
		return nil, err
	}

	return l, nil
}

// fileListener is the entry point for FileListener on Linux.
func fileListener(f *os.File) (*Listener, error) {
	c, err := socket.FileConn(f, name)
	if err != nil {
		return nil, err
	}

	l, err := newListener(c)
	if err != nil {
		_ = c.Close()
		return nil, err
	}

	return l, nil
}

// newListener creates a Listener from a raw socket.Conn.
func newListener(c *socket.Conn) (*Listener, error) {
	lsa, err := c.Getsockname()
	if err != nil {
		return nil, err
	}

	// Now that the library can also accept arbitrary os.Files, we have to
	// verify the address family so we don't accidentally create a
	// *vsock.Listener backed by TCP or some other socket type.
	lsavm, ok := lsa.(*unix.SockaddrVM)
	if !ok {
		// All errors should wrapped with os.SyscallError.
		return nil, os.NewSyscallError("listen", unix.EINVAL)
	}

	addr := &Addr{
		ContextID: lsavm.CID,
		Port:      lsavm.Port,
	}

	return &Listener{
		l: &listener{
			c:    c,
			addr: addr,
		},
	}, nil
}
