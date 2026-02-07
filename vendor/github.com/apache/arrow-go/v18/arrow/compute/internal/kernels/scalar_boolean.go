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
	"github.com/apache/arrow-go/v18/arrow/bitutil"
	"github.com/apache/arrow-go/v18/arrow/compute/exec"
	"github.com/apache/arrow-go/v18/arrow/scalar"
)

type computeWordFN func(leftTrue, leftFalse, rightTrue, rightFalse uint64) (outValid, outData uint64)

func computeKleene(computeWord computeWordFN, _ *exec.KernelCtx, left, right *exec.ArraySpan, out *exec.ExecResult) error {
	var (
		inBMs = [4]bitutil.Bitmap{
			{Data: left.Buffers[0].Buf, Offset: left.Offset, Len: left.Len},
			{Data: left.Buffers[1].Buf, Offset: left.Offset, Len: left.Len},
			{Data: right.Buffers[1].Buf, Offset: right.Offset, Len: right.Len},
			{Data: right.Buffers[0].Buf, Offset: right.Offset, Len: right.Len},
		}
		outBMs = [2]bitutil.Bitmap{
			{Data: out.Buffers[0].Buf, Offset: out.Offset, Len: out.Len},
			{Data: out.Buffers[1].Buf, Offset: out.Offset, Len: out.Len},
		}
		apply = func(leftValid, leftData uint64, rightValid, rightData uint64) (outValidity, outData uint64) {
			leftTrue, leftFalse := leftValid&leftData, leftValid&^leftData
			rightTrue, rightFalse := rightValid&rightData, rightValid&^rightData
			return computeWord(leftTrue, leftFalse, rightTrue, rightFalse)
		}
	)

	switch {
	case right.UpdateNullCount() == 0:
		return bitutil.VisitWordsAndWrite(inBMs[:3], outBMs[:],
			func(in, out []uint64) {
				out[0], out[1] = apply(in[0], in[1], ^uint64(0), in[2])
			})
	case left.UpdateNullCount() == 0:
		return bitutil.VisitWordsAndWrite(inBMs[1:], outBMs[:],
			func(in, out []uint64) {
				out[0], out[1] = apply(^uint64(0), in[0], in[2], in[1])
			})
	default:
		return bitutil.VisitWordsAndWrite(inBMs[:], outBMs[:],
			func(in, out []uint64) {
				out[0], out[1] = apply(in[0], in[1], in[3], in[2])
			})
	}
}

type AndOpKernel struct {
	commutativeBinaryKernel[AndOpKernel]
}

func (AndOpKernel) Call(ctx *exec.KernelCtx, left, right *exec.ArraySpan, out *exec.ExecResult) error {
	bitutil.BitmapAnd(left.Buffers[1].Buf, right.Buffers[1].Buf,
		left.Offset, right.Offset, out.Buffers[1].Buf, out.Offset, left.Len)
	return nil
}

func (AndOpKernel) CallScalarLeft(ctx *exec.KernelCtx, left scalar.Scalar, right *exec.ArraySpan, out *exec.ExecResult) error {
	if !left.IsValid() {
		return nil
	}

	outBM := out.Buffers[1].Buf
	if left.(*scalar.Boolean).Value {
		bitutil.CopyBitmap(right.Buffers[1].Buf, int(right.Offset),
			int(right.Len), outBM, int(out.Offset))
	} else {
		bitutil.SetBitsTo(outBM, out.Offset, out.Len, false)
	}
	return nil
}

type KleeneAndOpKernel struct {
	commutativeBinaryKernel[KleeneAndOpKernel]
}

func (KleeneAndOpKernel) Call(ctx *exec.KernelCtx, left, right *exec.ArraySpan, out *exec.ExecResult) error {
	if left.UpdateNullCount() == 0 && right.UpdateNullCount() == 0 {
		bitutil.SetBitsTo(out.Buffers[0].Buf, out.Offset, out.Len, true)
		out.Nulls = 0
		return (AndOpKernel{}).Call(ctx, left, right, out)
	}

	computeWord := func(leftTrue, leftFalse, rightTrue, rightFalse uint64) (outValid, outData uint64) {
		return leftFalse | rightFalse | (leftTrue & rightTrue), leftTrue & rightTrue
	}
	return computeKleene(computeWord, ctx, left, right, out)
}

