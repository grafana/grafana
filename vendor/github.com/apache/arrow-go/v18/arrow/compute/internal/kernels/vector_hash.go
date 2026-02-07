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

package kernels

import (
	"fmt"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/array"
	"github.com/apache/arrow-go/v18/arrow/compute/exec"
	"github.com/apache/arrow-go/v18/arrow/internal/debug"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/internal/bitutils"
	"github.com/apache/arrow-go/v18/internal/hashing"
)

type HashState interface {
	// Reset for another run
	Reset() error
	// Flush out accumulated results from last invocation
	Flush(*exec.ExecResult) error
	// FlushFinal flushes the accumulated results across all invocations
	// of calls. The kernel should not be used again until after
	// Reset() is called.
	FlushFinal(out *exec.ExecResult) error
	// GetDictionary returns the values (keys) accumulated in the dictionary
	// so far.
	GetDictionary() (arrow.ArrayData, error)
	ValueType() arrow.DataType
	// Append prepares the action for the given input (reserving appropriately
	// sized data structures, etc.) and visits the input with the Action
	Append(*exec.KernelCtx, *exec.ArraySpan) error
	Allocator() memory.Allocator
}

type Action interface {
	Reset() error
	Reserve(int) error
	Flush(*exec.ExecResult) error
	FlushFinal(*exec.ExecResult) error
	ObserveFound(int)
	ObserveNotFound(int) error
	ObserveNullFound(int)
	ObserveNullNotFound(int) error
	ShouldEncodeNulls() bool
}

type emptyAction struct {
	mem memory.Allocator
	dt  arrow.DataType
}

func (emptyAction) Reset() error                      { return nil }
func (emptyAction) Reserve(int) error                 { return nil }
func (emptyAction) Flush(*exec.ExecResult) error      { return nil }
func (emptyAction) FlushFinal(*exec.ExecResult) error { return nil }
func (emptyAction) ObserveFound(int)                  {}
func (emptyAction) ObserveNotFound(int) error         { return nil }
func (emptyAction) ObserveNullFound(int)              {}
func (emptyAction) ObserveNullNotFound(int) error     { return nil }
func (emptyAction) ShouldEncodeNulls() bool           { return true }

type uniqueAction = emptyAction

type regularHashState struct {
	mem       memory.Allocator
	typ       arrow.DataType
	memoTable hashing.MemoTable
	action    Action

	doAppend func(Action, hashing.MemoTable, *exec.ArraySpan) error
}

func (rhs *regularHashState) Allocator() memory.Allocator { return rhs.mem }

func (rhs *regularHashState) ValueType() arrow.DataType { return rhs.typ }

func (rhs *regularHashState) Reset() error {
	rhs.memoTable.Reset()
	return rhs.action.Reset()
}

func (rhs *regularHashState) Append(_ *exec.KernelCtx, arr *exec.ArraySpan) error {
	if err := rhs.action.Reserve(int(arr.Len)); err != nil {
		return err
	}

	return rhs.doAppend(rhs.action, rhs.memoTable, arr)
}

func (rhs *regularHashState) Flush(out *exec.ExecResult) error { return rhs.action.Flush(out) }
func (rhs *regularHashState) FlushFinal(out *exec.ExecResult) error {
	return rhs.action.FlushFinal(out)
}

func (rhs *regularHashState) GetDictionary() (arrow.ArrayData, error) {
	return array.GetDictArrayData(rhs.mem, rhs.typ, rhs.memoTable, 0)
}

func doAppendBinary[OffsetT int32 | int64](action Action, memo hashing.MemoTable, arr *exec.ArraySpan) error {
	var (
		bitmap            = arr.Buffers[0].Buf
		offsets           = exec.GetSpanOffsets[OffsetT](arr, 1)
		data              = arr.Buffers[2].Buf
		shouldEncodeNulls = action.ShouldEncodeNulls()
	)

	return bitutils.VisitBitBlocksShort(bitmap, arr.Offset, arr.Len,
		func(pos int64) error {
			v := data[offsets[pos]:offsets[pos+1]]
			idx, found, err := memo.GetOrInsert(v)
			if err != nil {
				return err
			}
			if found {
				action.ObserveFound(idx)
				return nil
			}
			return action.ObserveNotFound(idx)
		},
		func() error {
			if !shouldEncodeNulls {
				return action.ObserveNullNotFound(-1)
			}

			idx, found := memo.GetOrInsertNull()
			if found {
				action.ObserveNullFound(idx)
			}
			return action.ObserveNullNotFound(idx)
		})
}

