/*
 * SPDX-FileCopyrightText: © Hypermode Inc. <hello@hypermode.com>
 * SPDX-License-Identifier: Apache-2.0
 */

package badger

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"hash"
	"hash/crc32"
	"io"
	"math"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"

	"github.com/dgraph-io/badger/v4/y"
	"github.com/dgraph-io/ristretto/v2/z"
)

// maxVlogFileSize is the maximum size of the vlog file which can be created. Vlog Offset is of
// uint32, so limiting at max uint32.
var maxVlogFileSize uint32 = math.MaxUint32

// Values have their first byte being byteData or byteDelete. This helps us distinguish between
// a key that has never been seen and a key that has been explicitly deleted.
const (
	bitDelete                 byte = 1 << 0 // Set if the key has been deleted.
	bitValuePointer           byte = 1 << 1 // Set if the value is NOT stored directly next to key.
	bitDiscardEarlierVersions byte = 1 << 2 // Set if earlier versions can be discarded.
	// Set if item shouldn't be discarded via compactions (used by merge operator)
	bitMergeEntry byte = 1 << 3
	// The MSB 2 bits are for transactions.
	bitTxn    byte = 1 << 6 // Set if the entry is part of a txn.
	bitFinTxn byte = 1 << 7 // Set if the entry is to indicate end of txn in value log.

	mi int64 = 1 << 20 //nolint:unused

	// size of vlog header.
	// +----------------+------------------+
	// | keyID(8 bytes) |  baseIV(12 bytes)|
	// +----------------+------------------+
	vlogHeaderSize = 20
)

var errStop = errors.New("Stop iteration")
var errTruncate = errors.New("Do truncate")

type logEntry func(e Entry, vp valuePointer) error

type safeRead struct {
	k []byte
	v []byte

	recordOffset uint32
	lf           *logFile
}

// hashReader implements io.Reader, io.ByteReader interfaces. It also keeps track of the number
// bytes read. The hashReader writes to h (hash) what it reads from r.
type hashReader struct {
	r         io.Reader
	h         hash.Hash32
	bytesRead int // Number of bytes read.
}

func newHashReader(r io.Reader) *hashReader {
	hash := crc32.New(y.CastagnoliCrcTable)
	return &hashReader{
		r: r,
		h: hash,
	}
}

// Read reads len(p) bytes from the reader. Returns the number of bytes read, error on failure.
func (t *hashReader) Read(p []byte) (int, error) {
	n, err := t.r.Read(p)
	if err != nil {
		return n, err
	}
	t.bytesRead += n
	return t.h.Write(p[:n])
}

// ReadByte reads exactly one byte from the reader. Returns error on failure.
func (t *hashReader) ReadByte() (byte, error) {
	b := make([]byte, 1)
	_, err := t.Read(b)
	return b[0], err
}

// Sum32 returns the sum32 of the underlying hash.
func (t *hashReader) Sum32() uint32 {
	return t.h.Sum32()
}

// Entry reads an entry from the provided reader. It also validates the checksum for every entry
// read. Returns error on failure.
func (r *safeRead) Entry(reader io.Reader) (*Entry, error) {
	tee := newHashReader(reader)
	var h header
	hlen, err := h.DecodeFrom(tee)
	if err != nil {
		return nil, err
	}
	if h.klen > uint32(1<<16) { // Key length must be below uint16.
		return nil, errTruncate
	}
	kl := int(h.klen)
	if cap(r.k) < kl {
		r.k = make([]byte, 2*kl)
	}
	vl := int(h.vlen)
	if cap(r.v) < vl {
		r.v = make([]byte, 2*vl)
	}

	e := &Entry{}
	e.offset = r.recordOffset
	e.hlen = hlen
	buf := make([]byte, h.klen+h.vlen)
	if _, err := io.ReadFull(tee, buf[:]); err != nil {
		if err == io.EOF {
			err = errTruncate
		}
		return nil, err
	}
	if r.lf.encryptionEnabled() {
		if buf, err = r.lf.decryptKV(buf[:], r.recordOffset); err != nil {
			return nil, err
		}
	}
	e.Key = buf[:h.klen]
	e.Value = buf[h.klen:]
	var crcBuf [crc32.Size]byte
	if _, err := io.ReadFull(reader, crcBuf[:]); err != nil {
		if err == io.EOF {
			err = errTruncate
		}
		return nil, err
	}
	crc := y.BytesToU32(crcBuf[:])
	if crc != tee.Sum32() {
		return nil, errTruncate
	}
	e.meta = h.meta
	e.UserMeta = h.userMeta
	e.ExpiresAt = h.expiresAt
	return e, nil
}

