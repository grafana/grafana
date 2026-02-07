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

package metadata

import (
	"fmt"
	"io"
	"math"
	"sync"

	"github.com/apache/arrow-go/v18/arrow"
	shared_utils "github.com/apache/arrow-go/v18/internal/utils"
	"github.com/apache/arrow-go/v18/parquet"
	"github.com/apache/arrow-go/v18/parquet/internal/debug"
	"github.com/apache/arrow-go/v18/parquet/internal/encoding"
	"github.com/apache/arrow-go/v18/parquet/internal/encryption"
	format "github.com/apache/arrow-go/v18/parquet/internal/gen-go/parquet"
	"github.com/apache/arrow-go/v18/parquet/internal/thrift"
	"github.com/apache/arrow-go/v18/parquet/internal/utils"
	"github.com/apache/arrow-go/v18/parquet/schema"
)

// BoundaryOrder identifies whether the min and max values are ordered and
// if so, which direction it is stored in.
type BoundaryOrder = format.BoundaryOrder

const (
	Unordered  BoundaryOrder = format.BoundaryOrder_UNORDERED
	Ascending  BoundaryOrder = format.BoundaryOrder_ASCENDING
	Descending BoundaryOrder = format.BoundaryOrder_DESCENDING
)

// ColumnIndex is an interface for reading optional statistics for
// each data page of a column chunk. Along with the OffsetIndex this
// forms the PageIndex for a column chunk.
type ColumnIndex interface {
	// GetNullPages returns a list of bools to determine the validity of the
	// corresponding min/max values. If the value is true, then that page
	// contains only null values.
	GetNullPages() []bool
	// IsSetNullCounts returns true if the null counts are set.
	IsSetNullCounts() bool
	// GetNullCounts returns the number of null values in each page. This is
	// only valid if IsSetNullCounts returns true.
	GetNullCounts() []int64
	// GetBoundaryOrder returns if the min/max values are ordered and if so,
	// what direction.
	GetBoundaryOrder() BoundaryOrder
	// GetMinValues returns the encoded minimum value for each page
	GetMinValues() [][]byte
	// GetMaxValues returns the encoded max value for each page
	GetMaxValues() [][]byte

	GetRepetitionLevelHistograms() []int64
	GetDefinitionLevelHistograms() []int64
}

// TypedColumnIndex expands the ColumnIndex interface to provide a
// type-safe accessor for the min/max values.
type TypedColumnIndex[T parquet.ColumnTypes] struct {
	ColumnIndex

	minvals            []T
	maxvals            []T
	nonNullPageIndices []int32
}

type typedDecoder[T parquet.ColumnTypes] interface {
	encoding.TypedDecoder
	Decode([]T) (int, error)
	DecodeSpaced([]T, int, []byte, int64) (int, error)
}

func must(err error) {
	if err != nil {
		panic(err)
	}
}

func mustArg[T any](val T, err error) T {
	must(err)
	return val
}

// NewColumnIndex uses the thrift serialized bytes to deserialize a column index, optionally decrypting it.
//
// The column descriptor is used to determine the physical type of the column to create a proper
// TypedColumnIndex.
func NewColumnIndex(descr *schema.Column, serializedIndex []byte, props *parquet.ReaderProperties, decryptor encryption.Decryptor) ColumnIndex {
	if decryptor != nil {
		serializedIndex = decryptor.Decrypt(serializedIndex)
	}

	var colidx format.ColumnIndex
	if _, err := thrift.DeserializeThrift(&colidx, serializedIndex); err != nil {
		panic(err)
	}

	switch descr.PhysicalType() {
	case parquet.Types.Boolean:
		return newTypedColumnIndex[bool](descr, &colidx)
	case parquet.Types.Int32:
		return newTypedColumnIndex[int32](descr, &colidx)
	case parquet.Types.Int64:
		return newTypedColumnIndex[int64](descr, &colidx)
	case parquet.Types.Int96:
		return newTypedColumnIndex[parquet.Int96](descr, &colidx)
	case parquet.Types.Float:
		return newTypedColumnIndex[float32](descr, &colidx)
	case parquet.Types.Double:
		return newTypedColumnIndex[float64](descr, &colidx)
	case parquet.Types.ByteArray:
		return newTypedColumnIndex[parquet.ByteArray](descr, &colidx)
	case parquet.Types.FixedLenByteArray:
		return newTypedColumnIndex[parquet.FixedLenByteArray](descr, &colidx)
	}

	panic("unreachable: cannot make columnindex of unknown type")
}

