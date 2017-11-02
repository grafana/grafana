package gocql

import (
	"fmt"
	"net"
	"sync"
	"sync/atomic"
)

type ring struct {
	// endpoints are the set of endpoints which the driver will attempt to connect
	// to in the case it can not reach any of its hosts. They are also used to boot
	// strap the initial connection.
	endpoints []*HostInfo

	// hosts are the set of all hosts in the cassandra ring that we know of
	mu    sync.RWMutex
	hosts map[string]*HostInfo

	hostList []*HostInfo
	pos      uint32

	// TODO: we should store the ring metadata here also.
}

func (r *ring) rrHost() *HostInfo {
	// TODO: should we filter hosts that get used here? These hosts will be used
	// for the control connection, should we also provide an iterator?
	r.mu.RLock()
	defer r.mu.RUnlock()
	if len(r.hostList) == 0 {
		return nil
	}

	pos := int(atomic.AddUint32(&r.pos, 1) - 1)
	return r.hostList[pos%len(r.hostList)]
}

func (r *ring) getHost(ip net.IP) *HostInfo {
	r.mu.RLock()
	host := r.hosts[ip.String()]
	r.mu.RUnlock()
	return host
}

func (r *ring) allHosts() []*HostInfo {
	r.mu.RLock()
	hosts := make([]*HostInfo, 0, len(r.hosts))
	for _, host := range r.hosts {
		hosts = append(hosts, host)
	}
	r.mu.RUnlock()
	return hosts
}

func (r *ring) currentHosts() map[string]*HostInfo {
	r.mu.RLock()
	hosts := make(map[string]*HostInfo, len(r.hosts))
	for k, v := range r.hosts {
		hosts[k] = v
	}
	r.mu.RUnlock()
	return hosts
}

func (r *ring) addHost(host *HostInfo) bool {
	// TODO(zariel): key all host info by HostID instead of
	// ip addresses
	if host.invalidConnectAddr() {
		panic(fmt.Sprintf("invalid host: %v", host))
	}
	ip := host.ConnectAddress().String()

	r.mu.Lock()
	if r.hosts == nil {
		r.hosts = make(map[string]*HostInfo)
	}

	_, ok := r.hosts[ip]
	if !ok {
		r.hostList = append(r.hostList, host)
	}

	r.hosts[ip] = host
	r.mu.Unlock()
	return ok
}

func (r *ring) addOrUpdate(host *HostInfo) *HostInfo {
	if existingHost, ok := r.addHostIfMissing(host); ok {
		existingHost.update(host)
		host = existingHost
	}
	return host
}

func (r *ring) addHostIfMissing(host *HostInfo) (*HostInfo, bool) {
	if host.invalidConnectAddr() {
		panic(fmt.Sprintf("invalid host: %v", host))
	}
	ip := host.ConnectAddress().String()

	r.mu.Lock()
	if r.hosts == nil {
		r.hosts = make(map[string]*HostInfo)
	}

	existing, ok := r.hosts[ip]
	if !ok {
		r.hosts[ip] = host
		existing = host
		r.hostList = append(r.hostList, host)
	}
	r.mu.Unlock()
	return existing, ok
}

func (r *ring) removeHost(ip net.IP) bool {
	r.mu.Lock()
	if r.hosts == nil {
		r.hosts = make(map[string]*HostInfo)
	}

	k := ip.String()
	_, ok := r.hosts[k]
	if ok {
		for i, host := range r.hostList {
			if host.ConnectAddress().Equal(ip) {
				r.hostList = append(r.hostList[:i], r.hostList[i+1:]...)
				break
			}
		}
	}
	delete(r.hosts, k)
	r.mu.Unlock()
	return ok
}

type clusterMetadata struct {
	mu          sync.RWMutex
	partitioner string
}

func (c *clusterMetadata) setPartitioner(partitioner string) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if c.partitioner != partitioner {
		// TODO: update other things now
		c.partitioner = partitioner
	}
}
