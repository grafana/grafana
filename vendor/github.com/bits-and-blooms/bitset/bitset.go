/*
Package bitset implements bitsets, a mapping
between non-negative integers and boolean values. It should be more
efficient than map[uint] bool.

It provides methods for setting, clearing, flipping, and testing
individual integers.

But it also provides set intersection, union, difference,
complement, and symmetric operations, as well as tests to
check whether any, all, or no bits are set, and querying a
bitset's current length and number of positive bits.

BitSets are expanded to the size of the largest set bit; the
memory allocation is approximately Max bits, where Max is
the largest set bit. BitSets are never shrunk. On creation,
a hint can be given for the number of bits that will be used.

Many of the methods, including Set,Clear, and Flip, return
a BitSet pointer, which allows for chaining.

Example use:

	import "bitset"
	var b BitSet
	b.Set(10).Set(11)
	if b.Test(1000) {
		b.Clear(1000)
	}
	if B.Intersection(bitset.New(100).Set(10)).Count() > 1 {
		fmt.Println("Intersection works.")
	}

As an alternative to BitSets, one should check out the 'big' package,
which provides a (less set-theoretical) view of bitsets.
*/
package bitset

import (
	"bytes"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/bits"
	"strconv"
)

// the wordSize of a bit set
const wordSize = 64

// the wordSize of a bit set in bytes
const wordBytes = wordSize / 8

// wordMask is wordSize-1, used for bit indexing in a word
const wordMask = wordSize - 1

// log2WordSize is lg(wordSize)
const log2WordSize = 6

// allBits has every bit set
const allBits uint64 = 0xffffffffffffffff

// default binary BigEndian
var binaryOrder binary.ByteOrder = binary.BigEndian

// default json encoding base64.URLEncoding
var base64Encoding = base64.URLEncoding

// Base64StdEncoding Marshal/Unmarshal BitSet with base64.StdEncoding(Default: base64.URLEncoding)
func Base64StdEncoding() { base64Encoding = base64.StdEncoding }

// LittleEndian sets Marshal/Unmarshal Binary as Little Endian (Default: binary.BigEndian)
func LittleEndian() { binaryOrder = binary.LittleEndian }

// BigEndian sets Marshal/Unmarshal Binary as Big Endian (Default: binary.BigEndian)
func BigEndian() { binaryOrder = binary.BigEndian }

// BinaryOrder returns the current binary order, see also LittleEndian()
// and BigEndian() to change the order.
func BinaryOrder() binary.ByteOrder { return binaryOrder }

// A BitSet is a set of bits. The zero value of a BitSet is an empty set of length 0.
type BitSet struct {
	length uint
	set    []uint64
}

// Error is used to distinguish errors (panics) generated in this package.
type Error string

// safeSet will fixup b.set to be non-nil and return the field value
func (b *BitSet) safeSet() []uint64 {
	if b.set == nil {
		b.set = make([]uint64, wordsNeeded(0))
	}
	return b.set
}

// SetBitsetFrom fills the bitset with an array of integers without creating a new BitSet instance
func (b *BitSet) SetBitsetFrom(buf []uint64) {
	b.length = uint(len(buf)) * 64
	b.set = buf
}

// From is a constructor used to create a BitSet from an array of words
func From(buf []uint64) *BitSet {
	return FromWithLength(uint(len(buf))*64, buf)
}

// FromWithLength constructs from an array of words and length in bits.
// This function is for advanced users, most users should prefer
// the From function.
// As a user of FromWithLength, you are responsible for ensuring
// that the length is correct: your slice should have length at
// least (length+63)/64 in 64-bit words.
func FromWithLength(length uint, set []uint64) *BitSet {
	if len(set) < wordsNeeded(length) {
		panic("BitSet.FromWithLength: slice is too short")
	}
	return &BitSet{length, set}
}

// Bytes returns the bitset as array of 64-bit words, giving direct access to the internal representation.
// It is not a copy, so changes to the returned slice will affect the bitset.
// It is meant for advanced users.
//
// Deprecated: Bytes is deprecated. Use [BitSet.Words] instead.
func (b *BitSet) Bytes() []uint64 {
	return b.set
}

// Words returns the bitset as array of 64-bit words, giving direct access to the internal representation.
// It is not a copy, so changes to the returned slice will affect the bitset.
// It is meant for advanced users.
func (b *BitSet) Words() []uint64 {
	return b.set
}

// wordsNeeded calculates the number of words needed for i bits
func wordsNeeded(i uint) int {
	if i > (Cap() - wordMask) {
		return int(Cap() >> log2WordSize)
	}
	return int((i + wordMask) >> log2WordSize)
}

// wordsNeededUnbound calculates the number of words needed for i bits, possibly exceeding the capacity.
// This function is useful if you know that the capacity cannot be exceeded (e.g., you have an existing BitSet).
func wordsNeededUnbound(i uint) int {
	return (int(i) + wordMask) >> log2WordSize
}

// wordsIndex calculates the index of words in a `uint64`
func wordsIndex(i uint) uint {
	return i & wordMask
}

// New creates a new BitSet with a hint that length bits will be required.
// The memory usage is at least length/8 bytes.
// In case of allocation failure, the function will return a BitSet with zero
// capacity.
func New(length uint) (bset *BitSet) {
	defer func() {
		if r := recover(); r != nil {
			bset = &BitSet{
				0,
				make([]uint64, 0),
			}
		}
	}()

	bset = &BitSet{
		length,
		make([]uint64, wordsNeeded(length)),
	}

	return bset
}

// MustNew creates a new BitSet with the given length bits.
// It panics if length exceeds the possible capacity or by a lack of memory.
func MustNew(length uint) (bset *BitSet) {
	if length >= Cap() {
		panic("You are exceeding the capacity")
	}

	return &BitSet{
		length,
		make([]uint64, wordsNeeded(length)), // may panic on lack of memory
	}
}

// Cap returns the total possible capacity, or number of bits
// that can be stored in the BitSet theoretically. Under 32-bit system,
// it is 4294967295 and under 64-bit system, it is 18446744073709551615.
// Note that this is further limited by the maximum allocation size in Go,
// and your available memory, as any Go data structure.
func Cap() uint {
	return ^uint(0)
}

// Len returns the number of bits in the BitSet.
// Note that it differ from Count function.
func (b *BitSet) Len() uint {
	return b.length
}

