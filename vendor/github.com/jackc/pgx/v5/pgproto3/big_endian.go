package pgproto3

import (
	"encoding/binary"
)

type BigEndianBuf [8]byte

func (b BigEndianBuf) Int16(n int16) []byte {
	buf := b[0:2]
	binary.BigEndian.PutUint16(buf, uint16(n))
	return buf
}

func (b BigEndianBuf) Uint16(n uint16) []byte {
	buf := b[0:2]
	binary.BigEndian.PutUint16(buf, n)
	return buf
}

func (b BigEndianBuf) Int32(n int32) []byte {
	buf := b[0:4]
	binary.BigEndian.PutUint32(buf, uint32(n))
	return buf
}

func (b BigEndianBuf) Uint32(n uint32) []byte {
	buf := b[0:4]
	binary.BigEndian.PutUint32(buf, n)
	return buf
}

func (b BigEndianBuf) Int64(n int64) []byte {
	buf := b[0:8]
	binary.BigEndian.PutUint64(buf, uint64(n))
	return buf
}
