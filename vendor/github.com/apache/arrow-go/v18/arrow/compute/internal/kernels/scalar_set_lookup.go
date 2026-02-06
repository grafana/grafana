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

package kernels

import (
	"fmt"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/bitutil"
	"github.com/apache/arrow-go/v18/arrow/compute/exec"
	"github.com/apache/arrow-go/v18/arrow/internal/debug"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/internal/bitutils"
	"github.com/apache/arrow-go/v18/internal/hashing"
)

type NullMatchingBehavior int8

const (
	NullMatchingMatch NullMatchingBehavior = iota
	NullMatchingSkip
	NullMatchingEmitNull
	NullMatchingInconclusive
)

func visitBinary[OffsetT int32 | int64](data *exec.ArraySpan, valid func([]byte) error, null func() error) error {
	if data.Len == 0 {
		return nil
	}

	rawBytes := data.Buffers[2].Buf
	offsets := exec.GetSpanOffsets[OffsetT](data, 1)
	return bitutils.VisitBitBlocksShort(data.Buffers[0].Buf, data.Offset, data.Len,
		func(pos int64) error {
			return valid(rawBytes[offsets[pos]:offsets[pos+1]])
		}, null)
}

func visitNumeric[T arrow.FixedWidthType](data *exec.ArraySpan, valid func(T) error, null func() error) error {
	if data.Len == 0 {
		return nil
	}

	values := exec.GetSpanValues[T](data, 1)
	return bitutils.VisitBitBlocksShort(data.Buffers[0].Buf, data.Offset, data.Len,
		func(pos int64) error {
			return valid(values[pos])
		}, null)
}

func visitFSB(data *exec.ArraySpan, valid func([]byte) error, null func() error) error {
	if data.Len == 0 {
		return nil
	}

	sz := int64(data.Type.(arrow.FixedWidthDataType).Bytes())
	rawBytes := data.Buffers[1].Buf

	return bitutils.VisitBitBlocksShort(data.Buffers[0].Buf, data.Offset, data.Len,
		func(pos int64) error {
			return valid(rawBytes[pos*sz : (pos+1)*sz])
		}, null)
}

type SetLookupOptions struct {
	ValueSetType arrow.DataType
	TotalLen     int64
	ValueSet     []exec.ArraySpan
	NullBehavior NullMatchingBehavior
}

type lookupState interface {
	Init(SetLookupOptions) error
}

func CreateSetLookupState(opts SetLookupOptions, alloc memory.Allocator) (exec.KernelState, error) {
	valueSetType := opts.ValueSetType
	if valueSetType.ID() == arrow.EXTENSION {
		valueSetType = valueSetType.(arrow.ExtensionType).StorageType()
	}

	var state lookupState
	switch ty := valueSetType.(type) {
	case arrow.BinaryDataType:
		switch ty.Layout().Buffers[1].ByteWidth {
		case 4:
			state = &SetLookupState[[]byte]{
				Alloc:   alloc,
				visitFn: visitBinary[int32],
			}
		case 8:
			state = &SetLookupState[[]byte]{
				Alloc:   alloc,
				visitFn: visitBinary[int64],
			}
		}
	case arrow.FixedWidthDataType:
		switch ty.Bytes() {
		case 1:
			state = &SetLookupState[uint8]{
				Alloc:   alloc,
				visitFn: visitNumeric[uint8],
			}
		case 2:
			state = &SetLookupState[uint16]{
				Alloc:   alloc,
				visitFn: visitNumeric[uint16],
			}
		case 4:
			state = &SetLookupState[uint32]{
				Alloc:   alloc,
				visitFn: visitNumeric[uint32],
			}
		case 8:
			state = &SetLookupState[uint64]{
				Alloc:   alloc,
				visitFn: visitNumeric[uint64],
			}
		default:
			state = &SetLookupState[[]byte]{
				Alloc:   alloc,
				visitFn: visitFSB,
			}
		}

	default:
		return nil, fmt.Errorf("%w: unsupported type %s for SetLookup functions", arrow.ErrInvalid, opts.ValueSetType)
	}

	return state, state.Init(opts)
}

type SetLookupState[T hashing.MemoTypes] struct {
	visitFn      func(*exec.ArraySpan, func(T) error, func() error) error
	ValueSetType arrow.DataType
	Alloc        memory.Allocator
	Lookup       hashing.TypedMemoTable[T]
	// When there are duplicates in value set, memotable indices
	// must be mapped back to indices in the value set
	MemoIndexToValueIndex []int32
	NullIndex             int32
	NullBehavior          NullMatchingBehavior
}

func (s *SetLookupState[T]) ValueType() arrow.DataType {
	return s.ValueSetType
}

