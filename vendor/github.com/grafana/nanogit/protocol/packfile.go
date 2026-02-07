package protocol

import (
	"bufio"
	"bytes"
	"context"
	"crypto"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"fmt"
	stdhash "hash"
	"io"
	"os"
	"slices"
	"sort"
	"strconv"
	"strings"
	"sync"

	"github.com/klauspost/compress/zlib"

	"github.com/grafana/nanogit/log"
	"github.com/grafana/nanogit/protocol/hash"
)

// ErrPackfileWriterCleanedUp is returned when trying to use a PackfileWriter after cleanup has been called.
var ErrPackfileWriterCleanedUp = errors.New("packfile writer has been cleaned up and can no longer be used")

// Buffer pools for parseTree optimization
var (
	// Pool for bufio.Reader instances to avoid allocating new readers for each tree
	treeReaderPool = sync.Pool{
		New: func() interface{} {
			return bufio.NewReader(nil)
		},
	}

	// Pool for hex encoding buffers to reduce allocations
	hexBufferPool = sync.Pool{
		New: func() interface{} {
			// Pre-allocate buffer for SHA-1 hash (40 hex chars)
			return make([]byte, 40)
		},
	}

	// Pool for readAndInflate data buffers to reduce allocations
	dataBufferPool = sync.Pool{
		New: func() interface{} {
			// Pre-allocate buffer for common object sizes (64KB)
			return make([]byte, 65536)
		},
	}

	// Pool for discard buffers used in zlib stream consumption
	discardBufferPool = sync.Pool{
		New: func() interface{} {
			return make([]byte, 4096)
		},
	}

	// Pool for zlib writers to reduce allocations
	zlibWriterPool = sync.Pool{
		New: func() interface{} {
			// Use BestSpeed for better performance
			zw, _ := zlib.NewWriterLevel(nil, zlib.BestSpeed)
			return zw
		},
	}

	// Pool for zlib readers to reduce allocations
	zlibReaderPool = sync.Pool{
		New: func() interface{} {
			// Create a reader with valid empty zlib data - will be reset before use
			emptyZlibData := []byte{0x78, 0x9c, 0x03, 0x00, 0x00, 0x00, 0x00, 0x01} // Empty zlib stream
			zr, _ := zlib.NewReader(bytes.NewReader(emptyZlibData))
			return zr
		},
	}
)

// getHexString gets a hex string from a hash, allocating a new string
func getHexString(hash [20]byte) string {
	buf := hexBufferPool.Get().([]byte)
	hex.Encode(buf, hash[:])
	// Allocate string and return buffer to pool
	result := string(buf)
	//lint:ignore SA6002 byte slices are correct for sync.Pool
	hexBufferPool.Put(buf) //nolint:staticcheck
	return result
}

// getPooledZlibWriter gets a zlib writer from the pool and resets it for the given writer
func getPooledZlibWriter(writer io.Writer) *zlib.Writer {
	zw := zlibWriterPool.Get().(*zlib.Writer)
	zw.Reset(writer)
	return zw
}

// returnPooledZlibWriter returns a zlib writer to the pool
func returnPooledZlibWriter(zw *zlib.Writer) {
	zlibWriterPool.Put(zw)
}

// getPooledZlibReader gets a zlib reader from the pool and resets it for the given reader
func getPooledZlibReader(reader io.Reader) (io.ReadCloser, error) {
	zr := zlibReaderPool.Get().(io.ReadCloser)
	if resetter, ok := zr.(zlib.Resetter); ok {
		if err := resetter.Reset(reader, nil); err != nil {
			zlibReaderPool.Put(zr)
			return nil, err
		}
		return zr, nil
	}
	// Fallback: close and get a new reader
	_ = zr.Close()
	zlibReaderPool.Put(zr)
	return zlib.NewReader(reader)
}

// returnPooledZlibReader returns a zlib reader to the pool
func returnPooledZlibReader(zr io.ReadCloser) {
	zlibReaderPool.Put(zr)
}

// estimateTreeSize estimates the number of entries in tree data using improved heuristics
func estimateTreeSize(data []byte) int {
	if len(data) < 25 {
		return 4 // minimum reasonable capacity
	}

	// Use average entry size based on typical Git tree structure
	// Mode (6) + space (1) + avg filename (12) + null (1) + hash (20) = 40 bytes average
	estimate := len(data) / 40

	// Add 25% buffer for safety
	estimate = estimate + (estimate / 4)

	// Apply reasonable bounds
	if estimate < 8 {
		return 8
	}
	if estimate > 2000 {
		return 2000
	}
	return estimate
}

// FIXME: This logic is pretty hard to follow and test. So it's missing coverage for now
// Review it once we have some more integration testing so that we don't break things unintentionally.

const (
	ErrNoPackfileSignature        = strError("the given payload has no packfile signature")
	ErrUnsupportedPackfileVersion = strError("the version of the packfile payload is unsupported")
	ErrUnsupportedObjectType      = strError("the type of the object is unsupported")
	ErrInflatedDataIncorrectSize  = strError("the data is the wrong size post-inflation")
)

// MaxUnpackedObjectSize is the maximum size of an unpacked object.
const MaxUnpackedObjectSize = 10 * 1024 * 1024

type PackfileEntry struct {
	Object  *PackfileObject
	Trailer *PackfileTrailer
}

