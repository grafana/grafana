package pool

import (
	"errors"
	"fmt"
	"net"
	"sync"
	"sync/atomic"
	"time"

	"gopkg.in/redis.v5/internal"
)

var (
	ErrClosed      = errors.New("redis: client is closed")
	ErrPoolTimeout = errors.New("redis: connection pool timeout")
	errConnStale   = errors.New("connection is stale")
)

var timers = sync.Pool{
	New: func() interface{} {
		t := time.NewTimer(time.Hour)
		t.Stop()
		return t
	},
}

// Stats contains pool state information and accumulated stats.
type Stats struct {
	Requests uint32 // number of times a connection was requested by the pool
	Hits     uint32 // number of times free connection was found in the pool
	Timeouts uint32 // number of times a wait timeout occurred

	TotalConns uint32 // the number of total connections in the pool
	FreeConns  uint32 // the number of free connections in the pool
}

type Pooler interface {
	Get() (*Conn, bool, error)
	Put(*Conn) error
	Remove(*Conn, error) error
	Len() int
	FreeLen() int
	Stats() *Stats
	Close() error
}

type dialer func() (net.Conn, error)

type ConnPool struct {
	dial    dialer
	OnClose func(*Conn) error

	poolTimeout time.Duration
	idleTimeout time.Duration

	queue chan struct{}

	connsMu sync.Mutex
	conns   []*Conn

	freeConnsMu sync.Mutex
	freeConns   []*Conn

	stats Stats

	_closed int32 // atomic
	lastErr atomic.Value
}

var _ Pooler = (*ConnPool)(nil)

func NewConnPool(dial dialer, poolSize int, poolTimeout, idleTimeout, idleCheckFrequency time.Duration) *ConnPool {
	p := &ConnPool{
		dial: dial,

		poolTimeout: poolTimeout,
		idleTimeout: idleTimeout,

		queue:     make(chan struct{}, poolSize),
		conns:     make([]*Conn, 0, poolSize),
		freeConns: make([]*Conn, 0, poolSize),
	}
	if idleTimeout > 0 && idleCheckFrequency > 0 {
		go p.reaper(idleCheckFrequency)
	}
	return p
}

func (p *ConnPool) NewConn() (*Conn, error) {
	netConn, err := p.dial()
	if err != nil {
		return nil, err
	}
	return NewConn(netConn), nil
}

func (p *ConnPool) PopFree() *Conn {
	timer := timers.Get().(*time.Timer)
	timer.Reset(p.poolTimeout)

	select {
	case p.queue <- struct{}{}:
		if !timer.Stop() {
			<-timer.C
		}
		timers.Put(timer)
	case <-timer.C:
		timers.Put(timer)
		atomic.AddUint32(&p.stats.Timeouts, 1)
		return nil
	}

	p.freeConnsMu.Lock()
	cn := p.popFree()
	p.freeConnsMu.Unlock()

	if cn == nil {
		<-p.queue
	}
	return cn
}

func (p *ConnPool) popFree() *Conn {
	if len(p.freeConns) == 0 {
		return nil
	}

	idx := len(p.freeConns) - 1
	cn := p.freeConns[idx]
	p.freeConns = p.freeConns[:idx]
	return cn
}

// Get returns existed connection from the pool or creates a new one.
func (p *ConnPool) Get() (*Conn, bool, error) {
	if p.closed() {
		return nil, false, ErrClosed
	}

	atomic.AddUint32(&p.stats.Requests, 1)

	timer := timers.Get().(*time.Timer)
	timer.Reset(p.poolTimeout)

	select {
	case p.queue <- struct{}{}:
		if !timer.Stop() {
			<-timer.C
		}
		timers.Put(timer)
	case <-timer.C:
		timers.Put(timer)
		atomic.AddUint32(&p.stats.Timeouts, 1)
		return nil, false, ErrPoolTimeout
	}

	for {
		p.freeConnsMu.Lock()
		cn := p.popFree()
		p.freeConnsMu.Unlock()

		if cn == nil {
			break
		}

		if cn.IsStale(p.idleTimeout) {
			p.remove(cn, errConnStale)
			continue
		}

		atomic.AddUint32(&p.stats.Hits, 1)
		return cn, false, nil
	}

	newcn, err := p.NewConn()
	if err != nil {
		<-p.queue
		return nil, false, err
	}

	p.connsMu.Lock()
	p.conns = append(p.conns, newcn)
	p.connsMu.Unlock()

	return newcn, true, nil
}

