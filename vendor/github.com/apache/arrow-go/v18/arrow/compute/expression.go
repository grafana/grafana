// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

//go:build go1.18

package compute

import (
	"bytes"
	"encoding/hex"
	"errors"
	"fmt"
	"hash/maphash"
	"reflect"
	"strconv"
	"strings"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/array"
	"github.com/apache/arrow-go/v18/arrow/compute/exec"
	"github.com/apache/arrow-go/v18/arrow/compute/internal/kernels"
	"github.com/apache/arrow-go/v18/arrow/internal/debug"
	"github.com/apache/arrow-go/v18/arrow/ipc"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/arrow/scalar"
)

var hashSeed = maphash.MakeSeed()

// Expression is an interface for mapping one datum to another. An expression
// is one of:
//
//	A literal Datum
//	A reference to a single (potentially nested) field of an input Datum
//	A call to a compute function, with arguments specified by other Expressions
//
// Deprecated: use substrait-go expressions instead.
type Expression interface {
	fmt.Stringer
	// IsBound returns true if this expression has been bound to a particular
	// Datum and/or Schema.
	IsBound() bool
	// IsScalarExpr returns true if this expression is composed only of scalar
	// literals, field references and calls to scalar functions.
	IsScalarExpr() bool
	// IsNullLiteral returns true if this expression is a literal and entirely
	// null.
	IsNullLiteral() bool
	// IsSatisfiable returns true if this expression could evaluate to true
	IsSatisfiable() bool
	// FieldRef returns a pointer to the underlying field reference, or nil if
	// this expression is not a field reference.
	FieldRef() *FieldRef
	// Type returns the datatype this expression will evaluate to.
	Type() arrow.DataType

	Hash() uint64
	Equals(Expression) bool

	// Release releases the underlying bound C++ memory that is allocated when
	// a Bind is performed. Any bound expression should get released to ensure
	// no memory leaks.
	Release()
}

func printDatum(datum Datum) string {
	switch datum := datum.(type) {
	case *ScalarDatum:
		if !datum.Value.IsValid() {
			return "null"
		}

		switch datum.Type().ID() {
		case arrow.STRING, arrow.LARGE_STRING:
			return strconv.Quote(datum.Value.(scalar.BinaryScalar).String())
		case arrow.BINARY, arrow.FIXED_SIZE_BINARY, arrow.LARGE_BINARY:
			return `"` + strings.ToUpper(hex.EncodeToString(datum.Value.(scalar.BinaryScalar).Data())) + `"`
		}

		return datum.Value.String()
	default:
		return datum.String()
	}
}

// Literal is an expression denoting a literal Datum which could be any value
// as a scalar, an array, or so on.
//
// Deprecated: use substrait-go expressions Literal instead.
type Literal struct {
	Literal Datum
}

func (Literal) FieldRef() *FieldRef     { return nil }
func (l *Literal) String() string       { return printDatum(l.Literal) }
func (l *Literal) Type() arrow.DataType { return l.Literal.(ArrayLikeDatum).Type() }
func (l *Literal) IsBound() bool        { return l.Type() != nil }
func (l *Literal) IsScalarExpr() bool   { return l.Literal.Kind() == KindScalar }

func (l *Literal) Equals(other Expression) bool {
	if rhs, ok := other.(*Literal); ok {
		return l.Literal.Equals(rhs.Literal)
	}
	return false
}

func (l *Literal) IsNullLiteral() bool {
	if ad, ok := l.Literal.(ArrayLikeDatum); ok {
		return ad.NullN() == ad.Len()
	}
	return true
}

func (l *Literal) IsSatisfiable() bool {
	if l.IsNullLiteral() {
		return false
	}

	if sc, ok := l.Literal.(*ScalarDatum); ok && sc.Type().ID() == arrow.BOOL {
		return sc.Value.(*scalar.Boolean).Value
	}

	return true
}

func (l *Literal) Hash() uint64 {
	if l.IsScalarExpr() {
		return scalar.Hash(hashSeed, l.Literal.(*ScalarDatum).Value)
	}
	return 0
}

func (l *Literal) Release() {
	l.Literal.Release()
}

// Parameter represents a field reference and needs to be bound in order to determine
// its type and shape.
//
// Deprecated: use substrait-go field references instead.
type Parameter struct {
	ref *FieldRef

	// post bind props
	dt    arrow.DataType
	index int
}

