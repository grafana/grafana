// Copyright 2018 The CUE Authors
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

package cue

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"math/big"
	"strings"

	"github.com/cockroachdb/apd/v2"

	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/build"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/token"
	"cuelang.org/go/internal"
	"cuelang.org/go/internal/core/adt"
	"cuelang.org/go/internal/core/compile"
	"cuelang.org/go/internal/core/convert"
	"cuelang.org/go/internal/core/eval"
	"cuelang.org/go/internal/core/export"
	"cuelang.org/go/internal/core/runtime"
	"cuelang.org/go/internal/core/subsume"
	"cuelang.org/go/internal/core/validate"
	"cuelang.org/go/internal/types"
)

// Kind determines the underlying type of a Value.
type Kind = adt.Kind

const (
	// BottomKind represents the bottom value.
	BottomKind Kind = adt.BottomKind

	// NullKind indicates a null value.
	NullKind Kind = adt.NullKind

	// BoolKind indicates a boolean value.
	BoolKind Kind = adt.BoolKind

	// IntKind represents an integral number.
	IntKind Kind = adt.IntKind

	// FloatKind represents a decimal float point number that cannot be
	// converted to an integer. The underlying number may still be integral,
	// but resulting from an operation that enforces the float type.
	FloatKind Kind = adt.FloatKind

	// StringKind indicates any kind of string.
	StringKind Kind = adt.StringKind

	// BytesKind is a blob of data.
	BytesKind Kind = adt.BytesKind

	// StructKind is a kev-value map.
	StructKind Kind = adt.StructKind

	// ListKind indicates a list of values.
	ListKind Kind = adt.ListKind

	// _numberKind is used as a implementation detail inside
	// Kind.String to indicate NumberKind.

	// NumberKind represents any kind of number.
	NumberKind Kind = IntKind | FloatKind

	// TopKind represents the top value.
	TopKind Kind = adt.TopKind
)

// An structValue represents a JSON object.
//
// TODO: remove
type structValue struct {
	ctx      *adt.OpContext
	v        Value
	obj      *adt.Vertex
	features []adt.Feature
}

type hiddenStructValue = structValue

// Len reports the number of fields in this struct.
func (o *hiddenStructValue) Len() int {
	if o.obj == nil {
		return 0
	}
	return len(o.features)
}

// At reports the key and value of the ith field, i < o.Len().
func (o *hiddenStructValue) At(i int) (key string, v Value) {
	f := o.features[i]
	return o.v.idx.LabelStr(f), newChildValue(o, i)
}

func (o *hiddenStructValue) at(i int) (v *adt.Vertex, isOpt bool) {
	f := o.features[i]
	arc := o.obj.Lookup(f)
	if arc == nil {
		arc = &adt.Vertex{
			Parent: o.v.v,
			Label:  f,
		}
		o.obj.MatchAndInsert(o.ctx, arc)
		arc.Finalize(o.ctx)
		isOpt = true
	}
	return arc, isOpt
}

// Lookup reports the field for the given key. The returned Value is invalid
// if it does not exist.
func (o *hiddenStructValue) Lookup(key string) Value {
	f := o.v.idx.StrLabel(key)
	i := 0
	len := o.Len()
	for ; i < len; i++ {
		if o.features[i] == f {
			break
		}
	}
	if i == len {
		x := mkErr(o.v.idx, o.obj, 0, "field not found: %v", key)
		x.NotExists = true
		// TODO: more specifically we should test whether the values that
		// are addressable from the root of the configuration can support the
		// looked up value. This will avoid false positives such as when
		// an open literal struct is passed to a builtin.
		if o.obj.Accept(o.ctx, f) {
			x.Code = adt.IncompleteError
		}
		return newErrValue(o.v, x)
	}
	return newChildValue(o, i)
}

// MarshalJSON returns a valid JSON encoding or reports an error if any of the
// fields is invalid.
func (o *structValue) marshalJSON() (b []byte, err errors.Error) {
	b = append(b, '{')
	n := o.Len()
	for i := 0; i < n; i++ {
		k, v := o.At(i)
		s, err := json.Marshal(k)
		if err != nil {
			return nil, unwrapJSONError(err)
		}
		b = append(b, s...)
		b = append(b, ':')
		bb, err := json.Marshal(v)
		if err != nil {
			return nil, unwrapJSONError(err)
		}
		b = append(b, bb...)
		if i < n-1 {
			b = append(b, ',')
		}
	}
	b = append(b, '}')
	return b, nil
}

var _ errors.Error = &marshalError{}

type marshalError struct {
	err errors.Error
	b   *adt.Bottom
}

func toMarshalErr(v Value, b *adt.Bottom) error {
	return &marshalError{v.toErr(b), b}
}

func marshalErrf(v Value, src adt.Node, code adt.ErrorCode, msg string, args ...interface{}) error {
	arguments := append([]interface{}{code, msg}, args...)
	b := mkErr(v.idx, src, arguments...)
	return toMarshalErr(v, b)
}

func (e *marshalError) Error() string {
	return fmt.Sprintf("cue: marshal error: %v", e.err)
}

func (e *marshalError) Bottom() *adt.Bottom          { return e.b }
func (e *marshalError) Path() []string               { return e.err.Path() }
func (e *marshalError) Msg() (string, []interface{}) { return e.err.Msg() }
func (e *marshalError) Position() token.Pos          { return e.err.Position() }
func (e *marshalError) InputPositions() []token.Pos {
	return e.err.InputPositions()
}

func unwrapJSONError(err error) errors.Error {
	switch x := err.(type) {
	case *json.MarshalerError:
		return unwrapJSONError(x.Err)
	case *marshalError:
		return x
	case errors.Error:
		return &marshalError{x, nil}
	default:
		return &marshalError{errors.Wrapf(err, token.NoPos, "json error"), nil}
	}
}

// An Iterator iterates over values.
type Iterator struct {
	val   Value
	idx   *runtime.Runtime
	ctx   *adt.OpContext
	arcs  []field
	p     int
	cur   Value
	f     adt.Feature
	isOpt bool
}

type hiddenIterator = Iterator

type field struct {
	arc        *adt.Vertex
	isOptional bool
}

// Next advances the iterator to the next value and reports whether there was
// any. It must be called before the first call to Value or Key.
func (i *Iterator) Next() bool {
	if i.p >= len(i.arcs) {
		i.cur = Value{}
		return false
	}
	f := i.arcs[i.p]
	f.arc.Finalize(i.ctx)
	p := linkParent(i.val.parent_, i.val.v, f.arc)
	i.cur = makeValue(i.val.idx, f.arc, p)
	i.f = f.arc.Label
	i.isOpt = f.isOptional
	i.p++
	return true
}

// Value returns the current value in the list. It will panic if Next advanced
// past the last entry.
func (i *Iterator) Value() Value {
	return i.cur
}

// Selector reports the field label of this iteration.
func (i *Iterator) Selector() Selector {
	return featureToSel(i.f, i.idx)
}

// Label reports the label of the value if i iterates over struct fields and ""
// otherwise.
//
// Slated to be deprecated: use i.Selector().String(). Note that this will give
// more accurate string representations.
func (i *hiddenIterator) Label() string {
	if i.f == 0 {
		return ""
	}
	return i.idx.LabelStr(i.f)
}

// IsHidden reports if a field is hidden from the data model.
//
// Deprecated: use i.Selector().PkgPath() != ""
func (i *hiddenIterator) IsHidden() bool {
	return i.f.IsHidden()
}

// IsOptional reports if a field is optional.
func (i *Iterator) IsOptional() bool {
	return i.isOpt
}

// IsDefinition reports if a field is a definition.
//
// Deprecated: use i.Selector().IsDefinition()
func (i *hiddenIterator) IsDefinition() bool {
	return i.f.IsDef()
}

// marshalJSON iterates over the list and generates JSON output. HasNext
// will return false after this operation.
func marshalList(l *Iterator) (b []byte, err errors.Error) {
	b = append(b, '[')
	if l.Next() {
		for i := 0; ; i++ {
			x, err := json.Marshal(l.Value())
			if err != nil {
				return nil, unwrapJSONError(err)
			}
			b = append(b, x...)
			if !l.Next() {
				break
			}
			b = append(b, ',')
		}
	}
	b = append(b, ']')
	return b, nil
}

func (v Value) getNum(k adt.Kind) (*adt.Num, errors.Error) {
	v, _ = v.Default()
	ctx := v.ctx()
	if err := v.checkKind(ctx, k); err != nil {
		return nil, v.toErr(err)
	}
	n, _ := v.eval(ctx).(*adt.Num)
	return n, nil
}

// MantExp breaks x into its mantissa and exponent components and returns the
// exponent. If a non-nil mant argument is provided its value is set to the
// mantissa of x. The components satisfy x == mant × 10**exp. It returns an
// error if v is not a number.
//
// The components are not normalized. For instance, 2.00 is represented mant ==
// 200 and exp == -2. Calling MantExp with a nil argument is an efficient way to
// get the exponent of the receiver.
func (v Value) MantExp(mant *big.Int) (exp int, err error) {
	n, err := v.getNum(adt.NumKind)
	if err != nil {
		return 0, err
	}
	if n.X.Form != 0 {
		return 0, ErrInfinite
	}
	if mant != nil {
		mant.Set(&n.X.Coeff)
		if n.X.Negative {
			mant.Neg(mant)
		}
	}
	return int(n.X.Exponent), nil
}

