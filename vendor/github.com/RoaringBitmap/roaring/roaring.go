// Package roaring is an implementation of Roaring Bitmaps in Go.
// They provide fast compressed bitmap data structures (also called bitset).
// They are ideally suited to represent sets of integers over
// relatively small ranges.
// See http://roaringbitmap.org for details.
package roaring

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"io"
	"strconv"

	"github.com/RoaringBitmap/roaring/internal"
	"github.com/bits-and-blooms/bitset"
)

// Bitmap represents a compressed bitmap where you can add integers.
type Bitmap struct {
	highlowcontainer roaringArray
}

// ToBase64 serializes a bitmap as Base64
func (rb *Bitmap) ToBase64() (string, error) {
	buf := new(bytes.Buffer)
	_, err := rb.WriteTo(buf)
	return base64.StdEncoding.EncodeToString(buf.Bytes()), err

}

// FromBase64 deserializes a bitmap from Base64
func (rb *Bitmap) FromBase64(str string) (int64, error) {
	data, err := base64.StdEncoding.DecodeString(str)
	if err != nil {
		return 0, err
	}
	buf := bytes.NewBuffer(data)

	return rb.ReadFrom(buf)
}

// WriteTo writes a serialized version of this bitmap to stream.
// The format is compatible with other RoaringBitmap
// implementations (Java, C) and is documented here:
// https://github.com/RoaringBitmap/RoaringFormatSpec
func (rb *Bitmap) WriteTo(stream io.Writer) (int64, error) {
	return rb.highlowcontainer.writeTo(stream)
}

// ToBytes returns an array of bytes corresponding to what is written
// when calling WriteTo
func (rb *Bitmap) ToBytes() ([]byte, error) {
	return rb.highlowcontainer.toBytes()
}

const wordSize = uint64(64)
const log2WordSize = uint64(6)
const capacity = ^uint64(0)
const bitmapContainerSize = (1 << 16) / 64 // bitmap size in words

// DenseSize returns the size of the bitmap when stored as a dense bitmap.
func (rb *Bitmap) DenseSize() uint64 {
	if rb.highlowcontainer.size() == 0 {
		return 0
	}

	maximum := 1 + uint64(rb.Maximum())
	if maximum > (capacity - wordSize + 1) {
		return uint64(capacity >> log2WordSize)
	}

	return uint64((maximum + (wordSize - 1)) >> log2WordSize)
}

// ToDense returns a slice of uint64s representing the bitmap as a dense bitmap.
// Useful to convert a roaring bitmap to a format that can be used by other libraries
// like https://github.com/bits-and-blooms/bitset or https://github.com/kelindar/bitmap
func (rb *Bitmap) ToDense() []uint64 {
	sz := rb.DenseSize()
	if sz == 0 {
		return nil
	}

	bitmap := make([]uint64, sz)
	rb.WriteDenseTo(bitmap)
	return bitmap
}

// FromDense creates a bitmap from a slice of uint64s representing the bitmap as a dense bitmap.
// Useful to convert bitmaps from libraries like https://github.com/bits-and-blooms/bitset or
// https://github.com/kelindar/bitmap into roaring bitmaps fast and with convenience.
//
// This function will not create any run containers, only array and bitmap containers. It's up to
// the caller to call RunOptimize if they want to further compress the runs of consecutive values.
//
// When doCopy is true, the bitmap is copied into a new slice for each bitmap container.
// This is useful when the bitmap is going to be modified after this function returns or if it's
// undesirable to hold references to large bitmaps which the GC would not be able to collect.
// One copy can still happen even when doCopy is false if the bitmap length is not divisible
// by bitmapContainerSize.
//
// See also FromBitSet.
func FromDense(bitmap []uint64, doCopy bool) *Bitmap {
	sz := (len(bitmap) + bitmapContainerSize - 1) / bitmapContainerSize // round up
	rb := &Bitmap{
		highlowcontainer: roaringArray{
			containers:      make([]container, 0, sz),
			keys:            make([]uint16, 0, sz),
			needCopyOnWrite: make([]bool, 0, sz),
		},
	}
	rb.FromDense(bitmap, doCopy)
	return rb
}

// FromDense unmarshalls from a slice of uint64s representing the bitmap as a dense bitmap.
// Useful to convert bitmaps from libraries like https://github.com/bits-and-blooms/bitset or
// https://github.com/kelindar/bitmap into roaring bitmaps fast and with convenience.
// Callers are responsible for ensuring that the bitmap is empty before calling this function.
//
// This function will not create any run containers, only array and bitmap containers. It is up to
// the caller to call RunOptimize if they want to further compress the runs of consecutive values.
//
// When doCopy is true, the bitmap is copied into a new slice for each bitmap container.
// This is useful when the bitmap is going to be modified after this function returns or if it's
// undesirable to hold references to large bitmaps which the GC would not be able to collect.
// One copy can still happen even when doCopy is false if the bitmap length is not divisible
// by bitmapContainerSize.
//
// See FromBitSet.
func (rb *Bitmap) FromDense(bitmap []uint64, doCopy bool) {
	if len(bitmap) == 0 {
		return
	}

	var k uint16
	const size = bitmapContainerSize

	for len(bitmap) > 0 {
		hi := size
		if len(bitmap) < size {
			hi = len(bitmap)
		}

		words := bitmap[:hi]
		count := int(popcntSlice(words))

		switch {
		case count > arrayDefaultMaxSize:
			c := &bitmapContainer{cardinality: count, bitmap: words}
			cow := true

			if doCopy || len(words) < size {
				c.bitmap = make([]uint64, size)
				copy(c.bitmap, words)
				cow = false
			}

			rb.highlowcontainer.appendContainer(k, c, cow)

		case count > 0:
			c := &arrayContainer{content: make([]uint16, count)}
			var pos, base int
			for _, w := range words {
				for w != 0 {
					t := w & -w
					c.content[pos] = uint16(base + int(popcount(t-1)))
					pos++
					w ^= t
				}
				base += 64
			}
			rb.highlowcontainer.appendContainer(k, c, false)
		}

		bitmap = bitmap[hi:]
		k++
	}
}

// WriteDenseTo writes to a slice of uint64s representing the bitmap as a dense bitmap.
// Callers are responsible for allocating enough space in the bitmap using DenseSize.
// Useful to convert a roaring bitmap to a format that can be used by other libraries
// like https://github.com/bits-and-blooms/bitset or https://github.com/kelindar/bitmap
func (rb *Bitmap) WriteDenseTo(bitmap []uint64) {
	for i, ct := range rb.highlowcontainer.containers {
		hb := uint32(rb.highlowcontainer.keys[i]) << 16

		switch c := ct.(type) {
		case *arrayContainer:
			for _, x := range c.content {
				n := int(hb | uint32(x))
				bitmap[n>>log2WordSize] |= uint64(1) << uint(x%64)
			}

		case *bitmapContainer:
			copy(bitmap[int(hb)>>log2WordSize:], c.bitmap)

		case *runContainer16:
			for j := range c.iv {
				start := uint32(c.iv[j].start)
				end := start + uint32(c.iv[j].length) + 1
				lo := int(hb|start) >> log2WordSize
				hi := int(hb|(end-1)) >> log2WordSize

				if lo == hi {
					bitmap[lo] |= (^uint64(0) << uint(start%64)) &
						(^uint64(0) >> (uint(-end) % 64))
					continue
				}

				bitmap[lo] |= ^uint64(0) << uint(start%64)
				for n := lo + 1; n < hi; n++ {
					bitmap[n] = ^uint64(0)
				}
				bitmap[hi] |= ^uint64(0) >> (uint(-end) % 64)
			}
		default:
			panic("unsupported container type")
		}
	}
}

// Checksum computes a hash (currently FNV-1a) for a bitmap that is suitable for
// using bitmaps as elements in hash sets or as keys in hash maps, as well as
// generally quicker comparisons.
// The implementation is biased towards efficiency in little endian machines, so
// expect some extra CPU cycles and memory to be used if your machine is big endian.
// Likewise, do not use this to verify integrity unless you are certain you will load
// the bitmap on a machine with the same endianess used to create it. (Thankfully
// very few people use big endian machines these days.)
func (rb *Bitmap) Checksum() uint64 {
	const (
		offset = 14695981039346656037
		prime  = 1099511628211
	)

	var bytes []byte

	hash := uint64(offset)

	bytes = uint16SliceAsByteSlice(rb.highlowcontainer.keys)

	for _, b := range bytes {
		hash ^= uint64(b)
		hash *= prime
	}

	for _, c := range rb.highlowcontainer.containers {
		// 0 separator
		hash ^= 0
		hash *= prime

		switch c := c.(type) {
		case *bitmapContainer:
			bytes = uint64SliceAsByteSlice(c.bitmap)
		case *arrayContainer:
			bytes = uint16SliceAsByteSlice(c.content)
		case *runContainer16:
			bytes = interval16SliceAsByteSlice(c.iv)
		default:
			panic("invalid container type")
		}

		if len(bytes) == 0 {
			panic("empty containers are not supported")
		}

		for _, b := range bytes {
			hash ^= uint64(b)
			hash *= prime
		}
	}

	return hash
}

