//  Copyright (c) 2014 Couchbase, Inc.
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

package bleve

// An IndexAlias is a wrapper around one or more
// Index objects.  It has two distinct modes of
// operation.
// 1.  When it points to a single index, ALL index
// operations are valid and will be passed through
// to the underlying index.
// 2.  When it points to more than one index, the only
// valid operation is Search.  In this case the
// search will be performed across all the
// underlying indexes and the results merged.
// Calls to Add/Remove/Swap the underlying indexes
// are atomic, so you can safely change the
// underlying Index objects while other components
// are performing operations.
type IndexAlias interface {
	Index

	Add(i ...Index)
	Remove(i ...Index)
	Swap(in, out []Index)
}
