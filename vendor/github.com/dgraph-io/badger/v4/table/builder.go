/*
 * SPDX-FileCopyrightText: © Hypermode Inc. <hello@hypermode.com>
 * SPDX-License-Identifier: Apache-2.0
 */

package table

import (
	"crypto/aes"
	"errors"
	"math"
	"runtime"
	"sync"
	"sync/atomic"
	"unsafe"

	fbs "github.com/google/flatbuffers/go"
	"github.com/klauspost/compress/s2"
	"google.golang.org/protobuf/proto"

	"github.com/dgraph-io/badger/v4/fb"
	"github.com/dgraph-io/badger/v4/options"
	"github.com/dgraph-io/badger/v4/pb"
	"github.com/dgraph-io/badger/v4/y"
	"github.com/dgraph-io/ristretto/v2/z"
)

const (
	KB = 1024
	MB = KB * 1024

	// When a block is encrypted, it's length increases. We add 256 bytes of padding to
	// handle cases when block size increases. This is an approximate number.
	padding = 256
)

type header struct {
	overlap uint16 // Overlap with base key.
	diff    uint16 // Length of the diff.
}

const headerSize = uint16(unsafe.Sizeof(header{}))

// Encode encodes the header.
func (h header) Encode() []byte {
	var b [4]byte
	*(*header)(unsafe.Pointer(&b[0])) = h
	return b[:]
}

// Decode decodes the header.
func (h *header) Decode(buf []byte) {
	// Copy over data from buf into h. Using *h=unsafe.pointer(...) leads to
	// pointer alignment issues. See https://github.com/hypermodeinc/badger/issues/1096
	// and comment https://github.com/hypermodeinc/badger/pull/1097#pullrequestreview-307361714
	copy(((*[headerSize]byte)(unsafe.Pointer(h))[:]), buf[:headerSize])
}

// bblock represents a block that is being compressed/encrypted in the background.
type bblock struct {
	data         []byte
	baseKey      []byte   // Base key for the current block.
	entryOffsets []uint32 // Offsets of entries present in current block.
	end          int      // Points to the end offset of the block.
}

// Builder is used in building a table.
type Builder struct {
	// Typically tens or hundreds of meg. This is for one single file.
	alloc            *z.Allocator
	curBlock         *bblock
	compressedSize   atomic.Uint32
	uncompressedSize atomic.Uint32

	lenOffsets    uint32
	keyHashes     []uint32 // Used for building the bloomfilter.
	opts          *Options
	maxVersion    uint64
	onDiskSize    uint32
	staleDataSize int

	// Used to concurrently compress/encrypt blocks.
	wg        sync.WaitGroup
	blockChan chan *bblock
	blockList []*bblock
}

func (b *Builder) allocate(need int) []byte {
	bb := b.curBlock
	if len(bb.data[bb.end:]) < need {
		// We need to reallocate. 1GB is the max size that the allocator can allocate.
		// While reallocating, if doubling exceeds that limit, then put the upper bound on it.
		sz := 2 * len(bb.data)
		if sz > (1 << 30) {
			sz = 1 << 30
		}
		if bb.end+need > sz {
			sz = bb.end + need
		}
		tmp := b.alloc.Allocate(sz)
		copy(tmp, bb.data)
		bb.data = tmp
	}
	bb.end += need
	return bb.data[bb.end-need : bb.end]
}

// append appends to curBlock.data
func (b *Builder) append(data []byte) {
	dst := b.allocate(len(data))
	y.AssertTrue(len(data) == copy(dst, data))
}

const maxAllocatorInitialSz = 256 << 20

// NewTableBuilder makes a new TableBuilder.
func NewTableBuilder(opts Options) *Builder {
	sz := 2 * int(opts.TableSize)
	if sz > maxAllocatorInitialSz {
		sz = maxAllocatorInitialSz
	}
	b := &Builder{
		alloc: opts.AllocPool.Get(sz, "TableBuilder"),
		opts:  &opts,
	}
	b.alloc.Tag = "Builder"
	b.curBlock = &bblock{
		data: b.alloc.Allocate(opts.BlockSize + padding),
	}
	b.opts.tableCapacity = uint64(float64(b.opts.TableSize) * 0.95)

	// If encryption or compression is not enabled, do not start compression/encryption goroutines
	// and write directly to the buffer.
	if b.opts.Compression == options.None && b.opts.DataKey == nil {
		return b
	}

	count := 2 * runtime.NumCPU()
	b.blockChan = make(chan *bblock, count*2)

	b.wg.Add(count)
	for i := 0; i < count; i++ {
		go b.handleBlock()
	}
	return b
}

