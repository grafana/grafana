package rueidis

import (
	"context"
	"net"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/redis/rueidis/internal/cmds"
	"github.com/redis/rueidis/internal/util"
)

type connFn func(dst string, opt *ClientOption) conn
type dialFn func(ctx context.Context, dst string, opt *ClientOption) (net.Conn, error)
type wireFn func(ctx context.Context) wire

type singleconnect struct {
	w wire
	e error
	g sync.WaitGroup
}

type conn interface {
	Do(ctx context.Context, cmd Completed) RedisResult
	DoCache(ctx context.Context, cmd Cacheable, ttl time.Duration) RedisResult
	DoMulti(ctx context.Context, multi ...Completed) *redisresults
	DoMultiCache(ctx context.Context, multi ...CacheableTTL) *redisresults
	Receive(ctx context.Context, subscribe Completed, fn func(message PubSubMessage)) error
	DoStream(ctx context.Context, cmd Completed) RedisResultStream
	DoMultiStream(ctx context.Context, multi ...Completed) MultiRedisResultStream
	Info() map[string]RedisMessage
	Version() int
	AZ() string
	Error() error
	Close()
	Dial() error
	Override(conn)
	Acquire(ctx context.Context) wire
	Store(w wire)
	Addr() string
	SetOnCloseHook(func(error))
	OptInCmd() cmds.Completed
}

var _ conn = (*mux)(nil)

type muxwire struct {
	wire atomic.Value
	sc   *singleconnect
	mu   sync.Mutex
}

type mux struct {
	init     wire
	dead     wire
	clhks    atomic.Value
	dpool    *pool
	spool    *pool
	wireFn   wireFn
	dst      string
	muxwires []muxwire
	maxp     int
	maxm     int

	usePool bool
	optIn   bool
}

func makeMux(dst string, option *ClientOption, dialFn dialFn) *mux {
	dead := deadFn()
	connFn := func(ctx context.Context) (net.Conn, error) {
		return dialFn(ctx, dst, option)
	}
	wireFn := func(pipeFn pipeFn) func(context.Context) wire {
		return func(ctx context.Context) (w wire) {
			w, err := pipeFn(ctx, connFn, option)
			if err != nil {
				dead.error.Store(&errs{error: err})
				w = dead
			}
			return w
		}
	}
	return newMux(dst, option, (*pipe)(nil), dead, wireFn(newPipe), wireFn(newPipeNoBg))
}

func newMux(dst string, option *ClientOption, init, dead wire, wireFn wireFn, wireNoBgFn wireFn) *mux {
	var multiplex int
	if option.PipelineMultiplex >= 0 {
		multiplex = 1 << option.PipelineMultiplex
	} else {
		multiplex = 1
	}
	m := &mux{dst: dst, init: init, dead: dead, wireFn: wireFn,
		muxwires: make([]muxwire, multiplex),
		maxp:     runtime.GOMAXPROCS(0),
		maxm:     option.BlockingPipeline,

		usePool: option.DisableAutoPipelining,
		optIn:   isOptIn(option.ClientTrackingOptions),
	}
	m.clhks.Store(emptyclhks)
	for i := 0; i < len(m.muxwires); i++ {
		m.muxwires[i].wire.Store(init)
	}

	m.dpool = newPool(option.BlockingPoolSize, dead, option.BlockingPoolCleanup, option.BlockingPoolMinSize, wireFn)
	m.spool = newPool(option.BlockingPoolSize, dead, option.BlockingPoolCleanup, option.BlockingPoolMinSize, wireNoBgFn)
	return m
}

func isOptIn(opts []string) bool {
	for _, opt := range opts {
		if opt := strings.ToUpper(opt); opt == "BCAST" || opt == "OPTOUT" {
			return false
		}
	}
	return true
}

func (m *mux) OptInCmd() cmds.Completed {
	if m.optIn {
		return cmds.OptInCmd
	}
	return cmds.OptInNopCmd
}

func (m *mux) SetOnCloseHook(fn func(error)) {
	m.clhks.Store(fn)
}

func (m *mux) setCloseHookOnWire(i uint16, w wire) {
	if w != m.dead && w != m.init {
		w.SetOnCloseHook(func(err error) {
			if err != ErrClosing {
				if m.muxwires[i].wire.CompareAndSwap(w, m.init) {
					m.clhks.Load().(func(error))(err)
				}
			}
		})
	}
}

func (m *mux) Override(cc conn) {
	if m2, ok := cc.(*mux); ok {
		for i := 0; i < len(m.muxwires) && i < len(m2.muxwires); i++ {
			w := m2.muxwires[i].wire.Load().(wire)
			m.setCloseHookOnWire(uint16(i), w) // bind the new m to the old w
			m.muxwires[i].wire.CompareAndSwap(m.init, w)
		}
	}
}

