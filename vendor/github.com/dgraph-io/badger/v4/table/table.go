/*
 * SPDX-FileCopyrightText: © Hypermode Inc. <hello@hypermode.com>
 * SPDX-License-Identifier: Apache-2.0
 */

package table

import (
	"bytes"
	"crypto/aes"
	"encoding/binary"
	"errors"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
	"unsafe"

	"github.com/klauspost/compress/snappy"
	"github.com/klauspost/compress/zstd"
	"google.golang.org/protobuf/proto"

	"github.com/dgraph-io/badger/v4/fb"
	"github.com/dgraph-io/badger/v4/options"
	"github.com/dgraph-io/badger/v4/pb"
	"github.com/dgraph-io/badger/v4/y"
	"github.com/dgraph-io/ristretto/v2"
	"github.com/dgraph-io/ristretto/v2/z"
)

const fileSuffix = ".sst"
const intSize = int(unsafe.Sizeof(int(0)))

// Options contains configurable options for Table/Builder.
type Options struct {
	// Options for Opening/Building Table.

	// Open tables in read only mode.
	ReadOnly       bool
	MetricsEnabled bool

	// Maximum size of the table.
	TableSize     uint64
	tableCapacity uint64 // 0.9x TableSize.

	// ChkMode is the checksum verification mode for Table.
	ChkMode options.ChecksumVerificationMode

	// Options for Table builder.

	// BloomFalsePositive is the false positive probabiltiy of bloom filter.
	BloomFalsePositive float64

	// BlockSize is the size of each block inside SSTable in bytes.
	BlockSize int

	// DataKey is the key used to decrypt the encrypted text.
	DataKey *pb.DataKey

	// Compression indicates the compression algorithm used for block compression.
	Compression options.CompressionType

	// Block cache is used to cache decompressed and decrypted blocks.
	BlockCache *ristretto.Cache[[]byte, *Block]
	IndexCache *ristretto.Cache[uint64, *fb.TableIndex]

	AllocPool *z.AllocatorPool

	// ZSTDCompressionLevel is the ZSTD compression level used for compressing blocks.
	ZSTDCompressionLevel int
}

// TableInterface is useful for testing.
type TableInterface interface {
	Smallest() []byte
	Biggest() []byte
	DoesNotHave(hash uint32) bool
	MaxVersion() uint64
}

// Table represents a loaded table file with the info we have about it.
type Table struct {
	sync.Mutex
	*z.MmapFile

	tableSize int // Initialized in OpenTable, using fd.Stat().

	_index *fb.TableIndex // Nil if encryption is enabled. Use fetchIndex to access.
	_cheap *cheapIndex
	ref    atomic.Int32 // For file garbage collection

	// The following are initialized once and const.
	smallest, biggest []byte // Smallest and largest keys (with timestamps).
	id                uint64 // file id, part of filename

	Checksum       []byte
	CreatedAt      time.Time
	indexStart     int
	indexLen       int
	hasBloomFilter bool

	IsInmemory bool // Set to true if the table is on level 0 and opened in memory.
	opt        *Options
}

type cheapIndex struct {
	MaxVersion        uint64
	KeyCount          uint32
	UncompressedSize  uint32
	OnDiskSize        uint32
	BloomFilterLength int
	OffsetsLength     int
}

func (t *Table) cheapIndex() *cheapIndex {
	return t._cheap
}
func (t *Table) offsetsLength() int { return t.cheapIndex().OffsetsLength }

// MaxVersion returns the maximum version across all keys stored in this table.
func (t *Table) MaxVersion() uint64 { return t.cheapIndex().MaxVersion }

// BloomFilterSize returns the size of the bloom filter in bytes stored in memory.
func (t *Table) BloomFilterSize() int { return t.cheapIndex().BloomFilterLength }

// UncompressedSize is the size uncompressed data stored in this file.
func (t *Table) UncompressedSize() uint32 { return t.cheapIndex().UncompressedSize }

// KeyCount is the total number of keys in this table.
func (t *Table) KeyCount() uint32 { return t.cheapIndex().KeyCount }

