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
	"reflect"
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// Substring is a function to return a part of a string.
// This function behaves as the homonym MySQL function.
// Since Go strings are UTF8, this function does not return a direct sub
// string str[start:start+length], instead returns the substring of rune
// s. That is, "á"[0:1] does not return a partial unicode glyph, but "á"
// itself.
type Substring struct {
	Str   sql.Expression
	Start sql.Expression
	Len   sql.Expression
}

var _ sql.FunctionExpression = (*Substring)(nil)
var _ sql.CollationCoercible = (*Substring)(nil)

// NewSubstring creates a new substring UDF.
func NewSubstring(args ...sql.Expression) (sql.Expression, error) {
	var str, start, ln sql.Expression
	switch len(args) {
	case 2:
		str = args[0]
		start = args[1]
		ln = nil
	case 3:
		str = args[0]
		start = args[1]
		ln = args[2]
	default:
		return nil, sql.ErrInvalidArgumentNumber.New("SUBSTRING", "2 or 3", len(args))
	}
	return &Substring{str, start, ln}, nil
}

// FunctionName implements sql.FunctionExpression
func (s *Substring) FunctionName() string {
	return "substring"
}

// Description implements sql.FunctionExpression
func (s *Substring) Description() string {
	return "returns a substring from the provided string starting at pos with a length of len characters. If no len is provided, all characters from pos until the end will be taken."
}

// Children implements the Expression interface.
func (s *Substring) Children() []sql.Expression {
	if s.Len == nil {
		return []sql.Expression{s.Str, s.Start}
	}
	return []sql.Expression{s.Str, s.Start, s.Len}
}

// Eval implements the Expression interface.
func (s *Substring) Eval(
	ctx *sql.Context,
	row sql.Row,
) (interface{}, error) {
	str, err := s.Str.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	str, _, err = types.LongText.Convert(ctx, str)
	if err != nil {
		return nil, err
	}

	// Handle Dolt's TextStorage wrapper that doesn't convert to plain string
	str, err = sql.UnwrapAny(ctx, str)
	if err != nil {
		return nil, err
	}

	var text []rune
	switch str := str.(type) {
	case string:
		text = []rune(str)
	case []byte:
		text = []rune(string(str))
	case nil:
		return nil, nil
	default:
		return nil, sql.ErrInvalidType.New(reflect.TypeOf(str).String())
	}

	start, err := s.Start.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	if start == nil {
		return nil, nil
	}

	start, _, err = types.Int64.Convert(ctx, start)
	if err != nil {
		return nil, err
	}

	var length int64
	runeCount := int64(len(text))
	if s.Len != nil {
		len, err := s.Len.Eval(ctx, row)
		if err != nil {
			return nil, err
		}

		if len == nil {
			return nil, nil
		}

		len, _, err = types.Int64.Convert(ctx, len)
		if err != nil {
			return nil, err
		}

		length = len.(int64)
	} else {
		length = runeCount
	}

	var startIdx int64
	if start := start.(int64); start < 0 {
		startIdx = runeCount + start
	} else {
		startIdx = start - 1
	}

	if startIdx < 0 || startIdx >= runeCount || length <= 0 {
		return "", nil
	}

	if startIdx+length > runeCount {
		length = int64(runeCount) - startIdx
	}

	return string(text[startIdx : startIdx+length]), nil
}

// IsNullable implements the Expression interface.
func (s *Substring) IsNullable() bool {
	return s.Str.IsNullable() || s.Start.IsNullable() || (s.Len != nil && s.Len.IsNullable())
}

func (s *Substring) String() string {
	if s.Len == nil {
		return fmt.Sprintf("SUBSTRING(%s, %s)", s.Str, s.Start)
	}
	return fmt.Sprintf("SUBSTRING(%s, %s, %s)", s.Str, s.Start, s.Len)
}

// Resolved implements the Expression interface.
func (s *Substring) Resolved() bool {
	return s.Start.Resolved() && s.Str.Resolved() && (s.Len == nil || s.Len.Resolved())
}

// Type implements the Expression interface.
func (s *Substring) Type() sql.Type { return s.Str.Type() }

// CollationCoercibility implements the interface sql.CollationCoercible.
func (s *Substring) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.GetCoercibility(ctx, s.Str)
}

// WithChildren implements the Expression interface.
func (*Substring) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NewSubstring(children...)
}

