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
	"sync"
	"sync/atomic"
	"unsafe"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/array"
	"github.com/apache/arrow-go/v18/arrow/bitutil"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/internal/utils"
	"github.com/apache/arrow-go/v18/parquet"
	"github.com/apache/arrow-go/v18/parquet/internal/encoding"
	"github.com/apache/arrow-go/v18/parquet/schema"
	"golang.org/x/xerrors"
)

// RecordReader is an interface for reading entire records/rows at a time
// from a parquet file for both flat and nested columns. Properly delimiting
// semantic records according to the def and repetition levels.
type RecordReader interface {
	// DefLevels returns the current crop of definition levels for this record
	DefLevels() []int16
	// LevelsPos is the number of definition / repetition levels (from the decoded ones)
	// which the reader has already consumed.
	LevelsPos() int64
	// RepLevels returns the current decoded repetition levels
	RepLevels() []int16
	// Reset resets the state, clearing consumed values and repetition/definition
	// levels as the result of calling ReadRecords
	Reset()
	// Reserve pre-allocates space for data
	Reserve(int64) error
	// HasMore returns true if there is more internal data which hasn't been
	// processed yet.
	HasMore() bool
	// ReadRecords attempts to read the provided number of records from the
	// column chunk, returning the number of records read and any error.
	ReadRecords(num int64) (int64, error)
	// ValuesWritten is the number of values written internally including any nulls
	ValuesWritten() int
	// ReleaseValidBits transfers the buffer of bits for the validity bitmap
	// to the caller, subsequent calls will allocate a new one in the reader.
	ReleaseValidBits() *memory.Buffer
	// ReleaseValues transfers the buffer of data with the values to the caller,
	// a new buffer will be allocated on subsequent calls.
	ReleaseValues() *memory.Buffer
	ResetValues()
	// NullCount returns the number of nulls decoded
	NullCount() int64
	// Type returns the parquet physical type of the column
	Type() parquet.Type
	// Values returns the decoded data buffer, including any nulls, without
	// transferring ownership
	Values() []byte
	// SetPageReader allows progressing to the next column chunk while reusing
	// this record reader by providing the page reader for the next chunk.
	SetPageReader(PageReader)
	// Retain increments the ref count by one
	Retain()
	// Release decrements the ref count by one, releasing the internal buffers when
	// the ref count is 0.
	Release()
	// SeekToRow will shift the record reader so that subsequent reads will
	// start at the desired row. It will utilize Offset Indexes if they exist
	// to skip pages and seek.
	SeekToRow(int64) error
}

// BinaryRecordReader provides an extra GetBuilderChunks function above and beyond
// the plain RecordReader to allow for efficiently building chunked arrays.
type BinaryRecordReader interface {
	RecordReader
	GetBuilderChunks() []arrow.Array
	ReadDictionary() bool
}

// recordReaderImpl is the internal interface implemented for different types
// enabling reuse of the higher level record reader logic.
type recordReaderImpl interface {
	ColumnChunkReader
	ReadValuesDense(int64) error
	ReadValuesSpaced(int64, int64) error
	ReserveValues(int64, bool) error
	ResetValues()
	GetValidBits() []byte
	IncrementWritten(int64, int64)
	ValuesWritten() int64
	ReleaseValidBits() *memory.Buffer
	ReleaseValues() *memory.Buffer
	NullCount() int64
	Values() []byte
	SetPageReader(PageReader)
	Retain()
	Release()
}

type binaryRecordReaderImpl interface {
	recordReaderImpl
	GetBuilderChunks() []arrow.Array
	ReadDictionary() bool
}

// primitiveRecordReader is a record reader for primitive types, ie: not byte array or fixed len byte array
type primitiveRecordReader struct {
	ColumnChunkReader

	valuesWritten int64
	valuesCap     int64
	nullCount     int64
	values        *memory.Buffer
	validBits     *memory.Buffer
	mem           memory.Allocator

	refCount  atomic.Int64
	useValues bool
}

func createPrimitiveRecordReader(descr *schema.Column, mem memory.Allocator, bufferPool *sync.Pool) *primitiveRecordReader {
	prr := &primitiveRecordReader{
		ColumnChunkReader: newTypedColumnChunkReader(columnChunkReader{
			descr:      descr,
			mem:        mem,
			bufferPool: bufferPool,
		}),
		values:    memory.NewResizableBuffer(mem),
		validBits: memory.NewResizableBuffer(mem),
		mem:       mem,
		useValues: descr.PhysicalType() != parquet.Types.ByteArray && descr.PhysicalType() != parquet.Types.FixedLenByteArray,
	}

	prr.refCount.Add(1)
	return prr
}

