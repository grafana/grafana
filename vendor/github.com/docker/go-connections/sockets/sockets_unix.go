//go:build !windows

package sockets

import (
	"net"
	"net/http"
	"syscall"
	"time"
)

func configureNpipeTransport(tr *http.Transport, proto, addr string) error {
	return ErrProtocolNotAvailable
}

func dialPipe(_ string, _ time.Duration) (net.Conn, error) {
	return nil, syscall.EAFNOSUPPORT
}