// SubstringIndex returns the substring from string str before count occurrences of the delimiter delim.
// If count is positive, everything to the left of the final delimiter (counting from the left) is returned.
// If count is negative, everything to the right of the final delimiter (counting from the right) is returned.
// SUBSTRING_INDEX() performs a case-sensitive match when searching for delim.
type SubstringIndex struct {
	str   sql.Expression
	delim sql.Expression
	count sql.Expression
}

var _ sql.FunctionExpression = (*SubstringIndex)(nil)
var _ sql.CollationCoercible = (*SubstringIndex)(nil)

// NewSubstringIndex creates a new SubstringIndex UDF.
func NewSubstringIndex(str, delim, count sql.Expression) sql.Expression {
	return &SubstringIndex{str, delim, count}
}

// FunctionName implements sql.FunctionExpression
func (s *SubstringIndex) FunctionName() string {
	return "substring_index"
}

// Description implements sql.FunctionExpression
func (s *SubstringIndex) Description() string {
	return "returns a substring after count appearances of delim. If count is negative, counts from the right side of the string."
}

// Children implements the Expression interface.
func (s *SubstringIndex) Children() []sql.Expression {
	return []sql.Expression{s.str, s.delim, s.count}
}

// Eval implements the Expression interface.
func (s *SubstringIndex) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	ex, err := s.str.Eval(ctx, row)
	if ex == nil || err != nil {
		return nil, err
	}
	ex, _, err = types.LongText.Convert(ctx, ex)
	if err != nil {
		return nil, err
	}

	// Handle Dolt's TextStorage wrapper that doesn't convert to plain string
	ex, err = sql.UnwrapAny(ctx, ex)
	if err != nil {
		return nil, err
	}

	str, ok := ex.(string)
	if !ok {
		return nil, sql.ErrInvalidType.New(reflect.TypeOf(ex).String())
	}

	ex, err = s.delim.Eval(ctx, row)
	if ex == nil || err != nil {
		return nil, err
	}
	ex, _, err = types.LongText.Convert(ctx, ex)
	if err != nil {
		return nil, err
	}

	// Handle Dolt's TextStorage wrapper that doesn't convert to plain string
	ex, err = sql.UnwrapAny(ctx, ex)
	if err != nil {
		return nil, err
	}

	delim, ok := ex.(string)
	if !ok {
		return nil, sql.ErrInvalidType.New(reflect.TypeOf(ex).String())
	}

	ex, err = s.count.Eval(ctx, row)
	if ex == nil || err != nil {
		return nil, err
	}
	ex, _, err = types.Int64.Convert(ctx, ex)
	if err != nil {
		return nil, err
	}
	count, ok := ex.(int64)
	if !ok {
		return nil, sql.ErrInvalidType.New(reflect.TypeOf(ex).String())
	}

	// Implementation taken from pingcap/tidb
	// https://github.com/pingcap/tidb/blob/37c128b64f3ad2f08d52bc767b6e3320ecf429d8/expression/builtin_string.go#L1229
	strs := strings.Split(str, delim)
	start, end := int64(0), int64(len(strs))
	if count > 0 {
		// If count is positive, everything to the left of the final delimiter (counting from the left) is returned.
		if count < end {
			end = count
		}
	} else {
		// If count is negative, everything to the right of the final delimiter (counting from the right) is returned.
		count = -count
		if count < 0 {
			// -count overflows max int64, returns an empty string.
			return "", nil
		}

		if count < end {
			start = end - count
		}
	}

	return strings.Join(strs[start:end], delim), nil
}

// IsNullable implements the Expression interface.
func (s *SubstringIndex) IsNullable() bool {
	return s.str.IsNullable() || s.delim.IsNullable() || s.count.IsNullable()
}

func (s *SubstringIndex) String() string {
	return fmt.Sprintf("SUBSTRING_INDEX(%s, %s, %s)", s.str, s.delim, s.count)
}

// Resolved implements the Expression interface.
func (s *SubstringIndex) Resolved() bool {
	return s.str.Resolved() && s.delim.Resolved() && s.count.Resolved()
}

// Type implements the Expression interface.
func (*SubstringIndex) Type() sql.Type { return types.LongText }

// CollationCoercibility implements the interface sql.CollationCoercible.
func (s *SubstringIndex) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.GetCoercibility(ctx, s.str)
}

// WithChildren implements the Expression interface.
func (s *SubstringIndex) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 3 {
		return nil, sql.ErrInvalidChildrenNumber.New(s, len(children), 3)
	}
	return NewSubstringIndex(children[0], children[1], children[2]), nil
}