// extendSet adds additional words to incorporate new bits if needed
func (b *BitSet) extendSet(i uint) {
	if i >= Cap() {
		panic("You are exceeding the capacity")
	}
	nsize := wordsNeeded(i + 1)
	if b.set == nil {
		b.set = make([]uint64, nsize)
	} else if cap(b.set) >= nsize {
		b.set = b.set[:nsize] // fast resize
	} else if len(b.set) < nsize {
		newset := make([]uint64, nsize, 2*nsize) // increase capacity 2x
		copy(newset, b.set)
		b.set = newset
	}
	b.length = i + 1
}

// Test whether bit i is set.
func (b *BitSet) Test(i uint) bool {
	if i >= b.length {
		return false
	}
	return b.set[i>>log2WordSize]&(1<<wordsIndex(i)) != 0
}

// GetWord64AtBit retrieves bits i through i+63 as a single uint64 value
func (b *BitSet) GetWord64AtBit(i uint) uint64 {
	firstWordIndex := int(i >> log2WordSize)
	subWordIndex := wordsIndex(i)

	// The word that the index falls within, shifted so the index is at bit 0
	var firstWord, secondWord uint64
	if firstWordIndex < len(b.set) {
		firstWord = b.set[firstWordIndex] >> subWordIndex
	}

	// The next word, masked to only include the necessary bits and shifted to cover the
	// top of the word
	if (firstWordIndex + 1) < len(b.set) {
		secondWord = b.set[firstWordIndex+1] << uint64(wordSize-subWordIndex)
	}

	return firstWord | secondWord
}

// Set bit i to 1, the capacity of the bitset is automatically
// increased accordingly.
// Warning: using a very large value for 'i'
// may lead to a memory shortage and a panic: the caller is responsible
// for providing sensible parameters in line with their memory capacity.
// The memory usage is at least slightly over i/8 bytes.
func (b *BitSet) Set(i uint) *BitSet {
	if i >= b.length { // if we need more bits, make 'em
		b.extendSet(i)
	}
	b.set[i>>log2WordSize] |= 1 << wordsIndex(i)
	return b
}

// Clear bit i to 0. This never cause a memory allocation. It is always safe.
func (b *BitSet) Clear(i uint) *BitSet {
	if i >= b.length {
		return b
	}
	b.set[i>>log2WordSize] &^= 1 << wordsIndex(i)
	return b
}

// SetTo sets bit i to value.
// Warning: using a very large value for 'i'
// may lead to a memory shortage and a panic: the caller is responsible
// for providing sensible parameters in line with their memory capacity.
func (b *BitSet) SetTo(i uint, value bool) *BitSet {
	if value {
		return b.Set(i)
	}
	return b.Clear(i)
}

// Flip bit at i.
// Warning: using a very large value for 'i'
// may lead to a memory shortage and a panic: the caller is responsible
// for providing sensible parameters in line with their memory capacity.
func (b *BitSet) Flip(i uint) *BitSet {
	if i >= b.length {
		return b.Set(i)
	}
	b.set[i>>log2WordSize] ^= 1 << wordsIndex(i)
	return b
}

// FlipRange bit in [start, end).
// Warning: using a very large value for 'end'
// may lead to a memory shortage and a panic: the caller is responsible
// for providing sensible parameters in line with their memory capacity.
func (b *BitSet) FlipRange(start, end uint) *BitSet {
	if start >= end {
		return b
	}

	if end-1 >= b.length { // if we need more bits, make 'em
		b.extendSet(end - 1)
	}

	startWord := int(start >> log2WordSize)
	endWord := int(end >> log2WordSize)

	// b.set[startWord] ^= ^(^uint64(0) << wordsIndex(start))
	//  e.g:
	//  start = 71,
	//  startWord = 1
	//  wordsIndex(start) = 71 % 64 = 7
	//   (^uint64(0) << 7) = 0b111111....11110000000
	//
	//  mask = ^(^uint64(0) << 7) = 0b000000....00001111111
	//
	// flips the first 7 bits in b.set[1] and
	// in the range loop, the b.set[1] gets again flipped
	// so the two expressions flip results in a flip
	// in b.set[1] from [7,63]
	//
	// handle startWord special, get's reflipped in range loop
	b.set[startWord] ^= ^(^uint64(0) << wordsIndex(start))

	for idx := range b.set[startWord:endWord] {
		b.set[startWord+idx] = ^b.set[startWord+idx]
	}

	// handle endWord special
	//  e.g.
	// end = 135
	//  endWord = 2
	//
	//  wordsIndex(-7) = 57
	//  see the golang spec:
	//   "For unsigned integer values, the operations +, -, *, and << are computed
	//   modulo 2n, where n is the bit width of the unsigned integer's type."
	//
	//   mask = ^uint64(0) >> 57 = 0b00000....0001111111
	//
	// flips in b.set[2] from [0,7]
	//
	// is end at word boundary?
	if idx := wordsIndex(-end); idx != 0 {
		b.set[endWord] ^= ^uint64(0) >> wordsIndex(idx)
	}

	return b
}

// Shrink shrinks BitSet so that the provided value is the last possible
// set value. It clears all bits > the provided index and reduces the size
// and length of the set.
//
// Note that the parameter value is not the new length in bits: it is the
// maximal value that can be stored in the bitset after the function call.
// The new length in bits is the parameter value + 1. Thus it is not possible
// to use this function to set the length to 0, the minimal value of the length
// after this function call is 1.
//
// A new slice is allocated to store the new bits, so you may see an increase in
// memory usage until the GC runs. Normally this should not be a problem, but if you
// have an extremely large BitSet its important to understand that the old BitSet will
// remain in memory until the GC frees it.
// If you are memory constrained, this function may cause a panic.
func (b *BitSet) Shrink(lastbitindex uint) *BitSet {
	length := lastbitindex + 1
	idx := wordsNeeded(length)
	if idx > len(b.set) {
		return b
	}
	shrunk := make([]uint64, idx)
	copy(shrunk, b.set[:idx])
	b.set = shrunk
	b.length = length
	lastWordUsedBits := length % 64
	if lastWordUsedBits != 0 {
		b.set[idx-1] &= allBits >> uint64(64-wordsIndex(lastWordUsedBits))
	}
	return b
}

// Compact shrinks BitSet to so that we preserve all set bits, while minimizing
// memory usage. Compact calls Shrink.
// A new slice is allocated to store the new bits, so you may see an increase in
// memory usage until the GC runs. Normally this should not be a problem, but if you
// have an extremely large BitSet its important to understand that the old BitSet will
// remain in memory until the GC frees it.
// If you are memory constrained, this function may cause a panic.
func (b *BitSet) Compact() *BitSet {
	idx := len(b.set) - 1
	for ; idx >= 0 && b.set[idx] == 0; idx-- {
	}
	newlength := uint((idx + 1) << log2WordSize)
	if newlength >= b.length {
		return b // nothing to do
	}
	if newlength > 0 {
		return b.Shrink(newlength - 1)
	}
	// We preserve one word
	return b.Shrink(63)
}