func (pr *primitiveRecordReader) Retain() {
	pr.refCount.Add(1)
}

func (pr *primitiveRecordReader) Release() {
	if pr.refCount.Add(-1) == 0 {
		if pr.values != nil {
			pr.values.Release()
			pr.values = nil
		}
		if pr.validBits != nil {
			pr.validBits.Release()
			pr.validBits = nil
		}
	}
}

func (pr *primitiveRecordReader) SetPageReader(rdr PageReader) {
	pr.setPageReader(rdr)
}

func (pr *primitiveRecordReader) ReleaseValidBits() *memory.Buffer {
	res := pr.validBits
	res.Resize(int(bitutil.BytesForBits(pr.valuesWritten)))
	pr.validBits = memory.NewResizableBuffer(pr.mem)
	return res
}

func (pr *primitiveRecordReader) ReleaseValues() (res *memory.Buffer) {
	res = pr.values
	nbytes, err := pr.numBytesForValues(pr.valuesWritten)
	if err != nil {
		panic(err)
	}
	res.Resize(int(nbytes))
	pr.values = memory.NewResizableBuffer(pr.mem)
	pr.valuesCap = 0

	return
}

func (pr *primitiveRecordReader) NullCount() int64 { return pr.nullCount }

func (pr *primitiveRecordReader) IncrementWritten(w, n int64) {
	pr.valuesWritten += w
	pr.nullCount += n
}
func (pr *primitiveRecordReader) GetValidBits() []byte { return pr.validBits.Bytes() }
func (pr *primitiveRecordReader) ValuesWritten() int64 { return pr.valuesWritten }
func (pr *primitiveRecordReader) Values() []byte       { return pr.values.Bytes() }
func (pr *primitiveRecordReader) ResetValues() {
	if pr.valuesWritten > 0 {
		pr.values.ResizeNoShrink(0)
		pr.validBits.ResizeNoShrink(0)
		pr.valuesWritten = 0
		pr.valuesCap = 0
		pr.nullCount = 0
	}
}

func (pr *primitiveRecordReader) numBytesForValues(nitems int64) (num int64, err error) {
	typeSize := int64(pr.Descriptor().PhysicalType().ByteSize())
	var ok bool
	if num, ok = utils.Mul64(nitems, typeSize); !ok {
		err = xerrors.New("total size of items too large")
	}
	return
}

func (pr *primitiveRecordReader) ReserveValues(extra int64, hasNullable bool) error {
	newCap, err := updateCapacity(pr.valuesCap, pr.valuesWritten, extra)
	if err != nil {
		return err
	}
	if newCap > pr.valuesCap {
		capBytes, err := pr.numBytesForValues(newCap)
		if err != nil {
			return err
		}
		if pr.useValues {
			pr.values.ResizeNoShrink(int(capBytes))
		}
		pr.valuesCap = newCap
	}
	if hasNullable {
		validBytesCap := bitutil.BytesForBits(pr.valuesCap)
		if pr.validBits.Len() < int(validBytesCap) {
			pr.validBits.ResizeNoShrink(int(validBytesCap))
		}
	}
	return nil
}

func (pr *primitiveRecordReader) ReadValuesDense(toRead int64) (err error) {
	switch cr := pr.ColumnChunkReader.(type) {
	case *BooleanColumnChunkReader:
		data := pr.values.Bytes()[int(pr.valuesWritten):]
		values := *(*[]bool)(unsafe.Pointer(&data))
		_, err = cr.curDecoder.(encoding.BooleanDecoder).Decode(values[:toRead])
	case *Int32ColumnChunkReader:
		values := arrow.Int32Traits.CastFromBytes(pr.values.Bytes())[int(pr.valuesWritten):]
		_, err = cr.curDecoder.(encoding.Int32Decoder).Decode(values[:toRead])
	case *Int64ColumnChunkReader:
		values := arrow.Int64Traits.CastFromBytes(pr.values.Bytes())[int(pr.valuesWritten):]
		_, err = cr.curDecoder.(encoding.Int64Decoder).Decode(values[:toRead])
	case *Int96ColumnChunkReader:
		values := parquet.Int96Traits.CastFromBytes(pr.values.Bytes())[int(pr.valuesWritten):]
		_, err = cr.curDecoder.(encoding.Int96Decoder).Decode(values[:toRead])
	case *ByteArrayColumnChunkReader:
		values := parquet.ByteArrayTraits.CastFromBytes(pr.values.Bytes())[int(pr.valuesWritten):]
		_, err = cr.curDecoder.(encoding.ByteArrayDecoder).Decode(values[:toRead])
	case *FixedLenByteArrayColumnChunkReader:
		values := parquet.FixedLenByteArrayTraits.CastFromBytes(pr.values.Bytes())[int(pr.valuesWritten):]
		_, err = cr.curDecoder.(encoding.FixedLenByteArrayDecoder).Decode(values[:toRead])
	case *Float32ColumnChunkReader:
		values := arrow.Float32Traits.CastFromBytes(pr.values.Bytes())[int(pr.valuesWritten):]
		_, err = cr.curDecoder.(encoding.Float32Decoder).Decode(values[:toRead])
	case *Float64ColumnChunkReader:
		values := arrow.Float64Traits.CastFromBytes(pr.values.Bytes())[int(pr.valuesWritten):]
		_, err = cr.curDecoder.(encoding.Float64Decoder).Decode(values[:toRead])
	default:
		panic("invalid type for record reader")
	}
	return
}