func (vlog *valueLog) rewrite(f *logFile) error {
	vlog.filesLock.RLock()
	for _, fid := range vlog.filesToBeDeleted {
		if fid == f.fid {
			vlog.filesLock.RUnlock()
			return fmt.Errorf("value log file already marked for deletion fid: %d", fid)
		}
	}
	maxFid := vlog.maxFid
	y.AssertTruef(f.fid < maxFid, "fid to move: %d. Current max fid: %d", f.fid, maxFid)
	vlog.filesLock.RUnlock()

	vlog.opt.Infof("Rewriting fid: %d", f.fid)
	wb := make([]*Entry, 0, 1000)
	var size int64

	y.AssertTrue(vlog.db != nil)
	var count, moved int
	fe := func(e Entry) error {
		count++
		if count%100000 == 0 {
			vlog.opt.Debugf("Processing entry %d", count)
		}

		vs, err := vlog.db.get(e.Key)
		if err != nil {
			return err
		}
		if discardEntry(e, vs, vlog.db) {
			return nil
		}

		// Value is still present in value log.
		if len(vs.Value) == 0 {
			return fmt.Errorf("Empty value: %+v", vs)
		}
		var vp valuePointer
		vp.Decode(vs.Value)

		// If the entry found from the LSM Tree points to a newer vlog file, don't do anything.
		if vp.Fid > f.fid {
			return nil
		}
		// If the entry found from the LSM Tree points to an offset greater than the one
		// read from vlog, don't do anything.
		if vp.Offset > e.offset {
			return nil
		}
		// If the entry read from LSM Tree and vlog file point to the same vlog file and offset,
		// insert them back into the DB.
		// NOTE: It might be possible that the entry read from the LSM Tree points to
		// an older vlog file. See the comments in the else part.
		if vp.Fid == f.fid && vp.Offset == e.offset {
			moved++
			// This new entry only contains the key, and a pointer to the value.
			ne := new(Entry)
			// Remove only the bitValuePointer and transaction markers. We
			// should keep the other bits.
			ne.meta = e.meta &^ (bitValuePointer | bitTxn | bitFinTxn)
			ne.UserMeta = e.UserMeta
			ne.ExpiresAt = e.ExpiresAt
			ne.Key = append([]byte{}, e.Key...)
			ne.Value = append([]byte{}, e.Value...)
			es := ne.estimateSizeAndSetThreshold(vlog.db.valueThreshold())
			// Consider size of value as well while considering the total size
			// of the batch. There have been reports of high memory usage in
			// rewrite because we don't consider the value size. See #1292.
			es += int64(len(e.Value))

			// Ensure length and size of wb is within transaction limits.
			if int64(len(wb)+1) >= vlog.opt.maxBatchCount ||
				size+es >= vlog.opt.maxBatchSize {
				if err := vlog.db.batchSet(wb); err != nil {
					return err
				}
				size = 0
				wb = wb[:0]
			}
			wb = append(wb, ne)
			size += es
		} else { //nolint:staticcheck
			// It might be possible that the entry read from LSM Tree points to
			// an older vlog file.  This can happen in the following situation.
			// Assume DB is opened with
			// numberOfVersionsToKeep=1
			//
			// Now, if we have ONLY one key in the system "FOO" which has been
			// updated 3 times and the same key has been garbage collected 3
			// times, we'll have 3 versions of the movekey
			// for the same key "FOO".
			//
			// NOTE: moveKeyi is the gc'ed version of the original key with version i
			// We're calling the gc'ed keys as moveKey to simplify the
			// explanantion. We used to add move keys but we no longer do that.
			//
			// Assume we have 3 move keys in L0.
			// - moveKey1 (points to vlog file 10),
			// - moveKey2 (points to vlog file 14) and
			// - moveKey3 (points to vlog file 15).
			//
			// Also, assume there is another move key "moveKey1" (points to
			// vlog file 6) (this is also a move Key for key "FOO" ) on upper
			// levels (let's say 3). The move key "moveKey1" on level 0 was
			// inserted because vlog file 6 was GCed.
			//
			// Here's what the arrangement looks like
			// L0 => (moveKey1 => vlog10), (moveKey2 => vlog14), (moveKey3 => vlog15)
			// L1 => ....
			// L2 => ....
			// L3 => (moveKey1 => vlog6)
			//
			// When L0 compaction runs, it keeps only moveKey3 because the number of versions
			// to keep is set to 1. (we've dropped moveKey1's latest version)
			//
			// The new arrangement of keys is
			// L0 => ....
			// L1 => (moveKey3 => vlog15)
			// L2 => ....
			// L3 => (moveKey1 => vlog6)
			//
			// Now if we try to GC vlog file 10, the entry read from vlog file
			// will point to vlog10 but the entry read from LSM Tree will point
			// to vlog6. The move key read from LSM tree will point to vlog6
			// because we've asked for version 1 of the move key.
			//
			// This might seem like an issue but it's not really an issue
			// because the user has set the number of versions to keep to 1 and
			// the latest version of moveKey points to the correct vlog file
			// and offset. The stale move key on L3 will be eventually dropped
			// by compaction because there is a newer versions in the upper
			// levels.
		}
		return nil
	}

	_, err := f.iterate(vlog.opt.ReadOnly, 0, func(e Entry, vp valuePointer) error {
		return fe(e)
	})
	if err != nil {
		return err
	}

	batchSize := 1024
	var loops int
	for i := 0; i < len(wb); {
		loops++
		if batchSize == 0 {
			vlog.db.opt.Warningf("We shouldn't reach batch size of zero.")
			return ErrNoRewrite
		}
		end := i + batchSize
		if end > len(wb) {
			end = len(wb)
		}
		if err := vlog.db.batchSet(wb[i:end]); err != nil {
			if err == ErrTxnTooBig {
				// Decrease the batch size to half.
				batchSize = batchSize / 2
				continue
			}
			return err
		}
		i += batchSize
	}
	vlog.opt.Infof("Processed %d entries in %d loops", len(wb), loops)
	vlog.opt.Infof("Total entries: %d. Moved: %d", count, moved)
	vlog.opt.Infof("Removing fid: %d", f.fid)
	var deleteFileNow bool
	// Entries written to LSM. Remove the older file now.
	{
		vlog.filesLock.Lock()
		// Just a sanity-check.
		if _, ok := vlog.filesMap[f.fid]; !ok {
			vlog.filesLock.Unlock()
			return fmt.Errorf("Unable to find fid: %d", f.fid)
		}
		if vlog.iteratorCount() == 0 {
			delete(vlog.filesMap, f.fid)
			deleteFileNow = true
		} else {
			vlog.filesToBeDeleted = append(vlog.filesToBeDeleted, f.fid)
		}
		vlog.filesLock.Unlock()
	}

	if deleteFileNow {
		if err := vlog.deleteLogFile(f); err != nil {
			return err
		}
	}
	return nil
}