type PackfileObject struct {
	// The type of the object. 3-bit field.
	Type ObjectType
	// The data, uncompressed.
	// If Type is one of ObjectTypeRefDelta and ObjectTypeOfsDelta, this is a delta.
	Data []byte
	// The hash of the object. Might be unset.
	Hash hash.Hash

	// If Type == ObjectTypeRefDelta, this is set.
	Delta *Delta
	// If Type == ObjectTypeOfsDelta, this is set.
	RelativeOffset int
	// If Type == ObjectTypeTree, this is set.
	Tree []PackfileTreeEntry
	// If Type == ObjectTypeCommit, this is set.
	Commit *PackfileCommit
}

// Parse parses the object's data based on its type and populates the appropriate fields.
// This method should be called after creating a PackfileObject with raw data to ensure
// that Tree or Commit fields are properly populated.
func (obj *PackfileObject) Parse() error {
	switch obj.Type {
	case ObjectTypeTree:
		return obj.parseTree()
	case ObjectTypeCommit:
		return obj.parseCommit()
	default:
		return nil
	}
}

func (e *PackfileObject) parseTree() error {
	// Get reader from pool to avoid allocation
	reader := treeReaderPool.Get().(*bufio.Reader)
	defer treeReaderPool.Put(reader)
	reader.Reset(bytes.NewReader(e.Data))

	// Pre-allocate Tree slice with estimated capacity based on data size
	capacity := estimateTreeSize(e.Data)
	e.Tree = make([]PackfileTreeEntry, 0, capacity)

	for {
		fileModeStr, err := reader.ReadString(' ')
		if err != nil {
			if fileModeStr == "" && errors.Is(err, io.EOF) {
				// The last entry was already entered.
				break
			}
			return eofIsUnexpected(err)
		}
		fileModeStr = fileModeStr[:len(fileModeStr)-1] // ReadString includes delim
		fileMode, err := strconv.ParseUint(fileModeStr, 8, 32)
		if err != nil {
			return err
		}

		name, err := reader.ReadString(0)
		if err != nil {
			return eofIsUnexpected(err)
		}
		name = name[:len(name)-1] // ReadString includes delim

		var hash [20]byte
		if _, err := io.ReadFull(reader, hash[:]); err != nil {
			return eofIsUnexpected(err)
		}

		// Use pooled hex buffer and get proper string copy
		hashStr := getHexString(hash)
		e.Tree = append(e.Tree, PackfileTreeEntry{
			FileName: name,
			FileMode: uint32(fileMode),
			Hash:     hashStr,
		})
	}

	return nil
}

func (e *PackfileObject) parseCommit() error {
	reader := bufio.NewReader(bytes.NewReader(e.Data))
	e.Commit = &PackfileCommit{}

	msg, err := e.parseCommitHeaders(reader)
	if err != nil {
		return err
	}

	e.Commit.Message = msg.String()
	return nil
}

// parseCommitHeaders parses commit headers and returns the message builder
func (e *PackfileObject) parseCommitHeaders(reader *bufio.Reader) (*strings.Builder, error) {
	writingMsg := false
	msg := &strings.Builder{}

	for {
		line, err := reader.ReadBytes('\n')
		if err != nil && !errors.Is(err, io.EOF) {
			return nil, err
		}
		if len(line) == 0 && errors.Is(err, io.EOF) {
			break
		}

		if writingMsg {
			msg.Write(line)
			continue
		}

		line = bytes.TrimSpace(line)
		if len(line) == 0 {
			writingMsg = true
			continue
		}

		err = e.parseCommitField(line)
		if err != nil {
			return nil, err
		}
	}

	return msg, nil
}

// parseCommitField parses a single commit field line
func (e *PackfileObject) parseCommitField(line []byte) error {
	command, data, _ := bytes.Cut(line, []byte(" "))

	switch string(command) {
	case "committer":
		return e.parseCommitter(string(data))
	case "tree":
		return e.parseCommitTree(string(data))
	case "author":
		return e.parseAuthor(string(data))
	case "parent":
		return e.parseParent(string(data))
	default:
		e.parseCustomField(string(command), data)
		return nil
	}
}

// parseCommitter parses the committer field
func (e *PackfileObject) parseCommitter(data string) error {
	identity, err := ParseIdentity(data)
	if err != nil {
		return fmt.Errorf("parsing committer: %w", err)
	}
	e.Commit.Committer = identity
	return nil
}

// parseCommitTree parses the tree field
func (e *PackfileObject) parseCommitTree(data string) error {
	var err error
	e.Commit.Tree, err = hash.FromHex(data)
	return err
}

// parseAuthor parses the author field
func (e *PackfileObject) parseAuthor(data string) error {
	identity, err := ParseIdentity(data)
	if err != nil {
		return fmt.Errorf("parsing author: %w", err)
	}
	e.Commit.Author = identity
	return nil
}

// parseParent parses the parent field
func (e *PackfileObject) parseParent(data string) error {
	var err error
	e.Commit.Parent, err = hash.FromHex(data)
	return err
}

// parseCustomField stores custom fields in the Fields map
func (e *PackfileObject) parseCustomField(command string, data []byte) {
	if e.Commit.Fields == nil {
		e.Commit.Fields = make(map[string][]byte, 8)
	}
	e.Commit.Fields[command] = data
}

