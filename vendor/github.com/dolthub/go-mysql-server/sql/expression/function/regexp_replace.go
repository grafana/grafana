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

package function

import (
	"fmt"
	"strings"
	"sync"

	"gopkg.in/src-d/go-errors.v1"

	"github.com/dolthub/go-mysql-server/internal/regex"
	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// RegexpReplace implements the REGEXP_REPLACE function.
// https://dev.mysql.com/doc/refman/8.0/en/regexp.html#function_regexp-replace
type RegexpReplace struct {
	Text        sql.Expression
	Pattern     sql.Expression
	RText       sql.Expression
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

var _ sql.FunctionExpression = (*RegexpReplace)(nil)
var _ sql.CollationCoercible = (*RegexpReplace)(nil)
var _ sql.Disposable = (*RegexpReplace)(nil)

// NewRegexpReplace creates a new RegexpReplace expression.
func NewRegexpReplace(args ...sql.Expression) (sql.Expression, error) {
	var r *RegexpReplace
	switch len(args) {
	case 6:
		r = &RegexpReplace{
			Text:       args[0],
			Pattern:    args[1],
			RText:      args[2],
			Position:   args[3],
			Occurrence: args[4],
			Flags:      args[5],
		}
	case 5:
		r = &RegexpReplace{
			Text:       args[0],
			Pattern:    args[1],
			RText:      args[2],
			Position:   args[3],
			Occurrence: args[4],
		}
	case 4:
		r = &RegexpReplace{
			Text:       args[0],
			Pattern:    args[1],
			RText:      args[2],
			Position:   args[3],
			Occurrence: expression.NewLiteral(0, types.Int32),
		}
	case 3:
		r = &RegexpReplace{
			Text:       args[0],
			Pattern:    args[1],
			RText:      args[2],
			Position:   expression.NewLiteral(1, types.Int32),
			Occurrence: expression.NewLiteral(0, types.Int32),
		}
	default:
		return nil, sql.ErrInvalidArgumentNumber.New("regexp_replace", "3,4,5 or 6", len(args))
	}
	return r, nil
}

// FunctionName implements sql.FunctionExpression
func (r *RegexpReplace) FunctionName() string {
	return "regexp_replace"
}

// Description implements sql.FunctionExpression
func (r *RegexpReplace) Description() string {
	return "replaces substrings matching regular expression."
}

// Type implements the sql.Expression interface.
func (r *RegexpReplace) Type() sql.Type { return types.LongText }

// CollationCoercibility implements the interface sql.CollationCoercible.
func (r *RegexpReplace) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	collation, coercibility = sql.GetCoercibility(ctx, r.Text)
	nextCollation, nextCoercibility := sql.GetCoercibility(ctx, r.Pattern)
	collation, coercibility = sql.ResolveCoercibility(collation, coercibility, nextCollation, nextCoercibility)
	nextCollation, nextCoercibility = sql.GetCoercibility(ctx, r.RText)
	collation, coercibility = sql.ResolveCoercibility(collation, coercibility, nextCollation, nextCoercibility)
	return collation, coercibility
}

// IsNullable implements the sql.Expression interface.
func (r *RegexpReplace) IsNullable() bool { return true }

// Children implements the sql.Expression interface.
func (r *RegexpReplace) Children() []sql.Expression {
	var children = []sql.Expression{r.Text, r.Pattern, r.RText, r.Position, r.Occurrence}
	if r.Flags != nil {
		children = append(children, r.Flags)
	}
	return children
}

// Resolved implements the sql.Expression interface.
func (r *RegexpReplace) Resolved() bool {
	return r.Text.Resolved() &&
		r.Pattern.Resolved() &&
		r.RText.Resolved() &&
		r.Position.Resolved() &&
		r.Occurrence.Resolved() &&
		(r.Flags == nil || r.Flags.Resolved())
}

// WithChildren implements the sql.Expression interface.
func (r *RegexpReplace) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	required := 5
	if r.Flags != nil {
		required = 6
	}
	if len(children) != required {
		return nil, sql.ErrInvalidChildrenNumber.New(r, len(children), required)
	}

	// Copy over the regex instance, in case it has already been set to avoid leaking it.
	replace, err := NewRegexpReplace(children...)
	if err != nil {
		if r.re != nil {
			if err = r.re.Close(); err != nil {
				return nil, err
			}
		}
		return nil, err
	}
	if r.re != nil {
		replace.(*RegexpReplace).re = r.re
	}
	return replace, nil
}

func (r *RegexpReplace) String() string {
	var args []string
	for _, e := range r.Children() {
		args = append(args, e.String())
	}
	return fmt.Sprintf("%s(%s)", r.FunctionName(), strings.Join(args, ","))
}

func (r *RegexpReplace) compile(ctx *sql.Context, row sql.Row) {
	r.compileOnce.Do(func() {
		r.cacheRegex = canBeCached(r.Pattern, r.Flags)
		r.cacheVal = r.cacheRegex && canBeCached(r.Text, r.RText, r.Position, r.Occurrence)
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
func (r *RegexpReplace) Eval(ctx *sql.Context, row sql.Row) (val interface{}, err error) {
	span, ctx := ctx.Span("function.RegexpReplace")
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

	rText, err := r.RText.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	if rText == nil {
		return nil, nil
	}
	rText, _, err = types.LongText.Convert(ctx, rText)
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
	if pos.(int32) <= 0 {
		return nil, sql.ErrInvalidArgumentDetails.New(r.FunctionName(), fmt.Sprintf("%d", pos.(int32)))
	}

	if len(text.(string)) != 0 && int(pos.(int32)) > len(text.(string)) {
		return nil, errors.NewKind("Index out of bounds for regular expression search.").New()
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

	result, err := r.re.Replace(ctx, rText.(string), int(pos.(int32)), int(occurrence.(int32)))
	if err != nil {
		return nil, err
	}

	return result, nil
}

// Dispose implements the sql.Disposable interface.
func (r *RegexpReplace) Dispose() {
	if r.re != nil {
		_ = r.re.Close()
	}
}
