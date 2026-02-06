// Copyright (c) 2024 Alexey Mayshev. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package otter

import (
	"math"

	"github.com/maypok86/otter/internal/stats"
)

// Stats is a statistics snapshot.
type Stats struct {
	hits         int64
	misses       int64
	rejectedSets int64
	evictedCount int64
	evictedCost  int64
}

func newStats(s *stats.Stats) Stats {
	return Stats{
		hits:         negativeToMax(s.Hits()),
		misses:       negativeToMax(s.Misses()),
		rejectedSets: negativeToMax(s.RejectedSets()),
		evictedCount: negativeToMax(s.EvictedCount()),
		evictedCost:  negativeToMax(s.EvictedCost()),
	}
}

// Hits returns the number of cache hits.
func (s Stats) Hits() int64 {
	return s.hits
}

// Misses returns the number of cache misses.
func (s Stats) Misses() int64 {
	return s.misses
}

// Ratio returns the cache hit ratio.
func (s Stats) Ratio() float64 {
	requests := checkedAdd(s.hits, s.misses)
	if requests == 0 {
		return 0.0
	}
	return float64(s.hits) / float64(requests)
}

// RejectedSets returns the number of rejected sets.
func (s Stats) RejectedSets() int64 {
	return s.rejectedSets
}

// EvictedCount returns the number of evicted entries.
func (s Stats) EvictedCount() int64 {
	return s.evictedCount
}

// EvictedCost returns the sum of costs of evicted entries.
func (s Stats) EvictedCost() int64 {
	return s.evictedCost
}

func checkedAdd(a, b int64) int64 {
	naiveSum := a + b
	if (a^b) < 0 || (a^naiveSum) >= 0 {
		// If a and b have different signs or a has the same sign as the result then there was no overflow, return.
		return naiveSum
	}
	// we did over/under flow, if the sign is negative we should return math.MaxInt64 otherwise math.MinInt64.
	if naiveSum < 0 {
		return math.MaxInt64
	}
	return math.MinInt64
}

func negativeToMax(v int64) int64 {
	if v < 0 {
		return math.MaxInt64
	}

	return v
}