func maxEncodedLen(ctype options.CompressionType, sz int) int {
	switch ctype {
	case options.Snappy:
		return s2.MaxEncodedLen(sz)
	case options.ZSTD:
		return y.ZSTDCompressBound(sz)
	}
	return sz
}

func (b *Builder) handleBlock() {
	defer b.wg.Done()

	doCompress := b.opts.Compression != options.None
	for item := range b.blockChan {
		// Extract the block.
		blockBuf := item.data[:item.end]
		// Compress the block.
		if doCompress {
			out, err := b.compressData(blockBuf)
			y.Check(err)
			blockBuf = out
		}
		if b.shouldEncrypt() {
			out, err := b.encrypt(blockBuf)
			y.Check(y.Wrapf(err, "Error while encrypting block in table builder."))
			blockBuf = out
		}

		// BlockBuf should always less than or equal to allocated space. If the blockBuf is greater
		// than allocated space that means the data from this block cannot be stored in its
		// existing location.
		allocatedSpace := maxEncodedLen(b.opts.Compression, (item.end)) + padding + 1
		y.AssertTrue(len(blockBuf) <= allocatedSpace)

		// blockBuf was allocated on allocator. So, we don't need to copy it over.
		item.data = blockBuf
		item.end = len(blockBuf)
		b.compressedSize.Add(uint32(len(blockBuf)))
	}
}

// Close closes the TableBuilder.
func (b *Builder) Close() {
	b.opts.AllocPool.Return(b.alloc)
}

// Empty returns whether it's empty.
func (b *Builder) Empty() bool { return len(b.keyHashes) == 0 }

// keyDiff returns a suffix of newKey that is different from b.baseKey.
func (b *Builder) keyDiff(newKey []byte) []byte {
	var i int
	for i = 0; i < len(newKey) && i < len(b.curBlock.baseKey); i++ {
		if newKey[i] != b.curBlock.baseKey[i] {
			break
		}
	}
	return newKey[i:]
}

func (b *Builder) addHelper(key []byte, v y.ValueStruct, vpLen uint32) {
	b.keyHashes = append(b.keyHashes, y.Hash(y.ParseKey(key)))

	if version := y.ParseTs(key); version > b.maxVersion {
		b.maxVersion = version
	}

	// diffKey stores the difference of key with baseKey.
	var diffKey []byte
	if len(b.curBlock.baseKey) == 0 {
		// Make a copy. Builder should not keep references. Otherwise, caller has to be very careful
		// and will have to make copies of keys every time they add to builder, which is even worse.
		b.curBlock.baseKey = append(b.curBlock.baseKey[:0], key...)
		diffKey = key
	} else {
		diffKey = b.keyDiff(key)
	}

	y.AssertTrue(len(key)-len(diffKey) <= math.MaxUint16)
	y.AssertTrue(len(diffKey) <= math.MaxUint16)

	h := header{
		overlap: uint16(len(key) - len(diffKey)),
		diff:    uint16(len(diffKey)),
	}

	// store current entry's offset
	b.curBlock.entryOffsets = append(b.curBlock.entryOffsets, uint32(b.curBlock.end))

	// Layout: header, diffKey, value.
	b.append(h.Encode())
	b.append(diffKey)

	dst := b.allocate(int(v.EncodedSize()))
	v.Encode(dst)

	// Add the vpLen to the onDisk size. We'll add the size of the block to
	// onDisk size in Finish() function.
	b.onDiskSize += vpLen
}