// FromUnsafeBytes reads a serialized version of this bitmap from the byte buffer without copy.
// It is the caller's responsibility to ensure that the input data is not modified and remains valid for the entire lifetime of this bitmap.
// This method avoids small allocations but holds references to the input data buffer. It is GC-friendly, but it may consume more memory eventually.
// The containers in the resulting bitmap are immutable containers tied to the provided byte array and they rely on
// copy-on-write which means that modifying them creates copies. Thus FromUnsafeBytes is more likely to be appropriate for read-only use cases,
// when the resulting bitmap can be considered immutable.
//
// See also the FromBuffer function.
// See https://github.com/RoaringBitmap/roaring/pull/395 for more details.
func (rb *Bitmap) FromUnsafeBytes(data []byte, cookieHeader ...byte) (p int64, err error) {
	stream := internal.NewByteBuffer(data)
	return rb.ReadFrom(stream)
}

// ReadFrom reads a serialized version of this bitmap from stream.
// The format is compatible with other RoaringBitmap
// implementations (Java, C) and is documented here:
// https://github.com/RoaringBitmap/RoaringFormatSpec
// Since io.Reader is regarded as a stream and cannot be read twice.
// So add cookieHeader to accept the 4-byte data that has been read in roaring64.ReadFrom.
// It is not necessary to pass cookieHeader when call roaring.ReadFrom to read the roaring32 data directly.
func (rb *Bitmap) ReadFrom(reader io.Reader, cookieHeader ...byte) (p int64, err error) {
	stream, ok := reader.(internal.ByteInput)
	if !ok {
		byteInputAdapter := internal.ByteInputAdapterPool.Get().(*internal.ByteInputAdapter)
		byteInputAdapter.Reset(reader)
		stream = byteInputAdapter
	}

	p, err = rb.highlowcontainer.readFrom(stream, cookieHeader...)

	if !ok {
		internal.ByteInputAdapterPool.Put(stream.(*internal.ByteInputAdapter))
	}
	return
}

// FromBuffer creates a bitmap from its serialized version stored in buffer
//
// The format specification is available here:
// https://github.com/RoaringBitmap/RoaringFormatSpec
//
// The provided byte array (buf) is expected to be a constant.
// The function makes the best effort attempt not to copy data.
// You should take care not to modify buff as it will
// likely result in unexpected program behavior.
//
// Resulting bitmaps are effectively immutable in the following sense:
// a copy-on-write marker is used so that when you modify the resulting
// bitmap, copies of selected data (containers) are made.
// You should *not* change the copy-on-write status of the resulting
// bitmaps (SetCopyOnWrite).
//
// Thus FromBuffer is more likely to be appropriate for read-only use cases,
// when the resulting bitmap can be considered immutable.
//
// If buf becomes unavailable, then a bitmap created with
// FromBuffer would be effectively broken. Furthermore, any
// bitmap derived from this bitmap (e.g., via Or, And) might
// also be broken. Thus, before making buf unavailable, you should
// call CloneCopyOnWriteContainers on all such bitmaps.
//
// See also the FromUnsafeBytes function which can have better performance
// in some cases.
func (rb *Bitmap) FromBuffer(buf []byte) (p int64, err error) {
	stream := internal.ByteBufferPool.Get().(*internal.ByteBuffer)
	stream.Reset(buf)

	p, err = rb.highlowcontainer.readFrom(stream)
	internal.ByteBufferPool.Put(stream)

	return
}

// RunOptimize attempts to further compress the runs of consecutive values found in the bitmap
func (rb *Bitmap) RunOptimize() {
	rb.highlowcontainer.runOptimize()
}

// HasRunCompression returns true if the bitmap benefits from run compression
func (rb *Bitmap) HasRunCompression() bool {
	return rb.highlowcontainer.hasRunCompression()
}

// MarshalBinary implements the encoding.BinaryMarshaler interface for the bitmap
// (same as ToBytes)
func (rb *Bitmap) MarshalBinary() ([]byte, error) {
	return rb.ToBytes()
}

// UnmarshalBinary implements the encoding.BinaryUnmarshaler interface for the bitmap
func (rb *Bitmap) UnmarshalBinary(data []byte) error {
	r := bytes.NewReader(data)
	_, err := rb.ReadFrom(r)
	return err
}

// NewBitmap creates a new empty Bitmap (see also New)
func NewBitmap() *Bitmap {
	return &Bitmap{}
}

// New creates a new empty Bitmap (same as NewBitmap)
func New() *Bitmap {
	return &Bitmap{}
}

// Clear resets the Bitmap to be logically empty, but may retain
// some memory allocations that may speed up future operations
func (rb *Bitmap) Clear() {
	rb.highlowcontainer.clear()
}

// ToBitSet copies the content of the RoaringBitmap into a bitset.BitSet instance
func (rb *Bitmap) ToBitSet() *bitset.BitSet {
	return bitset.From(rb.ToDense())
}

// FromBitSet creates a new RoaringBitmap from a bitset.BitSet instance
func FromBitSet(bitset *bitset.BitSet) *Bitmap {
	return FromDense(bitset.Bytes(), false)
}

// ToArray creates a new slice containing all of the integers stored in the Bitmap in sorted order
func (rb *Bitmap) ToArray() []uint32 {
	array := make([]uint32, rb.GetCardinality())
	pos := 0
	pos2 := 0

	for pos < rb.highlowcontainer.size() {
		hs := uint32(rb.highlowcontainer.getKeyAtIndex(pos)) << 16
		c := rb.highlowcontainer.getContainerAtIndex(pos)
		pos++
		pos2 = c.fillLeastSignificant16bits(array, pos2, hs)
	}
	return array
}

// GetSizeInBytes estimates the memory usage of the Bitmap. Note that this
// might differ slightly from the amount of bytes required for persistent storage
func (rb *Bitmap) GetSizeInBytes() uint64 {
	size := uint64(8)
	for _, c := range rb.highlowcontainer.containers {
		size += uint64(2) + uint64(c.getSizeInBytes())
	}
	return size
}

// GetSerializedSizeInBytes computes the serialized size in bytes
// of the Bitmap. It should correspond to the
// number of bytes written when invoking WriteTo. You can expect
// that this function is much cheaper computationally than WriteTo.
func (rb *Bitmap) GetSerializedSizeInBytes() uint64 {
	return rb.highlowcontainer.serializedSizeInBytes()
}

// BoundSerializedSizeInBytes returns an upper bound on the serialized size in bytes
// assuming that one wants to store "cardinality" integers in [0, universe_size)
func BoundSerializedSizeInBytes(cardinality uint64, universeSize uint64) uint64 {
	contnbr := (universeSize + uint64(65535)) / uint64(65536)
	if contnbr > cardinality {
		contnbr = cardinality
		// we cannot have more containers than we have values
	}
	headermax := 8*contnbr + 4
	if 4 > (contnbr+7)/8 {
		headermax += 4
	} else {
		headermax += (contnbr + 7) / 8
	}
	valsarray := uint64(arrayContainerSizeInBytes(int(cardinality)))
	valsbitmap := contnbr * uint64(bitmapContainerSizeInBytes())
	valsbest := valsarray
	if valsbest > valsbitmap {
		valsbest = valsbitmap
	}
	return valsbest + headermax
}

// IntIterable allows you to iterate over the values in a Bitmap
type IntIterable interface {
	HasNext() bool
	Next() uint32
}

// IntPeekable allows you to look at the next value without advancing and
// advance as long as the next value is smaller than minval
type IntPeekable interface {
	IntIterable
	// PeekNext peeks the next value without advancing the iterator
	PeekNext() uint32
	// AdvanceIfNeeded advances as long as the next value is smaller than minval
	AdvanceIfNeeded(minval uint32)
}

type intIterator struct {
	pos              int
	hs               uint32
	iter             shortPeekable
	highlowcontainer *roaringArray

	// These embedded iterators per container type help reduce load in the GC.
	// This way, instead of making up-to 64k allocations per full iteration
	// we get a single allocation and simply reinitialize the appropriate
	// iterator and point to it in the generic `iter` member on each key bound.
	shortIter  shortIterator
	runIter    runIterator16
	bitmapIter bitmapContainerShortIterator
}

