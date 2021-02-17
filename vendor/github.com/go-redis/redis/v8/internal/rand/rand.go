package rand

import (
	"math/rand"
	"sync"
)

// Int returns a non-negative pseudo-random int.
func Int() int { return pseudo.Int() }

// Intn returns, as an int, a non-negative pseudo-random number in [0,n).
// It panics if n <= 0.
func Intn(n int) int { return pseudo.Intn(n) }

// Int63n returns, as an int64, a non-negative pseudo-random number in [0,n).
// It panics if n <= 0.
func Int63n(n int64) int64 { return pseudo.Int63n(n) }

// Perm returns, as a slice of n ints, a pseudo-random permutation of the integers [0,n).
func Perm(n int) []int { return pseudo.Perm(n) }

// Seed uses the provided seed value to initialize the default Source to a
// deterministic state. If Seed is not called, the generator behaves as if
// seeded by Seed(1).
func Seed(n int64) { pseudo.Seed(n) }

var pseudo = rand.New(&source{src: rand.NewSource(1)})

type source struct {
	src rand.Source
	mu  sync.Mutex
}

func (s *source) Int63() int64 {
	s.mu.Lock()
	n := s.src.Int63()
	s.mu.Unlock()
	return n
}

func (s *source) Seed(seed int64) {
	s.mu.Lock()
	s.src.Seed(seed)
	s.mu.Unlock()
}