/*
Structure of Block.
+-------------------+---------------------+--------------------+--------------+------------------+
| Entry1            | Entry2              | Entry3             | Entry4       | Entry5           |
+-------------------+---------------------+--------------------+--------------+------------------+
| Entry6            | ...                 | ...                | ...          | EntryN           |
+-------------------+---------------------+--------------------+--------------+------------------+
| Block Meta(contains list of offsets used| Block Meta Size    | Block        | Checksum Size    |
| to perform binary search in the block)  | (4 Bytes)          | Checksum     | (4 Bytes)        |
+-----------------------------------------+--------------------+--------------+------------------+
*/
// In case the data is encrypted, the "IV" is added to the end of the block.
func (b *Builder) finishBlock() {
	if len(b.curBlock.entryOffsets) == 0 {
		return
	}
	// Append the entryOffsets and its length.
	b.append(y.U32SliceToBytes(b.curBlock.entryOffsets))
	b.append(y.U32ToBytes(uint32(len(b.curBlock.entryOffsets))))

	checksum := b.calculateChecksum(b.curBlock.data[:b.curBlock.end])

	// Append the block checksum and its length.
	b.append(checksum)
	b.append(y.U32ToBytes(uint32(len(checksum))))

	b.blockList = append(b.blockList, b.curBlock)
	b.uncompressedSize.Add(uint32(b.curBlock.end))

	// Add length of baseKey (rounded to next multiple of 4 because of alignment).
	// Add another 40 Bytes, these additional 40 bytes consists of
	// 12 bytes of metadata of flatbuffer
	// 8 bytes for Key in flat buffer
	// 8 bytes for offset
	// 8 bytes for the len
	// 4 bytes for the size of slice while SliceAllocate
	b.lenOffsets += uint32(int(math.Ceil(float64(len(b.curBlock.baseKey))/4))*4) + 40

	// If compression/encryption is enabled, we need to send the block to the blockChan.
	if b.blockChan != nil {
		b.blockChan <- b.curBlock
	}
}

func (b *Builder) shouldFinishBlock(key []byte, value y.ValueStruct) bool {
	// If there is no entry till now, we will return false.
	if len(b.curBlock.entryOffsets) <= 0 {
		return false
	}

	// Integer overflow check for statements below.
	y.AssertTrue((uint32(len(b.curBlock.entryOffsets))+1)*4+4+8+4 < math.MaxUint32)
	// We should include current entry also in size, that's why +1 to len(b.entryOffsets).
	entriesOffsetsSize := uint32((len(b.curBlock.entryOffsets)+1)*4 +
		4 + // size of list
		8 + // Sum64 in checksum proto
		4) // checksum length
	estimatedSize := uint32(b.curBlock.end) + uint32(6 /*header size for entry*/) +
		uint32(len(key)) + value.EncodedSize() + entriesOffsetsSize

	if b.shouldEncrypt() {
		// IV is added at the end of the block, while encrypting.
		// So, size of IV is added to estimatedSize.
		estimatedSize += aes.BlockSize
	}

	// Integer overflow check for table size.
	y.AssertTrue(uint64(b.curBlock.end)+uint64(estimatedSize) < math.MaxUint32)

	return estimatedSize > uint32(b.opts.BlockSize)
}

// AddStaleKey is same is Add function but it also increments the internal
// staleDataSize counter. This value will be used to prioritize this table for
// compaction.
func (b *Builder) AddStaleKey(key []byte, v y.ValueStruct, valueLen uint32) {
	// Rough estimate based on how much space it will occupy in the SST.
	b.staleDataSize += len(key) + len(v.Value) + 4 /* entry offset */ + 4 /* header size */
	b.addInternal(key, v, valueLen, true)
}

// Add adds a key-value pair to the block.
func (b *Builder) Add(key []byte, value y.ValueStruct, valueLen uint32) {
	b.addInternal(key, value, valueLen, false)
}

func (b *Builder) addInternal(key []byte, value y.ValueStruct, valueLen uint32, isStale bool) {
	if b.shouldFinishBlock(key, value) {
		if isStale {
			// This key will be added to tableIndex and it is stale.
			b.staleDataSize += len(key) + 4 /* len */ + 4 /* offset */
		}
		b.finishBlock()
		// Create a new block and start writing.
		b.curBlock = &bblock{
			data: b.alloc.Allocate(b.opts.BlockSize + padding),
		}
	}
	b.addHelper(key, value, valueLen)
}

// TODO: vvv this was the comment on ReachedCapacity.
// FinalSize returns the *rough* final size of the array, counting the header which is
// not yet written.
// TODO: Look into why there is a discrepancy. I suspect it is because of Write(empty, empty)
// at the end. The diff can vary.