func (s *SetLookupState[T]) Init(opts SetLookupOptions) error {
	s.ValueSetType = opts.ValueSetType
	s.NullBehavior = opts.NullBehavior
	s.MemoIndexToValueIndex = make([]int32, 0, opts.TotalLen)
	s.NullIndex = -1
	memoType := s.ValueSetType.ID()
	if memoType == arrow.EXTENSION {
		memoType = s.ValueSetType.(arrow.ExtensionType).StorageType().ID()
	}
	lookup, err := newMemoTable(s.Alloc, memoType)
	if err != nil {
		return err
	}
	s.Lookup = lookup.(hashing.TypedMemoTable[T])
	if s.Lookup == nil {
		return fmt.Errorf("unsupported type %s for SetLookup functions", s.ValueSetType)
	}

	var offset int64
	for _, c := range opts.ValueSet {
		if err := s.AddArrayValueSet(&c, offset); err != nil {
			return err
		}
		offset += c.Len
	}

	lookupNull, _ := s.Lookup.GetNull()
	if s.NullBehavior != NullMatchingSkip && lookupNull >= 0 {
		s.NullIndex = int32(lookupNull)
	}
	return nil
}

func (s *SetLookupState[T]) AddArrayValueSet(data *exec.ArraySpan, startIdx int64) error {
	idx := startIdx
	return s.visitFn(data,
		func(v T) error {
			memoSize := len(s.MemoIndexToValueIndex)
			memoIdx, found, err := s.Lookup.InsertOrGet(v)
			if err != nil {
				return err
			}

			if !found {
				debug.Assert(memoIdx == memoSize, "inconsistent memo index and size")
				s.MemoIndexToValueIndex = append(s.MemoIndexToValueIndex, int32(idx))
			} else {
				debug.Assert(memoIdx < memoSize, "inconsistent memo index and size")
			}

			idx++
			return nil
		}, func() error {
			memoSize := len(s.MemoIndexToValueIndex)
			nullIdx, found := s.Lookup.GetOrInsertNull()
			if !found {
				debug.Assert(nullIdx == memoSize, "inconsistent memo index and size")
				s.MemoIndexToValueIndex = append(s.MemoIndexToValueIndex, int32(idx))
			} else {
				debug.Assert(nullIdx < memoSize, "inconsistent memo index and size")
			}

			idx++
			return nil
		})
}

func DispatchIsIn(state lookupState, in *exec.ArraySpan, out *exec.ExecResult) error {
	inType := in.Type
	if inType.ID() == arrow.EXTENSION {
		inType = inType.(arrow.ExtensionType).StorageType()
	}

	switch ty := inType.(type) {
	case arrow.BinaryDataType:
		return isInKernelExec(state.(*SetLookupState[[]byte]), in, out)
	case arrow.FixedWidthDataType:
		switch ty.Bytes() {
		case 1:
			return isInKernelExec(state.(*SetLookupState[uint8]), in, out)
		case 2:
			return isInKernelExec(state.(*SetLookupState[uint16]), in, out)
		case 4:
			return isInKernelExec(state.(*SetLookupState[uint32]), in, out)
		case 8:
			return isInKernelExec(state.(*SetLookupState[uint64]), in, out)
		default:
			return isInKernelExec(state.(*SetLookupState[[]byte]), in, out)
		}
	default:
		return fmt.Errorf("%w: unsupported type %s for is_in function", arrow.ErrInvalid, in.Type)
	}
}

func isInKernelExec[T hashing.MemoTypes](state *SetLookupState[T], in *exec.ArraySpan, out *exec.ExecResult) error {
	writerBool := bitutil.NewBitmapWriter(out.Buffers[1].Buf, int(out.Offset), int(out.Len))
	defer writerBool.Finish()
	writerNulls := bitutil.NewBitmapWriter(out.Buffers[0].Buf, int(out.Offset), int(out.Len))
	defer writerNulls.Finish()
	valueSetHasNull := state.NullIndex != -1
	return state.visitFn(in,
		func(v T) error {
			switch {
			case state.Lookup.Exists(v):
				writerBool.Set()
				writerNulls.Set()
			case state.NullBehavior == NullMatchingInconclusive && valueSetHasNull:
				writerBool.Clear()
				writerNulls.Clear()
			default:
				writerBool.Clear()
				writerNulls.Set()
			}

			writerBool.Next()
			writerNulls.Next()
			return nil
		}, func() error {
			switch {
			case state.NullBehavior == NullMatchingMatch && valueSetHasNull:
				writerBool.Set()
				writerNulls.Set()
			case state.NullBehavior == NullMatchingSkip || (!valueSetHasNull && state.NullBehavior == NullMatchingMatch):
				writerBool.Clear()
				writerNulls.Set()
			default:
				writerBool.Clear()
				writerNulls.Clear()
			}

			writerBool.Next()
			writerNulls.Next()
			return nil
		})
}
