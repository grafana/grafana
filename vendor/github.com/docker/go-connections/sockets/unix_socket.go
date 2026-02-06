/*
Package sockets is a simple unix domain socket wrapper.

# Usage

For example:

	import(
		"fmt"
		"net"
		"os"
		"github.com/docker/go-connections/sockets"
	)

	func main() {
		l, err := sockets.NewUnixSocketWithOpts("/path/to/sockets",
			sockets.WithChown(0,0),sockets.WithChmod(0660))
		if err != nil {
			panic(err)
		}
		echoStr := "hello"

		go func() {
			for {
				conn, err := l.Accept()
				if err != nil {
					return
				}
				conn.Write([]byte(echoStr))
				conn.Close()
			}
		}()

		conn, err := net.Dial("unix", path)
		if err != nil {
			t.Fatal(err)
		}

		buf := make([]byte, 5)
		if _, err := conn.Read(buf); err != nil {
			panic(err)
		} else if string(buf) != echoStr {
			panic(fmt.Errorf("msg may lost"))
		}
	}
*/
package sockets

import (
	"net"
	"os"
	"syscall"
)

// SockOption sets up socket file's creating option
type SockOption func(string) error

// NewUnixSocketWithOpts creates a unix socket with the specified options.
// By default, socket permissions are 0000 (i.e.: no access for anyone); pass
// WithChmod() and WithChown() to set the desired ownership and permissions.
//
// This function temporarily changes the system's "umask" to 0777 to work around
// a race condition between creating the socket and setting its permissions. While
// this should only be for a short duration, it may affect other processes that
// create files/directories during that period.
func NewUnixSocketWithOpts(path string, opts ...SockOption) (net.Listener, error) {
	if err := syscall.Unlink(path); err != nil && !os.IsNotExist(err) {
		return nil, err
	}

	l, err := listenUnix(path)
	if err != nil {
		return nil, err
	}

	for _, op := range opts {
		if err := op(path); err != nil {
			_ = l.Close()
			return nil, err
		}
	}

	return l, nil
}