func doAppendFixedSize(action Action, memo hashing.MemoTable, arr *exec.ArraySpan) error {
	sz := int64(arr.Type.(arrow.FixedWidthDataType).Bytes())
	arrData := arr.Buffers[1].Buf[arr.Offset*sz:]
	shouldEncodeNulls := action.ShouldEncodeNulls()

	return bitutils.VisitBitBlocksShort(arr.Buffers[0].Buf, arr.Offset, arr.Len,
		func(pos int64) error {
			// fixed size type memo table we use a binary memo table
			// so get the raw bytes
			idx, found, err := memo.GetOrInsert(arrData[pos*sz : (pos+1)*sz])
			if err != nil {
				return err
			}
			if found {
				action.ObserveFound(idx)
				return nil
			}
			return action.ObserveNotFound(idx)
		}, func() error {
			if !shouldEncodeNulls {
				return action.ObserveNullNotFound(-1)
			}

			idx, found := memo.GetOrInsertNull()
			if found {
				action.ObserveNullFound(idx)
			}
			return action.ObserveNullNotFound(idx)
		})
}

func doAppendNumeric[T arrow.IntType | arrow.UintType | arrow.FloatType](action Action, memo hashing.MemoTable, arr *exec.ArraySpan) error {
	arrData := exec.GetSpanValues[T](arr, 1)
	shouldEncodeNulls := action.ShouldEncodeNulls()
	return bitutils.VisitBitBlocksShort(arr.Buffers[0].Buf, arr.Offset, arr.Len,
		func(pos int64) error {
			idx, found, err := memo.GetOrInsert(arrData[pos])
			if err != nil {
				return err
			}
			if found {
				action.ObserveFound(idx)
				return nil
			}
			return action.ObserveNotFound(idx)
		}, func() error {
			if !shouldEncodeNulls {
				return action.ObserveNullNotFound(-1)
			}

			idx, found := memo.GetOrInsertNull()
			if found {
				action.ObserveNullFound(idx)
			}
			return action.ObserveNullNotFound(idx)
		})
}

type nullHashState struct {
	mem      memory.Allocator
	typ      arrow.DataType
	seenNull bool
	action   Action
}

func (nhs *nullHashState) Allocator() memory.Allocator { return nhs.mem }

func (nhs *nullHashState) ValueType() arrow.DataType { return nhs.typ }

func (nhs *nullHashState) Reset() error {
	return nhs.action.Reset()
}

func (nhs *nullHashState) Append(_ *exec.KernelCtx, arr *exec.ArraySpan) (err error) {
	if err := nhs.action.Reserve(int(arr.Len)); err != nil {
		return err
	}

	for i := 0; i < int(arr.Len); i++ {
		if i == 0 {
			nhs.seenNull = true
			err = nhs.action.ObserveNullNotFound(0)
		} else {
			nhs.action.ObserveNullFound(0)
		}
	}
	return
}

func (nhs *nullHashState) Flush(out *exec.ExecResult) error { return nhs.action.Flush(out) }
func (nhs *nullHashState) FlushFinal(out *exec.ExecResult) error {
	return nhs.action.FlushFinal(out)
}

func (nhs *nullHashState) GetDictionary() (arrow.ArrayData, error) {
	var out arrow.Array
	if nhs.seenNull {
		out = array.NewNull(1)
	} else {
		out = array.NewNull(0)
	}
	data := out.Data()
	data.Retain()
	out.Release()
	return data, nil
}

type dictionaryHashState struct {
	indicesKernel HashState
	dictionary    arrow.Array
	dictValueType arrow.DataType
}

