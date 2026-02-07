// Copyright 2018 The Prometheus Authors
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

package encoding

import (
	"encoding/binary"
	"errors"
	"fmt"
	"hash"
	"hash/crc32"
	"math"

	"github.com/dennwc/varint"
)

var (
	ErrInvalidSize     = errors.New("invalid size")
	ErrInvalidChecksum = errors.New("invalid checksum")
)

// Encbuf is a helper type to populate a byte slice with various types.
type Encbuf struct {
	B []byte
	C [binary.MaxVarintLen64]byte
}

func (e *Encbuf) Reset()      { e.B = e.B[:0] }
func (e *Encbuf) Get() []byte { return e.B }
func (e *Encbuf) Len() int    { return len(e.B) }

func (e *Encbuf) PutString(s string) { e.B = append(e.B, s...) }
func (e *Encbuf) PutByte(c byte)     { e.B = append(e.B, c) }
func (e *Encbuf) PutBytes(b []byte)  { e.B = append(e.B, b...) }

func (e *Encbuf) PutBE32int(x int)      { e.PutBE32(uint32(x)) }
func (e *Encbuf) PutUvarint32(x uint32) { e.PutUvarint64(uint64(x)) }
func (e *Encbuf) PutBE64int64(x int64)  { e.PutBE64(uint64(x)) }
func (e *Encbuf) PutUvarint(x int)      { e.PutUvarint64(uint64(x)) }

func (e *Encbuf) PutBE32(x uint32) {
	binary.BigEndian.PutUint32(e.C[:], x)
	e.B = append(e.B, e.C[:4]...)
}

func (e *Encbuf) PutBE64(x uint64) {
	binary.BigEndian.PutUint64(e.C[:], x)
	e.B = append(e.B, e.C[:8]...)
}

func (e *Encbuf) PutBEFloat64(x float64) {
	e.PutBE64(math.Float64bits(x))
}

func (e *Encbuf) PutUvarint64(x uint64) {
	n := binary.PutUvarint(e.C[:], x)
	e.B = append(e.B, e.C[:n]...)
}

func (e *Encbuf) PutVarint64(x int64) {
	n := binary.PutVarint(e.C[:], x)
	e.B = append(e.B, e.C[:n]...)
}

// PutUvarintStr writes a string to the buffer prefixed by its varint length (in bytes!).
func (e *Encbuf) PutUvarintStr(s string) {
	e.PutUvarint(len(s))
	e.PutString(s)
}

// PutUvarintBytes writes a variable length byte buffer.
func (e *Encbuf) PutUvarintBytes(b []byte) {
	e.PutUvarint(len(b))
	e.PutBytes(b)
}

// PutHash appends a hash over the buffers current contents to the buffer.
func (e *Encbuf) PutHash(h hash.Hash) {
	h.Reset()
	e.WriteToHash(h)
	e.PutHashSum(h)
}

// WriteToHash writes the current buffer contents to the given hash.
func (e *Encbuf) WriteToHash(h hash.Hash) {
	_, err := h.Write(e.B)
	if err != nil {
		panic(err) // The CRC32 implementation does not error
	}
}

// PutHashSum writes the Sum of the given hash to the buffer.
func (e *Encbuf) PutHashSum(h hash.Hash) {
	e.B = h.Sum(e.B)
}

// Decbuf provides safe methods to extract data from a byte slice. It does all
// necessary bounds checking and advancing of the byte slice.
// Several datums can be extracted without checking for errors. However, before using
// any datum, the err() method must be checked.
type Decbuf struct {
	B []byte
	E error
}

// NewDecbufAt returns a new decoding buffer. It expects the first 4 bytes
// after offset to hold the big endian encoded content length, followed by the contents and the expected
// checksum.
func NewDecbufAt(bs ByteSlice, off int, castagnoliTable *crc32.Table) Decbuf {
	if bs.Len() < off+4 {
		return Decbuf{E: ErrInvalidSize}
	}
	b := bs.Range(off, off+4)
	l := int(binary.BigEndian.Uint32(b))

	if bs.Len() < off+4+l+4 {
		return Decbuf{E: ErrInvalidSize}
	}

	// Load bytes holding the contents plus a CRC32 checksum.
	b = bs.Range(off+4, off+4+l+4)
	dec := Decbuf{B: b[:len(b)-4]}

	if castagnoliTable != nil {
		if exp := binary.BigEndian.Uint32(b[len(b)-4:]); dec.Crc32(castagnoliTable) != exp {
			return Decbuf{E: ErrInvalidChecksum}
		}
	}
	return dec
}

