package msdsn

import (
	"context"
	"net"
)

type BrowserData map[string]map[string]string

// ProtocolDialer makes the network connection for a protocol
type ProtocolDialer interface {
	// Translates data from SQL Browser to parameters in the config
	ParseBrowserData(data BrowserData, p *Config) error
	// DialConnection eturns a Dialer to make the connection. On success, also set Config.ServerSPN if it is unset.
	DialConnection(ctx context.Context, p *Config) (conn net.Conn, err error)
	// Returns true if information is needed from the SQL Browser service to make a connection
	CallBrowser(p *Config) bool
}

var ProtocolDialers map[string]ProtocolDialer = map[string]ProtocolDialer{}