func getDecoder[T parquet.ColumnTypes](descr *schema.Column) func([]byte) T {
	switch descr.PhysicalType() {
	case parquet.Types.ByteArray:
		var f any = func(data []byte) parquet.ByteArray {
			return parquet.ByteArray(data)
		}
		return f.(func([]byte) T)
	case parquet.Types.FixedLenByteArray:
		var f any = func(data []byte) parquet.FixedLenByteArray {
			return parquet.FixedLenByteArray(data)
		}
		return f.(func([]byte) T)
	default:
		decoder := encoding.NewDecoder(descr.PhysicalType(), parquet.Encodings.Plain, descr, nil).(typedDecoder[T])
		var buf [1]T
		return func(data []byte) T {
			must(decoder.SetData(1, data))
			mustArg(decoder.Decode(buf[:]))
			return buf[0]
		}
	}
}

func newTypedColumnIndex[T parquet.ColumnTypes](descr *schema.Column, colIdx *format.ColumnIndex) *TypedColumnIndex[T] {
	numPages := len(colIdx.NullPages)
	if numPages >= math.MaxInt32 ||
		len(colIdx.MinValues) != numPages ||
		len(colIdx.MaxValues) != numPages ||
		(colIdx.IsSetNullCounts() && len(colIdx.NullCounts) != numPages) {
		panic("invalid column index")
	}

	numNonNullPages := 0
	for _, page := range colIdx.NullPages {
		if !page {
			numNonNullPages++
		}
	}
	debug.Assert(numNonNullPages <= numPages, "invalid column index")

	minvals, maxvals := make([]T, numPages), make([]T, numPages)
	nonNullPageIndices := make([]int32, 0, numNonNullPages)

	dec := getDecoder[T](descr)
	for i := 0; i < numPages; i++ {
		if !colIdx.NullPages[i] {
			nonNullPageIndices = append(nonNullPageIndices, int32(i))
			minvals[i] = dec(colIdx.MinValues[i])
			maxvals[i] = dec(colIdx.MaxValues[i])
		}
	}
	debug.Assert(len(nonNullPageIndices) == numNonNullPages, "invalid column index")

	return &TypedColumnIndex[T]{
		ColumnIndex:        colIdx,
		minvals:            minvals,
		maxvals:            maxvals,
		nonNullPageIndices: nonNullPageIndices,
	}
}

func (idx *TypedColumnIndex[T]) MinValues() []T {
	return idx.minvals
}

func (idx *TypedColumnIndex[T]) MaxValues() []T {
	return idx.maxvals
}

func (idx *TypedColumnIndex[T]) NonNullPageIndices() []int32 {
	return idx.nonNullPageIndices
}

type (
	// PageLocation describes where in a file a particular page can be found,
	// along with the index within the rowgroup of the first row in the page
	PageLocation       = format.PageLocation
	PageIndexSelection struct {
		// specifies whether to read the column index
		ColumnIndex bool
		// specifies whether to read the offset index
		OffsetIndex bool
	}
)

// OffsetIndex forms the page index alongside a ColumnIndex,
// the OffsetIndex may be present even if a ColumnIndex is not.
type OffsetIndex interface {
	GetPageLocations() []*PageLocation
	GetUnencodedByteArrayDataBytes() []int64
}

func (p PageIndexSelection) String() string {
	return fmt.Sprintf("PageIndexSelection{column_index = %t, offset_index = %t}",
		p.ColumnIndex, p.OffsetIndex)
}

// NewOffsetIndex constructs an OffsetIndex object from the thrift serialized bytes,
// optionally decrypting it if it was encrypted.
func NewOffsetIndex(serializedIndex []byte, _ *parquet.ReaderProperties, decryptor encryption.Decryptor) OffsetIndex {
	if decryptor != nil {
		serializedIndex = decryptor.Decrypt(serializedIndex)
	}

	var offsetIndex format.OffsetIndex
	if _, err := thrift.DeserializeThrift(&offsetIndex, serializedIndex); err != nil {
		panic(err)
	}

	return &offsetIndex
}

