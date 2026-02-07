// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package plugin

const (
	// EnvUnixSocketDir specifies the directory that _plugins_ should create unix
	// sockets in. Does not affect client behavior.
	EnvUnixSocketDir = "PLUGIN_UNIX_SOCKET_DIR"

	// EnvUnixSocketGroup specifies the owning, writable group to set for Unix
	// sockets created by _plugins_. Does not affect client behavior.
	EnvUnixSocketGroup = "PLUGIN_UNIX_SOCKET_GROUP"

	envMultiplexGRPC = "PLUGIN_MULTIPLEX_GRPC"
)