func (e *PackfileObject) parseDelta(parent string) error {
	var err error
	e.Delta, err = parseDelta(parent, e.Data)
	return eofIsUnexpected(err)
}

// PackfileTreeEntry represents a part of a packfile tree.
//
// The wire-format looks as follows:
//   - File mode as ASCII text. Dirs are 0o40000.
//   - A space (0x20).
//   - A file name. NUL bytes are not legal.
//   - A NUL byte.
//   - A hash. 20 or 32 bytes for SHA-1 and SHA-256 respectively.
//   - Repeat until EOF.
//
// Resource: https://github.com/go-git/go-git/blob/63343bf5f918ea5384ae63bfd22bb36689fa0151/plumbing/object/tree.go#L216-L273
type PackfileTreeEntry struct {
	FileMode uint32
	FileName string
	Hash     string
}

// PackfileCommit represents a single commit within a packfile.
//
// The wire-format looks as follows:
//   - A set of attribute fields delimited by '\n's. They are a name, a space (0x20), and a value.
//   - An empty line (i.e. just \n).
//   - The commit message. A PGP signature is optionally included here, which will then have a '\n \n\n' at the end of it.
//
// Resource: https://github.com/go-git/go-git/blob/63343bf5f918ea5384ae63bfd22bb36689fa0151/plumbing/object/commit.go#L185-L275
type PackfileCommit struct {
	Tree      hash.Hash
	Author    *Identity
	Committer *Identity
	Parent    hash.Hash
	Message   string
	// Fields contains any fields beyond the fields that are statically defined.
	// If a field is statically defined, it SHOULD not show up here.
	Fields map[string][]byte

	// There is also a gpgsig field.
}

type PackfileTrailer struct {
	// TODO: Checksum here. Are there multiple??
}

// A PackfileReader is a reader for a set of compressed files (objects).
// Its wire-format is defined here: https://git-scm.com/docs/pack-format
// Its negotiation is defined here: https://git-scm.com/docs/pack-protocol#_packfile_negotiation
//
// The wire-format goes as such:
//   - 4-byte signature: `[]byte("PACK")`
//   - 4-byte version number (2 or 3; big-endian)
//   - 4-byte number of objects contained in the pack (big-endian)
//   - The pre-defined number of objects follow.
//   - A trailer of all packfile checksums.
//
// The object entries go as such:
//   - For an undeltified representation,
//     there is a n-byte type and length (3-bit type, (n-1)*7+4-bit length).
//     Finally, the compressed object data.
//   - For a deltified representation, the same byte and length is given.
//     Then, we have an object name if OBJ_REF_DELTA or a negative relative offset from the delta object's position in the pack if this is an OBJ_OFS_DELTA object.
//     Finally, the compressed delta data.
type PackfileReader struct {
	reader           io.Reader
	remainingObjects uint32
	algo             crypto.Hash
	zlibReader       io.ReadCloser // Reusable zlib reader for performance
	hasher           stdhash.Hash  // Reusable hasher for performance

	// State that shouldn't be set when constructed.
	trailerRead bool
	err         error
}

// Close cleans up the PackfileReader's resources, including the zlib reader
func (p *PackfileReader) Close() error {
	if p.zlibReader != nil {
		err := p.zlibReader.Close()
		// Return reader to pool for reuse
		returnPooledZlibReader(p.zlibReader)
		p.zlibReader = nil
		return err
	}
	return nil
}

// ReadObject reads an object from the packfile.
// The final object is always a PackfileTrailer. It comes with a nil error, not an io.EOF.
// When the final object is read, a nil and io.EOF is returned.
// If another error is ever returned, the object is "tainted", and will not read more objects.
//
// This function is not concurrency-safe. Use a mutex or a single goroutine+channel when dealing with this.
// Objects returned are no longer owned by this function once returned; you can pass them around goroutines freely.
func (p *PackfileReader) ReadObject(ctx context.Context) (PackfileEntry, error) {
	// TODO: probably smart to use a mutex here.
	if p == nil {
		return PackfileEntry{}, io.EOF
	}

	if p.err != nil {
		return PackfileEntry{}, fmt.Errorf("ReadObject called after error returned: %w", p.err)
	}

	var entry PackfileEntry
	entry, p.err = p.readObject(ctx)
	if !p.trailerRead {
		p.err = eofIsUnexpected(p.err)
	}
	return entry, p.err
}

func (p *PackfileReader) readObject(ctx context.Context) (PackfileEntry, error) {
	logger := log.FromContext(ctx)
	entry := PackfileEntry{}
	if p.remainingObjects == 0 {
		// It's time for the trailer.
		if p.trailerRead {
			// We've already read it, so there's no more to do here.
			return entry, io.EOF
		}

		// TODO: Read & parse trailer. No idea how that'll work.
		entry.Trailer = &PackfileTrailer{}

		p.trailerRead = true
		return entry, nil
	}
	p.remainingObjects--

	var buf [1]byte
	if _, err := p.reader.Read(buf[:]); err != nil {
		return entry, err
	}

	entry.Object = &PackfileObject{}

	// The first byte is a 3-bit type (stored in 4 bits).
	// The remaining 4 bits are the start of a varint containing the size.
	entry.Object.Type = ObjectType((buf[0] >> 4) & 0b111)

	size := int(buf[0] & 0b1111)
	shift := 4
	for buf[0]&0x80 == 0x80 {
		if _, err := p.reader.Read(buf[:]); err != nil {
			return entry, err
		}

		size += int(buf[0]&0x7f) << shift
		shift += 7
	}

	logger.Debug("Read object type", "type_byte", buf[0], "type", entry.Object.Type, "size", size, "shift", shift)

	err := p.processObjectByType(entry.Object, size, buf[0])
	if err != nil {
		return entry, err
	}

	return entry, nil
}

