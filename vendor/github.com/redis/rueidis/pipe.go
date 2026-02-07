package rueidis

import (
	"bufio"
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/redis/rueidis/internal/cmds"
)

const LibName = "rueidis"
const LibVer = "1.0.68"

var noHello = regexp.MustCompile("unknown command .?(HELLO|hello).?")

// See https://github.com/redis/rueidis/pull/691
func isUnsubReply(msg *RedisMessage) bool {
	// ex. NOPERM User limited-user has no permissions to run the 'ping' command
	// ex. LOADING server is loading the dataset in memory
	// ex. BUSY
	if msg.typ == '-' && (strings.HasPrefix(msg.string(), "LOADING") || strings.HasPrefix(msg.string(), "BUSY") || strings.Contains(msg.string(), "'ping'")) {
		msg.typ = '+'
		msg.setString("PONG")
		return true
	}
	return msg.string() == "PONG" || (len(msg.values()) != 0 && msg.values()[0].string() == "pong")
}

type wire interface {
	Do(ctx context.Context, cmd Completed) RedisResult
	DoCache(ctx context.Context, cmd Cacheable, ttl time.Duration) RedisResult
	DoMulti(ctx context.Context, multi ...Completed) *redisresults
	DoMultiCache(ctx context.Context, multi ...CacheableTTL) *redisresults
	Receive(ctx context.Context, subscribe Completed, fn func(message PubSubMessage)) error
	DoStream(ctx context.Context, pool *pool, cmd Completed) RedisResultStream
	DoMultiStream(ctx context.Context, pool *pool, multi ...Completed) MultiRedisResultStream
	Info() map[string]RedisMessage
	Version() int
	AZ() string
	Error() error
	Close()

	CleanSubscriptions()
	SetPubSubHooks(hooks PubSubHooks) <-chan error
	SetOnCloseHook(fn func(error))
	StopTimer() bool
	ResetTimer() bool
}

var _ wire = (*pipe)(nil)

type pipe struct {
	conn            net.Conn
	clhks           atomic.Value // closed hook, invoked after the conn is closed
	queue           queue
	cache           CacheStore
	pshks           atomic.Pointer[pshks] // pubsub hook, registered by the SetPubSubHooks
	error           atomic.Pointer[errs]
	r               *bufio.Reader
	w               *bufio.Writer
	close           chan struct{}
	onInvalidations func([]RedisMessage)
	ssubs           *subs // pubsub smessage subscriptions
	nsubs           *subs // pubsub  message subscriptions
	psubs           *subs // pubsub pmessage subscriptions
	r2p             *r2p
	pingTimer       *time.Timer // timer for background ping
	lftmTimer       *time.Timer // lifetime timer
	info            map[string]RedisMessage
	timeout         time.Duration
	pinggap         time.Duration
	maxFlushDelay   time.Duration
	lftm            time.Duration // lifetime
	wrCounter       atomic.Uint64
	version         int32
	blcksig         int32
	state           int32
	bgState         int32
	r2ps            bool // identify this pipe is used for resp2 pubsub or not
	noNoDelay       bool
	optIn           bool
}

type pipeFn func(ctx context.Context, connFn func(ctx context.Context) (net.Conn, error), option *ClientOption) (p *pipe, err error)

func newPipe(ctx context.Context, connFn func(ctx context.Context) (net.Conn, error), option *ClientOption) (p *pipe, err error) {
	return _newPipe(ctx, connFn, option, false, false)
}

func newPipeNoBg(ctx context.Context, connFn func(context.Context) (net.Conn, error), option *ClientOption) (p *pipe, err error) {
	return _newPipe(ctx, connFn, option, false, true)
}

