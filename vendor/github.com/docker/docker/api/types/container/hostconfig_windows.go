package container // import "github.com/docker/docker/api/types/container"

import "github.com/docker/docker/api/types/network"

// IsValid indicates if an isolation technology is valid
func (i Isolation) IsValid() bool {
	return i.IsDefault() || i.IsHyperV() || i.IsProcess()
}

// IsBridge indicates whether container uses the bridge network stack
// in windows it is given the name NAT
func (n NetworkMode) IsBridge() bool {
	return n == network.NetworkNat
}

// IsHost indicates whether container uses the host network stack.
// returns false as this is not supported by windows
func (n NetworkMode) IsHost() bool {
	return false
}

// IsUserDefined indicates user-created network
func (n NetworkMode) IsUserDefined() bool {
	return !n.IsDefault() && !n.IsNone() && !n.IsBridge() && !n.IsContainer()
}

// NetworkName returns the name of the network stack.
func (n NetworkMode) NetworkName() string {
	switch {
	case n.IsDefault():
		return network.NetworkDefault
	case n.IsBridge():
		return network.NetworkNat
	case n.IsHost():
		// Windows currently doesn't support host network-mode, so
		// this would currently never happen..
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