type readRange struct {
	Offset, Length int64
}

func (r readRange) Contains(other readRange) bool {
	return r.Offset <= other.Offset && other.Offset+other.Length <= r.Offset+r.Length
}

func checkReadRange(loc IndexLocation, idxRange *readRange, rgOrdinal int32) error {
	if idxRange == nil {
		return fmt.Errorf("%w: missing page index read range of row group %d, it may not exist or has not been requested",
			arrow.ErrInvalid, rgOrdinal)
	}

	// coalesced read range is invalid
	if idxRange.Offset < 0 || idxRange.Length <= 0 {
		return fmt.Errorf("%w: invalid page index read range: offset %d, length %d",
			arrow.ErrInvalid, idxRange.Offset, idxRange.Length)
	}

	if loc.Offset < 0 || loc.Length <= 0 {
		return fmt.Errorf("%w: invalid page index location: offset %d, length %d",
			arrow.ErrInvalid, loc.Offset, loc.Length)
	}

	if loc.Offset < idxRange.Offset || loc.Offset+int64(loc.Length) > idxRange.Offset+idxRange.Length {
		return fmt.Errorf("%w: Page index location [offset:%d,length:%d] is out of range from previous WillNeed request [offset:%d,length:%d], row group: %d",
			arrow.ErrInvalid, loc.Offset, loc.Length, idxRange.Offset, idxRange.Length, rgOrdinal)
	}

	return nil
}

type rgIndexReadRange struct {
	ColIndex, OffsetIndex *readRange
}

// RowGroupPageIndexReader is a read-only object for retrieving column and offset
// indexes for a given row group.
type RowGroupPageIndexReader struct {
	input            parquet.ReaderAtSeeker
	rowGroupMetadata *RowGroupMetaData
	props            *parquet.ReaderProperties
	rgOrdinal        int32
	idxReadRange     rgIndexReadRange
	fileDecryptor    encryption.FileDecryptor

	// buffers to hold raw bytes of page index
	// will be lazily set when the corresponding page index is accessed
	colIndexBuffer, offsetIndexBuffer []byte

	// cache of column indexes
	colIndexes map[int]ColumnIndex
	// cache of offset indices
	offsetIndices map[int]OffsetIndex
	mx            sync.Mutex
}

func (r *RowGroupPageIndexReader) GetColumnIndex(i int) (ColumnIndex, error) {
	if i < 0 || i >= r.rowGroupMetadata.NumColumns() {
		return nil, fmt.Errorf("%w: invalid column index at column ordinal %d",
			arrow.ErrInvalid, i)
	}

	r.mx.Lock()
	defer r.mx.Unlock()

	if r.colIndexes == nil {
		r.colIndexes = make(map[int]ColumnIndex)
	} else {
		if idx, ok := r.colIndexes[i]; ok {
			return idx, nil
		}
	}

	colChunk, err := r.rowGroupMetadata.ColumnChunk(i)
	if err != nil {
		return nil, err
	}

	colIndexLocation := colChunk.GetColumnIndexLocation()
	if colIndexLocation == nil {
		return nil, nil
	}

	if err := checkReadRange(*colIndexLocation, r.idxReadRange.ColIndex, r.rgOrdinal); err != nil {
		return nil, err
	}

	if r.colIndexBuffer == nil {
		r.colIndexBuffer = make([]byte, r.idxReadRange.ColIndex.Length)
		if _, err := r.input.ReadAt(r.colIndexBuffer, r.idxReadRange.ColIndex.Offset); err != nil {
			return nil, err
		}
	}

	bufferOffset := colIndexLocation.Offset - r.idxReadRange.ColIndex.Offset
	descr := r.rowGroupMetadata.Schema.Column(i)
	decryptor, err := encryption.GetColumnMetaDecryptor(colChunk.CryptoMetadata(), r.fileDecryptor)
	if err != nil {
		return nil, err
	}

	if decryptor != nil {
		encryption.UpdateDecryptor(decryptor, int16(r.rgOrdinal),
			int16(i), encryption.ColumnIndexModule)
	}

	idx := NewColumnIndex(descr, r.colIndexBuffer[bufferOffset:], r.props, decryptor)
	r.colIndexes[i] = idx
	return idx, nil
}