// OnDiskSize returns the total size of key-values stored in this table (including the
// disk space occupied on the value log).
func (t *Table) OnDiskSize() uint32 { return t.cheapIndex().OnDiskSize }

// CompressionType returns the compression algorithm used for block compression.
func (t *Table) CompressionType() options.CompressionType {
	return t.opt.Compression
}

// IncrRef increments the refcount (having to do with whether the file should be deleted)
func (t *Table) IncrRef() {
	t.ref.Add(1)
}

// DecrRef decrements the refcount and possibly deletes the table
func (t *Table) DecrRef() error {
	newRef := t.ref.Add(-1)
	if newRef == 0 {
		// We can safely delete this file, because for all the current files, we always have
		// at least one reference pointing to them.

		// Delete all blocks from the cache.
		for i := 0; i < t.offsetsLength(); i++ {
			t.opt.BlockCache.Del(t.blockCacheKey(i))
		}
		if err := t.Delete(); err != nil {
			return err
		}
	}
	return nil
}

// BlockEvictHandler is used to reuse the byte slice stored in the block on cache eviction.
func BlockEvictHandler(b *Block) {
	b.decrRef()
}

type Block struct {
	offset            int
	data              []byte
	checksum          []byte
	entriesIndexStart int      // start index of entryOffsets list
	entryOffsets      []uint32 // used to binary search an entry in the block.
	chkLen            int      // checksum length.
	freeMe            bool     // used to determine if the blocked should be reused.
	ref               atomic.Int32
}

var NumBlocks atomic.Int32

// incrRef increments the ref of a block and return a bool indicating if the
// increment was successful. A true value indicates that the block can be used.
func (b *Block) incrRef() bool {
	for {
		// We can't blindly add 1 to ref. We need to check whether it has
		// reached zero first, because if it did, then we should absolutely not
		// use this block.
		ref := b.ref.Load()
		// The ref would not be equal to 0 unless the existing
		// block get evicted before this line. If the ref is zero, it means that
		// the block is already added the the blockPool and cannot be used
		// anymore. The ref of a new block is 1 so the following condition will
		// be true only if the block got reused before we could increment its
		// ref.
		if ref == 0 {
			return false
		}
		// Increment the ref only if it is not zero and has not changed between
		// the time we read it and we're updating it.
		//
		if b.ref.CompareAndSwap(ref, ref+1) {
			return true
		}
	}
}
func (b *Block) decrRef() {
	if b == nil {
		return
	}

	// Insert the []byte into pool only if the block is resuable. When a block
	// is reusable a new []byte is used for decompression and this []byte can
	// be reused.
	// In case of an uncompressed block, the []byte is a reference to the
	// table.mmap []byte slice. Any attempt to write data to the mmap []byte
	// will lead to SEGFAULT.
	if b.ref.Add(-1) == 0 {
		if b.freeMe {
			z.Free(b.data)
		}
		NumBlocks.Add(-1)
		// blockPool.Put(&b.data)
	}
	y.AssertTrue(b.ref.Load() >= 0)
}
func (b *Block) size() int64 {
	return int64(3*intSize /* Size of the offset, entriesIndexStart and chkLen */ +
		cap(b.data) + cap(b.checksum) + cap(b.entryOffsets)*4)
}

func (b *Block) verifyCheckSum() error {
	cs := &pb.Checksum{}
	if err := proto.Unmarshal(b.checksum, cs); err != nil {
		return y.Wrapf(err, "unable to unmarshal checksum for block")
	}
	return y.VerifyChecksum(b.data, cs)
}

func CreateTable(fname string, builder *Builder) (*Table, error) {
	bd := builder.Done()
	mf, err := z.OpenMmapFile(fname, os.O_CREATE|os.O_RDWR|os.O_EXCL, bd.Size)
	if err == z.NewFile {
		// Expected.
	} else if err != nil {
		return nil, y.Wrapf(err, "while creating table: %s", fname)
	} else {
		return nil, fmt.Errorf("file already exists: %s", fname)
	}

	written := bd.Copy(mf.Data)
	y.AssertTrue(written == len(mf.Data))
	if err := z.Msync(mf.Data); err != nil {
		return nil, y.Wrapf(err, "while calling msync on %s", fname)
	}
	return OpenTable(mf, *builder.opts)
}

