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
		replica:      opt.ReplicaOnly,
	}

	for _, sentinel := range opt.InitAddress {
		client.sentinels.PushBack(sentinel)
	}

	if err = client.refresh(); err != nil {
		client.Close()
		return nil, err
	}

	return client, nil
}

type sentinelClient struct {
	mConn        atomic.Value
	sConn        conn
	retryHandler retryHandler
	connFn       connFn
	mOpt         *ClientOption
	sOpt         *ClientOption
	sentinels    *list.List
	mAddr        string
	sAddr        string
	sc           call
	mu           sync.Mutex
	stop         uint32
	cmd          Builder
	retry        bool
	replica      bool
}

func (c *sentinelClient) B() Builder {
	return c.cmd
}

func (c *sentinelClient) Do(ctx context.Context, cmd Completed) (resp RedisResult) {
	attempts := 1
retry:
	resp = c.mConn.Load().(conn).Do(ctx, cmd)
	if c.retry && cmd.IsReadOnly() && c.isRetryable(resp.Error(), ctx) {
		shouldRetry := c.retryHandler.WaitOrSkipRetry(
			ctx, attempts, cmd, resp.Error(),
		)
		if shouldRetry {
			attempts++
			goto retry
		}
	}
	if resp.NonRedisError() == nil { // not recycle cmds if error, since cmds may be used later in pipe. consider recycle them by pipe
		cmds.PutCompleted(cmd)
	}
	return resp
}

