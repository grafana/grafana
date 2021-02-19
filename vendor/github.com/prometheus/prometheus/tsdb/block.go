// Copyright 2017 The Prometheus Authors

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package tsdb

import (
	"encoding/json"
	"io"
	"io/ioutil"
	"os"
	"path/filepath"
	"sync"

	"github.com/go-kit/kit/log"
	"github.com/go-kit/kit/log/level"
	"github.com/oklog/ulid"
	"github.com/pkg/errors"
	"github.com/prometheus/prometheus/pkg/labels"
	"github.com/prometheus/prometheus/tsdb/chunkenc"
	"github.com/prometheus/prometheus/tsdb/chunks"
	tsdb_errors "github.com/prometheus/prometheus/tsdb/errors"
	"github.com/prometheus/prometheus/tsdb/fileutil"
	"github.com/prometheus/prometheus/tsdb/index"
	"github.com/prometheus/prometheus/tsdb/tombstones"
)

// IndexWriter serializes the index for a block of series data.
// The methods must be called in the order they are specified in.
type IndexWriter interface {
	// AddSymbols registers all string symbols that are encountered in series
	// and other indices. Symbols must be added in sorted order.
	AddSymbol(sym string) error

	// AddSeries populates the index writer with a series and its offsets
	// of chunks that the index can reference.
	// Implementations may require series to be insert in strictly increasing order by
	// their labels. The reference numbers are used to resolve entries in postings lists
	// that are added later.
	AddSeries(ref uint64, l labels.Labels, chunks ...chunks.Meta) error

	// Close writes any finalization and closes the resources associated with
	// the underlying writer.
	Close() error
}

// IndexReader provides reading access of serialized index data.
type IndexReader interface {
	// Symbols return an iterator over sorted string symbols that may occur in
	// series' labels and indices. It is not safe to use the returned strings
	// beyond the lifetime of the index reader.
	Symbols() index.StringIter

	// SortedLabelValues returns sorted possible label values.
	SortedLabelValues(name string) ([]string, error)

	// LabelValues returns possible label values which may not be sorted.
	LabelValues(name string) ([]string, error)

	// Postings returns the postings list iterator for the label pairs.
	// The Postings here contain the offsets to the series inside the index.
	// Found IDs are not strictly required to point to a valid Series, e.g.
	// during background garbage collections. Input values must be sorted.
	Postings(name string, values ...string) (index.Postings, error)

	// SortedPostings returns a postings list that is reordered to be sorted
	// by the label set of the underlying series.
	SortedPostings(index.Postings) index.Postings

	// Series populates the given labels and chunk metas for the series identified
	// by the reference.
	// Returns storage.ErrNotFound if the ref does not resolve to a known series.
	Series(ref uint64, lset *labels.Labels, chks *[]chunks.Meta) error

	// LabelNames returns all the unique label names present in the index in sorted order.
	LabelNames() ([]string, error)

	// Close releases the underlying resources of the reader.
	Close() error
}

// ChunkWriter serializes a time block of chunked series data.
type ChunkWriter interface {
	// WriteChunks writes several chunks. The Chunk field of the ChunkMetas
	// must be populated.
	// After returning successfully, the Ref fields in the ChunkMetas
	// are set and can be used to retrieve the chunks from the written data.
	WriteChunks(chunks ...chunks.Meta) error

	// Close writes any required finalization and closes the resources
	// associated with the underlying writer.
	Close() error
}

// ChunkReader provides reading access of serialized time series data.
type ChunkReader interface {
	// Chunk returns the series data chunk with the given reference.
	Chunk(ref uint64) (chunkenc.Chunk, error)

	// Close releases all underlying resources of the reader.
	Close() error
}

