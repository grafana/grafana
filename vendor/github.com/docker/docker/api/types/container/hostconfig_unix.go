//go:build !windows

package container // import "github.com/docker/docker/api/types/container"

import "github.com/docker/docker/api/types/network"

// IsValid indicates if an isolation technology is valid
func (i Isolation) IsValid() bool {
	return i.IsDefault()
}

// IsBridge indicates whether container uses the bridge network stack
func (n NetworkMode) IsBridge() bool {
	return n == network.NetworkBridge
}

// IsHost indicates whether container uses the host network stack.
func (n NetworkMode) IsHost() bool {
	return n == network.NetworkHost
}

// IsUserDefined indicates user-created network
func (n NetworkMode) IsUserDefined() bool {
	return !n.IsDefault() && !n.IsBridge() && !n.IsHost() && !n.IsNone() && !n.IsContainer()
}

// NetworkName returns the name of the network stack.
func (n NetworkMode) NetworkName() string {
	switch {
	case n.IsDefault():
		return network.NetworkDefault
	case n.IsBridge():
		return network.NetworkBridge
	case n.IsHost():
		return network.NetworkHost
	case n.IsNone():
		return network.NetworkNone
	case n.IsContainer():
		return "container"
	case n.IsUserDefined():
		return n.UserDefined()
	default:
		return ""
	}
}
