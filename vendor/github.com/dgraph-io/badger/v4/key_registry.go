/*
 * SPDX-FileCopyrightText: © Hypermode Inc. <hello@hypermode.com>
 * SPDX-License-Identifier: Apache-2.0
 */

package badger

import (
	"bytes"
	"crypto/aes"
	"crypto/rand"
	"encoding/binary"
	"hash/crc32"
	"io"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/dgraph-io/badger/v4/pb"
	"github.com/dgraph-io/badger/v4/y"
	"google.golang.org/protobuf/proto"
)

const (
	// KeyRegistryFileName is the file name for the key registry file.
	KeyRegistryFileName = "KEYREGISTRY"
	// KeyRegistryRewriteFileName is the file name for the rewrite key registry file.
	KeyRegistryRewriteFileName = "REWRITE-KEYREGISTRY"
)

// SanityText is used to check whether the given user provided storage key is valid or not
var sanityText = []byte("Hello Badger")

// KeyRegistry used to maintain all the data keys.
type KeyRegistry struct {
	sync.RWMutex
	dataKeys    map[uint64]*pb.DataKey
	lastCreated int64 //lastCreated is the timestamp(seconds) of the last data key generated.
	nextKeyID   uint64
	fp          *os.File
	opt         KeyRegistryOptions
}

type KeyRegistryOptions struct {
	Dir                           string
	ReadOnly                      bool
	EncryptionKey                 []byte
	EncryptionKeyRotationDuration time.Duration
	InMemory                      bool
}

// newKeyRegistry returns KeyRegistry.
func newKeyRegistry(opt KeyRegistryOptions) *KeyRegistry {
	return &KeyRegistry{
		dataKeys:  make(map[uint64]*pb.DataKey),
		nextKeyID: 0,
		opt:       opt,
	}
}

// OpenKeyRegistry opens key registry if it exists, otherwise it'll create key registry
// and returns key registry.
func OpenKeyRegistry(opt KeyRegistryOptions) (*KeyRegistry, error) {
	// sanity check the encryption key length.
	if len(opt.EncryptionKey) > 0 {
		switch len(opt.EncryptionKey) {
		default:
			return nil, y.Wrapf(ErrInvalidEncryptionKey, "During OpenKeyRegistry")
		case 16, 24, 32:
			break
		}
	}
	// If db is opened in InMemory mode, we don't need to write key registry to the disk.
	if opt.InMemory {
		return newKeyRegistry(opt), nil
	}
	path := filepath.Join(opt.Dir, KeyRegistryFileName)
	var flags y.Flags
	if opt.ReadOnly {
		flags |= y.ReadOnly
	} else {
		flags |= y.Sync
	}
	fp, err := y.OpenExistingFile(path, flags)
	// OpenExistingFile just open file.
	// So checking whether the file exist or not. If not
	// We'll create new keyregistry.
	if os.IsNotExist(err) {
		// Creating new registry file if not exist.
		kr := newKeyRegistry(opt)
		if opt.ReadOnly {
			return kr, nil
		}
		// Writing the key registry to the file.
		if err := WriteKeyRegistry(kr, opt); err != nil {
			return nil, y.Wrapf(err, "Error while writing key registry.")
		}
		fp, err = y.OpenExistingFile(path, flags)
		if err != nil {
			return nil, y.Wrapf(err, "Error while opening newly created key registry.")
		}
	} else if err != nil {
		return nil, y.Wrapf(err, "Error while opening key registry.")
	}
	kr, err := readKeyRegistry(fp, opt)
	if err != nil {
		// This case happens only if the file is opened properly and
		// not able to read.
		fp.Close()
		return nil, err
	}
	if opt.ReadOnly {
		// We'll close the file in readonly mode.
		return kr, fp.Close()
	}
	kr.fp = fp
	return kr, nil
}

// keyRegistryIterator reads all the datakey from the key registry
type keyRegistryIterator struct {
	encryptionKey []byte
	fp            *os.File
	// lenCrcBuf contains crc buf and data length to move forward.
	lenCrcBuf [8]byte
}

// newKeyRegistryIterator returns iterator which will allow you to iterate
// over the data key of the key registry.
func newKeyRegistryIterator(fp *os.File, encryptionKey []byte) (*keyRegistryIterator, error) {
	return &keyRegistryIterator{
		encryptionKey: encryptionKey,
		fp:            fp,
		lenCrcBuf:     [8]byte{},
	}, validRegistry(fp, encryptionKey)
}

// validRegistry checks that given encryption key is valid or not.
func validRegistry(fp *os.File, encryptionKey []byte) error {
	iv := make([]byte, aes.BlockSize)
	var err error
	if _, err = fp.Read(iv); err != nil {
		return y.Wrapf(err, "Error while reading IV for key registry.")
	}
	eSanityText := make([]byte, len(sanityText))
	if _, err = fp.Read(eSanityText); err != nil {
		return y.Wrapf(err, "Error while reading sanity text.")
	}
	if len(encryptionKey) > 0 {
		// Decrypting sanity text.
		if eSanityText, err = y.XORBlockAllocate(eSanityText, encryptionKey, iv); err != nil {
			return y.Wrapf(err, "During validRegistry")
		}
	}
	// Check the given key is valid or not.
	if !bytes.Equal(eSanityText, sanityText) {
		return ErrEncryptionKeyMismatch
	}
	return nil
}

