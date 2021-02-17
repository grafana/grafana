package redisc

import (
	"errors"
	"math/rand"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gomodule/redigo/redis"
)

const hashSlots = 16384

// Cluster manages a redis cluster. If the CreatePool field is not nil,
// a redis.Pool is used for each node in the cluster to get connections
// via Get. If it is nil or if Dial is called, redis.Dial
// is used to get the connection.
type Cluster struct {
	// StartupNodes is the list of initial nodes that make up
	// the cluster. The values are expected as "address:port"
	// (e.g.: "127.0.0.1:6379").
	StartupNodes []string

	// DialOptions is the list of options to set on each new connection.
	DialOptions []redis.DialOption

	// CreatePool is the function to call to create a redis.Pool for
	// the specified TCP address, using the provided options
	// as set in DialOptions. If this field is not nil, a
	// redis.Pool is created for each node in the cluster and the
	// pool is used to manage the connections returned by Get.
	CreatePool func(address string, options ...redis.DialOption) (*redis.Pool, error)

	// PoolWaitTime is the time to wait when getting a connection from
	// a pool configured with MaxActive > 0 and Wait set to true, and
	// MaxActive connections are already in use.
	//
	// If <= 0 (or with Go < 1.7), there is no wait timeout, it will wait
	// indefinitely if Pool.Wait is true.
	PoolWaitTime time.Duration

	mu         sync.RWMutex           // protects following fields
	err        error                  // broken connection error
	pools      map[string]*redis.Pool // created pools per node
	masters    map[string]bool        // set of known active master nodes, kept up-to-date
	replicas   map[string]bool        // set of known active replica nodes, kept up-to-date
	mapping    [hashSlots][]string    // hash slot number to master and replica(s) server addresses, master is always at [0]
	refreshing bool                   // indicates if there's a refresh in progress
}

// Refresh updates the cluster's internal mapping of hash slots
// to redis node. It calls CLUSTER SLOTS on each known node until one
// of them succeeds.
//
// It should typically be called after creating the Cluster and before
// using it. The cluster automatically keeps its mapping up-to-date
// afterwards, based on the redis commands' MOVED responses.
func (c *Cluster) Refresh() error {
	c.mu.Lock()
	err := c.err
	if err == nil {
		c.refreshing = true
	}
	c.mu.Unlock()
	if err != nil {
		return err
	}

	return c.refresh()
}

func (c *Cluster) refresh() error {
	var errMsgs []string

	addrs := c.getNodeAddrs(false)
	for _, addr := range addrs {
		m, err := c.getClusterSlots(addr)
		if err != nil {
			errMsgs = append(errMsgs, err.Error())
			continue
		}

		// succeeded, save as mapping
		c.mu.Lock()
		// mark all current nodes as false
		for k := range c.masters {
			c.masters[k] = false
		}
		for k := range c.replicas {
			c.replicas[k] = false
		}

		for _, sm := range m {
			for i, node := range sm.nodes {
				if node != "" {
					target := c.masters
					if i > 0 {
						target = c.replicas
					}
					target[node] = true
				}
			}
			for ix := sm.start; ix <= sm.end; ix++ {
				c.mapping[ix] = sm.nodes
			}
		}

		// remove all nodes that are gone from the cluster
		for _, nodes := range []map[string]bool{c.masters, c.replicas} {
			for k, ok := range nodes {
				if !ok {
					delete(nodes, k)

					// close and remove all existing pools for removed nodes
					if p := c.pools[k]; p != nil {
						p.Close()
						delete(c.pools, k)
					}
				}
			}
		}

		// mark that no refresh is needed until another MOVED
		c.refreshing = false
		c.mu.Unlock()

		return nil
	}

	// reset the refreshing flag
	c.mu.Lock()
	c.refreshing = false
	c.mu.Unlock()

	var sb strings.Builder
	sb.WriteString("redisc: all nodes failed")
	for _, msg := range errMsgs {
		sb.WriteByte('\n')
		sb.WriteString(msg)
	}
	return errors.New(sb.String())
}

