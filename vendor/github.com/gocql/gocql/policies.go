// Copyright (c) 2012 The gocql Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.
//This file will be the future home for more policies
package gocql

import (
	"fmt"
	"math"
	"math/rand"
	"net"
	"sync"
	"sync/atomic"
	"time"

	"github.com/hailocab/go-hostpool"
)

// cowHostList implements a copy on write host list, its equivalent type is []*HostInfo
type cowHostList struct {
	list atomic.Value
	mu   sync.Mutex
}

func (c *cowHostList) String() string {
	return fmt.Sprintf("%+v", c.get())
}

func (c *cowHostList) get() []*HostInfo {
	// TODO(zariel): should we replace this with []*HostInfo?
	l, ok := c.list.Load().(*[]*HostInfo)
	if !ok {
		return nil
	}
	return *l
}

func (c *cowHostList) set(list []*HostInfo) {
	c.mu.Lock()
	c.list.Store(&list)
	c.mu.Unlock()
}

// add will add a host if it not already in the list
func (c *cowHostList) add(host *HostInfo) bool {
	c.mu.Lock()
	l := c.get()

	if n := len(l); n == 0 {
		l = []*HostInfo{host}
	} else {
		newL := make([]*HostInfo, n+1)
		for i := 0; i < n; i++ {
			if host.Equal(l[i]) {
				c.mu.Unlock()
				return false
			}
			newL[i] = l[i]
		}
		newL[n] = host
		l = newL
	}

	c.list.Store(&l)
	c.mu.Unlock()
	return true
}

func (c *cowHostList) update(host *HostInfo) {
	c.mu.Lock()
	l := c.get()

	if len(l) == 0 {
		c.mu.Unlock()
		return
	}

	found := false
	newL := make([]*HostInfo, len(l))
	for i := range l {
		if host.Equal(l[i]) {
			newL[i] = host
			found = true
		} else {
			newL[i] = l[i]
		}
	}

	if found {
		c.list.Store(&newL)
	}

	c.mu.Unlock()
}

func (c *cowHostList) remove(ip net.IP) bool {
	c.mu.Lock()
	l := c.get()
	size := len(l)
	if size == 0 {
		c.mu.Unlock()
		return false
	}

	found := false
	newL := make([]*HostInfo, 0, size)
	for i := 0; i < len(l); i++ {
		if !l[i].ConnectAddress().Equal(ip) {
			newL = append(newL, l[i])
		} else {
			found = true
		}
	}

	if !found {
		c.mu.Unlock()
		return false
	}

	newL = newL[:size-1 : size-1]
	c.list.Store(&newL)
	c.mu.Unlock()

	return true
}

// RetryableQuery is an interface that represents a query or batch statement that
// exposes the correct functions for the retry policy logic to evaluate correctly.
type RetryableQuery interface {
	Attempts() int
	GetConsistency() Consistency
}

// RetryPolicy interface is used by gocql to determine if a query can be attempted
// again after a retryable error has been received. The interface allows gocql
// users to implement their own logic to determine if a query can be attempted
// again.
//
// See SimpleRetryPolicy as an example of implementing and using a RetryPolicy
// interface.
type RetryPolicy interface {
	Attempt(RetryableQuery) bool
}

// SimpleRetryPolicy has simple logic for attempting a query a fixed number of times.
//
// See below for examples of usage:
//
//     //Assign to the cluster
//     cluster.RetryPolicy = &gocql.SimpleRetryPolicy{NumRetries: 3}
//
//     //Assign to a query
//     query.RetryPolicy(&gocql.SimpleRetryPolicy{NumRetries: 1})
//
type SimpleRetryPolicy struct {
	NumRetries int //Number of times to retry a query
}

// Attempt tells gocql to attempt the query again based on query.Attempts being less
// than the NumRetries defined in the policy.
func (s *SimpleRetryPolicy) Attempt(q RetryableQuery) bool {
	return q.Attempts() <= s.NumRetries
}

// ExponentialBackoffRetryPolicy sleeps between attempts
type ExponentialBackoffRetryPolicy struct {
	NumRetries int
	Min, Max   time.Duration
}