func (vlog *valueLog) incrIteratorCount() {
	vlog.numActiveIterators.Add(1)
}

func (vlog *valueLog) iteratorCount() int {
	return int(vlog.numActiveIterators.Load())
}

func (vlog *valueLog) decrIteratorCount() error {
	num := vlog.numActiveIterators.Add(-1)
	if num != 0 {
		return nil
	}

	vlog.filesLock.Lock()
	lfs := make([]*logFile, 0, len(vlog.filesToBeDeleted))
	for _, id := range vlog.filesToBeDeleted {
		lfs = append(lfs, vlog.filesMap[id])
		delete(vlog.filesMap, id)
	}
	vlog.filesToBeDeleted = nil
	vlog.filesLock.Unlock()

	for _, lf := range lfs {
		if err := vlog.deleteLogFile(lf); err != nil {
			return err
		}
	}
	return nil
}

func (vlog *valueLog) deleteLogFile(lf *logFile) error {
	if lf == nil {
		return nil
	}
	lf.lock.Lock()
	defer lf.lock.Unlock()
	// Delete fid from discard stats as well.
	vlog.discardStats.Update(lf.fid, -1)

	return lf.Delete()
}

func (vlog *valueLog) dropAll() (int, error) {
	// If db is opened in InMemory mode, we don't need to do anything since there are no vlog files.
	if vlog.db.opt.InMemory {
		return 0, nil
	}
	// We don't want to block dropAll on any pending transactions. So, don't worry about iterator
	// count.
	var count int
	deleteAll := func() error {
		vlog.filesLock.Lock()
		defer vlog.filesLock.Unlock()
		for _, lf := range vlog.filesMap {
			if err := vlog.deleteLogFile(lf); err != nil {
				return err
			}
			count++
		}
		vlog.filesMap = make(map[uint32]*logFile)
		vlog.maxFid = 0
		return nil
	}
	if err := deleteAll(); err != nil {
		return count, err
	}

	vlog.db.opt.Infof("Value logs deleted. Creating value log file: 1")
	if _, err := vlog.createVlogFile(); err != nil { // Called while writes are stopped.
		return count, err
	}
	return count, nil
}

func (db *DB) valueThreshold() int64 {
	return db.threshold.valueThreshold.Load()
}

type valueLog struct {
	dirPath string

	// guards our view of which files exist, which to be deleted, how many active iterators
	filesLock        sync.RWMutex
	filesMap         map[uint32]*logFile
	maxFid           uint32
	filesToBeDeleted []uint32
	// A refcount of iterators -- when this hits zero, we can delete the filesToBeDeleted.
	numActiveIterators atomic.Int32

	db                *DB
	writableLogOffset atomic.Uint32 // read by read, written by write
	numEntriesWritten uint32
	opt               Options

	garbageCh    chan struct{}
	discardStats *discardStats
}

func vlogFilePath(dirPath string, fid uint32) string {
	return fmt.Sprintf("%s%s%06d.vlog", dirPath, string(os.PathSeparator), fid)
}

func (vlog *valueLog) fpath(fid uint32) string {
	return vlogFilePath(vlog.dirPath, fid)
}

