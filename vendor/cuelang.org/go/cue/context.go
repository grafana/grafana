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
	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/ast/astutil"
	"cuelang.org/go/cue/build"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/token"
	"cuelang.org/go/internal/core/adt"
	"cuelang.org/go/internal/core/compile"
	"cuelang.org/go/internal/core/convert"
	"cuelang.org/go/internal/core/debug"
	"cuelang.org/go/internal/core/eval"
	"cuelang.org/go/internal/core/runtime"
)

// A Context is used for creating CUE Values.
//
// A Context keeps track of loaded instances, indices of internal
// representations of values, and defines the set of supported builtins. Any
// operation that involves two Values should originate from the same Context.
//
// Use
//
//	ctx := cuecontext.New()
//
// to create a new Context.
type Context runtime.Runtime

func (c *Context) runtime() *runtime.Runtime {
	rt := (*runtime.Runtime)(c)
	return rt
}

func (c *Context) ctx() *adt.OpContext {
	return newContext(c.runtime())
}

// Context reports the Context with which this value was created.
func (v Value) Context() *Context {
	return (*Context)(v.idx)
}

// A BuildOption defines options for the various build-related methods of
// Context.
type BuildOption func(o *runtime.Config)

// Scope defines a context in which to resolve unresolved identifiers.
//
// Only one scope may be given. It panics if more than one scope is given
// or if the Context in which scope was created differs from the one where
// this option is used.
func Scope(scope Value) BuildOption {
	return func(o *runtime.Config) {
		if o.Runtime != scope.idx {
			panic("incompatible runtime")
		}
		if o.Scope != nil {
			panic("more than one scope is given")
		}
		o.Scope = valueScope(scope)
	}
}

// Filename assigns a filename to parsed content.
func Filename(filename string) BuildOption {
	return func(o *runtime.Config) { o.Filename = filename }
}

// ImportPath defines the import path to use for building CUE. The import path
// influences the scope in which identifiers occurring in the input CUE are
// defined. Passing the empty string is equal to not specifying this option.
//
// This option is typically not necessary when building using a build.Instance,
// but takes precedence otherwise.
func ImportPath(path string) BuildOption {
	return func(o *runtime.Config) { o.ImportPath = path }
}

// InferBuiltins allows unresolved references to bind to builtin packages with a
// unique package name.
//
// This option is intended for evaluating expressions in a context where import
// statements cannot be used. It is not recommended to use this for evaluating
// CUE files.
func InferBuiltins(elide bool) BuildOption {
	return func(o *runtime.Config) {
		o.Imports = func(x *ast.Ident) (pkgPath string) {
			return o.Runtime.BuiltinPackagePath(x.Name)
		}
	}
}

func (c *Context) parseOptions(options []BuildOption) (cfg runtime.Config) {
	cfg.Runtime = (*runtime.Runtime)(c)
	for _, f := range options {
		f(&cfg)
	}
	return cfg
}

// BuildInstance creates a Value from the given build.Instance.
//
// The returned Value will represent an error, accessible through Err, if any
// error occurred.
func (c *Context) BuildInstance(i *build.Instance, options ...BuildOption) Value {
	cfg := c.parseOptions(options)
	v, err := c.runtime().Build(&cfg, i)
	if err != nil {
		return c.makeError(err)
	}
	return c.make(v)
}

func (c *Context) makeError(err errors.Error) Value {
	b := &adt.Bottom{Err: err}
	node := &adt.Vertex{BaseValue: b}
	node.UpdateStatus(adt.Finalized)
	node.AddConjunct(adt.MakeRootConjunct(nil, b))
	return c.make(node)
}

// BuildInstances creates a Value for each of the given instances and reports
// the combined errors or nil if there were no errors.
func (c *Context) BuildInstances(instances []*build.Instance) ([]Value, error) {
	var errs errors.Error
	var a []Value
	for _, b := range instances {
		v, err := c.runtime().Build(nil, b)
		if err != nil {
			errs = errors.Append(errs, err)
			a = append(a, c.makeError(err))
		} else {
			a = append(a, c.make(v))
		}
	}
	return a, errs
}

// BuildFile creates a Value from f.
//
// The returned Value will represent an error, accessible through Err, if any
// error occurred.
func (c *Context) BuildFile(f *ast.File, options ...BuildOption) Value {
	cfg := c.parseOptions(options)
	return c.compile(c.runtime().CompileFile(&cfg, f))
}

func (c *Context) compile(v *adt.Vertex, p *build.Instance) Value {
	if p.Err != nil {
		return c.makeError(p.Err)
	}
	return c.make(v)
}

