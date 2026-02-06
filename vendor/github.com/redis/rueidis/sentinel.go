package rueidis

import (
	"container/list"
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/redis/rueidis/internal/cmds"
	"github.com/redis/rueidis/internal/util"
)

func newSentinelClient(opt *ClientOption, connFn connFn, retryer retryHandler) (client *sentinelClient, err error) {
	client = &sentinelClient{
		cmd:          cmds.NewBuilder(cmds.NoSlot),
		mOpt:         opt,
		sOpt:         newSentinelOpt(opt),
		connFn:       connFn,
		sentinels:    list.New(),
		retry:        !opt.DisableRetry,
		retryHandler: retryer,
		hasLftm:      opt.ConnLifetime > 0,
		replica:      opt.ReplicaOnly,
	}

	for _, sentinel := range opt.InitAddress {
		client.sentinels.PushBack(sentinel)
	}

	if opt.ReplicaOnly && opt.SendToReplicas != nil {
		return nil, ErrReplicaOnlyConflict
	}

	if opt.SendToReplicas != nil || opt.ReplicaOnly {
		rOpt := *opt
		rOpt.ReplicaOnly = true
		client.rOpt = &rOpt
	}

	if err = client.refresh(); err != nil {
		client.Close()
		return nil, err
	}

	return client, nil
}

type sentinelClient struct {
	mConn        atomic.Value
	rConn        atomic.Value
	sConn        conn
	retryHandler retryHandler
	connFn       connFn
	mOpt         *ClientOption
	sOpt         *ClientOption
	rOpt         *ClientOption
	sentinels    *list.List
	mAddr        atomic.Value
	rAddr        atomic.Value
	sAddr        string
	sc           call
	mu           sync.Mutex
	stop         uint32
	cmd          Builder
	retry        bool
	hasLftm      bool
	replica      bool
}

func (c *sentinelClient) B() Builder {
	return c.cmd
}

func (c *sentinelClient) Do(ctx context.Context, cmd Completed) (resp RedisResult) {
	attempts := 1
retry:
	cc := c.pick(cmd)
	resp = cc.Do(ctx, cmd)
	if err := resp.Error(); err != nil {
		if err == errConnExpired {
			goto retry
		}
		if c.retry && cmd.IsReadOnly() && c.isRetryable(err, ctx) {
			if c.retryHandler.WaitOrSkipRetry(ctx, attempts, cmd, err) {
				attempts++
				goto retry
			}
		}
	}
	if resp.NonRedisError() == nil { // not recycle cmds if error, since cmds may be used later in the pipe.
		cmds.PutCompleted(cmd)
	}
	return resp
}

func (c *sentinelClient) DoMulti(ctx context.Context, multi ...Completed) []RedisResult {
	if len(multi) == 0 {
		return nil
	}

	attempts := 1
	sendToReplica := c.sendAllToReplica(multi)
retry:
	cc := c.pickMulti(sendToReplica)
	resps := cc.DoMulti(ctx, multi...)
	if c.hasLftm {
		var ml []Completed
	recover:
		ml = ml[:0]
		var txIdx int // check transaction block, if zero, then not in transaction
		for i, resp := range resps.s {
			if resp.NonRedisError() == errConnExpired {
				if txIdx > 0 {
					ml = multi[txIdx:]
				} else {
					ml = multi[i:]
				}
				break
			}
			// if no error, then check if transaction block
			if isMulti(multi[i]) {
				txIdx = i
			} else if isExec(multi[i]) {
				txIdx = 0
			}
		}
		if len(ml) > 0 {
			rs := cc.DoMulti(ctx, ml...).s
			resps.s = append(resps.s[:len(resps.s)-len(rs)], rs...)
			goto recover
		}
	}
	if c.retry && allReadOnly(multi) {
		for i, resp := range resps.s {
			if c.isRetryable(resp.Error(), ctx) {
				shouldRetry := c.retryHandler.WaitOrSkipRetry(
					ctx, attempts, multi[i], resp.Error(),
				)
				if shouldRetry {
					resultsp.Put(resps)
					attempts++
					goto retry
				}
			}
		}
	}
	for i, cmd := range multi {
		if resps.s[i].NonRedisError() == nil {
			cmds.PutCompleted(cmd)
		}
	}
	return resps.s
}

