/*
 * SPDX-FileCopyrightText: © Hypermode Inc. <hello@hypermode.com>
 * SPDX-License-Identifier: Apache-2.0
 */

package badger

import (
	"bufio"
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"hash/crc32"
	"io"
	"math"
	"os"
	"path/filepath"
	"sync"

	"google.golang.org/protobuf/proto"

	"github.com/dgraph-io/badger/v4/options"
	"github.com/dgraph-io/badger/v4/pb"
	"github.com/dgraph-io/badger/v4/y"
)

// Manifest represents the contents of the MANIFEST file in a Badger store.
//
// The MANIFEST file describes the startup state of the db -- all LSM files and what level they're
// at.
//
// It consists of a sequence of ManifestChangeSet objects.  Each of these is treated atomically,
// and contains a sequence of ManifestChange's (file creations/deletions) which we use to
// reconstruct the manifest at startup.
type Manifest struct {
	Levels []levelManifest
	Tables map[uint64]TableManifest

	// Contains total number of creation and deletion changes in the manifest -- used to compute
	// whether it'd be useful to rewrite the manifest.
	Creations int
	Deletions int
}

func createManifest() Manifest {
	levels := make([]levelManifest, 0)
	return Manifest{
		Levels: levels,
		Tables: make(map[uint64]TableManifest),
	}
}

// levelManifest contains information about LSM tree levels
// in the MANIFEST file.
type levelManifest struct {
	Tables map[uint64]struct{} // Set of table id's
}

// TableManifest contains information about a specific table
// in the LSM tree.
type TableManifest struct {
	Level       uint8
	KeyID       uint64
	Compression options.CompressionType
}

// manifestFile holds the file pointer (and other info) about the manifest file, which is a log
// file we append to.
type manifestFile struct {
	fp        *os.File
	directory string

	// The external magic number used by the application running badger.
	externalMagic uint16

	// We make this configurable so that unit tests can hit rewrite() code quickly
	deletionsRewriteThreshold int

	// Guards appends, which includes access to the manifest field.
	appendLock sync.Mutex

	// Used to track the current state of the manifest, used when rewriting.
	manifest Manifest

	// Used to indicate if badger was opened in InMemory mode.
	inMemory bool
}

const (
	// ManifestFilename is the filename for the manifest file.
	ManifestFilename                  = "MANIFEST"
	manifestRewriteFilename           = "MANIFEST-REWRITE"
	manifestDeletionsRewriteThreshold = 10000
	manifestDeletionsRatio            = 10
)

// asChanges returns a sequence of changes that could be used to recreate the Manifest in its
// present state.
func (m *Manifest) asChanges() []*pb.ManifestChange {
	changes := make([]*pb.ManifestChange, 0, len(m.Tables))
	for id, tm := range m.Tables {
		changes = append(changes, newCreateChange(id, int(tm.Level), tm.KeyID, tm.Compression))
	}
	return changes
}

func (m *Manifest) clone() Manifest {
	changeSet := pb.ManifestChangeSet{Changes: m.asChanges()}
	ret := createManifest()
	y.Check(applyChangeSet(&ret, &changeSet))
	return ret
}

// openOrCreateManifestFile opens a Badger manifest file if it exists, or creates one if
// doesn’t exists.
func openOrCreateManifestFile(opt Options) (
	ret *manifestFile, result Manifest, err error) {
	if opt.InMemory {
		return &manifestFile{inMemory: true}, Manifest{}, nil
	}
	return helpOpenOrCreateManifestFile(opt.Dir, opt.ReadOnly, opt.ExternalMagicVersion,
		manifestDeletionsRewriteThreshold)
}