func (pr *primitiveRecordReader) ReadValuesSpaced(valuesWithNulls, nullCount int64) (err error) {
	validBits := pr.validBits.Bytes()
	offset := pr.valuesWritten

	switch cr := pr.ColumnChunkReader.(type) {
	case *BooleanColumnChunkReader:
		data := pr.values.Bytes()[int(pr.valuesWritten):]
		values := *(*[]bool)(unsafe.Pointer(&data))
		_, err = cr.curDecoder.(encoding.BooleanDecoder).DecodeSpaced(values[:int(valuesWithNulls)], int(nullCount), validBits, offset)
	case *Int32ColumnChunkReader:
		values := arrow.Int32Traits.CastFromBytes(pr.values.Bytes())[int(pr.valuesWritten):]
		_, err = cr.curDecoder.(encoding.Int32Decoder).DecodeSpaced(values[:int(valuesWithNulls)], int(nullCount), validBits, offset)
	case *Int64ColumnChunkReader:
		values := arrow.Int64Traits.CastFromBytes(pr.values.Bytes())[int(pr.valuesWritten):]
		_, err = cr.curDecoder.(encoding.Int64Decoder).DecodeSpaced(values[:int(valuesWithNulls)], int(nullCount), validBits, offset)
	case *Int96ColumnChunkReader:
		values := parquet.Int96Traits.CastFromBytes(pr.values.Bytes())[int(pr.valuesWritten):]
		_, err = cr.curDecoder.(encoding.Int96Decoder).DecodeSpaced(values[:int(valuesWithNulls)], int(nullCount), validBits, offset)
	case *ByteArrayColumnChunkReader:
		values := parquet.ByteArrayTraits.CastFromBytes(pr.values.Bytes())[int(pr.valuesWritten):]
		_, err = cr.curDecoder.(encoding.ByteArrayDecoder).DecodeSpaced(values[:int(valuesWithNulls)], int(nullCount), validBits, offset)
	case *FixedLenByteArrayColumnChunkReader:
		values := parquet.FixedLenByteArrayTraits.CastFromBytes(pr.values.Bytes())[int(pr.valuesWritten):]
		_, err = cr.curDecoder.(encoding.FixedLenByteArrayDecoder).DecodeSpaced(values[:int(valuesWithNulls)], int(nullCount), validBits, offset)
	case *Float32ColumnChunkReader:
		values := arrow.Float32Traits.CastFromBytes(pr.values.Bytes())[int(pr.valuesWritten):]
		_, err = cr.curDecoder.(encoding.Float32Decoder).DecodeSpaced(values[:int(valuesWithNulls)], int(nullCount), validBits, offset)
	case *Float64ColumnChunkReader:
		values := arrow.Float64Traits.CastFromBytes(pr.values.Bytes())[int(pr.valuesWritten):]
		_, err = cr.curDecoder.(encoding.Float64Decoder).DecodeSpaced(values[:int(valuesWithNulls)], int(nullCount), validBits, offset)
	default:
		panic("invalid type for record reader")
	}
	return
}

type recordReader struct {
	recordReaderImpl
	leafInfo LevelInfo

	atRecStart  bool
	recordsRead int64

	levelsWritten int64
	levelsPos     int64
	levelsCap     int64

	defLevels *memory.Buffer
	repLevels *memory.Buffer

	refCount atomic.Int64
}

// binaryRecordReader is the recordReaderImpl for non-primitive data
type binaryRecordReader struct {
	*recordReader
}

func (b *binaryRecordReader) ReadDictionary() bool {
	return b.recordReaderImpl.(binaryRecordReaderImpl).ReadDictionary()
}

func (b *binaryRecordReader) GetBuilderChunks() []arrow.Array {
	return b.recordReaderImpl.(binaryRecordReaderImpl).GetBuilderChunks()
}