func (Parameter) IsNullLiteral() bool     { return false }
func (p *Parameter) Type() arrow.DataType { return p.dt }
func (p *Parameter) IsBound() bool        { return p.Type() != nil }
func (p *Parameter) IsScalarExpr() bool   { return p.ref != nil }
func (p *Parameter) IsSatisfiable() bool  { return p.Type() == nil || p.Type().ID() != arrow.NULL }
func (p *Parameter) FieldRef() *FieldRef  { return p.ref }
func (p *Parameter) Hash() uint64         { return p.ref.Hash(hashSeed) }

func (p *Parameter) String() string {
	switch {
	case p.ref.IsName():
		return p.ref.Name()
	case p.ref.IsFieldPath():
		return p.ref.FieldPath().String()
	default:
		return p.ref.String()
	}
}

func (p *Parameter) Equals(other Expression) bool {
	if rhs, ok := other.(*Parameter); ok {
		return p.ref.Equals(*rhs.ref)
	}

	return false
}

func (p *Parameter) Release() {}

type comparisonType int8

const (
	compNA comparisonType = 0
	compEQ comparisonType = 1
	compLT comparisonType = 2
	compGT comparisonType = 4
	compNE comparisonType = compLT | compGT
	compLE comparisonType = compLT | compEQ
	compGE comparisonType = compGT | compEQ
)

//lint:ignore U1000 ignore that this is unused for now
func (c comparisonType) name() string {
	switch c {
	case compEQ:
		return "equal"
	case compLT:
		return "less"
	case compGT:
		return "greater"
	case compNE:
		return "not_equal"
	case compLE:
		return "less_equal"
	case compGE:
		return "greater_equal"
	}
	return "na"
}

func (c comparisonType) getOp() string {
	switch c {
	case compEQ:
		return "=="
	case compLT:
		return "<"
	case compGT:
		return ">"
	case compNE:
		return "!="
	case compLE:
		return "<="
	case compGE:
		return ">="
	}
	debug.Assert(false, "invalid getop")
	return ""
}

var compmap = map[string]comparisonType{
	"equal":         compEQ,
	"less":          compLT,
	"greater":       compGT,
	"not_equal":     compNE,
	"less_equal":    compLE,
	"greater_equal": compGE,
}

func optionsToString(fn FunctionOptions) string {
	if s, ok := fn.(fmt.Stringer); ok {
		return s.String()
	}

	var b strings.Builder
	v := reflect.Indirect(reflect.ValueOf(fn))
	b.WriteByte('{')
	for i := 0; i < v.Type().NumField(); i++ {
		fld := v.Type().Field(i)
		tag := fld.Tag.Get("compute")
		if tag == "-" {
			continue
		}

		fldVal := v.Field(i)
		fmt.Fprintf(&b, "%s=%v, ", tag, fldVal.Interface())
	}
	ret := b.String()
	return ret[:len(ret)-2] + "}"
}

// Call is a function call with specific arguments which are themselves other
// expressions. A call can also have options that are specific to the function
// in question. It must be bound to determine the shape and type.
//
// Deprecated: use substrait-go expression functions instead.
type Call struct {
	funcName string
	args     []Expression
	dt       arrow.DataType
	options  FunctionOptions

	cachedHash uint64
}

func (c *Call) IsNullLiteral() bool  { return false }
func (c *Call) FieldRef() *FieldRef  { return nil }
func (c *Call) Type() arrow.DataType { return c.dt }
func (c *Call) IsSatisfiable() bool  { return c.Type() == nil || c.Type().ID() != arrow.NULL }

func (c *Call) String() string {
	binary := func(op string) string {
		return "(" + c.args[0].String() + " " + op + " " + c.args[1].String() + ")"
	}

	if cmp, ok := compmap[c.funcName]; ok {
		return binary(cmp.getOp())
	}

	const kleene = "_kleene"
	if strings.HasSuffix(c.funcName, kleene) {
		return binary(strings.TrimSuffix(c.funcName, kleene))
	}

	if c.funcName == "make_struct" && c.options != nil {
		opts := c.options.(*MakeStructOptions)
		out := "{"
		for i, a := range c.args {
			out += opts.FieldNames[i] + "=" + a.String() + ", "
		}
		return out[:len(out)-2] + "}"
	}

	var b strings.Builder
	b.WriteString(c.funcName + "(")
	for _, a := range c.args {
		b.WriteString(a.String() + ", ")
	}

	if c.options != nil {
		b.WriteString(optionsToString(c.options))
		b.WriteString("  ")
	}

	ret := b.String()
	return ret[:len(ret)-2] + ")"
}

