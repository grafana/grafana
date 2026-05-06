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

package exec

import (
	"context"
	"fmt"
	"hash/maphash"
	"strings"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/bitutil"
	"github.com/apache/arrow-go/v18/arrow/internal/debug"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"golang.org/x/exp/slices"
)

var hashSeed = maphash.MakeSeed()

type ctxAllocKey struct{}

// WithAllocator returns a new context with the provided allocator
// embedded into the context.
func WithAllocator(ctx context.Context, mem memory.Allocator) context.Context {
	return context.WithValue(ctx, ctxAllocKey{}, mem)
}

// GetAllocator retrieves the allocator from the context, or returns
// memory.DefaultAllocator if there was no allocator in the provided
// context.
func GetAllocator(ctx context.Context) memory.Allocator {
	mem, ok := ctx.Value(ctxAllocKey{}).(memory.Allocator)
	if !ok {
		return memory.DefaultAllocator
	}
	return mem
}

// Kernel defines the minimum interface required for the basic execution
// kernel. It will grow as the implementation requires.
type Kernel interface {
	GetInitFn() KernelInitFn
	GetSig() *KernelSignature
}

// NonAggKernel builds on the base Kernel interface for
// non aggregate execution kernels. Specifically this will
// represent Scalar and Vector kernels.
type NonAggKernel interface {
	Kernel
	Exec(*KernelCtx, *ExecSpan, *ExecResult) error
	GetNullHandling() NullHandling
	GetMemAlloc() MemAlloc
	CanFillSlices() bool
	Cleanup() error
}

// KernelCtx is a small struct holding the context for a kernel execution
// consisting of a pointer to the kernel, initialized state (if needed)
// and the context for this execution.
type KernelCtx struct {
	Ctx    context.Context
	Kernel Kernel
	State  KernelState
}

func (k *KernelCtx) Allocate(bufsize int) *memory.Buffer {
	buf := memory.NewResizableBuffer(GetAllocator(k.Ctx))
	buf.Resize(bufsize)
	return buf
}

func (k *KernelCtx) AllocateBitmap(nbits int64) *memory.Buffer {
	nbytes := bitutil.BytesForBits(nbits)
	return k.Allocate(int(nbytes))
}

// TypeMatcher define an interface for matching Input or Output types
// for execution kernels. There are multiple implementations of this
// interface provided by this package.
type TypeMatcher interface {
	fmt.Stringer
	Matches(typ arrow.DataType) bool
	Equals(other TypeMatcher) bool
}

type sameTypeIDMatcher struct {
	accepted arrow.Type
}

func (s sameTypeIDMatcher) Matches(typ arrow.DataType) bool { return s.accepted == typ.ID() }
func (s sameTypeIDMatcher) Equals(other TypeMatcher) bool {
	if s == other {
		return true
	}

	o, ok := other.(*sameTypeIDMatcher)
	if !ok {
		return false
	}

	return s.accepted == o.accepted
}

func (s sameTypeIDMatcher) String() string {
	return "Type::" + s.accepted.String()
}

// SameTypeID returns a type matcher which will match
// any DataType that uses the same arrow.Type ID as the one
// passed in here.
func SameTypeID(id arrow.Type) TypeMatcher { return &sameTypeIDMatcher{id} }

type timeUnitMatcher struct {
	id   arrow.Type
	unit arrow.TimeUnit
}

func (s timeUnitMatcher) Matches(typ arrow.DataType) bool {
	if typ.ID() != s.id {
		return false
	}
	return s.unit == typ.(arrow.TemporalWithUnit).TimeUnit()
}

func (s timeUnitMatcher) String() string {
	return strings.ToLower(s.id.String()) + "(" + s.unit.String() + ")"
}

func (s *timeUnitMatcher) Equals(other TypeMatcher) bool {
	if s == other {
		return true
	}

	o, ok := other.(*timeUnitMatcher)
	if !ok {
		return false
	}
	return o.id == s.id && o.unit == s.unit
}

// TimestampTypeUnit returns a TypeMatcher that will match only
// a Timestamp datatype with the specified TimeUnit.
func TimestampTypeUnit(unit arrow.TimeUnit) TypeMatcher {
	return &timeUnitMatcher{arrow.TIMESTAMP, unit}
}

// Time32TypeUnit returns a TypeMatcher that will match only
// a Time32 datatype with the specified TimeUnit.
func Time32TypeUnit(unit arrow.TimeUnit) TypeMatcher {
	return &timeUnitMatcher{arrow.TIME32, unit}
}

