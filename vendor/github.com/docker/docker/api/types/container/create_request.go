package container

import "github.com/docker/docker/api/types/network"

// CreateRequest is the request message sent to the server for container
// create calls. It is a config wrapper that holds the container [Config]
// (portable) and the corresponding [HostConfig] (non-portable) and
// [network.NetworkingConfig].
type CreateRequest struct {
	*Config
	HostConfig       *HostConfig               `json:"HostConfig,omitempty"`
	NetworkingConfig *network.NetworkingConfig `json:"NetworkingConfig,omitempty"`
}
