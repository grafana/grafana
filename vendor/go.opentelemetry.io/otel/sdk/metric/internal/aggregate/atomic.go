// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package aggregate // import "go.opentelemetry.io/otel/sdk/metric/internal/aggregate"

import (
	"math"
	"runtime"
	"sync"
	"sync/atomic"

	"go.opentelemetry.io/otel/attribute"
)

// atomicCounter is an efficient way of adding to a number which is either an
// int64 or float64. It is designed to be efficient when adding whole
// numbers, regardless of whether N is an int64 or float64.
//
// Inspired by the Prometheus counter implementation:
// https://github.com/prometheus/client_golang/blob/14ccb93091c00f86b85af7753100aa372d63602b/prometheus/counter.go#L108
type atomicCounter[N int64 | float64] struct {
	// nFloatBits contains only the non-integer portion of the counter.
	nFloatBits atomic.Uint64
	// nInt contains only the integer portion of the counter.
	nInt atomic.Int64
}

// load returns the current value. The caller must ensure all calls to add have
// returned prior to calling load.
func (n *atomicCounter[N]) load() N {
	fval := math.Float64frombits(n.nFloatBits.Load())
	ival := n.nInt.Load()
	return N(fval + float64(ival))
}

func (n *atomicCounter[N]) add(value N) {
	ival := int64(value)
	// This case is where the value is an int, or if it is a whole-numbered float.
	if float64(ival) == float64(value) {
		n.nInt.Add(ival)
		return
	}

	// Value must be a float below.
	for {
		oldBits := n.nFloatBits.Load()
		newBits := math.Float64bits(math.Float64frombits(oldBits) + float64(value))
		if n.nFloatBits.CompareAndSwap(oldBits, newBits) {
			return
		}
	}
}

// reset resets the internal state, and is not safe to call concurrently.
func (n *atomicCounter[N]) reset() {
	n.nFloatBits.Store(0)
	n.nInt.Store(0)
}

// atomicN is a generic atomic number value.
type atomicN[N int64 | float64] struct {
	val atomic.Uint64
}

func (a *atomicN[N]) Load() (value N) {
	v := a.val.Load()
	switch any(value).(type) {
	case int64:
		value = N(v)
	case float64:
		value = N(math.Float64frombits(v))
	default:
		panic("unsupported type")
	}
	return value
}

func (a *atomicN[N]) Store(v N) {
	var val uint64
	switch any(v).(type) {
	case int64:
		val = uint64(v)
	case float64:
		val = math.Float64bits(float64(v))
	default:
		panic("unsupported type")
	}
	a.val.Store(val)
}

func (a *atomicN[N]) CompareAndSwap(oldN, newN N) bool {
	var o, n uint64
	switch any(oldN).(type) {
	case int64:
		o, n = uint64(oldN), uint64(newN)
	case float64:
		o, n = math.Float64bits(float64(oldN)), math.Float64bits(float64(newN))
	default:
		panic("unsupported type")
	}
	return a.val.CompareAndSwap(o, n)
}

type atomicMinMax[N int64 | float64] struct {
	minimum, maximum atomicN[N]
	set              atomic.Bool
	mu               sync.Mutex
}

// init returns true if the value was used to initialize min and max.
func (s *atomicMinMax[N]) init(val N) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.set.Load() {
		defer s.set.Store(true)
		s.minimum.Store(val)
		s.maximum.Store(val)
		return true
	}
	return false
}

func (s *atomicMinMax[N]) Update(val N) {
	if !s.set.Load() && s.init(val) {
		return
	}

	old := s.minimum.Load()
	for val < old {
		if s.minimum.CompareAndSwap(old, val) {
			return
		}
		old = s.minimum.Load()
	}

	old = s.maximum.Load()
	for old < val {
		if s.maximum.CompareAndSwap(old, val) {
			return
		}
		old = s.maximum.Load()
	}
}

