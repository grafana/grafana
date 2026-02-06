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

// RegexpInstr implements the REGEXP_INSTR function.
// https://dev.mysql.com/doc/refman/8.0/en/regexp.html#function_regexp-instr
type RegexpInstr struct {
	Text         sql.Expression
	Pattern      sql.Expression
	Position     sql.Expression
	Occurrence   sql.Expression
	ReturnOption sql.Expression
	Flags        sql.Expression
	cachedVal    any
	re           regex.Regex
	compileErr   error
	compileOnce  sync.Once
	cacheRegex   bool
	cacheVal     bool
}

var _ sql.FunctionExpression = (*RegexpInstr)(nil)
var _ sql.CollationCoercible = (*RegexpInstr)(nil)
var _ sql.Disposable = (*RegexpInstr)(nil)

// NewRegexpInstr creates a new RegexpInstr expression.
func NewRegexpInstr(args ...sql.Expression) (sql.Expression, error) {
	var r *RegexpInstr
	switch len(args) {
	case 6:
		r = &RegexpInstr{
			Text:         args[0],
			Pattern:      args[1],
			Position:     args[2],
			Occurrence:   args[3],
			ReturnOption: args[4],
			Flags:        args[5],
		}
	case 5:
		r = &RegexpInstr{
			Text:         args[0],
			Pattern:      args[1],
			Position:     args[2],
			Occurrence:   args[3],
			ReturnOption: args[4],
		}
	case 4:
		r = &RegexpInstr{
			Text:         args[0],
			Pattern:      args[1],
			Position:     args[2],
			Occurrence:   args[3],
			ReturnOption: expression.NewLiteral(0, types.Int32),
		}
	case 3:
		r = &RegexpInstr{
			Text:         args[0],
			Pattern:      args[1],
			Position:     args[2],
			Occurrence:   expression.NewLiteral(1, types.Int32),
			ReturnOption: expression.NewLiteral(0, types.Int32),
		}
	case 2:
		r = &RegexpInstr{
			Text:         args[0],
			Pattern:      args[1],
			Position:     expression.NewLiteral(1, types.Int32),
			Occurrence:   expression.NewLiteral(1, types.Int32),
			ReturnOption: expression.NewLiteral(0, types.Int32),
		}
	default:
		return nil, sql.ErrInvalidArgumentNumber.New("regexp_instr", "2 to 6", len(args))
	}
	return r, nil
}

// FunctionName implements sql.FunctionExpression
func (r *RegexpInstr) FunctionName() string {
	return "regexp_instr"
}

// Description implements sql.FunctionExpression
func (r *RegexpInstr) Description() string {
	return "returns the starting index of the substring."
}

// Type implements the sql.Expression interface.
func (r *RegexpInstr) Type() sql.Type { return types.Int32 }

// CollationCoercibility implements the interface sql.CollationCoercible.
func (r *RegexpInstr) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	leftCollation, leftCoercibility := sql.GetCoercibility(ctx, r.Text)
	rightCollation, rightCoercibility := sql.GetCoercibility(ctx, r.Pattern)
	return sql.ResolveCoercibility(leftCollation, leftCoercibility, rightCollation, rightCoercibility)
}

// IsNullable implements the sql.Expression interface.
func (r *RegexpInstr) IsNullable() bool { return true }

// Children implements the sql.Expression interface.
func (r *RegexpInstr) Children() []sql.Expression {
	var result = []sql.Expression{r.Text, r.Pattern, r.Position, r.Occurrence, r.ReturnOption}
	if r.Flags != nil {
		result = append(result, r.Flags)
	}
	return result
}

// Resolved implements the sql.Expression interface.
func (r *RegexpInstr) Resolved() bool {
	return r.Text.Resolved() && r.Pattern.Resolved() && r.Position.Resolved() && r.Occurrence.Resolved() &&
		r.ReturnOption.Resolved() && (r.Flags == nil || r.Flags.Resolved())
}

// WithChildren implements the sql.Expression interface.
func (r *RegexpInstr) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	required := 5
	if r.Flags != nil {
		required = 6
	}
	if len(children) != required {
		return nil, sql.ErrInvalidChildrenNumber.New(r, len(children), required)
	}

	// Copy over the regex instance, in case it has already been set to avoid leaking it.
	instr, err := NewRegexpInstr(children...)
	if r.re != nil && instr != nil {
		instr.(*RegexpInstr).re = r.re
	}
	return instr, err
}

// String implements the sql.Expression interface.
func (r *RegexpInstr) String() string {
	var args []string
	for _, e := range r.Children() {
		args = append(args, e.String())
	}
	return fmt.Sprintf("%s(%s)", r.FunctionName(), strings.Join(args, ","))
}

// compile handles compilation of the regex.
func (r *RegexpInstr) compile(ctx *sql.Context, row sql.Row) {
	r.compileOnce.Do(func() {
		r.cacheRegex = canBeCached(r.Pattern, r.Flags)
		r.cacheVal = r.cacheRegex && canBeCached(r.Text, r.Position, r.Occurrence, r.ReturnOption)
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
func (r *RegexpInstr) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	span, ctx := ctx.Span("function.RegexpInstr")
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

	returnOption, err := r.ReturnOption.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	if returnOption == nil {
		return nil, nil
	}
	returnOption, _, err = types.Int32.Convert(ctx, returnOption)
	if err != nil {
		return nil, err
	}

	err = r.re.SetMatchString(ctx, text.(string))
	if err != nil {
		return nil, err
	}
	index, err := r.re.IndexOf(ctx, int(pos.(int32)), int(occurrence.(int32)), returnOption.(int32) == 1)
	if err != nil {
		return nil, err
	}

	outVal := int32(index)
	if r.cacheVal {
		r.cachedVal = outVal
	}
	return outVal, nil
}

// Dispose implements the sql.Disposable interface.
func (r *RegexpInstr) Dispose() {
	if r.re != nil {
		_ = r.re.Close()
	}
}