func (e *ExponentialBackoffRetryPolicy) Attempt(q RetryableQuery) bool {
	if q.Attempts() > e.NumRetries {
		return false
	}
	time.Sleep(e.napTime(q.Attempts()))
	return true
}

func (e *ExponentialBackoffRetryPolicy) napTime(attempts int) time.Duration {
	if e.Min <= 0 {
		e.Min = 100 * time.Millisecond
	}
	if e.Max <= 0 {
		e.Max = 10 * time.Second
	}
	minFloat := float64(e.Min)
	napDuration := minFloat * math.Pow(2, float64(attempts-1))
	// add some jitter
	napDuration += rand.Float64()*minFloat - (minFloat / 2)
	if napDuration > float64(e.Max) {
		return time.Duration(e.Max)
	}
	return time.Duration(napDuration)
}

type HostStateNotifier interface {
	AddHost(host *HostInfo)
	RemoveHost(host *HostInfo)
	HostUp(host *HostInfo)
	HostDown(host *HostInfo)
}

// HostSelectionPolicy is an interface for selecting
// the most appropriate host to execute a given query.
type HostSelectionPolicy interface {
	HostStateNotifier
	SetPartitioner
	//Pick returns an iteration function over selected hosts
	Pick(ExecutableQuery) NextHost
}

// SelectedHost is an interface returned when picking a host from a host
// selection policy.
type SelectedHost interface {
	Info() *HostInfo
	Mark(error)
}

type selectedHost HostInfo

func (host *selectedHost) Info() *HostInfo {
	return (*HostInfo)(host)
}

func (host *selectedHost) Mark(err error) {}

// NextHost is an iteration function over picked hosts
type NextHost func() SelectedHost

// RoundRobinHostPolicy is a round-robin load balancing policy, where each host
// is tried sequentially for each query.
func RoundRobinHostPolicy() HostSelectionPolicy {
	return &roundRobinHostPolicy{}
}

type roundRobinHostPolicy struct {
	hosts cowHostList
	pos   uint32
	mu    sync.RWMutex
}

func (r *roundRobinHostPolicy) SetPartitioner(partitioner string) {
	// noop
}

func (r *roundRobinHostPolicy) Pick(qry ExecutableQuery) NextHost {
	// i is used to limit the number of attempts to find a host
	// to the number of hosts known to this policy
	var i int
	return func() SelectedHost {
		hosts := r.hosts.get()
		if len(hosts) == 0 {
			return nil
		}

		// always increment pos to evenly distribute traffic in case of
		// failures
		pos := atomic.AddUint32(&r.pos, 1) - 1
		if i >= len(hosts) {
			return nil
		}
		host := hosts[(pos)%uint32(len(hosts))]
		i++
		return (*selectedHost)(host)
	}
}

func (r *roundRobinHostPolicy) AddHost(host *HostInfo) {
	r.hosts.add(host)
}

func (r *roundRobinHostPolicy) RemoveHost(host *HostInfo) {
	r.hosts.remove(host.ConnectAddress())
}

func (r *roundRobinHostPolicy) HostUp(host *HostInfo) {
	r.AddHost(host)
}

func (r *roundRobinHostPolicy) HostDown(host *HostInfo) {
	r.RemoveHost(host)
}

// TokenAwareHostPolicy is a token aware host selection policy, where hosts are
// selected based on the partition key, so queries are sent to the host which
// owns the partition. Fallback is used when routing information is not available.
func TokenAwareHostPolicy(fallback HostSelectionPolicy) HostSelectionPolicy {
	return &tokenAwareHostPolicy{fallback: fallback}
}

type tokenAwareHostPolicy struct {
	hosts       cowHostList
	mu          sync.RWMutex
	partitioner string
	tokenRing   *tokenRing
	fallback    HostSelectionPolicy
}

func (t *tokenAwareHostPolicy) SetPartitioner(partitioner string) {
	t.mu.Lock()
	defer t.mu.Unlock()

	if t.partitioner != partitioner {
		t.fallback.SetPartitioner(partitioner)
		t.partitioner = partitioner

		t.resetTokenRing()
	}
}

func (t *tokenAwareHostPolicy) AddHost(host *HostInfo) {
	t.mu.Lock()
	defer t.mu.Unlock()

	t.hosts.add(host)
	t.fallback.AddHost(host)

	t.resetTokenRing()
}

