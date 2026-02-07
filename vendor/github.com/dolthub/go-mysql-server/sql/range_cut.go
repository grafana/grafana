// Copyright 2021 Dolthub, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package sql

import (
	"context"
	"fmt"
)

// MySQLRangeCut represents a position on the line of all possible values.
type MySQLRangeCut interface {
	// Compare returns an integer stating the relative position of the calling MySQLRangeCut to the given MySQLRangeCut.
	Compare(MySQLRangeCut, Type) (int, error)
	// String returns the MySQLRangeCut as a string for display purposes.
	String() string
	// TypeAsLowerBound returns the bound type if the calling MySQLRangeCut is the lower bound of a range.
	TypeAsLowerBound() MySQLRangeBoundType
	// TypeAsUpperBound returns the bound type if the calling MySQLRangeCut is the upper bound of a range.
	TypeAsUpperBound() MySQLRangeBoundType
}

// MySQLRangeBoundType is the bound of the MySQLRangeCut.
type MySQLRangeBoundType int

const (
	// Open bounds represent exclusion.
	Open MySQLRangeBoundType = iota
	// Closed bounds represent inclusion.
	Closed
)

// Inclusive returns whether the bound represents inclusion.
func (bt MySQLRangeBoundType) Inclusive() bool {
	return bt == Closed
}

// GetMySQLRangeCutKey returns the inner value from the given MySQLRangeCut.
func GetMySQLRangeCutKey(c MySQLRangeCut) interface{} {
	switch c := c.(type) {
	case Below:
		return c.Key
	case Above:
		return c.Key
	default:
		panic(fmt.Errorf("need to check the MySQLRangeCut type before calling GetMySQLRangeCutKey, used on `%T`", c))
	}
}

func MySQLRangeCutIsBinding(c MySQLRangeCut) bool {
	switch c.(type) {
	case Below, Above:
		return true
	case AboveAll, AboveNull, BelowNull:
		return false
	default:
		panic(fmt.Errorf("unknown range cut %v", c))
	}
}

// GetMySQLRangeCutMax returns the MySQLRangeCut with the highest value.
func GetMySQLRangeCutMax(typ Type, cuts ...MySQLRangeCut) (MySQLRangeCut, error) {
	i := 0
	var maxCut MySQLRangeCut
	for ; i < len(cuts); i++ {
		if cuts[i] != nil {
			maxCut = cuts[i]
			i++
			break
		}
	}
	for ; i < len(cuts); i++ {
		if cuts[i] == nil {
			continue
		}
		comp, err := maxCut.Compare(cuts[i], typ)
		if err != nil {
			return maxCut, err
		}
		if comp == -1 {
			maxCut = cuts[i]
		}
	}
	return maxCut, nil
}

// GetMySQLRangeCutMin returns the MySQLRangeCut with the lowest value.
func GetMySQLRangeCutMin(typ Type, cuts ...MySQLRangeCut) (MySQLRangeCut, error) {
	i := 0
	var minCut MySQLRangeCut
	for ; i < len(cuts); i++ {
		if cuts[i] != nil {
			minCut = cuts[i]
			i++
			break
		}
	}
	for ; i < len(cuts); i++ {
		if cuts[i] == nil {
			continue
		}
		comp, err := minCut.Compare(cuts[i], typ)
		if err != nil {
			return minCut, err
		}
		if comp == 1 {
			minCut = cuts[i]
		}
	}
	return minCut, nil
}

// Above represents the position immediately above the contained key.
type Above struct {
	Key interface{}
}

var _ MySQLRangeCut = Above{}

// Compare implements MySQLRangeCut.
func (a Above) Compare(c MySQLRangeCut, typ Type) (int, error) {
	//TODO: Add context parameter to MySQLRangeCut.Compare
	ctx := context.Background()
	switch c := c.(type) {
	case AboveAll:
		return -1, nil
	case AboveNull:
		return 1, nil
	case Above:
		return typ.Compare(ctx, a.Key, c.Key)
	case Below:
		cmp, err := typ.Compare(ctx, a.Key, c.Key)
		if err != nil {
			return 0, err
		}
		if cmp == -1 {
			return -1, nil
		}
		return 1, nil
	case BelowNull:
		return 1, nil
	default:
		panic(fmt.Errorf("unrecognized MySQLRangeCut type '%T'", c))
	}
}