func (dhs *dictionaryHashState) Allocator() memory.Allocator { return dhs.indicesKernel.Allocator() }
func (dhs *dictionaryHashState) Reset() error                { return dhs.indicesKernel.Reset() }
func (dhs *dictionaryHashState) Flush(out *exec.ExecResult) error {
	return dhs.indicesKernel.Flush(out)
}
func (dhs *dictionaryHashState) FlushFinal(out *exec.ExecResult) error {
	return dhs.indicesKernel.FlushFinal(out)
}
func (dhs *dictionaryHashState) GetDictionary() (arrow.ArrayData, error) {
	return dhs.indicesKernel.GetDictionary()
}
func (dhs *dictionaryHashState) ValueType() arrow.DataType           { return dhs.indicesKernel.ValueType() }
func (dhs *dictionaryHashState) DictionaryValueType() arrow.DataType { return dhs.dictValueType }
func (dhs *dictionaryHashState) Dictionary() arrow.Array             { return dhs.dictionary }
func (dhs *dictionaryHashState) Append(ctx *exec.KernelCtx, arr *exec.ArraySpan) error {
	arrDict := arr.Dictionary().MakeArray()
	if dhs.dictionary == nil || array.Equal(dhs.dictionary, arrDict) {
		dhs.dictionary = arrDict
		return dhs.indicesKernel.Append(ctx, arr)
	}

	defer arrDict.Release()

	// NOTE: this approach computes a new dictionary unification per chunk
	// this is in effect O(n*k) where n is the total chunked array length
	// and k is the number of chunks (therefore O(n**2) if chunks have a fixed size).
	//
	// A better approach may be to run the kernel over each individual chunk,
	// and then hash-aggregate all results (for example sum-group-by for
	// the "value_counts" kernel)
	unifier, err := array.NewDictionaryUnifier(dhs.indicesKernel.Allocator(), dhs.dictValueType)
	if err != nil {
		return err
	}
	defer unifier.Release()

	if err := unifier.Unify(dhs.dictionary); err != nil {
		return err
	}
	transposeMap, err := unifier.UnifyAndTranspose(arrDict)
	if err != nil {
		return err
	}
	defer transposeMap.Release()
	_, outDict, err := unifier.GetResult()
	if err != nil {
		return err
	}
	defer func() {
		dhs.dictionary.Release()
		dhs.dictionary = outDict
	}()

	inDict := arr.MakeData()
	defer inDict.Release()
	tmp, err := array.TransposeDictIndices(dhs.Allocator(), inDict, arr.Type, arr.Type, outDict.Data(), arrow.Int32Traits.CastFromBytes(transposeMap.Bytes()))
	if err != nil {
		return err
	}
	defer tmp.Release()

	var tmpSpan exec.ArraySpan
	tmpSpan.SetMembers(tmp)
	return dhs.indicesKernel.Append(ctx, &tmpSpan)
}

func nullHashInit(actionInit initAction) exec.KernelInitFn {
	return func(ctx *exec.KernelCtx, args exec.KernelInitArgs) (exec.KernelState, error) {
		mem := exec.GetAllocator(ctx.Ctx)
		ret := &nullHashState{
			mem:    mem,
			typ:    args.Inputs[0],
			action: actionInit(args.Inputs[0], args.Options, mem),
		}
		ret.Reset()
		return ret, nil
	}
}

func newMemoTable(mem memory.Allocator, dt arrow.Type) (hashing.MemoTable, error) {
	switch dt {
	case arrow.INT8, arrow.UINT8:
		return hashing.NewMemoTable[uint8](0), nil
	case arrow.INT16, arrow.UINT16:
		return hashing.NewMemoTable[uint16](0), nil
	case arrow.INT32, arrow.UINT32, arrow.FLOAT32, arrow.DECIMAL32,
		arrow.DATE32, arrow.TIME32, arrow.INTERVAL_MONTHS:
		return hashing.NewMemoTable[uint32](0), nil
	case arrow.INT64, arrow.UINT64, arrow.FLOAT64, arrow.DECIMAL64,
		arrow.DATE64, arrow.TIME64, arrow.TIMESTAMP,
		arrow.DURATION, arrow.INTERVAL_DAY_TIME:
		return hashing.NewMemoTable[uint64](0), nil
	case arrow.BINARY, arrow.STRING, arrow.FIXED_SIZE_BINARY, arrow.DECIMAL128,
		arrow.DECIMAL256, arrow.INTERVAL_MONTH_DAY_NANO:
		return hashing.NewBinaryMemoTable(0, 0,
			array.NewBinaryBuilder(mem, arrow.BinaryTypes.Binary)), nil
	case arrow.LARGE_BINARY, arrow.LARGE_STRING:
		return hashing.NewBinaryMemoTable(0, 0,
			array.NewBinaryBuilder(mem, arrow.BinaryTypes.LargeBinary)), nil
	default:
		return nil, fmt.Errorf("%w: unsupported type %s", arrow.ErrNotImplemented, dt)
	}
}