// InsertAt takes an index which indicates where a bit should be
// inserted. Then it shifts all the bits in the set to the left by 1, starting
// from the given index position, and sets the index position to 0.
//
// Depending on the size of your BitSet, and where you are inserting the new entry,
// this method could be extremely slow and in some cases might cause the entire BitSet
// to be recopied.
func (b *BitSet) InsertAt(idx uint) *BitSet {
	insertAtElement := idx >> log2WordSize

	// if length of set is a multiple of wordSize we need to allocate more space first
	if b.isLenExactMultiple() {
		b.set = append(b.set, uint64(0))
	}

	var i uint
	for i = uint(len(b.set) - 1); i > insertAtElement; i-- {
		// all elements above the position where we want to insert can simply by shifted
		b.set[i] <<= 1

		// we take the most significant bit of the previous element and set it as
		// the least significant bit of the current element
		b.set[i] |= (b.set[i-1] & 0x8000000000000000) >> 63
	}

	// generate a mask to extract the data that we need to shift left
	// within the element where we insert a bit
	dataMask := uint64(1)<<uint64(wordsIndex(idx)) - 1

	// extract that data that we'll shift
	data := b.set[i] & (^dataMask)

	// set the positions of the data mask to 0 in the element where we insert
	b.set[i] &= dataMask

	// shift data mask to the left and insert its data to the slice element
	b.set[i] |= data << 1

	// add 1 to length of BitSet
	b.length++

	return b
}

// String creates a string representation of the BitSet. It is only intended for
// human-readable output and not for serialization.
func (b *BitSet) String() string {
	// follows code from https://github.com/RoaringBitmap/roaring
	var buffer bytes.Buffer
	start := []byte("{")
	buffer.Write(start)
	counter := 0
	i, e := b.NextSet(0)
	for e {
		counter = counter + 1
		// to avoid exhausting the memory
		if counter > 0x40000 {
			buffer.WriteString("...")
			break
		}
		buffer.WriteString(strconv.FormatInt(int64(i), 10))
		i, e = b.NextSet(i + 1)
		if e {
			buffer.WriteString(",")
		}
	}
	buffer.WriteString("}")
	return buffer.String()
}

// DeleteAt deletes the bit at the given index position from
// within the bitset
// All the bits residing on the left of the deleted bit get
// shifted right by 1
// The running time of this operation may potentially be
// relatively slow, O(length)
func (b *BitSet) DeleteAt(i uint) *BitSet {
	// the index of the slice element where we'll delete a bit
	deleteAtElement := i >> log2WordSize

	// generate a mask for the data that needs to be shifted right
	// within that slice element that gets modified
	dataMask := ^((uint64(1) << wordsIndex(i)) - 1)

	// extract the data that we'll shift right from the slice element
	data := b.set[deleteAtElement] & dataMask

	// set the masked area to 0 while leaving the rest as it is
	b.set[deleteAtElement] &= ^dataMask

	// shift the previously extracted data to the right and then
	// set it in the previously masked area
	b.set[deleteAtElement] |= (data >> 1) & dataMask

	// loop over all the consecutive slice elements to copy each
	// lowest bit into the highest position of the previous element,
	// then shift the entire content to the right by 1
	for i := int(deleteAtElement) + 1; i < len(b.set); i++ {
		b.set[i-1] |= (b.set[i] & 1) << 63
		b.set[i] >>= 1
	}

	b.length = b.length - 1

	return b
}

// AppendTo appends all set bits to buf and returns the (maybe extended) buf.
// In case of allocation failure, the function will panic.
//
// See also [BitSet.AsSlice] and [BitSet.NextSetMany].
func (b *BitSet) AppendTo(buf []uint) []uint {
	// In theory, we could overflow uint, but in practice, we will not.
	for idx, word := range b.set {
		for word != 0 {
			// In theory idx<<log2WordSize could overflow, but it will not overflow
			// in practice.
			buf = append(buf, uint(idx<<log2WordSize+bits.TrailingZeros64(word)))

			// clear the rightmost set bit
			word &= word - 1
		}
	}

	return buf
}

// AsSlice returns all set bits as slice.
// It panics if the capacity of buf is < b.Count()
//
// See also [BitSet.AppendTo] and [BitSet.NextSetMany].
func (b *BitSet) AsSlice(buf []uint) []uint {
	buf = buf[:cap(buf)] // len = cap

	size := 0
	for idx, word := range b.set {
		for ; word != 0; size++ {
			// panics if capacity of buf is exceeded.
			// In theory idx<<log2WordSize could overflow, but it will not overflow
			// in practice.
			buf[size] = uint(idx<<log2WordSize + bits.TrailingZeros64(word))

			// clear the rightmost set bit
			word &= word - 1
		}
	}

	buf = buf[:size]
	return buf
}

// NextSet returns the next bit set from the specified index,
// including possibly the current index
// along with an error code (true = valid, false = no set bit found)
// for i,e := v.NextSet(0); e; i,e = v.NextSet(i + 1) {...}
//
// Users concerned with performance may want to use NextSetMany to
// retrieve several values at once.
func (b *BitSet) NextSet(i uint) (uint, bool) {
	x := int(i >> log2WordSize)
	if x >= len(b.set) {
		return 0, false
	}

	// process first (partial) word
	word := b.set[x] >> wordsIndex(i)
	if word != 0 {
		return i + uint(bits.TrailingZeros64(word)), true
	}

	// process the following full words until next bit is set
	// x < len(b.set), no out-of-bounds panic in following slice expression
	x++
	for idx, word := range b.set[x:] {
		if word != 0 {
			return uint((x+idx)<<log2WordSize + bits.TrailingZeros64(word)), true
		}
	}

	return 0, false
}