func (vlog *valueLog) populateFilesMap() error {
	vlog.filesMap = make(map[uint32]*logFile)

	files, err := os.ReadDir(vlog.dirPath)
	if err != nil {
		return errFile(err, vlog.dirPath, "Unable to open log dir.")
	}

	found := make(map[uint64]struct{})
	for _, file := range files {
		if !strings.HasSuffix(file.Name(), ".vlog") {
			continue
		}
		fsz := len(file.Name())
		fid, err := strconv.ParseUint(file.Name()[:fsz-5], 10, 32)
		if err != nil {
			return errFile(err, file.Name(), "Unable to parse log id.")
		}
		if _, ok := found[fid]; ok {
			return errFile(err, file.Name(), "Duplicate file found. Please delete one.")
		}
		found[fid] = struct{}{}

		lf := &logFile{
			fid:      uint32(fid),
			path:     vlog.fpath(uint32(fid)),
			registry: vlog.db.registry,
		}
		vlog.filesMap[uint32(fid)] = lf
		if vlog.maxFid < uint32(fid) {
			vlog.maxFid = uint32(fid)
		}
	}
	return nil
}

func (vlog *valueLog) createVlogFile() (*logFile, error) {
	fid := vlog.maxFid + 1
	path := vlog.fpath(fid)
	lf := &logFile{
		fid:      fid,
		path:     path,
		registry: vlog.db.registry,
		writeAt:  vlogHeaderSize,
		opt:      vlog.opt,
	}
	err := lf.open(path, os.O_RDWR|os.O_CREATE|os.O_EXCL, 2*vlog.opt.ValueLogFileSize)
	if err != z.NewFile && err != nil {
		return nil, err
	}

	vlog.filesLock.Lock()
	vlog.filesMap[fid] = lf
	y.AssertTrue(vlog.maxFid < fid)
	vlog.maxFid = fid
	// writableLogOffset is only written by write func, by read by Read func.
	// To avoid a race condition, all reads and updates to this variable must be
	// done via atomics.
	vlog.writableLogOffset.Store(vlogHeaderSize)
	vlog.numEntriesWritten = 0
	vlog.filesLock.Unlock()

	return lf, nil
}

func errFile(err error, path string, msg string) error {
	return fmt.Errorf("%s. Path=%s. Error=%v", msg, path, err)
}

// init initializes the value log struct. This initialization needs to happen
// before compactions start.
func (vlog *valueLog) init(db *DB) {
	vlog.opt = db.opt
	vlog.db = db
	// We don't need to open any vlog files or collect stats for GC if DB is opened
	// in InMemory mode. InMemory mode doesn't create any files/directories on disk.
	if vlog.opt.InMemory {
		return
	}
	vlog.dirPath = vlog.opt.ValueDir

	vlog.garbageCh = make(chan struct{}, 1) // Only allow one GC at a time.
	lf, err := InitDiscardStats(vlog.opt)
	y.Check(err)
	vlog.discardStats = lf
	// See TestPersistLFDiscardStats for purpose of statement below.
	db.logToSyncChan(endVLogInitMsg)
}

func (vlog *valueLog) open(db *DB) error {
	// We don't need to open any vlog files or collect stats for GC if DB is opened
	// in InMemory mode. InMemory mode doesn't create any files/directories on disk.
	if db.opt.InMemory {
		return nil
	}

	if err := vlog.populateFilesMap(); err != nil {
		return err
	}
	// If no files are found, then create a new file.
	if len(vlog.filesMap) == 0 {
		if vlog.opt.ReadOnly {
			return nil
		}
		_, err := vlog.createVlogFile()
		return y.Wrapf(err, "Error while creating log file in valueLog.open")
	}
	fids := vlog.sortedFids()
	for _, fid := range fids {
		lf, ok := vlog.filesMap[fid]
		y.AssertTrue(ok)

		// Just open in RDWR mode. This should not create a new log file.
		lf.opt = vlog.opt
		if err := lf.open(vlog.fpath(fid), os.O_RDWR,
			2*vlog.opt.ValueLogFileSize); err != nil {
			return y.Wrapf(err, "Open existing file: %q", lf.path)
		}
		// We shouldn't delete the maxFid file.
		if lf.size.Load() == vlogHeaderSize && fid != vlog.maxFid {
			vlog.opt.Infof("Deleting empty file: %s", lf.path)
			if err := lf.Delete(); err != nil {
				return y.Wrapf(err, "while trying to delete empty file: %s", lf.path)
			}
			delete(vlog.filesMap, fid)
		}
	}

	if vlog.opt.ReadOnly {
		return nil
	}
	// Now we can read the latest value log file, and see if it needs truncation. We could
	// technically do this over all the value log files, but that would mean slowing down the value
	// log open.
	last, ok := vlog.filesMap[vlog.maxFid]
	y.AssertTrue(ok)
	lastOff, err := last.iterate(vlog.opt.ReadOnly, vlogHeaderSize,
		func(_ Entry, vp valuePointer) error {
			return nil
		})
	if err != nil {
		return y.Wrapf(err, "while iterating over: %s", last.path)
	}
	if err := last.Truncate(int64(lastOff)); err != nil {
		return y.Wrapf(err, "while truncating last value log file: %s", last.path)
	}

	// Don't write to the old log file. Always create a new one.
	if _, err := vlog.createVlogFile(); err != nil {
		return y.Wrapf(err, "Error while creating log file in valueLog.open")
	}
	return nil
}

