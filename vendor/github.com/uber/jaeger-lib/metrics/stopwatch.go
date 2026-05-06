// Copyright (c) 2017 Uber Technologies, Inc.
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

package metrics

import (
	"time"
)

// StartStopwatch begins recording the executing time of an event, returning
// a Stopwatch that should be used to stop the recording the time for
// that event.  Multiple events can be occurring simultaneously each
// represented by different active Stopwatches
func StartStopwatch(timer Timer) Stopwatch {
	return Stopwatch{t: timer, start: time.Now()}
}

// A Stopwatch tracks the execution time of a specific event
type Stopwatch struct {
	t     Timer
	start time.Time
}

// Stop stops executing of the stopwatch and records the amount of elapsed time
func (s Stopwatch) Stop() {
	s.t.Record(s.ElapsedTime())
}

// ElapsedTime returns the amount of elapsed time (in time.Duration)
func (s Stopwatch) ElapsedTime() time.Duration {
	return time.Since(s.start)
}