func (t *tokenAwareHostPolicy) RemoveHost(host *HostInfo) {
	t.mu.Lock()
	defer t.mu.Unlock()

	t.hosts.remove(host.ConnectAddress())
	t.fallback.RemoveHost(host)

	t.resetTokenRing()
}

func (t *tokenAwareHostPolicy) HostUp(host *HostInfo) {
	t.AddHost(host)
}

func (t *tokenAwareHostPolicy) HostDown(host *HostInfo) {
	t.RemoveHost(host)
}

func (t *tokenAwareHostPolicy) resetTokenRing() {
	if t.partitioner == "" {
		// partitioner not yet set
		return
	}

	// create a new token ring
	hosts := t.hosts.get()
	tokenRing, err := newTokenRing(t.partitioner, hosts)
	if err != nil {
		Logger.Printf("Unable to update the token ring due to error: %s", err)
		return
	}

	// replace the token ring
	t.tokenRing = tokenRing
}

func (t *tokenAwareHostPolicy) Pick(qry ExecutableQuery) NextHost {
	if qry == nil {
		return t.fallback.Pick(qry)
	}

	routingKey, err := qry.GetRoutingKey()
	if err != nil {
		return t.fallback.Pick(qry)
	}
	if routingKey == nil {
		return t.fallback.Pick(qry)
	}

	t.mu.RLock()
	// TODO retrieve a list of hosts based on the replication strategy
	host := t.tokenRing.GetHostForPartitionKey(routingKey)
	t.mu.RUnlock()

	if host == nil {
		return t.fallback.Pick(qry)
	}

	// scope these variables for the same lifetime as the iterator function
	var (
		hostReturned bool
		fallbackIter NextHost
	)

	return func() SelectedHost {
		if !hostReturned {
			hostReturned = true
			return (*selectedHost)(host)
		}

		// fallback
		if fallbackIter == nil {
			fallbackIter = t.fallback.Pick(qry)
		}

		fallbackHost := fallbackIter()

		// filter the token aware selected hosts from the fallback hosts
		if fallbackHost != nil && fallbackHost.Info() == host {
			fallbackHost = fallbackIter()
		}

		return fallbackHost
	}
}

// HostPoolHostPolicy is a host policy which uses the bitly/go-hostpool library
// to distribute queries between hosts and prevent sending queries to
// unresponsive hosts. When creating the host pool that is passed to the policy
// use an empty slice of hosts as the hostpool will be populated later by gocql.
// See below for examples of usage:
//
//     // Create host selection policy using a simple host pool
//     cluster.PoolConfig.HostSelectionPolicy = HostPoolHostPolicy(hostpool.New(nil))
//
//     // Create host selection policy using an epsilon greedy pool
//     cluster.PoolConfig.HostSelectionPolicy = HostPoolHostPolicy(
//         hostpool.NewEpsilonGreedy(nil, 0, &hostpool.LinearEpsilonValueCalculator{}),
//     )
//
func HostPoolHostPolicy(hp hostpool.HostPool) HostSelectionPolicy {
	return &hostPoolHostPolicy{hostMap: map[string]*HostInfo{}, hp: hp}
}

type hostPoolHostPolicy struct {
	hp      hostpool.HostPool
	mu      sync.RWMutex
	hostMap map[string]*HostInfo
}

func (r *hostPoolHostPolicy) SetHosts(hosts []*HostInfo) {
	peers := make([]string, len(hosts))
	hostMap := make(map[string]*HostInfo, len(hosts))

	for i, host := range hosts {
		ip := host.ConnectAddress().String()
		peers[i] = ip
		hostMap[ip] = host
	}

	r.mu.Lock()
	r.hp.SetHosts(peers)
	r.hostMap = hostMap
	r.mu.Unlock()
}

func (r *hostPoolHostPolicy) AddHost(host *HostInfo) {
	ip := host.ConnectAddress().String()

	r.mu.Lock()
	defer r.mu.Unlock()

	// If the host addr is present and isn't nil return
	if h, ok := r.hostMap[ip]; ok && h != nil {
		return
	}
	// otherwise, add the host to the map
	r.hostMap[ip] = host
	// and construct a new peer list to give to the HostPool
	hosts := make([]string, 0, len(r.hostMap))
	for addr := range r.hostMap {
		hosts = append(hosts, addr)
	}

	r.hp.SetHosts(hosts)
}