// Decimal is for internal use only. The Decimal type that is returned is
// subject to change.
func (v hiddenValue) Decimal() (d *internal.Decimal, err error) {
	n, err := v.getNum(adt.NumKind)
	if err != nil {
		return nil, err
	}
	return &n.X, nil
}

// AppendInt appends the string representation of x in the given base to buf and
// returns the extended buffer, or an error if the underlying number was not
// an integer.
func (v Value) AppendInt(buf []byte, base int) ([]byte, error) {
	i, err := v.Int(nil)
	if err != nil {
		return nil, err
	}
	return i.Append(buf, base), nil
}

// AppendFloat appends to buf the string form of the floating-point number x.
// It returns an error if v is not a number.
func (v Value) AppendFloat(buf []byte, fmt byte, prec int) ([]byte, error) {
	n, err := v.getNum(adt.NumKind)
	if err != nil {
		return nil, err
	}
	ctx := apd.BaseContext
	nd := int(apd.NumDigits(&n.X.Coeff)) + int(n.X.Exponent)
	if n.X.Form == apd.Infinite {
		if n.X.Negative {
			buf = append(buf, '-')
		}
		return append(buf, string('∞')...), nil
	}
	if fmt == 'f' && nd > 0 {
		ctx.Precision = uint32(nd + prec)
	} else {
		ctx.Precision = uint32(prec)
	}
	var d apd.Decimal
	ctx.Round(&d, &n.X)
	return d.Append(buf, fmt), nil
}

var (
	// ErrBelow indicates that a value was rounded down in a conversion.
	ErrBelow = errors.New("value was rounded down")

	// ErrAbove indicates that a value was rounded up in a conversion.
	ErrAbove = errors.New("value was rounded up")

	// ErrInfinite indicates that a value is infinite.
	ErrInfinite = errors.New("infinite")
)

// Int converts the underlying integral number to an big.Int. It reports an
// error if the underlying value is not an integer type. If a non-nil *Int
// argument z is provided, Int stores the result in z instead of allocating a
// new Int.
func (v Value) Int(z *big.Int) (*big.Int, error) {
	n, err := v.getNum(adt.IntKind)
	if err != nil {
		return nil, err
	}
	if z == nil {
		z = &big.Int{}
	}
	if n.X.Exponent != 0 {
		panic("cue: exponent should always be nil for integer types")
	}
	z.Set(&n.X.Coeff)
	if n.X.Negative {
		z.Neg(z)
	}
	return z, nil
}

// Int64 converts the underlying integral number to int64. It reports an
// error if the underlying value is not an integer type or cannot be represented
// as an int64. The result is (math.MinInt64, ErrAbove) for x < math.MinInt64,
// and (math.MaxInt64, ErrBelow) for x > math.MaxInt64.
func (v Value) Int64() (int64, error) {
	n, err := v.getNum(adt.IntKind)
	if err != nil {
		return 0, err
	}
	if !n.X.Coeff.IsInt64() {
		if n.X.Negative {
			return math.MinInt64, ErrAbove
		}
		return math.MaxInt64, ErrBelow
	}
	i := n.X.Coeff.Int64()
	if n.X.Negative {
		i = -i
	}
	return i, nil
}

// Uint64 converts the underlying integral number to uint64. It reports an
// error if the underlying value is not an integer type or cannot be represented
// as a uint64. The result is (0, ErrAbove) for x < 0, and
// (math.MaxUint64, ErrBelow) for x > math.MaxUint64.
func (v Value) Uint64() (uint64, error) {
	n, err := v.getNum(adt.IntKind)
	if err != nil {
		return 0, err
	}
	if n.X.Negative {
		return 0, ErrAbove
	}
	if !n.X.Coeff.IsUint64() {
		return math.MaxUint64, ErrBelow
	}
	i := n.X.Coeff.Uint64()
	return i, nil
}

// trimZeros trims 0's for better JSON respresentations.
func trimZeros(s string) string {
	n1 := len(s)
	s2 := strings.TrimRight(s, "0")
	n2 := len(s2)
	if p := strings.IndexByte(s2, '.'); p != -1 {
		if p == n2-1 {
			return s[:len(s2)+1]
		}
		return s2
	}
	if n1-n2 <= 4 {
		return s
	}
	return fmt.Sprint(s2, "e+", n1-n2)
}

var (
	smallestPosFloat64 *apd.Decimal
	smallestNegFloat64 *apd.Decimal
	maxPosFloat64      *apd.Decimal
	maxNegFloat64      *apd.Decimal
)

func init() {
	const (
		// math.SmallestNonzeroFloat64: 1 / 2**(1023 - 1 + 52)
		smallest = "4.940656458412465441765687928682213723651e-324"
		// math.MaxFloat64: 2**1023 * (2**53 - 1) / 2**52
		max = "1.797693134862315708145274237317043567981e+308"
	)
	ctx := apd.BaseContext
	ctx.Precision = 40

	var err error
	smallestPosFloat64, _, err = ctx.NewFromString(smallest)
	if err != nil {
		panic(err)
	}
	smallestNegFloat64, _, err = ctx.NewFromString("-" + smallest)
	if err != nil {
		panic(err)
	}
	maxPosFloat64, _, err = ctx.NewFromString(max)
	if err != nil {
		panic(err)
	}
	maxNegFloat64, _, err = ctx.NewFromString("-" + max)
	if err != nil {
		panic(err)
	}
}

// Float64 returns the float64 value nearest to x. It reports an error if v is
// not a number. If x is too small to be represented by a float64 (|x| <
// math.SmallestNonzeroFloat64), the result is (0, ErrBelow) or (-0, ErrAbove),
// respectively, depending on the sign of x. If x is too large to be represented
// by a float64 (|x| > math.MaxFloat64), the result is (+Inf, ErrAbove) or
// (-Inf, ErrBelow), depending on the sign of x.
func (v Value) Float64() (float64, error) {
	n, err := v.getNum(adt.NumKind)
	if err != nil {
		return 0, err
	}
	if n.X.Negative {
		if n.X.Cmp(smallestNegFloat64) == 1 {
			return -0, ErrAbove
		}
		if n.X.Cmp(maxNegFloat64) == -1 {
			return math.Inf(-1), ErrBelow
		}
	} else {
		if n.X.Cmp(smallestPosFloat64) == -1 {
			return 0, ErrBelow
		}
		if n.X.Cmp(maxPosFloat64) == 1 {
			return math.Inf(1), ErrAbove
		}
	}
	f, _ := n.X.Float64()
	return f, nil
}

// Value holds any value, which may be a Boolean, Error, List, Null, Number,
// Struct, or String.
type Value struct {
	idx *runtime.Runtime
	v   *adt.Vertex
	// Parent keeps track of the parent if the value corresponding to v.Parent
	// differs, recursively.
	parent_ *parent
}

// parent is a distinct type from Value to ensure more type safety: Value
// is typically used by value, so taking a pointer to it has a high risk
// or globbering the contents.
type parent struct {
	v *adt.Vertex
	p *parent
}

func (v Value) parent() Value {
	switch {
	case v.v == nil:
		return Value{}
	case v.parent_ != nil:
		return Value{v.idx, v.parent_.v, v.parent_.p}
	default:
		return Value{v.idx, v.v.Parent, nil}
	}
}

type valueScope Value

func (v valueScope) Vertex() *adt.Vertex { return v.v }
func (v valueScope) Parent() compile.Scope {
	p := Value(v).parent()
	if p.v == nil {
		return nil
	}
	return valueScope(p)
}

type hiddenValue = Value

// Core is for internal use only.
func (v hiddenValue) Core(x *types.Value) {
	x.V = v.v
	x.R = v.idx
}

func newErrValue(v Value, b *adt.Bottom) Value {
	node := &adt.Vertex{BaseValue: b}
	if v.v != nil {
		node.Label = v.v.Label
		node.Parent = v.v.Parent
	}
	node.UpdateStatus(adt.Finalized)
	node.AddConjunct(adt.MakeRootConjunct(nil, b))
	return makeChildValue(v.parent(), node)
}

func newVertexRoot(idx *runtime.Runtime, ctx *adt.OpContext, x *adt.Vertex) Value {
	if ctx != nil {
		// This is indicative of an zero Value. In some cases this is called
		// with an error value.
		x.Finalize(ctx)
	} else {
		x.UpdateStatus(adt.Finalized)
	}
	return makeValue(idx, x, nil)
}

func newValueRoot(idx *runtime.Runtime, ctx *adt.OpContext, x adt.Expr) Value {
	if n, ok := x.(*adt.Vertex); ok {
		return newVertexRoot(idx, ctx, n)
	}
	node := &adt.Vertex{}
	node.AddConjunct(adt.MakeRootConjunct(nil, x))
	return newVertexRoot(idx, ctx, node)
}

func newChildValue(o *structValue, i int) Value {
	arc, _ := o.at(i)
	return makeValue(o.v.idx, arc, linkParent(o.v.parent_, o.v.v, arc))
}

// Dereference reports the value v refers to if v is a reference or v itself
// otherwise.
func Dereference(v Value) Value {
	n := v.v
	if n == nil || len(n.Conjuncts) != 1 {
		return v
	}

	c := n.Conjuncts[0]
	r, _ := c.Expr().(adt.Resolver)
	if r == nil {
		return v
	}

	ctx := v.ctx()
	n, b := ctx.Resolve(c, r)
	if b != nil {
		return newErrValue(v, b)
	}
	n.Finalize(ctx)
	// NOTE: due to structure sharing, the path of the referred node may end
	// up different from the one explicitly pointed to. The value will be the
	// same, but the scope may differ.
	// TODO(structureshare): see if we can construct the original path. This
	// only has to be done if structures are being shared.
	return makeValue(v.idx, n, nil)
}