// needsRefresh handles automatic update of the mapping.
func (c *Cluster) needsRefresh(re *RedirError) {
	c.mu.Lock()
	if re != nil {
		// update the mapping only if the address has changed, so that if
		// a READONLY replica read returns a MOVED to a master, it doesn't
		// overwrite that slot's replicas by setting just the master (i.e. this
		// is not a MOVED because the cluster is updating, it is a MOVED
		// because the replica cannot serve that key). Same goes for a request
		// to a random connection that gets a MOVED, should not overwrite
		// the moved-to slot's configuration if the master's address is the same.
		if current := c.mapping[re.NewSlot]; len(current) == 0 || current[0] != re.Addr {
			c.mapping[re.NewSlot] = []string{re.Addr}
		}
	}
	if !c.refreshing {
		// refreshing is reset to only once the goroutine has
		// finished updating the mapping, so a new refresh goroutine
		// will only be started if none is running.
		c.refreshing = true
		go c.refresh()
	}
	c.mu.Unlock()
}

type slotMapping struct {
	start, end int
	nodes      []string // master is always at [0]
}

func (c *Cluster) getClusterSlots(addr string) ([]slotMapping, error) {
	conn, err := c.getConnForAddr(addr, false)
	if err != nil {
		return nil, err
	}
	defer conn.Close()

	vals, err := redis.Values(conn.Do("CLUSTER", "SLOTS"))
	if err != nil {
		return nil, err
	}

	m := make([]slotMapping, 0, len(vals))
	for len(vals) > 0 {
		var slotRange []interface{}
		vals, err = redis.Scan(vals, &slotRange)
		if err != nil {
			return nil, err
		}

		var start, end int
		slotRange, err = redis.Scan(slotRange, &start, &end)
		if err != nil {
			return nil, err
		}

		sm := slotMapping{start: start, end: end}
		// store the master address and all replicas
		for len(slotRange) > 0 {
			var nodes []interface{}
			slotRange, err = redis.Scan(slotRange, &nodes)
			if err != nil {
				return nil, err
			}

			var addr string
			var port int
			if _, err = redis.Scan(nodes, &addr, &port); err != nil {
				return nil, err
			}
			sm.nodes = append(sm.nodes, addr+":"+strconv.Itoa(port))
		}

		m = append(m, sm)
	}

	return m, nil
}

func (c *Cluster) getConnForAddr(addr string, forceDial bool) (redis.Conn, error) {
	// non-pooled doesn't require a lock
	if c.CreatePool == nil || forceDial {
		return redis.Dial("tcp", addr, c.DialOptions...)
	}

	c.mu.Lock()

	p := c.pools[addr]
	if p == nil {
		c.mu.Unlock()
		pool, err := c.CreatePool(addr, c.DialOptions...)
		if err != nil {
			return nil, err
		}

		c.mu.Lock()
		// check again, concurrent request may have set the pool in the meantime
		if p = c.pools[addr]; p == nil {
			if c.pools == nil {
				c.pools = make(map[string]*redis.Pool, len(c.StartupNodes))
			}
			c.pools[addr] = pool
			p = pool
		} else {
			// Don't assume CreatePool just returned the pool struct, it may have
			// used a connection or something - always match CreatePool with Close.
			// Do it in a defer to keep lock time short.
			defer pool.Close()
		}
	}
	c.mu.Unlock()

	return c.getFromPool(p)
}

var errNoNodeForSlot = errors.New("redisc: no node for slot")

func (c *Cluster) getConnForSlot(slot int, forceDial, readOnly bool) (redis.Conn, string, error) {
	c.mu.Lock()
	addrs := c.mapping[slot]
	c.mu.Unlock()
	if len(addrs) == 0 {
		return nil, "", errNoNodeForSlot
	}

	// mapping slices are never altered, they are replaced when refreshing
	// or on a MOVED response, so it's non-racy to read them outside the lock.
	addr := addrs[0]
	if readOnly && len(addrs) > 1 {
		// get the address of a replica
		if len(addrs) == 2 {
			addr = addrs[1]
		} else {
			rnd.Lock()
			ix := rnd.Intn(len(addrs) - 1)
			rnd.Unlock()
			addr = addrs[ix+1] // +1 because 0 is the master
		}
	} else {
		readOnly = false
	}
	conn, err := c.getConnForAddr(addr, forceDial)
	if err == nil && readOnly {
		conn.Do("READONLY")
	}
	return conn, addr, err
}

