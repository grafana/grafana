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
	"errors"
	"fmt"
	"sync"

	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/internal/utils"
	"github.com/apache/arrow-go/v18/parquet"
	"github.com/apache/arrow-go/v18/parquet/internal/encoding"
	"github.com/apache/arrow-go/v18/parquet/internal/encryption"
	format "github.com/apache/arrow-go/v18/parquet/internal/gen-go/parquet"
	"github.com/apache/arrow-go/v18/parquet/schema"
	"golang.org/x/xerrors"
)

const (
	// 4 MB is the default maximum page header size
	defaultMaxPageHeaderSize = 4 * 1024 * 1024
	// 16 KB is the default expected page header size
	defaultPageHeaderSize = 16 * 1024
)

// dictionaryState tracks the lifecycle of dictionary handling for a column chunk
type dictionaryState int

const (
	// dictNotRead: Dictionary page has not been read yet
	dictNotRead dictionaryState = iota
	// dictReadNotInserted: Dictionary page has been read and decoder configured,
	// but not yet inserted into Arrow builder (for Arrow Dictionary types only)
	dictReadNotInserted
	// dictFullyProcessed: Dictionary has been read, configured, and inserted into builder
	dictFullyProcessed
)

// cloneByteArray is a helper function to clone a slice of byte slices
func cloneByteArray[T ~[]byte](src []T) {
	totalLength := 0
	for i := range src {
		totalLength += len(src[i])
	}

	buf := make([]byte, totalLength)
	pos := 0
	for i := range src {
		srcLen := len(src[i])
		copy(buf[pos:pos+srcLen], src[i])
		src[i] = T(buf[pos : pos+srcLen])
		pos += srcLen
	}
}

//go:generate go run ../../arrow/_tools/tmpl/main.go -i -data=../internal/encoding/physical_types.tmpldata column_reader_types.gen.go.tmpl

func isDictIndexEncoding(e format.Encoding) bool {
	return e == format.Encoding_RLE_DICTIONARY || e == format.Encoding_PLAIN_DICTIONARY
}

// CryptoContext is a context for keeping track of the current methods for decrypting.
// It keeps track of the row group and column numbers along with references to the
// decryptor objects.
type CryptoContext struct {
	StartDecryptWithDictionaryPage bool
	RowGroupOrdinal                int16
	ColumnOrdinal                  int16
	MetaDecryptor                  encryption.Decryptor
	DataDecryptor                  encryption.Decryptor
}

// ColumnChunkReader is the basic interface for all column readers. It will use
// a page reader to read all the pages in a column chunk from a row group.
//
// To actually Read out the column data, you need to convert to the properly
// typed ColumnChunkReader type such as *BooleanColumnReader etc.
//
// Some things to clarify when working with column readers:
//
// "Values" refers to the physical data values in a data page.
//
// This is separate from the number of "rows" in a column and the total number
// of "elements" in a column because null values aren't stored physically in the
// data page but are represented via definition levels, so the number of values
// in a column can be less than the number of rows.
//
// The total number of "elements" in a column also differs because of potential
// repeated fields, where you can have multiple values in the page which
// together make up a single element (such as a list) or depending on the repetition
// level and definition level, could represent an entire null list or just a null
// element inside of a list.
type ColumnChunkReader interface {
	// HasNext returns whether there is more data to be read in this column
	// and row group.
	HasNext() bool
	// Type returns the underlying physical type of the column
	Type() parquet.Type
	// Descriptor returns the column schema container
	Descriptor() *schema.Column
	// if HasNext returns false because of an error, this will return the error
	// it encountered. Otherwise this will be nil if it's just the end of the
	// column
	Err() error

	SeekToRow(rowIdx int64) error

	// Skip buffered values
	consumeBufferedValues(int64)
	// number of available buffered values that have not been decoded yet
	// when this returns 0, you're at the end of a page.
	numAvailValues() int64
	// read the definition levels and return the number of definitions,
	// and the number of values to be read (number of def levels == maxdef level)
	// it also populates the passed in slice which should be sized appropriately.
	readDefinitionLevels(levels []int16) (int, int64)
	// read the repetition levels and return the number of repetition levels read
	// also populates the passed in slice, which should be sized appropriately.
	readRepetitionLevels(levels []int16) int
	// a column is made up of potentially multiple pages across potentially multiple
	// row groups. A PageReader allows looping through the pages in a single row group.
	// When moving to another row group for reading, use setPageReader to re-use the
	// column reader for reading the pages of the new row group.
	pager() PageReader
	// set a page reader into the columnreader so it can be reused.
	//
	// This will clear any current error in the reader but does not
	// automatically read the first page of the page reader passed in until
	// HasNext which will read in the next page.
	setPageReader(PageReader)
	// Close releases the resources held by the column reader.
	Close() error
}