// OpenTable assumes file has only one table and opens it. Takes ownership of fd upon function
// entry. Returns a table with one reference count on it (decrementing which may delete the file!
// -- consider t.Close() instead). The fd has to writeable because we call Truncate on it before
// deleting. Checksum for all blocks of table is verified based on value of chkMode.
func OpenTable(mf *z.MmapFile, opts Options) (*Table, error) {
	// BlockSize is used to compute the approximate size of the decompressed
	// block. It should not be zero if the table is compressed.
	if opts.BlockSize == 0 && opts.Compression != options.None {
		return nil, errors.New("Block size cannot be zero")
	}
	fileInfo, err := mf.Fd.Stat()
	if err != nil {
		mf.Close(-1)
		return nil, y.Wrap(err, "")
	}

	filename := fileInfo.Name()
	id, ok := ParseFileID(filename)
	if !ok {
		mf.Close(-1)
		return nil, fmt.Errorf("Invalid filename: %s", filename)
	}
	t := &Table{
		MmapFile:   mf,
		id:         id,
		opt:        &opts,
		IsInmemory: false,
		tableSize:  int(fileInfo.Size()),
		CreatedAt:  fileInfo.ModTime(),
	}
	// Caller is given one reference.
	t.ref.Store(1)

	if err := t.initBiggestAndSmallest(); err != nil {
		return nil, y.Wrapf(err, "failed to initialize table")
	}

	if opts.ChkMode == options.OnTableRead || opts.ChkMode == options.OnTableAndBlockRead {
		if err := t.VerifyChecksum(); err != nil {
			mf.Close(-1)
			return nil, y.Wrapf(err, "failed to verify checksum")
		}
	}

	return t, nil
}

// OpenInMemoryTable is similar to OpenTable but it opens a new table from the provided data.
// OpenInMemoryTable is used for L0 tables.
func OpenInMemoryTable(data []byte, id uint64, opt *Options) (*Table, error) {
	mf := &z.MmapFile{
		Data: data,
		Fd:   nil,
	}
	t := &Table{
		MmapFile:   mf,
		opt:        opt,
		tableSize:  len(data),
		IsInmemory: true,
		id:         id, // It is important that each table gets a unique ID.
	}
	// Caller is given one reference.
	t.ref.Store(1)

	if err := t.initBiggestAndSmallest(); err != nil {
		return nil, err
	}
	return t, nil
}

func (t *Table) initBiggestAndSmallest() error {
	// This defer will help gathering debugging info incase initIndex crashes.
	defer func() {
		if r := recover(); r != nil {
			// Use defer for printing info because there may be an intermediate panic.
			var debugBuf bytes.Buffer
			defer func() {
				panic(fmt.Sprintf("%s\n== Recovered ==\n", debugBuf.String()))
			}()

			// Get the count of null bytes at the end of file. This is to make sure if there was an
			// issue with mmap sync or file copy.
			count := 0
			for i := len(t.Data) - 1; i >= 0; i-- {
				if t.Data[i] != 0 {
					break
				}
				count++
			}

			fmt.Fprintf(&debugBuf, "\n== Recovering from initIndex crash ==\n")
			fmt.Fprintf(&debugBuf, "File Info: [ID: %d, Size: %d, Zeros: %d]\n",
				t.id, t.tableSize, count)

			fmt.Fprintf(&debugBuf, "isEnrypted: %v ", t.shouldDecrypt())

			readPos := t.tableSize

			// Read checksum size.
			readPos -= 4
			buf := t.readNoFail(readPos, 4)
			checksumLen := int(y.BytesToU32(buf))
			fmt.Fprintf(&debugBuf, "checksumLen: %d ", checksumLen)

			// Read checksum.
			checksum := &pb.Checksum{}
			readPos -= checksumLen
			buf = t.readNoFail(readPos, checksumLen)
			_ = proto.Unmarshal(buf, checksum)
			fmt.Fprintf(&debugBuf, "checksum: %+v ", checksum)

			// Read index size from the footer.
			readPos -= 4
			buf = t.readNoFail(readPos, 4)
			indexLen := int(y.BytesToU32(buf))
			fmt.Fprintf(&debugBuf, "indexLen: %d ", indexLen)

			// Read index.
			readPos -= t.indexLen
			t.indexStart = readPos
			indexData := t.readNoFail(readPos, t.indexLen)
			fmt.Fprintf(&debugBuf, "index: %v ", indexData)
		}
	}()

	var err error
	var ko *fb.BlockOffset
	if ko, err = t.initIndex(); err != nil {
		return y.Wrapf(err, "failed to read index.")
	}

	t.smallest = y.Copy(ko.KeyBytes())

	it2 := t.NewIterator(REVERSED | NOCACHE)
	defer it2.Close()
	it2.Rewind()
	if !it2.Valid() {
		return y.Wrapf(it2.err, "failed to initialize biggest for table %s", t.Filename())
	}
	t.biggest = y.Copy(it2.Key())
	return nil
}

