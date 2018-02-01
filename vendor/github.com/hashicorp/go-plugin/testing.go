package plugin

import (
	"bytes"
	"net"
	"net/rpc"

	"github.com/mitchellh/go-testing-interface"
	"google.golang.org/grpc"
)

// The testing file contains test helpers that you can use outside of
// this package for making it easier to test plugins themselves.

// TestConn is a helper function for returning a client and server
// net.Conn connected to each other.
func TestConn(t testing.T) (net.Conn, net.Conn) {
	// Listen to any local port. This listener will be closed
	// after a single connection is established.
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("err: %s", err)
	}

	// Start a goroutine to accept our client connection
	var serverConn net.Conn
	doneCh := make(chan struct{})
	go func() {
		defer close(doneCh)
		defer l.Close()
		var err error
		serverConn, err = l.Accept()
		if err != nil {
			t.Fatalf("err: %s", err)
		}
	}()

	// Connect to the server
	clientConn, err := net.Dial("tcp", l.Addr().String())
	if err != nil {
		t.Fatalf("err: %s", err)
	}

	// Wait for the server side to acknowledge it has connected
	<-doneCh

	return clientConn, serverConn
}

// TestRPCConn returns a rpc client and server connected to each other.
func TestRPCConn(t testing.T) (*rpc.Client, *rpc.Server) {
	clientConn, serverConn := TestConn(t)

	server := rpc.NewServer()
	go server.ServeConn(serverConn)

	client := rpc.NewClient(clientConn)
	return client, server
}

// TestPluginRPCConn returns a plugin RPC client and server that are connected
// together and configured.
func TestPluginRPCConn(t testing.T, ps map[string]Plugin) (*RPCClient, *RPCServer) {
	// Create two net.Conns we can use to shuttle our control connection
	clientConn, serverConn := TestConn(t)

	// Start up the server
	server := &RPCServer{Plugins: ps, Stdout: new(bytes.Buffer), Stderr: new(bytes.Buffer)}
	go server.ServeConn(serverConn)

	// Connect the client to the server
	client, err := NewRPCClient(clientConn, ps)
	if err != nil {
		t.Fatalf("err: %s", err)
	}

	return client, server
}

// TestPluginGRPCConn returns a plugin gRPC client and server that are connected
// together and configured. This is used to test gRPC connections.
func TestPluginGRPCConn(t testing.T, ps map[string]Plugin) (*GRPCClient, *GRPCServer) {
	// Create a listener
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("err: %s", err)
	}

	// Start up the server
	server := &GRPCServer{
		Plugins: ps,
		Server:  DefaultGRPCServer,
		Stdout:  new(bytes.Buffer),
		Stderr:  new(bytes.Buffer),
	}
	if err := server.Init(); err != nil {
		t.Fatalf("err: %s", err)
	}
	go server.Serve(l)

	// Connect to the server
	conn, err := grpc.Dial(
		l.Addr().String(),
		grpc.WithBlock(),
		grpc.WithInsecure())
	if err != nil {
		t.Fatalf("err: %s", err)
	}

	// Connection successful, close the listener
	l.Close()

	// Create the client
	client := &GRPCClient{
		Conn:    conn,
		Plugins: ps,
	}

	return client, server
}