func (kri *keyRegistryIterator) next() (*pb.DataKey, error) {
	var err error
	// Read crc buf and data length.
	if _, err = kri.fp.Read(kri.lenCrcBuf[:]); err != nil {
		// EOF means end of the iteration.
		if err != io.EOF {
			return nil, y.Wrapf(err, "While reading crc in keyRegistryIterator.next")
		}
		return nil, err
	}
	l := int64(binary.BigEndian.Uint32(kri.lenCrcBuf[0:4]))
	// Read protobuf data.
	data := make([]byte, l)
	if _, err = kri.fp.Read(data); err != nil {
		// EOF means end of the iteration.
		if err != io.EOF {
			return nil, y.Wrapf(err, "While reading protobuf in keyRegistryIterator.next")
		}
		return nil, err
	}
	// Check checksum.
	if crc32.Checksum(data, y.CastagnoliCrcTable) != binary.BigEndian.Uint32(kri.lenCrcBuf[4:]) {
		return nil, y.Wrapf(y.ErrChecksumMismatch, "Error while checking checksum for data key.")
	}
	dataKey := &pb.DataKey{}
	if err = proto.Unmarshal(data, dataKey); err != nil {
		return nil, y.Wrapf(err, "While unmarshal of datakey in keyRegistryIterator.next")
	}
	if len(kri.encryptionKey) > 0 {
		// Decrypt the key if the storage key exists.
		if dataKey.Data, err = y.XORBlockAllocate(dataKey.Data, kri.encryptionKey, dataKey.Iv); err != nil {
			return nil, y.Wrapf(err, "While decrypting datakey in keyRegistryIterator.next")
		}
	}
	return dataKey, nil
}

// readKeyRegistry will read the key registry file and build the key registry struct.
func readKeyRegistry(fp *os.File, opt KeyRegistryOptions) (*KeyRegistry, error) {
	itr, err := newKeyRegistryIterator(fp, opt.EncryptionKey)
	if err != nil {
		return nil, err
	}
	kr := newKeyRegistry(opt)
	var dk *pb.DataKey
	dk, err = itr.next()
	for err == nil && dk != nil {
		if dk.KeyId > kr.nextKeyID {
			// Set the maximum key ID for next key ID generation.
			kr.nextKeyID = dk.KeyId
		}
		if dk.CreatedAt > kr.lastCreated {
			// Set the last generated key timestamp.
			kr.lastCreated = dk.CreatedAt
		}
		// No need to lock since we are building the initial state.
		kr.dataKeys[dk.KeyId] = dk
		// Forward the iterator.
		dk, err = itr.next()
	}
	// We read all the key. So, Ignoring this error.
	if err == io.EOF {
		err = nil
	}
	return kr, err
}

/*
Structure of Key Registry.
+-------------------+---------------------+--------------------+--------------+------------------+
|     IV            | Sanity Text         | DataKey1           | DataKey2     | ...              |
+-------------------+---------------------+--------------------+--------------+------------------+
*/

// WriteKeyRegistry will rewrite the existing key registry file with new one.
// It is okay to give closed key registry. Since, it's using only the datakey.
func WriteKeyRegistry(reg *KeyRegistry, opt KeyRegistryOptions) error {
	buf := &bytes.Buffer{}
	iv, err := y.GenerateIV()
	y.Check(err)
	// Encrypt sanity text if the encryption key is presents.
	eSanity := sanityText
	if len(opt.EncryptionKey) > 0 {
		var err error
		eSanity, err = y.XORBlockAllocate(eSanity, opt.EncryptionKey, iv)
		if err != nil {
			return y.Wrapf(err, "Error while encrpting sanity text in WriteKeyRegistry")
		}
	}
	y.Check2(buf.Write(iv))
	y.Check2(buf.Write(eSanity))
	// Write all the datakeys to the buf.
	for _, k := range reg.dataKeys {
		// Writing the datakey to the given buffer.
		if err := storeDataKey(buf, opt.EncryptionKey, k); err != nil {
			return y.Wrapf(err, "Error while storing datakey in WriteKeyRegistry")
		}
	}
	tmpPath := filepath.Join(opt.Dir, KeyRegistryRewriteFileName)
	// Open temporary file to write the data and do atomic rename.
	fp, err := y.OpenTruncFile(tmpPath, true)
	if err != nil {
		return y.Wrapf(err, "Error while opening tmp file in WriteKeyRegistry")
	}
	// Write buf to the disk.
	if _, err = fp.Write(buf.Bytes()); err != nil {
		// close the fd before returning error. We're not using defer
		// because, for windows we need to close the fd explicitly before
		// renaming.
		fp.Close()
		return y.Wrapf(err, "Error while writing buf in WriteKeyRegistry")
	}
	// In Windows the files should be closed before doing a Rename.
	if err = fp.Close(); err != nil {
		return y.Wrapf(err, "Error while closing tmp file in WriteKeyRegistry")
	}
	// Rename to the original file.
	if err = os.Rename(tmpPath, filepath.Join(opt.Dir, KeyRegistryFileName)); err != nil {
		return y.Wrapf(err, "Error while renaming file in WriteKeyRegistry")
	}
	// Sync Dir.
	return syncDir(opt.Dir)
}