func (c *Call) Hash() uint64 {
	if c.cachedHash != 0 {
		return c.cachedHash
	}

	var h maphash.Hash
	h.SetSeed(hashSeed)

	h.WriteString(c.funcName)
	c.cachedHash = h.Sum64()
	for _, arg := range c.args {
		c.cachedHash = exec.HashCombine(c.cachedHash, arg.Hash())
	}
	return c.cachedHash
}

func (c *Call) IsScalarExpr() bool {
	for _, arg := range c.args {
		if !arg.IsScalarExpr() {
			return false
		}
	}

	return false
	// return isFuncScalar(c.funcName)
}

func (c *Call) IsBound() bool {
	return c.Type() != nil
}

func (c *Call) Equals(other Expression) bool {
	rhs, ok := other.(*Call)
	if !ok {
		return false
	}

	if c.funcName != rhs.funcName || len(c.args) != len(rhs.args) {
		return false
	}

	for i := range c.args {
		if !c.args[i].Equals(rhs.args[i]) {
			return false
		}
	}

	if opt, ok := c.options.(FunctionOptionsEqual); ok {
		return opt.Equals(rhs.options)
	}
	return reflect.DeepEqual(c.options, rhs.options)
}

func (c *Call) Release() {
	for _, a := range c.args {
		a.Release()
	}
	if r, ok := c.options.(releasable); ok {
		r.Release()
	}
}

// FunctionOptions can be any type which has a TypeName function. The fields
// of the type will be used (via reflection) to determine the information to
// propagate when serializing to pass to the C++ for execution.
type FunctionOptions interface {
	TypeName() string
}

type FunctionOptionsEqual interface {
	Equals(FunctionOptions) bool
}

type FunctionOptionsCloneable interface {
	Clone() FunctionOptions
}

type MakeStructOptions struct {
	FieldNames       []string          `compute:"field_names"`
	FieldNullability []bool            `compute:"field_nullability"`
	FieldMetadata    []*arrow.Metadata `compute:"field_metadata"`
}

func (MakeStructOptions) TypeName() string { return "MakeStructOptions" }

type NullOptions struct {
	NanIsNull bool `compute:"nan_is_null"`
}

func (NullOptions) TypeName() string { return "NullOptions" }

type StrptimeOptions struct {
	Format string         `compute:"format"`
	Unit   arrow.TimeUnit `compute:"unit"`
}

func (StrptimeOptions) TypeName() string { return "StrptimeOptions" }

type NullSelectionBehavior = kernels.NullSelectionBehavior

const (
	SelectionEmitNulls = kernels.EmitNulls
	SelectionDropNulls = kernels.DropNulls
)

type ArithmeticOptions struct {
	NoCheckOverflow bool `compute:"check_overflow"`
}

func (ArithmeticOptions) TypeName() string { return "ArithmeticOptions" }

type (
	CastOptions   = kernels.CastOptions
	FilterOptions = kernels.FilterOptions
	TakeOptions   = kernels.TakeOptions
)

func DefaultFilterOptions() *FilterOptions { return &FilterOptions{} }

func DefaultTakeOptions() *TakeOptions { return &TakeOptions{BoundsCheck: true} }

func DefaultCastOptions(safe bool) *CastOptions {
	if safe {
		return &CastOptions{}
	}
	return &CastOptions{
		AllowIntOverflow:     true,
		AllowTimeTruncate:    true,
		AllowTimeOverflow:    true,
		AllowDecimalTruncate: true,
		AllowFloatTruncate:   true,
		AllowInvalidUtf8:     true,
	}
}

func UnsafeCastOptions(dt arrow.DataType) *CastOptions {
	return NewCastOptions(dt, false)
}

func SafeCastOptions(dt arrow.DataType) *CastOptions {
	return NewCastOptions(dt, true)
}

func NewCastOptions(dt arrow.DataType, safe bool) *CastOptions {
	opts := DefaultCastOptions(safe)
	if dt != nil {
		opts.ToType = dt
	} else {
		opts.ToType = arrow.Null
	}
	return opts
}