func _newPipe(ctx context.Context, connFn func(context.Context) (net.Conn, error), option *ClientOption, r2ps, nobg bool) (p *pipe, err error) {
	conn, err := connFn(ctx)
	if err != nil {
		return nil, err
	}
	p = &pipe{
		conn: conn,
		r:    bufio.NewReaderSize(conn, option.ReadBufferEachConn),
		w:    bufio.NewWriterSize(conn, option.WriteBufferEachConn),

		timeout:       option.ConnWriteTimeout,
		pinggap:       option.Dialer.KeepAlive,
		maxFlushDelay: option.MaxFlushDelay,
		noNoDelay:     option.DisableTCPNoDelay,

		r2ps:  r2ps,
		optIn: isOptIn(option.ClientTrackingOptions),
	}
	if !nobg {
		switch queueTypeFromEnv {
		case queueTypeFlowBuffer:
			p.queue = newFlowBuffer(option.RingScaleEachConn)
		default:
			p.queue = newRing(option.RingScaleEachConn)
		}
		p.nsubs = newSubs()
		p.psubs = newSubs()
		p.ssubs = newSubs()
		p.close = make(chan struct{})
	}
	if !nobg && !option.DisableCache {
		cacheStoreFn := option.NewCacheStoreFn
		if cacheStoreFn == nil {
			cacheStoreFn = newLRU
		}
		p.cache = cacheStoreFn(CacheStoreOption{CacheSizeEachConn: option.CacheSizeEachConn})
	}
	p.pshks.Store(emptypshks)
	p.clhks.Store(emptyclhks)

	username := option.Username
	password := option.Password
	if option.AuthCredentialsFn != nil {
		authCredentialsContext := AuthCredentialsContext{
			Address: conn.RemoteAddr(),
		}
		authCredentials, err := option.AuthCredentialsFn(authCredentialsContext)
		if err != nil {
			p.Close()
			return nil, err
		}
		username = authCredentials.Username
		password = authCredentials.Password
	}

	helloCmd := []string{"HELLO", "3"}
	if password != "" && username == "" {
		helloCmd = append(helloCmd, "AUTH", "default", password)
	} else if username != "" {
		helloCmd = append(helloCmd, "AUTH", username, password)
	}
	if option.ClientName != "" {
		helloCmd = append(helloCmd, "SETNAME", option.ClientName)
	}

	init := make([][]string, 0, 5)
	if option.ClientTrackingOptions == nil {
		init = append(init, helloCmd, []string{"CLIENT", "TRACKING", "ON", "OPTIN"})
	} else {
		init = append(init, helloCmd, append([]string{"CLIENT", "TRACKING", "ON"}, option.ClientTrackingOptions...))
	}
	if option.DisableCache {
		init = init[:1]
	}
	if option.SelectDB != 0 {
		init = append(init, []string{"SELECT", strconv.Itoa(option.SelectDB)})
	}
	if option.ReplicaOnly && option.Sentinel.MasterSet == "" {
		init = append(init, []string{"READONLY"})
	}
	if option.ClientNoTouch {
		init = append(init, []string{"CLIENT", "NO-TOUCH", "ON"})
	}
	if option.ClientNoEvict {
		init = append(init, []string{"CLIENT", "NO-EVICT", "ON"})
	}
	if option.Standalone.EnableRedirect {
		init = append(init, []string{"CLIENT", "CAPA", "redirect"})
	}

	addClientSetInfoCmds := true
	if len(option.ClientSetInfo) == 2 {
		init = append(init, []string{"CLIENT", "SETINFO", "LIB-NAME", option.ClientSetInfo[0]}, []string{"CLIENT", "SETINFO", "LIB-VER", option.ClientSetInfo[1]})
	} else if option.ClientSetInfo == nil {
		init = append(init, []string{"CLIENT", "SETINFO", "LIB-NAME", LibName}, []string{"CLIENT", "SETINFO", "LIB-VER", LibVer})
	} else {
		addClientSetInfoCmds = false
	}

	timeout := option.Dialer.Timeout
	if timeout <= 0 {
		timeout = DefaultDialTimeout
	}

	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	r2 := option.AlwaysRESP2
	if !r2 && !r2ps {
		resp := p.DoMulti(ctx, cmds.NewMultiCompleted(init)...)
		defer resultsp.Put(resp)

		count := len(resp.s)
		if addClientSetInfoCmds {
			// skip error checking on the last CLIENT SETINFO
			count -= 2
		}

		for i, r := range resp.s[:count] {
			if i == 0 {
				p.info, err = r.AsMap()
			} else {
				err = r.Error()
			}
			if err != nil {
				if init[i][0] == "READONLY" {
					// ignore READONLY command error
					continue
				}
				if re, ok := err.(*RedisError); ok {
					if !r2 && noHello.MatchString(re.string()) {
						r2 = true
						continue
					} else if init[i][0] == "CLIENT" {
						err = fmt.Errorf("%s: %v\n%w", re.string(), init[i], ErrNoCache)
					} else if r2 {
						continue
					}
				}
				p.Close()
				return nil, err
			}
		}
	}
	if proto := p.info["proto"]; proto.intlen < 3 {
		r2 = true
	}
	if !r2 && !r2ps {
		if ver, ok := p.info["version"]; ok {
			if v := strings.Split(ver.string(), "."); len(v) != 0 {
				vv, _ := strconv.ParseInt(v[0], 10, 32)
				p.version = int32(vv)
			}
		}
		p.onInvalidations = option.OnInvalidations
	} else {
		if !option.DisableCache {
			p.Close()
			return nil, ErrNoCache
		}
		init = init[:0]
		if password != "" && username == "" {
			init = append(init, []string{"AUTH", password})
		} else if username != "" {
			init = append(init, []string{"AUTH", username, password})
		}
		helloIndex := len(init)
		init = append(init, []string{"HELLO", "2"})
		if option.ClientName != "" {
			init = append(init, []string{"CLIENT", "SETNAME", option.ClientName})
		}
		if option.SelectDB != 0 {
			init = append(init, []string{"SELECT", strconv.Itoa(option.SelectDB)})
		}
		if option.ReplicaOnly && option.Sentinel.MasterSet == "" {
			init = append(init, []string{"READONLY"})
		}
		if option.ClientNoTouch {
			init = append(init, []string{"CLIENT", "NO-TOUCH", "ON"})
		}
		if option.ClientNoEvict {
			init = append(init, []string{"CLIENT", "NO-EVICT", "ON"})
		}
		if option.Standalone.EnableRedirect {
			init = append(init, []string{"CLIENT", "CAPA", "redirect"})
		}

		addClientSetInfoCmds := true
		if len(option.ClientSetInfo) == 2 {
			init = append(init, []string{"CLIENT", "SETINFO", "LIB-NAME", option.ClientSetInfo[0]}, []string{"CLIENT", "SETINFO", "LIB-VER", option.ClientSetInfo[1]})
		} else if option.ClientSetInfo == nil {
			init = append(init, []string{"CLIENT", "SETINFO", "LIB-NAME", LibName}, []string{"CLIENT", "SETINFO", "LIB-VER", LibVer})
		} else {
			addClientSetInfoCmds = false
		}

		p.version = 5
		if len(init) != 0 {
			resp := p.DoMulti(ctx, cmds.NewMultiCompleted(init)...)
			defer resultsp.Put(resp)

			count := len(resp.s)
			if addClientSetInfoCmds {
				// skip error checking on the last CLIENT SETINFO
				count -= 2
			}

			for i, r := range resp.s[:count] {
				if init[i][0] == "READONLY" {
					// ignore READONLY command error
					continue
				}
				if err = r.Error(); err != nil {
					if re, ok := err.(*RedisError); ok && noHello.MatchString(re.string()) {
						continue
					}
					p.Close()
					return nil, err
				}
				if i == helloIndex {
					p.info, err = r.AsMap()
				}
			}
		}
		if !r2ps {
			p.r2p = &r2p{
				f: func(ctx context.Context) (p *pipe, err error) {
					return _newPipe(ctx, connFn, option, true, nobg)
				},
			}
		}
	}
	if !nobg {
		if p.onInvalidations != nil || option.AlwaysPipelining {
			p.background()
		}
		if p.timeout > 0 && p.pinggap > 0 {
			p.backgroundPing()
		}
	}
	if option.ConnLifetime > 0 {
		p.lftm = option.ConnLifetime
		p.lftmTimer = time.AfterFunc(option.ConnLifetime, p.expired)
	}
	return p, nil
}

func (p *pipe) background() {
	if p.queue != nil {
		atomic.CompareAndSwapInt32(&p.state, 0, 1)
		if atomic.CompareAndSwapInt32(&p.bgState, 0, 1) {
			go p._background()
		}
	}
}

func (p *pipe) _exit(err error) {
	p.error.CompareAndSwap(nil, &errs{error: err})
	atomic.CompareAndSwapInt32(&p.state, 1, 2) // stop accepting new requests
	_ = p.conn.Close()                         // force both read & write goroutine to exit
	p.StopTimer()
	p.clhks.Load().(func(error))(err)
}

func disableNoDelay(conn net.Conn) {
	if c, ok := conn.(*tls.Conn); ok {
		conn = c.NetConn()
	}
	if c, ok := conn.(*net.TCPConn); ok {
		c.SetNoDelay(false)
	}
}

func (p *pipe) _background() {
	p.conn.SetDeadline(time.Time{})
	if p.noNoDelay {
		disableNoDelay(p.conn)
	}
	go func() {
		p._exit(p._backgroundWrite())
		close(p.close)
	}()
	{
		p._exit(p._backgroundRead())
		select {
		case <-p.close:
		default:
			p.incrWaits()
			go func() {
				ch, _ := p.queue.PutOne(context.Background(), cmds.PingCmd) // avoid _backgroundWrite hanging at p.queue.WaitForWrite()
				<-ch
				p.decrWaits()
			}()
		}
	}
	if p.pingTimer != nil {
		p.pingTimer.Stop()
	}
	err := p.Error()
	p.nsubs.Close()
	p.psubs.Close()
	p.ssubs.Close()
	if old := p.pshks.Swap(emptypshks); old.close != nil {
		old.close <- err
		close(old.close)
	}

	var (
		resps []RedisResult
		ch    chan RedisResult
	)

	// clean up cache and free pending calls
	if p.cache != nil {
		p.cache.Close(ErrDoCacheAborted)
	}
	if p.onInvalidations != nil {
		p.onInvalidations(nil)
	}

	resp := newErrResult(err)
	for p.loadWaits() != 0 {
		select {
		case <-p.close: // p.queue.NextWriteCmd() can only be called after _backgroundWrite
			_, _, _ = p.queue.NextWriteCmd()
		default:
		}
		if _, _, ch, resps = p.queue.NextResultCh(); ch != nil {
			for i := range resps {
				resps[i] = resp
			}
			ch <- resp
			p.queue.FinishResult()
		} else {
			p.queue.FinishResult()
			runtime.Gosched()
		}
	}
	<-p.close
	atomic.StoreInt32(&p.state, 4)
}