// HasNext returns true if there are more integers to iterate over
func (ii *intIterator) HasNext() bool {
	return ii.pos < ii.highlowcontainer.size()
}

func (ii *intIterator) init() {
	if ii.highlowcontainer.size() > ii.pos {
		ii.hs = uint32(ii.highlowcontainer.getKeyAtIndex(ii.pos)) << 16
		c := ii.highlowcontainer.getContainerAtIndex(ii.pos)
		switch t := c.(type) {
		case *arrayContainer:
			ii.shortIter = shortIterator{t.content, 0}
			ii.iter = &ii.shortIter
		case *runContainer16:
			ii.runIter = runIterator16{rc: t, curIndex: 0, curPosInIndex: 0}
			ii.iter = &ii.runIter
		case *bitmapContainer:
			ii.bitmapIter = bitmapContainerShortIterator{t, t.NextSetBit(0)}
			ii.iter = &ii.bitmapIter
		}
	}
}

// Next returns the next integer
func (ii *intIterator) Next() uint32 {
	x := uint32(ii.iter.next()) | ii.hs
	if !ii.iter.hasNext() {
		ii.pos = ii.pos + 1
		ii.init()
	}
	return x
}

// PeekNext peeks the next value without advancing the iterator
func (ii *intIterator) PeekNext() uint32 {
	return uint32(ii.iter.peekNext()&maxLowBit) | ii.hs
}

// AdvanceIfNeeded advances as long as the next value is smaller than minval
func (ii *intIterator) AdvanceIfNeeded(minval uint32) {
	to := minval & 0xffff0000

	for ii.HasNext() && ii.hs < to {
		ii.pos++
		ii.init()
	}

	if ii.HasNext() && ii.hs == to {
		ii.iter.advanceIfNeeded(lowbits(minval))

		if !ii.iter.hasNext() {
			ii.pos++
			ii.init()
		}
	}
}

// IntIterator is meant to allow you to iterate through the values of a bitmap, see Initialize(a *Bitmap)
type IntIterator = intIterator

// Initialize configures the existing iterator so that it can iterate through the values of
// the provided bitmap.
// The iteration results are undefined if the bitmap is modified (e.g., with Add or Remove).
func (ii *intIterator) Initialize(a *Bitmap) {
	ii.pos = 0
	ii.highlowcontainer = &a.highlowcontainer
	ii.init()
}

type intReverseIterator struct {
	pos              int
	hs               uint32
	iter             shortIterable
	highlowcontainer *roaringArray

	shortIter  reverseIterator
	runIter    runReverseIterator16
	bitmapIter reverseBitmapContainerShortIterator
}

// HasNext returns true if there are more integers to iterate over
func (ii *intReverseIterator) HasNext() bool {
	return ii.pos >= 0
}

func (ii *intReverseIterator) init() {
	if ii.pos >= 0 {
		ii.hs = uint32(ii.highlowcontainer.getKeyAtIndex(ii.pos)) << 16
		c := ii.highlowcontainer.getContainerAtIndex(ii.pos)
		switch t := c.(type) {
		case *arrayContainer:
			ii.shortIter = reverseIterator{t.content, len(t.content) - 1}
			ii.iter = &ii.shortIter
		case *runContainer16:
			index := int(len(t.iv)) - 1
			pos := uint16(0)

			if index >= 0 {
				pos = t.iv[index].length
			}

			ii.runIter = runReverseIterator16{rc: t, curIndex: index, curPosInIndex: pos}
			ii.iter = &ii.runIter
		case *bitmapContainer:
			pos := -1
			if t.cardinality > 0 {
				pos = int(t.maximum())
			}
			ii.bitmapIter = reverseBitmapContainerShortIterator{t, pos}
			ii.iter = &ii.bitmapIter
		}
	} else {
		ii.iter = nil
	}
}

// Next returns the next integer
func (ii *intReverseIterator) Next() uint32 {
	x := uint32(ii.iter.next()) | ii.hs
	if !ii.iter.hasNext() {
		ii.pos = ii.pos - 1
		ii.init()
	}
	return x
}

// IntReverseIterator is meant to allow you to iterate through the values of a bitmap, see Initialize(a *Bitmap)
type IntReverseIterator = intReverseIterator

// Initialize configures the existing iterator so that it can iterate through the values of
// the provided bitmap.
// The iteration results are undefined if the bitmap is modified (e.g., with Add or Remove).
func (ii *intReverseIterator) Initialize(a *Bitmap) {
	ii.highlowcontainer = &a.highlowcontainer
	ii.pos = a.highlowcontainer.size() - 1
	ii.init()
}

// ManyIntIterable allows you to iterate over the values in a Bitmap
type ManyIntIterable interface {
	// NextMany fills buf up with values, returns how many values were returned
	NextMany(buf []uint32) int
	// NextMany64 fills up buf with 64 bit values, uses hs as a mask (OR), returns how many values were returned
	NextMany64(hs uint64, buf []uint64) int
}

type manyIntIterator struct {
	pos              int
	hs               uint32
	iter             manyIterable
	highlowcontainer *roaringArray

	shortIter  shortIterator
	runIter    runIterator16
	bitmapIter bitmapContainerManyIterator
}

func (ii *manyIntIterator) init() {
	if ii.highlowcontainer.size() > ii.pos {
		ii.hs = uint32(ii.highlowcontainer.getKeyAtIndex(ii.pos)) << 16
		c := ii.highlowcontainer.getContainerAtIndex(ii.pos)
		switch t := c.(type) {
		case *arrayContainer:
			ii.shortIter = shortIterator{t.content, 0}
			ii.iter = &ii.shortIter
		case *runContainer16:
			ii.runIter = runIterator16{rc: t, curIndex: 0, curPosInIndex: 0}
			ii.iter = &ii.runIter
		case *bitmapContainer:
			ii.bitmapIter = bitmapContainerManyIterator{t, -1, 0}
			ii.iter = &ii.bitmapIter
		}
	} else {
		ii.iter = nil
	}
}

func (ii *manyIntIterator) NextMany(buf []uint32) int {
	n := 0
	for n < len(buf) {
		if ii.iter == nil {
			break
		}
		moreN := ii.iter.nextMany(ii.hs, buf[n:])
		n += moreN
		if moreN == 0 {
			ii.pos = ii.pos + 1
			ii.init()
		}
	}

	return n
}

func (ii *manyIntIterator) NextMany64(hs64 uint64, buf []uint64) int {
	n := 0
	for n < len(buf) {
		if ii.iter == nil {
			break
		}

		hs := uint64(ii.hs) | hs64
		moreN := ii.iter.nextMany64(hs, buf[n:])
		n += moreN
		if moreN == 0 {
			ii.pos = ii.pos + 1
			ii.init()
		}
	}

	return n
}

// ManyIntIterator is meant to allow you to iterate through the values of a bitmap, see Initialize(a *Bitmap)
type ManyIntIterator = manyIntIterator

// Initialize configures the existing iterator so that it can iterate through the values of
// the provided bitmap.
// The iteration results are undefined if the bitmap is modified (e.g., with Add or Remove).
func (ii *manyIntIterator) Initialize(a *Bitmap) {
	ii.pos = 0
	ii.highlowcontainer = &a.highlowcontainer
	ii.init()
}

// String creates a string representation of the Bitmap
func (rb *Bitmap) String() string {
	// inspired by https://github.com/fzandona/goroar/
	var buffer bytes.Buffer
	start := []byte("{")
	buffer.Write(start)
	i := rb.Iterator()
	counter := 0
	if i.HasNext() {
		counter = counter + 1
		buffer.WriteString(strconv.FormatInt(int64(i.Next()), 10))
	}
	for i.HasNext() {
		buffer.WriteString(",")
		counter = counter + 1
		// to avoid exhausting the memory
		if counter > 0x40000 {
			buffer.WriteString("...")
			break
		}
		buffer.WriteString(strconv.FormatInt(int64(i.Next()), 10))
	}
	buffer.WriteString("}")
	return buffer.String()
}

// Iterate iterates over the bitmap, calling the given callback with each value in the bitmap.  If the callback returns
// false, the iteration is halted.
// The iteration results are undefined if the bitmap is modified (e.g., with Add or Remove).
// There is no guarantee as to what order the values will be iterated.
func (rb *Bitmap) Iterate(cb func(x uint32) bool) {
	for i := 0; i < rb.highlowcontainer.size(); i++ {
		hs := uint32(rb.highlowcontainer.getKeyAtIndex(i)) << 16
		c := rb.highlowcontainer.getContainerAtIndex(i)

		var shouldContinue bool
		// This is hacky but it avoids allocations from invoking an interface method with a closure
		switch t := c.(type) {
		case *arrayContainer:
			shouldContinue = t.iterate(func(x uint16) bool {
				return cb(uint32(x) | hs)
			})
		case *runContainer16:
			shouldContinue = t.iterate(func(x uint16) bool {
				return cb(uint32(x) | hs)
			})
		case *bitmapContainer:
			shouldContinue = t.iterate(func(x uint16) bool {
				return cb(uint32(x) | hs)
			})
		}

		if !shouldContinue {
			break
		}
	}
}

