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

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/array"
	"github.com/apache/arrow-go/v18/arrow/compute/exec"
	"github.com/apache/arrow-go/v18/arrow/compute/internal/kernels"
	"golang.org/x/sync/errgroup"
)

var (
	filterDoc = FunctionDoc{
		Summary: "Filter with a boolean selection filter",
		Description: `The output is populated with values from the input at positions
where the selection filter is non-zero. Nulls in the selection filter
are handled based on FilterOptions.`,
		ArgNames:    []string{"input", "selection_filter"},
		OptionsType: "FilterOptions",
	}
	filterMetaFunc = NewMetaFunction("filter", Binary(), filterDoc,
		func(ctx context.Context, opts FunctionOptions, args ...Datum) (Datum, error) {
			if args[1].(ArrayLikeDatum).Type().ID() != arrow.BOOL {
				return nil, fmt.Errorf("%w: filter argument must be boolean type",
					arrow.ErrNotImplemented)
			}

			switch args[0].Kind() {
			case KindRecord:
				filtOpts, ok := opts.(*FilterOptions)
				if !ok {
					return nil, fmt.Errorf("%w: invalid options type", arrow.ErrInvalid)
				}

				if filter, ok := args[1].(*ArrayDatum); ok {
					filterArr := filter.MakeArray()
					defer filterArr.Release()
					rec, err := FilterRecordBatch(ctx, args[0].(*RecordDatum).Value, filterArr, filtOpts)
					if err != nil {
						return nil, err
					}
					return &RecordDatum{Value: rec}, nil
				}
				return nil, fmt.Errorf("%w: record batch filtering only implemented for Array filter", arrow.ErrNotImplemented)
			case KindTable:
				filtOpts, ok := opts.(*FilterOptions)
				if !ok {
					return nil, fmt.Errorf("%w: invalid options type", arrow.ErrInvalid)
				}

				tbl, err := FilterTable(ctx, args[0].(*TableDatum).Value, args[1], filtOpts)
				if err != nil {
					return nil, err
				}
				return &TableDatum{Value: tbl}, nil

			default:
				return CallFunction(ctx, "array_filter", opts, args...)
			}
		})
	takeDoc = FunctionDoc{
		Summary: "Select values from an input based on indices from another array",
		Description: `The output is populated with values from the input at positions
given by "indices". Nulls in "indices" emit null in the output`,
		ArgNames:    []string{"input", "indices"},
		OptionsType: "TakeOptions",
	}
	takeMetaFunc = NewMetaFunction("take", Binary(), takeDoc,
		func(ctx context.Context, opts FunctionOptions, args ...Datum) (Datum, error) {
			indexKind := args[1].Kind()
			if indexKind != KindArray && indexKind != KindChunked {
				return nil, fmt.Errorf("%w: unsupported types for take operation: values=%s, indices=%s",
					arrow.ErrNotImplemented, args[0], args[1])
			}

			switch args[0].Kind() {
			case KindArray:
				return takeArrayImpl(ctx, opts, args...)
			case KindChunked:
				return takeChunkedImpl(ctx, opts, args...)
			case KindRecord:
				return takeRecordImpl(ctx, opts, args...)
			case KindTable:
				return takeTableImpl(ctx, opts, args...)
			}

			return nil, fmt.Errorf("%w: unsupported types for take operation: values=%s, indices=%s",
				arrow.ErrNotImplemented, args[0], args[1])
		})
)

func takeTableImpl(ctx context.Context, opts FunctionOptions, args ...Datum) (Datum, error) {
	tbl := args[0].(*TableDatum).Value
	ncols := int(tbl.NumCols())
	cols := make([]arrow.Column, ncols)
	defer func() {
		for _, c := range cols {
			c.Release()
		}
	}()

	eg, cctx := errgroup.WithContext(ctx)
	eg.SetLimit(GetExecCtx(ctx).NumParallel)
	for i := 0; i < ncols; i++ {
		i := i
		eg.Go(func() error {
			inCol := tbl.Column(i)
			result, err := CallFunction(cctx, "take", opts,
				&ChunkedDatum{Value: inCol.Data()},
				args[1])
			if err != nil {
				return err
			}
			defer result.Release()
			out := result.(ArrayLikeDatum)
			chunks := out.Chunks()
			if out.Kind() == KindArray {
				defer chunks[0].Release()
			}
			chk := arrow.NewChunked(out.Type(), chunks)
			defer chk.Release()
			cols[i] = *arrow.NewColumn(inCol.Field(), chk)
			return nil
		})
	}

	if err := eg.Wait(); err != nil {
		return nil, err
	}

	final := array.NewTable(tbl.Schema(), cols, -1)
	return &TableDatum{Value: final}, nil
}