type columnChunkReader struct {
	descr *schema.Column

	rdr               PageReader
	repetitionDecoder encoding.LevelDecoder
	definitionDecoder encoding.LevelDecoder

	curPage     Page
	curEncoding format.Encoding
	curDecoder  encoding.TypedDecoder

	// number of currently buffered values in the current page
	numBuffered int64
	// the number of values we've decoded so far
	numDecoded int64
	mem        memory.Allocator
	bufferPool *sync.Pool

	decoders      map[format.Encoding]encoding.TypedDecoder
	decoderTraits encoding.DecoderTraits

	// is set when an error is encountered
	err          error
	defLvlBuffer []int16
	repLvlBuffer []int16

	dictState dictionaryState
}

func newTypedColumnChunkReader(base columnChunkReader) ColumnChunkReader {
	switch base.descr.PhysicalType() {
	case parquet.Types.FixedLenByteArray:
		base.decoderTraits = &encoding.FixedLenByteArrayDecoderTraits
		return &FixedLenByteArrayColumnChunkReader{base}
	case parquet.Types.Float:
		base.decoderTraits = &encoding.Float32DecoderTraits
		return &Float32ColumnChunkReader{base}
	case parquet.Types.Double:
		base.decoderTraits = &encoding.Float64DecoderTraits
		return &Float64ColumnChunkReader{base}
	case parquet.Types.ByteArray:
		base.decoderTraits = &encoding.ByteArrayDecoderTraits
		return &ByteArrayColumnChunkReader{base}
	case parquet.Types.Int32:
		base.decoderTraits = &encoding.Int32DecoderTraits
		return &Int32ColumnChunkReader{base}
	case parquet.Types.Int64:
		base.decoderTraits = &encoding.Int64DecoderTraits
		return &Int64ColumnChunkReader{base}
	case parquet.Types.Int96:
		base.decoderTraits = &encoding.Int96DecoderTraits
		return &Int96ColumnChunkReader{base}
	case parquet.Types.Boolean:
		base.decoderTraits = &encoding.BooleanDecoderTraits
		return &BooleanColumnChunkReader{base}
	}
	return nil
}

// NewColumnReader returns a column reader for the provided column initialized with the given pagereader that will
// provide the pages of data for this column. The type is determined from the column passed in.
//
// In addition to the page reader and allocator, a pointer to a shared sync.Pool is expected to provide buffers for temporary
// usage to minimize allocations. The bufferPool should provide *memory.Buffer objects that can be resized as necessary, buffers
// should have `ResizeNoShrink(0)` called on them before being put back into the pool.
//
// Deprecated: This function will be removed from the public interface soon as it is currently unsafe to use
// outside of this package.
func NewColumnReader(descr *schema.Column, pageReader PageReader, mem memory.Allocator, bufferPool *sync.Pool) ColumnChunkReader {
	base := columnChunkReader{descr: descr, rdr: pageReader, mem: mem, decoders: make(map[format.Encoding]encoding.TypedDecoder), bufferPool: bufferPool}
	switch descr.PhysicalType() {
	case parquet.Types.FixedLenByteArray:
		base.decoderTraits = &encoding.FixedLenByteArrayDecoderTraits
		return &FixedLenByteArrayColumnChunkReader{base}
	case parquet.Types.Float:
		base.decoderTraits = &encoding.Float32DecoderTraits
		return &Float32ColumnChunkReader{base}
	case parquet.Types.Double:
		base.decoderTraits = &encoding.Float64DecoderTraits
		return &Float64ColumnChunkReader{base}
	case parquet.Types.ByteArray:
		base.decoderTraits = &encoding.ByteArrayDecoderTraits
		return &ByteArrayColumnChunkReader{base}
	case parquet.Types.Int32:
		base.decoderTraits = &encoding.Int32DecoderTraits
		return &Int32ColumnChunkReader{base}
	case parquet.Types.Int64:
		base.decoderTraits = &encoding.Int64DecoderTraits
		return &Int64ColumnChunkReader{base}
	case parquet.Types.Int96:
		base.decoderTraits = &encoding.Int96DecoderTraits
		return &Int96ColumnChunkReader{base}
	case parquet.Types.Boolean:
		base.decoderTraits = &encoding.BooleanDecoderTraits
		return &BooleanColumnChunkReader{base}
	}
	return nil
}

