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

package file

import (
	"fmt"
	"math"
	"math/bits"
	"unsafe"

	shared_utils "github.com/apache/arrow-go/v18/internal/utils"
	"github.com/apache/arrow-go/v18/parquet"
	"github.com/apache/arrow-go/v18/parquet/internal/bmi"
	"github.com/apache/arrow-go/v18/parquet/internal/utils"
	"github.com/apache/arrow-go/v18/parquet/schema"
	"golang.org/x/xerrors"
)

type LevelInfo struct {
	// How many slots an undefined but present (i.e. null) element in
	// parquet consumes when decoding to Arrow.
	// "Slot" is used in the same context as the Arrow specification
	// (i.e. a value holder).
	// This is only ever >1 for descendents of FixedSizeList.
	NullSlotUsage int32
	// The definition level at which the value for the field
	// is considered not null (definition levels greater than
	// or equal to this value indicate a not-null
	// value for the field). For list fields definition levels
	// greater than or equal to this field indicate a present,
	// possibly null, child value.
	DefLevel int16
	// The repetition level corresponding to this element
	// or the closest repeated ancestor.  Any repetition
	// level less than this indicates either a new list OR
	// an empty list (which is determined in conjunction
	// with definition levels).
	RepLevel int16
	// The definition level indicating the level at which the closest
	// repeated ancestor is not empty.  This is used to discriminate
	// between a value less than |def_level| being null or excluded entirely.
	// For instance if we have an arrow schema like:
	// list(struct(f0: int)).  Then then there are the following
	// definition levels:
	//   0 = null list
	//   1 = present but empty list.
	//   2 = a null value in the list
	//   3 = a non null struct but null integer.
	//   4 = a present integer.
	// When reconstructing, the struct and integer arrays'
	// repeated_ancestor_def_level would be 2.  Any
	// def_level < 2 indicates that there isn't a corresponding
	// child value in the list.
	// i.e. [null, [], [null], [{f0: null}], [{f0: 1}]]
	// has the def levels [0, 1, 2, 3, 4].  The actual
	// struct array is only of length 3: [not-set, set, set] and
	// the int array is also of length 3: [N/A, null, 1].
	RepeatedAncestorDefLevel int16
}

func (l *LevelInfo) Equal(rhs *LevelInfo) bool {
	return l.NullSlotUsage == rhs.NullSlotUsage &&
		l.DefLevel == rhs.DefLevel &&
		l.RepLevel == rhs.RepLevel &&
		l.RepeatedAncestorDefLevel == rhs.RepeatedAncestorDefLevel
}

func (l *LevelInfo) HasNullableValues() bool {
	return l.RepeatedAncestorDefLevel < l.DefLevel
}

func (l *LevelInfo) IncrementOptional() {
	l.DefLevel++
}

func (l *LevelInfo) IncrementRepeated() int16 {
	lastRepAncestor := l.RepeatedAncestorDefLevel
	// Repeated fields add both a repetition and definition level. This is used
	// to distinguish between an empty list and a list with an item in it.
	l.RepLevel++
	l.DefLevel++

	// For levels >= repeated_ancestor_def_level it indicates the list was
	// non-null and had at least one element.  This is important
	// for later decoding because we need to add a slot for these
	// values.  for levels < current_def_level no slots are added
	// to arrays.
	l.RepeatedAncestorDefLevel = l.DefLevel
	return lastRepAncestor
}

func (l *LevelInfo) Increment(n schema.Node) {
	switch n.RepetitionType() {
	case parquet.Repetitions.Repeated:
		l.IncrementRepeated()
	case parquet.Repetitions.Optional:
		l.IncrementOptional()
	}
}

// Input/Output structure for reconstructed validity bitmaps.
type ValidityBitmapInputOutput struct {
	// Input only.
	// The maximum number of values_read expected (actual
	// values read must be less than or equal to this value).
	// If this number is exceeded methods will throw a
	// ParquetException. Exceeding this limit indicates
	// either a corrupt or incorrectly written file.
	ReadUpperBound int64
	// Output only. The number of values added to the encountered
	// (this is logically the count of the number of elements
	// for an Arrow array).
	Read int64
	// Input/Output. The number of nulls encountered.
	NullCount int64
	// Output only. The validity bitmap to populate. May be be null only
	// for DefRepLevelsToListInfo (if all that is needed is list offsets).
	ValidBits []byte
	// Input only, offset into valid_bits to start at.
	ValidBitsOffset int64
}

