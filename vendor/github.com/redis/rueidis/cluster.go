package rueidis

import (
	"context"
	"errors"
	"io"
	"net"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	"github.com/redis/rueidis/internal/cmds"
	"github.com/redis/rueidis/internal/util"
)

// ErrNoSlot indicates that there is no redis node owning the key slot.
var ErrNoSlot = errors.New("the slot has no redis node")
var ErrReplicaOnlyConflict = errors.New("ReplicaOnly conflicts with SendToReplicas option")
var ErrInvalidShardsRefreshInterval = errors.New("ShardsRefreshInterval must be greater than or equal to 0")
var ErrReplicaOnlyConflictWithReplicaSelector = errors.New("ReplicaOnly conflicts with ReplicaSelector option")
var ErrReplicaOnlyConflictWithReadNodeSelector = errors.New("ReplicaOnly conflicts with ReadNodeSelector option")
var ErrReplicaSelectorConflictWithReadNodeSelector = errors.New("either set ReplicaSelector or ReadNodeSelector, not both")
var ErrSendToReplicasNotSet = errors.New("SendToReplicas must be set when ReplicaSelector is set")

type clusterClient struct {
	wslots       [16384]conn
	retryHandler retryHandler
	opt          *ClientOption
	rOpt         *ClientOption
	conns        map[string]connrole
	connFn       connFn
	stopCh       chan struct{}
	sc           call
	rslots       [][]NodeInfo
	mu           sync.RWMutex
	stop         uint32
	cmd          Builder
	retry        bool
	hasLftm      bool
}

// NOTE: connrole and conn must be initialized at the same time
type connrole struct {
	conn   conn
	hidden bool
	//replica bool <- this field is removed because a server may have mixed roles at the same time in the future. https://github.com/valkey-io/valkey/issues/1372
}

var replicaOnlySelector = func(_ uint16, replicas []NodeInfo) int {
	return util.FastRand(len(replicas))
}

func newClusterClient(opt *ClientOption, connFn connFn, retryer retryHandler) (*clusterClient, error) {
	client := &clusterClient{
		cmd:          cmds.NewBuilder(cmds.InitSlot),
		connFn:       connFn,
		opt:          opt,
		conns:        make(map[string]connrole),
		retry:        !opt.DisableRetry,
		retryHandler: retryer,
		stopCh:       make(chan struct{}),
		hasLftm:      opt.ConnLifetime > 0,
	}

	if opt.ReplicaOnly && opt.SendToReplicas != nil {
		return nil, ErrReplicaOnlyConflict
	}
	if opt.ReplicaOnly && opt.ReplicaSelector != nil {
		return nil, ErrReplicaOnlyConflictWithReplicaSelector
	}
	if opt.ReplicaOnly && opt.ReadNodeSelector != nil {
		return nil, ErrReplicaOnlyConflictWithReadNodeSelector
	}
	if opt.ReplicaSelector != nil && opt.ReadNodeSelector != nil {
		return nil, ErrReplicaSelectorConflictWithReadNodeSelector
	}
	if opt.ReplicaSelector != nil && opt.SendToReplicas == nil {
		return nil, ErrSendToReplicasNotSet
	}
	if opt.SendToReplicas != nil && opt.ReplicaSelector == nil && opt.ReadNodeSelector == nil {
		opt.ReplicaSelector = replicaOnlySelector
	}

	if opt.SendToReplicas != nil {
		rOpt := *opt
		rOpt.ReplicaOnly = true
		client.rOpt = &rOpt
	}

	client.connFn = func(dst string, opt *ClientOption) conn {
		cc := connFn(dst, opt)
		cc.SetOnCloseHook(func(err error) {
			client.lazyRefresh()
		})
		return cc
	}

	if err := client.init(); err != nil {
		return nil, err
	}

	if err := client.refresh(context.Background()); err != nil {
		return client, err
	}

	if opt.ClusterOption.ShardsRefreshInterval > 0 {
		go client.runClusterTopologyRefreshment()
	} else if opt.ClusterOption.ShardsRefreshInterval < 0 {
		return nil, ErrInvalidShardsRefreshInterval
	}

	return client, nil
}

func (c *clusterClient) init() error {
	if len(c.opt.InitAddress) == 0 {
		return ErrNoAddr
	}
	results := make(chan error, len(c.opt.InitAddress))
	for _, addr := range c.opt.InitAddress {
		cc := c.connFn(addr, c.opt)
		go func(addr string, cc conn) {
			if err := cc.Dial(); err == nil {
				c.mu.Lock()
				if _, ok := c.conns[addr]; ok {
					go cc.Close() // abort the new connection instead of closing the old one, which may already been used
				} else {
					c.conns[addr] = connrole{
						conn: cc,
					}
				}
				c.mu.Unlock()
				results <- nil
			} else {
				results <- err
			}
		}(addr, cc)
	}
	es := make([]error, cap(results))
	for i := 0; i < cap(results); i++ {
		if err := <-results; err == nil {
			return nil
		} else {
			es[i] = err
		}
	}
	return es[0]
}

func (c *clusterClient) refresh(ctx context.Context) (err error) {
	return c.sc.Do(ctx, c._refresh)
}

func (c *clusterClient) lazyRefresh() {
	c.sc.LazyDo(time.Second, c._refresh)
}

type clusterslots struct {
	addr  string
	reply RedisResult
	ver   int
}

func (s clusterslots) parse(tls bool) map[string]group {
	if s.ver < 8 {
		return parseSlots(s.reply.val, s.addr)
	}
	return parseShards(s.reply.val, s.addr, tls)
}

func getClusterSlots(c conn, timeout time.Duration) clusterslots {
	var ctx context.Context
	var cancel context.CancelFunc
	if timeout > 0 {
		ctx, cancel = context.WithTimeout(context.Background(), timeout)
		defer cancel()
	} else {
		ctx = context.Background()
	}
	v := c.Version()
	if v < 8 {
		return clusterslots{reply: c.Do(ctx, cmds.SlotCmd), addr: c.Addr(), ver: v}
	}
	return clusterslots{reply: c.Do(ctx, cmds.ShardsCmd), addr: c.Addr(), ver: v}
}