func takeRecordImpl(ctx context.Context, opts FunctionOptions, args ...Datum) (Datum, error) {
	indices := args[1]
	if indices.Kind() == KindChunked {
		newIndices, err := array.Concatenate(indices.(*ChunkedDatum).Chunks(), exec.GetAllocator(ctx))
		if err != nil {
			return nil, err
		}
		defer newIndices.Release()
		indices = &ArrayDatum{Value: newIndices.Data()}
	}

	rb := args[0].(*RecordDatum).Value
	ncols := rb.NumCols()
	nrows := args[1].(ArrayLikeDatum).Len()
	cols := make([]arrow.Array, ncols)
	defer func() {
		for _, c := range cols {
			if c != nil {
				c.Release()
			}
		}
	}()

	eg, cctx := errgroup.WithContext(ctx)
	eg.SetLimit(GetExecCtx(ctx).NumParallel)
	for i := range rb.Columns() {
		i := i
		eg.Go(func() error {
			out, err := CallFunction(cctx, "array_take", opts, &ArrayDatum{Value: rb.Column(i).Data()}, indices)
			if err != nil {
				return err
			}
			defer out.Release()
			cols[i] = out.(*ArrayDatum).MakeArray()
			return nil
		})
	}

	if err := eg.Wait(); err != nil {
		return nil, err
	}

	outRec := array.NewRecord(rb.Schema(), cols, nrows)
	return &RecordDatum{Value: outRec}, nil
}

func takeArrayImpl(ctx context.Context, opts FunctionOptions, args ...Datum) (Datum, error) {
	switch args[1].Kind() {
	case KindArray:
		return CallFunction(ctx, "array_take", opts, args...)
	case KindChunked:
		chunks := args[1].(*ChunkedDatum).Chunks()
		out := make([]arrow.Array, len(chunks))
		defer func() {
			for _, a := range out {
				if a != nil {
					a.Release()
				}
			}
		}()

		eg, cctx := errgroup.WithContext(ctx)
		eg.SetLimit(GetExecCtx(ctx).NumParallel)
		for i := range chunks {
			i := i
			eg.Go(func() error {
				result, err := CallFunction(cctx, "array_take", opts, args[0], &ArrayDatum{Value: chunks[i].Data()})
				if err != nil {
					return err
				}
				defer result.Release()
				out[i] = result.(*ArrayDatum).MakeArray()
				return nil
			})
		}
		if err := eg.Wait(); err != nil {
			return nil, err
		}
		return &ChunkedDatum{
			Value: arrow.NewChunked(args[0].(*ArrayDatum).Type(), out)}, nil
	}

	return nil, fmt.Errorf("%w: unsupported types for take operation: values=%s, indices=%s",
		arrow.ErrNotImplemented, args[0], args[1])
}

