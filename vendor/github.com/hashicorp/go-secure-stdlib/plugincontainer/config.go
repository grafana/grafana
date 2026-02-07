// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package plugincontainer

import (
	"github.com/docker/docker/api/types/network"
)

// Config is used to opt in to running plugins inside a container.
// Currently only compatible with Linux due to the requirements we have for
// establishing communication over a unix socket.
//
// A temporary directory will be mounted into the container, which needs to be
// writable by the plugin so it can create a unix socket, which in turn needs
// to be writable from the host. To achieve these 2-way write perimissions,
// this library implements two different strategies:
//
//  1. Set up a uid or gid common to both the host and container processes, and
//     ensure the unix socket is writable by that shared id.
//
//     a) For a shared uid, run as root inside the container to avoid being mapped
//     to a different uid within the user namespace. No need to set GroupAdd or
//     Rootless options, but note this is highly inadvisable unless your container
//     runtime is unprivileged/rootless.
//
//     b) For a shared gid, use the same numeric gid for GroupAdd in this config
//     and go-plugin's ClientConfig.UnixSocketConfig.Group. go-plugin will handle
//     making all sockets writable by the gid. Not sufficient on its own for
//     rootless runtimes, as the gid will be mapped to a different actual group
//     inside the container.
//
//  2. If the container runtime and the container itself are both configured to
//     run as non-root users, it's not possible to set up a shared uid or gid.
//     In this case, set the Rootless option to enable two changes:
//
//     a) Enable the DAC_OVERRIDE capability for the container to allow the
//     plugin to create a file in the shared directory. Note it is recommended
//     to limit usage of this functionality to gVisor containers, because other
//     runtimes will need to be given DAC_OVERRIDE themselves, which undermines
//     some of the benefit of using a rootless container runtime.
//
//     b) Apply a default ACL to the shared directory, allowing the host to
//     write to any socket files created in it. The socket must be group-
//     writable for the default ACL to take effect, so GroupAdd must also be
//     set.
type Config struct {
	// GroupAdd sets an additional group that the container should run as. Should
	// match the UnixSocketConfig Group passed to go-plugin.
	GroupAdd int

	// Rootless enables extra steps necessary to make the plugin's Unix socket
	// writable by both sides when using a rootless container runtime. It
	// should be set if both the host's container runtime and the container
	// itself are configured to run as non-privileged users. It requires a file
	// system that supports POSIX 1e ACLs, which should be available by default
	// on most modern Linux distributions.
	Rootless bool

	// Container command/env
	Entrypoint []string // If specified, replaces the container entrypoint.
	Args       []string // If specified, replaces the container args.
	Env        []string // A slice of x=y environment variables to add to the container.

	// container.Config options
	Image          string            // Image to run (without the tag), e.g. hashicorp/vault-plugin-auth-jwt
	Tag            string            // Tag of the image to run, e.g. 0.16.0
	SHA256         string            // SHA256 digest of the image. Can be a plain sha256 or prefixed with sha256:
	DisableNetwork bool              // Whether to disable the networking stack.
	Labels         map[string]string // Arbitrary metadata to facilitate querying containers.

	// container.HostConfig options
	Runtime      string // OCI runtime. NOTE: Has no effect if using podman's system service API
	CgroupParent string // Parent Cgroup for the container
	NanoCpus     int64  // CPU quota in billionths of a CPU core
	Memory       int64  // Memory quota in bytes
	CapIPCLock   bool   // Whether to add the capability IPC_LOCK, to allow the mlockall(2) syscall

	// network.NetworkConfig options
	EndpointsConfig map[string]*network.EndpointSettings // Endpoint configs for each connecting network

	// When set, prints additional debug information when a plugin fails to start.
	// Debug changes the way the plugin is run so that more information can be
	// extracted from the plugin container before it is cleaned up. It will also
	// include plugin environment variables in the error output. Not recommended
	// for production use.
	Debug bool
}