func (p *pipe) _backgroundWrite() (err error) {
	var (
		ones  = make([]Completed, 1)
		multi []Completed
		ch    chan RedisResult

		flushDelay = p.maxFlushDelay
		flushStart = time.Time{}
	)

	for err == nil {
		if ones[0], multi, ch = p.queue.NextWriteCmd(); ch == nil {
			if flushDelay != 0 {
				flushStart = time.Now()
			}
			if p.w.Buffered() != 0 {
				if err = p.w.Flush(); err != nil {
					break
				}
			}
			ones[0], multi, ch = p.queue.WaitForWrite()
			if flushDelay != 0 && p.loadWaits() > 1 { // do not delay for sequential usage
				// Blocking commands are executed in a dedicated client which is acquired from the pool.
				// So, there is no sense to wait for other commands to be written.
				// https://github.com/redis/rueidis/issues/379
				var blocked bool
				for i := 0; i < len(multi) && !blocked; i++ {
					blocked = multi[i].IsBlock()
				}
				if !blocked {
					time.Sleep(flushDelay - time.Since(flushStart)) // ref: https://github.com/redis/rueidis/issues/156
				}
			}
		}
		if ch != nil && multi == nil {
			multi = ones
		}
		for _, cmd := range multi {
			err = writeCmd(p.w, cmd.Commands())
			if cmd.IsUnsub() { // See https://github.com/redis/rueidis/pull/691
				err = writeCmd(p.w, cmds.PingCmd.Commands())
			}
		}
	}
	return
}

func (p *pipe) _backgroundRead() (err error) {
	var (
		msg   RedisMessage
		ones  = make([]Completed, 1)
		multi []Completed
		resps []RedisResult
		ch    chan RedisResult
		ff    int // fulfilled count
		skip  int // skip the rest push messages
		ver   = p.version
		prply bool // push reply
		unsub bool // unsubscribe notification

		skipUnsubReply bool // if unsubscribe is replied

		r2ps = p.r2ps
	)

	defer func() {
		resp := newErrResult(err)
		if e := p.Error(); e == errConnExpired {
			resp = newErrResult(e)
		}
		if err != nil && ff < len(multi) {
			for ; ff < len(resps); ff++ {
				resps[ff] = resp
			}
			ch <- resp
			p.queue.FinishResult()
		}
	}()

	for {
		if msg, err = readNextMessage(p.r); err != nil {
			return
		}
		if msg.typ == '>' || (r2ps && len(msg.values()) != 0 && msg.values()[0].string() != "pong") {
			if prply, unsub = p.handlePush(msg.values()); !prply {
				continue
			}
			if skip > 0 {
				skip--
				prply = false
				unsub = false
				continue
			}
		} else if ver == 6 && len(msg.values()) != 0 {
			// This is a workaround for Redis 6's broken invalidation protocol: https://github.com/redis/redis/issues/8935
			// When Redis 6 handles MULTI, MGET, or other multi-keys command,
			// it will send invalidation messages immediately if it finds the keys are expired, thus causing the multi-keys command response to be broken.
			// We fix this by fetching the next message and patching it back to the response.
			i := 0
			for j, v := range msg.values() {
				if v.typ == '>' {
					p.handlePush(v.values())
				} else {
					if i != j {
						msg.values()[i] = v
					}
					i++
				}
			}
			for ; i < len(msg.values()); i++ {
				if msg.values()[i], err = readNextMessage(p.r); err != nil {
					return
				}
			}
		}
		if ff == len(multi) {
			ff = 0
			ones[0], multi, ch, resps = p.queue.NextResultCh() // ch should not be nil; otherwise, it must be a protocol bug
			if ch == nil {
				p.queue.FinishResult()
				// Redis will send sunsubscribe notification proactively in the event of slot migration.
				// We should ignore them and go fetch the next message.
				// We also treat all the other unsubscribe notifications just like sunsubscribe,
				// so that we don't need to track how many channels we have subscribed to deal with wildcard unsubscribe command
				// See https://github.com/redis/rueidis/pull/691
				if unsub {
					prply = false
					unsub = false
					continue
				}
				if skipUnsubReply && isUnsubReply(&msg) {
					skipUnsubReply = false
					continue
				}
				panic(protocolbug)
			}
			if multi == nil {
				multi = ones
			}
		} else if ff >= 4 && len(msg.values()) >= 2 && multi[0].IsOptIn() { // if unfulfilled multi commands are lead by opt-in and get a success response
			now := time.Now()
			if cacheable := Cacheable(multi[ff-1]); cacheable.IsMGet() {
				cc := cmds.MGetCacheCmd(cacheable)
				msgs := msg.values()[len(msg.values())-1].values()
				for i, cp := range msgs {
					ck := cmds.MGetCacheKey(cacheable, i)
					cp.attrs = cacheMark
					if pttl := msg.values()[i].intlen; pttl >= 0 {
						cp.setExpireAt(now.Add(time.Duration(pttl) * time.Millisecond).UnixMilli())
					}
					msgs[i].setExpireAt(p.cache.Update(ck, cc, cp))
				}
			} else {
				ck, cc := cmds.CacheKey(cacheable)
				ci := len(msg.values()) - 1
				cp := msg.values()[ci]
				cp.attrs = cacheMark
				if pttl := msg.values()[ci-1].intlen; pttl >= 0 {
					cp.setExpireAt(now.Add(time.Duration(pttl) * time.Millisecond).UnixMilli())
				}
				msg.values()[ci].setExpireAt(p.cache.Update(ck, cc, cp))
			}
		}
		if prply {
			// Redis will send sunsubscribe notification proactively in the event of slot migration.
			// We should ignore them and go fetch the next message.
			// We also treat all the other unsubscribe notifications just like sunsubscribe,
			// so that we don't need to track how many channels we have subscribed to deal with wildcard unsubscribe command
			// See https://github.com/redis/rueidis/pull/691
			if unsub {
				prply = false
				unsub = false
				continue
			}
			prply = false
			unsub = false
			if !multi[ff].NoReply() {
				panic(protocolbug)
			}
			skip = len(multi[ff].Commands()) - 2
			msg = RedisMessage{} // override successful subscribe/unsubscribe response to empty
		} else if multi[ff].NoReply() && msg.string() == "QUEUED" {
			panic(multiexecsub)
		} else if multi[ff].IsUnsub() && !isUnsubReply(&msg) {
			// See https://github.com/redis/rueidis/pull/691
			skipUnsubReply = true
		} else if skipUnsubReply {
			// See https://github.com/redis/rueidis/pull/691
			if !isUnsubReply(&msg) {
				panic(protocolbug)
			}
			skipUnsubReply = false
			continue
		}
		resp := newResult(msg, err)
		if resps != nil {
			resps[ff] = resp
		}
		if ff++; ff == len(multi) {
			ch <- resp
			p.queue.FinishResult()
		}
	}
}