func takeChunkedImpl(ctx context.Context, opts FunctionOptions, args ...Datum) (Datum, error) {
	chunked := args[0].(*ChunkedDatum).Value
	var chnkArg *arrow.Chunked
	if arg, ok := args[1].(*ArrayDatum); ok {
		switch {
		case len(chunked.Chunks()) <= 1:
			var curChunk arrow.Array
			if len(chunked.Chunks()) == 1 {
				curChunk = chunked.Chunk(0)
			} else {
				// no chunks, create an empty one!
				curChunk = array.MakeArrayOfNull(exec.GetAllocator(ctx), chunked.DataType(), 0)
				defer curChunk.Release()
			}
			newChunk, err := CallFunction(ctx, "array_take", opts, &ArrayDatum{Value: curChunk.Data()}, arg)
			if err != nil {
				return nil, err
			}
			defer newChunk.Release()
			outChunks := newChunk.(*ArrayDatum).Chunks()
			defer outChunks[0].Release()
			return &ChunkedDatum{Value: arrow.NewChunked(outChunks[0].DataType(), outChunks)}, nil
		case kernels.ChunkedTakeSupported(chunked.DataType()):
			indices := arg.Chunks()
			defer indices[0].Release()
			chnkArg = arrow.NewChunked(arg.Type(), indices)
			defer chnkArg.Release()
		default:
			values, err := array.Concatenate(chunked.Chunks(), GetAllocator(ctx))
			if err != nil {
				return nil, err
			}
			defer values.Release()
			newChunk, err := CallFunction(ctx, "array_take", opts, &ArrayDatum{Value: values.Data()}, arg)
			if err != nil {
				return nil, err
			}
			defer newChunk.Release()
			outChunks := newChunk.(*ArrayDatum).Chunks()
			defer outChunks[0].Release()
			return &ChunkedDatum{Value: arrow.NewChunked(outChunks[0].DataType(), outChunks)}, nil
		}
	} else {
		chnkArg = args[1].(*ChunkedDatum).Value
	}

	if kernels.ChunkedTakeSupported(chunked.DataType()) {
		return CallFunction(ctx, "array_take", opts, args[0], &ChunkedDatum{Value: chnkArg})
	}

	values, err := array.Concatenate(chunked.Chunks(), GetAllocator(ctx))
	if err != nil {
		return nil, err
	}
	defer values.Release()
	return CallFunction(ctx, "take", opts, &ArrayDatum{Value: values.Data()}, &ChunkedDatum{Value: chnkArg})
}

func Take(ctx context.Context, opts TakeOptions, values, indices Datum) (Datum, error) {
	return CallFunction(ctx, "take", &opts, values, indices)
}

func TakeArray(ctx context.Context, values, indices arrow.Array) (arrow.Array, error) {
	v := NewDatum(values)
	idx := NewDatum(indices)
	defer v.Release()
	defer idx.Release()

	out, err := CallFunction(ctx, "array_take", nil, v, idx)
	if err != nil {
		return nil, err
	}
	defer out.Release()

	return out.(*ArrayDatum).MakeArray(), nil
}

func TakeArrayOpts(ctx context.Context, values, indices arrow.Array, opts TakeOptions) (arrow.Array, error) {
	v := NewDatum(values)
	idx := NewDatum(indices)
	defer v.Release()
	defer idx.Release()

	out, err := CallFunction(ctx, "array_take", &opts, v, idx)
	if err != nil {
		return nil, err
	}
	defer out.Release()

	return out.(*ArrayDatum).MakeArray(), nil
}

type listArr interface {
	arrow.Array
	ListValues() arrow.Array
}

func selectListImpl(fn exec.ArrayKernelExec) exec.ArrayKernelExec {
	return func(ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
		if err := fn(ctx, batch, out); err != nil {
			return err
		}

		// out.Children[0] contains the child indexes of values that we
		// want to take after processing.
		values := batch.Values[0].Array.MakeArray().(listArr)
		defer values.Release()

		childIndices := out.Children[0].MakeArray()
		defer childIndices.Release()

		takenChild, err := TakeArrayOpts(ctx.Ctx, values.ListValues(), childIndices, kernels.TakeOptions{BoundsCheck: false})
		if err != nil {
			return err
		}
		defer takenChild.Release()

		out.Children[0].TakeOwnership(takenChild.Data())
		return nil
	}
}

func denseUnionImpl(fn exec.ArrayKernelExec) exec.ArrayKernelExec {
	return func(ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
		if err := fn(ctx, batch, out); err != nil {
			return err
		}

		typedValues := batch.Values[0].Array.MakeArray().(*array.DenseUnion)
		defer typedValues.Release()

		eg, cctx := errgroup.WithContext(ctx.Ctx)
		eg.SetLimit(GetExecCtx(ctx.Ctx).NumParallel)

		for i := 0; i < typedValues.NumFields(); i++ {
			i := i
			eg.Go(func() error {
				arr := typedValues.Field(i)
				childIndices := out.Children[i].MakeArray()
				defer childIndices.Release()
				taken, err := TakeArrayOpts(cctx, arr, childIndices, kernels.TakeOptions{})
				if err != nil {
					return err
				}
				defer taken.Release()
				out.Children[i].TakeOwnership(taken.Data())
				return nil
			})
		}

		return eg.Wait()
	}
}