func (p *ConnPool) Put(cn *Conn) error {
	if data := cn.Rd.PeekBuffered(); data != nil {
		err := fmt.Errorf("connection has unread data: %q", data)
		internal.Logf(err.Error())
		return p.Remove(cn, err)
	}
	p.freeConnsMu.Lock()
	p.freeConns = append(p.freeConns, cn)
	p.freeConnsMu.Unlock()
	<-p.queue
	return nil
}

func (p *ConnPool) Remove(cn *Conn, reason error) error {
	p.remove(cn, reason)
	<-p.queue
	return nil
}

func (p *ConnPool) remove(cn *Conn, reason error) {
	_ = p.closeConn(cn, reason)

	p.connsMu.Lock()
	for i, c := range p.conns {
		if c == cn {
			p.conns = append(p.conns[:i], p.conns[i+1:]...)
			break
		}
	}
	p.connsMu.Unlock()
}

// Len returns total number of connections.
func (p *ConnPool) Len() int {
	p.connsMu.Lock()
	l := len(p.conns)
	p.connsMu.Unlock()
	return l
}

// FreeLen returns number of free connections.
func (p *ConnPool) FreeLen() int {
	p.freeConnsMu.Lock()
	l := len(p.freeConns)
	p.freeConnsMu.Unlock()
	return l
}

func (p *ConnPool) Stats() *Stats {
	return &Stats{
		Requests:   atomic.LoadUint32(&p.stats.Requests),
		Hits:       atomic.LoadUint32(&p.stats.Hits),
		Timeouts:   atomic.LoadUint32(&p.stats.Timeouts),
		TotalConns: uint32(p.Len()),
		FreeConns:  uint32(p.FreeLen()),
	}
}

func (p *ConnPool) closed() bool {
	return atomic.LoadInt32(&p._closed) == 1
}

func (p *ConnPool) Close() error {
	if !atomic.CompareAndSwapInt32(&p._closed, 0, 1) {
		return ErrClosed
	}

	p.connsMu.Lock()
	var firstErr error
	for _, cn := range p.conns {
		if cn == nil {
			continue
		}
		if err := p.closeConn(cn, ErrClosed); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	p.conns = nil
	p.connsMu.Unlock()

	p.freeConnsMu.Lock()
	p.freeConns = nil
	p.freeConnsMu.Unlock()

	return firstErr
}

func (p *ConnPool) closeConn(cn *Conn, reason error) error {
	if p.OnClose != nil {
		_ = p.OnClose(cn)
	}
	return cn.Close()
}

func (p *ConnPool) reapStaleConn() bool {
	if len(p.freeConns) == 0 {
		return false
	}

	cn := p.freeConns[0]
	if !cn.IsStale(p.idleTimeout) {
		return false
	}

	p.remove(cn, errConnStale)
	p.freeConns = append(p.freeConns[:0], p.freeConns[1:]...)

	return true
}

func (p *ConnPool) ReapStaleConns() (int, error) {
	var n int
	for {
		p.queue <- struct{}{}
		p.freeConnsMu.Lock()

		reaped := p.reapStaleConn()

		p.freeConnsMu.Unlock()
		<-p.queue

		if reaped {
			n++
		} else {
			break
		}
	}
	return n, nil
}

func (p *ConnPool) reaper(frequency time.Duration) {
	ticker := time.NewTicker(frequency)
	defer ticker.Stop()

	for _ = range ticker.C {
		if p.closed() {
			break
		}
		n, err := p.ReapStaleConns()
		if err != nil {
			internal.Logf("ReapStaleConns failed: %s", err)
			continue
		}
		s := p.Stats()
		internal.Logf(
			"reaper: removed %d stale conns (TotalConns=%d FreeConns=%d Requests=%d Hits=%d Timeouts=%d)",
			n, s.TotalConns, s.FreeConns, s.Requests, s.Hits, s.Timeouts,
		)
	}
}

//------------------------------------------------------------------------------

var idleCheckFrequency atomic.Value

func SetIdleCheckFrequency(d time.Duration) {
	idleCheckFrequency.Store(d)
}

func getIdleCheckFrequency() time.Duration {
	v := idleCheckFrequency.Load()
	if v == nil {
		return time.Minute
	}
	return v.(time.Duration)
}