func (vlog *valueLog) Close() error {
	if vlog == nil || vlog.db == nil || vlog.db.opt.InMemory {
		return nil
	}

	vlog.opt.Debugf("Stopping garbage collection of values.")
	var err error
	for id, lf := range vlog.filesMap {
		lf.lock.Lock() // We won’t release the lock.
		offset := int64(-1)

		if !vlog.opt.ReadOnly && id == vlog.maxFid {
			offset = int64(vlog.woffset())
		}
		if terr := lf.Close(offset); terr != nil && err == nil {
			err = terr
		}
	}
	if vlog.discardStats != nil {
		vlog.db.captureDiscardStats()
		if terr := vlog.discardStats.Close(-1); terr != nil && err == nil {
			err = terr
		}
	}
	return err
}

// sortedFids returns the file id's not pending deletion, sorted.  Assumes we have shared access to
// filesMap.
func (vlog *valueLog) sortedFids() []uint32 {
	toBeDeleted := make(map[uint32]struct{})
	for _, fid := range vlog.filesToBeDeleted {
		toBeDeleted[fid] = struct{}{}
	}
	ret := make([]uint32, 0, len(vlog.filesMap))
	for fid := range vlog.filesMap {
		if _, ok := toBeDeleted[fid]; !ok {
			ret = append(ret, fid)
		}
	}
	sort.Slice(ret, func(i, j int) bool {
		return ret[i] < ret[j]
	})
	return ret
}

type request struct {
	// Input values
	Entries []*Entry
	// Output values and wait group stuff below
	Ptrs []valuePointer
	Wg   sync.WaitGroup
	Err  error
	ref  atomic.Int32
}

func (req *request) reset() {
	req.Entries = req.Entries[:0]
	req.Ptrs = req.Ptrs[:0]
	req.Wg = sync.WaitGroup{}
	req.Err = nil
	req.ref.Store(0)
}

func (req *request) IncrRef() {
	req.ref.Add(1)
}

func (req *request) DecrRef() {
	nRef := req.ref.Add(-1)
	if nRef > 0 {
		return
	}
	req.Entries = nil
	requestPool.Put(req)
}

func (req *request) Wait() error {
	req.Wg.Wait()
	err := req.Err
	req.DecrRef() // DecrRef after writing to DB.
	return err
}

type requests []*request

func (reqs requests) DecrRef() {
	for _, req := range reqs {
		req.DecrRef()
	}
}

func (reqs requests) IncrRef() {
	for _, req := range reqs {
		req.IncrRef()
	}
}

// sync function syncs content of latest value log file to disk. Syncing of value log directory is
// not required here as it happens every time a value log file rotation happens(check createVlogFile
// function). During rotation, previous value log file also gets synced to disk. It only syncs file
// if fid >= vlog.maxFid. In some cases such as replay(while opening db), it might be called with
// fid < vlog.maxFid. To sync irrespective of file id just call it with math.MaxUint32.
func (vlog *valueLog) sync() error {
	if vlog.opt.SyncWrites || vlog.opt.InMemory {
		return nil
	}

	vlog.filesLock.RLock()
	maxFid := vlog.maxFid
	curlf := vlog.filesMap[maxFid]
	// Sometimes it is possible that vlog.maxFid has been increased but file creation
	// with same id is still in progress and this function is called. In those cases
	// entry for the file might not be present in vlog.filesMap.
	if curlf == nil {
		vlog.filesLock.RUnlock()
		return nil
	}
	curlf.lock.RLock()
	vlog.filesLock.RUnlock()

	err := curlf.Sync()
	curlf.lock.RUnlock()
	return err
}

func (vlog *valueLog) woffset() uint32 {
	return vlog.writableLogOffset.Load()
}

// validateWrites will check whether the given requests can fit into 4GB vlog file.
// NOTE: 4GB is the maximum size we can create for vlog because value pointer offset is of type
// uint32. If we create more than 4GB, it will overflow uint32. So, limiting the size to 4GB.
func (vlog *valueLog) validateWrites(reqs []*request) error {
	vlogOffset := uint64(vlog.woffset())
	for _, req := range reqs {
		// calculate size of the request.
		size := estimateRequestSize(req)
		estimatedVlogOffset := vlogOffset + size
		if estimatedVlogOffset > uint64(maxVlogFileSize) {
			return fmt.Errorf("Request size offset %d is bigger than maximum offset %d",
				estimatedVlogOffset, maxVlogFileSize)
		}

		if estimatedVlogOffset >= uint64(vlog.opt.ValueLogFileSize) {
			// We'll create a new vlog file if the estimated offset is greater or equal to
			// max vlog size. So, resetting the vlogOffset.
			vlogOffset = 0
			continue
		}
		// Estimated vlog offset will become current vlog offset if the vlog is not rotated.
		vlogOffset = estimatedVlogOffset
	}
	return nil
}

