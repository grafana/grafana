package util

import (
	"context"
	"math/rand"
	"time"
)

type Jitter struct {
	base      time.Duration
	deviation time.Duration
}

// NewJitter returns a Jitter object that creates durations with random jitter.
func NewJitter(b time.Duration, d time.Duration) Jitter {
	return Jitter{base: b, deviation: d}
}

// Duration returns a random duration from the base duration and +/- jitter
func (j Jitter) Duration() time.Duration {
	base := j.base - j.deviation
	jitter := time.Duration(rand.Int63n(int64(float64(2 * j.deviation.Nanoseconds()))))
	return base + jitter
}

type TickerWithJitter struct {
	C    chan time.Time
	ctx  context.Context
	stop func()
}

func (t *TickerWithJitter) Stop() {
	t.stop()
}

func (t *TickerWithJitter) start(d, dev time.Duration) {
	j := NewJitter(d, dev)
	timer := time.NewTimer(j.Duration())
	defer timer.Stop()
	for {
		select {
		case <-timer.C:
			timer.Reset(j.Duration())
			t.C <- time.Now()
		case <-t.ctx.Done():
			if !timer.Stop() {
				<-timer.C
			}
			return
		}
	}
}

// NewTickerWithJitter returns a new Ticker-like object, but instead of a
// constant tick duration, it adds random +/- dev to each iteration.
func NewTickerWithJitter(d, dev time.Duration) *TickerWithJitter {
	ctx, cancel := context.WithCancel(context.Background())
	t := &TickerWithJitter{
		C:    make(chan time.Time),
		ctx:  ctx,
		stop: cancel,
	}
	go t.start(d, dev)
	return t
}