func (t *Table) read(off, sz int) ([]byte, error) {
	return t.Bytes(off, sz)
}

func (t *Table) readNoFail(off, sz int) []byte {
	res, err := t.read(off, sz)
	y.Check(err)
	return res
}

// initIndex reads the index and populate the necessary table fields and returns
// first block offset
func (t *Table) initIndex() (*fb.BlockOffset, error) {
	readPos := t.tableSize

	// Read checksum len from the last 4 bytes.
	readPos -= 4
	buf := t.readNoFail(readPos, 4)
	checksumLen := int(y.BytesToU32(buf))
	if checksumLen < 0 {
		return nil, errors.New("checksum length less than zero. Data corrupted")
	}

	// Read checksum.
	expectedChk := &pb.Checksum{}
	readPos -= checksumLen
	buf = t.readNoFail(readPos, checksumLen)
	if err := proto.Unmarshal(buf, expectedChk); err != nil {
		return nil, err
	}

	// Read index size from the footer.
	readPos -= 4
	buf = t.readNoFail(readPos, 4)
	t.indexLen = int(y.BytesToU32(buf))

	// Read index.
	readPos -= t.indexLen
	t.indexStart = readPos
	data := t.readNoFail(readPos, t.indexLen)

	if err := y.VerifyChecksum(data, expectedChk); err != nil {
		return nil, y.Wrapf(err, "failed to verify checksum for table: %s", t.Filename())
	}

	index, err := t.readTableIndex()
	if err != nil {
		return nil, err
	}
	if !t.shouldDecrypt() {
		// If there's no encryption, this points to the mmap'ed buffer.
		t._index = index
	}
	t._cheap = &cheapIndex{
		MaxVersion:        index.MaxVersion(),
		KeyCount:          index.KeyCount(),
		UncompressedSize:  index.UncompressedSize(),
		OnDiskSize:        index.OnDiskSize(),
		OffsetsLength:     index.OffsetsLength(),
		BloomFilterLength: index.BloomFilterLength(),
	}

	t.hasBloomFilter = len(index.BloomFilterBytes()) > 0

	var bo fb.BlockOffset
	y.AssertTrue(index.Offsets(&bo, 0))
	return &bo, nil
}

// KeySplits splits the table into at least n ranges based on the block offsets.
func (t *Table) KeySplits(n int, prefix []byte) []string {
	if n == 0 {
		return nil
	}

	oLen := t.offsetsLength()
	jump := oLen / n
	if jump == 0 {
		jump = 1
	}

	var bo fb.BlockOffset
	var res []string
	for i := 0; i < oLen; i += jump {
		if i >= oLen {
			i = oLen - 1
		}
		y.AssertTrue(t.offsets(&bo, i))
		if bytes.HasPrefix(bo.KeyBytes(), prefix) {
			res = append(res, string(bo.KeyBytes()))
		}
	}
	return res
}