// estimateRequestSize returns the size that needed to be written for the given request.
func estimateRequestSize(req *request) uint64 {
	size := uint64(0)
	for _, e := range req.Entries {
		size += uint64(maxHeaderSize + len(e.Key) + len(e.Value) + crc32.Size)
	}
	return size
}

// write is thread-unsafe by design and should not be called concurrently.
func (vlog *valueLog) write(reqs []*request) error {
	if vlog.db.opt.InMemory {
		return nil
	}
	// Validate writes before writing to vlog. Because, we don't want to partially write and return
	// an error.
	if err := vlog.validateWrites(reqs); err != nil {
		return y.Wrapf(err, "while validating writes")
	}

	vlog.filesLock.RLock()
	maxFid := vlog.maxFid
	curlf := vlog.filesMap[maxFid]
	vlog.filesLock.RUnlock()

	defer func() {
		if vlog.opt.SyncWrites {
			if err := curlf.Sync(); err != nil {
				vlog.opt.Errorf("Error while curlf sync: %v\n", err)
			}
		}
	}()

	write := func(buf *bytes.Buffer) error {
		if buf.Len() == 0 {
			return nil
		}

		n := uint32(buf.Len())
		endOffset := vlog.writableLogOffset.Add(n)
		// Increase the file size if we cannot accommodate this entry.
		// [Aman] Should this be >= or just >? Doesn't make sense to extend the file if it big enough already.
		if int(endOffset) >= len(curlf.Data) {
			if err := curlf.Truncate(int64(endOffset)); err != nil {
				return err
			}
		}

		start := int(endOffset - n)
		y.AssertTrue(copy(curlf.Data[start:], buf.Bytes()) == int(n))

		curlf.size.Store(endOffset)
		return nil
	}

	toDisk := func() error {
		if vlog.woffset() > uint32(vlog.opt.ValueLogFileSize) ||
			vlog.numEntriesWritten > vlog.opt.ValueLogMaxEntries {
			if err := curlf.doneWriting(vlog.woffset()); err != nil {
				return err
			}

			newlf, err := vlog.createVlogFile()
			if err != nil {
				return err
			}
			curlf = newlf
		}
		return nil
	}

	buf := new(bytes.Buffer)
	for i := range reqs {
		b := reqs[i]
		b.Ptrs = b.Ptrs[:0]
		var written, bytesWritten int
		valueSizes := make([]int64, 0, len(b.Entries))
		for j := range b.Entries {
			buf.Reset()

			e := b.Entries[j]
			valueSizes = append(valueSizes, int64(len(e.Value)))
			if e.skipVlogAndSetThreshold(vlog.db.valueThreshold()) {
				b.Ptrs = append(b.Ptrs, valuePointer{})
				continue
			}
			var p valuePointer

			p.Fid = curlf.fid
			p.Offset = vlog.woffset()

			// We should not store transaction marks in the vlog file because it will never have all
			// the entries in a transaction. If we store entries with transaction marks then value
			// GC will not be able to iterate on the entire vlog file.
			// But, we still want the entry to stay intact for the memTable WAL. So, store the meta
			// in a temporary variable and reassign it after writing to the value log.
			tmpMeta := e.meta
			e.meta = e.meta &^ (bitTxn | bitFinTxn)
			plen, err := curlf.encodeEntry(buf, e, p.Offset) // Now encode the entry into buffer.
			if err != nil {
				return err
			}
			// Restore the meta.
			e.meta = tmpMeta

			p.Len = uint32(plen)
			b.Ptrs = append(b.Ptrs, p)
			if err := write(buf); err != nil {
				return err
			}
			written++
			bytesWritten += buf.Len()
			// No need to flush anything, we write to file directly via mmap.
		}
		y.NumWritesVlogAdd(vlog.opt.MetricsEnabled, int64(written))
		y.NumBytesWrittenVlogAdd(vlog.opt.MetricsEnabled, int64(bytesWritten))

		vlog.numEntriesWritten += uint32(written)
		vlog.db.threshold.update(valueSizes)
		// We write to disk here so that all entries that are part of the same transaction are
		// written to the same vlog file.
		if err := toDisk(); err != nil {
			return err
		}
	}
	return toDisk()
}