func extensionFilterImpl(ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
	extArray := batch.Values[0].Array.MakeArray().(array.ExtensionArray)
	defer extArray.Release()

	selection := batch.Values[1].Array.MakeArray()
	defer selection.Release()
	result, err := FilterArray(ctx.Ctx, extArray.Storage(), selection, FilterOptions(ctx.State.(kernels.FilterState)))
	if err != nil {
		return err
	}
	defer result.Release()

	out.TakeOwnership(result.Data())
	out.Type = extArray.DataType()
	return nil
}

func extensionTakeImpl(ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
	extArray := batch.Values[0].Array.MakeArray().(array.ExtensionArray)
	defer extArray.Release()

	selection := batch.Values[1].Array.MakeArray()
	defer selection.Release()
	result, err := TakeArrayOpts(ctx.Ctx, extArray.Storage(), selection, TakeOptions(ctx.State.(kernels.TakeState)))
	if err != nil {
		return err
	}
	defer result.Release()

	out.TakeOwnership(result.Data())
	out.Type = extArray.DataType()
	return nil
}

func structFilter(ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
	// transform filter to selection indices and use take
	indices, err := kernels.GetTakeIndices(exec.GetAllocator(ctx.Ctx),
		&batch.Values[1].Array, ctx.State.(kernels.FilterState).NullSelection)
	if err != nil {
		return err
	}
	defer indices.Release()

	filter := NewDatum(indices)
	defer filter.Release()

	valData := batch.Values[0].Array.MakeData()
	defer valData.Release()

	vals := NewDatum(valData)
	defer vals.Release()

	result, err := Take(ctx.Ctx, kernels.TakeOptions{BoundsCheck: false}, vals, filter)
	if err != nil {
		return err
	}
	defer result.Release()

	out.TakeOwnership(result.(*ArrayDatum).Value)
	return nil
}

func structTake(ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
	// generate top level validity bitmap
	if err := kernels.TakeExec(kernels.StructImpl)(ctx, batch, out); err != nil {
		return err
	}

	values := batch.Values[0].Array.MakeArray().(*array.Struct)
	defer values.Release()

	// select from children without bounds checking
	out.Children = make([]exec.ArraySpan, values.NumField())
	eg, cctx := errgroup.WithContext(ctx.Ctx)
	eg.SetLimit(GetExecCtx(ctx.Ctx).NumParallel)

	selection := batch.Values[1].Array.MakeArray()
	defer selection.Release()

	for i := range out.Children {
		i := i
		eg.Go(func() error {
			taken, err := TakeArrayOpts(cctx, values.Field(i), selection, kernels.TakeOptions{BoundsCheck: false})
			if err != nil {
				return err
			}
			defer taken.Release()

			out.Children[i].TakeOwnership(taken.Data())
			return nil
		})
	}

	return eg.Wait()
}

