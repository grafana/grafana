// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"math"
	"math/rand"
	"sync"
	"time"
)

// BackoffFunc specifies the signature of a function that returns the
// time to wait before the next call to a resource. To stop retrying
// return false in the 2nd return value.
type BackoffFunc func(retry int) (time.Duration, bool)

// Backoff allows callers to implement their own Backoff strategy.
type Backoff interface {
	// Next implements a BackoffFunc.
	Next(retry int) (time.Duration, bool)
}

// -- ZeroBackoff --

// ZeroBackoff is a fixed backoff policy whose backoff time is always zero,
// meaning that the operation is retried immediately without waiting,
// indefinitely.
type ZeroBackoff struct{}

// Next implements BackoffFunc for ZeroBackoff.
func (b ZeroBackoff) Next(retry int) (time.Duration, bool) {
	return 0, true
}

// -- StopBackoff --

// StopBackoff is a fixed backoff policy that always returns false for
// Next(), meaning that the operation should never be retried.
type StopBackoff struct{}

// Next implements BackoffFunc for StopBackoff.
func (b StopBackoff) Next(retry int) (time.Duration, bool) {
	return 0, false
}

// -- ConstantBackoff --

// ConstantBackoff is a backoff policy that always returns the same delay.
type ConstantBackoff struct {
	interval time.Duration
}

// NewConstantBackoff returns a new ConstantBackoff.
func NewConstantBackoff(interval time.Duration) *ConstantBackoff {
	return &ConstantBackoff{interval: interval}
}

// Next implements BackoffFunc for ConstantBackoff.
func (b *ConstantBackoff) Next(retry int) (time.Duration, bool) {
	return b.interval, true
}

// -- Exponential --

// ExponentialBackoff implements the simple exponential backoff described by
// Douglas Thain at http://dthain.blogspot.de/2009/02/exponential-backoff-in-distributed.html.
type ExponentialBackoff struct {
	sync.Mutex
	t float64 // initial timeout (in msec)
	f float64 // exponential factor (e.g. 2)
	m float64 // maximum timeout (in msec)
}

// NewExponentialBackoff returns a ExponentialBackoff backoff policy.
// Use initialTimeout to set the first/minimal interval
// and maxTimeout to set the maximum wait interval.
func NewExponentialBackoff(initialTimeout, maxTimeout time.Duration) *ExponentialBackoff {
	return &ExponentialBackoff{
		t: float64(int64(initialTimeout / time.Millisecond)),
		f: 2.0,
		m: float64(int64(maxTimeout / time.Millisecond)),
	}
}

// Next implements BackoffFunc for ExponentialBackoff.
func (b *ExponentialBackoff) Next(retry int) (time.Duration, bool) {
	b.Lock()
	defer b.Unlock()

	r := 1.0 + rand.Float64() // random number in [1..2]
	m := math.Min(r*b.t*math.Pow(b.f, float64(retry)), b.m)
	if m >= b.m {
		return 0, false
	}
	d := time.Duration(int64(m)) * time.Millisecond
	return d, true
}

// -- Simple Backoff --

// SimpleBackoff takes a list of fixed values for backoff intervals.
// Each call to Next returns the next value from that fixed list.
// After each value is returned, subsequent calls to Next will only return
// the last element. The values are optionally "jittered" (off by default).
type SimpleBackoff struct {
	sync.Mutex
	ticks  []int
	jitter bool
}

// NewSimpleBackoff creates a SimpleBackoff algorithm with the specified
// list of fixed intervals in milliseconds.
func NewSimpleBackoff(ticks ...int) *SimpleBackoff {
	return &SimpleBackoff{
		ticks:  ticks,
		jitter: false,
	}
}

// Jitter enables or disables jittering values.
func (b *SimpleBackoff) Jitter(flag bool) *SimpleBackoff {
	b.Lock()
	b.jitter = flag
	b.Unlock()
	return b
}

// jitter randomizes the interval to return a value of [0.5*millis .. 1.5*millis].
func jitter(millis int) int {
	if millis <= 0 {
		return 0
	}
	return millis/2 + rand.Intn(millis)
}

// Next implements BackoffFunc for SimpleBackoff.
func (b *SimpleBackoff) Next(retry int) (time.Duration, bool) {
	b.Lock()
	defer b.Unlock()

	if retry >= len(b.ticks) {
		return 0, false
	}

	ms := b.ticks[retry]
	if b.jitter {
		ms = jitter(ms)
	}
	return time.Duration(ms) * time.Millisecond, true
}