func (c *clusterClient) _refresh() (err error) {
	c.mu.RLock()
	results := make(chan clusterslots, len(c.conns))
	pending := make([]conn, 0, len(c.conns))
	for _, cc := range c.conns {
		pending = append(pending, cc.conn)
	}
	c.mu.RUnlock()

	var result clusterslots
	for i := 0; i < cap(results); i++ {
		if i&3 == 0 { // batch CLUSTER SLOTS/CLUSTER SHARDS for every 4 connections
			for j := i; j < i+4 && j < len(pending); j++ {
				go func(c conn, timeout time.Duration) {
					results <- getClusterSlots(c, timeout)
				}(pending[j], c.opt.ConnWriteTimeout)
			}
		}
		result = <-results
		err = result.reply.Error()
		if len(result.reply.val.values()) != 0 {
			break
		}
	}
	if err != nil {
		return err
	}
	pending = nil

	groups := result.parse(c.opt.TLSConfig != nil)
	conns := make(map[string]connrole, len(groups))
	for master, g := range groups {
		conns[master] = connrole{conn: c.connFn(master, c.opt)}
		if c.rOpt != nil {
			for _, nodeInfo := range g.nodes[1:] {
				conns[nodeInfo.Addr] = connrole{conn: c.connFn(nodeInfo.Addr, c.rOpt)}
			}
		} else {
			for _, nodeInfo := range g.nodes[1:] {
				conns[nodeInfo.Addr] = connrole{conn: c.connFn(nodeInfo.Addr, c.opt)}
			}
		}
	}
	// make sure InitAddress always be present
	for _, addr := range c.opt.InitAddress {
		if _, ok := conns[addr]; !ok {
			conns[addr] = connrole{
				conn:   c.connFn(addr, c.opt),
				hidden: true,
			}
		}
	}

	var removes []conn

	c.mu.RLock()
	for addr, cc := range c.conns {
		if fresh, ok := conns[addr]; ok {
			fresh.conn = cc.conn
			conns[addr] = fresh
		} else {
			removes = append(removes, cc.conn)
		}
	}
	c.mu.RUnlock()

	wslots := [16384]conn{}
	var rslots [][]NodeInfo
	for _, g := range groups {

		for i, nodeInfo := range g.nodes {
			g.nodes[i].conn = conns[nodeInfo.Addr].conn
		}

		switch {
		case c.opt.ReplicaOnly && len(g.nodes) > 1:
			nodesCount := len(g.nodes)
			for _, slot := range g.slots {
				for i := slot[0]; i <= slot[1] && i >= 0 && i < 16384; i++ {
					wslots[i] = g.nodes[1+util.FastRand(nodesCount-1)].conn
				}
			}
		case c.rOpt != nil:
			if len(rslots) == 0 { // lazy init
				rslots = make([][]NodeInfo, 16384)
			}
			if c.opt.EnableReplicaAZInfo && (c.opt.ReadNodeSelector != nil || len(g.nodes) > 1) {
				var wg sync.WaitGroup
				for i := 0; i < len(g.nodes); i += 4 { // batch AZ() for every 4 connections
					for j := i + 1; j < i+4 && j < len(g.nodes); j++ {
						wg.Add(1)
						go func(wg *sync.WaitGroup, info *NodeInfo) {
							info.AZ = info.conn.AZ()
							wg.Done()
						}(&wg, &g.nodes[j])
					}
					g.nodes[i].AZ = g.nodes[i].conn.AZ()
					wg.Wait()
				}
			}
			if len(g.nodes) > 1 {
				for _, slot := range g.slots {
					for i := slot[0]; i <= slot[1] && i >= 0 && i < 16384; i++ {
						wslots[i] = g.nodes[0].conn
						if c.opt.ReadNodeSelector != nil {
							rslots[i] = g.nodes
						} else {
							rIndex := c.opt.ReplicaSelector(uint16(i), g.nodes[1:]) // exclude master node
							if rIndex >= 0 && rIndex < len(g.nodes)-1 {
								node := g.nodes[1+rIndex]
								rslots[i] = nodes{node}
							} else {
								node := g.nodes[0] // fallback to master
								rslots[i] = nodes{node}
							}
						}
					}
				}
			} else {
				for _, slot := range g.slots {
					for i := slot[0]; i <= slot[1] && i >= 0 && i < 16384; i++ {
						node := g.nodes[0]
						wslots[i] = node.conn
						rslots[i] = nodes{node}
					}
				}
			}
		default:
			for _, slot := range g.slots {
				for i := slot[0]; i <= slot[1] && i >= 0 && i < 16384; i++ {
					wslots[i] = g.nodes[0].conn
				}
			}
		}
	}

	c.mu.Lock()
	c.wslots = wslots
	c.rslots = rslots
	c.conns = conns
	c.mu.Unlock()

	if len(removes) > 0 {
		go func(removes []conn) {
			time.Sleep(time.Second * 5)
			for _, cc := range removes {
				cc.Close()
			}
		}(removes)
	}

	return nil
}

func (c *clusterClient) single() (conn conn) {
	return c._pick(cmds.InitSlot, false)
}

func (c *clusterClient) nodes() []string {
	c.mu.RLock()
	nodes := make([]string, 0, len(c.conns))
	for addr := range c.conns {
		nodes = append(nodes, addr)
	}
	c.mu.RUnlock()
	return nodes
}

type nodes []NodeInfo

type group struct {
	nodes nodes
	slots [][2]int64
}

func parseEndpoint(fallback, endpoint string, port int64) string {
	switch endpoint {
	case "":
		endpoint, _, _ = net.SplitHostPort(fallback)
	case "?":
		return ""
	}
	return net.JoinHostPort(endpoint, strconv.FormatInt(port, 10))
}

// parseSlots - map redis slots for each redis nodes/addresses
// defaultAddr is needed in case the node does not know its own IP
func parseSlots(slots RedisMessage, defaultAddr string) map[string]group {
	groups := make(map[string]group, len(slots.values()))
	for _, v := range slots.values() {
		master := parseEndpoint(defaultAddr, v.values()[2].values()[0].string(), v.values()[2].values()[1].intlen)
		if master == "" {
			continue
		}
		g, ok := groups[master]
		if !ok {
			g.slots = make([][2]int64, 0)
			g.nodes = make(nodes, 0, len(v.values())-2)
			for i := 2; i < len(v.values()); i++ {
				if dst := parseEndpoint(defaultAddr, v.values()[i].values()[0].string(), v.values()[i].values()[1].intlen); dst != "" {
					g.nodes = append(g.nodes, NodeInfo{Addr: dst})
				}
			}
		}
		g.slots = append(g.slots, [2]int64{v.values()[0].intlen, v.values()[1].intlen})
		groups[master] = g
	}
	return groups
}