func (r *RowGroupPageIndexReader) GetOffsetIndex(i int) (OffsetIndex, error) {
	if i < 0 || i >= r.rowGroupMetadata.NumColumns() {
		return nil, fmt.Errorf("%w: invalid column index at column ordinal %d",
			arrow.ErrInvalid, i)
	}

	r.mx.Lock()
	defer r.mx.Unlock()

	if r.offsetIndices == nil {
		r.offsetIndices = make(map[int]OffsetIndex)
	} else {
		if idx, ok := r.offsetIndices[i]; ok {
			return idx, nil
		}
	}

	colChunk, err := r.rowGroupMetadata.ColumnChunk(i)
	if err != nil {
		return nil, err
	}

	offsetIndexLocation := colChunk.GetOffsetIndexLocation()
	if offsetIndexLocation == nil {
		return nil, nil
	}

	if err := checkReadRange(*offsetIndexLocation, r.idxReadRange.OffsetIndex, r.rgOrdinal); err != nil {
		return nil, err
	}

	if r.offsetIndexBuffer == nil {
		r.offsetIndexBuffer = make([]byte, r.idxReadRange.OffsetIndex.Length)
		if _, err := r.input.ReadAt(r.offsetIndexBuffer, r.idxReadRange.OffsetIndex.Offset); err != nil {
			return nil, err
		}
	}

	bufferOffset := offsetIndexLocation.Offset - r.idxReadRange.OffsetIndex.Offset
	decryptor, err := encryption.GetColumnMetaDecryptor(colChunk.CryptoMetadata(), r.fileDecryptor)
	if err != nil {
		return nil, err
	}

	if decryptor != nil {
		encryption.UpdateDecryptor(decryptor, int16(r.rgOrdinal),
			int16(i), encryption.OffsetIndexModule)
	}

	oidx := NewOffsetIndex(r.offsetIndexBuffer[bufferOffset:], r.props, decryptor)
	r.offsetIndices[i] = oidx
	return oidx, nil
}

// PageIndexReader is a read-only object for retrieving the Column and Offset indexes
// for a particular parquet file.
type PageIndexReader struct {
	Input        parquet.ReaderAtSeeker
	FileMetadata *FileMetaData
	Props        *parquet.ReaderProperties
	Decryptor    encryption.FileDecryptor

	// coalesced read ranges of page index of row groups that have
	// been suggested by WillNeed(). key is the row group ordinal
	idxReadRanges map[int32]rgIndexReadRange
}

func determinePageIndexRangesInRowGroup(rgMeta *RowGroupMetaData, cols []int32) (rng rgIndexReadRange, err error) {
	ciStart, oiStart := int64(math.MaxInt64), int64(math.MaxInt64)
	ciEnd, oiEnd := int64(-1), int64(-1)

	mergeRange := func(idxLocation *IndexLocation, start, end *int64) error {
		if idxLocation == nil {
			return nil
		}

		indexEnd, ok := shared_utils.Add(idxLocation.Offset, int64(idxLocation.Length))
		if idxLocation.Offset < 0 || idxLocation.Length <= 0 || !ok {
			return fmt.Errorf("%w: invalid page index location: offset %d length %d",
				arrow.ErrIndex, idxLocation.Offset, idxLocation.Length)
		}
		*start = min(*start, idxLocation.Offset)
		*end = max(*end, indexEnd)
		return nil
	}

	var colChunk *ColumnChunkMetaData
	if len(cols) == 0 {
		cols = make([]int32, rgMeta.NumColumns())
		for i := 0; i < rgMeta.NumColumns(); i++ {
			cols[i] = int32(i)
		}
	}

	for _, i := range cols {
		if i < 0 || i >= int32(rgMeta.NumColumns()) {
			return rng, fmt.Errorf("%w: invalid column ordinal %d", arrow.ErrIndex, i)
		}

		if colChunk, _ = rgMeta.ColumnChunk(int(i)); colChunk == nil {
			continue
		}

		if err = mergeRange(colChunk.GetColumnIndexLocation(), &ciStart, &ciEnd); err != nil {
			return
		}

		if err = mergeRange(colChunk.GetOffsetIndexLocation(), &oiStart, &oiEnd); err != nil {
			return
		}
	}

	if ciEnd != -1 {
		rng.ColIndex = &readRange{Offset: ciStart, Length: ciEnd - ciStart}
	}

	if oiEnd != -1 {
		rng.OffsetIndex = &readRange{Offset: oiStart, Length: oiEnd - oiStart}
	}
	return
}