// processObjectByType handles different object types during packfile reading
func (p *PackfileReader) processObjectByType(obj *PackfileObject, size int, originalByte byte) error {
	switch obj.Type {
	case ObjectTypeBlob, ObjectTypeCommit, ObjectTypeTag, ObjectTypeTree:
		return p.processStandardObject(obj, size)
	case ObjectTypeRefDelta:
		return p.processRefDelta(obj, size)
	case ObjectTypeOfsDelta:
		// TODO(mariell): we need to handle a ref delta, at least.
		//   Maybe OFS too? I don't think we need them as that's a
		//   capability to negotiate.
		fallthrough
	case ObjectTypeInvalid, ObjectTypeReserved:
		// TODO(mem): do we need to do something about these? No
		// special handling for them yet.
		fallthrough
	default:
		return fmt.Errorf("%w (%s; original byte: %08b)",
			ErrUnsupportedObjectType, obj.Type, originalByte)
	}
}

// processStandardObject handles standard Git objects (blob, commit, tag, tree)
func (p *PackfileReader) processStandardObject(obj *PackfileObject, size int) error {
	var err error
	obj.Data, err = p.readAndInflate(size)
	if err != nil {
		return eofIsUnexpected(err)
	}

	obj.Hash, err = p.calculateObjectHash(obj.Type, obj.Data)
	if err != nil {
		return eofIsUnexpected(err)
	}

	return p.parseObjectContent(obj)
}

// parseObjectContent parses the content of tree and commit objects
func (p *PackfileReader) parseObjectContent(obj *PackfileObject) error {
	switch obj.Type {
	case ObjectTypeTree:
		return obj.parseTree()
	case ObjectTypeCommit:
		return obj.parseCommit()
	default:
		return nil
	}
}

// processRefDelta handles reference delta objects
func (p *PackfileReader) processRefDelta(obj *PackfileObject, size int) error {
	ref := make([]byte, p.algo.Size())
	if _, err := p.reader.Read(ref); err != nil {
		return err
	}

	var err error
	obj.Data, err = p.readAndInflate(size)
	if err != nil {
		return err
	}

	return obj.parseDelta(hex.EncodeToString(ref[:]))
}

func (p *PackfileReader) readAndInflate(sz int) ([]byte, error) {
	// Reuse zlib reader for performance - avoid creating new reader for each object
	if p.zlibReader == nil {
		var err error
		p.zlibReader, err = getPooledZlibReader(p.reader)
		if err != nil {
			return nil, err
		}
	} else {
		// Reset the reader for the next zlib stream
		if resetter, ok := p.zlibReader.(zlib.Resetter); ok {
			if err := resetter.Reset(p.reader, nil); err != nil {
				return nil, err
			}
		} else {
			// Fallback: close and recreate using pool
			_ = p.zlibReader.Close()
			var err error
			p.zlibReader, err = getPooledZlibReader(p.reader)
			if err != nil {
				return nil, err
			}
		}
	}

	// TODO(mem): this should be limited to the size the packet says it
	// carries, and we should limit that size above (i.e. if the packet
	// says it's carrying a huge amount of data we should bail out).
	lr := io.LimitReader(p.zlibReader, MaxUnpackedObjectSize)

	// Use pooled buffer if size is reasonable, otherwise allocate directly
	var data []byte
	var pooledBuf []byte

	if sz <= 65536 { // Use pooled buffer for objects <= 64KB
		pooledBuf = dataBufferPool.Get().([]byte)
		//lint:ignore SA6002 byte slices are correct for sync.Pool
		defer dataBufferPool.Put(pooledBuf) //nolint:staticcheck
		data = pooledBuf[:sz]               // Slice to exact size needed
	} else {
		data = make([]byte, sz) // Allocate directly for large objects
	}

	n, err := io.ReadFull(lr, data)
	if err != nil {
		if err == io.EOF || err == io.ErrUnexpectedEOF {
			// Handle partial read correctly
			if n != sz {
				return nil, ErrInflatedDataIncorrectSize
			}
		} else {
			return nil, eofIsUnexpected(err)
		}
	}

	// CRITICAL: Consume any remaining bytes in the zlib stream to ensure proper positioning
	// for the next object. This is essential for sequential object reading.
	// We need to read until EOF to complete the zlib stream.
	discardBuf := discardBufferPool.Get().([]byte)
	//lint:ignore SA6002 byte slices are correct for sync.Pool
	defer discardBufferPool.Put(discardBuf) //nolint:staticcheck

	for {
		_, err := lr.Read(discardBuf)
		if err != nil {
			if err == io.EOF {
				break // This is expected - we've consumed the entire zlib stream
			}
			return nil, eofIsUnexpected(err)
		}
	}

	// If we used a pooled buffer, we need to copy the data to return it
	// since the pooled buffer will be reused
	if pooledBuf != nil {
		result := make([]byte, sz)
		copy(result, data)
		return result, nil
	}

	return data, nil
}

