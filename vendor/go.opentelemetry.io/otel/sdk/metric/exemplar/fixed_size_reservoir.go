// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package exemplar // import "go.opentelemetry.io/otel/sdk/metric/exemplar"

import (
	"context"
	"math"
	"math/rand/v2"
	"sync"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/sdk/metric/internal/reservoir"
)

// FixedSizeReservoirProvider returns a provider of [FixedSizeReservoir].
func FixedSizeReservoirProvider(k int) ReservoirProvider {
	return func(attribute.Set) Reservoir {
		return NewFixedSizeReservoir(k)
	}
}

// NewFixedSizeReservoir returns a [FixedSizeReservoir] that samples at most
// k exemplars. If there are k or less measurements made, the Reservoir will
// sample each one. If there are more than k, the Reservoir will then randomly
// sample all additional measurement with a decreasing probability.
func NewFixedSizeReservoir(k int) *FixedSizeReservoir {
	return newFixedSizeReservoir(newStorage(k))
}

var _ Reservoir = &FixedSizeReservoir{}

// FixedSizeReservoir is a [Reservoir] that samples at most k exemplars. If
// there are k or less measurements made, the Reservoir will sample each one.
// If there are more than k, the Reservoir will then randomly sample all
// additional measurement with a decreasing probability.
type FixedSizeReservoir struct {
	reservoir.ConcurrentSafe
	*storage
	mu sync.Mutex

	// count is the number of measurement seen.
	count int64
	// next is the next count that will store a measurement at a random index
	// once the reservoir has been filled.
	next int64
	// w is the largest random number in a distribution that is used to compute
	// the next next.
	w float64
}

func newFixedSizeReservoir(s *storage) *FixedSizeReservoir {
	r := &FixedSizeReservoir{
		storage: s,
	}
	r.reset()
	return r
}

// randomFloat64 returns, as a float64, a uniform pseudo-random number in the
// open interval (0.0,1.0).
func (*FixedSizeReservoir) randomFloat64() float64 {
	// TODO: Use an algorithm that avoids rejection sampling. For example:
	//
	//   const precision = 1 << 53 // 2^53
	//   // Generate an integer in [1, 2^53 - 1]
	//   v := rand.Uint64() % (precision - 1) + 1
	//   return float64(v) / float64(precision)
	f := rand.Float64()
	for f == 0 {
		f = rand.Float64()
	}
	return f
}

// Offer accepts the parameters associated with a measurement. The
// parameters will be stored as an exemplar if the Reservoir decides to
// sample the measurement.
//
// The passed ctx needs to contain any baggage or span that were active
// when the measurement was made. This information may be used by the
// Reservoir in making a sampling decision.
//
// The time t is the time when the measurement was made. The v and a
// parameters are the value and dropped (filtered) attributes of the
// measurement respectively.
func (r *FixedSizeReservoir) Offer(ctx context.Context, t time.Time, n Value, a []attribute.KeyValue) {
	// The following algorithm is "Algorithm L" from Li, Kim-Hung (4 December
	// 1994). "Reservoir-Sampling Algorithms of Time Complexity
	// O(n(1+log(N/n)))". ACM Transactions on Mathematical Software. 20 (4):
	// 481–493 (https://dl.acm.org/doi/10.1145/198429.198435).
	//
	// A high-level overview of "Algorithm L":
	//   0) Pre-calculate the random count greater than the storage size when
	//      an exemplar will be replaced.
	//   1) Accept all measurements offered until the configured storage size is
	//      reached.
	//   2) Loop:
	//      a) When the pre-calculate count is reached, replace a random
	//         existing exemplar with the offered measurement.
	//      b) Calculate the next random count greater than the existing one
	//         which will replace another exemplars
	//
	// The way a "replacement" count is computed is by looking at `n` number of
	// independent random numbers each corresponding to an offered measurement.
	// Of these numbers the smallest `k` (the same size as the storage
	// capacity) of them are kept as a subset. The maximum value in this
	// subset, called `w` is used to weight another random number generation
	// for the next count that will be considered.
	//
	// By weighting the next count computation like described, it is able to
	// perform a uniformly-weighted sampling algorithm based on the number of
	// samples the reservoir has seen so far. The sampling will "slow down" as
	// more and more samples are offered so as to reduce a bias towards those
	// offered just prior to the end of the collection.
	//
	// This algorithm is preferred because of its balance of simplicity and
	// performance. It will compute three random numbers (the bulk of
	// computation time) for each item that becomes part of the reservoir, but
	// it does not spend any time on items that do not. In particular it has an
	// asymptotic runtime of O(k(1 + log(n/k)) where n is the number of
	// measurements offered and k is the reservoir size.
	//
	// See https://en.wikipedia.org/wiki/Reservoir_sampling for an overview of
	// this and other reservoir sampling algorithms. See
	// https://github.com/MrAlias/reservoir-sampling for a performance
	// comparison of reservoir sampling algorithms.

	r.mu.Lock()
	defer r.mu.Unlock()
	if int(r.count) < cap(r.measurements) {
		r.store(int(r.count), newMeasurement(ctx, t, n, a))
	} else if r.count == r.next {
		// Overwrite a random existing measurement with the one offered.
		idx := int(rand.Int64N(int64(cap(r.measurements))))
		r.store(idx, newMeasurement(ctx, t, n, a))
		r.advance()
	}
	r.count++
}