// NextSetMany returns many next bit sets from the specified index,
// including possibly the current index and up to cap(buffer).
// If the returned slice has len zero, then no more set bits were found
//
//	buffer := make([]uint, 256) // this should be reused
//	j := uint(0)
//	j, buffer = bitmap.NextSetMany(j, buffer)
//	for ; len(buffer) > 0; j, buffer = bitmap.NextSetMany(j,buffer) {
//	 for k := range buffer {
//	  do something with buffer[k]
//	 }
//	 j += 1
//	}
//
// It is possible to retrieve all set bits as follow:
//
//	indices := make([]uint, bitmap.Count())
//	bitmap.NextSetMany(0, indices)
//
// It is also possible to retrieve all set bits with [BitSet.AppendTo]
// or [BitSet.AsSlice].
//
// However if Count() is large, it might be preferable to
// use several calls to NextSetMany for memory reasons.
func (b *BitSet) NextSetMany(i uint, buffer []uint) (uint, []uint) {
	// In theory, we could overflow uint, but in practice, we will not.
	capacity := cap(buffer)
	result := buffer[:capacity]

	x := int(i >> log2WordSize)
	if x >= len(b.set) || capacity == 0 {
		return 0, result[:0]
	}

	// process first (partial) word
	word := b.set[x] >> wordsIndex(i)

	size := 0
	for word != 0 {
		result[size] = i + uint(bits.TrailingZeros64(word))

		size++
		if size == capacity {
			return result[size-1], result[:size]
		}

		// clear the rightmost set bit
		word &= word - 1
	}

	// process the following full words
	// x < len(b.set), no out-of-bounds panic in following slice expression
	x++
	for idx, word := range b.set[x:] {
		for word != 0 {
			result[size] = uint((x+idx)<<log2WordSize + bits.TrailingZeros64(word))

			size++
			if size == capacity {
				return result[size-1], result[:size]
			}

			// clear the rightmost set bit
			word &= word - 1
		}
	}

	if size > 0 {
		return result[size-1], result[:size]
	}
	return 0, result[:0]
}

// NextClear returns the next clear bit from the specified index,
// including possibly the current index
// along with an error code (true = valid, false = no bit found i.e. all bits are set)
func (b *BitSet) NextClear(i uint) (uint, bool) {
	x := int(i >> log2WordSize)
	if x >= len(b.set) {
		return 0, false
	}

	// process first (maybe partial) word
	word := b.set[x]
	word = word >> wordsIndex(i)
	wordAll := allBits >> wordsIndex(i)

	index := i + uint(bits.TrailingZeros64(^word))
	if word != wordAll && index < b.length {
		return index, true
	}

	// process the following full words until next bit is cleared
	// x < len(b.set), no out-of-bounds panic in following slice expression
	x++
	for idx, word := range b.set[x:] {
		if word != allBits {
			index = uint((x+idx)*wordSize + bits.TrailingZeros64(^word))
			if index < b.length {
				return index, true
			}
		}
	}

	return 0, false
}

// PreviousSet returns the previous set bit from the specified index,
// including possibly the current index
// along with an error code (true = valid, false = no bit found i.e. all bits are clear)
func (b *BitSet) PreviousSet(i uint) (uint, bool) {
	x := int(i >> log2WordSize)
	if x >= len(b.set) {
		return 0, false
	}
	word := b.set[x]

	// Clear the bits above the index
	word = word & ((1 << (wordsIndex(i) + 1)) - 1)
	if word != 0 {
		return uint(x<<log2WordSize+bits.Len64(word)) - 1, true
	}

	for x--; x >= 0; x-- {
		word = b.set[x]
		if word != 0 {
			return uint(x<<log2WordSize+bits.Len64(word)) - 1, true
		}
	}
	return 0, false
}

// PreviousClear returns the previous clear bit from the specified index,
// including possibly the current index
// along with an error code (true = valid, false = no clear bit found i.e. all bits are set)
func (b *BitSet) PreviousClear(i uint) (uint, bool) {
	x := int(i >> log2WordSize)
	if x >= len(b.set) {
		return 0, false
	}
	word := b.set[x]

	// Flip all bits and find the highest one bit
	word = ^word

	// Clear the bits above the index
	word = word & ((1 << (wordsIndex(i) + 1)) - 1)

	if word != 0 {
		return uint(x<<log2WordSize+bits.Len64(word)) - 1, true
	}

	for x--; x >= 0; x-- {
		word = b.set[x]
		word = ^word
		if word != 0 {
			return uint(x<<log2WordSize+bits.Len64(word)) - 1, true
		}
	}
	return 0, false
}

// ClearAll clears the entire BitSet.
// It does not free the memory.
func (b *BitSet) ClearAll() *BitSet {
	if b != nil && b.set != nil {
		for i := range b.set {
			b.set[i] = 0
		}
	}
	return b
}

// SetAll sets the entire BitSet
func (b *BitSet) SetAll() *BitSet {
	if b != nil && b.set != nil {
		for i := range b.set {
			b.set[i] = allBits
		}

		b.cleanLastWord()
	}
	return b
}

// wordCount returns the number of words used in a bit set
func (b *BitSet) wordCount() int {
	return wordsNeededUnbound(b.length)
}

// Clone this BitSet, returning a new BitSet that has the same bits set.
// In case of allocation failure, the function will return an empty BitSet.
func (b *BitSet) Clone() *BitSet {
	c := New(b.length)
	if b.set != nil { // Clone should not modify current object
		copy(c.set, b.set)
	}
	return c
}

// Copy into a destination BitSet using the Go array copy semantics:
// the number of bits copied is the minimum of the number of bits in the current
// BitSet (Len()) and the destination Bitset.
// We return the number of bits copied in the destination BitSet.
func (b *BitSet) Copy(c *BitSet) (count uint) {
	if c == nil {
		return
	}
	if b.set != nil { // Copy should not modify current object
		copy(c.set, b.set)
	}
	count = c.length
	if b.length < c.length {
		count = b.length
	}
	// Cleaning the last word is needed to keep the invariant that other functions, such as Count, require
	// that any bits in the last word that would exceed the length of the bitmask are set to 0.
	c.cleanLastWord()
	return
}

// CopyFull copies into a destination BitSet such that the destination is
// identical to the source after the operation, allocating memory if necessary.
func (b *BitSet) CopyFull(c *BitSet) {
	if c == nil {
		return
	}
	c.length = b.length
	if len(b.set) == 0 {
		if c.set != nil {
			c.set = c.set[:0]
		}
	} else {
		if cap(c.set) < len(b.set) {
			c.set = make([]uint64, len(b.set))
		} else {
			c.set = c.set[:len(b.set)]
		}
		copy(c.set, b.set)
	}
}

// Count (number of set bits).
// Also known as "popcount" or "population count".
func (b *BitSet) Count() uint {
	if b != nil && b.set != nil {
		return uint(popcntSlice(b.set))
	}
	return 0
}

// Equal tests the equivalence of two BitSets.
// False if they are of different sizes, otherwise true
// only if all the same bits are set
func (b *BitSet) Equal(c *BitSet) bool {
	if c == nil || b == nil {
		return c == b
	}
	if b.length != c.length {
		return false
	}
	if b.length == 0 { // if they have both length == 0, then could have nil set
		return true
	}
	wn := b.wordCount()
	// bounds check elimination
	if wn <= 0 {
		return true
	}
	_ = b.set[wn-1]
	_ = c.set[wn-1]
	for p := 0; p < wn; p++ {
		if c.set[p] != b.set[p] {
			return false
		}
	}
	return true
}

