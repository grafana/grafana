package vsock

import (
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"strings"
	"syscall"
	"time"
)

const (
	// Hypervisor specifies that a socket should communicate with the hypervisor
	// process. Note that this is _not_ the same as a socket owned by a process
	// running on the hypervisor. Most users should probably use Host instead.
	Hypervisor = 0x0

	// Local specifies that a socket should communicate with a matching socket
	// on the same machine. This provides an alternative to UNIX sockets or
	// similar and may be useful in testing VM sockets applications.
	Local = 0x1

	// Host specifies that a socket should communicate with processes other than
	// the hypervisor on the host machine. This is the correct choice to
	// communicate with a process running on a hypervisor using a socket dialed
	// from a guest.
	Host = 0x2

	// Error numbers we recognize, copied here to avoid importing x/sys/unix in
	// cross-platform code.
	ebadf    = 9
	enotconn = 107

	// devVsock is the location of /dev/vsock.  It is exposed on both the
	// hypervisor and on virtual machines.
	devVsock = "/dev/vsock"

	// network is the vsock network reported in net.OpError.
	network = "vsock"

	// Operation names which may be returned in net.OpError.
	opAccept      = "accept"
	opClose       = "close"
	opDial        = "dial"
	opListen      = "listen"
	opRawControl  = "raw-control"
	opRawRead     = "raw-read"
	opRawWrite    = "raw-write"
	opRead        = "read"
	opSet         = "set"
	opSyscallConn = "syscall-conn"
	opWrite       = "write"
)

// TODO(mdlayher): plumb through socket.Config.NetNS if it makes sense.

// Config contains options for a Conn or Listener.
type Config struct{}

// Listen opens a connection-oriented net.Listener for incoming VM sockets
// connections. The port parameter specifies the port for the Listener. Config
// specifies optional configuration for the Listener. If config is nil, a
// default configuration will be used.
//
// To allow the server to assign a port automatically, specify 0 for port. The
// address of the server can be retrieved using the Addr method.
//
// Listen automatically infers the appropriate context ID for this machine by
// calling ContextID and passing that value to ListenContextID. Callers with
// advanced use cases (such as using the Local context ID) may wish to use
// ListenContextID directly.
//
// When the Listener is no longer needed, Close must be called to free
// resources.
func Listen(port uint32, cfg *Config) (*Listener, error) {
	cid, err := ContextID()
	if err != nil {
		// No addresses available.
		return nil, opError(opListen, err, nil, nil)
	}

	return ListenContextID(cid, port, cfg)
}

// ListenContextID is the same as Listen, but also accepts an explicit context
// ID parameter. This function is intended for advanced use cases and most
// callers should use Listen instead.
//
// See the documentation of Listen for more details.
func ListenContextID(contextID, port uint32, cfg *Config) (*Listener, error) {
	l, err := listen(contextID, port, cfg)
	if err != nil {
		// No remote address available.
		return nil, opError(opListen, err, &Addr{
			ContextID: contextID,
			Port:      port,
		}, nil)
	}

	return l, nil
}

// FileListener returns a copy of the network listener corresponding to an open
// os.File. It is the caller's responsibility to close the Listener when
// finished. Closing the Listener does not affect the os.File, and closing the
// os.File does not affect the Listener.
//
// This function is intended for advanced use cases and most callers should use
// Listen instead.
func FileListener(f *os.File) (*Listener, error) {
	l, err := fileListener(f)
	if err != nil {
		// No addresses available.
		return nil, opError(opListen, err, nil, nil)
	}

	return l, nil
}

var _ net.Listener = &Listener{}

// A Listener is a VM sockets implementation of a net.Listener.
type Listener struct {
	l *listener
}

// Accept implements the Accept method in the net.Listener interface; it waits
// for the next call and returns a generic net.Conn. The returned net.Conn will
// always be of type *Conn.
func (l *Listener) Accept() (net.Conn, error) {
	c, err := l.l.Accept()
	if err != nil {
		return nil, l.opError(opAccept, err)
	}

	return c, nil
}

// Addr returns the listener's network address, a *Addr. The Addr returned is
// shared by all invocations of Addr, so do not modify it.
func (l *Listener) Addr() net.Addr { return l.l.Addr() }

// Close stops listening on the VM sockets address. Already Accepted connections
// are not closed.
func (l *Listener) Close() error {
	return l.opError(opClose, l.l.Close())
}