func (KleeneAndOpKernel) CallScalarLeft(ctx *exec.KernelCtx, left scalar.Scalar, right *exec.ArraySpan, out *exec.ExecResult) error {
	var (
		leftTrue  = left.IsValid() && left.(*scalar.Boolean).Value
		leftFalse = left.IsValid() && !left.(*scalar.Boolean).Value
	)

	switch {
	case leftFalse:
		bitutil.SetBitsTo(out.Buffers[0].Buf, out.Offset, out.Len, true)
		out.Nulls = 0
		bitutil.SetBitsTo(out.Buffers[1].Buf, out.Offset, out.Len, false)
	case leftTrue:
		if right.UpdateNullCount() == 0 {
			bitutil.SetBitsTo(out.Buffers[0].Buf, out.Offset, out.Len, true)
			out.Nulls = 0
		} else {
			bitutil.CopyBitmap(right.Buffers[0].Buf, int(right.Offset), int(right.Len),
				out.Buffers[0].Buf, int(out.Offset))
		}
		bitutil.CopyBitmap(right.Buffers[1].Buf, int(right.Offset), int(right.Len),
			out.Buffers[1].Buf, int(out.Offset))
	default: // scalar was null: out[i] is valid iff right[i] was false
		if right.UpdateNullCount() == 0 {
			bitutil.InvertBitmap(right.Buffers[1].Buf, int(right.Offset), int(right.Len),
				out.Buffers[0].Buf, int(out.Offset))
		} else {
			bitutil.BitmapAndNot(right.Buffers[0].Buf, right.Buffers[1].Buf, right.Offset,
				right.Offset, out.Buffers[0].Buf, out.Offset, right.Len)
		}
		bitutil.CopyBitmap(right.Buffers[1].Buf, int(right.Offset), int(right.Len),
			out.Buffers[1].Buf, int(out.Offset))
	}
	return nil
}

type OrOpKernel struct {
	commutativeBinaryKernel[OrOpKernel]
}

func (OrOpKernel) Call(ctx *exec.KernelCtx, left, right *exec.ArraySpan, out *exec.ExecResult) error {
	bitutil.BitmapOr(left.Buffers[1].Buf, right.Buffers[1].Buf,
		left.Offset, right.Offset, out.Buffers[1].Buf, out.Offset, left.Len)
	return nil
}

func (OrOpKernel) CallScalarLeft(ctx *exec.KernelCtx, left scalar.Scalar, right *exec.ArraySpan, out *exec.ExecResult) error {
	if !left.IsValid() {
		return nil
	}

	outBM := out.Buffers[1].Buf
	if left.(*scalar.Boolean).Value {
		bitutil.SetBitsTo(outBM, out.Offset, out.Len, true)
	} else {
		bitutil.CopyBitmap(right.Buffers[1].Buf, int(right.Offset),
			int(right.Len), outBM, int(out.Offset))
	}
	return nil
}

type KleeneOrOpKernel struct {
	commutativeBinaryKernel[KleeneOrOpKernel]
}

func (KleeneOrOpKernel) Call(ctx *exec.KernelCtx, left, right *exec.ArraySpan, out *exec.ExecResult) error {
	if left.UpdateNullCount() == 0 && right.UpdateNullCount() == 0 {
		bitutil.SetBitsTo(out.Buffers[0].Buf, out.Offset, out.Len, true)
		out.Nulls = 0
		return (OrOpKernel{}).Call(ctx, left, right, out)
	}

	computeWord := func(leftTrue, leftFalse, rightTrue, rightFalse uint64) (outValid, outData uint64) {
		return leftTrue | rightTrue | (leftFalse & rightFalse), leftTrue | rightTrue
	}
	return computeKleene(computeWord, ctx, left, right, out)
}

