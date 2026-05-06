// Copyright 2018 Prometheus Team
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package cluster

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"net"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	"github.com/hashicorp/memberlist"
	"github.com/oklog/ulid"
	"github.com/prometheus/client_golang/prometheus"
)

// ClusterPeer represents a single Peer in a gossip cluster.
type ClusterPeer interface {
	// Name returns the unique identifier of this peer in the cluster.
	Name() string
	// Status returns a status string representing the peer state.
	Status() string
	// Peers returns the peer nodes in the cluster.
	Peers() []ClusterMember
}

// ClusterMember interface that represents node peers in a cluster.
type ClusterMember interface {
	// Name returns the name of the node
	Name() string
	// Address returns the IP address of the node
	Address() string
}

// ClusterChannel supports state broadcasting across peers.
type ClusterChannel interface {
	Broadcast([]byte)
}

// Peer is a single peer in a gossip cluster.
type Peer struct {
	mlist    *memberlist.Memberlist
	delegate *delegate

	resolvedPeers []string

	mtx    sync.RWMutex
	states map[string]State
	stopc  chan struct{}
	readyc chan struct{}

	peerLock    sync.RWMutex
	peers       map[string]peer
	failedPeers []peer

	knownPeers    []string
	advertiseAddr string

	failedReconnectionsCounter prometheus.Counter
	reconnectionsCounter       prometheus.Counter
	failedRefreshCounter       prometheus.Counter
	refreshCounter             prometheus.Counter
	peerLeaveCounter           prometheus.Counter
	peerUpdateCounter          prometheus.Counter
	peerJoinCounter            prometheus.Counter

	logger log.Logger
}

// peer is an internal type used for bookkeeping. It holds the state of peers
// in the cluster.
type peer struct {
	status    PeerStatus
	leaveTime time.Time

	*memberlist.Node
}

// PeerStatus is the state that a peer is in.
type PeerStatus int

const (
	StatusNone PeerStatus = iota
	StatusAlive
	StatusFailed
)

func (s PeerStatus) String() string {
	switch s {
	case StatusNone:
		return "none"
	case StatusAlive:
		return "alive"
	case StatusFailed:
		return "failed"
	default:
		panic(fmt.Sprintf("unknown PeerStatus: %d", s))
	}
}

const (
	DefaultPushPullInterval  = 60 * time.Second
	DefaultGossipInterval    = 200 * time.Millisecond
	DefaultTCPTimeout        = 10 * time.Second
	DefaultProbeTimeout      = 500 * time.Millisecond
	DefaultProbeInterval     = 1 * time.Second
	DefaultReconnectInterval = 10 * time.Second
	DefaultReconnectTimeout  = 6 * time.Hour
	DefaultRefreshInterval   = 15 * time.Second
	MaxGossipPacketSize      = 1400
)

