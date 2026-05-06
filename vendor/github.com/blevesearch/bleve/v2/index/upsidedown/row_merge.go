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

package upsidedown

import (
	"encoding/binary"
)

var mergeOperator upsideDownMerge

var dictionaryTermIncr []byte
var dictionaryTermDecr []byte

func init() {
	dictionaryTermIncr = make([]byte, 8)
	binary.LittleEndian.PutUint64(dictionaryTermIncr, uint64(1))
	dictionaryTermDecr = make([]byte, 8)
	var negOne = int64(-1)
	binary.LittleEndian.PutUint64(dictionaryTermDecr, uint64(negOne))
}

type upsideDownMerge struct{}

func (m *upsideDownMerge) FullMerge(key, existingValue []byte, operands [][]byte) ([]byte, bool) {
	// set up record based on key
	dr, err := NewDictionaryRowK(key)
	if err != nil {
		return nil, false
	}
	if len(existingValue) > 0 {
		// if existing value, parse it
		err = dr.parseDictionaryV(existingValue)
		if err != nil {
			return nil, false
		}
	}

	// now process operands
	for _, operand := range operands {
		next := int64(binary.LittleEndian.Uint64(operand))
		if next < 0 && uint64(-next) > dr.count {
			// subtracting next from existing would overflow
			dr.count = 0
		} else if next < 0 {
			dr.count -= uint64(-next)
		} else {
			dr.count += uint64(next)
		}
	}

	return dr.Value(), true
}

func (m *upsideDownMerge) PartialMerge(key, leftOperand, rightOperand []byte) ([]byte, bool) {
	left := int64(binary.LittleEndian.Uint64(leftOperand))
	right := int64(binary.LittleEndian.Uint64(rightOperand))
	rv := make([]byte, 8)
	binary.LittleEndian.PutUint64(rv, uint64(left+right))
	return rv, true
}

func (m *upsideDownMerge) Name() string {
	return "upsideDownMerge"
}