func (KleeneOrOpKernel) CallScalarLeft(ctx *exec.KernelCtx, left scalar.Scalar, right *exec.ArraySpan, out *exec.ExecResult) error {
	var (
		leftTrue  = left.IsValid() && left.(*scalar.Boolean).Value
		leftFalse = left.IsValid() && !left.(*scalar.Boolean).Value
	)

	switch {
	case leftTrue:
		bitutil.SetBitsTo(out.Buffers[0].Buf, out.Offset, out.Len, true)
		out.Nulls = 0
		bitutil.SetBitsTo(out.Buffers[1].Buf, out.Offset, out.Len, true) // all true case
	case leftFalse:
		if right.UpdateNullCount() == 0 {
			bitutil.SetBitsTo(out.Buffers[0].Buf, out.Offset, out.Len, true)
			out.Nulls = 0
		} else {
			bitutil.CopyBitmap(right.Buffers[0].Buf, int(right.Offset), int(right.Len),
				out.Buffers[0].Buf, int(out.Offset))
		}
		bitutil.CopyBitmap(right.Buffers[1].Buf, int(right.Offset), int(right.Len),
			out.Buffers[1].Buf, int(out.Offset))
	default: // scalar was null: out[i] is valid iff right[i] was true
		if right.UpdateNullCount() == 0 {
			bitutil.CopyBitmap(right.Buffers[1].Buf, int(right.Offset), int(right.Len),
				out.Buffers[0].Buf, int(out.Offset))
		} else {
			bitutil.BitmapAnd(right.Buffers[0].Buf, right.Buffers[1].Buf, right.Offset,
				right.Offset, out.Buffers[0].Buf, out.Offset, right.Len)
		}
		bitutil.CopyBitmap(right.Buffers[1].Buf, int(right.Offset), int(right.Len),
			out.Buffers[1].Buf, int(out.Offset))
	}
	return nil
}

type XorOpKernel struct {
	commutativeBinaryKernel[XorOpKernel]
}

func (XorOpKernel) Call(ctx *exec.KernelCtx, left, right *exec.ArraySpan, out *exec.ExecResult) error {
	bitutil.BitmapXor(left.Buffers[1].Buf, right.Buffers[1].Buf,
		left.Offset, right.Offset, out.Buffers[1].Buf, out.Offset, out.Len)
	return nil
}

func (XorOpKernel) CallScalarLeft(ctx *exec.KernelCtx, left scalar.Scalar, right *exec.ArraySpan, out *exec.ExecResult) error {
	if !left.IsValid() {
		return nil
	}

	outBM := out.Buffers[1].Buf
	if left.(*scalar.Boolean).Value {
		bitutil.InvertBitmap(right.Buffers[1].Buf, int(right.Offset), int(right.Len),
			outBM, int(out.Offset))
	} else {
		bitutil.CopyBitmap(right.Buffers[1].Buf, int(right.Offset), int(right.Len),
			outBM, int(out.Offset))
	}
	return nil
}

func invertScalar(in scalar.Scalar) *scalar.Boolean {
	if in.IsValid() {
		return scalar.NewBooleanScalar(!in.(*scalar.Boolean).Value)
	}
	return in.(*scalar.Boolean)
}

type AndNotOpKernel struct{}

func (AndNotOpKernel) Call(ctx *exec.KernelCtx, left, right *exec.ArraySpan, out *exec.ExecResult) error {
	bitutil.BitmapAndNot(left.Buffers[1].Buf, right.Buffers[1].Buf, left.Offset, right.Offset,
		out.Buffers[1].Buf, out.Offset, right.Len)
	return nil
}

func (AndNotOpKernel) CallScalarLeft(ctx *exec.KernelCtx, left scalar.Scalar, right *exec.ArraySpan, out *exec.ExecResult) error {
	if !left.IsValid() {
		return nil
	}

	outBM := out.Buffers[1].Buf
	if left.(*scalar.Boolean).Value {
		bitutil.InvertBitmap(right.Buffers[1].Buf, int(right.Offset), int(right.Len),
			outBM, int(out.Offset))
	} else {
		bitutil.SetBitsTo(outBM, out.Offset, out.Len, false)
	}
	return nil
}

