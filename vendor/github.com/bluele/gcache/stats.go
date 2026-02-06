package gcache

import (
	"sync/atomic"
)

type statsAccessor interface {
	HitCount() uint64
	MissCount() uint64
	LookupCount() uint64
	HitRate() float64
}

// statistics
type stats struct {
	hitCount  uint64
	missCount uint64
}

// increment hit count
func (st *stats) IncrHitCount() uint64 {
	return atomic.AddUint64(&st.hitCount, 1)
}

// increment miss count
func (st *stats) IncrMissCount() uint64 {
	return atomic.AddUint64(&st.missCount, 1)
}

// HitCount returns hit count
func (st *stats) HitCount() uint64 {
	return atomic.LoadUint64(&st.hitCount)
}

// MissCount returns miss count
func (st *stats) MissCount() uint64 {
	return atomic.LoadUint64(&st.missCount)
}

// LookupCount returns lookup count
func (st *stats) LookupCount() uint64 {
	return st.HitCount() + st.MissCount()
}

// HitRate returns rate for cache hitting
func (st *stats) HitRate() float64 {
	hc, mc := st.HitCount(), st.MissCount()
	total := hc + mc
	if total == 0 {
		return 0.0
	}
	return float64(hc) / float64(total)
}