func (p *pipe) backgroundPing() {
	var prev, recv int32

	prev = p.loadRecvs()
	p.pingTimer = time.AfterFunc(p.pinggap, func() {
		var err error
		recv = p.loadRecvs()
		defer func() {
			if err == nil && p.Error() == nil {
				prev = p.loadRecvs()
				p.pingTimer.Reset(p.pinggap)
			}
		}()
		if recv != prev || atomic.LoadInt32(&p.blcksig) != 0 || (atomic.LoadInt32(&p.state) == 0 && p.loadWaits() != 0) {
			return
		}
		ch := make(chan error, 1)
		tm := time.NewTimer(p.timeout)
		go func() { ch <- p.Do(context.Background(), cmds.PingCmd).NonRedisError() }()
		select {
		case <-tm.C:
			err = os.ErrDeadlineExceeded
		case err = <-ch:
			tm.Stop()
		}
		if err != nil && atomic.LoadInt32(&p.blcksig) != 0 {
			err = nil
		}
		if err != nil && err != ErrClosing {
			p._exit(err)
		}
	})
}

func (p *pipe) handlePush(values []RedisMessage) (reply bool, unsubscribe bool) {
	if len(values) < 2 {
		return
	}
	// TODO: handle other push data
	// tracking-redir-broken
	// server-cpu-usage
	switch values[0].string() {
	case "invalidate":
		if p.cache != nil {
			if values[1].IsNil() {
				p.cache.Delete(nil)
			} else {
				p.cache.Delete(values[1].values())
			}
		}
		if p.onInvalidations != nil {
			if values[1].IsNil() {
				p.onInvalidations(nil)
			} else {
				p.onInvalidations(values[1].values())
			}
		}
	case "message":
		if len(values) >= 3 {
			m := PubSubMessage{Channel: values[1].string(), Message: values[2].string()}
			p.nsubs.Publish(values[1].string(), m)
			p.pshks.Load().hooks.OnMessage(m)
		}
	case "pmessage":
		if len(values) >= 4 {
			m := PubSubMessage{Pattern: values[1].string(), Channel: values[2].string(), Message: values[3].string()}
			p.psubs.Publish(values[1].string(), m)
			p.pshks.Load().hooks.OnMessage(m)
		}
	case "smessage":
		if len(values) >= 3 {
			m := PubSubMessage{Channel: values[1].string(), Message: values[2].string()}
			p.ssubs.Publish(values[1].string(), m)
			p.pshks.Load().hooks.OnMessage(m)
		}
	case "unsubscribe":
		if len(values) >= 3 {
			s := PubSubSubscription{Kind: values[0].string(), Channel: values[1].string(), Count: values[2].intlen}
			p.nsubs.Unsubscribe(s)
			p.pshks.Load().hooks.OnSubscription(s)
		}
		return true, true
	case "punsubscribe":
		if len(values) >= 3 {
			s := PubSubSubscription{Kind: values[0].string(), Channel: values[1].string(), Count: values[2].intlen}
			p.psubs.Unsubscribe(s)
			p.pshks.Load().hooks.OnSubscription(s)
		}
		return true, true
	case "sunsubscribe":
		if len(values) >= 3 {
			s := PubSubSubscription{Kind: values[0].string(), Channel: values[1].string(), Count: values[2].intlen}
			p.ssubs.Unsubscribe(s)
			p.pshks.Load().hooks.OnSubscription(s)
		}
		return true, true
	case "subscribe":
		if len(values) >= 3 {
			s := PubSubSubscription{Kind: values[0].string(), Channel: values[1].string(), Count: values[2].intlen}
			p.nsubs.Confirm(s)
			p.pshks.Load().hooks.OnSubscription(s)
		}
		return true, false
	case "psubscribe":
		if len(values) >= 3 {
			s := PubSubSubscription{Kind: values[0].string(), Channel: values[1].string(), Count: values[2].intlen}
			p.psubs.Confirm(s)
			p.pshks.Load().hooks.OnSubscription(s)
		}
		return true, false
	case "ssubscribe":
		if len(values) >= 3 {
			s := PubSubSubscription{Kind: values[0].string(), Channel: values[1].string(), Count: values[2].intlen}
			p.ssubs.Confirm(s)
			p.pshks.Load().hooks.OnSubscription(s)
		}
		return true, false
	}
	return false, false
}

type recvCtxKey int

const hookKey recvCtxKey = 0

// WithOnSubscriptionHook attaches a subscription confirmation hook to the provided
// context and returns a new context for the Receive method.
//
// The hook is invoked each time the server sends a subscribe or
// unsubscribe confirmation, allowing callers to observe the state of a Pub/Sub
// subscription during the lifetime of a Receive invocation.
//
// The hook may be called multiple times because the client can resubscribe after a
// reconnection. Therefore, the hook implementation must be safe to run more than once.
// Also, there should not be any blocking operations or another `client.Do()` in the hook
// since it runs in the same goroutine as the pipeline. Otherwise, the pipeline will be blocked.
func WithOnSubscriptionHook(ctx context.Context, hook func(PubSubSubscription)) context.Context {
	return context.WithValue(ctx, hookKey, hook)
}

func (p *pipe) Receive(ctx context.Context, subscribe Completed, fn func(message PubSubMessage)) error {
	if p.nsubs == nil || p.psubs == nil || p.ssubs == nil {
		return p.Error()
	}

	if p.r2p != nil {
		return p.r2p.pipe(ctx).Receive(ctx, subscribe, fn)
	}

	cmds.CompletedCS(subscribe).Verify()

	var sb *subs
	cmd, args := subscribe.Commands()[0], subscribe.Commands()[1:]

	switch cmd {
	case "SUBSCRIBE":
		sb = p.nsubs
	case "PSUBSCRIBE":
		sb = p.psubs
	case "SSUBSCRIBE":
		sb = p.ssubs
	default:
		panic(wrongreceive)
	}

	var hook func(PubSubSubscription)
	if v := ctx.Value(hookKey); v != nil {
		hook = v.(func(PubSubSubscription))
	}
	if ch, cancel := sb.Subscribe(args, hook); ch != nil {
		defer cancel()
		if err := p.Do(ctx, subscribe).Error(); err != nil {
			return err
		}
		if ctxCh := ctx.Done(); ctxCh == nil {
			for msg := range ch {
				fn(msg)
			}
		} else {
		next:
			select {
			case msg, ok := <-ch:
				if ok {
					fn(msg)
					goto next
				}
			case <-ctx.Done():
				return ctx.Err()
			}
		}
	}
	return p.Error()
}