func (AndNotOpKernel) CallScalarRight(ctx *exec.KernelCtx, left *exec.ArraySpan, right scalar.Scalar, out *exec.ExecResult) error {
	return (AndOpKernel{}).CallScalarRight(ctx, left, invertScalar(right), out)
}

type KleeneAndNotOpKernel struct{}

func (KleeneAndNotOpKernel) Call(ctx *exec.KernelCtx, left, right *exec.ArraySpan, out *exec.ExecResult) error {
	if left.UpdateNullCount() == 0 && right.UpdateNullCount() == 0 {
		bitutil.SetBitsTo(out.Buffers[0].Buf, out.Offset, out.Len, true)
		out.Nulls = 0
		return (AndNotOpKernel{}).Call(ctx, left, right, out)
	}

	computeWord := func(leftTrue, leftFalse, rightTrue, rightFalse uint64) (outValid, outData uint64) {
		return leftFalse | rightTrue | (leftTrue & rightFalse), leftTrue & rightFalse
	}

	return computeKleene(computeWord, ctx, left, right, out)
}

func (KleeneAndNotOpKernel) CallScalarLeft(ctx *exec.KernelCtx, left scalar.Scalar, right *exec.ArraySpan, out *exec.ExecResult) error {
	var (
		leftTrue  = left.IsValid() && left.(*scalar.Boolean).Value
		leftFalse = left.IsValid() && !left.(*scalar.Boolean).Value
	)

	switch {
	case leftFalse:
		bitutil.SetBitsTo(out.Buffers[0].Buf, out.Offset, out.Len, true)
		out.Nulls = 0
		bitutil.SetBitsTo(out.Buffers[1].Buf, out.Offset, out.Len, false)
	case leftTrue:
		if right.UpdateNullCount() == 0 {
			bitutil.SetBitsTo(out.Buffers[0].Buf, out.Offset, out.Len, true)
			out.Nulls = 0
		} else {
			bitutil.CopyBitmap(right.Buffers[0].Buf, int(right.Offset), int(right.Len),
				out.Buffers[0].Buf, int(out.Offset))
		}
		bitutil.InvertBitmap(right.Buffers[1].Buf, int(right.Offset), int(right.Len),
			out.Buffers[1].Buf, int(out.Offset))
	default: // scalar was null: out[i] is valid iff right[i] was true
		if right.UpdateNullCount() == 0 {
			bitutil.CopyBitmap(right.Buffers[1].Buf, int(right.Offset), int(right.Len),
				out.Buffers[0].Buf, int(out.Offset))
		} else {
			bitutil.BitmapAnd(right.Buffers[0].Buf, right.Buffers[1].Buf, right.Offset, right.Offset,
				out.Buffers[0].Buf, out.Offset, right.Len)
		}
		bitutil.InvertBitmap(right.Buffers[1].Buf, int(right.Offset), int(right.Len),
			out.Buffers[1].Buf, int(out.Offset))
	}
	return nil
}

func (KleeneAndNotOpKernel) CallScalarRight(ctx *exec.KernelCtx, left *exec.ArraySpan, right scalar.Scalar, out *exec.ExecResult) error {
	return (KleeneAndOpKernel{}).CallScalarRight(ctx, left, invertScalar(right), out)
}

func NotExecKernel(ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
	bitutil.InvertBitmap(batch.Values[0].Array.Buffers[1].Buf, int(batch.Values[0].Array.Offset),
		int(batch.Values[0].Array.Len), out.Buffers[1].Buf, int(out.Offset))

	out.Buffers[0] = batch.Values[0].Array.Buffers[0]
	if out.Buffers[0].SelfAlloc {
		out.Buffers[0].SelfAlloc = false
	}
	out.Nulls = batch.Values[0].Array.Nulls

	return nil
}
