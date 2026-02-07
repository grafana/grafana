//  Copyright (c) 2018 Couchbase, Inc.
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

package scorch

import "time"

// RegistryAsyncErrorCallbacks should be treated as read-only after
// process init()'ialization.
var RegistryAsyncErrorCallbacks = map[string]func(error, string){}

// RegistryEventCallbacks should be treated as read-only after
// process init()'ialization.
// In the event of not having a callback, these return true.
var RegistryEventCallbacks = map[string]func(Event) bool{}

// Event represents the information provided in an OnEvent() callback.
type Event struct {
	Kind     EventKind
	Scorch   *Scorch
	Duration time.Duration
}

// EventKind represents an event code for OnEvent() callbacks.
type EventKind int

const (
	// EventKindCloseStart is fired when a Scorch.Close() has begun.
	EventKindCloseStart EventKind = iota

	// EventKindClose is fired when a scorch index has been fully closed.
	EventKindClose

	// EventKindMergerProgress is fired when the merger has completed a
	// round of merge processing.
	EventKindMergerProgress

	// EventKindPersisterProgress is fired when the persister has completed
	// a round of persistence processing.
	EventKindPersisterProgress

	// EventKindBatchIntroductionStart is fired when Batch() is invoked which
	// introduces a new segment.
	EventKindBatchIntroductionStart

	// EventKindBatchIntroduction is fired when Batch() completes.
	EventKindBatchIntroduction

	// EventKindMergeTaskIntroductionStart is fired when the merger is about to
	// start the introduction of merged segment from a single merge task.
	EventKindMergeTaskIntroductionStart

	// EventKindMergeTaskIntroduction is fired when the merger has completed
	// the introduction of merged segment from a single merge task.
	EventKindMergeTaskIntroduction

	// EventKindPreMergeCheck is fired before the merge begins to check if
	// the caller should proceed with the merge.
	EventKindPreMergeCheck

	// EventKindIndexStart is fired when Index() is invoked which
	// creates a new Document object from an interface using the index mapping.
	EventKindIndexStart

	// EventKindPurgerCheck is fired before the purge code is invoked and decides
	// whether to execute or not. For unit test purposes
	EventKindPurgerCheck
)
