/*
Copyright 2019 The Vitess Authors.

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

package sqltypes

import (
	querypb "github.com/dolthub/vitess/go/vt/proto/query"
)

// EventTokenMinimum returns an event token that is guaranteed to
// happen before both provided EventToken objects. Note it doesn't
// parse the position, but rather only uses the timestamp. This is
// meant to be used for EventToken objects coming from different
// source shard.
func EventTokenMinimum(ev1, ev2 *querypb.EventToken) *querypb.EventToken {
	if ev1 == nil || ev2 == nil {
		// One or the other is not set, we can't do anything.
		return nil
	}

	if ev1.Timestamp < ev2.Timestamp {
		return &querypb.EventToken{
			Timestamp: ev1.Timestamp,
		}
	}
	return &querypb.EventToken{
		Timestamp: ev2.Timestamp,
	}
}
