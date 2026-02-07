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

// RegexpLike implements the REGEXP_LIKE function.
// https://dev.mysql.com/doc/refman/8.0/en/regexp.html#function_regexp-like
type RegexpLike struct {
	Text        sql.Expression
	Pattern     sql.Expression
	Flags       sql.Expression
	cachedVal   any
	re          regex.Regex
	compileErr  error
	compileOnce sync.Once
	cacheVal    bool
	cacheRegex  bool
}

var _ sql.FunctionExpression = (*RegexpLike)(nil)
var _ sql.CollationCoercible = (*RegexpLike)(nil)
var _ sql.Disposable = (*RegexpLike)(nil)

// NewRegexpLike creates a new RegexpLike expression.
func NewRegexpLike(args ...sql.Expression) (sql.Expression, error) {
	var r *RegexpLike
	switch len(args) {
	case 3:
		r = &RegexpLike{
			Text:    args[0],
			Pattern: args[1],
			Flags:   args[2],
		}
	case 2:
		r = &RegexpLike{
			Text:    args[0],
			Pattern: args[1],
		}
	default:
		return nil, sql.ErrInvalidArgumentNumber.New("regexp_like", "2 or 3", len(args))
	}
	return r, nil
}

// FunctionName implements sql.FunctionExpression
func (r *RegexpLike) FunctionName() string {
	return "regexp_like"
}

// Description implements sql.FunctionExpression
func (r *RegexpLike) Description() string {
	return "returns whether string matches regular expression."
}

// Type implements the sql.Expression interface.
func (r *RegexpLike) Type() sql.Type {
	return types.Boolean
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (r *RegexpLike) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	leftCollation, leftCoercibility := sql.GetCoercibility(ctx, r.Text)
	rightCollation, rightCoercibility := sql.GetCoercibility(ctx, r.Pattern)
	return sql.ResolveCoercibility(leftCollation, leftCoercibility, rightCollation, rightCoercibility)
}

// IsNullable implements the sql.Expression interface.
func (r *RegexpLike) IsNullable() bool { return true }

// Children implements the sql.Expression interface.
func (r *RegexpLike) Children() []sql.Expression {
	var result = []sql.Expression{r.Text, r.Pattern}
	if r.Flags != nil {
		result = append(result, r.Flags)
	}
	return result
}

// Resolved implements the sql.Expression interface.
func (r *RegexpLike) Resolved() bool {
	return r.Text.Resolved() && r.Pattern.Resolved() && (r.Flags == nil || r.Flags.Resolved())
}

// WithChildren implements the sql.Expression interface.
func (r *RegexpLike) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	required := 2
	if r.Flags != nil {
		required = 3
	}
	if len(children) != required {
		return nil, sql.ErrInvalidChildrenNumber.New(r, len(children), required)
	}

	// Copy over the regex instance, in case it has already been set to avoid leaking it.
	like, err := NewRegexpLike(children...)
	if like != nil && r.re != nil {
		like.(*RegexpLike).re = r.re
	}

	return like, err
}

// String implements the sql.Expression interface.
func (r *RegexpLike) String() string {
	var args []string
	for _, e := range r.Children() {
		args = append(args, e.String())
	}
	return fmt.Sprintf("%s(%s)", r.FunctionName(), strings.Join(args, ","))
}