// parseShards - map redis shards for each redis nodes/addresses
// defaultAddr is needed in case the node does not know its own IP
func parseShards(shards RedisMessage, defaultAddr string, tls bool) map[string]group {
	groups := make(map[string]group, len(shards.values()))
	for _, v := range shards.values() {
		m := -1
		shard, _ := v.AsMap()
		shardSlots := shard["slots"]
		shardNodes := shard["nodes"]
		slots := shardSlots.values()
		_nodes := shardNodes.values()
		g := group{
			nodes: make(nodes, 0, len(_nodes)),
			slots: make([][2]int64, len(slots)/2),
		}
		for i := range g.slots {
			g.slots[i][0], _ = slots[i*2].AsInt64()
			g.slots[i][1], _ = slots[i*2+1].AsInt64()
		}
		for _, n := range _nodes {
			dict, _ := n.AsMap()
			if dictHealth := dict["health"]; dictHealth.string() != "online" {
				continue
			}
			port := dict["port"].intlen
			if tls && dict["tls-port"].intlen > 0 {
				port = dict["tls-port"].intlen
			}
			dictEndpoint := dict["endpoint"]
			if dst := parseEndpoint(defaultAddr, dictEndpoint.string(), port); dst != "" {
				if dictRole := dict["role"]; dictRole.string() == "master" {
					m = len(g.nodes)
				}
				g.nodes = append(g.nodes, NodeInfo{Addr: dst})
			}
		}
		if m >= 0 {
			g.nodes[0], g.nodes[m] = g.nodes[m], g.nodes[0]
			groups[g.nodes[0].Addr] = g
		}
	}
	return groups
}

func (c *clusterClient) runClusterTopologyRefreshment() {
	ticker := time.NewTicker(c.opt.ClusterOption.ShardsRefreshInterval)
	defer ticker.Stop()
	for {
		select {
		case <-c.stopCh:
			return
		case <-ticker.C:
			c.lazyRefresh()
		}
	}
}

func (c *clusterClient) _pick(slot uint16, toReplica bool) (p conn) {
	c.mu.RLock()
	if slot == cmds.InitSlot {
		for _, cc := range c.conns {
			p = cc.conn
			break
		}
	} else if toReplica && c.rslots != nil {
		if c.opt.ReadNodeSelector != nil {
			nodes := c.rslots[slot]
			rIndex := c.opt.ReadNodeSelector(slot, nodes)
			if rIndex >= 0 && rIndex < len(nodes) {
				p = c.rslots[slot][rIndex].conn
			} else {
				p = c.wslots[slot]
			}
		} else {
			p = c.rslots[slot][0].conn
		}
	} else {
		p = c.wslots[slot]
	}
	c.mu.RUnlock()
	return p
}

func (c *clusterClient) pick(ctx context.Context, slot uint16, toReplica bool) (p conn, err error) {
	if p = c._pick(slot, toReplica); p == nil {
		if err := c.refresh(ctx); err != nil {
			return nil, err
		}
		if p = c._pick(slot, toReplica); p == nil {
			return nil, ErrNoSlot
		}
	}
	return p, nil
}

func (c *clusterClient) redirectOrNew(addr string, prev conn, slot uint16, mode RedirectMode) conn {
	c.mu.RLock()
	cc := c.conns[addr]
	c.mu.RUnlock()
	if cc.conn != nil && prev != cc.conn {
		return cc.conn
	}
	c.mu.Lock()
	if cc = c.conns[addr]; cc.conn == nil {
		p := c.connFn(addr, c.opt)
		cc = connrole{conn: p}
		c.conns[addr] = cc
		if mode == RedirectMove && slot != cmds.InitSlot {
			c.wslots[slot] = p
		}
	} else if prev == cc.conn {
		// try reconnection if the MOVED redirects to the same host,
		// because the same hostname may actually be resolved into another destination
		// depending on the fail-over implementation. ex: AWS MemoryDB's resize process.
		go func(prev conn) {
			time.Sleep(time.Second * 5)
			prev.Close()
		}(prev)
		p := c.connFn(addr, c.opt)
		cc = connrole{conn: p}
		c.conns[addr] = cc
		if mode == RedirectMove && slot != cmds.InitSlot { // MOVED should always point to the primary.
			c.wslots[slot] = p
		}
	}
	c.mu.Unlock()
	return cc.conn
}

func (c *clusterClient) B() Builder {
	return c.cmd
}

func (c *clusterClient) Do(ctx context.Context, cmd Completed) (resp RedisResult) {
	if resp = c.do(ctx, cmd); resp.NonRedisError() == nil { // not recycle cmds if error, since cmds may be used later in the pipe.
		cmds.PutCompleted(cmd)
	}
	return resp
}

func (c *clusterClient) do(ctx context.Context, cmd Completed) (resp RedisResult) {
	attempts := 1
retry:
	cc, err := c.pick(ctx, cmd.Slot(), c.toReplica(cmd))
	if err != nil {
		return newErrResult(err)
	}
	resp = cc.Do(ctx, cmd)
	if resp.NonRedisError() == errConnExpired {
		goto retry
	}
process:
	switch addr, mode := c.shouldRefreshRetry(resp.Error(), ctx); mode {
	case RedirectMove:
		ncc := c.redirectOrNew(addr, cc, cmd.Slot(), mode)
	recover1:
		resp = ncc.Do(ctx, cmd)
		if resp.NonRedisError() == errConnExpired {
			goto recover1
		}
		goto process
	case RedirectAsk:
		ncc := c.redirectOrNew(addr, cc, cmd.Slot(), mode)
	recover2:
		results := ncc.DoMulti(ctx, cmds.AskingCmd, cmd)
		resp = results.s[1]
		if resp.NonRedisError() == errConnExpired {
			goto recover2
		}
		resultsp.Put(results)
		goto process
	case RedirectRetry:
		if c.retry && cmd.IsReadOnly() {
			shouldRetry := c.retryHandler.WaitOrSkipRetry(ctx, attempts, cmd, resp.Error())
			if shouldRetry {
				attempts++
				goto retry
			}
		}
	}
	return resp
}

func (c *clusterClient) toReplica(cmd Completed) bool {
	if c.opt.SendToReplicas != nil {
		return c.opt.SendToReplicas(cmd)
	}
	return false
}

