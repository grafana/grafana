// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package plugin

import (
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/rpc"
	"sync"

	"github.com/hashicorp/yamux"
)

// RPCServer listens for network connections and then dispenses interface
// implementations over net/rpc.
//
// After setting the fields below, they shouldn't be read again directly
// from the structure which may be reading/writing them concurrently.
type RPCServer struct {
	Plugins map[string]Plugin

	// Stdout, Stderr are what this server will use instead of the
	// normal stdin/out/err. This is because due to the multi-process nature
	// of our plugin system, we can't use the normal process values so we
	// make our own custom one we pipe across.
	Stdout io.Reader
	Stderr io.Reader

	// DoneCh should be set to a non-nil channel that will be closed
	// when the control requests the RPC server to end.
	DoneCh chan<- struct{}

	lock sync.Mutex
}

// ServerProtocol impl.
func (s *RPCServer) Init() error { return nil }

// ServerProtocol impl.
func (s *RPCServer) Config() string { return "" }

// ServerProtocol impl.
func (s *RPCServer) Serve(lis net.Listener) {
	defer s.done()

	for {
		conn, err := lis.Accept()
		if err != nil {
			severity := "ERR"
			if errors.Is(err, net.ErrClosed) {
				severity = "DEBUG"
			}
			log.Printf("[%s] plugin: plugin server: %s", severity, err)
			return
		}

		go s.ServeConn(conn)
	}
}

// ServeConn runs a single connection.
//
// ServeConn blocks, serving the connection until the client hangs up.
func (s *RPCServer) ServeConn(conn io.ReadWriteCloser) {
	// First create the yamux server to wrap this connection
	mux, err := yamux.Server(conn, nil)
	if err != nil {
		conn.Close()
		log.Printf("[ERR] plugin: error creating yamux server: %s", err)
		return
	}

	// Accept the control connection
	control, err := mux.Accept()
	if err != nil {
		mux.Close()
		if err != io.EOF {
			log.Printf("[ERR] plugin: error accepting control connection: %s", err)
		}

		return
	}

	// Connect the stdstreams (in, out, err)
	stdstream := make([]net.Conn, 2)
	for i := range stdstream {
		stdstream[i], err = mux.Accept()
		if err != nil {
			mux.Close()
			log.Printf("[ERR] plugin: accepting stream %d: %s", i, err)
			return
		}
	}

	// Copy std streams out to the proper place
	go copyStream("stdout", stdstream[0], s.Stdout)
	go copyStream("stderr", stdstream[1], s.Stderr)

	// Create the broker and start it up
	broker := newMuxBroker(mux)
	go broker.Run()

	// Use the control connection to build the dispenser and serve the
	// connection.
	server := rpc.NewServer()
	server.RegisterName("Control", &controlServer{
		server: s,
	})
	server.RegisterName("Dispenser", &dispenseServer{
		broker:  broker,
		plugins: s.Plugins,
	})
	server.ServeConn(control)
}

// done is called internally by the control server to trigger the
// doneCh to close which is listened to by the main process to cleanly
// exit.
func (s *RPCServer) done() {
	s.lock.Lock()
	defer s.lock.Unlock()

	if s.DoneCh != nil {
		close(s.DoneCh)
		s.DoneCh = nil
	}
}

// dispenseServer dispenses variousinterface implementations for Terraform.
type controlServer struct {
	server *RPCServer
}

// Ping can be called to verify the connection (and likely the binary)
// is still alive to a plugin.
func (c *controlServer) Ping(
	null bool, response *struct{},
) error {
	*response = struct{}{}
	return nil
}

func (c *controlServer) Quit(
	null bool, response *struct{},
) error {
	// End the server
	c.server.done()

	// Always return true
	*response = struct{}{}

	return nil
}

// dispenseServer dispenses variousinterface implementations for Terraform.
type dispenseServer struct {
	broker  *MuxBroker
	plugins map[string]Plugin
}

func (d *dispenseServer) Dispense(
	name string, response *uint32,
) error {
	// Find the function to create this implementation
	p, ok := d.plugins[name]
	if !ok {
		return fmt.Errorf("unknown plugin type: %s", name)
	}

	// Create the implementation first so we know if there is an error.
	impl, err := p.Server(d.broker)
	if err != nil {
		// We turn the error into an errors error so that it works across RPC
		return errors.New(err.Error())
	}

	// Reserve an ID for our implementation
	id := d.broker.NextId()
	*response = id

	// Run the rest in a goroutine since it can only happen once this RPC
	// call returns. We wait for a connection for the plugin implementation
	// and serve it.
	go func() {
		conn, err := d.broker.Accept(id)
		if err != nil {
			log.Printf("[ERR] go-plugin: plugin dispense error: %s: %s", name, err)
			return
		}

		serve(conn, "Plugin", impl)
	}()

	return nil
}

func serve(conn io.ReadWriteCloser, name string, v interface{}) {
	server := rpc.NewServer()
	if err := server.RegisterName(name, v); err != nil {
		log.Printf("[ERR] go-plugin: plugin dispense error: %s", err)
		return
	}

	server.ServeConn(conn)
}
