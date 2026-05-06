package saferand

import (
	"math/rand"
	"sync"
)

// Rand is a concurrency-safe source of pseudo-random numbers. The Go
// stdlib's math/rand.Source is not concurrency-safe. The global source in
// math/rand would be concurrency safe (due to its internal use of
// lockedSource), but it is prone to inter-package interference with the PRNG
// state.
type Rand struct {
	mu sync.Mutex
	r  *rand.Rand
}

func New(seed int64) *Rand {
	return &Rand{r: rand.New(rand.NewSource(seed))}
}

func (sr *Rand) Int63n(n int64) int64 {
	sr.mu.Lock()
	v := sr.r.Int63n(n)
	sr.mu.Unlock()
	return v
}

func (sr *Rand) Intn(n int) int {
	sr.mu.Lock()
	v := sr.r.Intn(n)
	sr.mu.Unlock()
	return v
}
