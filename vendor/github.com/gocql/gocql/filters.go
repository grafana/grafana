package gocql

import "fmt"

// HostFilter interface is used when a host is discovered via server sent events.
type HostFilter interface {
	// Called when a new host is discovered, returning true will cause the host
	// to be added to the pools.
	Accept(host *HostInfo) bool
}

// HostFilterFunc converts a func(host HostInfo) bool into a HostFilter
type HostFilterFunc func(host *HostInfo) bool

func (fn HostFilterFunc) Accept(host *HostInfo) bool {
	return fn(host)
}

// AcceptAllFilter will accept all hosts
func AcceptAllFilter() HostFilter {
	return HostFilterFunc(func(host *HostInfo) bool {
		return true
	})
}

func DenyAllFilter() HostFilter {
	return HostFilterFunc(func(host *HostInfo) bool {
		return false
	})
}

// DataCentreHostFilter filters all hosts such that they are in the same data centre
// as the supplied data centre.
func DataCentreHostFilter(dataCentre string) HostFilter {
	return HostFilterFunc(func(host *HostInfo) bool {
		return host.DataCenter() == dataCentre
	})
}

// WhiteListHostFilter filters incoming hosts by checking that their address is
// in the initial hosts whitelist.
func WhiteListHostFilter(hosts ...string) HostFilter {
	hostInfos, err := addrsToHosts(hosts, 9042)
	if err != nil {
		// dont want to panic here, but rather not break the API
		panic(fmt.Errorf("unable to lookup host info from address: %v", err))
	}

	m := make(map[string]bool, len(hostInfos))
	for _, host := range hostInfos {
		m[host.ConnectAddress().String()] = true
	}

	return HostFilterFunc(func(host *HostInfo) bool {
		return m[host.ConnectAddress().String()]
	})
}
