package plugin

import (
	plugin "github.com/hashicorp/go-plugin"
)

const (
	// ProtocolVersion is the current (latest) supported protocol version.
	ProtocolVersion = 2

	// MagicCookieKey is the the magic cookie key that will be used for negotiating
	// between plugin host and client.
	// Should NEVER be changed.
	MagicCookieKey = "grafana_plugin_type"

	// MagicCookieValue is the the magic cookie value that will be used for negotiating
	// between plugin host and client.
	// Should NEVER be changed.
	MagicCookieValue = "datasource"
)

// handshake is the HandshakeConfig used to configure clients and servers.
var handshake = plugin.HandshakeConfig{
	ProtocolVersion:  ProtocolVersion,
	MagicCookieKey:   MagicCookieKey,
	MagicCookieValue: MagicCookieValue,
}