// BlockReader provides reading access to a data block.
type BlockReader interface {
	// Index returns an IndexReader over the block's data.
	Index() (IndexReader, error)

	// Chunks returns a ChunkReader over the block's data.
	Chunks() (ChunkReader, error)

	// Tombstones returns a tombstones.Reader over the block's deleted data.
	Tombstones() (tombstones.Reader, error)

	// Meta provides meta information about the block reader.
	Meta() BlockMeta

	// Size returns the number of bytes that the block takes up on disk.
	Size() int64
}

// BlockMeta provides meta information about a block.
type BlockMeta struct {
	// Unique identifier for the block and its contents. Changes on compaction.
	ULID ulid.ULID `json:"ulid"`

	// MinTime and MaxTime specify the time range all samples
	// in the block are in.
	MinTime int64 `json:"minTime"`
	MaxTime int64 `json:"maxTime"`

	// Stats about the contents of the block.
	Stats BlockStats `json:"stats,omitempty"`

	// Information on compactions the block was created from.
	Compaction BlockMetaCompaction `json:"compaction"`

	// Version of the index format.
	Version int `json:"version"`
}

// BlockStats contains stats about contents of a block.
type BlockStats struct {
	NumSamples    uint64 `json:"numSamples,omitempty"`
	NumSeries     uint64 `json:"numSeries,omitempty"`
	NumChunks     uint64 `json:"numChunks,omitempty"`
	NumTombstones uint64 `json:"numTombstones,omitempty"`
}

// BlockDesc describes a block by ULID and time range.
type BlockDesc struct {
	ULID    ulid.ULID `json:"ulid"`
	MinTime int64     `json:"minTime"`
	MaxTime int64     `json:"maxTime"`
}

// BlockMetaCompaction holds information about compactions a block went through.
type BlockMetaCompaction struct {
	// Maximum number of compaction cycles any source block has
	// gone through.
	Level int `json:"level"`
	// ULIDs of all source head blocks that went into the block.
	Sources []ulid.ULID `json:"sources,omitempty"`
	// Indicates that during compaction it resulted in a block without any samples
	// so it should be deleted on the next reload.
	Deletable bool `json:"deletable,omitempty"`
	// Short descriptions of the direct blocks that were used to create
	// this block.
	Parents []BlockDesc `json:"parents,omitempty"`
	Failed  bool        `json:"failed,omitempty"`
}

const indexFilename = "index"
const metaFilename = "meta.json"
const metaVersion1 = 1

func chunkDir(dir string) string { return filepath.Join(dir, "chunks") }

func readMetaFile(dir string) (*BlockMeta, int64, error) {
	b, err := ioutil.ReadFile(filepath.Join(dir, metaFilename))
	if err != nil {
		return nil, 0, err
	}
	var m BlockMeta

	if err := json.Unmarshal(b, &m); err != nil {
		return nil, 0, err
	}
	if m.Version != metaVersion1 {
		return nil, 0, errors.Errorf("unexpected meta file version %d", m.Version)
	}

	return &m, int64(len(b)), nil
}

func writeMetaFile(logger log.Logger, dir string, meta *BlockMeta) (int64, error) {
	meta.Version = metaVersion1

	// Make any changes to the file appear atomic.
	path := filepath.Join(dir, metaFilename)
	tmp := path + ".tmp"
	defer func() {
		if err := os.RemoveAll(tmp); err != nil {
			level.Error(logger).Log("msg", "remove tmp file", "err", err.Error())
		}
	}()

	f, err := os.Create(tmp)
	if err != nil {
		return 0, err
	}

	jsonMeta, err := json.MarshalIndent(meta, "", "\t")
	if err != nil {
		return 0, err
	}

	var merr tsdb_errors.MultiError
	n, err := f.Write(jsonMeta)
	if err != nil {
		merr.Add(err)
		merr.Add(f.Close())
		return 0, merr.Err()
	}

	// Force the kernel to persist the file on disk to avoid data loss if the host crashes.
	if err := f.Sync(); err != nil {
		merr.Add(err)
		merr.Add(f.Close())
		return 0, merr.Err()
	}
	if err := f.Close(); err != nil {
		return 0, err
	}
	return int64(n), fileutil.Replace(tmp, path)
}