func (r *PageIndexReader) RowGroup(i int) (*RowGroupPageIndexReader, error) {
	if i < 0 || i >= r.FileMetadata.NumRowGroups() {
		return nil, fmt.Errorf("%w: invalid row group ordinal %d", arrow.ErrInvalid, i)
	}

	var err error
	rgmeta := r.FileMetadata.RowGroup(i)
	idxReadRange, ok := r.idxReadRanges[int32(i)]
	if !ok {
		// row group has not been requested by WillNeed(), by default both
		// column index and offset index of all column chunks for the row group
		// can be read.
		if idxReadRange, err = determinePageIndexRangesInRowGroup(rgmeta, nil); err != nil {
			return nil, err
		}
	}

	if idxReadRange.ColIndex != nil || idxReadRange.OffsetIndex != nil {
		return &RowGroupPageIndexReader{
			input:            r.Input,
			rowGroupMetadata: rgmeta,
			props:            r.Props,
			rgOrdinal:        int32(i),
			idxReadRange:     idxReadRange,
			fileDecryptor:    r.Decryptor,
		}, nil
	}

	// the row group does not have a page index or has not been requested by willneed
	// simply return a nil pointer
	return nil, nil
}

func (r *PageIndexReader) WillNeed(rgIndices, colIndices []int32, selection PageIndexSelection) error {
	if r.idxReadRanges == nil {
		r.idxReadRanges = make(map[int32]rgIndexReadRange)
	}

	for _, ordinal := range rgIndices {
		readRange, err := determinePageIndexRangesInRowGroup(r.FileMetadata.RowGroup(int(ordinal)), colIndices)
		if err != nil {
			return err
		}

		if !selection.ColumnIndex || readRange.ColIndex == nil {
			// mark column index as not requested
			readRange.ColIndex = nil
		}

		if !selection.OffsetIndex || readRange.OffsetIndex == nil {
			// mark offset index as not requested
			readRange.OffsetIndex = nil
		}
		r.idxReadRanges[int32(ordinal)] = readRange
	}
	// TODO: possibly use read ranges to prefetch data of the input
	return nil
}

func (r *PageIndexReader) WillNotNeed(rgIndices []int32) {
	if r.idxReadRanges == nil {
		return
	}

	for _, i := range rgIndices {
		delete(r.idxReadRanges, i)
	}
}

type builderState int8

const (
	stateCreated builderState = iota
	stateStarted
	stateFinished
	stateDiscarded
)

// ColumnIndexBuilder is an interface for constructing column indexes,
// with the concrete implementations being fully typed.
type ColumnIndexBuilder interface {
	AddPage(stats *EncodedStatistics) error
	Finish() error
	WriteTo(w io.Writer, encryptor encryption.Encryptor) (int, error)
	Build() ColumnIndex
}

type columnIndexBuilder[T parquet.ColumnTypes] struct {
	descr              *schema.Column
	colIndex           format.ColumnIndex
	nonNullPageIndices []int64
	state              builderState
}

// NewColumnIndexBuilder creates a new typed ColumnIndexBuilder for the given column descriptor.
func NewColumnIndexBuilder(descr *schema.Column) ColumnIndexBuilder {
	switch descr.PhysicalType() {
	case parquet.Types.Boolean:
		return newColumnIndexBuilder[bool](descr)
	case parquet.Types.Int32:
		return newColumnIndexBuilder[int32](descr)
	case parquet.Types.Int64:
		return newColumnIndexBuilder[int64](descr)
	case parquet.Types.Int96:
		return newColumnIndexBuilder[parquet.Int96](descr)
	case parquet.Types.Float:
		return newColumnIndexBuilder[float32](descr)
	case parquet.Types.Double:
		return newColumnIndexBuilder[float64](descr)
	case parquet.Types.ByteArray:
		return newColumnIndexBuilder[parquet.ByteArray](descr)
	case parquet.Types.FixedLenByteArray:
		return newColumnIndexBuilder[parquet.FixedLenByteArray](descr)
	case parquet.Types.Undefined:
		return nil
	}
	panic("unreachable: cannot make column index builder of unknown type")
}

