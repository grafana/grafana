//go:build !386 && !arm && !mips && !mipsle
// +build !386,!arm,!mips,!mipsle

package mssql

import (
	"fmt"
	"reflect"
	"unicode/utf16"
	"unsafe"
)

func ucs22str(s []byte) (string, error) {
	if len(s)%2 != 0 {
		return "", fmt.Errorf("illegal UCS2 string length: %d", len(s))
	}

	// allocate a buffer which we will attempt to copy ascii into, optimistically, as we validate
	buf := make([]byte, len(s)/2)
	useFastPath := true

	// how many 8 byte chunks are in the input buffer
	nlen8 := len(s) & 0xFFFFFFF8
	// our read and write offsets into the buffers
	var (
		readIndex  int
		writeIndex int
	)

	// step through in 8 byte chunks.
	for readIndex = 0; readIndex < nlen8; readIndex += 8 {

		// dereference directly into the array as uint64s
		ui64 := *(*uint64)(unsafe.Pointer(uintptr(unsafe.Pointer(&s[0])) + uintptr(readIndex)))

		// mask the entire 64 bit region and check for
		// 1) even bytes > 0
		// 2) odd bytes with their high bit set
		// the mask for this is FF80....
		if ui64&mask64 > 0 {
			// if we find a value once masked, we have to take the slow path as this is not an ascii string
			useFastPath = false
			break
		}

		// we are ok to read out the 4 odd bytes and remove the empty even bytes
		var ui32 uint32 = 0
		ui32 |= uint32(byte(ui64))
		ui64 = ui64 >> 8

		ui32 |= uint32(uint16(ui64))
		ui64 = ui64 >> 8

		ui32 |= uint32(ui64 & 0xFF0000)
		ui64 = ui64 >> 8
		ui32 |= uint32(ui64 & 0xFF000000)

		// write the new 32 bit value to the destination buffer
		ptrui32 := ((*uint32)(unsafe.Pointer(uintptr(unsafe.Pointer(&buf[0])) + uintptr(writeIndex))))
		*ptrui32 = ui32

		// step forward four bytes in the destinaiton buffer
		writeIndex += 4
	}

	// can we continue reading on the fast ascii path?
	if useFastPath {
		// we have now dealt with all the avalable 8 byte chunks, we have at most 7 bytes remaining.

		// have we got at least 4 bytes remaining to be read?
		if len(s)-readIndex >= 4 {
			// deal with the next 32 bit region

			// read 32 bits from the current read position in the source slice
			ui32 := *(*uint32)(unsafe.Pointer(uintptr(unsafe.Pointer(&s[0])) + uintptr(readIndex)))

			// mask the 32 bit value as above. again, if we find a value
			// this is not ascii and we need to fall back to the slow path
			// this time with a 32 bit mask
			if ui32&mask32 > 0 {
				// we have found non ascii text and must fallback
				useFastPath = false
			} else {

				// read the two odd positions bytes and write as a single 16 bit value
				var ui16 uint16 = 0
				ui16 |= uint16(byte(ui32))
				ui32 = ui32 >> 8

				ui16 |= uint16(ui32)

				ptrui16 := ((*uint16)(unsafe.Pointer(uintptr(unsafe.Pointer(&buf[0])) + uintptr((writeIndex)))))
				*ptrui16 = ui16

				// step forward the read and write positions.
				readIndex += 4
				writeIndex += 2
			}
		}

		// Are we still on the fast path?
		if useFastPath {
			// have we got at least 2 bytes remaining to be read?
			// actually we can only have at most 2 bytes at this point
			// since we know the source buffer has even length.
			if len(s)-readIndex >= 2 {

				// read 2 bytes
				ui16 := *(*uint16)(unsafe.Pointer(uintptr(unsafe.Pointer(&s[0])) + uintptr(readIndex)))

				// mask again, but only 16bits
				if ui16&mask16 == 0 {
					// manually pull out the low byte and write to our destination buffer
					buf[writeIndex] = byte(ui16 & 0xFF)
					// we have now successfully read the entire ascii buffer and can convert to a string
					return *(*string)(unsafe.Pointer(&buf)), nil
				}
			} else {
				// there were no further bytes to read, but we have successfully read the ascii
				// and can convert to a string
				return *(*string)(unsafe.Pointer(&buf)), nil
			}
		}
	}

	// one of the above checks has found non ascii values in the buffer, either
	// a high bit set in an odd byte or any non zero in an even byte.
	// we fall back to a slower conversion here.

	// we can reuse the underlying array and create our own uint16 slice here
	// because utf16.Decode allocates a new buffer and only reads its input.

	// declare a real uint16 slice so that the compiler can keep track of
	// the underlying memory as we transfer & convert it.
	// This is to ensure that the GC does not prematurely collect our data.
	var uint16slice []uint16

	uint16Header := (*reflect.SliceHeader)(unsafe.Pointer(&uint16slice))
	sourceHeader := (*reflect.SliceHeader)(unsafe.Pointer(&s))

	uint16Header.Data = sourceHeader.Data
	// it is important to reference s after the assignment of the Data
	// pointer to make sure that s is not garbage collected before
	// we have another reference to the data.
	uint16Header.Len = len(s) / 2       // the output is half the length in bytes
	uint16Header.Cap = uint16Header.Len // the capacity is also half the number of bytes

	// decode the uint16s as utf-16 and return a string.
	// After this point both s and uint16slice can be garbage collected.
	return string(utf16.Decode(uint16slice)), nil
}