// reset resets r to the initial state.
func (r *FixedSizeReservoir) reset() {
	// This resets the number of exemplars known.
	r.count = 0
	// Random index inserts should only happen after the storage is full.
	r.next = int64(cap(r.measurements))

	// Initial random number in the series used to generate r.next.
	//
	// This is set before r.advance to reset or initialize the random number
	// series. Without doing so it would always be 0 or never restart a new
	// random number series.
	//
	// This maps the uniform random number in (0,1) to a geometric distribution
	// over the same interval. The mean of the distribution is inversely
	// proportional to the storage capacity.
	r.w = math.Exp(math.Log(r.randomFloat64()) / float64(cap(r.measurements)))

	r.advance()
}

// advance updates the count at which the offered measurement will overwrite an
// existing exemplar.
func (r *FixedSizeReservoir) advance() {
	// Calculate the next value in the random number series.
	//
	// The current value of r.w is based on the max of a distribution of random
	// numbers (i.e. `w = max(u_1,u_2,...,u_k)` for `k` equal to the capacity
	// of the storage and each `u` in the interval (0,w)). To calculate the
	// next r.w we use the fact that when the next exemplar is selected to be
	// included in the storage an existing one will be dropped, and the
	// corresponding random number in the set used to calculate r.w will also
	// be replaced. The replacement random number will also be within (0,w),
	// therefore the next r.w will be based on the same distribution (i.e.
	// `max(u_1,u_2,...,u_k)`). Therefore, we can sample the next r.w by
	// computing the next random number `u` and take r.w as `w * u^(1/k)`.
	r.w *= math.Exp(math.Log(r.randomFloat64()) / float64(cap(r.measurements)))
	// Use the new random number in the series to calculate the count of the
	// next measurement that will be stored.
	//
	// Given 0 < r.w < 1, each iteration will result in subsequent r.w being
	// smaller. This translates here into the next next being selected against
	// a distribution with a higher mean (i.e. the expected value will increase
	// and replacements become less likely)
	//
	// Important to note, the new r.next will always be at least 1 more than
	// the last r.next.
	r.next += int64(math.Log(r.randomFloat64())/math.Log(1-r.w)) + 1
}

// Collect returns all the held exemplars.
//
// The Reservoir state is preserved after this call.
func (r *FixedSizeReservoir) Collect(dest *[]Exemplar) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.storage.Collect(dest)
	// Call reset here even though it will reset r.count and restart the random
	// number series. This will persist any old exemplars as long as no new
	// measurements are offered, but it will also prioritize those new
	// measurements that are made over the older collection cycle ones.
	r.reset()
}