func makeValue(idx *runtime.Runtime, v *adt.Vertex, p *parent) Value {
	if v.Status() == 0 || v.BaseValue == nil {
		panic(fmt.Sprintf("not properly initialized (state: %v, value: %T)",
			v.Status(), v.BaseValue))
	}
	return Value{idx, v, p}
}

// makeChildValue makes a new value, of which p is the parent, and links the
// parent pointer to p if necessary.
func makeChildValue(p Value, arc *adt.Vertex) Value {
	return makeValue(p.idx, arc, linkParent(p.parent_, p.v, arc))
}

// linkParent creates the parent struct for an arc, if necessary.
//
// The parent struct is necessary if the parent struct also has a parent struct,
// or if arc is (structurally) shared and does not have node as a parent.
func linkParent(p *parent, node, arc *adt.Vertex) *parent {
	if p == nil && node == arc.Parent {
		return nil
	}
	return &parent{node, p}
}

func remakeValue(base Value, env *adt.Environment, v adt.Expr) Value {
	// TODO: right now this is necessary because disjunctions do not have
	// populated conjuncts.
	if v, ok := v.(*adt.Vertex); ok && v.Status() >= adt.Partial {
		return Value{base.idx, v, nil}
	}
	n := &adt.Vertex{Label: base.v.Label}
	n.AddConjunct(adt.MakeRootConjunct(env, v))
	n = manifest(base.ctx(), n)
	n.Parent = base.v.Parent
	return makeChildValue(base.parent(), n)
}

func remakeFinal(base Value, env *adt.Environment, v adt.Value) Value {
	n := &adt.Vertex{Parent: base.v.Parent, Label: base.v.Label, BaseValue: v}
	n.UpdateStatus(adt.Finalized)
	return makeChildValue(base.parent(), n)
}

func (v Value) ctx() *adt.OpContext {
	return newContext(v.idx)
}

// Eval resolves the references of a value and returns the result.
// This method is not necessary to obtain concrete values.
func (v Value) Eval() Value {
	if v.v == nil {
		return v
	}
	x := v.v
	// x = eval.FinalizeValue(v.idx.Runtime, v.v)
	// x.Finalize(v.ctx())
	x = x.ToDataSingle()
	return makeValue(v.idx, x, v.parent_)
	// return remakeValue(v, nil, ctx.value(x))
}

// Default reports the default value and whether it existed. It returns the
// normal value if there is no default.
func (v Value) Default() (Value, bool) {
	if v.v == nil {
		return v, false
	}

	d := v.v.Default()
	if d == v.v {
		return v, false
	}
	return makeValue(v.idx, d, v.parent_), true

	// d, ok := v.v.Value.(*adt.Disjunction)
	// if !ok {
	// 	return v, false
	// }

	// var w *adt.Vertex

	// switch d.NumDefaults {
	// case 0:
	// 	return v, false

	// case 1:
	// 	w = d.Values[0]

	// default:
	// 	x := *v.v
	// 	x.Value = &adt.Disjunction{
	// 		Src:         d.Src,
	// 		Values:      d.Values[:d.NumDefaults],
	// 		NumDefaults: 0,
	// 	}
	// 	w = &x
	// }

	// w.Conjuncts = nil
	// for _, c := range v.v.Conjuncts {
	// 	// TODO: preserve field information.
	// 	expr, _ := stripNonDefaults(c.Expr())
	// 	w.AddConjunct(adt.MakeConjunct(c.Env, expr))
	// }

	// return makeValue(v.idx, w), true

	// if !stripped {
	// 	return v, false
	// }

	// n := *v.v
	// n.Conjuncts = conjuncts
	// return Value{v.idx, &n}, true

	// isDefault := false
	// for _, c := range v.v.Conjuncts {
	// 	if hasDisjunction(c.Expr()) {
	// 		isDefault = true
	// 		break
	// 	}
	// }

	// if !isDefault {
	// 	return v, false
	// }

	// TODO: record expanded disjunctions in output.
	// - Rename Disjunction to DisjunctionExpr
	// - Introduce Disjuncts with Values.
	// - In Expr introduce Star
	// - Don't pick default by default?

	// Evaluate the value.
	// 	x := eval.FinalizeValue(v.idx.Runtime, v.v)
	// 	if b, _ := x.Value.(*adt.Bottom); b != nil { // && b.IsIncomplete() {
	// 		return v, false
	// 	}
	// 	// Finalize and return here.
	// 	return Value{v.idx, x}, isDefault
}

// TODO: this should go: record preexpanded disjunctions in Vertex.
func hasDisjunction(expr adt.Expr) bool {
	switch x := expr.(type) {
	case *adt.DisjunctionExpr:
		return true
	case *adt.Conjunction:
		for _, v := range x.Values {
			if hasDisjunction(v) {
				return true
			}
		}
	case *adt.BinaryExpr:
		switch x.Op {
		case adt.OrOp:
			return true
		case adt.AndOp:
			return hasDisjunction(x.X) || hasDisjunction(x.Y)
		}
	}
	return false
}

// TODO: this should go: record preexpanded disjunctions in Vertex.
func stripNonDefaults(expr adt.Expr) (r adt.Expr, stripped bool) {
	switch x := expr.(type) {
	case *adt.DisjunctionExpr:
		if !x.HasDefaults {
			return x, false
		}
		d := *x
		d.Values = []adt.Disjunct{}
		for _, v := range x.Values {
			if v.Default {
				d.Values = append(d.Values, v)
			}
		}
		if len(d.Values) == 1 {
			return d.Values[0].Val, true
		}
		return &d, true

	case *adt.BinaryExpr:
		if x.Op != adt.AndOp {
			return x, false
		}
		a, sa := stripNonDefaults(x.X)
		b, sb := stripNonDefaults(x.Y)
		if sa || sb {
			bin := *x
			bin.X = a
			bin.Y = b
			return &bin, true
		}
		return x, false

	default:
		return x, false
	}
}

// Label reports he label used to obtain this value from the enclosing struct.
//
// TODO: get rid of this somehow. Probably by including a FieldInfo struct
// or the like.
func (v hiddenValue) Label() (string, bool) {
	if v.v == nil || v.v.Label == 0 {
		return "", false
	}
	return v.idx.LabelStr(v.v.Label), true
}

// Kind returns the kind of value. It returns BottomKind for atomic values that
// are not concrete. For instance, it will return BottomKind for the bounds
// >=0.
func (v Value) Kind() Kind {
	if v.v == nil {
		return BottomKind
	}
	c := v.v.BaseValue
	if !v.v.IsConcrete() {
		return BottomKind
	}
	// TODO: perhaps we should not consider open lists as "incomplete".
	if v.IncompleteKind() == adt.ListKind && !v.v.IsClosedList() {
		return BottomKind
	}
	return c.Kind()
}

// IncompleteKind returns a mask of all kinds that this value may be.
func (v Value) IncompleteKind() Kind {
	if v.v == nil {
		return BottomKind
	}
	return v.v.Kind()
}

// MarshalJSON marshalls this value into valid JSON.
func (v Value) MarshalJSON() (b []byte, err error) {
	b, err = v.marshalJSON()
	if err != nil {
		return nil, unwrapJSONError(err)
	}
	return b, nil
}

func (v Value) marshalJSON() (b []byte, err error) {
	v, _ = v.Default()
	if v.v == nil {
		return json.Marshal(nil)
	}
	ctx := newContext(v.idx)
	x := v.eval(ctx)

	if _, ok := x.(adt.Resolver); ok {
		return nil, marshalErrf(v, x, adt.IncompleteError, "value %q contains unresolved references", str(ctx, x))
	}
	if !adt.IsConcrete(x) {
		return nil, marshalErrf(v, x, adt.IncompleteError, "cannot convert incomplete value %q to JSON", str(ctx, x))
	}

	// TODO: implement marshalles in value.
	switch k := x.Kind(); k {
	case adt.NullKind:
		return json.Marshal(nil)
	case adt.BoolKind:
		return json.Marshal(x.(*adt.Bool).B)
	case adt.IntKind, adt.FloatKind, adt.NumKind:
		b, err := x.(*adt.Num).X.MarshalText()
		b = bytes.TrimLeft(b, "+")
		return b, err
	case adt.StringKind:
		return json.Marshal(x.(*adt.String).Str)
	case adt.BytesKind:
		return json.Marshal(x.(*adt.Bytes).B)
	case adt.ListKind:
		i, _ := v.List()
		return marshalList(&i)
	case adt.StructKind:
		obj, err := v.structValData(ctx)
		if err != nil {
			return nil, toMarshalErr(v, err)
		}
		return obj.marshalJSON()
	case adt.BottomKind:
		return nil, toMarshalErr(v, x.(*adt.Bottom))
	default:
		return nil, marshalErrf(v, x, 0, "cannot convert value %q of type %T to JSON", str(ctx, x), x)
	}
}