func (c *sentinelClient) DoCache(ctx context.Context, cmd Cacheable, ttl time.Duration) (resp RedisResult) {
	attempts := 1
retry:
	cc := c.pick(Completed(cmd))
	resp = cc.DoCache(ctx, cmd, ttl)
	if err := resp.Error(); err != nil {
		if err == errConnExpired {
			goto retry
		}
		if c.retry && c.isRetryable(err, ctx) {
			if c.retryHandler.WaitOrSkipRetry(ctx, attempts, Completed(cmd), err) {
				attempts++
				goto retry
			}
		}
	}
	if err := resp.NonRedisError(); err == nil || err == ErrDoCacheAborted {
		cmds.PutCacheable(cmd)
	}
	return resp
}

func (c *sentinelClient) DoMultiCache(ctx context.Context, multi ...CacheableTTL) []RedisResult {
	if len(multi) == 0 {
		return nil
	}
	attempts := 1

	sendToReplica := c.sendAllToReplicaCache(multi)
retry:
	cc := c.pickMulti(sendToReplica)
	resps := cc.DoMultiCache(ctx, multi...)
	if c.hasLftm {
		var ml []CacheableTTL
	recover:
		ml = ml[:0]
		for i, resp := range resps.s {
			if resp.NonRedisError() == errConnExpired {
				ml = multi[i:]
				break
			}
		}
		if len(ml) > 0 {
			rs := cc.DoMultiCache(ctx, ml...).s
			resps.s = append(resps.s[:len(resps.s)-len(rs)], rs...)
			goto recover
		}
	}
	if c.retry {
		for i, resp := range resps.s {
			if c.isRetryable(resp.Error(), ctx) {
				shouldRetry := c.retryHandler.WaitOrSkipRetry(
					ctx, attempts, Completed(multi[i].Cmd), resp.Error(),
				)
				if shouldRetry {
					resultsp.Put(resps)
					attempts++
					goto retry
				}
			}
		}
	}
	for i, cmd := range multi {
		if err := resps.s[i].NonRedisError(); err == nil || err == ErrDoCacheAborted {
			cmds.PutCacheable(cmd.Cmd)
		}
	}
	return resps.s
}

