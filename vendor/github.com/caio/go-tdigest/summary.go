package tdigest

import (
	"fmt"
	"math"
	"sort"
)

type summary struct {
	means  []float64
	counts []uint64
}

func newSummary(initialCapacity int) *summary {
	s := &summary{
		means:  make([]float64, 0, initialCapacity),
		counts: make([]uint64, 0, initialCapacity),
	}
	return s
}

func (s *summary) Len() int {
	return len(s.means)
}

func (s *summary) Add(key float64, value uint64) error {
	if math.IsNaN(key) {
		return fmt.Errorf("Key must not be NaN")
	}
	if value == 0 {
		return fmt.Errorf("Count must be >0")
	}

	idx := s.findInsertionIndex(key)

	s.means = append(s.means, math.NaN())
	s.counts = append(s.counts, 0)

	copy(s.means[idx+1:], s.means[idx:])
	copy(s.counts[idx+1:], s.counts[idx:])

	s.means[idx] = key
	s.counts[idx] = value

	return nil
}

// Always insert to the right
func (s *summary) findInsertionIndex(x float64) int {
	// Binary search is only worthwhile if we have a lot of keys.
	if len(s.means) < 250 {
		for i, mean := range s.means {
			if mean > x {
				return i
			}
		}
		return len(s.means)
	}

	return sort.Search(len(s.means), func(i int) bool {
		return s.means[i] > x
	})
}

// This method is the hotspot when calling Add(), which in turn is called by
// Compress() and Merge().
func (s *summary) HeadSum(idx int) (sum float64) {
	return float64(sumUntilIndex(s.counts, idx))
}

func (s *summary) Floor(x float64) int {
	return s.findIndex(x) - 1
}

func (s *summary) findIndex(x float64) int {
	// Binary search is only worthwhile if we have a lot of keys.
	if len(s.means) < 250 {
		for i, mean := range s.means {
			if mean >= x {
				return i
			}
		}
		return len(s.means)
	}

	return sort.Search(len(s.means), func(i int) bool {
		return s.means[i] >= x
	})
}

func (s *summary) Mean(uncheckedIndex int) float64 {
	return s.means[uncheckedIndex]
}

func (s *summary) Count(uncheckedIndex int) uint64 {
	return s.counts[uncheckedIndex]
}

// return the index of the last item which the sum of counts
// of items before it is less than or equal to `sum`. -1 in
// case no centroid satisfies the requirement.
// Since it's cheap, this also returns the `HeadSum` until
// the found index (i.e. cumSum = HeadSum(FloorSum(x)))
func (s *summary) FloorSum(sum float64) (index int, cumSum float64) {
	index = -1
	for i, count := range s.counts {
		if cumSum <= sum {
			index = i
		} else {
			break
		}
		cumSum += float64(count)
	}
	if index != -1 {
		cumSum -= float64(s.counts[index])
	}
	return index, cumSum
}

func (s *summary) setAt(index int, mean float64, count uint64) {
	s.means[index] = mean
	s.counts[index] = count
	s.adjustRight(index)
	s.adjustLeft(index)
}

func (s *summary) adjustRight(index int) {
	for i := index + 1; i < len(s.means) && s.means[i-1] > s.means[i]; i++ {
		s.means[i-1], s.means[i] = s.means[i], s.means[i-1]
		s.counts[i-1], s.counts[i] = s.counts[i], s.counts[i-1]
	}
}

func (s *summary) adjustLeft(index int) {
	for i := index - 1; i >= 0 && s.means[i] > s.means[i+1]; i-- {
		s.means[i], s.means[i+1] = s.means[i+1], s.means[i]
		s.counts[i], s.counts[i+1] = s.counts[i+1], s.counts[i]
	}
}

func (s *summary) ForEach(f func(float64, uint64) bool) {
	for i, mean := range s.means {
		if !f(mean, s.counts[i]) {
			break
		}
	}
}

func (s *summary) Perm(rng RNG, f func(float64, uint64) bool) {
	for _, i := range perm(rng, s.Len()) {
		if !f(s.means[i], s.counts[i]) {
			break
		}
	}
}

func (s *summary) Clone() *summary {
	return &summary{
		means:  append([]float64{}, s.means...),
		counts: append([]uint64{}, s.counts...),
	}
}

// Randomly shuffles summary contents, so they can be added to another summary
// with being pathological. Renders summary invalid.
func (s *summary) shuffle(rng RNG) {
	for i := len(s.means) - 1; i > 1; i-- {
		s.Swap(i, rng.Intn(i+1))
	}
}

// for sort.Interface
func (s *summary) Swap(i, j int) {
	s.means[i], s.means[j] = s.means[j], s.means[i]
	s.counts[i], s.counts[j] = s.counts[j], s.counts[i]
}

func (s *summary) Less(i, j int) bool {
	return s.means[i] < s.means[j]
}

// A simple loop unroll saves a surprising amount of time.
func sumUntilIndex(s []uint64, idx int) uint64 {
	var cumSum uint64
	var i int
	for i = idx - 1; i >= 3; i -= 4 {
		cumSum += uint64(s[i])
		cumSum += uint64(s[i-1])
		cumSum += uint64(s[i-2])
		cumSum += uint64(s[i-3])
	}
	for ; i >= 0; i-- {
		cumSum += uint64(s[i])
	}
	return cumSum
}

func perm(rng RNG, n int) []int {
	m := make([]int, n)
	for i := 1; i < n; i++ {
		j := rng.Intn(i + 1)
		m[i] = m[j]
		m[j] = i
	}
	return m
}