func (p *pipe) CleanSubscriptions() {
	if atomic.LoadInt32(&p.blcksig) != 0 {
		p.Close()
	} else if atomic.LoadInt32(&p.state) == 1 {
		if p.version >= 7 {
			p.DoMulti(context.Background(), cmds.UnsubscribeCmd, cmds.PUnsubscribeCmd, cmds.SUnsubscribeCmd, cmds.DiscardCmd)
		} else {
			p.DoMulti(context.Background(), cmds.UnsubscribeCmd, cmds.PUnsubscribeCmd, cmds.DiscardCmd)
		}
	}
}

func (p *pipe) SetPubSubHooks(hooks PubSubHooks) <-chan error {
	if p.r2p != nil {
		return p.r2p.pipe(context.Background()).SetPubSubHooks(hooks)
	}
	if hooks.isZero() {
		if old := p.pshks.Swap(emptypshks); old.close != nil {
			close(old.close)
		}
		return nil
	}
	if hooks.OnMessage == nil {
		hooks.OnMessage = func(m PubSubMessage) {}
	}
	if hooks.OnSubscription == nil {
		hooks.OnSubscription = func(s PubSubSubscription) {}
	}
	ch := make(chan error, 1)
	if old := p.pshks.Swap(&pshks{hooks: hooks, close: ch}); old.close != nil {
		close(old.close)
	}
	if err := p.Error(); err != nil {
		if old := p.pshks.Swap(emptypshks); old.close != nil {
			old.close <- err
			close(old.close)
		}
	}
	if p.incrWaits() == 1 && atomic.LoadInt32(&p.state) == 0 {
		p.background()
	}
	p.decrWaits()
	return ch
}

func (p *pipe) SetOnCloseHook(fn func(error)) {
	p.clhks.Store(fn)
}

func (p *pipe) Info() map[string]RedisMessage {
	return p.info
}

func (p *pipe) Version() int {
	return int(p.version)
}

func (p *pipe) AZ() string {
	infoAvailabilityZone := p.info["availability_zone"]
	return infoAvailabilityZone.string()
}

func (p *pipe) Do(ctx context.Context, cmd Completed) (resp RedisResult) {
	if err := ctx.Err(); err != nil {
		return newErrResult(err)
	}

	cmds.CompletedCS(cmd).Verify()
	if cmd.IsBlock() {
		atomic.AddInt32(&p.blcksig, 1)
		defer func() {
			if resp.err == nil {
				atomic.AddInt32(&p.blcksig, -1)
			}
		}()
	}

	if cmd.NoReply() {
		if p.r2p != nil {
			return p.r2p.pipe(ctx).Do(ctx, cmd)
		}
	}
	waits := p.incrWaits() // if this is 1, and the background worker is not started, no need to queue
	state := atomic.LoadInt32(&p.state)

	if state == 1 {
		goto queue
	}

	if state == 0 {
		if waits != 1 {
			goto queue
		}
		if cmd.NoReply() {
			p.background()
			goto queue
		}
		dl, ok := ctx.Deadline()
		if p.queue != nil && !ok && ctx.Done() != nil {
			p.background()
			goto queue
		}
		resp = p.syncDo(dl, ok, cmd)
	} else {
		resp = newErrResult(p.Error())
	}

	if left := p.decrWaitsAndIncrRecvs(); state == 0 && left != 0 {
		p.background()
	}
	return resp

queue:
	ch, err := p.queue.PutOne(ctx, cmd)
	if err != nil {
		p.decrWaits()
		return newErrResult(err)
	}

	if ctxCh := ctx.Done(); ctxCh == nil {
		resp = <-ch
	} else {
		select {
		case resp = <-ch:
		case <-ctxCh:
			goto abort
		}
	}
	p.decrWaitsAndIncrRecvs()
	return resp
abort:
	go func(ch chan RedisResult) {
		<-ch
		p.decrWaitsAndIncrRecvs()
	}(ch)
	return newErrResult(ctx.Err())
}

func (p *pipe) DoMulti(ctx context.Context, multi ...Completed) *redisresults {
	resp := resultsp.Get(len(multi), len(multi))
	if err := ctx.Err(); err != nil {
		for i := 0; i < len(resp.s); i++ {
			resp.s[i] = newErrResult(err)
		}
		return resp
	}

	cmds.CompletedCS(multi[0]).Verify()

	isOptIn := multi[0].IsOptIn() // len(multi) > 0 should have already been checked by the upper layer
	noReply := 0

	for _, cmd := range multi {
		if cmd.NoReply() {
			noReply++
		}
	}

	if p.version < 6 && noReply != 0 {
		if noReply != len(multi) {
			for i := 0; i < len(resp.s); i++ {
				resp.s[i] = newErrResult(ErrRESP2PubSubMixed)
			}
			return resp
		} else if p.r2p != nil {
			resultsp.Put(resp)
			return p.r2p.pipe(ctx).DoMulti(ctx, multi...)
		}
	}

	for _, cmd := range multi {
		if cmd.IsBlock() {
			if noReply != 0 {
				for i := 0; i < len(resp.s); i++ {
					resp.s[i] = newErrResult(ErrBlockingPubSubMixed)
				}
				return resp
			}
			atomic.AddInt32(&p.blcksig, 1)
			defer func() {
				for _, r := range resp.s {
					if r.err != nil {
						return
					}
				}
				atomic.AddInt32(&p.blcksig, -1)
			}()
			break
		}
	}

	waits := p.incrWaits() // if this is 1, and the background worker is not started, no need to queue
	state := atomic.LoadInt32(&p.state)

	if state == 1 {
		goto queue
	}

	if state == 0 {
		if waits != 1 {
			goto queue
		}
		if isOptIn || noReply != 0 {
			p.background()
			goto queue
		}
		dl, ok := ctx.Deadline()
		if p.queue != nil && !ok && ctx.Done() != nil {
			p.background()
			goto queue
		}
		p.syncDoMulti(dl, ok, resp.s, multi)
	} else {
		err := newErrResult(p.Error())
		for i := 0; i < len(resp.s); i++ {
			resp.s[i] = err
		}
	}
	if left := p.decrWaitsAndIncrRecvs(); state == 0 && left != 0 {
		p.background()
	}
	return resp

queue:
	ch, err := p.queue.PutMulti(ctx, multi, resp.s)
	if err != nil {
		p.decrWaits()
		errResult := newErrResult(err)
		for i := 0; i < len(resp.s); i++ {
			resp.s[i] = errResult
		}
		return resp
	}

	if ctxCh := ctx.Done(); ctxCh == nil {
		<-ch
	} else {
		select {
		case <-ch:
		case <-ctxCh:
			goto abort
		}
	}
	p.decrWaitsAndIncrRecvs()
	return resp
abort:
	go func(resp *redisresults, ch chan RedisResult) {
		<-ch
		resultsp.Put(resp)
		p.decrWaitsAndIncrRecvs()
	}(resp, ch)
	resp = resultsp.Get(len(multi), len(multi))
	errResult := newErrResult(ctx.Err())
	for i := 0; i < len(resp.s); i++ {
		resp.s[i] = errResult
	}
	return resp
}

type MultiRedisResultStream = RedisResultStream