func Create(
	l log.Logger,
	reg prometheus.Registerer,
	bindAddr string,
	advertiseAddr string,
	knownPeers []string,
	waitIfEmpty bool,
	pushPullInterval time.Duration,
	gossipInterval time.Duration,
	tcpTimeout time.Duration,
	probeTimeout time.Duration,
	probeInterval time.Duration,
	tlsTransportConfig *TLSTransportConfig,
	allowInsecureAdvertise bool,
	label string,
) (*Peer, error) {
	bindHost, bindPortStr, err := net.SplitHostPort(bindAddr)
	if err != nil {
		return nil, fmt.Errorf("invalid listen address: %w", err)
	}
	bindPort, err := strconv.Atoi(bindPortStr)
	if err != nil {
		return nil, fmt.Errorf("address %s: invalid port: %w", bindAddr, err)
	}

	var advertiseHost string
	var advertisePort int
	if advertiseAddr != "" {
		var advertisePortStr string
		advertiseHost, advertisePortStr, err = net.SplitHostPort(advertiseAddr)
		if err != nil {
			return nil, fmt.Errorf("invalid advertise address: %w", err)
		}
		advertisePort, err = strconv.Atoi(advertisePortStr)
		if err != nil {
			return nil, fmt.Errorf("address %s: invalid port: %w", advertiseAddr, err)
		}
	}

	resolvedPeers, err := resolvePeers(context.Background(), knownPeers, advertiseAddr, &net.Resolver{}, waitIfEmpty)
	if err != nil {
		return nil, fmt.Errorf("resolve peers: %w", err)
	}
	level.Debug(l).Log("msg", "resolved peers to following addresses", "peers", strings.Join(resolvedPeers, ","))

	// Initial validation of user-specified advertise address.
	addr, err := calculateAdvertiseAddress(bindHost, advertiseHost, allowInsecureAdvertise)
	if err != nil {
		level.Warn(l).Log("err", "couldn't deduce an advertise address: "+err.Error())
	} else if hasNonlocal(resolvedPeers) && isUnroutable(addr.String()) {
		level.Warn(l).Log("err", "this node advertises itself on an unroutable address", "addr", addr.String())
		level.Warn(l).Log("err", "this node will be unreachable in the cluster")
		level.Warn(l).Log("err", "provide --cluster.advertise-address as a routable IP address or hostname")
	} else if isAny(bindAddr) && advertiseHost == "" {
		// memberlist doesn't advertise properly when the bind address is empty or unspecified.
		level.Info(l).Log("msg", "setting advertise address explicitly", "addr", addr.String(), "port", bindPort)
		advertiseHost = addr.String()
		advertisePort = bindPort
	}

	// TODO(fabxc): generate human-readable but random names?
	name, err := ulid.New(ulid.Now(), rand.New(rand.NewSource(time.Now().UnixNano())))
	if err != nil {
		return nil, err
	}

	p := &Peer{
		states:        map[string]State{},
		stopc:         make(chan struct{}),
		readyc:        make(chan struct{}),
		logger:        l,
		peers:         map[string]peer{},
		resolvedPeers: resolvedPeers,
		knownPeers:    knownPeers,
	}

	p.register(reg, name.String())

	retransmit := len(knownPeers) / 2
	if retransmit < 3 {
		retransmit = 3
	}
	p.delegate = newDelegate(l, reg, p, retransmit)

	cfg := memberlist.DefaultLANConfig()
	cfg.Name = name.String()
	cfg.BindAddr = bindHost
	cfg.BindPort = bindPort
	cfg.Delegate = p.delegate
	cfg.Ping = p.delegate
	cfg.Alive = p.delegate
	cfg.Events = p.delegate
	cfg.GossipInterval = gossipInterval
	cfg.PushPullInterval = pushPullInterval
	cfg.TCPTimeout = tcpTimeout
	cfg.ProbeTimeout = probeTimeout
	cfg.ProbeInterval = probeInterval
	cfg.LogOutput = &logWriter{l: l}
	cfg.GossipNodes = retransmit
	cfg.UDPBufferSize = MaxGossipPacketSize
	cfg.Label = label

	if advertiseHost != "" {
		cfg.AdvertiseAddr = advertiseHost
		cfg.AdvertisePort = advertisePort
		p.setInitialFailed(resolvedPeers, fmt.Sprintf("%s:%d", advertiseHost, advertisePort))
	} else {
		p.setInitialFailed(resolvedPeers, bindAddr)
	}

	if tlsTransportConfig != nil {
		level.Info(l).Log("msg", "using TLS for gossip")
		cfg.Transport, err = NewTLSTransport(context.Background(), l, reg, cfg.BindAddr, cfg.BindPort, tlsTransportConfig)
		if err != nil {
			return nil, fmt.Errorf("tls transport: %w", err)
		}
	}

	ml, err := memberlist.Create(cfg)
	if err != nil {
		return nil, fmt.Errorf("create memberlist: %w", err)
	}
	p.mlist = ml
	return p, nil
}

func (p *Peer) Join(
	reconnectInterval time.Duration,
	reconnectTimeout time.Duration,
) error {
	n, err := p.mlist.Join(p.resolvedPeers)
	if err != nil {
		level.Warn(p.logger).Log("msg", "failed to join cluster", "err", err)
		if reconnectInterval != 0 {
			level.Info(p.logger).Log("msg", fmt.Sprintf("will retry joining cluster every %v", reconnectInterval.String()))
		}
	} else {
		level.Debug(p.logger).Log("msg", "joined cluster", "peers", n)
	}

	if reconnectInterval != 0 {
		go p.runPeriodicTask(
			reconnectInterval,
			p.reconnect,
		)
	}
	if reconnectTimeout != 0 {
		go p.runPeriodicTask(
			5*time.Minute,
			func() { p.removeFailedPeers(reconnectTimeout) },
		)
	}
	go p.runPeriodicTask(
		DefaultRefreshInterval,
		p.refresh,
	)

	return err
}