// calculateObjectHash computes the hash of an object using a reusable hasher for performance
func (p *PackfileReader) calculateObjectHash(objType ObjectType, data []byte) (hash.Hash, error) {
	// Initialize hasher on first use
	if p.hasher == nil {
		p.hasher = p.algo.New()
	} else {
		p.hasher.Reset()
	}

	// Write Git object header exactly as NewHasher does for compatibility
	// This ensures we get the same hash as the Object function
	typeBytes := objType.Bytes()
	if _, err := p.hasher.Write(typeBytes); err != nil {
		return hash.Zero, err
	}

	if _, err := p.hasher.Write([]byte(" ")); err != nil {
		return hash.Zero, err
	}

	sizeBytes := []byte(strconv.FormatInt(int64(len(data)), 10))
	if _, err := p.hasher.Write(sizeBytes); err != nil {
		return hash.Zero, err
	}

	if _, err := p.hasher.Write([]byte{0}); err != nil {
		return hash.Zero, err
	}

	// Write object data
	if _, err := p.hasher.Write(data); err != nil {
		return hash.Zero, err
	}

	// Get hash sum
	sum := p.hasher.Sum(nil)
	if len(sum) != 20 {
		return hash.Zero, fmt.Errorf("expected 20-byte hash, got %d bytes", len(sum))
	}

	var result hash.Hash
	copy(result[:], sum)
	return result, nil
}

func ParsePackfile(ctx context.Context, reader io.Reader) (*PackfileReader, error) {
	logger := log.FromContext(ctx)
	// Read and verify the "PACK" signature
	signature := make([]byte, 4)
	if _, err := io.ReadFull(reader, signature); err != nil {
		// Return the expected error for empty/truncated data
		if err == io.EOF || err == io.ErrUnexpectedEOF {
			return nil, ErrNoPackfileSignature
		}
		return nil, fmt.Errorf("reading packfile signature: %w", err)
	}
	if !slices.Equal(signature, []byte("PACK")) {
		return nil, ErrNoPackfileSignature
	}

	// Read version (4 bytes, big-endian)
	var version uint32
	if err := binary.Read(reader, binary.BigEndian, &version); err != nil {
		return nil, fmt.Errorf("reading packfile version: %w", err)
	}
	if version != 2 && version != 3 {
		return nil, fmt.Errorf("version %d: %w", version, ErrUnsupportedPackfileVersion)
	}

	// Read object count (4 bytes, big-endian)
	var countObjects uint32
	if err := binary.Read(reader, binary.BigEndian, &countObjects); err != nil {
		return nil, fmt.Errorf("reading packfile object count: %w", err)
	}

	logger.Debug("Read packfile header", "version", version, "object_count", countObjects)

	// Now the reader points to the object data stream
	// For fast I/O with 64KB buffer
	bufferedReader := bufio.NewReaderSize(reader, 64*1024)
	return &PackfileReader{
		reader:           bufferedReader,
		remainingObjects: countObjects,
		algo:             crypto.SHA1, // TODO: Support SHA256
	}, nil
}

// PackfileStorageMode defines how packfile objects are stored during staging.
type PackfileStorageMode int

const (
	// PackfileStorageAuto automatically chooses between memory and disk based on object count and total size.
	// Uses memory for small operations (<=10 objects or <=5MB) and disk for larger operations.
	PackfileStorageAuto PackfileStorageMode = iota

	// PackfileStorageMemory always stores objects in memory for maximum performance.
	// Best for small operations but can use significant memory for bulk operations.
	PackfileStorageMemory

	// PackfileStorageDisk always stores objects in temporary files on disk.
	// Best for bulk operations to minimize memory usage.
	PackfileStorageDisk
)

// PackfileWriter helps create Git objects and pack them into a packfile.
// It maintains state about the objects being written and handles the packfile format.
// Storage behavior is configurable via PackfileStorageMode.
type PackfileWriter struct {
	// Track object hashes to avoid duplicates
	objectHashes map[string]bool
	// Memory storage: store objects in memory
	memoryObjects []PackfileObject
	// Disk storage: temporary file for streaming packfile data
	tempFile *os.File
	// Track if we have any commit (required for push)
	hasCommit bool
	// Track the last commit hash for reference updates
	lastCommitHash hash.Hash
	// Storage mode configuration
	storageMode PackfileStorageMode
	// Track total byte size of objects for auto mode threshold
	totalBytes int
	// Track if cleanup has been called
	isCleanedUp bool
	// The hash algorithm to use (SHA1 or SHA256)
	algo crypto.Hash
}

const (
	// MemoryThreshold is the default object count threshold for auto mode
	MemoryThreshold = 10
	// MemoryBytesThreshold is the default byte size threshold for auto mode (5MB)
	MemoryBytesThreshold = 5 * 1024 * 1024
)

// NewPackfileWriter creates a new PackfileWriter with the specified hash algorithm and storage mode.
func NewPackfileWriter(algo crypto.Hash, storageMode PackfileStorageMode) *PackfileWriter {
	return &PackfileWriter{
		objectHashes:  make(map[string]bool),
		memoryObjects: make([]PackfileObject, 0),
		storageMode:   storageMode,
		algo:          algo,
	}
}