// Block represents a directory of time series data covering a continuous time range.
type Block struct {
	mtx            sync.RWMutex
	closing        bool
	pendingReaders sync.WaitGroup

	dir  string
	meta BlockMeta

	// Symbol Table Size in bytes.
	// We maintain this variable to avoid recalculation every time.
	symbolTableSize uint64

	chunkr     ChunkReader
	indexr     IndexReader
	tombstones tombstones.Reader

	logger log.Logger

	numBytesChunks    int64
	numBytesIndex     int64
	numBytesTombstone int64
	numBytesMeta      int64
}

// OpenBlock opens the block in the directory. It can be passed a chunk pool, which is used
// to instantiate chunk structs.
func OpenBlock(logger log.Logger, dir string, pool chunkenc.Pool) (pb *Block, err error) {
	if logger == nil {
		logger = log.NewNopLogger()
	}
	var closers []io.Closer
	defer func() {
		if err != nil {
			var merr tsdb_errors.MultiError
			merr.Add(err)
			merr.Add(closeAll(closers))
			err = merr.Err()
		}
	}()
	meta, sizeMeta, err := readMetaFile(dir)
	if err != nil {
		return nil, err
	}

	cr, err := chunks.NewDirReader(chunkDir(dir), pool)
	if err != nil {
		return nil, err
	}
	closers = append(closers, cr)

	ir, err := index.NewFileReader(filepath.Join(dir, indexFilename))
	if err != nil {
		return nil, err
	}
	closers = append(closers, ir)

	tr, sizeTomb, err := tombstones.ReadTombstones(dir)
	if err != nil {
		return nil, err
	}
	closers = append(closers, tr)

	pb = &Block{
		dir:               dir,
		meta:              *meta,
		chunkr:            cr,
		indexr:            ir,
		tombstones:        tr,
		symbolTableSize:   ir.SymbolTableSize(),
		logger:            logger,
		numBytesChunks:    cr.Size(),
		numBytesIndex:     ir.Size(),
		numBytesTombstone: sizeTomb,
		numBytesMeta:      sizeMeta,
	}
	return pb, nil
}

// Close closes the on-disk block. It blocks as long as there are readers reading from the block.
func (pb *Block) Close() error {
	pb.mtx.Lock()
	pb.closing = true
	pb.mtx.Unlock()

	pb.pendingReaders.Wait()

	var merr tsdb_errors.MultiError

	merr.Add(pb.chunkr.Close())
	merr.Add(pb.indexr.Close())
	merr.Add(pb.tombstones.Close())

	return merr.Err()
}

func (pb *Block) String() string {
	return pb.meta.ULID.String()
}

// Dir returns the directory of the block.
func (pb *Block) Dir() string { return pb.dir }

// Meta returns meta information about the block.
func (pb *Block) Meta() BlockMeta { return pb.meta }

// MinTime returns the min time of the meta.
func (pb *Block) MinTime() int64 { return pb.meta.MinTime }

// MaxTime returns the max time of the meta.
func (pb *Block) MaxTime() int64 { return pb.meta.MaxTime }

// Size returns the number of bytes that the block takes up.
func (pb *Block) Size() int64 {
	return pb.numBytesChunks + pb.numBytesIndex + pb.numBytesTombstone + pb.numBytesMeta
}

// ErrClosing is returned when a block is in the process of being closed.
var ErrClosing = errors.New("block is closing")

func (pb *Block) startRead() error {
	pb.mtx.RLock()
	defer pb.mtx.RUnlock()

	if pb.closing {
		return ErrClosing
	}
	pb.pendingReaders.Add(1)
	return nil
}