// Left is a function that returns the first N characters of a string expression.
type Left struct {
	str sql.Expression
	len sql.Expression
}

var _ sql.FunctionExpression = Left{}
var _ sql.CollationCoercible = Left{}

// NewLeft creates a new LEFT function.
func NewLeft(str, len sql.Expression) sql.Expression {
	return Left{str, len}
}

// FunctionName implements sql.FunctionExpression
func (l Left) FunctionName() string {
	return "left"
}

// Description implements sql.FunctionExpression
func (l Left) Description() string {
	return "returns the first N characters in the string given."
}

// Children implements the Expression interface.
func (l Left) Children() []sql.Expression {
	return []sql.Expression{l.str, l.len}
}

// Eval implements the Expression interface.
func (l Left) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	str, err := l.str.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	var text []rune
	switch str := str.(type) {
	case string:
		text = []rune(str)
	case sql.StringWrapper:
		s, err := str.Unwrap(ctx)
		if err != nil {
			return nil, err
		}
		text = []rune(s)
	case []byte:
		text = []rune(string(str))
	case sql.BytesWrapper:
		b, err := str.Unwrap(ctx)
		if err != nil {
			return nil, err
		}
		text = []rune(string(b))
	case nil:
		return nil, nil
	default:
		return nil, sql.ErrInvalidType.New(reflect.TypeOf(str).String())
	}

	var length int64
	runeCount := int64(len(text))
	len, err := l.len.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	if len == nil {
		return nil, nil
	}

	len, _, err = types.Int64.Convert(ctx, len)
	if err != nil {
		return nil, err
	}

	length = len.(int64)

	if length > runeCount {
		length = runeCount
	}
	if length <= 0 {
		return "", nil
	}

	return string(text[:length]), nil
}

// IsNullable implements the Expression interface.
func (l Left) IsNullable() bool {
	return l.str.IsNullable() || l.len.IsNullable()
}

func (l Left) String() string {
	return fmt.Sprintf("LEFT(%s, %s)", l.str, l.len)
}

// Resolved implements the Expression interface.
func (l Left) Resolved() bool {
	return l.str.Resolved() && l.len.Resolved()
}

// Type implements the Expression interface.
func (Left) Type() sql.Type { return types.LongText }

// CollationCoercibility implements the interface sql.CollationCoercible.
func (l Left) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.GetCoercibility(ctx, l.str)
}

// WithChildren implements the Expression interface.
func (l Left) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 2 {
		return nil, sql.ErrInvalidChildrenNumber.New(l, len(children), 2)
	}
	return NewLeft(children[0], children[1]), nil
}

// Right is a function that returns the last N characters of a string expression.
type Right struct {
	str sql.Expression
	len sql.Expression
}

var _ sql.FunctionExpression = Right{}
var _ sql.CollationCoercible = Right{}

// NewRight creates a new RIGHT function.
func NewRight(str, len sql.Expression) sql.Expression {
	return Right{str, len}
}

// FunctionName implements sql.FunctionExpression
func (r Right) FunctionName() string {
	return "right"
}

// Description implements sql.FunctionExpression
func (r Right) Description() string {
	return "returns the specified rightmost number of characters."
}

// Children implements the Expression interface.
func (r Right) Children() []sql.Expression {
	return []sql.Expression{r.str, r.len}
}

// Eval implements the Expression interface.
func (r Right) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	str, err := r.str.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	var text []rune
	switch str := str.(type) {
	case string:
		text = []rune(str)
	case sql.StringWrapper:
		s, err := str.Unwrap(ctx)
		if err != nil {
			return nil, err
		}
		text = []rune(s)
	case []byte:
		text = []rune(string(str))
	case sql.BytesWrapper:
		b, err := str.Unwrap(ctx)
		if err != nil {
			return nil, err
		}
		text = []rune(string(b))
	case nil:
		return nil, nil
	default:
		return nil, sql.ErrInvalidType.New(reflect.TypeOf(str).String())
	}

	var length int64
	runeCount := int64(len(text))
	len, err := r.len.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	if len == nil {
		return nil, nil
	}

	len, _, err = types.Int64.Convert(ctx, len)
	if err != nil {
		return nil, err
	}

	length = len.(int64)

	if length > runeCount {
		length = runeCount
	}
	if length <= 0 {
		return "", nil
	}

	return string(text[runeCount-length:]), nil
}

