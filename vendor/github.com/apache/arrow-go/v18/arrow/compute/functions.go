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
	"context"
	"fmt"
	"strings"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/compute/exec"
)

type Function interface {
	Name() string
	Kind() FuncKind
	Arity() Arity
	Doc() FunctionDoc
	NumKernels() int
	Execute(context.Context, FunctionOptions, ...Datum) (Datum, error)
	DispatchExact(...arrow.DataType) (exec.Kernel, error)
	DispatchBest(...arrow.DataType) (exec.Kernel, error)
	DefaultOptions() FunctionOptions
	Validate() error
}

// Arity defines the number of required arguments for a function.
//
// Naming conventions are taken from https://en.wikipedia.org/wiki/Arity
type Arity struct {
	NArgs     int
	IsVarArgs bool
}

// Convenience functions to generating Arities

func Nullary() Arity            { return Arity{0, false} }
func Unary() Arity              { return Arity{1, false} }
func Binary() Arity             { return Arity{2, false} }
func Ternary() Arity            { return Arity{3, false} }
func VarArgs(minArgs int) Arity { return Arity{minArgs, true} }

type FunctionDoc struct {
	// A one-line summary of the function, using a verb.
	//
	// For example, "Add two numeric arrays or scalars"
	Summary string
	// A detailed description of the function, meant to follow the summary.
	Description string
	// Symbolic names (identifiers) for the function arguments.
	//
	// Can be used to generate nicer function signatures.
	ArgNames []string
	// Name of the options struct type, if any
	OptionsType string
	// Whether or not options are required for function execution.
	//
	// If false, then either there are no options for this function,
	// or there is a usable default options value.
	OptionsRequired bool
}

// EmptyFuncDoc is a reusable empty function doc definition for convenience.
var EmptyFuncDoc FunctionDoc

// FuncKind is an enum representing the type of a function
type FuncKind int8

const (
	// A function that performs scalar data operations on whole arrays
	// of data. Can generally process Array or Scalar values. The size
	// of the output will be the same as the size (or broadcasted size,
	// in the case of mixing Array and Scalar inputs) of the input.
	FuncScalar FuncKind = iota // Scalar
	// A function with array input and output whose behavior depends on
	// the values of the entire arrays passed, rather than the value of
	// each scalar value.
	FuncVector // Vector
	// A function that computes a scalar summary statistic from array input.
	FuncScalarAgg // ScalarAggregate
	// A function that computes grouped summary statistics from array
	// input and an array of group identifiers.
	FuncHashAgg // HashAggregate
	// A function that dispatches to other functions and does not contain
	// its own kernels.
	FuncMeta // Meta
)

func validateFunctionSummary(summary string) error {
	if strings.Contains(summary, "\n") {
		return fmt.Errorf("%w: summary contains a newline", arrow.ErrInvalid)
	}
	if summary[len(summary)-1] == '.' {
		return fmt.Errorf("%w: summary ends with a point", arrow.ErrInvalid)
	}
	return nil
}

func validateFunctionDescription(desc string) error {
	if len(desc) != 0 && desc[len(desc)-1] == '\n' {
		return fmt.Errorf("%w: description ends with a newline", arrow.ErrInvalid)
	}

	const maxLineSize = 78
	for _, ln := range strings.Split(desc, "\n") {
		if len(ln) > maxLineSize {
			return fmt.Errorf("%w: description line length exceeds %d characters", arrow.ErrInvalid, maxLineSize)
		}
	}
	return nil
}

// baseFunction is the base class for compute functions. Function
// implementations should embed this baseFunction and will contain
// a collection of "kernels" which are implementations of the function
// for specific argument types. Selecting a viable kernel for
// executing the function is referred to as "dispatching".
type baseFunction struct {
	name        string
	kind        FuncKind
	arity       Arity
	doc         FunctionDoc
	defaultOpts FunctionOptions
}

func (b *baseFunction) Name() string                    { return b.name }
func (b *baseFunction) Kind() FuncKind                  { return b.kind }
func (b *baseFunction) Arity() Arity                    { return b.arity }
func (b *baseFunction) Doc() FunctionDoc                { return b.doc }
func (b *baseFunction) DefaultOptions() FunctionOptions { return b.defaultOpts }
func (b *baseFunction) Validate() error {
	if b.doc.Summary == "" {
		return nil
	}

	argCount := len(b.doc.ArgNames)
	if argCount != b.arity.NArgs && !(b.arity.IsVarArgs && argCount == b.arity.NArgs+1) {
		return fmt.Errorf("in function '%s': number of argument names for function doc != function arity", b.name)
	}

	if err := validateFunctionSummary(b.doc.Summary); err != nil {
		return err
	}
	return validateFunctionDescription(b.doc.Description)
}

