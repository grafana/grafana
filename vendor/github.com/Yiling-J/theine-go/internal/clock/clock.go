package clock

import (
	"math"
	"sync/atomic"
	"time"
)

type Clock struct {
	Start time.Time
	now   atomic.Int64
}

func (c *Clock) NowNano() int64 {
	return time.Since(c.Start).Nanoseconds()
}

func (c *Clock) NowNanoCached() int64 {
	return c.now.Load()
}

func (c *Clock) RefreshNowCache() {
	c.now.Store(c.NowNano())
}

// used in test only
func (c *Clock) SetNowCache(n int64) {
	c.now.Store(n)
}

func (c *Clock) ExpireNano(ttl time.Duration) int64 {
	// Both `ttl` and `nano + ttl` can overflow, but we only handle the overflow of `nano + ttl` here.
	// An overflowed `ttl` can be either positive or negative. If it's positive, we won't detect it since it behaves
	// like a regular `ttl`. Users of Theine should ensure that `ttl` does not overflow (this should be the case in most scenarios
	// unless the value is directly manipulated via math operations).
	// When `nano + ttl` overflows, we cap the returned expiration time at `math.MaxInt64`.
	return saturatingAdd(c.NowNano(), ttl.Nanoseconds())
}

func (c *Clock) SetStart(ts int64) {
	c.Start = time.Unix(0, ts)
}

func saturatingAdd(a, b int64) int64 {
	var max int64 = math.MaxInt64
	var min int64 = math.MinInt64
	if b > 0 && a > max-b {
		return max
	}

	if b < 0 && a < min-b {
		return min
	}

	return a + b
}
