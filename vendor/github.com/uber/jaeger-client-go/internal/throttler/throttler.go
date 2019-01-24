// Copyright (c) 2018 The Jaeger Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package throttler

// Throttler is used to rate limits operations. For example, given how debug spans
// are always sampled, a throttler can be enabled per client to rate limit the amount
// of debug spans a client can start.
type Throttler interface {
	// IsAllowed determines whether the operation should be allowed and not be
	// throttled.
	IsAllowed(operation string) bool
}

// DefaultThrottler doesn't throttle at all.
type DefaultThrottler struct{}

// IsAllowed implements Throttler#IsAllowed.
func (t DefaultThrottler) IsAllowed(operation string) bool {
	return true
}