// checkCleanupState returns an error if the writer has been cleaned up.
func (w *PackfileWriter) checkCleanupState() error {
	if w.isCleanedUp {
		return ErrPackfileWriterCleanedUp
	}
	return nil
}

// Cleanup removes the temporary file if it exists and clears all memory state.
// This should be called when the writer is no longer needed.
func (w *PackfileWriter) Cleanup() error {
	if w.isCleanedUp {
		return ErrPackfileWriterCleanedUp
	}

	var err error

	// No need to clean up zlib writer since we create a new one for each object

	// Clean up temporary file if it exists
	if w.tempFile != nil {
		name := w.tempFile.Name()
		if closeErr := w.tempFile.Close(); closeErr != nil && err == nil {
			err = closeErr
		}
		if removeErr := os.Remove(name); removeErr != nil && err == nil {
			err = removeErr
		}
		w.tempFile = nil
	}

	// Clear all memory state
	w.objectHashes = make(map[string]bool)
	w.memoryObjects = nil
	w.hasCommit = false
	w.lastCommitHash = hash.Hash{}
	w.totalBytes = 0

	// Mark as cleaned up to prevent further use
	w.isCleanedUp = true

	return err
}

// AddBlob adds a blob object to the packfile.
// The blob contains the raw file contents.
func (w *PackfileWriter) AddBlob(data []byte) (hash.Hash, error) {
	if err := w.checkCleanupState(); err != nil {
		return hash.Hash{}, err
	}

	// Compute hash immediately for deduplication
	h, err := Object(w.algo, ObjectTypeBlob, data)
	if err != nil {
		return hash.Hash{}, fmt.Errorf("computing blob hash: %w", err)
	}

	// Check for duplicates
	if w.objectHashes[h.String()] {
		return h, nil
	}

	// Create the object
	obj := PackfileObject{
		Type: ObjectTypeBlob,
		Data: data,
		Hash: h,
	}

	// Add to appropriate storage
	if err := w.addObject(obj); err != nil {
		return hash.Hash{}, fmt.Errorf("adding blob object: %w", err)
	}

	w.objectHashes[h.String()] = true
	return h, nil
}

// BuildTreeObject builds a tree object from a list of entries.
// The tree represents a directory structure with file modes and hashes.
func BuildTreeObject(algo crypto.Hash, entries []PackfileTreeEntry) (PackfileObject, error) {
	// Sort entries according to Git specification: alphabetically by name,
	// but directories are treated as if they have a trailing slash
	sort.Slice(entries, func(i, j int) bool {
		nameI := entries[i].FileName
		nameJ := entries[j].FileName

		// If entry i is a directory (mode 040000), append "/" for sorting
		if entries[i].FileMode&0o40000 != 0 {
			nameI += "/"
		}

		// If entry j is a directory (mode 040000), append "/" for sorting
		if entries[j].FileMode&0o40000 != 0 {
			nameJ += "/"
		}

		return nameI < nameJ
	})

	// Build tree data
	var data bytes.Buffer
	for _, entry := range entries {
		// Write mode as octal string
		fmt.Fprintf(&data, "%o ", entry.FileMode)
		// Write filename
		data.WriteString(entry.FileName)
		data.WriteByte(0) // NUL byte
		// Write hash
		hashBytes, err := hex.DecodeString(entry.Hash)
		if err != nil {
			return PackfileObject{}, fmt.Errorf("decoding hash for %s: %w", entry.FileName, err)
		}
		data.Write(hashBytes)
	}

	obj := PackfileObject{
		Type: ObjectTypeTree,
		Data: data.Bytes(),
		Tree: entries,
	}

	h, err := Object(algo, obj.Type, obj.Data)
	if err != nil {
		return PackfileObject{}, fmt.Errorf("computing tree hash: %w", err)
	}
	obj.Hash = h

	return obj, nil
}

// AddObject adds an object to the packfile.
func (w *PackfileWriter) AddObject(obj PackfileObject) {
	if err := w.checkCleanupState(); err != nil {
		// Log error but don't fail - this maintains the original interface
		return
	}

	if w.objectHashes[obj.Hash.String()] {
		return
	}

	// Add to appropriate storage
	if err := w.addObject(obj); err != nil {
		// Log error but don't fail - this maintains the original interface
		return
	}

	w.objectHashes[obj.Hash.String()] = true
}

// HasObjects returns true if the writer has any objects staged for writing.
func (w *PackfileWriter) HasObjects() bool {
	if err := w.checkCleanupState(); err != nil {
		return false
	}
	return len(w.objectHashes) > 0
}