func (m *mux) _pipe(ctx context.Context, i uint16) (w wire, err error) {
	if w = m.muxwires[i].wire.Load().(wire); w != m.init {
		return w, nil
	}

	m.muxwires[i].mu.Lock()
	sc := m.muxwires[i].sc
	if m.muxwires[i].sc == nil {
		m.muxwires[i].sc = &singleconnect{}
		m.muxwires[i].sc.g.Add(1)
	}
	m.muxwires[i].mu.Unlock()

	if sc != nil {
		sc.g.Wait()
		return sc.w, sc.e
	}

	if w = m.muxwires[i].wire.Load().(wire); w == m.init {
		if w = m.wireFn(ctx); w != m.dead {
			m.setCloseHookOnWire(i, w)
			m.muxwires[i].wire.Store(w)
		} else {
			if err = w.Error(); err != ErrClosing {
				m.clhks.Load().(func(error))(err)
			}
		}
	}

	m.muxwires[i].mu.Lock()
	sc = m.muxwires[i].sc
	m.muxwires[i].sc = nil
	m.muxwires[i].mu.Unlock()

	sc.w = w
	sc.e = err
	sc.g.Done()

	return w, err
}

func (m *mux) pipe(ctx context.Context, i uint16) wire {
	w, _ := m._pipe(ctx, i)
	return w // this should never be nil
}

func (m *mux) Dial() error {
	_, err := m._pipe(context.Background(), 0)
	return err
}

func (m *mux) Info() map[string]RedisMessage {
	return m.pipe(context.Background(), 0).Info()
}

func (m *mux) Version() int {
	return m.pipe(context.Background(), 0).Version()
}

func (m *mux) AZ() string {
	return m.pipe(context.Background(), 0).AZ()
}

func (m *mux) Error() error {
	return m.pipe(context.Background(), 0).Error()
}

func (m *mux) DoStream(ctx context.Context, cmd Completed) RedisResultStream {
	wire := m.spool.Acquire(ctx)
	return wire.DoStream(ctx, m.spool, cmd)
}

func (m *mux) DoMultiStream(ctx context.Context, multi ...Completed) MultiRedisResultStream {
	wire := m.spool.Acquire(ctx)
	return wire.DoMultiStream(ctx, m.spool, multi...)
}

func (m *mux) Do(ctx context.Context, cmd Completed) (resp RedisResult) {
	if m.usePool && !cmd.IsPipe() {
		resp = m.blocking(m.spool, ctx, cmd)
	} else if cmd.IsBlock() {
		resp = m.blocking(m.dpool, ctx, cmd)
	} else {
		resp = m.pipeline(ctx, cmd)
	}
	return resp
}

func (m *mux) DoMulti(ctx context.Context, multi ...Completed) (resp *redisresults) {
	for _, cmd := range multi {
		if cmd.IsPipe() {
			return m.pipelineMulti(ctx, multi)
		}
		if cmd.IsBlock() {
			cmds.ToBlock(&multi[0]) // mark the first cmd as blocked if one of them is blocked to shortcut later check.
			goto block
		}
	}
	if m.usePool || (len(multi) >= m.maxm && m.maxm > 0) {
		goto block // use a dedicated connection if the pipeline is too large
	}
	return m.pipelineMulti(ctx, multi)
block:
	if m.usePool {
		return m.blockingMulti(m.spool, ctx, multi)
	}
	return m.blockingMulti(m.dpool, ctx, multi)
}

func (m *mux) blocking(pool *pool, ctx context.Context, cmd Completed) (resp RedisResult) {
	wire := pool.Acquire(ctx)
	resp = wire.Do(ctx, cmd)
	if resp.NonRedisError() != nil { // abort the wire if blocking command return early (ex. context.DeadlineExceeded)
		wire.Close()
	}
	pool.Store(wire)
	return resp
}

func (m *mux) blockingMulti(pool *pool, ctx context.Context, cmd []Completed) (resp *redisresults) {
	wire := pool.Acquire(ctx)
	resp = wire.DoMulti(ctx, cmd...)
	for _, res := range resp.s {
		if res.NonRedisError() != nil { // abort the wire if blocking command return early (ex. context.DeadlineExceeded)
			wire.Close()
			break
		}
	}
	pool.Store(wire)
	return resp
}

