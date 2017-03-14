package redis

import (
	"sync/atomic"
	"time"
)

type rateLimiter struct {
	v int64

	_closed int64
}

func newRateLimiter(limit time.Duration, bucketSize int) *rateLimiter {
	rl := &rateLimiter{
		v: int64(bucketSize),
	}
	go rl.loop(limit, int64(bucketSize))
	return rl
}

func (rl *rateLimiter) loop(limit time.Duration, bucketSize int64) {
	for {
		if rl.closed() {
			break
		}
		if v := atomic.LoadInt64(&rl.v); v < bucketSize {
			atomic.AddInt64(&rl.v, 1)
		}
		time.Sleep(limit)
	}
}

func (rl *rateLimiter) Check() bool {
	for {
		if v := atomic.LoadInt64(&rl.v); v > 0 {
			if atomic.CompareAndSwapInt64(&rl.v, v, v-1) {
				return true
			}
		} else {
			return false
		}
	}
}

func (rl *rateLimiter) Close() error {
	atomic.StoreInt64(&rl._closed, 1)
	return nil
}

func (rl *rateLimiter) closed() bool {
	return atomic.LoadInt64(&rl._closed) == 1
}