// AddCommit adds a commit object to the packfile.
// The commit references a tree and optionally a parent commit.
func (w *PackfileWriter) AddCommit(tree, parent hash.Hash, author, committer *Identity, message string) (hash.Hash, error) {
	if err := w.checkCleanupState(); err != nil {
		return hash.Hash{}, err
	}

	// Build commit data
	var data bytes.Buffer
	fmt.Fprintf(&data, "tree %s\n", tree.String())
	if !parent.Is(hash.Zero) {
		fmt.Fprintf(&data, "parent %s\n", parent.String())
	}
	fmt.Fprintf(&data, "author %s\n", author.String())
	fmt.Fprintf(&data, "committer %s\n", committer.String())
	data.WriteString("\n")
	data.WriteString(message)

	// Compute hash immediately
	h, err := Object(w.algo, ObjectTypeCommit, data.Bytes())
	if err != nil {
		return hash.Hash{}, fmt.Errorf("computing commit hash: %w", err)
	}

	// Check for duplicates
	if w.objectHashes[h.String()] {
		return h, nil
	}

	// Create commit object
	obj := PackfileObject{
		Type: ObjectTypeCommit,
		Data: data.Bytes(),
		Hash: h,
		Commit: &PackfileCommit{
			Tree:      tree,
			Parent:    parent,
			Author:    author,
			Committer: committer,
			Message:   message,
		},
	}

	// Add to appropriate storage
	if err := w.addObject(obj); err != nil {
		return hash.Hash{}, fmt.Errorf("adding commit object: %w", err)
	}

	w.objectHashes[h.String()] = true
	w.hasCommit = true
	w.lastCommitHash = h

	return h, nil
}

// WritePackfile writes all objects to a packfile, streaming directly to the provided writer.
// The packfile format is:
// - Reference update command: <old-value> <new-value> <ref-name>\000<capabilities>\n
// - Flush packet (0000)
// - 4-byte signature: "PACK"
// - 4-byte version number (2)
// - 4-byte number of objects
// - Object entries
// - 20-byte SHA1 of the packfile
func (pw *PackfileWriter) WritePackfile(writer io.Writer, refName string, oldRefHash hash.Hash) error {
	if err := pw.validateWriteState(); err != nil {
		return err
	}

	err := pw.writeRefUpdate(writer, refName, oldRefHash)
	if err != nil {
		return err
	}

	err = pw.writePackfileData(writer)
	if err != nil {
		return err
	}

	return pw.finalizeWrite()
}

// validateWriteState checks if the packfile writer is in a valid state for writing
func (pw *PackfileWriter) validateWriteState() error {
	if err := pw.checkCleanupState(); err != nil {
		return err
	}

	if !pw.hasCommit {
		return errors.New("no commit object found in packfile")
	}

	if len(pw.objectHashes) == 0 {
		return errors.New("no objects to write")
	}

	return nil
}

// writeRefUpdate writes the reference update command and flush packet
func (pw *PackfileWriter) writeRefUpdate(writer io.Writer, refName string, oldRefHash hash.Hash) error {
	refUpdate := fmt.Sprintf("%s %s %s\000report-status-v2 side-band-64k quiet object-format=sha1 agent=nanogit\n",
		oldRefHash.String(),
		pw.lastCommitHash.String(),
		refName)

	refUpdateLen := len(refUpdate) + 4
	refUpdateLine := fmt.Sprintf("%04x%s", refUpdateLen, refUpdate)

	if _, err := writer.Write([]byte(refUpdateLine)); err != nil {
		return fmt.Errorf("writing ref update line: %w", err)
	}

	if _, err := writer.Write([]byte("0000")); err != nil {
		return fmt.Errorf("writing flush packet: %w", err)
	}

	return nil
}

// writePackfileData writes the packfile header and object data
func (pw *PackfileWriter) writePackfileData(writer io.Writer) error {
	packHash := pw.algo.New()
	hashWriter := io.MultiWriter(writer, packHash)

	err := pw.writePackfileHeader(hashWriter)
	if err != nil {
		return err
	}

	err = pw.writeObjects(hashWriter)
	if err != nil {
		return err
	}

	if _, err := writer.Write(packHash.Sum(nil)); err != nil {
		return fmt.Errorf("writing pack hash: %w", err)
	}

	return nil
}

// writePackfileHeader writes the packfile signature, version, and object count
func (pw *PackfileWriter) writePackfileHeader(hashWriter io.Writer) error {
	if _, err := hashWriter.Write([]byte("PACK")); err != nil {
		return fmt.Errorf("writing packfile signature: %w", err)
	}

	if err := binary.Write(hashWriter, binary.BigEndian, uint32(2)); err != nil {
		return fmt.Errorf("writing packfile version: %w", err)
	}

	numObjects := uint64(len(pw.objectHashes))
	if numObjects > 0xFFFFFFFF {
		return fmt.Errorf("too many objects for packfile: %d (max: %d)", numObjects, uint64(0xFFFFFFFF))
	}
	if err := binary.Write(hashWriter, binary.BigEndian, uint32(numObjects)); err != nil {
		return fmt.Errorf("writing object count: %w", err)
	}

	return nil
}

// writeObjects writes all object data from either temp file or memory
func (pw *PackfileWriter) writeObjects(hashWriter io.Writer) error {
	if pw.tempFile != nil {
		return pw.writeFromTempFile(hashWriter)
	}
	return pw.writeFromMemory(hashWriter)
}

// writeFromTempFile writes objects from the temporary file
func (pw *PackfileWriter) writeFromTempFile(hashWriter io.Writer) error {
	if _, err := pw.tempFile.Seek(0, io.SeekStart); err != nil {
		return fmt.Errorf("seeking to start of temp file: %w", err)
	}

	if _, err := io.Copy(hashWriter, pw.tempFile); err != nil {
		return fmt.Errorf("copying objects from temp file: %w", err)
	}

	return nil
}

// writeFromMemory writes objects from memory storage
func (pw *PackfileWriter) writeFromMemory(hashWriter io.Writer) error {
	for _, obj := range pw.memoryObjects {
		if err := pw.writeObjectToWriter(hashWriter, obj); err != nil {
			return fmt.Errorf("writing memory object: %w", err)
		}
	}
	return nil
}