// SetDeadline sets the deadline associated with the listener. A zero time value
// disables the deadline.
func (l *Listener) SetDeadline(t time.Time) error {
	return l.opError(opSet, l.l.SetDeadline(t))
}

// opError is a convenience for the function opError that also passes the local
// address of the Listener.
func (l *Listener) opError(op string, err error) error {
	// No remote address for a Listener.
	return opError(op, err, l.Addr(), nil)
}

// Dial dials a connection-oriented net.Conn to a VM sockets listener. The
// context ID and port parameters specify the address of the listener. Config
// specifies optional configuration for the Conn. If config is nil, a default
// configuration will be used.
//
// If dialing a connection from the hypervisor to a virtual machine, the VM's
// context ID should be specified.
//
// If dialing from a VM to the hypervisor, Hypervisor should be used to
// communicate with the hypervisor process, or Host should be used to
// communicate with other processes on the host machine.
//
// When the connection is no longer needed, Close must be called to free
// resources.
func Dial(contextID, port uint32, cfg *Config) (*Conn, error) {
	c, err := dial(contextID, port, cfg)
	if err != nil {
		// No local address, but we have a remote address we can return.
		return nil, opError(opDial, err, nil, &Addr{
			ContextID: contextID,
			Port:      port,
		})
	}

	return c, nil
}

var (
	_ net.Conn     = &Conn{}
	_ syscall.Conn = &Conn{}
)

// A Conn is a VM sockets implementation of a net.Conn.
type Conn struct {
	c      *conn
	local  *Addr
	remote *Addr
}

// Close closes the connection.
func (c *Conn) Close() error {
	return c.opError(opClose, c.c.Close())
}

// CloseRead shuts down the reading side of the VM sockets connection. Most
// callers should just use Close.
func (c *Conn) CloseRead() error {
	return c.opError(opClose, c.c.CloseRead())
}

// CloseWrite shuts down the writing side of the VM sockets connection. Most
// callers should just use Close.
func (c *Conn) CloseWrite() error {
	return c.opError(opClose, c.c.CloseWrite())
}

// LocalAddr returns the local network address. The Addr returned is shared by
// all invocations of LocalAddr, so do not modify it.
func (c *Conn) LocalAddr() net.Addr { return c.local }

// RemoteAddr returns the remote network address. The Addr returned is shared by
// all invocations of RemoteAddr, so do not modify it.
func (c *Conn) RemoteAddr() net.Addr { return c.remote }

// Read implements the net.Conn Read method.
func (c *Conn) Read(b []byte) (int, error) {
	n, err := c.c.Read(b)
	if err != nil {
		return n, c.opError(opRead, err)
	}

	return n, nil
}

// Write implements the net.Conn Write method.
func (c *Conn) Write(b []byte) (int, error) {
	n, err := c.c.Write(b)
	if err != nil {
		return n, c.opError(opWrite, err)
	}

	return n, nil
}

// SetDeadline implements the net.Conn SetDeadline method.
func (c *Conn) SetDeadline(t time.Time) error {
	return c.opError(opSet, c.c.SetDeadline(t))
}

// SetReadDeadline implements the net.Conn SetReadDeadline method.
func (c *Conn) SetReadDeadline(t time.Time) error {
	return c.opError(opSet, c.c.SetReadDeadline(t))
}

// SetWriteDeadline implements the net.Conn SetWriteDeadline method.
func (c *Conn) SetWriteDeadline(t time.Time) error {
	return c.opError(opSet, c.c.SetWriteDeadline(t))
}

// SyscallConn returns a raw network connection. This implements the
// syscall.Conn interface.
func (c *Conn) SyscallConn() (syscall.RawConn, error) {
	rc, err := c.c.SyscallConn()
	if err != nil {
		return nil, c.opError(opSyscallConn, err)
	}

	return &rawConn{
		rc:     rc,
		local:  c.local,
		remote: c.remote,
	}, nil
}

// opError is a convenience for the function opError that also passes the local
// and remote addresses of the Conn.
func (c *Conn) opError(op string, err error) error {
	return opError(op, err, c.local, c.remote)
}

// TODO(mdlayher): see if we can port smarter net.OpError with local/remote
// address error logic into socket.Conn's SyscallConn type to avoid the need for
// this wrapper.

var _ syscall.RawConn = &rawConn{}

// A rawConn is a syscall.RawConn that wraps an internal syscall.RawConn in order
// to produce net.OpError error values.
type rawConn struct {
	rc            syscall.RawConn
	local, remote *Addr
}

