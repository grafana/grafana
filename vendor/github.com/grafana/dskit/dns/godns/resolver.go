// Provenance-includes-location: https://github.com/thanos-io/thanos/blob/main/pkg/discovery/dns/godns/resolver.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: The Thanos Authors.

package godns

import (
	"net"

	"github.com/pkg/errors"
)

// Resolver is a wrapper for net.Resolver.
type Resolver struct {
	*net.Resolver
}

// IsNotFound checkout if DNS record is not found.
func (r *Resolver) IsNotFound(err error) bool {
	if err == nil {
		return false
	}
	err = errors.Cause(err)
	dnsErr, ok := err.(*net.DNSError)
	return ok && dnsErr.IsNotFound
}