// RegisterVectorSelection registers functions that select specific
// values from arrays such as Take and Filter
func RegisterVectorSelection(reg FunctionRegistry) {
	filterMetaFunc.defaultOpts = DefaultFilterOptions()
	takeMetaFunc.defaultOpts = DefaultTakeOptions()
	reg.AddFunction(filterMetaFunc, false)
	reg.AddFunction(takeMetaFunc, false)
	filterKernels, takeKernels := kernels.GetVectorSelectionKernels()

	filterKernels = append(filterKernels, []kernels.SelectionKernelData{
		{In: exec.NewIDInput(arrow.LIST), Exec: selectListImpl(kernels.FilterExec(kernels.ListImpl[int32]))},
		{In: exec.NewIDInput(arrow.LARGE_LIST), Exec: selectListImpl(kernels.FilterExec(kernels.ListImpl[int64]))},
		{In: exec.NewIDInput(arrow.FIXED_SIZE_LIST), Exec: selectListImpl(kernels.FilterExec(kernels.FSLImpl))},
		{In: exec.NewIDInput(arrow.DENSE_UNION), Exec: denseUnionImpl(kernels.FilterExec(kernels.DenseUnionImpl))},
		{In: exec.NewIDInput(arrow.EXTENSION), Exec: extensionFilterImpl},
		{In: exec.NewIDInput(arrow.STRUCT), Exec: structFilter},
	}...)

	takeKernels = append(takeKernels, []kernels.SelectionKernelData{
		{In: exec.NewIDInput(arrow.LIST), Exec: selectListImpl(kernels.TakeExec(kernels.ListImpl[int32]))},
		{In: exec.NewIDInput(arrow.LARGE_LIST), Exec: selectListImpl(kernels.TakeExec(kernels.ListImpl[int64]))},
		{In: exec.NewIDInput(arrow.FIXED_SIZE_LIST), Exec: selectListImpl(kernels.TakeExec(kernels.FSLImpl))},
		{In: exec.NewIDInput(arrow.DENSE_UNION), Exec: denseUnionImpl(kernels.TakeExec(kernels.DenseUnionImpl))},
		{In: exec.NewIDInput(arrow.EXTENSION), Exec: extensionTakeImpl},
		{In: exec.NewIDInput(arrow.STRUCT), Exec: structTake},
	}...)

	vfunc := NewVectorFunction("array_filter", Binary(), EmptyFuncDoc)
	vfunc.defaultOpts = &kernels.FilterOptions{}

	selectionType := exec.NewExactInput(arrow.FixedWidthTypes.Boolean)
	basekernel := exec.NewVectorKernelWithSig(nil, nil, exec.OptionsInit[kernels.FilterState])
	for _, kd := range filterKernels {
		basekernel.Signature = &exec.KernelSignature{
			InputTypes: []exec.InputType{kd.In, selectionType},
			OutType:    kernels.OutputFirstType,
		}
		basekernel.ExecFn = kd.Exec
		basekernel.ExecChunked = kd.Chunked
		vfunc.AddKernel(basekernel)
	}
	reg.AddFunction(vfunc, false)

	vfunc = NewVectorFunction("array_take", Binary(), EmptyFuncDoc)
	vfunc.defaultOpts = DefaultTakeOptions()

	selectionType = exec.NewMatchedInput(exec.Integer())
	basekernel = exec.NewVectorKernelWithSig(nil, nil, exec.OptionsInit[kernels.TakeState])
	basekernel.CanExecuteChunkWise = false
	for _, kd := range takeKernels {
		basekernel.Signature = &exec.KernelSignature{
			InputTypes: []exec.InputType{kd.In, selectionType},
			OutType:    kernels.OutputFirstType,
		}

		basekernel.ExecFn = kd.Exec
		basekernel.ExecChunked = kd.Chunked
		vfunc.AddKernel(basekernel)
	}
	reg.AddFunction(vfunc, false)
}

// Filter is a wrapper convenience that is equivalent to calling
// CallFunction(ctx, "filter", &options, values, filter) for filtering
// an input array (values) by a boolean array (filter). The two inputs
// must be the same length.
func Filter(ctx context.Context, values, filter Datum, options FilterOptions) (Datum, error) {
	return CallFunction(ctx, "filter", &options, values, filter)
}

// FilterArray is a convenience method for calling Filter without having
// to manually construct the intervening Datum objects (they will be
// created for you internally here).
func FilterArray(ctx context.Context, values, filter arrow.Array, options FilterOptions) (arrow.Array, error) {
	valDatum := NewDatum(values)
	filterDatum := NewDatum(filter)
	defer valDatum.Release()
	defer filterDatum.Release()

	outDatum, err := Filter(ctx, valDatum, filterDatum, options)
	if err != nil {
		return nil, err
	}

	defer outDatum.Release()
	return outDatum.(*ArrayDatum).MakeArray(), nil
}

func FilterRecordBatch(ctx context.Context, batch arrow.Record, filter arrow.Array, opts *FilterOptions) (arrow.Record, error) {
	if batch.NumRows() != int64(filter.Len()) {
		return nil, fmt.Errorf("%w: filter inputs must all be the same length", arrow.ErrInvalid)
	}

	var filterSpan exec.ArraySpan
	filterSpan.SetMembers(filter.Data())

	indices, err := kernels.GetTakeIndices(exec.GetAllocator(ctx), &filterSpan, opts.NullSelection)
	if err != nil {
		return nil, err
	}
	defer indices.Release()

	indicesArr := array.MakeFromData(indices)
	defer indicesArr.Release()

	cols := make([]arrow.Array, batch.NumCols())
	defer func() {
		for _, c := range cols {
			if c != nil {
				c.Release()
			}
		}
	}()
	eg, cctx := errgroup.WithContext(ctx)
	eg.SetLimit(GetExecCtx(ctx).NumParallel)
	for i, col := range batch.Columns() {
		i, col := i, col
		eg.Go(func() error {
			out, err := TakeArrayOpts(cctx, col, indicesArr, kernels.TakeOptions{BoundsCheck: false})
			if err != nil {
				return err
			}
			cols[i] = out
			return nil
		})
	}

	if err := eg.Wait(); err != nil {
		return nil, err
	}

	return array.NewRecord(batch.Schema(), cols, int64(indicesArr.Len())), nil
}

