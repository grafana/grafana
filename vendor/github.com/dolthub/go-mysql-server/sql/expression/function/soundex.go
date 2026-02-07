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
	"strings"
	"unicode"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// Soundex is a function that returns the soundex of a string. Two strings that
// sound almost the same should have identical soundex strings. A standard
// soundex string is four characters long, but the SOUNDEX() function returns
// an arbitrarily long string.
type Soundex struct {
	expression.UnaryExpression
}

var _ sql.FunctionExpression = (*Soundex)(nil)
var _ sql.CollationCoercible = (*Soundex)(nil)

// NewSoundex creates a new Soundex expression.
func NewSoundex(e sql.Expression) sql.Expression {
	return &Soundex{expression.UnaryExpression{Child: e}}
}

// FunctionName implements sql.FunctionExpression
func (s *Soundex) FunctionName() string {
	return "soundex"
}

// Description implements sql.FunctionExpression
func (s *Soundex) Description() string {
	return "returns the soundex of a string."
}

// Eval implements the Expression interface.
func (s *Soundex) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	v, err := s.Child.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	if v == nil {
		return nil, nil
	}

	v, _, err = types.LongText.Convert(ctx, v)
	if err != nil {
		return nil, err
	}

	// Handle Dolt's TextStorage wrapper that doesn't convert to plain string
	v, err = sql.UnwrapAny(ctx, v)
	if err != nil {
		return nil, err
	}

	var b strings.Builder
	var last rune
	for _, c := range strings.ToUpper(v.(string)) {
		if last == 0 && !unicode.IsLetter(c) {
			continue
		}
		code := s.code(c)
		if last == 0 {
			b.WriteRune(c)
			last = code
			continue
		}
		if code == '0' || code == last {
			continue
		}
		b.WriteRune(code)
		last = code
	}
	if b.Len() == 0 {
		return "0000", nil
	}
	for i := len([]rune(b.String())); i < 4; i++ {
		b.WriteRune('0')
	}
	return b.String(), nil
}

func (s *Soundex) code(c rune) rune {
	switch c {
	case 'B', 'F', 'P', 'V':
		return '1'
	case 'C', 'G', 'J', 'K', 'Q', 'S', 'X', 'Z':
		return '2'
	case 'D', 'T':
		return '3'
	case 'L':
		return '4'
	case 'M', 'N':
		return '5'
	case 'R':
		return '6'
	}
	return '0'
}

func (s *Soundex) String() string {
	return fmt.Sprintf("%s(%s)", s.FunctionName(), s.Child)
}

// WithChildren implements the Expression interface.
func (s *Soundex) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(s, len(children), 1)
	}
	return NewSoundex(children[0]), nil
}

// Type implements the Expression interface.
func (s *Soundex) Type() sql.Type {
	return types.LongText
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Soundex) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return ctx.GetCollation(), 4
}
