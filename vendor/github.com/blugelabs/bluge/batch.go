//  Copyright (c) 2020 The Bluge Authors.
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

package bluge

import (
	"github.com/blugelabs/bluge/index"
)

const _idField = "_id"

type Identifier string

func (i Identifier) Field() string {
	return _idField
}

func (i Identifier) Term() []byte {
	return []byte(i)
}

// NewBatch creates a new empty batch.
func NewBatch() *index.Batch {
	return index.NewBatch()
}
