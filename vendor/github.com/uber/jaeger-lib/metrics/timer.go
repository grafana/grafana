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

// Timer accumulates observations about how long some operation took,
// and also maintains a historgam of percentiles.
type Timer interface {
	// Records the time passed in.
	Record(time.Duration)
}

// NullTimer timer that does nothing
var NullTimer Timer = nullTimer{}

type nullTimer struct{}

func (nullTimer) Record(time.Duration) {}
