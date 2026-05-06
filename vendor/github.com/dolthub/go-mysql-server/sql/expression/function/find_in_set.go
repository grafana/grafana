// Copyright 2023 Dolthub, Inc.
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

package function

import (
	"fmt"
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// FindInSet takes out the specified unit(s) from the time expression.
type FindInSet struct {
	expression.BinaryExpressionStub
}

var _ sql.FunctionExpression = (*FindInSet)(nil)
var _ sql.CollationCoercible = (*FindInSet)(nil)

// NewFindInSet creates a new FindInSet expression.
func NewFindInSet(e1, e2 sql.Expression) sql.Expression {
	return &FindInSet{
		expression.BinaryExpressionStub{
			LeftChild:  e1,
			RightChild: e2,
		},
	}
}

// FunctionName implements sql.FunctionExpression
func (f *FindInSet) FunctionName() string {
	return "find_in_set"
}

// Description implements sql.FunctionExpression
func (f *FindInSet) Description() string {
	return "returns a value in the range of 1 to N if the string str is in the string list strlist consisting of N substrings"
}

// Type implements the Expression interface.
func (f *FindInSet) Type() sql.Type { return types.Int64 }

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*FindInSet) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return ctx.GetCollation(), 5
}

func (f *FindInSet) String() string {
	return fmt.Sprintf("%s(%s from %s)", f.FunctionName(), f.LeftChild, f.RightChild)
}

// WithChildren implements the Expression interface.
func (f *FindInSet) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 2 {
		return nil, sql.ErrInvalidChildrenNumber.New(f, len(children), 2)
	}
	return NewFindInSet(children[0], children[1]), nil
}

// Eval implements the Expression interface.
func (f *FindInSet) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	if f.LeftChild == nil || f.RightChild == nil {
		return nil, nil
	}

	left, err := f.LeftChild.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	right, err := f.RightChild.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	if left == nil || right == nil {
		return nil, nil
	}

	left, err = sql.UnwrapAny(ctx, left)
	if err != nil {
		return nil, err
	}
	lVal, _, err := types.LongText.Convert(ctx, left)
	if err != nil {
		return nil, err
	}
	l := lVal.(string)

	// always returns 0 when left contains a comma
	if strings.Contains(l, ",") {
		return 0, nil
	}

	var r string
	right, err = sql.UnwrapAny(ctx, right)
	if err != nil {
		return nil, err
	}
	rType := f.RightChild.Type()
	if setType, ok := rType.(types.SetType); ok {
		// TODO: set type should take advantage of bit arithmetic
		r, err = setType.BitsToString(right.(uint64))
		if err != nil {
			return nil, err
		}
	} else if enumType, ok := rType.(types.EnumType); ok {
		r, ok = enumType.At(int(right.(uint16)))
		if !ok {
			return nil, fmt.Errorf("enum missing index %v", r)
		}
	} else {
		var rVal interface{}
		rVal, _, err = types.LongText.Convert(ctx, right)
		if err != nil {
			return nil, err
		}
		r = rVal.(string)
	}

	leftColl, leftCoer := sql.GetCoercibility(ctx, f.LeftChild)
	rightColl, rightCoer := sql.GetCoercibility(ctx, f.RightChild)
	collPref, _ := sql.ResolveCoercibility(leftColl, leftCoer, rightColl, rightCoer)

	strType := types.CreateLongText(collPref)
	for i, r := range strings.Split(r, ",") {
		cmp, err := strType.Compare(ctx, l, r)
		if err != nil {
			return nil, err
		}
		if cmp == 0 {
			return i + 1, nil
		}
	}

	return 0, nil
}