type RedisResultStream struct {
	p *pool
	w *pipe
	e error
	n int
}

// HasNext can be used in a for loop condition to check if a further WriteTo call is needed.
func (s *RedisResultStream) HasNext() bool {
	return s.n > 0 && s.e == nil
}

// Error returns the error happened when sending commands to redis or reading response from redis.
// Usually a user is not required to use this function because the error is also reported by the WriteTo.
func (s *RedisResultStream) Error() error {
	return s.e
}

// WriteTo reads a redis response from redis and then write it to the given writer.
// This function is not thread-safe and should be called sequentially to read multiple responses.
// An io.EOF error will be reported if all responses are read.
func (s *RedisResultStream) WriteTo(w io.Writer) (n int64, err error) {
	if err = s.e; err == nil && s.n > 0 {
		var clean bool
		if n, err, clean = streamTo(s.w.r, w); !clean {
			s.e = err // err must not be nil in case of !clean
			s.n = 1
		}
		if s.n--; s.n == 0 {
			atomic.AddInt32(&s.w.blcksig, -1)
			s.w.decrWaits()
			if s.e == nil {
				s.e = io.EOF
			} else {
				s.w.Close()
			}
			s.p.Store(s.w)
		}
	}
	return n, err
}

func (p *pipe) DoStream(ctx context.Context, pool *pool, cmd Completed) RedisResultStream {
	cmds.CompletedCS(cmd).Verify()

	if err := ctx.Err(); err != nil {
		return RedisResultStream{e: err}
	}

	state := atomic.LoadInt32(&p.state)

	if state == 1 {
		panic("DoStream with auto pipelining is a bug")
	}

	if state == 0 {
		atomic.AddInt32(&p.blcksig, 1)
		waits := p.incrWaits()
		if waits != 1 {
			panic("DoStream with racing is a bug")
		}
		dl, ok := ctx.Deadline()
		if ok {
			if p.timeout > 0 && !cmd.IsBlock() {
				defaultDeadline := time.Now().Add(p.timeout)
				if dl.After(defaultDeadline) {
					dl = defaultDeadline
				}
			}
			p.conn.SetDeadline(dl)
		} else if p.timeout > 0 && !cmd.IsBlock() {
			p.conn.SetDeadline(time.Now().Add(p.timeout))
		} else {
			p.conn.SetDeadline(time.Time{})
		}
		_ = writeCmd(p.w, cmd.Commands())
		if err := p.w.Flush(); err != nil {
			p.error.CompareAndSwap(nil, &errs{error: err})
			p.conn.Close()
			p.background() // start the background worker to clean up goroutines
		} else {
			return RedisResultStream{p: pool, w: p, n: 1}
		}
	}
	atomic.AddInt32(&p.blcksig, -1)
	p.decrWaits()
	pool.Store(p)
	return RedisResultStream{e: p.Error()}
}

func (p *pipe) DoMultiStream(ctx context.Context, pool *pool, multi ...Completed) MultiRedisResultStream {
	for _, cmd := range multi {
		cmds.CompletedCS(cmd).Verify()
	}

	if err := ctx.Err(); err != nil {
		return RedisResultStream{e: err}
	}

	state := atomic.LoadInt32(&p.state)

	if state == 1 {
		panic("DoMultiStream with auto pipelining is a bug")
	}

	if state == 0 {
		atomic.AddInt32(&p.blcksig, 1)
		waits := p.incrWaits()
		if waits != 1 {
			panic("DoMultiStream with racing is a bug")
		}
		dl, ok := ctx.Deadline()
		if ok {
			if p.timeout > 0 {
				for _, cmd := range multi {
					if cmd.IsBlock() {
						p.conn.SetDeadline(dl)
						goto process
					}
				}
				defaultDeadline := time.Now().Add(p.timeout)
				if dl.After(defaultDeadline) {
					dl = defaultDeadline
				}
			}
			p.conn.SetDeadline(dl)
		} else if p.timeout > 0 {
			for _, cmd := range multi {
				if cmd.IsBlock() {
					p.conn.SetDeadline(time.Time{})
					goto process
				}
			}
			p.conn.SetDeadline(time.Now().Add(p.timeout))
		} else {
			p.conn.SetDeadline(time.Time{})
		}
	process:
		for _, cmd := range multi {
			_ = writeCmd(p.w, cmd.Commands())
		}
		if err := p.w.Flush(); err != nil {
			p.error.CompareAndSwap(nil, &errs{error: err})
			p.conn.Close()
			p.background() // start the background worker to clean up goroutines
		} else {
			return RedisResultStream{p: pool, w: p, n: len(multi)}
		}
	}
	atomic.AddInt32(&p.blcksig, -1)
	p.decrWaits()
	pool.Store(p)
	return RedisResultStream{e: p.Error()}
}

func (p *pipe) syncDo(dl time.Time, dlOk bool, cmd Completed) (resp RedisResult) {
	if dlOk {
		if p.timeout > 0 && !cmd.IsBlock() {
			defaultDeadline := time.Now().Add(p.timeout)
			if dl.After(defaultDeadline) {
				dl = defaultDeadline
				dlOk = false
			}
		}
		p.conn.SetDeadline(dl)
	} else if p.timeout > 0 && !cmd.IsBlock() {
		p.conn.SetDeadline(time.Now().Add(p.timeout))
	} else {
		p.conn.SetDeadline(time.Time{})
	}

	var msg RedisMessage
	err := flushCmd(p.w, cmd.Commands())
	if err == nil {
		msg, err = syncRead(p.r)
	}
	if err != nil {
		if dlOk && errors.Is(err, os.ErrDeadlineExceeded) {
			err = context.DeadlineExceeded
		}
		p.error.CompareAndSwap(nil, &errs{error: err})
		p.conn.Close()
		p.background() // start the background worker to clean up goroutines
	}
	return newResult(msg, err)
}

func (p *pipe) syncDoMulti(dl time.Time, dlOk bool, resp []RedisResult, multi []Completed) {
	if dlOk {
		if p.timeout > 0 {
			for _, cmd := range multi {
				if cmd.IsBlock() {
					p.conn.SetDeadline(dl)
					goto process
				}
			}
			defaultDeadline := time.Now().Add(p.timeout)
			if dl.After(defaultDeadline) {
				dl = defaultDeadline
				dlOk = false
			}
		}
		p.conn.SetDeadline(dl)
	} else if p.timeout > 0 {
		for _, cmd := range multi {
			if cmd.IsBlock() {
				p.conn.SetDeadline(time.Time{})
				goto process
			}
		}
		p.conn.SetDeadline(time.Now().Add(p.timeout))
	} else {
		p.conn.SetDeadline(time.Time{})
	}
process:
	var err error
	var msg RedisMessage
	for _, cmd := range multi {
		_ = writeCmd(p.w, cmd.Commands())
	}
	if err = p.w.Flush(); err != nil {
		goto abort
	}
	for i := 0; i < len(resp); i++ {
		if msg, err = syncRead(p.r); err != nil {
			goto abort
		}
		resp[i] = newResult(msg, err)
	}
	return
abort:
	if dlOk && errors.Is(err, os.ErrDeadlineExceeded) {
		err = context.DeadlineExceeded
	}
	p.error.CompareAndSwap(nil, &errs{error: err})
	p.conn.Close()
	p.background() // start the background worker to clean up goroutines
	for i := 0; i < len(resp); i++ {
		resp[i] = newErrResult(err)
	}
}