func (c *columnChunkReader) Err() error                    { return c.err }
func (c *columnChunkReader) Type() parquet.Type            { return c.descr.PhysicalType() }
func (c *columnChunkReader) Descriptor() *schema.Column    { return c.descr }
func (c *columnChunkReader) consumeBufferedValues(n int64) { c.numDecoded += n }
func (c *columnChunkReader) numAvailValues() int64         { return c.numBuffered - c.numDecoded }
func (c *columnChunkReader) pager() PageReader             { return c.rdr }
func (c *columnChunkReader) setPageReader(rdr PageReader) {
	c.Close()
	c.rdr, c.err = rdr, nil
	c.decoders = make(map[format.Encoding]encoding.TypedDecoder)
	c.dictState = dictNotRead
	c.numBuffered, c.numDecoded = 0, 0
}

// Close closes the page raeder and the page if set.
func (c *columnChunkReader) Close() error {
	if c.curPage != nil {
		c.curPage.Release()
	}
	if c.rdr != nil {
		return c.rdr.Close()
	}
	return nil
}

func (c *columnChunkReader) getDefLvlBuffer(sz int64) []int16 {
	if int64(len(c.defLvlBuffer)) < sz {
		c.defLvlBuffer = make([]int16, sz)
		return c.defLvlBuffer
	}

	return c.defLvlBuffer[:sz]
}

func (c *columnChunkReader) getRepLvlBuffer(sz int64) []int16 {
	if int64(cap(c.repLvlBuffer)) < sz {
		c.repLvlBuffer = make([]int16, sz)
		return c.repLvlBuffer
	}

	return c.repLvlBuffer[:sz]
}

// HasNext returns whether there is more data to be read in this column
// and row group.
func (c *columnChunkReader) HasNext() bool {
	if c.numBuffered == 0 || c.numDecoded == c.numBuffered {
		return c.readNewPage() && c.numBuffered != 0
	}
	return true
}

func (c *columnChunkReader) readDictionary() error {
	// If dictionary has been read (in any state beyond dictNotRead), skip reading
	if c.dictState != dictNotRead {
		return nil
	}

	page, err := c.pager().GetDictionaryPage()
	if err != nil {
		return err
	}

	if page != nil {
		return c.configureDict(page)
	}

	return nil
}

func (c *columnChunkReader) configureDict(page *DictionaryPage) error {
	enc := page.encoding
	if enc == format.Encoding_PLAIN_DICTIONARY || enc == format.Encoding_PLAIN {
		enc = format.Encoding_RLE_DICTIONARY
	}

	if _, ok := c.decoders[enc]; ok {
		return xerrors.New("parquet: column chunk cannot have more than one dictionary.")
	}

	switch page.Encoding() {
	case format.Encoding_PLAIN, format.Encoding_PLAIN_DICTIONARY:
		dict := c.decoderTraits.Decoder(parquet.Encodings.Plain, c.descr, false, c.mem)
		dict.SetData(int(page.NumValues()), page.Data())

		decoder := c.decoderTraits.Decoder(parquet.Encodings.Plain, c.descr, true, c.mem).(encoding.DictDecoder)
		decoder.SetDict(dict)
		c.decoders[enc] = decoder
	default:
		return xerrors.New("parquet: dictionary index must be plain encoding")
	}

	// Dictionary page has been read and decoder configured
	// For non-Arrow Dictionary types, this is the final state
	// For Arrow Dictionary types, record reader will advance to dictFullyProcessed
	c.dictState = dictReadNotInserted
	c.curDecoder = c.decoders[enc]
	return nil
}

func (c *columnChunkReader) processPage() (bool, error) {
	var (
		err        error
		lvlByteLen int64
	)
	switch p := c.curPage.(type) {
	case *DictionaryPage:
		return false, c.configureDict(p)
	case *DataPageV1:
		lvlByteLen, err = c.initLevelDecodersV1(p, p.repLvlEncoding, p.defLvlEncoding)
	case *DataPageV2:
		lvlByteLen, err = c.initLevelDecodersV2(p)
	default:
		// we can skip non-data pages
		return false, nil
	}

	if err != nil {
		return true, err
	}

	return true, c.initDataDecoder(c.curPage, lvlByteLen)
}