func (r *hostPoolHostPolicy) RemoveHost(host *HostInfo) {
	ip := host.ConnectAddress().String()

	r.mu.Lock()
	defer r.mu.Unlock()

	if _, ok := r.hostMap[ip]; !ok {
		return
	}

	delete(r.hostMap, ip)
	hosts := make([]string, 0, len(r.hostMap))
	for _, host := range r.hostMap {
		hosts = append(hosts, host.ConnectAddress().String())
	}

	r.hp.SetHosts(hosts)
}

func (r *hostPoolHostPolicy) HostUp(host *HostInfo) {
	r.AddHost(host)
}

func (r *hostPoolHostPolicy) HostDown(host *HostInfo) {
	r.RemoveHost(host)
}

func (r *hostPoolHostPolicy) SetPartitioner(partitioner string) {
	// noop
}

func (r *hostPoolHostPolicy) Pick(qry ExecutableQuery) NextHost {
	return func() SelectedHost {
		r.mu.RLock()
		defer r.mu.RUnlock()

		if len(r.hostMap) == 0 {
			return nil
		}

		hostR := r.hp.Get()
		host, ok := r.hostMap[hostR.Host()]
		if !ok {
			return nil
		}

		return selectedHostPoolHost{
			policy: r,
			info:   host,
			hostR:  hostR,
		}
	}
}

// selectedHostPoolHost is a host returned by the hostPoolHostPolicy and
// implements the SelectedHost interface
type selectedHostPoolHost struct {
	policy *hostPoolHostPolicy
	info   *HostInfo
	hostR  hostpool.HostPoolResponse
}

func (host selectedHostPoolHost) Info() *HostInfo {
	return host.info
}

func (host selectedHostPoolHost) Mark(err error) {
	ip := host.info.ConnectAddress().String()

	host.policy.mu.RLock()
	defer host.policy.mu.RUnlock()

	if _, ok := host.policy.hostMap[ip]; !ok {
		// host was removed between pick and mark
		return
	}

	host.hostR.Mark(err)
}

type dcAwareRR struct {
	local       string
	pos         uint32
	mu          sync.RWMutex
	localHosts  cowHostList
	remoteHosts cowHostList
}

// DCAwareRoundRobinPolicy is a host selection policies which will prioritize and
// return hosts which are in the local datacentre before returning hosts in all
// other datercentres
func DCAwareRoundRobinPolicy(localDC string) HostSelectionPolicy {
	return &dcAwareRR{
		local: localDC,
	}
}

func (d *dcAwareRR) AddHost(host *HostInfo) {
	if host.DataCenter() == d.local {
		d.localHosts.add(host)
	} else {
		d.remoteHosts.add(host)
	}
}

func (d *dcAwareRR) RemoveHost(host *HostInfo) {
	if host.DataCenter() == d.local {
		d.localHosts.remove(host.ConnectAddress())
	} else {
		d.remoteHosts.remove(host.ConnectAddress())
	}
}

func (d *dcAwareRR) HostUp(host *HostInfo) {
	d.AddHost(host)
}

func (d *dcAwareRR) HostDown(host *HostInfo) {
	d.RemoveHost(host)
}

func (d *dcAwareRR) SetPartitioner(p string) {}

func (d *dcAwareRR) Pick(q ExecutableQuery) NextHost {
	var i int
	return func() SelectedHost {
		var hosts []*HostInfo
		localHosts := d.localHosts.get()
		remoteHosts := d.remoteHosts.get()
		if len(localHosts) != 0 {
			hosts = localHosts
		} else {
			hosts = remoteHosts
		}
		if len(hosts) == 0 {
			return nil
		}

		// always increment pos to evenly distribute traffic in case of
		// failures
		pos := atomic.AddUint32(&d.pos, 1) - 1
		if i >= len(localHosts)+len(remoteHosts) {
			return nil
		}
		host := hosts[(pos)%uint32(len(hosts))]
		i++
		return (*selectedHost)(host)
	}
}