// Time64TypeUnit returns a TypeMatcher that will match only
// a Time64 datatype with the specified TimeUnit.
func Time64TypeUnit(unit arrow.TimeUnit) TypeMatcher {
	return &timeUnitMatcher{arrow.TIME64, unit}
}

// DurationTypeUnit returns a TypeMatcher that will match only
// a Duration datatype with the specified TimeUnit.
func DurationTypeUnit(unit arrow.TimeUnit) TypeMatcher {
	return &timeUnitMatcher{arrow.DURATION, unit}
}

type integerMatcher struct{}

func (integerMatcher) String() string                  { return "integer" }
func (integerMatcher) Matches(typ arrow.DataType) bool { return arrow.IsInteger(typ.ID()) }
func (integerMatcher) Equals(other TypeMatcher) bool {
	_, ok := other.(integerMatcher)
	return ok
}

type binaryLikeMatcher struct{}

func (binaryLikeMatcher) String() string                  { return "binary-like" }
func (binaryLikeMatcher) Matches(typ arrow.DataType) bool { return arrow.IsBinaryLike(typ.ID()) }
func (binaryLikeMatcher) Equals(other TypeMatcher) bool {
	_, ok := other.(binaryLikeMatcher)
	return ok
}

type largeBinaryLikeMatcher struct{}

func (largeBinaryLikeMatcher) String() string { return "large-binary-like" }
func (largeBinaryLikeMatcher) Matches(typ arrow.DataType) bool {
	return arrow.IsLargeBinaryLike(typ.ID())
}
func (largeBinaryLikeMatcher) Equals(other TypeMatcher) bool {
	_, ok := other.(largeBinaryLikeMatcher)
	return ok
}

type fsbLikeMatcher struct{}

func (fsbLikeMatcher) String() string                  { return "fixed-size-binary-like" }
func (fsbLikeMatcher) Matches(typ arrow.DataType) bool { return arrow.IsFixedSizeBinary(typ.ID()) }
func (fsbLikeMatcher) Equals(other TypeMatcher) bool {
	_, ok := other.(fsbLikeMatcher)
	return ok
}

// Integer returns a TypeMatcher which will match any integral type like int8 or uint16
func Integer() TypeMatcher { return integerMatcher{} }

// BinaryLike returns a TypeMatcher that will match Binary or String
func BinaryLike() TypeMatcher { return binaryLikeMatcher{} }

// LargeBinaryLike returns a TypeMatcher which will match LargeBinary or LargeString
func LargeBinaryLike() TypeMatcher { return largeBinaryLikeMatcher{} }

// FixedSizeBinaryLike returns a TypeMatcher that will match FixedSizeBinary
// or Decimal128/256
func FixedSizeBinaryLike() TypeMatcher { return fsbLikeMatcher{} }

type primitiveMatcher struct{}

func (primitiveMatcher) String() string                  { return "primitive" }
func (primitiveMatcher) Matches(typ arrow.DataType) bool { return arrow.IsPrimitive(typ.ID()) }
func (primitiveMatcher) Equals(other TypeMatcher) bool {
	_, ok := other.(primitiveMatcher)
	return ok
}

// Primitive returns a TypeMatcher that will match any type that arrow.IsPrimitive
// returns true for.
func Primitive() TypeMatcher { return primitiveMatcher{} }

type reeMatcher struct {
	runEndsMatcher TypeMatcher
	encodedMatcher TypeMatcher
}

func (r reeMatcher) Matches(typ arrow.DataType) bool {
	if typ.ID() != arrow.RUN_END_ENCODED {
		return false
	}

	dt := typ.(*arrow.RunEndEncodedType)
	return r.runEndsMatcher.Matches(dt.RunEnds()) && r.encodedMatcher.Matches(dt.Encoded())
}

func (r reeMatcher) Equals(other TypeMatcher) bool {
	o, ok := other.(reeMatcher)
	if !ok {
		return false
	}
	return r.runEndsMatcher.Equals(o.runEndsMatcher) && r.encodedMatcher.Equals(o.encodedMatcher)
}

func (r reeMatcher) String() string {
	return "run_end_encoded(run_ends=" + r.runEndsMatcher.String() + ", values=" + r.encodedMatcher.String() + ")"
}

// RunEndEncoded returns a matcher which matches a RunEndEncoded
// type whose encoded type is matched by the passed in matcher.
func RunEndEncoded(runEndsMatcher, encodedMatcher TypeMatcher) TypeMatcher {
	return reeMatcher{
		runEndsMatcher: runEndsMatcher,
		encodedMatcher: encodedMatcher}
}