func syncRead(r *bufio.Reader) (m RedisMessage, err error) {
next:
	if m, err = readNextMessage(r); err != nil {
		return m, err
	}
	if m.typ == '>' {
		goto next
	}
	return m, nil
}

func (p *pipe) optInCmd() cmds.Completed {
	if p.optIn {
		return cmds.OptInCmd
	}
	return cmds.OptInNopCmd
}

func (p *pipe) DoCache(ctx context.Context, cmd Cacheable, ttl time.Duration) RedisResult {
	if p.cache == nil {
		return p.Do(ctx, Completed(cmd))
	}

	cmds.CacheableCS(cmd).Verify()

	if cmd.IsMGet() {
		return p.doCacheMGet(ctx, cmd, ttl)
	}
	ck, cc := cmds.CacheKey(cmd)
	now := time.Now()
	if v, entry := p.cache.Flight(ck, cc, ttl, now); v.typ != 0 {
		return newResult(v, nil)
	} else if entry != nil {
		return newResult(entry.Wait(ctx))
	}
	resp := p.DoMulti(
		ctx,
		p.optInCmd(),
		cmds.MultiCmd,
		cmds.NewCompleted([]string{"PTTL", ck}),
		Completed(cmd),
		cmds.ExecCmd,
	)
	defer resultsp.Put(resp)
	exec, err := resp.s[4].ToArray()
	if err != nil {
		if _, ok := err.(*RedisError); ok {
			err = ErrDoCacheAborted
			if preErr := resp.s[3].Error(); preErr != nil { // if {cmd} get a RedisError
				if _, ok := preErr.(*RedisError); ok {
					err = preErr
				}
			}
		}
		p.cache.Cancel(ck, cc, err)
		return newErrResult(err)
	}
	return newResult(exec[1], nil)
}

func (p *pipe) doCacheMGet(ctx context.Context, cmd Cacheable, ttl time.Duration) RedisResult {
	commands := cmd.Commands()
	keys := len(commands) - 1
	builder := cmds.NewBuilder(cmds.InitSlot)
	result := RedisResult{val: RedisMessage{typ: '*'}}
	mgetcc := cmds.MGetCacheCmd(cmd)
	if mgetcc[0] == 'J' {
		keys-- // the last one of JSON.MGET is a path, not a key
	}
	entries := entriesp.Get(keys, keys)
	defer entriesp.Put(entries)
	var now = time.Now()
	var rewrite cmds.Arbitrary
	for i, key := range commands[1 : keys+1] {
		v, entry := p.cache.Flight(key, mgetcc, ttl, now)
		if v.typ != 0 { // cache hit for one key
			if len(result.val.values()) == 0 {
				result.val.setValues(make([]RedisMessage, keys))

			}
			result.val.values()[i] = v
			continue
		}
		if entry != nil {
			entries.e[i] = entry // store entries for later entry.Wait() to avoid MGET deadlock each others.
			continue
		}
		if rewrite.IsZero() {
			rewrite = builder.Arbitrary(commands[0])
		}
		rewrite = rewrite.Args(key)
	}

	var partial []RedisMessage
	if !rewrite.IsZero() {
		var rewritten Completed
		var keys int
		if mgetcc[0] == 'J' { // rewrite JSON.MGET path
			rewritten = rewrite.Args(commands[len(commands)-1]).MultiGet()
			keys = len(rewritten.Commands()) - 2
		} else {
			rewritten = rewrite.MultiGet()
			keys = len(rewritten.Commands()) - 1
		}

		multi := make([]Completed, 0, keys+4)
		multi = append(multi, p.optInCmd(), cmds.MultiCmd)
		for _, key := range rewritten.Commands()[1 : keys+1] {
			multi = append(multi, builder.Pttl().Key(key).Build())
		}
		multi = append(multi, rewritten, cmds.ExecCmd)

		resp := p.DoMulti(ctx, multi...)
		defer resultsp.Put(resp)
		exec, err := resp.s[len(multi)-1].ToArray()
		if err != nil {
			if _, ok := err.(*RedisError); ok {
				err = ErrDoCacheAborted
				if preErr := resp.s[len(multi)-2].Error(); preErr != nil { // if {rewritten} get a RedisError
					if _, ok := preErr.(*RedisError); ok {
						err = preErr
					}
				}
			}
			for _, key := range rewritten.Commands()[1 : keys+1] {
				p.cache.Cancel(key, mgetcc, err)
			}
			return newErrResult(err)
		}
		defer func() {
			for _, cmd := range multi[2 : len(multi)-1] {
				cmds.PutCompleted(cmd)
			}
		}()
		last := len(exec) - 1
		if len(rewritten.Commands()) == len(commands) { // all cache misses
			return newResult(exec[last], nil)
		}
		partial = exec[last].values()
	} else { // all cache hit
		result.val.attrs = cacheMark
	}

	if len(result.val.values()) == 0 {
		result.val.setValues(make([]RedisMessage, keys))
	}
	for i, entry := range entries.e {
		v, err := entry.Wait(ctx)
		if err != nil {
			return newErrResult(err)
		}
		result.val.values()[i] = v
	}

	j := 0
	for _, ret := range partial {
		for ; j < len(result.val.values()); j++ {
			if result.val.values()[j].typ == 0 {
				result.val.values()[j] = ret
				break
			}
		}
	}
	return result
}