func (m *mux) pipeline(ctx context.Context, cmd Completed) (resp RedisResult) {
	slot := slotfn(len(m.muxwires), cmd.Slot(), cmd.NoReply())
	wire := m.pipe(ctx, slot)
	if resp = wire.Do(ctx, cmd); isBroken(resp.NonRedisError(), wire) {
		m.muxwires[slot].wire.CompareAndSwap(wire, m.init)
	}
	return resp
}

func (m *mux) pipelineMulti(ctx context.Context, cmd []Completed) (resp *redisresults) {
	slot := slotfn(len(m.muxwires), cmd[0].Slot(), cmd[0].NoReply())
	wire := m.pipe(ctx, slot)
	resp = wire.DoMulti(ctx, cmd...)
	for _, r := range resp.s {
		if isBroken(r.NonRedisError(), wire) {
			m.muxwires[slot].wire.CompareAndSwap(wire, m.init)
			return resp
		}
	}
	return resp
}

func (m *mux) DoCache(ctx context.Context, cmd Cacheable, ttl time.Duration) RedisResult {
	slot := cmd.Slot() & uint16(len(m.muxwires)-1)
	wire := m.pipe(ctx, slot)
	resp := wire.DoCache(ctx, cmd, ttl)
	if isBroken(resp.NonRedisError(), wire) {
		m.muxwires[slot].wire.CompareAndSwap(wire, m.init)
	}
	return resp
}

func (m *mux) DoMultiCache(ctx context.Context, multi ...CacheableTTL) (results *redisresults) {
	var slots *muxslots
	var mask = uint16(len(m.muxwires) - 1)

	if mask == 0 {
		return m.doMultiCache(ctx, 0, multi)
	}

	slots = muxslotsp.Get(len(m.muxwires), len(m.muxwires))
	for _, cmd := range multi {
		slots.s[cmd.Cmd.Slot()&mask]++
	}

	if slots.LessThen(2) {
		return m.doMultiCache(ctx, multi[0].Cmd.Slot()&mask, multi)
	}

	batches := batchcachemaps.Get(len(m.muxwires), len(m.muxwires))
	for slot, count := range slots.s {
		if count > 0 {
			batches.m[uint16(slot)] = batchcachep.Get(0, count)
		}
	}
	muxslotsp.Put(slots)

	for i, cmd := range multi {
		batch := batches.m[cmd.Cmd.Slot()&mask]
		batch.commands = append(batch.commands, cmd)
		batch.cIndexes = append(batch.cIndexes, i)
	}

	results = resultsp.Get(len(multi), len(multi))
	util.ParallelKeys(m.maxp, batches.m, func(slot uint16) {
		batch := batches.m[slot]
		resp := m.doMultiCache(ctx, slot, batch.commands)
		for i, r := range resp.s {
			results.s[batch.cIndexes[i]] = r
		}
		resultsp.Put(resp)
	})

	for _, batch := range batches.m {
		batchcachep.Put(batch)
	}
	batchcachemaps.Put(batches)

	return results
}

func (m *mux) doMultiCache(ctx context.Context, slot uint16, multi []CacheableTTL) (resps *redisresults) {
	wire := m.pipe(ctx, slot)
	resps = wire.DoMultiCache(ctx, multi...)
	for _, r := range resps.s {
		if isBroken(r.NonRedisError(), wire) {
			m.muxwires[slot].wire.CompareAndSwap(wire, m.init)
			return resps
		}
	}
	return resps
}

func (m *mux) Receive(ctx context.Context, subscribe Completed, fn func(message PubSubMessage)) error {
	slot := slotfn(len(m.muxwires), subscribe.Slot(), subscribe.NoReply())
	wire := m.pipe(ctx, slot)
	err := wire.Receive(ctx, subscribe, fn)
	if isBroken(err, wire) {
		m.muxwires[slot].wire.CompareAndSwap(wire, m.init)
	}
	return err
}

func (m *mux) Acquire(ctx context.Context) wire {
	return m.dpool.Acquire(ctx)
}

func (m *mux) Store(w wire) {
	w.SetPubSubHooks(PubSubHooks{})
	w.CleanSubscriptions()
	m.dpool.Store(w)
}

func (m *mux) Close() {
	for i := 0; i < len(m.muxwires); i++ {
		if prev := m.muxwires[i].wire.Swap(m.dead).(wire); prev != m.init && prev != m.dead {
			prev.Close()
		}
	}
	m.dpool.Close()
	m.spool.Close()
}

func (m *mux) Addr() string {
	return m.dst
}

func isBroken(err error, w wire) bool {
	return err != nil && err != ErrClosing && w.Error() != nil
}

func slotfn(n int, ks uint16, noreply bool) uint16 {
	if n == 1 || ks == cmds.NoSlot || noreply {
		return 0
	}
	return uint16(util.FastRand(n))
}