func (c *clusterClient) _pickMulti(multi []Completed) (retries *connretry, init bool) {
	last := cmds.InitSlot

	for _, cmd := range multi {
		if cmd.Slot() == cmds.InitSlot {
			init = true
			break
		}
	}

	c.mu.RLock()
	defer c.mu.RUnlock()

	count := conncountp.Get(len(c.conns), len(c.conns))

	if !init && c.rslots != nil && c.opt.SendToReplicas != nil {
		var bm bitmap
		itor := make(map[int]int)
		bm.Init(len(multi))
		for i, cmd := range multi {
			var cc conn
			slot := cmd.Slot()
			if c.opt.SendToReplicas(cmd) {
				bm.Set(i)
				if c.opt.ReadNodeSelector != nil {
					nodes := c.rslots[slot]
					rIndex := c.opt.ReadNodeSelector(slot, nodes)
					if rIndex > 0 && rIndex < len(nodes) {
						itor[i] = rIndex
					} else {
						rIndex = 0 // default itor[i] = 0
					}
					cc = nodes[rIndex].conn
				} else {
					cc = c.rslots[slot][0].conn
				}
			} else {
				cc = c.wslots[slot]
			}
			if cc == nil {
				return nil, false
			}
			count.m[cc]++
		}

		retries = connretryp.Get(len(count.m), len(count.m))
		for cc, n := range count.m {
			retries.m[cc] = retryp.Get(0, n)
		}
		conncountp.Put(count)

		for i, cmd := range multi {
			var cc conn
			if bm.Get(i) {
				cc = c.rslots[cmd.Slot()][itor[i]].conn
			} else {
				cc = c.wslots[cmd.Slot()]
			}
			re := retries.m[cc]
			re.commands = append(re.commands, cmd)
			re.cIndexes = append(re.cIndexes, i)
		}
		return retries, init
	}

	inits := 0
	for _, cmd := range multi {
		if cmd.Slot() == cmds.InitSlot {
			inits++
			continue
		}
		if last == cmds.InitSlot {
			last = cmd.Slot()
		} else if init && last != cmd.Slot() {
			panic(panicMixCxSlot)
		}
		cc := c.wslots[cmd.Slot()]
		if cc == nil {
			return nil, false
		}
		count.m[cc]++
	}

	if last == cmds.InitSlot {
		// if all commands have no slots, such as INFO, we pick a non-nil slot.
		for i, cc := range c.wslots {
			if cc != nil {
				last = uint16(i)
				count.m[cc] = inits
				break
			}
		}
		if last == cmds.InitSlot {
			return nil, false
		}
	} else if init {
		cc := c.wslots[last]
		count.m[cc] += inits
	}

	retries = connretryp.Get(len(count.m), len(count.m))
	for cc, n := range count.m {
		retries.m[cc] = retryp.Get(0, n)
	}
	conncountp.Put(count)

	for i, cmd := range multi {
		var cc conn
		if cmd.Slot() != cmds.InitSlot {
			cc = c.wslots[cmd.Slot()]
		} else {
			cc = c.wslots[last]
		}
		re := retries.m[cc]
		re.commands = append(re.commands, cmd)
		re.cIndexes = append(re.cIndexes, i)
	}
	return retries, init
}

func (c *clusterClient) pickMulti(ctx context.Context, multi []Completed) (*connretry, bool, error) {
	conns, hasInit := c._pickMulti(multi)
	if conns == nil {
		if err := c.refresh(ctx); err != nil {
			return nil, false, err
		}
		if conns, hasInit = c._pickMulti(multi); conns == nil {
			return nil, false, ErrNoSlot
		}
	}
	return conns, hasInit, nil
}

func isMulti(cmd Completed) bool {
	return len(cmd.Commands()) == 1 && cmd.Commands()[0] == "MULTI"
}
func isExec(cmd Completed) bool {
	return len(cmd.Commands()) == 1 && cmd.Commands()[0] == "EXEC"
}

func (c *clusterClient) doresultfn(
	ctx context.Context, results *redisresults, retries *connretry, mu *sync.Mutex, cc conn, cIndexes []int, commands []Completed, resps []RedisResult, attempts int, hasInit bool,
) (clean bool) {
	mi := -1
	ei := -1
	clean = true
	for i, resp := range resps {
		clean = clean && resp.NonRedisError() == nil
		ii := cIndexes[i]
		cm := commands[i]
		results.s[ii] = resp
		addr, mode := c.shouldRefreshRetry(resp.Error(), ctx)
		if mode != RedirectNone {
			nc := cc
			retryDelay := time.Duration(-1)
			if mode == RedirectRetry {
				if !c.retry || !cm.IsReadOnly() {
					continue
				}
				retryDelay = c.retryHandler.RetryDelay(attempts, cm, resp.Error())
			} else {
				nc = c.redirectOrNew(addr, cc, cm.Slot(), mode)
			}
			if hasInit && ei < i { // find out if there is a transaction block or not.
				for mi = i; mi >= 0 && !isMulti(commands[mi]) && !isExec(commands[mi]); mi-- {
				}
				for ei = i; ei < len(commands) && !isMulti(commands[ei]) && !isExec(commands[ei]); ei++ {
				}
				if mi >= 0 && ei < len(commands) && isMulti(commands[mi]) && isExec(commands[ei]) && resps[mi].val.string() == ok { // a transaction is found.
					mu.Lock()
					retries.Redirects++
					nr := retries.m[nc]
					if nr == nil {
						nr = retryp.Get(0, len(commands))
						retries.m[nc] = nr
					}
					for i := mi; i <= ei; i++ {
						ii := cIndexes[i]
						cm := commands[i]
						if mode == RedirectAsk {
							nr.aIndexes = append(nr.aIndexes, ii)
							nr.cAskings = append(nr.cAskings, cm)
						} else {
							nr.cIndexes = append(nr.cIndexes, ii)
							nr.commands = append(nr.commands, cm)
						}
					}
					mu.Unlock()
					continue // the transaction has been added to the retries, go to the next cmd.
				}
			}
			if hasInit && mi < i && i < ei && mi >= 0 && isMulti(commands[mi]) {
				continue // the current cmd is in the processed transaction and has been added to the retries.
			}
			mu.Lock()
			if mode != RedirectRetry {
				retries.Redirects++
			}
			if mode == RedirectRetry && retryDelay >= 0 {
				retries.RetryDelay = max(retries.RetryDelay, retryDelay)
			}
			nr := retries.m[nc]
			if nr == nil {
				nr = retryp.Get(0, len(commands))
				retries.m[nc] = nr
			}
			if mode == RedirectAsk {
				nr.aIndexes = append(nr.aIndexes, ii)
				nr.cAskings = append(nr.cAskings, cm)
			} else {
				nr.cIndexes = append(nr.cIndexes, ii)
				nr.commands = append(nr.commands, cm)
			}
			mu.Unlock()
		}
	}
	return clean
}

