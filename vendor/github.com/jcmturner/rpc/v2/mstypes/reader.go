package mstypes

import (
	"bufio"
	"encoding/binary"
	"fmt"
	"io"
)

// Byte sizes of primitive types
const (
	SizeBool   = 1
	SizeChar   = 1
	SizeUint8  = 1
	SizeUint16 = 2
	SizeUint32 = 4
	SizeUint64 = 8
	SizeEnum   = 2
	SizeSingle = 4
	SizeDouble = 8
	SizePtr    = 4
)

// Reader reads simple byte stream data into a Go representations
type Reader struct {
	r *bufio.Reader // source of the data
}

// NewReader creates a new instance of a simple Reader.
func NewReader(r io.Reader) *Reader {
	reader := new(Reader)
	reader.r = bufio.NewReader(r)
	return reader
}

func (r *Reader) Read(p []byte) (n int, err error) {
	return r.r.Read(p)
}

func (r *Reader) Uint8() (uint8, error) {
	b, err := r.r.ReadByte()
	if err != nil {
		return uint8(0), err
	}
	return uint8(b), nil
}

func (r *Reader) Uint16() (uint16, error) {
	b, err := r.ReadBytes(SizeUint16)
	if err != nil {
		return uint16(0), err
	}
	return binary.LittleEndian.Uint16(b), nil
}

func (r *Reader) Uint32() (uint32, error) {
	b, err := r.ReadBytes(SizeUint32)
	if err != nil {
		return uint32(0), err
	}
	return binary.LittleEndian.Uint32(b), nil
}

func (r *Reader) Uint64() (uint64, error) {
	b, err := r.ReadBytes(SizeUint64)
	if err != nil {
		return uint64(0), err
	}
	return binary.LittleEndian.Uint64(b), nil
}

func (r *Reader) FileTime() (f FileTime, err error) {
	f.LowDateTime, err = r.Uint32()
	if err != nil {
		return
	}
	f.HighDateTime, err = r.Uint32()
	if err != nil {
		return
	}
	return
}

// UTF16String returns a string that is UTF16 encoded in a byte slice. n is the number of bytes representing the string
func (r *Reader) UTF16String(n int) (str string, err error) {
	//Length divided by 2 as each run is 16bits = 2bytes
	s := make([]rune, n/2, n/2)
	for i := 0; i < len(s); i++ {
		var u uint16
		u, err = r.Uint16()
		if err != nil {
			return
		}
		s[i] = rune(u)
	}
	str = string(s)
	return
}

// readBytes returns a number of bytes from the NDR byte stream.
func (r *Reader) ReadBytes(n int) ([]byte, error) {
	//TODO make this take an int64 as input to allow for larger values on all systems?
	b := make([]byte, n, n)
	m, err := r.r.Read(b)
	if err != nil || m != n {
		return b, fmt.Errorf("error reading bytes from stream: %v", err)
	}
	return b, nil
}
