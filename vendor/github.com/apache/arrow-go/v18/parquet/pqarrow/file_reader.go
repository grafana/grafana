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

package pqarrow

import (
	"context"
	"errors"
	"fmt"
	"io"
	"slices"
	"sync"
	"sync/atomic"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/array"
	"github.com/apache/arrow-go/v18/arrow/arrio"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/internal/utils"
	"github.com/apache/arrow-go/v18/parquet"
	"github.com/apache/arrow-go/v18/parquet/file"
	"github.com/apache/arrow-go/v18/parquet/schema"
	"golang.org/x/sync/errgroup"
	"golang.org/x/xerrors"
)

type itrFactory func(int, *file.Reader) *columnIterator

type readerCtx struct {
	rdr            *file.Reader
	mem            memory.Allocator
	colFactory     itrFactory
	filterLeaves   bool
	includedLeaves map[int]bool
}

func (r readerCtx) includesLeaf(idx int) bool {
	_, ok := r.includedLeaves[idx]
	return ok
}

// ReadTable is a convenience function to quickly and easily read a parquet file
// into an arrow table.
//
// The schema of the arrow table is generated based on the schema of the parquet file,
// including nested columns/lists/etc. in the same fashion as the FromParquetSchema
// function. This just encapsulates the logic of creating a separate file.Reader and
// pqarrow.FileReader to make a single easy function when you just want to construct
// a table from the entire parquet file rather than reading it piecemeal.
func ReadTable(ctx context.Context, r parquet.ReaderAtSeeker, props *parquet.ReaderProperties, arrProps ArrowReadProperties, mem memory.Allocator) (arrow.Table, error) {
	pf, err := file.NewParquetReader(r, file.WithReadProps(props))
	if err != nil {
		return nil, err
	}

	reader, err := NewFileReader(pf, arrProps, mem)
	if err != nil {
		return nil, err
	}

	return reader.ReadTable(ctx)
}

// FileReader is the base object for reading a parquet file into arrow object
// types.
//
// It provides utility functions for reading record batches, a table, subsets of
// columns / rowgroups, and so on.
type FileReader struct {
	mem memory.Allocator
	rdr *file.Reader

	Props    ArrowReadProperties
	Manifest *SchemaManifest
}

// NewFileReader constructs a reader for converting to Arrow objects from an existing
// parquet file reader object.
//
// Only returns an error if there is some error constructing the schema manifest from
// the parquet file metadata.
func NewFileReader(rdr *file.Reader, props ArrowReadProperties, mem memory.Allocator) (*FileReader, error) {
	manifest, err := NewSchemaManifest(rdr.MetaData().Schema, rdr.MetaData().KeyValueMetadata(), &props)
	if err != nil {
		return nil, err
	}

	return &FileReader{
		mem:      mem,
		rdr:      rdr,
		Props:    props,
		Manifest: manifest,
	}, nil
}

// Schema returns the arrow schema representation of the underlying file's schema.
func (fr *FileReader) Schema() (*arrow.Schema, error) {
	return FromParquet(fr.rdr.MetaData().Schema, &fr.Props, fr.rdr.MetaData().KeyValueMetadata())
}

type extensionReader struct {
	colReaderImpl

	fieldWithExt arrow.Field
}

func (er *extensionReader) Field() *arrow.Field {
	return &er.fieldWithExt
}

func (er *extensionReader) BuildArray(boundedLen int64) (*arrow.Chunked, error) {
	if er.colReaderImpl == nil {
		return nil, errors.New("extension reader has no underlying column reader implementation")
	}

	chkd, err := er.colReaderImpl.BuildArray(boundedLen)
	if err != nil {
		return nil, err
	}
	defer chkd.Release()

	extType := er.fieldWithExt.Type.(arrow.ExtensionType)

	newChunks := make([]arrow.Array, len(chkd.Chunks()))
	for i, c := range chkd.Chunks() {
		newChunks[i] = array.NewExtensionArrayWithStorage(extType, c)
	}

	return arrow.NewChunked(extType, newChunks), nil
}

