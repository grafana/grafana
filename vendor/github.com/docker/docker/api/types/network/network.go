package network // import "github.com/docker/docker/api/types/network"

import (
	"time"

	"github.com/docker/docker/api/types/filters"
)

const (
	// NetworkDefault is a platform-independent alias to choose the platform-specific default network stack.
	NetworkDefault = "default"
	// NetworkHost is the name of the predefined network used when the NetworkMode host is selected (only available on Linux)
	NetworkHost = "host"
	// NetworkNone is the name of the predefined network used when the NetworkMode none is selected (available on both Linux and Windows)
	NetworkNone = "none"
	// NetworkBridge is the name of the default network on Linux
	NetworkBridge = "bridge"
	// NetworkNat is the name of the default network on Windows
	NetworkNat = "nat"
)

// CreateRequest is the request message sent to the server for network create call.
type CreateRequest struct {
	CreateOptions
	Name string // Name is the requested name of the network.

	// Deprecated: CheckDuplicate is deprecated since API v1.44, but it defaults to true when sent by the client
	// package to older daemons.
	CheckDuplicate *bool `json:",omitempty"`
}

// CreateOptions holds options to create a network.
type CreateOptions struct {
	Driver     string            // Driver is the driver-name used to create the network (e.g. `bridge`, `overlay`)
	Scope      string            // Scope describes the level at which the network exists (e.g. `swarm` for cluster-wide or `local` for machine level).
	EnableIPv4 *bool             `json:",omitempty"` // EnableIPv4 represents whether to enable IPv4.
	EnableIPv6 *bool             `json:",omitempty"` // EnableIPv6 represents whether to enable IPv6.
	IPAM       *IPAM             // IPAM is the network's IP Address Management.
	Internal   bool              // Internal represents if the network is used internal only.
	Attachable bool              // Attachable represents if the global scope is manually attachable by regular containers from workers in swarm mode.
	Ingress    bool              // Ingress indicates the network is providing the routing-mesh for the swarm cluster.
	ConfigOnly bool              // ConfigOnly creates a config-only network. Config-only networks are place-holder networks for network configurations to be used by other networks. ConfigOnly networks cannot be used directly to run containers or services.
	ConfigFrom *ConfigReference  // ConfigFrom specifies the source which will provide the configuration for this network. The specified network must be a config-only network; see [CreateOptions.ConfigOnly].
	Options    map[string]string // Options specifies the network-specific options to use for when creating the network.
	Labels     map[string]string // Labels holds metadata specific to the network being created.
}

// ListOptions holds parameters to filter the list of networks with.
type ListOptions struct {
	Filters filters.Args
}

// InspectOptions holds parameters to inspect network.
type InspectOptions struct {
	Scope   string
	Verbose bool
}

// ConnectOptions represents the data to be used to connect a container to the
// network.
type ConnectOptions struct {
	Container      string
	EndpointConfig *EndpointSettings `json:",omitempty"`
}

// DisconnectOptions represents the data to be used to disconnect a container
// from the network.
type DisconnectOptions struct {
	Container string
	Force     bool
}

// Inspect is the body of the "get network" http response message.
type Inspect struct {
	Name       string                      // Name is the name of the network
	ID         string                      `json:"Id"` // ID uniquely identifies a network on a single machine
	Created    time.Time                   // Created is the time the network created
	Scope      string                      // Scope describes the level at which the network exists (e.g. `swarm` for cluster-wide or `local` for machine level)
	Driver     string                      // Driver is the Driver name used to create the network (e.g. `bridge`, `overlay`)
	EnableIPv4 bool                        // EnableIPv4 represents whether IPv4 is enabled
	EnableIPv6 bool                        // EnableIPv6 represents whether IPv6 is enabled
	IPAM       IPAM                        // IPAM is the network's IP Address Management
	Internal   bool                        // Internal represents if the network is used internal only
	Attachable bool                        // Attachable represents if the global scope is manually attachable by regular containers from workers in swarm mode.
	Ingress    bool                        // Ingress indicates the network is providing the routing-mesh for the swarm cluster.
	ConfigFrom ConfigReference             // ConfigFrom specifies the source which will provide the configuration for this network.
	ConfigOnly bool                        // ConfigOnly networks are place-holder networks for network configurations to be used by other networks. ConfigOnly networks cannot be used directly to run containers or services.
	Containers map[string]EndpointResource // Containers contains endpoints belonging to the network
	Options    map[string]string           // Options holds the network specific options to use for when creating the network
	Labels     map[string]string           // Labels holds metadata specific to the network being created
	Peers      []PeerInfo                  `json:",omitempty"` // List of peer nodes for an overlay network
	Services   map[string]ServiceInfo      `json:",omitempty"`
}

// Summary is used as response when listing networks. It currently is an alias
// for [Inspect], but may diverge in the future, as not all information may
// be included when listing networks.
type Summary = Inspect

// Address represents an IP address
type Address struct {
	Addr      string
	PrefixLen int
}

// PeerInfo represents one peer of an overlay network
type PeerInfo struct {
	Name string
	IP   string
}

// Task carries the information about one backend task
type Task struct {
	Name       string
	EndpointID string
	EndpointIP string
	Info       map[string]string
}

// ServiceInfo represents service parameters with the list of service's tasks
type ServiceInfo struct {
	VIP          string
	Ports        []string
	LocalLBIndex int
	Tasks        []Task
}

// EndpointResource contains network resources allocated and used for a
// container in a network.
type EndpointResource struct {
	Name        string
	EndpointID  string
	MacAddress  string
	IPv4Address string
	IPv6Address string
}

// NetworkingConfig represents the container's networking configuration for each of its interfaces
// Carries the networking configs specified in the `docker run` and `docker network connect` commands
type NetworkingConfig struct {
	EndpointsConfig map[string]*EndpointSettings // Endpoint configs for each connecting network
}

// ConfigReference specifies the source which provides a network's configuration
type ConfigReference struct {
	Network string
}

var acceptedFilters = map[string]bool{
	"dangling": true,
	"driver":   true,
	"id":       true,
	"label":    true,
	"name":     true,
	"scope":    true,
	"type":     true,
}

// ValidateFilters validates the list of filter args with the available filters.
func ValidateFilters(filter filters.Args) error {
	return filter.Validate(acceptedFilters)
}

// PruneReport contains the response for Engine API:
// POST "/networks/prune"
type PruneReport struct {
	NetworksDeleted []string
}
