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

package expression

import (
	"fmt"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/encodings"
)

// ConvertUsing represents a CONVERT(X USING T) operation that casts the expression X to the character set T.
type ConvertUsing struct {
	UnaryExpression
	TargetCharSet sql.CharacterSetID
}

var _ sql.Expression = (*ConvertUsing)(nil)
var _ sql.CollationCoercible = (*ConvertUsing)(nil)

func NewConvertUsing(expr sql.Expression, targetCharSet sql.CharacterSetID) *ConvertUsing {
	return &ConvertUsing{
		UnaryExpression: UnaryExpression{Child: expr},
		TargetCharSet:   targetCharSet,
	}
}

// String implements the interface sql.Expression.
func (c *ConvertUsing) String() string {
	return fmt.Sprintf("CONVERT(%s USING %s)", c.Child.String(), c.TargetCharSet.Name())
}

// Type implements the interface sql.Expression.
func (c *ConvertUsing) Type() sql.Type {
	typ := c.Child.Type()
	if collatedType, ok := typ.(sql.TypeWithCollation); ok {
		newTyp, _ := collatedType.WithNewCollation(c.TargetCharSet.DefaultCollation())
		return newTyp
	}
	return typ
}

// Eval implements the interface sql.Expression.
func (c *ConvertUsing) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	val, err := c.Child.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	if val == nil {
		return nil, nil
	}

	var valBytes []byte
	if v, ok := val.([]byte); ok {
		valBytes = v
	} else if v, ok := val.(string); ok {
		valBytes = encodings.StringToBytes(v)
	}
	newString := c.TargetCharSet.Encoder().EncodeReplaceUnknown(valBytes)
	return encodings.BytesToString(newString), nil
}

// WithChildren implements the interface sql.Expression.
func (c *ConvertUsing) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(c, len(children), 1)
	}
	return NewConvertUsing(children[0], c.TargetCharSet), nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (c *ConvertUsing) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return c.TargetCharSet.DefaultCollation(), 2
}
