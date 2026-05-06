// Provenance-includes-location: https://github.com/thanos-io/thanos/blob/main/pkg/discovery/dns/miekgdns/resolver.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: The Thanos Authors.

package miekgdns

import (
	"context"
	"net"

	"github.com/miekg/dns"
	"github.com/pkg/errors"
)

// DefaultResolvConfPath is a common, default resolv.conf file present on linux server.
const DefaultResolvConfPath = "/etc/resolv.conf"

// Resolver is a drop-in Resolver for *part* of std lib Golang net.DefaultResolver methods.
type Resolver struct {
	ResolvConf string
}

func (r *Resolver) LookupSRV(_ context.Context, service, proto, name string) (cname string, addrs []*net.SRV, err error) {
	var target string
	if service == "" && proto == "" {
		target = name
	} else {
		target = "_" + service + "._" + proto + "." + name
	}

	response, err := r.lookupWithSearchPath(target, dns.Type(dns.TypeSRV))
	if err != nil {
		return "", nil, err
	}

	for _, record := range response.Answer {
		switch addr := record.(type) {
		case *dns.SRV:
			addrs = append(addrs, &net.SRV{
				Weight:   addr.Weight,
				Target:   addr.Target,
				Priority: addr.Priority,
				Port:     addr.Port,
			})
		default:
			return "", nil, errors.Errorf("invalid SRV response record %s", record)
		}
	}

	return "", addrs, nil
}

func (r *Resolver) LookupIPAddr(_ context.Context, host string) ([]net.IPAddr, error) {
	return r.lookupIPAddr(host, 1, 8)
}

func (r *Resolver) lookupIPAddr(host string, currIteration, maxIterations int) ([]net.IPAddr, error) {
	// We want to protect from infinite loops when resolving DNS records recursively.
	if currIteration > maxIterations {
		return nil, errors.Errorf("maximum number of recursive iterations reached (%d)", maxIterations)
	}

	response, err := r.lookupWithSearchPath(host, dns.Type(dns.TypeAAAA))
	if err != nil || len(response.Answer) == 0 {
		// Ugly fallback to A lookup.
		response, err = r.lookupWithSearchPath(host, dns.Type(dns.TypeA))
		if err != nil {
			return nil, err
		}
	}

	var resp []net.IPAddr
	for _, record := range response.Answer {
		switch addr := record.(type) {
		case *dns.A:
			resp = append(resp, net.IPAddr{IP: addr.A})
		case *dns.AAAA:
			resp = append(resp, net.IPAddr{IP: addr.AAAA})
		case *dns.CNAME:
			// Recursively resolve it.
			addrs, err := r.lookupIPAddr(addr.Target, currIteration+1, maxIterations)
			if err != nil {
				return nil, errors.Wrapf(err, "recursively resolve %s", addr.Target)
			}
			resp = append(resp, addrs...)
		default:
			return nil, errors.Errorf("invalid A, AAAA or CNAME response record %s", record)
		}
	}
	return resp, nil
}

func (r *Resolver) IsNotFound(err error) bool {
	return errors.Is(errors.Cause(err), ErrNoSuchHost)
}