// create a bitmap out of the definition Levels and return the number of non-null values
func defLevelsBatchToBitmap(defLevels []int16, remainingUpperBound int64, info LevelInfo, wr utils.BitmapWriter, hasRepeatedParent bool) (count uint64) {
	const maxbatch = 8 * int(unsafe.Sizeof(uint64(0)))

	if !hasRepeatedParent && int64(len(defLevels)) > remainingUpperBound {
		panic("values read exceed upper bound")
	}

	var batch []int16
	for len(defLevels) > 0 {
		batchSize := shared_utils.Min(maxbatch, len(defLevels))
		batch, defLevels = defLevels[:batchSize], defLevels[batchSize:]
		definedBitmap := bmi.GreaterThanBitmap(batch, info.DefLevel-1)

		if hasRepeatedParent {
			// Greater than level_info.repeated_ancestor_def_level - 1 implies >= the
			// repeated_ancestor_def_level
			presentBitmap := bmi.GreaterThanBitmap(batch, info.RepeatedAncestorDefLevel-1)
			selectedBits := bmi.ExtractBits(definedBitmap, presentBitmap)
			selectedCount := int64(bits.OnesCount64(presentBitmap))
			if selectedCount > remainingUpperBound {
				panic("values read exceeded upper bound")
			}
			wr.AppendWord(selectedBits, selectedCount)
			count += uint64(bits.OnesCount64(selectedBits))
			continue
		}

		wr.AppendWord(definedBitmap, int64(len(batch)))
		count += uint64(bits.OnesCount64(definedBitmap))
	}
	return
}

// create a bitmap out of the definition Levels
func defLevelsToBitmapInternal(defLevels []int16, info LevelInfo, out *ValidityBitmapInputOutput, hasRepeatedParent bool) {
	wr := utils.NewFirstTimeBitmapWriter(out.ValidBits, out.ValidBitsOffset, int64(out.ReadUpperBound))
	defer wr.Finish()
	setCount := defLevelsBatchToBitmap(defLevels, out.ReadUpperBound, info, wr, hasRepeatedParent)
	out.Read = int64(wr.Pos())
	out.NullCount += out.Read - int64(setCount)
}

// DefLevelsToBitmap creates a validitybitmap out of the passed in definition levels and info object.
func DefLevelsToBitmap(defLevels []int16, info LevelInfo, out *ValidityBitmapInputOutput) {
	hasRepeatedParent := info.RepLevel > 0

	defLevelsToBitmapInternal(defLevels, info, out, hasRepeatedParent)
}

// DefRepLevelsToListInfo takes in the definition and repetition levels in order to populate the validity bitmap
// and properly handle nested lists and update the offsets for them.
func DefRepLevelsToListInfo(defLevels, repLevels []int16, info LevelInfo, out *ValidityBitmapInputOutput, offsets []int32) error {
	var wr utils.BitmapWriter
	if out.ValidBits != nil {
		wr = utils.NewFirstTimeBitmapWriter(out.ValidBits, out.ValidBitsOffset, out.ReadUpperBound)
		defer wr.Finish()
	}
	offsetPos := 0
	for idx := range defLevels {
		// skip items that belong to empty or null ancestor lists and further nested lists
		if defLevels[idx] < info.RepeatedAncestorDefLevel || repLevels[idx] > info.RepLevel {
			continue
		}

		if repLevels[idx] == info.RepLevel {
			// continuation of an existing list.
			// offsets can be null for structs with repeated children
			if offsetPos < len(offsets) {
				if offsets[offsetPos] == math.MaxInt32 {
					return xerrors.New("list index overflow")
				}
				offsets[offsetPos]++
			}
		} else {
			if (wr != nil && int64(wr.Pos()) >= out.ReadUpperBound) || (offsetPos >= int(out.ReadUpperBound)) {
				return fmt.Errorf("definition levels exceeded upper bound: %d", out.ReadUpperBound)
			}

			// current_rep < list rep_level i.e. start of a list (ancestor empty lists
			// are filtered out above)
			// offsets can be null for structs with repeated children
			if offsetPos+1 < len(offsets) {
				offsetPos++
				// use cumulative offsets because variable size lists are more common
				// than fixed size lists so it should be cheaper to make these
				// cumulative and subtract when validating fixed size lists
				offsets[offsetPos] = offsets[offsetPos-1]
				if defLevels[idx] >= info.DefLevel {
					if offsets[offsetPos] == math.MaxInt32 {
						return xerrors.New("list index overflow")
					}
					offsets[offsetPos]++
				}
			}

			if wr != nil {
				// the level info def level for lists reflects element present level
				// the prior level distinguishes between empty lists
				if defLevels[idx] >= info.DefLevel-1 {
					wr.Set()
				} else {
					out.NullCount++
					wr.Clear()
				}
				wr.Next()
			}
		}
	}

	if len(offsets) > 0 {
		out.Read = int64(offsetPos)
	} else if wr != nil {
		out.Read = int64(wr.Pos())
	}

	if out.NullCount > 0 && info.NullSlotUsage > 1 {
		return xerrors.New("null values with null_slot_usage > 1 not supported.")
	}
	return nil
}

// DefRepLevelsToBitmap constructs a full validitybitmap out of the definition and repetition levels
// properly handling nested lists and parents.
func DefRepLevelsToBitmap(defLevels, repLevels []int16, info LevelInfo, out *ValidityBitmapInputOutput) error {
	info.RepLevel++
	info.DefLevel++
	return DefRepLevelsToListInfo(defLevels, repLevels, info, out, nil)
}