type colReaderImpl interface {
	LoadBatch(nrecs int64) error
	BuildArray(boundedLen int64) (*arrow.Chunked, error)
	GetDefLevels() ([]int16, error)
	GetRepLevels() ([]int16, error)
	Field() *arrow.Field
	SeekToRow(int64) error
	IsOrHasRepeatedChild() bool
	Retain()
	Release()
}

// ColumnReader is used for reading batches of data from a specific column
// across multiple row groups to return a chunked arrow array.
type ColumnReader struct {
	colReaderImpl
}

// NextBatch returns a chunked array after reading `size` values, potentially
// across multiple row groups.
func (c *ColumnReader) NextBatch(size int64) (*arrow.Chunked, error) {
	if err := c.LoadBatch(size); err != nil {
		return nil, err
	}
	return c.BuildArray(size)
}

type rdrCtxKey struct{}

func readerCtxFromContext(ctx context.Context) readerCtx {
	rdc := ctx.Value(rdrCtxKey{})
	if rdc != nil {
		return rdc.(readerCtx)
	}
	panic("no readerctx")
}

// ParquetReader returns the underlying parquet file reader that it was constructed with
func (fr *FileReader) ParquetReader() *file.Reader { return fr.rdr }

// GetColumn returns a reader for pulling the data of leaf column index i
// across all row groups in the file.
func (fr *FileReader) GetColumn(ctx context.Context, i int) (*ColumnReader, error) {
	return fr.getColumnReader(ctx, i, fr.allRowGroupFactory())
}

func rowGroupFactory(rowGroups []int) itrFactory {
	return func(i int, rdr *file.Reader) *columnIterator {
		return &columnIterator{
			index:     i,
			rdr:       rdr,
			schema:    rdr.MetaData().Schema,
			rowGroups: rowGroups,
		}
	}
}

func (fr *FileReader) allRowGroupFactory() itrFactory {
	rowGroups := make([]int, fr.rdr.NumRowGroups())
	for idx := range rowGroups {
		rowGroups[idx] = idx
	}
	return rowGroupFactory(rowGroups)
}

// GetFieldReader returns a reader for the entire Field of index i which could potentially include reading
// multiple columns from the underlying parquet file if that field is a nested field.
//
// IncludedLeaves and RowGroups are used to specify precisely which leaf indexes and row groups to read a subset of.
func (fr *FileReader) GetFieldReader(ctx context.Context, i int, includedLeaves map[int]bool, rowGroups []int) (*ColumnReader, error) {
	ctx = context.WithValue(ctx, rdrCtxKey{}, readerCtx{
		rdr:            fr.rdr,
		mem:            fr.mem,
		colFactory:     rowGroupFactory(rowGroups),
		filterLeaves:   true,
		includedLeaves: includedLeaves,
	})
	return fr.getReader(ctx, &fr.Manifest.Fields[i], *fr.Manifest.Fields[i].Field)
}