// Syntax converts the possibly partially evaluated value into syntax. This
// can use used to print the value with package format.
func (v Value) Syntax(opts ...Option) ast.Node {
	// TODO: the default should ideally be simplified representation that
	// exactly represents the value. The latter can currently only be
	// ensured with Raw().
	if v.v == nil {
		return nil
	}
	var o options = getOptions(opts)
	// var inst *Instance

	p := export.Profile{
		Simplify:        !o.raw,
		TakeDefaults:    o.final,
		ShowOptional:    !o.omitOptional && !o.concrete,
		ShowDefinitions: !o.omitDefinitions && !o.concrete,
		ShowHidden:      !o.omitHidden && !o.concrete,
		ShowAttributes:  !o.omitAttrs,
		ShowDocs:        o.docs,
		ShowErrors:      o.showErrors,
		InlineImports:   o.inlineImports,
	}

	pkgID := v.instance().ID()

	bad := func(name string, err error) ast.Node {
		const format = `"%s: internal error
Error: %s

Profile:
%#v

Value:
%v

You could file a bug with the above information at:
    https://cuelang.org/issues/new?assignees=&labels=NeedsInvestigation&template=bug_report.md&title=.
`
		cg := &ast.CommentGroup{Doc: true}
		msg := fmt.Sprintf(format, name, err, p, v)
		for _, line := range strings.Split(msg, "\n") {
			cg.List = append(cg.List, &ast.Comment{Text: "// " + line})
		}
		x := &ast.BadExpr{}
		ast.AddComment(x, cg)
		return x
	}

	// var expr ast.Expr
	var err error
	var f *ast.File
	if o.concrete || o.final || o.resolveReferences {
		f, err = p.Vertex(v.idx, pkgID, v.v)
		if err != nil {
			return bad(`"cuelang.org/go/internal/core/export".Vertex`, err)
		}
	} else {
		p.AddPackage = true
		f, err = p.Def(v.idx, pkgID, v.v)
		if err != nil {
			return bad(`"cuelang.org/go/internal/core/export".Def`, err)
		}
	}

outer:
	for _, d := range f.Decls {
		switch d.(type) {
		case *ast.Package, *ast.ImportDecl:
			return f
		case *ast.CommentGroup, *ast.Attribute:
		default:
			break outer
		}
	}

	if len(f.Decls) == 1 {
		if e, ok := f.Decls[0].(*ast.EmbedDecl); ok {
			return e.Expr
		}
	}
	return &ast.StructLit{
		Elts: f.Decls,
	}
}

// Doc returns all documentation comments associated with the field from which
// the current value originates.
func (v Value) Doc() []*ast.CommentGroup {
	if v.v == nil {
		return nil
	}
	return export.ExtractDoc(v.v)
}

// Split returns a list of values from which v originated such that
// the unification of all these values equals v and for all returned values.
// It will also split unchecked unifications (embeddings), so unifying the
// split values may fail if actually unified.
// Source returns a non-nil value.
//
// Deprecated: use Expr.
func (v hiddenValue) Split() []Value {
	if v.v == nil {
		return nil
	}
	a := []Value{}
	for _, x := range v.v.Conjuncts {
		a = append(a, remakeValue(v, x.Env, x.Expr()))
	}
	return a
}

// Source returns the original node for this value. The return value may not
// be an [ast.Expr]. For instance, a struct kind may be represented by a
// struct literal, a field comprehension, or a file. It returns nil for
// computed nodes. Use [Value.Expr] to get all source values that apply to a field.
func (v Value) Source() ast.Node {
	if v.v == nil {
		return nil
	}
	if len(v.v.Conjuncts) == 1 {
		return v.v.Conjuncts[0].Source()
	}
	return v.v.Value().Source()
}

// If v exactly represents a package, BuildInstance returns
// the build instance corresponding to the value; otherwise it returns nil.
//
// The value returned by Value.ReferencePath will commonly represent
// a package.
func (v Value) BuildInstance() *build.Instance {
	if v.idx == nil {
		return nil
	}
	return v.idx.GetInstanceFromNode(v.v)
}

// Err returns the error represented by v or nil v is not an error.
func (v Value) Err() error {
	if err := v.checkKind(v.ctx(), adt.BottomKind); err != nil {
		return v.toErr(err)
	}
	return nil
}

// Pos returns position information.
//
// Use v.Expr to get positions for all conjuncts and disjuncts.
func (v Value) Pos() token.Pos {
	if v.v == nil {
		return token.NoPos
	}

	if src := v.Source(); src != nil {
		if pos := src.Pos(); pos != token.NoPos {
			return pos
		}
	}
	// Pick the most-concrete field.
	var p token.Pos
	for _, c := range v.v.Conjuncts {
		x := c.Elem()
		pp := pos(x)
		if pp == token.NoPos {
			continue
		}
		p = pp
		// Prefer struct conjuncts with actual fields.
		if s, ok := x.(*adt.StructLit); ok && len(s.Fields) > 0 {
			break
		}
	}
	return p
}

// TODO: IsFinal: this value can never be changed.

// IsClosed reports whether a list of struct is closed. It reports false when
// when the value is not a list or struct.
//
// Deprecated: use Allows(AnyString) and Allows(AnyIndex) or Kind/IncompleteKind.
func (v hiddenValue) IsClosed() bool {
	if v.v == nil {
		return false
	}
	switch v.Kind() {
	case ListKind:
		return v.v.IsClosedList()
	case StructKind:
		return !v.Allows(AnyString)
	}
	return false
}

// Allows reports whether a field with the given selector could be added to v.
//
// Allows does not take into account validators like list.MaxItems(4). This may
// change in the future.
func (v Value) Allows(sel Selector) bool {
	c := v.ctx()
	f := sel.sel.feature(c)
	return v.v.Accept(c, f)
}

// IsConcrete reports whether the current value is a concrete scalar value
// (not relying on default values), a terminal error, a list, or a struct.
// It does not verify that values of lists or structs are concrete themselves.
// To check whether there is a concrete default, use v.Default().IsConcrete().
func (v Value) IsConcrete() bool {
	if v.v == nil {
		return false // any is neither concrete, not a list or struct.
	}
	if b, ok := v.v.BaseValue.(*adt.Bottom); ok {
		return !b.IsIncomplete()
	}
	if !adt.IsConcrete(v.v) {
		return false
	}
	if v.IncompleteKind() == adt.ListKind && !v.v.IsClosedList() {
		return false
	}
	return true
}

// // Deprecated: IsIncomplete
// //
// // It indicates that the value cannot be fully evaluated due to
// // insufficient information.
// func (v Value) IsIncomplete() bool {
// 	panic("deprecated")
// }

// Exists reports whether this value existed in the configuration.
func (v Value) Exists() bool {
	if v.v == nil {
		return false
	}
	if err, ok := v.v.BaseValue.(*adt.Bottom); ok {
		return !err.NotExists
	}
	return true
}

func (v Value) checkKind(ctx *adt.OpContext, want adt.Kind) *adt.Bottom {
	if v.v == nil {
		return errNotExists
	}
	// TODO: use checkKind
	x := v.eval(ctx)
	if b, ok := x.(*adt.Bottom); ok {
		return b
	}
	k := x.Kind()
	if want != adt.BottomKind {
		if k&want == adt.BottomKind {
			return mkErr(v.idx, x, "cannot use value %v (type %s) as %s",
				ctx.Str(x), k, want)
		}
		if !adt.IsConcrete(x) {
			return mkErr(v.idx, x, adt.IncompleteError, "non-concrete value %v", k)
		}
	}
	return nil
}

func makeInt(v Value, x int64) Value {
	n := &adt.Num{K: adt.IntKind}
	n.X.SetInt64(int64(x))
	return remakeFinal(v, nil, n)
}

// Len returns the number of items of the underlying value.
// For lists it reports the capacity of the list. For structs it indicates the
// number of fields, for bytes the number of bytes.
func (v Value) Len() Value {
	if v.v != nil {
		switch x := v.eval(v.ctx()).(type) {
		case *adt.Vertex:
			if x.IsList() {
				n := &adt.Num{K: adt.IntKind}
				n.X.SetInt64(int64(len(x.Elems())))
				if x.IsClosedList() {
					return remakeFinal(v, nil, n)
				}
				// Note: this HAS to be a Conjunction value and cannot be
				// an adt.BinaryExpr, as the expressions would be considered
				// to be self-contained and unresolvable when evaluated
				// (can never become concrete).
				c := &adt.Conjunction{Values: []adt.Value{
					&adt.BasicType{K: adt.IntKind},
					&adt.BoundValue{Op: adt.GreaterEqualOp, Value: n},
				}}
				return remakeFinal(v, nil, c)

			}
		case *adt.Bytes:
			return makeInt(v, int64(len(x.B)))
		case *adt.String:
			return makeInt(v, int64(len([]rune(x.Str))))
		}
	}
	const msg = "len not supported for type %v"
	return remakeValue(v, nil, mkErr(v.idx, v.v, msg, v.Kind()))

}

// Elem returns the value of undefined element types of lists and structs.
//
// Deprecated: use LookupPath in combination with "AnyString" or "AnyIndex".
func (v hiddenValue) Elem() (Value, bool) {
	sel := AnyString
	if v.v.IsList() {
		sel = AnyIndex
	}
	x := v.LookupPath(MakePath(sel))
	return x, x.Exists()
}