func regularHashInit(dt arrow.DataType, actionInit initAction, appendFn func(Action, hashing.MemoTable, *exec.ArraySpan) error) exec.KernelInitFn {
	return func(ctx *exec.KernelCtx, args exec.KernelInitArgs) (exec.KernelState, error) {
		mem := exec.GetAllocator(ctx.Ctx)
		memoTable, err := newMemoTable(mem, dt.ID())
		if err != nil {
			return nil, err
		}

		ret := &regularHashState{
			mem:       mem,
			typ:       args.Inputs[0],
			memoTable: memoTable,
			action:    actionInit(args.Inputs[0], args.Options, mem),
			doAppend:  appendFn,
		}
		ret.Reset()
		return ret, nil
	}
}

func dictionaryHashInit(actionInit initAction) exec.KernelInitFn {
	return func(ctx *exec.KernelCtx, args exec.KernelInitArgs) (exec.KernelState, error) {
		var (
			dictType      = args.Inputs[0].(*arrow.DictionaryType)
			indicesHasher exec.KernelState
			err           error
		)

		switch dictType.IndexType.ID() {
		case arrow.INT8, arrow.UINT8:
			indicesHasher, err = getHashInit(arrow.UINT8, actionInit)(ctx, args)
		case arrow.INT16, arrow.UINT16:
			indicesHasher, err = getHashInit(arrow.UINT16, actionInit)(ctx, args)
		case arrow.INT32, arrow.UINT32:
			indicesHasher, err = getHashInit(arrow.UINT32, actionInit)(ctx, args)
		case arrow.INT64, arrow.UINT64:
			indicesHasher, err = getHashInit(arrow.UINT64, actionInit)(ctx, args)
		default:
			return nil, fmt.Errorf("%w: unsupported dictionary index type", arrow.ErrInvalid)
		}
		if err != nil {
			return nil, err
		}

		return &dictionaryHashState{
			indicesKernel: indicesHasher.(HashState),
			dictValueType: dictType.ValueType,
		}, nil
	}
}

type initAction func(arrow.DataType, any, memory.Allocator) Action

func getHashInit(typeID arrow.Type, actionInit initAction) exec.KernelInitFn {
	switch typeID {
	case arrow.NULL:
		return nullHashInit(actionInit)
	case arrow.INT8, arrow.UINT8:
		return regularHashInit(arrow.PrimitiveTypes.Uint8, actionInit, doAppendNumeric[uint8])
	case arrow.INT16, arrow.UINT16:
		return regularHashInit(arrow.PrimitiveTypes.Uint16, actionInit, doAppendNumeric[uint16])
	case arrow.INT32, arrow.UINT32, arrow.FLOAT32,
		arrow.DATE32, arrow.TIME32, arrow.INTERVAL_MONTHS:
		return regularHashInit(arrow.PrimitiveTypes.Uint32, actionInit, doAppendNumeric[uint32])
	case arrow.INT64, arrow.UINT64, arrow.FLOAT64,
		arrow.DATE64, arrow.TIME64, arrow.TIMESTAMP,
		arrow.DURATION, arrow.INTERVAL_DAY_TIME:
		return regularHashInit(arrow.PrimitiveTypes.Uint64, actionInit, doAppendNumeric[uint64])
	case arrow.BINARY, arrow.STRING:
		return regularHashInit(arrow.BinaryTypes.Binary, actionInit, doAppendBinary[int32])
	case arrow.LARGE_BINARY, arrow.LARGE_STRING:
		return regularHashInit(arrow.BinaryTypes.LargeBinary, actionInit, doAppendBinary[int64])
	case arrow.FIXED_SIZE_BINARY, arrow.DECIMAL128, arrow.DECIMAL256:
		return regularHashInit(arrow.BinaryTypes.Binary, actionInit, doAppendFixedSize)
	case arrow.INTERVAL_MONTH_DAY_NANO:
		return regularHashInit(arrow.FixedWidthTypes.MonthDayNanoInterval, actionInit, doAppendFixedSize)
	default:
		debug.Assert(false, "unsupported hash init type")
		return nil
	}
}

