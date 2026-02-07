// Copyright 2025 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package storage

import "sync"

// readIDGenerator generates unique read IDs for multi-range reads.
// Call readIDGenerator.Next to get the next ID. Safe to be called concurrently.
type readIDGenerator struct {
	initOnce sync.Once
	nextID   chan int64 // do not use this field directly
}

func (g *readIDGenerator) init() {
	g.nextID = make(chan int64, 1)
	g.nextID <- 1
}

// Next returns the Next read ID. It initializes the readIDGenerator if needed.
func (g *readIDGenerator) Next() int64 {
	g.initOnce.Do(g.init)

	id := <-g.nextID
	n := id + 1
	g.nextID <- n

	return id
}
