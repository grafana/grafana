/*
 *
 * Copyright 2020 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

// Package adaptive provides functionality for adaptive client-side throttling.
package adaptive

import (
	rand "math/rand/v2"
	"sync"
	"time"
)

// For overriding in unittests.
var (
	timeNowFunc = time.Now
	randFunc    = rand.Float64
)

const (
	defaultDuration        = 30 * time.Second
	defaultBins            = 100
	defaultRatioForAccepts = 2.0
	defaultRequestsPadding = 8.0
)

// Throttler implements a client-side throttling recommendation system. All
// methods are safe for concurrent use by multiple goroutines.
//
// The throttler has the following knobs for which we will use defaults for
// now. If there is a need to make them configurable at a later point in time,
// support for the same will be added.
//   - Duration: amount of recent history that will be taken into account for
//     making client-side throttling decisions. A default of 30 seconds is used.
//   - Bins: number of bins to be used for bucketing historical data. A default
//     of 100 is used.
//   - RatioForAccepts: ratio by which accepts are multiplied, typically a value
//     slightly larger than 1.0. This is used to make the throttler behave as if
//     the backend had accepted more requests than it actually has, which lets us
//     err on the side of sending to the backend more requests than we think it
//     will accept for the sake of speeding up the propagation of state. A
//     default of 2.0 is used.
//   - RequestsPadding: is used to decrease the (client-side) throttling
//     probability in the low QPS regime (to speed up propagation of state), as
//     well as to safeguard against hitting a client-side throttling probability
//     of 100%. The weight of this value decreases as the number of requests in
//     recent history grows. A default of 8 is used.
//
// The adaptive throttler attempts to estimate the probability that a request
// will be throttled using recent history. Server requests (both throttled and
// accepted) are registered with the throttler (via the RegisterBackendResponse
// method), which then recommends client-side throttling (via the
// ShouldThrottle method) with probability given by:
// (requests - RatioForAccepts * accepts) / (requests + RequestsPadding)
type Throttler struct {
	ratioForAccepts float64
	requestsPadding float64

	// Number of total accepts and throttles in the lookback period.
	mu        sync.Mutex
	accepts   *lookback
	throttles *lookback
}

// New initializes a new adaptive throttler with the default values.
func New() *Throttler {
	return newWithArgs(defaultDuration, defaultBins, defaultRatioForAccepts, defaultRequestsPadding)
}

// newWithArgs initializes a new adaptive throttler with the provided values.
// Used only in unittests.
func newWithArgs(duration time.Duration, bins int64, ratioForAccepts, requestsPadding float64) *Throttler {
	return &Throttler{
		ratioForAccepts: ratioForAccepts,
		requestsPadding: requestsPadding,
		accepts:         newLookback(bins, duration),
		throttles:       newLookback(bins, duration),
	}
}

// ShouldThrottle returns a probabilistic estimate of whether the server would
// throttle the next request. This should be called for every request before
// allowing it to hit the network. If the returned value is true, the request
// should be aborted immediately (as if it had been throttled by the server).
func (t *Throttler) ShouldThrottle() bool {
	randomProbability := randFunc()
	now := timeNowFunc()

	t.mu.Lock()
	defer t.mu.Unlock()

	accepts, throttles := float64(t.accepts.sum(now)), float64(t.throttles.sum(now))
	requests := accepts + throttles
	throttleProbability := (requests - t.ratioForAccepts*accepts) / (requests + t.requestsPadding)
	if throttleProbability <= randomProbability {
		return false
	}

	t.throttles.add(now, 1)
	return true
}

// RegisterBackendResponse registers a response received from the backend for a
// request allowed by ShouldThrottle. This should be called for every response
// received from the backend (i.e., once for each request for which
// ShouldThrottle returned false).
func (t *Throttler) RegisterBackendResponse(throttled bool) {
	now := timeNowFunc()

	t.mu.Lock()
	if throttled {
		t.throttles.add(now, 1)
	} else {
		t.accepts.add(now, 1)
	}
	t.mu.Unlock()
}