// Index returns a new IndexReader against the block data.
func (pb *Block) Index() (IndexReader, error) {
	if err := pb.startRead(); err != nil {
		return nil, err
	}
	return blockIndexReader{ir: pb.indexr, b: pb}, nil
}

// Chunks returns a new ChunkReader against the block data.
func (pb *Block) Chunks() (ChunkReader, error) {
	if err := pb.startRead(); err != nil {
		return nil, err
	}
	return blockChunkReader{ChunkReader: pb.chunkr, b: pb}, nil
}

// Tombstones returns a new TombstoneReader against the block data.
func (pb *Block) Tombstones() (tombstones.Reader, error) {
	if err := pb.startRead(); err != nil {
		return nil, err
	}
	return blockTombstoneReader{Reader: pb.tombstones, b: pb}, nil
}

// GetSymbolTableSize returns the Symbol Table Size in the index of this block.
func (pb *Block) GetSymbolTableSize() uint64 {
	return pb.symbolTableSize
}

func (pb *Block) setCompactionFailed() error {
	pb.meta.Compaction.Failed = true
	n, err := writeMetaFile(pb.logger, pb.dir, &pb.meta)
	if err != nil {
		return err
	}
	pb.numBytesMeta = n
	return nil
}

type blockIndexReader struct {
	ir IndexReader
	b  *Block
}

func (r blockIndexReader) Symbols() index.StringIter {
	return r.ir.Symbols()
}

func (r blockIndexReader) SortedLabelValues(name string) ([]string, error) {
	st, err := r.ir.SortedLabelValues(name)
	return st, errors.Wrapf(err, "block: %s", r.b.Meta().ULID)
}

func (r blockIndexReader) LabelValues(name string) ([]string, error) {
	st, err := r.ir.LabelValues(name)
	return st, errors.Wrapf(err, "block: %s", r.b.Meta().ULID)
}

func (r blockIndexReader) Postings(name string, values ...string) (index.Postings, error) {
	p, err := r.ir.Postings(name, values...)
	if err != nil {
		return p, errors.Wrapf(err, "block: %s", r.b.Meta().ULID)
	}
	return p, nil
}

func (r blockIndexReader) SortedPostings(p index.Postings) index.Postings {
	return r.ir.SortedPostings(p)
}

func (r blockIndexReader) Series(ref uint64, lset *labels.Labels, chks *[]chunks.Meta) error {
	if err := r.ir.Series(ref, lset, chks); err != nil {
		return errors.Wrapf(err, "block: %s", r.b.Meta().ULID)
	}
	return nil
}

func (r blockIndexReader) LabelNames() ([]string, error) {
	return r.b.LabelNames()
}

func (r blockIndexReader) Close() error {
	r.b.pendingReaders.Done()
	return nil
}

type blockTombstoneReader struct {
	tombstones.Reader
	b *Block
}

func (r blockTombstoneReader) Close() error {
	r.b.pendingReaders.Done()
	return nil
}

type blockChunkReader struct {
	ChunkReader
	b *Block
}

func (r blockChunkReader) Close() error {
	r.b.pendingReaders.Done()
	return nil
}

