// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

// The plugin package exposes functions and helpers for communicating to
// plugins which are implemented as standalone binary applications.
//
// plugin.Client fully manages the lifecycle of executing the application,
// connecting to it, and returning the RPC client for dispensing plugins.
//
// plugin.Serve fully manages listeners to expose an RPC server from a binary
// that plugin.Client can connect to.
package plugin

import (
	"context"
	"errors"
	"net/rpc"

	"google.golang.org/grpc"
)

// Plugin is the interface that is implemented to serve/connect to an
// inteface implementation.
type Plugin interface {
	// Server should return the RPC server compatible struct to serve
	// the methods that the Client calls over net/rpc.
	Server(*MuxBroker) (interface{}, error)

	// Client returns an interface implementation for the plugin you're
	// serving that communicates to the server end of the plugin.
	Client(*MuxBroker, *rpc.Client) (interface{}, error)
}

// GRPCPlugin is the interface that is implemented to serve/connect to
// a plugin over gRPC.
type GRPCPlugin interface {
	// GRPCServer should register this plugin for serving with the
	// given GRPCServer. Unlike Plugin.Server, this is only called once
	// since gRPC plugins serve singletons.
	GRPCServer(*GRPCBroker, *grpc.Server) error

	// GRPCClient should return the interface implementation for the plugin
	// you're serving via gRPC. The provided context will be canceled by
	// go-plugin in the event of the plugin process exiting.
	GRPCClient(context.Context, *GRPCBroker, *grpc.ClientConn) (interface{}, error)
}

// NetRPCUnsupportedPlugin implements Plugin but returns errors for the
// Server and Client functions. This will effectively disable support for
// net/rpc based plugins.
//
// This struct can be embedded in your struct.
type NetRPCUnsupportedPlugin struct{}

func (p NetRPCUnsupportedPlugin) Server(*MuxBroker) (interface{}, error) {
	return nil, errors.New("net/rpc plugin protocol not supported")
}

func (p NetRPCUnsupportedPlugin) Client(*MuxBroker, *rpc.Client) (interface{}, error) {
	return nil, errors.New("net/rpc plugin protocol not supported")
}