// GetFieldReaders is for retrieving readers for multiple fields at one time for only the list
// of column indexes and rowgroups requested. It returns a slice of the readers and the corresponding
// arrow.Schema for those columns.
func (fr *FileReader) GetFieldReaders(ctx context.Context, colIndices, rowGroups []int) ([]*ColumnReader, *arrow.Schema, error) {
	fieldIndices, err := fr.Manifest.GetFieldIndices(colIndices)
	if err != nil {
		return nil, nil, err
	}

	includedLeaves := make(map[int]bool)
	for _, col := range colIndices {
		includedLeaves[col] = true
	}

	out := make([]*ColumnReader, len(fieldIndices))
	outFields := make([]arrow.Field, len(fieldIndices))

	// Load batches in parallel
	// When reading structs with large numbers of columns, the serial load is very slow.
	// This is especially true when reading Cloud Storage. Loading concurrently
	// greatly improves performance.
	// GetFieldReader causes read operations, when issued serially on large numbers of columns,
	// this is super time consuming. Get field readers concurrently.
	g, gctx := errgroup.WithContext(ctx)
	if !fr.Props.Parallel {
		g.SetLimit(1)
	}
	for idx, fidx := range fieldIndices {
		idx, fidx := idx, fidx // create concurrent copy
		g.Go(func() error {
			rdr, err := fr.GetFieldReader(gctx, fidx, includedLeaves, rowGroups)
			if err != nil {
				return err
			}
			outFields[idx] = *rdr.Field()
			out[idx] = rdr
			return nil
		})
	}
	if err = g.Wait(); err != nil {
		return nil, nil, err
	}

	return out, arrow.NewSchema(outFields, fr.Manifest.SchemaMeta), nil
}

// RowGroup creates a reader that will *only* read from the requested row group
func (fr *FileReader) RowGroup(idx int) RowGroupReader {
	return RowGroupReader{fr, idx}
}

// ReadColumn reads data to create a chunked array only from the requested row groups.
func (fr *FileReader) ReadColumn(rowGroups []int, rdr *ColumnReader) (*arrow.Chunked, error) {
	recs := int64(0)
	for _, rg := range rowGroups {
		recs += fr.rdr.MetaData().RowGroups[rg].GetNumRows()
	}
	return rdr.NextBatch(recs)
}

// ReadTable reads the entire file into an array.Table
func (fr *FileReader) ReadTable(ctx context.Context) (arrow.Table, error) {
	var (
		cols = []int{}
		rgs  = []int{}
	)
	for i := 0; i < fr.rdr.MetaData().Schema.NumColumns(); i++ {
		cols = append(cols, i)
	}
	for i := 0; i < fr.rdr.NumRowGroups(); i++ {
		rgs = append(rgs, i)
	}
	return fr.ReadRowGroups(ctx, cols, rgs)
}

func (fr *FileReader) checkCols(indices []int) (err error) {
	for _, col := range indices {
		if col < 0 || col >= fr.rdr.MetaData().Schema.NumColumns() {
			err = fmt.Errorf("invalid column index specified %d out of %d", col, fr.rdr.MetaData().Schema.NumColumns())
			break
		}
	}
	return
}

func (fr *FileReader) checkRowGroups(indices []int) (err error) {
	for _, rg := range indices {
		if rg < 0 || rg >= fr.rdr.NumRowGroups() {
			err = fmt.Errorf("invalid row group specified: %d, file only has %d row groups", rg, fr.rdr.NumRowGroups())
			break
		}
	}
	return
}

type readerInfo struct {
	rdr *ColumnReader
	idx int
}

type resultPair struct {
	idx  int
	data *arrow.Chunked
	err  error
}

//! This is Super complicated.  I would simplify the pattern, but it works and hesitant to change what works.