// Delete matching series between mint and maxt in the block.
func (pb *Block) Delete(mint, maxt int64, ms ...*labels.Matcher) error {
	pb.mtx.Lock()
	defer pb.mtx.Unlock()

	if pb.closing {
		return ErrClosing
	}

	p, err := PostingsForMatchers(pb.indexr, ms...)
	if err != nil {
		return errors.Wrap(err, "select series")
	}

	ir := pb.indexr

	// Choose only valid postings which have chunks in the time-range.
	stones := tombstones.NewMemTombstones()

	var lset labels.Labels
	var chks []chunks.Meta

Outer:
	for p.Next() {
		err := ir.Series(p.At(), &lset, &chks)
		if err != nil {
			return err
		}

		for _, chk := range chks {
			if chk.OverlapsClosedInterval(mint, maxt) {
				// Delete only until the current values and not beyond.
				tmin, tmax := clampInterval(mint, maxt, chks[0].MinTime, chks[len(chks)-1].MaxTime)
				stones.AddInterval(p.At(), tombstones.Interval{Mint: tmin, Maxt: tmax})
				continue Outer
			}
		}
	}

	if p.Err() != nil {
		return p.Err()
	}

	err = pb.tombstones.Iter(func(id uint64, ivs tombstones.Intervals) error {
		for _, iv := range ivs {
			stones.AddInterval(id, iv)
		}
		return nil
	})
	if err != nil {
		return err
	}
	pb.tombstones = stones
	pb.meta.Stats.NumTombstones = pb.tombstones.Total()

	n, err := tombstones.WriteFile(pb.logger, pb.dir, pb.tombstones)
	if err != nil {
		return err
	}
	pb.numBytesTombstone = n
	n, err = writeMetaFile(pb.logger, pb.dir, &pb.meta)
	if err != nil {
		return err
	}
	pb.numBytesMeta = n
	return nil
}

// CleanTombstones will remove the tombstones and rewrite the block (only if there are any tombstones).
// If there was a rewrite, then it returns the ULID of the new block written, else nil.
func (pb *Block) CleanTombstones(dest string, c Compactor) (*ulid.ULID, error) {
	numStones := 0

	if err := pb.tombstones.Iter(func(id uint64, ivs tombstones.Intervals) error {
		numStones += len(ivs)
		return nil
	}); err != nil {
		// This should never happen, as the iteration function only returns nil.
		panic(err)
	}
	if numStones == 0 {
		return nil, nil
	}

	meta := pb.Meta()
	uid, err := c.Write(dest, pb, pb.meta.MinTime, pb.meta.MaxTime, &meta)
	if err != nil {
		return nil, err
	}
	return &uid, nil
}

// Snapshot creates snapshot of the block into dir.
func (pb *Block) Snapshot(dir string) error {
	blockDir := filepath.Join(dir, pb.meta.ULID.String())
	if err := os.MkdirAll(blockDir, 0777); err != nil {
		return errors.Wrap(err, "create snapshot block dir")
	}

	chunksDir := chunkDir(blockDir)
	if err := os.MkdirAll(chunksDir, 0777); err != nil {
		return errors.Wrap(err, "create snapshot chunk dir")
	}

	// Hardlink meta, index and tombstones
	for _, fname := range []string{
		metaFilename,
		indexFilename,
		tombstones.TombstonesFilename,
	} {
		if err := os.Link(filepath.Join(pb.dir, fname), filepath.Join(blockDir, fname)); err != nil {
			return errors.Wrapf(err, "create snapshot %s", fname)
		}
	}

	// Hardlink the chunks
	curChunkDir := chunkDir(pb.dir)
	files, err := ioutil.ReadDir(curChunkDir)
	if err != nil {
		return errors.Wrap(err, "ReadDir the current chunk dir")
	}

	for _, f := range files {
		err := os.Link(filepath.Join(curChunkDir, f.Name()), filepath.Join(chunksDir, f.Name()))
		if err != nil {
			return errors.Wrap(err, "hardlink a chunk")
		}
	}

	return nil
}

// OverlapsClosedInterval returns true if the block overlaps [mint, maxt].
func (pb *Block) OverlapsClosedInterval(mint, maxt int64) bool {
	// The block itself is a half-open interval
	// [pb.meta.MinTime, pb.meta.MaxTime).
	return pb.meta.MinTime <= maxt && mint < pb.meta.MaxTime
}

// LabelNames returns all the unique label names present in the Block in sorted order.
func (pb *Block) LabelNames() ([]string, error) {
	return pb.indexr.LabelNames()
}

func clampInterval(a, b, mint, maxt int64) (int64, int64) {
	if a < mint {
		a = mint
	}
	if b > maxt {
		b = maxt
	}
	return a, b
}
