//go:build (386 && !appengine) || (amd64 && !appengine) || (arm && !appengine) || (arm64 && !appengine) || (ppc64le && !appengine) || (mipsle && !appengine) || (mips64le && !appengine) || (mips64p32le && !appengine) || (wasm && !appengine)
// +build 386,!appengine amd64,!appengine arm,!appengine arm64,!appengine ppc64le,!appengine mipsle,!appengine mips64le,!appengine mips64p32le,!appengine wasm,!appengine

package roaring

import (
	"encoding/binary"
	"errors"
	"io"
	"reflect"
	"runtime"
	"unsafe"
)

func (ac *arrayContainer) writeTo(stream io.Writer) (int, error) {
	buf := uint16SliceAsByteSlice(ac.content)
	return stream.Write(buf)
}

func (bc *bitmapContainer) writeTo(stream io.Writer) (int, error) {
	if bc.cardinality <= arrayDefaultMaxSize {
		return 0, errors.New("refusing to write bitmap container with cardinality of array container")
	}
	buf := uint64SliceAsByteSlice(bc.bitmap)
	return stream.Write(buf)
}

func uint64SliceAsByteSlice(slice []uint64) []byte {
	// make a new slice header
	header := *(*reflect.SliceHeader)(unsafe.Pointer(&slice))

	// update its capacity and length
	header.Len *= 8
	header.Cap *= 8

	// instantiate result and use KeepAlive so data isn't unmapped.
	result := *(*[]byte)(unsafe.Pointer(&header))
	runtime.KeepAlive(&slice)

	// return it
	return result
}

func uint16SliceAsByteSlice(slice []uint16) []byte {
	// make a new slice header
	header := *(*reflect.SliceHeader)(unsafe.Pointer(&slice))

	// update its capacity and length
	header.Len *= 2
	header.Cap *= 2

	// instantiate result and use KeepAlive so data isn't unmapped.
	result := *(*[]byte)(unsafe.Pointer(&header))
	runtime.KeepAlive(&slice)

	// return it
	return result
}

func interval16SliceAsByteSlice(slice []interval16) []byte {
	// make a new slice header
	header := *(*reflect.SliceHeader)(unsafe.Pointer(&slice))

	// update its capacity and length
	header.Len *= 4
	header.Cap *= 4

	// instantiate result and use KeepAlive so data isn't unmapped.
	result := *(*[]byte)(unsafe.Pointer(&header))
	runtime.KeepAlive(&slice)

	// return it
	return result
}

func (bc *bitmapContainer) asLittleEndianByteSlice() []byte {
	return uint64SliceAsByteSlice(bc.bitmap)
}

// Deserialization code follows

// //
// These methods (byteSliceAsUint16Slice,...) do not make copies,
// they are pointer-based (unsafe). The caller is responsible to
// ensure that the input slice does not get garbage collected, deleted
// or modified while you hold the returned slince.
// //
func byteSliceAsUint16Slice(slice []byte) (result []uint16) { // here we create a new slice holder
	if len(slice)%2 != 0 {
		panic("Slice size should be divisible by 2")
	}
	// reference: https://go101.org/article/unsafe.html

	// make a new slice header
	bHeader := (*reflect.SliceHeader)(unsafe.Pointer(&slice))
	rHeader := (*reflect.SliceHeader)(unsafe.Pointer(&result))

	// transfer the data from the given slice to a new variable (our result)
	rHeader.Data = bHeader.Data
	rHeader.Len = bHeader.Len / 2
	rHeader.Cap = bHeader.Cap / 2

	// instantiate result and use KeepAlive so data isn't unmapped.
	runtime.KeepAlive(&slice) // it is still crucial, GC can free it)

	// return result
	return
}