func panicIfNull(b *BitSet) {
	if b == nil {
		panic(Error("BitSet must not be null"))
	}
}

// Difference of base set and other set
// This is the BitSet equivalent of &^ (and not)
func (b *BitSet) Difference(compare *BitSet) (result *BitSet) {
	panicIfNull(b)
	panicIfNull(compare)
	result = b.Clone() // clone b (in case b is bigger than compare)
	l := compare.wordCount()
	if l > b.wordCount() {
		l = b.wordCount()
	}
	for i := 0; i < l; i++ {
		result.set[i] = b.set[i] &^ compare.set[i]
	}
	return
}

// DifferenceCardinality computes the cardinality of the difference
func (b *BitSet) DifferenceCardinality(compare *BitSet) uint {
	panicIfNull(b)
	panicIfNull(compare)
	l := compare.wordCount()
	if l > b.wordCount() {
		l = b.wordCount()
	}
	cnt := uint64(0)
	cnt += popcntMaskSlice(b.set[:l], compare.set[:l])
	cnt += popcntSlice(b.set[l:])
	return uint(cnt)
}

// InPlaceDifference computes the difference of base set and other set
// This is the BitSet equivalent of &^ (and not)
func (b *BitSet) InPlaceDifference(compare *BitSet) {
	panicIfNull(b)
	panicIfNull(compare)
	l := compare.wordCount()
	if l > b.wordCount() {
		l = b.wordCount()
	}
	if l <= 0 {
		return
	}
	// bounds check elimination
	data, cmpData := b.set, compare.set
	_ = data[l-1]
	_ = cmpData[l-1]
	for i := 0; i < l; i++ {
		data[i] &^= cmpData[i]
	}
}

// Convenience function: return two bitsets ordered by
// increasing length. Note: neither can be nil
func sortByLength(a *BitSet, b *BitSet) (ap *BitSet, bp *BitSet) {
	if a.length <= b.length {
		ap, bp = a, b
	} else {
		ap, bp = b, a
	}
	return
}

// Intersection of base set and other set
// This is the BitSet equivalent of & (and)
// In case of allocation failure, the function will return an empty BitSet.
func (b *BitSet) Intersection(compare *BitSet) (result *BitSet) {
	panicIfNull(b)
	panicIfNull(compare)
	b, compare = sortByLength(b, compare)
	result = New(b.length)
	for i, word := range b.set {
		result.set[i] = word & compare.set[i]
	}
	return
}

// IntersectionCardinality computes the cardinality of the intersection
func (b *BitSet) IntersectionCardinality(compare *BitSet) uint {
	panicIfNull(b)
	panicIfNull(compare)
	b, compare = sortByLength(b, compare)
	cnt := popcntAndSlice(b.set, compare.set)
	return uint(cnt)
}

// InPlaceIntersection destructively computes the intersection of
// base set and the compare set.
// This is the BitSet equivalent of & (and)
func (b *BitSet) InPlaceIntersection(compare *BitSet) {
	panicIfNull(b)
	panicIfNull(compare)
	l := compare.wordCount()
	if l > b.wordCount() {
		l = b.wordCount()
	}
	if l > 0 {
		// bounds check elimination
		data, cmpData := b.set, compare.set
		_ = data[l-1]
		_ = cmpData[l-1]

		for i := 0; i < l; i++ {
			data[i] &= cmpData[i]
		}
	}
	if l >= 0 {
		for i := l; i < len(b.set); i++ {
			b.set[i] = 0
		}
	}
	if compare.length > 0 {
		if compare.length-1 >= b.length {
			b.extendSet(compare.length - 1)
		}
	}
}

// Union of base set and other set
// This is the BitSet equivalent of | (or)
func (b *BitSet) Union(compare *BitSet) (result *BitSet) {
	panicIfNull(b)
	panicIfNull(compare)
	b, compare = sortByLength(b, compare)
	result = compare.Clone()
	for i, word := range b.set {
		result.set[i] = word | compare.set[i]
	}
	return
}

// UnionCardinality computes the cardinality of the uniton of the base set
// and the compare set.
func (b *BitSet) UnionCardinality(compare *BitSet) uint {
	panicIfNull(b)
	panicIfNull(compare)
	b, compare = sortByLength(b, compare)
	cnt := popcntOrSlice(b.set, compare.set)
	if len(compare.set) > len(b.set) {
		cnt += popcntSlice(compare.set[len(b.set):])
	}
	return uint(cnt)
}

// InPlaceUnion creates the destructive union of base set and compare set.
// This is the BitSet equivalent of | (or).
func (b *BitSet) InPlaceUnion(compare *BitSet) {
	panicIfNull(b)
	panicIfNull(compare)
	l := compare.wordCount()
	if l > b.wordCount() {
		l = b.wordCount()
	}
	if compare.length > 0 && compare.length-1 >= b.length {
		b.extendSet(compare.length - 1)
	}
	if l > 0 {
		// bounds check elimination
		data, cmpData := b.set, compare.set
		_ = data[l-1]
		_ = cmpData[l-1]

		for i := 0; i < l; i++ {
			data[i] |= cmpData[i]
		}
	}
	if len(compare.set) > l {
		for i := l; i < len(compare.set); i++ {
			b.set[i] = compare.set[i]
		}
	}
}

// SymmetricDifference of base set and other set
// This is the BitSet equivalent of ^ (xor)
func (b *BitSet) SymmetricDifference(compare *BitSet) (result *BitSet) {
	panicIfNull(b)
	panicIfNull(compare)
	b, compare = sortByLength(b, compare)
	// compare is bigger, so clone it
	result = compare.Clone()
	for i, word := range b.set {
		result.set[i] = word ^ compare.set[i]
	}
	return
}

// SymmetricDifferenceCardinality computes the cardinality of the symmetric difference
func (b *BitSet) SymmetricDifferenceCardinality(compare *BitSet) uint {
	panicIfNull(b)
	panicIfNull(compare)
	b, compare = sortByLength(b, compare)
	cnt := popcntXorSlice(b.set, compare.set)
	if len(compare.set) > len(b.set) {
		cnt += popcntSlice(compare.set[len(b.set):])
	}
	return uint(cnt)
}