// BuildExpr creates a Value from x.
//
// The returned Value will represent an error, accessible through Err, if any
// error occurred.
func (c *Context) BuildExpr(x ast.Expr, options ...BuildOption) Value {
	r := c.runtime()
	cfg := c.parseOptions(options)

	ctx := c.ctx()

	// TODO: move to runtime?: it probably does not make sense to treat BuildExpr
	// and the expression resulting from CompileString differently.
	astutil.ResolveExpr(x, errFn)

	pkgPath := cfg.ImportPath
	if pkgPath == "" {
		pkgPath = anonymousPkg
	}

	conjunct, err := compile.Expr(&cfg.Config, r, pkgPath, x)
	if err != nil {
		return c.makeError(err)
	}
	v := adt.Resolve(ctx, conjunct)

	return c.make(v)
}

func errFn(pos token.Pos, msg string, args ...interface{}) {}

// resolveExpr binds unresolved expressions to values in the expression or v.
func resolveExpr(ctx *adt.OpContext, v Value, x ast.Expr) adt.Value {
	cfg := &compile.Config{Scope: valueScope(v)}

	astutil.ResolveExpr(x, errFn)

	c, err := compile.Expr(cfg, ctx, anonymousPkg, x)
	if err != nil {
		return &adt.Bottom{Err: err}
	}
	return adt.Resolve(ctx, c)
}

// anonymousPkg reports a package path that can never resolve to a valid package.
const anonymousPkg = "_"

// CompileString parses and build a Value from the given source string.
//
// The returned Value will represent an error, accessible through Err, if any
// error occurred.
func (c *Context) CompileString(src string, options ...BuildOption) Value {
	cfg := c.parseOptions(options)
	return c.compile(c.runtime().Compile(&cfg, src))
}

// CompileBytes parses and build a Value from the given source bytes.
//
// The returned Value will represent an error, accessible through Err, if any
// error occurred.
func (c *Context) CompileBytes(b []byte, options ...BuildOption) Value {
	cfg := c.parseOptions(options)
	return c.compile(c.runtime().Compile(&cfg, b))
}

// TODO: fs.FS or custom wrapper?
// // CompileFile parses and build a Value from the given source bytes.
// //
// // The returned Value will represent an error, accessible through Err, if any
// // error occurred.
// func (c *Context) CompileFile(f fs.File, options ...BuildOption) Value {
// 	b, err := io.ReadAll(f)
// 	if err != nil {
// 		return c.makeError(errors.Promote(err, "parsing file system file"))
// 	}
// 	return c.compile(c.runtime().Compile("", b))
// }

func (c *Context) make(v *adt.Vertex) Value {
	opCtx := newContext(c.runtime())
	x := newValueRoot(c.runtime(), opCtx, v)
	adt.AddStats(opCtx)
	return x
}

// An EncodeOption defines options for the various encoding-related methods of
// Context.
type EncodeOption func(*encodeOptions)

type encodeOptions struct {
	nilIsTop bool
}

func (o *encodeOptions) process(option []EncodeOption) {
	for _, f := range option {
		f(o)
	}
}

// NilIsAny indicates whether a nil value is interpreted as null or _.
//
// The default is to interpret nil as _.
func NilIsAny(isAny bool) EncodeOption {
	return func(o *encodeOptions) { o.nilIsTop = isAny }
}

