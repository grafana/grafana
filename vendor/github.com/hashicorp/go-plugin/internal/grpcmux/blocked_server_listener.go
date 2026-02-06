// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package grpcmux

import (
	"io"
	"net"
)

var _ net.Listener = (*blockedServerListener)(nil)

// blockedServerListener accepts connections for a specific gRPC broker stream
// ID on the server (plugin) side of the connection.
type blockedServerListener struct {
	addr     net.Addr
	acceptCh chan acceptResult
	doneCh   <-chan struct{}
}

type acceptResult struct {
	conn net.Conn
	err  error
}

func newBlockedServerListener(addr net.Addr, doneCh <-chan struct{}) *blockedServerListener {
	return &blockedServerListener{
		addr:     addr,
		acceptCh: make(chan acceptResult),
		doneCh:   doneCh,
	}
}

func (b *blockedServerListener) Accept() (net.Conn, error) {
	select {
	case accept := <-b.acceptCh:
		return accept.conn, accept.err
	case <-b.doneCh:
		return nil, io.EOF
	}
}

func (b *blockedServerListener) Addr() net.Addr {
	return b.addr
}

func (b *blockedServerListener) Close() error {
	return nil
}
