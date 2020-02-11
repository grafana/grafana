package redis

import (
	"fmt"
	"math/rand"
	"sync"
	"sync/atomic"
	"time"

	"gopkg.in/redis.v5/internal"
	"gopkg.in/redis.v5/internal/hashtag"
	"gopkg.in/redis.v5/internal/pool"
	"gopkg.in/redis.v5/internal/proto"
)

var errClusterNoNodes = internal.RedisError("redis: cluster has no nodes")
var errNilClusterState = internal.RedisError("redis: cannot load cluster slots")

// ClusterOptions are used to configure a cluster client and should be
// passed to NewClusterClient.
type ClusterOptions struct {
	// A seed list of host:port addresses of cluster nodes.
	Addrs []string

	// The maximum number of retries before giving up. Command is retried
	// on network errors and MOVED/ASK redirects.
	// Default is 16.
	MaxRedirects int

	// Enables read queries for a connection to a Redis Cluster slave node.
	ReadOnly bool

	// Enables routing read-only queries to the closest master or slave node.
	RouteByLatency bool

	// Following options are copied from Options struct.

	Password string

	DialTimeout  time.Duration
	ReadTimeout  time.Duration
	WriteTimeout time.Duration

	// PoolSize applies per cluster node and not for the whole cluster.
	PoolSize           int
	PoolTimeout        time.Duration
	IdleTimeout        time.Duration
	IdleCheckFrequency time.Duration
}

func (opt *ClusterOptions) init() {
	if opt.MaxRedirects == -1 {
		opt.MaxRedirects = 0
	} else if opt.MaxRedirects == 0 {
		opt.MaxRedirects = 16
	}

	if opt.RouteByLatency {
		opt.ReadOnly = true
	}
}

func (opt *ClusterOptions) clientOptions() *Options {
	const disableIdleCheck = -1

	return &Options{
		Password: opt.Password,
		ReadOnly: opt.ReadOnly,

		DialTimeout:  opt.DialTimeout,
		ReadTimeout:  opt.ReadTimeout,
		WriteTimeout: opt.WriteTimeout,

		PoolSize:    opt.PoolSize,
		PoolTimeout: opt.PoolTimeout,
		IdleTimeout: opt.IdleTimeout,

		// IdleCheckFrequency is not copied to disable reaper
		IdleCheckFrequency: disableIdleCheck,
	}
}

//------------------------------------------------------------------------------

type clusterNode struct {
	Client  *Client
	Latency time.Duration
	loading time.Time
}

func newClusterNode(clOpt *ClusterOptions, addr string) *clusterNode {
	opt := clOpt.clientOptions()
	opt.Addr = addr
	node := clusterNode{
		Client: NewClient(opt),
	}

	if clOpt.RouteByLatency {
		node.updateLatency()
	}

	return &node
}

func (n *clusterNode) updateLatency() {
	const probes = 10
	for i := 0; i < probes; i++ {
		start := time.Now()
		n.Client.Ping()
		n.Latency += time.Since(start)
	}
	n.Latency = n.Latency / probes
}

func (n *clusterNode) Loading() bool {
	return !n.loading.IsZero() && time.Since(n.loading) < time.Minute
}

//------------------------------------------------------------------------------

type clusterNodes struct {
	opt *ClusterOptions

	mu     sync.RWMutex
	addrs  []string
	nodes  map[string]*clusterNode
	closed bool
}

func newClusterNodes(opt *ClusterOptions) *clusterNodes {
	return &clusterNodes{
		opt:   opt,
		nodes: make(map[string]*clusterNode),
	}
}

func (c *clusterNodes) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.closed {
		return nil
	}
	c.closed = true

	var firstErr error
	for _, node := range c.nodes {
		if err := node.Client.Close(); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	c.addrs = nil
	c.nodes = nil

	return firstErr
}