func Cast(ex Expression, dt arrow.DataType) Expression {
	opts := &CastOptions{}
	if dt == nil {
		opts.ToType = arrow.Null
	} else {
		opts.ToType = dt
	}

	return NewCall("cast", []Expression{ex}, opts)
}

// Deprecated: Use SetOptions instead
type SetLookupOptions struct {
	ValueSet  Datum `compute:"value_set"`
	SkipNulls bool  `compute:"skip_nulls"`
}

func (SetLookupOptions) TypeName() string { return "SetLookupOptions" }

func (s *SetLookupOptions) Release() { s.ValueSet.Release() }

func (s *SetLookupOptions) Equals(other FunctionOptions) bool {
	rhs, ok := other.(*SetLookupOptions)
	if !ok {
		return false
	}

	return s.SkipNulls == rhs.SkipNulls && s.ValueSet.Equals(rhs.ValueSet)
}

func (s *SetLookupOptions) FromStructScalar(sc *scalar.Struct) error {
	if v, err := sc.Field("skip_nulls"); err == nil {
		s.SkipNulls = v.(*scalar.Boolean).Value
	}

	value, err := sc.Field("value_set")
	if err != nil {
		return err
	}

	if v, ok := value.(scalar.ListScalar); ok {
		s.ValueSet = NewDatum(v.GetList())
		return nil
	}

	return errors.New("set lookup options valueset should be a list")
}

var (
	funcOptionsMap map[string]reflect.Type
	funcOptsTypes  = []FunctionOptions{
		SetLookupOptions{}, ArithmeticOptions{}, CastOptions{},
		FilterOptions{}, NullOptions{}, StrptimeOptions{}, MakeStructOptions{},
	}
)

func init() {
	funcOptionsMap = make(map[string]reflect.Type)
	for _, ft := range funcOptsTypes {
		funcOptionsMap[ft.TypeName()] = reflect.TypeOf(ft)
	}
}

// NewLiteral constructs a new literal expression from any value. It is passed
// to NewDatum which will construct the appropriate Datum and/or scalar
// value for the type provided.
func NewLiteral(arg interface{}) Expression {
	return &Literal{Literal: NewDatum(arg)}
}

func NullLiteral(dt arrow.DataType) Expression {
	return &Literal{Literal: NewDatum(scalar.MakeNullScalar(dt))}
}

// NewRef constructs a parameter expression which refers to a specific field
func NewRef(ref FieldRef) Expression {
	return &Parameter{ref: &ref, index: -1}
}

// NewFieldRef is shorthand for NewRef(FieldRefName(field))
func NewFieldRef(field string) Expression {
	return NewRef(FieldRefName(field))
}

// NewCall constructs an expression that represents a specific function call with
// the given arguments and options.
func NewCall(name string, args []Expression, opts FunctionOptions) Expression {
	return &Call{funcName: name, args: args, options: opts}
}

// Project is shorthand for `make_struct` to produce a record batch output
// from a group of expressions.
func Project(values []Expression, names []string) Expression {
	nulls := make([]bool, len(names))
	for i := range nulls {
		nulls[i] = true
	}
	meta := make([]*arrow.Metadata, len(names))
	return NewCall("make_struct", values,
		&MakeStructOptions{FieldNames: names, FieldNullability: nulls, FieldMetadata: meta})
}

// Equal is a convenience function for the equal function
func Equal(lhs, rhs Expression) Expression {
	return NewCall("equal", []Expression{lhs, rhs}, nil)
}

// NotEqual creates a call to not_equal
func NotEqual(lhs, rhs Expression) Expression {
	return NewCall("not_equal", []Expression{lhs, rhs}, nil)
}

// Less is shorthand for NewCall("less",....)
func Less(lhs, rhs Expression) Expression {
	return NewCall("less", []Expression{lhs, rhs}, nil)
}

// LessEqual is shorthand for NewCall("less_equal",....)
func LessEqual(lhs, rhs Expression) Expression {
	return NewCall("less_equal", []Expression{lhs, rhs}, nil)
}

// Greater is shorthand for NewCall("greater",....)
func Greater(lhs, rhs Expression) Expression {
	return NewCall("greater", []Expression{lhs, rhs}, nil)
}

