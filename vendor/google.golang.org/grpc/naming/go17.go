// +build go1.6, !go1.8

package naming

import (
	"net"

	"golang.org/x/net/context"
)

var (
	lookupHost = func(ctx context.Context, host string) ([]string, error) { return net.LookupHost(host) }
	lookupSRV  = func(ctx context.Context, service, proto, name string) (string, []*net.SRV, error) {
		return net.LookupSRV(service, proto, name)
	}
)
