// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package grpcmux

import (
	"fmt"
	"net"
	"sync"

	"github.com/hashicorp/go-hclog"
	"github.com/hashicorp/yamux"
)

var _ GRPCMuxer = (*GRPCClientMuxer)(nil)

// GRPCClientMuxer implements the client (host) side of the gRPC broker's
// GRPCMuxer interface for multiplexing multiple gRPC broker connections over
// a single net.Conn.
//
// The client dials the initial net.Conn eagerly, and creates a yamux.Session
// as the implementation for multiplexing any additional connections.
//
// Each net.Listener returned from Listener will block until the client receives
// a knock that matches its gRPC broker stream ID. There is no default listener
// on the client, as it is a client for the gRPC broker's control services. (See
// GRPCServerMuxer for more details).
type GRPCClientMuxer struct {
	logger  hclog.Logger
	session *yamux.Session

	acceptMutex     sync.Mutex
	acceptListeners map[uint32]*blockedClientListener
}

func NewGRPCClientMuxer(logger hclog.Logger, addr net.Addr) (*GRPCClientMuxer, error) {
	// Eagerly establish the underlying connection as early as possible.
	logger.Debug("making new client mux initial connection", "addr", addr)
	conn, err := net.Dial(addr.Network(), addr.String())
	if err != nil {
		return nil, err
	}
	if tcpConn, ok := conn.(*net.TCPConn); ok {
		// Make sure to set keep alive so that the connection doesn't die
		_ = tcpConn.SetKeepAlive(true)
	}

	cfg := yamux.DefaultConfig()
	cfg.Logger = logger.Named("yamux").StandardLogger(&hclog.StandardLoggerOptions{
		InferLevels: true,
	})
	cfg.LogOutput = nil
	sess, err := yamux.Client(conn, cfg)
	if err != nil {
		return nil, err
	}

	logger.Debug("client muxer connected", "addr", addr)
	m := &GRPCClientMuxer{
		logger:          logger,
		session:         sess,
		acceptListeners: make(map[uint32]*blockedClientListener),
	}

	return m, nil
}

func (m *GRPCClientMuxer) Enabled() bool {
	return m != nil
}

func (m *GRPCClientMuxer) Listener(id uint32, doneCh <-chan struct{}) (net.Listener, error) {
	ln := newBlockedClientListener(m.session, doneCh)

	m.acceptMutex.Lock()
	m.acceptListeners[id] = ln
	m.acceptMutex.Unlock()

	return ln, nil
}

func (m *GRPCClientMuxer) AcceptKnock(id uint32) error {
	m.acceptMutex.Lock()
	defer m.acceptMutex.Unlock()

	ln, ok := m.acceptListeners[id]
	if !ok {
		return fmt.Errorf("no listener for id %d", id)
	}
	ln.unblock()
	return nil
}

func (m *GRPCClientMuxer) Dial() (net.Conn, error) {
	stream, err := m.session.Open()
	if err != nil {
		return nil, fmt.Errorf("error dialling new client stream: %w", err)
	}

	return stream, nil
}

func (m *GRPCClientMuxer) Close() error {
	return m.session.Close()
}