func byteSliceAsUint64Slice(slice []byte) (result []uint64) {
	if len(slice)%8 != 0 {
		panic("Slice size should be divisible by 8")
	}
	// reference: https://go101.org/article/unsafe.html

	// make a new slice header
	bHeader := (*reflect.SliceHeader)(unsafe.Pointer(&slice))
	rHeader := (*reflect.SliceHeader)(unsafe.Pointer(&result))

	// transfer the data from the given slice to a new variable (our result)
	rHeader.Data = bHeader.Data
	rHeader.Len = bHeader.Len / 8
	rHeader.Cap = bHeader.Cap / 8

	// instantiate result and use KeepAlive so data isn't unmapped.
	runtime.KeepAlive(&slice) // it is still crucial, GC can free it)

	// return result
	return
}

func byteSliceAsInterval16Slice(slice []byte) (result []interval16) {
	if len(slice)%4 != 0 {
		panic("Slice size should be divisible by 4")
	}
	// reference: https://go101.org/article/unsafe.html

	// make a new slice header
	bHeader := (*reflect.SliceHeader)(unsafe.Pointer(&slice))
	rHeader := (*reflect.SliceHeader)(unsafe.Pointer(&result))

	// transfer the data from the given slice to a new variable (our result)
	rHeader.Data = bHeader.Data
	rHeader.Len = bHeader.Len / 4
	rHeader.Cap = bHeader.Cap / 4

	// instantiate result and use KeepAlive so data isn't unmapped.
	runtime.KeepAlive(&slice) // it is still crucial, GC can free it)

	// return result
	return
}

func byteSliceAsContainerSlice(slice []byte) (result []container) {
	var c container
	containerSize := int(unsafe.Sizeof(c))

	if len(slice)%containerSize != 0 {
		panic("Slice size should be divisible by unsafe.Sizeof(container)")
	}
	// reference: https://go101.org/article/unsafe.html

	// make a new slice header
	bHeader := (*reflect.SliceHeader)(unsafe.Pointer(&slice))
	rHeader := (*reflect.SliceHeader)(unsafe.Pointer(&result))

	// transfer the data from the given slice to a new variable (our result)
	rHeader.Data = bHeader.Data
	rHeader.Len = bHeader.Len / containerSize
	rHeader.Cap = bHeader.Cap / containerSize

	// instantiate result and use KeepAlive so data isn't unmapped.
	runtime.KeepAlive(&slice) // it is still crucial, GC can free it)

	// return result
	return
}

func byteSliceAsBitsetSlice(slice []byte) (result []bitmapContainer) {
	bitsetSize := int(unsafe.Sizeof(bitmapContainer{}))
	if len(slice)%bitsetSize != 0 {
		panic("Slice size should be divisible by unsafe.Sizeof(bitmapContainer)")
	}
	// reference: https://go101.org/article/unsafe.html

	// make a new slice header
	bHeader := (*reflect.SliceHeader)(unsafe.Pointer(&slice))
	rHeader := (*reflect.SliceHeader)(unsafe.Pointer(&result))

	// transfer the data from the given slice to a new variable (our result)
	rHeader.Data = bHeader.Data
	rHeader.Len = bHeader.Len / bitsetSize
	rHeader.Cap = bHeader.Cap / bitsetSize

	// instantiate result and use KeepAlive so data isn't unmapped.
	runtime.KeepAlive(&slice) // it is still crucial, GC can free it)

	// return result
	return
}

func byteSliceAsArraySlice(slice []byte) (result []arrayContainer) {
	arraySize := int(unsafe.Sizeof(arrayContainer{}))
	if len(slice)%arraySize != 0 {
		panic("Slice size should be divisible by unsafe.Sizeof(arrayContainer)")
	}
	// reference: https://go101.org/article/unsafe.html

	// make a new slice header
	bHeader := (*reflect.SliceHeader)(unsafe.Pointer(&slice))
	rHeader := (*reflect.SliceHeader)(unsafe.Pointer(&result))

	// transfer the data from the given slice to a new variable (our result)
	rHeader.Data = bHeader.Data
	rHeader.Len = bHeader.Len / arraySize
	rHeader.Cap = bHeader.Cap / arraySize

	// instantiate result and use KeepAlive so data isn't unmapped.
	runtime.KeepAlive(&slice) // it is still crucial, GC can free it)

	// return result
	return
}