// NewDecbufUvarintAt returns a new decoding buffer. It expects the first bytes
// after offset to hold the uvarint-encoded buffers length, followed by the contents and the expected
// checksum.
func NewDecbufUvarintAt(bs ByteSlice, off int, castagnoliTable *crc32.Table) Decbuf {
	// We never have to access this method at the far end of the byte slice. Thus just checking
	// against the MaxVarintLen32 is sufficient.
	if bs.Len() < off+binary.MaxVarintLen32 {
		return Decbuf{E: ErrInvalidSize}
	}
	b := bs.Range(off, off+binary.MaxVarintLen32)

	l, n := varint.Uvarint(b)
	if n <= 0 || n > binary.MaxVarintLen32 {
		return Decbuf{E: fmt.Errorf("invalid uvarint %d", n)}
	}

	if bs.Len() < off+n+int(l)+4 {
		return Decbuf{E: ErrInvalidSize}
	}

	// Load bytes holding the contents plus a CRC32 checksum.
	b = bs.Range(off+n, off+n+int(l)+4)
	dec := Decbuf{B: b[:len(b)-4]}

	if dec.Crc32(castagnoliTable) != binary.BigEndian.Uint32(b[len(b)-4:]) {
		return Decbuf{E: ErrInvalidChecksum}
	}
	return dec
}

// NewDecbufRaw returns a new decoding buffer of the given length.
func NewDecbufRaw(bs ByteSlice, length int) Decbuf {
	if bs.Len() < length {
		return Decbuf{E: ErrInvalidSize}
	}
	return Decbuf{B: bs.Range(0, length)}
}

func (d *Decbuf) Uvarint() int      { return int(d.Uvarint64()) }
func (d *Decbuf) Uvarint32() uint32 { return uint32(d.Uvarint64()) }
func (d *Decbuf) Be32int() int      { return int(d.Be32()) }
func (d *Decbuf) Be64int64() int64  { return int64(d.Be64()) }

// Crc32 returns a CRC32 checksum over the remaining bytes.
func (d *Decbuf) Crc32(castagnoliTable *crc32.Table) uint32 {
	return crc32.Checksum(d.B, castagnoliTable)
}

func (d *Decbuf) Skip(l int) {
	if len(d.B) < l {
		d.E = ErrInvalidSize
		return
	}
	d.B = d.B[l:]
}

func (d *Decbuf) UvarintStr() string {
	return string(d.UvarintBytes())
}

// UvarintBytes returns a pointer to internal data;
// the return value becomes invalid if the byte slice goes away.
// Compared to UvarintStr, this avoids allocations.
func (d *Decbuf) UvarintBytes() []byte {
	l := d.Uvarint64()
	if d.E != nil {
		return []byte{}
	}
	if len(d.B) < int(l) {
		d.E = ErrInvalidSize
		return []byte{}
	}
	s := d.B[:l]
	d.B = d.B[l:]
	return s
}

func (d *Decbuf) Varint64() int64 {
	if d.E != nil {
		return 0
	}
	// Decode as unsigned first, since that's what the varint library implements.
	ux, n := varint.Uvarint(d.B)
	if n < 1 {
		d.E = ErrInvalidSize
		return 0
	}
	// Now decode "ZigZag encoding" https://developers.google.com/protocol-buffers/docs/encoding#signed_integers.
	x := int64(ux >> 1)
	if ux&1 != 0 {
		x = ^x
	}
	d.B = d.B[n:]
	return x
}

func (d *Decbuf) Uvarint64() uint64 {
	if d.E != nil {
		return 0
	}
	x, n := varint.Uvarint(d.B)
	if n < 1 {
		d.E = ErrInvalidSize
		return 0
	}
	d.B = d.B[n:]
	return x
}

func (d *Decbuf) Be64() uint64 {
	if d.E != nil {
		return 0
	}
	if len(d.B) < 8 {
		d.E = ErrInvalidSize
		return 0
	}
	x := binary.BigEndian.Uint64(d.B)
	d.B = d.B[8:]
	return x
}

func (d *Decbuf) Be64Float64() float64 {
	return math.Float64frombits(d.Be64())
}

func (d *Decbuf) Be32() uint32 {
	if d.E != nil {
		return 0
	}
	if len(d.B) < 4 {
		d.E = ErrInvalidSize
		return 0
	}
	x := binary.BigEndian.Uint32(d.B)
	d.B = d.B[4:]
	return x
}

func (d *Decbuf) Byte() byte {
	if d.E != nil {
		return 0
	}
	if len(d.B) < 1 {
		d.E = ErrInvalidSize
		return 0
	}
	x := d.B[0]
	d.B = d.B[1:]
	return x
}

func (d *Decbuf) ConsumePadding() {
	if d.E != nil {
		return
	}
	for len(d.B) > 1 && d.B[0] == '\x00' {
		d.B = d.B[1:]
	}
	if len(d.B) < 1 {
		d.E = ErrInvalidSize
	}
}

func (d *Decbuf) Err() error  { return d.E }
func (d *Decbuf) Len() int    { return len(d.B) }
func (d *Decbuf) Get() []byte { return d.B }

// ByteSlice abstracts a byte slice.
type ByteSlice interface {
	Len() int
	Range(start, end int) []byte
}
