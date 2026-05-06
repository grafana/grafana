//  Copyright (c) 2020 Couchbase, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 		http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package index

import "time"

// Event represents the information provided in an OnEvent() callback.
type Event struct {
	Kind     int
	Chill    *Writer
	Duration time.Duration
}

// Kinds of index events
const (
	EventKindCloseStart                 = 1 // when the index has started to close
	EventKindClose                      = 2 // when the index has been fully closed
	EventKindMergerProgress             = 3 // when the index has completed a round of merge operations
	EventKindPersisterProgress          = 4 // when the index has completed a round of persistence operations
	EventKindBatchIntroductionStart     = 5 // when the index has started to introduce a new batch
	EventKindBatchIntroduction          = 6 // when index has finished introducing a batch
	EventKindMergeTaskIntroductionStart = 7 // when the index has started to introduce a merge
	EventKindMergeTaskIntroduction      = 8 // when the index has finished introdocing a merge

)