// InPlaceSymmetricDifference creates the destructive SymmetricDifference of base set and other set
// This is the BitSet equivalent of ^ (xor)
func (b *BitSet) InPlaceSymmetricDifference(compare *BitSet) {
	panicIfNull(b)
	panicIfNull(compare)
	l := compare.wordCount()
	if l > b.wordCount() {
		l = b.wordCount()
	}
	if compare.length > 0 && compare.length-1 >= b.length {
		b.extendSet(compare.length - 1)
	}
	if l > 0 {
		// bounds check elimination
		data, cmpData := b.set, compare.set
		_ = data[l-1]
		_ = cmpData[l-1]
		for i := 0; i < l; i++ {
			data[i] ^= cmpData[i]
		}
	}
	if len(compare.set) > l {
		for i := l; i < len(compare.set); i++ {
			b.set[i] = compare.set[i]
		}
	}
}

// Is the length an exact multiple of word sizes?
func (b *BitSet) isLenExactMultiple() bool {
	return wordsIndex(b.length) == 0
}

// Clean last word by setting unused bits to 0
func (b *BitSet) cleanLastWord() {
	if !b.isLenExactMultiple() {
		b.set[len(b.set)-1] &= allBits >> (wordSize - wordsIndex(b.length))
	}
}

// Complement computes the (local) complement of a bitset (up to length bits)
// In case of allocation failure, the function will return an empty BitSet.
func (b *BitSet) Complement() (result *BitSet) {
	panicIfNull(b)
	result = New(b.length)
	for i, word := range b.set {
		result.set[i] = ^word
	}
	result.cleanLastWord()
	return
}

// All returns true if all bits are set, false otherwise. Returns true for
// empty sets.
func (b *BitSet) All() bool {
	panicIfNull(b)
	return b.Count() == b.length
}

// None returns true if no bit is set, false otherwise. Returns true for
// empty sets.
func (b *BitSet) None() bool {
	panicIfNull(b)
	if b != nil && b.set != nil {
		for _, word := range b.set {
			if word > 0 {
				return false
			}
		}
	}
	return true
}

// Any returns true if any bit is set, false otherwise
func (b *BitSet) Any() bool {
	panicIfNull(b)
	return !b.None()
}

// IsSuperSet returns true if this is a superset of the other set
func (b *BitSet) IsSuperSet(other *BitSet) bool {
	l := other.wordCount()
	if b.wordCount() < l {
		l = b.wordCount()
	}
	for i, word := range other.set[:l] {
		if b.set[i]&word != word {
			return false
		}
	}
	return popcntSlice(other.set[l:]) == 0
}

// IsStrictSuperSet returns true if this is a strict superset of the other set
func (b *BitSet) IsStrictSuperSet(other *BitSet) bool {
	return b.Count() > other.Count() && b.IsSuperSet(other)
}

// DumpAsBits dumps a bit set as a string of bits. Following the usual convention in Go,
// the least significant bits are printed last (index 0 is at the end of the string).
// This is useful for debugging and testing. It is not suitable for serialization.
func (b *BitSet) DumpAsBits() string {
	if b.set == nil {
		return "."
	}
	buffer := bytes.NewBufferString("")
	i := len(b.set) - 1
	for ; i >= 0; i-- {
		fmt.Fprintf(buffer, "%064b.", b.set[i])
	}
	return buffer.String()
}

// BinaryStorageSize returns the binary storage requirements (see WriteTo) in bytes.
func (b *BitSet) BinaryStorageSize() int {
	return wordBytes + wordBytes*b.wordCount()
}

func readUint64Array(reader io.Reader, data []uint64) error {
	length := len(data)
	bufferSize := 128
	buffer := make([]byte, bufferSize*wordBytes)
	for i := 0; i < length; i += bufferSize {
		end := i + bufferSize
		if end > length {
			end = length
			buffer = buffer[:wordBytes*(end-i)]
		}
		chunk := data[i:end]
		if _, err := io.ReadFull(reader, buffer); err != nil {
			return err
		}
		for i := range chunk {
			chunk[i] = uint64(binaryOrder.Uint64(buffer[8*i:]))
		}
	}
	return nil
}

func writeUint64Array(writer io.Writer, data []uint64) error {
	bufferSize := 128
	buffer := make([]byte, bufferSize*wordBytes)
	for i := 0; i < len(data); i += bufferSize {
		end := i + bufferSize
		if end > len(data) {
			end = len(data)
			buffer = buffer[:wordBytes*(end-i)]
		}
		chunk := data[i:end]
		for i, x := range chunk {
			binaryOrder.PutUint64(buffer[8*i:], x)
		}
		_, err := writer.Write(buffer)
		if err != nil {
			return err
		}
	}
	return nil
}

// WriteTo writes a BitSet to a stream. The format is:
// 1. uint64 length
// 2. []uint64 set
// The length is the number of bits in the BitSet.
//
// The set is a slice of uint64s containing between length and length + 63 bits.
// It is interpreted as a big-endian array of uint64s by default (see BinaryOrder())
// meaning that the first 8 bits are stored at byte index 7, the next 8 bits are stored
// at byte index 6... the bits 64 to 71 are stored at byte index 8, etc.
// If you change the binary order, you need to do so for both reading and writing.
// We recommend using the default binary order.
//
// Upon success, the number of bytes written is returned.
//
// Performance: if this function is used to write to a disk or network
// connection, it might be beneficial to wrap the stream in a bufio.Writer.
// E.g.,
//
//	      f, err := os.Create("myfile")
//		       w := bufio.NewWriter(f)
func (b *BitSet) WriteTo(stream io.Writer) (int64, error) {
	length := uint64(b.length)
	// Write length
	err := binary.Write(stream, binaryOrder, &length)
	if err != nil {
		// Upon failure, we do not guarantee that we
		// return the number of bytes written.
		return int64(0), err
	}
	err = writeUint64Array(stream, b.set[:b.wordCount()])
	if err != nil {
		// Upon failure, we do not guarantee that we
		// return the number of bytes written.
		return int64(wordBytes), err
	}
	return int64(b.BinaryStorageSize()), nil
}

// ReadFrom reads a BitSet from a stream written using WriteTo
// The format is:
// 1. uint64 length
// 2. []uint64 set
// See WriteTo for details.
// Upon success, the number of bytes read is returned.
// If the current BitSet is not large enough to hold the data,
// it is extended. In case of error, the BitSet is either
// left unchanged or made empty if the error occurs too late
// to preserve the content.
//
// Performance: if this function is used to read from a disk or network
// connection, it might be beneficial to wrap the stream in a bufio.Reader.
// E.g.,
//
//	f, err := os.Open("myfile")
//	r := bufio.NewReader(f)
func (b *BitSet) ReadFrom(stream io.Reader) (int64, error) {
	var length uint64
	err := binary.Read(stream, binaryOrder, &length)
	if err != nil {
		if err == io.EOF {
			err = io.ErrUnexpectedEOF
		}
		return 0, err
	}
	newlength := uint(length)

	if uint64(newlength) != length {
		return 0, errors.New("unmarshalling error: type mismatch")
	}
	nWords := wordsNeeded(uint(newlength))
	if cap(b.set) >= nWords {
		b.set = b.set[:nWords]
	} else {
		b.set = make([]uint64, nWords)
	}

	b.length = newlength

	err = readUint64Array(stream, b.set)
	if err != nil {
		if err == io.EOF {
			err = io.ErrUnexpectedEOF
		}
		// We do not want to leave the BitSet partially filled as
		// it is error prone.
		b.set = b.set[:0]
		b.length = 0
		return 0, err
	}

	return int64(b.BinaryStorageSize()), nil
}