// Control implements the syscall.RawConn Control method.
func (rc *rawConn) Control(fn func(fd uintptr)) error {
	return rc.opError(opRawControl, rc.rc.Control(fn))
}

// Control implements the syscall.RawConn Read method.
func (rc *rawConn) Read(fn func(fd uintptr) (done bool)) error {
	return rc.opError(opRawRead, rc.rc.Read(fn))
}

// Control implements the syscall.RawConn Write method.
func (rc *rawConn) Write(fn func(fd uintptr) (done bool)) error {
	return rc.opError(opRawWrite, rc.rc.Write(fn))
}

// opError is a convenience for the function opError that also passes the local
// and remote addresses of the rawConn.
func (rc *rawConn) opError(op string, err error) error {
	return opError(op, err, rc.local, rc.remote)
}

var _ net.Addr = &Addr{}

// An Addr is the address of a VM sockets endpoint.
type Addr struct {
	ContextID, Port uint32
}

// Network returns the address's network name, "vsock".
func (a *Addr) Network() string { return network }

// String returns a human-readable representation of Addr, and indicates if
// ContextID is meant to be used for a hypervisor, host, VM, etc.
func (a *Addr) String() string {
	var host string

	switch a.ContextID {
	case Hypervisor:
		host = fmt.Sprintf("hypervisor(%d)", a.ContextID)
	case Local:
		host = fmt.Sprintf("local(%d)", a.ContextID)
	case Host:
		host = fmt.Sprintf("host(%d)", a.ContextID)
	default:
		host = fmt.Sprintf("vm(%d)", a.ContextID)
	}

	return fmt.Sprintf("%s:%d", host, a.Port)
}

// fileName returns a file name for use with os.NewFile for Addr.
func (a *Addr) fileName() string {
	return fmt.Sprintf("%s:%s", a.Network(), a.String())
}

// ContextID retrieves the local VM sockets context ID for this system.
// ContextID can be used to directly determine if a system is capable of using
// VM sockets.
//
// If the kernel module is unavailable, access to the kernel module is denied,
// or VM sockets are unsupported on this system, it returns an error.
func ContextID() (uint32, error) {
	return contextID()
}

// opError unpacks err if possible, producing a net.OpError with the input
// parameters in order to implement net.Conn. As a convenience, opError returns
// nil if the input error is nil.
func opError(op string, err error, local, remote net.Addr) error {
	if err == nil {
		return nil
	}

	// TODO(mdlayher): this entire function is suspect and should probably be
	// looked at carefully, especially with Go 1.13+ error wrapping.
	//
	// Eventually this *net.OpError logic should probably be ported into
	// mdlayher/socket because similar checks are necessary to comply with
	// nettest.TestConn.

	// Unwrap inner errors from error types.
	//
	// TODO(mdlayher): errors.Cause or similar in Go 1.13.
	switch xerr := err.(type) {
	// os.PathError produced by os.File method calls.
	case *os.PathError:
		// Although we could make use of xerr.Op here, we're passing it manually
		// for consistency, since some of the Conn calls we are making don't
		// wrap an os.File, which would return an Op for us.
		//
		// As a special case, if the error is related to access to the /dev/vsock
		// device, we don't unwrap it, so the caller has more context as to why
		// their operation actually failed than "permission denied" or similar.
		if xerr.Path != devVsock {
			err = xerr.Err
		}
	}

	switch {
	case err == io.EOF, isErrno(err, enotconn):
		// We may see a literal io.EOF as happens with x/net/nettest, but
		// "transport not connected" also means io.EOF in Go.
		return io.EOF
	case err == os.ErrClosed, isErrno(err, ebadf), strings.Contains(err.Error(), "use of closed"):
		// Different operations may return different errors that all effectively
		// indicate a closed file.
		//
		// To rectify the differences, net.TCPConn uses an error with this text
		// from internal/poll for the backing file already being closed.
		err = errors.New("use of closed network connection")
	default:
		// Nothing to do, return this directly.
	}

	// Determine source and addr using the rules defined by net.OpError's
	// documentation: https://golang.org/pkg/net/#OpError.
	var source, addr net.Addr
	switch op {
	case opClose, opDial, opRawRead, opRawWrite, opRead, opWrite:
		if local != nil {
			source = local
		}
		if remote != nil {
			addr = remote
		}
	case opAccept, opListen, opRawControl, opSet, opSyscallConn:
		if local != nil {
			addr = local
		}
	}

	return &net.OpError{
		Op:     op,
		Net:    network,
		Source: source,
		Addr:   addr,
		Err:    err,
	}
}