// finalizeWrite performs cleanup after successful write
func (pw *PackfileWriter) finalizeWrite() error {
	if cleanupErr := pw.Cleanup(); cleanupErr != nil {
		return fmt.Errorf("cleanup after successful write: %w", cleanupErr)
	}
	return nil
}

// writeObjectToWriter writes a single object to the specified writer.
// The object format is:
// - Type and size (variable length)
// - Compressed object data
func (pw *PackfileWriter) writeObjectToWriter(writer io.Writer, obj PackfileObject) error {
	// Write type and size
	size := len(obj.Data)
	firstByte := byte(obj.Type)<<4 | byte(size&0x0f)
	size >>= 4

	for size > 0 {
		firstByte |= 0x80
		if _, err := writer.Write([]byte{firstByte}); err != nil {
			return fmt.Errorf("writing object header: %w", err)
		}
		firstByte = byte(size & 0x7f)
		size >>= 7
	}
	if _, err := writer.Write([]byte{firstByte}); err != nil {
		return fmt.Errorf("writing object header: %w", err)
	}

	// Compress and write data using pooled zlib writer
	// This ensures proper zlib stream boundaries for each Git object
	zw := getPooledZlibWriter(writer)
	defer returnPooledZlibWriter(zw)
	
	if _, err := zw.Write(obj.Data); err != nil {
		return fmt.Errorf("compressing object data: %w", err)
	}
	if err := zw.Close(); err != nil {
		return fmt.Errorf("closing zlib writer: %w", err)
	}

	return nil
}


// addObject adds an object using the appropriate storage method based on the storage mode.
func (pw *PackfileWriter) addObject(obj PackfileObject) error {
	switch pw.storageMode {
	case PackfileStorageMemory:
		// Always use memory storage
		pw.memoryObjects = append(pw.memoryObjects, obj)
		pw.totalBytes += len(obj.Data)
		return nil

	case PackfileStorageDisk:
		// Always use file storage
		if pw.tempFile == nil {
			// First object - create temp file
			if err := pw.ensureTempFile(); err != nil {
				return fmt.Errorf("creating temp file: %w", err)
			}
		}
		pw.totalBytes += len(obj.Data)
		return pw.writeObjectToFile(obj)

	case PackfileStorageAuto:
		// Auto mode: use memory for small operations, file for bulk operations
		// Check both object count and total byte size thresholds
		if len(pw.objectHashes) < MemoryThreshold && pw.totalBytes < MemoryBytesThreshold && pw.tempFile == nil {
			pw.memoryObjects = append(pw.memoryObjects, obj)
			pw.totalBytes += len(obj.Data)
			return nil
		}

		// Switch to file storage for bulk operations
		if pw.tempFile == nil {
			// First time switching to file - migrate existing memory objects
			if err := pw.migrateToFile(); err != nil {
				return fmt.Errorf("migrating to file storage: %w", err)
			}
		}

		// Write to temp file
		pw.totalBytes += len(obj.Data)
		return pw.writeObjectToFile(obj)

	default:
		return fmt.Errorf("unknown storage mode: %v", pw.storageMode)
	}
}

// migrateToFile creates a temp file and writes all memory objects to it.
func (w *PackfileWriter) migrateToFile() error {
	if err := w.ensureTempFile(); err != nil {
		return fmt.Errorf("creating temp file: %w", err)
	}

	// Write all memory objects to file
	for _, obj := range w.memoryObjects {
		if err := w.writeObjectToFile(obj); err != nil {
			return fmt.Errorf("writing memory object to file: %w", err)
		}
	}

	// Clear memory objects to free memory
	w.memoryObjects = nil

	return nil
}

// ensureTempFile creates a temporary file if one doesn't exist.
func (w *PackfileWriter) ensureTempFile() error {
	if w.tempFile != nil {
		return nil
	}

	var err error
	w.tempFile, err = os.CreateTemp("", "nanogit-packfile-*.tmp")
	if err != nil {
		return fmt.Errorf("creating temporary file: %w", err)
	}

	return nil
}

// writeObjectToFile writes a single object to the temporary file.
func (w *PackfileWriter) writeObjectToFile(obj PackfileObject) error {
	// Write type and size
	size := len(obj.Data)
	firstByte := byte(obj.Type)<<4 | byte(size&0x0f)
	size >>= 4

	for size > 0 {
		firstByte |= 0x80
		if _, err := w.tempFile.Write([]byte{firstByte}); err != nil {
			return fmt.Errorf("writing object header: %w", err)
		}
		firstByte = byte(size & 0x7f)
		size >>= 7
	}
	if _, err := w.tempFile.Write([]byte{firstByte}); err != nil {
		return fmt.Errorf("writing object header: %w", err)
	}

	// Compress and write data using pooled zlib writer
	// This ensures proper zlib stream boundaries for each Git object
	zw := getPooledZlibWriter(w.tempFile)
	defer returnPooledZlibWriter(zw)
	
	if _, err := zw.Write(obj.Data); err != nil {
		return fmt.Errorf("compressing object data: %w", err)
	}
	if err := zw.Close(); err != nil {
		return fmt.Errorf("closing zlib writer: %w", err)
	}

	return nil
}
