package testcontainers

import (
	"context"

	"github.com/docker/docker/api/types/network"

	"github.com/testcontainers/testcontainers-go/internal/core"
)

// NetworkProvider allows the creation of networks on an arbitrary system
type NetworkProvider interface {
	CreateNetwork(context.Context, NetworkRequest) (Network, error)      // create a network
	GetNetwork(context.Context, NetworkRequest) (network.Inspect, error) // get a network
}

// Deprecated: will be removed in the future
// Network allows getting info about a single network instance
type Network interface {
	Remove(context.Context) error // removes the network
}

// Deprecated: will be removed in the future.
type DefaultNetwork string

// Deprecated: will be removed in the future.
func (n DefaultNetwork) ApplyGenericTo(opts *GenericProviderOptions) {
	opts.defaultNetwork = string(n)
}

// Deprecated: will be removed in the future.
func (n DefaultNetwork) ApplyDockerTo(opts *DockerProviderOptions) {
	opts.defaultNetwork = string(n)
}

// Deprecated: will be removed in the future
// NetworkRequest represents the parameters used to get a network
type NetworkRequest struct {
	Driver         string
	CheckDuplicate bool // Deprecated: CheckDuplicate is deprecated since API v1.44, but it defaults to true when sent by the client package to older daemons.
	Internal       bool
	EnableIPv6     *bool
	Name           string
	Labels         map[string]string
	Attachable     bool
	IPAM           *network.IPAM

	SkipReaper    bool              // Deprecated: The reaper is globally controlled by the .testcontainers.properties file or the TESTCONTAINERS_RYUK_DISABLED environment variable
	ReaperImage   string            // Deprecated: use WithImageName ContainerOption instead. Alternative reaper registry
	ReaperOptions []ContainerOption // Deprecated: the reaper is configured at the properties level, for an entire test session
}

// sessionID returns the session ID for the network request.
func (r NetworkRequest) sessionID() string {
	if sessionID := r.Labels[core.LabelSessionID]; sessionID != "" {
		return sessionID
	}

	return core.SessionID()
}
