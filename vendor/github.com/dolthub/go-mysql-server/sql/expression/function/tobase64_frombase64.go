// Copyright 2020-2021 Dolthub, Inc.
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
	"encoding/base64"
	"fmt"
	"reflect"
	"strings"

	"github.com/dolthub/go-mysql-server/sql/encodings"
	"github.com/dolthub/go-mysql-server/sql/types"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
)

// ToBase64 is a function to encode a string to the Base64 format
// using the same dialect that MySQL's TO_BASE64 uses
type ToBase64 struct {
	expression.UnaryExpression
}

var _ sql.FunctionExpression = (*ToBase64)(nil)
var _ sql.CollationCoercible = (*ToBase64)(nil)

// NewToBase64 creates a new ToBase64 expression.
func NewToBase64(e sql.Expression) sql.Expression {
	return &ToBase64{expression.UnaryExpression{Child: e}}
}

// FunctionName implements sql.FunctionExpression
func (t *ToBase64) FunctionName() string {
	return "to_base64"
}

// Description implements sql.FunctionExpression
func (t *ToBase64) Description() string {
	return "encodes the string str in base64 format."
}

// Eval implements the Expression interface.
func (t *ToBase64) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	val, err := t.Child.Eval(ctx, row)

	if err != nil {
		return nil, err
	}

	if val == nil {
		return nil, nil
	}

	var strBytes []byte
	if types.IsTextOnly(t.Child.Type()) {
		val, _, err = t.Child.Type().Convert(ctx, val)
		if err != nil {
			return nil, sql.ErrInvalidType.New(reflect.TypeOf(val))
		}
		// For string types we need to re-encode the internal string so that we get the correct base64 output
		encoder := t.Child.Type().(sql.StringType).Collation().CharacterSet().Encoder()
		encodedBytes, ok := encoder.Encode(encodings.StringToBytes(val.(string)))
		if !ok {
			return nil, fmt.Errorf("unable to re-encode string for TO_BASE64 function")
		}
		strBytes = encodedBytes
	} else {
		val, _, err = types.LongBlob.Convert(ctx, val)
		if err != nil {
			return nil, sql.ErrInvalidType.New(reflect.TypeOf(val))
		}
		strBytes = val.([]byte)
	}

	encoded := base64.StdEncoding.EncodeToString(strBytes)

	lenEncoded := len(encoded)
	if lenEncoded <= 76 {
		return encoded, nil
	}

	// Split into max 76 chars lines
	var out strings.Builder
	start := 0
	end := 76
	for {
		out.WriteString(encoded[start:end] + "\n")
		start += 76
		end += 76
		if end >= lenEncoded {
			out.WriteString(encoded[start:lenEncoded])
			break
		}
	}

	return out.String(), nil
}

// String implements the fmt.Stringer interface.
func (t *ToBase64) String() string {
	return fmt.Sprintf("%s(%s)", t.FunctionName(), t.Child)
}

// IsNullable implements the Expression interface.
func (t *ToBase64) IsNullable() bool {
	return t.Child.IsNullable()
}

// WithChildren implements the Expression interface.
func (t *ToBase64) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(t, len(children), 1)
	}
	return NewToBase64(children[0]), nil
}

// Type implements the Expression interface.
func (t *ToBase64) Type() sql.Type {
	return types.LongText
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*ToBase64) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return ctx.GetCollation(), 4
}

// FromBase64 is a function to decode a Base64-formatted string
// using the same dialect that MySQL's FROM_BASE64 uses
type FromBase64 struct {
	expression.UnaryExpression
}

var _ sql.FunctionExpression = (*FromBase64)(nil)
var _ sql.CollationCoercible = (*FromBase64)(nil)

// NewFromBase64 creates a new FromBase64 expression.
func NewFromBase64(e sql.Expression) sql.Expression {
	return &FromBase64{expression.UnaryExpression{Child: e}}
}

// FunctionName implements sql.FunctionExpression
func (t *FromBase64) FunctionName() string {
	return "from_base64"
}

// Description implements sql.FunctionExpression
func (t *FromBase64) Description() string {
	return "decodes the base64-encoded string str."
}

// Eval implements the Expression interface.
func (t *FromBase64) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	str, err := t.Child.Eval(ctx, row)

	if err != nil {
		return nil, err
	}

	if str == nil {
		return nil, nil
	}

	str, _, err = types.LongText.Convert(ctx, str)
	if err != nil {
		return nil, sql.ErrInvalidType.New(reflect.TypeOf(str))
	}

	decoded, err := base64.StdEncoding.DecodeString(str.(string))
	if err != nil {
		return nil, err
	}

	return decoded, nil
}

// String implements the fmt.Stringer interface.
func (t *FromBase64) String() string {
	return fmt.Sprintf("%s(%s)", t.FunctionName(), t.Child)
}

// IsNullable implements the Expression interface.
func (t *FromBase64) IsNullable() bool {
	return t.Child.IsNullable()
}

// WithChildren implements the Expression interface.
func (t *FromBase64) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(t, len(children), 1)
	}
	return NewFromBase64(children[0]), nil
}

// Type implements the Expression interface.
func (t *FromBase64) Type() sql.Type {
	return types.LongBlob
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*FromBase64) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 4
}