func byteSliceAsRun16Slice(slice []byte) (result []runContainer16) {
	run16Size := int(unsafe.Sizeof(runContainer16{}))
	if len(slice)%run16Size != 0 {
		panic("Slice size should be divisible by unsafe.Sizeof(runContainer16)")
	}
	// reference: https://go101.org/article/unsafe.html

	// make a new slice header
	bHeader := (*reflect.SliceHeader)(unsafe.Pointer(&slice))
	rHeader := (*reflect.SliceHeader)(unsafe.Pointer(&result))

	// transfer the data from the given slice to a new variable (our result)
	rHeader.Data = bHeader.Data
	rHeader.Len = bHeader.Len / run16Size
	rHeader.Cap = bHeader.Cap / run16Size

	// instantiate result and use KeepAlive so data isn't unmapped.
	runtime.KeepAlive(&slice) // it is still crucial, GC can free it)

	// return result
	return
}

func byteSliceAsBoolSlice(slice []byte) (result []bool) {
	boolSize := int(unsafe.Sizeof(true))
	if len(slice)%boolSize != 0 {
		panic("Slice size should be divisible by unsafe.Sizeof(bool)")
	}
	// reference: https://go101.org/article/unsafe.html

	// make a new slice header
	bHeader := (*reflect.SliceHeader)(unsafe.Pointer(&slice))
	rHeader := (*reflect.SliceHeader)(unsafe.Pointer(&result))

	// transfer the data from the given slice to a new variable (our result)
	rHeader.Data = bHeader.Data
	rHeader.Len = bHeader.Len / boolSize
	rHeader.Cap = bHeader.Cap / boolSize

	// instantiate result and use KeepAlive so data isn't unmapped.
	runtime.KeepAlive(&slice) // it is still crucial, GC can free it)

	// return result
	return
}

// FrozenView creates a static view of a serialized bitmap stored in buf.
// It uses CRoaring's frozen bitmap format.
//
// The format specification is available here:
// https://github.com/RoaringBitmap/CRoaring/blob/2c867e9f9c9e2a3a7032791f94c4c7ae3013f6e0/src/roaring.c#L2756-L2783
//
// The provided byte array (buf) is expected to be a constant.
// The function makes the best effort attempt not to copy data.
// Only little endian is supported. The function will err if it detects a big
// endian serialized file.
// You should take care not to modify buff as it will likely result in
// unexpected program behavior.
// If said buffer comes from a memory map, it's advisable to give it read
// only permissions, either at creation or by calling Mprotect from the
// golang.org/x/sys/unix package.
//
// Resulting bitmaps are effectively immutable in the following sense:
// a copy-on-write marker is used so that when you modify the resulting
// bitmap, copies of selected data (containers) are made.
// You should *not* change the copy-on-write status of the resulting
// bitmaps (SetCopyOnWrite).
//
// If buf becomes unavailable, then a bitmap created with
// FromBuffer would be effectively broken. Furthermore, any
// bitmap derived from this bitmap (e.g., via Or, And) might
// also be broken. Thus, before making buf unavailable, you should
// call CloneCopyOnWriteContainers on all such bitmaps.
func (rb *Bitmap) FrozenView(buf []byte) error {
	return rb.highlowcontainer.frozenView(buf)
}

/* Verbatim specification from CRoaring.
 *
 * FROZEN SERIALIZATION FORMAT DESCRIPTION
 *
 * -- (beginning must be aligned by 32 bytes) --
 * <bitset_data> uint64_t[BITSET_CONTAINER_SIZE_IN_WORDS * num_bitset_containers]
 * <run_data>    rle16_t[total number of rle elements in all run containers]
 * <array_data>  uint16_t[total number of array elements in all array containers]
 * <keys>        uint16_t[num_containers]
 * <counts>      uint16_t[num_containers]
 * <typecodes>   uint8_t[num_containers]
 * <header>      uint32_t
 *
 * <header> is a 4-byte value which is a bit union of frozenCookie (15 bits)
 * and the number of containers (17 bits).
 *
 * <counts> stores number of elements for every container.
 * Its meaning depends on container type.
 * For array and bitset containers, this value is the container cardinality minus one.
 * For run container, it is the number of rle_t elements (n_runs).
 *
 * <bitset_data>,<array_data>,<run_data> are flat arrays of elements of
 * all containers of respective type.
 *
 * <*_data> and <keys> are kept close together because they are not accessed
 * during deserilization. This may reduce IO in case of large mmaped bitmaps.
 * All members have their native alignments during deserilization except <header>,
 * which is not guaranteed to be aligned by 4 bytes.
 */
