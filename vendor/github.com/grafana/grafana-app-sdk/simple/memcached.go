package simple

import (
	"net"
	"sync"

	"github.com/bradfitz/gomemcache/memcache"

	"github.com/grafana/grafana-app-sdk/operator"
)

type MemcachedHostList struct {
	dnsMux     sync.Mutex
	endpoints  []string
	serverList *memcache.ServerList
}

// NewMemcachedHostList takes a list of endpoints and returns a MemcachedHostList which will resolve the hosts
// in the endpoints slice, which should be in the format [host]:[port].
// RefreshServers will re-resolve the endpoints for the MemcachedHostList.
func NewMemcachedHostList(endpoints []string) (*MemcachedHostList, error) {
	s := &MemcachedHostList{
		endpoints:  endpoints,
		serverList: &memcache.ServerList{},
	}
	// Resolve the initial list
	err := s.serverList.SetServers(endpoints...)
	return s, err
}

func (m *MemcachedHostList) PickServer(key string) (net.Addr, error) {
	return m.serverList.PickServer(key)
}

func (m *MemcachedHostList) Each(f func(net.Addr) error) error {
	return m.serverList.Each(f)
}

// RefreshServers re-resolves the endpoints for this MemcachedHostList.
// This can be used if the memcached client runs into a timeout or EOF due to the host IP changing.
func (m *MemcachedHostList) RefreshServers() error {
	m.dnsMux.Lock()
	defer m.dnsMux.Unlock()
	// Setting the ServerList with SetServers re-resolves the hosts to inet addresses
	return m.serverList.SetServers(m.endpoints...)
}

var _ operator.MemcachedServerSelector = &MemcachedHostList{}