func (c *clusterClient) doretry(
	ctx context.Context, cc conn, results *redisresults, retries *connretry, re *retry, mu *sync.Mutex, wg *sync.WaitGroup, attempts int, hasInit bool,
) {
	clean := true
	if len(re.commands) != 0 {
		resps := cc.DoMulti(ctx, re.commands...)
		if c.hasLftm {
			var ml []Completed
		recover:
			ml = ml[:0]
			var txIdx int // check transaction block, if zero, then not in transaction
			for i, resp := range resps.s {
				if resp.NonRedisError() == errConnExpired {
					if txIdx > 0 {
						ml = re.commands[txIdx:]
					} else {
						ml = re.commands[i:]
					}
					break
				}
				// if no error, then check if transaction block
				if isMulti(re.commands[i]) {
					txIdx = i
				} else if isExec(re.commands[i]) {
					txIdx = 0
				}
			}
			if len(ml) > 0 {
				rs := cc.DoMulti(ctx, ml...).s
				resps.s = append(resps.s[:len(resps.s)-len(rs)], rs...)
				goto recover
			}
		}
		clean = c.doresultfn(ctx, results, retries, mu, cc, re.cIndexes, re.commands, resps.s, attempts, hasInit)
		resultsp.Put(resps)
	}
	if len(re.cAskings) != 0 {
		resps := c.askingMulti(cc, ctx, re.cAskings)
		clean = c.doresultfn(ctx, results, retries, mu, cc, re.aIndexes, re.cAskings, resps.s, attempts, hasInit) && clean
		resultsp.Put(resps)
	}
	if clean {
		retryp.Put(re)
	}
	wg.Done()
}

func (c *clusterClient) DoMulti(ctx context.Context, multi ...Completed) []RedisResult {
	if len(multi) == 0 {
		return nil
	}

	retries, hasInit, err := c.pickMulti(ctx, multi)
	if err != nil {
		return fillErrs(len(multi), err)
	}
	defer connretryp.Put(retries)

	var wg sync.WaitGroup
	var mu sync.Mutex

	results := resultsp.Get(len(multi), len(multi))

	attempts := 1

retry:
	retries.RetryDelay = -1 // Assume no retry. Because a client retry flag can be set to false.

	var cc1 conn
	var re1 *retry
	wg.Add(len(retries.m))
	mu.Lock()
	for cc, re := range retries.m {
		delete(retries.m, cc)
		cc1 = cc
		re1 = re
		break
	}
	for cc, re := range retries.m {
		delete(retries.m, cc)
		go c.doretry(ctx, cc, results, retries, re, &mu, &wg, attempts, hasInit)
	}
	mu.Unlock()
	c.doretry(ctx, cc1, results, retries, re1, &mu, &wg, attempts, hasInit)
	wg.Wait()

	if len(retries.m) != 0 {
		if retries.Redirects > 0 {
			retries.Redirects = 0
			goto retry
		}
		if retries.RetryDelay >= 0 {
			c.retryHandler.WaitForRetry(ctx, retries.RetryDelay)
			attempts++
			goto retry
		}
	}

	for i, cmd := range multi {
		if results.s[i].NonRedisError() == nil {
			cmds.PutCompleted(cmd)
		}
	}
	return results.s
}

func fillErrs(n int, err error) (results []RedisResult) {
	results = resultsp.Get(n, n).s
	for i := range results {
		results[i] = newErrResult(err)
	}
	return results
}

func (c *clusterClient) doCache(ctx context.Context, cmd Cacheable, ttl time.Duration) (resp RedisResult) {
	attempts := 1

retry:
	cc, err := c.pick(ctx, cmd.Slot(), c.toReplica(Completed(cmd)))
	if err != nil {
		return newErrResult(err)
	}
	resp = cc.DoCache(ctx, cmd, ttl)
	if resp.NonRedisError() == errConnExpired {
		goto retry
	}
process:
	switch addr, mode := c.shouldRefreshRetry(resp.Error(), ctx); mode {
	case RedirectMove:
		ncc := c.redirectOrNew(addr, cc, cmd.Slot(), mode)
	recover:
		resp = ncc.DoCache(ctx, cmd, ttl)
		if resp.NonRedisError() == errConnExpired {
			goto recover
		}
		goto process
	case RedirectAsk:
		results := c.askingMultiCache(c.redirectOrNew(addr, cc, cmd.Slot(), mode), ctx, []CacheableTTL{CT(cmd, ttl)})
		resp = results.s[0]
		resultsp.Put(results)
		goto process
	case RedirectRetry:
		if c.retry {
			shouldRetry := c.retryHandler.WaitOrSkipRetry(ctx, attempts, Completed(cmd), resp.Error())
			if shouldRetry {
				attempts++
				goto retry
			}
		}
	}
	return resp
}

func (c *clusterClient) DoCache(ctx context.Context, cmd Cacheable, ttl time.Duration) (resp RedisResult) {
	resp = c.doCache(ctx, cmd, ttl)
	if err := resp.NonRedisError(); err == nil || err == ErrDoCacheAborted {
		cmds.PutCacheable(cmd)
	}
	return resp
}

func (c *clusterClient) askingMulti(cc conn, ctx context.Context, multi []Completed) *redisresults {
	var inTx bool
	commands := make([]Completed, 0, len(multi)*2)
	for _, cmd := range multi {
		if inTx {
			commands = append(commands, cmd)
			inTx = !isExec(cmd)
		} else {
			commands = append(commands, cmds.AskingCmd, cmd)
			inTx = isMulti(cmd)
		}
	}
	results := resultsp.Get(0, len(multi))
	resps := cc.DoMulti(ctx, commands...)
	if c.hasLftm {
		var ml []Completed
	recover:
		ml = ml[:0]
		var askingIdx int
		for i, resp := range resps.s {
			if commands[i] == cmds.AskingCmd {
				askingIdx = i
			}
			if resp.NonRedisError() == errConnExpired {
				ml = commands[askingIdx:]
				break
			}
		}
		if len(ml) > 0 {
			rs := cc.DoMulti(ctx, ml...).s
			resps.s = append(resps.s[:len(resps.s)-len(rs)], rs...)
			goto recover
		}
	}
	for i, resp := range resps.s {
		if commands[i] != cmds.AskingCmd {
			results.s = append(results.s, resp)
		}
	}
	resultsp.Put(resps)
	return results
}

