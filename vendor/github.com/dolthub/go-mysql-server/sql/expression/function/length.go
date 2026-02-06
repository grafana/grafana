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
	"fmt"
	"unicode/utf8"

	"github.com/dolthub/go-mysql-server/sql/encodings"
	"github.com/dolthub/go-mysql-server/sql/types"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
)

// Length returns the length of a string or binary content, either in bytes
// or characters.
type Length struct {
	expression.UnaryExpression
	CountType CountType
}

var _ sql.FunctionExpression = (*Length)(nil)
var _ sql.CollationCoercible = (*Length)(nil)

// CountType is the kind of length count.
type CountType bool

const (
	// NumBytes counts the number of bytes in a string or binary content.
	NumBytes = CountType(false)
	// NumChars counts the number of characters in a string or binary content.
	NumChars = CountType(true)
)

// NewLength returns a new LENGTH function.
func NewLength(e sql.Expression) sql.Expression {
	return &Length{expression.UnaryExpression{Child: e}, NumBytes}
}

// NewCharLength returns a new CHAR_LENGTH function.
func NewCharLength(e sql.Expression) sql.Expression {
	return &Length{expression.UnaryExpression{Child: e}, NumChars}
}

// FunctionName implements sql.FunctionExpression
func (l *Length) FunctionName() string {
	if l.CountType == NumChars {
		return "character_length"
	} else if l.CountType == NumBytes {
		return "length"
	} else {
		panic("unknown name for length count type")
	}
}

// Description implements sql.FunctionExpression
func (l *Length) Description() string {
	if l.CountType == NumChars {
		return "returns the length of the string in characters."
	} else if l.CountType == NumBytes {
		return "returns the length of the string in bytes."
	} else {
		panic("unknown description for length count type")
	}
}

// WithChildren implements the Expression interface.
func (l *Length) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(l, len(children), 1)
	}

	return &Length{expression.UnaryExpression{Child: children[0]}, l.CountType}, nil
}

// Type implements the sql.Expression interface.
func (l *Length) Type() sql.Type { return types.Int32 }

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Length) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

func (l *Length) String() string {
	if l.CountType == NumBytes {
		return fmt.Sprintf("length(%s)", l.Child)
	}
	return fmt.Sprintf("char_length(%s)", l.Child)
}

func (l *Length) DebugString() string {
	if l.CountType == NumBytes {
		return fmt.Sprintf("length(%s)", sql.DebugString(l.Child))
	}
	return fmt.Sprintf("char_length(%s)", sql.DebugString(l.Child))
}

// Eval implements the sql.Expression interface.
func (l *Length) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	val, err := l.Child.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	if val == nil {
		return nil, nil
	}

	if wrapper, isWrapper := val.(sql.AnyWrapper); isWrapper && wrapper.IsExactLength() {
		return int32(wrapper.MaxByteLength()), nil
	}

	content, collation, err := types.ConvertToCollatedString(ctx, val, l.Child.Type())
	if err != nil {
		return nil, err
	}
	charSetEncoder := collation.CharacterSet().Encoder()
	if l.CountType == NumBytes {
		encodedContent, ok := charSetEncoder.Encode(encodings.StringToBytes(content))
		if !ok {
			return nil, fmt.Errorf("unable to re-encode string for LENGTH function")
		}
		return int32(len(encodedContent)), nil
	} else {
		contentLen := int32(0)
		for len(content) > 0 {
			cr, cRead := charSetEncoder.NextRune(content)
			if cRead == 0 || cr == utf8.RuneError {
				return 0, sql.ErrCollationMalformedString.New("checking length")
			}
			content = content[cRead:]
			contentLen++
		}
		return contentLen, nil
	}
}