func newRecordReader(descr *schema.Column, info LevelInfo, mem memory.Allocator, bufferPool *sync.Pool) RecordReader {
	if mem == nil {
		mem = memory.DefaultAllocator
	}

	rr := &recordReader{
		recordReaderImpl: createPrimitiveRecordReader(descr, mem, bufferPool),
		leafInfo:         info,
		defLevels:        memory.NewResizableBuffer(mem),
		repLevels:        memory.NewResizableBuffer(mem),
	}
	rr.refCount.Add(1)
	return rr
}

func (rr *recordReader) Retain() {
	rr.refCount.Add(1)
}

func (rr *recordReader) Release() {
	if rr.refCount.Add(-1) == 0 {
		rr.recordReaderImpl.Release()
		rr.defLevels.Release()
		rr.repLevels.Release()
		rr.defLevels, rr.repLevels = nil, nil
		rr.Close()
	}
}

func (rr *recordReader) DefLevels() []int16 {
	return arrow.Int16Traits.CastFromBytes(rr.defLevels.Bytes())
}

func (rr *recordReader) RepLevels() []int16 {
	return arrow.Int16Traits.CastFromBytes(rr.repLevels.Bytes())
}

func (rr *recordReader) HasMore() bool {
	return rr.pager() != nil
}

func (rr *recordReader) SetPageReader(pr PageReader) {
	rr.atRecStart = true
	rr.recordReaderImpl.SetPageReader(pr)
}

func (rr *recordReader) ValuesWritten() int {
	return int(rr.recordReaderImpl.ValuesWritten())
}

func (rr *recordReader) LevelsPos() int64 { return rr.levelsPos }

func updateCapacity(cap, size, extra int64) (int64, error) {
	if extra < 0 {
		return 0, xerrors.New("negative size (corrupt file?)")
	}
	target, ok := utils.Add(size, extra)
	if !ok {
		return 0, xerrors.New("allocation size too large (corrupt file?)")
	}
	if target >= (1 << 62) {
		return 0, xerrors.New("allocation size too large (corrupt file?)")
	}
	if cap >= target {
		return cap, nil
	}
	return int64(bitutil.NextPowerOf2(int(target))), nil
}

func (rr *recordReader) Reserve(cap int64) error {
	if err := rr.reserveLevels(cap); err != nil {
		return err
	}
	if err := rr.reserveValues(cap); err != nil {
		return err
	}
	return nil
}

func (rr *recordReader) reserveLevels(extra int64) error {
	if rr.Descriptor().MaxDefinitionLevel() > 0 {
		newCap, err := updateCapacity(rr.levelsCap, rr.levelsWritten, extra)
		if err != nil {
			return err
		}

		if newCap > rr.levelsCap {
			capBytes, ok := utils.Mul(int(newCap), arrow.Int16SizeBytes)
			if !ok {
				return fmt.Errorf("allocation size too large (corrupt file?)")
			}
			rr.defLevels.ResizeNoShrink(capBytes)
			if rr.Descriptor().MaxRepetitionLevel() > 0 {
				rr.repLevels.ResizeNoShrink(capBytes)
			}
			rr.levelsCap = newCap
		}
	}
	return nil
}

func (rr *recordReader) reserveValues(extra int64) error {
	return rr.ReserveValues(extra, rr.leafInfo.HasNullableValues())
}

func (rr *recordReader) ResetValues() {
	rr.recordReaderImpl.ResetValues()
}

func (rr *recordReader) SeekToRow(recordIdx int64) error {
	if err := rr.recordReaderImpl.SeekToRow(recordIdx); err != nil {
		return err
	}

	rr.atRecStart = true
	rr.recordsRead = 0
	// force re-reading the definition/repetition levels
	// calling SeekToRow on the underlying column reader will ensure that
	// the next reads will pull from the correct row
	rr.levelsPos, rr.levelsWritten = 0, 0

	return nil
}

func (rr *recordReader) Reset() {
	rr.ResetValues()

	if rr.levelsWritten > 0 {
		remain := int(rr.levelsWritten - rr.levelsPos)
		// shift remaining levels to beginning of buffer and trim only the
		// number decoded remaining
		defData := rr.DefLevels()

		copy(defData, defData[int(rr.levelsPos):int(rr.levelsWritten)])
		rr.defLevels.ResizeNoShrink(remain * int(arrow.Int16SizeBytes))

		if rr.Descriptor().MaxRepetitionLevel() > 0 {
			repData := rr.RepLevels()
			copy(repData, repData[int(rr.levelsPos):int(rr.levelsWritten)])
			rr.repLevels.ResizeNoShrink(remain * int(arrow.Int16SizeBytes))
		}

		rr.levelsWritten -= rr.levelsPos
		rr.levelsPos = 0
		rr.levelsCap = int64(remain)
	}

	rr.recordsRead = 0
}

