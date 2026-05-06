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

package scorch

import segment "github.com/blevesearch/scorch_segment_api/v2"

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

func (e *emptyPostingsIterator) BytesRead() uint64 {
	return 0
}

func (e *emptyPostingsIterator) ResetBytesRead(uint64) {}

func (e *emptyPostingsIterator) BytesWritten() uint64 { return 0 }

var anEmptyPostingsIterator = &emptyPostingsIterator{}