// Iterator creates a new IntPeekable to iterate over the integers contained in the bitmap, in sorted order;
// the iterator becomes invalid if the bitmap is modified (e.g., with Add or Remove).
func (rb *Bitmap) Iterator() IntPeekable {
	p := new(intIterator)
	p.Initialize(rb)
	return p
}

// ReverseIterator creates a new IntIterable to iterate over the integers contained in the bitmap, in sorted order;
// the iterator becomes invalid if the bitmap is modified (e.g., with Add or Remove).
func (rb *Bitmap) ReverseIterator() IntIterable {
	p := new(intReverseIterator)
	p.Initialize(rb)
	return p
}

// ManyIterator creates a new ManyIntIterable to iterate over the integers contained in the bitmap, in sorted order;
// the iterator becomes invalid if the bitmap is modified (e.g., with Add or Remove).
func (rb *Bitmap) ManyIterator() ManyIntIterable {
	p := new(manyIntIterator)
	p.Initialize(rb)
	return p
}

// Clone creates a copy of the Bitmap
func (rb *Bitmap) Clone() *Bitmap {
	ptr := new(Bitmap)
	ptr.highlowcontainer = *rb.highlowcontainer.clone()
	return ptr
}

// Minimum get the smallest value stored in this roaring bitmap, assumes that it is not empty
func (rb *Bitmap) Minimum() uint32 {
	if len(rb.highlowcontainer.containers) == 0 {
		panic("Empty bitmap")
	}
	return uint32(rb.highlowcontainer.containers[0].minimum()) | (uint32(rb.highlowcontainer.keys[0]) << 16)
}

// Maximum get the largest value stored in this roaring bitmap, assumes that it is not empty
func (rb *Bitmap) Maximum() uint32 {
	if len(rb.highlowcontainer.containers) == 0 {
		panic("Empty bitmap")
	}
	lastindex := len(rb.highlowcontainer.containers) - 1
	return uint32(rb.highlowcontainer.containers[lastindex].maximum()) | (uint32(rb.highlowcontainer.keys[lastindex]) << 16)
}

// Contains returns true if the integer is contained in the bitmap
func (rb *Bitmap) Contains(x uint32) bool {
	hb := highbits(x)
	c := rb.highlowcontainer.getContainer(hb)
	return c != nil && c.contains(lowbits(x))
}

// ContainsInt returns true if the integer is contained in the bitmap (this is a convenience method, the parameter is casted to uint32 and Contains is called)
func (rb *Bitmap) ContainsInt(x int) bool {
	return rb.Contains(uint32(x))
}

// Equals returns true if the two bitmaps contain the same integers
func (rb *Bitmap) Equals(o interface{}) bool {
	srb, ok := o.(*Bitmap)
	if ok {
		return srb.highlowcontainer.equals(rb.highlowcontainer)
	}
	return false
}

// AddOffset adds the value 'offset' to each and every value in a bitmap, generating a new bitmap in the process
func AddOffset(x *Bitmap, offset uint32) (answer *Bitmap) {
	return AddOffset64(x, int64(offset))
}

// AddOffset64 adds the value 'offset' to each and every value in a bitmap, generating a new bitmap in the process
// If offset + element is outside of the range [0,2^32), that the element will be dropped
func AddOffset64(x *Bitmap, offset int64) (answer *Bitmap) {
	// we need "offset" to be a long because we want to support values
	// between -0xFFFFFFFF up to +-0xFFFFFFFF
	var containerOffset64 int64

	if offset < 0 {
		containerOffset64 = (offset - (1 << 16) + 1) / (1 << 16)
	} else {
		containerOffset64 = offset >> 16
	}

	answer = New()

	if containerOffset64 >= (1<<16) || containerOffset64 < -(1<<16) {
		return answer
	}

	containerOffset := int32(containerOffset64)
	inOffset := (uint16)(offset - containerOffset64*(1<<16))

	if inOffset == 0 {
		for pos := 0; pos < x.highlowcontainer.size(); pos++ {
			key := int32(x.highlowcontainer.getKeyAtIndex(pos))
			key += containerOffset

			if key >= 0 && key <= MaxUint16 {
				c := x.highlowcontainer.getContainerAtIndex(pos).clone()
				answer.highlowcontainer.appendContainer(uint16(key), c, false)
			}
		}
	} else {
		for pos := 0; pos < x.highlowcontainer.size(); pos++ {
			key := int32(x.highlowcontainer.getKeyAtIndex(pos))
			key += containerOffset

			if key+1 < 0 || key > MaxUint16 {
				continue
			}

			c := x.highlowcontainer.getContainerAtIndex(pos)
			lo, hi := c.addOffset(inOffset)

			if lo != nil && key >= 0 {
				curSize := answer.highlowcontainer.size()
				lastkey := int32(0)

				if curSize > 0 {
					lastkey = int32(answer.highlowcontainer.getKeyAtIndex(curSize - 1))
				}

				if curSize > 0 && lastkey == key {
					prev := answer.highlowcontainer.getContainerAtIndex(curSize - 1)
					orresult := prev.ior(lo)
					answer.highlowcontainer.setContainerAtIndex(curSize-1, orresult)
				} else {
					answer.highlowcontainer.appendContainer(uint16(key), lo, false)
				}
			}

			if hi != nil && key+1 <= MaxUint16 {
				answer.highlowcontainer.appendContainer(uint16(key+1), hi, false)
			}
		}
	}

	return answer
}

// Add the integer x to the bitmap
func (rb *Bitmap) Add(x uint32) {
	hb := highbits(x)
	ra := &rb.highlowcontainer
	i := ra.getIndex(hb)
	if i >= 0 {
		var c container
		c = ra.getWritableContainerAtIndex(i).iaddReturnMinimized(lowbits(x))
		rb.highlowcontainer.setContainerAtIndex(i, c)
	} else {
		newac := newArrayContainer()
		rb.highlowcontainer.insertNewKeyValueAt(-i-1, hb, newac.iaddReturnMinimized(lowbits(x)))
	}
}

// add the integer x to the bitmap, return the container and its index
func (rb *Bitmap) addwithptr(x uint32) (int, container) {
	hb := highbits(x)
	ra := &rb.highlowcontainer
	i := ra.getIndex(hb)
	var c container
	if i >= 0 {
		c = ra.getWritableContainerAtIndex(i).iaddReturnMinimized(lowbits(x))
		rb.highlowcontainer.setContainerAtIndex(i, c)
		return i, c
	}
	newac := newArrayContainer()
	c = newac.iaddReturnMinimized(lowbits(x))
	rb.highlowcontainer.insertNewKeyValueAt(-i-1, hb, c)
	return -i - 1, c
}

// CheckedAdd adds the integer x to the bitmap and return true  if it was added (false if the integer was already present)
func (rb *Bitmap) CheckedAdd(x uint32) bool {
	// TODO: add unit tests for this method
	hb := highbits(x)
	i := rb.highlowcontainer.getIndex(hb)
	if i >= 0 {
		C := rb.highlowcontainer.getWritableContainerAtIndex(i)
		oldcard := C.getCardinality()
		C = C.iaddReturnMinimized(lowbits(x))
		rb.highlowcontainer.setContainerAtIndex(i, C)
		return C.getCardinality() > oldcard
	}
	newac := newArrayContainer()
	rb.highlowcontainer.insertNewKeyValueAt(-i-1, hb, newac.iaddReturnMinimized(lowbits(x)))
	return true

}

// AddInt adds the integer x to the bitmap (convenience method: the parameter is casted to uint32 and we call Add)
func (rb *Bitmap) AddInt(x int) {
	rb.Add(uint32(x))
}

// Remove the integer x from the bitmap
func (rb *Bitmap) Remove(x uint32) {
	hb := highbits(x)
	i := rb.highlowcontainer.getIndex(hb)
	if i >= 0 {
		c := rb.highlowcontainer.getWritableContainerAtIndex(i).iremoveReturnMinimized(lowbits(x))
		rb.highlowcontainer.setContainerAtIndex(i, c)
		if rb.highlowcontainer.getContainerAtIndex(i).isEmpty() {
			rb.highlowcontainer.removeAtIndex(i)
		}
	}
}