// DataKey returns datakey of the given key id.
func (kr *KeyRegistry) DataKey(id uint64) (*pb.DataKey, error) {
	kr.RLock()
	defer kr.RUnlock()
	if id == 0 {
		// nil represent plain text.
		return nil, nil
	}
	dk, ok := kr.dataKeys[id]
	if !ok {
		return nil, y.Wrapf(ErrInvalidDataKeyID, "Error for the KEY ID %d", id)
	}
	return dk, nil
}

// LatestDataKey will give you the latest generated datakey based on the rotation
// period. If the last generated datakey lifetime exceeds the rotation period.
// It'll create new datakey.
func (kr *KeyRegistry) LatestDataKey() (*pb.DataKey, error) {
	if len(kr.opt.EncryptionKey) == 0 {
		// nil is for no encryption.
		return nil, nil
	}
	// validKey return datakey if the last generated key duration less than
	// rotation duration.
	validKey := func() (*pb.DataKey, bool) {
		// Time diffrence from the last generated time.
		diff := time.Since(time.Unix(kr.lastCreated, 0))
		if diff < kr.opt.EncryptionKeyRotationDuration {
			return kr.dataKeys[kr.nextKeyID], true
		}
		return nil, false
	}
	kr.RLock()
	key, valid := validKey()
	kr.RUnlock()
	if valid {
		// If less than EncryptionKeyRotationDuration, returns the last generated key.
		return key, nil
	}
	kr.Lock()
	defer kr.Unlock()
	// Key might have generated by another go routine. So,
	// checking once again.
	key, valid = validKey()
	if valid {
		return key, nil
	}
	k := make([]byte, len(kr.opt.EncryptionKey))
	iv, err := y.GenerateIV()
	if err != nil {
		return nil, err
	}
	_, err = rand.Read(k)
	if err != nil {
		return nil, err
	}
	// Otherwise Increment the KeyID and generate new datakey.
	kr.nextKeyID++
	dk := &pb.DataKey{
		KeyId:     kr.nextKeyID,
		Data:      k,
		CreatedAt: time.Now().Unix(),
		Iv:        iv,
	}
	// Don't store the datakey on file if badger is running in InMemory mode.
	if !kr.opt.InMemory {
		// Store the datekey.
		buf := &bytes.Buffer{}
		if err = storeDataKey(buf, kr.opt.EncryptionKey, dk); err != nil {
			return nil, err
		}
		// Persist the datakey to the disk
		if _, err = kr.fp.Write(buf.Bytes()); err != nil {
			return nil, err
		}
	}
	// storeDatakey encrypts the datakey So, placing un-encrypted key in the memory.
	dk.Data = k
	kr.lastCreated = dk.CreatedAt
	kr.dataKeys[kr.nextKeyID] = dk
	return dk, nil
}

// Close closes the key registry.
func (kr *KeyRegistry) Close() error {
	if !(kr.opt.ReadOnly || kr.opt.InMemory) {
		return kr.fp.Close()
	}
	return nil
}

// storeDataKey stores datakey in an encrypted format in the given buffer. If storage key preset.
func storeDataKey(buf *bytes.Buffer, storageKey []byte, k *pb.DataKey) error {
	// xor will encrypt the IV and xor with the given data.
	// It'll used for both encryption and decryption.
	xor := func() error {
		if len(storageKey) == 0 {
			return nil
		}
		var err error
		k.Data, err = y.XORBlockAllocate(k.Data, storageKey, k.Iv)
		return err
	}
	// In memory datakey will be plain text so encrypting before storing to the disk.
	var err error
	if err = xor(); err != nil {
		return y.Wrapf(err, "Error while encrypting datakey in storeDataKey")
	}
	var data []byte
	if data, err = proto.Marshal(k); err != nil {
		err = y.Wrapf(err, "Error while marshaling datakey in storeDataKey")
		var err2 error
		// decrypting the datakey back.
		if err2 = xor(); err2 != nil {
			return y.Wrapf(err,
				y.Wrapf(err2, "Error while decrypting datakey in storeDataKey").Error())
		}
		return err
	}
	var lenCrcBuf [8]byte
	binary.BigEndian.PutUint32(lenCrcBuf[0:4], uint32(len(data)))
	binary.BigEndian.PutUint32(lenCrcBuf[4:8], crc32.Checksum(data, y.CastagnoliCrcTable))
	y.Check2(buf.Write(lenCrcBuf[:]))
	y.Check2(buf.Write(data))
	// Decrypting the datakey back since we're using the pointer.
	return xor()
}