// ReachedCapacity returns true if we... roughly (?) reached capacity?
func (b *Builder) ReachedCapacity() bool {
	// If encryption/compression is enabled then use the compresssed size.
	sumBlockSizes := b.compressedSize.Load()
	if b.opts.Compression == options.None && b.opts.DataKey == nil {
		sumBlockSizes = b.uncompressedSize.Load()
	}
	blocksSize := sumBlockSizes + // actual length of current buffer
		uint32(len(b.curBlock.entryOffsets)*4) + // all entry offsets size
		4 + // count of all entry offsets
		8 + // checksum bytes
		4 // checksum length

	estimateSz := blocksSize +
		4 + // Index length
		b.lenOffsets

	return uint64(estimateSz) > b.opts.tableCapacity
}

// Finish finishes the table by appending the index.
/*
The table structure looks like
+---------+------------+-----------+---------------+
| Block 1 | Block 2    | Block 3   | Block 4       |
+---------+------------+-----------+---------------+
| Block 5 | Block 6    | Block ... | Block N       |
+---------+------------+-----------+---------------+
| Index   | Index Size | Checksum  | Checksum Size |
+---------+------------+-----------+---------------+
*/
// In case the data is encrypted, the "IV" is added to the end of the index.
func (b *Builder) Finish() []byte {
	bd := b.Done()
	buf := make([]byte, bd.Size)
	written := bd.Copy(buf)
	y.AssertTrue(written == len(buf))
	return buf
}

type buildData struct {
	blockList []*bblock
	index     []byte
	checksum  []byte
	Size      int
	alloc     *z.Allocator
}

func (bd *buildData) Copy(dst []byte) int {
	var written int
	for _, bl := range bd.blockList {
		written += copy(dst[written:], bl.data[:bl.end])
	}
	written += copy(dst[written:], bd.index)
	written += copy(dst[written:], y.U32ToBytes(uint32(len(bd.index))))

	written += copy(dst[written:], bd.checksum)
	written += copy(dst[written:], y.U32ToBytes(uint32(len(bd.checksum))))
	return written
}

func (b *Builder) Done() buildData {
	b.finishBlock() // This will never start a new block.
	if b.blockChan != nil {
		close(b.blockChan)
	}
	// Wait for block handler to finish.
	b.wg.Wait()

	if len(b.blockList) == 0 {
		return buildData{}
	}
	bd := buildData{
		blockList: b.blockList,
		alloc:     b.alloc,
	}

	var f y.Filter
	if b.opts.BloomFalsePositive > 0 {
		bits := y.BloomBitsPerKey(len(b.keyHashes), b.opts.BloomFalsePositive)
		f = y.NewFilter(b.keyHashes, bits)
	}
	index, dataSize := b.buildIndex(f)

	var err error
	if b.shouldEncrypt() {
		index, err = b.encrypt(index)
		y.Check(err)
	}
	checksum := b.calculateChecksum(index)

	bd.index = index
	bd.checksum = checksum
	bd.Size = int(dataSize) + len(index) + len(checksum) + 4 + 4
	return bd
}

func (b *Builder) calculateChecksum(data []byte) []byte {
	// Build checksum for the index.
	checksum := pb.Checksum{
		// TODO: The checksum type should be configurable from the
		// options.
		// We chose to use CRC32 as the default option because
		// it performed better compared to xxHash64.
		// See the BenchmarkChecksum in table_test.go file
		// Size     =>   1024 B        2048 B
		// CRC32    => 63.7 ns/op     112 ns/op
		// xxHash64 => 87.5 ns/op     158 ns/op
		Sum:  y.CalculateChecksum(data, pb.Checksum_CRC32C),
		Algo: pb.Checksum_CRC32C,
	}

	// Write checksum to the file.
	chksum, err := proto.Marshal(&checksum)
	y.Check(err)
	// Write checksum size.
	return chksum
}

// DataKey returns datakey of the builder.
func (b *Builder) DataKey() *pb.DataKey {
	return b.opts.DataKey
}

func (b *Builder) Opts() *Options {
	return b.opts
}

