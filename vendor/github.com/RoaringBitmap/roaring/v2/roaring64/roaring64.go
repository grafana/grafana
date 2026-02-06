package roaring64

import (
	"bytes"
	"encoding/base64"
	"encoding/binary"
	"fmt"
	"io"
	"strconv"

	"github.com/RoaringBitmap/roaring/v2"
	"github.com/RoaringBitmap/roaring/v2/internal"
)

const (
	serialCookieNoRunContainer = 12346 // only arrays and bitmaps
	serialCookie               = 12347 // runs, arrays, and bitmaps
)

// Bitmap represents a compressed bitmap where you can add integers.
type Bitmap struct {
	highlowcontainer roaringArray64
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

// ToBytes returns an array of bytes corresponding to what is written
// when calling WriteTo
func (rb *Bitmap) ToBytes() ([]byte, error) {
	var buf bytes.Buffer
	_, err := rb.WriteTo(&buf)
	return buf.Bytes(), err
}

// WriteTo writes a serialized version of this bitmap to stream.
// The format is compatible with other 64-bit RoaringBitmap
// implementations (Java, Go, C++) and it has a specification :
// https://github.com/RoaringBitmap/RoaringFormatSpec#extention-for-64-bit-implementations
func (rb *Bitmap) WriteTo(stream io.Writer) (int64, error) {
	var n int64
	buf := make([]byte, 8)
	binary.LittleEndian.PutUint64(buf, uint64(rb.highlowcontainer.size()))
	written, err := stream.Write(buf)
	if err != nil {
		return n, err
	}
	n += int64(written)
	pos := 0
	keyBuf := buf[:4]
	for pos < rb.highlowcontainer.size() {
		c := rb.highlowcontainer.getContainerAtIndex(pos)
		binary.LittleEndian.PutUint32(keyBuf, rb.highlowcontainer.getKeyAtIndex(pos))
		pos++
		written, err = stream.Write(keyBuf)
		n += int64(written)
		if err != nil {
			return n, err
		}
		written, err := c.WriteTo(stream)
		n += int64(written)
		if err != nil {
			return n, err
		}
	}
	return n, nil
}

// FromUnsafeBytes reads a serialized version of this bitmap from the byte buffer without copy.
// It is the caller's responsibility to ensure that the input data is not modified and remains valid for the entire lifetime of this bitmap.
// This method avoids small allocations but holds references to the input data buffer. It is GC-friendly, but it may consume more memory eventually.
func (rb *Bitmap) FromUnsafeBytes(data []byte) (p int64, err error) {
	stream := internal.NewByteBuffer(data)
	sizeBuf := make([]byte, 8)
	_, err = stream.Read(sizeBuf)
	if err != nil {
		return 0, err
	}
	size := binary.LittleEndian.Uint64(sizeBuf)

	rb.highlowcontainer.resize(0)
	if cap(rb.highlowcontainer.keys) >= int(size) {
		rb.highlowcontainer.keys = rb.highlowcontainer.keys[:size]
	} else {
		rb.highlowcontainer.keys = make([]uint32, size)
	}
	if cap(rb.highlowcontainer.containers) >= int(size) {
		rb.highlowcontainer.containers = rb.highlowcontainer.containers[:size]
	} else {
		rb.highlowcontainer.containers = make([]*roaring.Bitmap, size)
	}
	if cap(rb.highlowcontainer.needCopyOnWrite) >= int(size) {
		rb.highlowcontainer.needCopyOnWrite = rb.highlowcontainer.needCopyOnWrite[:size]
	} else {
		rb.highlowcontainer.needCopyOnWrite = make([]bool, size)
	}
	for i := uint64(0); i < size; i++ {
		keyBuf, err := stream.Next(4)
		if err != nil {
			return 0, fmt.Errorf("error in bitmap.UnsafeFromBytes: could not read key #%d: %w", i, err)
		}
		rb.highlowcontainer.keys[i] = binary.LittleEndian.Uint32(keyBuf)
		rb.highlowcontainer.containers[i] = roaring.NewBitmap()
		n, err := rb.highlowcontainer.containers[i].ReadFrom(stream)

		if n == 0 || err != nil {
			return int64(n), fmt.Errorf("Could not deserialize bitmap for key #%d: %s", i, err)
		}
	}

	return stream.GetReadBytes(), nil
}

// ReadFrom reads a serialized version of this bitmap from stream.
// The format is compatible with other 64-bit RoaringBitmap
// implementations (Java, Go, C++) and it has a specification :
// https://github.com/RoaringBitmap/RoaringFormatSpec#extention-for-64-bit-implementations
func (rb *Bitmap) ReadFrom(stream io.Reader) (p int64, err error) {
	sizeBuf := make([]byte, 8)
	var n int
	n, err = io.ReadFull(stream, sizeBuf)
	if err != nil {
		return int64(n), err
	}
	p += int64(n)
	size := binary.LittleEndian.Uint64(sizeBuf)
	rb.highlowcontainer.resize(0)
	if cap(rb.highlowcontainer.keys) >= int(size) {
		rb.highlowcontainer.keys = rb.highlowcontainer.keys[:size]
	} else {
		rb.highlowcontainer.keys = make([]uint32, size)
	}
	if cap(rb.highlowcontainer.containers) >= int(size) {
		rb.highlowcontainer.containers = rb.highlowcontainer.containers[:size]
	} else {
		rb.highlowcontainer.containers = make([]*roaring.Bitmap, size)
	}
	if cap(rb.highlowcontainer.needCopyOnWrite) >= int(size) {
		rb.highlowcontainer.needCopyOnWrite = rb.highlowcontainer.needCopyOnWrite[:size]
	} else {
		rb.highlowcontainer.needCopyOnWrite = make([]bool, size)
	}
	keyBuf := sizeBuf[:4]
	for i := uint64(0); i < size; i++ {
		n, err = io.ReadFull(stream, keyBuf)
		if err != nil {
			return int64(n), fmt.Errorf("error in bitmap.readFrom: could not read key #%d: %s", i, err)
		}
		p += int64(n)
		rb.highlowcontainer.keys[i] = binary.LittleEndian.Uint32(keyBuf)
		rb.highlowcontainer.containers[i] = roaring.NewBitmap()
		n, err := rb.highlowcontainer.containers[i].ReadFrom(stream)

		if n == 0 || err != nil {
			return int64(n), fmt.Errorf("Could not deserialize bitmap for key #%d: %s", i, err)
		}
		p += int64(n)
	}
	return p, nil
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

// RunOptimize attempts to further compress the runs of consecutive values found in the bitmap
func (rb *Bitmap) RunOptimize() {
	rb.highlowcontainer.runOptimize()
}

// HasRunCompression returns true if the bitmap benefits from run compression
func (rb *Bitmap) HasRunCompression() bool {
	return rb.highlowcontainer.hasRunCompression()
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

// ToArray creates a new slice containing all of the integers stored in the Bitmap in sorted order
func (rb *Bitmap) ToArray() []uint64 {
	array := make([]uint64, rb.GetCardinality())
	pos := 0
	pos2 := uint64(0)

	for pos < rb.highlowcontainer.size() {
		hs := uint64(rb.highlowcontainer.getKeyAtIndex(pos)) << 32
		c := rb.highlowcontainer.getContainerAtIndex(pos)
		pos++
		c.ManyIterator().NextMany64(hs, array[pos2:])
		pos2 += c.GetCardinality()
	}
	return array
}

// GetSizeInBytes estimates the memory usage of the Bitmap. Note that this
// might differ slightly from the amount of bytes required for persistent storage
func (rb *Bitmap) GetSizeInBytes() uint64 {
	size := uint64(8)
	for _, c := range rb.highlowcontainer.containers {
		size += uint64(4) + c.GetSizeInBytes()
	}
	return size
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
		buffer.WriteString(strconv.FormatUint(uint64(i.Next()), 10))
	}
	for i.HasNext() {
		buffer.WriteString(",")
		counter = counter + 1
		// to avoid exhausting the memory
		if counter > 0x40000 {
			buffer.WriteString("...")
			break
		}
		buffer.WriteString(strconv.FormatUint(uint64(i.Next()), 10))
	}
	buffer.WriteString("}")
	return buffer.String()
}

// Iterator creates a new IntPeekable to iterate over the integers contained in the bitmap, in sorted order;
// the iterator becomes invalid if the bitmap is modified (e.g., with Add or Remove).
func (rb *Bitmap) Iterator() IntPeekable64 {
	return newIntIterator(rb)
}

// ReverseIterator creates a new IntIterable to iterate over the integers contained in the bitmap, in sorted order;
// the iterator becomes invalid if the bitmap is modified (e.g., with Add or Remove).
func (rb *Bitmap) ReverseIterator() IntIterable64 {
	return newIntReverseIterator(rb)
}

// ManyIterator creates a new ManyIntIterable to iterate over the integers contained in the bitmap, in sorted order;
// the iterator becomes invalid if the bitmap is modified (e.g., with Add or Remove).
func (rb *Bitmap) ManyIterator() ManyIntIterable64 {
	return newManyIntIterator(rb)
}

// Clone creates a copy of the Bitmap
func (rb *Bitmap) Clone() *Bitmap {
	ptr := new(Bitmap)
	ptr.highlowcontainer = *rb.highlowcontainer.clone()
	return ptr
}

// Minimum get the smallest value stored in this roaring bitmap, assumes that it is not empty
func (rb *Bitmap) Minimum() uint64 {
	return uint64(rb.highlowcontainer.containers[0].Minimum()) | (uint64(rb.highlowcontainer.keys[0]) << 32)
}

// Maximum get the largest value stored in this roaring bitmap, assumes that it is not empty
func (rb *Bitmap) Maximum() uint64 {
	lastindex := len(rb.highlowcontainer.containers) - 1
	return uint64(rb.highlowcontainer.containers[lastindex].Maximum()) | (uint64(rb.highlowcontainer.keys[lastindex]) << 32)
}

// Contains returns true if the integer is contained in the bitmap
func (rb *Bitmap) Contains(x uint64) bool {
	hb := highbits(x)
	c := rb.highlowcontainer.getContainer(hb)
	return c != nil && c.Contains(lowbits(x))
}

// ContainsInt returns true if the integer is contained in the bitmap (this is a convenience method, the parameter is casted to uint64 and Contains is called)
func (rb *Bitmap) ContainsInt(x int) bool {
	return rb.Contains(uint64(x))
}

// Equals returns true if the two bitmaps contain the same integers
func (rb *Bitmap) Equals(srb *Bitmap) bool {
	return srb.highlowcontainer.equals(rb.highlowcontainer)
}

// Add the integer x to the bitmap
func (rb *Bitmap) Add(x uint64) {
	hb := highbits(x)
	ra := &rb.highlowcontainer
	i := ra.getIndex(hb)
	if i >= 0 {
		ra.getWritableContainerAtIndex(i).Add(lowbits(x))
	} else {
		newBitmap := roaring.NewBitmap()
		newBitmap.Add(lowbits(x))
		rb.highlowcontainer.insertNewKeyValueAt(-i-1, hb, newBitmap)
	}
}

// CheckedAdd adds the integer x to the bitmap and return true  if it was added (false if the integer was already present)
func (rb *Bitmap) CheckedAdd(x uint64) bool {
	hb := highbits(x)
	i := rb.highlowcontainer.getIndex(hb)
	if i >= 0 {
		c := rb.highlowcontainer.getWritableContainerAtIndex(i)
		return c.CheckedAdd(lowbits(x))
	}
	newBitmap := roaring.NewBitmap()
	newBitmap.Add(lowbits(x))
	rb.highlowcontainer.insertNewKeyValueAt(-i-1, hb, newBitmap)
	return true
}

// AddInt adds the integer x to the bitmap (convenience method: the parameter is casted to uint32 and we call Add)
func (rb *Bitmap) AddInt(x int) {
	rb.Add(uint64(x))
}

// Remove the integer x from the bitmap
func (rb *Bitmap) Remove(x uint64) {
	hb := highbits(x)
	i := rb.highlowcontainer.getIndex(hb)
	if i >= 0 {
		c := rb.highlowcontainer.getWritableContainerAtIndex(i)
		c.Remove(lowbits(x))
		if c.IsEmpty() {
			rb.highlowcontainer.removeAtIndex(i)
		}
	}
}

// CheckedRemove removes the integer x from the bitmap and return true if the integer was effectively remove (and false if the integer was not present)
func (rb *Bitmap) CheckedRemove(x uint64) bool {
	hb := highbits(x)
	i := rb.highlowcontainer.getIndex(hb)
	if i >= 0 {
		c := rb.highlowcontainer.getWritableContainerAtIndex(i)
		removed := c.CheckedRemove(lowbits(x))
		if removed && c.IsEmpty() {
			rb.highlowcontainer.removeAtIndex(i)
		}
		return removed
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
		size += c.GetCardinality()
	}
	return size
}

// Rank returns the number of integers that are smaller or equal to x (Rank(infinity) would be GetCardinality())
func (rb *Bitmap) Rank(x uint64) uint64 {
	size := uint64(0)
	for i := 0; i < rb.highlowcontainer.size(); i++ {
		key := rb.highlowcontainer.getKeyAtIndex(i)
		if key > highbits(x) {
			return size
		}
		if key < highbits(x) {
			size += rb.highlowcontainer.getContainerAtIndex(i).GetCardinality()
		} else {
			return size + rb.highlowcontainer.getContainerAtIndex(i).Rank(lowbits(x))
		}
	}
	return size
}

// Select returns the xth integer in the bitmap
func (rb *Bitmap) Select(x uint64) (uint64, error) {
	cardinality := rb.GetCardinality()
	if cardinality <= x {
		return 0, fmt.Errorf("can't find %dth integer in a bitmap with only %d items", x, cardinality)
	}

	remaining := x
	for i := 0; i < rb.highlowcontainer.size(); i++ {
		c := rb.highlowcontainer.getContainerAtIndex(i)
		if bitmapSize := c.GetCardinality(); remaining >= bitmapSize {
			remaining -= bitmapSize
		} else {
			key := rb.highlowcontainer.getKeyAtIndex(i)
			selected, err := c.Select(uint32(remaining))
			if err != nil {
				return 0, err
			}
			return uint64(key)<<32 + uint64(selected), nil
		}
	}
	return 0, fmt.Errorf("can't find %dth integer in a bitmap with only %d items", x, cardinality)
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
					c1.And(c2)
					if !c1.IsEmpty() {
						rb.highlowcontainer.replaceKeyAndContainerAtIndex(intersectionsize, s1, c1, false)
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
				} else { // s1 > s2
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

// OrCardinality returns the cardinality of the union between two bitmaps, bitmaps are not modified
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
					answer += rb.highlowcontainer.getContainerAtIndex(pos1).GetCardinality()
					pos1++
					if pos1 == length1 {
						break main
					}
					s1 = rb.highlowcontainer.getKeyAtIndex(pos1)
				} else if s1 > s2 {
					answer += x2.highlowcontainer.getContainerAtIndex(pos2).GetCardinality()
					pos2++
					if pos2 == length2 {
						break main
					}
					s2 = x2.highlowcontainer.getKeyAtIndex(pos2)
				} else {
					// TODO: could be faster if we did not have to materialize the container
					answer += roaring.Or(rb.highlowcontainer.getContainerAtIndex(pos1), x2.highlowcontainer.getContainerAtIndex(pos2)).GetCardinality()
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
		answer += rb.highlowcontainer.getContainerAtIndex(pos1).GetCardinality()
	}
	for ; pos2 < length2; pos2++ {
		answer += x2.highlowcontainer.getContainerAtIndex(pos2).GetCardinality()
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
					answer += c1.AndCardinality(c2)
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
				} else { // s1 > s2
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
					if c1.Intersects(c2) {
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
				} else { // s1 > s2
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
				c := roaring.Xor(rb.highlowcontainer.getContainerAtIndex(pos1), x2.highlowcontainer.getContainerAtIndex(pos2))
				if !c.IsEmpty() {
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
				rb.highlowcontainer.insertNewKeyValueAt(pos1, s2, x2.highlowcontainer.getContainerAtIndex(pos2).Clone())
				pos1++
				length1++
				pos2++
				if pos2 == length2 {
					break main
				}
				s2 = x2.highlowcontainer.getKeyAtIndex(pos2)
			} else {
				rb.highlowcontainer.getContainerAtIndex(pos1).Or(x2.highlowcontainer.getContainerAtIndex(pos2))
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
					c1.AndNot(c2)
					if !c1.IsEmpty() {
						rb.highlowcontainer.replaceKeyAndContainerAtIndex(intersectionsize, s1, c1, false)
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
				} else { // s1 > s2
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
				answer.highlowcontainer.appendContainer(s1,
					roaring.Or(x1.highlowcontainer.getContainerAtIndex(pos1), x2.highlowcontainer.getContainerAtIndex(pos2)), false)
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
				c := roaring.And(x1.highlowcontainer.getContainerAtIndex(pos1), x2.highlowcontainer.getContainerAtIndex(pos2))
				if !c.IsEmpty() {
					answer.highlowcontainer.appendContainer(s1, c, false)
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
				c := roaring.Xor(x1.highlowcontainer.getContainerAtIndex(pos1), x2.highlowcontainer.getContainerAtIndex(pos2))
				if !c.IsEmpty() {
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
					c := roaring.AndNot(x1.highlowcontainer.getContainerAtIndex(pos1), x2.highlowcontainer.getContainerAtIndex(pos2))
					if !c.IsEmpty() {
						answer.highlowcontainer.appendContainer(s1, c, false)
					}
					pos1++
					pos2++
					if (pos1 == length1) || (pos2 == length2) {
						break main
					}
					s1 = x1.highlowcontainer.getKeyAtIndex(pos1)
					s2 = x2.highlowcontainer.getKeyAtIndex(pos2)
				} else { // s1 > s2
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
func (rb *Bitmap) AddMany(dat []uint64) {
	if len(dat) == 0 {
		return
	}

	start, batchHighBits := 0, highbits(dat[0])
	for end := 1; end < len(dat); end++ {
		hi := highbits(dat[end])
		if hi != batchHighBits {
			batch := make([]uint32, end-start)
			for i := 0; i < end-start; i++ {
				batch[i] = lowbits(dat[start+i])
			}
			rb.getOrCreateContainer(batchHighBits).AddMany(batch)

			batchHighBits = hi
			start = end
		}
	}

	batch := make([]uint32, len(dat)-start)
	for i := 0; i < len(dat)-start; i++ {
		batch[i] = lowbits(dat[start+i])
	}
	rb.getOrCreateContainer(batchHighBits).AddMany(batch)
}

// getOrCreateContainer gets the roaring.Bitmap for key hb,
// or creates an *empty* roaring.Bitmap, inserts it to rb.highlowcontainer, and returns the new roaring.Bitmap.
func (rb *Bitmap) getOrCreateContainer(hb uint32) *roaring.Bitmap {
	i := rb.highlowcontainer.getIndex(hb)
	if i >= 0 {
		return rb.highlowcontainer.getWritableContainerAtIndex(i)
	}
	c := roaring.NewBitmap()
	rb.highlowcontainer.insertNewKeyValueAt(-i-1, hb, c)
	return c
}

// BitmapOf generates a new bitmap filled with the specified integers
func BitmapOf(dat ...uint64) *Bitmap {
	ans := NewBitmap()
	ans.AddMany(dat)
	return ans
}

// Flip negates the bits in the given range (i.e., [rangeStart,rangeEnd)), any integer present in this range and in the bitmap is removed,
// and any integer present in the range and not in the bitmap is added.
func (rb *Bitmap) Flip(rangeStart, rangeEnd uint64) {
	if rangeStart >= rangeEnd {
		return
	}

	hbStart := uint64(highbits(rangeStart))
	lbStart := uint64(lowbits(rangeStart))
	hbLast := uint64(highbits(rangeEnd))
	lbLast := uint64(lowbits(rangeEnd))

	var max uint64 = maxLowBit + 1
	for hb := hbStart; hb <= hbLast; hb++ {
		var containerStart uint64
		if hb == hbStart {
			containerStart = lbStart
		}
		containerLast := max
		if hb == hbLast {
			containerLast = lbLast
		}

		i := rb.highlowcontainer.getIndex(uint32(hb))

		if i >= 0 {
			c := rb.highlowcontainer.getWritableContainerAtIndex(i)
			c.Flip(containerStart, containerLast)
			if c.IsEmpty() {
				rb.highlowcontainer.removeAtIndex(i)
			}
		} else { // *think* the range of ones must never be empty.
			c := roaring.NewBitmap()
			c.Flip(containerStart, containerLast)
			if !c.IsEmpty() {
				rb.highlowcontainer.insertNewKeyValueAt(-i-1, uint32(hb), c)
			}
		}
	}
}

// FlipInt calls Flip after casting the parameters  (convenience method)
func (rb *Bitmap) FlipInt(rangeStart, rangeEnd int) {
	rb.Flip(uint64(rangeStart), uint64(rangeEnd))
}

// AddRange adds the integers in [rangeStart, rangeEnd) to the bitmap.
func (rb *Bitmap) AddRange(rangeStart, rangeEnd uint64) {
	if rangeStart >= rangeEnd {
		return
	}
	hbStart := uint64(highbits(rangeStart))
	lbStart := uint64(lowbits(rangeStart))
	hbLast := uint64(highbits(rangeEnd - 1))
	lbLast := uint64(lowbits(rangeEnd - 1))

	var max uint64 = maxLowBit
	for hb := hbStart; hb <= hbLast; hb++ {
		containerStart := uint64(0)
		if hb == hbStart {
			containerStart = lbStart
		}
		containerLast := max
		if hb == hbLast {
			containerLast = lbLast
		}

		rb.getOrCreateContainer(uint32(hb)).AddRange(containerStart, containerLast+1)
	}
}

// RemoveRange removes the integers in [rangeStart, rangeEnd) from the bitmap.
func (rb *Bitmap) RemoveRange(rangeStart, rangeEnd uint64) {
	if rangeStart >= rangeEnd {
		return
	}
	hbStart := uint64(highbits(rangeStart))
	lbStart := uint64(lowbits(rangeStart))
	hbLast := uint64(highbits(rangeEnd - 1))
	lbLast := uint64(lowbits(rangeEnd - 1))

	var max uint64 = maxLowBit

	if hbStart == hbLast {
		i := rb.highlowcontainer.getIndex(uint32(hbStart))
		if i < 0 {
			return
		}
		c := rb.highlowcontainer.getWritableContainerAtIndex(i)
		c.RemoveRange(lbStart, lbLast+1)
		if c.IsEmpty() {
			rb.highlowcontainer.removeAtIndex(i)
		}
		return
	}
	ifirst := rb.highlowcontainer.getIndex(uint32(hbStart))
	ilast := rb.highlowcontainer.getIndex(uint32(hbLast))

	if ifirst >= 0 {
		if lbStart != 0 {
			c := rb.highlowcontainer.getWritableContainerAtIndex(ifirst)
			c.RemoveRange(lbStart, max+1)
			if !c.IsEmpty() {
				ifirst++
			}
		}
	} else {
		ifirst = -ifirst - 1
	}
	if ilast >= 0 {
		if lbLast != max {
			c := rb.highlowcontainer.getWritableContainerAtIndex(ilast)
			c.RemoveRange(0, lbLast+1)
			if c.IsEmpty() {
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
func Flip(rb *Bitmap, rangeStart, rangeEnd uint64) *Bitmap {
	if rangeStart >= rangeEnd {
		return rb.Clone()
	}

	answer := NewBitmap()
	hbStart := uint64(highbits(rangeStart))
	lbStart := uint64(lowbits(rangeStart))
	hbLast := uint64(highbits(rangeEnd))
	lbLast := uint64(lowbits(rangeEnd))

	// copy the containers before the active area
	answer.highlowcontainer.appendCopiesUntil(rb.highlowcontainer, uint32(hbStart))

	var max uint64 = maxLowBit + 1
	for hb := hbStart; hb <= hbLast; hb++ {
		var containerStart uint64
		if hb == hbStart {
			containerStart = lbStart
		}
		containerLast := max
		if hb == hbLast {
			containerLast = lbLast
		}

		i := rb.highlowcontainer.getIndex(uint32(hb))
		j := answer.highlowcontainer.getIndex(uint32(hb))

		if i >= 0 {
			c := roaring.Flip(rb.highlowcontainer.getContainerAtIndex(i), containerStart, containerLast)
			if !c.IsEmpty() {
				answer.highlowcontainer.insertNewKeyValueAt(-j-1, uint32(hb), c)
			}

		} else { // *think* the range of ones must never be empty.
			c := roaring.NewBitmap()
			c.Flip(containerStart, containerLast)
			if !c.IsEmpty() {
				answer.highlowcontainer.insertNewKeyValueAt(-i-1, uint32(hb), c)
			}
		}
	}
	// copy the containers after the active area.
	answer.highlowcontainer.appendCopiesAfter(rb.highlowcontainer, uint32(hbLast))

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

// Stats returns details on container type usage in a Statistics struct.
func (rb *Bitmap) Stats() roaring.Statistics {
	stats := roaring.Statistics{}
	for _, c := range rb.highlowcontainer.containers {
		bitmapStats := c.Stats()
		stats.Cardinality += bitmapStats.Cardinality
		stats.Containers += bitmapStats.Containers
		stats.ArrayContainers += bitmapStats.ArrayContainers
		stats.ArrayContainerBytes += bitmapStats.ArrayContainerBytes
		stats.ArrayContainerValues += bitmapStats.ArrayContainerValues
		stats.BitmapContainers += bitmapStats.BitmapContainers
		stats.BitmapContainerBytes += bitmapStats.BitmapContainerBytes
		stats.BitmapContainerValues += bitmapStats.BitmapContainerValues
		stats.RunContainers += bitmapStats.RunContainers
		stats.RunContainerBytes += bitmapStats.RunContainerBytes
		stats.RunContainerValues += bitmapStats.RunContainerValues
	}
	return stats
}

// GetSerializedSizeInBytes computes the serialized size in bytes
// of the Bitmap. It should correspond to the number
// of bytes written when invoking WriteTo. You can expect
// that this function is much cheaper computationally than WriteTo.
func (rb *Bitmap) GetSerializedSizeInBytes() uint64 {
	return rb.highlowcontainer.serializedSizeInBytes()
}

func (rb *Bitmap) Validate() error {
	return rb.highlowcontainer.validate()
}

// Roaring32AsRoaring64 inserts a 32-bit roaring bitmap into
// a 64-bit roaring bitmap. No copy is made.
func Roaring32AsRoaring64(bm32 *roaring.Bitmap) *Bitmap {
	rb := NewBitmap()
	rb.highlowcontainer.resize(0)
	rb.highlowcontainer.keys = append(rb.highlowcontainer.keys, 0)
	rb.highlowcontainer.containers = append(rb.highlowcontainer.containers, bm32)
	rb.highlowcontainer.needCopyOnWrite = append(rb.highlowcontainer.needCopyOnWrite, false)
	return rb
}
