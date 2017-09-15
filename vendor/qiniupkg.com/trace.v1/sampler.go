package trace

import (
	"sync"
	"time"
)

type Sampler interface {
	Sample() bool
}

type SampleRateSetter interface {
	SetSampleRate(ratem int32)
}

type dummySampler struct {
	ret bool
}

var DummySampler = &dummySampler{false}
var DummyTrueSampler = &dummySampler{true}

func (ds *dummySampler) Sample() bool { return ds.ret }

//------------------------------------------------------
// token 限速实现

type tokenRateLimiter struct {
	mu     sync.Mutex
	rate   int
	tokens int
	t      time.Time
	nowFn  func() time.Time
}

func newTokenRateLimiter(rate int) *tokenRateLimiter {
	return &tokenRateLimiter{
		rate:   rate,
		tokens: rate,
		t:      time.Now().Add(time.Second),
		nowFn:  time.Now,
	}
}

func (r *tokenRateLimiter) Allow() bool {
	r.mu.Lock()
	defer r.mu.Unlock()

	now := r.nowFn()
	add := int((float64(now.Sub(r.t).Nanoseconds()/int64(time.Millisecond)) / 1000) * float64(r.rate))
	if add > 0 {
		r.tokens = r.tokens + add
		if r.tokens > r.rate {
			r.tokens = r.rate
		}
		r.t = now
	}
	if r.tokens > 0 {
		r.tokens--
		return true
	}
	return false
}

type tokenRateSampler struct {
	l *tokenRateLimiter
}

// @n: 每秒最多采样的个数
//
func NewTokenRateSampler(n int) Sampler {
	return tokenRateSampler{newTokenRateLimiter(n)}
}

func (r tokenRateSampler) Sample() bool {
	return r.l.Allow()
}