// process written rep/def levels to read the end of records
// process no more levels than necessary to delimit the indicated
// number of logical records. updates internal state of recordreader
// returns number of records delimited
func (rr *recordReader) delimitRecords(numRecords int64) (recordsRead, valsToRead int64) {
	var (
		curRep int16
		curDef int16
	)

	defLevels := rr.DefLevels()[int(rr.levelsPos):]
	repLevels := rr.RepLevels()[int(rr.levelsPos):]

	for rr.levelsPos < rr.levelsWritten {
		curRep, repLevels = repLevels[0], repLevels[1:]
		if curRep == 0 {
			// if at record start, we are seeing the start of a record
			// for the second time, such as after repeated calls to delimitrecords.
			// in this case we must continue until we find another record start
			// or exhaust the column chunk
			if !rr.atRecStart {
				// end of a record, increment count
				recordsRead++
				if recordsRead == numRecords {
					// found the number of records we wanted, set record start to true and break
					rr.atRecStart = true
					break
				}
			}
		}
		// we have decided to consume the level at this position
		// advance until we find another boundary
		rr.atRecStart = false

		curDef, defLevels = defLevels[0], defLevels[1:]
		if curDef == rr.Descriptor().MaxDefinitionLevel() {
			valsToRead++
		}
		rr.levelsPos++
	}
	return
}

func (rr *recordReader) ReadRecordData(numRecords int64) (int64, error) {
	possibleNum := utils.Max(numRecords, rr.levelsWritten-rr.levelsPos)
	if err := rr.reserveValues(possibleNum); err != nil {
		return 0, err
	}

	var (
		startPos     = rr.levelsPos
		valuesToRead int64
		recordsRead  int64
		nullCount    int64
		err          error
	)

	if rr.Descriptor().MaxRepetitionLevel() > 0 {
		recordsRead, valuesToRead = rr.delimitRecords(numRecords)
	} else if rr.Descriptor().MaxDefinitionLevel() > 0 {
		// no repetition levels, skip delimiting logic. each level
		// represents null or not null entry
		recordsRead = utils.Min(rr.levelsWritten-rr.levelsPos, numRecords)
		valuesToRead = recordsRead
		// this is advanced by delimitRecords which we skipped
		rr.levelsPos += recordsRead
	} else {
		recordsRead, valuesToRead = numRecords, numRecords
	}

	if rr.leafInfo.HasNullableValues() {
		validityIO := ValidityBitmapInputOutput{
			ReadUpperBound:  rr.levelsPos - startPos,
			ValidBits:       rr.GetValidBits(),
			ValidBitsOffset: rr.recordReaderImpl.ValuesWritten(),
		}
		DefLevelsToBitmap(rr.DefLevels()[startPos:int(rr.levelsPos)], rr.leafInfo, &validityIO)
		valuesToRead = validityIO.Read - validityIO.NullCount
		nullCount = validityIO.NullCount
		err = rr.ReadValuesSpaced(validityIO.Read, nullCount)
	} else {
		err = rr.ReadValuesDense(valuesToRead)
	}
	if err != nil {
		return 0, err
	}

	if rr.leafInfo.DefLevel > 0 {
		rr.consumeBufferedValues(rr.levelsPos - startPos)
	} else {
		rr.consumeBufferedValues(valuesToRead)
	}

	// total values, including nullspaces if any
	rr.IncrementWritten(valuesToRead+nullCount, nullCount)
	return recordsRead, nil
}

const minLevelBatchSize = 1024

