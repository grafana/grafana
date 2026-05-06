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

package pqarrow

import (
	"context"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/array"
	"github.com/apache/arrow-go/v18/arrow/compute"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/parquet"
	"github.com/apache/arrow-go/v18/parquet/file"
	"github.com/apache/arrow-go/v18/parquet/internal/debug"
	"github.com/apache/arrow-go/v18/parquet/internal/encoding"
)

func isDictEncoding(enc parquet.Encoding) bool {
	return enc == parquet.Encodings.PlainDict
}

func dictionaryDirectWriteSupported(arr arrow.Array) bool {
	debug.Assert(arr.DataType().ID() == arrow.DICTIONARY, "should only be called with dictionary type")
	dt := arr.DataType().(*arrow.DictionaryType)
	return arrow.IsPrimitive(dt.ValueType.ID()) || arrow.IsBaseBinary(dt.ValueType.ID())
}

func convertDictionaryToDense(mem memory.Allocator, arr arrow.Array) (arrow.Array, error) {
	dt := arr.DataType().(*arrow.DictionaryType).ValueType
	ctx := compute.WithAllocator(context.Background(), mem)
	return compute.CastArray(ctx, arr, compute.SafeCastOptions(dt))
}

func writeDictionaryArrow(ctx *arrowWriteContext, cw file.ColumnChunkWriter, leafArr arrow.Array, defLevels, repLevels []int16, maybeParentNulls bool) (err error) {
	// if this is the first time writing a dictionary array,
	// then there's a few possible paths to take:
	//
	// - If dictionary encoding is not enabled, just convert to densely
	//   encoded and call writeDenseArrow
	// - Dictionary Encoding is enabled:
	//   - If this is the first time this is called, then we
	//     call PutDictionary into the encoder and PutIndices on each
	//     chunk. We store the dictionary that was written so that
	//     subsequent calls to this method can make sure the dictionary
	//     hasn't changed.
	//   - on subsequent calls, we have to check whether the dictionary
	//     has changed. If it has, then we trigger the varying dictionary
	//     path and materialize each chunk and call writeDenseArrow with that
	writeDense := func() error {
		denseArr, err := convertDictionaryToDense(ctx.props.mem, leafArr)
		if err != nil {
			return err
		}
		defer denseArr.Release()
		return writeDenseArrow(ctx, cw, denseArr, defLevels, repLevels, maybeParentNulls)
	}

	if !isDictEncoding(cw.CurrentEncoder().Encoding()) || !dictionaryDirectWriteSupported(leafArr) {
		// no longer dictionary-encoding for whatever reason, maybe we never were
		// or we decided to stop. Note that writeArrowToColumn can be invoked multiple
		// times with both dense and dictionary-encoded versions of the same data
		// without a problem. Any dense data will be hashed to indices until the
		// dictionary page limit is reached, at which everything (dict and dense)
		// will fall back to plain encoding
		return writeDense()
	}

	var (
		dictEncoder = cw.CurrentEncoder().(encoding.DictEncoder)
		data        = leafArr.(*array.Dictionary)
		dict        = data.Dictionary()
		indices     = data.Indices()
		preserved   = dictEncoder.PreservedDictionary()
		pageStats   = cw.PageStatistics()
	)

	updateStats := func() error {
		var referencedDict arrow.Array

		ctx := compute.WithAllocator(context.Background(), ctx.props.mem)
		// if dictionary is the same dictionary we already have, just use that
		if preserved != nil && preserved == dict {
			referencedDict = preserved
		} else {
			referencedIndices, err := compute.UniqueArray(ctx, indices)
			if err != nil {
				return err
			}

			// on first run, we might be able to re-use the existing dict
			if referencedIndices.Len() == dict.Len() {
				referencedDict = dict
			} else {
				referencedDict, err = compute.TakeArrayOpts(ctx, dict, referencedIndices, compute.TakeOptions{BoundsCheck: false})
				if err != nil {
					return err
				}
				defer referencedDict.Release()
			}
			referencedIndices.Release()
		}

		nonNullCount := indices.Len() - indices.NullN()
		pageStats.IncNulls(int64(len(defLevels) - nonNullCount))
		pageStats.IncNumValues(int64(nonNullCount))
		return pageStats.UpdateFromArrow(referencedDict, false)
	}

	switch {
	case preserved == nil:
		if err := dictEncoder.PutDictionary(dict); err != nil {
			return err
		}

		// if there were duplicate values in the dictionary, the encoder's
		// memo table will be out of sync with the indices in the arrow array
		// the easiest solution for this uncommon case is to fallback to plain
		// encoding
		if dictEncoder.NumEntries() != dict.Len() {
			cw.FallbackToPlain()
			return writeDense()
		}

		if pageStats != nil {
			if err := updateStats(); err != nil {
				return err
			}
		}

	case !array.Equal(dict, preserved):
		// dictionary has changed
		cw.FallbackToPlain()
		return writeDense()
	default:
		// dictionary is the same but we need to update stats
		if pageStats != nil {
			if err := updateStats(); err != nil {
				return err
			}
		}
	}

	return cw.WriteDictIndices(indices, defLevels, repLevels)
}