// String implements MySQLRangeCut.
func (a Above) String() string {
	return fmt.Sprintf("Above[%v]", a.Key)
}

// TypeAsLowerBound implements MySQLRangeCut.
func (Above) TypeAsLowerBound() MySQLRangeBoundType {
	return Open
}

// TypeAsUpperBound implements MySQLRangeCut.
func (Above) TypeAsUpperBound() MySQLRangeBoundType {
	return Closed
}

// AboveAll represents the position beyond the maximum possible value.
type AboveAll struct{}

var _ MySQLRangeCut = AboveAll{}

// Compare implements MySQLRangeCut.
func (AboveAll) Compare(c MySQLRangeCut, typ Type) (int, error) {
	if _, ok := c.(AboveAll); ok {
		return 0, nil
	}
	return 1, nil
}

// String implements MySQLRangeCut.
func (AboveAll) String() string {
	return "AboveAll"
}

// TypeAsLowerBound implements MySQLRangeCut.
func (AboveAll) TypeAsLowerBound() MySQLRangeBoundType {
	return Open
}

// TypeAsUpperBound implements MySQLRangeCut.
func (AboveAll) TypeAsUpperBound() MySQLRangeBoundType {
	return Open
}

// Below represents the position immediately below the contained key.
type Below struct {
	Key interface{}
}

var _ MySQLRangeCut = Below{}

// Compare implements MySQLRangeCut.
func (b Below) Compare(c MySQLRangeCut, typ Type) (int, error) {
	//TODO: Add context parameter to MySQLRangeCut.Compare
	ctx := context.Background()
	switch c := c.(type) {
	case AboveAll:
		return -1, nil
	case AboveNull:
		return 1, nil
	case Below:
		return typ.Compare(ctx, b.Key, c.Key)
	case Above:
		cmp, err := typ.Compare(ctx, c.Key, b.Key)
		if err != nil {
			return 0, err
		}
		if cmp == -1 {
			return 1, nil
		}
		return -1, nil
	case BelowNull:
		return 1, nil
	default:
		panic(fmt.Errorf("unrecognized MySQLRangeCut type '%T'", c))
	}
}

// String implements MySQLRangeCut.
func (b Below) String() string {
	return fmt.Sprintf("Below[%v]", b.Key)
}

// TypeAsLowerBound implements MySQLRangeCut.
func (Below) TypeAsLowerBound() MySQLRangeBoundType {
	return Closed
}

// TypeAsUpperBound implements MySQLRangeCut.
func (Below) TypeAsUpperBound() MySQLRangeBoundType {
	return Open
}

// AboveNull represents the position just above NULL, lower than every possible value in the domain.
type AboveNull struct{}

var _ MySQLRangeCut = AboveNull{}

// Compare implements MySQLRangeCut.
func (AboveNull) Compare(c MySQLRangeCut, typ Type) (int, error) {
	if _, ok := c.(AboveNull); ok {
		return 0, nil
	}
	if _, ok := c.(BelowNull); ok {
		return 1, nil
	}
	return -1, nil
}

// String implements MySQLRangeCut.
func (AboveNull) String() string {
	return "AboveNull"
}

// TypeAsLowerBound implements MySQLRangeCut.
func (AboveNull) TypeAsLowerBound() MySQLRangeBoundType {
	return Open
}

// TypeAsUpperBound implements MySQLRangeCut.
func (AboveNull) TypeAsUpperBound() MySQLRangeBoundType {
	return Closed
}

// BelowNull represents the position below NULL, which sorts before |AboveNull|
// and every non-NULL value in the domain.
type BelowNull struct{}

var _ MySQLRangeCut = BelowNull{}

// Compare implements MySQLRangeCut.
func (BelowNull) Compare(c MySQLRangeCut, typ Type) (int, error) {
	// BelowNull overlaps with itself
	if _, ok := c.(BelowNull); ok {
		return 0, nil
	}
	return -1, nil
}

// String implements MySQLRangeCut.
func (BelowNull) String() string {
	return "BelowNull"
}

// TypeAsLowerBound implements MySQLRangeCut.
func (BelowNull) TypeAsLowerBound() MySQLRangeBoundType {
	return Closed
}

// TypeAsUpperBound implements MySQLRangeCut.
func (BelowNull) TypeAsUpperBound() MySQLRangeBoundType {
	return Open
}
