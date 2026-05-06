package jumphash

import (
	"net"
	"strings"
	"sync"

	"github.com/cespare/xxhash"
	"github.com/facette/natsort"
	"github.com/go-kit/log/level"
	"github.com/grafana/gomemcache/memcache"

	util_log "github.com/grafana/loki/v3/pkg/util/log"
)

// Selector implements the memcache.ServerSelector
// interface. Selector utilizes a jump hash to
// distribute keys to servers.
//
// While adding or removing servers only requires 1/N keys to move,
// servers are treated as a stack and can only be pushed/popped.
// Therefore, Selector works best for servers
// with consistent DNS names where the naturally sorted order
// is predictable.
type Selector struct {
	mu              sync.RWMutex
	addrs           []net.Addr
	resolveUnixAddr UnixResolver
	resolveTCPAddr  TCPResolver
}

type UnixResolver func(network, address string) (*net.UnixAddr, error)

type TCPResolver func(network, address string) (*net.TCPAddr, error)

func NewSelector(resolveUnixAddr UnixResolver, resolveTCPAddr TCPResolver) *Selector {
	return &Selector{
		resolveUnixAddr: resolveUnixAddr,
		resolveTCPAddr:  resolveTCPAddr,
	}
}

func DefaultSelector() *Selector {
	return &Selector{
		resolveUnixAddr: net.ResolveUnixAddr,
		resolveTCPAddr:  net.ResolveTCPAddr,
	}
}

// staticAddr caches the Network() and String() values from
// any net.Addr.
//
// Copied from github.com/grafana/gomemcache/selector.go.
type staticAddr struct {
	network, str string
}

func newStaticAddr(a net.Addr) net.Addr {
	return &staticAddr{
		network: a.Network(),
		str:     a.String(),
	}
}

func (a *staticAddr) Network() string { return a.network }
func (a *staticAddr) String() string  { return a.str }

// SetServers changes a MemcachedJumpHashSelector's set of servers at
// runtime and is safe for concurrent use by multiple goroutines.
//
// Each server is given equal weight. A server is given more weight
// if it's listed multiple times.
//
// SetServers returns an error if any of the server names fail to
// resolve. No attempt is made to connect to the server. If any
// error occurs, no changes are made to the internal server list.
//
// To minimize the number of rehashes for keys when scaling the
// number of servers in subsequent calls to SetServers, servers
// are stored in natural sort order.
func (s *Selector) SetServers(servers ...string) error {
	sortedServers := make([]string, len(servers))
	copy(sortedServers, servers)
	natsort.Sort(sortedServers)

	naddrs := make([]net.Addr, len(sortedServers))
	for i, server := range sortedServers {
		if strings.Contains(server, "/") {
			addr, err := s.resolveUnixAddr("unix", server)
			if err != nil {
				level.Error(util_log.Logger).Log("msg", "could not resolve UNIX address of server", "server", server, "err", err)
				return err
			}
			naddrs[i] = newStaticAddr(addr)
		} else {
			tcpAddr, err := s.resolveTCPAddr("tcp", server)
			if err != nil {
				level.Error(util_log.Logger).Log("msg", "could not resolve TCP address of server", "server", server, "err", err)
				return err
			}
			naddrs[i] = newStaticAddr(tcpAddr)
		}
	}

	level.Debug(util_log.Logger).Log("msg", "updating memcached servers", "servers", strings.Join(addresses(naddrs), ","), "count", len(naddrs))

	s.mu.Lock()
	defer s.mu.Unlock()
	s.addrs = naddrs
	return nil
}

func addresses(addrs []net.Addr) []string {
	servers := make([]string, len(addrs))
	for i, addr := range addrs {
		servers[i] = addr.String()
	}
	return servers
}

// jumpHash consistently chooses a hash bucket number in the range [0, numBuckets) for the given key.
// numBuckets must be >= 1.
//
// Copied from github.com/dgryski/go-jump/blob/master/jump.go
func jumpHash(key uint64, numBuckets int) int32 {

	var b int64 = -1
	var j int64

	for j < int64(numBuckets) {
		b = j
		key = key*2862933555777941757 + 1
		j = int64(float64(b+1) * (float64(int64(1)<<31) / float64((key>>33)+1)))
	}

	return int32(b)
}

// PickServer returns the server address that a given item
// should be shared onto.
func (s *Selector) PickServer(key string) (net.Addr, error) {
	return s.FromString(key)
}

func (s *Selector) FromString(key string) (net.Addr, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if len(s.addrs) == 0 {
		return nil, memcache.ErrNoServers
	} else if len(s.addrs) == 1 {
		return s.addrs[0], nil
	}
	cs := xxhash.Sum64String(key)
	idx := jumpHash(cs, len(s.addrs))
	return s.addrs[idx], nil
}

func (s *Selector) FromUInt64(key uint64) (net.Addr, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if len(s.addrs) == 0 {
		return nil, memcache.ErrNoServers
	} else if len(s.addrs) == 1 {
		return s.addrs[0], nil
	}
	idx := jumpHash(key, len(s.addrs))
	return s.addrs[idx], nil
}

// Each iterates over each server and calls the given function.
// If f returns a non-nil error, iteration will stop and that
// error will be returned.
func (s *Selector) Each(f func(net.Addr) error) error {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, def := range s.addrs {
		if err := f(def); err != nil {
			return err
		}
	}
	return nil
}

func (s *Selector) Addrs() []net.Addr {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.addrs
}