const frozenCookie = 13766

var (
	// ErrFrozenBitmapInvalidCookie is returned when the header does not contain the frozenCookie.
	ErrFrozenBitmapInvalidCookie = errors.New("header does not contain the frozenCookie")
	// ErrFrozenBitmapBigEndian is returned when the header is big endian.
	ErrFrozenBitmapBigEndian = errors.New("loading big endian frozen bitmaps is not supported")
	// ErrFrozenBitmapIncomplete is returned when the buffer is too small to contain a frozen bitmap.
	ErrFrozenBitmapIncomplete = errors.New("input buffer too small to contain a frozen bitmap")
	// ErrFrozenBitmapOverpopulated is returned when the number of containers is too large.
	ErrFrozenBitmapOverpopulated = errors.New("too many containers")
	// ErrFrozenBitmapUnexpectedData is returned when the buffer contains unexpected data.
	ErrFrozenBitmapUnexpectedData = errors.New("spurious data in input")
	// ErrFrozenBitmapInvalidTypecode is returned when the typecode is invalid.
	ErrFrozenBitmapInvalidTypecode = errors.New("unrecognized typecode")
	// ErrFrozenBitmapBufferTooSmall is returned when the buffer is too small.
	ErrFrozenBitmapBufferTooSmall = errors.New("buffer too small")
)