// CheckedRemove removes the integer x from the bitmap and return true if the integer was effectively removed (and false if the integer was not present)
func (rb *Bitmap) CheckedRemove(x uint32) bool {
	// TODO: add unit tests for this method
	hb := highbits(x)
	i := rb.highlowcontainer.getIndex(hb)
	if i >= 0 {
		C := rb.highlowcontainer.getWritableContainerAtIndex(i)
		oldcard := C.getCardinality()
		C = C.iremoveReturnMinimized(lowbits(x))
		rb.highlowcontainer.setContainerAtIndex(i, C)
		if rb.highlowcontainer.getContainerAtIndex(i).isEmpty() {
			rb.highlowcontainer.removeAtIndex(i)
			return true
		}
		return C.getCardinality() < oldcard
	}
	return false

}

// IsEmpty returns true if the Bitmap is empty (it is faster than doing (GetCardinality() == 0))
func (rb *Bitmap) IsEmpty() bool {
	return rb.highlowcontainer.size() == 0
}

// GetCardinality returns the number of integers contained in the bitmap
func (rb *Bitmap) GetCardinality() uint64 {
	size := uint64(0)
	for _, c := range rb.highlowcontainer.containers {
		size += uint64(c.getCardinality())
	}
	return size
}

// Rank returns the number of integers that are smaller or equal to x (Rank(infinity) would be GetCardinality()).
// If you pass the smallest value, you get the value 1. If you pass a value that is smaller than the smallest
// value, you get 0. Note that this function differs in convention from the Select function since it
// return 1 and not 0 on the smallest value.
func (rb *Bitmap) Rank(x uint32) uint64 {
	size := uint64(0)
	for i := 0; i < rb.highlowcontainer.size(); i++ {
		key := rb.highlowcontainer.getKeyAtIndex(i)
		if key > highbits(x) {
			return size
		}
		if key < highbits(x) {
			size += uint64(rb.highlowcontainer.getContainerAtIndex(i).getCardinality())
		} else {
			return size + uint64(rb.highlowcontainer.getContainerAtIndex(i).rank(lowbits(x)))
		}
	}
	return size
}

// Select returns the xth integer in the bitmap. If you pass 0, you get
// the smallest element. Note that this function differs in convention from
// the Rank function which returns 1 on the smallest value.
func (rb *Bitmap) Select(x uint32) (uint32, error) {
	remaining := x
	for i := 0; i < rb.highlowcontainer.size(); i++ {
		c := rb.highlowcontainer.getContainerAtIndex(i)
		card := uint32(c.getCardinality())
		if remaining >= card {
			remaining -= card
		} else {
			key := rb.highlowcontainer.getKeyAtIndex(i)
			return uint32(key)<<16 + uint32(c.selectInt(uint16(remaining))), nil
		}
	}
	return 0, fmt.Errorf("cannot find %dth integer in a bitmap with only %d items", x, rb.GetCardinality())
}

// And computes the intersection between two bitmaps and stores the result in the current bitmap
func (rb *Bitmap) And(x2 *Bitmap) {
	pos1 := 0
	pos2 := 0
	intersectionsize := 0
	length1 := rb.highlowcontainer.size()
	length2 := x2.highlowcontainer.size()

main:
	for {
		if pos1 < length1 && pos2 < length2 {
			s1 := rb.highlowcontainer.getKeyAtIndex(pos1)
			s2 := x2.highlowcontainer.getKeyAtIndex(pos2)
			for {
				if s1 == s2 {
					c1 := rb.highlowcontainer.getWritableContainerAtIndex(pos1)
					c2 := x2.highlowcontainer.getContainerAtIndex(pos2)
					diff := c1.iand(c2)
					if !diff.isEmpty() {
						rb.highlowcontainer.replaceKeyAndContainerAtIndex(intersectionsize, s1, diff, false)
						intersectionsize++
					}
					pos1++
					pos2++
					if (pos1 == length1) || (pos2 == length2) {
						break main
					}
					s1 = rb.highlowcontainer.getKeyAtIndex(pos1)
					s2 = x2.highlowcontainer.getKeyAtIndex(pos2)
				} else if s1 < s2 {
					pos1 = rb.highlowcontainer.advanceUntil(s2, pos1)
					if pos1 == length1 {
						break main
					}
					s1 = rb.highlowcontainer.getKeyAtIndex(pos1)
				} else { //s1 > s2
					pos2 = x2.highlowcontainer.advanceUntil(s1, pos2)
					if pos2 == length2 {
						break main
					}
					s2 = x2.highlowcontainer.getKeyAtIndex(pos2)
				}
			}
		} else {
			break
		}
	}
	rb.highlowcontainer.resize(intersectionsize)
}

// OrCardinality  returns the cardinality of the union between two bitmaps, bitmaps are not modified
func (rb *Bitmap) OrCardinality(x2 *Bitmap) uint64 {
	pos1 := 0
	pos2 := 0
	length1 := rb.highlowcontainer.size()
	length2 := x2.highlowcontainer.size()
	answer := uint64(0)
main:
	for {
		if (pos1 < length1) && (pos2 < length2) {
			s1 := rb.highlowcontainer.getKeyAtIndex(pos1)
			s2 := x2.highlowcontainer.getKeyAtIndex(pos2)

			for {
				if s1 < s2 {
					answer += uint64(rb.highlowcontainer.getContainerAtIndex(pos1).getCardinality())
					pos1++
					if pos1 == length1 {
						break main
					}
					s1 = rb.highlowcontainer.getKeyAtIndex(pos1)
				} else if s1 > s2 {
					answer += uint64(x2.highlowcontainer.getContainerAtIndex(pos2).getCardinality())
					pos2++
					if pos2 == length2 {
						break main
					}
					s2 = x2.highlowcontainer.getKeyAtIndex(pos2)
				} else {
					// TODO: could be faster if we did not have to materialize the container
					answer += uint64(rb.highlowcontainer.getContainerAtIndex(pos1).or(x2.highlowcontainer.getContainerAtIndex(pos2)).getCardinality())
					pos1++
					pos2++
					if (pos1 == length1) || (pos2 == length2) {
						break main
					}
					s1 = rb.highlowcontainer.getKeyAtIndex(pos1)
					s2 = x2.highlowcontainer.getKeyAtIndex(pos2)
				}
			}
		} else {
			break
		}
	}
	for ; pos1 < length1; pos1++ {
		answer += uint64(rb.highlowcontainer.getContainerAtIndex(pos1).getCardinality())
	}
	for ; pos2 < length2; pos2++ {
		answer += uint64(x2.highlowcontainer.getContainerAtIndex(pos2).getCardinality())
	}
	return answer
}

// AndCardinality returns the cardinality of the intersection between two bitmaps, bitmaps are not modified
func (rb *Bitmap) AndCardinality(x2 *Bitmap) uint64 {
	pos1 := 0
	pos2 := 0
	answer := uint64(0)
	length1 := rb.highlowcontainer.size()
	length2 := x2.highlowcontainer.size()

main:
	for {
		if pos1 < length1 && pos2 < length2 {
			s1 := rb.highlowcontainer.getKeyAtIndex(pos1)
			s2 := x2.highlowcontainer.getKeyAtIndex(pos2)
			for {
				if s1 == s2 {
					c1 := rb.highlowcontainer.getContainerAtIndex(pos1)
					c2 := x2.highlowcontainer.getContainerAtIndex(pos2)
					answer += uint64(c1.andCardinality(c2))
					pos1++
					pos2++
					if (pos1 == length1) || (pos2 == length2) {
						break main
					}
					s1 = rb.highlowcontainer.getKeyAtIndex(pos1)
					s2 = x2.highlowcontainer.getKeyAtIndex(pos2)
				} else if s1 < s2 {
					pos1 = rb.highlowcontainer.advanceUntil(s2, pos1)
					if pos1 == length1 {
						break main
					}
					s1 = rb.highlowcontainer.getKeyAtIndex(pos1)
				} else { //s1 > s2
					pos2 = x2.highlowcontainer.advanceUntil(s1, pos2)
					if pos2 == length2 {
						break main
					}
					s2 = x2.highlowcontainer.getKeyAtIndex(pos2)
				}
			}
		} else {
			break
		}
	}
	return answer
}

// IntersectsWithInterval checks whether a bitmap 'rb' and an open interval '[x,y)' intersect.
func (rb *Bitmap) IntersectsWithInterval(x, y uint64) bool {
	if x >= y {
		return false
	}
	if x > MaxUint32 {
		return false
	}

	it := intIterator{}
	it.Initialize(rb)
	it.AdvanceIfNeeded(uint32(x))
	if !it.HasNext() {
		return false
	}
	if uint64(it.Next()) >= y {
		return false
	}

	return true
}