func (c *sentinelClient) Receive(ctx context.Context, subscribe Completed, fn func(msg PubSubMessage)) (err error) {
	attempts := 1
retry:
	cc := c.pick(subscribe)
	err = cc.Receive(ctx, subscribe, fn)
	if err == errConnExpired {
		goto retry
	}
	if c.retry {
		if _, ok := err.(*RedisError); !ok && c.isRetryable(err, ctx) {
			shouldRetry := c.retryHandler.WaitOrSkipRetry(
				ctx, attempts, subscribe, err,
			)
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

func (c *sentinelClient) DoStream(ctx context.Context, cmd Completed) RedisResultStream {
	cc := c.pick(cmd)
	resp := cc.DoStream(ctx, cmd)
	cmds.PutCompleted(cmd)
	return resp
}

func (c *sentinelClient) DoMultiStream(ctx context.Context, multi ...Completed) MultiRedisResultStream {
	if len(multi) == 0 {
		return RedisResultStream{e: io.EOF}
	}

	cc := c.pickMulti(c.sendAllToReplica(multi))
	s := cc.DoMultiStream(ctx, multi...)
	for _, cmd := range multi {
		cmds.PutCompleted(cmd)
	}
	return s
}

func (c *sentinelClient) Dedicated(fn func(DedicatedClient) error) (err error) {
	var cc conn
	if c.replica {
		cc = c.rConn.Load().(conn)
	} else {
		cc = c.mConn.Load().(conn)
	}
	wire := cc.Acquire(context.Background())
	dsc := &dedicatedSingleClient{cmd: c.cmd, conn: cc, wire: wire, retry: c.retry, retryHandler: c.retryHandler}
	err = fn(dsc)
	dsc.release()
	return err
}

func (c *sentinelClient) Dedicate() (DedicatedClient, func()) {
	var cc conn
	if c.replica {
		cc = c.rConn.Load().(conn)
	} else {
		cc = c.mConn.Load().(conn)
	}
	wire := cc.Acquire(context.Background())
	dsc := &dedicatedSingleClient{cmd: c.cmd, conn: cc, wire: wire, retry: c.retry, retryHandler: c.retryHandler}
	return dsc, dsc.release
}

func (c *sentinelClient) Nodes() map[string]Client {
	disableCache := c.mOpt != nil && c.mOpt.DisableCache

	switch {
	case c.replica:
		cc := c.rConn.Load().(conn)
		return map[string]Client{cc.Addr(): newSingleClientWithConn(cc, c.cmd, c.retry, disableCache, c.retryHandler, false)}
	case c.mOpt.SendToReplicas != nil:
		master := c.mConn.Load().(conn)
		replica := c.rConn.Load().(conn)
		return map[string]Client{
			master.Addr():  newSingleClientWithConn(master, c.cmd, c.retry, disableCache, c.retryHandler, false),
			replica.Addr(): newSingleClientWithConn(replica, c.cmd, c.retry, disableCache, c.retryHandler, false),
		}
	default:
		cc := c.mConn.Load().(conn)
		return map[string]Client{cc.Addr(): newSingleClientWithConn(cc, c.cmd, c.retry, disableCache, c.retryHandler, false)}
	}
}

func (c *sentinelClient) Mode() ClientMode {
	return ClientModeSentinel
}

func (c *sentinelClient) Close() {
	atomic.StoreUint32(&c.stop, 1)
	c.mu.Lock()
	if c.sConn != nil {
		c.sConn.Close()
	}
	if master := c.mConn.Load(); master != nil {
		master.(conn).Close()
	}
	if replica := c.rConn.Load(); replica != nil {
		replica.(conn).Close()
	}
	c.mu.Unlock()
}

func (c *sentinelClient) isRetryable(err error, ctx context.Context) (should bool) {
	if err == nil || err == Nil || err == ErrDoCacheAborted || atomic.LoadUint32(&c.stop) != 0 || ctx.Err() != nil {
		return false
	}
	if err, ok := err.(*RedisError); ok {
		return err.IsLoading()
	}
	return true
}

func (c *sentinelClient) addSentinel(addr string) {
	c.mu.Lock()
	c._addSentinel(addr)
	c.mu.Unlock()
}

func (c *sentinelClient) _addSentinel(addr string) {
	for e := c.sentinels.Front(); e != nil; e = e.Next() {
		if e.Value.(string) == addr {
			return
		}
	}
	c.sentinels.PushFront(addr)
}

func (c *sentinelClient) pick(cmd Completed) (cc conn) {
	switch {
	case c.replica:
		cc = c.rConn.Load().(conn)
	case c.mOpt.SendToReplicas != nil:
		if c.mOpt.SendToReplicas(cmd) {
			cc = c.rConn.Load().(conn)
		} else {
			cc = c.mConn.Load().(conn)
		}
	default:
		cc = c.mConn.Load().(conn)
	}
	return cc
}

func (c *sentinelClient) pickMulti(sendToReplica bool) (cc conn) {
	switch {
	case c.replica:
		cc = c.rConn.Load().(conn)
	case c.mOpt.SendToReplicas != nil:
		if sendToReplica {
			cc = c.rConn.Load().(conn)
		} else {
			cc = c.mConn.Load().(conn)
		}
	default:
		cc = c.mConn.Load().(conn)
	}

	return cc
}

func (c *sentinelClient) sendAllToReplica(cmds []Completed) bool {
	if c.mOpt.SendToReplicas == nil {
		return false
	}

	for _, cmd := range cmds {
		if !c.mOpt.SendToReplicas(cmd) {
			return false
		}
	}

	return true
}

func (c *sentinelClient) sendAllToReplicaCache(cmds []CacheableTTL) bool {
	if c.mOpt.SendToReplicas == nil {
		return false
	}

	for _, cmd := range cmds {
		if !c.mOpt.SendToReplicas(Completed(cmd.Cmd)) {
			return false
		}
	}

	return true
}

func (c *sentinelClient) switchTargetRetry(addr string, isMaster bool) {
	c.mu.Lock()
	err := c._switchTarget(addr, isMaster)
	c.mu.Unlock()
	if err != nil {
		go c.refreshRetry()
	}
}

func (c *sentinelClient) _switchTarget(addr string, isMaster bool) (err error) {
	if atomic.LoadUint32(&c.stop) == 1 {
		return nil
	}

	var (
		target conn
		opt    *ClientOption
	)

	if isMaster {
		opt = c.mOpt
		if mAddr := c.mAddr.Load(); mAddr != nil && mAddr.(string) == addr {
			target = c.mConn.Load().(conn)
			if target.Error() != nil {
				target = nil
			}
		}
	} else {
		opt = c.rOpt
		if rAddr := c.rAddr.Load(); rAddr != nil && rAddr.(string) == addr {
			target = c.rConn.Load().(conn)
			if target.Error() != nil {
				target = nil
			}
		}
	}

	if target == nil {
		target = c.connFn(addr, opt)
		if err = target.Dial(); err != nil {
			return err
		}
	}

	resp, err := target.Do(context.Background(), cmds.RoleCmd).ToArray()
	if err != nil {
		target.Close()
		return err
	}

	if isMaster {
		if resp[0].string() != "master" {
			target.Close()
			return errNotMaster
		}

		c.mAddr.Store(addr)

		if old := c.mConn.Swap(target); old != nil {
			if prev := old.(conn); prev != target {
				prev.Close()
			}
		}
	} else {
		if resp[0].string() != "slave" {
			target.Close()
			return errNotSlave
		}

		c.rAddr.Store(addr)

		if old := c.rConn.Swap(target); old != nil {
			if prev := old.(conn); prev != target {
				prev.Close()
			}
		}
	}

	return nil
}

func (c *sentinelClient) refreshRetry() {
retry:
	if err := c.refresh(); err != nil {
		goto retry
	}
}

func (c *sentinelClient) refresh() (err error) {
	return c.sc.Do(context.Background(), c._refresh)
}

func (c *sentinelClient) _refresh() (err error) {
	var (
		master    string
		replica   string
		sentinels []string
	)

	c.mu.Lock()
	head := c.sentinels.Front()
	for e := head; e != nil; {
		if atomic.LoadUint32(&c.stop) == 1 {
			c.mu.Unlock()
			return nil
		}
		addr := e.Value.(string)

		if c.sAddr != addr || c.sConn == nil || c.sConn.Error() != nil {
			if c.sConn != nil {
				c.sConn.Close()
			}
			c.sAddr = addr
			c.sConn = c.connFn(addr, c.sOpt)
			err = c.sConn.Dial()
		}
		if err == nil {
			// listWatch returns the server address with sentinels.
			// check if the target is master or replica
			if master, replica, sentinels, err = c.listWatch(c.sConn); err == nil {
				for _, sentinel := range sentinels {
					c._addSentinel(sentinel)
				}

				switch {
				case c.replica:
					err = c._switchTarget(replica, false)
				case c.mOpt.SendToReplicas != nil:
					errs := make(chan error, 1)
					go func(errs chan error, master string) {
						errs <- c._switchTarget(master, true)
					}(errs, master)
					go func(errs chan error, replica string) {
						errs <- c._switchTarget(replica, false)
					}(errs, replica)

					for i := 0; i < 2; i++ {
						if e := <-errs; e != nil {
							err = e
							break
						}
					}
				default:
					err = c._switchTarget(master, true)
				}

				if err == nil {
					break
				}
			}
			c.sConn.Close()
		}
		c.sentinels.MoveToBack(e)
		if e = c.sentinels.Front(); e == head {
			break
		}
	}
	c.mu.Unlock()

	if err == nil {
		if c.replica {
			if replica := c.rConn.Load(); replica == nil {
				err = ErrNoAddr
			} else {
				err = replica.(conn).Error()
			}
		} else {
			if master := c.mConn.Load(); master == nil {
				err = ErrNoAddr
			} else {
				err = master.(conn).Error()
			}
		}
	}
	return err
}

// listWatch will use sentinel to list the current master,replica address along with sentinel address
func (c *sentinelClient) listWatch(cc conn) (master string, replica string, sentinels []string, err error) {
	ctx := context.Background()
	sentinelsCMD := c.cmd.SentinelSentinels().Master(c.mOpt.Sentinel.MasterSet).Build()
	getMasterCMD := c.cmd.SentinelGetMasterAddrByName().Master(c.mOpt.Sentinel.MasterSet).Build()
	replicasCMD := c.cmd.SentinelReplicas().Master(c.mOpt.Sentinel.MasterSet).Build()

	defer func() {
		if err == nil { // not recycle cmds if error, since cmds may be used later in the pipe.
			cmds.PutCompleted(sentinelsCMD)
			cmds.PutCompleted(getMasterCMD)
			cmds.PutCompleted(replicasCMD)
		}
	}()

	// unsubscribe in case there is any previous subscription
	cc.Do(ctx, cmds.SentinelUnSubscribe)

	go func(cc conn) {
		if err := cc.Receive(ctx, cmds.SentinelSubscribe, func(event PubSubMessage) {
			switch event.Channel {
			case "+sentinel":
				m := strings.SplitN(event.Message, " ", 4)
				c.addSentinel(net.JoinHostPort(m[2], m[3]))
			case "+switch-master":
				m := strings.SplitN(event.Message, " ", 5)
				if m[0] == c.sOpt.Sentinel.MasterSet {
					c.switchTargetRetry(net.JoinHostPort(m[3], m[4]), true)
				}
			case "+reboot":
				m := strings.SplitN(event.Message, " ", 7)
				if m[0] == "master" && m[1] == c.sOpt.Sentinel.MasterSet {
					c.switchTargetRetry(net.JoinHostPort(m[2], m[3]), true)
				} else if (c.replica || c.rOpt != nil) && m[0] == "slave" && m[5] == c.sOpt.Sentinel.MasterSet {
					c.refreshRetry()
				}
			// note that in case of failover, every slave in the setup
			// will send +slave event individually.
			case "+slave", "+sdown", "-sdown":
				m := strings.SplitN(event.Message, " ", 7)
				if (c.replica || c.rOpt != nil) && m[0] == "slave" && m[5] == c.sOpt.Sentinel.MasterSet {
					// call refresh to randomly choose a new slave
					c.refreshRetry()
				}
			}
		}); err != nil && atomic.LoadUint32(&c.stop) == 0 {
			c.refreshRetry()
		}
	}(cc)

	var commands Commands
	if c.replica {
		commands = Commands{sentinelsCMD, replicasCMD}
	} else if c.mOpt.SendToReplicas != nil {
		commands = Commands{sentinelsCMD, getMasterCMD, replicasCMD}
	} else {
		commands = Commands{sentinelsCMD, getMasterCMD}
	}

	resp := cc.DoMulti(ctx, commands...)
	defer resultsp.Put(resp)
	others, err := resp.s[0].ToArray()
	if err != nil {
		return "", "", nil, err
	}
	for _, other := range others {
		if m, err := other.AsStrMap(); err == nil {
			sentinels = append(sentinels, net.JoinHostPort(m["ip"], m["port"]))
		}
	}

	// we return a random slave address instead of master
	if c.replica {
		addr, err := pickReplica(resp.s[1])
		if err != nil {
			return "", "", nil, err
		}

		return "", addr, sentinels, nil
	}

	var r string
	if c.mOpt.SendToReplicas != nil {
		addr, err := pickReplica(resp.s[2])
		if err != nil {
			return "", "", nil, err
		}

		r = addr
	}

	m, err := resp.s[1].AsStrSlice()
	if err != nil {
		return "", "", nil, err
	}
	return net.JoinHostPort(m[0], m[1]), r, sentinels, nil
}

func pickReplica(resp RedisResult) (string, error) {
	replicas, err := resp.ToArray()
	if err != nil {
		return "", err
	}

	eligible := make([]map[string]string, 0, len(replicas))
	// eliminate replicas with the s_down condition
	for i := range replicas {
		replica, err := replicas[i].AsStrMap()
		if err != nil {
			continue
		}
		if _, ok := replica["s-down-time"]; !ok {
			eligible = append(eligible, replica)
		}
	}

	if len(eligible) == 0 {
		return "", fmt.Errorf("not enough ready replicas")
	}

	// choose a replica randomly
	m := eligible[util.FastRand(len(eligible))]
	return net.JoinHostPort(m["ip"], m["port"]), nil
}

func newSentinelOpt(opt *ClientOption) *ClientOption {
	o := *opt
	o.Username = o.Sentinel.Username
	o.Password = o.Sentinel.Password
	o.ClientName = o.Sentinel.ClientName
	o.Dialer = o.Sentinel.Dialer
	o.TLSConfig = o.Sentinel.TLSConfig
	o.SelectDB = 0 // https://github.com/redis/rueidis/issues/138
	return &o
}

var (
	errNotMaster = errors.New("the redis role is not master")
	errNotSlave  = errors.New("the redis role is not slave")
)