// InputKind is an enum representing the type of Input matching
// that will be done. Either accepting any type, an exact specific type
// or using a TypeMatcher.
type InputKind int8

const (
	InputAny InputKind = iota
	InputExact
	InputUseMatcher
)

// InputType is used for type checking arguments passed to a kernel
// and stored within a KernelSignature. The type-checking rule can
// be supplied either with an exact DataType instance or a custom
// TypeMatcher.
type InputType struct {
	Kind    InputKind
	Type    arrow.DataType
	Matcher TypeMatcher
}

func NewExactInput(dt arrow.DataType) InputType { return InputType{Kind: InputExact, Type: dt} }
func NewMatchedInput(match TypeMatcher) InputType {
	return InputType{Kind: InputUseMatcher, Matcher: match}
}
func NewIDInput(id arrow.Type) InputType { return NewMatchedInput(SameTypeID(id)) }

func (it InputType) MatchID() arrow.Type {
	switch it.Kind {
	case InputExact:
		return it.Type.ID()
	case InputUseMatcher:
		if idMatch, ok := it.Matcher.(*sameTypeIDMatcher); ok {
			return idMatch.accepted
		}
	}
	debug.Assert(false, "MatchID called on non-id matching InputType")
	return -1
}

func (it InputType) String() string {
	switch it.Kind {
	case InputAny:
		return "any"
	case InputUseMatcher:
		return it.Matcher.String()
	case InputExact:
		return it.Type.String()
	}
	return ""
}

func (it *InputType) Equals(other *InputType) bool {
	if it == other {
		return true
	}

	if it.Kind != other.Kind {
		return false
	}

	switch it.Kind {
	case InputAny:
		return true
	case InputExact:
		return arrow.TypeEqual(it.Type, other.Type)
	case InputUseMatcher:
		return it.Matcher.Equals(other.Matcher)
	default:
		return false
	}
}

func (it InputType) Hash() uint64 {
	var h maphash.Hash

	h.SetSeed(hashSeed)
	result := HashCombine(h.Sum64(), uint64(it.Kind))
	switch it.Kind {
	case InputExact:
		result = HashCombine(result, arrow.HashType(hashSeed, it.Type))
	}
	return result
}

func (it InputType) Matches(dt arrow.DataType) bool {
	switch it.Kind {
	case InputExact:
		return arrow.TypeEqual(it.Type, dt)
	case InputUseMatcher:
		return it.Matcher.Matches(dt)
	case InputAny:
		return true
	default:
		debug.Assert(false, "invalid InputKind")
		return true
	}
}

// ResolveKind defines the way that a particular OutputType resolves
// its type. Either it has a fixed type to resolve to or it contains
// a Resolver which will compute the resolved type based on
// the input types.
type ResolveKind int8

const (
	ResolveFixed ResolveKind = iota
	ResolveComputed
)

// TypeResolver is simply a function that takes a KernelCtx and a list of input types
// and returns the resolved type or an error.
type TypeResolver = func(*KernelCtx, []arrow.DataType) (arrow.DataType, error)

type OutputType struct {
	Kind     ResolveKind
	Type     arrow.DataType
	Resolver TypeResolver
}

func NewOutputType(dt arrow.DataType) OutputType {
	return OutputType{Kind: ResolveFixed, Type: dt}
}

func NewComputedOutputType(resolver TypeResolver) OutputType {
	return OutputType{Kind: ResolveComputed, Resolver: resolver}
}

func (o OutputType) String() string {
	if o.Kind == ResolveFixed {
		return o.Type.String()
	}
	return "computed"
}

func (o OutputType) Resolve(ctx *KernelCtx, types []arrow.DataType) (arrow.DataType, error) {
	switch o.Kind {
	case ResolveFixed:
		return o.Type, nil
	}

	return o.Resolver(ctx, types)
}

// NullHandling is an enum representing how a particular Kernel
// wants the executor to handle nulls.
type NullHandling int8

const (
	// Compute the output validity bitmap by intersection the validity
	// bitmaps of the arguments using bitwise-and operations. This means
	// that values in the output are valid/non-null only if the corresponding
	// values in all input arguments were valid/non-null. Kernels generally
	// do not have to touch the bitmap afterwards, but a kernel's exec function
	// is permitted to alter the bitmap after the null intersection is computed
	// if necessary.
	NullIntersection NullHandling = iota
	// Kernel expects a pre-allocated buffer to write the result bitmap
	// into.
	NullComputedPrealloc
	// Kernel will allocate and set the validity bitmap of the output
	NullComputedNoPrealloc
	// kernel output is never null and a validity bitmap doesn't need to
	// be allocated
	NullNoOutput
)