// Intersects checks whether two bitmap intersects, bitmaps are not modified
func (rb *Bitmap) Intersects(x2 *Bitmap) bool {
	pos1 := 0
	pos2 := 0
	length1 := rb.highlowcontainer.size()
	length2 := x2.highlowcontainer.size()

main:
	for {
		if pos1 < length1 && pos2 < length2 {
			s1 := rb.highlowcontainer.getKeyAtIndex(pos1)
			s2 := x2.highlowcontainer.getKeyAtIndex(pos2)
			for {
				if s1 == s2 {
					c1 := rb.highlowcontainer.getContainerAtIndex(pos1)
					c2 := x2.highlowcontainer.getContainerAtIndex(pos2)
					if c1.intersects(c2) {
						return true
					}
					pos1++
					pos2++
					if (pos1 == length1) || (pos2 == length2) {
						break main
					}
					s1 = rb.highlowcontainer.getKeyAtIndex(pos1)
					s2 = x2.highlowcontainer.getKeyAtIndex(pos2)
				} else if s1 < s2 {
					pos1 = rb.highlowcontainer.advanceUntil(s2, pos1)
					if pos1 == length1 {
						break main
					}
					s1 = rb.highlowcontainer.getKeyAtIndex(pos1)
				} else { //s1 > s2
					pos2 = x2.highlowcontainer.advanceUntil(s1, pos2)
					if pos2 == length2 {
						break main
					}
					s2 = x2.highlowcontainer.getKeyAtIndex(pos2)
				}
			}
		} else {
			break
		}
	}
	return false
}

// Xor computes the symmetric difference between two bitmaps and stores the result in the current bitmap
func (rb *Bitmap) Xor(x2 *Bitmap) {
	pos1 := 0
	pos2 := 0
	length1 := rb.highlowcontainer.size()
	length2 := x2.highlowcontainer.size()
	for {
		if (pos1 < length1) && (pos2 < length2) {
			s1 := rb.highlowcontainer.getKeyAtIndex(pos1)
			s2 := x2.highlowcontainer.getKeyAtIndex(pos2)
			if s1 < s2 {
				pos1 = rb.highlowcontainer.advanceUntil(s2, pos1)
				if pos1 == length1 {
					break
				}
			} else if s1 > s2 {
				c := x2.highlowcontainer.getWritableContainerAtIndex(pos2)
				rb.highlowcontainer.insertNewKeyValueAt(pos1, x2.highlowcontainer.getKeyAtIndex(pos2), c)
				length1++
				pos1++
				pos2++
			} else {
				// TODO: couple be computed in-place for reduced memory usage
				c := rb.highlowcontainer.getContainerAtIndex(pos1).xor(x2.highlowcontainer.getContainerAtIndex(pos2))
				if !c.isEmpty() {
					rb.highlowcontainer.setContainerAtIndex(pos1, c)
					pos1++
				} else {
					rb.highlowcontainer.removeAtIndex(pos1)
					length1--
				}
				pos2++
			}
		} else {
			break
		}
	}
	if pos1 == length1 {
		rb.highlowcontainer.appendCopyMany(x2.highlowcontainer, pos2, length2)
	}
}

// Or computes the union between two bitmaps and stores the result in the current bitmap
func (rb *Bitmap) Or(x2 *Bitmap) {
	pos1 := 0
	pos2 := 0
	length1 := rb.highlowcontainer.size()
	length2 := x2.highlowcontainer.size()
main:
	for (pos1 < length1) && (pos2 < length2) {
		s1 := rb.highlowcontainer.getKeyAtIndex(pos1)
		s2 := x2.highlowcontainer.getKeyAtIndex(pos2)

		for {
			if s1 < s2 {
				pos1++
				if pos1 == length1 {
					break main
				}
				s1 = rb.highlowcontainer.getKeyAtIndex(pos1)
			} else if s1 > s2 {
				rb.highlowcontainer.insertNewKeyValueAt(pos1, s2, x2.highlowcontainer.getContainerAtIndex(pos2).clone())
				pos1++
				length1++
				pos2++
				if pos2 == length2 {
					break main
				}
				s2 = x2.highlowcontainer.getKeyAtIndex(pos2)
			} else {
				rb.highlowcontainer.replaceKeyAndContainerAtIndex(pos1, s1, rb.highlowcontainer.getUnionedWritableContainer(pos1, x2.highlowcontainer.getContainerAtIndex(pos2)), false)
				pos1++
				pos2++
				if (pos1 == length1) || (pos2 == length2) {
					break main
				}
				s1 = rb.highlowcontainer.getKeyAtIndex(pos1)
				s2 = x2.highlowcontainer.getKeyAtIndex(pos2)
			}
		}
	}
	if pos1 == length1 {
		rb.highlowcontainer.appendCopyMany(x2.highlowcontainer, pos2, length2)
	}
}

// AndNot computes the difference between two bitmaps and stores the result in the current bitmap
func (rb *Bitmap) AndNot(x2 *Bitmap) {
	pos1 := 0
	pos2 := 0
	intersectionsize := 0
	length1 := rb.highlowcontainer.size()
	length2 := x2.highlowcontainer.size()

main:
	for {
		if pos1 < length1 && pos2 < length2 {
			s1 := rb.highlowcontainer.getKeyAtIndex(pos1)
			s2 := x2.highlowcontainer.getKeyAtIndex(pos2)
			for {
				if s1 == s2 {
					c1 := rb.highlowcontainer.getWritableContainerAtIndex(pos1)
					c2 := x2.highlowcontainer.getContainerAtIndex(pos2)
					diff := c1.iandNot(c2)
					if !diff.isEmpty() {
						rb.highlowcontainer.replaceKeyAndContainerAtIndex(intersectionsize, s1, diff, false)
						intersectionsize++
					}
					pos1++
					pos2++
					if (pos1 == length1) || (pos2 == length2) {
						break main
					}
					s1 = rb.highlowcontainer.getKeyAtIndex(pos1)
					s2 = x2.highlowcontainer.getKeyAtIndex(pos2)
				} else if s1 < s2 {
					c1 := rb.highlowcontainer.getContainerAtIndex(pos1)
					mustCopyOnWrite := rb.highlowcontainer.needsCopyOnWrite(pos1)
					rb.highlowcontainer.replaceKeyAndContainerAtIndex(intersectionsize, s1, c1, mustCopyOnWrite)
					intersectionsize++
					pos1++
					if pos1 == length1 {
						break main
					}
					s1 = rb.highlowcontainer.getKeyAtIndex(pos1)
				} else { //s1 > s2
					pos2 = x2.highlowcontainer.advanceUntil(s1, pos2)
					if pos2 == length2 {
						break main
					}
					s2 = x2.highlowcontainer.getKeyAtIndex(pos2)
				}
			}
		} else {
			break
		}
	}
	// TODO:implement as a copy
	for pos1 < length1 {
		c1 := rb.highlowcontainer.getContainerAtIndex(pos1)
		s1 := rb.highlowcontainer.getKeyAtIndex(pos1)
		mustCopyOnWrite := rb.highlowcontainer.needsCopyOnWrite(pos1)
		rb.highlowcontainer.replaceKeyAndContainerAtIndex(intersectionsize, s1, c1, mustCopyOnWrite)
		intersectionsize++
		pos1++
	}
	rb.highlowcontainer.resize(intersectionsize)
}

// Or computes the union between two bitmaps and returns the result
func Or(x1, x2 *Bitmap) *Bitmap {
	answer := NewBitmap()
	pos1 := 0
	pos2 := 0
	length1 := x1.highlowcontainer.size()
	length2 := x2.highlowcontainer.size()
main:
	for (pos1 < length1) && (pos2 < length2) {
		s1 := x1.highlowcontainer.getKeyAtIndex(pos1)
		s2 := x2.highlowcontainer.getKeyAtIndex(pos2)

		for {
			if s1 < s2 {
				answer.highlowcontainer.appendCopy(x1.highlowcontainer, pos1)
				pos1++
				if pos1 == length1 {
					break main
				}
				s1 = x1.highlowcontainer.getKeyAtIndex(pos1)
			} else if s1 > s2 {
				answer.highlowcontainer.appendCopy(x2.highlowcontainer, pos2)
				pos2++
				if pos2 == length2 {
					break main
				}
				s2 = x2.highlowcontainer.getKeyAtIndex(pos2)
			} else {

				answer.highlowcontainer.appendContainer(s1, x1.highlowcontainer.getContainerAtIndex(pos1).or(x2.highlowcontainer.getContainerAtIndex(pos2)), false)
				pos1++
				pos2++
				if (pos1 == length1) || (pos2 == length2) {
					break main
				}
				s1 = x1.highlowcontainer.getKeyAtIndex(pos1)
				s2 = x2.highlowcontainer.getKeyAtIndex(pos2)
			}
		}
	}
	if pos1 == length1 {
		answer.highlowcontainer.appendCopyMany(x2.highlowcontainer, pos2, length2)
	} else if pos2 == length2 {
		answer.highlowcontainer.appendCopyMany(x1.highlowcontainer, pos1, length1)
	}
	return answer
}