func (c *clusterClient) askingMultiCache(cc conn, ctx context.Context, multi []CacheableTTL) *redisresults {
	commands := make([]Completed, 0, len(multi)*6)
	for _, cmd := range multi {
		ck, _ := cmds.CacheKey(cmd.Cmd)
		commands = append(commands, cc.OptInCmd(), cmds.AskingCmd, cmds.MultiCmd, cmds.NewCompleted([]string{"PTTL", ck}), Completed(cmd.Cmd), cmds.ExecCmd)
	}
	results := resultsp.Get(0, len(multi))
	resps := cc.DoMulti(ctx, commands...)
	if c.hasLftm {
		var ml []Completed
	recover:
		ml = ml[:0]
		for i := 5; i < len(resps.s); i += 6 { // check exec command error only
			if resps.s[i].NonRedisError() == errConnExpired {
				ml = commands[i-5:]
				break
			}
		}
		if len(ml) > 0 {
			rs := cc.DoMulti(ctx, ml...).s
			resps.s = append(resps.s[:len(resps.s)-len(rs)], rs...)
			goto recover
		}
	}
	for i := 5; i < len(resps.s); i += 6 {
		if arr, err := resps.s[i].ToArray(); err != nil {
			if preErr := resps.s[i-1].Error(); preErr != nil { // if {Cmd} get a RedisError
				err = preErr
			}
			results.s = append(results.s, newErrResult(err))
		} else {
			results.s = append(results.s, newResult(arr[len(arr)-1], nil))
		}
	}
	resultsp.Put(resps)
	return results
}

func (c *clusterClient) _pickMultiCache(multi []CacheableTTL) *connretrycache {
	c.mu.RLock()
	defer c.mu.RUnlock()

	count := conncountp.Get(len(c.conns), len(c.conns))
	if c.opt.SendToReplicas == nil || c.rslots == nil {
		for _, cmd := range multi {
			p := c.wslots[cmd.Cmd.Slot()]
			if p == nil {
				return nil
			}
			count.m[p]++
		}

		retries := connretrycachep.Get(len(count.m), len(count.m))
		for cc, n := range count.m {
			retries.m[cc] = retrycachep.Get(0, n)
		}
		conncountp.Put(count)

		for i, cmd := range multi {
			cc := c.wslots[cmd.Cmd.Slot()]
			re := retries.m[cc]
			re.commands = append(re.commands, cmd)
			re.cIndexes = append(re.cIndexes, i)
		}

		return retries
	} else {
		var destination []conn
		var stackDestination [32]conn
		if len(multi) <= len(stackDestination) {
			destination = stackDestination[:len(multi)]
		} else {
			destination = make([]conn, len(multi))
		}
		for i, cmd := range multi {
			var p conn
			slot := cmd.Cmd.Slot()
			if c.opt.SendToReplicas(Completed(cmd.Cmd)) {
				if c.opt.ReadNodeSelector != nil {
					rIndex := c.opt.ReadNodeSelector(slot, c.rslots[slot])
					if rIndex >= 0 && rIndex < len(c.rslots[slot]) {
						p = c.rslots[slot][rIndex].conn
					} else {
						p = c.wslots[slot]
					}
				} else {
					p = c.rslots[slot][0].conn
				}
			} else {
				p = c.wslots[slot]
			}
			if p == nil {
				return nil
			}
			destination[i] = p
			count.m[p]++
		}

		retries := connretrycachep.Get(len(count.m), len(count.m))
		for cc, n := range count.m {
			retries.m[cc] = retrycachep.Get(0, n)
		}
		conncountp.Put(count)

		for i, cmd := range multi {
			cc := destination[i]
			re := retries.m[cc]
			re.commands = append(re.commands, cmd)
			re.cIndexes = append(re.cIndexes, i)
		}

		return retries
	}
}

func (c *clusterClient) pickMultiCache(ctx context.Context, multi []CacheableTTL) (*connretrycache, error) {
	conns := c._pickMultiCache(multi)
	if conns == nil {
		if err := c.refresh(ctx); err != nil {
			return nil, err
		}
		if conns = c._pickMultiCache(multi); conns == nil {
			return nil, ErrNoSlot
		}
	}
	return conns, nil
}

func (c *clusterClient) resultcachefn(
	ctx context.Context, results *redisresults, retries *connretrycache, mu *sync.Mutex, cc conn, cIndexes []int, commands []CacheableTTL, resps []RedisResult, attempts int,
) (clean bool) {
	clean = true
	for i, resp := range resps {
		clean = clean && resp.NonRedisError() == nil
		ii := cIndexes[i]
		cm := commands[i]
		results.s[ii] = resp
		addr, mode := c.shouldRefreshRetry(resp.Error(), ctx)
		if mode != RedirectNone {
			nc := cc
			retryDelay := time.Duration(-1)
			if mode == RedirectRetry {
				if !c.retry {
					continue
				}
				retryDelay = c.retryHandler.RetryDelay(attempts, Completed(cm.Cmd), resp.Error())
			} else {
				nc = c.redirectOrNew(addr, cc, cm.Cmd.Slot(), mode)
			}
			mu.Lock()
			if mode != RedirectRetry {
				retries.Redirects++
			}
			if mode == RedirectRetry && retryDelay >= 0 {
				retries.RetryDelay = max(retries.RetryDelay, retryDelay)
			}
			nr := retries.m[nc]
			if nr == nil {
				nr = retrycachep.Get(0, len(commands))
				retries.m[nc] = nr
			}
			if mode == RedirectAsk {
				nr.aIndexes = append(nr.aIndexes, ii)
				nr.cAskings = append(nr.cAskings, cm)
			} else {
				nr.cIndexes = append(nr.cIndexes, ii)
				nr.commands = append(nr.commands, cm)
			}
			mu.Unlock()
		}
	}
	return clean
}