// ReadRowGroups is for generating an array.Table from the file but filtering to only read the requested
// columns and row groups rather than the entire file which ReadTable does.
func (fr *FileReader) ReadRowGroups(ctx context.Context, indices, rowGroups []int) (arrow.Table, error) {
	if err := fr.checkRowGroups(rowGroups); err != nil {
		return nil, err
	}
	if err := fr.checkCols(indices); err != nil {
		return nil, err
	}

	// TODO(mtopol): add optimizations for pre-buffering data options

	readers, sc, err := fr.GetFieldReaders(ctx, indices, rowGroups)
	if err != nil {
		return nil, err
	}

	// producer-consumer parallelization
	var (
		np      = 1
		wg      sync.WaitGroup
		ch      = make(chan readerInfo, len(readers))
		results = make(chan resultPair, 2)
	)

	if fr.Props.Parallel {
		np = len(readers)
	}

	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	wg.Add(np) // fan-out to np readers
	for i := 0; i < np; i++ {
		go func() {
			defer wg.Done()
			defer func() {
				if pErr := recover(); pErr != nil {
					err := utils.FormatRecoveredError("panic while reading", pErr)
					results <- resultPair{err: err}
				}
			}()

			for {
				select {
				case r, ok := <-ch:
					if !ok {
						return
					}

					chnked, err := fr.ReadColumn(rowGroups, r.rdr)
					// pass the result column data to the result channel
					// for the consumer goroutine to process
					results <- resultPair{r.idx, chnked, err}
				case <-ctx.Done(): // check if we cancelled
					return
				}
			}
		}()
	}

	go func() {
		wg.Wait()
		close(results) // close the result channel when there's no more
	}()

	// pass pairs of reader and column index to the channel for the
	// goroutines to read the data
	for idx := range readers {
		defer readers[idx].Release()
		ch <- readerInfo{readers[idx], idx}
	}
	close(ch)

	// output slice of columns
	columns := make([]arrow.Column, sc.NumFields())
	defer releaseColumns(columns)
	for data := range results {
		if data.err != nil {
			err = data.err
			cancel()
			break
		}
		columns[data.idx] = *arrow.NewColumn(sc.Field(data.idx), data.data)
		data.data.Release()
	}

	// if the context is in error, but we haven't set an error yet, then it means that the parent context
	// was cancelled. In this case, we should exit early as some columns may not have been read yet.
	err = errors.Join(err, ctx.Err())
	if err != nil {
		// if we encountered an error, consume any waiting data on the channel
		// so the goroutines don't leak and so memory can get cleaned up. we already
		// cancelled the context, so we're just consuming anything that was already queued up.
		for data := range results {
			data.data.Release()
		}
		return nil, err
	}

	var nrows int
	if len(columns) > 0 {
		nrows = columns[0].Len()
	}

	return array.NewTable(sc, columns, int64(nrows)), nil
}

func (fr *FileReader) getColumnReader(ctx context.Context, i int, colFactory itrFactory) (*ColumnReader, error) {
	if i < 0 || i >= len(fr.Manifest.Fields) {
		return nil, fmt.Errorf("invalid column index chosen %d, there are only %d columns", i, len(fr.Manifest.Fields))
	}

	ctx = context.WithValue(ctx, rdrCtxKey{}, readerCtx{
		rdr:          fr.rdr,
		mem:          fr.mem,
		colFactory:   colFactory,
		filterLeaves: false,
	})

	return fr.getReader(ctx, &fr.Manifest.Fields[i], *fr.Manifest.Fields[i].Field)
}

// RecordReader is a Record Batch Reader that meets the interfaces for both
// array.RecordReader and arrio.Reader to allow easy progressive reading
// of record batches from the parquet file. Ideal for streaming.
type RecordReader interface {
	array.RecordReader
	arrio.Reader
	// SeekToRow will shift the record reader so that subsequent calls to Read
	// or Next will begin from the specified row.
	//
	// If the record reader was constructed with a request for a subset of row
	// groups, then rows are counted across the requested row groups, not the
	// entire file. This prevents reading row groups that were requested to be
	// skipped, and allows treating the subset of row groups as a single collection
	// of rows.
	//
	// If the file contains Offset indexes for a given column, then it will be
	// utilized to skip pages as needed to find the requested row. Otherwise page
	// headers will have to still be read to find the right page to being reading
	// from.
	SeekToRow(int64) error
}

