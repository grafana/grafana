package pool

import (
	"context"
	"errors"
	"fmt"
	"sync/atomic"
)

const (
	stateDefault = 0
	stateInited  = 1
	stateClosed  = 2
)

type BadConnError struct {
	wrapped error
}

var _ error = (*BadConnError)(nil)

func (e BadConnError) Error() string {
	s := "redis: Conn is in a bad state"
	if e.wrapped != nil {
		s += ": " + e.wrapped.Error()
	}
	return s
}

func (e BadConnError) Unwrap() error {
	return e.wrapped
}

//------------------------------------------------------------------------------

type StickyConnPool struct {
	pool   Pooler
	shared int32 // atomic

	state uint32 // atomic
	ch    chan *Conn

	_badConnError atomic.Value
}

var _ Pooler = (*StickyConnPool)(nil)

func NewStickyConnPool(pool Pooler) *StickyConnPool {
	p, ok := pool.(*StickyConnPool)
	if !ok {
		p = &StickyConnPool{
			pool: pool,
			ch:   make(chan *Conn, 1),
		}
	}
	atomic.AddInt32(&p.shared, 1)
	return p
}

func (p *StickyConnPool) NewConn(ctx context.Context) (*Conn, error) {
	return p.pool.NewConn(ctx)
}

func (p *StickyConnPool) CloseConn(cn *Conn) error {
	return p.pool.CloseConn(cn)
}

func (p *StickyConnPool) Get(ctx context.Context) (*Conn, error) {
	// In worst case this races with Close which is not a very common operation.
	for i := 0; i < 1000; i++ {
		switch atomic.LoadUint32(&p.state) {
		case stateDefault:
			cn, err := p.pool.Get(ctx)
			if err != nil {
				return nil, err
			}
			if atomic.CompareAndSwapUint32(&p.state, stateDefault, stateInited) {
				return cn, nil
			}
			p.pool.Remove(ctx, cn, ErrClosed)
		case stateInited:
			if err := p.badConnError(); err != nil {
				return nil, err
			}
			cn, ok := <-p.ch
			if !ok {
				return nil, ErrClosed
			}
			return cn, nil
		case stateClosed:
			return nil, ErrClosed
		default:
			panic("not reached")
		}
	}
	return nil, fmt.Errorf("redis: StickyConnPool.Get: infinite loop")
}

func (p *StickyConnPool) Put(ctx context.Context, cn *Conn) {
	defer func() {
		if recover() != nil {
			p.freeConn(ctx, cn)
		}
	}()
	p.ch <- cn
}

func (p *StickyConnPool) freeConn(ctx context.Context, cn *Conn) {
	if err := p.badConnError(); err != nil {
		p.pool.Remove(ctx, cn, err)
	} else {
		p.pool.Put(ctx, cn)
	}
}

func (p *StickyConnPool) Remove(ctx context.Context, cn *Conn, reason error) {
	defer func() {
		if recover() != nil {
			p.pool.Remove(ctx, cn, ErrClosed)
		}
	}()
	p._badConnError.Store(BadConnError{wrapped: reason})
	p.ch <- cn
}

func (p *StickyConnPool) Close() error {
	if shared := atomic.AddInt32(&p.shared, -1); shared > 0 {
		return nil
	}

	for i := 0; i < 1000; i++ {
		state := atomic.LoadUint32(&p.state)
		if state == stateClosed {
			return ErrClosed
		}
		if atomic.CompareAndSwapUint32(&p.state, state, stateClosed) {
			close(p.ch)
			cn, ok := <-p.ch
			if ok {
				p.freeConn(context.TODO(), cn)
			}
			return nil
		}
	}

	return errors.New("redis: StickyConnPool.Close: infinite loop")
}

func (p *StickyConnPool) Reset(ctx context.Context) error {
	if p.badConnError() == nil {
		return nil
	}

	select {
	case cn, ok := <-p.ch:
		if !ok {
			return ErrClosed
		}
		p.pool.Remove(ctx, cn, ErrClosed)
		p._badConnError.Store(BadConnError{wrapped: nil})
	default:
		return errors.New("redis: StickyConnPool does not have a Conn")
	}

	if !atomic.CompareAndSwapUint32(&p.state, stateInited, stateDefault) {
		state := atomic.LoadUint32(&p.state)
		return fmt.Errorf("redis: invalid StickyConnPool state: %d", state)
	}

	return nil
}

func (p *StickyConnPool) badConnError() error {
	if v := p._badConnError.Load(); v != nil {
		err := v.(BadConnError)
		if err.wrapped != nil {
			return err
		}
	}
	return nil
}

func (p *StickyConnPool) Len() int {
	switch atomic.LoadUint32(&p.state) {
	case stateDefault:
		return 0
	case stateInited:
		return 1
	case stateClosed:
		return 0
	default:
		panic("not reached")
	}
}

func (p *StickyConnPool) IdleLen() int {
	return len(p.ch)
}

func (p *StickyConnPool) Stats() *Stats {
	return &Stats{}
}