// MarshalBinary encodes a BitSet into a binary form and returns the result.
// Please see WriteTo for details.
func (b *BitSet) MarshalBinary() ([]byte, error) {
	var buf bytes.Buffer
	_, err := b.WriteTo(&buf)
	if err != nil {
		return []byte{}, err
	}

	return buf.Bytes(), err
}

// UnmarshalBinary decodes the binary form generated by MarshalBinary.
// Please see WriteTo for details.
func (b *BitSet) UnmarshalBinary(data []byte) error {
	buf := bytes.NewReader(data)
	_, err := b.ReadFrom(buf)
	return err
}

// MarshalJSON marshals a BitSet as a JSON structure
func (b BitSet) MarshalJSON() ([]byte, error) {
	buffer := bytes.NewBuffer(make([]byte, 0, b.BinaryStorageSize()))
	_, err := b.WriteTo(buffer)
	if err != nil {
		return nil, err
	}

	// URLEncode all bytes
	return json.Marshal(base64Encoding.EncodeToString(buffer.Bytes()))
}

// UnmarshalJSON unmarshals a BitSet from JSON created using MarshalJSON
func (b *BitSet) UnmarshalJSON(data []byte) error {
	// Unmarshal as string
	var s string
	err := json.Unmarshal(data, &s)
	if err != nil {
		return err
	}

	// URLDecode string
	buf, err := base64Encoding.DecodeString(s)
	if err != nil {
		return err
	}

	_, err = b.ReadFrom(bytes.NewReader(buf))
	return err
}

// Rank returns the number of set bits up to and including the index
// that are set in the bitset.
// See https://en.wikipedia.org/wiki/Ranking#Ranking_in_statistics
func (b *BitSet) Rank(index uint) (rank uint) {
	index++ // Rank is up to and including

	// needed more than once
	length := len(b.set)

	// TODO: built-in min requires go1.21 or later
	// idx := min(int(index>>6), len(b.set))
	idx := int(index >> 6)
	if idx > length {
		idx = length
	}

	// sum up the popcounts until idx ...
	// TODO: cannot range over idx (...): requires go1.22 or later
	// for j := range idx {
	for j := 0; j < idx; j++ {
		if w := b.set[j]; w != 0 {
			rank += uint(bits.OnesCount64(w))
		}
	}

	// ... plus partial word at idx,
	// make Rank inlineable and faster in the end
	// don't test index&63 != 0, just add, less branching
	if idx < length {
		rank += uint(bits.OnesCount64(b.set[idx] << (64 - index&63)))
	}

	return
}

// Select returns the index of the jth set bit, where j is the argument.
// The caller is responsible to ensure that 0 <= j < Count(): when j is
// out of range, the function returns the length of the bitset (b.length).
//
// Note that this function differs in convention from the Rank function which
// returns 1 when ranking the smallest value. We follow the conventional
// textbook definition of Select and Rank.
func (b *BitSet) Select(index uint) uint {
	leftover := index
	for idx, word := range b.set {
		w := uint(bits.OnesCount64(word))
		if w > leftover {
			return uint(idx)*64 + select64(word, leftover)
		}
		leftover -= w
	}
	return b.length
}

// top detects the top bit set
func (b *BitSet) top() (uint, bool) {
	for idx := len(b.set) - 1; idx >= 0; idx-- {
		if word := b.set[idx]; word != 0 {
			return uint(idx<<log2WordSize+bits.Len64(word)) - 1, true
		}
	}

	return 0, false
}

// ShiftLeft shifts the bitset like << operation would do.
//
// Left shift may require bitset size extension. We try to avoid the
// unnecessary memory operations by detecting the leftmost set bit.
// The function will panic if shift causes excess of capacity.
func (b *BitSet) ShiftLeft(bits uint) {
	panicIfNull(b)

	if bits == 0 {
		return
	}

	top, ok := b.top()
	if !ok {
		return
	}

	// capacity check
	if top+bits < bits {
		panic("You are exceeding the capacity")
	}

	// destination set
	dst := b.set

	// not using extendSet() to avoid unneeded data copying
	nsize := wordsNeeded(top + bits)
	if len(b.set) < nsize {
		dst = make([]uint64, nsize)
	}
	if top+bits >= b.length {
		b.length = top + bits + 1
	}

	pad, idx := top%wordSize, top>>log2WordSize
	shift, pages := bits%wordSize, bits>>log2WordSize
	if bits%wordSize == 0 { // happy case: just add pages
		copy(dst[pages:nsize], b.set)
	} else {
		if pad+shift >= wordSize {
			dst[idx+pages+1] = b.set[idx] >> (wordSize - shift)
		}

		for i := int(idx); i >= 0; i-- {
			if i > 0 {
				dst[i+int(pages)] = (b.set[i] << shift) | (b.set[i-1] >> (wordSize - shift))
			} else {
				dst[i+int(pages)] = b.set[i] << shift
			}
		}
	}

	// zeroing extra pages
	for i := 0; i < int(pages); i++ {
		dst[i] = 0
	}

	b.set = dst
}

// ShiftRight shifts the bitset like >> operation would do.
func (b *BitSet) ShiftRight(bits uint) {
	panicIfNull(b)

	if bits == 0 {
		return
	}

	top, ok := b.top()
	if !ok {
		return
	}

	if bits >= top {
		b.set = make([]uint64, wordsNeeded(b.length))
		return
	}

	pad, idx := top%wordSize, top>>log2WordSize
	shift, pages := bits%wordSize, bits>>log2WordSize
	if bits%wordSize == 0 { // happy case: just clear pages
		b.set = b.set[pages:]
		b.length -= pages * wordSize
	} else {
		for i := 0; i <= int(idx-pages); i++ {
			if i < int(idx-pages) {
				b.set[i] = (b.set[i+int(pages)] >> shift) | (b.set[i+int(pages)+1] << (wordSize - shift))
			} else {
				b.set[i] = b.set[i+int(pages)] >> shift
			}
		}

		if pad < shift {
			b.set[int(idx-pages)] = 0
		}
	}

	for i := int(idx-pages) + 1; i <= int(idx); i++ {
		b.set[i] = 0
	}
}