func (ra *roaringArray) frozenView(buf []byte) error {
	if len(buf) < 4 {
		return ErrFrozenBitmapIncomplete
	}

	headerBE := binary.BigEndian.Uint32(buf[len(buf)-4:])
	if headerBE&0x7fff == frozenCookie {
		return ErrFrozenBitmapBigEndian
	}

	header := binary.LittleEndian.Uint32(buf[len(buf)-4:])
	buf = buf[:len(buf)-4]

	if header&0x7fff != frozenCookie {
		return ErrFrozenBitmapInvalidCookie
	}

	nCont := int(header >> 15)
	if nCont > (1 << 16) {
		return ErrFrozenBitmapOverpopulated
	}

	// 1 byte per type, 2 bytes per key, 2 bytes per count.
	if len(buf) < 5*nCont {
		return ErrFrozenBitmapIncomplete
	}

	types := buf[len(buf)-nCont:]
	buf = buf[:len(buf)-nCont]

	counts := byteSliceAsUint16Slice(buf[len(buf)-2*nCont:])
	buf = buf[:len(buf)-2*nCont]

	keys := byteSliceAsUint16Slice(buf[len(buf)-2*nCont:])
	buf = buf[:len(buf)-2*nCont]

	nBitmap, nArray, nRun := 0, 0, 0
	nArrayEl, nRunEl := 0, 0
	for i, t := range types {
		switch t {
		case 1:
			nBitmap++
		case 2:
			nArray++
			nArrayEl += int(counts[i]) + 1
		case 3:
			nRun++
			nRunEl += int(counts[i])
		default:
			return ErrFrozenBitmapInvalidTypecode
		}
	}

	if len(buf) < (1<<13)*nBitmap+4*nRunEl+2*nArrayEl {
		return ErrFrozenBitmapIncomplete
	}

	bitsetsArena := byteSliceAsUint64Slice(buf[:(1<<13)*nBitmap])
	buf = buf[(1<<13)*nBitmap:]

	runsArena := byteSliceAsInterval16Slice(buf[:4*nRunEl])
	buf = buf[4*nRunEl:]

	arraysArena := byteSliceAsUint16Slice(buf[:2*nArrayEl])
	buf = buf[2*nArrayEl:]

	if len(buf) != 0 {
		return ErrFrozenBitmapUnexpectedData
	}

	var c container
	containersSz := int(unsafe.Sizeof(c)) * nCont
	bitsetsSz := int(unsafe.Sizeof(bitmapContainer{})) * nBitmap
	arraysSz := int(unsafe.Sizeof(arrayContainer{})) * nArray
	runsSz := int(unsafe.Sizeof(runContainer16{})) * nRun
	needCOWSz := int(unsafe.Sizeof(true)) * nCont

	bitmapArenaSz := containersSz + bitsetsSz + arraysSz + runsSz + needCOWSz
	bitmapArena := make([]byte, bitmapArenaSz)

	containers := byteSliceAsContainerSlice(bitmapArena[:containersSz])
	bitmapArena = bitmapArena[containersSz:]

	bitsets := byteSliceAsBitsetSlice(bitmapArena[:bitsetsSz])
	bitmapArena = bitmapArena[bitsetsSz:]

	arrays := byteSliceAsArraySlice(bitmapArena[:arraysSz])
	bitmapArena = bitmapArena[arraysSz:]

	runs := byteSliceAsRun16Slice(bitmapArena[:runsSz])
	bitmapArena = bitmapArena[runsSz:]

	needCOW := byteSliceAsBoolSlice(bitmapArena)

	iBitset, iArray, iRun := 0, 0, 0
	for i, t := range types {
		needCOW[i] = true

		switch t {
		case 1:
			containers[i] = &bitsets[iBitset]
			bitsets[iBitset].cardinality = int(counts[i]) + 1
			bitsets[iBitset].bitmap = bitsetsArena[:1024]
			bitsetsArena = bitsetsArena[1024:]
			iBitset++
		case 2:
			containers[i] = &arrays[iArray]
			sz := int(counts[i]) + 1
			arrays[iArray].content = arraysArena[:sz]
			arraysArena = arraysArena[sz:]
			iArray++
		case 3:
			containers[i] = &runs[iRun]
			runs[iRun].iv = runsArena[:counts[i]]
			runsArena = runsArena[counts[i]:]
			iRun++
		}
	}

	// Not consuming the full input is a bug.
	if iBitset != nBitmap || len(bitsetsArena) != 0 ||
		iArray != nArray || len(arraysArena) != 0 ||
		iRun != nRun || len(runsArena) != 0 {
		panic("we missed something")
	}

	ra.keys = keys
	ra.containers = containers
	ra.needCopyOnWrite = needCOW
	ra.copyOnWrite = true

	return nil
}

// GetFrozenSizeInBytes returns the size in bytes of the frozen bitmap.
func (rb *Bitmap) GetFrozenSizeInBytes() uint64 {
	nBits, nArrayEl, nRunEl := uint64(0), uint64(0), uint64(0)
	for _, c := range rb.highlowcontainer.containers {
		switch v := c.(type) {
		case *bitmapContainer:
			nBits++
		case *arrayContainer:
			nArrayEl += uint64(len(v.content))
		case *runContainer16:
			nRunEl += uint64(len(v.iv))
		}
	}
	return 4 + 5*uint64(len(rb.highlowcontainer.containers)) +
		(nBits << 13) + 2*nArrayEl + 4*nRunEl
}

// Freeze serializes the bitmap in the CRoaring's frozen format.
func (rb *Bitmap) Freeze() ([]byte, error) {
	sz := rb.GetFrozenSizeInBytes()
	buf := make([]byte, sz)
	_, err := rb.FreezeTo(buf)
	return buf, err
}

