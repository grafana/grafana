// Copyright 2025 Dolthub, Inc.
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
	"sync"

	"github.com/dolthub/go-mysql-server/internal/regex"
	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// RegexpSubstr implements the REGEXP_SUBSTR function.
// https://dev.mysql.com/doc/refman/8.0/en/regexp.html#function_regexp-substr
type RegexpSubstr struct {
	Text        sql.Expression
	Pattern     sql.Expression
	Position    sql.Expression
	Occurrence  sql.Expression
	Flags       sql.Expression
	cachedVal   any
	re          regex.Regex
	compileErr  error
	compileOnce sync.Once
	cacheVal    bool
	cacheRegex  bool
}

var _ sql.FunctionExpression = (*RegexpSubstr)(nil)
var _ sql.CollationCoercible = (*RegexpSubstr)(nil)
var _ sql.Disposable = (*RegexpSubstr)(nil)

// NewRegexpSubstr creates a new RegexpSubstr expression.
func NewRegexpSubstr(args ...sql.Expression) (sql.Expression, error) {
	var r *RegexpSubstr
	switch len(args) {
	case 5:
		r = &RegexpSubstr{
			Text:       args[0],
			Pattern:    args[1],
			Position:   args[2],
			Occurrence: args[3],
			Flags:      args[4],
		}
	case 4:
		r = &RegexpSubstr{
			Text:       args[0],
			Pattern:    args[1],
			Position:   args[2],
			Occurrence: args[3],
		}
	case 3:
		r = &RegexpSubstr{
			Text:       args[0],
			Pattern:    args[1],
			Position:   args[2],
			Occurrence: expression.NewLiteral(1, types.Int32),
		}
	case 2:
		r = &RegexpSubstr{
			Text:       args[0],
			Pattern:    args[1],
			Position:   expression.NewLiteral(1, types.Int32),
			Occurrence: expression.NewLiteral(1, types.Int32),
		}
	default:
		return nil, sql.ErrInvalidArgumentNumber.New("regexp_substr", "2 to 5", len(args))
	}
	return r, nil
}

// FunctionName implements sql.FunctionExpression
func (r *RegexpSubstr) FunctionName() string {
	return "regexp_substr"
}

// Description implements sql.FunctionExpression
func (r *RegexpSubstr) Description() string {
	return "returns the matching substring."
}

// Type implements the sql.Expression interface.
func (r *RegexpSubstr) Type() sql.Type { return types.LongText }

// CollationCoercibility implements the interface sql.CollationCoercible.
func (r *RegexpSubstr) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	leftCollation, leftCoercibility := sql.GetCoercibility(ctx, r.Text)
	rightCollation, rightCoercibility := sql.GetCoercibility(ctx, r.Pattern)
	return sql.ResolveCoercibility(leftCollation, leftCoercibility, rightCollation, rightCoercibility)
}

// IsNullable implements the sql.Expression interface.
func (r *RegexpSubstr) IsNullable() bool { return true }

// Children implements the sql.Expression interface.
func (r *RegexpSubstr) Children() []sql.Expression {
	var result = []sql.Expression{r.Text, r.Pattern, r.Position, r.Occurrence}
	if r.Flags != nil {
		result = append(result, r.Flags)
	}
	return result
}

// Resolved implements the sql.Expression interface.
func (r *RegexpSubstr) Resolved() bool {
	return r.Text.Resolved() && r.Pattern.Resolved() && r.Position.Resolved() && r.Occurrence.Resolved() &&
		(r.Flags == nil || r.Flags.Resolved())
}

// WithChildren implements the sql.Expression interface.
func (r *RegexpSubstr) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	required := 4
	if r.Flags != nil {
		required = 5
	}
	if len(children) != required {
		return nil, sql.ErrInvalidChildrenNumber.New(r, len(children), required)
	}

	// Copy over the regex instance, in case it has already been set to avoid leaking it.
	substr, err := NewRegexpSubstr(children...)
	if r.re != nil && substr != nil {
		substr.(*RegexpSubstr).re = r.re
	}
	return substr, err
}

// String implements the sql.Expression interface.
func (r *RegexpSubstr) String() string {
	var args []string
	for _, e := range r.Children() {
		args = append(args, e.String())
	}
	return fmt.Sprintf("%s(%s)", r.FunctionName(), strings.Join(args, ","))
}

// compile handles compilation of the regex.
func (r *RegexpSubstr) compile(ctx *sql.Context, row sql.Row) {
	r.compileOnce.Do(func() {
		r.cacheRegex = canBeCached(r.Pattern, r.Flags)
		r.cacheVal = r.cacheRegex && canBeCached(r.Text, r.Position, r.Occurrence)
		if r.cacheRegex {
			r.re, r.compileErr = compileRegex(ctx, r.Pattern, r.Text, r.Flags, r.FunctionName(), row)
		}
	})
	if !r.cacheRegex {
		if r.re != nil {
			if r.compileErr = r.re.Close(); r.compileErr != nil {
				return
			}
		}
		r.re, r.compileErr = compileRegex(ctx, r.Pattern, r.Text, r.Flags, r.FunctionName(), row)
	}
}

// Eval implements the sql.Expression interface.
func (r *RegexpSubstr) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	span, ctx := ctx.Span("function.RegexpSubstr")
	defer span.End()

	if r.cachedVal != nil {
		return r.cachedVal, nil
	}

	r.compile(ctx, row)
	if r.compileErr != nil {
		return nil, r.compileErr
	}
	if r.re == nil {
		return nil, nil
	}

	text, err := r.Text.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	if text == nil {
		return nil, nil
	}
	text, _, err = types.LongText.Convert(ctx, text)
	if err != nil {
		return nil, err
	}

	pos, err := r.Position.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	if pos == nil {
		return nil, nil
	}
	pos, _, err = types.Int32.Convert(ctx, pos)
	if err != nil {
		return nil, err
	}

	occurrence, err := r.Occurrence.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	if occurrence == nil {
		return nil, nil
	}
	occurrence, _, err = types.Int32.Convert(ctx, occurrence)
	if err != nil {
		return nil, err
	}

	err = r.re.SetMatchString(ctx, text.(string))
	if err != nil {
		return nil, err
	}
	substring, ok, err := r.re.Substring(ctx, int(pos.(int32)), int(occurrence.(int32)))
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, nil
	}

	if r.cacheVal {
		r.cachedVal = substring
	}
	return substring, nil
}

// Dispose implements the sql.Disposable interface.
func (r *RegexpSubstr) Dispose() {
	if r.re != nil {
		_ = r.re.Close()
	}
}