// GreaterEqual is shorthand for NewCall("greater_equal",....)
func GreaterEqual(lhs, rhs Expression) Expression {
	return NewCall("greater_equal", []Expression{lhs, rhs}, nil)
}

// IsNull creates an expression that returns true if the passed in expression is
// null. Optionally treating NaN as null if desired.
func IsNull(lhs Expression, nanIsNull bool) Expression {
	return NewCall("less", []Expression{lhs}, &NullOptions{nanIsNull})
}

// IsValid is the inverse of IsNull
func IsValid(lhs Expression) Expression {
	return NewCall("is_valid", []Expression{lhs}, nil)
}

type binop func(lhs, rhs Expression) Expression

func foldLeft(op binop, args ...Expression) Expression {
	switch len(args) {
	case 0:
		return nil
	case 1:
		return args[0]
	}

	folded := args[0]
	for _, a := range args[1:] {
		folded = op(folded, a)
	}
	return folded
}

func and(lhs, rhs Expression) Expression {
	return NewCall("and_kleene", []Expression{lhs, rhs}, nil)
}

// And constructs a tree of calls to and_kleene for boolean And logic taking
// an arbitrary number of values.
func And(lhs, rhs Expression, ops ...Expression) Expression {
	folded := foldLeft(and, append([]Expression{lhs, rhs}, ops...)...)
	if folded != nil {
		return folded
	}
	return NewLiteral(true)
}

func or(lhs, rhs Expression) Expression {
	return NewCall("or_kleene", []Expression{lhs, rhs}, nil)
}

// Or constructs a tree of calls to or_kleene for boolean Or logic taking
// an arbitrary number of values.
func Or(lhs, rhs Expression, ops ...Expression) Expression {
	folded := foldLeft(or, append([]Expression{lhs, rhs}, ops...)...)
	if folded != nil {
		return folded
	}
	return NewLiteral(false)
}

// Not creates a call to "invert" for the value specified.
func Not(expr Expression) Expression {
	return NewCall("invert", []Expression{expr}, nil)
}

func SerializeOptions(opts FunctionOptions, mem memory.Allocator) (*memory.Buffer, error) {
	sc, err := scalar.ToScalar(opts, mem)
	if err != nil {
		return nil, err
	}
	if sc, ok := sc.(releasable); ok {
		defer sc.Release()
	}

	arr, err := scalar.MakeArrayFromScalar(sc, 1, mem)
	if err != nil {
		return nil, err
	}
	defer arr.Release()

	batch := array.NewRecordBatch(arrow.NewSchema([]arrow.Field{{Type: arr.DataType(), Nullable: true}}, nil), []arrow.Array{arr}, 1)
	defer batch.Release()

	buf := &bufferWriteSeeker{mem: mem}
	wr, err := ipc.NewFileWriter(buf, ipc.WithSchema(batch.Schema()), ipc.WithAllocator(mem))
	if err != nil {
		return nil, err
	}

	wr.Write(batch)
	wr.Close()
	return buf.buf, nil
}

// SerializeExpr serializes expressions by converting them to Metadata and
// storing this in the schema of a Record. Embedded arrays and scalars are
// stored in its columns. Finally the record is written as an IPC file
func SerializeExpr(expr Expression, mem memory.Allocator) (*memory.Buffer, error) {
	var (
		cols      []arrow.Array
		metaKey   []string
		metaValue []string
		visit     func(Expression) error
	)

	addScalar := func(s scalar.Scalar) (string, error) {
		ret := len(cols)
		arr, err := scalar.MakeArrayFromScalar(s, 1, mem)
		if err != nil {
			return "", err
		}
		cols = append(cols, arr)
		return strconv.Itoa(ret), nil
	}

	visit = func(e Expression) error {
		switch e := e.(type) {
		case *Literal:
			if !e.IsScalarExpr() {
				return errors.New("not implemented: serialization of non-scalar literals")
			}
			metaKey = append(metaKey, "literal")
			s, err := addScalar(e.Literal.(*ScalarDatum).Value)
			if err != nil {
				return err
			}
			metaValue = append(metaValue, s)
		case *Parameter:
			if e.ref.Name() == "" {
				return errors.New("not implemented: serialization of non-name field_ref")
			}

			metaKey = append(metaKey, "field_ref")
			metaValue = append(metaValue, e.ref.Name())
		case *Call:
			metaKey = append(metaKey, "call")
			metaValue = append(metaValue, e.funcName)

			for _, arg := range e.args {
				visit(arg)
			}

			if e.options != nil {
				st, err := scalar.ToScalar(e.options, mem)
				if err != nil {
					return err
				}
				metaKey = append(metaKey, "options")
				s, err := addScalar(st)
				if err != nil {
					return err
				}
				metaValue = append(metaValue, s)

				for _, f := range st.(*scalar.Struct).Value {
					switch s := f.(type) {
					case releasable:
						defer s.Release()
					}
				}
			}

			metaKey = append(metaKey, "end")
			metaValue = append(metaValue, e.funcName)
		}
		return nil
	}

	if err := visit(expr); err != nil {
		return nil, err
	}

	fields := make([]arrow.Field, len(cols))
	for i, c := range cols {
		fields[i].Type = c.DataType()
		defer c.Release()
	}

	metadata := arrow.NewMetadata(metaKey, metaValue)
	rec := array.NewRecordBatch(arrow.NewSchema(fields, &metadata), cols, 1)
	defer rec.Release()

	buf := &bufferWriteSeeker{mem: mem}
	wr, err := ipc.NewFileWriter(buf, ipc.WithSchema(rec.Schema()), ipc.WithAllocator(mem))
	if err != nil {
		return nil, err
	}

	wr.Write(rec)
	wr.Close()
	return buf.buf, nil
}