func hashExec(ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
	impl, ok := ctx.State.(HashState)
	if !ok {
		return fmt.Errorf("%w: bad initialization of hash state", arrow.ErrInvalid)
	}

	if err := impl.Append(ctx, &batch.Values[0].Array); err != nil {
		return err
	}

	return impl.Flush(out)
}

func uniqueFinalize(ctx *exec.KernelCtx, results []*exec.ArraySpan) ([]*exec.ArraySpan, error) {
	impl, ok := ctx.State.(HashState)
	if !ok {
		return nil, fmt.Errorf("%w: HashState in invalid state", arrow.ErrInvalid)
	}

	for _, r := range results {
		// release any pre-allocation we did
		r.Release()
	}

	uniques, err := impl.GetDictionary()
	if err != nil {
		return nil, err
	}
	defer uniques.Release()

	var out exec.ArraySpan
	out.TakeOwnership(uniques)
	return []*exec.ArraySpan{&out}, nil
}

func ensureHashDictionary(_ *exec.KernelCtx, hash *dictionaryHashState) (*exec.ArraySpan, error) {
	out := &exec.ArraySpan{}

	if hash.dictionary != nil {
		out.TakeOwnership(hash.dictionary.Data())
		hash.dictionary.Release()
		return out, nil
	}

	exec.FillZeroLength(hash.DictionaryValueType(), out)
	return out, nil
}

func uniqueFinalizeDictionary(ctx *exec.KernelCtx, result []*exec.ArraySpan) (out []*exec.ArraySpan, err error) {
	if out, err = uniqueFinalize(ctx, result); err != nil {
		return
	}

	hash, ok := ctx.State.(*dictionaryHashState)
	if !ok {
		return nil, fmt.Errorf("%w: state should be *dictionaryHashState", arrow.ErrInvalid)
	}

	dict, err := ensureHashDictionary(ctx, hash)
	if err != nil {
		return nil, err
	}
	out[0].SetDictionary(dict)
	return
}

func addHashKernels(base exec.VectorKernel, actionInit initAction, outTy exec.OutputType) []exec.VectorKernel {
	kernels := make([]exec.VectorKernel, 0)
	for _, ty := range primitiveTypes {
		base.Init = getHashInit(ty.ID(), actionInit)
		base.Signature = &exec.KernelSignature{
			InputTypes: []exec.InputType{exec.NewExactInput(ty)},
			OutType:    outTy,
		}
		kernels = append(kernels, base)
	}

	parametricTypes := []arrow.Type{arrow.TIME32, arrow.TIME64, arrow.TIMESTAMP,
		arrow.DURATION, arrow.FIXED_SIZE_BINARY, arrow.DECIMAL128, arrow.DECIMAL256,
		arrow.INTERVAL_DAY_TIME, arrow.INTERVAL_MONTHS, arrow.INTERVAL_MONTH_DAY_NANO}
	for _, ty := range parametricTypes {
		base.Init = getHashInit(ty, actionInit)
		base.Signature = &exec.KernelSignature{
			InputTypes: []exec.InputType{exec.NewIDInput(ty)},
			OutType:    outTy,
		}
		kernels = append(kernels, base)
	}

	return kernels
}

func initUnique(dt arrow.DataType, _ any, mem memory.Allocator) Action {
	return uniqueAction{mem: mem, dt: dt}
}

func GetVectorHashKernels() (unique, valueCounts, dictEncode []exec.VectorKernel) {
	var base exec.VectorKernel
	base.ExecFn = hashExec

	// unique
	base.Finalize = uniqueFinalize
	base.OutputChunked = false
	base.CanExecuteChunkWise = true
	unique = addHashKernels(base, initUnique, OutputFirstType)

	// dictionary unique
	base.Init = dictionaryHashInit(initUnique)
	base.Finalize = uniqueFinalizeDictionary
	base.Signature = &exec.KernelSignature{
		InputTypes: []exec.InputType{exec.NewIDInput(arrow.DICTIONARY)},
		OutType:    OutputFirstType,
	}
	unique = append(unique, base)

	return
}