func (t *Table) fetchIndex() *fb.TableIndex {
	if !t.shouldDecrypt() {
		return t._index
	}

	if t.opt.IndexCache == nil {
		panic("Index Cache must be set for encrypted workloads")
	}
	if val, ok := t.opt.IndexCache.Get(t.indexKey()); ok && val != nil {
		return val
	}

	index, err := t.readTableIndex()
	y.Check(err)
	t.opt.IndexCache.Set(t.indexKey(), index, int64(t.indexLen))
	return index
}

func (t *Table) offsets(ko *fb.BlockOffset, i int) bool {
	return t.fetchIndex().Offsets(ko, i)
}

// block function return a new block. Each block holds a ref and the byte
// slice stored in the block will be reused when the ref becomes zero. The
// caller should release the block by calling block.decrRef() on it.
func (t *Table) block(idx int, useCache bool) (*Block, error) {
	y.AssertTruef(idx >= 0, "idx=%d", idx)
	if idx >= t.offsetsLength() {
		return nil, errors.New("block out of index")
	}
	if t.opt.BlockCache != nil {
		key := t.blockCacheKey(idx)
		blk, ok := t.opt.BlockCache.Get(key)
		if ok && blk != nil {
			// Use the block only if the increment was successful. The block
			// could get evicted from the cache between the Get() call and the
			// incrRef() call.
			if blk.incrRef() {
				return blk, nil
			}
		}
	}

	var ko fb.BlockOffset
	y.AssertTrue(t.offsets(&ko, idx))
	blk := &Block{offset: int(ko.Offset())}
	blk.ref.Store(1)
	defer blk.decrRef() // Deal with any errors, where blk would not be returned.
	NumBlocks.Add(1)

	var err error
	if blk.data, err = t.read(blk.offset, int(ko.Len())); err != nil {
		return nil, y.Wrapf(err,
			"failed to read from file: %s at offset: %d, len: %d",
			t.Fd.Name(), blk.offset, ko.Len())
	}

	if t.shouldDecrypt() {
		// Decrypt the block if it is encrypted.
		if blk.data, err = t.decrypt(blk.data, true); err != nil {
			return nil, err
		}
		// blk.data is allocated via Calloc. So, do free.
		blk.freeMe = true
	}

	if err = t.decompress(blk); err != nil {
		return nil, y.Wrapf(err,
			"failed to decode compressed data in file: %s at offset: %d, len: %d",
			t.Fd.Name(), blk.offset, ko.Len())
	}

	// Read meta data related to block.
	readPos := len(blk.data) - 4 // First read checksum length.
	blk.chkLen = int(y.BytesToU32(blk.data[readPos : readPos+4]))

	// Checksum length greater than block size could happen if the table was compressed and
	// it was opened with an incorrect compression algorithm (or the data was corrupted).
	if blk.chkLen > len(blk.data) {
		return nil, errors.New("invalid checksum length. Either the data is " +
			"corrupted or the table options are incorrectly set")
	}

	// Read checksum and store it
	readPos -= blk.chkLen
	blk.checksum = blk.data[readPos : readPos+blk.chkLen]
	// Move back and read numEntries in the block.
	readPos -= 4
	numEntries := int(y.BytesToU32(blk.data[readPos : readPos+4]))
	entriesIndexStart := readPos - (numEntries * 4)
	entriesIndexEnd := entriesIndexStart + numEntries*4

	blk.entryOffsets = y.BytesToU32Slice(blk.data[entriesIndexStart:entriesIndexEnd])

	blk.entriesIndexStart = entriesIndexStart

	// Drop checksum and checksum length.
	// The checksum is calculated for actual data + entry index + index length
	blk.data = blk.data[:readPos+4]

	// Verify checksum on if checksum verification mode is OnRead on OnStartAndRead.
	if t.opt.ChkMode == options.OnBlockRead || t.opt.ChkMode == options.OnTableAndBlockRead {
		if err = blk.verifyCheckSum(); err != nil {
			return nil, err
		}
	}

	blk.incrRef()
	if useCache && t.opt.BlockCache != nil {
		key := t.blockCacheKey(idx)
		// incrRef should never return false here because we're calling it on a
		// new block with ref=1.
		y.AssertTrue(blk.incrRef())

		// Decrement the block ref if we could not insert it in the cache.
		if !t.opt.BlockCache.Set(key, blk, blk.size()) {
			blk.decrRef()
		}
		// We have added an OnReject func in our cache, which gets called in case the block is not
		// admitted to the cache. So, every block would be accounted for.
	}
	return blk, nil
}