// List creates an iterator over the values of a list or reports an error if
// v is not a list.
func (v Value) List() (Iterator, error) {
	v, _ = v.Default()
	ctx := v.ctx()
	if err := v.checkKind(ctx, adt.ListKind); err != nil {
		return Iterator{idx: v.idx, ctx: ctx}, v.toErr(err)
	}
	arcs := []field{}
	for _, a := range v.v.Elems() {
		if a.Label.IsInt() {
			arcs = append(arcs, field{arc: a})
		}
	}
	return Iterator{idx: v.idx, ctx: ctx, val: v, arcs: arcs}, nil
}

// Null reports an error if v is not null.
func (v Value) Null() error {
	v, _ = v.Default()
	if err := v.checkKind(v.ctx(), adt.NullKind); err != nil {
		return v.toErr(err)
	}
	return nil
}

// // IsNull reports whether v is null.
// func (v Value) IsNull() bool {
// 	return v.Null() == nil
// }

// Bool returns the bool value of v or false and an error if v is not a boolean.
func (v Value) Bool() (bool, error) {
	v, _ = v.Default()
	ctx := v.ctx()
	if err := v.checkKind(ctx, adt.BoolKind); err != nil {
		return false, v.toErr(err)
	}
	return v.eval(ctx).(*adt.Bool).B, nil
}

// String returns the string value if v is a string or an error otherwise.
func (v Value) String() (string, error) {
	v, _ = v.Default()
	ctx := v.ctx()
	if err := v.checkKind(ctx, adt.StringKind); err != nil {
		return "", v.toErr(err)
	}
	return v.eval(ctx).(*adt.String).Str, nil
}

// Bytes returns a byte slice if v represents a list of bytes or an error
// otherwise.
func (v Value) Bytes() ([]byte, error) {
	v, _ = v.Default()
	ctx := v.ctx()
	switch x := v.eval(ctx).(type) {
	case *adt.Bytes:
		return append([]byte(nil), x.B...), nil
	case *adt.String:
		return []byte(x.Str), nil
	}
	return nil, v.toErr(v.checkKind(ctx, adt.BytesKind|adt.StringKind))
}

// Reader returns a new Reader if v is a string or bytes type and an error
// otherwise.
func (v hiddenValue) Reader() (io.Reader, error) {
	v, _ = v.Default()
	ctx := v.ctx()
	switch x := v.eval(ctx).(type) {
	case *adt.Bytes:
		return bytes.NewReader(x.B), nil
	case *adt.String:
		return strings.NewReader(x.Str), nil
	}
	return nil, v.toErr(v.checkKind(ctx, adt.StringKind|adt.BytesKind))
}

// TODO: distinguish between optional, hidden, etc. Probably the best approach
// is to mark options in context and have a single function for creating
// a structVal.

// structVal returns an structVal or an error if v is not a struct.
func (v Value) structValData(ctx *adt.OpContext) (structValue, *adt.Bottom) {
	return v.structValOpts(ctx, options{
		omitHidden:      true,
		omitDefinitions: true,
		omitOptional:    true,
	})
}

func (v Value) structValFull(ctx *adt.OpContext) (structValue, *adt.Bottom) {
	return v.structValOpts(ctx, options{allowScalar: true})
}

// structVal returns an structVal or an error if v is not a struct.
func (v Value) structValOpts(ctx *adt.OpContext, o options) (s structValue, err *adt.Bottom) {
	v, _ = v.Default()

	obj := v.v

	switch b, ok := v.v.BaseValue.(*adt.Bottom); {
	case ok && b.IsIncomplete() && !o.concrete && !o.final:

	// TODO:
	// case o.allowScalar, !o.omitHidden, !o.omitDefinitions:
	// Allow scalar values if hidden or definition fields are requested?
	case o.allowScalar:
	default:
		obj, err = v.getStruct()
		if err != nil {
			return structValue{}, err
		}
	}

	features := export.VertexFeatures(ctx, obj)

	k := 0
	for _, f := range features {
		if f.IsLet() {
			continue
		}
		if f.IsDef() && (o.omitDefinitions || o.concrete) {
			continue
		}
		if f.IsHidden() && o.omitHidden {
			continue
		}
		if arc := obj.Lookup(f); arc == nil {
			if o.omitOptional {
				continue
			}
			// ensure it really exists.
			v := adt.Vertex{
				Parent: obj,
				Label:  f,
			}
			obj.MatchAndInsert(ctx, &v)
			if len(v.Conjuncts) == 0 {
				continue
			}
		}
		features[k] = f
		k++
	}
	features = features[:k]
	return structValue{ctx, v, obj, features}, nil
}

// Struct returns the underlying struct of a value or an error if the value
// is not a struct.
//
// Deprecated: use Fields.
func (v hiddenValue) Struct() (*Struct, error) {
	ctx := v.ctx()
	obj, err := v.structValOpts(ctx, options{})
	if err != nil {
		return nil, v.toErr(err)
	}
	return &Struct{obj}, nil
}

func (v Value) getStruct() (*adt.Vertex, *adt.Bottom) {
	ctx := v.ctx()
	if err := v.checkKind(ctx, adt.StructKind); err != nil {
		if !err.ChildError {
			return nil, err
		}
	}
	return v.v, nil
}

// Struct represents a CUE struct value.
type Struct struct {
	structValue
}

type hiddenStruct = Struct

// FieldInfo contains information about a struct field.
type FieldInfo struct {
	Selector string
	Name     string // Deprecated: use Selector
	Pos      int
	Value    Value

	IsDefinition bool
	IsOptional   bool
	IsHidden     bool
}

func (s *hiddenStruct) Len() int {
	return s.structValue.Len()
}

// field reports information about the ith field, i < o.Len().
func (s *hiddenStruct) Field(i int) FieldInfo {
	a, opt := s.at(i)
	ctx := s.v.ctx()

	v := makeChildValue(s.v, a)
	name := s.v.idx.LabelStr(a.Label)
	str := a.Label.SelectorString(ctx)
	return FieldInfo{str, name, i, v, a.Label.IsDef(), opt, a.Label.IsHidden()}
}

// FieldByName looks up a field for the given name. If isIdent is true, it will
// look up a definition or hidden field (starting with `_` or `_#`). Otherwise
// it interprets name as an arbitrary string for a regular field.
func (s *hiddenStruct) FieldByName(name string, isIdent bool) (FieldInfo, error) {
	f := s.v.idx.Label(name, isIdent)
	for i, a := range s.features {
		if a == f {
			return s.Field(i), nil
		}
	}
	return FieldInfo{}, errNotFound
}

// Fields creates an iterator over the Struct's fields.
func (s *hiddenStruct) Fields(opts ...Option) *Iterator {
	iter, _ := s.v.Fields(opts...)
	return iter
}

// Fields creates an iterator over v's fields if v is a struct or an error
// otherwise.
func (v Value) Fields(opts ...Option) (*Iterator, error) {
	o := options{omitDefinitions: true, omitHidden: true, omitOptional: true}
	o.updateOptions(opts)
	ctx := v.ctx()
	obj, err := v.structValOpts(ctx, o)
	if err != nil {
		return &Iterator{idx: v.idx, ctx: ctx}, v.toErr(err)
	}

	arcs := []field{}
	for i := range obj.features {
		arc, isOpt := obj.at(i)
		arcs = append(arcs, field{arc: arc, isOptional: isOpt})
	}
	return &Iterator{idx: v.idx, ctx: ctx, val: v, arcs: arcs}, nil
}

// Lookup reports the value at a path starting from v. The empty path returns v
// itself.
//
// The Exists() method can be used to verify if the returned value existed.
// Lookup cannot be used to look up hidden or optional fields or definitions.
//
// Deprecated: use LookupPath. At some point before v1.0.0, this method will
// be removed to be reused eventually for looking up a selector.
func (v hiddenValue) Lookup(path ...string) Value {
	ctx := v.ctx()
	for _, k := range path {
		// TODO(eval) TODO(error): always search in full data and change error
		// message if a field is found but is of the incorrect type.
		obj, err := v.structValData(ctx)
		if err != nil {
			// TODO: return a Value at the same location and a new error?
			return newErrValue(v, err)
		}
		v = obj.Lookup(k)
	}
	return v
}

// Path returns the path to this value from the root of an Instance.
//
// This is currently only defined for values that have a fixed path within
// a configuration, and thus not those that are derived from Elem, Template,
// or programmatically generated values such as those returned by Unify.
func (v Value) Path() Path {
	if v.v == nil {
		return Path{}
	}
	return Path{path: appendPath(nil, v)}
}

// Path computes the sequence of Features leading from the root to of the
// instance to this Vertex.
func appendPath(a []Selector, v Value) []Selector {
	if p := v.parent(); p.v != nil {
		a = appendPath(a, p)
	}

	if v.v.Label == 0 {
		// A Label may be 0 for programmatically inserted nodes.
		return a
	}

	f := v.v.Label
	if index := f.Index(); index == adt.MaxIndex {
		return append(a, Selector{anySelector(f)})
	}

	var sel selector
	switch t := f.Typ(); t {
	case adt.IntLabel:
		sel = indexSelector(f)
	case adt.DefinitionLabel:
		sel = definitionSelector(f.SelectorString(v.idx))

	case adt.HiddenDefinitionLabel, adt.HiddenLabel:
		sel = scopedSelector{
			name: f.IdentString(v.idx),
			pkg:  f.PkgID(v.idx),
		}

	case adt.StringLabel:
		sel = stringSelector(f.StringValue(v.idx))

	default:
		panic(fmt.Sprintf("unsupported label type %v", t))
	}
	return append(a, Selector{sel})
}

