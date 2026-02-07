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
	"github.com/dolthub/vitess/go/vt/vterrors"
)

// QueryResponse represents a query response for ExecuteBatch.
type QueryResponse struct {
	QueryResult *Result
	QueryError  error
}

// QueryResponsesEqual compares two arrays of QueryResponse.
// They contain protos, so we cannot use reflect.DeepEqual.
func QueryResponsesEqual(r1, r2 []QueryResponse) bool {
	if len(r1) != len(r2) {
		return false
	}
	for i, r := range r1 {
		if !r.QueryResult.Equal(r2[i].QueryResult) {
			return false
		}
		if !vterrors.Equals(r.QueryError, r2[i].QueryError) {
			return false
		}
	}
	return true
}