func helpOpenOrCreateManifestFile(dir string, readOnly bool, extMagic uint16,
	deletionsThreshold int) (*manifestFile, Manifest, error) {

	path := filepath.Join(dir, ManifestFilename)
	var flags y.Flags
	if readOnly {
		flags |= y.ReadOnly
	}
	fp, err := y.OpenExistingFile(path, flags) // We explicitly sync in addChanges, outside the lock.
	if err != nil {
		if !os.IsNotExist(err) {
			return nil, Manifest{}, err
		}
		if readOnly {
			return nil, Manifest{}, fmt.Errorf("no manifest found, required for read-only db")
		}
		m := createManifest()
		fp, netCreations, err := helpRewrite(dir, &m, extMagic)
		if err != nil {
			return nil, Manifest{}, err
		}
		y.AssertTrue(netCreations == 0)
		mf := &manifestFile{
			fp:                        fp,
			directory:                 dir,
			externalMagic:             extMagic,
			manifest:                  m.clone(),
			deletionsRewriteThreshold: deletionsThreshold,
		}
		return mf, m, nil
	}

	manifest, truncOffset, err := ReplayManifestFile(fp, extMagic)
	if err != nil {
		_ = fp.Close()
		return nil, Manifest{}, err
	}

	if !readOnly {
		// Truncate file so we don't have a half-written entry at the end.
		if err := fp.Truncate(truncOffset); err != nil {
			_ = fp.Close()
			return nil, Manifest{}, err
		}
	}
	if _, err = fp.Seek(0, io.SeekEnd); err != nil {
		_ = fp.Close()
		return nil, Manifest{}, err
	}

	mf := &manifestFile{
		fp:                        fp,
		directory:                 dir,
		externalMagic:             extMagic,
		manifest:                  manifest.clone(),
		deletionsRewriteThreshold: deletionsThreshold,
	}
	return mf, manifest, nil
}

func (mf *manifestFile) close() error {
	if mf.inMemory {
		return nil
	}
	return mf.fp.Close()
}

// addChanges writes a batch of changes, atomically, to the file.  By "atomically" that means when
// we replay the MANIFEST file, we'll either replay all the changes or none of them.  (The truth of
// this depends on the filesystem -- some might append garbage data if a system crash happens at
// the wrong time.)
func (mf *manifestFile) addChanges(changesParam []*pb.ManifestChange) error {
	if mf.inMemory {
		return nil
	}
	changes := pb.ManifestChangeSet{Changes: changesParam}
	buf, err := proto.Marshal(&changes)
	if err != nil {
		return err
	}

	// Maybe we could use O_APPEND instead (on certain file systems)
	mf.appendLock.Lock()
	defer mf.appendLock.Unlock()
	if err := applyChangeSet(&mf.manifest, &changes); err != nil {
		return err
	}
	// Rewrite manifest if it'd shrink by 1/10 and it's big enough to care
	if mf.manifest.Deletions > mf.deletionsRewriteThreshold &&
		mf.manifest.Deletions > manifestDeletionsRatio*(mf.manifest.Creations-mf.manifest.Deletions) {
		if err := mf.rewrite(); err != nil {
			return err
		}
	} else {
		var lenCrcBuf [8]byte
		binary.BigEndian.PutUint32(lenCrcBuf[0:4], uint32(len(buf)))
		binary.BigEndian.PutUint32(lenCrcBuf[4:8], crc32.Checksum(buf, y.CastagnoliCrcTable))
		buf = append(lenCrcBuf[:], buf...)
		if _, err := mf.fp.Write(buf); err != nil {
			return err
		}
	}

	return syncFunc(mf.fp)
}

// this function is saved here to allow injection of fake filesystem latency at test time.
var syncFunc = func(f *os.File) error { return f.Sync() }

// Has to be 4 bytes.  The value can never change, ever, anyway.
var magicText = [4]byte{'B', 'd', 'g', 'r'}

// The magic version number. It is allocated 2 bytes, so it's value must be <= math.MaxUint16
const badgerMagicVersion = 8