// All peers are initially added to the failed list. They will be removed from
// this list in peerJoin when making their initial connection.
func (p *Peer) setInitialFailed(peers []string, myAddr string) {
	if len(peers) == 0 {
		return
	}

	p.peerLock.Lock()
	defer p.peerLock.Unlock()

	now := time.Now()
	for _, peerAddr := range peers {
		if peerAddr == myAddr {
			// Don't add ourselves to the initially failing list,
			// we don't connect to ourselves.
			continue
		}
		host, port, err := net.SplitHostPort(peerAddr)
		if err != nil {
			continue
		}
		ip := net.ParseIP(host)
		if ip == nil {
			// Don't add textual addresses since memberlist only advertises
			// dotted decimal or IPv6 addresses.
			continue
		}
		portUint, err := strconv.ParseUint(port, 10, 16)
		if err != nil {
			continue
		}

		pr := peer{
			status:    StatusFailed,
			leaveTime: now,
			Node: &memberlist.Node{
				Addr: ip,
				Port: uint16(portUint),
			},
		}
		p.failedPeers = append(p.failedPeers, pr)
		p.peers[peerAddr] = pr
	}
}

type logWriter struct {
	l log.Logger
}

func (l *logWriter) Write(b []byte) (int, error) {
	return len(b), level.Debug(l.l).Log("memberlist", string(b))
}

func (p *Peer) register(reg prometheus.Registerer, name string) {
	peerInfo := prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name:        "alertmanager_cluster_peer_info",
			Help:        "A metric with a constant '1' value labeled by peer name.",
			ConstLabels: prometheus.Labels{"peer": name},
		},
	)
	peerInfo.Set(1)
	clusterFailedPeers := prometheus.NewGaugeFunc(prometheus.GaugeOpts{
		Name: "alertmanager_cluster_failed_peers",
		Help: "Number indicating the current number of failed peers in the cluster.",
	}, func() float64 {
		p.peerLock.RLock()
		defer p.peerLock.RUnlock()

		return float64(len(p.failedPeers))
	})
	p.failedReconnectionsCounter = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "alertmanager_cluster_reconnections_failed_total",
		Help: "A counter of the number of failed cluster peer reconnection attempts.",
	})

	p.reconnectionsCounter = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "alertmanager_cluster_reconnections_total",
		Help: "A counter of the number of cluster peer reconnections.",
	})

	p.failedRefreshCounter = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "alertmanager_cluster_refresh_join_failed_total",
		Help: "A counter of the number of failed cluster peer joined attempts via refresh.",
	})
	p.refreshCounter = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "alertmanager_cluster_refresh_join_total",
		Help: "A counter of the number of cluster peer joined via refresh.",
	})

	p.peerLeaveCounter = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "alertmanager_cluster_peers_left_total",
		Help: "A counter of the number of peers that have left.",
	})
	p.peerUpdateCounter = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "alertmanager_cluster_peers_update_total",
		Help: "A counter of the number of peers that have updated metadata.",
	})
	p.peerJoinCounter = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "alertmanager_cluster_peers_joined_total",
		Help: "A counter of the number of peers that have joined.",
	})

	reg.MustRegister(peerInfo, clusterFailedPeers, p.failedReconnectionsCounter, p.reconnectionsCounter,
		p.peerLeaveCounter, p.peerUpdateCounter, p.peerJoinCounter, p.refreshCounter, p.failedRefreshCounter)
}

func (p *Peer) runPeriodicTask(d time.Duration, f func()) {
	tick := time.NewTicker(d)
	defer tick.Stop()

	for {
		select {
		case <-p.stopc:
			return
		case <-tick.C:
			f()
		}
	}
}

func (p *Peer) removeFailedPeers(timeout time.Duration) {
	p.peerLock.Lock()
	defer p.peerLock.Unlock()

	now := time.Now()

	keep := make([]peer, 0, len(p.failedPeers))
	for _, pr := range p.failedPeers {
		if pr.leaveTime.Add(timeout).After(now) {
			keep = append(keep, pr)
		} else {
			level.Debug(p.logger).Log("msg", "failed peer has timed out", "peer", pr.Node, "addr", pr.Address())
			delete(p.peers, pr.Name)
		}
	}

	p.failedPeers = keep
}