func newColumnIndexBuilder[T parquet.ColumnTypes](descr *schema.Column) *columnIndexBuilder[T] {
	return &columnIndexBuilder[T]{
		descr: descr,
		colIndex: format.ColumnIndex{
			NullCounts:    make([]int64, 0),
			BoundaryOrder: Unordered,
		},
		nonNullPageIndices: make([]int64, 0),
		state:              stateCreated,
	}
}

func (b *columnIndexBuilder[T]) AddPage(stats *EncodedStatistics) error {
	switch b.state {
	case stateFinished:
		return fmt.Errorf("%w: cannot add page to finished ColumnIndexBuilder", arrow.ErrInvalid)
	case stateDiscarded:
		return nil
	}

	b.state = stateStarted

	switch {
	case stats.AllNullValue:
		b.colIndex.NullPages = append(b.colIndex.NullPages, true)
		// thrift deserializes nil byte slice or empty byte slice both as
		// an empty byte slice. So we should append an empty byte slice
		// instead of nil so that round trip comparisons are consistent.
		b.colIndex.MinValues = append(b.colIndex.MinValues, []byte{})
		b.colIndex.MaxValues = append(b.colIndex.MaxValues, []byte{})
	case stats.HasMin && stats.HasMax:
		pageOrdinal := len(b.colIndex.NullPages)
		b.nonNullPageIndices = append(b.nonNullPageIndices, int64(pageOrdinal))
		b.colIndex.MinValues = append(b.colIndex.MinValues, stats.Min)
		b.colIndex.MaxValues = append(b.colIndex.MaxValues, stats.Max)
		b.colIndex.NullPages = append(b.colIndex.NullPages, false)
	default:
		// this is a non-null page but it lacks meaningful min/max values
		// discard the column index
		b.state = stateDiscarded
		return nil
	}

	if b.colIndex.IsSetNullCounts() && stats.HasNullCount {
		b.colIndex.NullCounts = append(b.colIndex.NullCounts, stats.NullCount)
	} else {
		b.colIndex.NullCounts = nil
	}

	return nil
}

func (b *columnIndexBuilder[T]) Finish() error {
	switch b.state {
	case stateCreated:
		// no page added, discard the column index
		b.state = stateDiscarded
		return nil
	case stateFinished:
		return fmt.Errorf("%w: ColumnIndexBuilder is already finished", arrow.ErrInvalid)
	case stateDiscarded:
		// column index is discarded, do nothing
		return nil
	case stateStarted:
	}

	b.state = stateFinished
	// clear null counts vector because at least one page does not provide it
	if !b.colIndex.IsSetNullCounts() {
		b.colIndex.NullCounts = nil
	}

	// decode min/max values according to data type
	nonNullPageCnt := len(b.nonNullPageIndices)
	minVals, maxVals := make([]T, nonNullPageCnt), make([]T, nonNullPageCnt)
	dec := getDecoder[T](b.descr)
	for i, pageOrdinal := range b.nonNullPageIndices {
		minVals[i] = dec(b.colIndex.MinValues[pageOrdinal])
		maxVals[i] = dec(b.colIndex.MaxValues[pageOrdinal])
	}

	// decode the boundary order from decoded min/max vals
	b.colIndex.BoundaryOrder = b.determineBoundaryOrder(minVals, maxVals)
	return nil
}

func (b *columnIndexBuilder[T]) Build() ColumnIndex {
	if b.state != stateFinished {
		return nil
	}
	return newTypedColumnIndex[T](b.descr, &b.colIndex)
}

func (b *columnIndexBuilder[T]) WriteTo(w io.Writer, encryptor encryption.Encryptor) (int, error) {
	if b.state == stateFinished {
		return thrift.NewThriftSerializer().Serialize(&b.colIndex, w, encryptor)
	}
	return 0, nil
}