// And computes the intersection between two bitmaps and returns the result
func And(x1, x2 *Bitmap) *Bitmap {
	answer := NewBitmap()
	pos1 := 0
	pos2 := 0
	length1 := x1.highlowcontainer.size()
	length2 := x2.highlowcontainer.size()
main:
	for pos1 < length1 && pos2 < length2 {
		s1 := x1.highlowcontainer.getKeyAtIndex(pos1)
		s2 := x2.highlowcontainer.getKeyAtIndex(pos2)
		for {
			if s1 == s2 {
				C := x1.highlowcontainer.getContainerAtIndex(pos1)
				C = C.and(x2.highlowcontainer.getContainerAtIndex(pos2))

				if !C.isEmpty() {
					answer.highlowcontainer.appendContainer(s1, C, false)
				}
				pos1++
				pos2++
				if (pos1 == length1) || (pos2 == length2) {
					break main
				}
				s1 = x1.highlowcontainer.getKeyAtIndex(pos1)
				s2 = x2.highlowcontainer.getKeyAtIndex(pos2)
			} else if s1 < s2 {
				pos1 = x1.highlowcontainer.advanceUntil(s2, pos1)
				if pos1 == length1 {
					break main
				}
				s1 = x1.highlowcontainer.getKeyAtIndex(pos1)
			} else { // s1 > s2
				pos2 = x2.highlowcontainer.advanceUntil(s1, pos2)
				if pos2 == length2 {
					break main
				}
				s2 = x2.highlowcontainer.getKeyAtIndex(pos2)
			}
		}
	}
	return answer
}

// Xor computes the symmetric difference between two bitmaps and returns the result
func Xor(x1, x2 *Bitmap) *Bitmap {
	answer := NewBitmap()
	pos1 := 0
	pos2 := 0
	length1 := x1.highlowcontainer.size()
	length2 := x2.highlowcontainer.size()
	for {
		if (pos1 < length1) && (pos2 < length2) {
			s1 := x1.highlowcontainer.getKeyAtIndex(pos1)
			s2 := x2.highlowcontainer.getKeyAtIndex(pos2)
			if s1 < s2 {
				answer.highlowcontainer.appendCopy(x1.highlowcontainer, pos1)
				pos1++
			} else if s1 > s2 {
				answer.highlowcontainer.appendCopy(x2.highlowcontainer, pos2)
				pos2++
			} else {
				c := x1.highlowcontainer.getContainerAtIndex(pos1).xor(x2.highlowcontainer.getContainerAtIndex(pos2))
				if !c.isEmpty() {
					answer.highlowcontainer.appendContainer(s1, c, false)
				}
				pos1++
				pos2++
			}
		} else {
			break
		}
	}
	if pos1 == length1 {
		answer.highlowcontainer.appendCopyMany(x2.highlowcontainer, pos2, length2)
	} else if pos2 == length2 {
		answer.highlowcontainer.appendCopyMany(x1.highlowcontainer, pos1, length1)
	}
	return answer
}

// AndNot computes the difference between two bitmaps and returns the result
func AndNot(x1, x2 *Bitmap) *Bitmap {
	answer := NewBitmap()
	pos1 := 0
	pos2 := 0
	length1 := x1.highlowcontainer.size()
	length2 := x2.highlowcontainer.size()

main:
	for {
		if pos1 < length1 && pos2 < length2 {
			s1 := x1.highlowcontainer.getKeyAtIndex(pos1)
			s2 := x2.highlowcontainer.getKeyAtIndex(pos2)
			for {
				if s1 < s2 {
					answer.highlowcontainer.appendCopy(x1.highlowcontainer, pos1)
					pos1++
					if pos1 == length1 {
						break main
					}
					s1 = x1.highlowcontainer.getKeyAtIndex(pos1)
				} else if s1 == s2 {
					c1 := x1.highlowcontainer.getContainerAtIndex(pos1)
					c2 := x2.highlowcontainer.getContainerAtIndex(pos2)
					diff := c1.andNot(c2)
					if !diff.isEmpty() {
						answer.highlowcontainer.appendContainer(s1, diff, false)
					}
					pos1++
					pos2++
					if (pos1 == length1) || (pos2 == length2) {
						break main
					}
					s1 = x1.highlowcontainer.getKeyAtIndex(pos1)
					s2 = x2.highlowcontainer.getKeyAtIndex(pos2)
				} else { //s1 > s2
					pos2 = x2.highlowcontainer.advanceUntil(s1, pos2)
					if pos2 == length2 {
						break main
					}
					s2 = x2.highlowcontainer.getKeyAtIndex(pos2)
				}
			}
		} else {
			break
		}
	}
	if pos2 == length2 {
		answer.highlowcontainer.appendCopyMany(x1.highlowcontainer, pos1, length1)
	}
	return answer
}

// AddMany add all of the values in dat
func (rb *Bitmap) AddMany(dat []uint32) {
	if len(dat) == 0 {
		return
	}
	prev := dat[0]
	idx, c := rb.addwithptr(prev)
	for _, i := range dat[1:] {
		if highbits(prev) == highbits(i) {
			c = c.iaddReturnMinimized(lowbits(i))
			rb.highlowcontainer.setContainerAtIndex(idx, c)
		} else {
			idx, c = rb.addwithptr(i)
		}
		prev = i
	}
}

// BitmapOf generates a new bitmap filled with the specified integers
func BitmapOf(dat ...uint32) *Bitmap {
	ans := NewBitmap()
	ans.AddMany(dat)
	return ans
}

// Flip negates the bits in the given range (i.e., [rangeStart,rangeEnd)), any integer present in this range and in the bitmap is removed,
// and any integer present in the range and not in the bitmap is added.
// The function uses 64-bit parameters even though a Bitmap stores 32-bit values because it is allowed and meaningful to use [0,uint64(0x100000000)) as a range
// while uint64(0x100000000) cannot be represented as a 32-bit value.
func (rb *Bitmap) Flip(rangeStart, rangeEnd uint64) {

	if rangeEnd > MaxUint32+1 {
		panic("rangeEnd > MaxUint32+1")
	}
	if rangeStart > MaxUint32+1 {
		panic("rangeStart > MaxUint32+1")
	}

	if rangeStart >= rangeEnd {
		return
	}

	hbStart := uint32(highbits(uint32(rangeStart)))
	lbStart := uint32(lowbits(uint32(rangeStart)))
	hbLast := uint32(highbits(uint32(rangeEnd - 1)))
	lbLast := uint32(lowbits(uint32(rangeEnd - 1)))

	var max uint32 = maxLowBit
	for hb := hbStart; hb <= hbLast; hb++ {
		var containerStart uint32
		if hb == hbStart {
			containerStart = uint32(lbStart)
		}
		containerLast := max
		if hb == hbLast {
			containerLast = uint32(lbLast)
		}

		i := rb.highlowcontainer.getIndex(uint16(hb))

		if i >= 0 {
			c := rb.highlowcontainer.getWritableContainerAtIndex(i).inot(int(containerStart), int(containerLast)+1)
			if !c.isEmpty() {
				rb.highlowcontainer.setContainerAtIndex(i, c)
			} else {
				rb.highlowcontainer.removeAtIndex(i)
			}
		} else { // *think* the range of ones must never be
			// empty.
			rb.highlowcontainer.insertNewKeyValueAt(-i-1, uint16(hb), rangeOfOnes(int(containerStart), int(containerLast)))
		}
	}
}

// FlipInt calls Flip after casting the parameters  (convenience method)
func (rb *Bitmap) FlipInt(rangeStart, rangeEnd int) {
	rb.Flip(uint64(rangeStart), uint64(rangeEnd))
}