func FilterTable(ctx context.Context, tbl arrow.Table, filter Datum, opts *FilterOptions) (arrow.Table, error) {
	if tbl.NumRows() != filter.Len() {
		return nil, fmt.Errorf("%w: filter inputs must all be the same length", arrow.ErrInvalid)
	}

	if tbl.NumRows() == 0 {
		cols := make([]arrow.Column, tbl.NumCols())
		for i := 0; i < int(tbl.NumCols()); i++ {
			cols[i] = *tbl.Column(i)
		}
		return array.NewTable(tbl.Schema(), cols, 0), nil
	}

	// last input element will be the filter array
	nCols := tbl.NumCols()
	inputs := make([][]arrow.Array, nCols+1)
	for i := int64(0); i < nCols; i++ {
		inputs[i] = tbl.Column(int(i)).Data().Chunks()
	}

	switch ft := filter.(type) {
	case *ArrayDatum:
		inputs[nCols] = ft.Chunks()
		defer inputs[nCols][0].Release()
	case *ChunkedDatum:
		inputs[nCols] = ft.Chunks()
	default:
		return nil, fmt.Errorf("%w: filter should be array-like", arrow.ErrNotImplemented)
	}

	// rechunk inputs to allow consistent iteration over the respective chunks
	inputs = exec.RechunkArraysConsistently(inputs)

	// instead of filtering each column with the boolean filter
	// (which would be slow if the table has a large number of columns)
	// convert each filter chunk to indices and take() the column
	mem := GetAllocator(ctx)
	outCols := make([][]arrow.Array, nCols)
	// pre-size the output
	nChunks := len(inputs[nCols])
	for i := range outCols {
		outCols[i] = make([]arrow.Array, nChunks)
	}
	var outNumRows int64
	var cancel context.CancelFunc
	ctx, cancel = context.WithCancel(ctx)
	defer cancel()

	eg, cctx := errgroup.WithContext(ctx)
	eg.SetLimit(GetExecCtx(cctx).NumParallel)

	var filterSpan exec.ArraySpan
	for i, filterChunk := range inputs[nCols] {
		filterSpan.SetMembers(filterChunk.Data())
		indices, err := kernels.GetTakeIndices(mem, &filterSpan, opts.NullSelection)
		if err != nil {
			return nil, err
		}
		defer indices.Release()
		filterChunk.Release()
		if indices.Len() == 0 {
			for col := int64(0); col < nCols; col++ {
				inputs[col][i].Release()
			}
			continue
		}

		// take from all input columns
		outNumRows += int64(indices.Len())
		indicesDatum := NewDatum(indices)
		defer indicesDatum.Release()

		for col := int64(0); col < nCols; col++ {
			columnChunk := inputs[col][i]
			defer columnChunk.Release()
			i := i
			col := col
			eg.Go(func() error {
				columnDatum := NewDatum(columnChunk)
				defer columnDatum.Release()
				out, err := Take(cctx, kernels.TakeOptions{BoundsCheck: false}, columnDatum, indicesDatum)
				if err != nil {
					return err
				}
				defer out.Release()
				outCols[col][i] = out.(*ArrayDatum).MakeArray()
				return nil
			})
		}
	}

	if err := eg.Wait(); err != nil {
		return nil, err
	}

	outChunks := make([]arrow.Column, nCols)
	for i, chunks := range outCols {
		chk := arrow.NewChunked(tbl.Column(i).DataType(), chunks)
		outChunks[i] = *arrow.NewColumn(tbl.Schema().Field(i), chk)
		defer outChunks[i].Release()
		chk.Release()
	}

	return array.NewTable(tbl.Schema(), outChunks, outNumRows), nil
}
