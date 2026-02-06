// Copyright 2024 Dolthub, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//	http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package vector

import (
	"fmt"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// StringToVector converts a JSON string representation to a vector
type StringToVector struct {
	expression.UnaryExpression
}

var _ sql.Expression = (*StringToVector)(nil)
var _ sql.FunctionExpression = (*StringToVector)(nil)
var _ sql.CollationCoercible = (*StringToVector)(nil)

func NewStringToVector(e sql.Expression) sql.Expression {
	return &StringToVector{UnaryExpression: expression.UnaryExpression{Child: e}}
}

func (s *StringToVector) FunctionName() string {
	return "string_to_vector"
}

func (s *StringToVector) Description() string {
	return "converts a JSON array string to a vector"
}

func (s *StringToVector) Type() sql.Type {
	return types.VectorType{}
}

func (s *StringToVector) CollationCoercibility(_ *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

func (s *StringToVector) String() string {
	return fmt.Sprintf("STRING_TO_VECTOR(%s)", s.Child)
}

func (s *StringToVector) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(s, len(children), 1)
	}
	return NewStringToVector(children[0]), nil
}

func (s *StringToVector) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	val, err := s.Child.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	if val == nil {
		return nil, nil
	}

	// TODO: Instead of using the JSON parser and then encoding, it would be more efficient to parse and encode
	// in a single step
	floats, err := sql.ConvertToVector(ctx, val)
	if err != nil {
		return nil, err
	}
	return sql.EncodeVector(floats), nil
}

// VectorToString converts a vector to a JSON string representation
type VectorToString struct {
	expression.UnaryExpression
}

var _ sql.Expression = (*VectorToString)(nil)
var _ sql.FunctionExpression = (*VectorToString)(nil)
var _ sql.CollationCoercible = (*VectorToString)(nil)

func NewVectorToString(e sql.Expression) sql.Expression {
	return &VectorToString{UnaryExpression: expression.UnaryExpression{Child: e}}
}

func (v *VectorToString) FunctionName() string {
	return "vector_to_string"
}

func (v *VectorToString) Description() string {
	return "converts a vector to a JSON array string"
}

func (v *VectorToString) Type() sql.Type {
	return types.LongText
}

func (v *VectorToString) CollationCoercibility(_ *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

func (v *VectorToString) String() string {
	return fmt.Sprintf("VECTOR_TO_STRING(%s)", v.Child)
}

func (v *VectorToString) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(v, len(children), 1)
	}
	return NewVectorToString(children[0]), nil
}

func (v *VectorToString) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	val, err := v.Child.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	if val == nil {
		return nil, nil
	}
	b, ok, err := sql.Unwrap[[]byte](ctx, val)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, fmt.Errorf("incorrect argument to VECTOR_TO_STRING: expected a vector, got %T", val)
	}
	vectorVal, err := sql.DecodeVector(b)
	if err != nil {
		return nil, err
	}
	return types.JSONDocument{Val: vectorVal}.JSONString()
}
