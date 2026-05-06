// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package plugin

import (
	"bytes"
	"context"
	"io"
	"net"
	"net/rpc"
	"testing"

	hclog "github.com/hashicorp/go-hclog"
	"github.com/hashicorp/go-plugin/internal/grpcmux"
	"google.golang.org/grpc"
)

// TestOptions allows specifying options that can affect the behavior of the
// test functions
type TestOptions struct {
	//ServerStdout causes the given value to be used in place of a blank buffer
	//for RPCServer's Stdout
	ServerStdout io.ReadCloser

	//ServerStderr causes the given value to be used in place of a blank buffer
	//for RPCServer's Stderr
	ServerStderr io.ReadCloser
}

// The testing file contains test helpers that you can use outside of
// this package for making it easier to test plugins themselves.

// TestConn is a helper function for returning a client and server
// net.Conn connected to each other.
func TestConn(t testing.TB) (net.Conn, net.Conn) {
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
func TestRPCConn(t testing.TB) (*rpc.Client, *rpc.Server) {
	clientConn, serverConn := TestConn(t)

	server := rpc.NewServer()
	go server.ServeConn(serverConn)

	client := rpc.NewClient(clientConn)
	return client, server
}

// TestPluginRPCConn returns a plugin RPC client and server that are connected
// together and configured.
func TestPluginRPCConn(t testing.TB, ps map[string]Plugin, opts *TestOptions) (*RPCClient, *RPCServer) {
	// Create two net.Conns we can use to shuttle our control connection
	clientConn, serverConn := TestConn(t)

	// Start up the server
	server := &RPCServer{Plugins: ps, Stdout: new(bytes.Buffer), Stderr: new(bytes.Buffer)}
	if opts != nil {
		if opts.ServerStdout != nil {
			server.Stdout = opts.ServerStdout
		}
		if opts.ServerStderr != nil {
			server.Stderr = opts.ServerStderr
		}
	}
	go server.ServeConn(serverConn)

	// Connect the client to the server
	client, err := NewRPCClient(clientConn, ps)
	if err != nil {
		t.Fatalf("err: %s", err)
	}

	return client, server
}

// TestGRPCConn returns a gRPC client conn and grpc server that are connected
// together and configured. The register function is used to register services
// prior to the Serve call. This is used to test gRPC connections.
func TestGRPCConn(t testing.TB, register func(*grpc.Server)) (*grpc.ClientConn, *grpc.Server) {
	// Create a listener
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("err: %s", err)
	}

	server := grpc.NewServer()
	register(server)
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

	return conn, server
}

// TestPluginGRPCConn returns a plugin gRPC client and server that are connected
// together and configured. This is used to test gRPC connections.
func TestPluginGRPCConn(t testing.TB, multiplex bool, ps map[string]Plugin) (*GRPCClient, *GRPCServer) {
	// Create a listener
	ln, err := serverListener(UnixSocketConfig{})
	if err != nil {
		t.Fatal(err)
	}

	logger := hclog.New(&hclog.LoggerOptions{
		Level: hclog.Debug,
	})

	// Start up the server
	var muxer *grpcmux.GRPCServerMuxer
	if multiplex {
		muxer = grpcmux.NewGRPCServerMuxer(logger, ln)
		ln = muxer
	}
	server := &GRPCServer{
		Plugins: ps,
		DoneCh:  make(chan struct{}),
		Server:  DefaultGRPCServer,
		Stdout:  new(bytes.Buffer),
		Stderr:  new(bytes.Buffer),
		logger:  logger,
		muxer:   muxer,
	}
	if err := server.Init(); err != nil {
		t.Fatalf("err: %s", err)
	}
	go server.Serve(ln)

	client := &Client{
		address:  ln.Addr(),
		protocol: ProtocolGRPC,
		config: &ClientConfig{
			Plugins:             ps,
			GRPCBrokerMultiplex: multiplex,
		},
		logger: logger,
	}

	grpcClient, err := newGRPCClient(context.Background(), client)
	if err != nil {
		t.Fatal(err)
	}

	return grpcClient, server
}
