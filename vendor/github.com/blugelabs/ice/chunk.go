//  Copyright (c) 2020 Couchbase, Inc.
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

package ice

import (
	"fmt"
)

const maxDocsToScanSequentially = 1024

// legacyChunkMode was the original chunk mode (always chunk size 1024)
// this mode is still used for chunking doc values.
const legacyChunkMode uint32 = 1024

const chunkModeV1 uint32 = 1025

// defaultChunkMode is the most recent improvement to chunking and should
// be used by default.
const defaultChunkMode uint32 = chunkModeV1

func getChunkSize(chunkMode uint32, cardinality, maxDocs uint64) (uint64, error) {
	switch {
	// any chunkMode <= 1024 will always chunk with chunkSize=chunkMode
	case chunkMode <= legacyChunkMode:
		// legacy chunk size
		return uint64(chunkMode), nil

	case chunkMode == chunkModeV1:
		// the observation that the fewest number of dense chunks is the most
		// desirable layout, given the built-in assumptions of chunking
		// (that we want to put an upper-bound on the number of items you must
		//  walk over without skipping, currently tuned to 1024)
		//
		// 1.  compute the number of chunks needed (max 1024/chunk)
		// 2.  convert to chunkSize, dividing into maxDocs
		numChunks := (cardinality / maxDocsToScanSequentially) + 1
		chunkSize := maxDocs / numChunks
		return chunkSize, nil
	}
	return 0, fmt.Errorf("unknown chunk mode %d", chunkMode)
}