func (p *pipe) DoMultiCache(ctx context.Context, multi ...CacheableTTL) *redisresults {
	if p.cache == nil {
		commands := make([]Completed, len(multi))
		for i, ct := range multi {
			commands[i] = Completed(ct.Cmd)
		}
		return p.DoMulti(ctx, commands...)
	}

	cmds.CacheableCS(multi[0].Cmd).Verify()

	results := resultsp.Get(len(multi), len(multi))
	entries := entriesp.Get(len(multi), len(multi))
	defer entriesp.Put(entries)
	var missing []Completed
	now := time.Now()
	for _, ct := range multi {
		if ct.Cmd.IsMGet() {
			panic(panicmgetcsc)
		}
	}
	if cache, ok := p.cache.(*lru); ok {
		missed := cache.Flights(now, multi, results.s, entries.e)
		for _, i := range missed {
			ct := multi[i]
			ck, _ := cmds.CacheKey(ct.Cmd)
			missing = append(missing, p.optInCmd(), cmds.MultiCmd, cmds.NewCompleted([]string{"PTTL", ck}), Completed(ct.Cmd), cmds.ExecCmd)
		}
	} else {
		for i, ct := range multi {
			ck, cc := cmds.CacheKey(ct.Cmd)
			v, entry := p.cache.Flight(ck, cc, ct.TTL, now)
			if v.typ != 0 { // cache hit for one key
				results.s[i] = newResult(v, nil)
				continue
			}
			if entry != nil {
				entries.e[i] = entry // store entries for later entry.Wait() to avoid MGET deadlock each others.
				continue
			}
			missing = append(missing, p.optInCmd(), cmds.MultiCmd, cmds.NewCompleted([]string{"PTTL", ck}), Completed(ct.Cmd), cmds.ExecCmd)
		}
	}

	var resp *redisresults
	if len(missing) > 0 {
		resp = p.DoMulti(ctx, missing...)
		defer resultsp.Put(resp)
		for i := 4; i < len(resp.s); i += 5 {
			if err := resp.s[i].Error(); err != nil {
				if _, ok := err.(*RedisError); ok {
					err = ErrDoCacheAborted
					if preErr := resp.s[i-1].Error(); preErr != nil { // if {cmd} get a RedisError
						if _, ok := preErr.(*RedisError); ok {
							err = preErr
						}
					}
				}
				ck, cc := cmds.CacheKey(Cacheable(missing[i-1]))
				p.cache.Cancel(ck, cc, err)
			}
		}
	}

	for i, entry := range entries.e {
		results.s[i] = newResult(entry.Wait(ctx))
	}

	if len(missing) == 0 {
		return results
	}

	j := 0
	for i := 4; i < len(resp.s); i += 5 {
		for ; j < len(results.s); j++ {
			if results.s[j].val.typ == 0 && results.s[j].err == nil {
				exec, err := resp.s[i].ToArray()
				if err != nil {
					if _, ok := err.(*RedisError); ok {
						err = ErrDoCacheAborted
						if preErr := resp.s[i-1].Error(); preErr != nil { // if {cmd} get a RedisError
							if _, ok := preErr.(*RedisError); ok {
								err = preErr
							}
						}
					}
					results.s[j] = newErrResult(err)
				} else {
					results.s[j] = newResult(exec[len(exec)-1], nil)
				}
				break
			}
		}
	}
	return results
}

// incrWaits increments the lower 32 bits (waits).
func (p *pipe) incrWaits() uint32 {
	// Increment the lower 32 bits (waits)
	return uint32(p.wrCounter.Add(1))
}

const (
	decrLo       = ^uint64(0)
	decrLoIncrHi = uint64(1<<32) - 1
)

// decrWaits decrements the lower 32 bits (waits).
func (p *pipe) decrWaits() uint32 {
	// Decrement the lower 32 bits (waits)
	return uint32(p.wrCounter.Add(decrLo))
}

// decrWaitsAndIncrRecvs decrements the lower 32 bits (waits) and increments the upper 32 bits (recvs).
func (p *pipe) decrWaitsAndIncrRecvs() uint32 {
	newValue := p.wrCounter.Add(decrLoIncrHi)
	return uint32(newValue)
}

// loadRecvs loads the upper 32 bits (recvs).
func (p *pipe) loadRecvs() int32 {
	// Load the upper 32 bits (recvs)
	return int32(p.wrCounter.Load() >> 32)
}

// loadWaits loads the lower 32 bits (waits).
func (p *pipe) loadWaits() uint32 {
	// Load the lower 32 bits (waits)
	return uint32(p.wrCounter.Load())
}

func (p *pipe) Error() error {
	if err := p.error.Load(); err != nil {
		return err.error
	}
	return nil
}

func (p *pipe) Close() {
	p.error.CompareAndSwap(nil, errClosing)
	block := atomic.AddInt32(&p.blcksig, 1)
	waits := p.incrWaits()
	stopping1 := atomic.CompareAndSwapInt32(&p.state, 0, 2)
	stopping2 := atomic.CompareAndSwapInt32(&p.state, 1, 2)
	if p.queue != nil {
		if stopping1 && waits == 1 { // make sure there is no sync read
			p.background()
		}
		if block == 1 && (stopping1 || stopping2) { // make sure there is no block cmd
			p.incrWaits()
			ch, _ := p.queue.PutOne(context.Background(), cmds.PingCmd)
			select {
			case <-ch:
				p.decrWaits()
			case <-time.After(time.Second):
				go func(ch chan RedisResult) {
					<-ch
					p.decrWaits()
				}(ch)
			}
		}
	}
	p.decrWaits()
	atomic.AddInt32(&p.blcksig, -1)
	if p.pingTimer != nil {
		p.pingTimer.Stop()
	}
	if p.conn != nil {
		p.conn.Close()
	}
	if p.r2p != nil {
		p.r2p.Close()
	}
}

func (p *pipe) StopTimer() bool {
	if p.lftmTimer == nil {
		return true
	}
	return p.lftmTimer.Stop()
}

func (p *pipe) ResetTimer() bool {
	if p.lftmTimer == nil || p.Error() != nil {
		return true
	}
	return p.lftmTimer.Reset(p.lftm)
}

func (p *pipe) expired() {
	p.error.CompareAndSwap(nil, errExpired)
	p.Close()
}

type r2p struct {
	f func(context.Context) (p *pipe, err error) // func to build pipe for resp2 pubsub
	p *pipe                                      // internal pipe for resp2 pubsub only
	m sync.RWMutex
}

func (r *r2p) pipe(ctx context.Context) (r2p *pipe) {
	r.m.RLock()
	r2p = r.p
	r.m.RUnlock()
	if r2p == nil {
		r.m.Lock()
		if r.p != nil {
			r2p = r.p
		} else {
			var err error
			if r2p, err = r.f(ctx); err != nil {
				r2p = epipeFn(err)
			} else {
				r.p = r2p
			}
		}
		r.m.Unlock()
	}
	return r2p
}

func (r *r2p) Close() {
	r.m.RLock()
	if r.p != nil {
		r.p.Close()
	}
	r.m.RUnlock()
}

type pshks struct {
	hooks PubSubHooks
	close chan error
}

var emptypshks = &pshks{
	hooks: PubSubHooks{
		OnMessage:      func(m PubSubMessage) {},
		OnSubscription: func(s PubSubSubscription) {},
	},
	close: nil,
}

var emptyclhks = func(error) {}

func deadFn() *pipe {
	dead := &pipe{state: 3}
	dead.error.Store(errClosing)
	dead.pshks.Store(emptypshks)
	dead.clhks.Store(emptyclhks)
	return dead
}

func epipeFn(err error) *pipe {
	dead := &pipe{state: 3}
	dead.error.Store(&errs{error: err})
	dead.pshks.Store(emptypshks)
	dead.clhks.Store(emptyclhks)
	return dead
}

const (
	protocolbug  = "protocol bug, message handled out of order"
	wrongreceive = "only SUBSCRIBE, SSUBSCRIBE, or PSUBSCRIBE command are allowed in Receive"
	multiexecsub = "SUBSCRIBE/UNSUBSCRIBE are not allowed in MULTI/EXEC block"
	panicmgetcsc = "MGET and JSON.MGET in DoMultiCache are not implemented, use DoCache instead"
)

var cacheMark = &(RedisMessage{})
var (
	errClosing = &errs{error: ErrClosing}
	errExpired = &errs{error: errConnExpired}
)

type errs struct{ error }