func (c *sentinelClient) DoMulti(ctx context.Context, multi ...Completed) []RedisResult {
	if len(multi) == 0 {
		return nil
	}

	attempts := 1
retry:
	resps := c.mConn.Load().(conn).DoMulti(ctx, multi...)
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
	resp = c.mConn.Load().(conn).DoCache(ctx, cmd, ttl)
	if c.retry && c.isRetryable(resp.Error(), ctx) {
		shouldRetry := c.retryHandler.WaitOrSkipRetry(ctx, attempts, Completed(cmd), resp.Error())
		if shouldRetry {
			attempts++
			goto retry
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
retry:
	resps := c.mConn.Load().(conn).DoMultiCache(ctx, multi...)
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
	err = c.mConn.Load().(conn).Receive(ctx, subscribe, fn)
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
	resp := c.mConn.Load().(conn).DoStream(ctx, cmd)
	cmds.PutCompleted(cmd)
	return resp
}

func (c *sentinelClient) DoMultiStream(ctx context.Context, multi ...Completed) MultiRedisResultStream {
	if len(multi) == 0 {
		return RedisResultStream{e: io.EOF}
	}
	s := c.mConn.Load().(conn).DoMultiStream(ctx, multi...)
	for _, cmd := range multi {
		cmds.PutCompleted(cmd)
	}
	return s
}

func (c *sentinelClient) Dedicated(fn func(DedicatedClient) error) (err error) {
	master := c.mConn.Load().(conn)
	wire := master.Acquire(context.Background())
	dsc := &dedicatedSingleClient{cmd: c.cmd, conn: master, wire: wire, retry: c.retry, retryHandler: c.retryHandler}
	err = fn(dsc)
	dsc.release()
	return err
}

func (c *sentinelClient) Dedicate() (DedicatedClient, func()) {
	master := c.mConn.Load().(conn)
	wire := master.Acquire(context.Background())
	dsc := &dedicatedSingleClient{cmd: c.cmd, conn: master, wire: wire, retry: c.retry, retryHandler: c.retryHandler}
	return dsc, dsc.release
}

func (c *sentinelClient) Nodes() map[string]Client {
	conn := c.mConn.Load().(conn)
	disableCache := c.mOpt != nil && c.mOpt.DisableCache
	return map[string]Client{conn.Addr(): newSingleClientWithConn(conn, c.cmd, c.retry, disableCache, c.retryHandler)}
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

func (c *sentinelClient) switchTargetRetry(addr string) {
	c.mu.Lock()
	err := c._switchTarget(addr)
	c.mu.Unlock()
	if err != nil {
		go c.refreshRetry()
	}
}

func (c *sentinelClient) _switchTarget(addr string) (err error) {
	var target conn
	if atomic.LoadUint32(&c.stop) == 1 {
		return nil
	}
	if c.mAddr == addr {
		target = c.mConn.Load().(conn)
		if target.Error() != nil {
			target = nil
		}
	}
	if target == nil {
		target = c.connFn(addr, c.mOpt)
		if err = target.Dial(); err != nil {
			return err
		}
	}

	resp, err := target.Do(context.Background(), cmds.RoleCmd).ToArray()
	if err != nil {
		target.Close()
		return err
	}

	if c.replica && resp[0].string != "slave" {
		target.Close()
		return errNotSlave
	} else if !c.replica && resp[0].string != "master" {
		target.Close()
		return errNotMaster
	}

	c.mAddr = addr
	if old := c.mConn.Swap(target); old != nil {
		if prev := old.(conn); prev != target {
			prev.Close()
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
	var target string
	var sentinels []string

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
			// listWatch returns server address with sentinels.
			// check if target is master or replica
			if target, sentinels, err = c.listWatch(c.sConn); err == nil {
				for _, sentinel := range sentinels {
					c._addSentinel(sentinel)
				}

				// _switchTarget will switch the connection for master OR replica
				if err = c._switchTarget(target); err == nil {
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
		if master := c.mConn.Load(); master == nil {
			err = ErrNoAddr
		} else {
			err = master.(conn).Error()
		}
	}
	return err
}

// listWatch will use sentinel to list current master|replica address along with sentinels address
func (c *sentinelClient) listWatch(cc conn) (target string, sentinels []string, err error) {
	ctx := context.Background()
	sentinelsCMD := c.cmd.SentinelSentinels().Master(c.mOpt.Sentinel.MasterSet).Build()
	getMasterCMD := c.cmd.SentinelGetMasterAddrByName().Master(c.mOpt.Sentinel.MasterSet).Build()
	replicasCMD := c.cmd.SentinelReplicas().Master(c.mOpt.Sentinel.MasterSet).Build()

	defer func() {
		if err == nil { // not recycle cmds if error, since cmds may be used later in pipe. consider recycle them by pipe
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
					c.switchTargetRetry(net.JoinHostPort(m[3], m[4]))
				}
			case "+reboot":
				m := strings.SplitN(event.Message, " ", 7)
				if m[0] == "master" && m[1] == c.sOpt.Sentinel.MasterSet {
					c.switchTargetRetry(net.JoinHostPort(m[2], m[3]))
				} else if c.replica && m[0] == "slave" && m[5] == c.sOpt.Sentinel.MasterSet {
					c.refreshRetry()
				}
			// note that in case of failover, every slave in the setup
			// will send +slave event individually.
			case "+slave", "+sdown", "-sdown":
				m := strings.SplitN(event.Message, " ", 7)
				if c.replica && m[0] == "slave" && m[5] == c.sOpt.Sentinel.MasterSet {
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
	} else {
		commands = Commands{sentinelsCMD, getMasterCMD}
	}

	resp := cc.DoMulti(ctx, commands...)
	defer resultsp.Put(resp)
	others, err := resp.s[0].ToArray()
	if err != nil {
		return "", nil, err
	}
	for _, other := range others {
		if m, err := other.AsStrMap(); err == nil {
			sentinels = append(sentinels, net.JoinHostPort(m["ip"], m["port"]))
		}
	}

	// we return random slave address instead of master
	if c.replica {
		addr, err := pickReplica(resp.s)
		if err != nil {
			return "", nil, err
		}

		return addr, sentinels, nil
	}

	// otherwise send master as address
	m, err := resp.s[1].AsStrSlice()
	if err != nil {
		return "", nil, err
	}
	return net.JoinHostPort(m[0], m[1]), sentinels, nil
}

func pickReplica(resp []RedisResult) (string, error) {
	replicas, err := resp[1].ToArray()
	if err != nil {
		return "", err
	}

	eligible := make([]map[string]string, 0, len(replicas))
	// eliminate replicas with s_down condition
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