func (b *columnIndexBuilder[T]) determineBoundaryOrder(minVals, maxVals []T) BoundaryOrder {
	debug.Assert(len(minVals) == len(maxVals), "min/max values length mismatch")
	if len(minVals) == 0 {
		return Unordered
	}

	comp, err := NewTypedComparator[T](b.descr)
	if err != nil {
		return Unordered
	}

	// check if both minVals and maxVals are in ascending order
	isAsc := true
	for i := 1; i < len(minVals); i++ {
		if comp.Compare(minVals[i], minVals[i-1]) ||
			comp.Compare(maxVals[i], maxVals[i-1]) {
			isAsc = false
			break
		}
	}

	if isAsc {
		return Ascending
	}

	// check if both minVals and maxVals are in descending order
	isDesc := true
	for i := 1; i < len(minVals); i++ {
		if comp.Compare(minVals[i-1], minVals[i]) ||
			comp.Compare(maxVals[i-1], maxVals[i]) {
			isDesc = false
			break
		}
	}
	if isDesc {
		return Descending
	}

	return Unordered
}

// OffsetIndexBuilder provides a way to construct new OffsetIndexes while writing
// a parquet file.
type OffsetIndexBuilder struct {
	offsetIndex format.OffsetIndex
	state       builderState
}

func (o *OffsetIndexBuilder) AddPageLoc(pgloc PageLocation) error {
	return o.AddPage(pgloc.Offset, pgloc.FirstRowIndex, pgloc.CompressedPageSize)
}

func (o *OffsetIndexBuilder) AddPage(offset, firstRowIdx int64, compressedPgSize int32) error {
	switch o.state {
	case stateFinished:
		return fmt.Errorf("%w: cannot add page to finished OffsetIndexBuilder", arrow.ErrInvalid)
	case stateDiscarded:
		// offset index is discarded, do nothing
		return nil
	}

	o.state = stateStarted
	o.offsetIndex.PageLocations = append(o.offsetIndex.PageLocations, &PageLocation{
		Offset:             offset,
		FirstRowIndex:      firstRowIdx,
		CompressedPageSize: compressedPgSize,
	})
	return nil
}

func (o *OffsetIndexBuilder) Finish(finalPos int64) error {
	switch o.state {
	case stateCreated:
		o.state = stateDiscarded
	case stateStarted:
		// adjust page offsets according to final position
		if finalPos > 0 {
			for _, loc := range o.offsetIndex.PageLocations {
				loc.Offset += finalPos
			}
		}
		o.state = stateFinished
	case stateFinished, stateDiscarded:
		return fmt.Errorf("%w: OffsetIndexBuilder is already finished", arrow.ErrInvalid)
	}
	return nil
}

func (o *OffsetIndexBuilder) WriteTo(w io.Writer, encryptor encryption.Encryptor) (int, error) {
	if o.state == stateFinished {
		return thrift.NewThriftSerializer().Serialize(&o.offsetIndex, w, encryptor)
	}
	return 0, nil
}

func (o *OffsetIndexBuilder) Build() OffsetIndex {
	if o.state != stateFinished {
		return nil
	}

	return &o.offsetIndex
}

// PageIndexBuilder manages the creation of the entire PageIndex for a parquet file,
// managing the builders for each row group as they are added and providing getters
// to retrieve the particular builders for specific columns and row groups.
type PageIndexBuilder struct {
	Schema    *schema.Schema
	Encryptor encryption.FileEncryptor

	colIndexBuilders    [][]ColumnIndexBuilder
	offsetIndexBuilders [][]*OffsetIndexBuilder
	finished            bool
}

func (b *PageIndexBuilder) AppendRowGroup() error {
	if b.finished {
		return fmt.Errorf("%w: cannot append row group to finished PageIndexBuilder", arrow.ErrInvalid)
	}

	if b.Schema == nil {
		return fmt.Errorf("%w: schema is not set in PageIndexBuilder", arrow.ErrInvalid)
	}

	numColumns := b.Schema.NumColumns()
	b.colIndexBuilders = append(b.colIndexBuilders, make([]ColumnIndexBuilder, numColumns))
	b.offsetIndexBuilders = append(b.offsetIndexBuilders, make([]*OffsetIndexBuilder, numColumns))

	debug.Assert(len(b.colIndexBuilders) == len(b.offsetIndexBuilders), "column and offset index builders mismatch")
	return nil
}

