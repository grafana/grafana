// Copyright 2023 CUE Authors
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

package adt

import (
	"sync"

	"cuelang.org/go/cue/stats"
)

// This file contains stats and profiling functionality.

var (
	// counts is a temporary and internal solution for collecting global stats. It is protected with a mutex.
	counts   stats.Counts
	countsMu sync.Mutex
)

// AddStats adds the stats of the given OpContext to the global
// counters.
func AddStats(ctx *OpContext) {
	countsMu.Lock()
	counts.Add(ctx.stats)
	countsMu.Unlock()
}

// TotalStats returns the aggregate counts of all operations
// calling AddStats.
func TotalStats() stats.Counts {
	countsMu.Lock()
	// Shallow copy suffices as it only contains counter fields.
	s := counts
	countsMu.Unlock()
	return s
}