// read a new page from the page reader
func (c *columnChunkReader) readNewPage() bool {
	for c.rdr.Next() { // keep going until we get a data page
		c.curPage = c.rdr.Page()
		if c.curPage == nil {
			break
		}

		gotDataPage, err := c.processPage()
		if err != nil {
			c.err = err
			return false
		}

		if gotDataPage {
			return true
		}
	}

	// If we get here, we're at the end of the column, and the page must
	// have already been released. So set it to nil to avoid releasing twice.
	c.curPage = nil
	c.err = c.rdr.Err()
	return false
}

func (c *columnChunkReader) initLevelDecodersV2(page *DataPageV2) (int64, error) {
	c.numBuffered = int64(page.nvals)
	c.numDecoded = 0
	buf := page.Data()
	totalLvlLen := int64(page.repLvlByteLen) + int64(page.defLvlByteLen)

	if totalLvlLen > int64(len(buf)) {
		return totalLvlLen, xerrors.New("parquet: data page too small for levels (corrupt header?)")
	}

	if c.descr.MaxRepetitionLevel() > 0 {
		c.repetitionDecoder.SetDataV2(page.repLvlByteLen, c.descr.MaxRepetitionLevel(), int(c.numBuffered), buf)
		if c.repLvlBuffer != nil {
			c.repLvlBuffer = c.repLvlBuffer[:0]
		}
	}
	// ARROW-17453: Some writers will write repetition levels even when
	// the max repetition level is 0, so we should respect the value
	// in the page header regardless of whether MaxRepetitionLevel is 0
	// or not.
	buf = buf[page.repLvlByteLen:]

	if c.descr.MaxDefinitionLevel() > 0 {
		c.definitionDecoder.SetDataV2(page.defLvlByteLen, c.descr.MaxDefinitionLevel(), int(c.numBuffered), buf)
	}

	return totalLvlLen, nil
}

func (c *columnChunkReader) initLevelDecodersV1(page *DataPageV1, repLvlEncoding, defLvlEncoding format.Encoding) (int64, error) {
	c.numBuffered = int64(page.nvals)
	c.numDecoded = 0

	buf := page.Data()
	maxSize := len(buf)
	levelsByteLen := int64(0)

	// Data page layout: Repetition Levels - Definition Levels - encoded values.
	// Levels are encoded as rle or bit-packed
	if c.descr.MaxRepetitionLevel() > 0 {
		repBytes, err := c.repetitionDecoder.SetData(parquet.Encoding(repLvlEncoding), c.descr.MaxRepetitionLevel(), int(c.numBuffered), buf)
		if err != nil {
			return levelsByteLen, err
		}
		buf = buf[repBytes:]
		maxSize -= repBytes
		levelsByteLen += int64(repBytes)
	}

	if c.descr.MaxDefinitionLevel() > 0 {
		defBytes, err := c.definitionDecoder.SetData(parquet.Encoding(defLvlEncoding), c.descr.MaxDefinitionLevel(), int(c.numBuffered), buf)
		if err != nil {
			return levelsByteLen, err
		}
		levelsByteLen += int64(defBytes)
		maxSize -= defBytes
	}

	return levelsByteLen, nil
}

func (c *columnChunkReader) initDataDecoder(page Page, lvlByteLen int64) error {
	buf := page.Data()
	if int64(len(buf)) < lvlByteLen {
		return xerrors.New("parquet: page smaller than size of encoded levels")
	}

	buf = buf[lvlByteLen:]
	encoding := page.Encoding()

	if isDictIndexEncoding(encoding) {
		// if we're seeking or otherwise skipping pages, we may not have read
		// the dictionary page in yet, so let's ensure we got it if one exists
		if err := c.readDictionary(); err != nil {
			return err
		}
		encoding = format.Encoding_RLE_DICTIONARY
	}

	if decoder, ok := c.decoders[encoding]; ok {
		c.curDecoder = decoder
	} else {
		switch encoding {
		case format.Encoding_RLE:
			if c.descr.PhysicalType() != parquet.Types.Boolean {
				return fmt.Errorf("parquet: only boolean supports RLE encoding, got %s", c.descr.PhysicalType())
			}
			fallthrough
		case format.Encoding_PLAIN,
			format.Encoding_DELTA_BYTE_ARRAY,
			format.Encoding_DELTA_LENGTH_BYTE_ARRAY,
			format.Encoding_DELTA_BINARY_PACKED,
			format.Encoding_BYTE_STREAM_SPLIT:
			c.curDecoder = c.decoderTraits.Decoder(parquet.Encoding(encoding), c.descr, false, c.mem)
			c.decoders[encoding] = c.curDecoder
		case format.Encoding_RLE_DICTIONARY:
			return errors.New("parquet: dictionary page must be before data page")
		default:
			return fmt.Errorf("parquet: unknown encoding type %s", encoding)
		}
	}

	c.curEncoding = encoding
	c.curDecoder.SetData(int(c.numBuffered), buf)
	return nil
}

