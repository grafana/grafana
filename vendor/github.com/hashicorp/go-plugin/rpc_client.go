// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package plugin

import (
	"crypto/tls"
	"fmt"
	"io"
	"net"
	"net/rpc"

	"github.com/hashicorp/yamux"
)

// RPCClient connects to an RPCServer over net/rpc to dispense plugin types.
type RPCClient struct {
	broker  *MuxBroker
	control *rpc.Client
	plugins map[string]Plugin

	// These are the streams used for the various stdout/err overrides
	stdout, stderr net.Conn
}

// newRPCClient creates a new RPCClient. The Client argument is expected
// to be successfully started already with a lock held.
func newRPCClient(c *Client) (*RPCClient, error) {
	// Connect to the client
	conn, err := net.Dial(c.address.Network(), c.address.String())
	if err != nil {
		return nil, err
	}
	if tcpConn, ok := conn.(*net.TCPConn); ok {
		// Make sure to set keep alive so that the connection doesn't die
		tcpConn.SetKeepAlive(true)
	}

	if c.config.TLSConfig != nil {
		conn = tls.Client(conn, c.config.TLSConfig)
	}

	// Create the actual RPC client
	result, err := NewRPCClient(conn, c.config.Plugins)
	if err != nil {
		conn.Close()
		return nil, err
	}

	// Begin the stream syncing so that stdin, out, err work properly
	err = result.SyncStreams(
		c.config.SyncStdout,
		c.config.SyncStderr)
	if err != nil {
		result.Close()
		return nil, err
	}

	return result, nil
}

// NewRPCClient creates a client from an already-open connection-like value.
// Dial is typically used instead.
func NewRPCClient(conn io.ReadWriteCloser, plugins map[string]Plugin) (*RPCClient, error) {
	// Create the yamux client so we can multiplex
	mux, err := yamux.Client(conn, nil)
	if err != nil {
		conn.Close()
		return nil, err
	}

	// Connect to the control stream.
	control, err := mux.Open()
	if err != nil {
		mux.Close()
		return nil, err
	}

	// Connect stdout, stderr streams
	stdstream := make([]net.Conn, 2)
	for i, _ := range stdstream {
		stdstream[i], err = mux.Open()
		if err != nil {
			mux.Close()
			return nil, err
		}
	}

	// Create the broker and start it up
	broker := newMuxBroker(mux)
	go broker.Run()

	// Build the client using our broker and control channel.
	return &RPCClient{
		broker:  broker,
		control: rpc.NewClient(control),
		plugins: plugins,
		stdout:  stdstream[0],
		stderr:  stdstream[1],
	}, nil
}

// SyncStreams should be called to enable syncing of stdout,
// stderr with the plugin.
//
// This will return immediately and the syncing will continue to happen
// in the background. You do not need to launch this in a goroutine itself.
//
// This should never be called multiple times.
func (c *RPCClient) SyncStreams(stdout io.Writer, stderr io.Writer) error {
	go copyStream("stdout", stdout, c.stdout)
	go copyStream("stderr", stderr, c.stderr)
	return nil
}

// Close closes the connection. The client is no longer usable after this
// is called.
func (c *RPCClient) Close() error {
	// Call the control channel and ask it to gracefully exit. If this
	// errors, then we save it so that we always return an error but we
	// want to try to close the other channels anyways.
	var empty struct{}
	returnErr := c.control.Call("Control.Quit", true, &empty)

	// Close the other streams we have
	if err := c.control.Close(); err != nil {
		return err
	}
	if err := c.stdout.Close(); err != nil {
		return err
	}
	if err := c.stderr.Close(); err != nil {
		return err
	}
	if err := c.broker.Close(); err != nil {
		return err
	}

	// Return back the error we got from Control.Quit. This is very important
	// since we MUST return non-nil error if this fails so that Client.Kill
	// will properly try a process.Kill.
	return returnErr
}

func (c *RPCClient) Dispense(name string) (interface{}, error) {
	p, ok := c.plugins[name]
	if !ok {
		return nil, fmt.Errorf("unknown plugin type: %s", name)
	}

	var id uint32
	if err := c.control.Call(
		"Dispenser.Dispense", name, &id); err != nil {
		return nil, err
	}

	conn, err := c.broker.Dial(id)
	if err != nil {
		return nil, err
	}

	return p.Client(c.broker, rpc.NewClient(conn))
}

// Ping pings the connection to ensure it is still alive.
//
// The error from the RPC call is returned exactly if you want to inspect
// it for further error analysis. Any error returned from here would indicate
// that the connection to the plugin is not healthy.
func (c *RPCClient) Ping() error {
	var empty struct{}
	return c.control.Call("Control.Ping", true, &empty)
}