// IsNullable implements the Expression interface.
func (r Right) IsNullable() bool {
	return r.str.IsNullable() || r.len.IsNullable()
}

func (r Right) String() string {
	return fmt.Sprintf("RIGHT(%s, %s)", r.str, r.len)
}

func (r Right) DebugString() string {
	pr := sql.NewTreePrinter()
	_ = pr.WriteNode("RIGHT")
	children := []string{
		fmt.Sprintf("str: %s", sql.DebugString(r.str)),
		fmt.Sprintf("len: %s", sql.DebugString(r.len)),
	}
	_ = pr.WriteChildren(children...)
	return pr.String()
}

// Resolved implements the Expression interface.
func (r Right) Resolved() bool {
	return r.str.Resolved() && r.len.Resolved()
}

// Type implements the Expression interface.
func (Right) Type() sql.Type { return types.LongText }

// CollationCoercibility implements the interface sql.CollationCoercible.
func (r Right) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.GetCoercibility(ctx, r.str)
}

// WithChildren implements the Expression interface.
func (r Right) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 2 {
		return nil, sql.ErrInvalidChildrenNumber.New(r, len(children), 2)
	}
	return NewRight(children[0], children[1]), nil
}

type Instr struct {
	str    sql.Expression
	substr sql.Expression
}

var _ sql.FunctionExpression = Instr{}
var _ sql.CollationCoercible = Instr{}

// NewInstr creates a new instr UDF.
func NewInstr(str, substr sql.Expression) sql.Expression {
	return Instr{str, substr}
}

// FunctionName implements sql.FunctionExpression
func (i Instr) FunctionName() string {
	return "instr"
}

// Description implements sql.FunctionExpression
func (i Instr) Description() string {
	return "returns the 1-based index of the first occurence of str2 in str1, or 0 if it does not occur."
}

// Children implements the Expression interface.
func (i Instr) Children() []sql.Expression {
	return []sql.Expression{i.str, i.substr}
}

// Eval implements the Expression interface.
func (i Instr) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	str, err := i.str.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	var text []rune
	switch str := str.(type) {
	case string:
		text = []rune(str)
	case sql.StringWrapper:
		s, err := str.Unwrap(ctx)
		if err != nil {
			return nil, err
		}
		text = []rune(s)
	case []byte:
		text = []rune(string(str))
	case sql.BytesWrapper:
		s, err := str.Unwrap(ctx)
		if err != nil {
			return nil, err
		}
		text = []rune(string(s))
	case nil:
		return nil, nil
	default:
		return nil, sql.ErrInvalidType.New(reflect.TypeOf(str).String())
	}

	substr, err := i.substr.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	var subtext []rune
	switch substr := substr.(type) {
	case string:
		subtext = []rune(substr)
	case sql.StringWrapper:
		s, err := substr.Unwrap(ctx)
		if err != nil {
			return nil, err
		}
		text = []rune(s)
	case []byte:
		subtext = []rune(string(substr))
	case sql.BytesWrapper:
		s, err := substr.Unwrap(ctx)
		if err != nil {
			return nil, err
		}
		subtext = []rune(string(s))
	case nil:
		return nil, nil
	default:
		return nil, sql.ErrInvalidType.New(reflect.TypeOf(str).String())
	}

	return findSubsequence(text, subtext) + 1, nil
}

func findSubsequence(text []rune, subtext []rune) int64 {
	for i := 0; i <= len(text)-len(subtext); i++ {
		var j int
		for j = 0; j < len(subtext); j++ {
			if text[i+j] != subtext[j] {
				break
			}
		}
		if j == len(subtext) {
			return int64(i)
		}
	}
	return -1
}

// IsNullable implements the Expression interface.
func (i Instr) IsNullable() bool {
	return i.str.IsNullable() || i.substr.IsNullable()
}

func (i Instr) String() string {
	return fmt.Sprintf("INSTR(%s, %s)", i.str, i.substr)
}

// Resolved implements the Expression interface.
func (i Instr) Resolved() bool {
	return i.str.Resolved() && i.substr.Resolved()
}

// Type implements the Expression interface.
func (Instr) Type() sql.Type { return types.Int64 }

// CollationCoercibility implements the interface sql.CollationCoercible.
func (Instr) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// WithChildren implements the Expression interface.
func (i Instr) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 2 {
		return nil, sql.ErrInvalidChildrenNumber.New(i, len(children), 2)
	}
	return NewInstr(children[0], children[1]), nil
}