func (rr *recordReader) ReadRecords(numRecords int64) (int64, error) {
	// delimit records, then read values at the end
	recordsRead := int64(0)

	if rr.levelsPos < rr.levelsWritten {
		additional, err := rr.ReadRecordData(numRecords)
		if err != nil {
			return 0, err
		}
		recordsRead += additional
	}

	levelBatch := utils.Max(minLevelBatchSize, numRecords)

	// if we are in the middle of a record, continue until reaching
	// the desired number of records or the end of the current record
	// if we have enough
	for !rr.atRecStart || recordsRead < numRecords {
		// is there more data in this row group?
		if !rr.HasNext() {
			if !rr.atRecStart {
				// ended the row group while inside a record we haven't seen
				// the end of yet. increment the record count for the last record
				// in the row group
				recordsRead++
				rr.atRecStart = true
			}
			break
		}

		// we perform multiple batch reads until we either exhaust the row group
		// or observe the desired number of records
		batchSize := utils.Min(levelBatch, rr.numAvailValues())
		if batchSize == 0 {
			// no more data in column
			break
		}

		if rr.Descriptor().MaxDefinitionLevel() > 0 {
			if err := rr.reserveLevels(batchSize); err != nil {
				return 0, err
			}

			defLevels := rr.DefLevels()[int(rr.levelsWritten):]

			levelsRead := 0
			// not present for non-repeated fields
			if rr.Descriptor().MaxRepetitionLevel() > 0 {
				repLevels := rr.RepLevels()[int(rr.levelsWritten):]
				levelsRead, _ = rr.readDefinitionLevels(defLevels[:batchSize])
				if rr.readRepetitionLevels(repLevels[:batchSize]) != levelsRead {
					return 0, xerrors.New("number of decoded rep/def levels did not match")
				}
			} else if rr.Descriptor().MaxDefinitionLevel() > 0 {
				levelsRead, _ = rr.readDefinitionLevels(defLevels[:batchSize])
			}

			if levelsRead == 0 {
				// exhausted column chunk
				break
			}

			rr.levelsWritten += int64(levelsRead)
			read, err := rr.ReadRecordData(numRecords - recordsRead)
			if err != nil {
				return recordsRead, err
			}
			recordsRead += read
		} else {
			// no rep or def levels
			batchSize = utils.Min(numRecords-recordsRead, batchSize)
			read, err := rr.ReadRecordData(batchSize)
			if err != nil {
				return recordsRead, err
			}
			recordsRead += read
		}
	}

	return recordsRead, rr.Err()
}

func (rr *recordReader) ReleaseValidBits() *memory.Buffer {
	if rr.leafInfo.HasNullableValues() {
		return rr.recordReaderImpl.ReleaseValidBits()
	}
	return nil
}

// flbaRecordReader is the specialization for optimizing reading fixed-length
// byte array records.
type flbaRecordReader struct {
	primitiveRecordReader

	bldr     *array.FixedSizeBinaryBuilder
	valueBuf []parquet.FixedLenByteArray
}

func (fr *flbaRecordReader) ReserveValues(extra int64, hasNullable bool) error {
	fr.bldr.Reserve(int(extra))
	return fr.primitiveRecordReader.ReserveValues(extra, hasNullable)
}

func (fr *flbaRecordReader) Retain() {
	fr.bldr.Retain()
	fr.primitiveRecordReader.Retain()
}

func (fr *flbaRecordReader) Release() {
	fr.bldr.Release()
	fr.primitiveRecordReader.Release()
}

func (fr *flbaRecordReader) ReadValuesDense(toRead int64) error {
	if int64(cap(fr.valueBuf)) < toRead {
		fr.valueBuf = make([]parquet.FixedLenByteArray, 0, toRead)
	}

	values := fr.valueBuf[:toRead]
	dec := fr.ColumnChunkReader.(*FixedLenByteArrayColumnChunkReader).curDecoder.(encoding.FixedLenByteArrayDecoder)

	_, err := dec.Decode(values)
	if err != nil {
		return err
	}

	for _, val := range values {
		fr.bldr.Append(val)
	}
	fr.ResetValues()
	return nil
}

func (fr *flbaRecordReader) ReadValuesSpaced(valuesWithNulls, nullCount int64) error {
	validBits := fr.validBits.Bytes()
	offset := fr.valuesWritten

	if int64(cap(fr.valueBuf)) < valuesWithNulls {
		fr.valueBuf = make([]parquet.FixedLenByteArray, 0, valuesWithNulls)
	}

	values := fr.valueBuf[:valuesWithNulls]
	dec := fr.ColumnChunkReader.(*FixedLenByteArrayColumnChunkReader).curDecoder.(encoding.FixedLenByteArrayDecoder)
	_, err := dec.DecodeSpaced(values, int(nullCount), validBits, offset)
	if err != nil {
		return err
	}

	for idx, val := range values {
		if bitutil.BitIsSet(validBits, int(offset)+idx) {
			fr.bldr.Append(val)
		} else {
			fr.bldr.AppendNull()
		}
	}
	fr.ResetValues()
	return nil
}

func (fr *flbaRecordReader) GetBuilderChunks() []arrow.Array {
	return []arrow.Array{fr.bldr.NewArray()}
}

func (fr *flbaRecordReader) ReadDictionary() bool { return false }