// OnesBetween returns the number of set bits in the range [from, to).
// The range is inclusive of 'from' and exclusive of 'to'.
// Returns 0 if from >= to.
func (b *BitSet) OnesBetween(from, to uint) uint {
	panicIfNull(b)

	if from >= to {
		return 0
	}

	// Calculate indices and masks for the starting and ending words
	startWord := from >> log2WordSize // Divide by wordSize
	endWord := to >> log2WordSize
	startOffset := from & wordMask // Mod wordSize
	endOffset := to & wordMask

	// Case 1: Bits lie within a single word
	if startWord == endWord {
		// Create mask for bits between from and to
		mask := uint64((1<<endOffset)-1) &^ ((1 << startOffset) - 1)
		return uint(bits.OnesCount64(b.set[startWord] & mask))
	}

	var count uint

	// Case 2: Bits span multiple words
	// 2a: Count bits in first word (from startOffset to end of word)
	startMask := ^uint64((1 << startOffset) - 1) // Mask for bits >= startOffset
	count = uint(bits.OnesCount64(b.set[startWord] & startMask))

	// 2b: Count all bits in complete words between start and end
	if endWord > startWord+1 {
		count += uint(popcntSlice(b.set[startWord+1 : endWord]))
	}

	// 2c: Count bits in last word (from start of word to endOffset)
	if endOffset > 0 {
		endMask := uint64(1<<endOffset) - 1 // Mask for bits < endOffset
		count += uint(bits.OnesCount64(b.set[endWord] & endMask))
	}

	return count
}

// Extract extracts bits according to a mask and returns the result
// in a new BitSet. See ExtractTo for details.
func (b *BitSet) Extract(mask *BitSet) *BitSet {
	dst := New(mask.Count())
	b.ExtractTo(mask, dst)
	return dst
}

// ExtractTo copies bits from the BitSet using positions specified in mask
// into a compacted form in dst. The number of set bits in mask determines
// the number of bits that will be extracted.
//
// For example, if mask has bits set at positions 1,4,5, then ExtractTo will
// take bits at those positions from the source BitSet and pack them into
// consecutive positions 0,1,2 in the destination BitSet.
func (b *BitSet) ExtractTo(mask *BitSet, dst *BitSet) {
	panicIfNull(b)
	panicIfNull(mask)
	panicIfNull(dst)

	if len(mask.set) == 0 || len(b.set) == 0 {
		return
	}

	// Ensure destination has enough space for extracted bits
	resultBits := uint(popcntSlice(mask.set))
	if dst.length < resultBits {
		dst.extendSet(resultBits - 1)
	}

	outPos := uint(0)
	length := len(mask.set)
	if len(b.set) < length {
		length = len(b.set)
	}

	// Process each word
	for i := 0; i < length; i++ {
		if mask.set[i] == 0 {
			continue // Skip words with no bits to extract
		}

		// Extract and compact bits according to mask
		extracted := pext(b.set[i], mask.set[i])
		bitsExtracted := uint(bits.OnesCount64(mask.set[i]))

		// Calculate destination position
		wordIdx := outPos >> log2WordSize
		bitOffset := outPos & wordMask

		// Write extracted bits, handling word boundary crossing
		dst.set[wordIdx] |= extracted << bitOffset
		if bitOffset+bitsExtracted > wordSize {
			dst.set[wordIdx+1] = extracted >> (wordSize - bitOffset)
		}

		outPos += bitsExtracted
	}
}

// Deposit creates a new BitSet and deposits bits according to a mask.
// See DepositTo for details.
func (b *BitSet) Deposit(mask *BitSet) *BitSet {
	dst := New(mask.length)
	b.DepositTo(mask, dst)
	return dst
}

// DepositTo spreads bits from a compacted form in the BitSet into positions
// specified by mask in dst. This is the inverse operation of Extract.
//
// For example, if mask has bits set at positions 1,4,5, then DepositTo will
// take consecutive bits 0,1,2 from the source BitSet and place them into
// positions 1,4,5 in the destination BitSet.
func (b *BitSet) DepositTo(mask *BitSet, dst *BitSet) {
	panicIfNull(b)
	panicIfNull(mask)
	panicIfNull(dst)

	if len(dst.set) == 0 || len(mask.set) == 0 || len(b.set) == 0 {
		return
	}

	inPos := uint(0)
	length := len(mask.set)
	if len(dst.set) < length {
		length = len(dst.set)
	}

	// Process each word
	for i := 0; i < length; i++ {
		if mask.set[i] == 0 {
			continue // Skip words with no bits to deposit
		}

		// Calculate source word index
		wordIdx := inPos >> log2WordSize
		if wordIdx >= uint(len(b.set)) {
			break // No more source bits available
		}

		// Get source bits, handling word boundary crossing
		sourceBits := b.set[wordIdx]
		bitOffset := inPos & wordMask
		if wordIdx+1 < uint(len(b.set)) && bitOffset != 0 {
			// Combine bits from current and next word
			sourceBits = (sourceBits >> bitOffset) |
				(b.set[wordIdx+1] << (wordSize - bitOffset))
		} else {
			sourceBits >>= bitOffset
		}

		// Deposit bits according to mask
		dst.set[i] = (dst.set[i] &^ mask.set[i]) | pdep(sourceBits, mask.set[i])
		inPos += uint(bits.OnesCount64(mask.set[i]))
	}
}

//go:generate go run cmd/pextgen/main.go -pkg=bitset

func pext(w, m uint64) (result uint64) {
	var outPos uint

	// Process byte by byte
	for i := 0; i < 8; i++ {
		shift := i << 3 // i * 8 using bit shift
		b := uint8(w >> shift)
		mask := uint8(m >> shift)

		extracted := pextLUT[b][mask]
		bits := popLUT[mask]

		result |= uint64(extracted) << outPos
		outPos += uint(bits)
	}

	return result
}

func pdep(w, m uint64) (result uint64) {
	var inPos uint

	// Process byte by byte
	for i := 0; i < 8; i++ {
		shift := i << 3 // i * 8 using bit shift
		mask := uint8(m >> shift)
		bits := popLUT[mask]

		// Get the bits we'll deposit from the source
		b := uint8(w >> inPos)

		// Deposit them according to the mask for this byte
		deposited := pdepLUT[b][mask]

		// Add to result
		result |= uint64(deposited) << shift
		inPos += uint(bits)
	}

	return result
}
