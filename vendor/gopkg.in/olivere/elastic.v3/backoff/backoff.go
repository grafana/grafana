// Copyright 2012-2016 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package backoff

import (
	"math"
	"math/rand"
	"sync"
	"sync/atomic"
	"time"
)

// Backoff is an interface for different types of backoff algorithms.
type Backoff interface {
	Next() time.Duration
	Reset()
}

// Stop is used as a signal to indicate that no more retries should be made.
const Stop time.Duration = -1

// -- Simple Backoff --

// SimpleBackoff takes a list of fixed values for backoff intervals.
// Each call to Next returns the next value from that fixed list.
// After each value is returned, subsequent calls to Next will only return
// the last element. The caller may specify if the values are "jittered".
type SimpleBackoff struct {
	sync.Mutex
	ticks  []int
	index  int
	jitter bool
	stop   bool
}

// NewSimpleBackoff creates a SimpleBackoff algorithm with the specified
// list of fixed intervals in milliseconds.
func NewSimpleBackoff(ticks ...int) *SimpleBackoff {
	return &SimpleBackoff{
		ticks:  ticks,
		index:  0,
		jitter: false,
		stop:   false,
	}
}

// Jitter, when set, randomizes to return a value of [0.5*value .. 1.5*value].
func (b *SimpleBackoff) Jitter(doJitter bool) *SimpleBackoff {
	b.Lock()
	defer b.Unlock()
	b.jitter = doJitter
	return b
}

// SendStop, when enables, makes Next to return Stop once
// the list of values is exhausted.
func (b *SimpleBackoff) SendStop(doStop bool) *SimpleBackoff {
	b.Lock()
	defer b.Unlock()
	b.stop = doStop
	return b
}

// Next returns the next wait interval.
func (b *SimpleBackoff) Next() time.Duration {
	b.Lock()
	defer b.Unlock()

	i := b.index
	if i >= len(b.ticks) {
		if b.stop {
			return Stop
		}
		i = len(b.ticks) - 1
		b.index = i
	} else {
		b.index++
	}

	ms := b.ticks[i]
	if b.jitter {
		ms = jitter(ms)
	}
	return time.Duration(ms) * time.Millisecond
}

// Reset resets SimpleBackoff.
func (b *SimpleBackoff) Reset() {
	b.Lock()
	b.index = 0
	b.Unlock()
}

// jitter randomizes the interval to return a value of [0.5*millis .. 1.5*millis].
func jitter(millis int) int {
	if millis <= 0 {
		return 0
	}
	return millis/2 + rand.Intn(millis)
}

// -- Exponential --

// ExponentialBackoff implements the simple exponential backoff described by
// Douglas Thain at http://dthain.blogspot.de/2009/02/exponential-backoff-in-distributed.html.
type ExponentialBackoff struct {
	sync.Mutex
	t    float64 // initial timeout (in msec)
	f    float64 // exponential factor (e.g. 2)
	m    float64 // maximum timeout (in msec)
	n    int64   // number of retries
	stop bool    // indicates whether Next should send "Stop" whan max timeout is reached
}

// NewExponentialBackoff returns a ExponentialBackoff backoff policy.
// Use initialTimeout to set the first/minimal interval
// and maxTimeout to set the maximum wait interval.
func NewExponentialBackoff(initialTimeout, maxTimeout time.Duration) *ExponentialBackoff {
	return &ExponentialBackoff{
		t:    float64(int64(initialTimeout / time.Millisecond)),
		f:    2.0,
		m:    float64(int64(maxTimeout / time.Millisecond)),
		n:    0,
		stop: false,
	}
}

// SendStop, when enables, makes Next to return Stop once
// the maximum timeout is reached.
func (b *ExponentialBackoff) SendStop(doStop bool) *ExponentialBackoff {
	b.Lock()
	defer b.Unlock()
	b.stop = doStop
	return b
}

// Next returns the next wait interval.
func (t *ExponentialBackoff) Next() time.Duration {
	t.Lock()
	defer t.Unlock()

	n := float64(atomic.AddInt64(&t.n, 1))
	r := 1.0 + rand.Float64() // random number in [1..2]
	m := math.Min(r*t.t*math.Pow(t.f, n), t.m)
	if t.stop && m >= t.m {
		return Stop
	}
	d := time.Duration(int64(m)) * time.Millisecond
	return d
}

// Reset resets the backoff policy so that it can be reused.
func (t *ExponentialBackoff) Reset() {
	t.Lock()
	t.n = 0
	t.Unlock()
}