// blockCacheKey is used to store blocks in the block cache.
func (t *Table) blockCacheKey(idx int) []byte {
	y.AssertTrue(t.id < math.MaxUint32)
	y.AssertTrue(uint32(idx) < math.MaxUint32)

	buf := make([]byte, 8)
	// Assume t.ID does not overflow uint32.
	binary.BigEndian.PutUint32(buf[:4], uint32(t.ID()))
	binary.BigEndian.PutUint32(buf[4:], uint32(idx))
	return buf
}

// indexKey returns the cache key for block offsets. blockOffsets
// are stored in the index cache.
func (t *Table) indexKey() uint64 {
	return t.id
}

// IndexSize is the size of table index in bytes.
func (t *Table) IndexSize() int {
	return t.indexLen
}

// Size is its file size in bytes
func (t *Table) Size() int64 { return int64(t.tableSize) }

// StaleDataSize is the amount of stale data (that can be dropped by a compaction )in this SST.
func (t *Table) StaleDataSize() uint32 { return t.fetchIndex().StaleDataSize() }

// Smallest is its smallest key, or nil if there are none
func (t *Table) Smallest() []byte { return t.smallest }

// Biggest is its biggest key, or nil if there are none
func (t *Table) Biggest() []byte { return t.biggest }

// Filename is NOT the file name.  Just kidding, it is.
func (t *Table) Filename() string { return t.Fd.Name() }

// ID is the table's ID number (used to make the file name).
func (t *Table) ID() uint64 { return t.id }

// DoesNotHave returns true if and only if the table does not have the key hash.
// It does a bloom filter lookup.
func (t *Table) DoesNotHave(hash uint32) bool {
	if !t.hasBloomFilter {
		return false
	}

	y.NumLSMBloomHitsAdd(t.opt.MetricsEnabled, "DoesNotHave_ALL", 1)
	index := t.fetchIndex()
	bf := index.BloomFilterBytes()
	mayContain := y.Filter(bf).MayContain(hash)
	if !mayContain {
		y.NumLSMBloomHitsAdd(t.opt.MetricsEnabled, "DoesNotHave_HIT", 1)
	}
	return !mayContain
}

// readTableIndex reads table index from the sst and returns its pb format.
func (t *Table) readTableIndex() (*fb.TableIndex, error) {
	data := t.readNoFail(t.indexStart, t.indexLen)
	var err error
	// Decrypt the table index if it is encrypted.
	if t.shouldDecrypt() {
		if data, err = t.decrypt(data, false); err != nil {
			return nil, y.Wrapf(err,
				"Error while decrypting table index for the table %d in readTableIndex", t.id)
		}
	}
	return fb.GetRootAsTableIndex(data, 0), nil
}

// VerifyChecksum verifies checksum for all blocks of table. This function is called by
// OpenTable() function. This function is also called inside levelsController.VerifyChecksum().
func (t *Table) VerifyChecksum() error {
	ti := t.fetchIndex()
	for i := 0; i < ti.OffsetsLength(); i++ {
		b, err := t.block(i, true)
		if err != nil {
			return y.Wrapf(err, "checksum validation failed for table: %s, block: %d, offset:%d",
				t.Filename(), i, b.offset)
		}
		// We should not call incrRef here, because the block already has one ref when created.
		defer b.decrRef()
		// OnBlockRead or OnTableAndBlockRead, we don't need to call verify checksum
		// on block, verification would be done while reading block itself.
		if !(t.opt.ChkMode == options.OnBlockRead || t.opt.ChkMode == options.OnTableAndBlockRead) {
			if err = b.verifyCheckSum(); err != nil {
				return y.Wrapf(err,
					"checksum validation failed for table: %s, block: %d, offset:%d",
					t.Filename(), i, b.offset)
			}
		}
	}
	return nil
}