// GetRecordReader returns a record reader that reads only the requested column indexes and row groups.
//
// For both cases, if you pass nil for column indexes or rowgroups it will default to reading all of them.
func (fr *FileReader) GetRecordReader(ctx context.Context, colIndices, rowGroups []int) (RecordReader, error) {
	if err := fr.checkRowGroups(rowGroups); err != nil {
		return nil, err
	}

	if rowGroups == nil {
		rowGroups = make([]int, fr.rdr.NumRowGroups())
		for idx := range rowGroups {
			rowGroups[idx] = idx
		}
	}

	if err := fr.checkCols(colIndices); err != nil {
		return nil, err
	}

	if colIndices == nil {
		colIndices = make([]int, fr.rdr.MetaData().Schema.NumColumns())
		for idx := range colIndices {
			colIndices[idx] = idx
		}
	}

	// TODO(mtopol): add optimizations to pre-buffer data from the file

	readers, sc, err := fr.GetFieldReaders(ctx, colIndices, rowGroups)
	if err != nil {
		return nil, err
	}

	if len(readers) == 0 {
		return nil, xerrors.New("no leaf column readers matched col indices")
	}

	nrows := int64(0)
	for _, rg := range rowGroups {
		nrows += fr.rdr.MetaData().RowGroup(rg).NumRows()
	}

	batchSize := fr.Props.BatchSize
	if fr.Props.BatchSize <= 0 {
		batchSize = nrows
	}
	rr := &recordReader{
		numRows:      nrows,
		batchSize:    batchSize,
		parallel:     fr.Props.Parallel,
		sc:           sc,
		fieldReaders: readers,
		mem:          fr.mem,
	}
	rr.refCount.Add(1)
	return rr, nil
}

func (fr *FileReader) getReader(ctx context.Context, field *SchemaField, arrowField arrow.Field) (out *ColumnReader, err error) {
	rctx := readerCtxFromContext(ctx)
	if len(field.Children) == 0 {
		if !field.IsLeaf() {
			return nil, xerrors.New("parquet non-leaf node has no children")
		}
		if rctx.filterLeaves && !rctx.includesLeaf(field.ColIndex) {
			return nil, nil
		}

		out, err = newLeafReader(&rctx, field.Field, rctx.colFactory(field.ColIndex, rctx.rdr), field.LevelInfo, fr.Props, fr.rdr.BufferPool())
		return
	}

	switch arrowField.Type.ID() {
	case arrow.EXTENSION:
		storageField := arrowField
		storageField.Type = arrowField.Type.(arrow.ExtensionType).StorageType()
		storageReader, err := fr.getReader(ctx, field, storageField)
		if err != nil {
			return nil, err
		}

		return &ColumnReader{&extensionReader{colReaderImpl: storageReader, fieldWithExt: arrowField}}, nil
	case arrow.STRUCT:

		childReaders := make([]*ColumnReader, len(field.Children))
		childFields := make([]arrow.Field, len(field.Children))

		// Get child field readers concurrently
		// 'getReader' causes a read operation.  Issue the 'reads' concurrently
		// When reading structs with large numbers of columns, the serial load is very slow.
		// This is especially true when reading Cloud Storage. Loading concurrently
		// greatly improves performance.
		g, gctx := errgroup.WithContext(ctx)
		if !fr.Props.Parallel {
			g.SetLimit(1)
		}

		for n, child := range field.Children {
			n, child := n, child
			g.Go(func() error {
				reader, err := fr.getReader(gctx, &child, *child.Field)
				if err != nil {
					return err
				}
				if reader == nil {
					return nil
				}
				childFields[n] = *child.Field
				childReaders[n] = reader
				return nil
			})
		}
		if err = g.Wait(); err != nil {
			return nil, err
		}

		// because we performed getReader concurrently, we need to prune out any empty readers
		childReaders = slices.DeleteFunc(childReaders,
			func(r *ColumnReader) bool { return r == nil })
		if len(childFields) == 0 {
			return nil, nil
		}
		filtered := arrow.Field{
			Name: arrowField.Name, Nullable: arrowField.Nullable,
			Metadata: arrowField.Metadata, Type: arrow.StructOf(childFields...),
		}
		out = newStructReader(&rctx, &filtered, field.LevelInfo, childReaders, fr.Props)
	case arrow.LIST, arrow.FIXED_SIZE_LIST, arrow.MAP:
		child := field.Children[0]
		childReader, err := fr.getReader(ctx, &child, *child.Field)
		if err != nil {
			return nil, err
		}
		if childReader == nil {
			return nil, nil
		}
		defer childReader.Release()

		switch arrowField.Type.(type) {
		case *arrow.MapType:
			if len(child.Children) != 2 {
				arrowField.Type = arrow.ListOf(childReader.Field().Type)
			}
			out = newListReader(&rctx, &arrowField, field.LevelInfo, childReader, fr.Props)
		case *arrow.ListType:
			out = newListReader(&rctx, &arrowField, field.LevelInfo, childReader, fr.Props)
		case *arrow.FixedSizeListType:
			out = newFixedSizeListReader(&rctx, &arrowField, field.LevelInfo, childReader, fr.Props)
		default:
			return nil, fmt.Errorf("unknown list type: %s", field.Field.String())
		}
	}
	return
}

