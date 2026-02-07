//  Copyright (c) 2017 Couchbase, Inc.
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

package regexp

import "fmt"

// instOp represents a instruction operation
type instOp int

// the enumeration of operations
const (
	OpMatch instOp = iota
	OpJmp
	OpSplit
	OpRange
)

// instSize is the approximate size of the an inst struct in bytes
const instSize = 40

type inst struct {
	op         instOp
	to         uint
	splitA     uint
	splitB     uint
	rangeStart byte
	rangeEnd   byte
}

func (i *inst) String() string {
	switch i.op {
	case OpJmp:
		return fmt.Sprintf("JMP: %d", i.to)
	case OpSplit:
		return fmt.Sprintf("SPLIT: %d - %d", i.splitA, i.splitB)
	case OpRange:
		return fmt.Sprintf("RANGE: %x - %x", i.rangeStart, i.rangeEnd)
	}
	return "MATCH"
}

type prog []*inst

func (p prog) String() string {
	rv := "\n"
	for i, pi := range p {
		rv += fmt.Sprintf("%d %v\n", i, pi)
	}
	return rv
}