func helpRewrite(dir string, m *Manifest, extMagic uint16) (*os.File, int, error) {
	rewritePath := filepath.Join(dir, manifestRewriteFilename)
	// We explicitly sync.
	fp, err := y.OpenTruncFile(rewritePath, false)
	if err != nil {
		return nil, 0, err
	}

	// magic bytes are structured as
	// +---------------------+-------------------------+-----------------------+
	// | magicText (4 bytes) | externalMagic (2 bytes) | badgerMagic (2 bytes) |
	// +---------------------+-------------------------+-----------------------+

	y.AssertTrue(badgerMagicVersion <= math.MaxUint16)
	buf := make([]byte, 8)
	copy(buf[0:4], magicText[:])
	binary.BigEndian.PutUint16(buf[4:6], extMagic)
	binary.BigEndian.PutUint16(buf[6:8], badgerMagicVersion)

	netCreations := len(m.Tables)
	changes := m.asChanges()
	set := pb.ManifestChangeSet{Changes: changes}

	changeBuf, err := proto.Marshal(&set)
	if err != nil {
		fp.Close()
		return nil, 0, err
	}
	var lenCrcBuf [8]byte
	binary.BigEndian.PutUint32(lenCrcBuf[0:4], uint32(len(changeBuf)))
	binary.BigEndian.PutUint32(lenCrcBuf[4:8], crc32.Checksum(changeBuf, y.CastagnoliCrcTable))
	buf = append(buf, lenCrcBuf[:]...)
	buf = append(buf, changeBuf...)
	if _, err := fp.Write(buf); err != nil {
		fp.Close()
		return nil, 0, err
	}
	if err := fp.Sync(); err != nil {
		fp.Close()
		return nil, 0, err
	}

	// In Windows the files should be closed before doing a Rename.
	if err = fp.Close(); err != nil {
		return nil, 0, err
	}
	manifestPath := filepath.Join(dir, ManifestFilename)
	if err := os.Rename(rewritePath, manifestPath); err != nil {
		return nil, 0, err
	}
	fp, err = y.OpenExistingFile(manifestPath, 0)
	if err != nil {
		return nil, 0, err
	}
	if _, err := fp.Seek(0, io.SeekEnd); err != nil {
		fp.Close()
		return nil, 0, err
	}
	if err := syncDir(dir); err != nil {
		fp.Close()
		return nil, 0, err
	}

	return fp, netCreations, nil
}

// Must be called while appendLock is held.
func (mf *manifestFile) rewrite() error {
	// In Windows the files should be closed before doing a Rename.
	if err := mf.fp.Close(); err != nil {
		return err
	}
	fp, netCreations, err := helpRewrite(mf.directory, &mf.manifest, mf.externalMagic)
	if err != nil {
		return err
	}
	mf.fp = fp
	mf.manifest.Creations = netCreations
	mf.manifest.Deletions = 0

	return nil
}

type countingReader struct {
	wrapped *bufio.Reader
	count   int64
}

func (r *countingReader) Read(p []byte) (n int, err error) {
	n, err = r.wrapped.Read(p)
	r.count += int64(n)
	return
}

func (r *countingReader) ReadByte() (b byte, err error) {
	b, err = r.wrapped.ReadByte()
	if err == nil {
		r.count++
	}
	return
}

var (
	errBadMagic    = errors.New("manifest has bad magic")
	errBadChecksum = errors.New("manifest has checksum mismatch")
)