func (p *Peer) reconnect() {
	p.peerLock.RLock()
	failedPeers := p.failedPeers
	p.peerLock.RUnlock()

	logger := log.With(p.logger, "msg", "reconnect")
	for _, pr := range failedPeers {
		// No need to do book keeping on failedPeers here. If a
		// reconnect is successful, they will be announced in
		// peerJoin().
		if _, err := p.mlist.Join([]string{pr.Address()}); err != nil {
			p.failedReconnectionsCounter.Inc()
			level.Debug(logger).Log("result", "failure", "peer", pr.Node, "addr", pr.Address(), "err", err)
		} else {
			p.reconnectionsCounter.Inc()
			level.Debug(logger).Log("result", "success", "peer", pr.Node, "addr", pr.Address())
		}
	}
}

func (p *Peer) refresh() {
	logger := log.With(p.logger, "msg", "refresh")

	resolvedPeers, err := resolvePeers(context.Background(), p.knownPeers, p.advertiseAddr, &net.Resolver{}, false)
	if err != nil {
		level.Debug(logger).Log("peers", p.knownPeers, "err", err)
		return
	}

	members := p.mlist.Members()
	for _, peer := range resolvedPeers {
		var isPeerFound bool
		for _, member := range members {
			if member.Address() == peer {
				isPeerFound = true
				break
			}
		}

		if !isPeerFound {
			if _, err := p.mlist.Join([]string{peer}); err != nil {
				p.failedRefreshCounter.Inc()
				level.Warn(logger).Log("result", "failure", "addr", peer, "err", err)
			} else {
				p.refreshCounter.Inc()
				level.Debug(logger).Log("result", "success", "addr", peer)
			}
		}
	}
}

func (p *Peer) peerJoin(n *memberlist.Node) {
	p.peerLock.Lock()
	defer p.peerLock.Unlock()

	var oldStatus PeerStatus
	pr, ok := p.peers[n.Address()]
	if !ok {
		oldStatus = StatusNone
		pr = peer{
			status: StatusAlive,
			Node:   n,
		}
	} else {
		oldStatus = pr.status
		pr.Node = n
		pr.status = StatusAlive
		pr.leaveTime = time.Time{}
	}

	p.peers[n.Address()] = pr
	p.peerJoinCounter.Inc()

	if oldStatus == StatusFailed {
		level.Debug(p.logger).Log("msg", "peer rejoined", "peer", pr.Node)
		p.failedPeers = removeOldPeer(p.failedPeers, pr.Address())
	}
}

func (p *Peer) peerLeave(n *memberlist.Node) {
	p.peerLock.Lock()
	defer p.peerLock.Unlock()

	pr, ok := p.peers[n.Address()]
	if !ok {
		// Why are we receiving a leave notification from a node that
		// never joined?
		return
	}

	pr.status = StatusFailed
	pr.leaveTime = time.Now()
	p.failedPeers = append(p.failedPeers, pr)
	p.peers[n.Address()] = pr

	p.peerLeaveCounter.Inc()
	level.Debug(p.logger).Log("msg", "peer left", "peer", pr.Node)
}

func (p *Peer) peerUpdate(n *memberlist.Node) {
	p.peerLock.Lock()
	defer p.peerLock.Unlock()

	pr, ok := p.peers[n.Address()]
	if !ok {
		// Why are we receiving an update from a node that never
		// joined?
		return
	}

	pr.Node = n
	p.peers[n.Address()] = pr

	p.peerUpdateCounter.Inc()
	level.Debug(p.logger).Log("msg", "peer updated", "peer", pr.Node)
}

// AddState adds a new state that will be gossiped. It returns a channel to which
// broadcast messages for the state can be sent.
func (p *Peer) AddState(key string, s State, reg prometheus.Registerer) ClusterChannel {
	p.mtx.Lock()
	p.states[key] = s
	p.mtx.Unlock()

	send := func(b []byte) {
		p.delegate.bcast.QueueBroadcast(simpleBroadcast(b))
	}
	peers := func() []*memberlist.Node {
		nodes := p.mlist.Members()
		for i, n := range nodes {
			if n.String() == p.Self().Name {
				nodes = append(nodes[:i], nodes[i+1:]...)
				break
			}
		}
		return nodes
	}
	sendOversize := func(n *memberlist.Node, b []byte) error {
		return p.mlist.SendReliable(n, b)
	}
	return NewChannel(key, send, peers, sendOversize, p.logger, p.stopc, reg)
}