func newFLBARecordReader(descr *schema.Column, info LevelInfo, mem memory.Allocator, bufferPool *sync.Pool) RecordReader {
	if mem == nil {
		mem = memory.DefaultAllocator
	}

	byteWidth := descr.TypeLength()

	brr := &binaryRecordReader{&recordReader{
		recordReaderImpl: &flbaRecordReader{
			*createPrimitiveRecordReader(descr, mem, bufferPool),
			array.NewFixedSizeBinaryBuilder(mem, &arrow.FixedSizeBinaryType{ByteWidth: byteWidth}),
			nil,
		},
		leafInfo:  info,
		defLevels: memory.NewResizableBuffer(mem),
		repLevels: memory.NewResizableBuffer(mem),
	}}
	brr.refCount.Add(1)
	return brr
}

// byteArrayRecordReader is the specialization impl for byte-array columns
type byteArrayRecordReader struct {
	primitiveRecordReader

	bldr     array.Builder
	valueBuf []parquet.ByteArray
}

func newByteArrayRecordReader(descr *schema.Column, info LevelInfo, dtype arrow.DataType, mem memory.Allocator, bufferPool *sync.Pool) RecordReader {
	if mem == nil {
		mem = memory.DefaultAllocator
	}

	dt, ok := dtype.(arrow.BinaryDataType)
	// arrow.DecimalType will also come through here, which we want to treat as binary
	if !ok {
		dt = arrow.BinaryTypes.Binary
	}

	brr := &binaryRecordReader{&recordReader{
		recordReaderImpl: &byteArrayRecordReader{
			*createPrimitiveRecordReader(descr, mem, bufferPool),
			array.NewBinaryBuilder(mem, dt),
			nil,
		},
		leafInfo:  info,
		defLevels: memory.NewResizableBuffer(mem),
		repLevels: memory.NewResizableBuffer(mem),
	}}
	brr.refCount.Add(1)
	return brr
}

func (br *byteArrayRecordReader) ReserveValues(extra int64, hasNullable bool) error {
	br.bldr.Reserve(int(extra))
	return br.primitiveRecordReader.ReserveValues(extra, hasNullable)
}

func (br *byteArrayRecordReader) Retain() {
	br.bldr.Retain()
	br.primitiveRecordReader.Retain()
}

func (br *byteArrayRecordReader) Release() {
	br.bldr.Release()
	br.primitiveRecordReader.Release()
}

func (br *byteArrayRecordReader) ReadValuesDense(toRead int64) error {
	if int64(cap(br.valueBuf)) < toRead {
		br.valueBuf = make([]parquet.ByteArray, 0, toRead)
	}

	values := br.valueBuf[:toRead]
	dec := br.ColumnChunkReader.(*ByteArrayColumnChunkReader).curDecoder.(encoding.ByteArrayDecoder)

	_, err := dec.Decode(values)
	if err != nil {
		return err
	}

	switch bldr := br.bldr.(type) {
	case *array.BinaryBuilder:
		for _, val := range values {
			bldr.Append(val)
		}
	case *array.BinaryDictionaryBuilder:
		for _, val := range values {
			if err := bldr.Append(val); err != nil {
				return err
			}
		}
	}

	br.ResetValues()
	return nil
}

func (br *byteArrayRecordReader) ReadValuesSpaced(valuesWithNulls, nullCount int64) error {
	validBits := br.validBits.Bytes()
	offset := br.valuesWritten

	if int64(cap(br.valueBuf)) < valuesWithNulls {
		br.valueBuf = make([]parquet.ByteArray, 0, valuesWithNulls)
	}

	values := br.valueBuf[:valuesWithNulls]
	dec := br.ColumnChunkReader.(*ByteArrayColumnChunkReader).curDecoder.(encoding.ByteArrayDecoder)
	_, err := dec.DecodeSpaced(values, int(nullCount), validBits, offset)
	if err != nil {
		return err
	}

	switch bldr := br.bldr.(type) {
	case *array.BinaryBuilder:
		for idx, val := range values {
			if bitutil.BitIsSet(validBits, int(offset)+idx) {
				bldr.Append(val)
			} else {
				bldr.AppendNull()
			}
		}
	case *array.BinaryDictionaryBuilder:
		for idx, val := range values {
			if bitutil.BitIsSet(validBits, int(offset)+idx) {
				if err := bldr.Append(val); err != nil {
					return err
				}
			} else {
				bldr.AppendNull()
			}
		}
	}

	br.ResetValues()
	return nil
}

func (br *byteArrayRecordReader) GetBuilderChunks() []arrow.Array {
	return []arrow.Array{br.bldr.NewArray()}
}

func (br *byteArrayRecordReader) ReadDictionary() bool { return false }

type byteArrayDictRecordReader struct {
	byteArrayRecordReader

	resultChunks []arrow.Array
}