func DeserializeExpr(mem memory.Allocator, buf *memory.Buffer) (Expression, error) {
	rdr, err := ipc.NewFileReader(bytes.NewReader(buf.Bytes()), ipc.WithAllocator(mem))
	if err != nil {
		return nil, err
	}
	defer rdr.Close()

	batch, err := rdr.Read()
	if err != nil {
		return nil, err
	}

	if !batch.Schema().HasMetadata() {
		return nil, errors.New("serialized Expression's batch repr had no metadata")
	}

	if batch.NumRows() != 1 {
		return nil, fmt.Errorf("serialized Expression's batch repr was not a single row - had %d", batch.NumRows())
	}

	var (
		getone   func() (Expression, error)
		index    = 0
		metadata = batch.Schema().Metadata()
	)

	getscalar := func(i string) (scalar.Scalar, error) {
		colIndex, err := strconv.ParseInt(i, 10, 32)
		if err != nil {
			return nil, err
		}
		if colIndex >= batch.NumCols() {
			return nil, errors.New("column index out of bounds")
		}
		return scalar.GetScalar(batch.Column(int(colIndex)), 0)
	}

	getone = func() (Expression, error) {
		if index >= metadata.Len() {
			return nil, errors.New("unterminated serialized Expression")
		}

		key, val := metadata.Keys()[index], metadata.Values()[index]
		index++

		switch key {
		case "literal":
			scalar, err := getscalar(val)
			if err != nil {
				return nil, err
			}
			if r, ok := scalar.(releasable); ok {
				defer r.Release()
			}
			return NewLiteral(scalar), err
		case "field_ref":
			return NewFieldRef(val), nil
		case "call":
			args := make([]Expression, 0)
			for metadata.Keys()[index] != "end" {
				if metadata.Keys()[index] == "options" {
					optsScalar, err := getscalar(metadata.Values()[index])
					if err != nil {
						return nil, err
					}
					if r, ok := optsScalar.(releasable); ok {
						defer r.Release()
					}
					var opts FunctionOptions
					if optsScalar != nil {
						typname, err := optsScalar.(*scalar.Struct).Field("_type_name")
						if err != nil {
							return nil, err
						}
						if typname.DataType().ID() != arrow.BINARY {
							return nil, errors.New("options scalar typename must be binary")
						}

						optionsVal := reflect.New(funcOptionsMap[string(typname.(*scalar.Binary).Data())]).Interface()
						if err := scalar.FromScalar(optsScalar.(*scalar.Struct), optionsVal); err != nil {
							return nil, err
						}
						opts = optionsVal.(FunctionOptions)
					}
					index += 2
					return NewCall(val, args, opts), nil
				}

				arg, err := getone()
				if err != nil {
					return nil, err
				}
				args = append(args, arg)
			}
			index++
			return NewCall(val, args, nil), nil
		default:
			return nil, fmt.Errorf("unrecognized serialized Expression key %s", key)
		}
	}

	return getone()
}