// Leave the cluster, waiting up to timeout.
func (p *Peer) Leave(timeout time.Duration) error {
	close(p.stopc)
	level.Debug(p.logger).Log("msg", "leaving cluster")
	return p.mlist.Leave(timeout)
}

// Name returns the unique ID of this peer in the cluster.
func (p *Peer) Name() string {
	return p.mlist.LocalNode().Name
}

// ClusterSize returns the current number of alive members in the cluster.
func (p *Peer) ClusterSize() int {
	return p.mlist.NumMembers()
}

// Return true when router has settled.
func (p *Peer) Ready() bool {
	select {
	case <-p.readyc:
		return true
	default:
	}
	return false
}

// Wait until Settle() has finished.
func (p *Peer) WaitReady(ctx context.Context) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-p.readyc:
		return nil
	}
}

// Return a status string representing the peer state.
func (p *Peer) Status() string {
	if p.Ready() {
		return "ready"
	}

	return "settling"
}

// Info returns a JSON-serializable dump of cluster state.
// Useful for debug.
func (p *Peer) Info() map[string]interface{} {
	p.mtx.RLock()
	defer p.mtx.RUnlock()

	return map[string]interface{}{
		"self":    p.mlist.LocalNode(),
		"members": p.mlist.Members(),
	}
}

// Self returns the node information about the peer itself.
func (p *Peer) Self() *memberlist.Node {
	return p.mlist.LocalNode()
}

// Member represents a member in the cluster.
type Member struct {
	node *memberlist.Node
}

// Name implements cluster.ClusterMember.
func (m Member) Name() string { return m.node.Name }

// Address implements cluster.ClusterMember.
func (m Member) Address() string { return m.node.Address() }

// Peers returns the peers in the cluster.
func (p *Peer) Peers() []ClusterMember {
	peers := make([]ClusterMember, 0, len(p.mlist.Members()))
	for _, member := range p.mlist.Members() {
		peers = append(peers, Member{
			node: member,
		})
	}
	return peers
}

// Position returns the position of the peer in the cluster.
func (p *Peer) Position() int {
	all := p.mlist.Members()
	sort.Slice(all, func(i, j int) bool {
		return all[i].Name < all[j].Name
	})

	k := 0
	for _, n := range all {
		if n.Name == p.Self().Name {
			break
		}
		k++
	}
	return k
}

// Settle waits until the mesh is ready (and sets the appropriate internal state when it is).
// The idea is that we don't want to start "working" before we get a chance to know most of the alerts and/or silences.
// Inspired from https://github.com/apache/cassandra/blob/7a40abb6a5108688fb1b10c375bb751cbb782ea4/src/java/org/apache/cassandra/gms/Gossiper.java
// This is clearly not perfect or strictly correct but should prevent the alertmanager to send notification before it is obviously not ready.
// This is especially important for those that do not have persistent storage.
func (p *Peer) Settle(ctx context.Context, interval time.Duration) {
	const NumOkayRequired = 3
	level.Info(p.logger).Log("msg", "Waiting for gossip to settle...", "interval", interval)
	start := time.Now()
	nPeers := 0
	nOkay := 0
	totalPolls := 0
	for {
		select {
		case <-ctx.Done():
			elapsed := time.Since(start)
			level.Info(p.logger).Log("msg", "gossip not settled but continuing anyway", "polls", totalPolls, "elapsed", elapsed)
			close(p.readyc)
			return
		case <-time.After(interval):
		}
		elapsed := time.Since(start)
		n := len(p.Peers())
		if nOkay >= NumOkayRequired {
			level.Info(p.logger).Log("msg", "gossip settled; proceeding", "elapsed", elapsed)
			break
		}
		if n == nPeers {
			nOkay++
			level.Debug(p.logger).Log("msg", "gossip looks settled", "elapsed", elapsed)
		} else {
			nOkay = 0
			level.Info(p.logger).Log("msg", "gossip not settled", "polls", totalPolls, "before", nPeers, "now", n, "elapsed", elapsed)
		}
		nPeers = n
		totalPolls++
	}
	close(p.readyc)
}

