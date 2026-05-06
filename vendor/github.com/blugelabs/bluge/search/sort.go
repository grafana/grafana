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

package search

import (
	"bytes"
	"strings"
)

type SortOrder []*Sort

func (o SortOrder) Fields() (fields []string) {
	for _, sort := range o {
		fields = append(fields, sort.Fields()...)
	}
	return fields
}

func (o SortOrder) Copy() SortOrder {
	rv := make(SortOrder, len(o))
	copy(rv, o)
	return rv
}

func (o SortOrder) Reverse() {
	for _, oi := range o {
		oi.desc = !oi.desc
		oi.missingFirst = !oi.missingFirst
	}
}

func (o SortOrder) Compute(match *DocumentMatch) {
	for _, sort := range o {
		sortVal := sort.Value(match)
		sortValCopy := make([]byte, len(sortVal))
		copy(sortValCopy, sortVal)
		match.SortValue = append(match.SortValue, sortValCopy)
	}
}

func (o SortOrder) Compare(i, j *DocumentMatch) int {
	// compare the documents on all search sorts until a differences is found
	for x := range o {
		c := 0

		iVal := i.SortValue[x]
		jVal := j.SortValue[x]
		c = bytes.Compare(iVal, jVal)
		if c == 0 {
			continue
		}
		if o[x].desc {
			c = -c
		}
		return c
	}
	// if they are the same at this point, impose order based on index natural sort order
	if i.HitNumber == j.HitNumber {
		return 0
	} else if i.HitNumber > j.HitNumber {
		return 1
	}
	return -1
}

type SortValue [][]byte

type Sort struct {
	source       TextValueSource
	desc         bool
	missingFirst bool
}

func SortBy(source TextValueSource) *Sort {
	rv := &Sort{}

	rv.source = MissingTextValue(source, &sortFirstLast{
		desc:  &rv.desc,
		first: &rv.missingFirst,
	})

	return rv
}

func (s *Sort) Desc() *Sort {
	s.desc = true
	return s
}

func (s *Sort) MissingFirst() *Sort {
	s.missingFirst = true
	return s
}

func (s *Sort) Fields() []string {
	return s.source.Fields()
}

func (s *Sort) Value(match *DocumentMatch) []byte {
	return s.source.Value(match)
}

func ParseSearchSortString(input string) *Sort {
	descending := false
	if strings.HasPrefix(input, "-") {
		descending = true
		input = input[1:]
	}
	input = strings.TrimPrefix(input, "+")
	if input == "_score" {
		return SortBy(&ScoreSource{}).Desc()
	}
	rv := SortBy(Field(input))
	if descending {
		rv.Desc()
	}
	return rv
}

func ParseSortOrderStrings(in []string) SortOrder {
	rv := make(SortOrder, 0, len(in))
	for _, i := range in {
		ss := ParseSearchSortString(i)
		rv = append(rv, ss)
	}
	return rv
}

var highTerm = bytes.Repeat([]byte{0xff}, 10)
var lowTerm []byte = []byte{0x00}

type sortFirstLast struct {
	desc  *bool
	first *bool
}

func (c *sortFirstLast) Fields() []string {
	return nil
}

func (c *sortFirstLast) Value(_ *DocumentMatch) []byte {
	if c.desc != nil && *c.desc && c.first != nil && *c.first {
		return highTerm
	} else if c.desc != nil && *c.desc {
		return lowTerm
	} else if c.first != nil && *c.first {
		return lowTerm
	}
	return highTerm
}
