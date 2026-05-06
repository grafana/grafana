// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package runner

import (
	"context"
	"io"
)

// Runner defines the interface required by go-plugin to manage the lifecycle of
// of a plugin and attempt to negotiate a connection with it. Note that this
// is orthogonal to the protocol and transport used, which is negotiated over stdout.
type Runner interface {
	// Start should start the plugin and ensure any work required for servicing
	// other interface methods is done. If the context is cancelled, it should
	// only abort any attempts to _start_ the plugin. Waiting and shutdown are
	// handled separately.
	Start(ctx context.Context) error

	// Diagnose makes a best-effort attempt to return any debug information that
	// might help users understand why a plugin failed to start and negotiate a
	// connection.
	Diagnose(ctx context.Context) string

	// Stdout is used to negotiate the go-plugin protocol.
	Stdout() io.ReadCloser

	// Stderr is used for forwarding plugin logs to the host process logger.
	Stderr() io.ReadCloser

	// Name is a human-friendly name for the plugin, such as the path to the
	// executable. It does not have to be unique.
	Name() string

	AttachedRunner
}

// AttachedRunner defines a limited subset of Runner's interface to represent the
// reduced responsibility for plugin lifecycle when attaching to an already running
// plugin.
type AttachedRunner interface {
	// Wait should wait until the plugin stops running, whether in response to
	// an out of band signal or in response to calling Kill().
	Wait(ctx context.Context) error

	// Kill should stop the plugin and perform any cleanup required.
	Kill(ctx context.Context) error

	// ID is a unique identifier to represent the running plugin. e.g. pid or
	// container ID.
	ID() string

	AddrTranslator
}

// AddrTranslator translates addresses between the execution context of the host
// process and the plugin. For example, if the plugin is in a container, the file
// path for a Unix socket may be different between the host and the container.
//
// It is only intended to be used by the host process.
type AddrTranslator interface {
	// Called before connecting on any addresses received back from the plugin.
	PluginToHost(pluginNet, pluginAddr string) (hostNet string, hostAddr string, err error)

	// Called on any host process addresses before they are sent to the plugin.
	HostToPlugin(hostNet, hostAddr string) (pluginNet string, pluginAddr string, err error)
}

// ReattachFunc can be passed to a client's reattach config to reattach to an
// already running plugin instead of starting it ourselves.
type ReattachFunc func() (AttachedRunner, error)