// Encode converts a Go value to a CUE value.
//
// The returned Value will represent an error, accessible through Err, if any
// error occurred.
//
// Encode traverses the value v recursively. If an encountered value implements
// the json.Marshaler interface and is not a nil pointer, Encode calls its
// MarshalJSON method to produce JSON and convert that to CUE instead. If no
// MarshalJSON method is present but the value implements encoding.TextMarshaler
// instead, Encode calls its MarshalText method and encodes the result as a
// string.
//
// Otherwise, Encode uses the following type-dependent default encodings:
//
// Boolean values encode as CUE booleans.
//
// Floating point, integer, and *big.Int and *big.Float values encode as CUE
// numbers.
//
// String values encode as CUE strings coerced to valid UTF-8, replacing
// sequences of invalid bytes with the Unicode replacement rune as per Unicode's
// and W3C's recommendation.
//
// Array and slice values encode as CUE lists, except that []byte encodes as a
// bytes value, and a nil slice encodes as the null.
//
// Struct values encode as CUE structs. Each exported struct field becomes a
// member of the object, using the field name as the object key, unless the
// field is omitted for one of the reasons given below.
//
// The encoding of each struct field can be customized by the format string
// stored under the "json" key in the struct field's tag. The format string
// gives the name of the field, possibly followed by a comma-separated list of
// options. The name may be empty in order to specify options without overriding
// the default field name.
//
// The "omitempty" option specifies that the field should be omitted from the
// encoding if the field has an empty value, defined as false, 0, a nil pointer,
// a nil interface value, and any empty array, slice, map, or string.
//
// See the documentation for Go's json.Marshal for more details on the field
// tags and their meaning.
//
// Anonymous struct fields are usually encoded as if their inner exported
// fields were fields in the outer struct, subject to the usual Go visibility
// rules amended as described in the next paragraph. An anonymous struct field
// with a name given in its JSON tag is treated as having that name, rather than
// being anonymous. An anonymous struct field of interface type is treated the
// same as having that type as its name, rather than being anonymous.
//
// The Go visibility rules for struct fields are amended for when deciding which
// field to encode or decode. If there are multiple fields at the same level,
// and that level is the least nested (and would therefore be the nesting level
// selected by the usual Go rules), the following extra rules apply:
//
// 1) Of those fields, if any are JSON-tagged, only tagged fields are
// considered, even if there are multiple untagged fields that would otherwise
// conflict.
//
// 2) If there is exactly one field (tagged or not according to the first rule),
// that is selected.
//
// 3) Otherwise there are multiple fields, and all are ignored; no error occurs.
//
// Map values encode as CUE structs. The map's key type must either be a string,
// an integer type, or implement encoding.TextMarshaler. The map keys are sorted
// and used as CUE struct field names by applying the following rules, subject
// to the UTF-8 coercion described for string values above:
//
//   - keys of any string type are used directly
//   - encoding.TextMarshalers are marshaled
//   - integer keys are converted to strings
//
// Pointer values encode as the value pointed to. A nil pointer encodes as the
// null CUE value.
//
// Interface values encode as the value contained in the interface. A nil
// interface value encodes as the null CUE value. The NilIsAny EncodingOption
// can be used to interpret nil as any (_) instead.
//
// Channel, complex, and function values cannot be encoded in CUE. Attempting to
// encode such a value results in the returned value being an error, accessible
// through the Err method.
func (c *Context) Encode(x interface{}, option ...EncodeOption) Value {
	switch v := x.(type) {
	case adt.Value:
		return newValueRoot(c.runtime(), c.ctx(), v)
	}
	var options encodeOptions
	options.process(option)

	ctx := c.ctx()
	// TODO: is true the right default?
	expr := convert.GoValueToValue(ctx, x, options.nilIsTop)
	n := &adt.Vertex{}
	n.AddConjunct(adt.MakeRootConjunct(nil, expr))
	n.Finalize(ctx)
	return c.make(n)
}

// Encode converts a Go type to a CUE value.
//
// The returned Value will represent an error, accessible through Err, if any
// error occurred.
func (c *Context) EncodeType(x interface{}, option ...EncodeOption) Value {
	switch v := x.(type) {
	case *adt.Vertex:
		return c.make(v)
	}

	ctx := c.ctx()
	expr, err := convert.GoTypeToExpr(ctx, x)
	if err != nil {
		return c.makeError(err)
	}
	n := &adt.Vertex{}
	n.AddConjunct(adt.MakeRootConjunct(nil, expr))
	n.Finalize(ctx)
	return c.make(n)
}

// NewList creates a Value that is a list of the given values.
//
// All Values must be created by c.
func (c *Context) NewList(v ...Value) Value {
	a := make([]adt.Value, len(v))
	for i, x := range v {
		if x.idx != (*runtime.Runtime)(c) {
			panic("values must be from same Context")
		}
		a[i] = x.v
	}
	return c.make(c.ctx().NewList(a...))
}

// TODO:

// func (c *Context) NewExpr(op Op, v ...Value) Value {
// 	return Value{}
// }

// func (c *Context) NewValue(v ...ValueElem) Value {
// 	return Value{}
// }

// func NewAttr(key string, values ...string) *Attribute {
// 	return &Attribute{}
// }

// // Clear unloads all previously-loaded imports.
// func (c *Context) Clear() {
// }

// // Values created up to the point of the Fork will be valid in both runtimes.
// func (c *Context) Fork() *Context {
// 	return nil
// }

// type ValueElem interface {
// }

// func NewField(sel Selector, value Value, attrs ...Attribute) ValueElem {
// 	return nil
// }

// func NewDocComment(text string) ValueElem {
// 	return nil
// }

// newContext returns a new evaluation context.
func newContext(idx *runtime.Runtime) *adt.OpContext {
	if idx == nil {
		return nil
	}
	return eval.NewContext(idx, nil)
}

func debugStr(ctx *adt.OpContext, v adt.Node) string {
	return debug.NodeString(ctx, v, nil)
}

func str(c *adt.OpContext, v adt.Node) string {
	return debugStr(c, v)
}

// eval returns the evaluated value. This may not be the vertex.
//
// Deprecated: use ctx.value
func (v Value) eval(ctx *adt.OpContext) adt.Value {
	if v.v == nil {
		panic("undefined value")
	}
	x := manifest(ctx, v.v)
	return x.Value()
}

// TODO: change from Vertex to Vertex.
func manifest(ctx *adt.OpContext, v *adt.Vertex) *adt.Vertex {
	v.Finalize(ctx)
	return v
}
