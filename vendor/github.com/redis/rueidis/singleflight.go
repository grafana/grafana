package rueidis

import (
	"context"
	"sync"
	"time"
)

type call struct {
	ts time.Time
	ch chan struct{}
	cn int
	mu sync.Mutex
}

func (c *call) Do(ctx context.Context, fn func() error) error {
	c.mu.Lock()
	c.cn++
	ch := c.ch
	if ch != nil {
		c.mu.Unlock()
		if ctxCh := ctx.Done(); ctxCh != nil {
			select {
			case <-ch:
			case <-ctxCh:
				return ctx.Err()
			}
		} else {
			<-ch
		}
		return nil
	}
	ch = make(chan struct{})
	c.ch = ch
	c.mu.Unlock()
	return c.do(ch, fn)
}

func (c *call) LazyDo(threshold time.Duration, fn func() error) {
	c.mu.Lock()
	ch := c.ch
	if ch != nil {
		c.mu.Unlock()
		return
	}
	ch = make(chan struct{})
	c.ch = ch
	c.cn++
	ts := c.ts
	c.mu.Unlock()
	go func(ts time.Time, ch chan struct{}, fn func() error) {
		time.Sleep(time.Until(ts))
		c.do(ch, fn)
	}(ts.Add(threshold), ch, fn)
}

func (c *call) do(ch chan struct{}, fn func() error) (err error) {
	err = fn()
	c.mu.Lock()
	c.ch = nil
	c.cn = 0
	c.ts = time.Now()
	c.mu.Unlock()
	close(ch)
	return
}

func (c *call) suppressing() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.cn
}