// LookupDef is equal to LookupPath(MakePath(Def(name))).
//
// Deprecated: use LookupPath.
func (v hiddenValue) LookupDef(name string) Value {
	return v.LookupPath(MakePath(Def(name)))
}

var errNotFound = errors.Newf(token.NoPos, "field not found")

// FieldByName looks up a field for the given name. If isIdent is true, it will
// look up a definition or hidden field (starting with `_` or `_#`). Otherwise
// it interprets name as an arbitrary string for a regular field.
//
// Deprecated: use LookupPath.
func (v hiddenValue) FieldByName(name string, isIdent bool) (f FieldInfo, err error) {
	s, err := v.Struct()
	if err != nil {
		return f, err
	}
	return s.FieldByName(name, isIdent)
}

// LookupField reports information about a field of v.
//
// Deprecated: use LookupPath
func (v hiddenValue) LookupField(name string) (FieldInfo, error) {
	s, err := v.Struct()
	if err != nil {
		// TODO: return a Value at the same location and a new error?
		return FieldInfo{}, err
	}
	f, err := s.FieldByName(name, true)
	if err != nil {
		return f, err
	}
	if f.IsHidden {
		return f, errNotFound
	}
	return f, err
}

// TODO: expose this API?
//
// // EvalExpr evaluates an expression within the scope of v, which must be
// // a struct.
// //
// // Expressions may refer to builtin packages if they can be uniquely identified.
// func (v Value) EvalExpr(expr ast.Expr) Value {
// 	ctx := v.ctx()
// 	result := evalExpr(ctx, v.eval(ctx), expr)
// 	return newValueRoot(ctx, result)
// }

// Fill creates a new value by unifying v with the value of x at the given path.
//
// Values may be any Go value that can be converted to CUE, an ast.Expr or
// a Value. In the latter case, it will panic if the Value is not from the same
// Runtime.
//
// Any reference in v referring to the value at the given path will resolve
// to x in the newly created value. The resulting value is not validated.
//
// Deprecated: use FillPath.
func (v hiddenValue) Fill(x interface{}, path ...string) Value {
	if v.v == nil {
		return v
	}
	selectors := make([]Selector, len(path))
	for i, p := range path {
		selectors[i] = Str(p)
	}
	return v.FillPath(MakePath(selectors...), x)
}

// FillPath creates a new value by unifying v with the value of x at the given
// path.
//
// If x is an cue/ast.Expr, it will be evaluated within the context of the
// given path: identifiers that are not resolved within the expression are
// resolved as if they were defined at the path position.
//
// If x is a Value, it will be used as is. It panics if x is not created
// from the same Runtime as v.
//
// Otherwise, the given Go value will be converted to CUE using the same rules
// as Context.Encode.
//
// Any reference in v referring to the value at the given path will resolve to x
// in the newly created value. The resulting value is not validated.
func (v Value) FillPath(p Path, x interface{}) Value {
	if v.v == nil {
		// TODO: panic here?
		return v
	}
	ctx := v.ctx()
	if err := p.Err(); err != nil {
		return newErrValue(v, mkErr(v.idx, nil, 0, "invalid path: %v", err))
	}
	var expr adt.Expr
	switch x := x.(type) {
	case Value:
		if v.idx != x.idx {
			panic("values are not from the same runtime")
		}
		expr = x.v
	case ast.Expr:
		n := getScopePrefix(v, p)
		// TODO: inject import path of current package?
		expr = resolveExpr(ctx, n, x)
	default:
		expr = convert.GoValueToValue(ctx, x, true)
	}
	for i := len(p.path) - 1; i >= 0; i-- {
		switch sel := p.path[i]; sel.Type() {
		case StringLabel | PatternConstraint:
			expr = &adt.StructLit{Decls: []adt.Decl{
				&adt.BulkOptionalField{
					Filter: &adt.BasicType{K: adt.StringKind},
					Value:  expr,
				},
			}}

		case IndexLabel | PatternConstraint:
			expr = &adt.ListLit{Elems: []adt.Elem{
				&adt.Ellipsis{Value: expr},
			}}

		case IndexLabel:
			i := sel.Index()
			list := &adt.ListLit{}
			any := &adt.Top{}
			// TODO(perf): make this a constant thing. This will be possible with the query extension.
			for k := 0; k < i; k++ {
				list.Elems = append(list.Elems, any)
			}
			list.Elems = append(list.Elems, expr, &adt.Ellipsis{})
			expr = list

		default:
			var d adt.Decl
			if sel.ConstraintType() == OptionalConstraint {
				d = &adt.OptionalField{
					Label: sel.sel.feature(v.idx),
					Value: expr,
				}
			} else {
				d = &adt.Field{
					Label: sel.sel.feature(v.idx),
					Value: expr,
				}
			}
			expr = &adt.StructLit{Decls: []adt.Decl{d}}
		}
	}
	n := &adt.Vertex{}
	n.AddConjunct(adt.MakeRootConjunct(nil, expr))
	n.Finalize(ctx)
	w := makeValue(v.idx, n, v.parent_)
	return v.Unify(w)
}

// Template returns a function that represents the template definition for a
// struct in a configuration file. It returns nil if v is not a struct kind or
// if there is no template associated with the struct.
//
// The returned function returns the value that would be unified with field
// given its name.
//
// Deprecated: use LookupPath in combination with using optional selectors.
func (v hiddenValue) Template() func(label string) Value {
	if v.v == nil {
		return nil
	}

	types := v.v.OptionalTypes()
	if types&(adt.HasAdditional|adt.HasPattern) == 0 {
		return nil
	}

	return func(label string) Value {
		return v.LookupPath(MakePath(Str(label).Optional()))
	}
}

// Subsume reports nil when w is an instance of v or an error otherwise.
//
// Without options, the entire value is considered for assumption, which means
// Subsume tests whether  v is a backwards compatible (newer) API version of w.
//
// Use the Final option to check subsumption if a w is known to be final, and
// should assumed to be closed.
//
// Use the Raw option to do a low-level subsumption, taking defaults into
// account.
//
// Value v and w must be obtained from the same build. TODO: remove this
// requirement.
func (v Value) Subsume(w Value, opts ...Option) error {
	o := getOptions(opts)
	p := subsume.CUE
	switch {
	case o.final && o.ignoreClosedness:
		p = subsume.FinalOpen
	case o.final:
		p = subsume.Final
	case o.ignoreClosedness:
		p = subsume.API
	}
	if !o.raw {
		p.Defaults = true
	}
	ctx := v.ctx()
	return p.Value(ctx, v.v, w.v)
}

// Deprecated: use Subsume.
//
// Subsumes reports whether w is an instance of v.
//
// Without options, Subsumes checks whether v is a backwards compatbile schema
// of w.
//
// By default, Subsumes tests whether two values are compatible
// Value v and w must be obtained from the same build.
// TODO: remove this requirement.
func (v hiddenValue) Subsumes(w Value) bool {
	ctx := v.ctx()
	p := subsume.Profile{Defaults: true}
	return p.Check(ctx, v.v, w.v)
}

func allowed(ctx *adt.OpContext, parent, n *adt.Vertex) *adt.Bottom {
	if !parent.IsClosedList() && !parent.IsClosedStruct() {
		return nil
	}

	for _, a := range n.Arcs {
		if !parent.Accept(ctx, a.Label) {
			defer ctx.PopArc(ctx.PushArc(parent))
			label := a.Label.SelectorString(ctx)
			parent.Accept(ctx, a.Label)
			return ctx.NewErrf("field not allowed: %s", label)
		}
	}
	return nil
}

func addConjuncts(dst, src *adt.Vertex) {
	c := adt.MakeRootConjunct(nil, src)
	if src.Closed {
		var root adt.CloseInfo
		c.CloseInfo = root.SpawnRef(src, src.Closed, nil)
	}
	dst.AddConjunct(c)
}

// Unify reports the greatest lower bound of v and w.
//
// Value v and w must be obtained from the same build.
// TODO: remove this requirement.
func (v Value) Unify(w Value) Value {
	if v.v == nil {
		return w
	}
	if w.v == nil || w.v == v.v {
		return v
	}

	n := &adt.Vertex{}
	addConjuncts(n, v.v)
	addConjuncts(n, w.v)

	ctx := newContext(v.idx)
	n.Finalize(ctx)

	n.Parent = v.v.Parent
	n.Label = v.v.Label
	n.Closed = v.v.Closed || w.v.Closed

	if err := n.Err(ctx, adt.Finalized); err != nil {
		return makeValue(v.idx, n, v.parent_)
	}
	if err := allowed(ctx, v.v, n); err != nil {
		return newErrValue(w, err)
	}
	if err := allowed(ctx, w.v, n); err != nil {
		return newErrValue(v, err)
	}

	return makeValue(v.idx, n, v.parent_)
}

// UnifyAccept is as v.Unify(w), but will disregard any field that is allowed
// in the Value accept.
func (v Value) UnifyAccept(w Value, accept Value) Value {
	if v.v == nil {
		return w
	}
	if w.v == nil {
		return v
	}
	if accept.v == nil {
		panic("accept must exist")
	}

	n := &adt.Vertex{}
	n.AddConjunct(adt.MakeRootConjunct(nil, v.v))
	n.AddConjunct(adt.MakeRootConjunct(nil, w.v))

	ctx := newContext(v.idx)
	n.Finalize(ctx)

	n.Parent = v.v.Parent
	n.Label = v.v.Label

	if err := n.Err(ctx, adt.Finalized); err != nil {
		return makeValue(v.idx, n, v.parent_)
	}
	if err := allowed(ctx, accept.v, n); err != nil {
		return newErrValue(accept, err)
	}

	return makeValue(v.idx, n, v.parent_)
}

