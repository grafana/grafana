/*
 * SPDX-FileCopyrightText: © Hypermode Inc. <hello@hypermode.com>
 * SPDX-License-Identifier: Apache-2.0
 */

package badger

import (
	"encoding/binary"
	"fmt"
	"time"
	"unsafe"
)

type valuePointer struct {
	Fid    uint32
	Len    uint32
	Offset uint32
}

const vptrSize = unsafe.Sizeof(valuePointer{})

func (p valuePointer) Less(o valuePointer) bool {
	if p.Fid != o.Fid {
		return p.Fid < o.Fid
	}
	if p.Offset != o.Offset {
		return p.Offset < o.Offset
	}
	return p.Len < o.Len
}

func (p valuePointer) IsZero() bool {
	return p.Fid == 0 && p.Offset == 0 && p.Len == 0
}

// Encode encodes Pointer into byte buffer.
func (p valuePointer) Encode() []byte {
	b := make([]byte, vptrSize)
	// Copy over the content from p to b.
	*(*valuePointer)(unsafe.Pointer(&b[0])) = p
	return b
}

// Decode decodes the value pointer into the provided byte buffer.
func (p *valuePointer) Decode(b []byte) {
	// Copy over data from b into p. Using *p=unsafe.pointer(...) leads to
	// pointer alignment issues. See https://github.com/hypermodeinc/badger/issues/1096
	// and comment https://github.com/hypermodeinc/badger/pull/1097#pullrequestreview-307361714
	copy(((*[vptrSize]byte)(unsafe.Pointer(p))[:]), b[:vptrSize])
}

// header is used in value log as a header before Entry.
type header struct {
	klen      uint32
	vlen      uint32
	expiresAt uint64
	meta      byte
	userMeta  byte
}

const (
	// Maximum possible size of the header. The maximum size of header struct will be 18 but the
	// maximum size of varint encoded header will be 22.
	maxHeaderSize = 22
)

// Encode encodes the header into []byte. The provided []byte should be atleast 5 bytes. The
// function will panic if out []byte isn't large enough to hold all the values.
// The encoded header looks like
// +------+----------+------------+--------------+-----------+
// | Meta | UserMeta | Key Length | Value Length | ExpiresAt |
// +------+----------+------------+--------------+-----------+
func (h header) Encode(out []byte) int {
	out[0], out[1] = h.meta, h.userMeta
	index := 2
	index += binary.PutUvarint(out[index:], uint64(h.klen))
	index += binary.PutUvarint(out[index:], uint64(h.vlen))
	index += binary.PutUvarint(out[index:], h.expiresAt)
	return index
}

// Decode decodes the given header from the provided byte slice.
// Returns the number of bytes read.
func (h *header) Decode(buf []byte) int {
	h.meta, h.userMeta = buf[0], buf[1]
	index := 2
	klen, count := binary.Uvarint(buf[index:])
	h.klen = uint32(klen)
	index += count
	vlen, count := binary.Uvarint(buf[index:])
	h.vlen = uint32(vlen)
	index += count
	h.expiresAt, count = binary.Uvarint(buf[index:])
	return index + count
}

// DecodeFrom reads the header from the hashReader.
// Returns the number of bytes read.
func (h *header) DecodeFrom(reader *hashReader) (int, error) {
	var err error
	h.meta, err = reader.ReadByte()
	if err != nil {
		return 0, err
	}
	h.userMeta, err = reader.ReadByte()
	if err != nil {
		return 0, err
	}
	klen, err := binary.ReadUvarint(reader)
	if err != nil {
		return 0, err
	}
	h.klen = uint32(klen)
	vlen, err := binary.ReadUvarint(reader)
	if err != nil {
		return 0, err
	}
	h.vlen = uint32(vlen)
	h.expiresAt, err = binary.ReadUvarint(reader)
	if err != nil {
		return 0, err
	}
	return reader.bytesRead, nil
}

// Entry provides Key, Value, UserMeta and ExpiresAt. This struct can be used by
// the user to set data.
type Entry struct {
	Key       []byte
	Value     []byte
	ExpiresAt uint64 // time.Unix
	version   uint64
	offset    uint32 // offset is an internal field.
	UserMeta  byte
	meta      byte

	// Fields maintained internally.
	hlen         int // Length of the header.
	valThreshold int64
}

func (e *Entry) isZero() bool {
	return len(e.Key) == 0
}

func (e *Entry) estimateSizeAndSetThreshold(threshold int64) int64 {
	if e.valThreshold == 0 {
		e.valThreshold = threshold
	}
	k := int64(len(e.Key))
	v := int64(len(e.Value))
	if v < e.valThreshold {
		return k + v + 2 // Meta, UserMeta
	}
	return k + 12 + 2 // 12 for ValuePointer, 2 for metas.
}

func (e *Entry) skipVlogAndSetThreshold(threshold int64) bool {
	if e.valThreshold == 0 {
		e.valThreshold = threshold
	}
	return int64(len(e.Value)) < e.valThreshold
}

//nolint:unused
func (e Entry) print(prefix string) {
	fmt.Printf("%s Key: %s Meta: %d UserMeta: %d Offset: %d len(val)=%d",
		prefix, e.Key, e.meta, e.UserMeta, e.offset, len(e.Value))
}

// NewEntry creates a new entry with key and value passed in args. This newly created entry can be
// set in a transaction by calling txn.SetEntry(). All other properties of Entry can be set by
// calling WithMeta, WithDiscard, WithTTL methods on it.
// This function uses key and value reference, hence users must
// not modify key and value until the end of transaction.
func NewEntry(key, value []byte) *Entry {
	return &Entry{
		Key:   key,
		Value: value,
	}
}

// WithMeta adds meta data to Entry e. This byte is stored alongside the key
// and can be used as an aid to interpret the value or store other contextual
// bits corresponding to the key-value pair of entry.
func (e *Entry) WithMeta(meta byte) *Entry {
	e.UserMeta = meta
	return e
}

// WithDiscard adds a marker to Entry e. This means all the previous versions of the key (of the
// Entry) will be eligible for garbage collection.
// This method is only useful if you have set a higher limit for options.NumVersionsToKeep. The
// default setting is 1, in which case, this function doesn't add any more benefit. If however, you
// have a higher setting for NumVersionsToKeep (in Dgraph, we set it to infinity), you can use this
// method to indicate that all the older versions can be discarded and removed during compactions.
func (e *Entry) WithDiscard() *Entry {
	e.meta = bitDiscardEarlierVersions
	return e
}

// WithTTL adds time to live duration to Entry e. Entry stored with a TTL would automatically expire
// after the time has elapsed, and will be eligible for garbage collection.
func (e *Entry) WithTTL(dur time.Duration) *Entry {
	e.ExpiresAt = uint64(time.Now().Add(dur).Unix())
	return e
}

// withMergeBit sets merge bit in entry's metadata. This
// function is called by MergeOperator's Add method.
func (e *Entry) withMergeBit() *Entry {
	e.meta = bitMergeEntry
	return e
}