// compile handles compilation of the regex.
func (r *RegexpLike) compile(ctx *sql.Context, row sql.Row) {
	r.compileOnce.Do(func() {
		r.cacheRegex = canBeCached(r.Pattern, r.Flags)
		r.cacheVal = r.cacheRegex && canBeCached(r.Text)
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
func (r *RegexpLike) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	span, ctx := ctx.Span("function.RegexpLike")
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
	textStr, _, err := sql.Unwrap[string](ctx, text)
	if err != nil {
		return nil, err
	}

	err = r.re.SetMatchString(ctx, textStr)
	if err != nil {
		return nil, err
	}
	ok, err := r.re.Matches(ctx, 0, 0)
	if err != nil {
		return nil, err
	}
	var outVal int8
	if ok {
		outVal = int8(1)
	} else {
		outVal = int8(0)
	}

	if r.cacheVal {
		r.cachedVal = outVal
	}
	return outVal, nil
}

// Dispose implements the sql.Disposable interface.
func (r *RegexpLike) Dispose() {
	if r.re != nil {
		_ = r.re.Close()
	}
}

func compileRegex(ctx *sql.Context, pattern, text, flags sql.Expression, funcName string, row sql.Row) (regex.Regex, error) {
	patternVal, err := pattern.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	if patternVal == nil {
		return nil, nil
	}
	patternVal, _, err = types.LongText.Convert(ctx, patternVal)
	if err != nil {
		return nil, err
	}
	patternValStr, _, err := sql.Unwrap[string](ctx, patternVal)
	if err != nil {
		return nil, err
	}

	// Empty regex, throw illegal argument
	if len(patternValStr) == 0 {
		return nil, errors.NewKind("Illegal argument to regular expression.").New()
	}

	// It appears that MySQL ONLY uses the collation to determine case-sensitivity and character set. We don't need to
	// worry about the character set since we convert all strings to UTF-8 for internal consistency. At the time of
	// writing this comment, all case-insensitive collations end with "_ci", so we can just check for that.
	leftCollation, leftCoercibility := sql.GetCoercibility(ctx, text)
	rightCollation, rightCoercibility := sql.GetCoercibility(ctx, pattern)
	resolvedCollation, _ := sql.ResolveCoercibility(leftCollation, leftCoercibility, rightCollation, rightCoercibility)
	flagsStr := ""
	if strings.HasSuffix(resolvedCollation.String(), "_ci") {
		flagsStr = "i"
	}

	if flags != nil {
		f, err := flags.Eval(ctx, row)
		if err != nil {
			return nil, err
		}
		if f == nil {
			return nil, nil
		}
		f, _, err = types.LongText.Convert(ctx, f)
		if err != nil {
			return nil, err
		}

		flagsStr, _, err = sql.Unwrap[string](ctx, f)
		if err != nil {
			return nil, err
		}
		flagsStr, err = consolidateRegexpFlags(flagsStr, funcName)
		if err != nil {
			return nil, err
		}
	}
	regexFlags := regex.RegexFlags_None
	for _, flag := range flagsStr {
		// The 'c' flag is the default behavior, so we don't need to set anything in that case.
		// Any illegal flags will have been caught by consolidateRegexpFlags.
		switch flag {
		case 'i':
			regexFlags |= regex.RegexFlags_Case_Insensitive
		case 'm':
			regexFlags |= regex.RegexFlags_Multiline
		case 'n':
			regexFlags |= regex.RegexFlags_Dot_All
		case 'u':
			regexFlags |= regex.RegexFlags_Unix_Lines
		}
	}

	bufferSize := uint32(524288)
	if _, val, ok := sql.SystemVariables.GetGlobal("regexp_buffer_size"); ok {
		bufferSize = uint32(val.(uint64))
	} else {
		ctx.Warn(1193, `System variable for regular expressions "regexp_buffer_size" is missing`)
	}
	re := regex.CreateRegex(bufferSize)
	if err = re.SetRegexString(ctx, patternValStr, regexFlags); err != nil {
		_ = re.Close()
		return nil, err
	}
	return re, nil
}

// consolidateRegexpFlags consolidates regexp flags by removing duplicates, resolving order of conflicting flags, and
// verifying that all flags are valid.
func consolidateRegexpFlags(flags, funcName string) (string, error) {
	flagSet := make(map[string]struct{})
	for _, flag := range flags {
		switch flag {
		case 'c':
			delete(flagSet, "i")
		case 'i':
			flagSet["i"] = struct{}{}
		case 'm':
			flagSet["m"] = struct{}{}
		case 'n':
			flagSet["n"] = struct{}{}
		case 'u':
			flagSet["u"] = struct{}{}
		default:
			return "", sql.ErrInvalidArgument.New(funcName)
		}
	}
	flags = ""
	for flag := range flagSet {
		flags += flag
	}
	return flags, nil
}

// canBeCached returns whether the expression(s) can be cached
func canBeCached(exprs ...sql.Expression) bool {
	hasCols := false
	for _, expr := range exprs {
		if expr == nil {
			continue
		}
		sql.Inspect(expr, func(e sql.Expression) bool {
			switch e.(type) {
			case *expression.GetField, *expression.UserVar, *expression.SystemVar, *expression.ProcedureParam:
				hasCols = true
			default:
				if nonDet, ok := expr.(sql.NonDeterministicExpression); ok {
					hasCols = hasCols || nonDet.IsNonDeterministic()
				}
			}
			return true
		})
	}
	return !hasCols
}