// RowGroupReader is a reader for getting data only from a single row group of the file
// rather than having to repeatedly pass the index to functions on the reader.
type RowGroupReader struct {
	impl *FileReader
	idx  int
}

// ReadTable provides an array.Table consisting only of the columns requested for this rowgroup
func (rgr RowGroupReader) ReadTable(ctx context.Context, colIndices []int) (arrow.Table, error) {
	return rgr.impl.ReadRowGroups(ctx, colIndices, []int{rgr.idx})
}

// Column creates a reader for just the requested column chunk in only this row group.
func (rgr RowGroupReader) Column(idx int) ColumnChunkReader {
	return ColumnChunkReader{rgr.impl, idx, rgr.idx}
}

// ColumnChunkReader is a reader that reads only a single column chunk from a single
// column in a single row group
type ColumnChunkReader struct {
	impl     *FileReader
	idx      int
	rowGroup int
}

func (ccr ColumnChunkReader) Read(ctx context.Context) (*arrow.Chunked, error) {
	rdr, err := ccr.impl.getColumnReader(ctx, ccr.idx, rowGroupFactory([]int{ccr.rowGroup}))
	if err != nil {
		return nil, err
	}
	return ccr.impl.ReadColumn([]int{ccr.rowGroup}, rdr)
}

type columnIterator struct {
	index     int
	rdr       *file.Reader
	schema    *schema.Schema
	rowGroups []int

	rgIdx int
}

func (c *columnIterator) FindChunkForRow(rowIdx int64) (file.PageReader, int64, error) {
	if len(c.rowGroups) == 0 {
		return nil, 0, nil
	}

	if rowIdx < 0 || rowIdx > c.rdr.NumRows() {
		return nil, 0, fmt.Errorf("invalid row index %d, file only has %d rows", rowIdx, c.rdr.NumRows())
	}

	idx := int64(0)
	for i, rg := range c.rowGroups {
		rgr := c.rdr.RowGroup(rg)
		if idx+rgr.NumRows() > rowIdx {
			c.rgIdx = i + 1
			pr, err := rgr.GetColumnPageReader(c.index)
			if err != nil {
				return nil, 0, err
			}

			return pr, rowIdx - idx, nil
		}
		idx += rgr.NumRows()
	}

	return nil, 0, fmt.Errorf("%w: invalid row index %d, row group subset only has %d total rows",
		arrow.ErrInvalid, rowIdx, idx)
}

func (c *columnIterator) NextChunk() (file.PageReader, error) {
	if len(c.rowGroups) == 0 || c.rgIdx >= len(c.rowGroups) {
		return nil, nil
	}

	rgr := c.rdr.RowGroup(c.rowGroups[c.rgIdx])
	c.rgIdx++
	return rgr.GetColumnPageReader(c.index)
}

func (c *columnIterator) Descr() *schema.Column { return c.schema.Column(c.index) }