// encrypt will encrypt the given data and appends IV to the end of the encrypted data.
// This should be only called only after checking shouldEncrypt method.
func (b *Builder) encrypt(data []byte) ([]byte, error) {
	iv, err := y.GenerateIV()
	if err != nil {
		return data, y.Wrapf(err, "Error while generating IV in Builder.encrypt")
	}
	needSz := len(data) + len(iv)
	dst := b.alloc.Allocate(needSz)

	if err = y.XORBlock(dst[:len(data)], data, b.DataKey().Data, iv); err != nil {
		return data, y.Wrapf(err, "Error while encrypting in Builder.encrypt")
	}

	y.AssertTrue(len(iv) == copy(dst[len(data):], iv))
	return dst, nil
}

// shouldEncrypt tells us whether to encrypt the data or not.
// We encrypt only if the data key exist. Otherwise, not.
func (b *Builder) shouldEncrypt() bool {
	return b.opts.DataKey != nil
}

// compressData compresses the given data.
func (b *Builder) compressData(data []byte) ([]byte, error) {
	switch b.opts.Compression {
	case options.None:
		return data, nil
	case options.Snappy:
		sz := s2.MaxEncodedLen(len(data))
		dst := b.alloc.Allocate(sz)
		return s2.EncodeSnappy(dst, data), nil
	case options.ZSTD:
		sz := y.ZSTDCompressBound(len(data))
		dst := b.alloc.Allocate(sz)
		return y.ZSTDCompress(dst, data, b.opts.ZSTDCompressionLevel)
	}
	return nil, errors.New("Unsupported compression type")
}

func (b *Builder) buildIndex(bloom []byte) ([]byte, uint32) {
	builder := fbs.NewBuilder(3 << 20)

	boList, dataSize := b.writeBlockOffsets(builder)
	// Write block offset vector the the idxBuilder.
	fb.TableIndexStartOffsetsVector(builder, len(boList))

	// Write individual block offsets in reverse order to work around how Flatbuffers expects it.
	for i := len(boList) - 1; i >= 0; i-- {
		builder.PrependUOffsetT(boList[i])
	}
	boEnd := builder.EndVector(len(boList))

	var bfoff fbs.UOffsetT
	// Write the bloom filter.
	if len(bloom) > 0 {
		bfoff = builder.CreateByteVector(bloom)
	}
	b.onDiskSize += dataSize
	fb.TableIndexStart(builder)
	fb.TableIndexAddOffsets(builder, boEnd)
	fb.TableIndexAddBloomFilter(builder, bfoff)
	fb.TableIndexAddMaxVersion(builder, b.maxVersion)
	fb.TableIndexAddUncompressedSize(builder, b.uncompressedSize.Load())
	fb.TableIndexAddKeyCount(builder, uint32(len(b.keyHashes)))
	fb.TableIndexAddOnDiskSize(builder, b.onDiskSize)
	fb.TableIndexAddStaleDataSize(builder, uint32(b.staleDataSize))
	builder.Finish(fb.TableIndexEnd(builder))

	buf := builder.FinishedBytes()
	index := fb.GetRootAsTableIndex(buf, 0)
	// Mutate the ondisk size to include the size of the index as well.
	y.AssertTrue(index.MutateOnDiskSize(index.OnDiskSize() + uint32(len(buf))))
	return buf, dataSize
}

// writeBlockOffsets writes all the blockOffets in b.offsets and returns the
// offsets for the newly written items.
func (b *Builder) writeBlockOffsets(builder *fbs.Builder) ([]fbs.UOffsetT, uint32) {
	var startOffset uint32
	var uoffs []fbs.UOffsetT
	for _, bl := range b.blockList {
		uoff := b.writeBlockOffset(builder, bl, startOffset)
		uoffs = append(uoffs, uoff)
		startOffset += uint32(bl.end)
	}
	return uoffs, startOffset
}

// writeBlockOffset writes the given key,offset,len triple to the indexBuilder.
// It returns the offset of the newly written blockoffset.
func (b *Builder) writeBlockOffset(
	builder *fbs.Builder, bl *bblock, startOffset uint32) fbs.UOffsetT {
	// Write the key to the buffer.
	k := builder.CreateByteVector(bl.baseKey)

	// Build the blockOffset.
	fb.BlockOffsetStart(builder)
	fb.BlockOffsetAddKey(builder, k)
	fb.BlockOffsetAddOffset(builder, startOffset)
	fb.BlockOffsetAddLen(builder, uint32(bl.end))
	return fb.BlockOffsetEnd(builder)
}