func (c *clusterClient) doretrycache(
	ctx context.Context, cc conn, results *redisresults, retries *connretrycache, re *retrycache, mu *sync.Mutex, wg *sync.WaitGroup, attempts int,
) {
	clean := true
	if len(re.commands) != 0 {
		resps := cc.DoMultiCache(ctx, re.commands...)
		if c.hasLftm {
			var ml []CacheableTTL
		recover:
			ml = ml[:0]
			for i, resp := range resps.s {
				if resp.NonRedisError() == errConnExpired {
					ml = re.commands[i:]
					break
				}
			}
			if len(ml) > 0 {
				rs := cc.DoMultiCache(ctx, ml...).s
				resps.s = append(resps.s[:len(resps.s)-len(rs)], rs...)
				goto recover
			}
		}
		clean = c.resultcachefn(ctx, results, retries, mu, cc, re.cIndexes, re.commands, resps.s, attempts)
		resultsp.Put(resps)
	}
	if len(re.cAskings) != 0 {
		resps := c.askingMultiCache(cc, ctx, re.cAskings)
		clean = c.resultcachefn(ctx, results, retries, mu, cc, re.aIndexes, re.cAskings, resps.s, attempts) && clean
		resultsp.Put(resps)
	}
	if clean {
		retrycachep.Put(re)
	}
	wg.Done()
}

func (c *clusterClient) DoMultiCache(ctx context.Context, multi ...CacheableTTL) []RedisResult {
	if len(multi) == 0 {
		return nil
	}

	retries, err := c.pickMultiCache(ctx, multi)
	if err != nil {
		return fillErrs(len(multi), err)
	}
	defer connretrycachep.Put(retries)

	var wg sync.WaitGroup
	var mu sync.Mutex

	results := resultsp.Get(len(multi), len(multi))

	attempts := 1

retry:
	retries.RetryDelay = -1 // Assume no retry. Because a client retry flag can be set to false.

	var cc1 conn
	var re1 *retrycache
	wg.Add(len(retries.m))
	mu.Lock()
	for cc, re := range retries.m {
		delete(retries.m, cc)
		cc1 = cc
		re1 = re
		break
	}
	for cc, re := range retries.m {
		delete(retries.m, cc)
		go c.doretrycache(ctx, cc, results, retries, re, &mu, &wg, attempts)
	}
	mu.Unlock()
	c.doretrycache(ctx, cc1, results, retries, re1, &mu, &wg, attempts)
	wg.Wait()

	if len(retries.m) != 0 {
		if retries.Redirects > 0 {
			retries.Redirects = 0
			goto retry
		}
		if retries.RetryDelay >= 0 {
			c.retryHandler.WaitForRetry(ctx, retries.RetryDelay)
			attempts++
			goto retry
		}
	}

	for i, cmd := range multi {
		if err := results.s[i].NonRedisError(); err == nil || err == ErrDoCacheAborted {
			cmds.PutCacheable(cmd.Cmd)
		}
	}
	return results.s
}

func (c *clusterClient) Receive(ctx context.Context, subscribe Completed, fn func(msg PubSubMessage)) (err error) {
	attempts := 1
retry:
	cc, err := c.pick(ctx, subscribe.Slot(), c.toReplica(subscribe))
	if err != nil {
		goto ret
	}
	err = cc.Receive(ctx, subscribe, fn)
	if err == errConnExpired {
		goto retry
	}
	if _, mode := c.shouldRefreshRetry(err, ctx); c.retry && mode != RedirectNone {
		shouldRetry := c.retryHandler.WaitOrSkipRetry(ctx, attempts, subscribe, err)
		if shouldRetry {
			attempts++
			goto retry
		}
	}
ret:
	if err == nil {
		cmds.PutCompleted(subscribe)
	}
	return err
}

func (c *clusterClient) DoStream(ctx context.Context, cmd Completed) RedisResultStream {
	cc, err := c.pick(ctx, cmd.Slot(), c.toReplica(cmd))
	if err != nil {
		return RedisResultStream{e: err}
	}
	ret := cc.DoStream(ctx, cmd)
	cmds.PutCompleted(cmd)
	return ret
}

func (c *clusterClient) DoMultiStream(ctx context.Context, multi ...Completed) MultiRedisResultStream {
	if len(multi) == 0 {
		return RedisResultStream{e: io.EOF}
	}
	slot := multi[0].Slot()
	repl := c.toReplica(multi[0])
	for i := 1; i < len(multi); i++ {
		if s := multi[i].Slot(); s != cmds.InitSlot {
			if slot == cmds.InitSlot {
				slot = s
			} else if slot != s {
				panic("DoMultiStream across multiple slots is not supported")
			}
		}
		repl = repl && c.toReplica(multi[i])
	}
	cc, err := c.pick(ctx, slot, repl)
	if err != nil {
		return RedisResultStream{e: err}
	}
	ret := cc.DoMultiStream(ctx, multi...)
	for _, cmd := range multi {
		cmds.PutCompleted(cmd)
	}
	return ret
}

func (c *clusterClient) Dedicated(fn func(DedicatedClient) error) (err error) {
	dcc := &dedicatedClusterClient{cmd: c.cmd, client: c, slot: cmds.NoSlot, retry: c.retry, retryHandler: c.retryHandler}
	err = fn(dcc)
	dcc.release()
	return err
}

func (c *clusterClient) Dedicate() (DedicatedClient, func()) {
	dcc := &dedicatedClusterClient{cmd: c.cmd, client: c, slot: cmds.NoSlot, retry: c.retry, retryHandler: c.retryHandler}
	return dcc, dcc.release
}

func (c *clusterClient) Nodes() map[string]Client {
	c.mu.RLock()
	_nodes := make(map[string]Client, len(c.conns))
	disableCache := c.opt != nil && c.opt.DisableCache
	for addr, cc := range c.conns {
		if !cc.hidden {
			_nodes[addr] = newSingleClientWithConn(cc.conn, c.cmd, c.retry, disableCache, c.retryHandler, false)
		}
	}
	c.mu.RUnlock()
	return _nodes
}

func (c *clusterClient) Mode() ClientMode {
	return ClientModeCluster
}

func (c *clusterClient) Close() {
	if atomic.CompareAndSwapUint32(&c.stop, 0, 1) {
		close(c.stopCh)
	}

	c.mu.RLock()
	for _, cc := range c.conns {
		go cc.conn.Close()
	}
	c.mu.RUnlock()
}