// MemAlloc is the preference for preallocating memory of fixed-width
// type outputs during kernel execution.
type MemAlloc int8

const (
	// For data types that support pre-allocation (fixed-width), the
	// kernel expects to be provided a pre-allocated buffer to write into.
	// Non-fixed-width types must always allocate their own buffers.
	// The allocation is made for the same length as the execution batch,
	// so vector kernels yielding differently sized outputs should not
	// use this.
	//
	// It is valid for the data to not be preallocated but the validity
	// bitmap is (or is computed using intersection).
	//
	// For variable-size output types like Binary or String, or for nested
	// types, this option has no effect.
	MemPrealloc MemAlloc = iota
	// The kernel is responsible for allocating its own data buffer
	// for fixed-width output types.
	MemNoPrealloc
)

type KernelState any

// KernelInitArgs are the arguments required to initialize an Kernel's
// state using the input types and any options.
type KernelInitArgs struct {
	Kernel Kernel
	Inputs []arrow.DataType
	// Options are opaque and specific to the Kernel being initialized,
	// may be nil if the kernel doesn't require options.
	Options any
}

// KernelInitFn is any function that receives a KernelCtx and initialization
// arguments and returns the initialized state or an error.
type KernelInitFn = func(*KernelCtx, KernelInitArgs) (KernelState, error)

// KernelSignature holds the input and output types for a kernel.
//
// Variable argument functions with a minimum of N arguments should pass
// up to N input types to be used to validate for invocation. The first
// N-1 types will be matched against the first N-1 arguments and the last
// type will be matched against the remaining arguments.
type KernelSignature struct {
	InputTypes []InputType
	OutType    OutputType
	IsVarArgs  bool

	// store the hashcode after it is computed so we don't
	// need to recompute it
	hashCode uint64
}

func (k KernelSignature) String() string {
	var b strings.Builder
	if k.IsVarArgs {
		b.WriteString("varargs[")
	} else {
		b.WriteByte('(')
	}

	for i, t := range k.InputTypes {
		if i != 0 {
			b.WriteString(", ")
		}
		b.WriteString(t.String())
	}
	if k.IsVarArgs {
		b.WriteString("*]")
	} else {
		b.WriteByte(')')
	}

	b.WriteString(" -> ")
	b.WriteString(k.OutType.String())
	return b.String()
}

func (k KernelSignature) Equals(other KernelSignature) bool {
	if k.IsVarArgs != other.IsVarArgs {
		return false
	}

	return slices.EqualFunc(k.InputTypes, other.InputTypes, func(e1, e2 InputType) bool {
		return e1.Equals(&e2)
	})
}

func (k *KernelSignature) Hash() uint64 {
	if k.hashCode != 0 {
		return k.hashCode
	}

	var h maphash.Hash
	h.SetSeed(hashSeed)
	result := h.Sum64()
	for _, typ := range k.InputTypes {
		result = HashCombine(result, typ.Hash())
	}
	k.hashCode = result
	return result
}

func (k KernelSignature) MatchesInputs(types []arrow.DataType) bool {
	switch k.IsVarArgs {
	case true:
		// check that it has enough to match at least the non-vararg types
		if len(types) < (len(k.InputTypes) - 1) {
			return false
		}

		for i, t := range types {
			if !k.InputTypes[Min(i, len(k.InputTypes)-1)].Matches(t) {
				return false
			}
		}
	case false:
		if len(types) != len(k.InputTypes) {
			return false
		}
		for i, t := range types {
			if !k.InputTypes[i].Matches(t) {
				return false
			}
		}
	}
	return true
}

// ArrayKernelExec is an alias definition for a kernel's execution function.
//
// This is used for both stateless and stateful kernels. If a kernel
// depends on some execution state, it can be accessed from the KernelCtx
// object, which also contains the context.Context object which can be
// used for shortcircuiting by checking context.Done / context.Err.
// This allows kernels to control handling timeouts or cancellation of
// computation.
type ArrayKernelExec = func(*KernelCtx, *ExecSpan, *ExecResult) error

type kernel struct {
	Init           KernelInitFn
	Signature      *KernelSignature
	Data           KernelState
	Parallelizable bool
}

func (k kernel) GetInitFn() KernelInitFn  { return k.Init }
func (k kernel) GetSig() *KernelSignature { return k.Signature }

