// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package grpcmux

import (
	"net"
)

// GRPCMuxer enables multiple implementations of net.Listener to accept
// connections over a single "main" multiplexed net.Conn, and dial multiple
// client connections over the same multiplexed net.Conn.
//
// The first multiplexed connection is used to serve the gRPC broker's own
// control services: plugin.GRPCBroker, plugin.GRPCController, plugin.GRPCStdio.
//
// Clients must "knock" before dialling, to tell the server side that the
// next net.Conn should be accepted onto a specific stream ID. The knock is a
// bidirectional streaming message on the plugin.GRPCBroker service.
type GRPCMuxer interface {
	// Enabled determines whether multiplexing should be used. It saves users
	// of the interface from having to compare an interface with nil, which
	// is a bit awkward to do correctly.
	Enabled() bool

	// Listener returns a multiplexed listener that will wait until AcceptKnock
	// is called with a matching ID before its Accept function returns.
	Listener(id uint32, doneCh <-chan struct{}) (net.Listener, error)

	// AcceptKnock unblocks the listener with the matching ID, and returns an
	// error if it hasn't been created yet.
	AcceptKnock(id uint32) error

	// Dial makes a new multiplexed client connection. To dial a specific ID,
	// a knock must be sent first.
	Dial() (net.Conn, error)

	// Close closes connections and releases any resources associated with the
	// muxer.
	Close() error
}