func (c *clusterNodes) All() ([]*clusterNode, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if c.closed {
		return nil, pool.ErrClosed
	}

	nodes := make([]*clusterNode, 0, len(c.nodes))
	for _, node := range c.nodes {
		nodes = append(nodes, node)
	}
	return nodes, nil
}

func (c *clusterNodes) Get(addr string) (*clusterNode, error) {
	var node *clusterNode
	var ok bool

	c.mu.RLock()
	if !c.closed {
		node, ok = c.nodes[addr]
	}
	c.mu.RUnlock()
	if ok {
		return node, nil
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	if c.closed {
		return nil, pool.ErrClosed
	}

	node, ok = c.nodes[addr]
	if ok {
		return node, nil
	}

	c.addrs = append(c.addrs, addr)
	node = newClusterNode(c.opt, addr)
	c.nodes[addr] = node
	return node, nil
}

func (c *clusterNodes) Random() (*clusterNode, error) {
	c.mu.RLock()
	closed := c.closed
	addrs := c.addrs
	c.mu.RUnlock()

	if closed {
		return nil, pool.ErrClosed
	}
	if len(addrs) == 0 {
		return nil, errClusterNoNodes
	}

	var nodeErr error
	for i := 0; i <= c.opt.MaxRedirects; i++ {
		n := rand.Intn(len(addrs))
		node, err := c.Get(addrs[n])
		if err != nil {
			return nil, err
		}

		nodeErr = node.Client.ClusterInfo().Err()
		if nodeErr == nil {
			return node, nil
		}
	}
	return nil, nodeErr
}

//------------------------------------------------------------------------------

type clusterState struct {
	nodes *clusterNodes
	slots [][]*clusterNode
}

func newClusterState(nodes *clusterNodes, slots []ClusterSlot) (*clusterState, error) {
	c := clusterState{
		nodes: nodes,
		slots: make([][]*clusterNode, hashtag.SlotNumber),
	}

	for _, slot := range slots {
		var nodes []*clusterNode
		for _, slotNode := range slot.Nodes {
			node, err := c.nodes.Get(slotNode.Addr)
			if err != nil {
				return nil, err
			}
			nodes = append(nodes, node)
		}

		for i := slot.Start; i <= slot.End; i++ {
			c.slots[i] = nodes
		}
	}

	return &c, nil
}

func (c *clusterState) slotMasterNode(slot int) (*clusterNode, error) {
	nodes := c.slotNodes(slot)
	if len(nodes) > 0 {
		return nodes[0], nil
	}
	return c.nodes.Random()
}

func (c *clusterState) slotSlaveNode(slot int) (*clusterNode, error) {
	nodes := c.slotNodes(slot)
	switch len(nodes) {
	case 0:
		return c.nodes.Random()
	case 1:
		return nodes[0], nil
	case 2:
		if slave := nodes[1]; !slave.Loading() {
			return slave, nil
		}
		return nodes[0], nil
	default:
		var slave *clusterNode
		for i := 0; i < 10; i++ {
			n := rand.Intn(len(nodes)-1) + 1
			slave = nodes[n]
			if !slave.Loading() {
				break
			}
		}
		return slave, nil
	}
}

func (c *clusterState) slotClosestNode(slot int) (*clusterNode, error) {
	const threshold = time.Millisecond

	nodes := c.slotNodes(slot)
	if len(nodes) == 0 {
		return c.nodes.Random()
	}

	var node *clusterNode
	for _, n := range nodes {
		if n.Loading() {
			continue
		}
		if node == nil || node.Latency-n.Latency > threshold {
			node = n
		}
	}
	return node, nil
}

func (c *clusterState) slotNodes(slot int) []*clusterNode {
	if slot < len(c.slots) {
		return c.slots[slot]
	}
	return nil
}

//------------------------------------------------------------------------------

// ClusterClient is a Redis Cluster client representing a pool of zero
// or more underlying connections. It's safe for concurrent use by
// multiple goroutines.
type ClusterClient struct {
	cmdable

	opt    *ClusterOptions
	cmds   map[string]*CommandInfo
	nodes  *clusterNodes
	_state atomic.Value

	// Reports where slots reloading is in progress.
	reloading uint32

	closed bool
}

// NewClusterClient returns a Redis Cluster client as described in
// http://redis.io/topics/cluster-spec.
func NewClusterClient(opt *ClusterOptions) *ClusterClient {
	opt.init()

	c := &ClusterClient{
		opt:   opt,
		nodes: newClusterNodes(opt),
	}
	c.cmdable.process = c.Process

	// Add initial nodes.
	for _, addr := range opt.Addrs {
		_, _ = c.nodes.Get(addr)
	}

	// Preload cluster slots.
	for i := 0; i < 10; i++ {
		state, err := c.reloadSlots()
		if err == nil {
			c._state.Store(state)
			break
		}
	}

	if opt.IdleCheckFrequency > 0 {
		go c.reaper(opt.IdleCheckFrequency)
	}

	return c
}

func (c *ClusterClient) state() *clusterState {
	v := c._state.Load()
	if v != nil {
		return v.(*clusterState)
	}
	c.lazyReloadSlots()
	return nil
}

func (c *ClusterClient) cmdSlotAndNode(state *clusterState, cmd Cmder) (int, *clusterNode, error) {
	if state == nil {
		node, err := c.nodes.Random()
		return 0, node, err
	}

	cmdInfo := c.cmds[cmd.name()]
	firstKey := cmd.arg(cmdFirstKeyPos(cmd, cmdInfo))
	slot := hashtag.Slot(firstKey)

	if cmdInfo != nil && cmdInfo.ReadOnly && c.opt.ReadOnly {
		if c.opt.RouteByLatency {
			node, err := state.slotClosestNode(slot)
			return slot, node, err
		}

		node, err := state.slotSlaveNode(slot)
		return slot, node, err
	}

	node, err := state.slotMasterNode(slot)
	return slot, node, err
}

func (c *ClusterClient) Watch(fn func(*Tx) error, keys ...string) error {
	state := c.state()

	var node *clusterNode
	var err error
	if state != nil && len(keys) > 0 {
		node, err = state.slotMasterNode(hashtag.Slot(keys[0]))
	} else {
		node, err = c.nodes.Random()
	}
	if err != nil {
		return err
	}
	return node.Client.Watch(fn, keys...)
}

// Close closes the cluster client, releasing any open resources.
//
// It is rare to Close a ClusterClient, as the ClusterClient is meant
// to be long-lived and shared between many goroutines.
func (c *ClusterClient) Close() error {
	return c.nodes.Close()
}

func (c *ClusterClient) Process(cmd Cmder) error {
	slot, node, err := c.cmdSlotAndNode(c.state(), cmd)
	if err != nil {
		cmd.setErr(err)
		return err
	}

	var ask bool
	for attempt := 0; attempt <= c.opt.MaxRedirects; attempt++ {
		if ask {
			pipe := node.Client.Pipeline()
			pipe.Process(NewCmd("ASKING"))
			pipe.Process(cmd)
			_, err = pipe.Exec()
			pipe.Close()
			ask = false
		} else {
			err = node.Client.Process(cmd)
		}

		// If there is no (real) error - we are done.
		if err == nil {
			return nil
		}

		// If slave is loading - read from master.
		if c.opt.ReadOnly && internal.IsLoadingError(err) {
			node.loading = time.Now()
			continue
		}

		// On network errors try random node.
		if internal.IsRetryableError(err) {
			node, err = c.nodes.Random()
			if err != nil {
				cmd.setErr(err)
				return err
			}
			continue
		}

		var moved bool
		var addr string
		moved, ask, addr = internal.IsMovedError(err)
		if moved || ask {
			state := c.state()
			if state != nil && slot >= 0 {
				master, _ := state.slotMasterNode(slot)
				if moved && (master == nil || master.Client.getAddr() != addr) {
					c.lazyReloadSlots()
				}
			}

			node, err = c.nodes.Get(addr)
			if err != nil {
				cmd.setErr(err)
				return err
			}

			continue
		}

		break
	}

	return cmd.Err()
}

// ForEachNode concurrently calls the fn on each ever known node in the cluster.
// It returns the first error if any.
func (c *ClusterClient) ForEachNode(fn func(client *Client) error) error {
	nodes, err := c.nodes.All()
	if err != nil {
		return err
	}

	var wg sync.WaitGroup
	errCh := make(chan error, 1)
	for _, node := range nodes {
		wg.Add(1)
		go func(node *clusterNode) {
			defer wg.Done()
			err := fn(node.Client)
			if err != nil {
				select {
				case errCh <- err:
				default:
				}
			}
		}(node)
	}
	wg.Wait()

	select {
	case err := <-errCh:
		return err
	default:
		return nil
	}
}

// ForEachMaster concurrently calls the fn on each master node in the cluster.
// It returns the first error if any.
func (c *ClusterClient) ForEachMaster(fn func(client *Client) error) error {
	state := c.state()
	if state == nil {
		return errNilClusterState
	}

	var wg sync.WaitGroup
	visited := make(map[*clusterNode]struct{})
	errCh := make(chan error, 1)
	for _, nodes := range state.slots {
		if len(nodes) == 0 {
			continue
		}

		master := nodes[0]
		if _, ok := visited[master]; ok {
			continue
		}
		visited[master] = struct{}{}

		wg.Add(1)
		go func(node *clusterNode) {
			defer wg.Done()
			err := fn(node.Client)
			if err != nil {
				select {
				case errCh <- err:
				default:
				}
			}
		}(master)
	}
	wg.Wait()

	select {
	case err := <-errCh:
		return err
	default:
		return nil
	}
}

// PoolStats returns accumulated connection pool stats.
func (c *ClusterClient) PoolStats() *PoolStats {
	var acc PoolStats

	nodes, err := c.nodes.All()
	if err != nil {
		return &acc
	}

	for _, node := range nodes {
		s := node.Client.connPool.Stats()
		acc.Requests += s.Requests
		acc.Hits += s.Hits
		acc.Timeouts += s.Timeouts
		acc.TotalConns += s.TotalConns
		acc.FreeConns += s.FreeConns
	}
	return &acc
}

func (c *ClusterClient) lazyReloadSlots() {
	if !atomic.CompareAndSwapUint32(&c.reloading, 0, 1) {
		return
	}

	go func() {
		for i := 0; i < 1000; i++ {
			state, err := c.reloadSlots()
			if err == pool.ErrClosed {
				break
			}
			if err == nil {
				c._state.Store(state)
				break
			}
			time.Sleep(time.Millisecond)
		}

		time.Sleep(3 * time.Second)
		atomic.StoreUint32(&c.reloading, 0)
	}()
}

func (c *ClusterClient) reloadSlots() (*clusterState, error) {
	node, err := c.nodes.Random()
	if err != nil {
		return nil, err
	}

	// TODO: fix race
	if c.cmds == nil {
		cmds, err := node.Client.Command().Result()
		if err != nil {
			return nil, err
		}
		c.cmds = cmds
	}

	slots, err := node.Client.ClusterSlots().Result()
	if err != nil {
		return nil, err
	}

	return newClusterState(c.nodes, slots)
}

// reaper closes idle connections to the cluster.
func (c *ClusterClient) reaper(idleCheckFrequency time.Duration) {
	ticker := time.NewTicker(idleCheckFrequency)
	defer ticker.Stop()

	for _ = range ticker.C {
		nodes, err := c.nodes.All()
		if err != nil {
			break
		}

		var n int
		for _, node := range nodes {
			nn, err := node.Client.connPool.(*pool.ConnPool).ReapStaleConns()
			if err != nil {
				internal.Logf("ReapStaleConns failed: %s", err)
			} else {
				n += nn
			}
		}

		s := c.PoolStats()
		internal.Logf(
			"reaper: removed %d stale conns (TotalConns=%d FreeConns=%d Requests=%d Hits=%d Timeouts=%d)",
			n, s.TotalConns, s.FreeConns, s.Requests, s.Hits, s.Timeouts,
		)
	}
}

func (c *ClusterClient) Pipeline() *Pipeline {
	pipe := Pipeline{
		exec: c.pipelineExec,
	}
	pipe.cmdable.process = pipe.Process
	pipe.statefulCmdable.process = pipe.Process
	return &pipe
}

func (c *ClusterClient) Pipelined(fn func(*Pipeline) error) ([]Cmder, error) {
	return c.Pipeline().pipelined(fn)
}

func (c *ClusterClient) pipelineExec(cmds []Cmder) error {
	cmdsMap, err := c.mapCmdsByNode(cmds)
	if err != nil {
		return err
	}

	for i := 0; i <= c.opt.MaxRedirects; i++ {
		failedCmds := make(map[*clusterNode][]Cmder)

		for node, cmds := range cmdsMap {
			cn, _, err := node.Client.conn()
			if err != nil {
				setCmdsErr(cmds, err)
				continue
			}

			err = c.pipelineProcessCmds(cn, cmds, failedCmds)
			node.Client.putConn(cn, err, false)
		}

		if len(failedCmds) == 0 {
			break
		}
		cmdsMap = failedCmds
	}

	var firstErr error
	for _, cmd := range cmds {
		if err := cmd.Err(); err != nil {
			firstErr = err
			break
		}
	}
	return firstErr
}

func (c *ClusterClient) mapCmdsByNode(cmds []Cmder) (map[*clusterNode][]Cmder, error) {
	state := c.state()
	cmdsMap := make(map[*clusterNode][]Cmder)
	for _, cmd := range cmds {
		_, node, err := c.cmdSlotAndNode(state, cmd)
		if err != nil {
			return nil, err
		}
		cmdsMap[node] = append(cmdsMap[node], cmd)
	}
	return cmdsMap, nil
}

func (c *ClusterClient) pipelineProcessCmds(
	cn *pool.Conn, cmds []Cmder, failedCmds map[*clusterNode][]Cmder,
) error {
	cn.SetWriteTimeout(c.opt.WriteTimeout)
	if err := writeCmd(cn, cmds...); err != nil {
		setCmdsErr(cmds, err)
		return err
	}

	// Set read timeout for all commands.
	cn.SetReadTimeout(c.opt.ReadTimeout)

	return c.pipelineReadCmds(cn, cmds, failedCmds)
}

func (c *ClusterClient) pipelineReadCmds(
	cn *pool.Conn, cmds []Cmder, failedCmds map[*clusterNode][]Cmder,
) error {
	var firstErr error
	for _, cmd := range cmds {
		err := cmd.readReply(cn)
		if err == nil {
			continue
		}

		if firstErr == nil {
			firstErr = err
		}

		err = c.checkMovedErr(cmd, failedCmds)
		if err != nil && firstErr == nil {
			firstErr = err
		}
	}
	return firstErr
}

func (c *ClusterClient) checkMovedErr(cmd Cmder, failedCmds map[*clusterNode][]Cmder) error {
	moved, ask, addr := internal.IsMovedError(cmd.Err())
	if moved {
		c.lazyReloadSlots()

		node, err := c.nodes.Get(addr)
		if err != nil {
			return err
		}

		failedCmds[node] = append(failedCmds[node], cmd)
	}
	if ask {
		node, err := c.nodes.Get(addr)
		if err != nil {
			return err
		}

		failedCmds[node] = append(failedCmds[node], NewCmd("ASKING"), cmd)
	}
	return nil
}

// TxPipeline acts like Pipeline, but wraps queued commands with MULTI/EXEC.
func (c *ClusterClient) TxPipeline() *Pipeline {
	pipe := Pipeline{
		exec: c.txPipelineExec,
	}
	pipe.cmdable.process = pipe.Process
	pipe.statefulCmdable.process = pipe.Process
	return &pipe
}

func (c *ClusterClient) TxPipelined(fn func(*Pipeline) error) ([]Cmder, error) {
	return c.Pipeline().pipelined(fn)
}

func (c *ClusterClient) txPipelineExec(cmds []Cmder) error {
	cmdsMap, err := c.mapCmdsBySlot(cmds)
	if err != nil {
		return err
	}

	state := c.state()
	if state == nil {
		return errNilClusterState
	}

	for slot, cmds := range cmdsMap {
		node, err := state.slotMasterNode(slot)
		if err != nil {
			setCmdsErr(cmds, err)
			continue
		}

		cmdsMap := map[*clusterNode][]Cmder{node: cmds}
		for i := 0; i <= c.opt.MaxRedirects; i++ {
			failedCmds := make(map[*clusterNode][]Cmder)

			for node, cmds := range cmdsMap {
				cn, _, err := node.Client.conn()
				if err != nil {
					setCmdsErr(cmds, err)
					continue
				}

				err = c.txPipelineProcessCmds(node, cn, cmds, failedCmds)
				node.Client.putConn(cn, err, false)
			}

			if len(failedCmds) == 0 {
				break
			}
			cmdsMap = failedCmds
		}
	}

	var firstErr error
	for _, cmd := range cmds {
		if err := cmd.Err(); err != nil {
			firstErr = err
			break
		}
	}
	return firstErr
}

func (c *ClusterClient) mapCmdsBySlot(cmds []Cmder) (map[int][]Cmder, error) {
	state := c.state()
	cmdsMap := make(map[int][]Cmder)
	for _, cmd := range cmds {
		slot, _, err := c.cmdSlotAndNode(state, cmd)
		if err != nil {
			return nil, err
		}
		cmdsMap[slot] = append(cmdsMap[slot], cmd)
	}
	return cmdsMap, nil
}

func (c *ClusterClient) txPipelineProcessCmds(
	node *clusterNode, cn *pool.Conn, cmds []Cmder, failedCmds map[*clusterNode][]Cmder,
) error {
	cn.SetWriteTimeout(c.opt.WriteTimeout)
	if err := txPipelineWriteMulti(cn, cmds); err != nil {
		setCmdsErr(cmds, err)
		failedCmds[node] = cmds
		return err
	}

	// Set read timeout for all commands.
	cn.SetReadTimeout(c.opt.ReadTimeout)

	if err := c.txPipelineReadQueued(cn, cmds, failedCmds); err != nil {
		return err
	}

	_, err := pipelineReadCmds(cn, cmds)
	return err
}

func (c *ClusterClient) txPipelineReadQueued(
	cn *pool.Conn, cmds []Cmder, failedCmds map[*clusterNode][]Cmder,
) error {
	var firstErr error

	// Parse queued replies.
	var statusCmd StatusCmd
	if err := statusCmd.readReply(cn); err != nil && firstErr == nil {
		firstErr = err
	}

	for _, cmd := range cmds {
		err := statusCmd.readReply(cn)
		if err == nil {
			continue
		}

		cmd.setErr(err)
		if firstErr == nil {
			firstErr = err
		}

		err = c.checkMovedErr(cmd, failedCmds)
		if err != nil && firstErr == nil {
			firstErr = err
		}
	}

	// Parse number of replies.
	line, err := cn.Rd.ReadLine()
	if err != nil {
		if err == Nil {
			err = TxFailedErr
		}
		return err
	}

	switch line[0] {
	case proto.ErrorReply:
		return proto.ParseErrorReply(line)
	case proto.ArrayReply:
		// ok
	default:
		err := fmt.Errorf("redis: expected '*', but got line %q", line)
		return err
	}

	return firstErr
}