// readDefinitionLevels decodes the definition levels from the page and returns
// it returns the total number of levels that were decoded (and thus populated
// in the passed in slice) and the number of physical values that exist to read
// (the number of levels that are equal to the max definition level).
//
// If the max definition level is 0, the assumption is that there no nulls in the
// column and therefore no definition levels to read, so it will always return 0, 0
func (c *columnChunkReader) readDefinitionLevels(levels []int16) (totalDecoded int, valuesToRead int64) {
	if c.descr.MaxDefinitionLevel() == 0 {
		return 0, 0
	}

	return c.definitionDecoder.Decode(levels)
}

// readRepetitionLevels decodes the repetition levels from the page and returns
// the total number of values decoded (and thus populated in the passed in levels
// slice).
//
// If max repetition level is 0, it is assumed there are no repetition levels,
// and thus will always return 0.
func (c *columnChunkReader) readRepetitionLevels(levels []int16) int {
	if c.descr.MaxRepetitionLevel() == 0 {
		return 0
	}

	if len(c.repLvlBuffer) > 0 {
		return copy(levels, c.repLvlBuffer[c.numDecoded:])
	}
	nlevels, _ := c.repetitionDecoder.Decode(levels)
	return nlevels
}

// determineNumToRead reads the definition levels (and optionally populates the repetition levels)
// in order to determine how many values need to be read to fulfill this batch read.
//
// batchLen is the number of values it is desired to read. defLvls must be either nil (in which case
// a buffer will be used) or must be at least batchLen in length to be safe. repLvls should be either nil
// (in which case it is ignored) or should be at least batchLen in length to be safe.
//
// In the return values: ndef is the number of definition levels that were actually read in which will
// typically be the minimum of batchLen and numAvailValues.
// toRead is the number of physical values that should be read in based on the definition levels (the number
// of definition levels that were equal to maxDefinitionLevel). and err being either nil or any error encountered
func (c *columnChunkReader) determineNumToRead(batchLen int64, defLvls, repLvls []int16) (ndefs int, toRead int64, err error) {
	if !c.HasNext() {
		return 0, 0, c.err
	}

	size := utils.Min(batchLen, c.numBuffered-c.numDecoded)

	if c.descr.MaxDefinitionLevel() > 0 {
		if defLvls == nil {
			defLvls = c.getDefLvlBuffer(size)
		}
		ndefs, toRead = c.readDefinitionLevels(defLvls[:size])
	} else {
		toRead = size
	}

	if c.descr.MaxRepetitionLevel() > 0 && repLvls != nil {
		nreps := c.readRepetitionLevels(repLvls[:size])
		if defLvls != nil && ndefs != nreps {
			err = xerrors.New("parquet: number of decoded rep/def levels did not match")
		}
	}
	return
}

// SeekToRow will seek to the row index provided in the column chunk. If
// the metadata contains an OffsetIndex for skipping pages based on row indexes
// then the pager will use that to skip to the correct page.
//
// If there is no OffsetIndex, then the pager will read each page until it
// finds the page that contains the desired row index, and the Column Chunk
// reader will discard values until it reaches the desired row index according
// to the definition and repetition levels.
func (c *columnChunkReader) SeekToRow(rowIdx int64) error {
	if err := c.pager().SeekToPageWithRow(rowIdx); err != nil {
		return err
	}

	c.numBuffered, c.numDecoded = 0, 0
	c.curPage = c.rdr.Page()
	if c.curPage == nil {
		c.err = c.rdr.Err()
		return c.err
	}

	gotDataPage, err := c.processPage()
	if err != nil {
		c.err = err
		return err
	}

	if !gotDataPage {
		c.readNewPage()
	}

	return c.skipRows(rowIdx - c.curPage.(DataPage).FirstRowIndex())
}

