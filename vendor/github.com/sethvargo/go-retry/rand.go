package retry

import (
	"math/rand"
	"sync"
)

type lockedSource struct {
	src *rand.Rand
	mu  sync.Mutex
}

var _ rand.Source64 = (*lockedSource)(nil)

func newLockedRandom(seed int64) *lockedSource {
	return &lockedSource{src: rand.New(rand.NewSource(seed))}
}

// Int63 mimics math/rand.(*Rand).Int63 with mutex locked.
func (r *lockedSource) Int63() int64 {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.src.Int63()
}

// Seed mimics math/rand.(*Rand).Seed with mutex locked.
func (r *lockedSource) Seed(seed int64) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.src.Seed(seed)
}

// Uint64 mimics math/rand.(*Rand).Uint64 with mutex locked.
func (r *lockedSource) Uint64() uint64 {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.src.Uint64()
}

// Int63n mimics math/rand.(*Rand).Int63n with mutex locked.
func (r *lockedSource) Int63n(n int64) int64 {
	if n <= 0 {
		panic("invalid argument to Int63n")
	}
	if n&(n-1) == 0 { // n is power of two, can mask
		return r.Int63() & (n - 1)
	}
	max := int64((1 << 63) - 1 - (1<<63)%uint64(n))
	v := r.Int63()
	for v > max {
		v = r.Int63()
	}
	return v % n
}
