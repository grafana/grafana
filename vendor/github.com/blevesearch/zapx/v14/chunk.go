//  Copyright (c) 2019 Couchbase, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//              http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package zap

import (
	"fmt"
)

// LegacyChunkMode was the original chunk mode (always chunk size 1024)
// this mode is still used for chunking doc values.
var LegacyChunkMode uint32 = 1024

// DefaultChunkMode is the most recent improvement to chunking and should
// be used by default.
var DefaultChunkMode uint32 = 1026

func getChunkSize(chunkMode uint32, cardinality uint64, maxDocs uint64) (uint64, error) {
	switch {
	// any chunkMode <= 1024 will always chunk with chunkSize=chunkMode
	case chunkMode <= 1024:
		// legacy chunk size
		return uint64(chunkMode), nil

	case chunkMode == 1025:
		// attempt at simple improvement
		// theory - the point of chunking is to put a bound on the maximum number of
		// calls to Next() needed to find a random document.  ie, you should be able
		// to do one jump to the correct chunk, and then walk through at most
		// chunk-size items
		// previously 1024 was chosen as the chunk size, but this is particularly
		// wasteful for low cardinality terms.  the observation is that if there
		// are less than 1024 items, why not put them all in one chunk,
		// this way you'll still achieve the same goal of visiting at most
		// chunk-size items.
		// no attempt is made to tweak any other case
		if cardinality <= 1024 {
			return maxDocs, nil
		}
		return 1024, nil

	case chunkMode == 1026:
		// improve upon the ideas tested in chunkMode 1025
		// the observation that the fewest number of dense chunks is the most
		// desirable layout, given the built-in assumptions of chunking
		// (that we want to put an upper-bound on the number of items you must
		//  walk over without skipping, currently tuned to 1024)
		//
		// 1.  compute the number of chunks needed (max 1024/chunk)
		// 2.  convert to chunkSize, dividing into maxDocs
		numChunks := (cardinality / 1024) + 1
		chunkSize := maxDocs / numChunks
		return chunkSize, nil
	}
	return 0, fmt.Errorf("unknown chunk mode %d", chunkMode)
}