func checkOptions(fn Function, opts FunctionOptions) error {
	if opts == nil && fn.Doc().OptionsRequired {
		return fmt.Errorf("%w: function '%s' cannot be called without options", arrow.ErrInvalid, fn.Name())
	}
	return nil
}

func (b *baseFunction) checkArity(nargs int) error {
	switch {
	case b.arity.IsVarArgs && nargs < b.arity.NArgs:
		return fmt.Errorf("%w: varargs function '%s' needs at least %d arguments, but only %d passed",
			arrow.ErrInvalid, b.name, b.arity.NArgs, nargs)
	case !b.arity.IsVarArgs && nargs != b.arity.NArgs:
		return fmt.Errorf("%w: function '%s' accepts %d arguments but %d passed",
			arrow.ErrInvalid, b.name, b.arity.NArgs, nargs)
	}
	return nil
}

// kernelType is a type constraint interface that is used for funcImpl
// generic definitions. It will be extended as other kernel types
// are defined.
//
// Currently only ScalarKernels are allowed to be used.
type kernelType interface {
	exec.ScalarKernel | exec.VectorKernel

	// specifying the Kernel interface here allows us to utilize
	// the methods of the Kernel interface on the generic
	// constrained type
	exec.Kernel
}

// funcImpl is the basic implementation for any functions that use kernels
// i.e. all except for Meta functions.
type funcImpl[KT kernelType] struct {
	baseFunction

	kernels []KT
}

func (fi *funcImpl[KT]) DispatchExact(vals ...arrow.DataType) (*KT, error) {
	if err := fi.checkArity(len(vals)); err != nil {
		return nil, err
	}

	for i := range fi.kernels {
		if fi.kernels[i].GetSig().MatchesInputs(vals) {
			return &fi.kernels[i], nil
		}
	}

	return nil, fmt.Errorf("%w: function '%s' has no kernel matching input types %s",
		arrow.ErrNotImplemented, fi.name, arrow.TypesToString(vals))
}

func (fi *funcImpl[KT]) NumKernels() int { return len(fi.kernels) }
func (fi *funcImpl[KT]) Kernels() []*KT {
	res := make([]*KT, len(fi.kernels))
	for i := range fi.kernels {
		res[i] = &fi.kernels[i]
	}
	return res
}

// A ScalarFunction is a function that executes element-wise operations
// on arrays or scalars, and therefore whose results generally do not
// depend on the order of the values in the arguments. Accepts and returns
// arrays that are all of the same size. These functions roughly correspond
// to the functions used in most SQL expressions.
type ScalarFunction struct {
	funcImpl[exec.ScalarKernel]
}

// NewScalarFunction constructs a new ScalarFunction object with the passed in
// name, arity and function doc.
func NewScalarFunction(name string, arity Arity, doc FunctionDoc) *ScalarFunction {
	return &ScalarFunction{
		funcImpl: funcImpl[exec.ScalarKernel]{
			baseFunction: baseFunction{
				name:  name,
				arity: arity,
				doc:   doc,
				kind:  FuncScalar,
			},
		},
	}
}

func (s *ScalarFunction) SetDefaultOptions(opts FunctionOptions) {
	s.defaultOpts = opts
}

func (s *ScalarFunction) DispatchExact(vals ...arrow.DataType) (exec.Kernel, error) {
	return s.funcImpl.DispatchExact(vals...)
}

func (s *ScalarFunction) DispatchBest(vals ...arrow.DataType) (exec.Kernel, error) {
	return s.DispatchExact(vals...)
}

// AddNewKernel constructs a new kernel with the provided signature
// and execution/init functions and then adds it to the function's list of
// kernels. This assumes default null handling (intersection of validity bitmaps)
func (s *ScalarFunction) AddNewKernel(inTypes []exec.InputType, outType exec.OutputType, execFn exec.ArrayKernelExec, init exec.KernelInitFn) error {
	if err := s.checkArity(len(inTypes)); err != nil {
		return err
	}

	if s.arity.IsVarArgs && len(inTypes) != 1 {
		return fmt.Errorf("%w: varargs signatures must have exactly one input type", arrow.ErrInvalid)
	}

	sig := &exec.KernelSignature{
		InputTypes: inTypes,
		OutType:    outType,
		IsVarArgs:  s.arity.IsVarArgs,
	}

	s.kernels = append(s.kernels, exec.NewScalarKernelWithSig(sig, execFn, init))
	return nil
}

// AddKernel adds the provided kernel to the list of kernels
// this function has. A copy of the kernel is added to the slice of kernels,
// which means that a given kernel object can be created, added and then
// reused to add other kernels.
func (s *ScalarFunction) AddKernel(k exec.ScalarKernel) error {
	if err := s.checkArity(len(k.Signature.InputTypes)); err != nil {
		return err
	}

	if s.arity.IsVarArgs && !k.Signature.IsVarArgs {
		return fmt.Errorf("%w: function accepts varargs but kernel signature does not", arrow.ErrInvalid)
	}

	s.kernels = append(s.kernels, k)
	return nil
}