func (c *columnChunkReader) skipRows(nrows int64) error {
	toSkip := nrows
	for c.HasNext() && toSkip > 0 {
		// if there are no repetition levels, then this is easy! each level
		// is one row so we just use the definition levels to determine
		// the number of physical values to discard!
		if c.descr.MaxRepetitionLevel() == 0 {
			if toSkip >= (c.numBuffered - c.numDecoded) {
				toSkip -= c.numBuffered - c.numDecoded
				c.numDecoded = c.numBuffered
				continue
			}

			ndefs, nvals, err := c.determineNumToRead(toSkip, nil, nil)
			if err != nil {
				c.err = err
				return err
			}

			skipped, err := c.curDecoder.Discard(int(nvals))
			if err != nil {
				c.err = err
				return err
			}

			skipped = max(ndefs, skipped)

			toSkip -= int64(skipped)
			c.consumeBufferedValues(int64(skipped))
		} else {
			// with repetition levels, we have to check them to determine
			// how many rows to skip. we can't just skip the number of values
			// because there could be multiple values per row. So we read in
			// the repetition levels for the entire page at once and then go
			// through them to find the right row.
			repLvls := c.getRepLvlBuffer(c.numBuffered)
			nreps, _ := c.repetitionDecoder.Decode(repLvls)

			rowsSkipped := int64(0)
			levelsToSkip := -1
			for i, def := range repLvls[:nreps] {
				if def == 0 {
					if rowsSkipped == toSkip {
						levelsToSkip = i
						break
					}
					rowsSkipped++
				}
			}

			if levelsToSkip == -1 {
				toSkip -= rowsSkipped
				c.numBuffered, c.numDecoded = 0, 0
				continue
			}

			var valuesToSkip int64
			if c.descr.MaxDefinitionLevel() > 0 {
				defLvls := c.getDefLvlBuffer(int64(levelsToSkip))
				_, valuesToSkip = c.readDefinitionLevels(defLvls)
			} else {
				valuesToSkip = int64(levelsToSkip)
			}

			skipped, err := c.curDecoder.Discard(int(valuesToSkip))
			if err != nil {
				c.err = err
				return err
			}

			toSkip -= int64(skipped)
			c.consumeBufferedValues(int64(levelsToSkip))
		}
	}
	return nil
}

type readerFunc func(int64, int64) (int, error)

// readBatch is base function for reading a batch of values, this will read until it either reads
// in batchSize values or it hits the end of the column chunk, including reading multiple pages.
//
// totalLvls is the total number of values which were read in, and thus would be the total number
// of definition levels and repetition levels which were populated (if they were non-nil). totalRead
// is the number of physical values that were read in (ie: the number of non-null values)
func (c *columnChunkReader) readBatch(batchSize int64, defLvls, repLvls []int16, readFn readerFunc) (totalLvls int64, totalRead int, err error) {
	var (
		defs []int16
		reps []int16
		lvls int64
		read int
	)

	for totalLvls < batchSize && c.HasNext() && err == nil {
		if defLvls != nil {
			defs = defLvls[totalLvls:]
		}
		if repLvls != nil {
			reps = repLvls[totalLvls:]
		}
		lvls, read, err = c.readBatchInPage(batchSize-totalLvls, int64(totalRead), defs, reps, readFn)
		totalLvls += lvls
		totalRead += read
	}
	return totalLvls, totalRead, err
}

// readBatchInPage is a helper function for reading a batch of values. This function ensures
// the read values are from the same page.
//
// TotalRead is the start index to pass to readFn.
func (c *columnChunkReader) readBatchInPage(batchSize int64, totalRead int64, defLvls, repLvls []int16, readFn readerFunc) (lvls int64, read int, err error) {
	if !c.HasNext() {
		return 0, 0, c.err
	}

	ndefs, toRead, err := c.determineNumToRead(batchSize, defLvls, repLvls)
	if err != nil {
		return 0, 0, err
	}

	read, err = readFn(totalRead, toRead)
	// the total number of values processed here is the maximum of
	// the number of definition levels or the number of physical values read.
	// if this is a required field, ndefs will be 0 since there is no definition
	// levels stored with it and `read` will be the number of values, otherwise
	// we use ndefs since it will be equal to or greater than read.
	lvls = int64(utils.Max(ndefs, read))
	c.consumeBufferedValues(lvls)

	return lvls, read, err
}