// Gets the logFile and acquires and RLock() for the mmap. You must call RUnlock on the file
// (if non-nil)
func (vlog *valueLog) getFileRLocked(vp valuePointer) (*logFile, error) {
	vlog.filesLock.RLock()
	defer vlog.filesLock.RUnlock()
	ret, ok := vlog.filesMap[vp.Fid]
	if !ok {
		// log file has gone away, we can't do anything. Return.
		return nil, fmt.Errorf("file with ID: %d not found", vp.Fid)
	}

	// Check for valid offset if we are reading from writable log.
	maxFid := vlog.maxFid
	// In read-only mode we don't need to check for writable offset as we are not writing anything.
	// Moreover, this offset is not set in readonly mode.
	if !vlog.opt.ReadOnly && vp.Fid == maxFid {
		currentOffset := vlog.woffset()
		if vp.Offset >= currentOffset {
			return nil, fmt.Errorf(
				"Invalid value pointer offset: %d greater than current offset: %d",
				vp.Offset, currentOffset)
		}
	}

	ret.lock.RLock()
	return ret, nil
}

// Read reads the value log at a given location.
// TODO: Make this read private.
func (vlog *valueLog) Read(vp valuePointer, _ *y.Slice) ([]byte, func(), error) {
	buf, lf, err := vlog.readValueBytes(vp)
	// log file is locked so, decide whether to lock immediately or let the caller to
	// unlock it, after caller uses it.
	cb := vlog.getUnlockCallback(lf)
	if err != nil {
		return nil, cb, err
	}

	if vlog.opt.VerifyValueChecksum {
		hash := crc32.New(y.CastagnoliCrcTable)
		if _, err := hash.Write(buf[:len(buf)-crc32.Size]); err != nil {
			runCallback(cb)
			return nil, nil, y.Wrapf(err, "failed to write hash for vp %+v", vp)
		}
		// Fetch checksum from the end of the buffer.
		checksum := buf[len(buf)-crc32.Size:]
		if hash.Sum32() != y.BytesToU32(checksum) {
			runCallback(cb)
			return nil, nil, y.Wrapf(y.ErrChecksumMismatch, "value corrupted for vp: %+v", vp)
		}
	}
	var h header
	headerLen := h.Decode(buf)
	kv := buf[headerLen:]
	if lf.encryptionEnabled() {
		kv, err = lf.decryptKV(kv, vp.Offset)
		if err != nil {
			return nil, cb, err
		}
	}
	if uint32(len(kv)) < h.klen+h.vlen {
		vlog.db.opt.Errorf("Invalid read: vp: %+v", vp)
		return nil, nil, fmt.Errorf("Invalid read: Len: %d read at:[%d:%d]",
			len(kv), h.klen, h.klen+h.vlen)
	}
	return kv[h.klen : h.klen+h.vlen], cb, nil
}

// getUnlockCallback will returns a function which unlock the logfile if the logfile is mmaped.
// otherwise, it unlock the logfile and return nil.
func (vlog *valueLog) getUnlockCallback(lf *logFile) func() {
	if lf == nil {
		return nil
	}
	return lf.lock.RUnlock
}

// readValueBytes return vlog entry slice and read locked log file. Caller should take care of
// logFile unlocking.
func (vlog *valueLog) readValueBytes(vp valuePointer) ([]byte, *logFile, error) {
	lf, err := vlog.getFileRLocked(vp)
	if err != nil {
		return nil, nil, err
	}

	buf, err := lf.read(vp)
	y.NumReadsVlogAdd(vlog.db.opt.MetricsEnabled, 1)
	y.NumBytesReadsVlogAdd(vlog.db.opt.MetricsEnabled, int64(len(buf)))
	return buf, lf, err
}

func (vlog *valueLog) pickLog(discardRatio float64) *logFile {
	vlog.filesLock.RLock()
	defer vlog.filesLock.RUnlock()

LOOP:
	// Pick a candidate that contains the largest amount of discardable data
	fid, discard := vlog.discardStats.MaxDiscard()

	// MaxDiscard will return fid=0 if it doesn't have any discard data. The
	// vlog files start from 1.
	if fid == 0 {
		vlog.opt.Debugf("No file with discard stats")
		return nil
	}
	lf, ok := vlog.filesMap[fid]
	// This file was deleted but it's discard stats increased because of compactions. The file
	// doesn't exist so we don't need to do anything. Skip it and retry.
	if !ok {
		vlog.discardStats.Update(fid, -1)
		goto LOOP
	}
	// We have a valid file.
	fi, err := lf.Fd.Stat()
	if err != nil {
		vlog.opt.Errorf("Unable to get stats for value log fid: %d err: %+v", fi, err)
		return nil
	}
	if thr := discardRatio * float64(fi.Size()); float64(discard) < thr {
		vlog.opt.Debugf("Discard: %d less than threshold: %.0f for file: %s",
			discard, thr, fi.Name())
		return nil
	}
	if fid < vlog.maxFid {
		vlog.opt.Infof("Found value log max discard fid: %d discard: %d\n", fid, discard)
		lf, ok := vlog.filesMap[fid]
		y.AssertTrue(ok)
		return lf
	}

	// Don't randomly pick any value log file.
	return nil
}