// State is a piece of state that can be serialized and merged with other
// serialized state.
type State interface {
	// MarshalBinary serializes the underlying state.
	MarshalBinary() ([]byte, error)

	// Merge merges serialized state into the underlying state.
	Merge(b []byte) error
}

// We use a simple broadcast implementation in which items are never invalidated by others.
type simpleBroadcast []byte

func (b simpleBroadcast) Message() []byte                       { return []byte(b) }
func (b simpleBroadcast) Invalidates(memberlist.Broadcast) bool { return false }
func (b simpleBroadcast) Finished()                             {}

func resolvePeers(ctx context.Context, peers []string, myAddress string, res *net.Resolver, waitIfEmpty bool) ([]string, error) {
	var resolvedPeers []string

	for _, peer := range peers {
		host, port, err := net.SplitHostPort(peer)
		if err != nil {
			return nil, fmt.Errorf("split host/port for peer %s: %w", peer, err)
		}

		retryCtx, cancel := context.WithCancel(ctx)
		defer cancel()

		ips, err := res.LookupIPAddr(ctx, host)
		if err != nil {
			// Assume direct address.
			resolvedPeers = append(resolvedPeers, peer)
			continue
		}

		if len(ips) == 0 {
			var lookupErrSpotted bool

			err := retry(2*time.Second, retryCtx.Done(), func() error {
				if lookupErrSpotted {
					// We need to invoke cancel in next run of retry when lookupErrSpotted to preserve LookupIPAddr error.
					cancel()
				}

				ips, err = res.LookupIPAddr(retryCtx, host)
				if err != nil {
					lookupErrSpotted = true
					return fmt.Errorf("IP Addr lookup for peer %s: %w", peer, err)
				}

				ips = removeMyAddr(ips, port, myAddress)
				if len(ips) == 0 {
					if !waitIfEmpty {
						return nil
					}
					return errors.New("empty IPAddr result. Retrying")
				}

				return nil
			})
			if err != nil {
				return nil, err
			}
		}

		for _, ip := range ips {
			resolvedPeers = append(resolvedPeers, net.JoinHostPort(ip.String(), port))
		}
	}

	return resolvedPeers, nil
}

func removeMyAddr(ips []net.IPAddr, targetPort, myAddr string) []net.IPAddr {
	var result []net.IPAddr

	for _, ip := range ips {
		if net.JoinHostPort(ip.String(), targetPort) == myAddr {
			continue
		}
		result = append(result, ip)
	}

	return result
}

func hasNonlocal(clusterPeers []string) bool {
	for _, peer := range clusterPeers {
		if host, _, err := net.SplitHostPort(peer); err == nil {
			peer = host
		}
		if ip := net.ParseIP(peer); ip != nil && !ip.IsLoopback() {
			return true
		} else if ip == nil && strings.ToLower(peer) != "localhost" {
			return true
		}
	}
	return false
}

func isUnroutable(addr string) bool {
	if host, _, err := net.SplitHostPort(addr); err == nil {
		addr = host
	}
	if ip := net.ParseIP(addr); ip != nil && (ip.IsUnspecified() || ip.IsLoopback()) {
		return true // typically 0.0.0.0 or localhost
	} else if ip == nil && strings.ToLower(addr) == "localhost" {
		return true
	}
	return false
}

func isAny(addr string) bool {
	if host, _, err := net.SplitHostPort(addr); err == nil {
		addr = host
	}
	return addr == "" || net.ParseIP(addr).IsUnspecified()
}

// retry executes f every interval seconds until timeout or no error is returned from f.
func retry(interval time.Duration, stopc <-chan struct{}, f func() error) error {
	tick := time.NewTicker(interval)
	defer tick.Stop()

	var err error
	for {
		if err = f(); err == nil {
			return nil
		}
		select {
		case <-stopc:
			return err
		case <-tick.C:
		}
	}
}

func removeOldPeer(old []peer, addr string) []peer {
	new := make([]peer, 0, len(old))
	for _, p := range old {
		if p.Address() != addr {
			new = append(new, p)
		}
	}

	return new
}