// FreezeTo serializes the bitmap in the CRoaring's frozen format.
func (rb *Bitmap) FreezeTo(buf []byte) (int, error) {
	containers := rb.highlowcontainer.containers
	nCont := len(containers)

	nBits, nArrayEl, nRunEl := 0, 0, 0
	for _, c := range containers {
		switch v := c.(type) {
		case *bitmapContainer:
			nBits++
		case *arrayContainer:
			nArrayEl += len(v.content)
		case *runContainer16:
			nRunEl += len(v.iv)
		}
	}

	serialSize := 4 + 5*nCont + (1<<13)*nBits + 4*nRunEl + 2*nArrayEl
	if len(buf) < serialSize {
		return 0, ErrFrozenBitmapBufferTooSmall
	}

	bitsArena := byteSliceAsUint64Slice(buf[:(1<<13)*nBits])
	buf = buf[(1<<13)*nBits:]

	runsArena := byteSliceAsInterval16Slice(buf[:4*nRunEl])
	buf = buf[4*nRunEl:]

	arraysArena := byteSliceAsUint16Slice(buf[:2*nArrayEl])
	buf = buf[2*nArrayEl:]

	keys := byteSliceAsUint16Slice(buf[:2*nCont])
	buf = buf[2*nCont:]

	counts := byteSliceAsUint16Slice(buf[:2*nCont])
	buf = buf[2*nCont:]

	types := buf[:nCont]
	buf = buf[nCont:]

	header := uint32(frozenCookie | (nCont << 15))
	binary.LittleEndian.PutUint32(buf[:4], header)

	copy(keys, rb.highlowcontainer.keys[:])

	for i, c := range containers {
		switch v := c.(type) {
		case *bitmapContainer:
			copy(bitsArena, v.bitmap)
			bitsArena = bitsArena[1024:]
			counts[i] = uint16(v.cardinality - 1)
			types[i] = 1
		case *arrayContainer:
			copy(arraysArena, v.content)
			arraysArena = arraysArena[len(v.content):]
			elems := len(v.content)
			counts[i] = uint16(elems - 1)
			types[i] = 2
		case *runContainer16:
			copy(runsArena, v.iv)
			runs := len(v.iv)
			runsArena = runsArena[runs:]
			counts[i] = uint16(runs)
			types[i] = 3
		}
	}

	return serialSize, nil
}

// WriteFrozenTo serializes the bitmap in the CRoaring's frozen format.
func (rb *Bitmap) WriteFrozenTo(wr io.Writer) (int, error) {
	// FIXME: this is a naive version that iterates 4 times through the
	// containers and allocates 3*len(containers) bytes; it's quite likely
	// it can be done more efficiently.
	containers := rb.highlowcontainer.containers
	written := 0

	for _, c := range containers {
		c, ok := c.(*bitmapContainer)
		if !ok {
			continue
		}
		n, err := wr.Write(uint64SliceAsByteSlice(c.bitmap))
		written += n
		if err != nil {
			return written, err
		}
	}

	for _, c := range containers {
		c, ok := c.(*runContainer16)
		if !ok {
			continue
		}
		n, err := wr.Write(interval16SliceAsByteSlice(c.iv))
		written += n
		if err != nil {
			return written, err
		}
	}

	for _, c := range containers {
		c, ok := c.(*arrayContainer)
		if !ok {
			continue
		}
		n, err := wr.Write(uint16SliceAsByteSlice(c.content))
		written += n
		if err != nil {
			return written, err
		}
	}

	n, err := wr.Write(uint16SliceAsByteSlice(rb.highlowcontainer.keys))
	written += n
	if err != nil {
		return written, err
	}

	countTypeBuf := make([]byte, 3*len(containers))
	counts := byteSliceAsUint16Slice(countTypeBuf[:2*len(containers)])
	types := countTypeBuf[2*len(containers):]

	for i, c := range containers {
		switch c := c.(type) {
		case *bitmapContainer:
			counts[i] = uint16(c.cardinality - 1)
			types[i] = 1
		case *arrayContainer:
			elems := len(c.content)
			counts[i] = uint16(elems - 1)
			types[i] = 2
		case *runContainer16:
			runs := len(c.iv)
			counts[i] = uint16(runs)
			types[i] = 3
		}
	}

	n, err = wr.Write(countTypeBuf)
	written += n
	if err != nil {
		return written, err
	}

	header := uint32(frozenCookie | (len(containers) << 15))
	if err := binary.Write(wr, binary.LittleEndian, header); err != nil {
		return written, err
	}
	written += 4

	return written, nil
}