func (b *PageIndexBuilder) GetColumnIndexBuilder(i int) (ColumnIndexBuilder, error) {
	if err := b.checkState(i); err != nil {
		return nil, err
	}

	bldr := &b.colIndexBuilders[len(b.colIndexBuilders)-1][i]
	if *bldr == nil {
		*bldr = NewColumnIndexBuilder(b.Schema.Column(i))
	}
	return *bldr, nil
}

func (b *PageIndexBuilder) GetOffsetIndexBuilder(i int) (*OffsetIndexBuilder, error) {
	if err := b.checkState(i); err != nil {
		return nil, err
	}

	bldr := &b.offsetIndexBuilders[len(b.offsetIndexBuilders)-1][i]
	if *bldr == nil {
		*bldr = &OffsetIndexBuilder{}
	}
	return *bldr, nil
}

func (b *PageIndexBuilder) Finish() { b.finished = true }

func (b *PageIndexBuilder) WriteTo(w utils.WriterTell, location *PageIndexLocation) error {
	if !b.finished {
		return fmt.Errorf("%w: PageIndexBuilder is not finished", arrow.ErrInvalid)
	}

	location.ColIndexLocation = make(map[uint64][]*IndexLocation)
	location.OffsetIndexLocation = make(map[uint64][]*IndexLocation)

	// serialize column index
	if err := serializeIndex(b.Schema, b.colIndexBuilders, w, location.ColIndexLocation, encryption.ColumnIndexModule, b.getColumnMetaEncryptor); err != nil {
		return err
	}

	// serialize offset index
	if err := serializeIndex(b.Schema, b.offsetIndexBuilders, w, location.OffsetIndexLocation, encryption.OffsetIndexModule, b.getColumnMetaEncryptor); err != nil {
		return err
	}

	return nil
}

func (b *PageIndexBuilder) checkState(col int) error {
	if b.finished {
		return fmt.Errorf("%w: cannot add page to finished PageIndexBuilder", arrow.ErrInvalid)
	}

	if col < 0 || col >= b.Schema.NumColumns() {
		return fmt.Errorf("%w: invalid column ordinal %d", arrow.ErrInvalid, col)
	}

	if len(b.colIndexBuilders) == 0 || len(b.offsetIndexBuilders) == 0 {
		return fmt.Errorf("%w: No row group appended to PageIndexBuilder", arrow.ErrInvalid)
	}
	return nil
}

func (b *PageIndexBuilder) getColumnMetaEncryptor(rgOrdinal, colOrdinal int, moduleType int8) encryption.Encryptor {
	if b.Encryptor == nil {
		return nil
	}

	colPath := b.Schema.Column(colOrdinal).Path()
	encryptor := b.Encryptor.GetColumnMetaEncryptor(colPath)
	if encryptor != nil {
		encryptor.UpdateAad(encryption.CreateModuleAad(
			encryptor.FileAad(), moduleType, int16(rgOrdinal),
			int16(colOrdinal), encryption.NonPageOrdinal))
	}
	return encryptor
}

func serializeIndex[T interface {
	comparable
	WriteTo(io.Writer, encryption.Encryptor) (int, error)
}](s *schema.Schema, bldrs [][]T, w utils.WriterTell, location map[uint64][]*IndexLocation, moduleType int8, encFn func(int, int, int8) encryption.Encryptor) error {
	var (
		z       T
		numCols = s.NumColumns()
	)

	// serialize the same kind of page index, row group by row group
	for rg, idxBldrs := range bldrs {
		debug.Assert(len(idxBldrs) == numCols, "column index builders length mismatch")

		hasValidIndex := false
		locations := make([]*IndexLocation, numCols)

		// in the same row group, serialize the same kind of page index column by column
		for col, bldr := range idxBldrs {
			if bldr == z {
				continue
			}

			encryptor := encFn(rg, col, moduleType)
			posBefore := w.Tell()

			n, err := bldr.WriteTo(w, encryptor)
			if err != nil {
				return err
			}

			if n == 0 {
				continue
			}

			if n > math.MaxInt32 {
				return fmt.Errorf("%w: serialized page index size overflows INT32_MAX", arrow.ErrInvalid)
			}

			locations[col] = &IndexLocation{Offset: posBefore, Length: int32(n)}
			hasValidIndex = true
		}

		if hasValidIndex {
			location[uint64(rg)] = locations
		}
	}

	return nil
}