func (c *clusterClient) shouldRefreshRetry(err error, ctx context.Context) (addr string, mode RedirectMode) {
	if err != nil && err != Nil && err != ErrDoCacheAborted && atomic.LoadUint32(&c.stop) == 0 {
		if err, ok := err.(*RedisError); ok {
			if addr, ok = err.IsMoved(); ok {
				mode = RedirectMove
			} else if addr, ok = err.IsAsk(); ok {
				mode = RedirectAsk
			} else if err.IsClusterDown() || err.IsTryAgain() || err.IsLoading() {
				mode = RedirectRetry
			}
		} else if ctx.Err() == nil {
			mode = RedirectRetry
		}
		if mode != RedirectNone {
			c.lazyRefresh()
		}
	}
	return
}

type dedicatedClusterClient struct {
	conn         conn
	wire         wire
	retryHandler retryHandler
	client       *clusterClient
	pshks        *pshks
	mu           sync.Mutex
	cmd          Builder
	slot         uint16
	retry        bool
	mark         bool
}

func (c *dedicatedClusterClient) acquire(ctx context.Context, slot uint16) (wire wire, err error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.mark {
		return nil, ErrDedicatedClientRecycled
	}
	if c.slot == cmds.NoSlot {
		c.slot = slot
	} else if c.slot != slot && slot != cmds.InitSlot {
		panic(panicMsgCxSlot)
	}
	if c.wire != nil {
		return c.wire, nil
	}
	if c.conn, err = c.client.pick(ctx, c.slot, false); err != nil {
		if p := c.pshks; p != nil {
			c.pshks = nil
			p.close <- err
			close(p.close)
		}
		return nil, err
	}
	c.wire = c.conn.Acquire(ctx)
	if p := c.pshks; p != nil {
		c.pshks = nil
		ch := c.wire.SetPubSubHooks(p.hooks)
		go func(ch <-chan error) {
			for e := range ch {
				p.close <- e
			}
			close(p.close)
		}(ch)
	}
	return c.wire, nil
}

func (c *dedicatedClusterClient) release() {
	c.mu.Lock()
	if !c.mark {
		if p := c.pshks; p != nil {
			c.pshks = nil
			close(p.close)
		}
		if c.wire != nil {
			c.conn.Store(c.wire)
		}
	}
	c.mark = true
	c.mu.Unlock()
}

func (c *dedicatedClusterClient) B() Builder {
	return c.cmd
}

func (c *dedicatedClusterClient) Do(ctx context.Context, cmd Completed) (resp RedisResult) {
	attempts := 1
retry:
	if w, err := c.acquire(ctx, cmd.Slot()); err != nil {
		resp = newErrResult(err)
	} else {
		resp = w.Do(ctx, cmd)
		switch _, mode := c.client.shouldRefreshRetry(resp.Error(), ctx); mode {
		case RedirectRetry:
			if c.retry && cmd.IsReadOnly() && w.Error() == nil {
				shouldRetry := c.retryHandler.WaitOrSkipRetry(
					ctx, attempts, cmd, resp.Error(),
				)
				if shouldRetry {
					attempts++
					goto retry
				}
			}
		}
	}
	if resp.NonRedisError() == nil {
		cmds.PutCompleted(cmd)
	}
	return resp
}

func (c *dedicatedClusterClient) DoMulti(ctx context.Context, multi ...Completed) (resp []RedisResult) {
	if len(multi) == 0 {
		return nil
	}
	slot := chooseSlot(multi)
	if slot == cmds.NoSlot {
		panic(panicMsgCxSlot)
	}
	retryable := c.retry
	if retryable {
		retryable = allReadOnly(multi)
	}
	attempts := 1
retry:
	if w, err := c.acquire(ctx, slot); err == nil {
		resp = w.DoMulti(ctx, multi...).s
		for i, r := range resp {
			_, mode := c.client.shouldRefreshRetry(r.Error(), ctx)
			if mode == RedirectRetry && retryable && w.Error() == nil {
				shouldRetry := c.retryHandler.WaitOrSkipRetry(
					ctx, attempts, multi[i], r.Error(),
				)
				if shouldRetry {
					attempts++
					goto retry
				}
			}
			if mode != RedirectNone {
				break
			}
		}
	} else {
		resp = resultsp.Get(len(multi), len(multi)).s
		for i := range resp {
			resp[i] = newErrResult(err)
		}
	}
	for i, cmd := range multi {
		if resp[i].NonRedisError() == nil {
			cmds.PutCompleted(cmd)
		}
	}
	return resp
}

func (c *dedicatedClusterClient) Receive(ctx context.Context, subscribe Completed, fn func(msg PubSubMessage)) (err error) {
	var (
		w        wire
		attempts = 1
	)
retry:
	if w, err = c.acquire(ctx, subscribe.Slot()); err == nil {
		err = w.Receive(ctx, subscribe, fn)
		if _, mode := c.client.shouldRefreshRetry(err, ctx); c.retry && mode == RedirectRetry && w.Error() == nil {
			shouldRetry := c.retryHandler.WaitOrSkipRetry(ctx, attempts, subscribe, err)
			if shouldRetry {
				attempts++
				goto retry
			}
		}
	}
	if err == nil {
		cmds.PutCompleted(subscribe)
	}
	return err
}

func (c *dedicatedClusterClient) SetPubSubHooks(hooks PubSubHooks) <-chan error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.mark {
		ch := make(chan error, 1)
		ch <- ErrDedicatedClientRecycled
		return ch
	}
	if p := c.pshks; p != nil {
		c.pshks = nil
		close(p.close)
	}
	if c.wire != nil {
		return c.wire.SetPubSubHooks(hooks)
	}
	if hooks.isZero() {
		return nil
	}
	ch := make(chan error, 1)
	c.pshks = &pshks{hooks: hooks, close: ch}
	return ch
}

func (c *dedicatedClusterClient) Close() {
	c.mu.Lock()
	if p := c.pshks; p != nil {
		c.pshks = nil
		p.close <- ErrClosing
		close(p.close)
	}
	if c.wire != nil {
		c.wire.Close()
	}
	c.mu.Unlock()
	c.release()
}

type RedirectMode int

const (
	RedirectNone RedirectMode = iota
	RedirectMove
	RedirectAsk
	RedirectRetry

	panicMsgCxSlot = "cross slot command in Dedicated is prohibited"
	panicMixCxSlot = "Mixing no-slot and cross slot commands in DoMulti is prohibited"
)