// ReplayManifestFile reads the manifest file and constructs two manifest objects.  (We need one
// immutable copy and one mutable copy of the manifest.  Easiest way is to construct two of them.)
// Also, returns the last offset after a completely read manifest entry -- the file must be
// truncated at that point before further appends are made (if there is a partial entry after
// that).  In normal conditions, truncOffset is the file size.
func ReplayManifestFile(fp *os.File, extMagic uint16) (Manifest, int64, error) {
	r := countingReader{wrapped: bufio.NewReader(fp)}

	var magicBuf [8]byte
	if _, err := io.ReadFull(&r, magicBuf[:]); err != nil {
		return Manifest{}, 0, errBadMagic
	}
	if !bytes.Equal(magicBuf[0:4], magicText[:]) {
		return Manifest{}, 0, errBadMagic
	}

	extVersion := y.BytesToU16(magicBuf[4:6])
	version := y.BytesToU16(magicBuf[6:8])

	if version != badgerMagicVersion {
		return Manifest{}, 0,
			//nolint:lll
			fmt.Errorf("manifest has unsupported version: %d (we support %d).\n"+
				"Please see https://docs.hypermode.com/badger/troubleshooting#i-see-manifest-has-unsupported-version-x-we-support-y-error"+
				" on how to fix this.",
				version, badgerMagicVersion)
	}
	if extVersion != extMagic {
		return Manifest{}, 0,
			fmt.Errorf("Cannot open DB because the external magic number doesn't match. "+
				"Expected: %d, version present in manifest: %d\n", extMagic, extVersion)
	}

	stat, err := fp.Stat()
	if err != nil {
		return Manifest{}, 0, err
	}

	build := createManifest()
	var offset int64
	for {
		offset = r.count
		var lenCrcBuf [8]byte
		_, err := io.ReadFull(&r, lenCrcBuf[:])
		if err != nil {
			if err == io.EOF || err == io.ErrUnexpectedEOF {
				break
			}
			return Manifest{}, 0, err
		}
		length := y.BytesToU32(lenCrcBuf[0:4])
		// Sanity check to ensure we don't over-allocate memory.
		if length > uint32(stat.Size()) {
			return Manifest{}, 0, fmt.Errorf(
				"Buffer length: %d greater than file size: %d. Manifest file might be corrupted",
				length, stat.Size())
		}
		var buf = make([]byte, length)
		if _, err := io.ReadFull(&r, buf); err != nil {
			if err == io.EOF || err == io.ErrUnexpectedEOF {
				break
			}
			return Manifest{}, 0, err
		}
		if crc32.Checksum(buf, y.CastagnoliCrcTable) != y.BytesToU32(lenCrcBuf[4:8]) {
			return Manifest{}, 0, errBadChecksum
		}

		var changeSet pb.ManifestChangeSet
		if err := proto.Unmarshal(buf, &changeSet); err != nil {
			return Manifest{}, 0, err
		}

		if err := applyChangeSet(&build, &changeSet); err != nil {
			return Manifest{}, 0, err
		}
	}

	return build, offset, nil
}

func applyManifestChange(build *Manifest, tc *pb.ManifestChange) error {
	switch tc.Op {
	case pb.ManifestChange_CREATE:
		if _, ok := build.Tables[tc.Id]; ok {
			return fmt.Errorf("MANIFEST invalid, table %d exists", tc.Id)
		}
		build.Tables[tc.Id] = TableManifest{
			Level:       uint8(tc.Level),
			KeyID:       tc.KeyId,
			Compression: options.CompressionType(tc.Compression),
		}
		for len(build.Levels) <= int(tc.Level) {
			build.Levels = append(build.Levels, levelManifest{make(map[uint64]struct{})})
		}
		build.Levels[tc.Level].Tables[tc.Id] = struct{}{}
		build.Creations++
	case pb.ManifestChange_DELETE:
		tm, ok := build.Tables[tc.Id]
		if !ok {
			return fmt.Errorf("MANIFEST removes non-existing table %d", tc.Id)
		}
		delete(build.Levels[tm.Level].Tables, tc.Id)
		delete(build.Tables, tc.Id)
		build.Deletions++
	default:
		return fmt.Errorf("MANIFEST file has invalid manifestChange op")
	}
	return nil
}

// This is not a "recoverable" error -- opening the KV store fails because the MANIFEST file is
// just plain broken.
func applyChangeSet(build *Manifest, changeSet *pb.ManifestChangeSet) error {
	for _, change := range changeSet.Changes {
		if err := applyManifestChange(build, change); err != nil {
			return err
		}
	}
	return nil
}

func newCreateChange(
	id uint64, level int, keyID uint64, c options.CompressionType) *pb.ManifestChange {
	return &pb.ManifestChange{
		Id:    id,
		Op:    pb.ManifestChange_CREATE,
		Level: uint32(level),
		KeyId: keyID,
		// Hard coding it, since we're supporting only AES for now.
		EncryptionAlgo: pb.EncryptionAlgo_aes,
		Compression:    uint32(c),
	}
}

func newDeleteChange(id uint64) *pb.ManifestChange {
	return &pb.ManifestChange{
		Id: id,
		Op: pb.ManifestChange_DELETE,
	}
}