// implementation of arrio.Reader for streaming record batches
// from the parquet data.
type recordReader struct {
	numRows      int64
	batchSize    int64
	parallel     bool
	sc           *arrow.Schema
	fieldReaders []*ColumnReader
	cur          arrow.RecordBatch
	err          error
	mem          memory.Allocator

	refCount atomic.Int64
}

func (r *recordReader) SeekToRow(row int64) error {
	if r.cur != nil {
		r.cur.Release()
		r.cur = nil
	}

	if row < 0 || row >= r.numRows {
		return fmt.Errorf("invalid row index %d, file only has %d rows", row, r.numRows)
	}

	var (
		np = 1
		g  errgroup.Group
	)

	if r.parallel {
		np = len(r.fieldReaders)
	}

	g.SetLimit(np)
	for _, fr := range r.fieldReaders {
		fr := fr
		g.Go(func() error { return fr.SeekToRow(row) })
	}

	return g.Wait()
}

func (r *recordReader) Retain() {
	r.refCount.Add(1)
}

func (r *recordReader) Release() {
	if r.refCount.Add(-1) == 0 {
		if r.cur != nil {
			r.cur.Release()
			r.cur = nil
		}
		if r.fieldReaders == nil {
			return
		}
		for _, fr := range r.fieldReaders {
			fr.Release()
		}
		r.fieldReaders = nil
	}
}

func (r *recordReader) Schema() *arrow.Schema { return r.sc }

func (r *recordReader) next() bool {
	cols := make([]arrow.Array, len(r.sc.Fields()))
	defer releaseArrays(cols)
	readField := func(idx int, rdr *ColumnReader) error {
		data, err := rdr.NextBatch(r.batchSize)
		if err != nil {
			return err
		}
		defer data.Release()

		if data.Len() == 0 {
			return io.EOF
		}

		arrdata, err := chunksToSingle(data, r.mem)
		if err != nil {
			return err
		}
		defer arrdata.Release()

		cols[idx] = array.MakeFromData(arrdata)
		return nil
	}

	if !r.parallel {
		for idx, rdr := range r.fieldReaders {
			if err := readField(idx, rdr); err != nil {
				r.err = err
				return false
			}
		}

		r.cur = array.NewRecordBatch(r.sc, cols, -1)
		return true
	}

	var (
		wg    sync.WaitGroup
		np    = len(cols)
		ch    = make(chan int, np)
		errch = make(chan error, np)
	)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	wg.Add(np)
	for i := 0; i < np; i++ {
		go func() {
			defer wg.Done()
			for {
				select {
				case idx, ok := <-ch:
					if !ok {
						return
					}

					if err := readField(idx, r.fieldReaders[idx]); err != nil {
						errch <- err
						cancel()
						return
					}

				case <-ctx.Done():
					return
				}
			}
		}()
	}

	for idx := range r.fieldReaders {
		ch <- idx
	}
	close(ch)
	wg.Wait()
	close(errch)

	var ok bool
	// check for any errors
	if r.err, ok = <-errch; ok {
		// return the first error that was reported and drain
		// any remaining errors from the channel before returning.
		for range errch {
		}
		return false
	}

	r.cur = array.NewRecordBatch(r.sc, cols, -1)
	return true
}

func (r *recordReader) Next() bool {
	if r.cur != nil {
		r.cur.Release()
		r.cur = nil
	}

	if r.err != nil {
		return false
	}

	return r.next()
}

func (r *recordReader) RecordBatch() arrow.RecordBatch { return r.cur }

// Deprecated: Use [RecordBatch] instead.
func (r *recordReader) Record() arrow.Record { return r.RecordBatch() }

func (r *recordReader) Err() error {
	if r.err == io.EOF {
		return nil
	}
	return r.err
}

func (r *recordReader) Read() (arrow.RecordBatch, error) {
	if r.cur != nil {
		r.cur.Release()
		r.cur = nil
	}

	if !r.next() {
		return nil, r.err
	}

	return r.cur, nil
}