// Equals reports whether two values are equal, ignoring optional fields.
// The result is undefined for incomplete values.
func (v Value) Equals(other Value) bool {
	if v.v == nil || other.v == nil {
		return false
	}
	return adt.Equal(v.ctx(), v.v, other.v, 0)
}

func (v Value) instance() *Instance {
	if v.v == nil {
		return nil
	}
	return getImportFromNode(v.idx, v.v)
}

// Reference returns the instance and path referred to by this value such that
// inst.Lookup(path) resolves to the same value, or no path if this value is not
// a reference. If a reference contains index selection (foo[bar]), it will
// only return a reference if the index resolves to a concrete value.
//
// Deprecated: use ReferencePath
func (v hiddenValue) Reference() (inst *Instance, path []string) {
	root, p := v.ReferencePath()
	if !root.Exists() {
		return nil, nil
	}

	inst = getImportFromNode(v.idx, root.v)
	for _, sel := range p.Selectors() {
		switch x := sel.sel.(type) {
		case stringSelector:
			path = append(path, string(x))
		default:
			path = append(path, sel.String())
		}
	}

	return inst, path
}

// ReferencePath returns the value and path referred to by this value such that
// value.LookupPath(path) resolves to the same value, or no path if this value
// is not a reference.
func (v Value) ReferencePath() (root Value, p Path) {
	// TODO: don't include references to hidden fields.
	if v.v == nil || len(v.v.Conjuncts) != 1 {
		return Value{}, Path{}
	}
	ctx := v.ctx()
	c := v.v.Conjuncts[0]

	x, path := reference(v.idx, ctx, c.Env, c.Expr())
	if x == nil {
		return Value{}, Path{}
	}
	// NOTE: due to structure sharing, the path of the referred node may end
	// up different from the one explicitly pointed to. The value will be the
	// same, but the scope may differ.
	// TODO(structureshare): see if we can construct the original path. This
	// only has to be done if structures are being shared.
	return makeValue(v.idx, x, nil), Path{path: path}
}

func reference(rt *runtime.Runtime, c *adt.OpContext, env *adt.Environment, r adt.Expr) (inst *adt.Vertex, path []Selector) {
	ctx := c
	defer ctx.PopState(ctx.PushState(env, r.Source()))

	switch x := r.(type) {
	// TODO: do we need to handle Vertex as well, in case this is hard-wired?
	// Probably not, as this results from dynamic content.

	case *adt.NodeLink:
		// TODO: consider getting rid of NodeLink.
		inst, path = mkPath(rt, nil, x.Node)

	case *adt.FieldReference:
		env := ctx.Env(x.UpCount)
		inst, path = mkPath(rt, nil, env.Vertex)
		path = appendSelector(path, featureToSel(x.Label, rt))

	case *adt.LabelReference:
		env := ctx.Env(x.UpCount)
		return mkPath(rt, nil, env.Vertex)

	case *adt.DynamicReference:
		env := ctx.Env(x.UpCount)
		inst, path = mkPath(rt, nil, env.Vertex)
		v, _ := ctx.Evaluate(env, x.Label)
		path = appendSelector(path, valueToSel(v))

	case *adt.ImportReference:
		inst = rt.LoadImport(rt.LabelStr(x.ImportPath))

	case *adt.SelectorExpr:
		inst, path = reference(rt, c, env, x.X)
		path = appendSelector(path, featureToSel(x.Sel, rt))

	case *adt.IndexExpr:
		inst, path = reference(rt, c, env, x.X)
		v, _ := ctx.Evaluate(env, x.Index)
		path = appendSelector(path, valueToSel(v))
	}
	if inst == nil {
		return nil, nil
	}
	return inst, path
}

func mkPath(r *runtime.Runtime, a []Selector, v *adt.Vertex) (root *adt.Vertex, path []Selector) {
	if v.Parent == nil {
		return v, a
	}
	root, path = mkPath(r, a, v.Parent)
	path = appendSelector(path, featureToSel(v.Label, r))
	return root, path
}

type options struct {
	concrete          bool // enforce that values are concrete
	raw               bool // show original values
	hasHidden         bool
	omitHidden        bool
	omitDefinitions   bool
	omitOptional      bool
	omitAttrs         bool
	inlineImports     bool
	resolveReferences bool
	showErrors        bool
	final             bool
	ignoreClosedness  bool // used for comparing APIs
	docs              bool
	disallowCycles    bool // implied by concrete
	allowScalar       bool
}

// An Option defines modes of evaluation.
type Option option

type option func(p *options)

// Final indicates a value is final. It implicitly closes all structs and lists
// in a value and selects defaults.
func Final() Option {
	return func(o *options) {
		o.final = true
		o.omitDefinitions = true
		o.omitOptional = true
		o.omitHidden = true
	}
}

// Schema specifies the input is a Schema. Used by Subsume.
func Schema() Option {
	return func(o *options) {
		o.ignoreClosedness = true
	}
}

// Concrete ensures that all values are concrete.
//
// For Validate this means it returns an error if this is not the case.
// In other cases a non-concrete value will be replaced with an error.
func Concrete(concrete bool) Option {
	return func(p *options) {
		if concrete {
			p.concrete = true
			p.final = true
			if !p.hasHidden {
				p.omitHidden = true
				p.omitDefinitions = true
			}
		}
	}
}

// InlineImports causes references to values within imported packages to be
// inlined. References to builtin packages are not inlined.
func InlineImports(expand bool) Option {
	return func(p *options) { p.inlineImports = expand }
}

// DisallowCycles forces validation in the presence of cycles, even if
// non-concrete values are allowed. This is implied by Concrete(true).
func DisallowCycles(disallow bool) Option {
	return func(p *options) { p.disallowCycles = disallow }
}

// ResolveReferences forces the evaluation of references when outputting.
//
// Deprecated: Syntax will now always attempt to resolve dangling references and
// make the output self-contained. When Final or Concrete is used, it will
// already attempt to resolve all references.
// See also InlineImports.
func ResolveReferences(resolve bool) Option {
	return func(p *options) {
		p.resolveReferences = resolve

		// ResolveReferences is implemented as a Value printer, rather than
		// a definition printer, even though it should be more like the latter.
		// To reflect this we convert incomplete errors to their original
		// expression.
		//
		// TODO: ShowErrors mostly shows incomplete errors, even though this is
		// just an approximation. There seems to be some inconsistencies as to
		// when child errors are marked as such, making the conversion somewhat
		// inconsistent. This option is conservative, though.
		p.showErrors = true
	}
}

// ErrorsAsValues treats errors as a regular value, including them at the
// location in the tree where they occur, instead of interpreting them as a
// configuration-wide failure that is returned instead of root value.
// Used by Syntax.
func ErrorsAsValues(show bool) Option {
	return func(p *options) { p.showErrors = show }
}

// Raw tells Syntax to generate the value as is without any simplifications.
func Raw() Option {
	return func(p *options) { p.raw = true }
}

// All indicates that all fields and values should be included in processing
// even if they can be elided or omitted.
func All() Option {
	return func(p *options) {
		p.omitAttrs = false
		p.omitHidden = false
		p.omitDefinitions = false
		p.omitOptional = false
	}
}

// Docs indicates whether docs should be included.
func Docs(include bool) Option {
	return func(p *options) { p.docs = true }
}

// Definitions indicates whether definitions should be included.
//
// Definitions may still be included for certain functions if they are referred
// to by other other values.
func Definitions(include bool) Option {
	return func(p *options) {
		p.hasHidden = true
		p.omitDefinitions = !include
	}
}

// Hidden indicates that definitions and hidden fields should be included.
func Hidden(include bool) Option {
	return func(p *options) {
		p.hasHidden = true
		p.omitHidden = !include
		p.omitDefinitions = !include
	}
}

// Optional indicates that optional fields should be included.
func Optional(include bool) Option {
	return func(p *options) { p.omitOptional = !include }
}

// Attributes indicates that attributes should be included.
func Attributes(include bool) Option {
	return func(p *options) { p.omitAttrs = !include }
}

func getOptions(opts []Option) (o options) {
	o.updateOptions(opts)
	return
}

func (o *options) updateOptions(opts []Option) {
	for _, fn := range opts {
		fn(o)
	}
}

// Validate reports any errors, recursively. The returned error may represent
// more than one error, retrievable with errors.Errors, if more than one
// exists.
//
// Note that by default not all errors are reported, unless options like
// Concrete are used.
func (v Value) Validate(opts ...Option) error {
	o := options{}
	o.updateOptions(opts)

	cfg := &validate.Config{
		Concrete:       o.concrete,
		DisallowCycles: o.disallowCycles,
		AllErrors:      true,
	}

	b := validate.Validate(v.ctx(), v.v, cfg)
	if b != nil {
		return v.toErr(b)
	}
	return nil
}