// A ScalarKernel is the kernel implementation for a Scalar Function.
// In addition to the members found in the base Kernel, it contains
// the null handling and memory pre-allocation preferences.
type ScalarKernel struct {
	kernel

	ExecFn             ArrayKernelExec
	CanWriteIntoSlices bool
	NullHandling       NullHandling
	MemAlloc           MemAlloc
	CleanupFn          func(KernelState) error
}

// NewScalarKernel constructs a new kernel for scalar execution, constructing
// a KernelSignature with the provided input types and output type, and using
// the passed in execution implementation and initialization function.
func NewScalarKernel(in []InputType, out OutputType, exec ArrayKernelExec, init KernelInitFn) ScalarKernel {
	return NewScalarKernelWithSig(&KernelSignature{
		InputTypes: in,
		OutType:    out,
	}, exec, init)
}

// NewScalarKernelWithSig is a convenience when you already have a signature
// to use for constructing a kernel. It's equivalent to passing the components
// of the signature (input and output types) to NewScalarKernel.
func NewScalarKernelWithSig(sig *KernelSignature, exec ArrayKernelExec, init KernelInitFn) ScalarKernel {
	return ScalarKernel{
		kernel:             kernel{Signature: sig, Init: init, Parallelizable: true},
		ExecFn:             exec,
		CanWriteIntoSlices: true,
		NullHandling:       NullIntersection,
		MemAlloc:           MemPrealloc,
	}
}

func (s *ScalarKernel) Cleanup() error {
	if s.CleanupFn != nil {
		return s.CleanupFn(s.Data)
	}
	return nil
}

func (s *ScalarKernel) Exec(ctx *KernelCtx, sp *ExecSpan, out *ExecResult) error {
	return s.ExecFn(ctx, sp, out)
}

func (s ScalarKernel) GetNullHandling() NullHandling { return s.NullHandling }
func (s ScalarKernel) GetMemAlloc() MemAlloc         { return s.MemAlloc }
func (s ScalarKernel) CanFillSlices() bool           { return s.CanWriteIntoSlices }

// ChunkedExec is the signature for executing a stateful vector kernel
// against a ChunkedArray input. It is optional
type ChunkedExec func(*KernelCtx, []*arrow.Chunked, *ExecResult) ([]*ExecResult, error)

// FinalizeFunc is an optional finalizer function for any postprocessing
// that may need to be done on data before returning it
type FinalizeFunc func(*KernelCtx, []*ArraySpan) ([]*ArraySpan, error)

// VectorKernel is a structure for implementations of vector functions.
// It can optionally contain a finalizer function, the null handling
// and memory pre-allocation preferences (different defaults from
// scalar kernels when using NewVectorKernel), and other execution related
// options.
type VectorKernel struct {
	kernel

	ExecFn              ArrayKernelExec
	ExecChunked         ChunkedExec
	Finalize            FinalizeFunc
	NullHandling        NullHandling
	MemAlloc            MemAlloc
	CanWriteIntoSlices  bool
	CanExecuteChunkWise bool
	OutputChunked       bool
}

// NewVectorKernel constructs a new kernel for execution of vector functions,
// which take into account more than just the individual scalar values
// of its input. Output of a vector kernel may be a different length
// than its inputs.
func NewVectorKernel(inTypes []InputType, outType OutputType, exec ArrayKernelExec, init KernelInitFn) VectorKernel {
	return NewVectorKernelWithSig(&KernelSignature{
		InputTypes: inTypes, OutType: outType}, exec, init)
}

// NewVectorKernelWithSig is a convenience function for creating a kernel
// when you already have a signature constructed.
func NewVectorKernelWithSig(sig *KernelSignature, exec ArrayKernelExec, init KernelInitFn) VectorKernel {
	return VectorKernel{
		kernel:              kernel{Signature: sig, Init: init, Parallelizable: true},
		ExecFn:              exec,
		CanWriteIntoSlices:  true,
		CanExecuteChunkWise: true,
		OutputChunked:       true,
		NullHandling:        NullComputedNoPrealloc,
		MemAlloc:            MemNoPrealloc,
	}
}

func (s *VectorKernel) Exec(ctx *KernelCtx, sp *ExecSpan, out *ExecResult) error {
	return s.ExecFn(ctx, sp, out)
}

func (s VectorKernel) GetNullHandling() NullHandling { return s.NullHandling }
func (s VectorKernel) GetMemAlloc() MemAlloc         { return s.MemAlloc }
func (s VectorKernel) CanFillSlices() bool           { return s.CanWriteIntoSlices }
func (s VectorKernel) Cleanup() error                { return nil }