// shouldDecrypt tells whether to decrypt or not. We decrypt only if the datakey exist
// for the table.
func (t *Table) shouldDecrypt() bool {
	return t.opt.DataKey != nil
}

// KeyID returns data key id.
func (t *Table) KeyID() uint64 {
	if t.opt.DataKey != nil {
		return t.opt.DataKey.KeyId
	}
	// By default it's 0, if it is plain text.
	return 0
}

// decrypt decrypts the given data. It should be called only after checking shouldDecrypt.
func (t *Table) decrypt(data []byte, viaCalloc bool) ([]byte, error) {
	// Last BlockSize bytes of the data is the IV.
	iv := data[len(data)-aes.BlockSize:]
	// Rest all bytes are data.
	data = data[:len(data)-aes.BlockSize]

	var dst []byte
	if viaCalloc {
		dst = z.Calloc(len(data), "Table.Decrypt")
	} else {
		dst = make([]byte, len(data))
	}
	if err := y.XORBlock(dst, data, t.opt.DataKey.Data, iv); err != nil {
		return nil, y.Wrapf(err, "while decrypt")
	}
	return dst, nil
}

// ParseFileID reads the file id out of a filename.
func ParseFileID(name string) (uint64, bool) {
	name = filepath.Base(name)
	if !strings.HasSuffix(name, fileSuffix) {
		return 0, false
	}
	//	suffix := name[len(fileSuffix):]
	name = strings.TrimSuffix(name, fileSuffix)
	id, err := strconv.Atoi(name)
	if err != nil {
		return 0, false
	}
	y.AssertTrue(id >= 0)
	return uint64(id), true
}

// IDToFilename does the inverse of ParseFileID
func IDToFilename(id uint64) string {
	return fmt.Sprintf("%06d", id) + fileSuffix
}

// NewFilename should be named TableFilepath -- it combines the dir with the ID to make a table
// filepath.
func NewFilename(id uint64, dir string) string {
	return filepath.Join(dir, IDToFilename(id))
}

// decompress decompresses the data stored in a block.
func (t *Table) decompress(b *Block) error {
	var dst []byte
	var err error

	// Point to the original b.data
	src := b.data

	switch t.opt.Compression {
	case options.None:
		// Nothing to be done here.
		return nil
	case options.Snappy:
		if sz, err := snappy.DecodedLen(b.data); err == nil {
			dst = z.Calloc(sz, "Table.Decompress")
		} else {
			dst = z.Calloc(len(b.data)*4, "Table.Decompress") // Take a guess.
		}
		b.data, err = snappy.Decode(dst, b.data)
		if err != nil {
			z.Free(dst)
			return y.Wrap(err, "failed to decompress")
		}
	case options.ZSTD:
		sz := int(float64(t.opt.BlockSize) * 1.2)
		// Get frame content size from header.
		var hdr zstd.Header
		if err := hdr.Decode(b.data); err == nil && hdr.HasFCS && hdr.FrameContentSize < uint64(t.opt.BlockSize*2) {
			sz = int(hdr.FrameContentSize)
		}
		dst = z.Calloc(sz, "Table.Decompress")
		b.data, err = y.ZSTDDecompress(dst, b.data)
		if err != nil {
			z.Free(dst)
			return y.Wrap(err, "failed to decompress")
		}
	default:
		return errors.New("Unsupported compression type")
	}

	if b.freeMe {
		z.Free(src)
		b.freeMe = false
	}

	if len(b.data) > 0 && len(dst) > 0 && &dst[0] != &b.data[0] {
		z.Free(dst)
	} else {
		b.freeMe = true
	}
	return nil
}
