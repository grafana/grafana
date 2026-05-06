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

import segment "github.com/blugelabs/bluge_segment_api"

type emptyPostingsIterator struct{}

func (e *emptyPostingsIterator) Next() (segment.Posting, error) {
	return nil, nil
}

func (e *emptyPostingsIterator) Advance(uint64) (segment.Posting, error) {
	return nil, nil
}

func (e *emptyPostingsIterator) Size() int {
	return 0
}

func (e *emptyPostingsIterator) Empty() bool {
	return true
}

func (e *emptyPostingsIterator) Count() uint64 {
	return 0
}

func (e *emptyPostingsIterator) Close() error {
	return nil
}

var anEmptyPostingsIterator = &emptyPostingsIterator{}