// Execute uses the passed in context, function options and arguments to eagerly
// execute the function using kernel dispatch, batch iteration and memory
// allocation details as defined by the kernel.
//
// If opts is nil, then the DefaultOptions() will be used.
func (s *ScalarFunction) Execute(ctx context.Context, opts FunctionOptions, args ...Datum) (Datum, error) {
	return execInternal(ctx, s, opts, -1, args...)
}

type VectorFunction struct {
	funcImpl[exec.VectorKernel]
}

func NewVectorFunction(name string, arity Arity, doc FunctionDoc) *VectorFunction {
	return &VectorFunction{
		funcImpl: funcImpl[exec.VectorKernel]{
			baseFunction: baseFunction{
				name:  name,
				arity: arity,
				doc:   doc,
				kind:  FuncVector,
			},
		},
	}
}

func (f *VectorFunction) SetDefaultOptions(opts FunctionOptions) {
	f.defaultOpts = opts
}

func (f *VectorFunction) DispatchExact(vals ...arrow.DataType) (exec.Kernel, error) {
	return f.funcImpl.DispatchExact(vals...)
}

func (f *VectorFunction) DispatchBest(vals ...arrow.DataType) (exec.Kernel, error) {
	return f.DispatchExact(vals...)
}

func (f *VectorFunction) AddNewKernel(inTypes []exec.InputType, outType exec.OutputType, execFn exec.ArrayKernelExec, init exec.KernelInitFn) error {
	if err := f.checkArity(len(inTypes)); err != nil {
		return err
	}

	if f.arity.IsVarArgs && len(inTypes) != 1 {
		return fmt.Errorf("%w: varags signatures must have exactly one input type", arrow.ErrInvalid)
	}

	sig := &exec.KernelSignature{
		InputTypes: inTypes,
		OutType:    outType,
		IsVarArgs:  f.arity.IsVarArgs,
	}
	f.kernels = append(f.kernels, exec.NewVectorKernelWithSig(sig, execFn, init))
	return nil
}

func (f *VectorFunction) AddKernel(kernel exec.VectorKernel) error {
	if err := f.checkArity(len(kernel.Signature.InputTypes)); err != nil {
		return err
	}

	if f.arity.IsVarArgs && !kernel.Signature.IsVarArgs {
		return fmt.Errorf("%w: function accepts varargs but kernel signature does not", arrow.ErrInvalid)
	}
	f.kernels = append(f.kernels, kernel)
	return nil
}

func (f *VectorFunction) Execute(ctx context.Context, opts FunctionOptions, args ...Datum) (Datum, error) {
	return execInternal(ctx, f, opts, -1, args...)
}

// MetaFunctionImpl is the signature needed for implementing a MetaFunction
// which is a function that dispatches to another function instead.
type MetaFunctionImpl func(context.Context, FunctionOptions, ...Datum) (Datum, error)

// MetaFunction is a function which dispatches to other functions, the impl
// must not be nil.
//
// For Array, ChunkedArray and Scalar datums, this may rely on the execution
// of concrete function types, but this must handle other Datum kinds on its
// own.
type MetaFunction struct {
	baseFunction
	impl MetaFunctionImpl
}

// NewMetaFunction constructs a new MetaFunction which will call the provided
// impl for dispatching with the expected arity.
//
// Will panic if impl is nil.
func NewMetaFunction(name string, arity Arity, doc FunctionDoc, impl MetaFunctionImpl) *MetaFunction {
	if impl == nil {
		panic("arrow/compute: cannot construct MetaFunction with nil impl")
	}
	return &MetaFunction{
		baseFunction: baseFunction{
			name:  name,
			arity: arity,
			doc:   doc,
		},
		impl: impl,
	}
}

func (MetaFunction) NumKernels() int { return 0 }
func (m *MetaFunction) DispatchExact(...arrow.DataType) (exec.Kernel, error) {
	return nil, fmt.Errorf("%w: dispatch for metafunction", arrow.ErrNotImplemented)
}

func (m *MetaFunction) DispatchBest(...arrow.DataType) (exec.Kernel, error) {
	return nil, fmt.Errorf("%w: dispatch for metafunction", arrow.ErrNotImplemented)
}

func (m *MetaFunction) Execute(ctx context.Context, opts FunctionOptions, args ...Datum) (Datum, error) {
	if err := m.checkArity(len(args)); err != nil {
		return nil, err
	}
	if err := checkOptions(m, opts); err != nil {
		return nil, err
	}

	if opts == nil {
		opts = m.defaultOpts
	}

	return m.impl(ctx, opts, args...)
}