// AddRange adds the integers in [rangeStart, rangeEnd) to the bitmap.
// The function uses 64-bit parameters even though a Bitmap stores 32-bit values because it is allowed and meaningful to use [0,uint64(0x100000000)) as a range
// while uint64(0x100000000) cannot be represented as a 32-bit value.
func (rb *Bitmap) AddRange(rangeStart, rangeEnd uint64) {
	if rangeStart >= rangeEnd {
		return
	}
	if rangeEnd-1 > MaxUint32 {
		panic("rangeEnd-1 > MaxUint32")
	}
	hbStart := uint32(highbits(uint32(rangeStart)))
	lbStart := uint32(lowbits(uint32(rangeStart)))
	hbLast := uint32(highbits(uint32(rangeEnd - 1)))
	lbLast := uint32(lowbits(uint32(rangeEnd - 1)))

	var max uint32 = maxLowBit
	for hb := hbStart; hb <= hbLast; hb++ {
		containerStart := uint32(0)
		if hb == hbStart {
			containerStart = lbStart
		}
		containerLast := max
		if hb == hbLast {
			containerLast = lbLast
		}

		i := rb.highlowcontainer.getIndex(uint16(hb))

		if i >= 0 {
			c := rb.highlowcontainer.getWritableContainerAtIndex(i).iaddRange(int(containerStart), int(containerLast)+1)
			rb.highlowcontainer.setContainerAtIndex(i, c)
		} else { // *think* the range of ones must never be
			// empty.
			rb.highlowcontainer.insertNewKeyValueAt(-i-1, uint16(hb), rangeOfOnes(int(containerStart), int(containerLast)))
		}
	}
}

// RemoveRange removes the integers in [rangeStart, rangeEnd) from the bitmap.
// The function uses 64-bit parameters even though a Bitmap stores 32-bit values because it is allowed and meaningful to use [0,uint64(0x100000000)) as a range
// while uint64(0x100000000) cannot be represented as a 32-bit value.
func (rb *Bitmap) RemoveRange(rangeStart, rangeEnd uint64) {
	if rangeStart >= rangeEnd {
		return
	}
	if rangeEnd-1 > MaxUint32 {
		// logically, we should assume that the user wants to
		// remove all values from rangeStart to infinity
		// see https://github.com/RoaringBitmap/roaring/issues/141
		rangeEnd = uint64(0x100000000)
	}
	hbStart := uint32(highbits(uint32(rangeStart)))
	lbStart := uint32(lowbits(uint32(rangeStart)))
	hbLast := uint32(highbits(uint32(rangeEnd - 1)))
	lbLast := uint32(lowbits(uint32(rangeEnd - 1)))

	var max uint32 = maxLowBit

	if hbStart == hbLast {
		i := rb.highlowcontainer.getIndex(uint16(hbStart))
		if i < 0 {
			return
		}
		c := rb.highlowcontainer.getWritableContainerAtIndex(i).iremoveRange(int(lbStart), int(lbLast+1))
		if !c.isEmpty() {
			rb.highlowcontainer.setContainerAtIndex(i, c)
		} else {
			rb.highlowcontainer.removeAtIndex(i)
		}
		return
	}
	ifirst := rb.highlowcontainer.getIndex(uint16(hbStart))
	ilast := rb.highlowcontainer.getIndex(uint16(hbLast))

	if ifirst >= 0 {
		if lbStart != 0 {
			c := rb.highlowcontainer.getWritableContainerAtIndex(ifirst).iremoveRange(int(lbStart), int(max+1))
			if !c.isEmpty() {
				rb.highlowcontainer.setContainerAtIndex(ifirst, c)
				ifirst++
			}
		}
	} else {
		ifirst = -ifirst - 1
	}
	if ilast >= 0 {
		if lbLast != max {
			c := rb.highlowcontainer.getWritableContainerAtIndex(ilast).iremoveRange(int(0), int(lbLast+1))
			if !c.isEmpty() {
				rb.highlowcontainer.setContainerAtIndex(ilast, c)
			} else {
				ilast++
			}
		} else {
			ilast++
		}
	} else {
		ilast = -ilast - 1
	}
	rb.highlowcontainer.removeIndexRange(ifirst, ilast)
}

// Flip negates the bits in the given range  (i.e., [rangeStart,rangeEnd)), any integer present in this range and in the bitmap is removed,
// and any integer present in the range and not in the bitmap is added, a new bitmap is returned leaving
// the current bitmap unchanged.
// The function uses 64-bit parameters even though a Bitmap stores 32-bit values because it is allowed and meaningful to use [0,uint64(0x100000000)) as a range
// while uint64(0x100000000) cannot be represented as a 32-bit value.
func Flip(bm *Bitmap, rangeStart, rangeEnd uint64) *Bitmap {
	if rangeStart >= rangeEnd {
		return bm.Clone()
	}

	if rangeStart > MaxUint32 {
		panic("rangeStart > MaxUint32")
	}
	if rangeEnd-1 > MaxUint32 {
		panic("rangeEnd-1 > MaxUint32")
	}

	answer := NewBitmap()
	hbStart := uint32(highbits(uint32(rangeStart)))
	lbStart := uint32(lowbits(uint32(rangeStart)))
	hbLast := uint32(highbits(uint32(rangeEnd - 1)))
	lbLast := uint32(lowbits(uint32(rangeEnd - 1)))

	// copy the containers before the active area
	answer.highlowcontainer.appendCopiesUntil(bm.highlowcontainer, uint16(hbStart))

	var max uint32 = maxLowBit
	for hb := hbStart; hb <= hbLast; hb++ {
		var containerStart uint32
		if hb == hbStart {
			containerStart = uint32(lbStart)
		}
		containerLast := max
		if hb == hbLast {
			containerLast = uint32(lbLast)
		}

		i := bm.highlowcontainer.getIndex(uint16(hb))
		j := answer.highlowcontainer.getIndex(uint16(hb))

		if i >= 0 {
			c := bm.highlowcontainer.getContainerAtIndex(i).not(int(containerStart), int(containerLast)+1)
			if !c.isEmpty() {
				answer.highlowcontainer.insertNewKeyValueAt(-j-1, uint16(hb), c)
			}

		} else { // *think* the range of ones must never be
			// empty.
			answer.highlowcontainer.insertNewKeyValueAt(-j-1, uint16(hb),
				rangeOfOnes(int(containerStart), int(containerLast)))
		}
	}
	// copy the containers after the active area.
	answer.highlowcontainer.appendCopiesAfter(bm.highlowcontainer, uint16(hbLast))

	return answer
}

// SetCopyOnWrite sets this bitmap to use copy-on-write so that copies are fast and memory conscious
// if the parameter is true, otherwise we leave the default where hard copies are made
// (copy-on-write requires extra care in a threaded context).
// Calling SetCopyOnWrite(true) on a bitmap created with FromBuffer is unsafe.
func (rb *Bitmap) SetCopyOnWrite(val bool) {
	rb.highlowcontainer.copyOnWrite = val
}

// GetCopyOnWrite gets this bitmap's copy-on-write property
func (rb *Bitmap) GetCopyOnWrite() (val bool) {
	return rb.highlowcontainer.copyOnWrite
}

// CloneCopyOnWriteContainers clones all containers which have
// needCopyOnWrite set to true.
// This can be used to make sure it is safe to munmap a []byte
// that the roaring array may still have a reference to, after
// calling FromBuffer.
// More generally this function is useful if you call FromBuffer
// to construct a bitmap with a backing array buf
// and then later discard the buf array. Note that you should call
// CloneCopyOnWriteContainers on all bitmaps that were derived
// from the 'FromBuffer' bitmap since they map have dependencies
// on the buf array as well.
func (rb *Bitmap) CloneCopyOnWriteContainers() {
	rb.highlowcontainer.cloneCopyOnWriteContainers()
}

// FlipInt calls Flip after casting the parameters (convenience method)
func FlipInt(bm *Bitmap, rangeStart, rangeEnd int) *Bitmap {
	return Flip(bm, uint64(rangeStart), uint64(rangeEnd))
}

// Statistics provides details on the container types in use.
type Statistics struct {
	Cardinality uint64
	Containers  uint64

	ArrayContainers      uint64
	ArrayContainerBytes  uint64
	ArrayContainerValues uint64

	BitmapContainers      uint64
	BitmapContainerBytes  uint64
	BitmapContainerValues uint64

	RunContainers      uint64
	RunContainerBytes  uint64
	RunContainerValues uint64
}

// Stats returns details on container type usage in a Statistics struct.
func (rb *Bitmap) Stats() Statistics {
	stats := Statistics{}
	stats.Containers = uint64(len(rb.highlowcontainer.containers))
	for _, c := range rb.highlowcontainer.containers {
		stats.Cardinality += uint64(c.getCardinality())

		switch c.(type) {
		case *arrayContainer:
			stats.ArrayContainers++
			stats.ArrayContainerBytes += uint64(c.getSizeInBytes())
			stats.ArrayContainerValues += uint64(c.getCardinality())
		case *bitmapContainer:
			stats.BitmapContainers++
			stats.BitmapContainerBytes += uint64(c.getSizeInBytes())
			stats.BitmapContainerValues += uint64(c.getCardinality())
		case *runContainer16:
			stats.RunContainers++
			stats.RunContainerBytes += uint64(c.getSizeInBytes())
			stats.RunContainerValues += uint64(c.getCardinality())
		}
	}
	return stats
}