// hotColdWaitGroup is a synchronization primitive which enables lockless
// writes for concurrent writers and enables a reader to acquire exclusive
// access to a snapshot of state including only completed operations.
// Conceptually, it can be thought of as a "hot" wait group,
// and a "cold" wait group, with the ability for the reader to atomically swap
// the hot and cold wait groups, and wait for the now-cold wait group to
// complete.
//
// Inspired by the prometheus/client_golang histogram implementation:
// https://github.com/prometheus/client_golang/blob/a974e0d45e0aa54c65492559114894314d8a2447/prometheus/histogram.go#L725
//
// Usage:
//
//	var hcwg hotColdWaitGroup
//	var data [2]any
//
//	func write() {
//	  hotIdx := hcwg.start()
//	  defer hcwg.done(hotIdx)
//	  // modify data without locking
//	  data[hotIdx].update()
//	}
//
//	func read() {
//	  coldIdx := hcwg.swapHotAndWait()
//	  // read data now that all writes to the cold data have completed.
//	  data[coldIdx].read()
//	}
type hotColdWaitGroup struct {
	// startedCountAndHotIdx contains a 63-bit counter in the lower bits,
	// and a 1 bit hot index to denote which of the two data-points new
	// measurements to write to. These are contained together so that read()
	// can atomically swap the hot bit, reset the started writes to zero, and
	// read the number writes that were started prior to the hot bit being
	// swapped.
	startedCountAndHotIdx atomic.Uint64
	// endedCounts is the number of writes that have completed to each
	// dataPoint.
	endedCounts [2]atomic.Uint64
}

// start returns the hot index that the writer should write to. The returned
// hot index is 0 or 1. The caller must call done(hot index) after it finishes
// its operation. start() is safe to call concurrently with other methods.
func (l *hotColdWaitGroup) start() uint64 {
	// We increment h.startedCountAndHotIdx so that the counter in the lower
	// 63 bits gets incremented. At the same time, we get the new value
	// back, which we can use to return the currently-hot index.
	return l.startedCountAndHotIdx.Add(1) >> 63
}

// done signals to the reader that an operation has fully completed.
// done is safe to call concurrently.
func (l *hotColdWaitGroup) done(hotIdx uint64) {
	l.endedCounts[hotIdx].Add(1)
}

// swapHotAndWait swaps the hot bit, waits for all start() calls to be done(),
// and then returns the now-cold index for the reader to read from. The
// returned index is 0 or 1. swapHotAndWait must not be called concurrently.
func (l *hotColdWaitGroup) swapHotAndWait() uint64 {
	n := l.startedCountAndHotIdx.Load()
	coldIdx := (^n) >> 63
	// Swap the hot and cold index while resetting the started measurements
	// count to zero.
	n = l.startedCountAndHotIdx.Swap((coldIdx << 63))
	hotIdx := n >> 63
	startedCount := n & ((1 << 63) - 1)
	// Wait for all measurements to the previously-hot map to finish.
	for startedCount != l.endedCounts[hotIdx].Load() {
		runtime.Gosched() // Let measurements complete.
	}
	// reset the number of ended operations
	l.endedCounts[hotIdx].Store(0)
	return hotIdx
}

// limitedSyncMap is a sync.Map which enforces the aggregation limit on
// attribute sets and provides a Len() function.
type limitedSyncMap struct {
	sync.Map
	aggLimit int
	len      int
	lenMux   sync.Mutex
}

func (m *limitedSyncMap) LoadOrStoreAttr(fltrAttr attribute.Set, newValue func(attribute.Set) any) any {
	actual, loaded := m.Load(fltrAttr.Equivalent())
	if loaded {
		return actual
	}
	// If the overflow set exists, assume we have already overflowed and don't
	// bother with the slow path below.
	actual, loaded = m.Load(overflowSet.Equivalent())
	if loaded {
		return actual
	}
	// Slow path: add a new attribute set.
	m.lenMux.Lock()
	defer m.lenMux.Unlock()

	// re-fetch now that we hold the lock to ensure we don't use the overflow
	// set unless we are sure the attribute set isn't being written
	// concurrently.
	actual, loaded = m.Load(fltrAttr.Equivalent())
	if loaded {
		return actual
	}

	if m.aggLimit > 0 && m.len >= m.aggLimit-1 {
		fltrAttr = overflowSet
	}
	actual, loaded = m.LoadOrStore(fltrAttr.Equivalent(), newValue(fltrAttr))
	if !loaded {
		m.len++
	}
	return actual
}

func (m *limitedSyncMap) Clear() {
	m.lenMux.Lock()
	defer m.lenMux.Unlock()
	m.len = 0
	m.Map.Clear()
}

func (m *limitedSyncMap) Len() int {
	m.lenMux.Lock()
	defer m.lenMux.Unlock()
	return m.len
}
