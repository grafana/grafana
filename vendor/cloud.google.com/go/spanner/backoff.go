/*
Copyright 2017 Google Inc. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package spanner

import (
	"math/rand"
	"time"
)

const (
	// minBackoff is the minimum backoff used by default.
	minBackoff = 1 * time.Second
	// maxBackoff is the maximum backoff used by default.
	maxBackoff = 32 * time.Second
	// jitter is the jitter factor.
	jitter = 0.4
	// rate is the rate of exponential increase in the backoff.
	rate = 1.3
)

var defaultBackoff = exponentialBackoff{minBackoff, maxBackoff}

type exponentialBackoff struct {
	min, max time.Duration
}

// delay calculates the delay that should happen at n-th
// exponential backoff in a series.
func (b exponentialBackoff) delay(retries int) time.Duration {
	min, max := float64(b.min), float64(b.max)
	delay := min
	for delay < max && retries > 0 {
		delay *= rate
		retries--
	}
	if delay > max {
		delay = max
	}
	delay -= delay * jitter * rand.Float64()
	if delay < min {
		delay = min
	}
	return time.Duration(delay)
}
