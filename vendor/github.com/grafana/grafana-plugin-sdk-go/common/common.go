package common

import plugin "github.com/hashicorp/go-plugin"

const (
	MagicCookieKey   = "grafana_plugin_type"
	MagicCookieValue = "datasource"
	ProtocolVersion  = 2
)

var Handshake = plugin.HandshakeConfig{
	ProtocolVersion:  ProtocolVersion,
	MagicCookieKey:   MagicCookieKey,
	MagicCookieValue: MagicCookieValue,
}