// a *rand.Rand is not safe for concurrent access
var rnd = struct {
	sync.Mutex
	*rand.Rand
}{Rand: rand.New(rand.NewSource(time.Now().UnixNano()))}

func (c *Cluster) getRandomConn(forceDial, readOnly bool) (redis.Conn, string, error) {
	addrs := c.getNodeAddrs(readOnly)
	rnd.Lock()
	perms := rnd.Perm(len(addrs))
	rnd.Unlock()

	for _, ix := range perms {
		addr := addrs[ix]
		conn, err := c.getConnForAddr(addr, forceDial)
		if err == nil {
			if readOnly {
				conn.Do("READONLY")
			}
			return conn, addr, nil
		}
	}
	return nil, "", errors.New("redisc: failed to get a connection")
}

func (c *Cluster) getConn(preferredSlot int, forceDial, readOnly bool) (conn redis.Conn, addr string, err error) {
	if preferredSlot >= 0 {
		conn, addr, err = c.getConnForSlot(preferredSlot, forceDial, readOnly)
		if err == errNoNodeForSlot {
			c.needsRefresh(nil)
		}
	}
	if preferredSlot < 0 || err != nil {
		conn, addr, err = c.getRandomConn(forceDial, readOnly)
	}
	return conn, addr, err
}

func (c *Cluster) getNodeAddrs(preferReplicas bool) []string {
	c.mu.Lock()

	// populate nodes lazily, only once
	if c.masters == nil {
		c.masters = make(map[string]bool)
		c.replicas = make(map[string]bool)

		// StartupNodes should be masters
		for _, n := range c.StartupNodes {
			c.masters[n] = true
		}
	}

	from := c.masters
	if preferReplicas && len(c.replicas) > 0 {
		from = c.replicas
	}

	// grab a slice of addresses
	addrs := make([]string, 0, len(from))
	for addr := range from {
		addrs = append(addrs, addr)
	}
	c.mu.Unlock()

	return addrs
}

// Dial returns a connection the same way as Get, but
// it guarantees that the connection will not be managed by the
// pool, even if CreatePool is set. The actual returned
// type is *Conn, see its documentation for details.
func (c *Cluster) Dial() (redis.Conn, error) {
	c.mu.Lock()
	err := c.err
	c.mu.Unlock()

	if err != nil {
		return nil, err
	}

	return &Conn{
		cluster:   c,
		forceDial: true,
	}, nil
}

// Get returns a redis.Conn interface that can be used to call
// redis commands on the cluster. The application must close the
// returned connection. The actual returned type is *Conn,
// see its documentation for details.
func (c *Cluster) Get() redis.Conn {
	c.mu.Lock()
	err := c.err
	c.mu.Unlock()

	return &Conn{
		cluster: c,
		err:     err,
	}
}

// Close releases the resources used by the cluster. It closes all the
// pools that were created, if any.
func (c *Cluster) Close() error {
	c.mu.Lock()
	err := c.err
	if err == nil {
		c.err = errors.New("redisc: closed")
		for _, p := range c.pools {
			if e := p.Close(); e != nil && err == nil {
				err = e
			}
		}
	}
	c.mu.Unlock()

	return err
}

// Stats returns the current statistics for all pools. Keys are node's addresses.
func (c *Cluster) Stats() map[string]redis.PoolStats {
	c.mu.RLock()
	defer c.mu.RUnlock()

	stats := make(map[string]redis.PoolStats, len(c.pools))

	for address, pool := range c.pools {
		stats[address] = pool.Stats()
	}

	return stats
}