// Walk descends into all values of v, calling f. If f returns false, Walk
// will not descent further. It only visits values that are part of the data
// model, so this excludes optional fields, hidden fields, and definitions.
func (v Value) Walk(before func(Value) bool, after func(Value)) {
	ctx := v.ctx()
	switch v.Kind() {
	case StructKind:
		if before != nil && !before(v) {
			return
		}
		obj, _ := v.structValData(ctx)
		for i := 0; i < obj.Len(); i++ {
			_, v := obj.At(i)
			v.Walk(before, after)
		}
	case ListKind:
		if before != nil && !before(v) {
			return
		}
		list, _ := v.List()
		for list.Next() {
			list.Value().Walk(before, after)
		}
	default:
		if before != nil {
			before(v)
		}
	}
	if after != nil {
		after(v)
	}
}

// Expr reports the operation of the underlying expression and the values it
// operates on.
//
// For unary expressions, it returns the single value of the expression.
//
// For binary expressions it returns first the left and right value, in that
// order. For associative operations however, (for instance '&' and '|'), it may
// return more than two values, where the operation is to be applied in
// sequence.
//
// For selector and index expressions it returns the subject and then the index.
// For selectors, the index is the string value of the identifier.
//
// For interpolations it returns a sequence of values to be concatenated, some
// of which will be literal strings and some unevaluated expressions.
//
// A builtin call expression returns the value of the builtin followed by the
// args of the call.
func (v Value) Expr() (Op, []Value) {
	// TODO: return v if this is complete? Yes for now
	if v.v == nil {
		return NoOp, nil
	}

	var expr adt.Expr
	var env *adt.Environment

	if v.v.IsData() {
		expr = v.v.Value()

	} else {
		switch len(v.v.Conjuncts) {
		case 0:
			if v.v.BaseValue == nil {
				return NoOp, []Value{makeValue(v.idx, v.v, v.parent_)} // TODO: v?
			}
			expr = v.v.Value()

		case 1:
			// the default case, processed below.
			c := v.v.Conjuncts[0]
			env = c.Env
			expr = c.Expr()
			if w, ok := expr.(*adt.Vertex); ok {
				return Value{v.idx, w, v.parent_}.Expr()
			}

		default:
			a := []Value{}
			ctx := v.ctx()
			for _, c := range v.v.Conjuncts {
				// Keep parent here. TODO: do we need remove the requirement
				// from other conjuncts?
				n := &adt.Vertex{
					Parent: v.v.Parent,
					Label:  v.v.Label,
				}
				n.AddConjunct(c)
				n.Finalize(ctx)
				a = append(a, makeValue(v.idx, n, v.parent_))
			}
			return adt.AndOp, a
		}
	}

	// TODO: replace appends with []Value{}. For not leave.
	a := []Value{}
	op := NoOp
	switch x := expr.(type) {
	case *adt.BinaryExpr:
		a = append(a, remakeValue(v, env, x.X))
		a = append(a, remakeValue(v, env, x.Y))
		op = x.Op
	case *adt.UnaryExpr:
		a = append(a, remakeValue(v, env, x.X))
		op = x.Op
	case *adt.BoundExpr:
		a = append(a, remakeValue(v, env, x.Expr))
		op = x.Op
	case *adt.BoundValue:
		a = append(a, remakeValue(v, env, x.Value))
		op = x.Op
	case *adt.Conjunction:
		// pre-expanded unification
		for _, conjunct := range x.Values {
			a = append(a, remakeValue(v, env, conjunct))
		}
		op = AndOp
	case *adt.Disjunction:
		count := 0
	outer:
		for i, disjunct := range x.Values {
			if i < x.NumDefaults {
				for _, n := range x.Values[x.NumDefaults:] {
					if subsume.Simplify.Value(v.ctx(), n, disjunct) == nil {
						continue outer
					}
				}
			}
			count++
			a = append(a, remakeValue(v, env, disjunct))
		}
		if count > 1 {
			op = OrOp
		}

	case *adt.DisjunctionExpr:
		// Filter defaults that are subsumed by another value.
		count := 0
	outerExpr:
		for _, disjunct := range x.Values {
			if disjunct.Default {
				for _, n := range x.Values {
					a := adt.Vertex{
						Label: v.v.Label,
					}
					b := a
					a.AddConjunct(adt.MakeRootConjunct(env, n.Val))
					b.AddConjunct(adt.MakeRootConjunct(env, disjunct.Val))

					ctx := eval.NewContext(v.idx, nil)
					ctx.Unify(&a, adt.Finalized)
					ctx.Unify(&b, adt.Finalized)
					if allowed(ctx, v.v, &b) != nil {
						// Everything subsumed bottom
						continue outerExpr
					}
					if allowed(ctx, v.v, &a) != nil {
						// An error doesn't subsume anything except another error.
						continue
					}
					a.Parent = v.v.Parent
					if !n.Default && subsume.Simplify.Value(ctx, &a, &b) == nil {
						continue outerExpr
					}
				}
			}
			count++
			a = append(a, remakeValue(v, env, disjunct.Val))
		}
		if count > 1 {
			op = adt.OrOp
		}

	case *adt.Interpolation:
		for _, p := range x.Parts {
			a = append(a, remakeValue(v, env, p))
		}
		op = InterpolationOp

	case *adt.FieldReference:
		// TODO: allow hard link
		ctx := v.ctx()
		f := ctx.PushState(env, x.Src)
		env := ctx.Env(x.UpCount)
		a = append(a, remakeValue(v, nil, &adt.NodeLink{Node: env.Vertex}))
		a = append(a, remakeValue(v, nil, ctx.NewString(x.Label.SelectorString(ctx))))
		_ = ctx.PopState(f)
		op = SelectorOp

	case *adt.SelectorExpr:
		a = append(a, remakeValue(v, env, x.X))
		// A string selector is quoted.
		a = append(a, remakeValue(v, env, &adt.String{
			Str: x.Sel.SelectorString(v.idx),
		}))
		op = SelectorOp

	case *adt.IndexExpr:
		a = append(a, remakeValue(v, env, x.X))
		a = append(a, remakeValue(v, env, x.Index))
		op = IndexOp
	case *adt.SliceExpr:
		a = append(a, remakeValue(v, env, x.X))
		a = append(a, remakeValue(v, env, x.Lo))
		a = append(a, remakeValue(v, env, x.Hi))
		op = SliceOp
	case *adt.CallExpr:
		// Interpret "and" and "or" builtin semantically.
		if fn, ok := x.Fun.(*adt.Builtin); ok && len(x.Args) == 1 &&
			(fn.Name == "or" || fn.Name == "and") {

			iter, _ := remakeValue(v, env, x.Args[0]).List()
			for iter.Next() {
				a = append(a, iter.Value())
			}

			op = OrOp
			if fn.Name == "and" {
				op = AndOp
			}

			if len(a) == 0 {
				// Mimic semantics of builtin.
				switch op {
				case AndOp:
					a = append(a, remakeValue(v, env, &adt.Top{}))
				case OrOp:
					a = append(a, remakeValue(v, env, &adt.Bottom{
						Code: adt.IncompleteError,
						Err:  errors.Newf(x.Src.Fun.Pos(), "empty list in call to or"),
					}))
				}
				op = NoOp
			}
			break
		}
		a = append(a, remakeValue(v, env, x.Fun))
		for _, arg := range x.Args {
			a = append(a, remakeValue(v, env, arg))
		}
		op = CallOp
	case *adt.BuiltinValidator:
		a = append(a, remakeValue(v, env, x.Builtin))
		for _, arg := range x.Args {
			a = append(a, remakeValue(v, env, arg))
		}
		op = CallOp

	case *adt.StructLit:
		hasEmbed := false
		fields := []adt.Decl{}
		for _, d := range x.Decls {
			switch d.(type) {
			default:
				fields = append(fields, d)
			case adt.Value:
				fields = append(fields, d)
			case adt.Expr:
				hasEmbed = true
			}
		}

		if !hasEmbed {
			a = append(a, v)
			break
		}

		ctx := v.ctx()

		n := v.v

		if len(fields) > 0 {
			n = &adt.Vertex{
				Parent: v.v.Parent,
				Label:  v.v.Label,
			}

			s := &adt.StructLit{}
			if k := v.v.Kind(); k != adt.StructKind && k != BottomKind {
				// TODO: we should also add such a declaration for embeddings
				// of structs with definitions. However, this is currently
				// also not supported at the CUE level. If we do, it may be
				// best handled with a special mode of unification.
				s.Decls = append(s.Decls, &adt.BasicType{K: k})
			}
			s.Decls = append(s.Decls, fields...)
			c := adt.MakeRootConjunct(env, s)
			n.AddConjunct(c)
			n.Finalize(ctx)
			n.Parent = v.v.Parent
		}

		// Simulate old embeddings.
		envEmbed := &adt.Environment{
			Up:     env,
			Vertex: n,
		}

		for _, d := range x.Decls {
			switch x := d.(type) {
			case adt.Value:
			case adt.Expr:
				// embedding
				n := &adt.Vertex{Label: v.v.Label}
				c := adt.MakeRootConjunct(envEmbed, x)
				n.AddConjunct(c)
				n.Finalize(ctx)
				n.Parent = v.v.Parent
				a = append(a, makeValue(v.idx, n, v.parent_))
			}
		}

		// Could be done earlier, but keep struct with fields at end.
		if len(fields) > 0 {
			a = append(a, makeValue(v.idx, n, v.parent_))
		}

		if len(a) == 1 {
			return a[0].Expr()
		}
		op = adt.AndOp

	default:
		a = append(a, v)
	}
	return op, a
}