func discardEntry(e Entry, vs y.ValueStruct, db *DB) bool {
	if vs.Version != y.ParseTs(e.Key) {
		// Version not found. Discard.
		return true
	}
	if isDeletedOrExpired(vs.Meta, vs.ExpiresAt) {
		return true
	}
	if (vs.Meta & bitValuePointer) == 0 {
		// Key also stores the value in LSM. Discard.
		return true
	}
	if (vs.Meta & bitFinTxn) > 0 {
		// Just a txn finish entry. Discard.
		return true
	}
	return false
}

func (vlog *valueLog) doRunGC(lf *logFile) error {
	_, span := otel.Tracer("").Start(context.TODO(), "Badger.GC")
	span.SetAttributes(attribute.String("GC rewrite for", lf.path))
	defer span.End()
	if err := vlog.rewrite(lf); err != nil {
		return err
	}
	// Remove the file from discardStats.
	vlog.discardStats.Update(lf.fid, -1)
	return nil
}

func (vlog *valueLog) waitOnGC(lc *z.Closer) {
	defer lc.Done()

	<-lc.HasBeenClosed() // Wait for lc to be closed.

	// Block any GC in progress to finish, and don't allow any more writes to runGC by filling up
	// the channel of size 1.
	vlog.garbageCh <- struct{}{}
}

func (vlog *valueLog) runGC(discardRatio float64) error {
	select {
	case vlog.garbageCh <- struct{}{}:
		// Pick a log file for GC.
		defer func() {
			<-vlog.garbageCh
		}()

		lf := vlog.pickLog(discardRatio)
		if lf == nil {
			return ErrNoRewrite
		}
		return vlog.doRunGC(lf)
	default:
		return ErrRejected
	}
}

func (vlog *valueLog) updateDiscardStats(stats map[uint32]int64) {
	if vlog.opt.InMemory {
		return
	}
	for fid, discard := range stats {
		vlog.discardStats.Update(fid, discard)
	}
	// The following is to coordinate with some test cases where we want to
	// verify that at least one iteration of updateDiscardStats has been completed.
	vlog.db.logToSyncChan(updateDiscardStatsMsg)
}

type vlogThreshold struct {
	logger         Logger
	percentile     float64
	valueThreshold atomic.Int64
	valueCh        chan []int64
	clearCh        chan bool
	closer         *z.Closer
	// Metrics contains a running log of statistics like amount of data stored etc.
	vlMetrics *z.HistogramData
}

func initVlogThreshold(opt *Options) *vlogThreshold {
	getBounds := func() []float64 {
		mxbd := opt.maxValueThreshold
		mnbd := float64(opt.ValueThreshold)
		y.AssertTruef(mxbd >= mnbd, "maximum threshold bound is less than the min threshold")
		size := math.Min(mxbd-mnbd+1, 1024.0)
		bdstp := (mxbd - mnbd) / size
		bounds := make([]float64, int64(size))
		for i := range bounds {
			if i == 0 {
				bounds[0] = mnbd
				continue
			}
			if i == int(size-1) {
				bounds[i] = mxbd
				continue
			}
			bounds[i] = bounds[i-1] + bdstp
		}
		return bounds
	}
	lt := &vlogThreshold{
		logger:     opt.Logger,
		percentile: opt.VLogPercentile,
		valueCh:    make(chan []int64, 1000),
		clearCh:    make(chan bool, 1),
		closer:     z.NewCloser(1),
		vlMetrics:  z.NewHistogramData(getBounds()),
	}
	lt.valueThreshold.Store(opt.ValueThreshold)
	return lt
}

func (v *vlogThreshold) Clear(opt Options) {
	v.valueThreshold.Store(opt.ValueThreshold)
	v.clearCh <- true
}

func (v *vlogThreshold) update(sizes []int64) {
	v.valueCh <- sizes
}

func (v *vlogThreshold) close() {
	v.closer.SignalAndWait()
}

func (v *vlogThreshold) listenForValueThresholdUpdate() {
	defer v.closer.Done()
	for {
		select {
		case <-v.closer.HasBeenClosed():
			return
		case val := <-v.valueCh:
			for _, e := range val {
				v.vlMetrics.Update(e)
			}
			// we are making it to get Options.VlogPercentile so that values with sizes
			// in range of Options.VlogPercentile will make it to the LSM tree and rest to the
			// value log file.
			p := int64(v.vlMetrics.Percentile(v.percentile))
			if v.valueThreshold.Load() != p {
				if v.logger != nil {
					v.logger.Infof("updating value of threshold to: %d", p)
				}
				v.valueThreshold.Store(p)
			}
		case <-v.clearCh:
			v.vlMetrics.Clear()
		}
	}
}