func newByteArrayDictRecordReader(descr *schema.Column, info LevelInfo, dtype arrow.DataType, mem memory.Allocator, bufferPool *sync.Pool) RecordReader {
	if mem == nil {
		mem = memory.DefaultAllocator
	}

	dt := dtype.(*arrow.DictionaryType)
	if _, ok := dt.ValueType.(arrow.BinaryDataType); !ok {
		dt.ValueType = arrow.BinaryTypes.Binary
	}

	brr := &binaryRecordReader{&recordReader{
		recordReaderImpl: &byteArrayDictRecordReader{
			byteArrayRecordReader: byteArrayRecordReader{
				*createPrimitiveRecordReader(descr, mem, bufferPool),
				array.NewDictionaryBuilder(mem, dt),
				nil,
			},
			resultChunks: make([]arrow.Array, 0),
		},
		leafInfo:  info,
		defLevels: memory.NewResizableBuffer(mem),
		repLevels: memory.NewResizableBuffer(mem),
	}}

	brr.refCount.Add(1)
	return brr
}

func (bd *byteArrayDictRecordReader) GetBuilderChunks() []arrow.Array {
	bd.flushBuilder()
	chunks := bd.resultChunks
	bd.resultChunks = make([]arrow.Array, 0, 1)
	return chunks
}

func (bd *byteArrayDictRecordReader) flushBuilder() {
	if bd.bldr.Len() > 0 {
		chunk := bd.bldr.NewArray()
		bd.resultChunks = append(bd.resultChunks, chunk)
	}
}

func (bd *byteArrayDictRecordReader) maybeWriteNewDictionary() error {
	rdr := bd.ColumnChunkReader.(*ByteArrayColumnChunkReader)
	// Only process dictionary if it's been read but not yet inserted into builder
	if rdr.dictState == dictReadNotInserted {
		// Flush the builder and insert the new dictionary values
		bd.flushBuilder()
		bd.bldr.(*array.BinaryDictionaryBuilder).ResetFull()
		dec := rdr.curDecoder.(*encoding.DictByteArrayDecoder)
		if err := dec.InsertDictionary(bd.bldr); err != nil {
			return err
		}
		// Mark dictionary as fully processed (read + inserted)
		rdr.dictState = dictFullyProcessed
	}
	return nil
}

func (bd *byteArrayDictRecordReader) ReadValuesDense(toRead int64) error {
	dec := bd.ColumnChunkReader.(*ByteArrayColumnChunkReader).curDecoder.(encoding.ByteArrayDecoder)
	if dec.Encoding() == parquet.Encodings.RLEDict {
		if err := bd.maybeWriteNewDictionary(); err != nil {
			return err
		}

		rdr := bd.ColumnChunkReader.(*ByteArrayColumnChunkReader)
		_, err := rdr.curDecoder.(*encoding.DictByteArrayDecoder).DecodeIndices(int(toRead), bd.bldr)
		return err
	}
	return bd.byteArrayRecordReader.ReadValuesDense(toRead)
}

func (bd *byteArrayDictRecordReader) ReadValuesSpaced(valuesWithNulls, nullCount int64) error {
	validBits := bd.validBits.Bytes()
	offset := bd.valuesWritten

	dec := bd.ColumnChunkReader.(*ByteArrayColumnChunkReader).curDecoder.(encoding.ByteArrayDecoder)
	if dec.Encoding() == parquet.Encodings.RLEDict {
		if err := bd.maybeWriteNewDictionary(); err != nil {
			return err
		}

		rdr := bd.ColumnChunkReader.(*ByteArrayColumnChunkReader)
		_, err := rdr.curDecoder.(*encoding.DictByteArrayDecoder).DecodeIndicesSpaced(int(valuesWithNulls), int(nullCount), validBits, offset, bd.bldr)
		return err

	}

	return bd.byteArrayRecordReader.ReadValuesSpaced(valuesWithNulls, int64(nullCount))
}

func (bd *byteArrayDictRecordReader) ReadDictionary() bool { return true }

func NewRecordReader(descr *schema.Column, info LevelInfo, dtype arrow.DataType, mem memory.Allocator, bufferPool *sync.Pool) RecordReader {
	switch descr.PhysicalType() {
	case parquet.Types.ByteArray:
		if dtype.ID() == arrow.DICTIONARY {
			return newByteArrayDictRecordReader(descr, info, dtype, mem, bufferPool)
		}
		return newByteArrayRecordReader(descr, info, dtype, mem, bufferPool)
	case parquet.Types.FixedLenByteArray:
		return newFLBARecordReader(descr, info, mem, bufferPool)
	default:
		return newRecordReader(descr, info, mem, bufferPool)
	}
}
